import { chosenPasscodeProof, credentialPlan, operationPasscode } from './support-account-credentials.ts';

Deno.test('chosen passcode proof is bound to the operation and preserves leading zeroes', async () => {
  const secret = 'a'.repeat(40);
  const proof = await chosenPasscodeProof(secret, id, student, '069513');
  assert(/^[a-f0-9]{64}$/.test(proof));
  assert(proof === await chosenPasscodeProof(secret, id.toUpperCase(), student, '069513'));
  assert(proof !== await chosenPasscodeProof(secret, second, student, '069513'));
  assert(proof !== await chosenPasscodeProof(secret, id, student, '069514'));
  assert(proof !== await chosenPasscodeProof(secret, id, 'student_other', '069513'));
});
import type { AccountUser } from './support-accounts.ts';
const assert = (value: unknown) => { if (!value) throw Error('assertion failed'); };
const rejects = (fn: () => unknown) => { let rejected = false; try { fn(); } catch { rejected = true; } assert(rejected); };
const id = '11111111-1111-4111-8111-111111111111', second = '22222222-2222-4222-8222-222222222222', student = 'student_test';
const data = { campusId: 'main', loginNumber: '19', authUserId: id, coins: 100 };
const access = { auth_user_id: id, user_data_id: student, role: 'student' };
const user: AccountUser = { id, email: 'dlesson-student-main-019@dlesson.example.com', user_metadata: { user_data_id: student } };
const settings = { domain: 'dlesson.example.com', prefix: 'dlesson-student-', pad: 3, campusCode: 'main' };
const plan = (action: string, patch = {}, rows = [access], users = [user], owned = new Map([[id, [access]]])) => credentialPlan(action, student, { ...data, ...patch }, rows, users, owned, settings);
Deno.test('issue requires no saved primary and no owned Auth', () => {
  const result = plan('issue', { authUserId: '' }, [], [], new Map()); assert(result.authId === null && result.email === user.email);
  rejects(() => plan('issue')); rejects(() => plan('issue', { authUserId: second }, [], [], new Map()));
});
Deno.test('reset preserves the one owned classroom Auth and its exact email', () => {
  const result = plan('reset'); assert(result.authId === id && result.email === user.email);
  const legacy = plan('reset', {}, [access], [{ ...user, email: 'dlesson-student-019@dlesson.example.com' }]); assert(legacy.campusCode === '' && legacy.authId === id);
});
Deno.test('duplicate login aliases, foreign/elevated access, email-only and banned Auth cannot reset', () => {
  const secondAccess = { ...access, auth_user_id: second };
  rejects(() => plan('reset', {}, [access, secondAccess], [user, { ...user, id: second }], new Map([[id, [access]], [second, [secondAccess]]])));
  rejects(() => plan('reset', {}, [access], [user], new Map([[id, [{ ...access, user_data_id: 'student_other' }]]])));
  rejects(() => plan('reset', {}, [{ ...access, role: 'admin' }]));
  rejects(() => plan('reset', {}, [access], [{ ...user, email: 'other@example.com' }]));
  rejects(() => plan('reset', {}, [access], [{ ...user, banned_until: '2099-01-01T00:00:00Z' }]));
});
Deno.test('verified school and legacy aliases of the same student can reset together', () => {
  const secondAccess = { ...access, auth_user_id: second };
  const legacy = {...user,id:second,email:'dlesson-student-019@dlesson.example.com'};
  const result=plan('reset',{},[access,secondAccess],[user,legacy],new Map([[id,[access]],[second,[secondAccess]]]));
  assert(result.authId===id && result.campusCode==='main');
});
Deno.test('new operations generate six digits while legacy generation remains unchanged',async()=>{
  const secret='a'.repeat(40);
  const six=await operationPasscode(secret,id,student,6),ten=await operationPasscode(secret,id,student,10);
  assert(/^\d{6}$/.test(six));assert(ten.endsWith(six));
});
Deno.test('unsupported numbers and actions are blocked', () => {
  for (const loginNumber of ['0', '51', '0019', 'invalid']) rejects(() => plan('issue', { loginNumber, authUserId: '' }, [], [], new Map()));
  rejects(() => plan('delete')); rejects(() => plan('reset', { authUserId: second }));
});
Deno.test('operation generation is stable, secret-dependent and isolated by child and ID', async () => {
  const secret = 'a'.repeat(40), passcode = await operationPasscode(secret, id, student);
  assert(/^\d{10}$/.test(passcode)); assert(passcode === await operationPasscode(secret, id.toUpperCase(), student));
  assert(passcode !== await operationPasscode(secret, second, student)); assert(passcode !== await operationPasscode(secret, id, 'student_other'));
  assert(passcode !== await operationPasscode('b'.repeat(40), id, student));
});
Deno.test('planning does not modify learning data, Auth or access rows', () => {
  const before = JSON.stringify([data, user, access]); plan('reset'); assert(before === JSON.stringify([data, user, access]));
});
