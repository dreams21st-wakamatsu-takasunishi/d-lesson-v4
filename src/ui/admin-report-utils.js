import { getValidMistakeEntries } from '../utils/weak-mistakes.js';

export function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

export function progressPercent(value, total) {
    if (!total) return 0;
    return Math.max(0, Math.min(100, Math.floor((value / total) * 100)));
}

export function reportBar(label, value, total, color) {
    const pct = progressPercent(value, total);
    return `
        <div style="margin-bottom:10px;">
            <div style="display:flex; justify-content:space-between; gap:10px; font-weight:bold; font-size:14px;">
                <span>${escapeHtml(label)}</span><span>${value}/${total} (${pct}%)</span>
            </div>
            <div style="height:14px; background:#eee; border-radius:8px; overflow:hidden; margin-top:4px;">
                <div style="width:${pct}%; height:100%; background:${color};"></div>
            </div>
        </div>
    `;
}

export function reportSection(title, body) {
    return `
        <section style="border:1px solid #ddd; border-radius:8px; padding:14px; background:#fff; break-inside:avoid;">
            <h4 style="margin:0 0 10px; color:#37474f; border-bottom:1px solid #eee; padding-bottom:6px;">${escapeHtml(title)}</h4>
            ${body}
        </section>
    `;
}

export function formatRecordSeconds(value) {
    return typeof value === 'number' ? `${value.toFixed(1)}\u79d2` : '-';
}

export const VISION_RADAR_GROUPS = [
    { id: 'find', label: '見つける', stageIds: ['v1', 'v2', 'v5', 'v12', 'v15', 'v18', 'v20'] },
    { id: 'compare', label: 'くらべる', stageIds: ['v13', 'v14', 'v17'] },
    { id: 'react', label: '反応する', stageIds: ['v3', 'v6', 'v10'] },
    { id: 'memory', label: '覚える', stageIds: ['v4', 'v7', 'v9', 'v11', 'v19'] },
    { id: 'track', label: '目で追う', stageIds: ['v8', 'v16'] }
];

const VISION_RADAR_DIFFICULTY_SUFFIXES = ['_easy', '', '_hard'];
const VISION_RADAR_MAX_SCORE = 160;
const VISION_RADAR_AVERAGE_SCORE = 100;
const VISION_RADAR_MIN_USER_RECORDS = 3;
const VISION_RADAR_MIN_CLASS_RECORDS = 3;

function average(values) {
    const valid = values.filter(value => Number.isFinite(value) && value > 0);
    if (!valid.length) return null;
    return valid.reduce((sum, value) => sum + value, 0) / valid.length;
}

function collectVisionTimes(records, stageIds) {
    if (!records) return [];
    const times = [];
    stageIds.forEach(stageId => {
        VISION_RADAR_DIFFICULTY_SUFFIXES.forEach(suffix => {
            const value = Number(records[stageId + suffix]);
            if (Number.isFinite(value) && value > 0) times.push(value);
        });
    });
    return times;
}

function clampRadarScore(score) {
    if (!Number.isFinite(score)) return 0;
    return Math.max(0, Math.min(VISION_RADAR_MAX_SCORE, Math.round(score)));
}

function getVisionRadarReliability(userRecordCount, classRecordCount) {
    if (userRecordCount <= 0) return { level: 'empty', label: '本人記録なし' };
    if (classRecordCount <= 0) return { level: 'waiting', label: '平均データ待ち' };
    const userOk = userRecordCount >= VISION_RADAR_MIN_USER_RECORDS;
    const classOk = classRecordCount >= VISION_RADAR_MIN_CLASS_RECORDS;
    if (userOk && classOk) return { level: 'stable', label: '判定に使用可' };
    return { level: 'low', label: '記録少なめ' };
}

function isAverageTargetUser(userId, user, isSystemUserId) {
    if (!userId || !user || user.isMaster) return false;
    if (String(userId).startsWith('__')) return false;
    if (typeof isSystemUserId === 'function' && isSystemUserId(userId)) return false;
    return Boolean(user.examRecords && typeof user.examRecords === 'object');
}

function getVisionRadarStageIds(group, visionStages) {
    const stageIdSet = new Set((visionStages || []).map(stage => stage.id));
    return group.stageIds.filter(stageId => stageIdSet.size === 0 || stageIdSet.has(stageId));
}

