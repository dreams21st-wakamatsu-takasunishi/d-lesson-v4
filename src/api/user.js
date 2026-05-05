import { createClient } from '@supabase/supabase-js';
import { SoundManager } from '../utils/sound.js';
import { calculateGrade, sortGrades } from '../utils/helpers.js';
import { showScreen } from '../ui/screen.js';
import { applyTheme } from '../ui/home.js';
import { createConfetti } from '../ui/effects.js';
// ==========================================
// Database (Supabase) connection
// ==========================================
// Values come from Vite env vars. Do not hard-code project keys here.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const HAS_SUPABASE_CONFIG = Boolean(supabaseUrl && supabaseKey);
export const ENABLE_LEGACY_SUPABASE_SYNC = import.meta.env.VITE_ENABLE_LEGACY_SUPABASE_SYNC === 'true';
export const ENABLE_RLS_CLOUD_SYNC = import.meta.env.VITE_ENABLE_RLS_CLOUD_SYNC === 'true';
export const REQUIRE_SUPABASE_AUTH = import.meta.env.VITE_REQUIRE_SUPABASE_AUTH === 'true';
export const ENABLE_SETTINGS_TABLE = import.meta.env.VITE_ENABLE_SETTINGS_TABLE === 'true';
export const supabase = HAS_SUPABASE_CONFIG ? createClient(supabaseUrl, supabaseKey) : null;

// ==========================================
// Environment settings
// ==========================================
export const IS_DEV_MODE = import.meta.env.VITE_SUPABASE_USE_TEST_TABLE === 'true';
const TARGET_TABLE = import.meta.env.VITE_SUPABASE_TABLE || (IS_DEV_MODE ? 'test_user_data' : 'user_data');

export const STORAGE_KEY = 'pc_practice_v5_split';
export const GLOBAL_SETTINGS_ID = '__GLOBAL_SETTINGS__';
export const MASTER_DEBUG_ID = 'Master_Debug';
export const SETTINGS_TABLE_KEY = `${TARGET_TABLE}:global`;
const PRACTICE_LOG_LIMIT = 80;

export let users = {};
export let currentUser = null;
export let currentSelectedGrade = null;
export let currentLessonAccess = [];
let authGatePromise = null;
let authGateResolve = null;
let authGateAfterLogin = null;

const LESSON_ACCESS_BASE_COLUMNS = 'auth_user_id,user_data_id,role';
const LESSON_ACCESS_SCOPED_COLUMNS = `${LESSON_ACCESS_BASE_COLUMNS},scope_type,scope_value`;

function canUseRlsCloudSync() {
    return Boolean(supabase && REQUIRE_SUPABASE_AUTH && ENABLE_RLS_CLOUD_SYNC);
}

function canUseLegacyCloudSync() {
    return Boolean(supabase && ENABLE_LEGACY_SUPABASE_SYNC && !canUseRlsCloudSync());
}

function canUseSettingsTable() {
    return Boolean(supabase && REQUIRE_SUPABASE_AUTH && ENABLE_RLS_CLOUD_SYNC && ENABLE_SETTINGS_TABLE);
}

function getLocalOnlySyncStatus() {
    if (ENABLE_RLS_CLOUD_SYNC && !REQUIRE_SUPABASE_AUTH) return 'rls auth missing';
    if (REQUIRE_SUPABASE_AUTH && HAS_SUPABASE_CONFIG) return 'auth only';
    return HAS_SUPABASE_CONFIG ? 'cloud locked' : 'local only';
}

export function getCurrentLessonRole() {
    const roles = currentLessonAccess.map(access => access?.role).filter(Boolean);
    if (roles.includes('admin')) return 'admin';
    if (roles.includes('teacher')) return 'teacher';
    if (roles.includes('student')) return 'student';
    return null;
}

export function hasLessonRole(...roles) {
    return roles.includes(getCurrentLessonRole());
}

function canWriteUserRow(userId) {
    if (!userId) return false;
    if (!canUseRlsCloudSync()) return true;
    if (hasLessonRole('admin')) return true;
    return currentLessonAccess.some(access => (
        access?.role === 'student'
        && access.user_data_id === userId
    ));
}

export function canWriteCurrentUserRow() {
    return canWriteUserRow(currentUser);
}

