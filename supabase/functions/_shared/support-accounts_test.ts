import { inspectOwnedAccounts, lessonLoginUrl, validCardPasscode, type AccountAccess, type AccountUser } from './support-accounts.ts';
const assert = (value: unknown) => { if (!value) throw Error('assertion failed'); };
const id = '11111111-1111-4111-8111-111111111111', secondId = '22222222-2222-4222-8222-222222222222', student = 'student_test';
const data = { campusId: 'main', loginNumber: '19', authUserId: id };
const access: AccountAccess = { auth_user_id: id, user_data_id: student, role: 'student' };
const user: AccountUser = { id, email: 'dlesson-student-main-019@dlesson.example.com', user_metadata: { user_data_id: student, campus_id: 'main', login_number: '19' } };
const settings = { domain: 'dlesson.example.com', prefix: 'dlesson-student-', pad: 3, campusCode: 'main' };
const inspect = (patch = {}, rows = [access], users = [user], byAuth = new Map([[id, [access]]])) => inspectOwnedAccounts(student, { ...data, ...patch }, rows, users, byAuth, settings);
Deno.test('owned classroom Auth is ready without exposing passwords', () => {
  const result = inspect(); assert(result.status === 'ready' && result.loginNumber === '19' && result.candidates[0].campusCode === 'main');
});
Deno.test('legacy no-campus Auth and multiple owned login variants remain compatible', () => {
  const second = { ...user, id: secondId, email: 'dlesson-student-019@dlesson.example.com' }, secondAccess = { ...access, auth_user_id: secondId };
  const result = inspect({}, [access, secondAccess], [user, second], new Map([[id, [access]], [secondId, [secondAccess]]]));
  assert(result.status === 'ready' && result.candidates.length === 2 && result.candidates[0].campusCode === '');
});
Deno.test('regular email login does not become a classroom password target', () => {
  const result = inspect({}, [access], [{ ...user, email: 'normal@example.com' }]); assert(result.status === 'email-only' && result.candidates.length === 0);
});
Deno.test('foreign child, elevated role or contradictory Auth metadata is review only', () => {
  for (const row of [{ ...access, user_data_id: 'student_other' }, { ...access, role: 'admin' }]) assert(inspect({}, [access], [user], new Map([[id, [row]]])).status === 'review');
  for (const metadata of [{ ...user.user_metadata, user_data_id: 'student_other' }, { ...user.user_metadata, campus_id: 'other' }, { ...user.user_metadata, login_number: '20' }]) {
    assert(inspect({}, [access], [{ ...user, user_metadata: metadata }]).status === 'review');
  }
});
Deno.test('stale or malformed saved Auth linkage is never silently repaired', () => {
  assert(inspect({ authUserId: secondId }).status === 'review'); assert(inspect({ authUserId: 'invalid' }).status === 'review'); assert(inspect({}, [access], []).status === 'review');
  assert(inspect({ authUserId: '' }, [], []).status === 'missing');
});
Deno.test('banned and malformed ban status prevent verification', () => {
  assert(inspect({}, [access], [{ ...user, banned_until: '2099-01-01T00:00:00Z' }]).status === 'disabled');
  assert(inspect({}, [access], [{ ...user, banned_until: 'bad' }]).status === 'review');
});
Deno.test('too many accesses are review only; no partial diagnosis', () => {
  assert(inspect({}, Array(11).fill(access)).status === 'review');
});
Deno.test('current published classroom number and passphrase limits are respected', () => {
  for (const number of ['0', '51', '0019', 'bad', true]) assert(inspect({ loginNumber: number }).status === 'review');
  assert(validCardPasscode('123456')); assert(validCardPasscode('000001')); assert(!validCardPasscode('12345')); assert(!validCardPasscode('1234567890123')); assert(!validCardPasscode('abcdef'));
});
Deno.test('card QR URL contains campus only, never password or Auth identity', () => {
  assert(lessonLoginUrl('main').endsWith('/d-lesson-v4/?campus=main')); assert(lessonLoginUrl('').endsWith('/d-lesson-v4/'));
});
Deno.test('inspection never mutates the source record or permissions', () => {
  const before = JSON.stringify([data, access, user]); inspect(); assert(before === JSON.stringify([data, access, user]));
});
