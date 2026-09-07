import assert from 'node:assert/strict';
import { ALPHABET_READING_STAGES, STAGE_ORDER, VISION_STAGES, WORD_STAGES } from '../src/data/constants.js';
import {
    buildRouteSteps,
    getAvailableRouteSteps,
    getStandardRouteOrderForUser,
    getStandardRouteStatus,
    getTextProgress,
    getVisionProgress,
    getWordProgress,
    normalizeStandardRouteOrder
} from '../src/utils/standard-route.js';

const student = { campusId: 'main', group: 'A', mouseLevel: 0, keyboardSequence: 0 };
const settings = {
    standardRouteSettings: {
        mode: 'campus_group',
        rules: [
            { campusId: 'main', order: ['vision'] },
            { campusId: 'main', group: 'A', order: ['word', 'alphabet', 'text', 'keyboard'] }
        ]
    },
    textTasks: [
        { id: 'common', title: 'Common' },
        { id: 'a', title: 'Group A', targetGroup: 'A' },
        { id: 'b', title: 'Group B', targetGroup: 'B' },
        { id: 'hidden', hidden: true }
    ]
};

assert.deepEqual(normalizeStandardRouteOrder(['vision', 'vision', 'unknown']), [
    'vision', 'mouse', 'alphabet', 'keyboard', 'text', 'word'
]);
assert.equal(getStandardRouteOrderForUser(student, settings)[0], 'word');
assert.equal(getStandardRouteOrderForUser({ ...student, group: 'B' }, settings)[0], 'vision');
assert.equal(getStandardRouteOrderForUser({ campusId: 'public', group: 'public' }, settings)[0], 'mouse');
assert.equal(getStandardRouteOrderForUser(student, {})[0], 'mouse');

const initialSteps = getAvailableRouteSteps(student);
assert.equal(initialSteps[0].step, 'mouse');
assert.equal(initialSteps.some(step => step.step === 'alphabet' || step.step === 'word'), false);
assert.equal(getAvailableRouteSteps({ ...student, mouseLevel: 7 })[0].step, 'alphabet');

// Custom priority must skip locked courses and match staff progress displays.
const customSteps = getAvailableRouteSteps(student, settings);
assert.equal(customSteps[0].step, 'text');
assert.equal(getStandardRouteStatus(student, settings).step, customSteps[0].step);
assert.equal(getAvailableRouteSteps({ ...student, mouseLevel: 7 }, settings)[0].step, 'alphabet');
assert.equal(getAvailableRouteSteps({ ...student, examRecords: { romaji_daku_exam: {} } }, settings)[0].step, 'word');

assert.deepEqual(getTextProgress({ ...student, textRecords: { common: {}, b: {} } }, settings), {
    done: 1, total: 2, nextTitle: 'Group A'
});
assert.equal(getVisionProgress({ visionCleared: ['v1_easy', 'v1_easy', 'unknown'] }).done, 1);
const wordProgress = {
    [WORD_STAGES[0].id]: 'cleared',
    [WORD_STAGES[1].id]: { status: 'cleared' }
};
assert.equal(getWordProgress({ wordProgress }).done, 2);
assert.equal(buildRouteSteps({ wordProgress }).word.done, 2);

const reviewStudent = {
    mouseLevel: 7,
    alphabetSequence: ALPHABET_READING_STAGES.length,
    keyboardSequence: STAGE_ORDER.indexOf(3301),
    keyboardReviewRequirements: { 3301: 3203 }
};
assert.equal(getAvailableRouteSteps(reviewStudent)[0].stageId, 3203);
assert.equal(buildRouteSteps({ mouseLevel: 100, alphabetSequence: -1 }).mouse.done, 7);
assert.equal(buildRouteSteps({ alphabetSequence: 'bad' }).alphabet.done, 0);

const completedStudent = {
    mouseLevel: 7,
    alphabetSequence: ALPHABET_READING_STAGES.length,
    keyboardSequence: STAGE_ORDER.length,
    visionCleared: VISION_STAGES.flatMap(stage => [stage.id, `${stage.id}_easy`, `${stage.id}_hard`]),
    wordProgress: Object.fromEntries(WORD_STAGES.map(stage => [stage.id, { status: 'cleared' }])),
    examRecords: { romaji_daku_exam: {} }
};
assert.deepEqual(getAvailableRouteSteps(completedStudent), []);
assert.equal(getStandardRouteStatus(completedStudent).tone, 'complete');
assert.equal(getStandardRouteStatus(completedStudent).percent, 100);

console.log('Learning route checks passed.');
