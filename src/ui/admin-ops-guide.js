import {
    users,
    saveUsers,
    getCurrentLessonRole,
    getTeacherScopeSummary,
    HAS_SUPABASE_CONFIG,
    ENABLE_LEGACY_SUPABASE_SYNC,
    ENABLE_RLS_CLOUD_SYNC,
    ENABLE_SETTINGS_TABLE,
    REQUIRE_SUPABASE_AUTH,
    GLOBAL_SETTINGS_ID,
    SETTINGS_TABLE_KEY,
    getUserDisplayName,
    isSystemUserId,
    getStudentIdleLogoutMinutes,
    refreshStudentIdleLogoutTimer
} from '../api/user.js';
import { getLegacyAdminPassStatus } from '../utils/security.js';
import { showCustomAlert } from './modal.js';
import { recordAdminAudit } from './admin-audit.js';

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

async function copyText(text) {
    try {
        await navigator.clipboard.writeText(text);
        showCustomAlert('コピーしました。');
    } catch (err) {
        console.warn('Clipboard copy failed:', err);
        showCustomAlert(text);
    }
}

function renderOpsStatusCard(label, value, tone = 'neutral') {
    const colors = {
        good: ['#e8f5e9', '#2e7d32'],
        warn: ['#fff8e1', '#ef6c00'],
        bad: ['#ffebee', '#c62828'],
        neutral: ['#eceff1', '#37474f']
    };
    const [bg, color] = colors[tone] || colors.neutral;
    return `
        <div style="background:${bg}; border:1px solid ${color}; border-radius:8px; padding:12px;">
            <div style="font-size:12px; color:#546e7a; margin-bottom:4px;">${escapeHtml(label)}</div>
            <div style="font-size:18px; font-weight:bold; color:${color};">${escapeHtml(value)}</div>
        </div>
      `;
  }

function ensureGlobalSettings() {
    if (!users[GLOBAL_SETTINGS_ID]) users[GLOBAL_SETTINGS_ID] = { isMaster: true };
    users[GLOBAL_SETTINGS_ID].isMaster = true;
    return users[GLOBAL_SETTINGS_ID];
}

function renderStudentIdleLogoutSetting() {
    const input = document.getElementById('student-idle-logout-minutes');
    if (!input) return;
    input.value = String(getStudentIdleLogoutMinutes());
}

export async function saveStudentIdleLogoutSetting() {
    const input = document.getElementById('student-idle-logout-minutes');
    const rawValue = input?.value ?? '';
    const minutes = Number.parseInt(rawValue, 10);

    if (!Number.isFinite(minutes) || minutes < 0 || minutes > 240) {
        showCustomAlert('0〜240分の範囲で入力してください。0分にすると児童の自動ログアウトは無効になります。');
        renderStudentIdleLogoutSetting();
        return;
    }

    const before = getStudentIdleLogoutMinutes();
    const settings = ensureGlobalSettings();
    settings.studentIdleLogoutMinutes = minutes;

    recordAdminAudit('児童自動ログアウト設定変更', {
        before: before > 0 ? `${before}分` : '無効',
        after: minutes > 0 ? `${minutes}分` : '無効'
    });

    const saved = await saveUsers(true);
    refreshStudentIdleLogoutTimer();
    renderOpsGuideAdmin();

    if (!saved) {
        showCustomAlert('設定を保存しましたが、クラウド同期が完了していません。通信状態を確認してください。');
        return;
    }

    showCustomAlert(minutes > 0
        ? `児童の自動ログアウトを ${minutes}分 に設定しました。`
        : '児童の自動ログアウトを無効にしました。'
    );
}
  
  function getStudentUserIds() {
    return Object.keys(users).filter(userId => (
        users[userId]
        && !users[userId].isMaster
        && !isSystemUserId(userId)
    ));
}

function getLegacyStudentIdRows() {
    return getStudentUserIds()
        .filter(userId => !String(userId).startsWith('student_'))
        .map(userId => ({
            userId,
            displayName: getUserDisplayName(userId),
            userDataId: users[userId]?.userDataId || ''
        }));
}

function getUserDataIdMismatchRows() {
    return getStudentUserIds()
        .filter(userId => users[userId]?.userDataId && users[userId].userDataId !== userId)
        .map(userId => ({
            userId,
            displayName: getUserDisplayName(userId),
            userDataId: users[userId]?.userDataId || ''
        }));
}

