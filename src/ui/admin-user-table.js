import {
    users,
    saveUsers,
    DEFAULT_CAMPUS_ID,
    GLOBAL_SETTINGS_ID,
    getCampusList,
    getCampusCode,
    getCampusName,
    getUserCampusId,
    getUserAccountType,
    getUserAccountTypeLabel,
    normalizeCampusId,
    getUserDisplayName,
    isSystemUserId,
    USER_ACCOUNT_TYPES,
    userDisplayNameExists,
    invokeLessonFunction
} from '../api/user.js';
import { STAGE_ORDER } from '../data/constants.js';
import { calculateGrade, sortGrades } from '../utils/helpers.js';
import { getStandardRouteStatus, renderStandardRouteCell } from '../utils/standard-route.js';
import { showCustomAlert } from './modal.js';
import { recordAdminAudit } from './admin-audit.js';

function runUserChanged(options) {
    if (typeof options?.onUserChanged === 'function') options.onUserChanged();
}

function updateAdminFilterSelect(select, values, allLabel, currentValue, getLabel = value => value) {
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
        opt.innerText = getLabel(value);
        select.appendChild(opt);
    });

    select.value = values.includes(currentValue) ? currentValue : 'all';
}

function renderAccountTypeBadge(accountType) {
    const label = getUserAccountTypeLabel(accountType);
    const styles = {
        [USER_ACCOUNT_TYPES.CLASSROOM]: 'background:#e0f2fe; color:#075985; border:1px solid #7dd3fc;',
        [USER_ACCOUNT_TYPES.PUBLIC]: 'background:#fff7ed; color:#9a3412; border:1px solid #fdba74;',
        [USER_ACCOUNT_TYPES.GUEST]: 'background:#f1f5f9; color:#475569; border:1px solid #cbd5e1;'
    };
    const style = styles[accountType] || styles[USER_ACCOUNT_TYPES.CLASSROOM];
    return `<span style="display:inline-flex; align-items:center; justify-content:center; min-width:64px; padding:3px 7px; border-radius:999px; font-size:12px; font-weight:800; ${style}">${label}</span>`;
}

function cleanStudentLoginNumber(value) {
    return String(value || '').replace(/\D/g, '');
}

function studentLoginNumberExistsInCampus(loginNumber, campusId, ignoreUserId = '') {
    const cleanNumber = cleanStudentLoginNumber(loginNumber);
    if (!cleanNumber) return false;
    return Object.keys(users).some(userId => {
        if (userId === ignoreUserId || isSystemUserId(userId)) return false;
        const user = users[userId];
        return user
            && cleanStudentLoginNumber(user.loginNumber) === cleanNumber
            && getUserCampusId(user) === campusId;
    });
}

async function moveStudentCampusAuth(userId, campusId) {
    const user = users[userId];
    const studentNumber = cleanStudentLoginNumber(user?.loginNumber);
    if (!user?.authUserId) return null;
    if (!studentNumber) {
        throw new Error('児童番号が登録されていないため、Authの校舎情報を変更できません。');
    }

    return invokeLessonFunction('admin-create-student', {
        userDataId: userId,
        displayName: getUserDisplayName(userId),
        studentNumber,
        authUserId: user.authUserId,
        mode: 'move',
        campusId,
        campusCode: getCampusCode(campusId),
        group: user.group || ''
    });
}

