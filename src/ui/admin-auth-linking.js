import {
    users,
    saveUsers,
    refreshCurrentLessonAccess,
    REQUIRE_SUPABASE_AUTH,
    supabase,
    getCampusCode,
    getUserCampusId,
    getUserDisplayName,
    isSystemUserId
} from '../api/user.js';
import { showCustomAlert, showCustomConfirm } from './modal.js';
import { recordAdminAudit } from './admin-audit.js';
import { openStudentLoginCardsPrintWindow } from './student-login-cards.js';
import {
    buildAccessSql,
    getRoleAccessDataId,
    isMissingLessonScopeColumnError,
    isUuid,
    normalizeAccessScope,
    normalizeTeacherScope
} from './admin-auth-utils.js';

function getTeacherScopeFormValues() {
    const scopeType = document.getElementById('auth-teacher-scope-type')?.value || 'all';
    const scopeValue = document.getElementById('auth-teacher-scope-value')?.value || '';
    return normalizeTeacherScope(scopeType, scopeValue);
}

function ensureAuthLinkingReady() {
    if (!REQUIRE_SUPABASE_AUTH || !supabase) {
        showCustomAlert('Supabase Auth設定が有効な環境で使用してください。');
        return false;
    }
    return true;
}

async function upsertLessonUserAccess(authUserId, userDataId, role, scope = {}) {
    const nextScope = normalizeAccessScope(role, scope);

    const basePayload = {
        auth_user_id: authUserId,
        user_data_id: userDataId,
        role
    };
    const scopedPayload = {
        ...basePayload,
        ...nextScope
    };

    const { error } = await supabase
        .from('lesson_user_access')
        .upsert(scopedPayload, { onConflict: 'auth_user_id,user_data_id' });

    if (error && isMissingLessonScopeColumnError(error)) {
        const fallback = await supabase
            .from('lesson_user_access')
            .upsert(basePayload, { onConflict: 'auth_user_id,user_data_id' });
        return fallback.error;
    }

    return error;
}

export async function linkRoleAuthUser(role) {
    if (!ensureAuthLinkingReady()) return;
    const inputId = role === 'admin' ? 'auth-admin-user-id' : 'auth-teacher-user-id';
    const authUserId = document.getElementById(inputId)?.value?.trim();
    const userDataId = getRoleAccessDataId(role);
    const label = role === 'admin' ? '管理者' : '先生';

    if (!isUuid(authUserId)) {
        showCustomAlert(`${label}のAuth User ID(UUID)を正しく入力してください。`);
        return;
    }

    const scope = role === 'teacher'
        ? getTeacherScopeFormValues()
        : { scope_type: 'all', scope_value: '' };

    if (role === 'teacher' && scope.scope_type !== 'all' && !scope.scope_value) {
        showCustomAlert('先生の対象グループを入力してください。');
        return;
    }

    showCustomConfirm(`${label}ロールを登録しますか？`, async () => {
        const error = await upsertLessonUserAccess(authUserId, userDataId, role, scope);
        if (error) {
            if (role === 'teacher' && isMissingLessonScopeColumnError(error)) {
                showCustomAlert('先生の対象グループ保存には、lesson_user_access の scope_type / scope_value 列追加SQLを先に実行してください。');
            } else {
                showCustomAlert(`登録に失敗しました: ${error.message}`);
            }
            return;
        }
        await refreshCurrentLessonAccess();
        recordAdminAudit('auth_linked', {
            role,
            authUserId,
            userDataId,
            scope: role === 'teacher' ? scope : undefined
        });
        showCustomAlert(`${label}ロールを登録しました。`);
        await renderAuthLinkingAdmin();
    });
}

export async function linkStudentAuthUser(userDataId, inputId) {
    if (!ensureAuthLinkingReady()) return;
    const authUserId = document.getElementById(inputId)?.value?.trim();
    const displayName = getUserDisplayName(userDataId);

    if (!isUuid(authUserId)) {
        showCustomAlert(`${displayName} さんのAuth User ID(UUID)を正しく入力してください。`);
        return;
    }

    showCustomConfirm(`${displayName} さんを生徒アカウントに紐づけますか？`, async () => {
        const error = await upsertLessonUserAccess(authUserId, userDataId, 'student');
        if (error) {
            showCustomAlert(`登録に失敗しました: ${error.message}`);
            return;
        }
        await refreshCurrentLessonAccess();
        recordAdminAudit('auth_linked', {
            role: 'student',
            authUserId,
            userDataId
        });
        showCustomAlert(`${displayName} さんの生徒アカウントを登録しました。`);
        await renderAuthLinkingAdmin();
    });
}

