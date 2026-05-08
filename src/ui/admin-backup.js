import {
    users,
    GLOBAL_SETTINGS_ID,
    isSystemUserId,
    replaceUsers
} from '../api/user.js';
import { getBackupDateStamp } from '../utils/export-format.js';
import { showCustomAlert, showCustomConfirm } from './modal.js';
import {
    loadAdminAuditLog,
    recordAdminAudit,
    restoreAdminAuditLog
} from './admin-audit.js';

function countStudentRows(collection) {
    if (!collection || typeof collection !== 'object') return 0;
    return getImportedStudentIds(collection).length;
}

function getImportedStudentIds(collection) {
    if (!collection || typeof collection !== 'object') return [];
    return Object.keys(collection).filter(userId => {
        const row = collection[userId];
        return row && typeof row === 'object' && !Array.isArray(row) && !row.isMaster && !isSystemUserId(userId);
    });
}

function getImportedDisplayName(userId, row) {
    return String(row?.displayName || row?.name || row?.studentName || userId || '').trim();
}

function inspectImportedUsers(collection) {
    const result = {
        invalidRows: [],
        legacyStudentIds: [],
        missingDisplayNames: [],
        userDataIdMismatches: [],
        duplicateDisplayNames: []
    };

    if (!collection || typeof collection !== 'object' || Array.isArray(collection)) {
        result.invalidRows.push('(root)');
        return result;
    }

    const displayNameMap = new Map();
    Object.keys(collection).forEach(userId => {
        if (isSystemUserId(userId)) return;
        const row = collection[userId];
        if (!row || typeof row !== 'object' || Array.isArray(row)) {
            result.invalidRows.push(userId);
            return;
        }
        if (row.isMaster) return;

        if (!String(userId).startsWith('student_')) result.legacyStudentIds.push(userId);
        if (!row.userDataId || row.userDataId !== userId) result.userDataIdMismatches.push(userId);

        const displayName = getImportedDisplayName(userId, row);
        if (!displayName) {
            result.missingDisplayNames.push(userId);
        } else {
            const sameNameIds = displayNameMap.get(displayName) || [];
            sameNameIds.push(userId);
            displayNameMap.set(displayName, sameNameIds);
        }
    });

    displayNameMap.forEach(userIds => {
        if (userIds.length > 1) result.duplicateDisplayNames.push(...userIds);
    });

    return result;
}

function hasImportBlockingIssues(validation) {
    return [
        validation.invalidRows,
        validation.legacyStudentIds,
        validation.missingDisplayNames,
        validation.userDataIdMismatches,
        validation.duplicateDisplayNames
    ].some(rows => rows.length > 0);
}

function formatImportCheckLine(label, count, okText) {
    return count === 0 ? `${label}: ${okText}` : `${label}: ${count}件 要確認`;
}

function buildImportSafetySummary(validation) {
    return [
        '【移行安全チェック】',
        formatImportCheckLine('児童ID', validation.legacyStudentIds.length, '内部ID OK'),
        formatImportCheckLine('表示名', validation.missingDisplayNames.length, 'OK'),
        formatImportCheckLine('userDataId', validation.userDataIdMismatches.length, 'OK'),
        formatImportCheckLine('表示名の重複', validation.duplicateDisplayNames.length, 'OK'),
        formatImportCheckLine('不正行', validation.invalidRows.length, 'OK')
    ].join('\n');
}

function buildBackupPayload() {
    return {
        app: 'd-lesson',
        version: 3,
        exportedAt: new Date().toISOString(),
        users,
        adminAuditLog: loadAdminAuditLog()
    };
}

function downloadJsonFile(payload, prefix) {
    const dataStr = JSON.stringify(payload, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${prefix}_${getBackupDateStamp()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    return a.download;
}

function buildImportSummary(file, importedData, importedUsers, validation = inspectImportedUsers(importedUsers)) {
    const exportedAt = importedData?.exportedAt ? new Date(importedData.exportedAt).toLocaleString('ja-JP') : '不明';
    const auditCount = Array.isArray(importedData?.adminAuditLog) ? importedData.adminAuditLog.length : 0;
    const summary = [
        '【復元前の確認】現在のデータが上書きされます。',
        '',
        `ファイル: ${file.name}`,
        `バックアップ日時: ${exportedAt}`,
        `児童データ: ${countStudentRows(importedUsers)}件`,
        `設定データ: ${importedUsers?.[GLOBAL_SETTINGS_ID] ? 'あり' : 'なし'}`,
        `操作ログ: ${auditCount}件`,
        '',
        '現在のデータは、復元前に自動バックアップとして保存します。',
        'この内容で復元しますか？'
    ].join('\n');
    return `${summary}\n\n${buildImportSafetySummary(validation)}`;
}

export function exportAdminBackupData() {
    recordAdminAudit('データバックアップ', { students: countStudentRows(users) });
    const backup = buildBackupPayload();
    downloadJsonFile(backup, 'd-lesson_backup');
}

export function importAdminBackupData(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const importedData = JSON.parse(e.target.result);
            const importedUsers = importedData?.users || importedData;
            if (typeof importedUsers !== 'object' || importedUsers === null || Array.isArray(importedUsers)) {
                showCustomAlert('データ形式が正しくありません。');
                event.target.value = '';
                return;
            }
            const validation = inspectImportedUsers(importedUsers);
            if (hasImportBlockingIssues(validation)) {
                showCustomAlert([
                    '復元を中止しました。',
                    '',
                    '旧式の児童ID、表示名の重複、または不正な行が含まれています。',
                    '旧Dレッスンのバックアップは、先に convert:legacy-users で変換してください。',
                    '',
                    buildImportSafetySummary(validation)
                ].join('\n'));
                event.target.value = '';
                return;
            }

            showCustomConfirm(buildImportSummary(file, importedData, importedUsers, validation), async () => {
                try {
                    const autoBackup = buildBackupPayload();
                    const autoBackupFile = downloadJsonFile(autoBackup, 'd-lesson_before_restore');
                    await replaceUsers(importedUsers, true);
                    restoreAdminAuditLog(importedData?.adminAuditLog, {
                        file: file.name,
                        students: countStudentRows(importedUsers),
                        autoBackup: autoBackupFile
                    });
                    showCustomAlert('データを正常に復元しました！\n画面を再読み込みします。');
                    setTimeout(() => location.reload(), 1500);
                } catch (err) {
                    console.error('Restore failed:', err);
                    showCustomAlert('復元に失敗しました。現在のデータは変更されていません。');
                }
            });
        } catch (err) {
            showCustomAlert('ファイルの読み込みに失敗しました。JSONファイルを選択してください。');
        }
        event.target.value = '';
    };
    reader.onerror = () => {
        showCustomAlert('ファイルの読み込みに失敗しました。');
        event.target.value = '';
    };
    reader.readAsText(file);
}