function isMissingLessonScopeColumnError(error) {
    const message = `${error?.code || ''} ${error?.message || ''}`;
    return /scope_type|scope_value|42703/i.test(message);
}

function normalizeLessonAccessRows(rows) {
    return (Array.isArray(rows) ? rows : []).map(row => ({
        ...row,
        scope_type: row?.scope_type || 'all',
        scope_value: row?.scope_value || ''
    }));
}

function parseScopeGroups(scopeValue) {
    return String(scopeValue || '')
        .split(',')
        .map(value => value.trim())
        .filter(Boolean);
}

export function getTeacherScopeSummary(accessRows = currentLessonAccess) {
    const teacherRows = (Array.isArray(accessRows) ? accessRows : []).filter(access => access?.role === 'teacher');
    if (teacherRows.length === 0) return 'なし';
    if (teacherRows.some(access => (access.scope_type || 'all') === 'all')) return '全児童';
    const groups = Array.from(new Set(teacherRows.flatMap(access => parseScopeGroups(access.scope_value))));
    return groups.length ? `グループ: ${groups.join(',')}` : 'なし';
}

export async function refreshCurrentLessonAccess() {
    currentLessonAccess = [];
    if (!supabase || !REQUIRE_SUPABASE_AUTH) return currentLessonAccess;

    try {
        const { data: userData, error: userError } = await supabase.auth.getUser();
        if (userError) throw userError;

        const authUserId = userData?.user?.id;
        if (!authUserId) return currentLessonAccess;

        let { data, error } = await supabase
            .from('lesson_user_access')
            .select(LESSON_ACCESS_SCOPED_COLUMNS)
            .eq('auth_user_id', authUserId);

        if (error && isMissingLessonScopeColumnError(error)) {
            const fallback = await supabase
                .from('lesson_user_access')
                .select(LESSON_ACCESS_BASE_COLUMNS)
                .eq('auth_user_id', authUserId);
            data = fallback.data;
            error = fallback.error;
        }

        if (error) throw error;
        currentLessonAccess = normalizeLessonAccessRows(data);
    } catch (err) {
        console.error('Failed to load lesson access:', err);
        currentLessonAccess = [];
    }

    return currentLessonAccess;
}

function setSyncStatus(text) {
    const syncStatus = document.getElementById('sync-status');
    if (syncStatus) syncStatus.innerText = text;
}

function loadLocalUsers() {
    const localDataStr = localStorage.getItem(STORAGE_KEY);
    if (!localDataStr) return;

    try {
        const parsed = JSON.parse(localDataStr);
        if (parsed && typeof parsed === 'object') users = parsed;
    } catch (err) {
        console.warn('Failed to parse local user data:', err);
    }
}

function applyCustomGlobalSettingsIfReady() {
    if (typeof window !== 'undefined' && typeof window.loadCustomGlobalSettings === 'function') {
        window.loadCustomGlobalSettings();
    }
}

async function loadCloudSettingsIfEnabled() {
    if (!canUseSettingsTable()) return false;

    try {
        const { data, error } = await supabase
            .from('lesson_settings')
            .select('key,data')
            .eq('key', SETTINGS_TABLE_KEY)
            .maybeSingle();

        if (error) throw error;
        if (data?.data && typeof data.data === 'object') {
            users[GLOBAL_SETTINGS_ID] = data.data;
            return true;
        }
    } catch (err) {
        console.warn('Failed to load lesson_settings. Falling back to legacy global row:', err);
    }

    return false;
}

async function saveCloudSettingsIfEnabled() {
    if (!canUseSettingsTable()) return false;
    if (!hasLessonRole('admin')) return false;
    if (!shouldPersistUserRow(GLOBAL_SETTINGS_ID, users[GLOBAL_SETTINGS_ID])) return false;

    const { error } = await supabase
        .from('lesson_settings')
        .upsert({
            key: SETTINGS_TABLE_KEY,
            data: users[GLOBAL_SETTINGS_ID],
            updated_at: new Date().toISOString()
        }, { onConflict: 'key' });

    if (error) throw error;
    return true;
}

function clearRosterDom() {
    ['grade-list', 'user-list'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.innerHTML = '';
    });
}