async function createStudentAuthAccount(userDataId, inputId) {
    if (!ensureAuthLinkingReady()) return;
    const user = users[userDataId];
    const displayName = getUserDisplayName(userDataId);
    const defaultNumber = user?.loginNumber || '';
    const studentNumber = window.prompt(`${displayName} さんの児童番号を入力してください。`, defaultNumber);
    if (studentNumber === null) return;
    const cleanNumber = String(studentNumber || '').replace(/\D/g, '');
    if (!cleanNumber) {
        showCustomAlert('児童番号を入力してください。');
        return;
    }
    const passcode = window.prompt(`${displayName} さんのあいことばを6けた以上の数字で入力してください。`, '');
    if (passcode === null) return;
    const cleanPasscode = String(passcode || '').replace(/\D/g, '');
    if (cleanPasscode.length < 6) {
        showCustomAlert('あいことばは6けた以上の数字で入力してください。');
        return;
    }

    const campusId = getUserCampusId(user);
    const campusCode = getCampusCode(campusId);
    const { data, error } = await supabase.functions.invoke('admin-create-student', {
        body: {
            userDataId,
            displayName,
            studentNumber: cleanNumber,
            passcode: cleanPasscode,
            campusId,
            campusCode,
            group: user?.group || ''
        }
    });

    if (error || data?.error) {
        showCustomAlert(`Auth作成に失敗しました: ${data?.error || error?.message || 'unknown error'}`);
        return;
    }

    if (inputId && data?.authUserId) {
        const input = document.getElementById(inputId);
        if (input) input.value = data.authUserId;
    }
    user.loginNumber = cleanNumber;
    user.authUserId = data.authUserId;
    await saveUsers(true);
    await refreshCurrentLessonAccess();
    recordAdminAudit('auth_student_created', {
        user: displayName,
        userDataId,
        authUserId: data.authUserId,
        email: data.email
    });
    showCustomAlert(`${displayName} さんのAuthアカウントを作成しました。\n${data.email}`);
    await renderAuthLinkingAdmin();
}

export function openStudentLoginCardForUser(userDataId, defaultPasscode = '') {
    const user = users[userDataId];
    if (!user) {
        showCustomAlert('児童データが見つかりません。');
        return;
    }

    const displayName = getUserDisplayName(userDataId);
    const numberInput = window.prompt(`${displayName} さんの児童番号を入力してください。`, user.loginNumber || '');
    if (numberInput === null) return;
    const studentNumber = String(numberInput || '').replace(/\D/g, '');
    if (!studentNumber) {
        showCustomAlert('児童番号を入力してください。');
        return;
    }

    const passcodeInput = window.prompt(`${displayName} さんのあいことばを入力してください。\n※あいことばはDレッスンに保存しません。`, defaultPasscode);
    if (passcodeInput === null) return;
    const passcode = String(passcodeInput || '').replace(/\D/g, '');
    if (passcode.length < 6) {
        showCustomAlert('あいことばは6けた以上の数字で入力してください。');
        return;
    }

    if (user.loginNumber !== studentNumber) {
        user.loginNumber = studentNumber;
        void saveUsers(true);
    }

    openStudentLoginCardsPrintWindow([{
        student_number: studentNumber,
        display_name: displayName,
        password: passcode
    }], {
        title: 'Dレッスン ログインカード',
        cardsPerPage: 6
    });
}

async function copyText(text) {
    try {
        await navigator.clipboard.writeText(text);
        showCustomAlert('コピーしました。');
    } catch (error) {
        showCustomAlert('コピーできませんでした。手動で選択してコピーしてください。');
    }
}

export function copyStudentAccessSql(userDataId, inputId) {
    const authUserId = document.getElementById(inputId)?.value?.trim();
    if (!isUuid(authUserId)) {
        showCustomAlert('Auth User ID(UUID)を正しく入力してください。');
        return;
    }
    copyText(buildAccessSql(authUserId, userDataId, 'student'));
}

export function copyRoleAccessSql(role) {
    const inputId = role === 'admin' ? 'auth-admin-user-id' : 'auth-teacher-user-id';
    const authUserId = document.getElementById(inputId)?.value?.trim();
    const userDataId = getRoleAccessDataId(role);
    if (!isUuid(authUserId)) {
        showCustomAlert('Auth User ID(UUID)を正しく入力してください。');
        return;
    }
    const scope = role === 'teacher'
        ? getTeacherScopeFormValues()
        : { scope_type: 'all', scope_value: '' };
    if (role === 'teacher' && scope.scope_type !== 'all' && !scope.scope_value) {
        showCustomAlert('先生の対象グループを入力してください。');
        return;
    }
    copyText(buildAccessSql(authUserId, userDataId, role, scope));
}

