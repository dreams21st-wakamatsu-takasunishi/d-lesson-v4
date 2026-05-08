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
    getPracticeLogs,
    formatPracticeActivity,
    getStudentIdleLogoutMinutes,
    refreshStudentIdleLogoutTimer
} from '../api/user.js';
import { STAGE_ORDER, THEMES, EFFECTS, VISION_STAGES } from '../data/constants.js';
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
    // ★修正: let に変更し、データが無ければ新しく作る処理を追加
    let glob = users[GLOBAL_SETTINGS_ID];
    if (!glob) {
        glob = { isMaster: true };
        users[GLOBAL_SETTINGS_ID] = glob;
    }
    
    if(!glob.ticketConfig) glob.ticketConfig = { normal: { name: '👍 いいねポイント 5こ', icon: '🎟️' }, newRecord: { name: '👍 いいねポイント 1こ', icon: '🎟️' } };
    document.getElementById('admin-ticket-normal').value = glob.ticketConfig.normal.name;
    document.getElementById('admin-ticket-newrecord').value = glob.ticketConfig.newRecord.name;

    const histList = document.getElementById('admin-ticket-history');
    if(!histList) return; histList.innerHTML = '';
    let allHistory =[];
    Object.keys(users).forEach(n => {
        if (!users[n].isMaster && !isSystemUserId(n) && users[n].ticketHistory) {
            users[n].ticketHistory.forEach(h => { allHistory.push({ user: getUserDisplayName(n), ticketName: h.ticketName, date: h.date, timestamp: h.timestamp }); });
        }
    });
    allHistory.sort((a, b) => b.timestamp - a.timestamp);
    if(allHistory.length === 0) { histList.innerHTML = '<li style="color:#999;">まだ履歴がありません</li>'; } 
    else {
        allHistory.slice(0, 30).forEach(h => {
            const li = document.createElement('li');
            li.style.borderBottom = "1px dotted #ccc"; li.style.padding = "8px 0";
            li.innerHTML = `<span style="color:#666; font-size:14px;">${h.date}</span><br><b>【${h.user}】</b>さんが「<span style="color:#E91E63;">${h.ticketName}</span>」を使用しました。`;
            histList.appendChild(li);
        });
    }
}

