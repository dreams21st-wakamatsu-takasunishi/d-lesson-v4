import { createClient } from '@supabase/supabase-js';
import { SoundManager } from '../utils/sound.js';
import { calculateGrade, sortGrades } from '../utils/helpers.js';
import { sanitizeGlobalMistakes } from '../utils/weak-mistakes.js';
import { showScreen } from '../ui/screen.js';
import { applyTheme } from '../ui/home.js';
import { createConfetti } from '../ui/effects.js';
// ==========================================
// Database (Supabase) connection
// ==========================================
// Values come from Vite env vars. Do not hard-code project keys here.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY || '';
const SUPABASE_PROJECT_REF = getSupabaseProjectRef(supabaseUrl);
// Use an app-specific auth key so legacy/test sessions do not collide with production.
const SUPABASE_AUTH_STORAGE_KEY = SUPABASE_PROJECT_REF ? `sb-${SUPABASE_PROJECT_REF}-d-lesson-auth-token` : '';
const SUPABASE_LEGACY_AUTH_STORAGE_KEY = SUPABASE_PROJECT_REF ? `sb-${SUPABASE_PROJECT_REF}-auth-token` : '';
const SUPABASE_SESSION_STORAGE = getSupabaseSessionStorage();
const supabaseClientOptions = {
    auth: {
        ...(SUPABASE_AUTH_STORAGE_KEY ? { storageKey: SUPABASE_AUTH_STORAGE_KEY } : {}),
        ...(SUPABASE_SESSION_STORAGE
            ? { storage: SUPABASE_SESSION_STORAGE, persistSession: true }
            : { persistSession: false }),
        skipAutoInitialize: true
    }
};

export const HAS_SUPABASE_CONFIG = Boolean(supabaseUrl && supabaseKey);
export const ENABLE_LEGACY_SUPABASE_SYNC = false;
export const ENABLE_RLS_CLOUD_SYNC = import.meta.env.VITE_ENABLE_RLS_CLOUD_SYNC === 'true';
export const REQUIRE_SUPABASE_AUTH = import.meta.env.VITE_REQUIRE_SUPABASE_AUTH === 'true';
export const ENABLE_SETTINGS_TABLE = import.meta.env.VITE_ENABLE_SETTINGS_TABLE === 'true';
export const supabase = HAS_SUPABASE_CONFIG ? createClient(supabaseUrl, supabaseKey, supabaseClientOptions) : null;

// ==========================================
// Environment settings
// ==========================================
export const IS_DEV_MODE = import.meta.env.VITE_SUPABASE_USE_TEST_TABLE === 'true';
const TARGET_TABLE = import.meta.env.VITE_SUPABASE_TABLE || (IS_DEV_MODE ? 'test_user_data' : 'user_data');
const STUDENT_LOGIN_EMAIL_DOMAIN = (import.meta.env.VITE_STUDENT_LOGIN_EMAIL_DOMAIN || '').trim().replace(/^@/, '');
const STUDENT_LOGIN_EMAIL_PREFIX = import.meta.env.VITE_STUDENT_LOGIN_EMAIL_PREFIX || 'dlesson-student-';
const STUDENT_LOGIN_NUMBER_PAD = parseEnvInteger(import.meta.env.VITE_STUDENT_LOGIN_NUMBER_PAD || import.meta.env.VITE_STUDENT_LOGIN_PAD, 3, 1, 8);
const STUDENT_LOGIN_MIN = parseEnvInteger(import.meta.env.VITE_STUDENT_LOGIN_MIN, 1, 1, 999);
const STUDENT_LOGIN_MAX = Math.max(STUDENT_LOGIN_MIN, parseEnvInteger(import.meta.env.VITE_STUDENT_LOGIN_MAX, 40, STUDENT_LOGIN_MIN, 999));
const STUDENT_LOGIN_PASSCODE_MIN_LENGTH = parseEnvInteger(import.meta.env.VITE_STUDENT_LOGIN_PASSCODE_MIN_LENGTH, 6, 4, 24);
const STUDENT_LOGIN_PASSCODE_MAX_LENGTH = parseEnvInteger(import.meta.env.VITE_STUDENT_LOGIN_PASSCODE_MAX_LENGTH, 12, STUDENT_LOGIN_PASSCODE_MIN_LENGTH, 32);
const STUDENT_IDLE_LOGOUT_DEFAULT_MINUTES = parseEnvInteger(import.meta.env.VITE_STUDENT_IDLE_LOGOUT_MINUTES, 20, 0, 240);

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
let studentLoginState = { number: '', passcode: '' };
let pendingStudentLoginNumber = '';
let studentIdleLogoutTimer = null;
let studentIdleWatcherStarted = false;

