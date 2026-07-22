import { VISION_STAGES } from '../data/constants.js';
import {
    getActiveKeyboardStageIds,
    getCompletedActiveKeyboardStageIds
} from '../utils/keyboard-progression.js';
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
    invokeLessonFunction,
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
import { calculateGrade, sortGrades } from '../utils/helpers.js';
import { getStandardRouteStatus, renderStandardRouteCell } from '../utils/standard-route.js';
import { showCustomAlert, showCustomConfirm } from './modal.js';
import { recordAdminAudit } from './admin-audit.js';
import { showScreen } from './screen.js';
import { getDashboardProgressPercent, getVisionDifficultySuffix } from './admin-dashboard-utils.js';
import { buildPracticeHistoryCsv } from './admin-practice-history-utils.js';
import {
    buildVisionRadarData,
    renderVisionRadarChart
} from './admin-report-utils.js';
import { openStudentReportPanel } from './admin-student-report.js';
import { openStudentLoginCardsPrintWindow } from './student-login-cards.js';

const TEACHER_STATUS_STALE_DAYS = 14;
const TEACHER_STATUS_LOW_KEYBOARD_PERCENT = 40;
const TEACHER_STATUS_LOW_MOUSE_LEVEL = 3;
const TEACHER_STATUS_PRINT_WINDOW_FEATURES = 'popup=yes,width=1180,height=840,menubar=no,toolbar=no,location=no,status=no,scrollbars=yes,resizable=yes';
const TEACHER_MENU_MODES = new Set(['students', 'grades', 'history', 'reports', 'textTasks', 'rewards']);
const TEACHER_MENU_ITEMS = [
    { mode: 'grades', icon: '📊', title: '生徒成績', note: '進捗・文章課題・要確認を見る', color: '#E91E63' },
    { mode: 'history', icon: '🗓️', title: '取り組み確認', note: '前回の練習や未実施を確認', color: '#795548' },
    { mode: 'students', icon: '👥', title: '生徒管理/Auth作成', note: '追加・編集・削除を担当範囲だけで実行', color: '#2196F3' },
    { mode: 'textTasks', icon: '📝', title: '文章課題', note: '担当児童の課題状況を確認', color: '#4CAF50' },
    { mode: 'rewards', icon: '🎟️', title: 'チケット・コイン', note: '担当児童への付与と履歴確認', color: '#FF9800' },
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
let teacherGradeTab = 'basic';

const teacherGradeFilters = {
    basicGrade: 'all',
    basicGroup: 'all',
    basicSort: 'name',
    visionDifficulty: 'normal',
    visionTarget: 'all',
    visionGrade: 'all',
    visionGroup: 'all',
    visionSearch: '',
    visionView: 'table',
    textGrade: 'all',
    textGroup: 'all',
    textSearch: '',
    textStudent: ''
};

const teacherHistoryFilters = {
    view: 'date',
    date: '',
    student: '',
    grade: 'all',
    group: 'all',
    sort: 'time_desc',
    search: ''
};

function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, char => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    })[char]);
}

function updateTeacherOptionValue(currentValue, values, fallback = 'all') {
    return values.includes(currentValue) ? currentValue : fallback;
}

function getTeacherGrades(rows) {
    return sortGrades(Array.from(new Set(rows.map(row => row.grade).filter(Boolean))));
}

function getTeacherGroups(rows) {
    return Array.from(new Set(rows.map(row => row.group).filter(group => group && group !== '-')))
        .sort((a, b) => a.localeCompare(b, 'ja'));
}

function renderTeacherOptions(values, allLabel, selected = 'all') {
    return `
        <option value="all"${selected === 'all' ? ' selected' : ''}>${escapeHtml(allLabel)}</option>
        ${values.map(value => `<option value="${escapeHtml(value)}"${value === selected ? ' selected' : ''}>${escapeHtml(value)}</option>`).join('')}
    `;
}

function filterTeacherRowsByGradeGroupSearch(rows, grade = 'all', group = 'all', search = '') {
    const normalizedSearch = String(search || '').trim().toLowerCase();
    return rows.filter(row => {
        if (grade !== 'all' && row.grade !== grade) return false;
        if (group !== 'all' && row.group !== group) return false;
        if (!normalizedSearch) return true;
        return `${row.name} ${row.userId} ${row.group}`.toLowerCase().includes(normalizedSearch);
    });
}

function renderTeacherProgressCell(value, total, color) {
    const pct = getDashboardProgressPercent(value, total);
    return `<div class="teacher-admin-progress-cell">
        <span style="width:${escapeHtml(pct)}%; background:${escapeHtml(color)};">${pct ? `${escapeHtml(pct)}%` : ''}</span>
    </div>`;
}

function formatTeacherSeconds(value) {
    return Number.isFinite(value) && value > 0 ? `${value.toFixed(1)}秒` : '-';
}

function formatTeacherVisionDiff(record, average) {
    if (!Number.isFinite(record) || !Number.isFinite(average) || average <= 0) return '';
    const diff = record - average;
    if (Math.abs(diff) < 0.05) return '<small class="teacher-vision-diff even">平均と同じくらい</small>';
    const className = diff < 0 ? 'good' : 'slow';
    const label = diff < 0 ? '平均より速い' : '平均よりゆっくり';
    return `<small class="teacher-vision-diff ${className}">${Math.abs(diff).toFixed(1)}秒 ${label}</small>`;
}

function getTeacherTextHistory(userId) {
    return getPracticeLogs(userId)
        .filter(log => log.category === 'text' || String(log.title || '').includes('文章入力'))
        .map(log => {
            const amount = `${log.amount || ''}`;
            const scoreMatch = amount.match(/(?:純文字数|score|文字数)\s*[:：]?\s*([0-9]+)/i);
            const inputMatch = amount.match(/(?:入力|total)\s*[:：]?\s*([0-9]+)/i);
            const score = scoreMatch ? Number(scoreMatch[1]) : (inputMatch ? Number(inputMatch[1]) : null);
            return {
                ...log,
                score,
                atMs: Date.parse(log.at) || 0
            };
        })
        .filter(log => log.atMs && Number.isFinite(log.score))
        .sort((a, b) => a.atMs - b.atMs);
}

function buildTeacherTextMetrics(row) {
    const tasks = getVisibleTextTasksForStudent(row.user);
    const records = row.user?.textRecords || {};
    const completed = tasks.filter(task => records[task.id]).length;
    const taskRecords = tasks.map(task => records[task.id]).filter(Boolean);
    const attempts = taskRecords.reduce((sum, record) => sum + Number(record?.attempts || 1), 0);
    const bestScore = taskRecords.reduce((max, record) => Math.max(max, Number(record?.score || 0)), 0);
    const latestAt = taskRecords
        .map(record => Date.parse(record?.lastCompletedAt || record?.bestAt || record?.updatedAt || ''))
        .filter(value => Number.isFinite(value))
        .sort((a, b) => b - a)[0] || 0;
    const history = getTeacherTextHistory(row.userId);
    const firstScore = history.find(log => Number.isFinite(log.score))?.score || 0;
    const lastScore = [...history].reverse().find(log => Number.isFinite(log.score))?.score || 0;
    const growth = history.length >= 2 ? lastScore - firstScore : 0;
    return { total: tasks.length, completed, attempts, bestScore, latestAt, history, growth };
}

