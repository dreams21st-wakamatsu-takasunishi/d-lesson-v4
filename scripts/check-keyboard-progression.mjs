import assert from 'node:assert/strict';
import { KB_CHAPTERS, STAGE_ORDER, WORD_DATA } from '../src/data/constants.js';
import {
    advanceKeyboardSequence,
    clearKeyboardExamFailure,
    completeKeyboardReviewRequirement,
    getActiveKeyboardStageIds,
    getCompletedActiveKeyboardStageIds,
    getKeyboardExamReviewRequirement,
    getKeyboardTargetStage,
    getRecommendedKeyboardStage,
    getKeyboardChapterStageIds,
    isKeyboardStageCleared,
    isKeyboardStageUnlocked,
    normalizeKeyboardSequence,
    recordKeyboardExamFailure
} from '../src/utils/keyboard-progression.js';
import { buildSequentialPracticeRounds, registerRapidMistype } from '../src/utils/typing-practice.js';

const sequentialPractice = buildSequentialPracticeRounds(
    [{ h: 'あ' }, { h: 'い' }, { h: 'う' }],
    3,
    { blind: false }
);
assert.deepEqual(
    sequentialPractice.map(item => item.h),
    ['あ', 'い', 'う', 'あ', 'い', 'う', 'あ', 'い', 'う']
);
assert.equal(sequentialPractice.every(item => item.blind === false), true);

let rapidMistypes = [];
for (const [key, timestamp] of [['Q', 0], ['W', 120], ['E', 240]]) {
    const result = registerRapidMistype(rapidMistypes, key, timestamp);
    rapidMistypes = result.history;
    assert.equal(result.shouldWarn, false);
}
const rapidWarning = registerRapidMistype(rapidMistypes, 'R', 360);
assert.equal(rapidWarning.shouldWarn, true);
assert.deepEqual(rapidWarning.history, []);

let repeatedMistypes = [];
for (const timestamp of [0, 100, 200, 300]) {
    const result = registerRapidMistype(repeatedMistypes, 'Q', timestamp);
    repeatedMistypes = result.history;
    assert.equal(result.shouldWarn, false);
}

let spacedMistypes = [];
for (const [key, timestamp] of [['Q', 0], ['W', 300], ['E', 700], ['R', 1100]]) {
    const result = registerRapidMistype(spacedMistypes, key, timestamp);
    spacedMistypes = result.history;
    assert.equal(result.shouldWarn, false);
}

const legacyBlindStart = STAGE_ORDER.indexOf(2001);
const hiraganaStart = STAGE_ORDER.indexOf(3001);

assert.notEqual(legacyBlindStart, -1);
assert.notEqual(hiraganaStart, -1);
assert.equal(normalizeKeyboardSequence(legacyBlindStart), hiraganaStart);
assert.equal(getKeyboardTargetStage(legacyBlindStart), 3001);

const afterFirstHiragana = advanceKeyboardSequence(hiraganaStart, 3001);
assert.equal(getKeyboardTargetStage(afterFirstHiragana), 3101);
assert.equal(isKeyboardStageCleared(afterFirstHiragana, 3001), true);
assert.equal(isKeyboardStageUnlocked(afterFirstHiragana, 3101), true);

const activeStages = getActiveKeyboardStageIds();
assert.equal(new Set(STAGE_ORDER).size, STAGE_ORDER.length);
for (const [examId, wordId] of [[3301, 4301], [3302, 4302], [3303, 4303], [3304, 4304]]) {
    assert.equal(STAGE_ORDER[STAGE_ORDER.indexOf(examId) + 1], wordId);
    const chapter = KB_CHAPTERS.find(item => item.exam === examId);
    assert.equal(getKeyboardChapterStageIds(chapter).at(-1), wordId);
    const wordStage = WORD_DATA.find(stage => stage.id === wordId);
    assert.ok(wordStage?.chars.length > 0);
    assert.equal(wordStage.learnedWordStage, true);
    assert.equal(wordStage.mode, 'blind', `${wordId}: learned-word practice must hide keyboard hints`);
}
assert.equal(WORD_DATA.find(stage => stage.id === 4001).mode, 'guided');
assert.equal(activeStages.includes(2001), false);
assert.equal(activeStages.includes(3101), true);
assert.equal(activeStages.includes(3001), true);
assert.equal(activeStages.includes(3201), true);
assert.equal(activeStages.includes(4016), false);
assert.equal(WORD_DATA.some(stage => stage.id === 4016), false);
assert.equal(KB_CHAPTERS.some(chapter => chapter.stages.includes(4016)), false);

const retiredKatakanaIndex = STAGE_ORDER.indexOf(4016);
assert.notEqual(retiredKatakanaIndex, -1);
assert.equal(normalizeKeyboardSequence(retiredKatakanaIndex), retiredKatakanaIndex + 1);
assert.equal(getKeyboardTargetStage(retiredKatakanaIndex), 4105);
assert.deepEqual(
    getCompletedActiveKeyboardStageIds(afterFirstHiragana).slice(-1),
    [3001]
);

const user = {};
for (let attempt = 1; attempt <= 4; attempt++) {
    const result = recordKeyboardExamFailure(user, 3301);
    assert.equal(result.streak, attempt);
    assert.equal(result.requiredStage, null);
}
const fifthFailure = recordKeyboardExamFailure(user, 3301);
assert.equal(fifthFailure.streak, 5);
assert.equal(fifthFailure.requiredStage, 3203);
assert.equal(getKeyboardExamReviewRequirement(user, 3301), 3203);
user.keyboardSequence = STAGE_ORDER.indexOf(3301);
assert.equal(getRecommendedKeyboardStage(user), 3203);

assert.deepEqual(completeKeyboardReviewRequirement(user, 3202), []);
assert.equal(getKeyboardExamReviewRequirement(user, 3301), 3203);
assert.deepEqual(completeKeyboardReviewRequirement(user, 3203), [3301]);
assert.equal(getKeyboardExamReviewRequirement(user, 3301), null);
assert.equal(getRecommendedKeyboardStage(user), 3301);

recordKeyboardExamFailure(user, 3302);
clearKeyboardExamFailure(user, 3302);
assert.equal(user.keyboardExamFailureStreaks?.[3302], undefined);
assert.equal(getKeyboardExamReviewRequirement(user, 3302), null);

console.log('Keyboard progression checks passed.');
