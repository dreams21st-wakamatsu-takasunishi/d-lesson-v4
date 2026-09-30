import { classroomIdentity, practiceForDate, secretMatches, serviceDate, validDate } from './support-learning.ts';
const assert = (condition: unknown) => { if (!condition) throw new Error('assertion failed'); };
const project = 'abcdefghijklmnopqrst';
Deno.test('classroom identity excludes public, guest, master and invalid IDs', () => {
  const student = { displayName: 'テスト児童', campusId: 'main' };
  assert(classroomIdentity('student_test', student, project, 'user_data'));
  for (const patch of [{ publicRegistration: true }, { registrationSource: 'public' }, { registration_source: 'public' }, { accountType: 'public' }, { accountType: 'guest' }, { campusId: 'public' }, { isGuest: true }, { isMaster: true }, { isMaster: 'true' }]) assert(!classroomIdentity('student_test', { ...student, ...patch }, project, 'user_data'));
  assert(!classroomIdentity('__GUEST_USER__', student, project, 'user_data'));
});
Deno.test('day boundaries use Japan time, not UTC or machine timezone', () => {
  assert(serviceDate('2026-09-29T14:59:59Z') === '2026-09-29');
  assert(serviceDate('2026-09-29T15:00:00Z') === '2026-09-30');
  assert(!validDate('2026-09-31')); assert(validDate('2024-02-29'));
});
Deno.test('exports select practice only, deduplicate and never include coins or user data', () => {
  const event = { id: 'e1', at: '2026-09-30T01:00:00Z', category: 'word', title: 'Word', detail: '途中保存', amount: '2ページまで', coins: 500, email: 'private' };
  const events = practiceForDate({ practiceLogs: [event, event, { ...event, id: 'e2', category: 'gacha' }, { ...event, id: 'e3', at: 'bad' }, { ...event, id: '' }] }, '2026-09-30');
  assert(events.length === 1); assert(!('coins' in events[0])); assert(!('email' in events[0]));
});
Deno.test('bridge rejects missing/short/mismatched secrets', async () => {
  const secret = 'a'.repeat(64);
  assert(await secretMatches(secret, secret));
  assert(!await secretMatches('', secret)); assert(!await secretMatches('b'.repeat(64), secret));
  assert(!await secretMatches('a', 'a'));
});
