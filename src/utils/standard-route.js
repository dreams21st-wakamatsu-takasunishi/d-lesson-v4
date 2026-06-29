import { ALPHABET_READING_STAGES, STAGE_ORDER, VISION_STAGES, WORD_STAGES } from '../data/constants.js';

function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, char => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    })[char]);
}

function clampDone(done, total) {
    const safeTotal = Math.max(0, Number(total || 0));
    if (safeTotal <= 0) return 0;
    return Math.min(safeTotal, Math.max(0, Number(done || 0)));
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

export function getStandardRouteStatus(user = {}, globalSettings = {}) {
    const mouseTotal = 7;
    const alphabetTotal = ALPHABET_READING_STAGES.length;
    const keyboardTotal = STAGE_ORDER.length;
    const text = getTextProgress(user, globalSettings);
    const vision = getVisionProgress(user);
    const word = getWordProgress(user);

    const parts = [
        { done: clampDone(user?.mouseLevel, mouseTotal), total: mouseTotal },
        { done: clampDone(user?.alphabetSequence, alphabetTotal), total: alphabetTotal },
        { done: clampDone(user?.keyboardSequence, keyboardTotal), total: keyboardTotal },
        text.total > 0 ? text : null,
        vision,
        word
    ].filter(Boolean);

    const done = parts.reduce((sum, part) => sum + clampDone(part.done, part.total), 0);
    const total = parts.reduce((sum, part) => sum + Math.max(0, Number(part.total || 0)), 0);
    const percent = total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 0;

    const mouseLevel = Number(user?.mouseLevel || 0);
    if (mouseLevel < mouseTotal) {
        return {
            phase: '基礎操作',
            next: `マウス M-${mouseLevel + 1}`,
            detail: `マウス ${mouseLevel}/${mouseTotal}`,
            percent,
            done,
            total,
            tone: 'active'
        };
    }

    const alphabetSequence = Number(user?.alphabetSequence || 0);
    if (alphabetSequence < alphabetTotal) {
        return {
            phase: 'ABC導入',
            next: `ABC ${alphabetSequence + 1}/${alphabetTotal}`,
            detail: `ABC ${alphabetSequence}/${alphabetTotal}`,
            percent,
            done,
            total,
            tone: 'active'
        };
    }

    const keyboardSequence = Number(user?.keyboardSequence || 0);
    if (keyboardSequence < keyboardTotal) {
        return {
            phase: '文字入力',
            next: `キーボード ${keyboardSequence + 1}/${keyboardTotal}`,
            detail: `キー ${keyboardSequence}/${keyboardTotal}`,
            percent,
            done,
            total,
            tone: 'active'
        };
    }

    if (text.total > 0 && text.done < text.total) {
        return {
            phase: '実用入力',
            next: '文章入力',
            detail: formatRemaining(text.done, text.total),
            percent,
            done,
            total,
            tone: 'active'
        };
    }

    if (vision.done < vision.total) {
        return {
            phase: '見る力',
            next: 'ビジョン',
            detail: formatRemaining(vision.done, vision.total),
            percent,
            done,
            total,
            tone: 'active'
        };
    }

    const wordLocked = !user?.isMaster && !user?.examRecords?.romaji_daku_exam;
    if (wordLocked) {
        return {
            phase: 'Word準備',
            next: 'ローマ字テスト後',
            detail: 'Word未解放',
            percent,
            done,
            total,
            tone: 'blocked'
        };
    }

    if (word.done < word.total) {
        return {
            phase: 'Word',
            next: 'Wordれんしゅう',
            detail: formatRemaining(word.done, word.total),
            percent,
            done,
            total,
            tone: 'active'
        };
    }

    return {
        phase: '完了',
        next: '総合復習',
        detail: '標準ルート完了',
        percent: 100,
        done,
        total,
        tone: 'complete'
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