export function isSystemUserId(userId) {
    return userId === GLOBAL_SETTINGS_ID || userId === MASTER_DEBUG_ID;
}

export function getUserDataDisplayName(userId, data) {
    const value = data?.displayName || data?.name || data?.studentName || userId;
    return String(value || userId);
}

export function getUserDisplayName(userId) {
    return getUserDataDisplayName(userId, users[userId]);
}

export function userDisplayNameExists(displayName, ignoreUserId = null) {
    const target = String(displayName || '').trim();
    if (!target) return false;
    return Object.keys(users).some(userId => {
        if (userId === ignoreUserId || isSystemUserId(userId)) return false;
        return getUserDisplayName(userId) === target;
    });
}

export function createUserDataId() {
    const cryptoApi = globalThis.crypto;
    if (cryptoApi && typeof cryptoApi.randomUUID === 'function') {
        return `student_${cryptoApi.randomUUID()}`;
    }
    return `student_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function createPracticeLogId() {
    const cryptoApi = globalThis.crypto;
    if (cryptoApi && typeof cryptoApi.randomUUID === 'function') return cryptoApi.randomUUID();
    return `practice_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function normalizePracticeLogs(logs) {
    if (!Array.isArray(logs)) return [];
    return logs
        .filter(log => log && typeof log === 'object')
        .map(log => ({
            id: String(log.id || createPracticeLogId()),
            at: log.at || new Date().toISOString(),
            category: String(log.category || 'practice'),
            title: String(log.title || '練習'),
            detail: String(log.detail || ''),
            amount: String(log.amount || ''),
            coins: Number.isFinite(Number(log.coins)) ? Number(log.coins) : 0
        }))
        .sort((a, b) => {
            const atA = Date.parse(a.at) || 0;
            const atB = Date.parse(b.at) || 0;
            return atB - atA;
        })
        .slice(0, PRACTICE_LOG_LIMIT);
}

export function recordPracticeActivity(entry = {}) {
    if (!currentUser || !users[currentUser] || !canWriteUserRow(currentUser)) return null;
    const logs = normalizePracticeLogs(users[currentUser].practiceLogs);
    const log = {
        id: createPracticeLogId(),
        at: new Date().toISOString(),
        category: String(entry.category || 'practice'),
        title: String(entry.title || '練習'),
        detail: String(entry.detail || ''),
        amount: String(entry.amount || ''),
        coins: Number.isFinite(Number(entry.coins)) ? Number(entry.coins) : 0
    };
    users[currentUser].practiceLogs = [log, ...logs].slice(0, PRACTICE_LOG_LIMIT);
    return log;
}

export function getPracticeLogs(userId = currentUser) {
    return normalizePracticeLogs(users[userId]?.practiceLogs);
}

export function getLatestPracticeActivity(userId = currentUser) {
    return getPracticeLogs(userId)[0] || null;
}

export function formatPracticeActivity(log) {
    if (!log) {
        return {
            title: '前回の練習はまだありません',
            detail: '練習するとここに表示されます',
            when: '',
            coinsText: ''
        };
    }
    const at = Date.parse(log.at);
    const when = at ? new Date(at).toLocaleString('ja-JP', {
        month: 'numeric',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    }) : '';
    const coins = Number(log.coins || 0);
    return {
        title: log.title || '練習',
        detail: [log.detail, log.amount].filter(Boolean).join(' / ') || '内容の記録があります',
        when,
        coinsText: coins ? `+${coins}コイン` : ''
    };
}

function normalizeUserRecord(userId, data) {
    if (!data || typeof data !== 'object') return data;
    if (!isSystemUserId(userId)) {
        if (!data.displayName) data.displayName = getUserDataDisplayName(userId, data);
        if (!data.userDataId) data.userDataId = userId;
        data.practiceLogs = normalizePracticeLogs(data.practiceLogs);
    }
    return data;
}

function normalizeUsersCollection() {
    if (!users || typeof users !== 'object') users = {};
    Object.keys(users).forEach(userId => {
        normalizeUserRecord(userId, users[userId]);
    });
}

function shouldPersistUserRow(userId, data) {
    return Boolean(userId && data && typeof data === 'object' && userId !== MASTER_DEBUG_ID);
}

export function isTeacherReadOnlyMode() {
    return Boolean(currentUser && hasLessonRole('teacher') && !canWriteUserRow(currentUser));
}

function updateReadOnlyModeUi() {
    const enabled = isTeacherReadOnlyMode();
    const badge = document.getElementById('role-mode-badge');
    if (badge) badge.style.display = enabled ? 'inline-flex' : 'none';
    const notice = document.getElementById('readonly-mode-notice');
    if (notice) notice.style.display = enabled ? 'block' : 'none';
}

function updateVisibleUserUi() {
    if (typeof window === 'undefined') return;
    updateReadOnlyModeUi();
    if (typeof window.updateGlobalHeader === 'function') window.updateGlobalHeader();
    if (typeof window.updateHomeDashboard === 'function') window.updateHomeDashboard();
}

function setAuthGateMessage(message, isError = false) {
    const messageEl = document.getElementById('supabase-auth-message');
    if (!messageEl) return;
    messageEl.innerText = message || '';
    messageEl.style.color = isError ? '#b91c1c' : '#475569';
}

function setAuthGateBusy(isBusy, message = '') {
    const submit = document.getElementById('supabase-auth-submit');
    const email = document.getElementById('supabase-auth-email');
    const password = document.getElementById('supabase-auth-password');
    if (submit) {
        submit.disabled = isBusy;
        submit.innerText = isBusy ? 'ログイン中...' : 'ログイン';
    }
    if (email) email.disabled = isBusy;
    if (password) password.disabled = isBusy;
    if (message) setAuthGateMessage(message);
}

function hideAuthGate() {
    const gate = document.getElementById('supabase-auth-gate');
    if (gate) gate.remove();
}

function showAuthGate(message = '', isError = false, afterLogin = null) {
    authGateAfterLogin = afterLogin;

    let gate = document.getElementById('supabase-auth-gate');
    if (!gate) {
        gate = document.createElement('div');
        gate.id = 'supabase-auth-gate';
        document.body.appendChild(gate);
    }

    gate.style.cssText = 'position:fixed; inset:0; z-index:20000; background:#f6f7fb; display:flex; align-items:center; justify-content:center; padding:24px;';
    gate.innerHTML = `
        <form id="supabase-auth-form" style="width:min(420px, 100%); background:#fff; border:1px solid #dbe3ef; border-radius:8px; box-shadow:0 18px 45px rgba(15,23,42,0.18); padding:28px;">
            <h2 style="margin:0 0 18px; color:#0f172a; font-size:24px; letter-spacing:0;">Dレッスン ログイン</h2>
            <label style="display:block; color:#334155; font-weight:700; font-size:14px; margin-bottom:12px;">
                メールアドレス
                <input id="supabase-auth-email" type="email" autocomplete="username" required style="box-sizing:border-box; width:100%; margin-top:6px; border:1px solid #cbd5e1; border-radius:6px; padding:12px; font-size:16px;">
            </label>
            <label style="display:block; color:#334155; font-weight:700; font-size:14px; margin-bottom:18px;">
                パスワード
                <input id="supabase-auth-password" type="password" autocomplete="current-password" required style="box-sizing:border-box; width:100%; margin-top:6px; border:1px solid #cbd5e1; border-radius:6px; padding:12px; font-size:16px;">
            </label>
            <button id="supabase-auth-submit" class="btn-primary" type="submit" style="width:100%; min-height:46px; font-size:17px;">ログイン</button>
            <p id="supabase-auth-message" style="min-height:22px; margin:14px 0 0; color:${isError ? '#b91c1c' : '#475569'}; font-size:14px; line-height:1.5;"></p>
        </form>
    `;

    setAuthGateMessage(message, isError);
    const form = document.getElementById('supabase-auth-form');
    if (form) form.onsubmit = handleAuthFormSubmit;

    const email = document.getElementById('supabase-auth-email');
    if (email) setTimeout(() => email.focus(), 0);
}

async function handleAuthFormSubmit(event) {
    event.preventDefault();

    if (!supabase) {
        setAuthGateMessage('Supabaseのログイン設定が見つかりません。.env.local を確認してください。', true);
        return;
    }

    const email = document.getElementById('supabase-auth-email')?.value.trim();
    const password = document.getElementById('supabase-auth-password')?.value;
    if (!email || !password) {
        setAuthGateMessage('メールアドレスとパスワードを入力してください。', true);
        return;
    }

    setAuthGateBusy(true, 'ログイン中...');
    try {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;

        hideAuthGate();
        setSyncStatus('authenticated');

        const resolve = authGateResolve;
        const afterLogin = authGateAfterLogin;
        authGatePromise = null;
        authGateResolve = null;
        authGateAfterLogin = null;

        if (resolve) resolve(true);
        if (afterLogin) afterLogin();
    } catch (err) {
        console.error('Auth sign-in failed:', err);
        setAuthGateBusy(false);
        setAuthGateMessage('メールアドレスまたはパスワードを確認してください。', true);
    }
}

async function ensureSupabaseSession() {
    if (!REQUIRE_SUPABASE_AUTH) return true;

    if (!supabase) {
        setSyncStatus('auth missing');
        showAuthGate('Supabaseのログイン設定が見つかりません。.env.local を確認してください。', true);
        return false;
    }

    try {
        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;
        if (data?.session) {
            hideAuthGate();
            setSyncStatus('authenticated');
            return true;
        }
    } catch (err) {
        console.error('Auth session check failed:', err);
    }

    if (authGatePromise) return authGatePromise;
    authGatePromise = new Promise(resolve => {
        authGateResolve = resolve;
        showAuthGate('先生または管理者のアカウントでログインしてください。');
    });
    return authGatePromise;
}

export function setCurrentUser(value) {
    currentUser = value;
}

export function setCurrentSelectedGrade(value) {
    currentSelectedGrade = value;
}

export async function replaceUsers(nextUsers, persistCloud = true) {
    if (!nextUsers || typeof nextUsers !== 'object' || Array.isArray(nextUsers)) {
        throw new Error('Invalid users data');
    }

    if (persistCloud) {
        await pruneCloudStudentRowsMissingFrom(nextUsers);
    }

    users = nextUsers;
    normalizeUsersCollection();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(users));
    updateVisibleUserUi();

    if (persistCloud) {
        const saved = await saveUsers(true);
        if (!saved) throw new Error('Failed to persist users');
    }
}