export function updateAdminUserTable(options = {}) {
    const tbody = document.getElementById('admin-user-tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    const headerRow = document.querySelector('#admin-user-table thead tr');
    if (headerRow && !headerRow.querySelector('[data-account-type-header="true"]')) {
        const th = document.createElement('th');
        th.dataset.accountTypeHeader = 'true';
        th.style.cssText = 'padding:8px; border:1px solid #ddd;';
        th.innerText = '種別';
        headerRow.insertBefore(th, headerRow.children[4] || null);
    }
    if (headerRow && !headerRow.querySelector('[data-campus-header="true"]')) {
        const th = document.createElement('th');
        th.dataset.campusHeader = 'true';
        th.style.cssText = 'padding:8px; border:1px solid #ddd;';
        th.innerText = '校舎';
        headerRow.insertBefore(th, headerRow.children[5] || null);
    }
    if (headerRow && !headerRow.querySelector('[data-standard-route-header="true"]')) {
        const th = document.createElement('th');
        th.dataset.standardRouteHeader = 'true';
        th.style.cssText = 'padding:8px; border:1px solid #ddd;';
        th.innerText = '標準ルート';
        headerRow.appendChild(th);
    }

    const searchInput = document.getElementById('admin-user-search');
    const accountTypeFilter = document.getElementById('admin-user-account-type-filter');
    const gradeFilter = document.getElementById('admin-user-grade-filter');
    const campusFilter = document.getElementById('admin-user-campus-filter');
    const groupFilter = document.getElementById('admin-user-group-filter');
    const countLabel = document.getElementById('admin-user-count');
    const searchText = (searchInput?.value || '').trim().toLowerCase();
    const selectedAccountType = accountTypeFilter?.value || USER_ACCOUNT_TYPES.CLASSROOM;
    const selectedGrade = gradeFilter?.value || 'all';
    const selectedCampus = campusFilter?.value || 'all';
    const selectedGroup = groupFilter?.value || 'all';

    let list = Object.keys(users)
        .filter(userId => users[userId] && !users[userId].isMaster && !isSystemUserId(userId))
        .map(userId => {
            const birthdate = users[userId].birthdate || users[userId].birth;
            const grade = (users[userId].grade && String(users[userId].grade) !== 'undefined')
                ? users[userId].grade
                : calculateGrade(birthdate);
            return {
                id: userId,
                name: getUserDisplayName(userId),
                grade,
                accountType: getUserAccountType(userId),
                campusId: getUserCampusId(users[userId]),
                group: users[userId].group || '',
                user: users[userId]
            };
        });

    updateAdminFilterSelect(
        accountTypeFilter,
        [USER_ACCOUNT_TYPES.CLASSROOM, USER_ACCOUNT_TYPES.PUBLIC, USER_ACCOUNT_TYPES.GUEST],
        'すべての種別',
        selectedAccountType,
        getUserAccountTypeLabel
    );
    const grades = sortGrades(Array.from(new Set(list.map(item => item.grade).filter(Boolean))));
    const campusIds = Array.from(new Set([DEFAULT_CAMPUS_ID, ...list.map(item => item.campusId).filter(Boolean)]));
    updateAdminFilterSelect(campusFilter, campusIds, 'すべての校舎', selectedCampus);
    if (campusFilter) {
        Array.from(campusFilter.options).forEach(option => {
            if (option.value !== 'all') option.innerText = getCampusName(option.value);
        });
    }
    const groups = Array.from(new Set(list.map(item => item.group).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'ja'));
    updateAdminFilterSelect(gradeFilter, grades, 'すべての学年', selectedGrade);
    updateAdminFilterSelect(groupFilter, groups, 'すべてのグループ', selectedGroup);

    list = list.filter(item => {
        if (accountTypeFilter && accountTypeFilter.value !== 'all' && item.accountType !== accountTypeFilter.value) return false;
        if (gradeFilter && gradeFilter.value !== 'all' && item.grade !== gradeFilter.value) return false;
        if (campusFilter && campusFilter.value !== 'all' && item.campusId !== campusFilter.value) return false;
        if (groupFilter && groupFilter.value !== 'all' && item.group !== groupFilter.value) return false;
        if (!searchText) return true;
        const haystack = `${item.name} ${item.id} ${getUserAccountTypeLabel(item.accountType)} ${getCampusName(item.campusId)} ${item.group}`.toLowerCase();
        return haystack.includes(searchText);
    });

    list.sort((a, b) => a.name.localeCompare(b.name, 'ja'));
    if (countLabel) countLabel.innerText = `${list.length}件`;

    if (list.length === 0) {
        const tr = document.createElement('tr');
        const td = document.createElement('td');
        td.colSpan = 10;
        td.style.cssText = 'padding:14px; border:1px solid #ddd; color:#777; text-align:center;';
        td.innerText = '条件に合う児童がいません';
        tr.appendChild(td);
        tbody.appendChild(tr);
        return;
    }

    list.forEach(item => {
        const birthdate = item.user.birthdate || item.user.birth;
        const tr = document.createElement('tr');

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
        nameInput.onchange = () => updateUserDisplayName(item.id, nameInput.value, options);
        nameTd.appendChild(nameInput);
        tr.appendChild(nameTd);

        const birthTd = document.createElement('td');
        birthTd.style.cssText = 'padding:5px; border:1px solid #ddd;';
        const birthInput = document.createElement('input');
        birthInput.type = 'date';
        birthInput.value = birthdate || '';
        birthInput.style.cssText = 'width:120px; padding:2px; font-size:12px; border:1px solid #ccc;';
        birthInput.onchange = () => updateUserBirthdate(item.id, birthInput.value, options);
        birthTd.appendChild(birthInput);
        tr.appendChild(birthTd);

        const gradeTd = document.createElement('td');
        gradeTd.style.cssText = 'padding:5px; border:1px solid #ddd;';
        gradeTd.innerText = item.grade;
        tr.appendChild(gradeTd);

        const accountTypeTd = document.createElement('td');
        accountTypeTd.style.cssText = 'padding:5px; border:1px solid #ddd;';
        accountTypeTd.innerHTML = renderAccountTypeBadge(item.accountType);
        tr.appendChild(accountTypeTd);

        const campusTd = document.createElement('td');
        campusTd.style.cssText = 'padding:5px; border:1px solid #ddd;';
        const campusSelect = document.createElement('select');
        campusSelect.style.cssText = 'width:100px; padding:2px; font-size:12px; border:1px solid #ccc;';
        getCampusList().forEach(campus => {
            const opt = document.createElement('option');
            opt.value = campus.id;
            opt.innerText = campus.name;
            campusSelect.appendChild(opt);
        });
        campusSelect.value = item.campusId || DEFAULT_CAMPUS_ID;
        campusSelect.onchange = async () => {
            campusSelect.disabled = true;
            await updateUserCampus(item.id, campusSelect.value, options);
        };
        campusTd.appendChild(campusSelect);
        if (
            item.accountType === USER_ACCOUNT_TYPES.CLASSROOM
            && item.user.authUserId
            && item.user.loginNumber
        ) {
            const syncButton = document.createElement('button');
            syncButton.type = 'button';
            syncButton.innerText = 'Auth同期';
            syncButton.title = '児童番号ログインの校舎情報を、現在の校舎に合わせます';
            syncButton.style.cssText = 'display:block; width:100px; margin-top:4px; padding:3px 5px; border:1px solid #0f766e; background:#f0fdfa; color:#115e59; font-size:11px; font-weight:bold; cursor:pointer;';
            syncButton.onclick = async () => {
                syncButton.disabled = true;
                await syncUserCampusAuth(item.id, options);
            };
            campusTd.appendChild(syncButton);
        }
        tr.appendChild(campusTd);

        const groupTd = document.createElement('td');
        groupTd.style.cssText = 'padding:5px; border:1px solid #ddd;';
        const groupInput = document.createElement('input');
        groupInput.type = 'text';
        groupInput.value = item.user.group || '';
        groupInput.style.cssText = 'width:80px; padding:2px; font-size:12px; border:1px solid #ccc;';
        groupInput.onchange = () => updateUserGroup(item.id, groupInput.value, options);
        groupTd.appendChild(groupInput);
        tr.appendChild(groupTd);

        const mouseTd = document.createElement('td');
        mouseTd.style.cssText = 'padding:5px; border:1px solid #ddd;';
        mouseTd.innerText = `Lv.${Number(item.user.mouseLevel || 0)}`;
        tr.appendChild(mouseTd);

        const keyboardTd = document.createElement('td');
        keyboardTd.style.cssText = 'padding:5px; border:1px solid #ddd;';
        keyboardTd.innerText = `${item.user.keyboardSequence || 0}/${STAGE_ORDER.length}`;
        tr.appendChild(keyboardTd);

        const routeTd = document.createElement('td');
        routeTd.style.cssText = 'padding:5px; border:1px solid #ddd; min-width:150px;';
        routeTd.innerHTML = renderStandardRouteCell(getStandardRouteStatus(item.user, users[GLOBAL_SETTINGS_ID] || {}));
        tr.appendChild(routeTd);

        tbody.appendChild(tr);
    });
}

export function clearAdminUserFilters(options = {}) {
    const searchInput = document.getElementById('admin-user-search');
    const accountTypeFilter = document.getElementById('admin-user-account-type-filter');
    const gradeFilter = document.getElementById('admin-user-grade-filter');
    const campusFilter = document.getElementById('admin-user-campus-filter');
    const groupFilter = document.getElementById('admin-user-group-filter');
    if (searchInput) searchInput.value = '';
    if (accountTypeFilter) accountTypeFilter.value = USER_ACCOUNT_TYPES.CLASSROOM;
    if (gradeFilter) gradeFilter.value = 'all';
    if (campusFilter) campusFilter.value = 'all';
    if (groupFilter) groupFilter.value = 'all';
    updateAdminUserTable(options);
}

export function updateUserDisplayName(userId, newName, options = {}) {
    const displayName = newName.trim();
    if (!users[userId]) return;
    if (!displayName) {
        showCustomAlert('名前を入力してください');
        updateAdminUserTable(options);
        return;
    }
    if (userDisplayNameExists(displayName, userId)) {
        showCustomAlert('その名前はすでに登録されています');
        updateAdminUserTable(options);
        return;
    }

    const oldName = getUserDisplayName(userId);
    users[userId].displayName = displayName;
    recordAdminAudit('表示名変更', {
        userDataId: userId,
        before: oldName,
        after: displayName
    });
    saveUsers(true);
    updateAdminUserTable(options);
    runUserChanged(options);
}

export function updateUserBirthdate(userId, newBirthdate, options = {}) {
    if (!users[userId]) return;
    if (!newBirthdate) {
        showCustomAlert('生年月日を入力してください');
        updateAdminUserTable(options);
        return;
    }

    const oldBirthdate = users[userId].birthdate || users[userId].birth || '';
    users[userId].birthdate = newBirthdate;
    users[userId].grade = calculateGrade(newBirthdate);
    recordAdminAudit('生年月日変更', {
        user: getUserDisplayName(userId),
        userDataId: userId,
        before: oldBirthdate,
        after: newBirthdate
    });
    saveUsers(true);
    updateAdminUserTable(options);
    runUserChanged(options);
}

export async function updateUserCampus(userId, newCampusId, options = {}) {
    if (!users[userId]) return false;

    const oldCampusId = getUserCampusId(users[userId]);
    const campusId = normalizeCampusId(newCampusId);
    if (oldCampusId === campusId) {
        updateAdminUserTable(options);
        return true;
    }

    const user = users[userId];
    const loginNumber = cleanStudentLoginNumber(user.loginNumber);
    if (loginNumber && studentLoginNumberExistsInCampus(loginNumber, campusId, userId)) {
        showCustomAlert(`${getCampusName(campusId)}には、児童番号 ${loginNumber} がすでに登録されています。`);
        updateAdminUserTable(options);
        return false;
    }

    let authMoved = false;
    try {
        if (getUserAccountType(userId) === USER_ACCOUNT_TYPES.CLASSROOM && user.authUserId) {
            await moveStudentCampusAuth(userId, campusId);
            authMoved = true;
        }

        user.campusId = campusId;
        const saved = await saveUsers(true);
        if (!saved) throw new Error('児童データを保存できませんでした。');
    } catch (error) {
        user.campusId = oldCampusId;
        if (authMoved) {
            try {
                await moveStudentCampusAuth(userId, oldCampusId);
            } catch (rollbackError) {
                console.error('Auth校舎変更の巻き戻しに失敗しました:', rollbackError);
            }
        }
        console.error('校舎変更に失敗しました:', error);
        showCustomAlert(`校舎を変更できませんでした。\n${error.message || error}`);
        updateAdminUserTable(options);
        return false;
    }

    recordAdminAudit('campus_changed', {
        user: getUserDisplayName(userId),
        userDataId: userId,
        before: oldCampusId,
        after: campusId,
        authSynced: authMoved
    });
    updateAdminUserTable(options);
    runUserChanged(options);
    return true;
}

export async function syncUserCampusAuth(userId, options = {}) {
    const user = users[userId];
    if (!user) return false;

    const campusId = getUserCampusId(user);
    const loginNumber = cleanStudentLoginNumber(user.loginNumber);
    if (!user.authUserId || !loginNumber) {
        showCustomAlert('Auth User IDと児童番号の両方が必要です。');
        updateAdminUserTable(options);
        return false;
    }
    if (studentLoginNumberExistsInCampus(loginNumber, campusId, userId)) {
        showCustomAlert(`${getCampusName(campusId)}には、児童番号 ${loginNumber} が重複しています。`);
        updateAdminUserTable(options);
        return false;
    }

    try {
        await moveStudentCampusAuth(userId, campusId);
        recordAdminAudit('campus_auth_synced', {
            user: getUserDisplayName(userId),
            userDataId: userId,
            campusId,
            loginNumber
        });
        showCustomAlert(`${getUserDisplayName(userId)} さんのAuth校舎情報を同期しました。`);
        updateAdminUserTable(options);
        return true;
    } catch (error) {
        console.error('Auth校舎同期に失敗しました:', error);
        showCustomAlert(`Auth校舎情報を同期できませんでした。\n${error.message || error}`);
        updateAdminUserTable(options);
        return false;
    }
}

export function updateUserGroup(userId, newGroup, options = {}) {
    if (!users[userId]) return;

    const oldGroup = users[userId].group || '';
    users[userId].group = newGroup.trim();
    recordAdminAudit('グループ変更', {
        user: getUserDisplayName(userId),
        userDataId: userId,
        before: oldGroup,
        after: users[userId].group
    });
    saveUsers(true);
    updateAdminUserTable(options);
    runUserChanged(options);
}
