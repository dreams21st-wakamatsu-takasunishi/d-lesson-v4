import {ALPHABET_READING_STAGES, VISION_STAGES, WORD_STAGES} from '../data/constants.js';
import {getActiveKeyboardStageIds, isKeyboardStageUnlocked} from './keyboard-progression.js';
import {getStageName} from './stages.js';

// The browser and bridge use the same curriculum allowlist, not caller-supplied routes.
export const taskStageCatalog = Object.freeze([
    ...Array.from({length:7}, (_, i) => ({category:'mouse', stageId:String(i+1), title:`M-${i+1}`})),
    ...getActiveKeyboardStageIds().map(id => ({category:'keyboard', stageId:String(id), title:getStageName(id).replace(/^\[ID:\d+\]\s*/, '')})),
    ...ALPHABET_READING_STAGES.map(stage => ({category:'keyboard', stageId:String(stage.id), title:stage.title})),
    ...VISION_STAGES.flatMap(stage => [['_easy','やさしい'],['','ふつう'],['_hard','むずかしい']].map(([suffix,label]) => ({category:'vision', stageId:stage.id+suffix, title:`${stage.title}（${label}）`}))),
    ...WORD_STAGES.map(stage => ({category:'word', stageId:stage.id, title:`${stage.title} ${stage.sub}`}))
].map(Object.freeze));

export function findTaskStage(category, stageId) {
    return taskStageCatalog.find(stage => stage.category===category && stage.stageId===stageId) || null;
}

export function canOpenTaskStage(user, category, stageId) {
    if (!user || !findTaskStage(category, stageId)) return false;
    if (category==='mouse') return Number(user.mouseLevel || 0)>=Number(stageId)-1;
    if (category==='keyboard') {
        const alphabetIndex=ALPHABET_READING_STAGES.findIndex(stage => String(stage.id)===stageId);
        return alphabetIndex>=0
            ? Number(user.mouseLevel || 0)>=7 && Number(user.alphabetSequence || 0)>=alphabetIndex
            : isKeyboardStageUnlocked(user.keyboardSequence, Number(stageId));
    }
    if (category==='vision') return !stageId.endsWith('_hard') || user.isMaster || (user.visionCleared || []).includes(stageId.replace('_hard',''));
    if (!user.isMaster && !user.examRecords?.romaji_daku_exam) return false;
    const index=WORD_STAGES.findIndex(stage => stage.id===stageId);
    const previous=user.wordProgress?.[WORD_STAGES[index-1]?.id];
    return user.isMaster || index===0 || previous==='cleared' || previous?.status==='cleared';
}