export async function deleteCloudUserRows(userIds) {
    const ids = (Array.isArray(userIds) ? userIds : [userIds])
        .filter(userId => userId && !isSystemUserId(userId));

    if (ids.length === 0) return [];
    if (!canUseRlsCloudSync() && !canUseLegacyCloudSync()) return [];
    if (canUseRlsCloudSync() && !hasLessonRole('admin')) {
        throw new Error('Admin role is required to delete cloud user rows');
    }

    const deletedIds = Array.from(new Set(ids));
    const chunkSize = 100;
    for (let i = 0; i < deletedIds.length; i += chunkSize) {
        const chunk = deletedIds.slice(i, i + chunkSize);
        const { error } = await supabase.from(TARGET_TABLE).delete().in('id', chunk);
        if (error) throw error;
    }

    const { data: remainingRows, error: verifyError } = await supabase
        .from(TARGET_TABLE)
        .select('id')
        .in('id', deletedIds);
    if (verifyError) throw verifyError;

    const remainingIds = (remainingRows || []).map(row => row.id);
    if (remainingIds.length > 0) {
        throw new Error(`Cloud delete did not remove rows: ${remainingIds.join(', ')}`);
    }

    return deletedIds;
}

async function pruneCloudStudentRowsMissingFrom(nextUsers) {
    if (!canUseRlsCloudSync() && !canUseLegacyCloudSync()) return [];
    if (canUseRlsCloudSync() && !hasLessonRole('admin')) {
        throw new Error('Admin role is required to prune cloud user rows');
    }

    const desiredIds = new Set(
        Object.keys(nextUsers)
            .filter(userId => !isSystemUserId(userId) && shouldPersistUserRow(userId, nextUsers[userId]))
    );

    const { data, error } = await supabase.from(TARGET_TABLE).select('id');
    if (error) throw error;

    const missingIds = (data || [])
        .map(row => row.id)
        .filter(userId => userId && !isSystemUserId(userId) && !desiredIds.has(userId));

    return deleteCloudUserRows(missingIds);
}

