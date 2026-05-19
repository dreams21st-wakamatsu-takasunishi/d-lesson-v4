import {
    users,
    saveUsers,
    GLOBAL_SETTINGS_ID,
    isSystemUserId,
    getUserDisplayName
} from '../api/user.js';
import { showCustomAlert, showCustomConfirm } from './modal.js';
import { recordAdminAudit } from './admin-audit.js';
import { escapeCsvCell, getBackupDateStamp } from '../utils/export-format.js';

let editingTextTaskId = null; 

const TEXT_TASK_TEMPLATES = [
    {
        id: 'tpl_text_first_steps',
        title: 'はじめての文章入力',
        time: 3,
        star: 1,
        content: 'きょうは、パソコンで文章を入力します。\nゆっくりでもよいので、正しく入力しましょう。\nまちがえたときは、落ち着いて直します。'
    },
    {
        id: 'tpl_text_comma_period',
        title: '読点と句点の練習',
        time: 4,
        star: 2,
        content: '朝、教室に入ったら、先生にあいさつをします。\nイスにすわったら、パソコンを開きます。\n準備ができたら、Dレッスンを始めます。'
    },
    {
        id: 'tpl_text_pc_actions',
        title: 'パソコン操作の文',
        time: 4,
        star: 2,
        content: 'ファイルを開いて、文字を入力します。\n入力が終わったら、名前をつけて保存します。\nわからないときは、先生に聞きます。'
    },
    {
        id: 'tpl_text_report',
        title: '短い報告文',
        time: 5,
        star: 3,
        content: '今日の練習では、マウス操作とキーボード入力に取り組みました。\nマウスでは、ねらった場所を正しくクリックできました。\nキーボードでは、前よりも落ち着いて入力できました。'
    },
    {
        id: 'tpl_text_story',
        title: '物語文の練習',
        time: 6,
        star: 3,
        content: '{昔|むかし}々、あるところに、パソコンが好きな子どもがいました。\nその子は毎日少しずつ練習して、できることを増やしていきました。\nうまくいかない日もありましたが、あきらめずに続けました。'
    },
    {
        id: 'tpl_text_long_challenge',
        title: '長文チャレンジ',
        time: 8,
        star: 4,
        content: '文章入力では、速さだけでなく、正確さも大切です。\nまずはお手本をよく見て、同じように入力します。\n次に、まちがえた場所を確認して、どうすれば正しく入力できるか考えます。\n毎回の練習を記録していくことで、自分の成長がわかります。'
    }
];

function getTextTasks() {
    if (!users[GLOBAL_SETTINGS_ID]) users[GLOBAL_SETTINGS_ID] = { isMaster: true };
    if (!users[GLOBAL_SETTINGS_ID].textTasks) users[GLOBAL_SETTINGS_ID].textTasks = [];
    return users[GLOBAL_SETTINGS_ID].textTasks;
}

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function getStudentGroups() {
    const groups = new Set();
    Object.entries(users).forEach(([userId, user]) => {
        if (!isStudentUser(userId, user)) return;
        const group = String(user.group || '').trim();
        if (group) groups.add(group);
    });
    return Array.from(groups).sort((a, b) => a.localeCompare(b, 'ja'));
}

function isStudentUser(userId, user) {
    return Boolean(user && !user.isMaster && !isSystemUserId(userId));
}

function getStudentUsers() {
    return Object.entries(users)
        .filter(([userId, user]) => isStudentUser(userId, user))
        .map(([userId, user]) => ({ userId, user }));
}

function getKnownTextTaskGroups(tasks = getTextTasks()) {
    const groups = new Set(getStudentGroups());
    tasks.forEach(task => {
        const group = String(task?.targetGroup || '').trim();
        if (group) groups.add(group);
    });
    return Array.from(groups).sort((a, b) => a.localeCompare(b, 'ja'));
}

function renderTextTaskGroupOptions(selectedValue = null) {
    const select = document.getElementById('admin-text-target-group');
    if (!select) return;
    const selected = String(selectedValue ?? select.value ?? '').trim();
    const groups = getStudentGroups();
    select.innerHTML = '';

    const allOption = document.createElement('option');
    allOption.value = '';
    allOption.textContent = '全員';
    select.appendChild(allOption);

    groups.forEach(group => {
        const option = document.createElement('option');
        option.value = group;
        option.textContent = group;
        select.appendChild(option);
    });

    if (selected && !groups.includes(selected)) {
        const option = document.createElement('option');
        option.value = selected;
        option.textContent = `${selected}（現在該当なし）`;
        select.appendChild(option);
    }

    select.value = selected;
}

function getTextTaskTargetGroupLabel(task) {
    const group = String(task?.targetGroup || '').trim();
    return group || '全員';
}

function getTextTaskAudience(task) {
    const targetGroup = String(task?.targetGroup || '').trim();
    const students = getStudentUsers();
    const targetStudents = targetGroup
        ? students.filter(({ user }) => String(user.group || '').trim() === targetGroup)
        : students;
    const visibleCount = task?.hidden === true ? 0 : targetStudents.length;
    return {
        targetGroup,
        targetCount: targetStudents.length,
        visibleCount,
        totalStudents: students.length
    };
}

function getTextRecordTimestamp(record) {
    if (!record || typeof record !== 'object') return '';
    return record.lastCompletedAt || record.updatedAt || record.updated_at || record.bestAt || record.completedAt || '';
}