export function buildVisionRadarAverageSnapshot(allUsers = {}, visionStages = [], isSystemUserId = null) {
    const averageUsers = Object.entries(allUsers || {})
        .filter(([userId, row]) => isAverageTargetUser(userId, row, isSystemUserId))
        .map(([, row]) => row);

    const groups = VISION_RADAR_GROUPS.map(group => {
        const stageIds = getVisionRadarStageIds(group, visionStages);
        const classTimes = averageUsers.flatMap(row => collectVisionTimes(row.examRecords, stageIds));
        const classAverage = average(classTimes);

        return {
            id: group.id,
            label: group.label,
            stageIds,
            classAverage,
            classRecordCount: classTimes.length,
            totalRecordSlots: stageIds.length * VISION_RADAR_DIFFICULTY_SUFFIXES.length,
            hasClassData: classTimes.length > 0
        };
    });

    return {
        version: 1,
        groups,
        maxScore: VISION_RADAR_MAX_SCORE,
        averageScore: VISION_RADAR_AVERAGE_SCORE,
        hasAnyClassData: groups.some(group => group.hasClassData)
    };
}

export function buildVisionRadarDataFromAverageSnapshot(user, averageSnapshot = null, visionStages = []) {
    const snapshotGroups = new Map((averageSnapshot?.groups || []).map(group => [group.id, group]));

    const groups = VISION_RADAR_GROUPS.map(group => {
        const stageIds = getVisionRadarStageIds(group, visionStages);
        const snapshot = snapshotGroups.get(group.id) || {};
        const userTimes = collectVisionTimes(user?.examRecords, stageIds);
        const userAverage = average(userTimes);
        const classAverageValue = Number(snapshot.classAverage);
        const classAverage = Number.isFinite(classAverageValue) && classAverageValue > 0 ? classAverageValue : null;
        const rawScore = userAverage && classAverage ? (classAverage / userAverage) * 100 : 0;
        const score = clampRadarScore(rawScore);
        const differenceSeconds = userAverage && classAverage ? userAverage - classAverage : null;
        const classRecordCount = Number(snapshot.classRecordCount || 0);
        const totalRecordSlots = Number(snapshot.totalRecordSlots || (stageIds.length * VISION_RADAR_DIFFICULTY_SUFFIXES.length));
        const reliability = getVisionRadarReliability(userTimes.length, classRecordCount);

        return {
            ...group,
            stageIds,
            score,
            userAverage,
            classAverage,
            differenceSeconds,
            completionCount: userTimes.length,
            classRecordCount,
            totalRecordSlots,
            reliability: reliability.level,
            reliabilityLabel: reliability.label,
            hasUserData: userTimes.length > 0,
            hasClassData: classAverage !== null && classRecordCount > 0
        };
    });

    return {
        groups,
        maxScore: VISION_RADAR_MAX_SCORE,
        averageScore: VISION_RADAR_AVERAGE_SCORE,
        hasAnyUserData: groups.some(group => group.hasUserData),
        hasAnyClassData: groups.some(group => group.hasClassData)
    };
}

export function buildVisionRadarData(user, allUsers = {}, visionStages = [], isSystemUserId = null) {
    const averageUsers = Object.entries(allUsers)
        .filter(([userId, row]) => isAverageTargetUser(userId, row, isSystemUserId))
        .map(([, row]) => row);

    const groups = VISION_RADAR_GROUPS.map(group => {
        const stageIds = getVisionRadarStageIds(group, visionStages);
        const userTimes = collectVisionTimes(user?.examRecords, stageIds);
        const classTimes = averageUsers.flatMap(row => collectVisionTimes(row.examRecords, stageIds));
        const userAverage = average(userTimes);
        const classAverage = average(classTimes);
        const rawScore = userAverage && classAverage ? (classAverage / userAverage) * 100 : 0;
        const score = clampRadarScore(rawScore);
        const differenceSeconds = userAverage && classAverage ? userAverage - classAverage : null;
        const reliability = getVisionRadarReliability(userTimes.length, classTimes.length);

        return {
            ...group,
            stageIds,
            score,
            userAverage,
            classAverage,
            differenceSeconds,
            completionCount: userTimes.length,
            classRecordCount: classTimes.length,
            totalRecordSlots: stageIds.length * VISION_RADAR_DIFFICULTY_SUFFIXES.length,
            reliability: reliability.level,
            reliabilityLabel: reliability.label,
            hasUserData: userTimes.length > 0,
            hasClassData: classTimes.length > 0
        };
    });

    return {
        groups,
        maxScore: VISION_RADAR_MAX_SCORE,
        averageScore: VISION_RADAR_AVERAGE_SCORE,
        hasAnyUserData: groups.some(group => group.hasUserData),
        hasAnyClassData: groups.some(group => group.hasClassData)
    };
}

