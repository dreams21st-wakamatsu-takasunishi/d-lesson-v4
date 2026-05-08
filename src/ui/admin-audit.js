import { currentUser, users, hasLessonRole, getUserDisplayName } from '../api/user.js';
import { escapeCsvCell, getBackupDateStamp } from '../utils/export-format.js';

const ADMIN_AUDIT_STORAGE_KEY = 'd_lesson_admin_audit_log';
const ADMIN_AUDIT_LIMIT = 200;

export function loadAdminAuditLog() {
    try {
        const raw = localStorage.getItem(ADMIN_AUDIT_STORAGE_KEY);
        const parsed = raw ? JSON.parse(raw) : [];
        return normalizeAdminAuditLog(parsed);
    } catch (err) {
        console.warn('Failed to load admin audit log:', err);
        return [];
    }
}

function saveAdminAuditLog(log) {
    localStorage.setItem(ADMIN_AUDIT_STORAGE_KEY, JSON.stringify(normalizeAdminAuditLog(log)));
}

function normalizeAdminAuditLog(log) {
    if (!Array.isArray(log)) return [];
    return log
        .filter(entry => entry && typeof entry === 'object')
        .map(entry => ({
            id: String(entry.id || `audit_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`),
            at: entry.at || new Date().toISOString(),
            actor: String(entry.actor || ''),
            action: String(entry.action || ''),
            details: entry.details && typeof entry.details === 'object' ? entry.details : {}
        }))
        .slice(0, ADMIN_AUDIT_LIMIT);
}

function getAdminActorLabel() {
    if (hasLessonRole('admin')) return 'Supabase admin';
    if (currentUser && users[currentUser]) return `legacy admin after ${getUserDisplayName(currentUser)}`;
    return 'legacy admin';
}

function summarizeAuditDetails(details = {}) {
    return Object.entries(details)
        .filter(([, value]) => value !== undefined && value !== null && value !== '')
        .map(([key, value]) => `${key}: ${Array.isArray(value) ? value.join(', ') : value}`)
        .join(' / ');
}

export function recordAdminAudit(action, details = {}) {
    const log = loadAdminAuditLog();
    log.unshift({
        id: `audit_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        at: new Date().toISOString(),
        actor: getAdminActorLabel(),
        action,
        details
    });
    saveAdminAuditLog(log);
    renderAdminAuditLog();
}

export function restoreAdminAuditLog(importedLog, restoreDetails = {}) {
    saveAdminAuditLog(normalizeAdminAuditLog(importedLog));
    recordAdminAudit('データ復元', restoreDetails);
}

export function renderAdminAuditLog() {
    const tbody = document.getElementById('admin-audit-tbody');
    if (!tbody) return;
    const log = loadAdminAuditLog();
    tbody.innerHTML = '';

    if (log.length === 0) {
        const tr = document.createElement('tr');
        const td = document.createElement('td');
        td.colSpan = 3;
        td.style.cssText = 'border:1px solid #ddd; padding:10px; color:#777; text-align:center;';
        td.innerText = 'まだ操作ログがありません';
        tr.appendChild(td);
        tbody.appendChild(tr);
        return;
    }

    log.slice(0, 80).forEach(entry => {
        const tr = document.createElement('tr');
        const dateTd = document.createElement('td');
        dateTd.style.cssText = 'border:1px solid #ddd; padding:6px; white-space:nowrap;';
        dateTd.innerText = entry.at ? new Date(entry.at).toLocaleString('ja-JP') : '';
        tr.appendChild(dateTd);

        const actionTd = document.createElement('td');
        actionTd.style.cssText = 'border:1px solid #ddd; padding:6px; white-space:nowrap;';
        actionTd.innerText = entry.action || '';
        tr.appendChild(actionTd);

        const detailTd = document.createElement('td');
        detailTd.style.cssText = 'border:1px solid #ddd; padding:6px; word-break:break-word;';
        detailTd.innerText = summarizeAuditDetails({ actor: entry.actor, ...(entry.details || {}) });
        tr.appendChild(detailTd);

        tbody.appendChild(tr);
    });
}

export function exportAdminAuditCsv() {
    const log = loadAdminAuditLog();
    const rows = [['datetime', 'action', 'actor', 'details']];
    log.forEach(entry => {
        rows.push([
            entry.at ? new Date(entry.at).toLocaleString('ja-JP') : '',
            entry.action || '',
            entry.actor || '',
            summarizeAuditDetails(entry.details || {})
        ]);
    });

    const csv = rows.map(row => row.map(escapeCsvCell).join(',')).join('\r\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `d-lesson_admin_audit_${getBackupDateStamp()}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    recordAdminAudit('操作ログCSV出力', { rows: log.length });
}
