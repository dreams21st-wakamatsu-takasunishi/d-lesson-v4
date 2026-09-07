import { DEFAULT_CAMPUS_ID, ALPHABET_READING_STAGES, VISION_STAGES, WORD_STAGES } from '../data/constants.js';
import {
    getActiveKeyboardStageIds,
    getCompletedActiveKeyboardStageIds,
    getRecommendedKeyboardStage
} from './keyboard-progression.js';

export const STANDARD_ROUTE_SETTING_KEY = 'standardRouteSettings';
export const STANDARD_ROUTE_MODE_STANDARD = 'standard';
export const STANDARD_ROUTE_MODE_CAMPUS_GROUP = 'campus_group';
export const STANDARD_ROUTE_STEP_IDS = ['mouse', 'alphabet', 'keyboard', 'text', 'vision', 'word'];
export const STANDARD_ROUTE_STEP_LABELS = {
    mouse: 'マウス',
    alphabet: 'ABC導入',
    keyboard: 'キーボード',
    text: '文章入力',
    vision: 'ビジョン',
    word: 'Word'
};

function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, char => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    })[char]);
}

function normalizeText(value) {
    return String(value ?? '').trim();
}

function clampDone(done, total) {
    const safeTotal = Math.max(0, Number(total || 0));
    if (safeTotal <= 0) return 0;
    const value = Number(done);
    return Number.isFinite(value) ? Math.min(safeTotal, Math.max(0, Math.floor(value))) : 0;
}

export function normalizeStandardRouteOrder(order) {
    const seen = new Set();
    const normalized = [];
    (Array.isArray(order) ? order : []).forEach(stepId => {
        const id = normalizeText(stepId);
        if (!STANDARD_ROUTE_STEP_IDS.includes(id) || seen.has(id)) return;
        seen.add(id);
        normalized.push(id);
    });
    STANDARD_ROUTE_STEP_IDS.forEach(stepId => {
        if (!seen.has(stepId)) normalized.push(stepId);
    });
    return normalized;
}

export function getDefaultStandardRouteSettings() {
    return {
        mode: STANDARD_ROUTE_MODE_STANDARD,
        rules: []
    };
}

export function normalizeStandardRouteSettings(globalSettings = {}) {
    const source = globalSettings?.[STANDARD_ROUTE_SETTING_KEY] || {};
    const mode = source.mode === STANDARD_ROUTE_MODE_CAMPUS_GROUP
        ? STANDARD_ROUTE_MODE_CAMPUS_GROUP
        : STANDARD_ROUTE_MODE_STANDARD;
    const rules = (Array.isArray(source.rules) ? source.rules : [])
        .map((rule, index) => ({
            id: normalizeText(rule?.id) || `route_${index + 1}`,
            campusId: normalizeText(rule?.campusId),
            group: normalizeText(rule?.group),
            order: normalizeStandardRouteOrder(rule?.order)
        }))
        .filter(rule => rule.campusId || rule.group);
    return { mode, rules };
}

function getUserCampusId(user = {}) {
    return normalizeText(user?.campusId || user?.campus || DEFAULT_CAMPUS_ID);
}

function ruleMatchScore(rule, user = {}) {
    const campusId = getUserCampusId(user);
    const group = normalizeText(user?.group);
    const campusMatches = rule.campusId ? rule.campusId === campusId : true;
    const groupMatches = rule.group ? rule.group === group : true;
    if (!campusMatches || !groupMatches) return -1;
    return (rule.campusId ? 2 : 0) + (rule.group ? 1 : 0);
}

export function getStandardRouteOrderForUser(user = {}, globalSettings = {}) {
    const settings = normalizeStandardRouteSettings(globalSettings);
    if (settings.mode !== STANDARD_ROUTE_MODE_CAMPUS_GROUP) return STANDARD_ROUTE_STEP_IDS;

    const rule = settings.rules
        .map(item => ({ item, score: ruleMatchScore(item, user) }))
        .filter(({ score }) => score >= 0)
        .sort((a, b) => b.score - a.score)[0]?.item;

    return rule ? rule.order : STANDARD_ROUTE_STEP_IDS;
}

