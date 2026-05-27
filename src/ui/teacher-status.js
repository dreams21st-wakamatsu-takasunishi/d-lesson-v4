import { STAGE_ORDER } from '../data/constants.js';
import {
    canManageScopedUserRow,
    createUserDataId,
    deleteCloudUserRows,
    DEFAULT_CAMPUS_ID,
    GLOBAL_SETTINGS_ID,
    currentLessonAccess,
    formatPracticeActivity,
    getCampusCode,
    getCampusName,
    getLatestPracticeActivity,
    getPracticeLogs,
    getTeacherScopeSummary,
    getUserCampusId,
    getUserDisplayName,
    hasLessonRole,
    isSystemUserId,
    normalizeCampusId,
    refreshCurrentLessonAccess,
    REQUIRE_SUPABASE_AUTH,
    saveManagedUserRows,
    supabase,
    userDisplayNameExists,
    users
} from '../api/user.js';
import { escapeCsvCell, getBackupDateStamp } from '../utils/export-format.js';
import { calculateGrade } from '../utils/helpers.js';
import { showCustomAlert, showCustomConfirm } from './modal.js';
import { recordAdminAudit } from './admin-audit.js';
import { showScreen } from './screen.js';

const TEACHER_STATUS_STALE_DAYS = 14;
const TEACHER_STATUS_LOW_KEYBOARD_PERCENT = 40;
const TEACHER_STATUS_LOW_MOUSE_LEVEL = 3;
const TEACHER_STATUS_PRINT_WINDOW_FEATURES = 'popup=yes,width=1180,height=840,menubar=no,toolbar=no,location=no,status=no,scrollbars=yes,resizable=yes';
const TEACHER_MENU_MODES = new Set(['students', 'grades', 'history', 'reports']);
const TEACHER_MENU_ITEMS = [
    { mode: 'students', icon: '👥', title: '担当児童', note: '担当範囲の児童一覧を確認', color: '#2196F3' },
    { mode: 'grades', icon: '📊', title: '生徒成績', note: '進捗・文章課題・要確認を見る', color: '#E91E63' },
    { mode: 'history', icon: '🗓️', title: '取り組み確認', note: '前回の練習や未実施を確認', color: '#795548' },
    { mode: 'reports', icon: '🖨️', title: 'レポート印刷', note: '個別詳細から印刷', color: '#607D8B' },
    { mode: 'preview', icon: '🔎', title: '先生用プレビュー', note: '保存せず練習画面を確認', color: '#00695C' }
];

const teacherStatusFilters = {
    search: '',
    group: 'all',
    status: 'all',
    sort: 'group-name'
};

let selectedTeacherStatusUserId = '';
let teacherMenuMode = 'students';

function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, char => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    })[char]);
}

function isStudentUser(userId, user) {
    if (!userId || !user || typeof user !== 'object') return false;
    if (isSystemUserId(userId) || String(userId).startsWith('__')) return false;
    if (user.isMaster === true) return false;
    if (['admin', 'teacher'].includes(String(user.role || '').toLowerCase())) return false;
    return true;
}

function getVisibleTextTasksForStudent(user) {
    const tasks = Array.isArray(users[GLOBAL_SETTINGS_ID]?.textTasks)
        ? users[GLOBAL_SETTINGS_ID].textTasks
        : [];
    const group = String(user?.group || '').trim();

    return tasks.filter(task => {
        if (task?.hidden === true) return false;
        const targetGroup = String(task?.targetGroup || '').trim();
        return !targetGroup || targetGroup === group;
    });
}

function getTextTaskProgress(user) {
    const tasks = getVisibleTextTasksForStudent(user);
    const done = tasks.filter(task => Boolean(user?.textRecords?.[task.id])).length;
    return {
        done,
        total: tasks.length,
        percent: tasks.length ? Math.round((done / tasks.length) * 100) : 0
    };
}

function getStudentRows() {
    return Object.entries(users)
        .filter(([userId, user]) => isStudentUser(userId, user))
        .map(([userId, user]) => {
            const text = getTextTaskProgress(user);
            const latestLog = getLatestPracticeActivity(userId);
            const latest = formatPracticeActivity(latestLog);
            const birthdate = user.birthdate || user.birth || '';
            const grade = (user.grade && String(user.grade) !== 'undefined')
                ? String(user.grade)
                : calculateGrade(birthdate);
            const campusId = getUserCampusId(user);
            const mouseLevel = Number(user.mouseLevel || 0);
            const keyboardSequence = Number(user.keyboardSequence || 0);
            const keyboardPercent = STAGE_ORDER.length
                ? Math.round((keyboardSequence / STAGE_ORDER.length) * 100)
                : 0;

            const row = {
                userId,
                name: getUserDisplayName(userId),
                birthdate,
                grade,
                campusId,
                campusName: getCampusName(campusId || DEFAULT_CAMPUS_ID),
                group: String(user.group || '').trim() || '-',
                coins: Number(user.coins || 0),
                mouseLevel,
                keyboardPercent,
                text,
                latestLog,
                latest
            };

            return {
                ...row,
                attention: getTeacherStatusAttention(row)
            };
        });
}

function getTeacherStatusGroups(rows) {
    return Array.from(new Set(
        rows
            .map(row => row.group)
            .filter(group => group && group !== '-')
    )).sort((a, b) => a.localeCompare(b, 'ja'));
}

function syncTeacherStatusControls(rows) {
    const searchInput = document.getElementById('teacher-status-search');
    const groupSelect = document.getElementById('teacher-status-group-filter');
    const statusSelect = document.getElementById('teacher-status-status-filter');
    const sortSelect = document.getElementById('teacher-status-sort');
    const groups = getTeacherStatusGroups(rows);

    if (searchInput && searchInput.value !== teacherStatusFilters.search) {
        searchInput.value = teacherStatusFilters.search;
    }

    if (groupSelect) {
        const current = teacherStatusFilters.group;
        groupSelect.innerHTML = `
            <option value="all">すべてのグループ</option>
            ${groups.map(group => `<option value="${escapeHtml(group)}">${escapeHtml(group)}</option>`).join('')}
        `;
        teacherStatusFilters.group = current === 'all' || groups.includes(current) ? current : 'all';
        groupSelect.value = teacherStatusFilters.group;
    }

    if (statusSelect && statusSelect.value !== teacherStatusFilters.status) {
        statusSelect.value = teacherStatusFilters.status;
    }

    if (sortSelect && sortSelect.value !== teacherStatusFilters.sort) {
        sortSelect.value = teacherStatusFilters.sort;
    }
}

function rowMatchesTeacherStatusFilters(row) {
    const search = teacherStatusFilters.search.trim().toLowerCase();
    if (search) {
        const haystack = `${row.name} ${row.userId} ${row.group}`.toLowerCase();
        if (!haystack.includes(search)) return false;
    }

    if (teacherStatusFilters.group !== 'all' && row.group !== teacherStatusFilters.group) return false;

    if (teacherStatusFilters.status === 'no-practice') {
        return !row.latestLog;
    }
    if (teacherStatusFilters.status === 'text-incomplete') {
        return row.text.total > 0 && row.text.done < row.text.total;
    }
    if (teacherStatusFilters.status === 'text-complete') {
        return row.text.total > 0 && row.text.done >= row.text.total;
    }

    return true;
}

function getFilteredTeacherStatusRows() {
    return sortTeacherStatusRows(getStudentRows().filter(rowMatchesTeacherStatusFilters));
}