function renderOpsUserIdDetails(anchor, legacyRows, mismatchRows) {
    let detail = document.getElementById('ops-user-id-detail');
    if (!detail) {
        detail = document.createElement('div');
        detail.id = 'ops-user-id-detail';
        detail.style.cssText = 'width:min(1000px, 96%); background:#fff; border:1px solid #ddd; border-radius:8px; padding:14px; box-sizing:border-box;';
        anchor.insertAdjacentElement('afterend', detail);
    }

    const rowHtml = legacyRows.slice(0, 12).map(row => `
        <tr>
            <td style="border:1px solid #ddd; padding:6px;">${escapeHtml(row.displayName)}</td>
            <td style="border:1px solid #ddd; padding:6px; font-family:monospace;">${escapeHtml(row.userId)}</td>
            <td style="border:1px solid #ddd; padding:6px; font-family:monospace;">${escapeHtml(row.userDataId || '-')}</td>
        </tr>
    `).join('');
    const moreText = legacyRows.length > 12 ? `<p style="margin:8px 0 0; color:#ef6c00; font-size:13px;">ほか ${legacyRows.length - 12} 件あります。SQL確認で全件を確認してください。</p>` : '';
    const mismatchText = mismatchRows.length
        ? `<p style="margin:8px 0 0; color:#c62828; font-size:13px;">data.userDataId と行IDが一致しない児童が ${mismatchRows.length} 件あります。内部ID移行前後の確認が必要です。</p>`
        : '';

    detail.innerHTML = legacyRows.length
        ? `
            <h4 style="margin:0 0 8px; color:#bf360c;">児童IDの確認が必要です</h4>
            <p style="margin:0 0 10px; color:#555; font-size:14px;">DB行のIDに児童名が残っている可能性があります。公開運用で実名データを入れる前に、内部ID移行手順を確認してください。</p>
            <table style="width:100%; border-collapse:collapse; font-size:13px;">
                <thead>
                    <tr>
                        <th style="border:1px solid #ddd; padding:6px; background:#fff3e0;">表示名</th>
                        <th style="border:1px solid #ddd; padding:6px; background:#fff3e0;">現在の行ID</th>
                        <th style="border:1px solid #ddd; padding:6px; background:#fff3e0;">data.userDataId</th>
                    </tr>
                </thead>
                <tbody>${rowHtml}</tbody>
            </table>
            ${moreText}
            ${mismatchText}
            <div style="display:flex; gap:10px; flex-wrap:wrap; margin-top:12px;">
                <button class="btn-secondary" onclick="copyInternalIdCheckGuide()" style="font-size:13px; padding:8px 12px;">SQL確認手順をコピー</button>
            </div>
        `
        : `
            <h4 style="margin:0 0 8px; color:#2e7d32;">児童IDは内部ID形式です</h4>
            <p style="margin:0; color:#555; font-size:14px;">画面に読み込まれている児童は student_... の行IDで保存されています。本番公開前はSQLでも user_data 側を確認してください。</p>
            ${mismatchText}
            <div style="display:flex; gap:10px; flex-wrap:wrap; margin-top:12px;">
                <button class="btn-secondary" onclick="copyInternalIdCheckGuide()" style="font-size:13px; padding:8px 12px;">SQL確認手順をコピー</button>
            </div>
        `;
}

