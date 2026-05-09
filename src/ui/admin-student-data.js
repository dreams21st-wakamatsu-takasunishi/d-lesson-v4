import {
    users,
    saveUsers,
    createUserDataId,
    getUserDisplayName,
    isSystemUserId,
    deleteCloudUserRows,
    userDisplayNameExists
} from '../api/user.js';
import { calculateGrade } from '../utils/helpers.js';
import { escapeCsvCell, getBackupDateStamp } from '../utils/export-format.js';
import { showCustomAlert, showCustomConfirm } from './modal.js';
import { recordAdminAudit } from './admin-audit.js';

function runAfterChange(afterChange) {
    if (typeof afterChange === 'function') afterChange();
}

function createStudentRecord(name, birthdate, group) {
    const grade = calculateGrade(birthdate);
    let userDataId = createUserDataId();
    while (users[userDataId]) userDataId = createUserDataId();

    users[userDataId] = {
        displayName: name,
        userDataId,
        birthdate,
        grade,
        mouseLevel: 1,
        keyboardSequence: 0,
        coins: 0,
        items: [],
        tickets: [],
        loginStamps: [],
        group
    };
    return userDataId;
}

export function adminAddUser(afterChange) {
    const name = document.getElementById('admin-add-name').value.trim();
    const birthdate = document.getElementById('admin-add-birth').value;
    const group = document.getElementById('admin-add-group').value.trim();

    if (!name) return showCustomAlert('名前を入力してください');
    if (userDisplayNameExists(name)) return showCustomAlert('その名前はすでに登録されています');
    if (!birthdate) return showCustomAlert('生年月日を入力してください');

    const userDataId = createStudentRecord(name, birthdate, group);
    recordAdminAudit('児童追加', {
        user: name,
        userDataId,
        birthdate,
        group
    });
    saveUsers(true);
    document.getElementById('admin-add-name').value = '';
    document.getElementById('admin-add-group').value = '';
    runAfterChange(afterChange);
    showCustomAlert(`${name} さんを追加しました！`);
}

export function adminBulkAddUsers(afterChange) {
    const textarea = document.getElementById('admin-bulk-names');
    const text = textarea?.value || '';
    if (!text.trim()) return showCustomAlert('入力してください');

    let added = 0;
    text.split('\n').forEach(line => {
        if (!line.trim()) return;
        const parts = line.split(/[,、\s]+/);
        const name = parts[0].trim();
        const birthdate = parts.length > 1 ? parts[1].trim() : '2015-04-01';
        const group = parts.length > 2 ? parts[2].trim() : '';
        if (name && !userDisplayNameExists(name)) {
            createStudentRecord(name, birthdate, group);
            added++;
        }
    });

    recordAdminAudit('児童一括追加', { count: added });
    saveUsers(true);
    runAfterChange(afterChange);
    if (textarea) textarea.value = '';
    showCustomAlert(`${added} 人を追加しました！`);
}

function parseCsvLine(line) {
    const cells = [];
    let cell = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        const next = line[i + 1];
        if (ch === '"' && inQuotes && next === '"') {
            cell += '"';
            i++;
        } else if (ch === '"') {
            inQuotes = !inQuotes;
        } else if (ch === ',' && !inQuotes) {
            cells.push(cell.trim());
            cell = '';
        } else {
            cell += ch;
        }
    }
    cells.push(cell.trim());
    return cells;
}

function normalizeCsvKey(key) {
    const value = String(key || '').trim().toLowerCase();
    if (['id', 'user_id', 'user_data_id', 'userdataid'].includes(value)) return 'userDataId';
    if (['name', 'displayname', 'display_name', '名前'].includes(value)) return 'displayName';
    if (['birth', 'birthdate', 'birthday', '生年月日'].includes(value)) return 'birthdate';
    if (['group', 'class', 'グループ'].includes(value)) return 'group';
    return value;
}

