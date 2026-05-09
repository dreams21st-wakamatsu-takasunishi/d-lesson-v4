import {
    users,
    saveUsers,
    hasLessonRole,
    getCurrentLessonRole,
    getTeacherScopeSummary,
    refreshCurrentLessonAccess,
    HAS_SUPABASE_CONFIG,
    ENABLE_LEGACY_SUPABASE_SYNC,
    ENABLE_RLS_CLOUD_SYNC,
    ENABLE_SETTINGS_TABLE,
    REQUIRE_SUPABASE_AUTH,
    supabase,
    GLOBAL_SETTINGS_ID,
    SETTINGS_TABLE_KEY,
    createUserDataId,
    getUserDisplayName,
    isSystemUserId,
    deleteCloudUserRows,
    userDisplayNameExists,
    getStudentIdleLogoutMinutes,
    refreshStudentIdleLogoutTimer
} from '../api/user.js';
import { STAGE_ORDER, THEMES, EFFECTS } from '../data/constants.js';
import { SoundManager } from '../utils/sound.js';
import { showCustomAlert, showCustomConfirm } from './modal.js';
import { showScreen } from './screen.js';
import { calculateGrade, sortGrades } from '../utils/helpers.js';
import { escapeCsvCell, getBackupDateStamp } from '../utils/export-format.js';
import { getLegacyAdminPassStatus } from '../utils/security.js';
import { getStageName } from '../utils/stages.js';
import {
    recordAdminAudit,
    renderAdminAuditLog as renderAdminAuditLogImpl,
    exportAdminAuditCsv as exportAdminAuditCsvImpl
} from './admin-audit.js';
import {
    exportAdminBackupData,
    importAdminBackupData
} from './admin-backup.js';
import {
    openStudentReportPanel,
    closeStudentReportPanel,
    printStudentReportPanel
} from './admin-student-report.js';
import {
    renderPracticeHistoryPanel,
    clearPracticeHistoryPanelFilters,
    exportPracticeHistoryPanelCsv
} from './admin-practice-history.js';
import {
    switchDashTab as switchDashTabImpl,
    renderDashboardTable as renderDashboardTableImpl,
    renderVisionDashboardTable as renderVisionDashboardTableImpl
} from './admin-dashboard.js';
import {
    adminAddTextTask as adminAddTextTaskImpl,
    editTextTask as editTextTaskImpl,
    moveTextTask as moveTextTaskImpl,
    renderAdminTextTasks as renderAdminTextTasksImpl,
    deleteTextTask as deleteTextTaskImpl,
    insertRuby as insertRubyImpl,
    toggleAutoRubyTool as toggleAutoRubyToolImpl,
    generateAutoRuby as generateAutoRubyImpl,
    processAutoRuby as processAutoRubyImpl
} from './admin-text-tasks.js';
import {
    openThemeCreator as openThemeCreatorImpl,
    closeThemeCreator as closeThemeCreatorImpl,
    updateThemePreview as updateThemePreviewImpl,
    saveCustomTheme as saveCustomThemeImpl,
    openEffectCreator as openEffectCreatorImpl,
    closeEffectCreator as closeEffectCreatorImpl,
    saveCustomEffect as saveCustomEffectImpl,
    openCustomManager as openCustomManagerImpl,
    closeCustomManager as closeCustomManagerImpl,
    renderCustomManagerList as renderCustomManagerListImpl,
    deleteCustomElement as deleteCustomElementImpl
} from './admin-custom.js';
import {
    renderTicketAdmin as renderTicketAdminImpl,
    saveTicketSettings as saveTicketSettingsImpl
} from './admin-tickets.js';

export function renderAdminAuditLog() {
    renderAdminAuditLogImpl();
}

export function exportAdminAuditCsv() {
    exportAdminAuditCsvImpl();
}

export function adminAddUser() {
    const name = document.getElementById('admin-add-name').value.trim();
    const birth = document.getElementById('admin-add-birth').value;
    const grp = document.getElementById('admin-add-group').value.trim(); 
    if(!name) return showCustomAlert("名前を入力してください");
    if(userDisplayNameExists(name)) return showCustomAlert("その名前はすでに登録されています");
    if(!birth) return showCustomAlert("生年月日を入力してください");
    const grade = calculateGrade(birth);
    let userId = createUserDataId();
    while (users[userId]) userId = createUserDataId();
    users[userId] = { displayName: name, userDataId: userId, birthdate: birth, grade: grade, mouseLevel: 1, keyboardSequence: 0, coins: 0, items: [], tickets:[], loginStamps:[], group: grp };
    recordAdminAudit('児童追加', { user: name, userDataId: userId, birthdate: birth, group: grp });
    saveUsers(true);
    document.getElementById('admin-add-name').value = '';
    document.getElementById('admin-add-group').value = '';
    updateAdminUserTable(); renderDashboardTable(); showCustomAlert(`${name} さんを追加しました！`);
}