export async function signOutSupabaseAuth() {
    if (!REQUIRE_SUPABASE_AUTH) return false;

    authGatePromise = null;
    authGateResolve = null;
    authGateAfterLogin = null;
    currentUser = null;
    currentSelectedGrade = null;
    currentLessonAccess = [];
    users = {};
    if (ENABLE_RLS_CLOUD_SYNC) localStorage.removeItem(STORAGE_KEY);
    clearRosterDom();
    updateVisibleUserUi();

    if (supabase) {
        try {
            await supabase.auth.signOut();
        } catch (err) {
            console.error('Auth sign-out failed:', err);
        }
    }

    setSyncStatus('signed out');
    showAuthGate('ログアウトしました。もう一度ログインしてください。', false, () => { void loadUsers(); });
    return true;
}

// ==========================================
// Data load/save functions
// ==========================================
export async function loadUsers() {
    const titleScreen = document.getElementById('screen-title');
    if (!titleScreen.querySelector('.loading-msg')) {
        titleScreen.querySelector('.screen-content').insertAdjacentHTML('beforeend', '<div class="loading-msg" style="color:#555; font-size:20px; margin-top:20px;">データを読み込み中...</div>');
    }

    const hasSession = await ensureSupabaseSession();
    if (!hasSession) {
        const loadingMsg = titleScreen.querySelector('.loading-msg');
        if (loadingMsg) loadingMsg.remove();
        return;
    }

    const useRlsCloudSync = canUseRlsCloudSync();
    const useLegacyCloudSync = canUseLegacyCloudSync();

    await refreshCurrentLessonAccess();
    updateVisibleUserUi();

    if (!useRlsCloudSync) loadLocalUsers();

    if (!useRlsCloudSync && !useLegacyCloudSync) {
        if (!users || typeof users !== 'object') users = {};
        normalizeUsersCollection();
        applyCustomGlobalSettingsIfReady();
        setSyncStatus(getLocalOnlySyncStatus());
        const loadingMsg = titleScreen.querySelector('.loading-msg');
        if (loadingMsg) loadingMsg.remove();
        updateVisibleUserUi();
        return;
    }

    let cloudLoadFailed = false;

    try {
        // RLS sync relies on Supabase policies. Legacy sync must stay disabled on public URLs.
        const { data, error } = await supabase.from(TARGET_TABLE).select('*');
        if (error) throw error;

        if(data && data.length > 0) {
            let newUsers = {};
            data.forEach(row => { newUsers[row.id] = row.data; });
            
            if (!useRlsCloudSync) {
                // Merge local-only progress that has not reached the cloud yet.
                const localDataStr = localStorage.getItem(STORAGE_KEY);
                let localUsers = null;
                if (localDataStr) { try { localUsers = JSON.parse(localDataStr); } catch(err) {} }

                if (localUsers) {
                    for (let n in localUsers) {
                        if (!newUsers[n]) {
                            newUsers[n] = localUsers[n];
                        } else {
                            const props =['coins', 'items', 'tickets', 'activeEffect', 'textRecords', 'textTasks', 'dChallengeHighscore', 'minigameHighscore', 'examRecords', 'globalMistakes', 'ticketHistory', 'loginStamps', 'visionCleared', 'currentWeakKeys', 'group', 'wordProgress'];
                            props.forEach(p => {
                                if (newUsers[n][p] === undefined && localUsers[n][p] !== undefined) {
                                    newUsers[n][p] = localUsers[n][p];
                                }
                            });
                        }
                    }
                }
            }
            users = newUsers;
            normalizeUsersCollection();
            await loadCloudSettingsIfEnabled();
            localStorage.setItem(STORAGE_KEY, JSON.stringify(users)); 
        } else {
            if (useRlsCloudSync) {
                users = {};
                await loadCloudSettingsIfEnabled();
                localStorage.setItem(STORAGE_KEY, JSON.stringify(users));
            } else {
                // If the cloud table is empty, keep local data.
                const localDataStr = localStorage.getItem(STORAGE_KEY);
                if (localDataStr) { try { users = JSON.parse(localDataStr); } catch(err) { users = {}; } }
            }
        }
    } catch(e) {
        console.error("通信エラー", e);
        if (useRlsCloudSync) users = {};
        else loadLocalUsers();
        cloudLoadFailed = true;
        setSyncStatus('sync error');
    }
    
    if (!users || typeof users !== 'object') users = {};
    normalizeUsersCollection();
    applyCustomGlobalSettingsIfReady();
    if ((useRlsCloudSync || useLegacyCloudSync) && !cloudLoadFailed) {
        setSyncStatus(useRlsCloudSync ? 'rls synced' : 'synced');
    }

    const loadingMsg = titleScreen.querySelector('.loading-msg');
    if (loadingMsg) loadingMsg.remove();
    updateVisibleUserUi();
}