function radarPoint(index, count, score, radius, center) {
    const angle = -Math.PI / 2 + (Math.PI * 2 * index) / count;
    const distance = radius * (Math.max(0, Math.min(VISION_RADAR_MAX_SCORE, score)) / VISION_RADAR_MAX_SCORE);
    return {
        x: center + Math.cos(angle) * distance,
        y: center + Math.sin(angle) * distance
    };
}

function radarPolygon(groups, scoreGetter, radius, center) {
    return groups
        .map((group, index) => {
            const point = radarPoint(index, groups.length, scoreGetter(group), radius, center);
            return `${point.x.toFixed(1)},${point.y.toFixed(1)}`;
        })
        .join(' ');
}

function formatVisionAverage(value) {
    return Number.isFinite(value) ? `${value.toFixed(1)}秒` : '-';
}

function formatVisionDifference(group) {
    if (!group.hasUserData) return '記録なし';
    if (!group.hasClassData) return '平均データ待ち';
    if (!Number.isFinite(group.differenceSeconds)) return '平均データ待ち';
    const abs = Math.abs(group.differenceSeconds).toFixed(1);
    if (Math.abs(group.differenceSeconds) < 0.05) return '平均と同じくらい';
    return group.differenceSeconds < 0 ? `平均より ${abs}秒 はやい` : `平均より ${abs}秒 ゆっくり`;
}

function getVisionRadarTone(group) {
    if (!group.hasUserData || !group.hasClassData) return 'empty';
    if (group.reliability === 'low') return 'low-data';
    if (group.score >= 108) return 'faster';
    if (group.score <= 92) return 'slower';
    return 'average';
}

export function renderVisionRadarChart(radarData, options = {}) {
    const groups = radarData?.groups || [];
    const title = options.title || 'ビジョン平均との差';
    const compactClass = options.compact ? ' compact' : '';
    if (!groups.length || !radarData?.hasAnyUserData) {
        return `
            <div class="vision-radar-card${compactClass}">
                <div class="vision-radar-head">
                    <h4>${escapeHtml(title)}</h4>
                    <span>平均 100 / 3件以上で判定</span>
                </div>
                <p class="vision-radar-empty">ビジョントレーニングの記録が増えると、平均との差がレーダーチャートで表示されます。</p>
            </div>
        `;
    }

    const center = 180;
    const radius = 122;
    const rings = [50, 100, 150];
    const axisLines = groups.map((group, index) => {
        const point = radarPoint(index, groups.length, VISION_RADAR_MAX_SCORE, radius, center);
        const labelPoint = radarPoint(index, groups.length, VISION_RADAR_MAX_SCORE + 18, radius, center);
        return `
            <line x1="${center}" y1="${center}" x2="${point.x.toFixed(1)}" y2="${point.y.toFixed(1)}" />
            <text x="${labelPoint.x.toFixed(1)}" y="${labelPoint.y.toFixed(1)}">${escapeHtml(group.label)}</text>
        `;
    }).join('');
    const ringPolygons = rings.map(value => `<polygon points="${radarPolygon(groups, () => value, radius, center)}" />`).join('');
    const averagePolygon = radarPolygon(groups, () => VISION_RADAR_AVERAGE_SCORE, radius, center);
    const userPolygon = radarPolygon(groups, group => group.score, radius, center);
    const summaryRows = groups.map(group => {
        const tone = getVisionRadarTone(group);
        return `
            <div class="vision-radar-row ${tone}">
                <div>
                    <b>${escapeHtml(group.label)}</b>
                    <span>${group.completionCount}/${group.totalRecordSlots} 記録</span>
                    <span>本人 ${formatVisionAverage(group.userAverage)} / 平均 ${formatVisionAverage(group.classAverage)}</span>
                    <span>${escapeHtml(group.reliabilityLabel || '')}</span>
                </div>
                <div>
                    <strong>${group.hasUserData ? group.score : '-'}</strong>
                    <span>${escapeHtml(formatVisionDifference(group))}</span>
                </div>
            </div>
        `;
    }).join('');

    return `
        <div class="vision-radar-card${compactClass}">
            <div class="vision-radar-head">
                <h4>${escapeHtml(title)}</h4>
                <span>平均 100 / 3件以上で判定</span>
            </div>
            <div class="vision-radar-layout">
                <div class="vision-radar-figure">
                    <svg class="vision-radar-chart" viewBox="0 0 360 360" role="img" aria-label="${escapeHtml(title)}">
                        <g class="vision-radar-rings">${ringPolygons}</g>
                        <g class="vision-radar-axis">${axisLines}</g>
                        <polygon class="vision-radar-average" points="${averagePolygon}" />
                        <polygon class="vision-radar-user" points="${userPolygon}" />
                        <circle cx="${center}" cy="${center}" r="3" class="vision-radar-center" />
                    </svg>
                    <div class="vision-radar-legend">
                        <span><i class="vision-radar-legend-user"></i>本人</span>
                        <span><i class="vision-radar-legend-average"></i>平均</span>
                    </div>
                </div>
                <div class="vision-radar-summary">
                    ${summaryRows}
                </div>
            </div>
            <div class="vision-radar-note">
                タイムが短いほど外側に伸びます。Easy、Normal、Hardの記録を分類ごとにまとめ、表示できる児童の平均タイムと比較しています。
            </div>
        </div>
    `;
}

