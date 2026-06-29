import {
    users,
    saveUsers,
    REQUIRE_SUPABASE_AUTH,
    GLOBAL_SETTINGS_ID,
    DEFAULT_CAMPUS_ID,
    createUserDataId,
    supabase,
    refreshCurrentLessonAccess,
    getCampusList,
    getCampusCode,
    getCampusName,
    getUserCampusId,
    normalizeCampusId,
    getUserDisplayName,
    isSystemUserId,
    deleteCloudStudentAccount,
    deleteCloudUserRows,
    userDisplayNameExists
} from '../api/user.js';
import { calculateGrade } from '../utils/helpers.js';
import { escapeCsvCell, getBackupDateStamp } from '../utils/export-format.js';
import { showCustomAlert, showCustomConfirm } from './modal.js';
import { recordAdminAudit } from './admin-audit.js';
import {
    openBlankStudentLoginCardPrintWindow,
    openStudentLoginCardsPrintWindow
} from './student-login-cards.js';

function runAfterChange(afterChange) {
    if (typeof afterChange === 'function') afterChange();
}

function createStudentRecord(name, birthdate, group, campusId = DEFAULT_CAMPUS_ID) {
    const grade = calculateGrade(birthdate);
    let userDataId = createUserDataId();
    while (users[userDataId]) userDataId = createUserDataId();

    users[userDataId] = {
        displayName: name,
        userDataId,
        birthdate,
        grade,
        campusId: normalizeCampusId(campusId),
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

function getNumericInputValue(id) {
    return String(document.getElementById(id)?.value || '').replace(/\D/g, '');
}

function studentLoginNumberExists(loginNumber, campusId, ignoreUserId = null) {
    if (!loginNumber) return false;
    return Object.keys(users).some(userId => {
        if (userId === ignoreUserId || isSystemUserId(userId)) return false;
        const user = users[userId];
        return user
            && String(user.loginNumber || '').replace(/\D/g, '') === loginNumber
            && getUserCampusId(user) === campusId;
    });
}

async function createAdminStudentAuthAccount(userDataId, studentNumber, passcode) {
    if (!REQUIRE_SUPABASE_AUTH || !supabase) {
        throw new Error('Supabase Auth設定が有効な環境で使用してください。');
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

    user.loginNumber = studentNumber;
    user.authUserId = data.authUserId;
    await refreshCurrentLessonAccess();
    return data;
}

function getCampusInputValue(id) {
    return normalizeCampusId(document.getElementById(id)?.value || DEFAULT_CAMPUS_ID);
}

export function renderCampusAdmin() {
    const campusList = getCampusList();
    let addCampusSelect = document.getElementById('admin-add-campus');
    if (!addCampusSelect) {
        const groupInput = document.getElementById('admin-add-group');
        if (groupInput?.parentElement) {
            addCampusSelect = document.createElement('select');
            addCampusSelect.id = 'admin-add-campus';
            addCampusSelect.title = '校舎';
            addCampusSelect.style.cssText = 'margin:0; width:130px; padding:8px; font-size:16px; border:1px solid #ccc; border-radius:6px;';
            groupInput.parentElement.insertBefore(addCampusSelect, groupInput);
        }
    }

    if (!document.getElementById('admin-campus-list')) {
        const addNameInput = document.getElementById('admin-add-name');
        const addCard = addNameInput?.closest('div[style]');
        const parent = addCard?.parentElement;
        if (parent && addCard) {
            const campusCard = document.createElement('div');
            campusCard.id = 'admin-campus-card';
            campusCard.style.cssText = 'display:flex; flex-direction:column; gap:10px; background:#eefaf7; padding:15px; border-radius:8px; border:1px solid #80cbc4;';
            campusCard.innerHTML = `
                <span style="font-weight:bold; color:#00695c;">校舎の管理</span>
                <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap;">
                    <input type="text" id="admin-campus-name" placeholder="校舎名 例: 若松校" style="margin:0; flex:1; min-width:140px; padding:8px; font-size:14px;">
                    <input type="text" id="admin-campus-code" placeholder="コード 例: wakamatsu" style="margin:0; width:150px; padding:8px; font-size:14px;">
                    <button type="button" class="btn-primary" onclick="adminAddCampus()" style="font-size:14px; padding:8px 12px;">校舎追加</button>
                </div>
                <div id="admin-campus-list" style="display:flex; flex-direction:column; gap:6px;"></div>
            `;
            parent.insertBefore(campusCard, addCard.nextSibling);
        }
    }

    const campusFilter = document.getElementById('admin-user-campus-filter');
    if (!campusFilter) {
        const groupFilter = document.getElementById('admin-user-group-filter');
        if (groupFilter?.parentElement) {
            const select = document.createElement('select');
            select.id = 'admin-user-campus-filter';
            select.onchange = () => {
                if (typeof window.updateAdminUserTable === 'function') window.updateAdminUserTable();
            };
            select.style.cssText = 'min-width:130px; padding:8px; font-size:14px; border:1px solid #ccc; border-radius:6px; margin:0;';
            groupFilter.parentElement.insertBefore(select, groupFilter);
        }
    }

    const scopeTypeSelect = document.getElementById('auth-teacher-scope-type');
    if (scopeTypeSelect && !scopeTypeSelect.querySelector('option[value="campus"]')) {
        const opt = document.createElement('option');
        opt.value = 'campus';
        opt.innerText = '校舎指定';
        scopeTypeSelect.appendChild(opt);
    }

    const listEl = document.getElementById('admin-campus-list');

    if (addCampusSelect) {
        const current = addCampusSelect.value || DEFAULT_CAMPUS_ID;
        addCampusSelect.innerHTML = '';
        campusList.forEach(campus => {
            const opt = document.createElement('option');
            opt.value = campus.id;
            opt.innerText = campus.name;
            addCampusSelect.appendChild(opt);
        });
        addCampusSelect.value = campusList.some(campus => campus.id === current) ? current : DEFAULT_CAMPUS_ID;
    }

    if (!listEl) return;
    listEl.innerHTML = '';
    campusList.forEach(campus => {
        const row = document.createElement('div');
        row.style.cssText = 'display:flex; align-items:center; justify-content:space-between; gap:8px; padding:6px 8px; border:1px solid #d8e5e3; border-radius:6px; background:#fff;';
        const label = document.createElement('span');
        label.innerText = `${campus.name} / ${campus.id}`;
        label.style.cssText = 'font-size:13px; color:#234; font-weight:700;';
        row.appendChild(label);

        if (campus.id !== DEFAULT_CAMPUS_ID) {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'btn-secondary';
            btn.innerText = '削除';
            btn.style.cssText = 'font-size:12px; padding:4px 8px;';
            btn.onclick = () => adminDeleteCampus(campus.id);
            row.appendChild(btn);
        }
        listEl.appendChild(row);
    });
}

export function adminAddCampus(afterChange) {
    const nameInput = document.getElementById('admin-campus-name');
    const codeInput = document.getElementById('admin-campus-code');
    const name = String(nameInput?.value || '').trim();
    const code = String(codeInput?.value || '').trim();
    if (!name) return showCustomAlert('校舎名を入力してください。');

    const id = normalizeCampusId(code || name);
    const campuses = getCampusList();
    if (campuses.some(campus => campus.id === id || campus.name === name)) {
        showCustomAlert('同じ校舎がすでに登録されています。');
        return;
    }

    users[GLOBAL_SETTINGS_ID].campuses = [...campuses, { id, name, code: code || id }];
    recordAdminAudit('campus_added', { id, name, code: code || id });
    saveUsers(true);
    if (nameInput) nameInput.value = '';
    if (codeInput) codeInput.value = '';
    renderCampusAdmin();
    runAfterChange(afterChange);
}

export function adminDeleteCampus(campusId, afterChange) {
    const id = normalizeCampusId(campusId);
    if (id === DEFAULT_CAMPUS_ID) return;
    const used = Object.keys(users).some(userId => (
        users[userId]
        && !users[userId].isMaster
        && !isSystemUserId(userId)
        && getUserCampusId(users[userId]) === id
    ));
    if (used) {
        showCustomAlert('この校舎に所属している児童がいるため削除できません。先に児童の校舎を変更してください。');
        return;
    }
    users[GLOBAL_SETTINGS_ID].campuses = getCampusList().filter(campus => campus.id !== id);
    recordAdminAudit('campus_deleted', { id });
    saveUsers(true);
    renderCampusAdmin();
    runAfterChange(afterChange);
}

export async function adminAddUser(afterChange) {
    const name = document.getElementById('admin-add-name').value.trim();
    const birthdate = document.getElementById('admin-add-birth').value;
    const campusId = getCampusInputValue('admin-add-campus');
    const group = document.getElementById('admin-add-group').value.trim();
    const loginNumber = getNumericInputValue('admin-add-login-number');
    const passcode = getNumericInputValue('admin-add-passcode');
    const shouldCreateAuth = Boolean(loginNumber || passcode);
    let loginCardPopup = null;

    if (!name) return showCustomAlert('名前を入力してください');
    if (userDisplayNameExists(name)) return showCustomAlert('その名前はすでに登録されています');
    if (!birthdate) return showCustomAlert('生年月日を入力してください');
    if (shouldCreateAuth && !loginNumber) return showCustomAlert('Auth作成する場合は児童番号を入力してください');
    if (shouldCreateAuth && passcode.length < 6) return showCustomAlert('Auth作成する場合は、あいことばを6けた以上の数字で入力してください');
    if (shouldCreateAuth && studentLoginNumberExists(loginNumber, campusId)) {
        return showCustomAlert('同じ校舎で同じ児童番号がすでに使われています。');
    }
    if (shouldCreateAuth) {
        loginCardPopup = openBlankStudentLoginCardPrintWindow();
        if (!loginCardPopup) {
            return showCustomAlert('ログインカードを開けませんでした。ブラウザのポップアップ許可を確認してから、もう一度追加してください。');
        }
    }

    const userDataId = createStudentRecord(name, birthdate, group, campusId);
    recordAdminAudit('児童追加', {
        user: name,
        userDataId,
        birthdate,
        campusId,
        group
    });
    const saved = await saveUsers(true);
    if (!saved) {
        if (loginCardPopup) loginCardPopup.close();
        delete users[userDataId];
        runAfterChange(afterChange);
        return showCustomAlert('児童データの保存に失敗しました。通信状態または権限を確認してください。');
    }

    if (shouldCreateAuth) {
        try {
            const authData = await createAdminStudentAuthAccount(userDataId, loginNumber, passcode);
            await saveUsers(true);
            recordAdminAudit('auth_student_created', {
                user: name,
                userDataId,
                authUserId: authData.authUserId,
                email: authData.email,
                loginNumber
            });
            openStudentLoginCardsPrintWindow([{
                student_number: loginNumber,
                display_name: name,
                password: passcode
            }], {
                title: 'Dレッスン ログインカード',
                cardsPerPage: 6
            }, loginCardPopup);
            const loginInput = document.getElementById('admin-add-login-number');
            const passcodeInput = document.getElementById('admin-add-passcode');
            if (loginInput) loginInput.value = '';
            if (passcodeInput) passcodeInput.value = '';
        } catch (error) {
            console.error('Admin add student auth failed:', error);
            if (loginCardPopup) loginCardPopup.close();
            runAfterChange(afterChange);
            showCustomAlert(`児童データは追加されましたが、Auth作成に失敗しました。\n${error.message}`);
            return;
        }
    }

    document.getElementById('admin-add-name').value = '';
    document.getElementById('admin-add-birth').value = '';
    document.getElementById('admin-add-group').value = '';
    runAfterChange(afterChange);
    showCustomAlert(shouldCreateAuth
        ? `${name} さんを追加し、Authアカウントを作成しました！\n児童番号: ${loginNumber}`
        : `${name} さんを追加しました！`);
}

export function adminBulkAddUsers(afterChange) {
    const textarea = document.getElementById('admin-bulk-names');
    const text = textarea?.value || '';
    if (!text.trim()) return showCustomAlert('入力してください');

    let added = 0;
    text.split('\n').forEach(line => {
        if (!line.trim()) return;
        const parts = line.split(/[,、\s]+/);
        const name = parts[0].trim();
        const birthdate = parts.length > 1 ? parts[1].trim() : '2015-04-01';
        const selectedCampusId = getCampusInputValue('admin-add-campus');
        const campusId = parts.length > 3 ? normalizeCampusId(parts[2]) : selectedCampusId;
        const group = parts.length > 3 ? parts[3].trim() : (parts.length > 2 ? parts[2].trim() : '');
        if (name && !userDisplayNameExists(name)) {
            createStudentRecord(name, birthdate, group, campusId);
            added++;
        }
    });

    recordAdminAudit('児童一括追加', { count: added });
    saveUsers(true);
    runAfterChange(afterChange);
    if (textarea) textarea.value = '';
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
    if (['campus', 'campusid', 'campus_id', 'school', 'school_id', '校舎'].includes(value)) return 'campusId';
    return value;
}

export function exportStudentCsv() {
    const rows = [['user_data_id', 'name', 'birthdate', 'campus_id', 'campus_name', 'group']];
    Object.keys(users)
        .filter(userDataId => users[userDataId] && !users[userDataId].isMaster && !isSystemUserId(userDataId))
        .sort((a, b) => getUserDisplayName(a).localeCompare(getUserDisplayName(b), 'ja'))
        .forEach(userDataId => {
            const user = users[userDataId];
            rows.push([
                userDataId,
                getUserDisplayName(userDataId),
                user.birthdate || user.birth || '',
                getUserCampusId(user),
                getCampusName(getUserCampusId(user)),
                user.group || ''
            ]);
        });

    const csv = rows.map(row => row.map(escapeCsvCell).join(',')).join('\r\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `d-lesson_students_${getBackupDateStamp()}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);

    recordAdminAudit('児童CSV出力', { students: rows.length - 1 });
}

export function applyStudentCsvUpdates(afterChange) {
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
        headers.forEach((header, index) => {
            row[header] = cells[index] ?? '';
        });

        const userDataId = row.userDataId;
        if (!userDataId || !users[userDataId] || isSystemUserId(userDataId)) {
            skipped++;
            continue;
        }

        const user = users[userDataId];
        let changed = false;
        const before = {
            displayName: getUserDisplayName(userDataId),
            birthdate: user.birthdate || user.birth || '',
            campusId: getUserCampusId(user),
            group: user.group || ''
        };

        if (Object.prototype.hasOwnProperty.call(row, 'displayName')) {
            const displayName = row.displayName.trim();
            if (displayName && displayName !== before.displayName) {
                if (userDisplayNameExists(displayName, userDataId)) {
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

        if (Object.prototype.hasOwnProperty.call(row, 'campusId')) {
            const campusId = normalizeCampusId(row.campusId);
            if (campusId !== before.campusId) {
                user.campusId = campusId;
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
        runAfterChange(afterChange);
    }

    const duplicateText = duplicateNames.length
        ? `\n重複名のため反映しなかった名前: ${duplicateNames.join(', ')}`
        : '';
    showCustomAlert(`CSV反映が完了しました。\n更新: ${updated}件\nスキップ: ${skipped}件${duplicateText}`);
}

export function adminDeleteUser(userDataId, afterChange) {
    if (!userDataId) return;

    showCustomConfirm(`${getUserDisplayName(userDataId)}さんを削除しますか？`, async () => {
        const displayName = getUserDisplayName(userDataId);
        try {
            const deletedByAdminFunction = await deleteCloudStudentAccount(userDataId);
            if (!deletedByAdminFunction) await deleteCloudUserRows(userDataId);
            delete users[userDataId];
            const saved = await saveUsers(true);
            if (!saved) throw new Error('Failed to persist deletion');
            recordAdminAudit('児童削除', { user: displayName, userDataId });
            runAfterChange(afterChange);
            showCustomAlert(`${displayName} さんを削除しました。`);
        } catch (error) {
            console.error('Delete user failed:', error);
            showCustomAlert('削除に失敗しました。データは変更されていません。');
        }
    });
}

export function adminAddCoins(userDataId, afterChange) {
    if (!userDataId || !users[userDataId]) {
        showCustomAlert('ユーザーを選択してください');
        return;
    }

    const amount = parseInt(document.getElementById('admin-custom-coin-amount').value, 10);
    if (Number.isNaN(amount) || amount <= 0) {
        showCustomAlert('正しいコイン数を入力してください');
        return;
    }

    users[userDataId].coins = (users[userDataId].coins || 0) + amount;
    recordAdminAudit('コイン付与', {
        user: getUserDisplayName(userDataId),
        userDataId,
        amount,
        coins: users[userDataId].coins
    });
    saveUsers(true);
    runAfterChange(afterChange);
    showCustomAlert(`${getUserDisplayName(userDataId)} さんに ${amount} コインを付与しました！\n（現在のコイン: ${users[userDataId].coins}枚）`);
}