function compareTeacherStatusByGroupName(a, b) {
    return (
        a.group.localeCompare(b.group, 'ja')
        || a.name.localeCompare(b.name, 'ja')
        || a.userId.localeCompare(b.userId, 'ja')
    );
}

function getLatestLogTime(row) {
    return Date.parse(row.latestLog?.at || '') || 0;
}

function getTeacherStatusAttention(row) {
    const attention = [];
    const latestTime = getLatestLogTime(row);

    if (!row.latestLog) {
        attention.push({ type: 'notice', label: '記録なし' });
    } else if (Date.now() - latestTime >= TEACHER_STATUS_STALE_DAYS * 24 * 60 * 60 * 1000) {
        attention.push({ type: 'notice', label: `${TEACHER_STATUS_STALE_DAYS}日以上` });
    }

    if (row.text.total > 0 && row.text.done < row.text.total) {
        attention.push({ type: 'warning', label: '文章未完了' });
    }

    if (row.keyboardPercent < TEACHER_STATUS_LOW_KEYBOARD_PERCENT) {
        attention.push({ type: 'info', label: 'キー低め' });
    }

    if (row.mouseLevel < TEACHER_STATUS_LOW_MOUSE_LEVEL) {
        attention.push({ type: 'info', label: 'マウス低め' });
    }

    return attention;
}

function getTeacherStatusAttentionText(row) {
    return row.attention.length ? row.attention.map(item => item.label).join(' / ') : 'OK';
}

function sortTeacherStatusRows(rows) {
    return [...rows].sort((a, b) => {
        if (teacherStatusFilters.sort === 'no-practice') {
            const hasLogOrder = Number(Boolean(a.latestLog)) - Number(Boolean(b.latestLog));
            return hasLogOrder || compareTeacherStatusByGroupName(a, b);
        }

        if (teacherStatusFilters.sort === 'text-incomplete') {
            const incompleteA = a.text.total > 0 ? a.text.total - a.text.done : 0;
            const incompleteB = b.text.total > 0 ? b.text.total - b.text.done : 0;
            return incompleteB - incompleteA || compareTeacherStatusByGroupName(a, b);
        }

        if (teacherStatusFilters.sort === 'keyboard-low') {
            return a.keyboardPercent - b.keyboardPercent || compareTeacherStatusByGroupName(a, b);
        }

        if (teacherStatusFilters.sort === 'mouse-low') {
            return a.mouseLevel - b.mouseLevel || compareTeacherStatusByGroupName(a, b);
        }

        if (teacherStatusFilters.sort === 'latest-old') {
            return getLatestLogTime(a) - getLatestLogTime(b) || compareTeacherStatusByGroupName(a, b);
        }

        return compareTeacherStatusByGroupName(a, b);
    });
}

