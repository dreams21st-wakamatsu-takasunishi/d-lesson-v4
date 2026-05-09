import {
    users,
    saveUsers,
    hasLessonRole,
    refreshCurrentLessonAccess,
    GLOBAL_SETTINGS_ID,
    createUserDataId,
    getUserDisplayName,
    isSystemUserId,
    deleteCloudUserRows,
    userDisplayNameExists
} from '../api/user.js';
import { STAGE_ORDER } from '../data/constants.js';
import { showCustomAlert, showCustomConfirm } from './modal.js';
import { showScreen } from './screen.js';
import { calculateGrade, sortGrades } from '../utils/helpers.js';
import { escapeCsvCell, getBackupDateStamp } from '../utils/export-format.js';
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
import {
    saveStudentIdleLogoutSetting as saveStudentIdleLogoutSettingImpl,
    renderOpsGuideAdmin as renderOpsGuideAdminImpl,
    copyInternalIdCheckGuide as copyInternalIdCheckGuideImpl,
    copyDeviceHandoffChecklist as copyDeviceHandoffChecklistImpl,
    copyLessonSettingsCheckGuide as copyLessonSettingsCheckGuideImpl
} from './admin-ops-guide.js';
import {
    linkRoleAuthUser as linkRoleAuthUserImpl,
    linkStudentAuthUser as linkStudentAuthUserImpl,
    copyStudentAccessSql as copyStudentAccessSqlImpl,
    copyRoleAccessSql as copyRoleAccessSqlImpl,
    renderAuthAccessOverview as renderAuthAccessOverviewImpl,
    renderAuthLinkingAdmin as renderAuthLinkingAdminImpl
} from './admin-auth-linking.js';
import {
    resetUserProgress as resetUserProgressImpl,
    forceUserProgress as forceUserProgressImpl,
    openEditProgress as openEditProgressImpl,
    closeEditProgress as closeEditProgressImpl,
    saveEditProgress as saveEditProgressImpl
} from './admin-progress-editor.js';

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

export async function saveStudentIdleLogoutSetting() {
    await saveStudentIdleLogoutSettingImpl();
}

export function renderOpsGuideAdmin() {
    renderOpsGuideAdminImpl();
}

export function copyInternalIdCheckGuide() {
    copyInternalIdCheckGuideImpl();
}

export function copyDeviceHandoffChecklist() {
    copyDeviceHandoffChecklistImpl();
}

export function copyLessonSettingsCheckGuide() {
    copyLessonSettingsCheckGuideImpl();
}

export function getSelUser() { const r = document.querySelector('input[name="asel"]:checked'); return r ? r.value : null; }

function refreshAdminStudentViews() {
    updateAdminUserTable();
    renderDashboardTable();
}

export function adminResetUser() {
    resetUserProgressImpl(getSelUser(), refreshAdminStudentViews);
}

export function adminForceProgress() {
    forceUserProgressImpl(getSelUser(), refreshAdminStudentViews);
}

export function openEditProgress() {
    openEditProgressImpl(getSelUser());
}

export function closeEditProgress() {
    closeEditProgressImpl();
}

export function saveEditProgress() {
    saveEditProgressImpl(refreshAdminStudentViews);
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

export async function linkRoleAuthUser(role) {
    await linkRoleAuthUserImpl(role);
}

export async function linkStudentAuthUser(userDataId, inputId) {
    await linkStudentAuthUserImpl(userDataId, inputId);
}

export function copyStudentAccessSql(userDataId, inputId) {
    copyStudentAccessSqlImpl(userDataId, inputId);
}

export function copyRoleAccessSql(role) {
    copyRoleAccessSqlImpl(role);
}

export async function renderAuthAccessOverview() {
    await renderAuthAccessOverviewImpl();
}

export async function renderAuthLinkingAdmin() {
    await renderAuthLinkingAdminImpl();
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
