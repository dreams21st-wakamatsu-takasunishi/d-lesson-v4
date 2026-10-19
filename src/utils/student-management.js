// Pure presentation helpers. A saved Auth ID is not proof of a working login.
export function parseCampusRegistry(rows) {
    if (!Array.isArray(rows)) throw Error('校舎台帳を確認してください。');
    const ids = new Set(), codes = new Set();
    return rows.map(row => {
        if (!row || typeof row.id !== 'string' || !row.id || typeof row.name !== 'string' || !row.name.trim()
            || typeof row.code !== 'string' || !row.code || ids.has(row.id) || codes.has(row.code)) {
            throw Error('校舎台帳に重複または未設定があります。');
        }
        ids.add(row.id); codes.add(row.code);
        return { id: row.id, name: row.name, code: row.code, active: row.active !== false,
            registrationEnabled: row.registration_enabled !== false };
    });
}

export function registrationCampuses(campuses, access = []) {
    const permitted = campus => access.some(row => row.role === 'admin' || (row.role === 'teacher' && (
        row.scope_type === 'all' || !row.scope_type
        || (row.scope_type === 'campus' && String(row.scope_value || '').split(',').map(v => v.trim()).includes(campus.id))
        || (row.scope_type === 'campus_group' && String(row.scope_value || '').split(',').some(v => v.trim().startsWith(`${campus.id}:`)))
    )));
    return campuses.filter(c => c.id !== 'public' && c.active && c.registrationEnabled && permitted(c));
}

export function studentState(user = {}) {
    return ['paused', 'left'].includes(user.studentState) ? user.studentState : 'active';
}
export const studentStateLabels = { active: '利用中', paused: '休止', left: '在籍終了' };

export function nextStudentNumber(collection, campusId, max = 50) {
    const used = new Set(Object.values(collection).filter(row => row && (row.campusId || row.campus || 'main') === campusId)
        .map(row => Number(row.loginNumber)).filter(Number.isInteger));
    for (let value = 1; value <= max; value++) if (!used.has(value)) return String(value);
    return '';
}

export function describeStudentAccount(user, status) {
    if (status?.loginReady && status.campusReady === false) return '校舎設定を確認';
    if (status) return status.loginReady ? 'ログイン設定確認済み' : 'ログイン要確認';
    return user?.authUserId && user?.loginNumber ? 'ログイン設定あり（未検証）' : 'ログイン未設定';
}

export function expectedFields(user, patch) {
    return Object.fromEntries(Object.keys(patch).map(key => [key, user[key] ?? null]));
}
