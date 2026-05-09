import {
    users,
    getUserDisplayName,
    isSystemUserId,
    getPracticeLogs,
    formatPracticeActivity
} from '../api/user.js';
import { calculateGrade, sortGrades } from '../utils/helpers.js';
import { getBackupDateStamp } from '../utils/export-format.js';
import { showCustomAlert } from './modal.js';
import { recordAdminAudit } from './admin-audit.js';
import {
    buildPracticeHistoryCsv,
    buildPracticeHistoryRows
} from './admin-practice-history-utils.js';

function updatePracticeFilterSelect(select, values, allLabel, currentValue) {
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

function collectPracticeHistoryRows() {
    return buildPracticeHistoryRows(users, {
        getUserDisplayName,
        isSystemUserId,
        getPracticeLogs,
        formatPracticeActivity,
        calculateGrade
    });
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
    updatePracticeFilterSelect(gradeSelect, grades, 'すべての学年', gradeSelect?.value || 'all');
    updatePracticeFilterSelect(groupSelect, groups, 'すべてのグループ', groupSelect?.value || 'all');

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

export function renderPracticeHistoryPanel() {
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

export function clearPracticeHistoryPanelFilters() {
    const gradeSelect = document.getElementById('admin-practice-grade');
    const groupSelect = document.getElementById('admin-practice-group');
    const searchInput = document.getElementById('admin-practice-search');
    if (gradeSelect) gradeSelect.value = 'all';
    if (groupSelect) groupSelect.value = 'all';
    if (searchInput) searchInput.value = '';
    renderPracticeHistoryPanel();
}

export function exportPracticeHistoryPanelCsv() {
    const { rows, selectedDate } = getFilteredPracticeHistoryRows();
    if (rows.length === 0) return showCustomAlert('出力する取り組み記録がありません。');

    const csv = buildPracticeHistoryCsv(rows, selectedDate);
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
