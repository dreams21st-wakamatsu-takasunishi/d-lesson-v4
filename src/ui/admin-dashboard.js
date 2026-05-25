import {
    users,
    saveUsers,
    GLOBAL_SETTINGS_ID,
    getUserDisplayName,
    getPracticeLogs,
    formatPracticeActivity,
    isSystemUserId
} from '../api/user.js';
import { STAGE_ORDER, VISION_STAGES } from '../data/constants.js';
import { calculateGrade, sortGrades } from '../utils/helpers.js';
import {
    getDashboardProgressPercent,
    getVisionDifficultySuffix
} from './admin-dashboard-utils.js';
import {
    buildVisionRadarData,
    escapeHtml,
    renderVisionRadarChart
} from './admin-report-utils.js';

function getStudentRows() {
    const rows = [];
    let isDataFixed = false;

    Object.keys(users).forEach(userId => {
        const user = users[userId];
        if (!user || user.isMaster || isSystemUserId(userId)) return;

        const birthdate = user.birthdate || user.birth;
        let grade = user.grade;
        if (!grade || String(grade) === 'undefined') {
            grade = calculateGrade(birthdate);
            user.grade = grade;
            user.birthdate = birthdate;
            isDataFixed = true;
        }

        rows.push({
            id: userId,
            name: getUserDisplayName(userId),
            grade,
            group: user.group || '',
            user
        });
    });

    if (isDataFixed) saveUsers(false);
    rows.sort((a, b) => a.name.localeCompare(b.name, 'ja'));
    return rows;
}