export async function renderAuthAccessOverview() {
    const body = document.getElementById('auth-access-tbody');
    const status = document.getElementById('auth-access-status');
    if (!body || !status) return;
    body.innerHTML = '';

    if (!REQUIRE_SUPABASE_AUTH || !supabase) {
        status.innerText = 'Supabase Auth未使用';
        return;
    }

    let { data, error } = await supabase
        .from('lesson_user_access')
        .select('auth_user_id,user_data_id,role,scope_type,scope_value,created_at')
        .order('created_at', { ascending: false });

    if (error && isMissingLessonScopeColumnError(error)) {
        const fallback = await supabase
            .from('lesson_user_access')
            .select('auth_user_id,user_data_id,role,created_at')
            .order('created_at', { ascending: false });
        data = fallback.data;
        error = fallback.error;
    }

    if (error) {
        status.innerText = '管理者用RLS未適用または読込権限なし';
        return;
    }

    status.innerText = `${data?.length || 0}件`;
    (data || []).forEach(row => {
        const tr = document.createElement('tr');
        [row.role, row.user_data_id, row.scope_type || 'all', row.scope_value || '', row.auth_user_id].forEach(value => {
            const td = document.createElement('td');
            td.style.cssText = 'border:1px solid #ddd; padding:6px; word-break:break-all;';
            td.innerText = value || '';
            tr.appendChild(td);
        });
        body.appendChild(tr);
    });
}

export async function renderAuthLinkingAdmin() {
    await renderAuthAccessOverview();

    const body = document.getElementById('auth-link-student-tbody');
    if (!body) return;
    body.innerHTML = '';

    const list = Object.keys(users)
        .filter(userId => users[userId] && !users[userId].isMaster && !isSystemUserId(userId))
        .map(userId => ({ id: userId, name: getUserDisplayName(userId), user: users[userId] }))
        .sort((a, b) => a.name.localeCompare(b.name, 'ja'));

    list.forEach((item, index) => {
        const inputId = `auth-student-${index}`;
        const tr = document.createElement('tr');

        const nameTd = document.createElement('td');
        nameTd.style.cssText = 'border:1px solid #ddd; padding:6px; font-weight:bold;';
        nameTd.innerText = item.name;
        tr.appendChild(nameTd);

        const idTd = document.createElement('td');
        idTd.style.cssText = 'border:1px solid #ddd; padding:6px; word-break:break-all; font-family:monospace;';
        idTd.innerText = item.id;
        tr.appendChild(idTd);

        const inputTd = document.createElement('td');
        inputTd.style.cssText = 'border:1px solid #ddd; padding:6px;';
        const input = document.createElement('input');
        input.type = 'text';
        input.id = inputId;
        input.placeholder = 'Auth User ID';
        input.style.cssText = 'width:220px; max-width:100%; padding:6px; font-size:13px;';
        inputTd.appendChild(input);
        tr.appendChild(inputTd);

        const actionTd = document.createElement('td');
        actionTd.style.cssText = 'border:1px solid #ddd; padding:6px; white-space:nowrap;';
        const createBtn = document.createElement('button');
        createBtn.className = 'btn-primary';
        createBtn.style.cssText = 'font-size:13px; padding:6px 10px; margin-right:6px;';
        createBtn.innerText = 'Auth作成';
        createBtn.onclick = () => createStudentAuthAccount(item.id, inputId);
        actionTd.appendChild(createBtn);

        const linkBtn = document.createElement('button');
        linkBtn.className = 'btn-primary';
        linkBtn.style.cssText = 'font-size:13px; padding:6px 10px; margin-right:6px;';
        linkBtn.innerText = '登録';
        linkBtn.onclick = () => linkStudentAuthUser(item.id, inputId);
        actionTd.appendChild(linkBtn);

        const copyBtn = document.createElement('button');
        copyBtn.className = 'btn-secondary';
        copyBtn.style.cssText = 'font-size:13px; padding:6px 10px; margin-right:6px;';
        copyBtn.innerText = 'SQL';
        copyBtn.onclick = () => copyStudentAccessSql(item.id, inputId);
        actionTd.appendChild(copyBtn);

        const cardBtn = document.createElement('button');
        cardBtn.className = 'btn-secondary';
        cardBtn.style.cssText = 'font-size:13px; padding:6px 10px;';
        cardBtn.innerText = 'カード';
        cardBtn.onclick = () => openStudentLoginCardForUser(item.id);
        actionTd.appendChild(cardBtn);
        tr.appendChild(actionTd);

        body.appendChild(tr);
    });

}
