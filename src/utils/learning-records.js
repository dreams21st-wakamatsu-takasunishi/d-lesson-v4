import { ALPHABET_READING_STAGES, KB_CHAPTERS } from '../data/constants.js';
import { ONE_HAND_STAGES, isOneHandChallengeUnlocked } from '../data/one-hand.js';
import {
    getActiveKeyboardStageIds, getCompletedActiveKeyboardStageIds,
    getKeyboardChapterStageIds, getRecommendedKeyboardStage
} from './keyboard-progression.js';
import { getStageName } from './stages.js';

export const recordStageName = id => getStageName(id).replace(/^\[ID:[^\]]+\]\s*/, '');

function progressGroup(id, title, stages) {
    return { id, title, stages, done: stages.filter(stage => stage.state === 'done' || stage.review).length };
}

export function getLearningStageGroups(user) {
    const active = new Set(getActiveKeyboardStageIds());
    const completed = new Set(getCompletedActiveKeyboardStageIds(user.keyboardSequence));
    const nextId = getRecommendedKeyboardStage(user);
    const groups = KB_CHAPTERS.filter(chapter => chapter.id !== 'alphabet').map(chapter => {
        const ids = getKeyboardChapterStageIds(chapter).filter(id => active.has(id));
        return progressGroup(chapter.id, chapter.title, ids.map(id => ({
            id, title: recordStageName(id),
            state: id === nextId ? 'next' : completed.has(id) ? 'done' : 'waiting',
            review: id === nextId && completed.has(id)
        })));
    }).filter(group => group.stages.length);
    const included = new Set(groups.flatMap(group => group.stages.map(stage => stage.id)));
    const other = [...active].filter(id => !included.has(id));
    if (other.length) groups.push(progressGroup('other', 'まとめテスト', other.map(id => ({
        id, title: recordStageName(id), state: id === nextId ? 'next' : completed.has(id) ? 'done' : 'waiting'
    }))));
    groups.unshift(progressGroup('alphabet', 'ABCをおぼえる', ALPHABET_READING_STAGES.map((stage, index) => ({
        id: stage.id, title: stage.title,
        state: index < Number(user.alphabetSequence || 0) ? 'done' : 'waiting'
    }))));
    for (const hand of ['left', 'right']) {
        groups.push(progressGroup(hand, hand === 'left' ? '左手タイピング' : '右手タイピング',
            ONE_HAND_STAGES.filter(stage => stage.hand === hand).map(stage => ({
                id: stage.id, title: stage.name,
                state: stage.timed
                    ? user.oneHandChallenges?.[hand]?.attempts > 0 ? 'done' : isOneHandChallengeUnlocked(user, hand) ? 'ready' : 'locked'
                    : user.oneHandProgress?.[stage.id]?.clears > 0 ? 'done' : 'waiting'
            }))));
    }
    return groups;
}

export function getTypingAccuracySeries(logs) {
    const groups = new Map();
    for (const log of logs) {
        if (log.category !== 'keyboard' || !String(log.detail).split('/').some(part => part.trim() === 'クリア')) continue;
        const match = String(log.amount).match(/^うった数 (\d+)回 \/ ミス (\d+)回 \/ せいかく (\d+)%$/);
        const at = Date.parse(log.at);
        if (!match || !Number.isFinite(at) || Number(match[1]) + Number(match[2]) <= 0 || Number(match[3]) > 100) continue;
        const title = String(log.title || 'タイピング');
        const id = log.stageId ? `stage:${log.stageId}` : `legacy:${title}`;
        if (!groups.has(id)) groups.set(id, { id, title, attempts: [] });
        groups.get(id).attempts.push({ at, correct: Number(match[1]), misses: Number(match[2]), accuracy: Number(match[3]) });
    }
    return [...groups.values()]
        .map(group => ({ ...group, attempts: group.attempts.sort((a, b) => b.at - a.at) }))
        .sort((a, b) => b.attempts[0].at - a.attempts[0].at);
}

const dayFormat = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Tokyo' });
export function getRecentPracticeDays(logs, now = new Date()) {
    const counts = new Map();
    const start = Date.parse(dayFormat.format(now) + 'T00:00:00+09:00');
    for (let i = 6; i >= 0; i--) counts.set(dayFormat.format(start - i * 86400000), 0);
    for (const log of logs) {
        const at = Date.parse(log.at);
        if (!Number.isFinite(at) || at > Number(now)) continue;
        const day = dayFormat.format(at);
        if (counts.has(day)) counts.set(day, counts.get(day) + 1);
    }
    return [...counts].map(([date, count]) => ({ date, count }));
}
