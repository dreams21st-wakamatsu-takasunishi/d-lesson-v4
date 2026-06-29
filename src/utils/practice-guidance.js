export function findLatestPracticeLog(logs = [], categories = []) {
    const categorySet = new Set(categories.map(String));
    return (Array.isArray(logs) ? logs : [])
        .find(log => categorySet.has(String(log?.category || ''))) || null;
}

export function formatPracticeLogShort(log, emptyText = '前回: まだありません') {
    if (!log) return emptyText;
    const at = Date.parse(log.at);
    const when = at ? new Date(at).toLocaleString('ja-JP', {
        month: 'numeric',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    }) : '';
    const title = String(log.title || '練習').replace(/^文章入力\s*/, '').trim();
    return `前回: ${[when, title].filter(Boolean).join(' ')}`;
}

export function buildProgressLabel(done, total) {
    const safeDone = Math.max(0, Number(done || 0));
    const safeTotal = Math.max(0, Number(total || 0));
    if (safeTotal <= 0) return '未設定';
    return `${safeDone}/${safeTotal}`;
}
