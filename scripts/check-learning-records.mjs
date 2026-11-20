import assert from 'node:assert/strict';
import { STAGE_ORDER } from '../src/data/constants.js';
import { getActiveKeyboardStageIds, getCompletedActiveKeyboardStageIds } from '../src/utils/keyboard-progression.js';
import { getLearningStageGroups, getTypingAccuracySeries, getRecentPracticeDays } from '../src/utils/learning-records.js';

const log = (at, stageId, accuracy, extra = {}) => ({
    at, stageId, category: 'keyboard', title: stageId === '1001' ? 'キーボード 同じ名前' : 'キーボード 別のステージ',
    detail: 'クリア', amount: `うった数 20回 / ミス 2回 / せいかく ${accuracy}%`, ...extra
});
const logs = [
    log('2026-11-19T15:01:00Z', '1001', 97, { detail: 'とちゅうでやめた' }),
    log('2026-11-18T16:00:00Z', '1001', 83),
    log('2026-11-19T15:02:00Z', '1001', 90, { detail: 'クリア / しんきろく' }),
    log('2026-11-19T15:03:00Z', '1002', 99, { title: 'キーボード 同じ名前' }),
    log('2026-11-19T14:59:00Z', '1001', 96, { category: 'text' }),
    log('2026-11-19T15:04:00Z', '1001', 110),
    log('2026-11-19T15:05:00Z', 'hand_left_5', 100, { amount: '90秒 / スコア 80点', detail: '90秒おわり' }),
    log('2026-11-19T15:05:00Z', undefined, 65)
];
const before = JSON.stringify(logs);
const series = getTypingAccuracySeries(logs);
assert.equal(series.length, 3);
assert.deepEqual(series.find(group => group.id === 'stage:1001').attempts.map(attempt => attempt.accuracy), [90, 83]);
assert.equal(series.find(group => group.id === 'stage:1002').attempts.length, 1);
assert.equal(JSON.stringify(logs), before);

const days = getRecentPracticeDays(logs, new Date('2026-11-19T15:02:30Z'));
assert.equal(days.length, 7);
assert.deepEqual(days.slice(-2), [{ date: '2026-11-19', count: 2 }, { date: '2026-11-20', count: 2 }]);
assert.ok(days.slice(0, 5).every(day => !day.count));

const user = {
    keyboardSequence: STAGE_ORDER.indexOf(3301), keyboardReviewRequirements: { 3301: 3203 },
    alphabetSequence: 1, oneHandProgress: { hand_left_4: { clears: 1 } },
    oneHandChallenges: { right: { attempts: 1, best: { score: 0 } } }
};
const groups = getLearningStageGroups(user);
const keyboardGroups = groups.filter(group => !['alphabet', 'left', 'right'].includes(group.id));
assert.deepEqual(keyboardGroups.flatMap(group => group.stages.map(stage => stage.id)).sort(), getActiveKeyboardStageIds().sort());
assert.equal(keyboardGroups.reduce((sum, group) => sum + group.done, 0), getCompletedActiveKeyboardStageIds(user.keyboardSequence).length);
assert.equal(keyboardGroups.flatMap(group => group.stages).find(stage => stage.id === 3203).review, true);
assert.equal(groups.find(group => group.id === 'alphabet').done, 1);
assert.equal(groups.find(group => group.id === 'left').stages.at(-1).state, 'ready');
assert.equal(groups.find(group => group.id === 'right').stages.at(-1).state, 'done');
assert.equal(getLearningStageGroups({}).find(group => group.id === 'left').stages.at(-1).state, 'locked');
assert.deepEqual(getTypingAccuracySeries([]), []);
console.log('Learning records checks passed: same-stage accuracy, recorded activities, JST week, and stage progress.');