const SPECIAL_KEY_LABELS = {
    ' ': 'スペースキー',
    '　': 'スペースキー',
    SPACE: 'スペースキー',
    SPACEBAR: 'スペースキー',
    ENTER: 'Enterキー',
    RETURN: 'Enterキー',
    BACKSPACE: 'Backspaceキー',
    TAB: 'Tabキー',
    ESC: 'Escキー',
    ESCAPE: 'Escキー',
    SHIFT: 'Shiftキー',
    CONTROL: 'Ctrlキー',
    CTRL: 'Ctrlキー',
    ALT: 'Altキー',
    META: 'Windowsキー',
    CAPSLOCK: 'CapsLockキー',
    ARROWUP: '↑キー',
    ARROWDOWN: '↓キー',
    ARROWLEFT: '←キー',
    ARROWRIGHT: '→キー'
};

const SYMBOL_KEY_LABELS = {
    '=': '=（イコール）',
    '+': '+（プラス）',
    '-': '-（マイナス）',
    '_': '_（アンダーバー）',
    '*': '*（アスタリスク）',
    '/': '/（スラッシュ）',
    '\\': '\\（バックスラッシュ）',
    '|': '|（縦線）',
    '.': '.（ピリオド）',
    ',': ',（カンマ）',
    ':': ':（コロン）',
    ';': ';（セミコロン）',
    '?': '?（クエスチョン）',
    '!': '!（びっくり）',
    '@': '@（アットマーク）',
    '#': '#（シャープ）',
    '$': '$（ドル）',
    '%': '%（パーセント）',
    '&': '&（アンド）',
    '^': '^（キャレット）',
    '~': '~（チルダ）',
    '`': '`（バッククォート）',
    '"': '"（ダブルクォート）',
    "'": "'（アポストロフィ）",
    '(': '(（左かっこ）',
    ')': ')（右かっこ）',
    '[': '[（左角かっこ）',
    ']': ']（右角かっこ）',
    '{': '{（左波かっこ）',
    '}': '}（右波かっこ）',
    '<': '<（小なり）',
    '>': '>（大なり）'
};

export function formatWeakKeyLabel(key) {
    const raw = String(key ?? '');
    const trimmed = raw.trim();
    const lookup = trimmed || raw;
    const upper = lookup.toUpperCase();
    if (SPECIAL_KEY_LABELS[lookup]) return SPECIAL_KEY_LABELS[lookup];
    if (SPECIAL_KEY_LABELS[upper]) return SPECIAL_KEY_LABELS[upper];
    if (SYMBOL_KEY_LABELS[lookup]) return `キー「${SYMBOL_KEY_LABELS[lookup]}」`;
    if (/^KEY[A-Z]$/.test(upper)) return `キー「${upper.slice(3)}」`;
    if (/^DIGIT\d$/.test(upper)) return `キー「${upper.slice(5)}」`;
    if (!trimmed) return '不明なキー';
    return `キー「${trimmed}」`;
}

export function getTopMistakeDetails(user, limit = 8) {
    return getValidMistakeEntries(user?.globalMistakes, limit)
        .map(key => ({
            key: key.key,
            label: formatWeakKeyLabel(key.key),
            count: key.count
        }));
}

export function getTopMistakes(user, limit = 8) {
    return getTopMistakeDetails(user, limit)
        .map(item => `${item.label}：${item.count}回`);
}
