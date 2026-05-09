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

export function getTopMistakes(user, limit = 8) {
    const mistakes = user?.globalMistakes || {};
    return Object.keys(mistakes)
        .filter(key => mistakes[key] > 0)
        .sort((a, b) => mistakes[b] - mistakes[a])
        .slice(0, limit)
        .map(key => `${key === 'SPACE' ? '\u7a7a\u767d' : key}(${mistakes[key]})`);
}
