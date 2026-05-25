import { escapeCsvCell } from '../utils/export-format.js';

export function getLocalDateKey(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

export function buildPracticeHistoryRows(users, helpers) {
    const {
        getUserDisplayName,
        isSystemUserId,
        getPracticeLogs,
        formatPracticeActivity,
        calculateGrade
    } = helpers;
    const rows = [];
    Object.keys(users)
        .filter(userId => users[userId] && !users[userId].isMaster && !isSystemUserId(userId))
        .forEach(userId => {
            const user = users[userId];
            const grade = (user.grade && String(user.grade) !== 'undefined') ? user.grade : calculateGrade(user.birthdate || user.birth);
            const group = user.group || '';
            getPracticeLogs(userId).forEach(log => {
                const atMs = Date.parse(log.at);
                if (!atMs) return;
                const info = formatPracticeActivity(log);
                rows.push({
                    userId,
                    name: getUserDisplayName(userId),
                    grade,
                    group,
                    category: String(log.category || 'practice'),
                    dateKey: getLocalDateKey(log.at),
                    timeText: new Date(atMs).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' }),
                    atMs,
                    title: info.title,
                    detail: log.detail || '',
                    amount: log.amount || '',
                    coins: Number(log.coins || 0)
                });
            });
        });

    rows.sort((a, b) => b.atMs - a.atMs || a.name.localeCompare(b.name, 'ja'));
    return rows;
}

export function buildPracticeHistoryCsv(rows) {
    const csvRows = [['date', 'time', 'student_name', 'grade', 'group', 'category', 'practice', 'detail', 'amount', 'coins']];
    rows.forEach(row => {
        csvRows.push([
            row.dateKey,
            row.timeText,
            row.name,
            row.grade || '',
            row.group || '',
            row.category || '',
            row.title,
            row.detail || '',
            row.amount || '',
            row.coins || 0
        ]);
    });

    return csvRows.map(row => row.map(escapeCsvCell).join(',')).join('\r\n');
}