export async function saveUsers(forceOverwrite = false) {
    if (!users || typeof users !== 'object') users = {};
    normalizeUsersCollection();
    updateVisibleUserUi();

    const useRlsCloudSync = canUseRlsCloudSync();
    const useLegacyCloudSync = canUseLegacyCloudSync();
    const useSettingsTable = canUseSettingsTable();

    if (!useRlsCloudSync) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(users));
    }

    if (!useRlsCloudSync && !useLegacyCloudSync) {
        setSyncStatus(getLocalOnlySyncStatus());
        return true;
    }
    
    if (!navigator.onLine) { setSyncStatus('offline'); return false; }
    setSyncStatus('syncing');

    try {
        // Build the cloud upsert payload.
        let upsertData =[];
        let shouldSaveSettings = false;
        if (forceOverwrite) {
            const canUpdateAllRows = !useRlsCloudSync || hasLessonRole('admin');
            for (let userId in users) {
                if (useSettingsTable && userId === GLOBAL_SETTINGS_ID) {
                    if (canUpdateAllRows) shouldSaveSettings = true;
                    continue;
                }
                if (canWriteUserRow(userId) && shouldPersistUserRow(userId, users[userId])) {
                    upsertData.push({ id: userId, data: users[userId] });
                }
            }
        } else {
            if (currentUser && canWriteUserRow(currentUser) && shouldPersistUserRow(currentUser, users[currentUser])) {
                upsertData.push({ id: currentUser, data: users[currentUser] });
            }
            const canUpdateGlobalSettings = !useRlsCloudSync || hasLessonRole('admin');
            if (canUpdateGlobalSettings && shouldPersistUserRow(GLOBAL_SETTINGS_ID, users[GLOBAL_SETTINGS_ID])) {
                if (useSettingsTable) shouldSaveSettings = true;
                else upsertData.push({ id: GLOBAL_SETTINGS_ID, data: users[GLOBAL_SETTINGS_ID] });
            }
        }

        if (shouldSaveSettings) {
            await saveCloudSettingsIfEnabled();
        }

        if (upsertData.length > 0) {
            // Upsert to Supabase.
            const { error } = await supabase.from(TARGET_TABLE).upsert(upsertData);
            if (error) throw error;
        }
        setSyncStatus(useRlsCloudSync ? 'rls synced' : 'synced');
        if (!useRlsCloudSync || upsertData.length > 0 || shouldSaveSettings) {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(users));
        }
        return true;
    } catch (e) { 
        console.error("保存エラー:", e); 
        setSyncStatus('sync error'); 
        return false;
    }
}