function getVisibleTextTasks(user, globalSettings = {}) {
    const tasks = Array.isArray(globalSettings?.textTasks) ? globalSettings.textTasks : [];
    const group = String(user?.group || '').trim();
    return tasks
        .filter(task => task && task.hidden !== true)
        .filter(task => {
            const targetGroup = String(task?.targetGroup || '').trim();
            return !targetGroup || targetGroup === group;
        });
}

export function getTextProgress(user, globalSettings) {
    const tasks = getVisibleTextTasks(user, globalSettings);
    const done = tasks.filter(task => user?.textRecords?.[task.id]).length;
    const nextTask = tasks.find(task => !user?.textRecords?.[task.id]);
    return { done, total: tasks.length, nextTitle: String(nextTask?.title || '') };
}

export function getVisionProgress(user) {
    const validIds = new Set(VISION_STAGES.flatMap(stage => [
        `${stage.id}_easy`,
        stage.id,
        `${stage.id}_hard`
    ]));
    const cleared = new Set((Array.isArray(user?.visionCleared) ? user.visionCleared : [])
        .map(String)
        .filter(id => validIds.has(id)));
    const nextStage = VISION_STAGES.find(stage => [
        `${stage.id}_easy`, stage.id, `${stage.id}_hard`
    ].some(id => !cleared.has(id)));
    return { done: cleared.size, total: VISION_STAGES.length * 3, nextTitle: nextStage?.title || '' };
}

export function getWordProgress(user) {
    const progress = user?.wordProgress || {};
    const isCleared = stage => {
        const record = progress[stage.id];
        return record === 'cleared' || record?.status === 'cleared';
    };
    const done = WORD_STAGES.filter(isCleared).length;
    const nextStage = WORD_STAGES.find(stage => !isCleared(stage));
    return { done, total: WORD_STAGES.length, nextTitle: nextStage?.title || '' };
}

function formatRemaining(done, total) {
    return `未完了 ${Math.max(0, Number(total || 0) - Number(done || 0))}件`;
}

function getStepStatus(step, done, total, meta = {}) {
    const safeTotal = Math.max(0, Number(total || 0));
    const safeDone = clampDone(done, safeTotal);
    return {
        step,
        done: safeDone,
        total: safeTotal,
        complete: safeTotal <= 0 || safeDone >= safeTotal,
        ...meta
    };
}