export function adminBulkAddUsers() {
    const text = document.getElementById('admin-bulk-names').value;
    if(!text.trim()) return showCustomAlert("入力してください");
    const lines = text.split('\n');
    let added = 0;
    lines.forEach(line => {
        if(!line.trim()) return;
        let parts = line.split(/[,、]+/);
        let name = parts[0].trim();
        let birth = parts.length > 1 ? parts[1].trim() : "2015-04-01";
        let grp = parts.length > 2 ? parts[2].trim() : ""; 
        if(name && !userDisplayNameExists(name)) {
            let grade = calculateGrade(birth);
            let userId = createUserDataId();
            while (users[userId]) userId = createUserDataId();
            users[userId] = { displayName: name, userDataId: userId, birthdate: birth, grade: grade, mouseLevel: 1, keyboardSequence: 0, coins: 0, items: [], tickets:[], loginStamps:[], group: grp };
            added++;
        }
    });
    recordAdminAudit('児童一括追加', { count: added });
    saveUsers(true); updateAdminUserTable(); renderDashboardTable();
    document.getElementById('admin-bulk-names').value = '';
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
        .filter(userId => users[userId] && !users[userId].isMaster && !isSystemUserId(userId))
        .sort((a, b) => getUserDisplayName(a).localeCompare(getUserDisplayName(b), 'ja'))
        .forEach(userId => {
            const user = users[userId];
            rows.push([
                userId,
                getUserDisplayName(userId),
                user.birthdate || user.birth || '',
                user.group || ''
            ]);
        });

    const csv = rows.map(row => row.map(escapeCsvCell).join(',')).join('\r\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `d-lesson_students_${getBackupDateStamp()}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    recordAdminAudit('児童CSV出力', { students: rows.length - 1 });
}

export function applyStudentCsvUpdates() {
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
        headers.forEach((header, idx) => { row[header] = cells[idx] ?? ''; });

        const userId = row.userDataId;
        if (!userId || !users[userId] || isSystemUserId(userId)) {
            skipped++;
            continue;
        }

        const user = users[userId];
        let changed = false;
        const before = {
            displayName: getUserDisplayName(userId),
            birthdate: user.birthdate || user.birth || '',
            group: user.group || ''
        };

        if (Object.prototype.hasOwnProperty.call(row, 'displayName')) {
            const displayName = row.displayName.trim();
            if (displayName && displayName !== before.displayName) {
                if (userDisplayNameExists(displayName, userId)) {
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
        updateAdminUserTable();
        renderDashboardTable();
    }

    const duplicateText = duplicateNames.length ? `\n重複名のため反映しなかった名前: ${duplicateNames.join(', ')}` : '';
    showCustomAlert(`CSV反映が完了しました。\n更新: ${updated}件\nスキップ: ${skipped}件${duplicateText}`);
}

export function adminDeleteUser() {
    const n = getSelUser();
    if(n) { 
        showCustomConfirm(`${getUserDisplayName(n)}さんを削除しますか？`, async () => {
            const displayName = getUserDisplayName(n);
            try {
                await deleteCloudUserRows(n);
                delete users[n];
                const saved = await saveUsers(true);
                if (!saved) throw new Error('Failed to persist deletion');
                recordAdminAudit('児童削除', { user: displayName, userDataId: n });
                updateAdminUserTable();
                renderDashboardTable();
                showCustomAlert(`${displayName} さんを削除しました。`);
            } catch (err) {
                console.error('Delete user failed:', err);
                showCustomAlert('削除に失敗しました。データは変更されていません。');
            }
        });
    }
}
export function adminAddCoins() { 
    const n = getSelUser(); 
    if (!n || !users[n]) return showCustomAlert('ユーザーを選択してください'); 
    const amt = parseInt(document.getElementById('admin-custom-coin-amount').value, 10);
    if(isNaN(amt) || amt <= 0) return showCustomAlert('正しいコイン数を入力してください');
    users[n].coins = (users[n].coins || 0) + amt; 
    recordAdminAudit('コイン付与', { user: getUserDisplayName(n), userDataId: n, amount: amt, coins: users[n].coins });
    saveUsers(true); 
    showCustomAlert(`${getUserDisplayName(n)} さんに ${amt} コインを付与しました！\n（現在のコイン: ${users[n].coins}枚）`);
}

export function showAdminSection(secId) {
    document.getElementById('admin-main-menu').style.display = 'none';
    document.getElementById('admin-panel-content').style.display = 'flex';
    document.getElementById('admin-bottom-back-btn').style.display = 'none'; 
    document.querySelectorAll('.admin-section').forEach(sec => sec.style.display = 'none');
    const target = document.getElementById(secId);
    if(target) {
        target.style.display = 'flex';
        target.style.flexDirection = 'column';
        if(secId === 'admin-sec-dashboard') switchDashTab('basic'); 
        if(secId === 'admin-sec-practice-history') renderPracticeHistoryAdmin();
        if(secId === 'admin-sec-auth-link') renderAuthLinkingAdmin();
        if(secId === 'admin-sec-backup') renderAdminAuditLog();
        if(secId === 'admin-sec-ops-guide') renderOpsGuideAdmin();
    }
}

export function backToAdminMenu() {
    document.getElementById('admin-main-menu').style.display = 'flex';
    document.getElementById('admin-panel-content').style.display = 'none';
    document.getElementById('admin-bottom-back-btn').style.display = 'block';
}

function openAdminScreen() {
    updateAdminUserTable();
    renderAdminTextTasks();
    renderTicketAdmin();
    renderPracticeHistoryAdmin();
    backToAdminMenu();
    showScreen('screen-admin');
}

export async function openAdmin() {
    await refreshCurrentLessonAccess();

    if (hasLessonRole('admin')) {
        openAdminScreen();
        return;
    }

    showCustomAlert('管理者アカウントでログインしてください。');
}

export function renderTicketAdmin() {
    renderTicketAdminImpl();
}

export function saveTicketSettings() {
    saveTicketSettingsImpl();
}

function renderOpsStatusCard(label, value, tone = 'neutral') {
    const colors = {
        good: ['#e8f5e9', '#2e7d32'],
        warn: ['#fff8e1', '#ef6c00'],
        bad: ['#ffebee', '#c62828'],
        neutral: ['#eceff1', '#37474f']
    };
    const [bg, color] = colors[tone] || colors.neutral;
    return `
        <div style="background:${bg}; border:1px solid ${color}; border-radius:8px; padding:12px;">
            <div style="font-size:12px; color:#546e7a; margin-bottom:4px;">${escapeHtml(label)}</div>
            <div style="font-size:18px; font-weight:bold; color:${color};">${escapeHtml(value)}</div>
        </div>
      `;
  }

function ensureGlobalSettings() {
    if (!users[GLOBAL_SETTINGS_ID]) users[GLOBAL_SETTINGS_ID] = { isMaster: true };
    users[GLOBAL_SETTINGS_ID].isMaster = true;
    return users[GLOBAL_SETTINGS_ID];
}

function renderStudentIdleLogoutSetting() {
    const input = document.getElementById('student-idle-logout-minutes');
    if (!input) return;
    input.value = String(getStudentIdleLogoutMinutes());
}

export async function saveStudentIdleLogoutSetting() {
    const input = document.getElementById('student-idle-logout-minutes');
    const rawValue = input?.value ?? '';
    const minutes = Number.parseInt(rawValue, 10);

    if (!Number.isFinite(minutes) || minutes < 0 || minutes > 240) {
        showCustomAlert('0〜240分の範囲で入力してください。0分にすると児童の自動ログアウトは無効になります。');
        renderStudentIdleLogoutSetting();
        return;
    }

    const before = getStudentIdleLogoutMinutes();
    const settings = ensureGlobalSettings();
    settings.studentIdleLogoutMinutes = minutes;

    recordAdminAudit('児童自動ログアウト設定変更', {
        before: before > 0 ? `${before}分` : '無効',
        after: minutes > 0 ? `${minutes}分` : '無効'
    });

    const saved = await saveUsers(true);
    refreshStudentIdleLogoutTimer();
    renderOpsGuideAdmin();

    if (!saved) {
        showCustomAlert('設定を保存しましたが、クラウド同期が完了していません。通信状態を確認してください。');
        return;
    }

    showCustomAlert(minutes > 0
        ? `児童の自動ログアウトを ${minutes}分 に設定しました。`
        : '児童の自動ログアウトを無効にしました。'
    );
}
  
  function getStudentUserIds() {
    return Object.keys(users).filter(userId => (
        users[userId]
        && !users[userId].isMaster
        && !isSystemUserId(userId)
    ));
}

function getLegacyStudentIdRows() {
    return getStudentUserIds()
        .filter(userId => !String(userId).startsWith('student_'))
        .map(userId => ({
            userId,
            displayName: getUserDisplayName(userId),
            userDataId: users[userId]?.userDataId || ''
        }));
}

function getUserDataIdMismatchRows() {
    return getStudentUserIds()
        .filter(userId => users[userId]?.userDataId && users[userId].userDataId !== userId)
        .map(userId => ({
            userId,
            displayName: getUserDisplayName(userId),
            userDataId: users[userId]?.userDataId || ''
        }));
}

function renderOpsUserIdDetails(anchor, legacyRows, mismatchRows) {
    let detail = document.getElementById('ops-user-id-detail');
    if (!detail) {
        detail = document.createElement('div');
        detail.id = 'ops-user-id-detail';
        detail.style.cssText = 'width:min(1000px, 96%); background:#fff; border:1px solid #ddd; border-radius:8px; padding:14px; box-sizing:border-box;';
        anchor.insertAdjacentElement('afterend', detail);
    }

    const rowHtml = legacyRows.slice(0, 12).map(row => `
        <tr>
            <td style="border:1px solid #ddd; padding:6px;">${escapeHtml(row.displayName)}</td>
            <td style="border:1px solid #ddd; padding:6px; font-family:monospace;">${escapeHtml(row.userId)}</td>
            <td style="border:1px solid #ddd; padding:6px; font-family:monospace;">${escapeHtml(row.userDataId || '-')}</td>
        </tr>
    `).join('');
    const moreText = legacyRows.length > 12 ? `<p style="margin:8px 0 0; color:#ef6c00; font-size:13px;">ほか ${legacyRows.length - 12} 件あります。SQL確認で全件を確認してください。</p>` : '';
    const mismatchText = mismatchRows.length
        ? `<p style="margin:8px 0 0; color:#c62828; font-size:13px;">data.userDataId と行IDが一致しない児童が ${mismatchRows.length} 件あります。内部ID移行前後の確認が必要です。</p>`
        : '';

    detail.innerHTML = legacyRows.length
        ? `
            <h4 style="margin:0 0 8px; color:#bf360c;">児童IDの確認が必要です</h4>
            <p style="margin:0 0 10px; color:#555; font-size:14px;">DB行のIDに児童名が残っている可能性があります。公開運用で実名データを入れる前に、内部ID移行手順を確認してください。</p>
            <table style="width:100%; border-collapse:collapse; font-size:13px;">
                <thead>
                    <tr>
                        <th style="border:1px solid #ddd; padding:6px; background:#fff3e0;">表示名</th>
                        <th style="border:1px solid #ddd; padding:6px; background:#fff3e0;">現在の行ID</th>
                        <th style="border:1px solid #ddd; padding:6px; background:#fff3e0;">data.userDataId</th>
                    </tr>
                </thead>
                <tbody>${rowHtml}</tbody>
            </table>
            ${moreText}
            ${mismatchText}
            <div style="display:flex; gap:10px; flex-wrap:wrap; margin-top:12px;">
                <button class="btn-secondary" onclick="copyInternalIdCheckGuide()" style="font-size:13px; padding:8px 12px;">SQL確認手順をコピー</button>
            </div>
        `
        : `
            <h4 style="margin:0 0 8px; color:#2e7d32;">児童IDは内部ID形式です</h4>
            <p style="margin:0; color:#555; font-size:14px;">画面に読み込まれている児童は student_... の行IDで保存されています。本番公開前はSQLでも user_data 側を確認してください。</p>
            ${mismatchText}
            <div style="display:flex; gap:10px; flex-wrap:wrap; margin-top:12px;">
                <button class="btn-secondary" onclick="copyInternalIdCheckGuide()" style="font-size:13px; padding:8px 12px;">SQL確認手順をコピー</button>
            </div>
        `;
}

function renderOpsGuideAdminLegacy() {
    const grid = document.getElementById('ops-status-grid');
    if (!grid) return;

    const syncText = document.getElementById('sync-status')?.innerText || '未確認';
    const role = getCurrentLessonRole() || (REQUIRE_SUPABASE_AUTH ? '未登録/未ログイン' : '旧方式');
    const teacherScope = getTeacherScopeSummary();
    const teacherScopeTone = teacherScope === '全児童' ? 'warn' : (teacherScope === 'なし' ? 'neutral' : 'good');
    const legacyPassStatus = getLegacyAdminPassStatus();
    const legacyPassTone = legacyPassStatus === 'ローカルのみ有効' ? 'warn' : 'good';
    const studentCount = Object.keys(users).filter(userId => users[userId] && !users[userId].isMaster && !isSystemUserId(userId)).length;
    const idleLogoutMinutes = getStudentIdleLogoutMinutes();
    const syncTone = /synced|rls synced/.test(syncText) ? 'good' : (/error|offline|locked/.test(syncText) ? 'bad' : 'warn');

    grid.innerHTML = [
        renderOpsStatusCard('先生範囲', teacherScope, teacherScopeTone),
        renderOpsStatusCard('Supabase設定', HAS_SUPABASE_CONFIG ? 'あり' : 'なし', HAS_SUPABASE_CONFIG ? 'good' : 'warn'),
        renderOpsStatusCard('Auth必須', REQUIRE_SUPABASE_AUTH ? '有効' : '無効', REQUIRE_SUPABASE_AUTH ? 'good' : 'bad'),
        renderOpsStatusCard('旧パスワード', legacyPassStatus, legacyPassTone),
        renderOpsStatusCard('RLS同期', ENABLE_RLS_CLOUD_SYNC ? '有効' : '無効', ENABLE_RLS_CLOUD_SYNC ? 'good' : 'warn'),
        renderOpsStatusCard('設定テーブル', ENABLE_SETTINGS_TABLE ? SETTINGS_TABLE_KEY : '旧方式', ENABLE_SETTINGS_TABLE ? 'good' : 'warn'),
        renderOpsStatusCard('旧同期', ENABLE_LEGACY_SUPABASE_SYNC ? '有効' : '無効', ENABLE_LEGACY_SUPABASE_SYNC ? 'bad' : 'good'),
        renderOpsStatusCard('現在ロール', role, role === 'admin' ? 'good' : 'warn'),
        renderOpsStatusCard('保存状態', syncText, syncTone),
        renderOpsStatusCard('児童数', `${studentCount}人`, studentCount > 0 ? 'good' : 'warn'),
        renderOpsStatusCard('児童自動ログアウト', idleLogoutMinutes > 0 ? `${idleLogoutMinutes}分` : '無効', idleLogoutMinutes > 0 ? 'good' : 'warn')
    ].join('');

    renderStudentIdleLogoutSetting();
}

export function renderOpsGuideAdmin() {
    const grid = document.getElementById('ops-status-grid');
    if (!grid) return;

    const syncText = document.getElementById('sync-status')?.innerText || '未確認';
    const role = getCurrentLessonRole() || (REQUIRE_SUPABASE_AUTH ? '未登録/未ログイン' : '旧方式');
    const teacherScope = getTeacherScopeSummary();
    const teacherScopeTone = teacherScope === '全児童' ? 'warn' : (teacherScope === 'なし' ? 'neutral' : 'good');
    const legacyPassStatus = getLegacyAdminPassStatus();
    const legacyPassTone = legacyPassStatus === 'ローカルのみ有効' ? 'warn' : 'good';
    const studentCount = getStudentUserIds().length;
    const idleLogoutMinutes = getStudentIdleLogoutMinutes();
    const legacyStudentIdRows = getLegacyStudentIdRows();
    const userDataIdMismatchRows = getUserDataIdMismatchRows();
    const userIdTone = legacyStudentIdRows.length > 0 || userDataIdMismatchRows.length > 0 ? 'warn' : 'good';
    const userIdStatus = legacyStudentIdRows.length > 0
        ? `${legacyStudentIdRows.length}件 要確認`
        : (userDataIdMismatchRows.length > 0 ? `${userDataIdMismatchRows.length}件 不一致` : '内部ID OK');
    const syncTone = /synced|rls synced/.test(syncText) ? 'good' : (/error|offline|locked/.test(syncText) ? 'bad' : 'warn');

    grid.innerHTML = [
        renderOpsStatusCard('先生範囲', teacherScope, teacherScopeTone),
        renderOpsStatusCard('Supabase設定', HAS_SUPABASE_CONFIG ? 'あり' : 'なし', HAS_SUPABASE_CONFIG ? 'good' : 'warn'),
        renderOpsStatusCard('Auth必須', REQUIRE_SUPABASE_AUTH ? '有効' : '無効', REQUIRE_SUPABASE_AUTH ? 'good' : 'bad'),
        renderOpsStatusCard('旧パスワード', legacyPassStatus, legacyPassTone),
        renderOpsStatusCard('RLS同期', ENABLE_RLS_CLOUD_SYNC ? '有効' : '無効', ENABLE_RLS_CLOUD_SYNC ? 'good' : 'warn'),
        renderOpsStatusCard('設定テーブル', ENABLE_SETTINGS_TABLE ? SETTINGS_TABLE_KEY : '旧方式', ENABLE_SETTINGS_TABLE ? 'good' : 'warn'),
        renderOpsStatusCard('旧同期', ENABLE_LEGACY_SUPABASE_SYNC ? '有効' : '無効', ENABLE_LEGACY_SUPABASE_SYNC ? 'bad' : 'good'),
        renderOpsStatusCard('現在ロール', role, role === 'admin' ? 'good' : 'warn'),
        renderOpsStatusCard('保存状態', syncText, syncTone),
        renderOpsStatusCard('児童数', `${studentCount}人`, studentCount > 0 ? 'good' : 'warn'),
        renderOpsStatusCard('児童ID形式', userIdStatus, userIdTone),
        renderOpsStatusCard('児童自動ログアウト', idleLogoutMinutes > 0 ? `${idleLogoutMinutes}分` : '無効', idleLogoutMinutes > 0 ? 'good' : 'warn')
    ].join('');

    renderOpsUserIdDetails(grid, legacyStudentIdRows, userDataIdMismatchRows);
    renderStudentIdleLogoutSetting();
}

export function copyInternalIdCheckGuide() {
    const text = [
        'Dレッスン 児童IDの本番前確認',
        '',
        '1. 管理者画面 > バックアップ でJSONバックアップを保存する。',
        '2. Supabase SQL Editorで supabase/sql/preflight_public_release.sql の中身を実行する。',
        '3. result が NG の行がないか確認する。',
        '4. user_data_legacy_name_ids が 0 ではない場合は、docs/production-user-data-id-migration.md に沿って移行する。',
        '5. lesson_user_access_legacy_refs が 0 ではない場合は、Auth連携の user_data_id が内部IDへ更新されているか確認する。',
        '6. 実名運用前に npm.cmd run check:public-env と npm.cmd run build を実行する。'
    ].join('\n');
    copyText(text);
}

export function copyDeviceHandoffChecklist() {
    const text = [
        'Dレッスン 端末切替チェック',
        '1. 古い端末で保存状態が「rls synced」または「synced」になっていることを確認',
        '2. 管理者画面 > バックアップ でJSONバックアップを保存',
        '3. 新しい端末でDレッスンを開き、Supabase Authでログイン',
        '4. 児童一覧、進捗、コインが見えることを確認',
        '5. 短い練習を1つクリアし、保存状態が同期済みになることを確認',
        '6. 旧端末を共有端末として使わない場合はログアウト'
    ].join('\n');
    copyText(text);
}

export function copyLessonSettingsCheckGuide() {
    const text = [
        'Dレッスン 設定テーブル確認',
        '',
        '目的:',
        '__GLOBAL_SETTINGS__ を児童データ行から分離し、チケット設定・文章課題・自動ログアウト設定などを lesson_settings で管理できるか確認する。',
        '',
        '1. Supabase SQL Editor を開く。',
        '2. supabase/sql/lesson_settings_table.sql の中身を貼り付けて実行する。',
        '3. supabase/sql/verify_lesson_settings.sql の中身を貼り付けて実行する。',
        '',
        '確認する結果:',
        '- public.lesson_settings の rls_enabled が true。',
        '- lesson_settings の policy が SELECT / INSERT / UPDATE / DELETE の4種類ある。',
        '- user_data:global または test_user_data:global の行がある。',
        '- same_as_legacy_row が true、または管理者画面で設定保存後に lesson_settings 側へ反映される。',
        '',
        'ブラウザ確認:',
        '1. GitHub Actions Variables または .env.local で VITE_ENABLE_SETTINGS_TABLE=true にする。',
        '2. Dレッスンを再起動または再デプロイする。',
        '3. 管理者ログイン > 管理者用 > 運用確認 を開く。',
        '4. 「設定テーブル」が user_data:global または test_user_data:global になっていることを確認する。',
        '5. 自動ログアウト分数やチケット設定を保存し、再読み込み後も残ることを確認する。',
        '',
        '注意:',
        '設定テーブルを有効にする前は、管理者画面の「設定テーブル」が「旧方式」と表示される。これは VITE_ENABLE_SETTINGS_TABLE=false の状態なら正常。'
    ].join('\n');
    copyText(text);
}

export function getSelUser() { const r = document.querySelector('input[name="asel"]:checked'); return r ? r.value : null; }
export function adminResetUser() {
    const n = getSelUser();
    if(n) {
        showCustomConfirm('リセットしますか？', () => {
            recordAdminAudit('進捗リセット', { user: getUserDisplayName(n), userDataId: n });
            users[n].mouseLevel=0; users[n].keyboardSequence=0; users[n].examRecords={}; users[n].textRecords={}; users[n].globalMistakes={}; users[n].theme='default'; saveUsers(true); updateAdminUserTable();
        });
    }
}
export function adminForceProgress() {
    const n = getSelUser();
    if(n) {
        showCustomConfirm('全開放しますか？', () => {
            recordAdminAudit('進捗全開放', { user: getUserDisplayName(n), userDataId: n });
            users[n].mouseLevel=7; users[n].keyboardSequence=STAGE_ORDER.length; saveUsers(true); updateAdminUserTable();
        });
    }
}

let editTargetUser = null;
export function openEditProgress() {
    const n = getSelUser(); if (!n) return showCustomAlert('ユーザーを選択してください');
    editTargetUser = n; document.getElementById('edit-modal-title').innerText = `${getUserDisplayName(n)} さんの進捗編集`;
    document.getElementById('edit-mouse-level').value = users[n].mouseLevel || 0;
    const kbSelect = document.getElementById('edit-keyboard-seq'); kbSelect.innerHTML = `<option value="0">0: 初期状態</option>`;
    STAGE_ORDER.forEach((sid, idx) => { kbSelect.innerHTML += `<option value="${idx + 1}">${idx + 1}: ${getStageName(sid)} までクリア済</option>`; });
    kbSelect.value = users[n].keyboardSequence || 0; 
    const itemsContainer = document.getElementById('edit-items-container'); itemsContainer.innerHTML = '';
    const userItems = users[n].items ||[];
    let allCollectibles =[];
    THEMES.forEach(t => { if(t.id !== 'default') allCollectibles.push({ id: t.isCustom ? t.id : 'theme_' + t.id, name: '🎨 ' + t.name }); });
    EFFECTS.forEach(e => { if(e.id !== 'default') allCollectibles.push({ id: e.id, name: '🎉 ' + e.name }); });
    if (allCollectibles.length === 0) { itemsContainer.innerHTML = '<span style="color:#999;">ガチャアイテムがまだシステムにありません</span>'; } 
    else {
        allCollectibles.forEach(item => {
            const isOwned = userItems.includes(item.id) || (item.id.startsWith('theme_') && userItems.includes(item.id.replace('theme_', '')));
            const lbl = document.createElement('label'); lbl.style.cssText = 'display:inline-block; background:#fff; border:1px solid #ccc; padding:5px 10px; border-radius:20px; cursor:pointer; user-select:none; font-size:14px;';
            lbl.innerHTML = `<input type="checkbox" value="${item.id}" class="edit-item-cb" ${isOwned ? 'checked' : ''} style="margin-right:5px; transform:scale(1.2); cursor:pointer;">${item.name}`;
            itemsContainer.appendChild(lbl);
        });
    }
    document.getElementById('admin-edit-modal').style.display = 'flex';
}
export function closeEditProgress() { document.getElementById('admin-edit-modal').style.display = 'none'; editTargetUser = null; }

export function saveEditProgress() {
    if (!editTargetUser) return;
    users[editTargetUser].mouseLevel = parseInt(document.getElementById('edit-mouse-level').value, 10);
    users[editTargetUser].keyboardSequence = parseInt(document.getElementById('edit-keyboard-seq').value, 10);
    const cbs = document.querySelectorAll('.edit-item-cb'); let newItems =[];
    cbs.forEach(cb => { if (cb.checked) newItems.push(cb.value); }); users[editTargetUser].items = newItems;
    let currentThemeCheckId = THEMES.find(t=>t.id === users[editTargetUser].theme)?.isCustom ? users[editTargetUser].theme : 'theme_' + users[editTargetUser].theme;
    if(users[editTargetUser].theme !== 'default' && !newItems.includes(currentThemeCheckId) && !newItems.includes(users[editTargetUser].theme)) { users[editTargetUser].theme = 'default'; }
    if(users[editTargetUser].activeEffect !== 'default' && !newItems.includes(users[editTargetUser].activeEffect)) { users[editTargetUser].activeEffect = 'default'; }
    recordAdminAudit('進捗編集', {
        user: getUserDisplayName(editTargetUser),
        userDataId: editTargetUser,
        mouseLevel: users[editTargetUser].mouseLevel,
        keyboardSequence: users[editTargetUser].keyboardSequence
    });
    saveUsers(true); updateAdminUserTable(); closeEditProgress(); showCustomAlert('進捗とアイテム情報を保存しました。');
}

export function switchDashTab(tab) {
    switchDashTabImpl(tab);
}

function updateAdminFilterSelect(select, values, allLabel, currentValue) {
    if (!select) return;
    select.innerHTML = '';

    const allOpt = document.createElement('option');
    allOpt.value = 'all';
    allOpt.innerText = allLabel;
    select.appendChild(allOpt);

    values.forEach(value => {
        if (!value) return;
        const opt = document.createElement('option');
        opt.value = value;
        opt.innerText = value;
        select.appendChild(opt);
    });

    select.value = values.includes(currentValue) ? currentValue : 'all';
}

export function renderPracticeHistoryAdmin() {
    renderPracticeHistoryPanel();
}

export function clearPracticeHistoryFilters() {
    clearPracticeHistoryPanelFilters();
}

export function exportPracticeHistoryCsv() {
    exportPracticeHistoryPanelCsv();
}

export function updateAdminUserTable() {
    const tbody = document.getElementById('admin-user-tbody'); tbody.innerHTML = '';
    const searchInput = document.getElementById('admin-user-search');
    const gradeFilter = document.getElementById('admin-user-grade-filter');
    const groupFilter = document.getElementById('admin-user-group-filter');
    const countLabel = document.getElementById('admin-user-count');
    const searchText = (searchInput?.value || '').trim().toLowerCase();
    const selectedGrade = gradeFilter?.value || 'all';
    const selectedGroup = groupFilter?.value || 'all';

    let list = Object.keys(users)
        .filter(n => users[n] && !users[n].isMaster && !isSystemUserId(n))
        .map(n => {
            const uBirth = users[n].birthdate || users[n].birth;
            const grade = (users[n].grade && String(users[n].grade) !== 'undefined') ? users[n].grade : calculateGrade(uBirth);
            return { id: n, name: getUserDisplayName(n), grade, group: users[n].group || '', user: users[n] };
        });

    const grades = sortGrades(Array.from(new Set(list.map(item => item.grade).filter(Boolean))));
    const groups = Array.from(new Set(list.map(item => item.group).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'ja'));
    updateAdminFilterSelect(gradeFilter, grades, 'すべての学年', selectedGrade);
    updateAdminFilterSelect(groupFilter, groups, 'すべてのグループ', selectedGroup);

    list = list.filter(item => {
        if (gradeFilter && gradeFilter.value !== 'all' && item.grade !== gradeFilter.value) return false;
        if (groupFilter && groupFilter.value !== 'all' && item.group !== groupFilter.value) return false;
        if (!searchText) return true;
        const haystack = `${item.name} ${item.id} ${item.group}`.toLowerCase();
        return haystack.includes(searchText);
    });

    list.sort((a,b) => a.name.localeCompare(b.name, 'ja'));
    if (countLabel) countLabel.innerText = `${list.length}件`;

    if (list.length === 0) {
        const tr = document.createElement('tr');
        const td = document.createElement('td');
        td.colSpan = 7;
        td.style.cssText = 'padding:14px; border:1px solid #ddd; color:#777; text-align:center;';
        td.innerText = '条件に合う児童がいません';
        tr.appendChild(td);
        tbody.appendChild(tr);
        return;
    }

    list.forEach(item => {
        let uBirth = item.user.birthdate || item.user.birth;
        let dispGrade = item.grade;
        
        let tr = document.createElement('tr');
        const selectTd = document.createElement('td');
        selectTd.style.cssText = 'padding:5px; border:1px solid #ddd;';
        const radio = document.createElement('input');
        radio.type = 'radio';
        radio.name = 'asel';
        radio.className = 'admin-user-check';
        radio.value = item.id;
        selectTd.appendChild(radio);
        tr.appendChild(selectTd);

        const nameTd = document.createElement('td');
        nameTd.style.cssText = 'padding:5px; border:1px solid #ddd; font-weight:bold;';
        const nameInput = document.createElement('input');
        nameInput.type = 'text';
        nameInput.value = item.name;
        nameInput.style.cssText = 'width:120px; padding:2px; font-size:12px; border:1px solid #ccc;';
        nameInput.onchange = () => updateUserDisplayName(item.id, nameInput.value);
        nameTd.appendChild(nameInput);
        tr.appendChild(nameTd);

        const birthTd = document.createElement('td');
        birthTd.style.cssText = 'padding:5px; border:1px solid #ddd;';
        const birthInput = document.createElement('input');
        birthInput.type = 'date';
        birthInput.value = uBirth || '';
        birthInput.style.cssText = 'width:120px; padding:2px; font-size:12px; border:1px solid #ccc;';
        birthInput.onchange = () => updateUserBirthdate(item.id, birthInput.value);
        birthTd.appendChild(birthInput);
        tr.appendChild(birthTd);

        const gradeTd = document.createElement('td');
        gradeTd.style.cssText = 'padding:5px; border:1px solid #ddd;';
        gradeTd.innerText = dispGrade;
        tr.appendChild(gradeTd);

        const groupTd = document.createElement('td');
        groupTd.style.cssText = 'padding:5px; border:1px solid #ddd;';
        const groupInput = document.createElement('input');
        groupInput.type = 'text';
        groupInput.value = item.user.group || '';
        groupInput.style.cssText = 'width:80px; padding:2px; font-size:12px; border:1px solid #ccc;';
        groupInput.onchange = () => updateUserGroup(item.id, groupInput.value);
        groupTd.appendChild(groupInput);
        tr.appendChild(groupTd);

        const mouseTd = document.createElement('td');
        mouseTd.style.cssText = 'padding:5px; border:1px solid #ddd;';
        mouseTd.innerText = `Lv.${item.user.mouseLevel || 1}`;
        tr.appendChild(mouseTd);

        const keyboardTd = document.createElement('td');
        keyboardTd.style.cssText = 'padding:5px; border:1px solid #ddd;';
        keyboardTd.innerText = `${item.user.keyboardSequence || 0}/${STAGE_ORDER.length}`;
        tr.appendChild(keyboardTd);

        tbody.appendChild(tr);
    });
}

export function clearAdminUserFilters() {
    const searchInput = document.getElementById('admin-user-search');
    const gradeFilter = document.getElementById('admin-user-grade-filter');
    const groupFilter = document.getElementById('admin-user-group-filter');
    if (searchInput) searchInput.value = '';
    if (gradeFilter) gradeFilter.value = 'all';
    if (groupFilter) groupFilter.value = 'all';
    updateAdminUserTable();
}

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

export function openStudentReport() {
    openStudentReportPanel(getSelUser());
}

export function closeStudentReport() {
    closeStudentReportPanel();
}

export function printStudentReport() {
    printStudentReportPanel();
}

export function updateUserDisplayName(userId, newName) {
    const displayName = newName.trim();
    if (!users[userId]) return;
    if (!displayName) {
        showCustomAlert('名前を入力してください');
        updateAdminUserTable();
        return;
    }
    if (userDisplayNameExists(displayName, userId)) {
        showCustomAlert('その名前はすでに登録されています');
        updateAdminUserTable();
        return;
    }
    const oldName = getUserDisplayName(userId);
    users[userId].displayName = displayName;
    recordAdminAudit('表示名変更', { userDataId: userId, before: oldName, after: displayName });
    saveUsers(true);
    updateAdminUserTable();
    renderDashboardTable();
}

export function updateUserBirthdate(userId, newBirthdate) {
    if (!users[userId]) return;
    if (!newBirthdate) {
        showCustomAlert('生年月日を入力してください');
        updateAdminUserTable();
        return;
    }

    const oldBirthdate = users[userId].birthdate || users[userId].birth || '';
    users[userId].birthdate = newBirthdate;
    users[userId].grade = calculateGrade(newBirthdate);
    recordAdminAudit('生年月日変更', { user: getUserDisplayName(userId), userDataId: userId, before: oldBirthdate, after: newBirthdate });
    saveUsers(true);
    updateAdminUserTable();
    renderDashboardTable();
}

export function updateUserGroup(name, newGroup) {
    if(users[name]) { 
        const oldGroup = users[name].group || '';
        users[name].group = newGroup.trim(); 
        recordAdminAudit('グループ変更', { user: getUserDisplayName(name), userDataId: name, before: oldGroup, after: users[name].group });
        saveUsers(true);
        updateAdminUserTable();
        renderDashboardTable(); 
    }
}

function isUuid(value) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || '').trim());
}

