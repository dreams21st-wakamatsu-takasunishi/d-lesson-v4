import { createClient } from '@supabase/supabase-js';
import { SoundManager } from '../utils/sound.js';
import { calculateGrade, sortGrades } from '../utils/helpers.js';
import { sanitizeGlobalMistakes } from '../utils/weak-mistakes.js';
import { THEMES, EFFECTS } from '../data/constants.js';
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

async function getSupabaseFunctionErrorMessage(error) {
    const response = error?.context || error?.response;
    if (response && typeof response.clone === 'function') {
        try {
            const contentType = response.headers?.get?.('content-type') || '';
            if (contentType.includes('application/json')) {
                const payload = await response.clone().json();
                if (payload?.error) return String(payload.error);
                if (payload?.message) return String(payload.message);
            } else {
                const text = await response.clone().text();
                if (text.trim()) return text.trim();
            }
        } catch (_err) {
            // Fall through to the generic Supabase client error.
        }
    }
    return error?.message || 'Edge Function returned an error.';
}

export async function invokeLessonFunction(functionName, body) {
    if (!supabase) throw new Error('Supabase設定が見つかりません。');
    const { data, error } = await supabase.functions.invoke(functionName, { body });
    if (error) throw new Error(await getSupabaseFunctionErrorMessage(error));
    if (data?.error) throw new Error(String(data.error));
    return data;
}

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
const ENABLE_PUBLIC_STUDENT_REGISTRATION = import.meta.env.VITE_ENABLE_PUBLIC_STUDENT_REGISTRATION !== 'false';
const PUBLIC_STUDENT_REGISTRATION_FUNCTION = import.meta.env.VITE_PUBLIC_STUDENT_REGISTRATION_FUNCTION || 'public-register-student';

export const STORAGE_KEY = 'pc_practice_v5_split';
const GUEST_STORAGE_KEY = `${STORAGE_KEY}_guest_session`;
const GUEST_USER_ID = '__GUEST_USER__';
const AUTH_GATE_MODES = Object.freeze({
    STUDENT: 'student',
    STAFF: 'staff',
    REGISTER: 'register'
});
export const USER_ACCOUNT_TYPES = Object.freeze({
    CLASSROOM: 'classroom',
    PUBLIC: 'public',
    GUEST: 'guest'
});
export const GLOBAL_SETTINGS_ID = '__GLOBAL_SETTINGS__';
export const MASTER_DEBUG_ID = 'Master_Debug';
export const SETTINGS_TABLE_KEY = `${TARGET_TABLE}:global`;
export const DEFAULT_CAMPUS_ID = 'main';
const PRACTICE_LOG_LIMIT = parseEnvInteger(import.meta.env.VITE_PRACTICE_LOG_LIMIT, 300, 20, 2000);
const PRACTICE_LOG_RETENTION_DAYS = parseEnvInteger(import.meta.env.VITE_PRACTICE_LOG_RETENTION_DAYS, 180, 0, 3650);

export let users = {};
export let currentUser = null;
export let currentSelectedGrade = null;
export let currentLessonAccess = [];
let authGatePromise = null;
let authGateResolve = null;
let authGateAfterLogin = null;
let studentLoginState = { number: '', passcode: '', showPasscode: false };
let pendingStudentLoginNumber = '';
let authGateMode = AUTH_GATE_MODES.STUDENT;
let guestMode = false;
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
    return Boolean(!guestMode && supabase && REQUIRE_SUPABASE_AUTH && ENABLE_RLS_CLOUD_SYNC);
}

function canUseLegacyCloudSync() {
    return Boolean(supabase && ENABLE_LEGACY_SUPABASE_SYNC && !canUseRlsCloudSync());
}

function canUseSettingsTable() {
    return Boolean(!guestMode && supabase && REQUIRE_SUPABASE_AUTH && ENABLE_RLS_CLOUD_SYNC && ENABLE_SETTINGS_TABLE);
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
    if (guestMode) return 'guest';
    if (ENABLE_RLS_CLOUD_SYNC && !REQUIRE_SUPABASE_AUTH) return 'rls auth missing';
    if (REQUIRE_SUPABASE_AUTH && HAS_SUPABASE_CONFIG) return 'auth only';
    return HAS_SUPABASE_CONFIG ? 'cloud locked' : 'local only';
}

