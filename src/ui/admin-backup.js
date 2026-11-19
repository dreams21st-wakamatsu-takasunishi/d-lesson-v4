import { users, isSystemUserId } from '../api/user.js';
import { getBackupDateStamp } from '../utils/export-format.js';
import { loadAdminAuditLog, recordAdminAudit } from './admin-audit.js';

function countStudentRows(collection) {
    if (!collection || typeof collection !== 'object') return 0;
    return getImportedStudentIds(collection).length;
}

function getImportedStudentIds(collection) {
    if (!collection || typeof collection !== 'object') return [];
    return Object.keys(collection).filter(userId => {
        const row = collection[userId];
        return row && typeof row === 'object' && !Array.isArray(row) && !row.isMaster && !isSystemUserId(userId);
    });
}


function buildBackupPayload() {
    return {
        app: 'd-lesson',
        version: 3,
        exportedAt: new Date().toISOString(),
        users,
        adminAuditLog: loadAdminAuditLog()
    };
}

function downloadJsonFile(payload, prefix) {
    const dataStr = JSON.stringify(payload, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${prefix}_${getBackupDateStamp()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    return a.download;
}


export function exportAdminBackupData() {
    recordAdminAudit('データバックアップ', { students: countStudentRows(users) });
    const backup = buildBackupPayload();
    downloadJsonFile(backup, 'd-lesson_backup');
}