function renderTeacherSummaryCard(label, value, color) {
    return `
        <div class="teacher-admin-summary-card" style="border-color:${escapeHtml(color)};">
            <span>${escapeHtml(label)}</span>
            <strong style="color:${escapeHtml(color)};">${escapeHtml(value)}</strong>
        </div>
    `;
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
        .filter(([userId]) => hasLessonRole('admin') || canManageScopedUserRow(userId))
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
            const keyboardCompleted = getCompletedActiveKeyboardStageIds(user.keyboardSequence).length;
            const keyboardTotal = getActiveKeyboardStageIds().length;
            const keyboardPercent = keyboardTotal
                ? Math.round((keyboardCompleted / keyboardTotal) * 100)
                : 0;
            const routeStatus = getStandardRouteStatus(user, users[GLOBAL_SETTINGS_ID] || {});

            const row = {
                userId,
                user,
                name: getUserDisplayName(userId),
                birthdate,
                grade,
                campusId,
                campusName: getCampusName(campusId || DEFAULT_CAMPUS_ID),
                group: String(user.group || '').trim() || '-',
                coins: Number(user.coins || 0),
                mouseLevel,
                keyboardPercent,
                routeStatus,
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
    if (mode === 'textTasks') {
        const entries = getTeacherScopedTextTasks(rows);
        const incomplete = entries.reduce((sum, entry) => sum + entry.stats.incomplete, 0);
        return `課題 ${entries.length} / 未完了 ${incomplete}`;
    }
    if (mode === 'rewards') return '付与・履歴';
    return '確認専用';
}

function renderTeacherModeNote(rows, allRows, scopeLabel) {
    const mode = getTeacherMenuItem(teacherMenuMode);
    const copy = {
        students: '担当範囲に入っている児童だけを表示します。校舎やグループの範囲外の児童は表示されません。',
        grades: 'マウス、キーボード、文章課題の進み具合を並べて確認します。詳しく見たい児童は「詳細」を押してください。',
        history: '前回の練習が古い児童や、まだ取り組み記録がない児童を見つけやすくする画面です。',
        reports: '表示中の範囲で児童を確認し、必要な児童の「詳細」から個別印刷できます。',
        textTasks: '担当範囲の児童に関係する文章課題の実施状況を確認し、CSVで出力できます。',
        rewards: '担当範囲の児童にだけ、コインやいいねポイントを付与できます。全体設定は管理者専用です。'
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

function openTeacherStudentReport(userId) {
    const row = getStudentRows().find(item => item.userId === userId);
    if (!row) {
        showCustomAlert('表示できる担当児童が見つかりません。');
        return;
    }
    openStudentReportPanel(userId);
}

function exportTeacherHistoryCsv() {
    const rows = getFilteredTeacherHistoryRows(getFilteredTeacherStatusRows()).rows;
    if (!rows.length) {
        showCustomAlert('CSVに出力できる取り組み記録がありません。');
        return;
    }
    const csv = buildPracticeHistoryCsv(rows);
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    const scope = teacherHistoryFilters.view === 'student'
        ? `student_${teacherHistoryFilters.student || 'unknown'}`
        : (teacherHistoryFilters.date || 'all');
    anchor.href = url;
    anchor.download = `d-lesson_teacher_practice_${scope}_${getBackupDateStamp()}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
    recordAdminAudit('teacher_practice_history_csv_exported', { scope, rows: rows.length });
}

function resetTeacherHistoryFilters() {
    teacherHistoryFilters.view = 'date';
    teacherHistoryFilters.date = '';
    teacherHistoryFilters.student = '';
    teacherHistoryFilters.grade = 'all';
    teacherHistoryFilters.group = 'all';
    teacherHistoryFilters.sort = 'time_desc';
    teacherHistoryFilters.search = '';
    renderTeacherStatus();
}

function updateTeacherGradeFilter(name, value) {
    if (!Object.prototype.hasOwnProperty.call(teacherGradeFilters, name)) return;
    teacherGradeFilters[name] = value;
    renderTeacherStatus();
}

function updateTeacherHistoryFilter(name, value) {
    if (!Object.prototype.hasOwnProperty.call(teacherHistoryFilters, name)) return;
    teacherHistoryFilters[name] = value;
    renderTeacherStatus();
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
                openTeacherStudentReport(detailPrintButton.dataset.teacherDetailPrintUserId || '');
                return;
            }

            const reportButton = event.target.closest('[data-teacher-report-open-user-id]');
            if (reportButton) {
                openTeacherStudentReport(reportButton.dataset.teacherReportOpenUserId || '');
                return;
            }

            const gradeTabButton = event.target.closest('[data-teacher-grade-tab]');
            if (gradeTabButton) {
                teacherGradeTab = ['basic', 'vision', 'text'].includes(gradeTabButton.dataset.teacherGradeTab)
                    ? gradeTabButton.dataset.teacherGradeTab
                    : 'basic';
                renderTeacherStatus();
                return;
            }

            const historyResetButton = event.target.closest('[data-teacher-history-reset]');
            if (historyResetButton) {
                resetTeacherHistoryFilters();
                return;
            }

            const historyExportButton = event.target.closest('[data-teacher-history-export]');
            if (historyExportButton) {
                exportTeacherHistoryCsv();
                return;
            }

            const deleteButton = event.target.closest('[data-teacher-delete-user-id]');
            if (deleteButton) {
                deleteTeacherStudent(deleteButton.dataset.teacherDeleteUserId || '');
                return;
            }

            const passcodeButton = event.target.closest('[data-teacher-passcode-user-id]');
            if (passcodeButton) {
                void resetTeacherStudentPasscode(passcodeButton.dataset.teacherPasscodeUserId || '');
                return;
            }

            const addButton = event.target.closest('[data-teacher-add-student]');
            if (addButton) {
                void addTeacherStudentFromForm();
                return;
            }

            const textExportButton = event.target.closest('[data-teacher-text-export-task]');
            if (textExportButton) {
                exportTeacherTextTaskCsv(textExportButton.dataset.teacherTextExportTask || '', false);
                return;
            }

            const textIncompleteButton = event.target.closest('[data-teacher-text-incomplete-task]');
            if (textIncompleteButton) {
                exportTeacherTextTaskCsv(textIncompleteButton.dataset.teacherTextIncompleteTask || '', true);
                return;
            }

            const coinButton = event.target.closest('[data-teacher-grant-coins]');
            if (coinButton) {
                void grantTeacherCoinsFromForm();
                return;
            }

            const ticketButton = event.target.closest('[data-teacher-grant-ticket]');
            if (ticketButton) {
                void grantTeacherTicketFromForm();
                return;
            }

            const button = event.target.closest('[data-teacher-status-user-id]');
            if (!button) return;
            selectedTeacherStatusUserId = button.dataset.teacherStatusUserId || '';
            renderTeacherStatus();
        });

        body.addEventListener('input', event => {
            const target = event.target;
            if (!(target instanceof HTMLInputElement)) return;
            const gradeFilter = target.dataset.teacherGradeFilter;
            if (gradeFilter) {
                updateTeacherGradeFilter(gradeFilter, target.value || '');
                return;
            }
            const historyFilter = target.dataset.teacherHistoryFilter;
            if (historyFilter) {
                updateTeacherHistoryFilter(historyFilter, target.value || '');
            }
        });

        body.addEventListener('change', event => {
            const target = event.target;
            if (target instanceof HTMLSelectElement) {
                const gradeFilter = target.dataset.teacherGradeFilter;
                if (gradeFilter) {
                    updateTeacherGradeFilter(gradeFilter, target.value || 'all');
                    return;
                }
                const historyFilter = target.dataset.teacherHistoryFilter;
                if (historyFilter) {
                    updateTeacherHistoryFilter(historyFilter, target.value || 'all');
                    return;
                }
            }
            if (!(target instanceof HTMLInputElement)) return;

            const gradeFilter = target.dataset.teacherGradeFilter;
            if (gradeFilter) {
                updateTeacherGradeFilter(gradeFilter, target.value || '');
                return;
            }
            const historyFilter = target.dataset.teacherHistoryFilter;
            if (historyFilter) {
                updateTeacherHistoryFilter(historyFilter, target.value || '');
                return;
            }

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
        mouseLevel: 0,
        keyboardSequence: 0,
        coins: 0,
        items: [],
        tickets: [],
        loginStamps: [],
        group
    };
    return userDataId;
}

function generateTeacherPasscode(length = 6) {
    const cryptoApi = globalThis.crypto;
    const digits = [];
    for (let i = 0; i < length; i++) {
        const buffer = new Uint8Array(1);
        if (cryptoApi?.getRandomValues) {
            cryptoApi.getRandomValues(buffer);
            digits.push(String(buffer[0] % 10));
        } else {
            digits.push(String(Math.floor(Math.random() * 10)));
        }
    }
    return digits.join('');
}

async function createTeacherStudentAuthAccount(userDataId, studentNumber, passcode, mode = 'create') {
    if (!REQUIRE_SUPABASE_AUTH || !supabase) {
        throw new Error('Supabase Auth is not enabled.');
    }

    const user = users[userDataId];
    const campusId = getUserCampusId(user);
    const data = await invokeLessonFunction('admin-create-student', {
        userDataId,
        displayName: getUserDisplayName(userDataId),
        studentNumber,
        passcode,
        authUserId: user?.authUserId || '',
        mode,
        campusId,
        campusCode: getCampusCode(campusId),
        group: user?.group || ''
    });

    user.loginNumber = String(studentNumber || '').replace(/\D/g, '');
    user.authUserId = data.authUserId;
    user.authPasscodeIssuedAt = new Date().toISOString();
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
        openStudentLoginCardsPrintWindow([{
            student_number: loginNumber,
            display_name: name,
            password: passcode
        }], {
            title: 'Dレッスン ログインカード',
            cardsPerPage: 6
        });
        showCustomAlert(`${name}さんを追加し、ログイン用アカウントを作成しました。\n番号: ${loginNumber}`);
    } catch (error) {
        console.error('Teacher add student auth failed:', error);
        renderTeacherStatus();
        showCustomAlert(`児童データは追加されましたが、Auth作成に失敗しました。\n${error.message}`);
    }
}

async function resetTeacherStudentPasscode(userId) {
    if (!userId || !users[userId] || !canManageTeacherStudent(userId)) {
        showCustomAlert('担当範囲内の児童を選択してください。');
        return;
    }

    const user = users[userId];
    const displayName = getUserDisplayName(userId);
    const numberInput = window.prompt(`${displayName} さんの児童番号を確認してください。`, user.loginNumber || '');
    if (numberInput === null) return;
    const studentNumber = String(numberInput || '').replace(/\D/g, '');
    if (!studentNumber) {
        showCustomAlert('児童番号を入力してください。');
        return;
    }

    const passcodeInput = window.prompt(`${displayName} さんの新しいあいことばを入力してください。\nこの値は保存されず、再発行直後のカードにだけ表示します。`, generateTeacherPasscode(6));
    if (passcodeInput === null) return;
    const passcode = String(passcodeInput || '').replace(/\D/g, '');
    if (passcode.length < 6) {
        showCustomAlert('あいことばは6けた以上の数字で入力してください。');
        return;
    }

    showCustomConfirm(`${displayName} さんのあいことばを再発行しますか？\n古いあいことばではログインできなくなります。`, async () => {
        try {
            const authData = await createTeacherStudentAuthAccount(userId, studentNumber, passcode, 'reset');
            const saved = await saveManagedUserRows(userId);
            if (!saved) throw new Error('児童データの保存に失敗しました。');
            recordAdminAudit('teacher_student_passcode_reset', {
                user: displayName,
                userDataId: userId,
                authUserId: authData.authUserId,
                loginNumber: studentNumber
            });
            renderTeacherStatus();
            renderTeacherMenuHome();
            openStudentLoginCardsPrintWindow([{
                student_number: studentNumber,
                display_name: displayName,
                password: passcode
            }], {
                title: 'Dレッスン ログインカード',
                cardsPerPage: 6
            });
            showCustomAlert(`${displayName} さんのあいことばを再発行しました。`);
        } catch (error) {
            console.error('Teacher reset student passcode failed:', error);
            showCustomAlert(`あいことばの再発行に失敗しました。\n${error.message}`);
        }
    });
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

function getTeacherTextTasks() {
    return Array.isArray(users[GLOBAL_SETTINGS_ID]?.textTasks)
        ? users[GLOBAL_SETTINGS_ID].textTasks
        : [];
}

function getTeacherTextTaskStats(task, rows) {
    const targetGroup = String(task?.targetGroup || '').trim();
    const targets = rows.filter(row => !targetGroup || row.group === targetGroup);
    const completed = targets.filter(row => Boolean(users[row.userId]?.textRecords?.[task.id])).length;
    return {
        targetGroup,
        targets,
        completed,
        incomplete: Math.max(0, targets.length - completed),
        percent: targets.length ? Math.round((completed / targets.length) * 100) : 0
    };
}

function getTeacherScopedTextTasks(rows) {
    const groups = new Set(rows.map(row => row.group).filter(group => group && group !== '-'));
    return getTeacherTextTasks()
        .filter(task => {
            const targetGroup = String(task?.targetGroup || '').trim();
            return !targetGroup || groups.has(targetGroup);
        })
        .map(task => ({
            task,
            stats: getTeacherTextTaskStats(task, rows)
        }));
}

function exportTeacherTextTaskCsv(taskId, incompleteOnly = false) {
    const rows = getFilteredTeacherStatusRows();
    const entry = getTeacherScopedTextTasks(rows).find(item => item.task.id === taskId);
    if (!entry) {
        showCustomAlert('出力できる課題が見つかりません。');
        return;
    }

    const csvRows = [[
        'task_title',
        'student_name',
        'user_data_id',
        'campus',
        'group',
        'status',
        'score',
        'miss',
        'attempts',
        'last_completed_at'
    ]];

    entry.stats.targets
        .filter(row => {
            const record = users[row.userId]?.textRecords?.[taskId];
            return incompleteOnly ? !record : true;
        })
        .forEach(row => {
            const record = users[row.userId]?.textRecords?.[taskId] || null;
            csvRows.push([
                entry.task.title || '',
                row.name,
                row.userId,
                row.campusName,
                row.group,
                record ? 'done' : 'incomplete',
                record?.score ?? '',
                record?.miss ?? '',
                record?.attempts ?? '',
                record?.lastCompletedAt || record?.updatedAt || record?.bestAt || ''
            ]);
        });

    const suffix = incompleteOnly ? 'incomplete' : 'progress';
    downloadTeacherStatusCsv(
        `d-lesson_teacher_text_task_${suffix}_${getBackupDateStamp()}.csv`,
        csvRows
    );
}

function getTeacherTicketConfig() {
    const config = users[GLOBAL_SETTINGS_ID]?.ticketConfig || {};
    return {
        normal: {
            id: 'ticket_normal',
            icon: config.normal?.icon || '🎟️',
            name: config.normal?.name || '👍 いいねポイント 5こ'
        },
        newRecord: {
            id: 'ticket_newrecord',
            icon: config.newRecord?.icon || '🎟️',
            name: config.newRecord?.name || '👍 いいねポイント 1こ'
        }
    };
}

function getTeacherRewardTargetRows(selectId = 'teacher-reward-target') {
    const rows = getFilteredTeacherStatusRows();
    const select = document.getElementById(selectId);
    const target = select?.value || '__filtered__';
    if (target === '__filtered__') return rows;
    return rows.filter(row => row.userId === target);
}

async function grantTeacherCoinsFromForm() {
    const amountInput = document.getElementById('teacher-coin-amount');
    const amount = Math.floor(Number(amountInput?.value || 0));
    const targetRows = getTeacherRewardTargetRows('teacher-reward-target');

    if (!targetRows.length) return showCustomAlert('付与できる児童がいません。');
    if (!Number.isFinite(amount) || amount <= 0) return showCustomAlert('付与するコイン数を入力してください。');

    const applyGrant = async () => {
        targetRows.forEach(row => {
            users[row.userId].coins = Number(users[row.userId]?.coins || 0) + amount;
        });
        const saved = await saveManagedUserRows(targetRows.map(row => row.userId));
        if (!saved) {
            showCustomAlert('コイン付与の保存に失敗しました。先生の担当範囲または通信状態を確認してください。');
            return;
        }
        recordAdminAudit('teacher_coin_granted', {
            amount,
            count: targetRows.length,
            users: targetRows.map(row => row.userId)
        });
        renderTeacherStatus();
        renderTeacherMenuHome();
        showCustomAlert(`${targetRows.length}人に ${amount} コインを付与しました。`);
    };

    if (targetRows.length > 1) {
        showCustomConfirm(`表示中の ${targetRows.length}人に ${amount} コインを付与しますか？`, () => { void applyGrant(); });
        return;
    }
    await applyGrant();
}

async function grantTeacherTicketFromForm() {
    const type = document.getElementById('teacher-ticket-type')?.value === 'newRecord' ? 'newRecord' : 'normal';
    const config = getTeacherTicketConfig()[type];
    const targetRows = getTeacherRewardTargetRows('teacher-ticket-target');

    if (!targetRows.length) return showCustomAlert('付与できる児童がいません。');

    const applyGrant = async () => {
        const date = new Date().toLocaleDateString('ja-JP');
        targetRows.forEach(row => {
            if (!Array.isArray(users[row.userId].tickets)) users[row.userId].tickets = [];
            users[row.userId].tickets.push({
                id: config.id,
                name: config.name,
                date
            });
        });
        const saved = await saveManagedUserRows(targetRows.map(row => row.userId));
        if (!saved) {
            showCustomAlert('チケット付与の保存に失敗しました。先生の担当範囲または通信状態を確認してください。');
            return;
        }
        recordAdminAudit('teacher_ticket_granted', {
            ticket: config.name,
            count: targetRows.length,
            users: targetRows.map(row => row.userId)
        });
        renderTeacherStatus();
        renderTeacherMenuHome();
        showCustomAlert(`${targetRows.length}人に「${config.name}」を付与しました。`);
    };

    if (targetRows.length > 1) {
        showCustomConfirm(`表示中の ${targetRows.length}人に「${config.name}」を付与しますか？`, () => { void applyGrant(); });
        return;
    }
    await applyGrant();
}

function getTeacherTicketHistoryEntries(rows) {
    return rows
        .flatMap(row => (Array.isArray(users[row.userId]?.ticketHistory) ? users[row.userId].ticketHistory : []).map(item => ({
            row,
            item,
            time: Number(item.timestamp || Date.parse(item.date || '')) || 0
        })))
        .sort((a, b) => b.time - a.time)
        .slice(0, 80);
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
                                        class="teacher-status-detail-btn"
                                        data-teacher-passcode-user-id="${escapeHtml(row.userId)}"
                                        ${canManage ? '' : 'disabled'}
                                    >合言葉再発行</button>
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

function renderTeacherHistoryRowsLegacy(rows) {
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

function getTeacherPracticeHistoryRows(rows) {
    return rows.flatMap(row => getPracticeLogs(row.userId).map(log => {
        const atMs = Date.parse(log.at || '');
        const info = formatPracticeActivity(log);
        const date = atMs ? new Date(atMs) : null;
        return {
            userId: row.userId,
            name: row.name,
            grade: row.grade,
            group: row.group === '-' ? '' : row.group,
            category: String(log.category || 'practice'),
            dateKey: date
                ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
                : '',
            timeText: date ? date.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' }) : '-',
            atMs: atMs || 0,
            title: info.title || log.title || '練習',
            detail: log.detail || info.detail || '',
            amount: log.amount || '',
            coins: Number(log.coins || 0),
            status: log.status || ''
        };
    }))
        .filter(item => item.atMs)
        .sort((a, b) => b.atMs - a.atMs || a.name.localeCompare(b.name, 'ja'));
}

function syncTeacherHistoryFilterDefaults(allRows) {
    const dates = Array.from(new Set(allRows.map(row => row.dateKey).filter(Boolean))).sort((a, b) => b.localeCompare(a));
    const students = Array.from(new Map(allRows.map(row => [row.userId, row.name])).entries())
        .map(([id, name]) => ({ id, name }))
        .sort((a, b) => a.name.localeCompare(b.name, 'ja'));
    teacherHistoryFilters.date = updateTeacherOptionValue(teacherHistoryFilters.date, dates, dates[0] || '');
    teacherHistoryFilters.student = students.some(student => student.id === teacherHistoryFilters.student)
        ? teacherHistoryFilters.student
        : (students[0]?.id || '');
}

function getFilteredTeacherHistoryRows(rows) {
    const allRows = getTeacherPracticeHistoryRows(rows);
    syncTeacherHistoryFilterDefaults(allRows);
    const search = teacherHistoryFilters.search.trim().toLowerCase();
    const filtered = allRows.filter(row => {
        if (teacherHistoryFilters.view === 'date') {
            if (!teacherHistoryFilters.date || row.dateKey !== teacherHistoryFilters.date) return false;
            if (teacherHistoryFilters.grade !== 'all' && row.grade !== teacherHistoryFilters.grade) return false;
            if (teacherHistoryFilters.group !== 'all' && row.group !== teacherHistoryFilters.group) return false;
        } else if (teacherHistoryFilters.view === 'student') {
            if (!teacherHistoryFilters.student || row.userId !== teacherHistoryFilters.student) return false;
        }
        if (!search) return true;
        return `${row.name} ${row.userId} ${row.group} ${row.title} ${row.detail} ${row.amount}`.toLowerCase().includes(search);
    });

    filtered.sort((a, b) => {
        if (teacherHistoryFilters.sort === 'time_asc') return a.atMs - b.atMs || a.name.localeCompare(b.name, 'ja');
        if (teacherHistoryFilters.sort === 'student_asc') return a.name.localeCompare(b.name, 'ja') || a.atMs - b.atMs;
        return b.atMs - a.atMs || a.name.localeCompare(b.name, 'ja');
    });

    return { rows: filtered, allRows };
}

function renderTeacherHistoryRows(rows) {
    const { rows: historyRows, allRows } = getFilteredTeacherHistoryRows(rows);
    const grades = getTeacherGrades(rows);
    const groups = getTeacherGroups(rows);
    const dates = Array.from(new Set(allRows.map(row => row.dateKey).filter(Boolean))).sort((a, b) => b.localeCompare(a));
    const students = Array.from(new Map(allRows.map(row => [row.userId, row.name])).entries())
        .map(([id, name]) => ({ id, name }))
        .sort((a, b) => a.name.localeCompare(b.name, 'ja'));
    const activeStudents = new Set(historyRows.map(row => row.userId)).size;
    const totalCoins = historyRows.reduce((sum, row) => sum + row.coins, 0);
    const selectedStudentName = students.find(student => student.id === teacherHistoryFilters.student)?.name || '記録なし';

    return `
        <div class="teacher-admin-filter-panel teacher-history-filter-panel">
            <label>表示
                <select data-teacher-history-filter="view">
                    <option value="date"${teacherHistoryFilters.view === 'date' ? ' selected' : ''}>日別</option>
                    <option value="student"${teacherHistoryFilters.view === 'student' ? ' selected' : ''}>児童別</option>
                </select>
            </label>
            <label>日付
                <select data-teacher-history-filter="date" ${teacherHistoryFilters.view !== 'date' ? 'disabled' : ''}>
                    ${dates.length ? dates.map(dateKey => `<option value="${escapeHtml(dateKey)}"${dateKey === teacherHistoryFilters.date ? ' selected' : ''}>${escapeHtml(dateKey)} (${escapeHtml(allRows.filter(row => row.dateKey === dateKey).length)}件)</option>`).join('') : '<option value="">記録なし</option>'}
                </select>
            </label>
            <label>児童
                <select data-teacher-history-filter="student" ${teacherHistoryFilters.view !== 'student' ? 'disabled' : ''}>
                    ${students.length ? students.map(student => `<option value="${escapeHtml(student.id)}"${student.id === teacherHistoryFilters.student ? ' selected' : ''}>${escapeHtml(student.name)}</option>`).join('') : '<option value="">記録なし</option>'}
                </select>
            </label>
            <label>学年
                <select data-teacher-history-filter="grade" ${teacherHistoryFilters.view !== 'date' ? 'disabled' : ''}>
                    ${renderTeacherOptions(grades, 'すべての学年', teacherHistoryFilters.grade)}
                </select>
            </label>
            <label>グループ
                <select data-teacher-history-filter="group" ${teacherHistoryFilters.view !== 'date' ? 'disabled' : ''}>
                    ${renderTeacherOptions(groups, 'すべてのグループ', teacherHistoryFilters.group)}
                </select>
            </label>
            <label>並び順
                <select data-teacher-history-filter="sort">
                    <option value="time_desc"${teacherHistoryFilters.sort === 'time_desc' ? ' selected' : ''}>時刻が新しい順</option>
                    <option value="time_asc"${teacherHistoryFilters.sort === 'time_asc' ? ' selected' : ''}>時刻が古い順</option>
                    <option value="student_asc"${teacherHistoryFilters.sort === 'student_asc' ? ' selected' : ''}>児童名順</option>
                </select>
            </label>
            <input type="search" data-teacher-history-filter="search" value="${escapeHtml(teacherHistoryFilters.search)}" placeholder="名前・練習名で検索">
            <button type="button" class="teacher-status-reset" data-teacher-history-reset>解除</button>
            <button type="button" class="teacher-status-export" data-teacher-history-export>CSV</button>
        </div>
        <div class="teacher-admin-summary-grid">
            ${renderTeacherSummaryCard(teacherHistoryFilters.view === 'student' ? '選択児童' : '選択日', teacherHistoryFilters.view === 'student' ? selectedStudentName : (teacherHistoryFilters.date || '記録なし'), '#795548')}
            ${renderTeacherSummaryCard('取り組んだ児童', `${activeStudents}人`, '#2196F3')}
            ${renderTeacherSummaryCard('取り組み件数', `${historyRows.length}件`, '#4CAF50')}
            ${renderTeacherSummaryCard('コイン増減合計', `${totalCoins}コイン`, '#FF9800')}
        </div>
        <div class="teacher-status-table-wrap teacher-history-wrap">
            <table class="teacher-status-table teacher-history-table">
                <thead>
                    <tr>
                        <th>日付</th>
                        <th>時刻</th>
                        <th>児童</th>
                        <th>学年</th>
                        <th>グループ</th>
                        <th>取り組み</th>
                        <th>内容</th>
                        <th>結果</th>
                        <th>コイン</th>
                    </tr>
                </thead>
                <tbody>
                    ${historyRows.length ? historyRows.map(row => `
                        <tr>
                            <td>${escapeHtml(row.dateKey || '-')}</td>
                            <td>${escapeHtml(row.timeText)}</td>
                            <td><strong>${escapeHtml(row.name)}</strong></td>
                            <td>${escapeHtml(row.grade || '-')}</td>
                            <td>${escapeHtml(row.group || '-')}</td>
                            <td>${escapeHtml(row.title)}</td>
                            <td>${escapeHtml(row.detail || '-')}</td>
                            <td>${escapeHtml([row.amount, row.status].filter(Boolean).join(' / ') || '-')}</td>
                            <td>${row.coins ? `+${escapeHtml(row.coins)}` : ''}</td>
                        </tr>
                    `).join('') : `
                        <tr>
                            <td colspan="9" style="text-align:center; color:#78909c; font-weight:800;">条件に合う取り組み記録はありません。</td>
                        </tr>
                    `}
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

function renderTeacherTextTaskRows(rows) {
    const entries = getTeacherScopedTextTasks(rows);
    if (entries.length === 0) {
        return `
            <div class="teacher-status-empty">
                担当範囲の児童に表示される文章課題がありません。
            </div>
        `;
    }

    return `
        <div class="teacher-text-task-note">
            <strong>文章課題</strong>
            <span>先生メニューでは、担当範囲の児童に関係する課題だけを表示します。全校舎共通の作成・削除は管理者メニューで行います。</span>
        </div>
        <div class="teacher-status-table-wrap teacher-text-task-wrap">
            <table class="teacher-status-table teacher-text-task-table">
                <thead>
                    <tr>
                        <th>課題</th>
                        <th>対象</th>
                        <th>制限</th>
                        <th>達成</th>
                        <th>未完了</th>
                        <th>表示</th>
                        <th>CSV</th>
                    </tr>
                </thead>
                <tbody>
                    ${entries.map(({ task, stats }) => `
                        <tr>
                            <td>
                                <strong>${escapeHtml(task.title || '無題の課題')}</strong>
                                <small>${escapeHtml(String(task.content || '').replace(/\s+/g, ' ').slice(0, 80))}</small>
                            </td>
                            <td>${escapeHtml(stats.targetGroup || '担当範囲の全員')}</td>
                            <td>${escapeHtml(task.time || '-')}分 / ★${escapeHtml(task.star || 3)}</td>
                            <td>
                                <span>${escapeHtml(stats.completed)} / ${escapeHtml(stats.targets.length)}人</span>
                                ${renderProgressBar(stats.percent)}
                            </td>
                            <td>${escapeHtml(stats.incomplete)}人</td>
                            <td>${task.hidden === true ? '<span class="teacher-status-alert notice">非公開</span>' : '<span class="teacher-status-ok">公開中</span>'}</td>
                            <td>
                                <button type="button" class="teacher-status-detail-btn" data-teacher-text-export-task="${escapeHtml(task.id)}">進捗CSV</button>
                                <button type="button" class="teacher-status-detail-btn secondary" data-teacher-text-incomplete-task="${escapeHtml(task.id)}">未完了CSV</button>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;
}

function renderTeacherRewardRows(rows) {
    const config = getTeacherTicketConfig();
    const history = getTeacherTicketHistoryEntries(rows);

    return `
        <div class="teacher-reward-grid">
            <section class="teacher-reward-card">
                <h4>コイン付与</h4>
                <p>担当範囲の児童だけに付与できます。全校舎一括付与は管理者メニュー専用です。</p>
                ${renderTeacherRewardTargetSelect(rows)}
                <div class="teacher-reward-form-row">
                    <input id="teacher-coin-amount" type="number" min="1" step="1" value="100" inputmode="numeric" aria-label="付与コイン数">
                    <button type="button" data-teacher-grant-coins>コインを付与</button>
                </div>
            </section>
            <section class="teacher-reward-card">
                <h4>いいねポイント付与</h4>
                <p>児童のマイページで使えるいいねポイントを付与します。</p>
                ${renderTeacherRewardTargetSelect(rows, 'ticket')}
                <div class="teacher-reward-form-row">
                    <select id="teacher-ticket-type">
                        <option value="normal">${escapeHtml(config.normal.name)}</option>
                        <option value="newRecord">${escapeHtml(config.newRecord.name)}</option>
                    </select>
                    <button type="button" data-teacher-grant-ticket>チケットを付与</button>
                </div>
            </section>
        </div>
        <div class="teacher-status-table-wrap teacher-ticket-history-wrap">
            <table class="teacher-status-table teacher-ticket-history-table">
                <thead>
                    <tr>
                        <th>日時</th>
                        <th>児童</th>
                        <th>グループ</th>
                        <th>使用したいいねポイント</th>
                    </tr>
                </thead>
                <tbody>
                    ${history.length ? history.map(({ row, item }) => `
                        <tr>
                            <td>${escapeHtml(item.date || '-')}</td>
                            <td><strong>${escapeHtml(row.name)}</strong></td>
                            <td>${escapeHtml(row.group)}</td>
                            <td>${escapeHtml(item.ticketName || item.name || '-')}</td>
                        </tr>
                    `).join('') : `
                        <tr>
                            <td colspan="4" style="text-align:center; color:#78909c; font-weight:800;">担当範囲内の使用履歴はまだありません。</td>
                        </tr>
                    `}
                </tbody>
            </table>
        </div>
    `;
}

function renderTeacherRewardTargetSelect(rows, suffix = 'coin') {
    return `
        <label class="teacher-reward-target-label">
            対象
            <select id="${suffix === 'ticket' ? 'teacher-ticket-target' : 'teacher-reward-target'}" data-teacher-target-mirror="${escapeHtml(suffix)}">
                <option value="__filtered__">表示中の児童全員</option>
                ${rows.map(row => `
                    <option value="${escapeHtml(row.userId)}">${escapeHtml(row.name)}（${escapeHtml(row.group)}）</option>
                `).join('')}
            </select>
        </label>
    `;
}

function renderTeacherGradeTabs() {
    const tabs = [
        ['basic', '基本進捗'],
        ['vision', 'ビジョンタイム'],
        ['text', '文章入力']
    ];
    return `
        <div class="teacher-admin-tabs">
            ${tabs.map(([tab, label]) => `
                <button type="button" class="${teacherGradeTab === tab ? 'active' : ''}" data-teacher-grade-tab="${escapeHtml(tab)}">
                    ${escapeHtml(label)}
                </button>
            `).join('')}
        </div>
    `;
}

function renderTeacherBasicGrades(rows) {
    const grades = getTeacherGrades(rows);
    const groups = getTeacherGroups(rows);
    teacherGradeFilters.basicGrade = updateTeacherOptionValue(teacherGradeFilters.basicGrade, ['all', ...grades]);
    teacherGradeFilters.basicGroup = updateTeacherOptionValue(teacherGradeFilters.basicGroup, ['all', ...groups]);
    const list = filterTeacherRowsByGradeGroupSearch(rows, teacherGradeFilters.basicGrade, teacherGradeFilters.basicGroup);
    if (teacherGradeFilters.basicSort === 'mouse_desc') list.sort((a, b) => b.mouseLevel - a.mouseLevel || a.name.localeCompare(b.name, 'ja'));
    else if (teacherGradeFilters.basicSort === 'kb_desc') list.sort((a, b) => b.keyboardPercent - a.keyboardPercent || a.name.localeCompare(b.name, 'ja'));
    else if (teacherGradeFilters.basicSort === 'route_asc') list.sort((a, b) => a.routeStatus.percent - b.routeStatus.percent || a.name.localeCompare(b.name, 'ja'));
    else list.sort((a, b) => a.name.localeCompare(b.name, 'ja'));

    return `
        <div class="teacher-admin-filter-panel">
            <label>学年
                <select data-teacher-grade-filter="basicGrade">
                    ${renderTeacherOptions(grades, 'すべての学年', teacherGradeFilters.basicGrade)}
                </select>
            </label>
            <label>グループ
                <select data-teacher-grade-filter="basicGroup">
                    ${renderTeacherOptions(groups, 'すべてのグループ', teacherGradeFilters.basicGroup)}
                </select>
            </label>
            <label>並び順
                <select data-teacher-grade-filter="basicSort">
                    <option value="name"${teacherGradeFilters.basicSort === 'name' ? ' selected' : ''}>名前順</option>
                    <option value="route_asc"${teacherGradeFilters.basicSort === 'route_asc' ? ' selected' : ''}>標準ルート順</option>
                    <option value="mouse_desc"${teacherGradeFilters.basicSort === 'mouse_desc' ? ' selected' : ''}>マウス進捗順</option>
                    <option value="kb_desc"${teacherGradeFilters.basicSort === 'kb_desc' ? ' selected' : ''}>キーボード進捗順</option>
                </select>
            </label>
        </div>
        <div class="teacher-status-table-wrap">
            <table class="teacher-status-table teacher-admin-grade-table">
                <thead>
                    <tr>
                        <th>児童</th>
                        <th>学年</th>
                        <th>グループ</th>
                        <th>マウス</th>
                        <th>キーボード</th>
                        <th>標準ルート</th>
                        <th>文章入力</th>
                        <th>レポート</th>
                    </tr>
                </thead>
                <tbody>
                    ${list.length ? list.map(row => `
                        <tr>
                            <td><strong>${escapeHtml(row.name)}</strong><small>${escapeHtml(row.userId)}</small></td>
                            <td>${escapeHtml(row.grade || '-')}</td>
                            <td>${escapeHtml(row.group || '-')}</td>
                            <td>${renderTeacherProgressCell(row.mouseLevel, 7, '#2196F3')}</td>
                            <td>${renderTeacherProgressCell(row.keyboardPercent, 100, '#FF9800')}</td>
                            <td>${renderStandardRouteCell(row.routeStatus)}</td>
                            <td>${renderTeacherProgressCell(row.text.done, row.text.total, '#4CAF50')}</td>
                            <td><button type="button" class="teacher-status-detail-btn" data-teacher-report-open-user-id="${escapeHtml(row.userId)}">レポート</button></td>
                        </tr>
                    `).join('') : `
                        <tr><td colspan="8" style="text-align:center; color:#78909c; font-weight:800;">条件に合う児童がいません。</td></tr>
                    `}
                </tbody>
            </table>
        </div>
    `;
}

function getTeacherVisionRows(rows) {
    const grades = getTeacherGrades(rows);
    const groups = getTeacherGroups(rows);
    teacherGradeFilters.visionGrade = updateTeacherOptionValue(teacherGradeFilters.visionGrade, ['all', ...grades]);
    teacherGradeFilters.visionGroup = updateTeacherOptionValue(teacherGradeFilters.visionGroup, ['all', ...groups]);
    if (teacherGradeFilters.visionTarget === 'grade') return filterTeacherRowsByGradeGroupSearch(rows, teacherGradeFilters.visionGrade, 'all');
    if (teacherGradeFilters.visionTarget === 'group') return filterTeacherRowsByGradeGroupSearch(rows, 'all', teacherGradeFilters.visionGroup);
    if (teacherGradeFilters.visionTarget === 'student') return filterTeacherRowsByGradeGroupSearch(rows, 'all', 'all', teacherGradeFilters.visionSearch);
    return rows;
}

function renderTeacherVisionGrades(rows) {
    const grades = getTeacherGrades(rows);
    const groups = getTeacherGroups(rows);
    const list = getTeacherVisionRows(rows);
    const suffix = getVisionDifficultySuffix(teacherGradeFilters.visionDifficulty);
    const averageByStage = {};
    VISION_STAGES.forEach(stage => {
        const values = list
            .map(row => Number(row.user?.examRecords?.[stage.id + suffix]))
            .filter(value => Number.isFinite(value) && value > 0);
        averageByStage[stage.id] = values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
    });
    const visibleUsers = Object.fromEntries(list.map(row => [row.userId, row.user]));

    return `
        <div class="teacher-admin-filter-panel teacher-vision-filter-panel">
            <label>難易度
                <select data-teacher-grade-filter="visionDifficulty">
                    <option value="easy"${teacherGradeFilters.visionDifficulty === 'easy' ? ' selected' : ''}>Easy</option>
                    <option value="normal"${teacherGradeFilters.visionDifficulty === 'normal' ? ' selected' : ''}>Normal</option>
                    <option value="hard"${teacherGradeFilters.visionDifficulty === 'hard' ? ' selected' : ''}>Hard</option>
                </select>
            </label>
            <label>絞り込み
                <select data-teacher-grade-filter="visionTarget">
                    <option value="all"${teacherGradeFilters.visionTarget === 'all' ? ' selected' : ''}>担当範囲全体</option>
                    <option value="grade"${teacherGradeFilters.visionTarget === 'grade' ? ' selected' : ''}>学年</option>
                    <option value="group"${teacherGradeFilters.visionTarget === 'group' ? ' selected' : ''}>グループ</option>
                    <option value="student"${teacherGradeFilters.visionTarget === 'student' ? ' selected' : ''}>児童検索</option>
                </select>
            </label>
            <label>学年
                <select data-teacher-grade-filter="visionGrade" ${teacherGradeFilters.visionTarget !== 'grade' ? 'disabled' : ''}>
                    ${renderTeacherOptions(grades, 'すべての学年', teacherGradeFilters.visionGrade)}
                </select>
            </label>
            <label>グループ
                <select data-teacher-grade-filter="visionGroup" ${teacherGradeFilters.visionTarget !== 'group' ? 'disabled' : ''}>
                    ${renderTeacherOptions(groups, 'すべてのグループ', teacherGradeFilters.visionGroup)}
                </select>
            </label>
            <input type="search" data-teacher-grade-filter="visionSearch" value="${escapeHtml(teacherGradeFilters.visionSearch)}" placeholder="児童名で検索" ${teacherGradeFilters.visionTarget !== 'student' ? 'disabled' : ''}>
            <label>表示
                <select data-teacher-grade-filter="visionView">
                    <option value="table"${teacherGradeFilters.visionView === 'table' ? ' selected' : ''}>表</option>
                    <option value="radar"${teacherGradeFilters.visionView === 'radar' ? ' selected' : ''}>レーダー一覧</option>
                </select>
            </label>
        </div>
        ${teacherGradeFilters.visionView === 'radar' ? `
            <div class="teacher-vision-radar-list">
                ${list.length ? list.map(row => renderVisionRadarChart(
                    buildVisionRadarData(row.user, visibleUsers, VISION_STAGES, isSystemUserId),
                    { title: `${row.name} さん`, compact: true }
                )).join('') : '<div class="teacher-status-empty">条件に合う児童がいません。</div>'}
            </div>
        ` : `
            <div class="teacher-status-table-wrap teacher-vision-table-wrap">
                <table class="teacher-status-table teacher-admin-vision-table">
                    <thead>
                        <tr>
                            <th>児童</th>
                            ${VISION_STAGES.map(stage => `<th>${escapeHtml(stage.title)}</th>`).join('')}
                        </tr>
                    </thead>
                    <tbody>
                        <tr class="teacher-average-row">
                            <td><strong>平均タイム</strong></td>
                            ${VISION_STAGES.map(stage => `<td>${escapeHtml(formatTeacherSeconds(averageByStage[stage.id]))}</td>`).join('')}
                        </tr>
                        ${list.length ? list.map(row => `
                            <tr>
                                <td><strong>${escapeHtml(row.name)}</strong><small>${escapeHtml(row.group || '-')}</small></td>
                                ${VISION_STAGES.map(stage => {
                                    const record = Number(row.user?.examRecords?.[stage.id + suffix]);
                                    const hasRecord = Number.isFinite(record) && record > 0;
                                    return `<td class="${hasRecord ? '' : 'teacher-empty-record'}">
                                        <strong>${hasRecord ? escapeHtml(formatTeacherSeconds(record)) : '-'}</strong>
                                        ${hasRecord ? formatTeacherVisionDiff(record, averageByStage[stage.id]) : ''}
                                    </td>`;
                                }).join('')}
                            </tr>
                        `).join('') : `
                            <tr><td colspan="${escapeHtml(VISION_STAGES.length + 1)}" style="text-align:center; color:#78909c; font-weight:800;">条件に合う児童がいません。</td></tr>
                        `}
                    </tbody>
                </table>
            </div>
        `}
    `;
}

function renderTeacherTextSparkline(history) {
    const points = history.map(log => Number(log.score)).filter(value => Number.isFinite(value));
    if (points.length < 2) return '<span class="teacher-text-spark-empty">記録待ち</span>';
    const max = Math.max(...points, 1);
    const min = Math.min(...points, 0);
    const width = 160;
    const height = 48;
    const span = Math.max(1, max - min);
    const svgPoints = points.map((value, index) => {
        const x = points.length === 1 ? width / 2 : (index / (points.length - 1)) * width;
        const y = height - ((value - min) / span) * (height - 8) - 4;
        return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(' ');
    const lastPoint = svgPoints.split(' ').pop().split(',');
    return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="文章入力の伸び">
        <polyline points="${svgPoints}" fill="none" stroke="#7B1FA2" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"></polyline>
        <circle cx="${lastPoint[0]}" cy="${lastPoint[1]}" r="4" fill="#7B1FA2"></circle>
    </svg>`;
}

function renderTeacherTextGrades(rows) {
    const grades = getTeacherGrades(rows);
    const groups = getTeacherGroups(rows);
    teacherGradeFilters.textGrade = updateTeacherOptionValue(teacherGradeFilters.textGrade, ['all', ...grades]);
    teacherGradeFilters.textGroup = updateTeacherOptionValue(teacherGradeFilters.textGroup, ['all', ...groups]);
    const filtered = filterTeacherRowsByGradeGroupSearch(
        rows,
        teacherGradeFilters.textGrade,
        teacherGradeFilters.textGroup,
        teacherGradeFilters.textSearch
    );
    teacherGradeFilters.textStudent = filtered.some(row => row.userId === teacherGradeFilters.textStudent)
        ? teacherGradeFilters.textStudent
        : (filtered[0]?.userId || '');
    const metricsMap = new Map(filtered.map(row => [row.userId, buildTeacherTextMetrics(row)]));
    const active = filtered.filter(row => metricsMap.get(row.userId)?.completed > 0).length;
    const completedTotal = filtered.reduce((sum, row) => sum + metricsMap.get(row.userId).completed, 0);
    const attemptsTotal = filtered.reduce((sum, row) => sum + metricsMap.get(row.userId).attempts, 0);
    const selectedRow = filtered.find(row => row.userId === teacherGradeFilters.textStudent) || filtered[0];
    const selectedMetrics = selectedRow ? metricsMap.get(selectedRow.userId) : null;
    const recent = selectedMetrics ? selectedMetrics.history.slice(-12) : [];
    const maxScore = Math.max(...recent.map(log => log.score || 0), 1);

    return `
        <div class="teacher-admin-filter-panel teacher-text-filter-panel">
            <label>学年
                <select data-teacher-grade-filter="textGrade">
                    ${renderTeacherOptions(grades, 'すべての学年', teacherGradeFilters.textGrade)}
                </select>
            </label>
            <label>グループ
                <select data-teacher-grade-filter="textGroup">
                    ${renderTeacherOptions(groups, 'すべてのグループ', teacherGradeFilters.textGroup)}
                </select>
            </label>
            <label>グラフ対象
                <select data-teacher-grade-filter="textStudent">
                    ${filtered.length ? filtered.map(row => `<option value="${escapeHtml(row.userId)}"${row.userId === teacherGradeFilters.textStudent ? ' selected' : ''}>${escapeHtml(row.name)}</option>`).join('') : '<option value="">記録なし</option>'}
                </select>
            </label>
            <input type="search" data-teacher-grade-filter="textSearch" value="${escapeHtml(teacherGradeFilters.textSearch)}" placeholder="児童名で検索">
        </div>
        <div class="teacher-admin-summary-grid">
            ${renderTeacherSummaryCard('対象児童', `${filtered.length}人`, '#7B1FA2')}
            ${renderTeacherSummaryCard('取り組みあり', `${active}人`, '#009688')}
            ${renderTeacherSummaryCard('完了課題合計', `${completedTotal}件`, '#4CAF50')}
            ${renderTeacherSummaryCard('挑戦回数合計', `${attemptsTotal}回`, '#FF9800')}
        </div>
        <div class="teacher-text-chart-card">
            ${selectedRow ? `
                <div class="teacher-text-chart-head">
                    <strong>${escapeHtml(selectedRow.name)} さんの文章入力の伸び</strong>
                    <span class="${selectedMetrics.growth >= 0 ? 'good' : 'slow'}">伸び: ${selectedMetrics.growth >= 0 ? '+' : ''}${escapeHtml(selectedMetrics.growth)}</span>
                </div>
                ${recent.length ? `
                    <div class="teacher-text-bar-chart">
                        ${recent.map(log => {
                            const h = Math.max(8, Math.round((Number(log.score || 0) / maxScore) * 130));
                            const date = new Date(log.atMs).toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' });
                            return `<div title="${escapeHtml(formatPracticeActivity(log).detail || '')}">
                                <span>${escapeHtml(log.score || 0)}</span>
                                <b style="height:${escapeHtml(h)}px;"></b>
                                <small>${escapeHtml(date)}</small>
                            </div>`;
                        }).join('')}
                    </div>
                ` : '<p>文章入力の取り組み履歴はまだありません。</p>'}
            ` : '<p>グラフ対象の児童がいません。</p>'}
        </div>
        <div class="teacher-status-table-wrap">
            <table class="teacher-status-table teacher-admin-text-table">
                <thead>
                    <tr>
                        <th>児童</th>
                        <th>学年</th>
                        <th>グループ</th>
                        <th>完了課題</th>
                        <th>挑戦回数</th>
                        <th>最高スコア</th>
                        <th>最終完了</th>
                        <th>伸び</th>
                        <th>レポート</th>
                    </tr>
                </thead>
                <tbody>
                    ${filtered.length ? filtered.map(row => {
                        const metrics = metricsMap.get(row.userId);
                        const latest = metrics.latestAt ? new Date(metrics.latestAt).toLocaleDateString('ja-JP') : '-';
                        return `
                            <tr>
                                <td><strong>${escapeHtml(row.name)}</strong></td>
                                <td>${escapeHtml(row.grade || '-')}</td>
                                <td>${escapeHtml(row.group || '-')}</td>
                                <td>${escapeHtml(metrics.completed)} / ${escapeHtml(metrics.total)}</td>
                                <td>${escapeHtml(metrics.attempts)}</td>
                                <td>${escapeHtml(metrics.bestScore)}</td>
                                <td>${escapeHtml(latest)}</td>
                                <td class="${metrics.growth >= 0 ? 'teacher-growth-good' : 'teacher-growth-slow'}">${metrics.growth >= 0 ? '+' : ''}${escapeHtml(metrics.growth)}<br>${renderTeacherTextSparkline(metrics.history)}</td>
                                <td><button type="button" class="teacher-status-detail-btn" data-teacher-report-open-user-id="${escapeHtml(row.userId)}">レポート</button></td>
                            </tr>
                        `;
                    }).join('') : `
                        <tr><td colspan="9" style="text-align:center; color:#78909c; font-weight:800;">条件に合う児童がいません。</td></tr>
                    `}
                </tbody>
            </table>
        </div>
    `;
}

function renderTeacherGradesRows(rows) {
    return `
        ${renderTeacherGradeTabs()}
        ${teacherGradeTab === 'vision' ? renderTeacherVisionGrades(rows) : ''}
        ${teacherGradeTab === 'text' ? renderTeacherTextGrades(rows) : ''}
        ${teacherGradeTab === 'basic' ? renderTeacherBasicGrades(rows) : ''}
    `;
}

function renderTeacherModeContent(rows) {
    if (teacherMenuMode === 'students') return renderTeacherStudentManagementRows(rows);
    if (teacherMenuMode === 'grades') return renderTeacherGradesRows(rows);
    if (teacherMenuMode === 'history') return renderTeacherHistoryRows(rows);
    if (teacherMenuMode === 'reports') return renderTeacherReportRows(rows);
    if (teacherMenuMode === 'textTasks') return renderTeacherTextTaskRows(rows);
    if (teacherMenuMode === 'rewards') return renderTeacherRewardRows(rows);
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
            reports: '個別詳細から児童レポートを印刷します。',
            textTasks: '担当範囲の文章課題の進み具合を確認します。',
            rewards: '担当範囲の児童へコインやいいねポイントを付与します。'
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
    const filteredRows = sortTeacherStatusRows(allRows.filter(rowMatchesTeacherStatusFilters));
    const adminLikeTeacherModes = new Set(['grades', 'history', 'reports']);
    const rows = adminLikeTeacherModes.has(teacherMenuMode) ? allRows : filteredRows;
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