const LESSON_ACCESS_BASE_COLUMNS = 'auth_user_id,user_data_id,role';
const LESSON_ACCESS_SCOPED_COLUMNS = `${LESSON_ACCESS_BASE_COLUMNS},scope_type,scope_value`;

function getSupabaseProjectRef(url) {
    if (!url) return '';
    try {
        return new URL(url).hostname.split('.')[0] || '';
    } catch (_err) {
        return '';
    }
}

function getSupabaseSessionStorage() {
    if (typeof window === 'undefined') return null;
    try {
        return window.sessionStorage || null;
    } catch (_err) {
        return null;
    }
}

function parseEnvInteger(value, fallback, min, max) {
    const parsed = Number.parseInt(value, 10);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.min(max, Math.max(min, parsed));
}

function forEachBrowserStorage(callback) {
    if (typeof window === 'undefined') return;
    [window.localStorage, window.sessionStorage].forEach(storage => {
        if (!storage) return;
        try {
            callback(storage);
        } catch (err) {
            console.warn('Failed to access browser storage:', err);
        }
    });
}

function removeSupabaseAuthStorage() {
    const storageKeys = getSupabaseAuthStorageKeys();
    if (storageKeys.length === 0) return;
    forEachBrowserStorage(storage => {
        storageKeys.forEach(key => {
            storage.removeItem(key);
            storage.removeItem(`${key}-code-verifier`);
            storage.removeItem(`${key}-user`);
        });
    });
}

function getSupabaseAuthStorageKeys() {
    return [SUPABASE_AUTH_STORAGE_KEY, SUPABASE_LEGACY_AUTH_STORAGE_KEY].filter(Boolean);
}

function removePersistentSupabaseAuthStorage() {
    if (typeof window === 'undefined' || !window.localStorage) return;
    const storageKeys = getSupabaseAuthStorageKeys();
    if (storageKeys.length === 0) return;
    try {
        storageKeys.forEach(key => {
            window.localStorage.removeItem(key);
            window.localStorage.removeItem(`${key}-code-verifier`);
            window.localStorage.removeItem(`${key}-user`);
        });
    } catch (err) {
        console.warn('Failed to clear persistent auth storage:', err);
    }
}

removePersistentSupabaseAuthStorage();

function isInvalidRefreshTokenError(error) {
    const message = `${error?.name || ''} ${error?.message || ''} ${error?.code || ''} ${error?.status || ''}`;
    return /invalid refresh token|refresh token not found|invalid_grant/i.test(message);
}

async function discardStaleSupabaseSession() {
    if (supabase) {
        try {
            await supabase.auth.signOut({ scope: 'local' });
        } catch (err) {
            if (!isInvalidRefreshTokenError(err)) {
                console.warn('Failed to clear stale auth session:', err);
            }
        }
    }
    removeSupabaseAuthStorage();
}

function canUseRlsCloudSync() {
    return Boolean(supabase && REQUIRE_SUPABASE_AUTH && ENABLE_RLS_CLOUD_SYNC);
}

function canUseLegacyCloudSync() {
    return Boolean(supabase && ENABLE_LEGACY_SUPABASE_SYNC && !canUseRlsCloudSync());
}

function canUseSettingsTable() {
    return Boolean(supabase && REQUIRE_SUPABASE_AUTH && ENABLE_RLS_CLOUD_SYNC && ENABLE_SETTINGS_TABLE);
}

function normalizeStudentIdleLogoutMinutes(value, fallback = STUDENT_IDLE_LOGOUT_DEFAULT_MINUTES) {
    const parsed = Number.parseInt(value, 10);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.min(240, Math.max(0, parsed));
}

export function getStudentIdleLogoutMinutes() {
    return normalizeStudentIdleLogoutMinutes(users?.[GLOBAL_SETTINGS_ID]?.studentIdleLogoutMinutes);
}

