import { projectProgress, readBoundProgress, type ProgressReader } from './support-progress.ts';
import { STAGE_ORDER } from '../../../src/data/constants.js';
import { getKeyboardTargetStage } from '../../../src/utils/keyboard-progression.js';
const assert = (value: unknown, message = 'assertion failed') => { if (!value) throw Error(message); };
const request = { supportProjectRef: 'abcdefghijklmnopqrst', organizationId: '11111111-1111-4111-8111-111111111111', studentId: 'student_test', childId: 'child-test', linkId: '22222222-2222-4222-8222-222222222222' };
const permission = { campus_id: 'main', support_child_id: request.childId, support_link_id: request.linkId };
const data = { displayName: '架空児童', campusId: 'main', mouseLevel: 0, keyboardSequence: 0, visionCleared: [], wordProgress: {} };

Deno.test('missing or invalid progress stays unknown, not zero or cleared', () => {
  for (const source of [{}, { mouseLevel: -1, keyboardSequence: 'no', visionCleared: {}, wordProgress: [] }, { mouseLevel: true, keyboardSequence: STAGE_ORDER.length + 1 }]) {
    const result = projectProgress(source);
    assert(result.courses.every(course => course.completed === null && course.next === null && course.stages.every(stage => stage.status === 'unknown')));
  }
});
Deno.test('new student starts at M-1 without clearing it', () => {
  const mouse = projectProgress(data).courses[0];
  assert(mouse.completed === 0 && mouse.next?.id === '1' && mouse.stages[0].status === 'current');
});
Deno.test('keyboard uses real curriculum, skips retired stages, and recommends required review', () => {
  const retiredIndex = STAGE_ORDER.indexOf(2001);
  const course = projectProgress({ ...data, keyboardSequence: retiredIndex }).courses[1];
  assert(course.next?.id === String(getKeyboardTargetStage(retiredIndex)));
  assert(!course.stages.some(stage => stage.id === '2001'));
  const exam = STAGE_ORDER.indexOf(3301);
  const review = projectProgress({ ...data, keyboardSequence: exam, keyboardReviewRequirements: { 3301: 3203 } }).courses[1];
  assert(review.next?.id === '3203' && review.next.status === 'current');
});
Deno.test('vision counts unique known difficulty records, not unknown or duplicate IDs', () => {
  const course = projectProgress({ ...data, visionCleared: ['v1', 'v1', 'v1_easy', 'v1_hard', 'private'] }).courses[2];
  assert(course.completed === 3 && course.total === 60);
});
Deno.test('Word supports legacy and current approval storage', () => {
  const course = projectProgress({ ...data, wordProgress: { w_b1_1: 'cleared', w_b1_2: { status: 'cleared', approvedBy: 'private' }, w_b1_3: { status: 'pending' } } }).courses[3];
  assert(course.completed === 2 && !JSON.stringify(course).includes('approvedBy'));
});
Deno.test('best times are positive finite saved values, missing is not zero', () => {
  const stages = projectProgress({ ...data, examRecords: { 1: 12.5, 2: 0, 3: -2, 4: '1', 5: Infinity } }).courses[0].stages;
  assert(stages[0].bestSeconds === 12.5 && stages.slice(1).every(stage => stage.bestSeconds === null));
});
Deno.test('weak keys are bounded, merged case-insensitively, and exclude arbitrary raw fields', () => {
  const result = projectProgress({ globalMistakes: { a: 2, A: 3, z: 7, password: 10, '@': 2, b: -1, c: '4' } });
  assert(result.weakKeys.length === 3 && result.weakKeys[0].key === 'Z' && result.weakKeys[1].count === 5);
});
Deno.test('recent events use Japan dates, latest order, duplicate removal and limit 30', () => {
  const event = { id: 'e', at: '2026-10-07T15:00:00Z', category: 'text', title: '文章入力', detail: '最近の結果', amount: '3回' };
  const logs = Array.from({ length: 50 }, (_, index) => ({ ...event, id: `e${index}`, at: new Date(Date.parse(event.at) + index * 1000).toISOString(), email: 'private' }));
  const result = projectProgress({ practiceLogs: [...logs, ...logs, { ...event, id: 'other', category: 'gacha' }] });
  assert(result.recentEvents.length === 30 && result.recentEvents[0].id === 'e49');
  assert(!JSON.stringify(result).includes('private'));
});
Deno.test('projection is read only and never exports passwords, email, Auth IDs or unknown properties', () => {
  const source = { ...data, email: 'SECRET_EMAIL', passcode: 'SECRET_PASSCODE', authUserId: '11111111-1111-4111-8111-111111111111', loginNumber: 19, coins: 999, practiceLogs: [] };
  const before = JSON.stringify(source);
  const result = projectProgress(source);
  const json = JSON.stringify(result);
  assert(result.account.authIdSaved && result.account.loginNumber === '19' && result.account.loginVerified === false);
  assert(!json.includes('SECRET') && !json.includes(source.authUserId) && !json.includes('coins') && before === JSON.stringify(source));
});

const reader = (patch: Partial<ProgressReader> = {}): ProgressReader => ({ scopes: async () => ['main'], permission: async () => permission, learner: async () => ({ id: request.studentId, data }), ...patch });
const rejects = async (operation: () => Promise<unknown>) => { let rejected = false; try { await operation(); } catch { rejected = true; } assert(rejected); };
Deno.test('wrong child, link or campus never reads private learner data', async () => {
  for (const patch of [{ support_child_id: 'other' }, { support_link_id: 'other' }, { campus_id: 'other' }]) {
    let reads = 0;
    await rejects(() => readBoundProgress(reader({ permission: async () => ({ ...permission, ...patch }), learner: async () => { reads++; return null; } }), request, 'abcdefghijklmnopqrst', 'user_data'));
    assert(reads === 0);
  }
});
Deno.test('revocation during read does not return a snapshot', async () => {
  let checks = 0;
  await rejects(() => readBoundProgress(reader({ permission: async () => ++checks === 1 ? permission : null }), request, 'abcdefghijklmnopqrst', 'user_data'));
});
Deno.test('wrong source identity or public/guest learner is denied', async () => {
  for (const row of [{ id: 'student_other', data }, { id: request.studentId, data: { ...data, campusId: 'other' } }, { id: request.studentId, data: { ...data, publicRegistration: true } }]) {
    await rejects(() => readBoundProgress(reader({ learner: async () => row }), request, 'abcdefghijklmnopqrst', 'user_data'));
  }
});
Deno.test('valid binding returns only projected progress and explicit child/link identity', async () => {
  const result = await readBoundProgress(reader(), request, 'abcdefghijklmnopqrst', 'user_data');
  assert(result.childId === request.childId && result.linkId === request.linkId && result.identity.studentId === request.studentId && !('data' in result));
});
