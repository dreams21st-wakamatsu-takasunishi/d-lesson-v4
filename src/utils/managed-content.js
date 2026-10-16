const campusCatalogs = new Map();
export const CONTENT_KINDS = ['textTasks', 'customThemes', 'customEffects'];
const object = value => value && typeof value === 'object' && !Array.isArray(value);
const fail = () => { throw new Error('教材・ごほうびの内容を確認してください。'); };
function text(value, max, empty = false) {
    if (typeof value !== 'string' || value.length > max || (!empty && !value.trim())) fail();
    return value;
}
export function parseContentItem(kind, value) {
    if (!CONTENT_KINDS.includes(kind) || !object(value) || !/^[A-Za-z0-9_-]{1,100}$/.test(value.id || '')) fail();
    const base = { id: value.id, hidden: value.hidden === true };
    if (value.hidden != null && typeof value.hidden !== 'boolean') fail();
    if (kind === 'textTasks') {
        if (!Number.isInteger(value.time) || value.time < 1 || value.time > 60 || !Number.isInteger(value.star) || value.star < 1 || value.star > 5) fail();
        return { ...base, title: text(value.title, 160), content: text(value.content, 20000), time: value.time, star: value.star, targetGroup: text(value.targetGroup ?? '', 80, true) };
    }
    if (!value.id.startsWith(kind === 'customThemes' ? 'ct_' : 'ce_')) fail();
    const reward = { ...base, name: text(value.name, 80), distribution: value.distribution ?? 'gacha' };
    if (!['gacha', 'present'].includes(reward.distribution)) fail();
    if (kind === 'customThemes') {
        for (const key of ['bg', 'text', 'btnBg', 'btnText']) if (!/^#[a-f0-9]{6}$/i.test(value[key] || '')) fail();
        return { ...reward, bg: value.bg, text: value.text, btnBg: value.btnBg, btnText: value.btnText };
    }
    if (!Array.isArray(value.emojis) || value.emojis.length < 1 || value.emojis.length > 3) fail();
    return { ...reward, emojis: value.emojis.map(emoji => text(emoji, 32)) };
}
export function parseContentCatalog(value) {
    if (!object(value)) fail();
    const catalog = {};
    for (const kind of CONTENT_KINDS) {
        if (!Array.isArray(value[kind]) || value[kind].length > (kind === 'textTasks' ? 300 : 100)) fail();
        catalog[kind] = value[kind].map(item => parseContentItem(kind, item));
        if (new Set(catalog[kind].map(item => item.id)).size !== catalog[kind].length) fail();
    }
    return catalog;
}
export function replaceCampusCatalogs(rows = []) {
    const next = new Map();
    for (const row of rows) {
        if (!row || typeof row.campus_id !== 'string' || !row.campus_id || row.campus_id === 'public' || next.has(row.campus_id)) fail();
        next.set(row.campus_id, parseContentCatalog(row.content));
    }
    campusCatalogs.clear();
    for (const [key, value] of next) campusCatalogs.set(key, value);
}
export function campusLearningSettings(user = {}, globalSettings = {}) {
    const catalog = campusCatalogs.get(String(user.campusId || user.campus || 'main'));
    if (!catalog || user.campusId === 'public' || user.isMaster) return globalSettings;
    return { ...globalSettings, textTasks: catalog.textTasks,
        globalMistakes: { ...globalSettings.globalMistakes, customThemes: catalog.customThemes, customEffects: catalog.customEffects } };
}