function getStudentIdleLogoutMs() {
    return getStudentIdleLogoutMinutes() * 60 * 1000;
}

export function refreshStudentIdleLogoutTimer() {
    resetStudentIdleLogoutTimer();
}

function shouldUseStudentIdleLogout() {
    return Boolean(
        REQUIRE_SUPABASE_AUTH
        && getStudentIdleLogoutMs() > 0
        && currentUser
        && getCurrentLessonRole() === 'student'
    );
}

function clearStudentIdleLogoutTimer() {
    if (studentIdleLogoutTimer) clearTimeout(studentIdleLogoutTimer);
    studentIdleLogoutTimer = null;
}

function resetStudentIdleLogoutTimer() {
    clearStudentIdleLogoutTimer();
    if (!shouldUseStudentIdleLogout()) return;

    const timeoutMs = getStudentIdleLogoutMs();
    studentIdleLogoutTimer = setTimeout(() => {
        void handleStudentIdleLogout();
    }, timeoutMs);
}

async function handleStudentIdleLogout() {
    if (!shouldUseStudentIdleLogout()) return;
    await signOutSupabaseAuth('一定時間操作がなかったため、自動でログアウトしました。もう一度ログインしてください。');
}

function handleStudentActivity() {
    if (studentIdleLogoutTimer || shouldUseStudentIdleLogout()) resetStudentIdleLogoutTimer();
}

