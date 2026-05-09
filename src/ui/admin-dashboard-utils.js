export function getDashboardProgressPercent(value, total) {
    const current = Number(value || 0);
    const max = Number(total || 0);
    if (!max) return 0;
    return Math.max(0, Math.min(100, Math.floor((current / max) * 100)));
}

export function getVisionDifficultySuffix(value) {
    return value === 'normal' ? '' : `_${value}`;
}