export function buildRouteSteps(user = {}, globalSettings = {}) {
    const mouseTotal = 7;
    const alphabetTotal = ALPHABET_READING_STAGES.length;
    const keyboardTotal = getActiveKeyboardStageIds().length;
    const text = getTextProgress(user, globalSettings);
    const vision = getVisionProgress(user);
    const word = getWordProgress(user);

    const mouseLevel = clampDone(user?.mouseLevel, mouseTotal);
    const alphabetSequence = clampDone(user?.alphabetSequence, alphabetTotal);
    const keyboardCompleted = getCompletedActiveKeyboardStageIds(user?.keyboardSequence).length;
    const keyboardTarget = getRecommendedKeyboardStage(user);
    const alphabetLocked = !user?.isMaster && mouseLevel < mouseTotal;
    const wordLocked = !user?.isMaster && !user?.examRecords?.romaji_daku_exam;

    return {
        mouse: getStepStatus('mouse', mouseLevel, mouseTotal, {
            phase: '基礎操作',
            next: `マウス M-${Math.min(mouseLevel + 1, mouseTotal)}`,
            detail: `マウス ${clampDone(mouseLevel, mouseTotal)}/${mouseTotal}`,
            stageId: Math.min(mouseLevel + 1, mouseTotal),
            tone: 'active'
        }),
        alphabet: getStepStatus('alphabet', alphabetSequence, alphabetTotal, {
            phase: 'ABC導入',
            next: alphabetLocked ? 'マウス M-7 のあと' : `ABC ${Math.min(alphabetSequence + 1, alphabetTotal)}/${alphabetTotal}`,
            detail: `ABC ${clampDone(alphabetSequence, alphabetTotal)}/${alphabetTotal}`,
            stageId: ALPHABET_READING_STAGES[alphabetSequence]?.id || null,
            tone: alphabetLocked ? 'blocked' : 'active'
        }),
        keyboard: getStepStatus('keyboard', keyboardCompleted, keyboardTotal, {
            phase: '文字入力',
            next: keyboardTarget ? `キーボード ${Math.min(keyboardCompleted + 1, keyboardTotal)}/${keyboardTotal}` : 'キーボード できた',
            detail: `キー ${clampDone(keyboardCompleted, keyboardTotal)}/${keyboardTotal}`,
            stageId: keyboardTarget,
            tone: 'active'
        }),
        text: getStepStatus('text', text.done, text.total, {
            phase: '実用入力',
            next: '文章入力',
            detail: formatRemaining(text.done, text.total),
            tone: 'active'
        }),
        vision: getStepStatus('vision', vision.done, vision.total, {
            phase: '見る力',
            next: 'ビジョン',
            detail: formatRemaining(vision.done, vision.total),
            tone: 'active'
        }),
        word: getStepStatus('word', word.done, word.total, {
            phase: wordLocked ? 'Word準備' : 'Word',
            next: wordLocked ? 'ローマ字テスト後' : 'Wordれんしゅう',
            detail: wordLocked ? 'Word未解放' : formatRemaining(word.done, word.total),
            tone: wordLocked ? 'blocked' : 'active',
            complete: !wordLocked && word.done >= word.total
        })
    };
}

export function getAvailableRouteSteps(user = {}, globalSettings = {}) {
    const steps = buildRouteSteps(user, globalSettings);
    return getStandardRouteOrderForUser(user, globalSettings)
        .map(id => steps[id])
        .filter(step => !step.complete && step.tone !== 'blocked');
}

export function getStandardRouteStatus(user = {}, globalSettings = {}) {
    const routeOrder = getStandardRouteOrderForUser(user, globalSettings);
    const stepMap = buildRouteSteps(user, globalSettings);
    const parts = STANDARD_ROUTE_STEP_IDS
        .map(stepId => stepMap[stepId])
        .filter(part => part && part.total > 0);

    const done = parts.reduce((sum, part) => sum + clampDone(part.done, part.total), 0);
    const total = parts.reduce((sum, part) => sum + Math.max(0, Number(part.total || 0)), 0);
    const percent = total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 0;

    const pendingSteps = routeOrder.map(stepId => stepMap[stepId]).filter(step => !step.complete);
    const currentStep = pendingSteps.find(step => step.tone !== 'blocked') || pendingSteps[0];

    if (currentStep) {
        return {
            phase: currentStep.phase,
            next: currentStep.next,
            detail: currentStep.detail,
            percent,
            done,
            total,
            tone: currentStep.tone || 'active',
            step: currentStep.step,
            order: routeOrder
        };
    }

    return {
        phase: '完了',
        next: '総合復習',
        detail: '標準ルート完了',
        percent: 100,
        done,
        total,
        tone: 'complete',
        step: 'complete',
        order: routeOrder
    };
}

export function renderStandardRouteCell(status = {}) {
    const percent = Math.min(100, Math.max(0, Number(status.percent || 0)));
    const tone = ['complete', 'blocked'].includes(status.tone) ? status.tone : 'active';
    return `
        <div class="standard-route-cell ${escapeHtml(tone)}">
            <strong>${escapeHtml(status.phase || '-')}</strong>
            <span>${escapeHtml(status.next || '-')}</span>
            <small>${escapeHtml(status.detail || '')}</small>
            <div class="standard-route-bar" aria-label="標準ルート進捗 ${escapeHtml(percent)}%">
                <i style="width:${escapeHtml(percent)}%;"></i>
            </div>
        </div>
    `;
}