function updateSelectOptions(select, values, allLabel, currentValue = 'all') {
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

function updateStudentSelect(select, rows, currentValue = '') {
    if (!select) return;
    select.innerHTML = '<option value="">グラフ対象を選択</option>';
    rows.forEach(row => {
        const opt = document.createElement('option');
        opt.value = row.id;
        opt.innerText = row.name;
        select.appendChild(opt);
    });
    select.value = rows.some(row => row.id === currentValue) ? currentValue : (rows[0]?.id || '');
}

function getFilterValues(prefix) {
    return {
        grade: document.getElementById(`${prefix}-filter-grade`)?.value || 'all',
        group: document.getElementById(`${prefix}-filter-group`)?.value || 'all',
        search: (document.getElementById(`${prefix}-filter-search`)?.value || '').trim().toLowerCase()
    };
}

function filterRows(rows, filters = {}) {
    return rows.filter(row => {
        if (filters.grade && filters.grade !== 'all' && row.grade !== filters.grade) return false;
        if (filters.group && filters.group !== 'all' && row.group !== filters.group) return false;
        if (!filters.search) return true;
        return `${row.name} ${row.id} ${row.group}`.toLowerCase().includes(filters.search);
    });
}

function renderProgressCell(value, total, color) {
    const pct = getDashboardProgressPercent(value, total);
    return `<div style="width:100%; background:#eee; border-radius:5px; overflow:hidden;">
        <div style="width:${pct}%; background:${color}; color:#fff; text-align:center; font-size:12px; border-radius:5px; min-width:${pct ? '34px' : '0'};">${pct}%</div>
    </div>`;
}

function escapeJsString(value) {
    return String(value ?? '')
        .replace(/\\/g, '\\\\')
        .replace(/'/g, "\\'")
        .replace(/\r/g, '\\r')
        .replace(/\n/g, '\\n');
}

function resetDashboardTabs(activeTab) {
    ['basic', 'vision', 'text'].forEach(tab => {
        const panel = document.getElementById(`dash-${tab}`);
        const button = document.getElementById(`tab-btn-${tab}`);
        if (panel) panel.style.display = tab === activeTab ? 'block' : 'none';
        if (button) {
            const colors = { basic: '#2196F3', vision: '#9C27B0', text: '#7B1FA2' };
            button.style.background = tab === activeTab ? colors[tab] : '#9e9e9e';
        }
    });
}

export function switchDashTab(tab) {
    if (tab === 'vision') {
        resetDashboardTabs('vision');
        renderVisionDashboardTable();
        return;
    }
    if (tab === 'text') {
        resetDashboardTabs('text');
        renderTextDashboardTable();
        return;
    }
    resetDashboardTabs('basic');
    renderDashboardTable();
}

export function renderDashboardTable() {
    try {
        const tbody = document.getElementById('dash-tbody');
        const gradeSelect = document.getElementById('dash-filter-grade');
        const grpSelect = document.getElementById('dash-filter-group');
        const sortSelect = document.getElementById('dash-sort');
        if (!tbody || !gradeSelect || !grpSelect || !sortSelect) return;

        const rows = getStudentRows();
        const currentGrade = gradeSelect.value || 'all';
        const currentGroup = grpSelect.value || 'all';
        const sortVal = sortSelect.value || 'name';
        updateSelectOptions(gradeSelect, sortGrades(Array.from(new Set(rows.map(row => row.grade).filter(Boolean)))), 'すべての学年', currentGrade);
        updateSelectOptions(grpSelect, Array.from(new Set(rows.map(row => row.group).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'ja')), 'すべてのグループ', currentGroup);

        const list = filterRows(rows, { grade: gradeSelect.value, group: grpSelect.value });
        if (sortVal === 'mouse_desc') list.sort((a, b) => (b.user.mouseLevel || 0) - (a.user.mouseLevel || 0));
        else if (sortVal === 'kb_desc') list.sort((a, b) => (b.user.keyboardSequence || 0) - (a.user.keyboardSequence || 0));
        else list.sort((a, b) => a.name.localeCompare(b.name, 'ja'));

        tbody.innerHTML = '';
        list.forEach(item => {
            const tr = document.createElement('tr');
            const groupBadge = item.group ? `<span style="font-size:12px; color:#666; background:#e0e0e0; padding:2px 6px; border-radius:10px; margin-left:8px;">${escapeHtml(item.group)}</span>` : '';
            tr.innerHTML = `
                <td style="border:1px solid #ccc; padding:8px; font-weight:bold;">${escapeHtml(item.name)}${groupBadge}</td>
                <td style="border:1px solid #ccc; padding:8px;">${escapeHtml(item.grade || '-')}</td>
                <td style="border:1px solid #ccc; padding:8px;">${renderProgressCell(item.user.mouseLevel || 0, 7, '#2196F3')}</td>
                <td style="border:1px solid #ccc; padding:8px;">${renderProgressCell(item.user.keyboardSequence || 0, STAGE_ORDER.length, '#FF9800')}</td>
                <td style="border:1px solid #ccc; padding:8px; text-align:center;"><button class="btn-secondary" style="font-size:13px; padding:6px 10px;" onclick="openStudentReportById('${escapeJsString(item.id)}')">レポート</button></td>
            `;
            tbody.appendChild(tr);
        });
    } catch (e) {
        console.error(e);
    }
}

function formatSeconds(value) {
    return Number.isFinite(value) && value > 0 ? `${value.toFixed(1)}秒` : '-';
}

function formatVisionDiff(record, average) {
    if (!Number.isFinite(record) || !Number.isFinite(average) || average <= 0) return '';
    const diff = record - average;
    if (Math.abs(diff) < 0.05) return '<span style="display:block; font-size:12px; color:#607d8b;">平均と同じくらい</span>';
    const color = diff < 0 ? '#2e7d32' : '#c62828';
    const label = diff < 0 ? '平均よりはやい' : '平均よりゆっくり';
    return `<span style="display:block; font-size:12px; color:${color}; font-weight:bold;">${Math.abs(diff).toFixed(1)}秒 ${label}</span>`;
}

function getVisionFilteredRows(rows) {
    const target = document.getElementById('vision-filter-target')?.value || 'all';
    const gradeSelect = document.getElementById('vision-filter-grade');
    const groupSelect = document.getElementById('vision-filter-group');
    const searchInput = document.getElementById('vision-filter-search');
    const currentGrade = gradeSelect?.value || 'all';
    const currentGroup = groupSelect?.value || 'all';

    updateSelectOptions(gradeSelect, sortGrades(Array.from(new Set(rows.map(row => row.grade).filter(Boolean)))), 'すべての学年', currentGrade);
    updateSelectOptions(groupSelect, Array.from(new Set(rows.map(row => row.group).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'ja')), 'すべてのグループ', currentGroup);

    if (gradeSelect) gradeSelect.disabled = target !== 'grade';
    if (groupSelect) groupSelect.disabled = target !== 'group';
    if (searchInput) searchInput.disabled = target !== 'student';

    if (target === 'grade') return filterRows(rows, { grade: gradeSelect?.value || 'all' });
    if (target === 'group') return filterRows(rows, { group: groupSelect?.value || 'all' });
    if (target === 'student') return filterRows(rows, { search: (searchInput?.value || '').trim().toLowerCase() });
    return rows;
}

export function renderVisionDashboardTable() {
    const tbody = document.getElementById('dash-vision-tbody');
    const thead = document.getElementById('dash-vision-thead');
    const diffSelect = document.getElementById('vision-diff-select');
    const radarList = document.getElementById('dash-vision-radar-list');
    const viewMode = document.getElementById('vision-view-mode')?.value || 'table';
    if (!tbody || !thead || !diffSelect || !radarList) return;

    const suffix = getVisionDifficultySuffix(diffSelect.value);
    const allRows = getStudentRows();
    const list = getVisionFilteredRows(allRows);
    const averageByStage = {};
    VISION_STAGES.forEach(stage => {
        const values = list
            .map(item => Number(item.user.examRecords?.[stage.id + suffix]))
            .filter(value => Number.isFinite(value) && value > 0);
        averageByStage[stage.id] = values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
    });

    const table = thead.closest('table');
    if (table) table.style.display = viewMode === 'radar' ? 'none' : 'table';
    radarList.style.display = viewMode === 'radar' ? 'grid' : 'none';

    let htmlHead = '<tr><th style="border:1px solid #ccc; padding:8px; position:sticky; left:0; background:#f2f2f2; z-index:11;">名前</th>';
    VISION_STAGES.forEach(stage => {
        htmlHead += `<th style="border:1px solid #ccc; padding:8px; font-size:14px;">${escapeHtml(stage.title)}</th>`;
    });
    htmlHead += '</tr>';
    thead.innerHTML = htmlHead;
    tbody.innerHTML = '';

    const avgTr = document.createElement('tr');
    avgTr.style.backgroundColor = '#fff9c4';
    avgTr.style.fontWeight = 'bold';
    avgTr.innerHTML = `<td style="border:1px solid #ccc; padding:8px; position:sticky; left:0; background:#fff9c4; z-index:6; color:#f57f17;">平均タイム</td>${VISION_STAGES.map(stage => `<td style="border:1px solid #ccc; padding:8px; color:#d32f2f;">${formatSeconds(averageByStage[stage.id])}</td>`).join('')}`;
    tbody.appendChild(avgTr);

    if (!list.length) {
        const tr = document.createElement('tr');
        const td = document.createElement('td');
        td.colSpan = VISION_STAGES.length + 1;
        td.style.cssText = 'border:1px solid #ccc; padding:18px; color:#777;';
        td.innerText = '条件に合う児童がいません';
        tr.appendChild(td);
        tbody.appendChild(tr);
    } else {
        list.forEach(item => {
            const tr = document.createElement('tr');
            let html = `<td style="border:1px solid #ccc; padding:8px; font-weight:bold; position:sticky; left:0; background:#fff; z-index:5;">${escapeHtml(item.name)}</td>`;
            VISION_STAGES.forEach(stage => {
                const record = Number(item.user.examRecords?.[stage.id + suffix]);
                const hasRecord = Number.isFinite(record) && record > 0;
                html += `<td style="border:1px solid #ccc; padding:8px; text-align:center; ${hasRecord ? '' : 'color:#ccc;'}">
                    <strong>${hasRecord ? formatSeconds(record) : '-'}</strong>
                    ${hasRecord ? formatVisionDiff(record, averageByStage[stage.id]) : ''}
                </td>`;
            });
            tr.innerHTML = html;
            tbody.appendChild(tr);
        });
    }

    const visibleUsers = Object.fromEntries(list.map(item => [item.id, item.user]));
    radarList.innerHTML = list.length
        ? list.map(item => renderVisionRadarChart(
            buildVisionRadarData(item.user, visibleUsers, VISION_STAGES, isSystemUserId),
            { title: `${item.name} さん`, compact: true }
        )).join('')
        : '<div style="grid-column:1/-1; padding:18px; text-align:center; color:#777; background:#fff; border:1px dashed #ccc; border-radius:10px;">条件に合う児童がいません</div>';
}

function getVisibleTextTasksForUser(user) {
    const tasks = Array.isArray(users[GLOBAL_SETTINGS_ID]?.textTasks) ? users[GLOBAL_SETTINGS_ID].textTasks : [];
    return tasks.filter(task => {
        if (!task || task.visible === false) return false;
        if (!task.targetGroup || task.targetGroup === 'all') return true;
        return (user?.group || '') === task.targetGroup;
    });
}

function getTextLogScore(log) {
    const amount = `${log?.amount || ''}`;
    const match = amount.match(/純字数\s*([0-9]+)/);
    if (match) return Number(match[1]);
    const inputMatch = amount.match(/入力\s*([0-9]+)/);
    return inputMatch ? Number(inputMatch[1]) : null;
}

function getTextHistory(userId) {
    return getPracticeLogs(userId)
        .filter(log => log.category === 'text' || String(log.title || '').includes('文章入力'))
        .map(log => ({
            ...log,
            score: getTextLogScore(log),
            atMs: Date.parse(log.at) || 0
        }))
        .filter(log => log.atMs && Number.isFinite(log.score))
        .sort((a, b) => a.atMs - b.atMs);
}

function buildTextMetrics(row) {
    const tasks = getVisibleTextTasksForUser(row.user);
    const records = row.user.textRecords || {};
    const completed = tasks.filter(task => records[task.id]).length;
    const taskRecords = tasks.map(task => records[task.id]).filter(Boolean);
    const attempts = taskRecords.reduce((sum, record) => sum + Number(record?.attempts || 1), 0);
    const bestScore = taskRecords.reduce((max, record) => Math.max(max, Number(record?.score || 0)), 0);
    const latestAt = taskRecords
        .map(record => Date.parse(record?.lastCompletedAt || record?.bestAt || ''))
        .filter(value => Number.isFinite(value))
        .sort((a, b) => b - a)[0] || 0;
    const history = getTextHistory(row.id);
    const firstScore = history.find(log => Number.isFinite(log.score))?.score || 0;
    const lastScore = [...history].reverse().find(log => Number.isFinite(log.score))?.score || 0;
    const growth = history.length >= 2 ? lastScore - firstScore : 0;
    return { total: tasks.length, completed, attempts, bestScore, latestAt, history, growth };
}

function renderTextSummaryCard(container, label, value, color) {
    const card = document.createElement('div');
    card.style.cssText = `background:#fff; border:2px solid ${color}; border-radius:8px; padding:12px; text-align:center;`;
    card.innerHTML = `<div style="font-size:13px; color:#546e7a; font-weight:bold; margin-bottom:6px;">${escapeHtml(label)}</div><div style="font-size:24px; color:${color}; font-weight:bold;">${escapeHtml(value)}</div>`;
    container.appendChild(card);
}

function renderSparkline(history) {
    const points = history.map(log => Number(log.score)).filter(value => Number.isFinite(value));
    if (points.length < 2) return '<span style="color:#9e9e9e;">記録待ち</span>';
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
    return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="伸び率グラフ">
        <polyline points="${svgPoints}" fill="none" stroke="#7B1FA2" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" />
        <circle cx="${svgPoints.split(' ').pop().split(',')[0]}" cy="${svgPoints.split(' ').pop().split(',')[1]}" r="4" fill="#7B1FA2" />
    </svg>`;
}

function renderTextChart(row, metrics) {
    const chart = document.getElementById('dash-text-chart');
    if (!chart) return;
    if (!row) {
        chart.innerHTML = '<div style="color:#777; text-align:center; font-weight:bold;">グラフ対象の児童を選択してください。</div>';
        return;
    }
    const history = metrics.history.slice(-12);
    if (history.length === 0) {
        chart.innerHTML = `<strong>${escapeHtml(row.name)} さん</strong><div style="color:#777; margin-top:8px;">文章入力の取り組み履歴がまだありません。</div>`;
        return;
    }
    const maxScore = Math.max(...history.map(log => log.score), 1);
    chart.innerHTML = `
        <div style="display:flex; justify-content:space-between; gap:10px; align-items:center; margin-bottom:10px; flex-wrap:wrap;">
            <strong style="color:#6a1b9a;">${escapeHtml(row.name)} さんの文章入力の伸び</strong>
            <span style="font-weight:bold; color:${metrics.growth >= 0 ? '#2e7d32' : '#c62828'};">伸び: ${metrics.growth >= 0 ? '+' : ''}${metrics.growth}</span>
        </div>
        <div style="display:flex; align-items:flex-end; gap:8px; height:150px; border-left:2px solid #d1c4e9; border-bottom:2px solid #d1c4e9; padding:8px 8px 0; overflow-x:auto;">
            ${history.map(log => {
                const h = Math.max(8, Math.round((log.score / maxScore) * 130));
                const date = new Date(log.atMs).toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' });
                return `<div title="${escapeHtml(formatPracticeActivity(log).detail)}" style="min-width:42px; display:flex; flex-direction:column; align-items:center; gap:4px;">
                    <div style="font-size:11px; color:#6a1b9a; font-weight:bold;">${log.score}</div>
                    <div style="width:28px; height:${h}px; background:linear-gradient(#ba68c8,#7b1fa2); border-radius:6px 6px 0 0;"></div>
                    <div style="font-size:10px; color:#607d8b; white-space:nowrap;">${date}</div>
                </div>`;
            }).join('')}
        </div>
    `;
}

export function renderTextDashboardTable() {
    const tbody = document.getElementById('dash-text-tbody');
    const summary = document.getElementById('dash-text-summary');
    const gradeSelect = document.getElementById('text-dash-filter-grade');
    const groupSelect = document.getElementById('text-dash-filter-group');
    const searchInput = document.getElementById('text-dash-search');
    const studentSelect = document.getElementById('text-dash-student-select');
    if (!tbody || !summary || !gradeSelect || !groupSelect || !studentSelect) return;

    const rows = getStudentRows();
    const currentGrade = gradeSelect.value || 'all';
    const currentGroup = groupSelect.value || 'all';
    updateSelectOptions(gradeSelect, sortGrades(Array.from(new Set(rows.map(row => row.grade).filter(Boolean)))), 'すべての学年', currentGrade);
    updateSelectOptions(groupSelect, Array.from(new Set(rows.map(row => row.group).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'ja')), 'すべてのグループ', currentGroup);

    const filtered = filterRows(rows, {
        grade: gradeSelect.value,
        group: groupSelect.value,
        search: (searchInput?.value || '').trim().toLowerCase()
    });
    updateStudentSelect(studentSelect, filtered, studentSelect.value);

    const metricsMap = new Map(filtered.map(row => [row.id, buildTextMetrics(row)]));
    summary.innerHTML = '';
    const active = filtered.filter(row => metricsMap.get(row.id)?.completed > 0).length;
    const completedTotal = filtered.reduce((sum, row) => sum + metricsMap.get(row.id).completed, 0);
    const attemptsTotal = filtered.reduce((sum, row) => sum + metricsMap.get(row.id).attempts, 0);
    renderTextSummaryCard(summary, '対象児童', `${filtered.length}人`, '#7B1FA2');
    renderTextSummaryCard(summary, '取り組みあり', `${active}人`, '#009688');
    renderTextSummaryCard(summary, '完了課題合計', `${completedTotal}件`, '#4CAF50');
    renderTextSummaryCard(summary, '挑戦回数合計', `${attemptsTotal}回`, '#FF9800');

    const selectedRow = filtered.find(row => row.id === studentSelect.value) || filtered[0];
    renderTextChart(selectedRow, selectedRow ? metricsMap.get(selectedRow.id) : null);

    tbody.innerHTML = '';
    if (!filtered.length) {
        tbody.innerHTML = '<tr><td colspan="9" style="border:1px solid #ccc; padding:18px; color:#777;">条件に合う児童がいません</td></tr>';
        return;
    }

    filtered.forEach(row => {
        const metrics = metricsMap.get(row.id);
        const latest = metrics.latestAt ? new Date(metrics.latestAt).toLocaleDateString('ja-JP') : '-';
        const growthColor = metrics.growth > 0 ? '#2e7d32' : metrics.growth < 0 ? '#c62828' : '#607d8b';
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td style="border:1px solid #ccc; padding:8px; font-weight:bold; text-align:left;">${escapeHtml(row.name)}</td>
            <td style="border:1px solid #ccc; padding:8px;">${escapeHtml(row.grade || '-')}</td>
            <td style="border:1px solid #ccc; padding:8px;">${escapeHtml(row.group || '-')}</td>
            <td style="border:1px solid #ccc; padding:8px;">${metrics.completed}/${metrics.total}</td>
            <td style="border:1px solid #ccc; padding:8px;">${metrics.attempts}</td>
            <td style="border:1px solid #ccc; padding:8px; font-weight:bold; color:#6a1b9a;">${metrics.bestScore}</td>
            <td style="border:1px solid #ccc; padding:8px;">${latest}</td>
            <td style="border:1px solid #ccc; padding:8px; color:${growthColor}; font-weight:bold;">${metrics.growth >= 0 ? '+' : ''}${metrics.growth}<br>${renderSparkline(metrics.history)}</td>
            <td style="border:1px solid #ccc; padding:8px;"><button class="btn-secondary" style="font-size:13px; padding:6px 10px;" onclick="openStudentReportById('${escapeJsString(row.id)}')">レポート</button></td>
        `;
        tbody.appendChild(tr);
    });
}