function formatTextRecordTimestamp(value) {
    const date = new Date(value);
    if (!value || Number.isNaN(date.getTime())) return '';
    return date.toLocaleString('ja-JP', {
        month: 'numeric',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function getTextTaskProgress(task) {
    const targetGroup = String(task?.targetGroup || '').trim();
    const rows = getStudentUsers()
        .filter(({ user }) => !targetGroup || String(user.group || '').trim() === targetGroup)
        .map(({ userId, user }) => {
            const record = user?.textRecords?.[task.id] || null;
            const lastCompletedAt = getTextRecordTimestamp(record);
            return {
                userId,
                name: getUserDisplayName(userId),
                group: String(user.group || '').trim(),
                completed: Boolean(record),
                score: Number(record?.score || 0),
                total: Number(record?.total || 0),
                miss: Number(record?.miss || 0),
                attempts: record ? Math.max(1, Number(record?.attempts || 1)) : 0,
                lastCompletedAt,
                lastCompletedLabel: formatTextRecordTimestamp(lastCompletedAt)
            };
        })
        .sort((a, b) => {
            if (a.completed !== b.completed) return a.completed ? -1 : 1;
            if (b.score !== a.score) return b.score - a.score;
            return a.name.localeCompare(b.name, 'ja');
        });
    return {
        rows,
        completedCount: rows.filter(row => row.completed).length,
        targetCount: rows.length
    };
}

function makeSafeFileName(value) {
    return String(value || 'text-task')
        .replace(/[\\/:*?"<>|]/g, '_')
        .replace(/\s+/g, '_')
        .slice(0, 80);
}

function downloadTextCsv(filename, rows) {
    const csv = rows.map(row => row.map(escapeCsvCell).join(',')).join('\r\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
}

function getTextTaskAudienceBadgeStyle(task, audience) {
    if (task.hidden === true) return { bg: '#eceff1', color: '#546e7a' };
    if (audience.targetCount === 0) return { bg: '#fff3e0', color: '#e65100' };
    return { bg: '#e8f5e9', color: '#2e7d32' };
}

function getPlainTextTaskContent(task) {
    return String(task?.content || '').replace(/\{([^|]+)\|([^}]+)\}/g, '$1');
}

function getReadableTextTaskContent(task) {
    return String(task?.content || '').replace(/\{([^|]+)\|([^}]+)\}/g, '$1（$2）');
}

function renderTextTaskListGroupOptions(tasks) {
    const select = document.getElementById('admin-text-list-filter-group');
    if (!select) return;
    const selected = select.value || 'all';
    select.innerHTML = '';

    [
        { value: 'all', label: 'すべての対象' },
        { value: '__everyone__', label: '全員向けのみ' }
    ].forEach(item => {
        const option = document.createElement('option');
        option.value = item.value;
        option.textContent = item.label;
        select.appendChild(option);
    });

    getKnownTextTaskGroups(tasks).forEach(group => {
        const option = document.createElement('option');
        option.value = group;
        option.textContent = group;
        select.appendChild(option);
    });

    const values = Array.from(select.options).map(option => option.value);
    select.value = values.includes(selected) ? selected : 'all';
}

function renderTextTaskBulkGroupOptions(tasks) {
    const select = document.getElementById('admin-text-bulk-target-group');
    if (!select) return;
    const selected = String(select.value || '').trim();
    select.innerHTML = '';

    const allOption = document.createElement('option');
    allOption.value = '';
    allOption.textContent = '全員';
    select.appendChild(allOption);

    getKnownTextTaskGroups(tasks).forEach(group => {
        const option = document.createElement('option');
        option.value = group;
        option.textContent = group;
        select.appendChild(option);
    });

    const values = Array.from(select.options).map(option => option.value);
    select.value = values.includes(selected) ? selected : '';
}

function getAdminTextTaskFilters() {
    return {
        group: document.getElementById('admin-text-list-filter-group')?.value || 'all',
        visibility: document.getElementById('admin-text-list-filter-visibility')?.value || 'all',
        difficulty: document.getElementById('admin-text-list-filter-difficulty')?.value || 'all',
        progress: document.getElementById('admin-text-list-filter-progress')?.value || 'all',
        sort: document.getElementById('admin-text-list-sort')?.value || 'manual',
        search: String(document.getElementById('admin-text-list-search')?.value || '').trim().toLowerCase()
    };
}

function sortAdminTextTaskEntries(entries, sort) {
    if (sort === 'manual') return entries;

    return entries
        .map(entry => {
            const progress = getTextTaskProgress(entry.task);
            const incompleteCount = Math.max(0, progress.targetCount - progress.completedCount);
            const completionRate = progress.targetCount > 0 ? progress.completedCount / progress.targetCount : 1;
            return {
                ...entry,
                progress,
                incompleteCount,
                completionRate,
                title: String(entry.task.title || '')
            };
        })
        .sort((a, b) => {
            if (sort === 'incomplete-desc') {
                return (b.incompleteCount - a.incompleteCount)
                    || (b.progress.targetCount - a.progress.targetCount)
                    || (a.index - b.index);
            }
            if (sort === 'completion-asc') {
                return (a.completionRate - b.completionRate)
                    || (b.incompleteCount - a.incompleteCount)
                    || (a.index - b.index);
            }
            if (sort === 'completed-desc') {
                return (b.progress.completedCount - a.progress.completedCount)
                    || (b.progress.targetCount - a.progress.targetCount)
                    || (a.index - b.index);
            }
            if (sort === 'title-asc') {
                return a.title.localeCompare(b.title, 'ja') || (a.index - b.index);
            }
            return a.index - b.index;
        });
}

function filterAdminTextTasks(tasks) {
    const filters = getAdminTextTaskFilters();
    const entries = tasks
        .map((task, index) => ({ task, index }))
        .filter(({ task }) => {
            const taskGroup = String(task.targetGroup || '').trim();
            if (filters.group === '__everyone__' && taskGroup) return false;
            if (filters.group !== 'all' && filters.group !== '__everyone__' && taskGroup !== filters.group) return false;
            if (filters.visibility === 'visible' && task.hidden === true) return false;
            if (filters.visibility === 'hidden' && task.hidden !== true) return false;

            const star = Number(task.star || 3);
            if (filters.difficulty === 'easy' && star > 2) return false;
            if (filters.difficulty === 'normal' && star !== 3) return false;
            if (filters.difficulty === 'hard' && star < 4) return false;

            if (filters.progress !== 'all') {
                const progress = getTextTaskProgress(task);
                if (filters.progress === 'no-target' && progress.targetCount !== 0) return false;
                if (filters.progress === 'complete' && (progress.targetCount === 0 || progress.completedCount < progress.targetCount)) return false;
                if (filters.progress === 'incomplete' && (progress.targetCount === 0 || progress.completedCount >= progress.targetCount)) return false;
            }

            if (filters.search) {
                const haystack = `${task.title || ''} ${task.content || ''}`.toLowerCase();
                if (!haystack.includes(filters.search)) return false;
            }
            return true;
        });
    return sortAdminTextTaskEntries(entries, filters.sort);
}

export function resetAdminTextTaskFilters() {
    const group = document.getElementById('admin-text-list-filter-group');
    const visibility = document.getElementById('admin-text-list-filter-visibility');
    const difficulty = document.getElementById('admin-text-list-filter-difficulty');
    const progress = document.getElementById('admin-text-list-filter-progress');
    const sort = document.getElementById('admin-text-list-sort');
    const search = document.getElementById('admin-text-list-search');
    if (group) group.value = 'all';
    if (visibility) visibility.value = 'all';
    if (difficulty) difficulty.value = 'all';
    if (progress) progress.value = 'all';
    if (sort) sort.value = 'manual';
    if (search) search.value = '';
    renderAdminTextTasks();
}

function getFilteredTextTaskEntriesForBulkAction() {
    return filterAdminTextTasks(getTextTasks());
}

export function applyAdminTextTaskBulkTargetGroup() {
    const targetGroup = document.getElementById('admin-text-bulk-target-group')?.value.trim() || '';
    const entries = getFilteredTextTaskEntriesForBulkAction();
    if (entries.length === 0) return showCustomAlert('一括変更できる課題がありません。');

    showCustomConfirm(`現在一覧に表示されている ${entries.length} 件の課題の対象を「${targetGroup || '全員'}」に変更しますか？`, () => {
        let changed = 0;
        entries.forEach(({ task }) => {
            const beforeGroup = String(task.targetGroup || '').trim();
            if (beforeGroup === targetGroup) return;
            task.targetGroup = targetGroup;
            changed++;
        });
        recordAdminAudit('文章課題 対象グループ一括変更', {
            count: entries.length,
            changed,
            targetGroup: targetGroup || '全員'
        });
        saveUsers(true);
        renderAdminTextTasks();
        showCustomAlert(`対象グループを ${changed} 件変更しました。`);
    });
}

export function applyAdminTextTaskBulkVisibility() {
    const visibility = document.getElementById('admin-text-bulk-visibility')?.value || 'visible';
    const makeHidden = visibility === 'hidden';
    const entries = getFilteredTextTaskEntriesForBulkAction();
    if (entries.length === 0) return showCustomAlert('一括変更できる課題がありません。');

    const label = makeHidden ? '非表示' : '表示中';
    showCustomConfirm(`現在一覧に表示されている ${entries.length} 件の課題を「${label}」に変更しますか？`, () => {
        let changed = 0;
        entries.forEach(({ task }) => {
            if ((task.hidden === true) === makeHidden) return;
            task.hidden = makeHidden;
            changed++;
        });
        recordAdminAudit('文章課題 表示状態一括変更', {
            count: entries.length,
            changed,
            visible: !makeHidden
        });
        saveUsers(true);
        renderAdminTextTasks();
        showCustomAlert(`表示状態を ${changed} 件変更しました。`);
    });
}

function resetTextTaskForm() {
    editingTextTaskId = null;
    document.getElementById('admin-text-title').value = '';
    document.getElementById('admin-text-time').value = '';
    document.getElementById('admin-text-star').value = '3';
    document.getElementById('admin-text-content').value = '';
    const visibleInput = document.getElementById('admin-text-visible');
    if (visibleInput) visibleInput.checked = true;
    renderTextTaskGroupOptions('');
    document.getElementById('btn-admin-text-save').innerText = '課題を追加';
    const cancelButton = document.getElementById('btn-admin-text-cancel');
    if (cancelButton) cancelButton.style.display = 'none';
}

function makeTextTaskListButton(label, className, onClick, options = {}) {
    const button = document.createElement('button');
    button.className = className;
    button.type = 'button';
    button.textContent = label;
    button.disabled = Boolean(options.disabled);
    if (options.title) button.title = options.title;
    button.style.fontSize = '14px';
    button.style.padding = '5px 10px';
    button.addEventListener('click', onClick);
    return button;
}

export function adminAddTextTask() {
    const title = document.getElementById('admin-text-title').value.trim();
    const time = parseInt(document.getElementById('admin-text-time').value, 10);
    const star = parseInt(document.getElementById('admin-text-star').value, 10) || 3; 
    const content = document.getElementById('admin-text-content').value;
    const hidden = document.getElementById('admin-text-visible')?.checked === false;
    const targetGroup = document.getElementById('admin-text-target-group')?.value.trim() || '';
    if (!title || !time || !content.trim()) return showCustomAlert("タイトル、制限時間、お手本文章をすべて入力してください。");
    
    const textTasks = getTextTasks();
    
    if (editingTextTaskId) {
        let task = textTasks.find(t => t.id === editingTextTaskId);
        if (task) {
            task.title = title;
            task.time = time;
            task.star = star;
            task.content = content;
            task.hidden = hidden;
            task.targetGroup = targetGroup;
        }
        editingTextTaskId = null;
        document.getElementById('btn-admin-text-save').innerText = '課題を追加';
        recordAdminAudit('文章課題更新', { title, time, star, targetGroup: targetGroup || '全員' });
        showCustomAlert('課題を更新しました！');
    } else {
        const taskId = 'tt_' + Date.now();
        textTasks.push({ id: taskId, title: title, time: time, star: star, content: content, hidden, targetGroup });
        recordAdminAudit('文章課題追加', { title, time, star, targetGroup: targetGroup || '全員' });
        showCustomAlert('新しい課題を追加しました！');
    }
    
    saveUsers(true); 
    resetTextTaskForm();
    renderAdminTextTasks();
}

export function loadTextTaskTemplate(templateId) {
    const template = TEXT_TASK_TEMPLATES.find(item => item.id === templateId);
    if (!template) return showCustomAlert('テンプレートが見つかりませんでした。');
    editingTextTaskId = null;
    document.getElementById('admin-text-title').value = template.title;
    document.getElementById('admin-text-time').value = template.time;
    document.getElementById('admin-text-star').value = template.star;
    document.getElementById('admin-text-content').value = template.content;
    const visibleInput = document.getElementById('admin-text-visible');
    if (visibleInput) visibleInput.checked = true;
    renderTextTaskGroupOptions('');
    document.getElementById('btn-admin-text-save').innerText = '課題を追加';
    const cancelButton = document.getElementById('btn-admin-text-cancel');
    if (cancelButton) cancelButton.style.display = 'none';
}

export function addStandardTextTaskTemplates() {
    const textTasks = getTextTasks();
    const existingIds = new Set(textTasks.map(task => task.id));
    const added = [];
    TEXT_TASK_TEMPLATES.forEach(template => {
        if (existingIds.has(template.id)) return;
        textTasks.push({ ...template });
        added.push(template.title);
    });
    if (added.length === 0) {
        showCustomAlert('標準課題はすでに追加されています。');
        return;
    }
    recordAdminAudit('文章入力 標準課題追加', { count: added.length, titles: added });
    saveUsers(true);
    renderAdminTextTasks();
    showCustomAlert(`標準課題を ${added.length} 件追加しました。`);
}

export function renderTextTaskTemplateOptions() {
    const select = document.getElementById('admin-text-template-select');
    if (!select) return;
    select.innerHTML = '<option value="">テンプレートを選択</option>' + TEXT_TASK_TEMPLATES
        .map(template => `<option value="${template.id}">★${template.star} ${template.title}</option>`)
        .join('');
}

export function editTextTask(id) {
    const task = getTextTasks().find(t => t.id === id);
    if (!task) return;
    editingTextTaskId = id;
    document.getElementById('admin-text-title').value = task.title;
    document.getElementById('admin-text-time').value = task.time;
    document.getElementById('admin-text-star').value = task.star || 3;
    document.getElementById('admin-text-content').value = task.content;
    const visibleInput = document.getElementById('admin-text-visible');
    if (visibleInput) visibleInput.checked = task.hidden !== true;
    renderTextTaskGroupOptions(task.targetGroup || '');
    document.getElementById('btn-admin-text-save').innerText = '課題を更新';
    const cancelButton = document.getElementById('btn-admin-text-cancel');
    if (cancelButton) cancelButton.style.display = 'inline-flex';
    document.getElementById('admin-text-title').focus();
}

export function cancelTextTaskEdit() {
    resetTextTaskForm();
}

export function duplicateTextTask(id) {
    const tasks = getTextTasks();
    const idx = tasks.findIndex(t => t.id === id);
    if (idx === -1) return showCustomAlert('複製する課題が見つかりませんでした。');
    const original = tasks[idx];
    const duplicated = {
        id: 'tt_' + Date.now(),
        title: `${original.title} のコピー`,
        time: original.time,
        star: original.star || 3,
        content: original.content,
        hidden: original.hidden === true,
        targetGroup: original.targetGroup || ''
    };
    tasks.splice(idx + 1, 0, duplicated);
    recordAdminAudit('文章課題複製', { from: original.title, title: duplicated.title });
    saveUsers(true);
    renderAdminTextTasks();
    showCustomAlert('課題を複製しました。必要に応じて編集してください。');
}

export function toggleTextTaskVisibility(id) {
    const task = getTextTasks().find(t => t.id === id);
    if (!task) return showCustomAlert('表示を切り替える課題が見つかりませんでした。');
    task.hidden = task.hidden !== true;
    recordAdminAudit('文章課題 表示切替', { title: task.title, visible: task.hidden !== true });
    saveUsers(true);
    renderAdminTextTasks();
}

function setTextTaskTargetGroup(id, targetGroup) {
    const task = getTextTasks().find(t => t.id === id);
    if (!task) return showCustomAlert('対象グループを変更する課題が見つかりませんでした。');
    const nextGroup = String(targetGroup || '').trim();
    const beforeGroup = String(task.targetGroup || '').trim();
    if (beforeGroup === nextGroup) return;
    task.targetGroup = nextGroup;
    recordAdminAudit('文章課題 対象グループ変更', {
        title: task.title,
        before: beforeGroup || '全員',
        after: nextGroup || '全員'
    });
    saveUsers(true);
    if (editingTextTaskId === id) renderTextTaskGroupOptions(nextGroup);
    renderAdminTextTasks();
}

function createTextTaskTargetGroupSelect(task) {
    const wrapper = document.createElement('label');
    wrapper.style.cssText = 'display:flex; align-items:center; gap:6px; margin:2px 0 6px 0; font-size:12px; font-weight:bold; color:#455a64;';
    wrapper.textContent = '対象変更';

    const select = document.createElement('select');
    select.style.cssText = 'max-width:180px; padding:4px 6px; border:1px solid #b0bec5; border-radius:6px; background:#fff; font-size:12px; color:#263238;';
    const taskGroup = String(task.targetGroup || '').trim();

    const allOption = document.createElement('option');
    allOption.value = '';
    allOption.textContent = '全員';
    select.appendChild(allOption);

    getKnownTextTaskGroups().forEach(group => {
        const option = document.createElement('option');
        option.value = group;
        option.textContent = group;
        select.appendChild(option);
    });

    if (taskGroup && !Array.from(select.options).some(option => option.value === taskGroup)) {
        const option = document.createElement('option');
        option.value = taskGroup;
        option.textContent = `${taskGroup}（現在該当なし）`;
        select.appendChild(option);
    }

    select.value = taskGroup;
    select.addEventListener('change', () => setTextTaskTargetGroup(task.id, select.value));
    wrapper.appendChild(select);
    return wrapper;
}

function closeTextTaskPreview() {
    const modal = document.getElementById('admin-text-task-preview-modal');
    if (modal) modal.style.display = 'none';
}

function createTextTaskPreviewModal() {
    const existing = document.getElementById('admin-text-task-preview-modal');
    if (existing) return existing;

    const modal = document.createElement('div');
    modal.id = 'admin-text-task-preview-modal';
    modal.style.cssText = 'display:none; position:absolute; inset:0; background:rgba(0,0,0,0.72); z-index:9200; align-items:center; justify-content:center; padding:24px; box-sizing:border-box;';
    modal.innerHTML = `
        <div style="width:min(920px, 94vw); max-height:88vh; background:#fff; border-radius:14px; border:3px solid #90caf9; box-shadow:0 18px 50px rgba(0,0,0,0.35); display:flex; flex-direction:column; overflow:hidden;">
            <div style="padding:18px 22px; background:#e3f2fd; border-bottom:2px solid #bbdefb;">
                <div id="admin-text-task-preview-title" style="font-size:22px; font-weight:bold; color:#0d47a1;"></div>
                <div id="admin-text-task-preview-meta" style="display:flex; gap:8px; flex-wrap:wrap; margin-top:10px;"></div>
            </div>
            <div style="padding:18px 22px; overflow:auto;">
                <div style="font-size:14px; color:#546e7a; font-weight:bold; margin-bottom:8px;">本文プレビュー</div>
                <pre id="admin-text-task-preview-content" style="white-space:pre-wrap; word-break:break-word; margin:0; min-height:240px; max-height:46vh; overflow:auto; background:#fafafa; border:2px solid #cfd8dc; border-radius:10px; padding:16px; font-size:17px; line-height:1.8; color:#263238;"></pre>
            </div>
            <div style="display:flex; justify-content:flex-end; gap:10px; padding:14px 22px; border-top:1px solid #e0e0e0; background:#fafafa;">
                <button id="admin-text-task-preview-edit" class="btn-primary" type="button" style="font-size:16px; padding:9px 18px; margin:0;">この課題を編集</button>
                <button id="admin-text-task-preview-close" class="btn-secondary" type="button" style="font-size:16px; padding:9px 18px; margin:0;">とじる</button>
            </div>
        </div>
    `;
    modal.addEventListener('click', event => {
        if (event.target === modal) closeTextTaskPreview();
    });
    modal.querySelector('#admin-text-task-preview-close')?.addEventListener('click', closeTextTaskPreview);
    document.body.appendChild(modal);
    return modal;
}

function setPreviewBadge(container, label, bg, color = '#263238') {
    const badge = document.createElement('span');
    badge.textContent = label;
    badge.style.cssText = `display:inline-block; padding:4px 10px; border-radius:999px; background:${bg}; color:${color}; font-size:13px; font-weight:bold;`;
    container.appendChild(badge);
}

function previewTextTask(id) {
    const task = getTextTasks().find(t => t.id === id);
    if (!task) return showCustomAlert('確認する課題が見つかりませんでした。');

    const modal = createTextTaskPreviewModal();
    const title = modal.querySelector('#admin-text-task-preview-title');
    const meta = modal.querySelector('#admin-text-task-preview-meta');
    const content = modal.querySelector('#admin-text-task-preview-content');
    const editButton = modal.querySelector('#admin-text-task-preview-edit');
    const plainText = getPlainTextTaskContent(task);
    const audience = getTextTaskAudience(task);
    const progress = getTextTaskProgress(task);
    const audienceStyle = getTextTaskAudienceBadgeStyle(task, audience);

    if (title) title.textContent = task.title || '無題の課題';
    if (meta) {
        meta.innerHTML = '';
        setPreviewBadge(meta, task.hidden === true ? '非表示' : '表示中', task.hidden === true ? '#eceff1' : '#e8f5e9', task.hidden === true ? '#546e7a' : '#2e7d32');
        setPreviewBadge(meta, `対象: ${getTextTaskTargetGroupLabel(task)}`, '#e3f2fd', '#1565c0');
        setPreviewBadge(meta, `対象児童: ${audience.targetCount}人`, '#e0f7fa', '#006064');
        setPreviewBadge(meta, `児童側表示: ${audience.visibleCount}人`, audienceStyle.bg, audienceStyle.color);
        setPreviewBadge(meta, `実施済み: ${progress.completedCount}/${progress.targetCount}人`, '#ede7f6', '#4527a0');
        setPreviewBadge(meta, `難易度: ${'★'.repeat(Number(task.star || 3))}`, '#fff8e1', '#e65100');
        setPreviewBadge(meta, `制限時間: ${Number(task.time || 0)}分`, '#f3e5f5', '#6a1b9a');
        setPreviewBadge(meta, `文字数: ${plainText.length}`, '#e0f2f1', '#00695c');
        setPreviewBadge(meta, `行数: ${plainText.split(/\r?\n/).length}`, '#fbe9e7', '#bf360c');
    }
    if (content) content.textContent = getReadableTextTaskContent(task);
    if (editButton) {
        editButton.onclick = () => {
            closeTextTaskPreview();
            editTextTask(id);
        };
    }
    modal.style.display = 'flex';
}

function closeTextTaskProgressModal() {
    const modal = document.getElementById('admin-text-task-progress-modal');
    if (modal) modal.style.display = 'none';
}

function createTextTaskProgressModal() {
    const existing = document.getElementById('admin-text-task-progress-modal');
    if (existing) return existing;

    const modal = document.createElement('div');
    modal.id = 'admin-text-task-progress-modal';
    modal.style.cssText = 'display:none; position:absolute; inset:0; background:rgba(0,0,0,0.72); z-index:9200; align-items:center; justify-content:center; padding:24px; box-sizing:border-box;';
    modal.innerHTML = `
        <div style="width:min(1060px, 94vw); max-height:88vh; background:#fff; border-radius:14px; border:3px solid #b39ddb; box-shadow:0 18px 50px rgba(0,0,0,0.35); display:flex; flex-direction:column; overflow:hidden;">
            <div style="padding:18px 22px; background:#ede7f6; border-bottom:2px solid #d1c4e9;">
                <div id="admin-text-task-progress-title" style="font-size:22px; font-weight:bold; color:#4527a0;"></div>
                <div id="admin-text-task-progress-meta" style="display:flex; gap:8px; flex-wrap:wrap; margin-top:10px;"></div>
            </div>
            <div style="padding:16px 22px; overflow:auto;">
                <div style="display:flex; justify-content:space-between; align-items:center; gap:12px; margin-bottom:12px; flex-wrap:wrap;">
                    <label style="display:flex; align-items:center; gap:8px; font-size:14px; font-weight:bold; color:#4527a0;">
                        表示
                        <select id="admin-text-task-progress-filter" style="padding:7px 10px; border:2px solid #d1c4e9; border-radius:8px; font-size:14px;">
                            <option value="all">すべて</option>
                            <option value="incomplete">未実施のみ</option>
                            <option value="complete">実施済みのみ</option>
                        </select>
                    </label>
                    <label style="display:flex; align-items:center; gap:8px; font-size:14px; font-weight:bold; color:#4527a0;">
                        並び替え
                        <select id="admin-text-task-progress-sort" style="padding:7px 10px; border:2px solid #d1c4e9; border-radius:8px; font-size:14px;">
                            <option value="status-score">状態・スコア順</option>
                            <option value="incomplete-first">未実施を上に</option>
                            <option value="last-desc">最終実施が新しい順</option>
                            <option value="score-desc">スコアが高い順</option>
                            <option value="name-asc">名前順</option>
                        </select>
                    </label>
                    <div id="admin-text-task-progress-view-summary" style="font-size:13px; font-weight:bold; color:#6a1b9a;"></div>
                </div>
                <table style="width:100%; border-collapse:collapse; font-size:14px;">
                    <thead style="background:#f3e5f5; position:sticky; top:0;">
                        <tr>
                            <th style="border:1px solid #d1c4e9; padding:8px; text-align:left;">児童</th>
                            <th style="border:1px solid #d1c4e9; padding:8px; text-align:left;">グループ</th>
                            <th style="border:1px solid #d1c4e9; padding:8px; text-align:left;">状態</th>
                            <th style="border:1px solid #d1c4e9; padding:8px; text-align:left;">最終実施</th>
                            <th style="border:1px solid #d1c4e9; padding:8px; text-align:right;">回数</th>
                            <th style="border:1px solid #d1c4e9; padding:8px; text-align:right;">最高純字数</th>
                            <th style="border:1px solid #d1c4e9; padding:8px; text-align:right;">入力文字数</th>
                            <th style="border:1px solid #d1c4e9; padding:8px; text-align:right;">ミス</th>
                        </tr>
                    </thead>
                    <tbody id="admin-text-task-progress-body"></tbody>
                </table>
            </div>
            <div style="display:flex; justify-content:flex-end; gap:10px; padding:14px 22px; border-top:1px solid #e0e0e0; background:#fafafa;">
                <button id="admin-text-task-progress-export" class="btn-primary" type="button" style="font-size:16px; padding:9px 18px; margin:0;">CSV出力</button>
                <button id="admin-text-task-progress-incomplete-export" class="btn-secondary" type="button" style="font-size:16px; padding:9px 18px; margin:0;">未実施CSV</button>
                <button id="admin-text-task-progress-incomplete-copy" class="btn-secondary" type="button" style="font-size:16px; padding:9px 18px; margin:0;">未実施名コピー</button>
                <button id="admin-text-task-progress-close" class="btn-secondary" type="button" style="font-size:16px; padding:9px 18px; margin:0;">とじる</button>
            </div>
        </div>
    `;
    modal.addEventListener('click', event => {
        if (event.target === modal) closeTextTaskProgressModal();
    });
    modal.querySelector('#admin-text-task-progress-close')?.addEventListener('click', closeTextTaskProgressModal);
    document.body.appendChild(modal);
    return modal;
}

function appendProgressCell(row, text, align = 'left', color = '#263238') {
    const cell = document.createElement('td');
    cell.textContent = text;
    cell.style.cssText = `border:1px solid #e1bee7; padding:8px; text-align:${align}; color:${color};`;
    row.appendChild(cell);
}

function getFilteredTextTaskProgressRows(progress, mode) {
    if (mode === 'incomplete') return progress.rows.filter(item => !item.completed);
    if (mode === 'complete') return progress.rows.filter(item => item.completed);
    return progress.rows;
}

function sortTextTaskProgressRows(rows, sort) {
    const sortedRows = [...rows];
    const getTime = item => Date.parse(item.lastCompletedAt || '') || 0;
    if (sort === 'incomplete-first') {
        return sortedRows.sort((a, b) => {
            if (a.completed !== b.completed) return a.completed ? 1 : -1;
            return a.name.localeCompare(b.name, 'ja');
        });
    }
    if (sort === 'last-desc') {
        return sortedRows.sort((a, b) => {
            if (getTime(b) !== getTime(a)) return getTime(b) - getTime(a);
            if (a.completed !== b.completed) return a.completed ? -1 : 1;
            return a.name.localeCompare(b.name, 'ja');
        });
    }
    if (sort === 'score-desc') {
        return sortedRows.sort((a, b) => {
            if (b.score !== a.score) return b.score - a.score;
            return a.name.localeCompare(b.name, 'ja');
        });
    }
    if (sort === 'name-asc') {
        return sortedRows.sort((a, b) => a.name.localeCompare(b.name, 'ja'));
    }
    return sortedRows;
}

function renderTextTaskProgressRows(body, progress, mode, sort, summary) {
    if (!body) return;
    const rows = sortTextTaskProgressRows(getFilteredTextTaskProgressRows(progress, mode), sort);
    body.innerHTML = '';

    if (summary) {
        const label = mode === 'incomplete' ? '未実施' : mode === 'complete' ? '実施済み' : 'すべて';
        summary.textContent = `${label}: ${rows.length}人 / 対象${progress.targetCount}人`;
    }

    if (progress.rows.length === 0) {
        const row = document.createElement('tr');
        const cell = document.createElement('td');
        cell.colSpan = 8;
        cell.textContent = '対象児童がいません。対象グループを確認してください。';
        cell.style.cssText = 'border:1px solid #e1bee7; padding:18px; text-align:center; color:#78909c; font-weight:bold;';
        row.appendChild(cell);
        body.appendChild(row);
        return;
    }

    if (rows.length === 0) {
        const row = document.createElement('tr');
        const cell = document.createElement('td');
        cell.colSpan = 8;
        cell.textContent = mode === 'incomplete' ? '未実施児童はいません。' : '表示できる児童がいません。';
        cell.style.cssText = 'border:1px solid #e1bee7; padding:18px; text-align:center; color:#78909c; font-weight:bold;';
        row.appendChild(cell);
        body.appendChild(row);
        return;
    }

    rows.forEach(item => {
        const row = document.createElement('tr');
        row.style.background = item.completed ? '#ffffff' : '#fafafa';
        appendProgressCell(row, item.name);
        appendProgressCell(row, item.group || '-');
        appendProgressCell(row, item.completed ? '実施済み' : '未実施', 'left', item.completed ? '#2e7d32' : '#78909c');
        appendProgressCell(row, item.completed ? item.lastCompletedLabel || '-' : '-', 'left', '#455a64');
        appendProgressCell(row, item.completed ? `${item.attempts}` : '-', 'right');
        appendProgressCell(row, item.completed ? `${item.score}` : '-', 'right');
        appendProgressCell(row, item.completed ? `${item.total}` : '-', 'right');
        appendProgressCell(row, item.completed ? `${item.miss}` : '-', 'right');
        body.appendChild(row);
    });
}

function exportTextTaskProgressCsv(task) {
    const progress = getTextTaskProgress(task);
    if (progress.rows.length === 0) return showCustomAlert('出力する対象児童がいません。');

    const rows = [[
        'task_title',
        'target_group',
        'visible_to_students',
        'student_name',
        'user_data_id',
        'group',
        'status',
        'last_completed_at',
        'attempts',
        'best_score',
        'input_chars',
        'misses'
    ]];

    progress.rows.forEach(item => {
        rows.push([
            task.title || '',
            getTextTaskTargetGroupLabel(task),
            task.hidden === true ? 'no' : 'yes',
            item.name,
            item.userId,
            item.group || '',
            item.completed ? 'completed' : 'not_completed',
            item.completed ? item.lastCompletedAt : '',
            item.completed ? item.attempts : '',
            item.completed ? item.score : '',
            item.completed ? item.total : '',
            item.completed ? item.miss : ''
        ]);
    });

    const filename = `d-lesson_text_task_${makeSafeFileName(task.title)}_${getBackupDateStamp()}.csv`;
    downloadTextCsv(filename, rows);
    recordAdminAudit('文章課題 実施状況CSV出力', {
        title: task.title,
        rows: progress.rows.length,
        completed: progress.completedCount,
        target: progress.targetCount
    });
}

function exportTextTaskIncompleteCsv(task) {
    const progress = getTextTaskProgress(task);
    const incompleteRows = progress.rows.filter(item => !item.completed);
    if (progress.rows.length === 0) return showCustomAlert('出力する対象児童がいません。');
    if (incompleteRows.length === 0) return showCustomAlert('この課題に未実施児童はいません。');

    const rows = [[
        'task_title',
        'target_group',
        'visible_to_students',
        'student_name',
        'user_data_id',
        'group',
        'status'
    ]];

    incompleteRows.forEach(item => {
        rows.push([
            task.title || '',
            getTextTaskTargetGroupLabel(task),
            task.hidden === true ? 'no' : 'yes',
            item.name,
            item.userId,
            item.group || '',
            'not_completed'
        ]);
    });

    const filename = `d-lesson_text_task_incomplete_${makeSafeFileName(task.title)}_${getBackupDateStamp()}.csv`;
    downloadTextCsv(filename, rows);
    recordAdminAudit('文章課題 未実施児童CSV出力', {
        title: task.title,
        rows: incompleteRows.length,
        completed: progress.completedCount,
        target: progress.targetCount
    });
}

async function copyTextTaskIncompleteNames(task) {
    const progress = getTextTaskProgress(task);
    const incompleteRows = progress.rows.filter(item => !item.completed);
    if (progress.rows.length === 0) return showCustomAlert('コピーする対象児童がいません。');
    if (incompleteRows.length === 0) return showCustomAlert('この課題に未実施児童はいません。');

    const text = [
        `文章課題: ${task.title || '無題の課題'}`,
        `対象: ${getTextTaskTargetGroupLabel(task)}`,
        `未実施: ${incompleteRows.length}人 / 対象${progress.targetCount}人`,
        '',
        ...incompleteRows.map(item => item.group ? `${item.name}（${item.group}）` : item.name)
    ].join('\n');

    try {
        await navigator.clipboard.writeText(text);
        recordAdminAudit('文章課題 未実施児童名コピー', {
            title: task.title,
            rows: incompleteRows.length,
            target: progress.targetCount
        });
        showCustomAlert('未実施児童名をコピーしました。');
    } catch (error) {
        console.warn('未実施児童名コピーに失敗しました。', error);
        showCustomAlert(`コピーできませんでした。手動で選択してコピーしてください。\n\n${text}`);
    }
}

export function exportVisibleAdminTextTaskProgressCsv() {
    const entries = filterAdminTextTasks(getTextTasks());
    if (entries.length === 0) return showCustomAlert('出力する文章課題がありません。');

    const rows = [[
        'task_title',
        'task_id',
        'target_group',
        'visible_to_students',
        'completed_count',
        'target_count',
        'student_name',
        'user_data_id',
        'group',
        'status',
        'last_completed_at',
        'attempts',
        'best_score',
        'input_chars',
        'misses'
    ]];

    let outputRows = 0;
    entries.forEach(({ task }) => {
        const progress = getTextTaskProgress(task);
        if (progress.rows.length === 0) {
            rows.push([
                task.title || '',
                task.id || '',
                getTextTaskTargetGroupLabel(task),
                task.hidden === true ? 'no' : 'yes',
                progress.completedCount,
                progress.targetCount,
                '',
                '',
                '',
                'no_target_students',
                '',
                '',
                '',
                '',
                ''
            ]);
            outputRows++;
            return;
        }

        progress.rows.forEach(item => {
            rows.push([
                task.title || '',
                task.id || '',
                getTextTaskTargetGroupLabel(task),
                task.hidden === true ? 'no' : 'yes',
                progress.completedCount,
                progress.targetCount,
                item.name,
                item.userId,
                item.group || '',
                item.completed ? 'completed' : 'not_completed',
                item.completed ? item.lastCompletedAt : '',
                item.completed ? item.attempts : '',
                item.completed ? item.score : '',
                item.completed ? item.total : '',
                item.completed ? item.miss : ''
            ]);
            outputRows++;
        });
    });

    downloadTextCsv(`d-lesson_text_tasks_progress_${getBackupDateStamp()}.csv`, rows);
    recordAdminAudit('文章課題 一覧実施状況CSV出力', {
        tasks: entries.length,
        rows: outputRows
    });
}

export function exportVisibleAdminTextTaskIncompleteCsv() {
    const entries = filterAdminTextTasks(getTextTasks());
    if (entries.length === 0) return showCustomAlert('出力する文章課題がありません。');

    const rows = [[
        'task_title',
        'task_id',
        'target_group',
        'visible_to_students',
        'completed_count',
        'target_count',
        'student_name',
        'user_data_id',
        'group',
        'status'
    ]];

    let outputRows = 0;
    entries.forEach(({ task }) => {
        const progress = getTextTaskProgress(task);
        progress.rows
            .filter(item => !item.completed)
            .forEach(item => {
                rows.push([
                    task.title || '',
                    task.id || '',
                    getTextTaskTargetGroupLabel(task),
                    task.hidden === true ? 'no' : 'yes',
                    progress.completedCount,
                    progress.targetCount,
                    item.name,
                    item.userId,
                    item.group || '',
                    'not_completed'
                ]);
                outputRows++;
            });
    });

    if (outputRows === 0) {
        return showCustomAlert('表示中の課題に未実施児童はいません。');
    }

    downloadTextCsv(`d-lesson_text_tasks_incomplete_${getBackupDateStamp()}.csv`, rows);
    recordAdminAudit('文章課題 未実施児童CSV出力', {
        tasks: entries.length,
        rows: outputRows
    });
}

function openTextTaskProgress(id) {
    const task = getTextTasks().find(t => t.id === id);
    if (!task) return showCustomAlert('実施状況を確認する課題が見つかりませんでした。');

    const modal = createTextTaskProgressModal();
    const title = modal.querySelector('#admin-text-task-progress-title');
    const meta = modal.querySelector('#admin-text-task-progress-meta');
    const body = modal.querySelector('#admin-text-task-progress-body');
    const exportButton = modal.querySelector('#admin-text-task-progress-export');
    const incompleteExportButton = modal.querySelector('#admin-text-task-progress-incomplete-export');
    const incompleteCopyButton = modal.querySelector('#admin-text-task-progress-incomplete-copy');
    const filterSelect = modal.querySelector('#admin-text-task-progress-filter');
    const sortSelect = modal.querySelector('#admin-text-task-progress-sort');
    const viewSummary = modal.querySelector('#admin-text-task-progress-view-summary');
    const progress = getTextTaskProgress(task);
    const audience = getTextTaskAudience(task);

    if (title) title.textContent = `${task.title || '無題の課題'} の実施状況`;
    if (meta) {
        meta.innerHTML = '';
        setPreviewBadge(meta, `対象: ${getTextTaskTargetGroupLabel(task)}`, '#e3f2fd', '#1565c0');
        setPreviewBadge(meta, `児童側表示: ${audience.visibleCount}人`, '#e8f5e9', '#2e7d32');
        setPreviewBadge(meta, `実施済み: ${progress.completedCount}/${progress.targetCount}人`, '#fff8e1', '#e65100');
    }
    const renderProgressView = () => renderTextTaskProgressRows(
        body,
        progress,
        filterSelect?.value || 'all',
        sortSelect?.value || 'status-score',
        viewSummary
    );
    if (filterSelect) {
        filterSelect.value = 'all';
        filterSelect.onchange = renderProgressView;
    }
    if (sortSelect) {
        sortSelect.value = 'status-score';
        sortSelect.onchange = renderProgressView;
    }
    renderProgressView();
    if (exportButton) exportButton.onclick = () => exportTextTaskProgressCsv(task);
    if (incompleteExportButton) incompleteExportButton.onclick = () => exportTextTaskIncompleteCsv(task);
    if (incompleteCopyButton) incompleteCopyButton.onclick = () => copyTextTaskIncompleteNames(task);
    modal.style.display = 'flex';
}

export function moveTextTask(idx, dir) {
    const tasks = getTextTasks();
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
    renderTextTaskTemplateOptions();
    const tasks = getTextTasks();
    renderTextTaskGroupOptions();
    renderTextTaskListGroupOptions(tasks);
    renderTextTaskBulkGroupOptions(tasks);
    const filters = getAdminTextTaskFilters();
    const filteredTasks = filterAdminTextTasks(tasks);
    const canMoveInCurrentView = filters.sort === 'manual';
    const summary = document.getElementById('admin-text-task-list-summary');
    if (summary) summary.textContent = `(${filteredTasks.length}/${tasks.length}件)`;
    if (tasks.length === 0) { list.innerHTML = '<li style="color:#999; text-align:center;">まだ課題がありません</li>'; return; }
    if (filteredTasks.length === 0) { list.innerHTML = '<li style="color:#999; text-align:center;">条件に合う課題がありません</li>'; return; }
    filteredTasks.forEach(({ task, index: idx }) => {
        const li = document.createElement('li');
        li.style.display = 'flex'; li.style.justifyContent = 'space-between'; li.style.alignItems = 'center'; li.style.marginBottom = '10px'; li.style.background = '#f9f9f9'; li.style.padding = '10px'; li.style.borderRadius = '5px'; li.style.border = '1px solid #ccc';
        
        let stars = "⭐".repeat(task.star || 3);

        const info = document.createElement('div');
        info.style.flex = '1';
        info.style.minWidth = '0';
        const visibilityLabel = task.hidden === true ? '非表示' : '表示中';
        const visibilityColor = task.hidden === true ? '#78909c' : '#2e7d32';
        const targetGroupLabel = getTextTaskTargetGroupLabel(task);
        const audience = getTextTaskAudience(task);
        const progress = getTextTaskProgress(task);
        const audienceStyle = getTextTaskAudienceBadgeStyle(task, audience);
        const incompleteCount = Math.max(0, progress.targetCount - progress.completedCount);
        const progressPercent = progress.targetCount > 0
            ? Math.round((progress.completedCount / progress.targetCount) * 100)
            : 0;
        const progressLabel = progress.targetCount > 0
            ? `実施率 ${progressPercent}% / 未実施 ${incompleteCount}人`
            : '対象児童なし';
        const progressClass = progress.targetCount === 0
            ? 'empty'
            : progress.completedCount >= progress.targetCount
                ? 'complete'
                : incompleteCount >= Math.ceil(progress.targetCount / 2)
                    ? 'attention'
                    : 'progressing';
        info.innerHTML = `
            <strong>${escapeHtml(task.title)}</strong>
            <span style="font-size:12px; color:#FF9800;">${escapeHtml(stars)}</span>
            <span>(${escapeHtml(task.time)}分)</span><br>
            <span style="display:inline-block; margin:4px 0; padding:2px 8px; border-radius:999px; background:${visibilityColor}; color:#fff; font-size:12px; font-weight:bold;">${visibilityLabel}</span><br>
            <span style="display:inline-block; margin:0 0 4px 0; padding:2px 8px; border-radius:999px; background:#e3f2fd; color:#1565c0; font-size:12px; font-weight:bold;">対象: ${escapeHtml(targetGroupLabel)}</span><br>
            <span style="display:inline-block; margin:0 0 4px 0; padding:2px 8px; border-radius:999px; background:${audienceStyle.bg}; color:${audienceStyle.color}; font-size:12px; font-weight:bold;">児童側表示: ${escapeHtml(audience.visibleCount)}人 / 対象${escapeHtml(audience.targetCount)}人</span><br>
            <span style="display:inline-block; margin:0 0 4px 0; padding:2px 8px; border-radius:999px; background:#ede7f6; color:#4527a0; font-size:12px; font-weight:bold;">実施済み: ${escapeHtml(progress.completedCount)} / ${escapeHtml(progress.targetCount)}人</span><br>
            <span class="admin-text-progress-line ${progressClass}">
                <span class="admin-text-progress-label">${escapeHtml(progressLabel)}</span>
                <span class="admin-text-progress-track"><span style="width:${escapeHtml(progressPercent)}%;"></span></span>
            </span>
            <span style="font-size:12px; color:#666;">${escapeHtml(String(task.content || '').substring(0, 40))}...</span>
        `;
        info.appendChild(createTextTaskTargetGroupSelect(task));

        const controls = document.createElement('div');
        controls.style.display = 'flex';
        controls.style.gap = '5px';
        controls.style.flexWrap = 'wrap';
        controls.style.justifyContent = 'flex-end';
        controls.appendChild(makeTextTaskListButton('▲', 'btn-secondary', () => moveTextTask(idx, -1), {
            disabled: !canMoveInCurrentView || idx === 0,
            title: canMoveInCurrentView ? '' : '並び替えを「手動順」にすると移動できます'
        }));
        controls.appendChild(makeTextTaskListButton('▼', 'btn-secondary', () => moveTextTask(idx, 1), {
            disabled: !canMoveInCurrentView || idx === tasks.length - 1,
            title: canMoveInCurrentView ? '' : '並び替えを「手動順」にすると移動できます'
        }));
        controls.appendChild(makeTextTaskListButton(task.hidden === true ? '表示する' : '非表示', 'btn-secondary', () => toggleTextTaskVisibility(task.id)));
        controls.appendChild(makeTextTaskListButton('確認', 'btn-secondary', () => previewTextTask(task.id)));
        controls.appendChild(makeTextTaskListButton('実施状況', 'btn-secondary', () => openTextTaskProgress(task.id)));
        controls.appendChild(makeTextTaskListButton('複製', 'btn-secondary', () => duplicateTextTask(task.id)));
        controls.appendChild(makeTextTaskListButton('編集', 'btn-primary', () => editTextTask(task.id)));
        controls.appendChild(makeTextTaskListButton('削除', 'btn-danger', () => deleteTextTask(idx, task.title)));
        li.appendChild(info);
        li.appendChild(controls);
        list.appendChild(li);
    });
}

export function deleteTextTask(idx, title) { 
    showCustomConfirm(`本当に課題「${title}」を削除しますか？`, () => {
        getTextTasks().splice(idx, 1);
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