function formatTeacherStatusDate(value) {
    const time = Date.parse(value || '');
    if (!time) return '-';
    return new Date(time).toLocaleString('ja-JP', {
        month: 'numeric',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function formatTeacherStatusFullDate(value) {
    const time = Date.parse(value || '');
    if (!time) return '-';
    return new Date(time).toLocaleString('ja-JP', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function getTextTaskDetailRows(userId) {
    const user = users[userId];
    if (!user) return [];
    return getVisibleTextTasksForStudent(user)
        .map(task => {
            const record = user.textRecords?.[task.id] || null;
            return {
                title: String(task.title || '無題の課題'),
                done: Boolean(record),
                score: record ? Number(record.score || 0) : null,
                miss: record ? Number(record.miss || 0) : null,
                attempts: record ? Math.max(1, Number(record.attempts || 1)) : 0,
                lastCompletedAt: record?.lastCompletedAt || record?.updatedAt || record?.bestAt || ''
            };
        })
        .sort((a, b) => Number(a.done) - Number(b.done) || a.title.localeCompare(b.title, 'ja'));
}

function downloadTeacherStatusCsv(filename, rows) {
    const csv = rows.map(row => row.map(escapeCsvCell).join(',')).join('\r\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
    const anchor = document.createElement('a');
    anchor.href = URL.createObjectURL(blob);
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(anchor.href);
}

function getTeacherStatusScopeLabel() {
    return hasLessonRole('admin') ? '全児童' : getTeacherScopeSummary(currentLessonAccess);
}

function getTeacherMenuItem(mode) {
    return TEACHER_MENU_ITEMS.find(item => item.mode === mode) || TEACHER_MENU_ITEMS[0];
}

function getTeacherMenuMetric(mode, rows) {
    if (mode === 'students') return `${rows.length}人`;
    if (mode === 'grades') return `要確認 ${rows.filter(row => row.attention.length > 0).length}`;
    if (mode === 'history') return `記録なし ${rows.filter(row => !row.latestLog).length}`;
    if (mode === 'reports') return '印刷';
    return '確認専用';
}

function renderTeacherModeNote(rows, allRows, scopeLabel) {
    const mode = getTeacherMenuItem(teacherMenuMode);
    const copy = {
        students: '担当範囲に入っている児童だけを表示します。校舎やグループの範囲外の児童は表示されません。',
        grades: 'マウス、キーボード、文章課題の進み具合を並べて確認します。詳しく見たい児童は「詳細」を押してください。',
        history: '前回の練習が古い児童や、まだ取り組み記録がない児童を見つけやすくする画面です。',
        reports: '表示中の範囲で児童を確認し、必要な児童の「詳細」から個別印刷できます。'
    }[teacherMenuMode] || '';

    return `
        <div class="teacher-status-mode-note">
            <div>
                <span>${escapeHtml(mode.icon)}</span>
                <strong>${escapeHtml(mode.title)}</strong>
            </div>
            <p>${escapeHtml(copy)}</p>
            <small>表示範囲: ${escapeHtml(scopeLabel)} / 表示中 ${escapeHtml(rows.length)}人 / 担当内 ${escapeHtml(allRows.length)}人</small>
        </div>
    `;
}

function runTeacherMenuAction(mode) {
    if (mode === 'preview') {
        closeTeacherStatus();
        if (typeof window.loginAsMaster === 'function') {
            window.loginAsMaster();
            return;
        }
        showCustomAlert('先生用プレビューを開けませんでした。画面を再読み込みしてからもう一度お試しください。');
        return;
    }

    if (!TEACHER_MENU_MODES.has(mode)) return;
    if (mode === 'history' && teacherStatusFilters.sort === 'group-name') {
        teacherStatusFilters.sort = 'latest-old';
    }
    if (mode === 'grades' && teacherStatusFilters.status === 'no-practice') {
        teacherStatusFilters.status = 'all';
    }

    showTeacherMenuSection(mode);
}

function buildTeacherStatusCsvRows(rows, scopeLabel) {
    return [
        [
            'scope',
            'student_name',
            'user_data_id',
            'group',
            'mouse_level',
            'keyboard_percent',
            'text_done',
            'text_total',
            'text_percent',
            'attention',
            'latest_title',
            'latest_when',
            'latest_detail'
        ],
        ...rows.map(row => [
            scopeLabel,
            row.name,
            row.userId,
            row.group,
            `Lv.${row.mouseLevel}`,
            `${row.keyboardPercent}%`,
            row.text.done,
            row.text.total,
            `${row.text.percent}%`,
            getTeacherStatusAttentionText(row),
            row.latest.title,
            row.latest.when,
            row.latest.detail
        ])
    ];
}

function exportTeacherStatusCsv() {
    const rows = getFilteredTeacherStatusRows();
    if (rows.length === 0) {
        showCustomAlert('出力できる児童がいません。絞り込み条件を確認してください。');
        return;
    }

    const scopeLabel = getTeacherStatusScopeLabel();
    downloadTeacherStatusCsv(
        `d-lesson_teacher_status_${getBackupDateStamp()}.csv`,
        buildTeacherStatusCsvRows(rows, scopeLabel)
    );
}

function exportTeacherTextIncompleteCsv() {
    const rows = getFilteredTeacherStatusRows()
        .filter(row => row.text.total > 0 && row.text.done < row.text.total);
    if (rows.length === 0) {
        showCustomAlert('表示中の範囲に、文章課題が未完了の児童はいません。');
        return;
    }

    const scopeLabel = getTeacherStatusScopeLabel();
    downloadTeacherStatusCsv(
        `d-lesson_teacher_text_incomplete_${getBackupDateStamp()}.csv`,
        buildTeacherStatusCsvRows(rows, scopeLabel)
    );
}

function buildTeacherStatusPrintHtml(rows, scopeLabel) {
    const generatedAt = new Date().toLocaleString('ja-JP', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });

    return `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<title>Dレッスン 先生メニュー確認</title>
<style>
    body { font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color: #263238; margin: 24px; }
    h1 { margin: 0 0 8px; color: #00695c; font-size: 24px; }
    .meta { display: flex; gap: 16px; flex-wrap: wrap; margin-bottom: 18px; color: #455a64; font-size: 13px; font-weight: 700; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; }
    th, td { border: 1px solid #b0bec5; padding: 7px 8px; text-align: left; vertical-align: top; }
    th { background: #e0f2f1; color: #004d40; }
    td small { display: block; margin-top: 3px; color: #607d8b; line-height: 1.45; }
    .note { margin-top: 14px; color: #607d8b; font-size: 11px; }
    @media print {
        body { margin: 12mm; }
        button { display: none; }
    }
</style>
</head>
<body>
    <h1>Dレッスン 先生メニュー確認</h1>
    <div class="meta">
        <span>表示範囲: ${escapeHtml(scopeLabel)}</span>
        <span>児童数: ${escapeHtml(rows.length)}人</span>
        <span>作成: ${escapeHtml(generatedAt)}</span>
    </div>
    <table>
        <thead>
            <tr>
                <th>児童</th>
                <th>グループ</th>
                <th>マウス</th>
                <th>キーボード</th>
                <th>文章課題</th>
                <th>要確認</th>
                <th>前回の練習</th>
            </tr>
        </thead>
        <tbody>
            ${rows.map(row => `
                <tr>
                    <td>${escapeHtml(row.name)}</td>
                    <td>${escapeHtml(row.group)}</td>
                    <td>Lv.${escapeHtml(row.mouseLevel)}</td>
                    <td>${escapeHtml(row.keyboardPercent)}%</td>
                    <td>${escapeHtml(row.text.done)} / ${escapeHtml(row.text.total)} (${escapeHtml(row.text.percent)}%)</td>
                    <td>${escapeHtml(getTeacherStatusAttentionText(row))}</td>
                    <td>
                        ${escapeHtml(row.latest.title)}
                        <small>${escapeHtml([row.latest.when, row.latest.detail].filter(Boolean).join(' / '))}</small>
                    </td>
                </tr>
            `).join('')}
        </tbody>
    </table>
    <div class="note">この印刷画面には、内部管理用の user_data_id は表示していません。</div>
</body>
</html>`;
}

function printTeacherStatus() {
    const rows = getFilteredTeacherStatusRows();
    if (rows.length === 0) {
        showCustomAlert('印刷できる児童がいません。絞り込み条件を確認してください。');
        return;
    }

    const printWindow = window.open('', '_blank', TEACHER_STATUS_PRINT_WINDOW_FEATURES);
    if (!printWindow) {
        showCustomAlert('印刷画面を開けませんでした。ブラウザのポップアップ設定を確認してください。');
        return;
    }

    printWindow.document.open();
    printWindow.document.write(buildTeacherStatusPrintHtml(rows, getTeacherStatusScopeLabel()));
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => printWindow.print(), 250);
}

function buildTeacherStudentDetailPrintHtml(row) {
    const generatedAt = new Date().toLocaleString('ja-JP', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });
    const logs = getPracticeLogs(row.userId).slice(0, 12);
    const textRows = getTextTaskDetailRows(row.userId);

    return `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<title>Dレッスン 児童詳細</title>
<style>
    body { font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color: #263238; margin: 24px; }
    h1 { margin: 0 0 8px; color: #00695c; font-size: 24px; }
    h2 { margin: 22px 0 8px; color: #00695c; font-size: 17px; border-bottom: 2px solid #b2dfdb; padding-bottom: 5px; }
    .meta { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; margin: 16px 0 18px; }
    .meta div { border: 1px solid #b0bec5; border-radius: 8px; padding: 10px; background: #f8fffe; }
    .meta span { display: block; color: #607d8b; font-size: 11px; font-weight: 800; }
    .meta strong { display: block; margin-top: 4px; font-size: 16px; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; }
    th, td { border: 1px solid #b0bec5; padding: 7px 8px; text-align: left; vertical-align: top; }
    th { background: #e0f2f1; color: #004d40; }
    .empty, .note { color: #607d8b; font-size: 12px; }
    @media print {
        body { margin: 12mm; }
        .meta { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    }
</style>
</head>
<body>
    <h1>Dレッスン 児童詳細</h1>
    <div class="meta">
        <div><span>児童</span><strong>${escapeHtml(row.name)}</strong></div>
        <div><span>グループ</span><strong>${escapeHtml(row.group)}</strong></div>
        <div><span>マウス</span><strong>Lv.${escapeHtml(row.mouseLevel)}</strong></div>
        <div><span>キーボード</span><strong>${escapeHtml(row.keyboardPercent)}%</strong></div>
        <div><span>文章課題</span><strong>${escapeHtml(row.text.done)} / ${escapeHtml(row.text.total)} (${escapeHtml(row.text.percent)}%)</strong></div>
        <div><span>要確認</span><strong>${escapeHtml(getTeacherStatusAttentionText(row))}</strong></div>
        <div><span>作成</span><strong>${escapeHtml(generatedAt)}</strong></div>
    </div>

    <h2>直近の取り組み</h2>
    ${logs.length ? `
        <table>
            <thead>
                <tr><th>日時</th><th>練習</th><th>内容</th><th>コイン</th></tr>
            </thead>
            <tbody>
                ${logs.map(log => `
                    <tr>
                        <td>${escapeHtml(formatTeacherStatusDate(log.at))}</td>
                        <td>${escapeHtml(log.title || '練習')}</td>
                        <td>${escapeHtml([log.detail, log.amount].filter(Boolean).join(' / ') || '-')}</td>
                        <td>${escapeHtml(Number(log.coins || 0))}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    ` : '<p class="empty">まだ取り組み記録がありません。</p>'}

    <h2>文章課題</h2>
    ${textRows.length ? `
        <table>
            <thead>
                <tr><th>課題</th><th>状態</th><th>最高文字数</th><th>ミス</th><th>回数</th><th>最終完了</th></tr>
            </thead>
            <tbody>
                ${textRows.map(item => `
                    <tr>
                        <td>${escapeHtml(item.title)}</td>
                        <td>${escapeHtml(item.done ? '完了' : '未完了')}</td>
                        <td>${item.done ? escapeHtml(item.score) : '-'}</td>
                        <td>${item.done ? escapeHtml(item.miss) : '-'}</td>
                        <td>${item.done ? escapeHtml(item.attempts) : '-'}</td>
                        <td>${item.done ? escapeHtml(formatTeacherStatusDate(item.lastCompletedAt)) : '-'}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    ` : '<p class="empty">表示対象の文章課題がありません。</p>'}

    <p class="note">この印刷画面には、内部管理用の user_data_id は表示していません。</p>
</body>
</html>`;
}

function printTeacherStudentDetail(userId) {
    const row = getStudentRows().find(item => item.userId === userId);
    if (!row) {
        showCustomAlert('印刷できる児童が見つかりません。');
        return;
    }

    const printWindow = window.open('', '_blank', TEACHER_STATUS_PRINT_WINDOW_FEATURES);
    if (!printWindow) {
        showCustomAlert('印刷画面を開けませんでした。ブラウザのポップアップ設定を確認してください。');
        return;
    }

    printWindow.document.open();
    printWindow.document.write(buildTeacherStudentDetailPrintHtml(row));
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => printWindow.print(), 250);
}

function attachTeacherStatusControlHandlers(modal) {
    if (modal.dataset.teacherStatusControls === 'attached') return;
    modal.dataset.teacherStatusControls = 'attached';

    const searchInput = modal.querySelector('#teacher-status-search');
    const groupSelect = modal.querySelector('#teacher-status-group-filter');
    const statusSelect = modal.querySelector('#teacher-status-status-filter');
    const sortSelect = modal.querySelector('#teacher-status-sort');
    const resetButton = modal.querySelector('#teacher-status-reset');
    const printButton = modal.querySelector('#teacher-status-print');
    const exportButton = modal.querySelector('#teacher-status-export');
    const incompleteExportButton = modal.querySelector('#teacher-status-incomplete-export');
    const body = modal.querySelector('#teacher-status-body');

    if (searchInput) {
        searchInput.addEventListener('input', event => {
            teacherStatusFilters.search = event.target.value || '';
            renderTeacherStatus();
        });
    }
    if (groupSelect) {
        groupSelect.addEventListener('change', event => {
            teacherStatusFilters.group = event.target.value || 'all';
            renderTeacherStatus();
        });
    }
    if (statusSelect) {
        statusSelect.addEventListener('change', event => {
            teacherStatusFilters.status = event.target.value || 'all';
            renderTeacherStatus();
        });
    }
    if (sortSelect) {
        sortSelect.addEventListener('change', event => {
            teacherStatusFilters.sort = event.target.value || 'group-name';
            renderTeacherStatus();
        });
    }
    if (resetButton) {
        resetButton.addEventListener('click', () => {
            teacherStatusFilters.search = '';
            teacherStatusFilters.group = 'all';
            teacherStatusFilters.status = 'all';
            teacherStatusFilters.sort = 'group-name';
            renderTeacherStatus();
        });
    }
    if (printButton) printButton.addEventListener('click', printTeacherStatus);
    if (exportButton) exportButton.addEventListener('click', exportTeacherStatusCsv);
    if (incompleteExportButton) incompleteExportButton.addEventListener('click', exportTeacherTextIncompleteCsv);
    if (body) {
        body.addEventListener('click', event => {
            const menuButton = event.target.closest('[data-teacher-menu-action]');
            if (menuButton) {
                runTeacherMenuAction(menuButton.dataset.teacherMenuAction || 'students');
                return;
            }

            const detailPrintButton = event.target.closest('[data-teacher-detail-print-user-id]');
            if (detailPrintButton) {
                printTeacherStudentDetail(detailPrintButton.dataset.teacherDetailPrintUserId || '');
                return;
            }

            const deleteButton = event.target.closest('[data-teacher-delete-user-id]');
            if (deleteButton) {
                deleteTeacherStudent(deleteButton.dataset.teacherDeleteUserId || '');
                return;
            }

            const addButton = event.target.closest('[data-teacher-add-student]');
            if (addButton) {
                void addTeacherStudentFromForm();
                return;
            }

            const button = event.target.closest('[data-teacher-status-user-id]');
            if (!button) return;
            selectedTeacherStatusUserId = button.dataset.teacherStatusUserId || '';
            renderTeacherStatus();
        });

        body.addEventListener('change', event => {
            const target = event.target;
            if (!(target instanceof HTMLInputElement)) return;

            const nameUserId = target.dataset.teacherEditName;
            if (nameUserId) {
                void updateTeacherStudentName(nameUserId, target.value);
                return;
            }

            const birthUserId = target.dataset.teacherEditBirthdate;
            if (birthUserId) {
                void updateTeacherStudentBirthdate(birthUserId, target.value);
                return;
            }

            const groupUserId = target.dataset.teacherEditGroup;
            if (groupUserId) {
                void updateTeacherStudentGroup(groupUserId, target.value);
            }
        });
    }
}

function renderProgressBar(percent) {
    const safePercent = Math.max(0, Math.min(100, Number(percent) || 0));
    return `
        <span class="teacher-status-progress" aria-label="${escapeHtml(safePercent)}%">
            <span style="width:${escapeHtml(safePercent)}%;"></span>
        </span>
    `;
}

function getTeacherStudentRow(userId) {
    return getStudentRows().find(row => row.userId === userId) || null;
}

function canManageTeacherStudent(userId) {
    return hasLessonRole('admin') || canManageScopedUserRow(userId);
}

function parseTeacherScopeValues(value) {
    return String(value || '')
        .split(',')
        .map(item => item.trim())
        .filter(Boolean);
}

function getTeacherDefaultCampusId() {
    if (hasLessonRole('admin')) return DEFAULT_CAMPUS_ID;
    const teacherAccess = currentLessonAccess.filter(access => access?.role === 'teacher');
    const campusAccess = teacherAccess.find(access => access.scope_type === 'campus' && parseTeacherScopeValues(access.scope_value).length);
    if (campusAccess) return normalizeCampusId(parseTeacherScopeValues(campusAccess.scope_value)[0]);

    const campusGroupAccess = teacherAccess.find(access => access.scope_type === 'campus_group' && parseTeacherScopeValues(access.scope_value).length);
    if (campusGroupAccess) {
        const first = parseTeacherScopeValues(campusGroupAccess.scope_value)[0] || '';
        return normalizeCampusId(first.split(':')[0] || DEFAULT_CAMPUS_ID);
    }

    return DEFAULT_CAMPUS_ID;
}

function createTeacherStudentRecord(name, birthdate, group) {
    const campusId = getTeacherDefaultCampusId();
    let userDataId = createUserDataId();
    while (users[userDataId]) userDataId = createUserDataId();

    users[userDataId] = {
        displayName: name,
        userDataId,
        birthdate,
        grade: calculateGrade(birthdate),
        campusId,
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

async function createTeacherStudentAuthAccount(userDataId, studentNumber, passcode) {
    if (!REQUIRE_SUPABASE_AUTH || !supabase) {
        throw new Error('Supabase Auth is not enabled.');
    }

    const user = users[userDataId];
    const campusId = getUserCampusId(user);
    const { data, error } = await supabase.functions.invoke('admin-create-student', {
        body: {
            userDataId,
            displayName: getUserDisplayName(userDataId),
            studentNumber,
            passcode,
            campusId,
            campusCode: getCampusCode(campusId),
            group: user?.group || ''
        }
    });

    if (error || data?.error) {
        throw new Error(data?.error || error?.message || 'Auth account creation failed.');
    }

    user.loginNumber = String(studentNumber || '').replace(/\D/g, '');
    user.authUserId = data.authUserId;
    await refreshCurrentLessonAccess();
    return data;
}

async function addTeacherStudentFromForm() {
    const nameInput = document.getElementById('teacher-add-name');
    const birthInput = document.getElementById('teacher-add-birthdate');
    const groupInput = document.getElementById('teacher-add-group');
    const numberInput = document.getElementById('teacher-add-login-number');
    const passcodeInput = document.getElementById('teacher-add-passcode');

    const name = String(nameInput?.value || '').trim();
    const birthdate = String(birthInput?.value || '').trim();
    const group = String(groupInput?.value || '').trim();
    const loginNumber = String(numberInput?.value || '').replace(/\D/g, '');
    const passcode = String(passcodeInput?.value || '').replace(/\D/g, '');

    if (!name) return showCustomAlert('児童名を入力してください。');
    if (userDisplayNameExists(name)) return showCustomAlert('同じ名前の児童がすでに登録されています。');
    if (!birthdate) return showCustomAlert('生年月日を入力してください。');
    if (!loginNumber) return showCustomAlert('児童番号を入力してください。');
    if (passcode.length < 6) return showCustomAlert('あいことばは6けた以上の数字で入力してください。');

    const userDataId = createTeacherStudentRecord(name, birthdate, group);
    const saved = await saveManagedUserRows(userDataId);
    if (!saved) {
        delete users[userDataId];
        renderTeacherStatus();
        showCustomAlert('児童データの保存に失敗しました。先生の担当校舎権限、または Supabase の teacher_campus_write_policies.sql 実行状況を確認してください。');
        return;
    }

    try {
        const authData = await createTeacherStudentAuthAccount(userDataId, loginNumber, passcode);
        await saveManagedUserRows(userDataId);
        recordAdminAudit('teacher_student_added', {
            user: name,
            userDataId,
            campusId: getUserCampusId(users[userDataId]),
            group,
            authUserId: authData.authUserId,
            loginNumber
        });
        if (nameInput) nameInput.value = '';
        if (birthInput) birthInput.value = '';
        if (groupInput) groupInput.value = '';
        if (numberInput) numberInput.value = '';
        if (passcodeInput) passcodeInput.value = '';
        renderTeacherStatus();
        renderTeacherMenuHome();
        showCustomAlert(`${name}さんを追加し、ログイン用アカウントを作成しました。\n番号: ${loginNumber}`);
    } catch (error) {
        console.error('Teacher add student auth failed:', error);
        renderTeacherStatus();
        showCustomAlert(`児童データは追加されましたが、Auth作成に失敗しました。\n${error.message}`);
    }
}

async function saveTeacherStudentChange(userId, action, payload, rollback) {
    const saved = await saveManagedUserRows(userId);
    if (!saved) {
        if (typeof rollback === 'function') rollback();
        renderTeacherStatus();
        renderTeacherMenuHome();
        showCustomAlert('保存に失敗しました。通信状態または先生の担当校舎権限を確認してください。');
        return false;
    }

    recordAdminAudit(action, {
        user: getUserDisplayName(userId),
        userDataId: userId,
        ...payload
    });
    renderTeacherStatus();
    renderTeacherMenuHome();
    return true;
}

async function updateTeacherStudentName(userId, value) {
    const user = users[userId];
    if (!user || !canManageTeacherStudent(userId)) {
        showCustomAlert('この児童を変更する権限がありません。');
        renderTeacherStatus();
        return;
    }

    const displayName = String(value || '').trim();
    const before = getUserDisplayName(userId);
    if (!displayName) {
        showCustomAlert('児童名を入力してください。');
        renderTeacherStatus();
        return;
    }
    if (displayName === before) return;
    if (userDisplayNameExists(displayName, userId)) {
        showCustomAlert('同じ名前の児童がすでに登録されています。');
        renderTeacherStatus();
        return;
    }

    user.displayName = displayName;
    await saveTeacherStudentChange(
        userId,
        'teacher_student_name_updated',
        { before, after: displayName },
        () => { user.displayName = before; }
    );
}

async function updateTeacherStudentBirthdate(userId, value) {
    const user = users[userId];
    if (!user || !canManageTeacherStudent(userId)) {
        showCustomAlert('この児童を変更する権限がありません。');
        renderTeacherStatus();
        return;
    }

    const birthdate = String(value || '').trim();
    const beforeBirthdate = user.birthdate || user.birth || '';
    const beforeGrade = user.grade;
    if (!birthdate) {
        showCustomAlert('生年月日を入力してください。');
        renderTeacherStatus();
        return;
    }
    if (birthdate === beforeBirthdate) return;

    user.birthdate = birthdate;
    user.grade = calculateGrade(birthdate);
    await saveTeacherStudentChange(
        userId,
        'teacher_student_birthdate_updated',
        { before: beforeBirthdate, after: birthdate },
        () => {
            user.birthdate = beforeBirthdate;
            user.grade = beforeGrade;
        }
    );
}

async function updateTeacherStudentGroup(userId, value) {
    const user = users[userId];
    if (!user || !canManageTeacherStudent(userId)) {
        showCustomAlert('この児童を変更する権限がありません。');
        renderTeacherStatus();
        return;
    }

    const group = String(value || '').trim();
    const before = user.group || '';
    if (group === before) return;

    user.group = group;
    await saveTeacherStudentChange(
        userId,
        'teacher_student_group_updated',
        { before, after: group },
        () => { user.group = before; }
    );
}

function deleteTeacherStudent(userId) {
    const row = getTeacherStudentRow(userId);
    if (!row || !users[userId]) {
        showCustomAlert('削除できる児童が見つかりません。');
        renderTeacherStatus();
        return;
    }
    if (!canManageTeacherStudent(userId)) {
        showCustomAlert('この児童を削除する権限がありません。');
        renderTeacherStatus();
        return;
    }

    showCustomConfirm(`${row.name}さんを削除しますか？\nこの操作はクラウド上の児童データも削除します。`, async () => {
        const backup = users[userId];
        try {
            await deleteCloudUserRows(userId);
            delete users[userId];
            selectedTeacherStatusUserId = '';
            recordAdminAudit('teacher_student_deleted', {
                user: row.name,
                userDataId: userId,
                campusId: row.campusId,
                group: row.group
            });
            renderTeacherStatus();
            renderTeacherMenuHome();
            showCustomAlert(`${row.name}さんを削除しました。`);
        } catch (error) {
            console.error('Teacher delete failed:', error);
            users[userId] = backup;
            renderTeacherStatus();
            showCustomAlert('削除に失敗しました。先生の担当校舎権限、または Supabase の teacher_campus_write_policies.sql 実行状況を確認してください。');
        }
    });
}

function renderTeacherStatusDetail(rows) {
    const selectedRow = rows.find(row => row.userId === selectedTeacherStatusUserId);
    if (!selectedRow) return '';

    const logs = getPracticeLogs(selectedRow.userId).slice(0, 8);
    const textRows = getTextTaskDetailRows(selectedRow.userId).slice(0, 10);

    return `
        <div class="teacher-status-detail">
            <div class="teacher-status-detail-head">
                <div>
                    <span>児童詳細</span>
                    <strong>${escapeHtml(selectedRow.name)}</strong>
                    <small>${escapeHtml(selectedRow.group)} / マウス Lv.${escapeHtml(selectedRow.mouseLevel)} / キーボード ${escapeHtml(selectedRow.keyboardPercent)}%</small>
                    <div class="teacher-status-detail-alerts">${renderTeacherStatusAttention(selectedRow)}</div>
                </div>
                <div class="teacher-status-detail-actions">
                    <button type="button" data-teacher-detail-print-user-id="${escapeHtml(selectedRow.userId)}">個別印刷</button>
                    <button type="button" data-teacher-status-user-id="">閉じる</button>
                </div>
            </div>
            <div class="teacher-status-detail-grid">
                <section>
                    <h3>直近の取り組み</h3>
                    ${logs.length ? `
                        <ul class="teacher-status-log-list">
                            ${logs.map(log => `
                                <li>
                                    <strong>${escapeHtml(log.title || '練習')}</strong>
                                    <span>${escapeHtml(formatTeacherStatusDate(log.at))}</span>
                                    <small>${escapeHtml([log.detail, log.amount].filter(Boolean).join(' / ') || '-')}</small>
                                </li>
                            `).join('')}
                        </ul>
                    ` : '<p class="teacher-status-detail-empty">まだ取り組み記録がありません。</p>'}
                </section>
                <section>
                    <h3>文章課題</h3>
                    ${textRows.length ? `
                        <ul class="teacher-status-text-list">
                            ${textRows.map(item => `
                                <li class="${item.done ? 'done' : 'todo'}">
                                    <strong>${escapeHtml(item.title)}</strong>
                                    <span>${item.done ? '完了' : '未完了'}</span>
                                    <small>${item.done
                                        ? `最高 ${escapeHtml(item.score)}文字 / ミス ${escapeHtml(item.miss)} / ${escapeHtml(item.attempts)}回 / ${escapeHtml(formatTeacherStatusDate(item.lastCompletedAt))}`
                                        : 'まだ完了記録がありません。'
                                    }</small>
                                </li>
                            `).join('')}
                        </ul>
                    ` : '<p class="teacher-status-detail-empty">表示対象の文章課題がありません。</p>'}
                </section>
            </div>
        </div>
    `;
}

function renderTeacherStatusAttention(row) {
    if (!row.attention.length) {
        return '<span class="teacher-status-ok">OK</span>';
    }

    const visibleItems = row.attention.slice(0, 3);
    const hiddenCount = row.attention.length - visibleItems.length;
    return `
        <div class="teacher-status-alerts">
            ${visibleItems.map(item => `
                <span class="teacher-status-alert ${escapeHtml(item.type)}">${escapeHtml(item.label)}</span>
            `).join('')}
            ${hiddenCount > 0 ? `<span class="teacher-status-alert more">+${escapeHtml(hiddenCount)}</span>` : ''}
        </div>
    `;
}

function renderStudentRows(rows) {
    if (rows.length === 0) {
        return `
            <div class="teacher-status-empty">
                表示できる児童がいません。担当グループや利用権限の設定を確認してください。
            </div>
        `;
    }

    return `
        <div class="teacher-status-table-wrap">
            <table class="teacher-status-table">
                <thead>
                    <tr>
                        <th>児童</th>
                        <th>グループ</th>
                        <th>マウス</th>
                        <th>キーボード</th>
                        <th>文章課題</th>
                        <th>要確認</th>
                        <th>前回の練習</th>
                        <th>詳細</th>
                    </tr>
                </thead>
                <tbody>
                    ${rows.map(row => `
                        <tr>
                            <td>
                                <strong>${escapeHtml(row.name)}</strong>
                                <small>${escapeHtml(row.userId)}</small>
                            </td>
                            <td>${escapeHtml(row.group)}</td>
                            <td>Lv.${escapeHtml(row.mouseLevel)}</td>
                            <td>
                                <span>${escapeHtml(row.keyboardPercent)}%</span>
                                ${renderProgressBar(row.keyboardPercent)}
                            </td>
                            <td>
                                <span>${escapeHtml(row.text.done)} / ${escapeHtml(row.text.total)}</span>
                                ${renderProgressBar(row.text.percent)}
                            </td>
                            <td>${renderTeacherStatusAttention(row)}</td>
                            <td>
                                <strong>${escapeHtml(row.latest.title)}</strong>
                                <small>${escapeHtml([row.latest.when, row.latest.detail].filter(Boolean).join(' / '))}</small>
                            </td>
                            <td>
                                <button type="button" class="teacher-status-detail-btn" data-teacher-status-user-id="${escapeHtml(row.userId)}">
                                    詳細
                                </button>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;
}

function renderTeacherStudentManagementRows(rows) {
    const addForm = `
        <div class="teacher-student-add-card">
            <div>
                <strong>児童を追加</strong>
                <small>ログイン中の先生の担当校舎に自動で所属します。児童番号とあいことばも同時に作成します。</small>
            </div>
            <input id="teacher-add-name" type="text" placeholder="児童名">
            <input id="teacher-add-birthdate" type="date" title="生年月日">
            <input id="teacher-add-group" type="text" placeholder="グループ 例: 月曜A">
            <input id="teacher-add-login-number" type="text" inputmode="numeric" placeholder="番号">
            <input id="teacher-add-passcode" type="password" inputmode="numeric" placeholder="あいことば">
            <button type="button" data-teacher-add-student>追加してAuth作成</button>
        </div>
    `;

    if (rows.length === 0) {
        return `
            ${addForm}
            <div class="teacher-status-empty">
                表示できる児童がいません。検索条件、担当校舎、先生ロールの範囲を確認してください。
            </div>
        `;
    }

    return `
        ${addForm}
        <div class="teacher-status-table-wrap teacher-student-manage-wrap">
            <table class="teacher-status-table teacher-student-manage-table">
                <thead>
                    <tr>
                        <th>児童名</th>
                        <th>校舎</th>
                        <th>生年月日</th>
                        <th>学年</th>
                        <th>グループ</th>
                        <th>進捗</th>
                        <th>コイン</th>
                        <th>操作</th>
                    </tr>
                </thead>
                <tbody>
                    ${rows.map(row => {
                        const canManage = canManageTeacherStudent(row.userId);
                        return `
                            <tr>
                                <td>
                                    <input
                                        type="text"
                                        class="teacher-student-input"
                                        value="${escapeHtml(row.name)}"
                                        data-teacher-edit-name="${escapeHtml(row.userId)}"
                                        ${canManage ? '' : 'disabled'}
                                    >
                                    <small>${escapeHtml(row.userId)}</small>
                                </td>
                                <td><span class="teacher-student-readonly">${escapeHtml(row.campusName)}</span></td>
                                <td>
                                    <input
                                        type="date"
                                        class="teacher-student-input date"
                                        value="${escapeHtml(row.birthdate)}"
                                        data-teacher-edit-birthdate="${escapeHtml(row.userId)}"
                                        ${canManage ? '' : 'disabled'}
                                    >
                                </td>
                                <td>${escapeHtml(row.grade || '-')}</td>
                                <td>
                                    <input
                                        type="text"
                                        class="teacher-student-input"
                                        value="${escapeHtml(row.group === '-' ? '' : row.group)}"
                                        placeholder="例: 月曜A"
                                        data-teacher-edit-group="${escapeHtml(row.userId)}"
                                        ${canManage ? '' : 'disabled'}
                                    >
                                </td>
                                <td>
                                    <span>マウス Lv.${escapeHtml(row.mouseLevel)}</span>
                                    <small>キーボード ${escapeHtml(row.keyboardPercent)}% / 文章 ${escapeHtml(row.text.done)} / ${escapeHtml(row.text.total)}</small>
                                </td>
                                <td>${escapeHtml(row.coins)}枚</td>
                                <td>
                                    <button
                                        type="button"
                                        class="teacher-status-detail-btn"
                                        data-teacher-detail-print-user-id="${escapeHtml(row.userId)}"
                                    >レポート</button>
                                    <button
                                        type="button"
                                        class="teacher-danger-mini"
                                        data-teacher-delete-user-id="${escapeHtml(row.userId)}"
                                        ${canManage ? '' : 'disabled'}
                                    >削除</button>
                                </td>
                            </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
        </div>
    `;
}

function getTeacherHistoryEntries(rows) {
    return rows
        .flatMap(row => getPracticeLogs(row.userId).map(log => ({
            row,
            log,
            time: Date.parse(log.at || '') || 0
        })))
        .sort((a, b) => b.time - a.time)
        .slice(0, 300);
}

function renderTeacherHistoryRows(rows) {
    const entries = getTeacherHistoryEntries(rows);
    if (entries.length === 0) {
        return `
            <div class="teacher-status-empty">
                表示範囲内に取り組み記録がありません。
            </div>
        `;
    }

    return `
        <div class="teacher-status-table-wrap teacher-history-wrap">
            <table class="teacher-status-table teacher-history-table">
                <thead>
                    <tr>
                        <th>日時</th>
                        <th>児童</th>
                        <th>グループ</th>
                        <th>取り組み</th>
                        <th>内容</th>
                        <th>コイン</th>
                    </tr>
                </thead>
                <tbody>
                    ${entries.map(({ row, log }) => `
                        <tr>
                            <td>${escapeHtml(formatTeacherStatusFullDate(log.at))}</td>
                            <td><strong>${escapeHtml(row.name)}</strong></td>
                            <td>${escapeHtml(row.group)}</td>
                            <td>${escapeHtml(log.title || '練習')}</td>
                            <td>${escapeHtml([log.detail, log.amount, log.status].filter(Boolean).join(' / ') || '-')}</td>
                            <td>${escapeHtml(Number(log.coins || 0))}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;
}

function renderTeacherReportRows(rows) {
    if (rows.length === 0) {
        return `
            <div class="teacher-status-empty">
                レポートを表示できる児童がいません。
            </div>
        `;
    }

    return `
        <div class="teacher-report-grid">
            ${rows.map(row => `
                <article class="teacher-report-card">
                    <div>
                        <strong>${escapeHtml(row.name)}</strong>
                        <small>${escapeHtml(row.campusName)} / ${escapeHtml(row.group)} / ${escapeHtml(row.grade || '-')}</small>
                    </div>
                    <dl>
                        <div><dt>マウス</dt><dd>Lv.${escapeHtml(row.mouseLevel)}</dd></div>
                        <div><dt>キーボード</dt><dd>${escapeHtml(row.keyboardPercent)}%</dd></div>
                        <div><dt>文章</dt><dd>${escapeHtml(row.text.done)} / ${escapeHtml(row.text.total)}</dd></div>
                    </dl>
                    <button type="button" data-teacher-detail-print-user-id="${escapeHtml(row.userId)}">レポートを印刷</button>
                </article>
            `).join('')}
        </div>
    `;
}

function renderTeacherModeContent(rows) {
    if (teacherMenuMode === 'students') return renderTeacherStudentManagementRows(rows);
    if (teacherMenuMode === 'history') return renderTeacherHistoryRows(rows);
    if (teacherMenuMode === 'reports') return renderTeacherReportRows(rows);
    return `${renderTeacherStatusDetail(rows)}${renderStudentRows(rows)}`;
}

function renderTeacherMenuHome() {
    const mainMenu = document.getElementById('teacher-main-menu');
    const scope = document.getElementById('teacher-menu-scope');
    if (!mainMenu || !scope) return;

    const rows = getStudentRows();
    const scopeLabel = getTeacherStatusScopeLabel();
    const noPracticeCount = rows.filter(row => !row.latestLog).length;
    const attentionCount = rows.filter(row => row.attention.length > 0).length;

    scope.innerHTML = `
        <div>
            <span>表示範囲</span>
            <strong>${escapeHtml(scopeLabel)}</strong>
        </div>
        <div>
            <span>担当児童</span>
            <strong>${escapeHtml(rows.length)}人</strong>
        </div>
        <div>
            <span>要確認 / 記録なし</span>
            <strong>${escapeHtml(attentionCount)} / ${escapeHtml(noPracticeCount)}人</strong>
        </div>
    `;

    mainMenu.innerHTML = TEACHER_MENU_ITEMS.map(item => `
        <button
            type="button"
            class="category-btn teacher-menu-home-card"
            data-teacher-menu-action="${escapeHtml(item.mode)}"
            style="background-color:${escapeHtml(item.color)};"
        >
            <span class="teacher-menu-home-icon">${escapeHtml(item.icon)}</span>
            <span class="teacher-menu-home-title">${escapeHtml(item.title)}</span>
            <span class="teacher-menu-home-note">${escapeHtml(item.note)}</span>
            <span class="teacher-menu-home-metric">${escapeHtml(getTeacherMenuMetric(item.mode, rows))}</span>
        </button>
    `).join('');
}

function ensureTeacherMenuScreen() {
    let screen = document.getElementById('screen-teacher-menu');
    if (screen) return screen;

    document.getElementById('teacher-status-modal')?.remove();

    screen = document.createElement('div');
    screen.id = 'screen-teacher-menu';
    screen.className = 'screen';
    screen.innerHTML = `
        <div class="screen-content teacher-menu-screen-content">
            <h2>📋 先生メニュー</h2>
            <div id="teacher-menu-scope" class="teacher-menu-scope"></div>
            <div id="teacher-main-menu" class="teacher-menu-home-grid"></div>
            <div id="teacher-panel-content" class="teacher-panel-content" style="display:none;">
                <div class="teacher-panel-toolbar">
                    <button type="button" id="teacher-panel-back" class="btn-secondary">← 先生メニューへもどる</button>
                    <div>
                        <h3 id="teacher-panel-title">担当児童</h3>
                        <p id="teacher-panel-description">担当範囲の児童状況を確認します。</p>
                    </div>
                </div>
                <div class="teacher-status-controls">
                    <input id="teacher-status-search" type="text" placeholder="児童名・IDで検索">
                    <select id="teacher-status-group-filter">
                        <option value="all">すべてのグループ</option>
                    </select>
                    <select id="teacher-status-status-filter">
                        <option value="all">すべての状況</option>
                        <option value="no-practice">前回記録なし</option>
                        <option value="text-incomplete">文章課題 未完了あり</option>
                        <option value="text-complete">文章課題 完了</option>
                    </select>
                    <select id="teacher-status-sort">
                        <option value="group-name">グループ・名前順</option>
                        <option value="text-incomplete">文章未完了が多い順</option>
                        <option value="no-practice">前回記録なしを上に</option>
                        <option value="keyboard-low">キーボード進捗が低い順</option>
                        <option value="mouse-low">マウスLvが低い順</option>
                        <option value="latest-old">前回練習が古い順</option>
                    </select>
                    <button type="button" id="teacher-status-reset" class="teacher-status-reset">解除</button>
                    <button type="button" id="teacher-status-print" class="teacher-status-print">印刷</button>
                    <button type="button" id="teacher-status-export" class="teacher-status-export">表示中CSV</button>
                    <button type="button" id="teacher-status-incomplete-export" class="teacher-status-export secondary">未完了CSV</button>
                </div>
                <div id="teacher-status-body" class="teacher-status-body teacher-menu-panel-body"></div>
            </div>
            <button id="teacher-menu-bottom-back" class="btn-secondary bottom-back-btn">タイトルへもどる</button>
        </div>
    `;

    const container = document.getElementById('game-container') || document.body;
    container.appendChild(screen);
    attachTeacherStatusControlHandlers(screen);

    screen.querySelector('#teacher-main-menu')?.addEventListener('click', event => {
        const button = event.target.closest('[data-teacher-menu-action]');
        if (!button) return;
        runTeacherMenuAction(button.dataset.teacherMenuAction || 'students');
    });
    screen.querySelector('#teacher-panel-back')?.addEventListener('click', showTeacherMenuHome);
    screen.querySelector('#teacher-menu-bottom-back')?.addEventListener('click', () => showScreen('screen-title'));

    return screen;
}

function syncTeacherPanelHeader() {
    const item = getTeacherMenuItem(teacherMenuMode);
    const title = document.getElementById('teacher-panel-title');
    const description = document.getElementById('teacher-panel-description');
    if (title) title.textContent = `${item.icon} ${item.title}`;
    if (description) {
        description.textContent = {
            students: '担当範囲の児童一覧を確認します。詳しく見たい児童は詳細を押してください。',
            grades: '進捗、文章課題、要確認の児童をまとめて確認します。',
            history: '前回の練習や未実施の児童を確認します。',
            reports: '個別詳細から児童レポートを印刷します。'
        }[teacherMenuMode] || '担当範囲の児童状況を確認します。';
    }
}

function showTeacherMenuHome() {
    const screen = ensureTeacherMenuScreen();
    selectedTeacherStatusUserId = '';
    renderTeacherMenuHome();

    const main = screen.querySelector('#teacher-main-menu');
    const panel = screen.querySelector('#teacher-panel-content');
    const bottomBack = screen.querySelector('#teacher-menu-bottom-back');
    if (main) main.style.display = 'grid';
    if (panel) panel.style.display = 'none';
    if (bottomBack) bottomBack.style.display = 'block';
    showScreen('screen-teacher-menu');
}

function showTeacherMenuSection(mode) {
    const screen = ensureTeacherMenuScreen();
    teacherMenuMode = TEACHER_MENU_MODES.has(mode) ? mode : 'students';
    selectedTeacherStatusUserId = '';

    const main = screen.querySelector('#teacher-main-menu');
    const panel = screen.querySelector('#teacher-panel-content');
    const bottomBack = screen.querySelector('#teacher-menu-bottom-back');
    if (main) main.style.display = 'none';
    if (panel) panel.style.display = 'flex';
    if (bottomBack) bottomBack.style.display = 'none';
    syncTeacherPanelHeader();
    renderTeacherStatus();
    showScreen('screen-teacher-menu');
}

function ensureTeacherStatusModal() {
    let modal = document.getElementById('teacher-status-modal');
    if (modal) return modal;

    modal = document.createElement('div');
    modal.id = 'teacher-status-modal';
    modal.className = 'teacher-status-overlay';
    modal.style.display = 'none';
    modal.innerHTML = `
        <div class="teacher-status-dialog" role="dialog" aria-modal="true" aria-labelledby="teacher-status-title">
            <div class="teacher-status-header">
                <div>
                    <h2 id="teacher-status-title">先生メニュー</h2>
                    <p>担当範囲の児童状況を確認します。校舎・グループの範囲外の児童は表示されません。</p>
                </div>
                <button type="button" class="teacher-status-close" onclick="closeTeacherStatus()" aria-label="閉じる">×</button>
            </div>
            <div class="teacher-status-controls">
                <input id="teacher-status-search" type="text" placeholder="児童名・IDで検索">
                <select id="teacher-status-group-filter">
                    <option value="all">すべてのグループ</option>
                </select>
                <select id="teacher-status-status-filter">
                    <option value="all">すべての状況</option>
                    <option value="no-practice">前回記録なし</option>
                    <option value="text-incomplete">文章課題 未完了あり</option>
                    <option value="text-complete">文章課題 完了</option>
                </select>
                <select id="teacher-status-sort">
                    <option value="group-name">グループ・名前順</option>
                    <option value="text-incomplete">文章未完了が多い順</option>
                    <option value="no-practice">前回記録なしを上に</option>
                    <option value="keyboard-low">キーボード進捗が低い順</option>
                    <option value="mouse-low">マウスLvが低い順</option>
                    <option value="latest-old">前回練習が古い順</option>
                </select>
                <button type="button" id="teacher-status-reset" class="teacher-status-reset">解除</button>
                <button type="button" id="teacher-status-print" class="teacher-status-print">印刷</button>
                <button type="button" id="teacher-status-export" class="teacher-status-export">表示中CSV</button>
                <button type="button" id="teacher-status-incomplete-export" class="teacher-status-export secondary">未完了CSV</button>
            </div>
            <div id="teacher-status-body" class="teacher-status-body"></div>
        </div>
    `;
    document.body.appendChild(modal);
    attachTeacherStatusControlHandlers(modal);
    modal.addEventListener('click', event => {
        if (event.target === modal) closeTeacherStatus();
    });
    return modal;
}

function renderTeacherStatus() {
    const allRows = getStudentRows();
    syncTeacherStatusControls(allRows);
    const rows = sortTeacherStatusRows(allRows.filter(rowMatchesTeacherStatusFilters));
    if (selectedTeacherStatusUserId && !rows.some(row => row.userId === selectedTeacherStatusUserId)) {
        selectedTeacherStatusUserId = '';
    }
    const body = document.getElementById('teacher-status-body');
    if (!body) return;

    const noPracticeCount = rows.filter(row => !row.latestLog).length;
    const incompleteTextCount = rows.filter(row => row.text.total > 0 && row.text.done < row.text.total).length;
    const attentionCount = rows.filter(row => row.attention.length > 0).length;
    const scopeLabel = getTeacherStatusScopeLabel();

    body.innerHTML = `
        ${renderTeacherModeNote(rows, allRows, scopeLabel)}
        <div class="teacher-status-summary">
            <div>
                <span>表示範囲</span>
                <strong>${escapeHtml(scopeLabel)}</strong>
            </div>
            <div>
                <span>表示中 / 児童数</span>
                <strong>${escapeHtml(rows.length)} / ${escapeHtml(allRows.length)}人</strong>
            </div>
            <div>
                <span>前回記録なし / 文章未完了</span>
                <strong>${escapeHtml(noPracticeCount)} / ${escapeHtml(incompleteTextCount)}人</strong>
            </div>
            <div>
                <span>要確認</span>
                <strong>${escapeHtml(attentionCount)}人</strong>
            </div>
        </div>
        ${renderTeacherModeContent(rows)}
    `;
}

export function closeTeacherStatus() {
    const modal = document.getElementById('teacher-status-modal');
    if (modal) modal.style.display = 'none';
}

export function openTeacherStatus() {
    openTeacherMenu('students');
}

export function openTeacherMenu(mode = 'home') {
    if (!hasLessonRole('teacher', 'admin')) {
        showCustomAlert('先生または管理者アカウントでログインしてください。');
        return;
    }

    if (TEACHER_MENU_MODES.has(mode)) {
        showTeacherMenuSection(mode);
        return;
    }

    showTeacherMenuHome();
}
