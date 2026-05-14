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