export function saveTicketSettings() {
    const nName = document.getElementById('admin-ticket-normal').value.trim();
    const rName = document.getElementById('admin-ticket-newrecord').value.trim();
    if(!nName || !rName) return showCustomAlert('チケット名を入力してください');
    if (!users[GLOBAL_SETTINGS_ID]) users[GLOBAL_SETTINGS_ID] = { isMaster:true };
    if (!users[GLOBAL_SETTINGS_ID].ticketConfig) users[GLOBAL_SETTINGS_ID].ticketConfig = { normal:{icon:'🎟️'}, newRecord:{icon:'🎟️'} };
    users[GLOBAL_SETTINGS_ID].ticketConfig.normal.name = nName; users[GLOBAL_SETTINGS_ID].ticketConfig.newRecord.name = rName;
    recordAdminAudit('チケット設定変更', { normal: nName, newRecord: rName });
    saveUsers(true); showCustomAlert('チケット設定を保存しました！');
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
    if(tab === 'basic') {
        document.getElementById('dash-basic').style.display = 'block';
        document.getElementById('dash-vision').style.display = 'none';
        document.getElementById('tab-btn-basic').style.background = '#2196F3';
        document.getElementById('tab-btn-vision').style.background = '#9e9e9e';
        renderDashboardTable();
    } else {
        document.getElementById('dash-basic').style.display = 'none';
        document.getElementById('dash-vision').style.display = 'block';
        document.getElementById('tab-btn-basic').style.background = '#9e9e9e';
        document.getElementById('tab-btn-vision').style.background = '#9C27B0';
        renderVisionDashboardTable();
    }
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

function getLocalDateKey(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

function collectPracticeHistoryRows() {
    const rows = [];
    Object.keys(users)
        .filter(userId => users[userId] && !users[userId].isMaster && !isSystemUserId(userId))
        .forEach(userId => {
            const user = users[userId];
            const grade = (user.grade && String(user.grade) !== 'undefined') ? user.grade : calculateGrade(user.birthdate || user.birth);
            const group = user.group || '';
            getPracticeLogs(userId).forEach(log => {
                const atMs = Date.parse(log.at);
                if (!atMs) return;
                const info = formatPracticeActivity(log);
                rows.push({
                    userId,
                    name: getUserDisplayName(userId),
                    grade,
                    group,
                    dateKey: getLocalDateKey(log.at),
                    timeText: new Date(atMs).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' }),
                    atMs,
                    title: info.title,
                    detail: log.detail || '',
                    amount: log.amount || '',
                    coins: Number(log.coins || 0)
                });
            });
        });

    rows.sort((a, b) => b.atMs - a.atMs || a.name.localeCompare(b.name, 'ja'));
    return rows;
}

function updatePracticeDateSelect(select, rows) {
    if (!select) return '';
    const currentValue = select.value;
    const counts = new Map();
    rows.forEach(row => counts.set(row.dateKey, (counts.get(row.dateKey) || 0) + 1));
    const dates = Array.from(counts.keys()).sort((a, b) => b.localeCompare(a));

    select.innerHTML = '';
    if (dates.length === 0) {
        const opt = document.createElement('option');
        opt.value = '';
        opt.innerText = '記録なし';
        select.appendChild(opt);
        return '';
    }

    dates.forEach(dateKey => {
        const opt = document.createElement('option');
        opt.value = dateKey;
        opt.innerText = `${dateKey} (${counts.get(dateKey)}件)`;
        select.appendChild(opt);
    });

    const selected = dates.includes(currentValue) ? currentValue : dates[0];
    select.value = selected;
    return selected;
}

function getFilteredPracticeHistoryRows() {
    const allRows = collectPracticeHistoryRows();
    const dateSelect = document.getElementById('admin-practice-date');
    const gradeSelect = document.getElementById('admin-practice-grade');
    const groupSelect = document.getElementById('admin-practice-group');
    const searchInput = document.getElementById('admin-practice-search');

    const selectedDate = updatePracticeDateSelect(dateSelect, allRows);
    const grades = sortGrades(Array.from(new Set(allRows.map(row => row.grade).filter(Boolean))));
    const groups = Array.from(new Set(allRows.map(row => row.group).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'ja'));
    updateAdminFilterSelect(gradeSelect, grades, 'すべての学年', gradeSelect?.value || 'all');
    updateAdminFilterSelect(groupSelect, groups, 'すべてのグループ', groupSelect?.value || 'all');

    const selectedGrade = gradeSelect?.value || 'all';
    const selectedGroup = groupSelect?.value || 'all';
    const searchText = (searchInput?.value || '').trim().toLowerCase();

    const rows = allRows.filter(row => {
        if (!selectedDate || row.dateKey !== selectedDate) return false;
        if (selectedGrade !== 'all' && row.grade !== selectedGrade) return false;
        if (selectedGroup !== 'all' && row.group !== selectedGroup) return false;
        if (!searchText) return true;
        const haystack = `${row.name} ${row.userId} ${row.group} ${row.title} ${row.detail} ${row.amount}`.toLowerCase();
        return haystack.includes(searchText);
    });

    return { rows, allRows, selectedDate };
}

function renderPracticeSummaryCard(container, label, value, color) {
    const card = document.createElement('div');
    card.style.cssText = `background:#fff; border:2px solid ${color}; border-radius:8px; padding:12px; text-align:center;`;
    const labelEl = document.createElement('div');
    labelEl.innerText = label;
    labelEl.style.cssText = 'font-size:13px; color:#546e7a; font-weight:bold; margin-bottom:6px;';
    const valueEl = document.createElement('div');
    valueEl.innerText = value;
    valueEl.style.cssText = `font-size:24px; color:${color}; font-weight:bold;`;
    card.appendChild(labelEl);
    card.appendChild(valueEl);
    container.appendChild(card);
}

function appendPracticeCell(tr, text, extraStyle = '') {
    const td = document.createElement('td');
    td.style.cssText = `border:1px solid #ddd; padding:8px; vertical-align:top; ${extraStyle}`;
    td.innerText = text;
    tr.appendChild(td);
}

export function renderPracticeHistoryAdmin() {
    const tbody = document.getElementById('admin-practice-tbody');
    const summary = document.getElementById('admin-practice-summary');
    if (!tbody || !summary) return;

    const { rows, allRows, selectedDate } = getFilteredPracticeHistoryRows();
    tbody.innerHTML = '';
    summary.innerHTML = '';

    const activeStudents = new Set(rows.map(row => row.userId)).size;
    const totalCoins = rows.reduce((sum, row) => sum + row.coins, 0);
    renderPracticeSummaryCard(summary, '選択日', selectedDate || '記録なし', '#795548');
    renderPracticeSummaryCard(summary, '取り組んだ児童', `${activeStudents}人`, '#2196F3');
    renderPracticeSummaryCard(summary, '取り組み件数', `${rows.length}件`, '#4CAF50');
    renderPracticeSummaryCard(summary, '獲得コイン合計', `${totalCoins}コイン`, '#FF9800');

    if (allRows.length === 0) {
        const tr = document.createElement('tr');
        const td = document.createElement('td');
        td.colSpan = 8;
        td.style.cssText = 'border:1px solid #ddd; padding:18px; text-align:center; color:#777;';
        td.innerText = 'まだ取り組み記録がありません。児童が練習を終えるとここに表示されます。';
        tr.appendChild(td);
        tbody.appendChild(tr);
        return;
    }

    if (rows.length === 0) {
        const tr = document.createElement('tr');
        const td = document.createElement('td');
        td.colSpan = 8;
        td.style.cssText = 'border:1px solid #ddd; padding:18px; text-align:center; color:#777;';
        td.innerText = '条件に合う取り組み記録はありません。';
        tr.appendChild(td);
        tbody.appendChild(tr);
        return;
    }

    rows.forEach(row => {
        const tr = document.createElement('tr');
        appendPracticeCell(tr, row.timeText, 'white-space:nowrap; color:#607d8b; font-weight:bold;');
        appendPracticeCell(tr, row.name, 'font-weight:bold; color:#263238;');
        appendPracticeCell(tr, row.grade || '-');
        appendPracticeCell(tr, row.group || '-');
        appendPracticeCell(tr, row.title);
        appendPracticeCell(tr, row.detail || '-');
        appendPracticeCell(tr, row.amount || '-');
        appendPracticeCell(tr, row.coins ? `+${row.coins}` : '', 'text-align:right; color:#f57c00; font-weight:bold;');
        tbody.appendChild(tr);
    });
}

export function clearPracticeHistoryFilters() {
    const gradeSelect = document.getElementById('admin-practice-grade');
    const groupSelect = document.getElementById('admin-practice-group');
    const searchInput = document.getElementById('admin-practice-search');
    if (gradeSelect) gradeSelect.value = 'all';
    if (groupSelect) groupSelect.value = 'all';
    if (searchInput) searchInput.value = '';
    renderPracticeHistoryAdmin();
}

export function exportPracticeHistoryCsv() {
    const { rows, selectedDate } = getFilteredPracticeHistoryRows();
    if (rows.length === 0) return showCustomAlert('出力する取り組み記録がありません。');

    const csvRows = [['date', 'time', 'student_name', 'grade', 'group', 'practice', 'detail', 'amount', 'coins']];
    rows.forEach(row => {
        csvRows.push([
            selectedDate,
            row.timeText,
            row.name,
            row.grade || '',
            row.group || '',
            row.title,
            row.detail || '',
            row.amount || '',
            row.coins || 0
        ]);
    });

    const csv = csvRows.map(row => row.map(escapeCsvCell).join(',')).join('\r\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `d-lesson_practice_${selectedDate || 'all'}_${getBackupDateStamp()}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    recordAdminAudit('取り組み履歴CSV出力', { date: selectedDate, rows: rows.length });
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
    try {
        const tbody = document.getElementById('dash-tbody');
        const gradeSelect = document.getElementById('dash-filter-grade');
        const grpSelect = document.getElementById('dash-filter-group'); 
        const sortSelect = document.getElementById('dash-sort');
        if(!tbody || !gradeSelect || !grpSelect || !sortSelect) return;

        const fGrade = gradeSelect.value || 'all';
        const fGroup = grpSelect.value || 'all';
        const sortVal = sortSelect.value || 'name';

        let existingGrades = new Set();
        let groups = new Set();
        let list =[];
        let isDataFixed = false;

        Object.keys(users).forEach(n => { 
            if(!users[n] || users[n].isMaster || isSystemUserId(n)) return;
            
            let uBirth = users[n].birthdate || users[n].birth;
            let uGrade = users[n].grade;
            if (!uGrade || String(uGrade) === 'undefined') {
                uGrade = calculateGrade(uBirth);
                users[n].grade = uGrade; 
                users[n].birthdate = uBirth; 
                isDataFixed = true;
            }

            existingGrades.add(uGrade);
            if(users[n].group) groups.add(users[n].group);

            if (fGrade !== 'all' && uGrade !== fGrade) return;
            if (fGroup !== 'all' && (users[n].group || '') !== fGroup) return; 
            
            list.push({ id: n, name: getUserDisplayName(n), user: users[n] });
        });

        if (isDataFixed) saveUsers(false); 

        gradeSelect.innerHTML = '<option value="all">すべての学年</option>';
        sortGrades(Array.from(existingGrades)).forEach(g => {
            let opt = document.createElement('option'); opt.value = g; opt.innerText = g;
            if(g === fGrade) opt.selected = true;
            gradeSelect.appendChild(opt);
        });

        grpSelect.innerHTML = '<option value="all">すべてのグループ</option>';
        Array.from(groups).sort().forEach(g => {
            let opt = document.createElement('option'); opt.value = g; opt.innerText = g;
            if(g === fGroup) opt.selected = true;
            grpSelect.appendChild(opt);
        });

        if (sortVal === 'name') list.sort((a,b) => a.name.localeCompare(b.name, 'ja'));
        else if (sortVal === 'mouse_desc') list.sort((a,b) => (b.user.mouseLevel || 0) - (a.user.mouseLevel || 0));
        else if (sortVal === 'kb_desc') list.sort((a,b) => (b.user.keyboardSequence || 0) - (a.user.keyboardSequence || 0));

        tbody.innerHTML = '';
        list.forEach(item => {
            let tr = document.createElement('tr');
            
            let tdName = document.createElement('td'); 
            tdName.style.cssText = 'border:1px solid #ccc; padding:8px; font-weight:bold;'; 
            let grpBadge = item.user.group ? `<span style="font-size:12px; color:#666; background:#e0e0e0; padding:2px 6px; border-radius:10px; margin-left:8px;">${item.user.group}</span>` : '';
            tdName.innerHTML = item.name + grpBadge; 
            tr.appendChild(tdName);

            let tdGrade = document.createElement('td'); 
            tdGrade.style.cssText = 'border:1px solid #ccc; padding:8px;'; 
            tdGrade.innerText = item.user.grade; 
            tr.appendChild(tdGrade);

            let tdMouse = document.createElement('td'); 
            tdMouse.style.cssText = 'border:1px solid #ccc; padding:8px;';
            let mouseLevel = item.user.mouseLevel || 0;
            let mousePct = Math.floor((mouseLevel / 7) * 100);
            tdMouse.innerHTML = `<div style="width:100%; background:#eee; border-radius:5px;"><div style="width:${mousePct}%; background:#2196F3; color:#fff; text-align:center; font-size:12px; border-radius:5px;">${mousePct}%</div></div>`; 
            tr.appendChild(tdMouse);

            let tdKb = document.createElement('td'); 
            tdKb.style.cssText = 'border:1px solid #ccc; padding:8px;';
            let kbSeq = item.user.keyboardSequence || 0;
            let kbPct = Math.floor((kbSeq / STAGE_ORDER.length) * 100);
            tdKb.innerHTML = `<div style="width:100%; background:#eee; border-radius:5px;"><div style="width:${kbPct}%; background:#FF9800; color:#fff; text-align:center; font-size:12px; border-radius:5px;">${kbPct}%</div></div>`; 
            tr.appendChild(tdKb);

            tbody.appendChild(tr);
        });
    } catch(e) { console.error(e); }
}

export function renderVisionDashboardTable() {
    const tbody = document.getElementById('dash-vision-tbody');
    const thead = document.getElementById('dash-vision-thead');
    const diffSelect = document.getElementById('vision-diff-select');
    if (!tbody || !thead || !diffSelect) return;
    
    let diffVal = diffSelect.value; 
    let suffix = diffVal === 'normal' ? '' : '_' + diffVal;

    let htmlHead = '<tr><th style="border:1px solid #ccc; padding:8px; position:sticky; left:0; background:#f2f2f2; z-index:11;">名前</th>';
    VISION_STAGES.forEach(st => { htmlHead += `<th style="border:1px solid #ccc; padding:8px; font-size:14px;">${st.title}</th>`; });
    htmlHead += '</tr>';
    thead.innerHTML = htmlHead; tbody.innerHTML = '';
    
    let sumTimes = {}; let countTimes = {};
    VISION_STAGES.forEach(st => { sumTimes[st.id] = 0; countTimes[st.id] = 0; });

    let list =[];
    Object.keys(users).forEach(n => {
        if (!users[n] || users[n].isMaster || isSystemUserId(n)) return;
        list.push({ id: n, name: getUserDisplayName(n), user: users[n] });
    });
    list.sort((a, b) => a.name.localeCompare(b.name, 'ja'));

    list.forEach(item => {
        let tr = document.createElement('tr');
        let tdName = document.createElement('td');
        tdName.style.cssText = 'border:1px solid #ccc; padding:8px; font-weight:bold; position:sticky; left:0; background:#fff; z-index:5;';
        tdName.innerText = item.name; tr.appendChild(tdName);

        VISION_STAGES.forEach(st => {
            let td = document.createElement('td');
            td.style.cssText = 'border:1px solid #ccc; padding:8px; text-align:center;';
            let key = st.id + suffix;
            let rec = item.user.examRecords && item.user.examRecords[key];
            if (rec) {
                td.innerText = rec.toFixed(1) + '秒';
                sumTimes[st.id] += rec; countTimes[st.id]++;
            } else { td.innerText = '-'; td.style.color = '#ccc'; }
            tr.appendChild(td);
        });
        tbody.appendChild(tr);
    });

    let trAvg = document.createElement('tr');
    trAvg.style.backgroundColor = '#fff9c4'; trAvg.style.fontWeight = 'bold';
    let tdAvgName = document.createElement('td');
    tdAvgName.style.cssText = 'border:1px solid #ccc; padding:8px; position:sticky; left:0; background:#fff9c4; z-index:6; color:#f57f17;';
    tdAvgName.innerText = '★平均タイム'; trAvg.appendChild(tdAvgName);

    VISION_STAGES.forEach(st => {
        let td = document.createElement('td');
        td.style.cssText = 'border:1px solid #ccc; padding:8px; text-align:center; color:#d32f2f; font-size:18px;';
        if (countTimes[st.id] > 0) {
            td.innerText = (sumTimes[st.id] / countTimes[st.id]).toFixed(1) + '秒';
        } else { td.innerText = '-'; }
        trAvg.appendChild(td);
    });
    tbody.prepend(trAvg); 
}

let editingTextTaskId = null; 

export function adminAddTextTask() {
    const title = document.getElementById('admin-text-title').value.trim();
    const time = parseInt(document.getElementById('admin-text-time').value, 10);
    const star = parseInt(document.getElementById('admin-text-star').value, 10) || 3; 
    const content = document.getElementById('admin-text-content').value;
    if (!title || !time || !content.trim()) return showCustomAlert("タイトル、制限時間、お手本文章をすべて入力してください。");
    
    if (!users[GLOBAL_SETTINGS_ID]) users[GLOBAL_SETTINGS_ID] = { isMaster:true };
    if (!users[GLOBAL_SETTINGS_ID].textTasks) users[GLOBAL_SETTINGS_ID].textTasks =[];
    
    if (editingTextTaskId) {
        let task = users[GLOBAL_SETTINGS_ID].textTasks.find(t => t.id === editingTextTaskId);
        if (task) {
            task.title = title;
            task.time = time;
            task.star = star;
            task.content = content;
        }
        editingTextTaskId = null;
        document.getElementById('btn-admin-text-save').innerText = '課題を追加';
        recordAdminAudit('文章課題更新', { title, time, star });
        showCustomAlert('課題を更新しました！');
    } else {
        const taskId = 'tt_' + Date.now();
        users[GLOBAL_SETTINGS_ID].textTasks.push({ id: taskId, title: title, time: time, star: star, content: content });
        recordAdminAudit('文章課題追加', { title, time, star });
        showCustomAlert('新しい課題を追加しました！');
    }
    
    saveUsers(true); 
    document.getElementById('admin-text-title').value = ''; 
    document.getElementById('admin-text-time').value = ''; 
    document.getElementById('admin-text-star').value = '3'; 
    document.getElementById('admin-text-content').value = '';
    renderAdminTextTasks();
}

export function editTextTask(id) {
    const task = users[GLOBAL_SETTINGS_ID].textTasks.find(t => t.id === id);
    if (!task) return;
    editingTextTaskId = id;
    document.getElementById('admin-text-title').value = task.title;
    document.getElementById('admin-text-time').value = task.time;
    document.getElementById('admin-text-star').value = task.star || 3;
    document.getElementById('admin-text-content').value = task.content;
    document.getElementById('btn-admin-text-save').innerText = '課題を更新';
    document.getElementById('admin-text-title').focus();
}

export function moveTextTask(idx, dir) {
    const tasks = users[GLOBAL_SETTINGS_ID].textTasks;
    if (dir === -1 && idx > 0) {
        [tasks[idx-1], tasks[idx]] =[tasks[idx], tasks[idx-1]];
    } else if (dir === 1 && idx < tasks.length - 1) {
        [tasks[idx+1], tasks[idx]] = [tasks[idx], tasks[idx+1]];
    }
    recordAdminAudit('文章課題並び替え', { index: idx + 1, direction: dir === -1 ? 'up' : 'down' });
    saveUsers(true);
    renderAdminTextTasks();
}

export function renderAdminTextTasks() {
    const list = document.getElementById('admin-text-task-list'); list.innerHTML = '';
    const glob = users[GLOBAL_SETTINGS_ID];
    if (!glob || !glob.textTasks || glob.textTasks.length === 0) { list.innerHTML = '<li style="color:#999; text-align:center;">まだ課題がありません</li>'; return; }
    glob.textTasks.forEach((task, idx) => {
        const li = document.createElement('li');
        li.style.display = 'flex'; li.style.justifyContent = 'space-between'; li.style.alignItems = 'center'; li.style.marginBottom = '10px'; li.style.background = '#f9f9f9'; li.style.padding = '10px'; li.style.borderRadius = '5px'; li.style.border = '1px solid #ccc';
        
        let stars = "⭐".repeat(task.star || 3);
        
        li.innerHTML = `
            <div style="flex:1;">
                <strong>${task.title}</strong> <span style="font-size:12px; color:#FF9800;">${stars}</span> (${task.time}分)<br>
                <span style="font-size:12px; color:#666;">${task.content.substring(0, 30)}...</span>
            </div>
            <div style="display:flex; gap:5px;">
                <button class="btn-secondary" style="font-size:14px; padding:5px 10px;" onclick="moveTextTask(${idx}, -1)" ${idx === 0 ? 'disabled' : ''}>▲</button>
                <button class="btn-secondary" style="font-size:14px; padding:5px 10px;" onclick="moveTextTask(${idx}, 1)" ${idx === glob.textTasks.length - 1 ? 'disabled' : ''}>▼</button>
                <button class="btn-primary" style="font-size:14px; padding:5px 15px;" onclick="editTextTask('${task.id}')">編集</button>
                <button class="btn-danger" style="font-size:14px; padding:5px 15px;" onclick="deleteTextTask(${idx}, '${task.title}')">削除</button>
            </div>
        `;
        list.appendChild(li);
    });
}

export function deleteTextTask(idx, title) { 
    showCustomConfirm(`本当に課題「${title}」を削除しますか？`, () => {
        users[GLOBAL_SETTINGS_ID].textTasks.splice(idx, 1);
        recordAdminAudit('文章課題削除', { title });
        saveUsers(true); renderAdminTextTasks();
    });
}

export function insertRuby() {
    const ta = document.getElementById('admin-text-content');
    const rubyInp = document.getElementById('admin-ruby-input');
    const ruby = rubyInp.value.trim();
    if (!ruby) return showCustomAlert('よみがなを入力してください');
    const start = ta.selectionStart; const end = ta.selectionEnd;
    if (start === end) return showCustomAlert('テキストボックス内で、ルビを振りたい漢字をマウスで選択（ハイライト）してからボタンを押してください。');
    const text = ta.value; const selected = text.substring(start, end); const before = text.substring(0, start); const after = text.substring(end);
    ta.value = `${before}{${selected}|${ruby}}${after}`; rubyInp.value = ''; ta.focus();
    const newCursorPos = start + selected.length + ruby.length + 3; ta.setSelectionRange(newCursorPos, newCursorPos);
}

export function toggleAutoRubyTool() {
    const tool = document.getElementById('admin-auto-ruby-tool');
    tool.style.display = tool.style.display === 'none' ? 'flex' : 'none';
}

export function generateAutoRuby() {
    const tool = document.getElementById('admin-auto-ruby-tool');
    const btn = tool.querySelector('.btn-primary');
    const originalText = btn.innerText;
    btn.innerText = '⏳ 処理中...'; btn.disabled = true; btn.style.backgroundColor = '#9e9e9e';
    setTimeout(() => {
        try { processAutoRuby(); } catch(e) { console.error(e); showCustomAlert("エラーが発生しました。入力内容を確認してください。"); } 
        finally { btn.innerText = originalText; btn.disabled = false; btn.style.backgroundColor = ''; }
    }, 50);
}

export function processAutoRuby() {
    const original = document.getElementById('auto-ruby-origin').value.trim();
    const yomiInput = document.getElementById('auto-ruby-yomi').value.trim();
    if(!original || !yomiInput) return showCustomAlert('「原文」と「よみ」の両方を入力してください。');
    const toHira = (str) => str.replace(/[\u30a1-\u30f6]/g, match => String.fromCharCode(match.charCodeAt(0) - 0x60)).toLowerCase();
    const isKanji = (c) => /[\u4E00-\u9FFF\u3400-\u4DBF\uF900-\uFAFF々]/.test(c);
    const yStr = toHira(yomiInput.replace(/\s+/g, ''));
    let blocks =[]; let currentBlock = ""; let currentType = null; 
    const getType = (c) => { if (/\s/.test(c)) return 'space'; if (isKanji(c)) return 'kanji'; return 'other'; };
    for (let i = 0; i < original.length; i++) {
        let c = original[i]; let t = getType(c);
        if (i === 0) { currentType = t; currentBlock = c; } 
        else { if (currentType === t) { currentBlock += c; } else { blocks.push({ type: currentType, text: currentBlock }); currentType = t; currentBlock = c; } }
    }
    if (currentBlock) blocks.push({ type: currentType, text: currentBlock });
    let searchBlocks = blocks.filter(b => b.type !== 'space');
    let memo = {};
    function dfs(bIdx, yIdx) {
        let key = bIdx + "," + yIdx; if (memo[key] !== undefined) return memo[key];
        if (bIdx === searchBlocks.length) return yIdx === yStr.length ?[] : null;
        let b = searchBlocks[bIdx];
        if (b.type === 'other') {
            let compStr = toHira(b.text).replace(/\s+/g, ''); let len = compStr.length;
            if (yStr.substring(yIdx, yIdx + len) === compStr) { let res = dfs(bIdx + 1, yIdx + len); if (res !== null) { memo[key] = res; return res; } }
        } else {
            let nextB = searchBlocks[bIdx + 1];
            if (nextB && nextB.type === 'other') {
                let nextStr = toHira(nextB.text).replace(/\s+/g, ''); let searchStart = yIdx + 1;
                while (true) {
                    let matchIdx = yStr.indexOf(nextStr, searchStart); if (matchIdx === -1) break;
                    let res = dfs(bIdx + 1, matchIdx); if (res !== null) { let result =[yStr.substring(yIdx, matchIdx)].concat(res); memo[key] = result; return result; }
                    searchStart = matchIdx + 1;
                }
            } else {
                if (bIdx === searchBlocks.length - 1) {
                    let ruby = yStr.substring(yIdx); if (ruby.length > 0) { let result = [ruby]; memo[key] = result; return result; }
                } else {
                    for (let i = 1; yIdx + i <= yStr.length; i++) {
                        let res = dfs(bIdx + 1, yIdx + i); if (res !== null) { let result =[yStr.substring(yIdx, yIdx + i)].concat(res); memo[key] = result; return result; }
                    }
                }
            }
        }
        memo[key] = null; return null;
    }
    let rubies = dfs(0, 0);
    if (!rubies) return showCustomAlert("【ズレを発見しました！】\n「原文」と「よみ」の構成が一致しません。");
    let result = ""; let rubyIndex = 0;
    for (let i = 0; i < blocks.length; i++) {
        let b = blocks[i];
        if (b.type === 'space' || b.type === 'other') { result += b.text; } 
        else { result += `{${b.text}|${rubies[rubyIndex]}}`; rubyIndex++; }
    }
    document.getElementById('admin-text-content').value = result; toggleAutoRubyTool();
    showCustomAlert('✨ 自動ルビ振りが完了しました！\n\n上のテキストボックスの内容を確認し、問題なければ「課題を追加・更新」ボタンを押してください。');
}

export function exportData() {
    exportAdminBackupData();
}

export function importData(event) {
    importAdminBackupData(event);
}

export function openThemeCreator() { 
    document.getElementById('admin-theme-modal').style.display='flex'; 
    updateThemePreview(); 
}
export function closeThemeCreator() { document.getElementById('admin-theme-modal').style.display='none'; }

export function updateThemePreview() {
    const bg = document.getElementById('ct-bg').value;
    const text = document.getElementById('ct-text').value;
    const btnBg = document.getElementById('ct-btn-bg').value;
    const btnText = document.getElementById('ct-btn-text').value;
    const name = document.getElementById('ct-name').value || 'プレビュー';
    
    document.getElementById('ct-preview-text').innerText = name;

    let styleTag = document.getElementById('preview-dynamic-style');
    if (!styleTag) {
        styleTag = document.createElement('style');
        styleTag.id = 'preview-dynamic-style';
        document.head.appendChild(styleTag);
    }
    
    styleTag.innerHTML = `
        #ct-preview {
            background-color: ${bg} !important;
            border-color: ${text} !important;
        }
        #ct-preview-text {
            color: ${text} !important;
        }
        #ct-preview-btn {
            background-color: ${btnBg} !important;
            color: ${btnText} !important;
        }
    `;
}

export function saveCustomTheme() {
    const name = document.getElementById('ct-name').value.trim(); if(!name) return showCustomAlert('名前を入力してください');
    const bg = document.getElementById('ct-bg').value, text = document.getElementById('ct-text').value, btnBg = document.getElementById('ct-btn-bg').value, btnText = document.getElementById('ct-btn-text').value;
    const isPresent = document.getElementById('ct-present').checked; 
    
    if (!users[GLOBAL_SETTINGS_ID]) users[GLOBAL_SETTINGS_ID] = { isMaster:true }; if (!users[GLOBAL_SETTINGS_ID].globalMistakes) users[GLOBAL_SETTINGS_ID].globalMistakes = {};
    if (!Array.isArray(users[GLOBAL_SETTINGS_ID].globalMistakes.customThemes)) users[GLOBAL_SETTINGS_ID].globalMistakes.customThemes =[];
    const newId = 'ct_' + Date.now(); 
    users[GLOBAL_SETTINGS_ID].globalMistakes.customThemes.push({ id: newId, name: name, bg: bg, text: text, btnBg: btnBg, btnText: btnText });
    
    if (isPresent) {
        Object.keys(users).forEach(n => {
            if (!isSystemUserId(n)) {
                if (!users[n].items) users[n].items =[];
                if (!users[n].items.includes(newId)) users[n].items.push(newId);
            }
        });
        showCustomAlert('「' + name + '」を全員にプレゼントしました！');
    } else {
        showCustomAlert('「' + name + '」をガチャのラインナップに追加しました！'); 
    }
    
    recordAdminAudit('カスタムテーマ追加', { name, present: isPresent ? 'yes' : 'no' });
    saveUsers(true);
    if (typeof window.loadCustomGlobalSettings === 'function') window.loadCustomGlobalSettings();
    closeThemeCreator();
    document.getElementById('ct-name').value = ''; document.getElementById('ct-present').checked = false;
}

export function openEffectCreator() { document.getElementById('admin-effect-modal').style.display='flex'; }
export function closeEffectCreator() { document.getElementById('admin-effect-modal').style.display='none'; }

export function saveCustomEffect() {
    const name = document.getElementById('ce-name').value.trim(); if(!name) return showCustomAlert('名前を入力してください');
    const emojis =[document.getElementById('ce-emo1').value.trim(), document.getElementById('ce-emo2').value.trim(), document.getElementById('ce-emo3').value.trim()].filter(e => e !== '');
    if(emojis.length === 0) return showCustomAlert('絵文字を1つ以上入力してください');
    const isPresent = document.getElementById('ce-present').checked; 
    
    if (!users[GLOBAL_SETTINGS_ID]) users[GLOBAL_SETTINGS_ID] = { isMaster:true }; if (!users[GLOBAL_SETTINGS_ID].globalMistakes) users[GLOBAL_SETTINGS_ID].globalMistakes = {};
    if (!Array.isArray(users[GLOBAL_SETTINGS_ID].globalMistakes.customEffects)) users[GLOBAL_SETTINGS_ID].globalMistakes.customEffects =[];
    const newId = 'ce_' + Date.now();
    users[GLOBAL_SETTINGS_ID].globalMistakes.customEffects.push({ id: newId, name: name, emojis: emojis });
    
    if (isPresent) {
        Object.keys(users).forEach(n => {
            if (!isSystemUserId(n)) {
                if (!users[n].items) users[n].items =[];
                if (!users[n].items.includes(newId)) users[n].items.push(newId);
            }
        });
        showCustomAlert('「' + name + '」を全員にプレゼントしました！');
    } else {
        showCustomAlert('「' + name + '」をガチャのラインナップに追加しました！'); 
    }
    
    recordAdminAudit('カスタム演出追加', { name, present: isPresent ? 'yes' : 'no' });
    saveUsers(true);
    if (typeof window.loadCustomGlobalSettings === 'function') window.loadCustomGlobalSettings();
    closeEffectCreator();
    document.getElementById('ce-name').value = ''; document.getElementById('ce-present').checked = false;
}

export function openCustomManager() { const modal = document.getElementById('admin-custom-manage-modal'); if (!modal) return; renderCustomManagerList(); modal.style.display = 'flex'; }
export function closeCustomManager() { document.getElementById('admin-custom-manage-modal').style.display = 'none'; }
export function renderCustomManagerList() {
    const glob = users[GLOBAL_SETTINGS_ID], themeUl = document.getElementById('manage-theme-list'), effectUl = document.getElementById('manage-effect-list');
    if (!themeUl || !effectUl) return; themeUl.innerHTML = ''; effectUl.innerHTML = '';
    let hasTheme = false;
    if (glob && glob.globalMistakes && Array.isArray(glob.globalMistakes.customThemes)) {
        glob.globalMistakes.customThemes.forEach((ct, idx) => {
            hasTheme = true; const li = document.createElement('li'); li.style.display = 'flex'; li.style.justifyContent = 'space-between'; li.style.alignItems = 'center'; li.style.marginBottom = '10px';
            li.innerHTML = `<span>🎨 ${ct.name}</span> <button class="btn-danger" style="font-size:14px; padding:5px 15px;" onclick="deleteCustomElement('theme', ${idx}, '${ct.name}')">削除</button>`; themeUl.appendChild(li);
        });
    }
    if (!hasTheme) themeUl.innerHTML = '<li style="color:#999; text-align:center;">作ったテーマはありません</li>';
    let hasEffect = false;
    if (glob && glob.globalMistakes && Array.isArray(glob.globalMistakes.customEffects)) {
        glob.globalMistakes.customEffects.forEach((ce, idx) => {
            hasEffect = true; const li = document.createElement('li'); li.style.display = 'flex'; li.style.justifyContent = 'space-between'; li.style.alignItems = 'center'; li.style.marginBottom = '10px';
            li.innerHTML = `<span>🎉 ${ce.name} (${ce.emojis.join('')})</span> <button class="btn-danger" style="font-size:14px; padding:5px 15px;" onclick="deleteCustomElement('effect', ${idx}, '${ce.name}')">削除</button>`; effectUl.appendChild(li);
        });
    }
    if (!hasEffect) effectUl.innerHTML = '<li style="color:#999; text-align:center;">作った演出はありません</li>';
}
export function deleteCustomElement(type, idx, name) {
    showCustomConfirm(`本当に「${name}」を削除しますか？\n（※削除後、設定を反映するためにページが再読み込みされます）`, () => {
    const glob = users[GLOBAL_SETTINGS_ID];
        if (type === 'theme') glob.globalMistakes.customThemes.splice(idx, 1); else if (type === 'effect') glob.globalMistakes.customEffects.splice(idx, 1);
        recordAdminAudit('カスタム要素削除', { type, name });
        saveUsers(true); showCustomAlert('削除しました。画面を再読み込みします。'); setTimeout(() => location.reload(), 1500);
    });
}