function renderOpsGuideAdminLegacy() {
    const grid = document.getElementById('ops-status-grid');
    if (!grid) return;

    const syncText = document.getElementById('sync-status')?.innerText || '未確認';
    const role = getCurrentLessonRole() || (REQUIRE_SUPABASE_AUTH ? '未登録/未ログイン' : '旧方式');
    const teacherScope = getTeacherScopeSummary();
    const teacherScopeTone = teacherScope === '全児童' ? 'warn' : (teacherScope === 'なし' ? 'neutral' : 'good');
    const legacyPassStatus = getLegacyAdminPassStatus();
    const legacyPassTone = legacyPassStatus === 'ローカルのみ有効' ? 'warn' : 'good';
    const studentCount = Object.keys(users).filter(userId => users[userId] && !users[userId].isMaster && !isSystemUserId(userId)).length;
    const idleLogoutMinutes = getStudentIdleLogoutMinutes();
    const syncTone = /synced|rls synced/.test(syncText) ? 'good' : (/error|offline|locked/.test(syncText) ? 'bad' : 'warn');

    grid.innerHTML = [
        renderOpsStatusCard('先生範囲', teacherScope, teacherScopeTone),
        renderOpsStatusCard('Supabase設定', HAS_SUPABASE_CONFIG ? 'あり' : 'なし', HAS_SUPABASE_CONFIG ? 'good' : 'warn'),
        renderOpsStatusCard('Auth必須', REQUIRE_SUPABASE_AUTH ? '有効' : '無効', REQUIRE_SUPABASE_AUTH ? 'good' : 'bad'),
        renderOpsStatusCard('旧パスワード', legacyPassStatus, legacyPassTone),
        renderOpsStatusCard('RLS同期', ENABLE_RLS_CLOUD_SYNC ? '有効' : '無効', ENABLE_RLS_CLOUD_SYNC ? 'good' : 'warn'),
        renderOpsStatusCard('設定テーブル', ENABLE_SETTINGS_TABLE ? SETTINGS_TABLE_KEY : '旧方式', ENABLE_SETTINGS_TABLE ? 'good' : 'warn'),
        renderOpsStatusCard('旧同期', ENABLE_LEGACY_SUPABASE_SYNC ? '有効' : '無効', ENABLE_LEGACY_SUPABASE_SYNC ? 'bad' : 'good'),
        renderOpsStatusCard('現在ロール', role, role === 'admin' ? 'good' : 'warn'),
        renderOpsStatusCard('保存状態', syncText, syncTone),
        renderOpsStatusCard('児童数', `${studentCount}人`, studentCount > 0 ? 'good' : 'warn'),
        renderOpsStatusCard('児童自動ログアウト', idleLogoutMinutes > 0 ? `${idleLogoutMinutes}分` : '無効', idleLogoutMinutes > 0 ? 'good' : 'warn')
    ].join('');

    renderStudentIdleLogoutSetting();
}

export function renderOpsGuideAdmin() {
    const grid = document.getElementById('ops-status-grid');
    if (!grid) return;

    const syncText = document.getElementById('sync-status')?.innerText || '未確認';
    const role = getCurrentLessonRole() || (REQUIRE_SUPABASE_AUTH ? '未登録/未ログイン' : '旧方式');
    const teacherScope = getTeacherScopeSummary();
    const teacherScopeTone = teacherScope === '全児童' ? 'warn' : (teacherScope === 'なし' ? 'neutral' : 'good');
    const legacyPassStatus = getLegacyAdminPassStatus();
    const legacyPassTone = legacyPassStatus === 'ローカルのみ有効' ? 'warn' : 'good';
    const studentCount = getStudentUserIds().length;
    const idleLogoutMinutes = getStudentIdleLogoutMinutes();
    const legacyStudentIdRows = getLegacyStudentIdRows();
    const userDataIdMismatchRows = getUserDataIdMismatchRows();
    const userIdTone = legacyStudentIdRows.length > 0 || userDataIdMismatchRows.length > 0 ? 'warn' : 'good';
    const userIdStatus = legacyStudentIdRows.length > 0
        ? `${legacyStudentIdRows.length}件 要確認`
        : (userDataIdMismatchRows.length > 0 ? `${userDataIdMismatchRows.length}件 不一致` : '内部ID OK');
    const syncTone = /synced|rls synced/.test(syncText) ? 'good' : (/error|offline|locked/.test(syncText) ? 'bad' : 'warn');

    grid.innerHTML = [
        renderOpsStatusCard('先生範囲', teacherScope, teacherScopeTone),
        renderOpsStatusCard('Supabase設定', HAS_SUPABASE_CONFIG ? 'あり' : 'なし', HAS_SUPABASE_CONFIG ? 'good' : 'warn'),
        renderOpsStatusCard('Auth必須', REQUIRE_SUPABASE_AUTH ? '有効' : '無効', REQUIRE_SUPABASE_AUTH ? 'good' : 'bad'),
        renderOpsStatusCard('旧パスワード', legacyPassStatus, legacyPassTone),
        renderOpsStatusCard('RLS同期', ENABLE_RLS_CLOUD_SYNC ? '有効' : '無効', ENABLE_RLS_CLOUD_SYNC ? 'good' : 'warn'),
        renderOpsStatusCard('設定テーブル', ENABLE_SETTINGS_TABLE ? SETTINGS_TABLE_KEY : '旧方式', ENABLE_SETTINGS_TABLE ? 'good' : 'warn'),
        renderOpsStatusCard('旧同期', ENABLE_LEGACY_SUPABASE_SYNC ? '有効' : '無効', ENABLE_LEGACY_SUPABASE_SYNC ? 'bad' : 'good'),
        renderOpsStatusCard('現在ロール', role, role === 'admin' ? 'good' : 'warn'),
        renderOpsStatusCard('保存状態', syncText, syncTone),
        renderOpsStatusCard('児童数', `${studentCount}人`, studentCount > 0 ? 'good' : 'warn'),
        renderOpsStatusCard('児童ID形式', userIdStatus, userIdTone),
        renderOpsStatusCard('児童自動ログアウト', idleLogoutMinutes > 0 ? `${idleLogoutMinutes}分` : '無効', idleLogoutMinutes > 0 ? 'good' : 'warn')
    ].join('');

    renderOpsUserIdDetails(grid, legacyStudentIdRows, userDataIdMismatchRows);
    renderStudentIdleLogoutSetting();
}

