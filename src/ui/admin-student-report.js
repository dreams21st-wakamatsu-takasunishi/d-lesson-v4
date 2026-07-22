import {
    users,
    GLOBAL_SETTINGS_ID,
    getUserDisplayName,
    getPracticeLogs,
    formatPracticeActivity,
    hasLessonRole,
    isSystemUserId
} from '../api/user.js';
import { VISION_STAGES, WORD_DATA } from '../data/constants.js';
import { calculateGrade } from '../utils/helpers.js';
import { getStageName } from '../utils/stages.js';
import {
    getActiveKeyboardStageIds,
    getCompletedActiveKeyboardStageIds,
    getKeyboardTargetStage
} from '../utils/keyboard-progression.js';
import { showCustomAlert } from './modal.js';
import { recordAdminAudit } from './admin-audit.js';
import {
    escapeHtml,
    buildVisionRadarData,
    buildVisionRadarDataFromAverageSnapshot,
    formatRecordSeconds,
    getTopMistakeDetails,
    renderVisionRadarChart,
    reportBar,
    reportSection
} from './admin-report-utils.js';

const STUDENT_REPORT_PRINT_WINDOW_FEATURES = 'popup=yes,width=980,height=760,menubar=no,toolbar=no,location=no,status=no,scrollbars=yes,resizable=yes';

function getSharedVisionRadarAverageSnapshot() {
    const snapshot = users?.[GLOBAL_SETTINGS_ID]?.visionRadarAverageSnapshot;
    return snapshot && Array.isArray(snapshot.groups) ? snapshot : null;
}

function buildReportVisionRadarData(user) {
    const sharedAverageSnapshot = getSharedVisionRadarAverageSnapshot();
    if (sharedAverageSnapshot && hasLessonRole('admin')) {
        return buildVisionRadarDataFromAverageSnapshot(user, sharedAverageSnapshot, VISION_STAGES);
    }
    return buildVisionRadarData(user, users, VISION_STAGES, isSystemUserId);
}

function buildPracticeLogReportHtml(userId) {
    const logs = getPracticeLogs(userId).slice(0, 12);
    if (!logs.length) {
        return '<p style="color:#777; margin:0;">取り組み履歴はまだありません。</p>';
    }

    return `<table style="width:100%; border-collapse:collapse; font-size:13px;">
        <thead>
            <tr>
                <th style="border:1px solid #ddd; padding:6px;">日時</th>
                <th style="border:1px solid #ddd; padding:6px;">練習</th>
                <th style="border:1px solid #ddd; padding:6px;">内容</th>
                <th style="border:1px solid #ddd; padding:6px;">コイン</th>
            </tr>
        </thead>
        <tbody>${logs.map(log => {
            const info = formatPracticeActivity(log);
            const at = Date.parse(log.at);
            const when = at ? new Date(at).toLocaleString('ja-JP') : '-';
            return `<tr>
                <td style="border:1px solid #ddd; padding:6px; white-space:nowrap;">${escapeHtml(when)}</td>
                <td style="border:1px solid #ddd; padding:6px;">${escapeHtml(info.title)}</td>
                <td style="border:1px solid #ddd; padding:6px;">${escapeHtml(info.detail)}</td>
                <td style="border:1px solid #ddd; padding:6px; text-align:right;">${escapeHtml(info.coinsText || '-')}</td>
            </tr>`;
        }).join('')}</tbody>
    </table>`;
}