export function isGuestMode() {
    return guestMode;
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

function pruneUsersToSingleStudentAccessIfNeeded() {
    const studentUserId = getSingleStudentAccessUserId();
    if (!studentUserId || !users?.[studentUserId]) return;

    const scopedUsers = {};
    if (users[GLOBAL_SETTINGS_ID]) scopedUsers[GLOBAL_SETTINGS_ID] = users[GLOBAL_SETTINGS_ID];
    scopedUsers[studentUserId] = users[studentUserId];
    users = scopedUsers;
}

function lessonAccessMatchesUserData(access, userId) {
    if (!access || !userId || access.role !== 'teacher') return false;
    const user = users?.[userId];
    if (!user || isSystemUserId(userId)) return false;

    const scopeType = access.scope_type || 'all';
    const scopeValues = parseScopeValues(access.scope_value);
    if (scopeType === 'all') return true;

    const campusId = getUserCampusId(user);
    const group = String(user.group || '').trim();
    if (scopeType === 'campus') return scopeValues.includes(campusId);
    if (scopeType === 'group') return scopeValues.includes(group);
    if (scopeType === 'campus_group') return scopeValues.includes(`${campusId}:${group}`);
    return false;
}

export function canManageScopedUserRow(userId) {
    if (!userId) return false;
    if (!canUseRlsCloudSync()) return true;
    if (hasLessonRole('admin')) return true;
    return currentLessonAccess.some(access => lessonAccessMatchesUserData(access, userId));
}

export function canWriteUserRow(userId) {
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

function parseScopeValues(scopeValue) {
    return String(scopeValue || '')
        .split(',')
        .map(value => value.trim())
        .filter(Boolean);
}

export function getTeacherScopeSummary(accessRows = currentLessonAccess) {
    const teacherRows = (Array.isArray(accessRows) ? accessRows : []).filter(access => access?.role === 'teacher');
    if (teacherRows.length === 0) return 'なし';
    if (teacherRows.some(access => (access.scope_type || 'all') === 'all')) return '全児童';
    const campuses = Array.from(new Set(
        teacherRows
            .filter(access => access.scope_type === 'campus')
            .flatMap(access => parseScopeValues(access.scope_value))
            .map(getCampusName)
    ));
    const groups = Array.from(new Set(
        teacherRows
            .filter(access => access.scope_type === 'group')
            .flatMap(access => parseScopeValues(access.scope_value))
    ));
    if (campuses.length && groups.length) return `校舎: ${campuses.join(',')} / グループ: ${groups.join(',')}`;
    if (campuses.length) return `校舎: ${campuses.join(',')}`;
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

function getGuestStorage() {
    if (typeof window === 'undefined') return null;
    try {
        return window.sessionStorage || null;
    } catch (_err) {
        return null;
    }
}

function createGuestUserRecord(existing = {}) {
    const base = existing && typeof existing === 'object' ? existing : {};
    return {
        ...base,
        displayName: 'ゲスト',
        userDataId: GUEST_USER_ID,
        birthdate: '',
        grade: 'ゲスト',
        campusId: DEFAULT_CAMPUS_ID,
        mouseLevel: Number.isFinite(Number(base.mouseLevel)) ? Number(base.mouseLevel) : 0,
        keyboardSequence: Number.isFinite(Number(base.keyboardSequence)) ? Number(base.keyboardSequence) : 0,
        coins: Number.isFinite(Number(base.coins)) ? Number(base.coins) : 0,
        items: Array.isArray(base.items) ? base.items : [],
        tickets: Array.isArray(base.tickets) ? base.tickets : [],
        loginStamps: Array.isArray(base.loginStamps) ? base.loginStamps : [],
        group: 'guest',
        isGuest: true
    };
}

function loadGuestUsers() {
    const storage = getGuestStorage();
    let existing = {};
    if (storage) {
        try {
            const parsed = JSON.parse(storage.getItem(GUEST_STORAGE_KEY) || '{}');
            existing = parsed?.[GUEST_USER_ID] || parsed || {};
        } catch (_err) {
            existing = {};
        }
    }
    users = { [GUEST_USER_ID]: createGuestUserRecord(existing) };
}

function saveGuestUsers() {
    const storage = getGuestStorage();
    if (!storage) return;
    const guest = createGuestUserRecord(users?.[GUEST_USER_ID] || {});
    storage.setItem(GUEST_STORAGE_KEY, JSON.stringify({ [GUEST_USER_ID]: guest }));
}

function clearGuestUsers() {
    const storage = getGuestStorage();
    if (storage) storage.removeItem(GUEST_STORAGE_KEY);
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

function getPracticeLogRetentionCutoffMs(nowMs = Date.now()) {
    if (!PRACTICE_LOG_RETENTION_DAYS) return null;
    return nowMs - (PRACTICE_LOG_RETENTION_DAYS * 24 * 60 * 60 * 1000);
}

function normalizePracticeLogs(logs) {
    if (!Array.isArray(logs)) return [];
    const nowMs = Date.now();
    const cutoffMs = getPracticeLogRetentionCutoffMs(nowMs);
    return logs
        .filter(log => log && typeof log === 'object')
        .map(log => {
            const parsedAt = Date.parse(log.at || '');
            const atMs = Number.isFinite(parsedAt) ? parsedAt : nowMs;
            return {
                id: String(log.id || createPracticeLogId()),
                at: new Date(atMs).toISOString(),
                atMs,
                category: String(log.category || 'practice'),
                title: String(log.title || '練習'),
                detail: String(log.detail || ''),
                amount: String(log.amount || ''),
                coins: Number.isFinite(Number(log.coins)) ? Number(log.coins) : 0
            };
        })
        .filter(log => cutoffMs === null || log.atMs >= cutoffMs)
        .sort((a, b) => {
            return b.atMs - a.atMs;
        })
        .slice(0, PRACTICE_LOG_LIMIT)
        .map(({ atMs: _atMs, ...log }) => log);
}

function normalizeCampusRecord(record) {
    const id = String(record?.id || record?.campusId || record?.code || '').trim() || DEFAULT_CAMPUS_ID;
    const name = String(record?.name || record?.label || id).trim() || id;
    const code = String(record?.code || id).trim() || id;
    return { id, name, code };
}

export function ensureCampusSettings() {
    if (!users || typeof users !== 'object') users = {};
    if (!users[GLOBAL_SETTINGS_ID] || typeof users[GLOBAL_SETTINGS_ID] !== 'object') {
        users[GLOBAL_SETTINGS_ID] = {};
    }

    const settings = users[GLOBAL_SETTINGS_ID];
    const campuses = Array.isArray(settings.campuses) ? settings.campuses.map(normalizeCampusRecord) : [];
    const byId = new Map();
    campuses.forEach(campus => {
        if (!byId.has(campus.id)) byId.set(campus.id, campus);
    });
    if (!byId.has(DEFAULT_CAMPUS_ID)) {
        byId.set(DEFAULT_CAMPUS_ID, { id: DEFAULT_CAMPUS_ID, name: '本校', code: DEFAULT_CAMPUS_ID });
    }
    settings.campuses = Array.from(byId.values()).sort((a, b) => {
        if (a.id === DEFAULT_CAMPUS_ID) return -1;
        if (b.id === DEFAULT_CAMPUS_ID) return 1;
        return a.name.localeCompare(b.name, 'ja');
    });
    return settings.campuses;
}

export function getCampusList() {
    return ensureCampusSettings();
}

export function normalizeCampusId(value) {
    const text = String(value || '').trim();
    if (!text) return DEFAULT_CAMPUS_ID;
    const campus = getCampusList().find(item => (
        item.id === text || item.name === text || item.code === text
    ));
    return campus ? campus.id : text;
}

export function getCampusName(campusId) {
    const id = normalizeCampusId(campusId);
    const campus = getCampusList().find(item => item.id === id);
    return campus?.name || id || '本校';
}

export function getCampusCode(campusId) {
    const id = normalizeCampusId(campusId);
    const campus = getCampusList().find(item => item.id === id);
    return campus?.code || id || DEFAULT_CAMPUS_ID;
}

export function getUserCampusId(userOrId) {
    const data = typeof userOrId === 'string' ? users[userOrId] : userOrId;
    return normalizeCampusId(data?.campusId || data?.campus || DEFAULT_CAMPUS_ID);
}

export function getUserAccountType(userOrId) {
    const userId = typeof userOrId === 'string' ? userOrId : '';
    const data = typeof userOrId === 'string' ? users[userOrId] : userOrId;
    if (userId === GUEST_USER_ID || data?.isGuest) return USER_ACCOUNT_TYPES.GUEST;
    if (
        data?.publicRegistration === true
        || data?.registrationSource === 'public'
        || data?.registration_source === 'public'
        || data?.accountType === USER_ACCOUNT_TYPES.PUBLIC
    ) {
        return USER_ACCOUNT_TYPES.PUBLIC;
    }
    const campusId = normalizeCampusId(data?.campusId || data?.campus || '');
    const group = String(data?.group || '').trim().toLowerCase();
    if (campusId === 'public' && group === 'public') return USER_ACCOUNT_TYPES.PUBLIC;
    return USER_ACCOUNT_TYPES.CLASSROOM;
}

export function getUserAccountTypeLabel(accountType) {
    if (accountType === USER_ACCOUNT_TYPES.PUBLIC) return '公開登録';
    if (accountType === USER_ACCOUNT_TYPES.GUEST) return 'ゲスト';
    return '教室';
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
    users[currentUser].practiceLogs = normalizePracticeLogs([log, ...logs]);
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
        coinsText: coins ? `${coins > 0 ? '+' : ''}${coins}コイン` : ''
    };
}

function normalizeUserRecord(userId, data) {
    if (!data || typeof data !== 'object') return data;
    if (userId === GLOBAL_SETTINGS_ID) {
        ensureCampusSettings();
        return data;
    }
    if (!isSystemUserId(userId)) {
        if (!data.displayName) data.displayName = getUserDataDisplayName(userId, data);
        if (!data.userDataId) data.userDataId = userId;
        data.campusId = getUserCampusId(data);
        data.globalMistakes = sanitizeGlobalMistakes(data.globalMistakes);
        data.practiceLogs = normalizePracticeLogs(data.practiceLogs);
        data.themeFavorites = Array.isArray(data.themeFavorites) ? Array.from(new Set(data.themeFavorites.map(String))) : [];
        data.effectFavorites = Array.isArray(data.effectFavorites) ? Array.from(new Set(data.effectFavorites.map(String))) : [];
        data.randomThemeEnabled = Boolean(data.randomThemeEnabled);
        data.randomEffectEnabled = Boolean(data.randomEffectEnabled);
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
    const registerSubmit = document.getElementById('public-register-submit');
    const guestSubmit = document.getElementById('guest-login-button');
    if (submit) submit.innerText = isBusy ? 'ログイン中...' : 'ログイン';
    if (studentSubmit) studentSubmit.innerText = isBusy ? 'ログイン中...' : 'ログイン';
    if (registerSubmit) registerSubmit.innerText = isBusy ? '登録中...' : '登録する';
    if (guestSubmit) guestSubmit.innerText = isBusy ? '準備中...' : 'ゲストではじめる';
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

function getDefaultAuthGateMode() {
    return isStudentClickLoginEnabled() ? AUTH_GATE_MODES.STUDENT : AUTH_GATE_MODES.STAFF;
}

function normalizeAuthGateMode(mode) {
    if (mode === AUTH_GATE_MODES.STUDENT && isStudentClickLoginEnabled()) return AUTH_GATE_MODES.STUDENT;
    if (mode === AUTH_GATE_MODES.REGISTER && ENABLE_PUBLIC_STUDENT_REGISTRATION) return AUTH_GATE_MODES.REGISTER;
    if (mode === AUTH_GATE_MODES.STAFF) return AUTH_GATE_MODES.STAFF;
    return getDefaultAuthGateMode();
}

function focusAuthGateMode() {
    const focusId = authGateMode === AUTH_GATE_MODES.STUDENT
        ? 'student-login-number'
        : (authGateMode === AUTH_GATE_MODES.REGISTER ? 'public-register-display-name' : 'supabase-auth-email');
    const input = document.getElementById(focusId);
    if (input) setTimeout(() => input.focus(), 0);
}

function setAuthGateMode(mode) {
    const gate = document.getElementById('supabase-auth-gate');
    if (!gate) return;
    authGateMode = normalizeAuthGateMode(mode);
    gate.innerHTML = buildAuthGateHtml(false);
    bindAuthGateEvents();
    setAuthGateMessage('');
    focusAuthGateMode();
}

function resetStudentLoginState() {
    studentLoginState = { number: '', passcode: '', showPasscode: false };
}

function padStudentLoginNumber(number) {
    return String(number).padStart(STUDENT_LOGIN_NUMBER_PAD, '0');
}

function getStudentLoginCampusCode() {
    if (typeof window === 'undefined') return '';
    try {
        const params = new URLSearchParams(window.location.search);
        const value = params.get('campus') || params.get('campusCode') || import.meta.env.VITE_STUDENT_LOGIN_CAMPUS_CODE || '';
        return String(value || '').trim().replace(/[^a-zA-Z0-9_-]/g, '');
    } catch (_err) {
        return '';
    }
}

function buildStudentLoginEmail(number) {
    const campusCode = getStudentLoginCampusCode();
    const campusPart = campusCode ? `${campusCode}-` : '';
    return `${STUDENT_LOGIN_EMAIL_PREFIX}${campusPart}${padStudentLoginNumber(number)}@${STUDENT_LOGIN_EMAIL_DOMAIN}`;
}

function buildStaffAuthFormHtml(isPrimary = false) {
    const topMargin = isPrimary ? '0' : '14px';
    return `
        <form id="supabase-auth-form" class="auth-panel" style="margin-top:${topMargin};">
            <h3 class="auth-panel-title">ログイン</h3>
            <p class="auth-panel-copy">登録済みユーザー、先生、管理者はこちらから入ります。</p>
            <label class="auth-field-label">
                メールアドレス
                <input id="supabase-auth-email" class="auth-text-input" type="email" inputmode="email" autocomplete="username" spellcheck="false" required>
            </label>
            <label class="auth-field-label">
                パスワード
                <input id="supabase-auth-password" class="auth-text-input" type="password" autocomplete="current-password" required>
            </label>
            <button id="supabase-auth-submit" class="btn-primary auth-submit" type="submit">ログイン</button>
        </form>
    `;
}

function buildPublicRegisterPanelHtml() {
    if (!ENABLE_PUBLIC_STUDENT_REGISTRATION) return '';
    return `
        <form id="public-register-form" class="auth-panel">
            <h3 class="auth-panel-title">ユーザー登録</h3>
            <p class="auth-panel-copy">公開版で使う自分用アカウントを作ります。名前は実名ではなくニックネームを使ってください。</p>
            <label class="auth-field-label">
                ニックネーム
                <input id="public-register-display-name" class="auth-text-input" type="text" autocomplete="nickname" maxlength="24" required>
            </label>
            <label class="auth-field-label">
                メールアドレス
                <input id="public-register-email" class="auth-text-input" type="email" inputmode="email" autocomplete="username" spellcheck="false" required>
            </label>
            <label class="auth-field-label">
                生年月日
                <input id="public-register-birthdate" class="auth-text-input" type="date" autocomplete="bday" required>
            </label>
            <label class="auth-field-label">
                パスワード
                <input id="public-register-password" class="auth-text-input" type="password" autocomplete="new-password" required>
            </label>
            <label class="auth-field-label">
                パスワードをもう一度
                <input id="public-register-password-confirm" class="auth-text-input" type="password" autocomplete="new-password" required>
            </label>
            <button id="public-register-submit" class="btn-primary auth-submit" type="submit">登録する</button>
        </form>
    `;
}

function buildStudentAuthPanelHtml() {
    return `
        <form id="student-auth-form" class="auth-panel student-login-panel">
            <h3 class="auth-panel-title student-login-title">教室ログイン</h3>
            <p class="auth-panel-copy student-login-copy">教室からもらった児童番号とあいことばで入ります。</p>
            <div class="student-login-fields">
                <label class="student-login-label">
                    児童番号
                    <input id="student-login-number" class="student-login-input" type="text" inputmode="numeric" pattern="[0-9]*" autocomplete="off" placeholder="例: 1" required>
                </label>
                <label class="student-login-label">
                    あいことば
                    <div class="student-login-passcode-row">
                        <input id="student-login-passcode" class="student-login-input" type="password" inputmode="numeric" pattern="[0-9]*" autocomplete="current-password" placeholder="${STUDENT_LOGIN_PASSCODE_MIN_LENGTH}けた以上" required>
                        <button id="student-login-passcode-toggle" class="student-login-passcode-toggle" type="button" aria-pressed="false">みる</button>
                    </div>
                </label>
            </div>
            <button id="student-auth-submit" class="btn-primary student-login-submit" type="submit">ログイン</button>
        </form>
    `;
}

async function getFunctionErrorMessage(error, fallback = '処理に失敗しました。') {
    if (!error) return fallback;
    const context = error.context;
    if (context && typeof context.clone === 'function') {
        try {
            const body = await context.clone().json();
            if (body?.error) return String(body.error);
            if (body?.message) return String(body.message);
        } catch (_err) {
            // Fall through to the SDK message below.
        }
    }
    return error.message || fallback;
}

function buildGuestPanelHtml() {
    return `
        <section class="auth-panel guest-login-panel">
            <h3 class="auth-panel-title">ゲストとしてプレイ</h3>
            <p class="auth-panel-copy">登録せずに試せます。記録はこのブラウザを閉じると消え、クラウドには保存されません。</p>
            <button id="guest-login-button" class="guest-login-button" type="button">ゲストではじめる</button>
        </section>
    `;
}

function buildAuthGateMainPanelHtml() {
    authGateMode = normalizeAuthGateMode(authGateMode);
    if (authGateMode === AUTH_GATE_MODES.REGISTER) return buildPublicRegisterPanelHtml();
    if (authGateMode === AUTH_GATE_MODES.STAFF) return buildStaffAuthFormHtml(true);
    return isStudentClickLoginEnabled() ? buildStudentAuthPanelHtml() : buildStaffAuthFormHtml(true);
}

function buildAuthGateActionsHtml() {
    const buttons = [];
    if (isStudentClickLoginEnabled() && authGateMode !== AUTH_GATE_MODES.STUDENT) {
        buttons.push('<button type="button" class="auth-gate-switch-button" data-auth-gate-mode="student">教室ログイン</button>');
    }
    if (authGateMode !== AUTH_GATE_MODES.STAFF) {
        buttons.push('<button type="button" class="auth-gate-switch-button" data-auth-gate-mode="staff">通常ログイン</button>');
    }
    if (ENABLE_PUBLIC_STUDENT_REGISTRATION && authGateMode !== AUTH_GATE_MODES.REGISTER) {
        buttons.push('<button type="button" class="auth-gate-switch-button" data-auth-gate-mode="register">ユーザー登録</button>');
    }
    buttons.push('<button id="guest-login-button" class="auth-gate-switch-button auth-gate-guest-button" type="button">ゲストではじめる</button>');

    return `<div class="auth-gate-actions" aria-label="ログイン方法">${buttons.join('')}</div>`;
}

function buildAuthGateHtml(isError = false) {
    authGateMode = normalizeAuthGateMode(authGateMode);
    const cardWidth = authGateMode === AUTH_GATE_MODES.REGISTER ? '620px' : '540px';

    return `
        <div id="supabase-auth-card" style="box-sizing:border-box; width:min(${cardWidth}, 100%); max-height:calc(100vh - 32px); overflow:auto; background:#fff; border:1px solid #dbe3ef; border-radius:8px; box-shadow:0 18px 45px rgba(15,23,42,0.18); padding:22px;">
            <h2 style="margin:0 0 8px; color:#0f172a; font-size:24px; letter-spacing:0; text-align:center;">Dレッスン ログイン</h2>
            <p id="supabase-auth-message" class="auth-gate-message" style="color:${isError ? '#b91c1c' : '#475569'};"></p>
            <style>
                .auth-gate-message {
                    min-height:22px;
                    margin:0 0 14px;
                    text-align:center;
                    font-size:14px;
                    line-height:1.5;
                    font-weight:800;
                }
                .auth-gate-main {
                    min-height:220px;
                }
                .auth-panel {
                    box-sizing:border-box;
                    border:1px solid #dbe3ef;
                    border-radius:8px;
                    background:#f8fafc;
                    padding:18px;
                }
                .auth-panel-title {
                    margin:0 0 6px;
                    color:#0f172a;
                    font-size:20px;
                    letter-spacing:0;
                }
                .auth-panel-copy {
                    margin:0 0 14px;
                    color:#475569;
                    font-size:14px;
                    line-height:1.5;
                    font-weight:700;
                }
                .auth-field-label {
                    display:block;
                    color:#334155;
                    font-weight:800;
                    font-size:14px;
                    margin-bottom:12px;
                }
                .auth-text-input {
                    box-sizing:border-box;
                    width:100%;
                    margin-top:6px;
                    border:1px solid #cbd5e1;
                    border-radius:6px;
                    padding:12px;
                    background:#fff;
                    color:#0f172a;
                    font-size:16px;
                    font-weight:700;
                    letter-spacing:0;
                }
                .auth-submit {
                    width:100%;
                    min-height:48px;
                    font-size:17px;
                }
                .student-login-panel {
                    background:#f0f9ff;
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
                .student-login-passcode-row {
                    display:grid;
                    grid-template-columns:minmax(0, 1fr) 96px;
                    gap:10px;
                    align-items:end;
                    margin-top:7px;
                }
                .student-login-passcode-row .student-login-input {
                    margin-top:0;
                }
                .student-login-passcode-toggle {
                    min-height:54px;
                    margin:0;
                    padding:10px 12px;
                    border:0;
                    border-radius:8px;
                    background:#0284c7;
                    color:#fff;
                    font-size:16px;
                    font-weight:900;
                    box-shadow:0 4px 0 rgba(15,23,42,0.22);
                }
                .student-login-passcode-toggle[aria-pressed="true"] {
                    background:#475569;
                }
                .student-login-submit {
                    width:100%;
                    min-height:54px;
                    margin-top:18px;
                    font-size:18px;
                }
                .auth-gate-actions {
                    display:flex;
                    justify-content:flex-end;
                    align-items:center;
                    gap:8px;
                    flex-wrap:wrap;
                    margin-top:14px;
                }
                .auth-gate-switch-button {
                    min-height:38px;
                    margin:0;
                    padding:8px 12px;
                    border:1px solid #cbd5e1;
                    border-radius:8px;
                    background:#fff;
                    color:#0f172a;
                    font-size:14px;
                    font-weight:800;
                }
                .auth-gate-guest-button {
                    background:#fff7ed;
                    border-color:#fdba74;
                    color:#9a3412;
                }
                .auth-gate-switch-button:disabled {
                    opacity:0.55;
                }
                .auth-text-input:focus,
                .student-login-input:focus {
                    outline:3px solid #93c5fd;
                    outline-offset:2px;
                }
                .auth-gate-switch-button:focus,
                .student-login-passcode-toggle:focus {
                    outline:3px solid #93c5fd;
                    outline-offset:2px;
                }
                @media (max-width: 760px) {
                    #supabase-auth-card {
                        padding:16px !important;
                    }
                    .student-login-passcode-row {
                        grid-template-columns:1fr;
                    }
                    .auth-gate-actions {
                        justify-content:stretch;
                    }
                    .auth-gate-switch-button {
                        flex:1 1 46%;
                    }
                }
            </style>
            <div class="auth-gate-main">
                ${buildAuthGateMainPanelHtml()}
            </div>
            ${buildAuthGateActionsHtml()}
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
    if (passcodeInput) {
        passcodeInput.type = studentLoginState.showPasscode ? 'text' : 'password';
    }

    const passcodeToggle = document.getElementById('student-login-passcode-toggle');
    if (passcodeToggle) {
        passcodeToggle.setAttribute('aria-pressed', studentLoginState.showPasscode ? 'true' : 'false');
        passcodeToggle.innerText = studentLoginState.showPasscode ? 'かくす' : 'みる';
        passcodeToggle.title = studentLoginState.showPasscode ? 'あいことばをかくします' : 'あいことばを表示します';
    }

    const submit = document.getElementById('student-auth-submit');
    if (submit) {
        submit.disabled = !studentLoginState.number || !studentLoginState.passcode;
    }
}

function bindAuthGateEvents() {
    document.querySelectorAll('[data-auth-gate-mode]').forEach(button => {
        button.onclick = () => setAuthGateMode(button.dataset.authGateMode);
    });

    const staffForm = document.getElementById('supabase-auth-form');
    if (staffForm) staffForm.onsubmit = handleAuthFormSubmit;

    const registerForm = document.getElementById('public-register-form');
    if (registerForm) registerForm.onsubmit = handlePublicRegisterFormSubmit;

    const guestButton = document.getElementById('guest-login-button');
    if (guestButton) guestButton.onclick = handleGuestLogin;

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

    const passcodeToggle = document.getElementById('student-login-passcode-toggle');
    if (passcodeToggle) {
        passcodeToggle.onclick = () => {
            studentLoginState.showPasscode = !studentLoginState.showPasscode;
            updateStudentLoginUi();
            passcodeInput?.focus();
        };
    }

    updateStudentLoginUi();
}

function completeAuthGateLogin() {
    hideAuthGate();
    setSyncStatus(guestMode ? 'guest' : 'authenticated');

    const resolve = authGateResolve;
    const afterLogin = authGateAfterLogin;
    authGatePromise = null;
    authGateResolve = null;
    authGateAfterLogin = null;

    if (resolve) resolve(true);
    if (afterLogin) afterLogin();
}

function handleGuestLogin() {
    guestMode = true;
    currentLessonAccess = [];
    pendingStudentLoginNumber = '';
    completeAuthGateLogin();
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
        guestMode = false;
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

    authGateMode = getDefaultAuthGateMode();
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
    focusAuthGateMode();
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
        guestMode = false;
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        completeAuthGateLogin();
    } catch (err) {
        console.error('Auth sign-in failed:', err);
        setAuthGateBusy(false);
        setAuthGateMessage('メールアドレスまたはパスワードを確認してください。', true);
    }
}

async function handlePublicRegisterFormSubmit(event) {
    event.preventDefault();

    if (!supabase) {
        setAuthGateMessage('Supabaseの登録設定が見つかりません。Supabase設定を確認してください。', true);
        return;
    }

    const displayName = document.getElementById('public-register-display-name')?.value.trim();
    const email = document.getElementById('public-register-email')?.value.trim();
    const birthdate = document.getElementById('public-register-birthdate')?.value || '';
    const password = document.getElementById('public-register-password')?.value || '';
    const confirm = document.getElementById('public-register-password-confirm')?.value || '';

    if (!displayName) {
        setAuthGateMessage('ニックネームを入力してください。', true);
        return;
    }
    if (!email || !password) {
        setAuthGateMessage('メールアドレスとパスワードを入力してください。', true);
        return;
    }
    if (!birthdate) {
        setAuthGateMessage('生年月日を入力してください。', true);
        return;
    }
    if (password !== confirm) {
        setAuthGateMessage('確認用パスワードが一致しません。', true);
        return;
    }

    setAuthGateBusy(true, '登録中...');
    try {
        const { data, error } = await supabase.functions.invoke(PUBLIC_STUDENT_REGISTRATION_FUNCTION, {
            body: { displayName, email, birthdate, password }
        });
        if (error || data?.error) {
            throw new Error(data?.error || await getFunctionErrorMessage(error, '登録に失敗しました。'));
        }
        if (data?.needsEmailConfirmation) {
            setAuthGateBusy(false);
            setAuthGateMessage('確認メールを送信しました。メール内のURLを開いてから、通常ログインしてください。', false);
            const passwordInput = document.getElementById('public-register-password');
            const confirmInput = document.getElementById('public-register-password-confirm');
            if (passwordInput) passwordInput.value = '';
            if (confirmInput) confirmInput.value = '';
            return;
        }

        guestMode = false;
        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
        if (signInError) throw signInError;
        completeAuthGateLogin();
    } catch (err) {
        console.error('Public registration failed:', err);
        setAuthGateBusy(false);
        setAuthGateMessage(err?.message || '登録に失敗しました。時間をおいてもう一度試してください。', true);
    }
}

async function ensureSupabaseSession() {
    if (!REQUIRE_SUPABASE_AUTH) return true;
    if (guestMode) return true;
    let gateMessage = '先生または管理者のアカウントでログインしてください。';
    let gateMessageIsError = false;

    if (!supabase) {
        setSyncStatus('auth missing');
        if (authGatePromise) return authGatePromise;
        authGatePromise = new Promise(resolve => {
            authGateResolve = resolve;
            showAuthGate('Supabaseのログイン設定が見つかりません。ログイン・登録は使えませんが、ゲストプレイは利用できます。', true);
        });
        return authGatePromise;
    }

    try {
        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;
        if (data?.session) {
            guestMode = false;
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
        const canDeleteScopedRows = hasLessonRole('teacher') && ids.every(userId => canManageScopedUserRow(userId));
        if (!canDeleteScopedRows) {
            throw new Error('Admin or scoped teacher role is required to delete cloud user rows');
        }
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

export async function deleteCloudStudentAccount(userDataId) {
    if (!userDataId || !supabase || !canUseRlsCloudSync() || !hasLessonRole('admin')) return false;
    const { data, error } = await supabase.functions.invoke('admin-delete-auth-user', {
        body: { userDataId }
    });
    if (error || data?.error) {
        throw new Error(data?.error || error?.message || 'Failed to delete linked Auth user');
    }
    return Boolean(data?.ok);
}

export async function saveManagedUserRows(userIds) {
    const ids = Array.from(new Set((Array.isArray(userIds) ? userIds : [userIds]).filter(Boolean)));
    if (ids.length === 0) return true;
    if (!canUseRlsCloudSync()) return saveUsers(true);
    if (!navigator.onLine) {
        setSyncStatus('offline');
        return false;
    }

    normalizeUsersCollection();
    const upsertData = ids.map(userId => {
        if (!canManageScopedUserRow(userId) || !shouldPersistUserRow(userId, users[userId])) return null;
        return { id: userId, data: users[userId] };
    }).filter(Boolean);

    if (upsertData.length !== ids.length) {
        throw new Error('Scoped role is not allowed to save one or more user rows.');
    }

    setSyncStatus('syncing');
    try {
        const { error } = await supabase.from(TARGET_TABLE).upsert(upsertData);
        if (error) throw error;
        setSyncStatus('rls synced');
        return true;
    } catch (error) {
        console.error('Managed row save failed:', error);
        setSyncStatus('sync error');
        return false;
    }
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
    if (guestMode) clearGuestUsers();
    guestMode = false;
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

    if (guestMode) {
        loadGuestUsers();
        normalizeUsersCollection();
        applyCustomGlobalSettingsIfReady();
        setSyncStatus('guest');
        const loadingMsg = titleScreen.querySelector('.loading-msg');
        if (loadingMsg) loadingMsg.remove();
        updateVisibleUserUi();
        login(GUEST_USER_ID);
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
            if (useRlsCloudSync) pruneUsersToSingleStudentAccessIfNeeded();
            localStorage.setItem(STORAGE_KEY, JSON.stringify(users)); 
        } else {
            if (useRlsCloudSync) {
                users = {};
                await loadCloudSettingsIfEnabled();
                pruneUsersToSingleStudentAccessIfNeeded();
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
    if (useRlsCloudSync) pruneUsersToSingleStudentAccessIfNeeded();
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

    if (guestMode) {
        saveGuestUsers();
        setSyncStatus('guest');
        return true;
    }

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

function isThemeUnlockedForUser(user, theme) {
    if (!user || !theme) return false;
    const checkId = theme.isCustom ? theme.id : `theme_${theme.id}`;
    return theme.id === 'default'
        || user.isMaster
        || (Array.isArray(user.items) && (user.items.includes(checkId) || user.items.includes(theme.id)));
}

function isEffectUnlockedForUser(user, effect) {
    if (!user || !effect) return false;
    return effect.id === 'default'
        || user.isMaster
        || (Array.isArray(user.items) && user.items.includes(effect.id));
}

function pickRandomEntry(values) {
    if (!values.length) return null;
    return values[Math.floor(Math.random() * values.length)];
}

function applyRandomStyleFavorites(userId) {
    const user = users[userId];
    if (!user || user.isMaster) return false;
    let changed = false;

    if (user.randomThemeEnabled) {
        const candidates = (Array.isArray(user.themeFavorites) ? user.themeFavorites : [])
            .map(id => THEMES.find(theme => theme.id === id))
            .filter(theme => isThemeUnlockedForUser(user, theme));
        const selected = pickRandomEntry(candidates);
        if (selected) {
            if (user.theme !== selected.id) changed = true;
            user.theme = selected.id;
        } else {
            user.randomThemeEnabled = false;
            changed = true;
        }
    }

    if (user.randomEffectEnabled) {
        const candidates = (Array.isArray(user.effectFavorites) ? user.effectFavorites : [])
            .map(id => EFFECTS.find(effect => effect.id === id))
            .filter(effect => isEffectUnlockedForUser(user, effect));
        const selected = pickRandomEntry(candidates);
        if (selected) {
            if (user.activeEffect !== selected.id) changed = true;
            user.activeEffect = selected.id;
        } else {
            user.randomEffectEnabled = false;
            changed = true;
        }
    }

    if (typeof window !== 'undefined') {
        window.__D_LESSON_ACTIVE_EFFECT__ = user.activeEffect || 'default';
    }
    return changed;
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
    if(!Array.isArray(users[userId].themeFavorites)) users[userId].themeFavorites = [];
    if(!Array.isArray(users[userId].effectFavorites)) users[userId].effectFavorites = [];
    if(users[userId].randomThemeEnabled === undefined) users[userId].randomThemeEnabled = false;
    if(users[userId].randomEffectEnabled === undefined) users[userId].randomEffectEnabled = false;
    const randomStyleChanged = applyRandomStyleFavorites(userId);
    
    applyTheme(users[userId].theme);
    window.__D_LESSON_ACTIVE_EFFECT__ = users[userId].activeEffect || 'default';
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
        if (randomStyleChanged && canWriteUserRow(userId)) saveUsers(false);
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