export function exportStudentCsv() {
    const rows = [['user_data_id', 'name', 'birthdate', 'group']];
    Object.keys(users)
        .filter(userDataId => users[userDataId] && !users[userDataId].isMaster && !isSystemUserId(userDataId))
        .sort((a, b) => getUserDisplayName(a).localeCompare(getUserDisplayName(b), 'ja'))
        .forEach(userDataId => {
            const user = users[userDataId];
            rows.push([
                userDataId,
                getUserDisplayName(userDataId),
                user.birthdate || user.birth || '',
                user.group || ''
            ]);
        });

    const csv = rows.map(row => row.map(escapeCsvCell).join(',')).join('\r\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `d-lesson_students_${getBackupDateStamp()}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);

    recordAdminAudit('児童CSV出力', { students: rows.length - 1 });
}

export function applyStudentCsvUpdates(afterChange) {
    const textarea = document.getElementById('admin-bulk-update-csv');
    const raw = textarea?.value || '';
    const lines = raw.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
    if (lines.length < 2) return showCustomAlert('ヘッダー行と更新する児童行を入力してください。');

    const headers = parseCsvLine(lines[0]).map(normalizeCsvKey);
    const idIndex = headers.indexOf('userDataId');
    if (idIndex === -1) return showCustomAlert('CSVに user_data_id 列が必要です。');

    let updated = 0;
    let skipped = 0;
    const duplicateNames = [];

    for (let i = 1; i < lines.length; i++) {
        const cells = parseCsvLine(lines[i]);
        const row = {};
        headers.forEach((header, index) => {
            row[header] = cells[index] ?? '';
        });

        const userDataId = row.userDataId;
        if (!userDataId || !users[userDataId] || isSystemUserId(userDataId)) {
            skipped++;
            continue;
        }

        const user = users[userDataId];
        let changed = false;
        const before = {
            displayName: getUserDisplayName(userDataId),
            birthdate: user.birthdate || user.birth || '',
            group: user.group || ''
        };

        if (Object.prototype.hasOwnProperty.call(row, 'displayName')) {
            const displayName = row.displayName.trim();
            if (displayName && displayName !== before.displayName) {
                if (userDisplayNameExists(displayName, userDataId)) {
                    duplicateNames.push(displayName);
                    skipped++;
                    continue;
                }
                user.displayName = displayName;
                changed = true;
            }
        }

        if (Object.prototype.hasOwnProperty.call(row, 'birthdate')) {
            const birthdate = row.birthdate.trim();
            if (birthdate && birthdate !== before.birthdate) {
                user.birthdate = birthdate;
                user.grade = calculateGrade(birthdate);
                changed = true;
            }
        }

        if (Object.prototype.hasOwnProperty.call(row, 'group')) {
            const group = row.group.trim();
            if (group !== before.group) {
                user.group = group;
                changed = true;
            }
        }

        if (changed) updated++;
    }

    if (updated > 0) {
        recordAdminAudit('児童CSV一括更新', { updated, skipped });
        saveUsers(true);
        runAfterChange(afterChange);
    }

    const duplicateText = duplicateNames.length
        ? `\n重複名のため反映しなかった名前: ${duplicateNames.join(', ')}`
        : '';
    showCustomAlert(`CSV反映が完了しました。\n更新: ${updated}件\nスキップ: ${skipped}件${duplicateText}`);
}

export function adminDeleteUser(userDataId, afterChange) {
    if (!userDataId) return;

    showCustomConfirm(`${getUserDisplayName(userDataId)}さんを削除しますか？`, async () => {
        const displayName = getUserDisplayName(userDataId);
        try {
            await deleteCloudUserRows(userDataId);
            delete users[userDataId];
            const saved = await saveUsers(true);
            if (!saved) throw new Error('Failed to persist deletion');
            recordAdminAudit('児童削除', { user: displayName, userDataId });
            runAfterChange(afterChange);
            showCustomAlert(`${displayName} さんを削除しました。`);
        } catch (error) {
            console.error('Delete user failed:', error);
            showCustomAlert('削除に失敗しました。データは変更されていません。');
        }
    });
}

export function adminAddCoins(userDataId, afterChange) {
    if (!userDataId || !users[userDataId]) {
        showCustomAlert('ユーザーを選択してください');
        return;
    }

    const amount = parseInt(document.getElementById('admin-custom-coin-amount').value, 10);
    if (Number.isNaN(amount) || amount <= 0) {
        showCustomAlert('正しいコイン数を入力してください');
        return;
    }

    users[userDataId].coins = (users[userDataId].coins || 0) + amount;
    recordAdminAudit('コイン付与', {
        user: getUserDisplayName(userDataId),
        userDataId,
        amount,
        coins: users[userDataId].coins
    });
    saveUsers(true);
    runAfterChange(afterChange);
    showCustomAlert(`${getUserDisplayName(userDataId)} さんに ${amount} コインを付与しました！\n（現在のコイン: ${users[userDataId].coins}枚）`);
}
