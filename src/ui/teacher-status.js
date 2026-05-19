import { STAGE_ORDER } from '../data/constants.js';
import {
    GLOBAL_SETTINGS_ID,
    currentLessonAccess,
    formatPracticeActivity,
    getLatestPracticeActivity,
    getTeacherScopeSummary,
    getUserDisplayName,
    hasLessonRole,
    isSystemUserId,
    users
} from '../api/user.js';
import { escapeCsvCell, getBackupDateStamp } from '../utils/export-format.js';
import { showCustomAlert } from './modal.js';

const teacherStatusFilters = {
    search: '',
    group: 'all',
    status: 'all'
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
            const mouseLevel = Number(user.mouseLevel || 0);
            const keyboardSequence = Number(user.keyboardSequence || 0);
            const keyboardPercent = STAGE_ORDER.length
                ? Math.round((keyboardSequence / STAGE_ORDER.length) * 100)
                : 0;

            return {
                userId,
                name: getUserDisplayName(userId),
                group: String(user.group || '').trim() || '-',
                mouseLevel,
                keyboardPercent,
                text,
                latestLog,
                latest
            };
        })
        .sort((a, b) => (
            a.group.localeCompare(b.group, 'ja')
            || a.name.localeCompare(b.name, 'ja')
        ));
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
    return getStudentRows().filter(rowMatchesTeacherStatusFilters);
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

function attachTeacherStatusControlHandlers(modal) {
    if (modal.dataset.teacherStatusControls === 'attached') return;
    modal.dataset.teacherStatusControls = 'attached';

    const searchInput = modal.querySelector('#teacher-status-search');
    const groupSelect = modal.querySelector('#teacher-status-group-filter');
    const statusSelect = modal.querySelector('#teacher-status-status-filter');
    const resetButton = modal.querySelector('#teacher-status-reset');
    const exportButton = modal.querySelector('#teacher-status-export');
    const incompleteExportButton = modal.querySelector('#teacher-status-incomplete-export');

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
    if (resetButton) {
        resetButton.addEventListener('click', () => {
            teacherStatusFilters.search = '';
            teacherStatusFilters.group = 'all';
            teacherStatusFilters.status = 'all';
            renderTeacherStatus();
        });
    }
    if (exportButton) exportButton.addEventListener('click', exportTeacherStatusCsv);
    if (incompleteExportButton) incompleteExportButton.addEventListener('click', exportTeacherTextIncompleteCsv);
}

function renderProgressBar(percent) {
    const safePercent = Math.max(0, Math.min(100, Number(percent) || 0));
    return `
        <span class="teacher-status-progress" aria-label="${escapeHtml(safePercent)}%">
            <span style="width:${escapeHtml(safePercent)}%;"></span>
        </span>
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
                        <th>前回の練習</th>
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
                            <td>
                                <strong>${escapeHtml(row.latest.title)}</strong>
                                <small>${escapeHtml([row.latest.when, row.latest.detail].filter(Boolean).join(' / '))}</small>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;
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
                    <h2 id="teacher-status-title">先生用確認</h2>
                    <p>担当範囲の児童の進み具合を確認できます。ここから児童データは変更されません。</p>
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
                <button type="button" id="teacher-status-reset" class="teacher-status-reset">解除</button>
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
    const rows = allRows.filter(rowMatchesTeacherStatusFilters);
    const body = document.getElementById('teacher-status-body');
    if (!body) return;

    const noPracticeCount = rows.filter(row => !row.latestLog).length;
    const incompleteTextCount = rows.filter(row => row.text.total > 0 && row.text.done < row.text.total).length;
    const scopeLabel = getTeacherStatusScopeLabel();

    body.innerHTML = `
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
        </div>
        ${renderStudentRows(rows)}
    `;
}

export function closeTeacherStatus() {
    const modal = document.getElementById('teacher-status-modal');
    if (modal) modal.style.display = 'none';
}

export function openTeacherStatus() {
    if (!hasLessonRole('teacher', 'admin')) {
        showCustomAlert('先生または管理者アカウントでログインしてください。');
        return;
    }

    const modal = ensureTeacherStatusModal();
    renderTeacherStatus();
    modal.style.display = 'flex';
}
