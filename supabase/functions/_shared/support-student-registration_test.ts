import { registrationCampuses, validRegistrationChild } from './support-student-registration.ts';
const equal = (actual: unknown, expected: unknown) => { if (JSON.stringify(actual) !== JSON.stringify(expected)) throw Error('Unexpected registration configuration'); };
Deno.test('registration lists only approved non-public scopes with safe login codes', () => {
  equal(registrationCampuses([{ campus_id: 'main' }, { campus_id: 'main' }, { campus_id: 'public' }, { campus_id: '../bad' }, { campus_id: 'school' }], { campuses: [{ id: 'school', code: 'public' }, { id: 'unapproved', name: 'Not visible' }] }), [{ id: 'main', code: 'main', name: '本校' }]);
});
Deno.test('registration preserves authorized classroom labels and codes', () => {
  equal(registrationCampuses([{ campus_id: 'school' }], { campuses: [{ id: 'school', code: 'sch', name: '試験校' }] }), [{ id: 'school', code: 'sch', name: '試験校' }]);
});
Deno.test('registration rejects missing invalid and future birthday or unsafe names', () => {
  for (const birth of ['', '2026-02-30', '2027-01-01']) equal(validRegistrationChild('架空児童', birth, '2026-10-09'), false);
  for (const name of ['', ' ', 'test\u0000', 'a'.repeat(161)]) equal(validRegistrationChild(name, '2016-02-29', '2026-10-09'), false);
  equal(validRegistrationChild('架空児童', '2016-02-29', '2026-10-09'), true);
});
