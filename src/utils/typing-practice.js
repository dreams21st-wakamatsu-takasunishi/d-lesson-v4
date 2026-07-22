const DEFAULT_RAPID_MISTYPE_OPTIONS = Object.freeze({
    windowMs: 650,
    minCount: 4,
    minDistinctKeys: 3
});

export function buildSequentialPracticeRounds(chars, rounds = 3, extras = {}) {
    const source = Array.isArray(chars) ? chars : [];
    const repeatCount = Math.max(0, Number(rounds) || 0);
    const queue = [];

    for (let round = 0; round < repeatCount; round++) {
        source.forEach(char => queue.push({ ...char, ...extras }));
    }
    return queue;
}

export function registerRapidMistype(history, key, timestamp = Date.now(), options = {}) {
    const settings = { ...DEFAULT_RAPID_MISTYPE_OPTIONS, ...options };
    const normalizedKey = String(key || '').toUpperCase();
    const recent = (Array.isArray(history) ? history : [])
        .filter(event => timestamp - event.timestamp <= settings.windowMs);

    if (normalizedKey) recent.push({ key: normalizedKey, timestamp });

    const distinctKeys = new Set(recent.map(event => event.key)).size;
    const shouldWarn = recent.length >= settings.minCount
        && distinctKeys >= settings.minDistinctKeys;

    return {
        history: shouldWarn ? [] : recent,
        shouldWarn
    };
}