function getRoleAccessDataId(role) {
    if (role === 'admin') return '__admin__';
    if (role === 'teacher') return '__teacher__';
    return null;
}

function isMissingLessonScopeColumnError(error) {
    const message = `${error?.code || ''} ${error?.message || ''}`;
    return /scope_type|scope_value|42703/i.test(message);
}

function normalizeTeacherScope(scopeType, scopeValue) {
    const type = scopeType === 'group' ? 'group' : 'all';
    const value = type === 'group'
        ? String(scopeValue || '').split(',').map(group => group.trim()).filter(Boolean).join(',')
        : '';
    return { scopeType: type, scopeValue: value };
}

function formatTeacherScope(scopeType, scopeValue) {
    const { scopeType: type, scopeValue: value } = normalizeTeacherScope(scopeType, scopeValue);
    return type === 'group' ? `グループ: ${value || '未指定'}` : '全児童';
}

function getTeacherScopeFormValues() {
    const scopeType = document.getElementById('auth-teacher-scope-type')?.value || 'all';
    const scopeValue = document.getElementById('auth-teacher-scope-value')?.value || '';
    return normalizeTeacherScope(scopeType, scopeValue);
}

function ensureAuthLinkingReady() {
    if (!REQUIRE_SUPABASE_AUTH || !supabase) {
        showCustomAlert('Supabase Auth設定が有効な環境で使用してください。');
        return false;
    }
    if (!hasLessonRole('admin')) {
        showCustomAlert('管理者アカウントでログインしてください。');
        return false;
    }
    return true;
}