function startStudentIdleLogoutWatcher() {
    if (studentIdleWatcherStarted || typeof window === 'undefined') return;
    studentIdleWatcherStarted = true;
    ['pointerdown', 'keydown', 'touchstart'].forEach(eventName => {
        window.addEventListener(eventName, handleStudentActivity, { passive: true });
    });
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

function getSingleStudentAccessUserId() {
    if (!canUseRlsCloudSync() || getCurrentLessonRole() !== 'student') return null;
    const userIds = Array.from(new Set(
        currentLessonAccess
            .filter(access => (
                access?.role === 'student'
                && access.user_data_id
                && !isSystemUserId(access.user_data_id)
            ))
            .map(access => access.user_data_id)
    ));
    return userIds.length === 1 ? userIds[0] : null;
}

function maybeEnterSingleStudentUser() {
    const studentUserId = getSingleStudentAccessUserId();
    if (!studentUserId || currentUser || !users[studentUserId]) return false;
    login(studentUserId);
    return true;
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
        if (isInvalidRefreshTokenError(err)) {
            await discardStaleSupabaseSession();
            setSyncStatus('auth expired');
        } else {
            console.error('Failed to load lesson access:', err);
        }
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
        data.globalMistakes = sanitizeGlobalMistakes(data.globalMistakes);
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
    const gate = document.getElementById('supabase-auth-gate');
    if (gate) {
        gate.querySelectorAll('button, input').forEach(element => {
            element.disabled = isBusy;
        });
    }

    const submit = document.getElementById('supabase-auth-submit');
    const studentSubmit = document.getElementById('student-auth-submit');
    if (submit) submit.innerText = isBusy ? 'ログイン中...' : 'ログイン';
    if (studentSubmit) studentSubmit.innerText = isBusy ? 'ログイン中...' : 'ログイン';
    if (message) setAuthGateMessage(message);
    if (!isBusy) updateStudentLoginUi();
}

function hideAuthGate() {
    const gate = document.getElementById('supabase-auth-gate');
    if (gate) gate.remove();
}

function isStudentClickLoginEnabled() {
    return Boolean(STUDENT_LOGIN_EMAIL_DOMAIN);
}

function resetStudentLoginState() {
    studentLoginState = { number: '', passcode: '' };
}

function padStudentLoginNumber(number) {
    return String(number).padStart(STUDENT_LOGIN_NUMBER_PAD, '0');
}

function buildStudentLoginEmail(number) {
    return `${STUDENT_LOGIN_EMAIL_PREFIX}${padStudentLoginNumber(number)}@${STUDENT_LOGIN_EMAIL_DOMAIN}`;
}

function buildStaffAuthFormHtml(isPrimary = false) {
    const topMargin = isPrimary ? '0' : '14px';
    return `
        <form id="supabase-auth-form" style="margin-top:${topMargin};">
            <label style="display:block; color:#334155; font-weight:700; font-size:14px; margin-bottom:12px;">
                メールアドレス
                <input id="supabase-auth-email" type="email" autocomplete="username" required style="box-sizing:border-box; width:100%; margin-top:6px; border:1px solid #cbd5e1; border-radius:6px; padding:12px; font-size:16px;">
            </label>
            <label style="display:block; color:#334155; font-weight:700; font-size:14px; margin-bottom:18px;">
                パスワード
                <input id="supabase-auth-password" type="password" autocomplete="current-password" required style="box-sizing:border-box; width:100%; margin-top:6px; border:1px solid #cbd5e1; border-radius:6px; padding:12px; font-size:16px;">
            </label>
            <button id="supabase-auth-submit" class="btn-primary" type="submit" style="width:100%; min-height:46px; font-size:17px;">ログイン</button>
        </form>
    `;
}

function buildStudentAuthPanelHtml() {
    return `
        <form id="student-auth-form" class="student-login-panel">
            <h3 class="student-login-title">児童ログイン</h3>
            <p class="student-login-copy">児童番号とあいことばを入力してください。</p>
            <div class="student-login-fields">
                <label class="student-login-label">
                    児童番号
                    <input id="student-login-number" class="student-login-input" type="text" inputmode="numeric" pattern="[0-9]*" autocomplete="off" placeholder="例: 1" required>
                </label>
                <label class="student-login-label">
                    あいことば
                    <input id="student-login-passcode" class="student-login-input" type="password" inputmode="numeric" pattern="[0-9]*" autocomplete="current-password" placeholder="${STUDENT_LOGIN_PASSCODE_MIN_LENGTH}けた以上" required>
                </label>
            </div>
            <button id="student-auth-submit" class="btn-primary student-login-submit" type="submit">ログイン</button>
            <p id="supabase-auth-message" class="student-login-message" style="color:#475569;"></p>
        </form>
    `;
}

function buildAuthGateHtml(isError = false) {
    const hasStudentLogin = isStudentClickLoginEnabled();
    const cardWidth = hasStudentLogin ? '520px' : '420px';
    const staffPanel = hasStudentLogin
        ? `<details style="margin-top:12px; border-top:1px solid #e2e8f0; padding-top:12px;">
                <summary style="cursor:pointer; color:#0f172a; font-weight:800; font-size:15px;">先生・管理者ログイン</summary>
                ${buildStaffAuthFormHtml(false)}
            </details>`
        : buildStaffAuthFormHtml(true);

    return `
        <div id="supabase-auth-card" style="box-sizing:border-box; width:min(${cardWidth}, 100%); max-height:calc(100vh - 32px); overflow:auto; background:#fff; border:1px solid #dbe3ef; border-radius:8px; box-shadow:0 18px 45px rgba(15,23,42,0.18); padding:22px;">
            <h2 style="margin:0 0 14px; color:#0f172a; font-size:24px; letter-spacing:0; text-align:center;">Dレッスン ログイン</h2>
            <style>
                .student-login-panel {
                    border:1px solid #dbe3ef;
                    border-radius:8px;
                    background:#f8fafc;
                    padding:22px;
                }
                .student-login-title {
                    margin:0 0 6px;
                    color:#0f172a;
                    font-size:22px;
                    letter-spacing:0;
                }
                .student-login-copy {
                    margin:0;
                    color:#475569;
                    font-size:14px;
                    line-height:1.5;
                }
                .student-login-fields {
                    display:grid;
                    gap:14px;
                    margin-top:18px;
                }
                .student-login-label {
                    display:block;
                    color:#334155;
                    font-weight:800;
                    font-size:15px;
                }
                .student-login-input {
                    box-sizing:border-box;
                    width:100%;
                    margin-top:7px;
                    border:1px solid #cbd5e1;
                    border-radius:6px;
                    padding:14px;
                    background:#fff;
                    color:#0f172a;
                    font-size:20px;
                    font-weight:700;
                    letter-spacing:0;
                }
                .student-login-submit {
                    width:100%;
                    min-height:54px;
                    margin-top:18px;
                    font-size:18px;
                }
                .student-login-message {
                    min-height:24px;
                    margin:12px 0 0;
                    font-size:14px;
                    line-height:1.5;
                    font-weight:700;
                }
                .student-login-input:focus {
                    outline:3px solid #93c5fd;
                    outline-offset:2px;
                }
                @media (max-width: 760px) {
                    #supabase-auth-card {
                        padding:16px !important;
                    }
                }
            </style>
            ${hasStudentLogin ? buildStudentAuthPanelHtml() : ''}
            ${staffPanel}
            ${hasStudentLogin ? '' : `<p id="supabase-auth-message" style="min-height:22px; margin:14px 0 0; color:${isError ? '#b91c1c' : '#475569'}; font-size:14px; line-height:1.5;"></p>`}
        </div>
    `;
}

function updateStudentLoginUi() {
    if (!isStudentClickLoginEnabled()) return;

    const numberInput = document.getElementById('student-login-number');
    if (numberInput && numberInput.value !== studentLoginState.number) {
        numberInput.value = studentLoginState.number;
    }

    const passcodeInput = document.getElementById('student-login-passcode');
    if (passcodeInput && passcodeInput.value !== studentLoginState.passcode) {
        passcodeInput.value = studentLoginState.passcode;
    }

    const submit = document.getElementById('student-auth-submit');
    if (submit) {
        submit.disabled = !studentLoginState.number || !studentLoginState.passcode;
    }
}

function bindAuthGateEvents() {
    const staffForm = document.getElementById('supabase-auth-form');
    if (staffForm) staffForm.onsubmit = handleAuthFormSubmit;

    const studentForm = document.getElementById('student-auth-form');
    if (studentForm) studentForm.onsubmit = handleStudentAuthFormSubmit;

    const numberInput = document.getElementById('student-login-number');
    if (numberInput) {
        numberInput.oninput = () => {
            studentLoginState.number = numberInput.value.replace(/\D/g, '').slice(0, 3);
            setAuthGateMessage('');
            updateStudentLoginUi();
        };
    }

    const passcodeInput = document.getElementById('student-login-passcode');
    if (passcodeInput) {
        passcodeInput.oninput = () => {
            studentLoginState.passcode = passcodeInput.value.replace(/\D/g, '').slice(0, STUDENT_LOGIN_PASSCODE_MAX_LENGTH);
            setAuthGateMessage('');
            updateStudentLoginUi();
        };
    }

    updateStudentLoginUi();
}

function completeAuthGateLogin() {
    hideAuthGate();
    setSyncStatus('authenticated');

    const resolve = authGateResolve;
    const afterLogin = authGateAfterLogin;
    authGatePromise = null;
    authGateResolve = null;
    authGateAfterLogin = null;

    if (resolve) resolve(true);
    if (afterLogin) afterLogin();
}

function getStudentAuthErrorMessage(error) {
    const message = `${error?.message || ''} ${error?.name || ''} ${error?.status || ''}`.toLowerCase();
    if (message.includes('email not confirmed') || message.includes('not confirmed')) {
        return 'この児童アカウントはまだ確認済みになっていません。Supabase AuthでConfirm emailを確認してください。';
    }
    if (message.includes('invalid login credentials')) {
        return '児童番号またはあいことばが違います。番号とあいことばを確認してください。';
    }
    return 'ログインできませんでした。児童番号、あいことば、Supabase Authの登録を確認してください。';
}

async function handleStudentAuthFormSubmit(event) {
    event.preventDefault();

    const numberInput = document.getElementById('student-login-number');
    const passcodeInput = document.getElementById('student-login-passcode');
    if (numberInput) studentLoginState.number = numberInput.value.replace(/\D/g, '');
    if (passcodeInput) studentLoginState.passcode = passcodeInput.value.replace(/\D/g, '');
    updateStudentLoginUi();

    if (!supabase) {
        setAuthGateMessage('Supabaseのログイン設定が見つかりません。.env.local を確認してください。', true);
        return;
    }

    const studentNumber = Number.parseInt(studentLoginState.number, 10);
    if (!Number.isFinite(studentNumber)) {
        setAuthGateMessage('児童番号を選んでください。', true);
        return;
    }

    if (studentNumber < STUDENT_LOGIN_MIN || studentNumber > STUDENT_LOGIN_MAX) {
        setAuthGateMessage(`児童番号は${STUDENT_LOGIN_MIN}〜${STUDENT_LOGIN_MAX}の範囲で入力してください。`, true);
        return;
    }

    if (studentLoginState.passcode.length < STUDENT_LOGIN_PASSCODE_MIN_LENGTH) {
        setAuthGateMessage(`あいことばは${STUDENT_LOGIN_PASSCODE_MIN_LENGTH}けた以上で入力してください。`, true);
        return;
    }

    setAuthGateBusy(true, 'ログイン中...');
    try {
        const normalizedNumber = String(studentNumber);
        const email = buildStudentLoginEmail(normalizedNumber);
        const { error } = await supabase.auth.signInWithPassword({
            email,
            password: studentLoginState.passcode
        });
        if (error) throw error;
        pendingStudentLoginNumber = normalizedNumber;
        completeAuthGateLogin();
    } catch (err) {
        console.error('Student auth sign-in failed:', err);
        setAuthGateBusy(false);
        setAuthGateMessage(getStudentAuthErrorMessage(err), true);
    }
}

function showAuthGate(message = '', isError = false, afterLogin = null) {
    authGateAfterLogin = afterLogin;

    resetStudentLoginState();

    let gate = document.getElementById('supabase-auth-gate');
    if (!gate) {
        gate = document.createElement('div');
        gate.id = 'supabase-auth-gate';
        document.body.appendChild(gate);
    }

    gate.style.cssText = 'position:fixed; inset:0; z-index:20000; background:#f6f7fb; display:flex; align-items:center; justify-content:center; padding:24px;';
    gate.innerHTML = buildAuthGateHtml(isError);
    setAuthGateMessage(message, isError);
    bindAuthGateEvents();

    const studentNumber = document.getElementById('student-login-number');
    if (studentNumber) setTimeout(() => studentNumber.focus(), 0);
    const email = document.getElementById('supabase-auth-email');
    if (email && !isStudentClickLoginEnabled()) setTimeout(() => email.focus(), 0);
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
        completeAuthGateLogin();
    } catch (err) {
        console.error('Auth sign-in failed:', err);
        setAuthGateBusy(false);
        setAuthGateMessage('メールアドレスまたはパスワードを確認してください。', true);
    }
}

