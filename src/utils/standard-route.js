import { DEFAULT_CAMPUS_ID } from '../api/user.js';
import { ALPHABET_READING_STAGES, STAGE_ORDER, VISION_STAGES, WORD_STAGES } from '../data/constants.js';

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
    return Math.min(safeTotal, Math.max(0, Number(done || 0)));
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

function getTextProgress(user, globalSettings) {
    const tasks = getVisibleTextTasks(user, globalSettings);
    const done = tasks.filter(task => user?.textRecords?.[task.id]).length;
    return { done: clampDone(done, tasks.length), total: tasks.length };
}

function getVisionProgress(user) {
    const validIds = new Set(VISION_STAGES.flatMap(stage => [
        `${stage.id}_easy`,
        stage.id,
        `${stage.id}_hard`
    ]));
    const cleared = new Set((Array.isArray(user?.visionCleared) ? user.visionCleared : [])
        .map(String)
        .filter(id => validIds.has(id)));
    return { done: cleared.size, total: VISION_STAGES.length * 3 };
}

function getWordProgress(user) {
    const progress = user?.wordProgress || {};
    const done = WORD_STAGES.filter(stage => {
        const record = progress[stage.id];
        return record === 'cleared' || record?.status === 'cleared';
    }).length;
    return { done, total: WORD_STAGES.length };
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

function buildRouteSteps(user, globalSettings) {
    const mouseTotal = 7;
    const alphabetTotal = ALPHABET_READING_STAGES.length;
    const keyboardTotal = STAGE_ORDER.length;
    const text = getTextProgress(user, globalSettings);
    const vision = getVisionProgress(user);
    const word = getWordProgress(user);

    const mouseLevel = Number(user?.mouseLevel || 0);
    const alphabetSequence = Number(user?.alphabetSequence || 0);
    const keyboardSequence = Number(user?.keyboardSequence || 0);
    const wordLocked = !user?.isMaster && !user?.examRecords?.romaji_daku_exam;

    return {
        mouse: getStepStatus('mouse', mouseLevel, mouseTotal, {
            phase: '基礎操作',
            next: `マウス M-${Math.min(mouseLevel + 1, mouseTotal)}`,
            detail: `マウス ${clampDone(mouseLevel, mouseTotal)}/${mouseTotal}`,
            tone: 'active'
        }),
        alphabet: getStepStatus('alphabet', alphabetSequence, alphabetTotal, {
            phase: 'ABC導入',
            next: `ABC ${Math.min(alphabetSequence + 1, alphabetTotal)}/${alphabetTotal}`,
            detail: `ABC ${clampDone(alphabetSequence, alphabetTotal)}/${alphabetTotal}`,
            tone: 'active'
        }),
        keyboard: getStepStatus('keyboard', keyboardSequence, keyboardTotal, {
            phase: '文字入力',
            next: `キーボード ${Math.min(keyboardSequence + 1, keyboardTotal)}/${keyboardTotal}`,
            detail: `キー ${clampDone(keyboardSequence, keyboardTotal)}/${keyboardTotal}`,
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
        word: getStepStatus('word', wordLocked ? 0 : word.done, word.total, {
            phase: wordLocked ? 'Word準備' : 'Word',
            next: wordLocked ? 'ローマ字テスト後' : 'Wordれんしゅう',
            detail: wordLocked ? 'Word未解放' : formatRemaining(word.done, word.total),
            tone: wordLocked ? 'blocked' : 'active',
            complete: !wordLocked && word.done >= word.total
        })
    };
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

    const currentStep = routeOrder
        .map(stepId => stepMap[stepId])
        .find(step => step && !step.complete);

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