export function goToGradeSelect() { renderGradeList(); showScreen('screen-grade'); }

export function renderGradeList() {
    const gradeList = document.getElementById('grade-list'); gradeList.innerHTML = '';
    const existingGrades = new Set();
    Object.keys(users).forEach(userId => { if(!users[userId].isMaster && !isSystemUserId(userId)) existingGrades.add(calculateGrade(users[userId].birthdate || users[userId].birth)); });
    const sortedGrades = sortGrades(Array.from(existingGrades));
    
    if(sortedGrades.length === 0) {
        gradeList.innerHTML = '<p style="font-size:24px;">ユーザーが登録されていません。<br>右下の「管理者」からユーザーを追加してください。</p>';
        return;
    }
    sortedGrades.forEach(grade => {
        const btn = document.createElement('div'); btn.className = 'grade-card'; btn.innerText = grade;
        btn.onclick = () => { currentSelectedGrade = grade; renderUserList(grade); showScreen('screen-login'); };
        gradeList.appendChild(btn);
    });
}

export function renderUserList(grade) {
    const userList = document.getElementById('user-list'); userList.innerHTML = '';
    document.getElementById('login-grade-title').innerText = `${grade} の なまえをえらんでね`;
    Object.keys(users).forEach(userId => {
        if(!users[userId].isMaster && !isSystemUserId(userId) && calculateGrade(users[userId].birthdate || users[userId].birth) === grade) {
            const btn = document.createElement('div');
            btn.className = 'user-card';
            btn.style.display = 'flex';
            btn.style.flexDirection = 'column';
            btn.style.alignItems = 'center';
            btn.style.justifyContent = 'center';
            btn.style.gap = '6px';

            const nameEl = document.createElement('div');
            nameEl.textContent = getUserDisplayName(userId);
            nameEl.style.fontWeight = 'bold';
            nameEl.style.fontSize = '24px';
            btn.appendChild(nameEl);

            const last = formatPracticeActivity(getLatestPracticeActivity(userId));
            const lastEl = document.createElement('div');
            lastEl.textContent = last.when ? `前回: ${last.title} (${last.when})` : last.title;
            lastEl.style.fontSize = '13px';
            lastEl.style.color = '#455a64';
            lastEl.style.lineHeight = '1.3';
            lastEl.style.maxWidth = '100%';
            btn.appendChild(lastEl);

            if (last.detail && last.when) {
                const detailEl = document.createElement('div');
                detailEl.textContent = last.detail;
                detailEl.style.fontSize = '12px';
                detailEl.style.color = '#78909c';
                detailEl.style.lineHeight = '1.3';
                detailEl.style.maxWidth = '100%';
                btn.appendChild(detailEl);
            }

            btn.onclick = () => login(userId); userList.appendChild(btn);
        }
    });
}

