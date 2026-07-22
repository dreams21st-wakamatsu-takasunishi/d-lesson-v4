import { STAGE_ORDER } from '../data/constants.js';

export const RETIRED_KEYBOARD_STAGE_IDS = Object.freeze([
    2001, 2101, 2002, 2102, 2003, 2103, 2004, 2104, 2999, 4016
]);

export const HIRAGANA_ROW_EXAM_IDS = Object.freeze([3301, 3302, 3303, 3304]);

const RETIRED_STAGE_SET = new Set(RETIRED_KEYBOARD_STAGE_IDS);
const REVIEW_STAGE_BY_EXAM = Object.freeze({
    3301: 3203,
    3302: 3206,
    3303: 3210,
    3304: 3215
});

function toSequence(value) {
    const parsed = Number.parseInt(value, 10);
    if (!Number.isFinite(parsed)) return 0;
    return Math.min(STAGE_ORDER.length, Math.max(0, parsed));
}

export function isRetiredKeyboardStage(stageId) {
    return RETIRED_STAGE_SET.has(Number(stageId));
}

export function normalizeKeyboardSequence(value) {
    let sequence = toSequence(value);
    while (sequence < STAGE_ORDER.length && isRetiredKeyboardStage(STAGE_ORDER[sequence])) {
        sequence++;
    }
    return sequence;
}

export function getKeyboardTargetStage(value) {
    return STAGE_ORDER[normalizeKeyboardSequence(value)] || null;
}

export function isKeyboardStageUnlocked(value, stageId) {
    if (isRetiredKeyboardStage(stageId)) return false;
    const index = STAGE_ORDER.indexOf(Number(stageId));
    return index !== -1 && normalizeKeyboardSequence(value) >= index;
}

export function isKeyboardStageCleared(value, stageId) {
    if (isRetiredKeyboardStage(stageId)) return false;
    const index = STAGE_ORDER.indexOf(Number(stageId));
    return index !== -1 && normalizeKeyboardSequence(value) > index;
}

export function advanceKeyboardSequence(value, stageId) {
    const current = normalizeKeyboardSequence(value);
    const index = STAGE_ORDER.indexOf(Number(stageId));
    if (index === -1 || current > index) return current;
    return normalizeKeyboardSequence(index + 1);
}

export function getActiveKeyboardStageIds() {
    return STAGE_ORDER.filter(stageId => !isRetiredKeyboardStage(stageId));
}

export function getCompletedActiveKeyboardStageIds(value) {
    const sequence = normalizeKeyboardSequence(value);
    return STAGE_ORDER.slice(0, sequence).filter(stageId => !isRetiredKeyboardStage(stageId));
}

export function getKeyboardExamReviewStage(examId) {
    return REVIEW_STAGE_BY_EXAM[Number(examId)] || null;
}

export function getKeyboardExamReviewRequirement(user, examId) {
    const requiredStage = Number(user?.keyboardReviewRequirements?.[examId]);
    return Number.isInteger(requiredStage) && requiredStage > 0 ? requiredStage : null;
}

export function recordKeyboardExamFailure(user, examId, threshold = 5) {
    const numericExamId = Number(examId);
    const reviewStage = getKeyboardExamReviewStage(numericExamId);
    if (!user || !reviewStage) return { streak: 0, requiredStage: null, requirementAdded: false };

    if (!user.keyboardExamFailureStreaks || typeof user.keyboardExamFailureStreaks !== 'object') {
        user.keyboardExamFailureStreaks = {};
    }
    const previous = Number.parseInt(user.keyboardExamFailureStreaks[numericExamId], 10) || 0;
    const streak = Math.min(threshold, previous + 1);
    user.keyboardExamFailureStreaks[numericExamId] = streak;

    let requirementAdded = false;
    if (streak >= threshold) {
        if (!user.keyboardReviewRequirements || typeof user.keyboardReviewRequirements !== 'object') {
            user.keyboardReviewRequirements = {};
        }
        requirementAdded = Number(user.keyboardReviewRequirements[numericExamId]) !== reviewStage;
        user.keyboardReviewRequirements[numericExamId] = reviewStage;
    }

    return {
        streak,
        requiredStage: getKeyboardExamReviewRequirement(user, numericExamId),
        requirementAdded
    };
}

export function clearKeyboardExamFailure(user, examId) {
    if (!user) return;
    if (user.keyboardExamFailureStreaks) delete user.keyboardExamFailureStreaks[Number(examId)];
    if (user.keyboardReviewRequirements) delete user.keyboardReviewRequirements[Number(examId)];
}

export function completeKeyboardReviewRequirement(user, stageId) {
    if (!user?.keyboardReviewRequirements) return [];
    const completedStage = Number(stageId);
    const clearedExamIds = [];
    Object.entries(user.keyboardReviewRequirements).forEach(([examId, requiredStage]) => {
        if (Number(requiredStage) !== completedStage) return;
        delete user.keyboardReviewRequirements[examId];
        if (user.keyboardExamFailureStreaks) delete user.keyboardExamFailureStreaks[examId];
        clearedExamIds.push(Number(examId));
    });
    return clearedExamIds;
}