async function ensureSupabaseSession() {
    if (!REQUIRE_SUPABASE_AUTH) return true;
    let gateMessage = '先生または管理者のアカウントでログインしてください。';
    let gateMessageIsError = false;

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
        if (isInvalidRefreshTokenError(err)) {
            await discardStaleSupabaseSession();
            setSyncStatus('auth expired');
            gateMessage = 'ログインの有効期限が切れました。もう一度ログインしてください。';
        } else {
            console.error('Auth session check failed:', err);
            gateMessage = 'ログイン状態を確認できませんでした。もう一度ログインしてください。';
            gateMessageIsError = true;
        }
    }

    if (authGatePromise) return authGatePromise;
    authGatePromise = new Promise(resolve => {
        authGateResolve = resolve;
        showAuthGate(gateMessage, gateMessageIsError);
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

export async function signOutSupabaseAuth(message = 'ログアウトしました。もう一度ログインしてください。') {
    if (!REQUIRE_SUPABASE_AUTH) return false;

    clearStudentIdleLogoutTimer();
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
            await supabase.auth.signOut({ scope: 'local' });
        } catch (err) {
            if (!isInvalidRefreshTokenError(err)) {
                console.error('Auth sign-out failed:', err);
            }
        }
    }
    removeSupabaseAuthStorage();

    setSyncStatus('signed out');
    showAuthGate(message, false, () => { void loadUsers(); });
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
    const enteredStudent = maybeEnterSingleStudentUser();
    if (enteredStudent) {
        pendingStudentLoginNumber = '';
        return;
    }

    if (pendingStudentLoginNumber) {
        const message = getCurrentLessonRole() === 'student'
            ? `${pendingStudentLoginNumber}番でログインできましたが、児童データが見つかりません。user_dataへの移行とlesson_user_accessのuser_data_idを確認してください。`
            : `${pendingStudentLoginNumber}番でログインできましたが、Dレッスンの利用権限が見つかりません。lesson_user_accessにこの児童のAuth User IDが登録されているか確認してください。`;
        pendingStudentLoginNumber = '';
        setSyncStatus('student access missing');
        showAuthGate(message, true, () => { void loadUsers(); });
    }
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
    resetStudentIdleLogoutTimer();

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

startStudentIdleLogoutWatcher();
