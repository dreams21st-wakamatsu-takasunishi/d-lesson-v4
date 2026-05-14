export const MAX_REASONABLE_MISTAKE_COUNT = 100000;

const RESERVED_GLOBAL_MISTAKE_KEYS = new Set([
    'customThemes',
    'customEffects'
]);

export function normalizeMistakeCount(value) {
    const count = Number(value);
    if (!Number.isFinite(count) || count <= 0) return 0;
    if (count > MAX_REASONABLE_MISTAKE_COUNT) return 0;
    return Math.floor(count);
}

export function isValidMistakeKey(key) {
    const text = String(key ?? '').trim();
    if (!text) return false;
    if (RESERVED_GLOBAL_MISTAKE_KEYS.has(text)) return false;
    return true;
}

export function getValidMistakeEntries(mistakes, limit = Infinity) {
    if (!mistakes || typeof mistakes !== 'object' || Array.isArray(mistakes)) return [];
    return Object.keys(mistakes)
        .map(key => ({
            key,
            count: normalizeMistakeCount(mistakes[key])
        }))
        .filter(item => isValidMistakeKey(item.key) && item.count > 0)
        .sort((a, b) => b.count - a.count)
        .slice(0, limit);
}

export function hasValidMistakes(mistakes) {
    return getValidMistakeEntries(mistakes, 1).length > 0;
}

export function sanitizeGlobalMistakes(mistakes) {
    const sanitized = {};
    getValidMistakeEntries(mistakes).forEach(item => {
        sanitized[item.key] = item.count;
    });
    return sanitized;
}
