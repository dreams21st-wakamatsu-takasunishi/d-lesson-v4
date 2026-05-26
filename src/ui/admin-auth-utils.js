export function isUuid(value) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || '').trim());
}

export function getRoleAccessDataId(role) {
    if (role === 'admin') return '__admin__';
    if (role === 'teacher') return '__teacher__';
    return '';
}

export function isMissingLessonScopeColumnError(error) {
    const text = `${error?.message || ''} ${error?.details || ''} ${error?.hint || ''}`.toLowerCase();
    return text.includes('scope_type') || text.includes('scope_value');
}

export function normalizeTeacherScope(scopeType, scopeValue) {
    if (scopeType === 'campus' || scopeType === 'group') {
        return {
            scope_type: scopeType,
            scope_value: String(scopeValue || '').trim()
        };
    }
    return {
        scope_type: 'all',
        scope_value: ''
    };
}

export function normalizeAccessScope(role, scope = {}) {
    if (role === 'teacher') {
        return normalizeTeacherScope(scope.scope_type, scope.scope_value);
    }
    return {
        scope_type: 'all',
        scope_value: ''
    };
}

function sqlString(value) {
    return String(value || '').replace(/'/g, "''");
}

export function buildAccessSql(authUserId, userDataId, role, scope = {}) {
    const scopeValues = normalizeAccessScope(role, scope);
    const scopeTypeSql = scopeValues.scope_type === null ? 'null' : `'${sqlString(scopeValues.scope_type)}'`;
    const scopeValueSql = scopeValues.scope_value === null ? 'null' : `'${sqlString(scopeValues.scope_value)}'`;

    return `insert into public.lesson_user_access (auth_user_id, user_data_id, role, scope_type, scope_value)
values ('${sqlString(authUserId)}', '${sqlString(userDataId)}', '${sqlString(role)}', ${scopeTypeSql}, ${scopeValueSql})
on conflict (auth_user_id, user_data_id)
do update set
    role = excluded.role,
    scope_type = excluded.scope_type,
    scope_value = excluded.scope_value;`;
}