async function upsertLessonUserAccess(authUserId, userDataId, role, scope = {}) {
    if (!ensureAuthLinkingReady()) return false;
    if (!isUuid(authUserId)) {
        showCustomAlert('Auth User ID はUUID形式で入力してください。');
        return false;
    }
    if (!userDataId || !role) return false;

    const { scopeType, scopeValue } = role === 'teacher'
        ? normalizeTeacherScope(scope.scopeType, scope.scopeValue)
        : { scopeType: 'all', scopeValue: '' };

    if (role === 'teacher' && scopeType === 'group' && !scopeValue) {
        showCustomAlert('先生の担当範囲がグループ指定ですが、グループ名が入力されていません。');
        return false;
    }

    const basePayload = { auth_user_id: authUserId.trim(), user_data_id: userDataId, role };
    const scopedPayload = role === 'teacher'
        ? { ...basePayload, scope_type: scopeType, scope_value: scopeValue }
        : basePayload;

    let { error } = await supabase
        .from('lesson_user_access')
        .upsert(scopedPayload, { onConflict: 'auth_user_id,user_data_id' });

    if (error && role === 'teacher' && scopeType === 'all' && isMissingLessonScopeColumnError(error)) {
        const fallback = await supabase
            .from('lesson_user_access')
            .upsert(basePayload, { onConflict: 'auth_user_id,user_data_id' });
        error = fallback.error;
    }

    if (error) {
        console.error('lesson_user_access upsert failed:', error);
        const migrationHint = isMissingLessonScopeColumnError(error)
            ? '\nsupabase/sql/teacher_group_scope_policies.sql を実行してから再登録してください。'
            : '\nsupabase/sql/admin_lesson_user_access_policies.sql を実行済みか確認してください。';
        showCustomAlert(`Auth連携の登録に失敗しました。${migrationHint}`);
        return false;
    }

    recordAdminAudit('Auth連携登録', {
        role,
        userDataId,
        authUserId: authUserId.trim(),
        scope: role === 'teacher' ? formatTeacherScope(scopeType, scopeValue) : ''
    });
    await refreshCurrentLessonAccess();
    await renderAuthAccessOverview();
    showCustomAlert('Auth連携を登録しました。');
    return true;
}

