import { validDate } from './support-learning.ts';
export const safeCampusId = (value: unknown): value is string => typeof value === 'string' && /^[a-zA-Z0-9_-]{1,80}$/.test(value) && value !== 'public';
export function registrationCampuses(scopes: { campus_id: string }[], settings: unknown) {
  const rows = Array.isArray(settings) ? settings : [];
  const seen = new Set<string>();
  return scopes.flatMap(scope => {
    if (!safeCampusId(scope.campus_id) || seen.has(scope.campus_id)) return [];
    seen.add(scope.campus_id);
    const campus = rows.find(row => row && (row.id || row.campusId || row.code) === scope.campus_id);
    if (!campus || campus.active === false) return [];
    const code = campus?.code || scope.campus_id;
    if (!safeCampusId(code)) return [];
    return [{ id: scope.campus_id, code, name: String(campus.name).slice(0, 160), registrationEnabled: campus.registration_enabled !== false }];
  });
}
export function validRegistrationChild(name: unknown, birth: unknown, today: string) {
  return typeof name === 'string' && name.trim().length > 0 && name.length <= 160 && !/[\u0000-\u001f\u007f]/.test(name) && validDate(birth) && birth <= today;
}