function buildStudentReportHtml(userId) {
    const user = users[userId];
    const records = user.examRecords || {};
    const textRecords = user.textRecords || {};
    const wordProgress = user.wordProgress || {};
    const textTasks = users[GLOBAL_SETTINGS_ID]?.textTasks || [];
    const mouseLevel = user.mouseLevel || 0;
    const keyboardCompleted = getCompletedActiveKeyboardStageIds(user.keyboardSequence).length;
    const keyboardTotal = getActiveKeyboardStageIds().length;
    const visionDone = VISION_STAGES.reduce((count, stage) => {
        return count + ['_easy', '', '_hard'].filter(suffix => records[stage.id + suffix]).length;
    }, 0);
    const wordDone = Object.values(wordProgress).filter(progress => progress?.status === 'cleared').length;

    const keyboardTarget = getKeyboardTargetStage(user.keyboardSequence);
    const keyboardNext = keyboardTarget
        ? getStageName(keyboardTarget).replace(/\[ID:\d+\]\s*/, '')
        : '完了';

    const textRows = Object.keys(textRecords)
        .map(taskId => {
            const task = textTasks.find(t => t.id === taskId);
            const rec = textRecords[taskId] || {};
            return { title: task?.title || taskId, score: rec.score || 0, miss: rec.miss || 0, total: rec.total || 0 };
        })
        .sort((a, b) => b.score - a.score)
        .slice(0, 5);

    const textHtml = textRows.length
        ? `<table style="width:100%; border-collapse:collapse; font-size:13px;">
            <thead><tr><th style="border:1px solid #ddd; padding:6px;">課題</th><th style="border:1px solid #ddd; padding:6px;">純字数</th><th style="border:1px solid #ddd; padding:6px;">入力</th><th style="border:1px solid #ddd; padding:6px;">ミス</th></tr></thead>
            <tbody>${textRows.map(row => `<tr><td style="border:1px solid #ddd; padding:6px;">${escapeHtml(row.title)}</td><td style="border:1px solid #ddd; padding:6px; text-align:right;">${row.score}</td><td style="border:1px solid #ddd; padding:6px; text-align:right;">${row.total}</td><td style="border:1px solid #ddd; padding:6px; text-align:right;">${row.miss}</td></tr>`).join('')}</tbody>
        </table>`
        : '<p style="color:#777; margin:0;">文章練習の記録はまだありません。</p>';

    const visionRows = VISION_STAGES.map(stage => {
        const easy = records[stage.id + '_easy'];
        const normal = records[stage.id];
        const hard = records[stage.id + '_hard'];
        if (!easy && !normal && !hard) return '';
        return `<tr><td style="border:1px solid #ddd; padding:6px;">${escapeHtml(stage.title)}</td><td style="border:1px solid #ddd; padding:6px;">${formatRecordSeconds(easy)}</td><td style="border:1px solid #ddd; padding:6px;">${formatRecordSeconds(normal)}</td><td style="border:1px solid #ddd; padding:6px;">${formatRecordSeconds(hard)}</td></tr>`;
    }).filter(Boolean);
    const visionHtml = visionRows.length
        ? `<table style="width:100%; border-collapse:collapse; font-size:13px;">
            <thead><tr><th style="border:1px solid #ddd; padding:6px;">種目</th><th style="border:1px solid #ddd; padding:6px;">Easy</th><th style="border:1px solid #ddd; padding:6px;">Normal</th><th style="border:1px solid #ddd; padding:6px;">Hard</th></tr></thead>
            <tbody>${visionRows.join('')}</tbody>
        </table>`
        : '<p style="color:#777; margin:0;">ビジョンのタイム記録はまだありません。</p>';
    const visionRadarHtml = renderVisionRadarChart(
        buildReportVisionRadarData(user),
        { title: 'ビジョン平均との差', compact: true }
    );

    const mistakeList = getTopMistakeDetails(user);
    const mistakeHtml = mistakeList.length
        ? `<table style="width:100%; border-collapse:collapse; font-size:13px;">
            <thead>
                <tr>
                    <th style="border:1px solid #ffccbc; background:#fff3ed; padding:6px; text-align:left;">キー</th>
                    <th style="border:1px solid #ffccbc; background:#fff3ed; padding:6px; text-align:right; width:72px;">回数</th>
                </tr>
            </thead>
            <tbody>${mistakeList.map(item => `<tr>
                <td style="border:1px solid #ffccbc; padding:6px; font-weight:bold; color:#bf360c;">${escapeHtml(item.label)}</td>
                <td style="border:1px solid #ffccbc; padding:6px; text-align:right; color:#bf360c;">${item.count}回</td>
            </tr>`).join('')}</tbody>
        </table>`
        : '<p style="margin:0; color:#2e7d32; font-weight:bold;">目立った苦手キーはありません。</p>';
    const practiceLogHtml = buildPracticeLogReportHtml(userId);

    return `
        <div style="font-family:system-ui, sans-serif; color:#263238;">
            <div style="display:flex; justify-content:space-between; gap:16px; flex-wrap:wrap; border-bottom:2px solid #009688; padding-bottom:12px; margin-bottom:14px;">
                <div>
                    <div style="font-size:28px; font-weight:bold;">${escapeHtml(getUserDisplayName(userId))}</div>
                    <div style="color:#607d8b; font-size:13px;">user_data_id: ${escapeHtml(userId)}</div>
                </div>
                <div style="font-size:14px; line-height:1.7;">
                    <div>学年: <b>${escapeHtml(user.grade || calculateGrade(user.birthdate || user.birth))}</b></div>
                    <div>生年月日: <b>${escapeHtml(user.birthdate || user.birth || '-')}</b></div>
                    <div>グループ: <b>${escapeHtml(user.group || '-')}</b></div>
                    <div>作成日: <b>${new Date().toLocaleDateString('ja-JP')}</b></div>
                </div>
            </div>

            <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(210px, 1fr)); gap:12px; margin-bottom:12px;">
                ${reportSection('全体進捗', `
                    ${reportBar('マウス', mouseLevel, 7, '#2196F3')}
                    ${reportBar('キーボード', keyboardCompleted, keyboardTotal, '#FF9800')}
                    ${reportBar('ビジョン記録', visionDone, VISION_STAGES.length * 3, '#9C27B0')}
                    ${reportBar('ことば入力', wordDone, WORD_DATA.length, '#4CAF50')}
                `)}
                ${reportSection('現在の状態', `
                    <p style="margin:0 0 6px;">次のキーボード: <b>${escapeHtml(keyboardNext)}</b></p>
                    <p style="margin:0 0 6px;">コイン: <b>${user.coins || 0}</b></p>
                    <p style="margin:0 0 6px;">アイテム: <b>${(user.items || []).length}</b></p>
                    <p style="margin:0;">練習スタンプ: <b>${(user.loginStamps || []).length}</b></p>
                `)}
                ${reportSection('苦手キー', mistakeHtml)}
            </div>

            <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(320px, 1fr)); gap:12px;">
                ${reportSection('文章練習', textHtml)}
                ${reportSection('ビジョン平均との差', visionRadarHtml)}
                ${reportSection('ビジョントレーニング', visionHtml)}
                ${reportSection('直近の取り組み', practiceLogHtml)}
            </div>
        </div>
    `;
}