export async function linkRoleAuthUser(role) {
    const inputId = role === 'admin' ? 'auth-admin-user-id' : 'auth-teacher-user-id';
    const input = document.getElementById(inputId);
    const authUserId = input?.value.trim();
    const userDataId = getRoleAccessDataId(role);
    const label = role === 'admin' ? '管理者' : '先生';
    if (!userDataId) return;
    const teacherScope = role === 'teacher' ? getTeacherScopeFormValues() : {};

    showCustomConfirm(`${label}ロールを登録しますか？`, async () => {
        const ok = await upsertLessonUserAccess(authUserId, userDataId, role, teacherScope);
        if (ok && input) input.value = '';
    });
}

export async function linkStudentAuthUser(userDataId, inputId) {
    const input = document.getElementById(inputId);
    const authUserId = input?.value.trim();
    const displayName = getUserDisplayName(userDataId);

    showCustomConfirm(`${displayName} さんを生徒アカウントに紐づけますか？`, async () => {
        const ok = await upsertLessonUserAccess(authUserId, userDataId, 'student');
        if (ok && input) input.value = '';
    });
}

function sqlString(value) {
    return String(value || '').replace(/'/g, "''");
}

function buildAccessSql(authUserId, userDataId, role, scope = {}) {
    const safeAuthUserId = sqlString(authUserId || 'AUTH_USER_ID_HERE');
    const safeUserDataId = sqlString(userDataId);
    const safeRole = sqlString(role);
    const { scopeType, scopeValue } = role === 'teacher'
        ? normalizeTeacherScope(scope.scopeType, scope.scopeValue)
        : { scopeType: 'all', scopeValue: '' };
    if (role === 'teacher') {
        const safeScopeType = sqlString(scopeType);
        const safeScopeValue = sqlString(scopeValue);
        return `insert into public.lesson_user_access (auth_user_id, user_data_id, role, scope_type, scope_value)\nvalues ('${safeAuthUserId}', '${safeUserDataId}', '${safeRole}', '${safeScopeType}', '${safeScopeValue}')\non conflict (auth_user_id, user_data_id) do update\nset role = excluded.role,\n    scope_type = excluded.scope_type,\n    scope_value = excluded.scope_value;`;
    }
    return `insert into public.lesson_user_access (auth_user_id, user_data_id, role)\nvalues ('${safeAuthUserId}', '${safeUserDataId}', '${safeRole}')\non conflict (auth_user_id, user_data_id) do update\nset role = excluded.role;`;
}

async function copyText(text) {
    try {
        await navigator.clipboard.writeText(text);
        showCustomAlert('コピーしました。');
    } catch (err) {
        console.warn('Clipboard copy failed:', err);
        showCustomAlert(text);
    }
}

export function copyStudentAccessSql(userDataId, inputId) {
    const input = document.getElementById(inputId);
    copyText(buildAccessSql(input?.value.trim(), userDataId, 'student'));
}

export function copyRoleAccessSql(role) {
    const inputId = role === 'admin' ? 'auth-admin-user-id' : 'auth-teacher-user-id';
    const input = document.getElementById(inputId);
    const userDataId = getRoleAccessDataId(role);
    if (!userDataId) return;
    copyText(buildAccessSql(input?.value.trim(), userDataId, role, role === 'teacher' ? getTeacherScopeFormValues() : {}));
}

export async function renderAuthAccessOverview() {
    const tbody = document.getElementById('auth-access-tbody');
    const status = document.getElementById('auth-access-status');
    if (!tbody || !status) return;
    tbody.innerHTML = '';

    if (!supabase || !REQUIRE_SUPABASE_AUTH) {
        status.innerText = 'Supabase Auth未使用';
        return;
    }

    let { data, error } = await supabase
        .from('lesson_user_access')
        .select('auth_user_id,user_data_id,role,scope_type,scope_value,created_at')
        .order('created_at', { ascending: false });

    if (error && isMissingLessonScopeColumnError(error)) {
        const fallback = await supabase
            .from('lesson_user_access')
            .select('auth_user_id,user_data_id,role,created_at')
            .order('created_at', { ascending: false });
        data = fallback.data;
        error = fallback.error;
    }

    if (error) {
        status.innerText = '管理者用RLS未適用または読込権限なし';
        return;
    }

    status.innerText = `${data?.length || 0}件`;
    (data || []).forEach(row => {
        const tr = document.createElement('tr');
        [row.role, row.user_data_id, row.scope_type || 'all', row.scope_value || '', row.auth_user_id].forEach(value => {
            const td = document.createElement('td');
            td.style.cssText = 'border:1px solid #ddd; padding:6px; word-break:break-all;';
            td.innerText = value || '';
            tr.appendChild(td);
        });
        tbody.appendChild(tr);
    });
}

export async function renderAuthLinkingAdmin() {
    const tbody = document.getElementById('auth-link-student-tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    const list = Object.keys(users)
        .filter(userId => users[userId] && !users[userId].isMaster && !isSystemUserId(userId))
        .map(userId => ({ id: userId, name: getUserDisplayName(userId), user: users[userId] }))
        .sort((a, b) => a.name.localeCompare(b.name, 'ja'));

    list.forEach((item, index) => {
        const inputId = `auth-student-${index}`;
        const tr = document.createElement('tr');

        const nameTd = document.createElement('td');
        nameTd.style.cssText = 'border:1px solid #ddd; padding:6px; font-weight:bold;';
        nameTd.innerText = item.name;
        tr.appendChild(nameTd);

        const idTd = document.createElement('td');
        idTd.style.cssText = 'border:1px solid #ddd; padding:6px; word-break:break-all; font-family:monospace;';
        idTd.innerText = item.id;
        tr.appendChild(idTd);

        const inputTd = document.createElement('td');
        inputTd.style.cssText = 'border:1px solid #ddd; padding:6px;';
        const input = document.createElement('input');
        input.type = 'text';
        input.id = inputId;
        input.placeholder = 'Auth User ID';
        input.style.cssText = 'width:220px; max-width:100%; padding:6px; font-size:13px;';
        inputTd.appendChild(input);
        tr.appendChild(inputTd);

        const actionTd = document.createElement('td');
        actionTd.style.cssText = 'border:1px solid #ddd; padding:6px; white-space:nowrap;';
        const linkBtn = document.createElement('button');
        linkBtn.className = 'btn-primary';
        linkBtn.style.cssText = 'font-size:13px; padding:6px 10px; margin-right:6px;';
        linkBtn.innerText = '登録';
        linkBtn.onclick = () => linkStudentAuthUser(item.id, inputId);
        actionTd.appendChild(linkBtn);

        const copyBtn = document.createElement('button');
        copyBtn.className = 'btn-secondary';
        copyBtn.style.cssText = 'font-size:13px; padding:6px 10px;';
        copyBtn.innerText = 'SQL';
        copyBtn.onclick = () => copyStudentAccessSql(item.id, inputId);
        actionTd.appendChild(copyBtn);
        tr.appendChild(actionTd);

        tbody.appendChild(tr);
    });

    await renderAuthAccessOverview();
}

export function renderDashboardTable() {
    renderDashboardTableImpl();
}

export function renderVisionDashboardTable() {
    renderVisionDashboardTableImpl();
}

export function adminAddTextTask() {
    adminAddTextTaskImpl();
}

export function editTextTask(id) {
    editTextTaskImpl(id);
}

export function moveTextTask(idx, dir) {
    moveTextTaskImpl(idx, dir);
}

export function renderAdminTextTasks() {
    renderAdminTextTasksImpl();
}

export function deleteTextTask(idx, title) {
    deleteTextTaskImpl(idx, title);
}

export function insertRuby() {
    insertRubyImpl();
}

export function toggleAutoRubyTool() {
    toggleAutoRubyToolImpl();
}

export function generateAutoRuby() {
    generateAutoRubyImpl();
}

export function processAutoRuby() {
    processAutoRubyImpl();
}

export function exportData() {
    exportAdminBackupData();
}

export function importData(event) {
    importAdminBackupData(event);
}

export function openThemeCreator() {
    openThemeCreatorImpl();
}

export function closeThemeCreator() {
    closeThemeCreatorImpl();
}

export function updateThemePreview() {
    updateThemePreviewImpl();
}

export function saveCustomTheme() {
    saveCustomThemeImpl();
}

export function openEffectCreator() {
    openEffectCreatorImpl();
}

export function closeEffectCreator() {
    closeEffectCreatorImpl();
}

export function saveCustomEffect() {
    saveCustomEffectImpl();
}

export function openCustomManager() {
    openCustomManagerImpl();
}

export function closeCustomManager() {
    closeCustomManagerImpl();
}

export function renderCustomManagerList() {
    renderCustomManagerListImpl();
}

export function deleteCustomElement(type, idx, name) {
    deleteCustomElementImpl(type, idx, name);
}