export function copyInternalIdCheckGuide() {
    const text = [
        'Dレッスン 児童IDの本番前確認',
        '',
        '1. 管理者画面 > バックアップ でJSONバックアップを保存する。',
        '2. Supabase SQL Editorで supabase/sql/preflight_public_release.sql の中身を実行する。',
        '3. result が NG の行がないか確認する。',
        '4. user_data_legacy_name_ids が 0 ではない場合は、docs/production-user-data-id-migration.md に沿って移行する。',
        '5. lesson_user_access_legacy_refs が 0 ではない場合は、Auth連携の user_data_id が内部IDへ更新されているか確認する。',
        '6. 実名運用前に npm.cmd run check:public-env と npm.cmd run build を実行する。'
    ].join('\n');
    copyText(text);
}

export function copyDeviceHandoffChecklist() {
    const text = [
        'Dレッスン 端末切替チェック',
        '1. 古い端末で保存状態が「rls synced」または「synced」になっていることを確認',
        '2. 管理者画面 > バックアップ でJSONバックアップを保存',
        '3. 新しい端末でDレッスンを開き、Supabase Authでログイン',
        '4. 児童一覧、進捗、コインが見えることを確認',
        '5. 短い練習を1つクリアし、保存状態が同期済みになることを確認',
        '6. 旧端末を共有端末として使わない場合はログアウト'
    ].join('\n');
    copyText(text);
}

export function copyLessonSettingsCheckGuide() {
    const text = [
        'Dレッスン 設定テーブル確認',
        '',
        '目的:',
        '__GLOBAL_SETTINGS__ を児童データ行から分離し、チケット設定・文章課題・自動ログアウト設定などを lesson_settings で管理できるか確認する。',
        '',
        '1. Supabase SQL Editor を開く。',
        '2. supabase/sql/lesson_settings_table.sql の中身を貼り付けて実行する。',
        '3. supabase/sql/verify_lesson_settings.sql の中身を貼り付けて実行する。',
        '',
        '確認する結果:',
        '- public.lesson_settings の rls_enabled が true。',
        '- lesson_settings の policy が SELECT / INSERT / UPDATE / DELETE の4種類ある。',
        '- user_data:global または test_user_data:global の行がある。',
        '- same_as_legacy_row が true、または管理者画面で設定保存後に lesson_settings 側へ反映される。',
        '',
        'ブラウザ確認:',
        '1. GitHub Actions Variables または .env.local で VITE_ENABLE_SETTINGS_TABLE=true にする。',
        '2. Dレッスンを再起動または再デプロイする。',
        '3. 管理者ログイン > 管理者用 > 運用確認 を開く。',
        '4. 「設定テーブル」が user_data:global または test_user_data:global になっていることを確認する。',
        '5. 自動ログアウト分数やチケット設定を保存し、再読み込み後も残ることを確認する。',
        '',
        '注意:',
        '設定テーブルを有効にする前は、管理者画面の「設定テーブル」が「旧方式」と表示される。これは VITE_ENABLE_SETTINGS_TABLE=false の状態なら正常。'
    ].join('\n');
    copyText(text);
}
