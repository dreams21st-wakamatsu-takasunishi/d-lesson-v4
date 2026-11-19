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
    getRegistrationCampuses,
    addCampusRegistryEntry,
    deleteCampusRegistryEntry,
    saveManagedUserRows,
    reloadManagedStudent,
    patchStudentFields,
    getUserCampusId,
    getUserAccountType,
    normalizeCampusId,
    getUserDisplayName,
    isSystemUserId,
    USER_ACCOUNT_TYPES,
    invokeLessonFunction,
    deleteCloudStudentAccount,
    deleteCloudUserRows,
    userDisplayNameExists
} from '../api/user.js';
import { calculateGrade } from '../utils/helpers.js';
import { escapeCsvCell, getBackupDateStamp } from '../utils/export-format.js';
import { showCustomAlert, showCustomConfirm } from './modal.js';
import { recordAdminAudit } from './admin-audit.js';
import { openStudentLoginCardsPrintWindow } from './student-login-cards.js';
import { nextStudentNumber } from '../utils/student-management.js';

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

function generatePasscode(length = 6) {
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

async function createAdminStudentAuthAccount(userDataId, studentNumber, passcode, mode = 'create') {
    if (!REQUIRE_SUPABASE_AUTH || !supabase) {
        throw new Error('Supabase Auth設定が有効な環境で使用してください。');
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

    user.loginNumber = studentNumber;
    user.authUserId = data.authUserId;
    user.authPasscodeIssuedAt = new Date().toISOString();
    await refreshCurrentLessonAccess();
    await reloadManagedStudent(userDataId);
    return data;
}

function getCampusInputValue(id) {
    return normalizeCampusId(document.getElementById(id)?.value || DEFAULT_CAMPUS_ID);
}

export function renderCampusAdmin() {
    for (const id of ['admin-campus-card', 'admin-user-campus-filter']) {
        const element = document.getElementById(id);
        if (element) { element.hidden = true; element.style.display = 'none'; }
    }
}

export async function adminAddCampus(afterChange) {
    showCustomAlert('児童の登録・合言葉・削除と復元は、Dサポートの「Dレッスン管理 → 児童・ログイン管理」で行ってください。学習履歴は保持されます。');
    return false;
}

export async function adminDeleteCampus(campusId, afterChange) {
    showCustomAlert('児童の登録・合言葉・削除と復元は、Dサポートの「Dレッスン管理 → 児童・ログイン管理」で行ってください。学習履歴は保持されます。');
    return false;
}

export async function adminAddUser(afterChange) {
    showCustomAlert('児童の登録・合言葉・削除と復元は、Dサポートの「Dレッスン管理 → 児童・ログイン管理」で行ってください。学習履歴は保持されます。');
    return false;
}

export async function adminCreateExistingStudentAuth(userDataId, afterChange) {
    showCustomAlert('児童の登録・合言葉・削除と復元は、Dサポートの「Dレッスン管理 → 児童・ログイン管理」で行ってください。学習履歴は保持されます。');
    return false;
}

export async function adminResetStudentPasscode(userDataId, afterChange) {
    showCustomAlert('児童の登録・合言葉・削除と復元は、Dサポートの「Dレッスン管理 → 児童・ログイン管理」で行ってください。学習履歴は保持されます。');
    return false;
}

export async function adminBulkAddUsers(afterChange) {
    showCustomAlert('児童の登録・合言葉・削除と復元は、Dサポートの「Dレッスン管理 → 児童・ログイン管理」で行ってください。学習履歴は保持されます。');
    return false;
}

function parseCsvLine(line) {
    const cells = []; let cell = ''; let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
        const ch = line[i], next = line[i + 1];
        if (ch === '"' && inQuotes && next === '"') { cell += '"'; i++; }
        else if (ch === '"') inQuotes = !inQuotes;
        else if (ch === ',' && !inQuotes) { cells.push(cell.trim()); cell = ''; }
        else cell += ch;
    }
    cells.push(cell.trim()); return cells;
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

export async function applyStudentCsvUpdates(afterChange) {
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

        const user = structuredClone(users[userDataId]);
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
                skipped++;
                continue; // Campus/Auth moves require the explicit managed move flow.
            }
        }

        if (Object.prototype.hasOwnProperty.call(row, 'group')) {
            const group = row.group.trim();
            if (group !== before.group) {
                user.group = group;
                changed = true;
            }
        }

        if (changed) {
            const patch = {};
            for (const key of ['displayName','birthdate','grade','group']) if (user[key] !== users[userDataId][key] && user[key] !== undefined) patch[key] = user[key];
            try { await patchStudentFields(userDataId, patch); updated++; }
            catch (error) { runAfterChange(afterChange); return showCustomAlert(`途中で保存を停止しました（保存済み${updated}件）。入力内容は残しています。\n${error.message}`); }
        }
    }

    if (updated > 0) {
        recordAdminAudit('児童CSV一括更新', { updated, skipped });
        runAfterChange(afterChange);
    }

    const duplicateText = duplicateNames.length
        ? `\n重複名のため反映しなかった名前: ${duplicateNames.join(', ')}`
        : '';
    showCustomAlert(`CSV反映が完了しました。\n更新: ${updated}件\nスキップ: ${skipped}件${duplicateText}`);
}

export function adminDeleteUser(userDataId, afterChange) {
    showCustomAlert('児童の登録・合言葉・削除と復元は、Dサポートの「Dレッスン管理 → 児童・ログイン管理」で行ってください。学習履歴は保持されます。');
    return false;
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