export function login(userId) {
    currentUser = userId;
    if(!users[userId]) users[userId] = {};
    normalizeUserRecord(userId, users[userId]);
    if(users[userId].wordProgress === undefined) users[userId].wordProgress = {};
    if(users[userId].mouseLevel===undefined) users[userId].mouseLevel=0;
    if(users[userId].keyboardSequence===undefined) users[userId].keyboardSequence=0;
    if(users[userId].examRecords===undefined) users[userId].examRecords={};
    if(users[userId].textRecords===undefined) users[userId].textRecords={};
    if(users[userId].globalMistakes===undefined) users[userId].globalMistakes={};
    if(users[userId].theme===undefined) users[userId].theme='default';
    if(users[userId].birthdate===undefined) users[userId].birthdate='';
    if(users[userId].loginStamps===undefined) users[userId].loginStamps=[];
    if(users[userId].minigameHighscore===undefined) users[userId].minigameHighscore=0;
    if(users[userId].dChallengeHighscore===undefined) users[userId].dChallengeHighscore=0;
    if(users[userId].coins === undefined) users[userId].coins = 0;
    if(users[userId].items === undefined) users[userId].items =[];
    if(users[userId].tickets === undefined) users[userId].tickets =[];
    if(users[userId].activeEffect === undefined) users[userId].activeEffect = 'default';
    
    applyTheme(users[userId].theme);
    document.getElementById('welcome-msg').innerText = `ようこそ、${getUserDisplayName(userId)} さん`;

    updateVisibleUserUi();

    const today = new Date().toISOString().split('T')[0];
    if (canWriteUserRow(userId) && !users[userId].loginStamps.includes(today) && !users[userId].isMaster) {
        users[userId].loginStamps.push(today);
        users[userId].coins += 100;
        saveUsers(false);
        showStampOverlay();
    } else {
        showScreen('screen-category');
    }
}

export function showStampOverlay() {
    SoundManager.init(); SoundManager.playClear(); createConfetti(users[currentUser]?.activeEffect || 'default');
    document.getElementById('stamp-count').innerText = users[currentUser].loginStamps.length;
    document.getElementById('stamp-overlay').style.display = 'flex';
}
export function closeStampOverlay() {
    document.getElementById('stamp-overlay').style.display = 'none';
    showScreen('screen-category');
}

// Warn if the user closes the page while cloud sync is in progress.
window.addEventListener('beforeunload', (e) => {
    const syncStatus = document.getElementById('sync-status');
    if (syncStatus && syncStatus.innerText === 'syncing') {
        e.preventDefault();
        e.returnValue = 'Data is still syncing. Closing now may lose changes.';
    }
});
