export type AccountStatus = 'ready' | 'missing' | 'email-only' | 'review' | 'disabled' | 'unconfigured';
export type AccountUser = { id: string; email?: string; banned_until?: string; user_metadata?: Record<string, unknown> };
export type AccountAccess = { auth_user_id: string; user_data_id: string; role: string };
export type LoginSettings = { domain: string; prefix: string; pad: number; campusCode: string };
const uuid = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

// This inspects owned Auth records, not their passwords. Never sends emails/UUIDs to the browser.
export function inspectOwnedAccounts(studentId: string, data: Record<string, unknown>, rows: AccountAccess[], users: AccountUser[],
  accessByAuth: Map<string, AccountAccess[]>, settings: LoginSettings, now = Date.now()) {
  const rawNumber = typeof data.loginNumber === 'number' ? String(data.loginNumber) : data.loginNumber;
  const number = typeof rawNumber === 'string' && /^\d{1,3}$/.test(rawNumber) && Number(rawNumber) >= 1 && Number(rawNumber) <= 50 ? String(Number(rawNumber)) : null;
  const basic = { loginNumber: number, authCount: users.length };
  const finish = (status: AccountStatus, candidates: { user: AccountUser; campusCode: string }[] = []) => ({ ...basic, status, candidates });
  if (rows.length > 10 || users.length > 10 || rows.some(row => row.role !== 'student' || row.user_data_id !== studentId || !uuid(row.auth_user_id))) return finish('review');
  const ids = [...new Set(rows.map(row => row.auth_user_id))];
  if (ids.length !== users.length || users.some(user => !ids.includes(user.id)) || (data.authUserId && !uuid(data.authUserId))
    || (uuid(data.authUserId) && !ids.includes(data.authUserId))) return finish('review');
  for (const user of users) {
    const accesses = accessByAuth.get(user.id);
    const metadata = user.user_metadata || {};
    if (!accesses?.length || accesses.some(row => row.role !== 'student' || row.user_data_id !== studentId)
      || (metadata.user_data_id && metadata.user_data_id !== studentId)) return finish('review');
  }
  if (!ids.length) return finish('missing');
  if (!settings.domain || !settings.prefix || !Number.isInteger(settings.pad) || settings.pad < 1 || settings.pad > 8) return finish('unconfigured');
  if (!number) return finish('review');
  const campusId = String(data.campusId || data.campus || 'main');
  const codes = [...new Set(['', settings.campusCode, campusId].filter(code => code === '' || /^[a-zA-Z0-9_-]{1,80}$/.test(code)))];
  let metadataConflict = false;
  const candidates = users.flatMap(user => {
    const code = codes.find(code => `${settings.prefix}${code ? code + '-' : ''}${number.padStart(settings.pad, '0')}@${settings.domain}`.toLowerCase() === user.email?.toLowerCase());
    if (code === undefined) return [];
    const metadata = user.user_metadata || {};
    if ((metadata.campus_id && metadata.campus_id !== campusId) || (metadata.login_number && Number(metadata.login_number) !== Number(number))) { metadataConflict = true; return []; }
    return [{ user, campusCode: code }];
  });
  if (metadataConflict || candidates.some(({ user }) => user.banned_until && !Number.isFinite(Date.parse(user.banned_until)))) return finish('review');
  if (!candidates.length) return finish('email-only');
  const enabled = candidates.filter(({ user }) => !user.banned_until || Date.parse(user.banned_until) <= now);
  if (!enabled.length) return finish('disabled');
  return finish('ready', enabled.sort((a, b) => Number(Boolean(a.campusCode)) - Number(Boolean(b.campusCode))));
}

export const validCardPasscode = (value: unknown): value is string => typeof value === 'string' && /^\d{6,12}$/.test(value);
export const lessonLoginUrl = (campusCode: string) => {
  const url = new URL('https://dreams21st-wakamatsu-takasunishi.github.io/d-lesson-v4/');
  if (campusCode) url.searchParams.set('campus', campusCode);
  return url.href;
};