export function openStudentReportPanel(userId) {
    if (!userId || !users[userId]) return showCustomAlert('ユーザーを選択してください');
    const modal = document.getElementById('student-report-modal');
    const title = document.getElementById('student-report-title');
    const content = document.getElementById('student-report-content');
    if (!modal || !title || !content) return;

    title.innerText = `${getUserDisplayName(userId)} さんのレポート`;
    content.dataset.userId = userId;
    content.innerHTML = buildStudentReportHtml(userId);
    recordAdminAudit('児童レポート表示', { user: getUserDisplayName(userId), userDataId: userId });
    modal.style.display = 'flex';
}

export function closeStudentReportPanel() {
    const modal = document.getElementById('student-report-modal');
    if (modal) modal.style.display = 'none';
}

function getReportPrintStyles() {
    return `
        @page{margin:14mm;}
        body{background:#fff;margin:0;padding:0;font-family:system-ui,sans-serif;color:#263238;}
        section{break-inside:avoid;}
        button{display:none;}
        .vision-radar-card{border:1px solid #cfd8dc;border-radius:10px;padding:10px;background:#fff;}
        .vision-radar-head{display:flex;justify-content:space-between;gap:10px;border-bottom:1px solid #eceff1;padding-bottom:6px;margin-bottom:8px;}
        .vision-radar-head h4{margin:0;color:#37474f;font-size:16px;}
        .vision-radar-head span{color:#455a64;font-weight:bold;font-size:12px;}
        .vision-radar-layout{display:grid;grid-template-columns:1fr;gap:8px;}
        .vision-radar-figure{text-align:center;}
        .vision-radar-chart{width:260px;max-width:100%;height:auto;}
        .vision-radar-rings polygon{fill:none;stroke:#d8e2ea;stroke-width:1.5;}
        .vision-radar-axis line{stroke:#e0e7ee;stroke-width:1.4;}
        .vision-radar-axis text{fill:#37474f;font-size:15px;font-weight:800;text-anchor:middle;dominant-baseline:middle;paint-order:stroke;stroke:#fff;stroke-width:5px;stroke-linejoin:round;}
        .vision-radar-average{fill:rgba(96,125,139,.12);stroke:#607d8b;stroke-width:3;stroke-dasharray:8 7;}
        .vision-radar-user{fill:rgba(33,150,243,.28);stroke:#1565c0;stroke-width:4;}
        .vision-radar-center{fill:#1565c0;}
        .vision-radar-legend,.vision-radar-note{font-size:11px;color:#607d8b;font-weight:bold;}
        .vision-radar-summary{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px;}
        .vision-radar-row{border:1px solid #dce5ec;border-left:5px solid #90a4ae;border-radius:8px;padding:6px;background:#f8fafc;display:flex;justify-content:space-between;gap:8px;}
        .vision-radar-row b,.vision-radar-row strong{color:#263238;}
        .vision-radar-row span{display:block;color:#607d8b;font-size:10px;font-weight:bold;}
    `;
}

export function printStudentReportPanel() {
    const content = document.getElementById('student-report-content');
    if (!content || !content.innerHTML.trim()) return;
    const userId = content.dataset.userId;
    const title = userId && users[userId] ? `${getUserDisplayName(userId)} さんのレポート` : '児童レポート';
    const printWindow = window.open('', '_blank', STUDENT_REPORT_PRINT_WINDOW_FEATURES);
    if (!printWindow) return showCustomAlert('印刷画面を開けませんでした。ポップアップ設定を確認してください。');
    printWindow.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title><style>${getReportPrintStyles()}</style></head><body>${content.innerHTML}</body></html>`);
    printWindow.document.close();
    printWindow.focus();
    recordAdminAudit('児童レポート印刷', { user: title, userDataId: userId || '' });
    printWindow.print();
}
