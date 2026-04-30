import { createClient } from '@supabase/supabase-js';
import { SoundManager } from '../utils/sound.js';
import { calculateGrade, sortGrades } from '../utils/helpers.js';
import { showScreen } from '../ui/screen.js';
import { applyTheme, updateGlobalHeader, updateHomeDashboard } from '../ui/home.js';
import { createConfetti } from '../ui/effects.js';
// ==========================================
// Database (Supabase) connection
// ==========================================
// Values come from Vite env vars. Do not hard-code project keys here.
const env = import.meta.env || {};
const supabaseUrl = env.VITE_SUPABASE_URL || '';
const supabaseKey = env.VITE_SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_ANON_KEY || '';

export const HAS_SUPABASE_CONFIG = Boolean(supabaseUrl && supabaseKey);
export const ENABLE_LEGACY_SUPABASE_SYNC = env.VITE_ENABLE_LEGACY_SUPABASE_SYNC === 'true';
export const REQUIRE_SUPABASE_AUTH = env.VITE_REQUIRE_SUPABASE_AUTH === 'true';
export const supabase = HAS_SUPABASE_CONFIG ? createClient(supabaseUrl, supabaseKey) : null;

// ==========================================
// Environment settings
// ==========================================
export const IS_DEV_MODE = env.VITE_SUPABASE_USE_TEST_TABLE === 'true';
const TARGET_TABLE = env.VITE_SUPABASE_TABLE || (IS_DEV_MODE ? 'test_user_data' : 'user_data');

export const STORAGE_KEY = 'pc_practice_v5_split';

export let users = {};
export let currentUser = null;
export let currentSelectedGrade = null;
let authGatePromise = null;
let authGateResolve = null;
let authGateAfterLogin = null;

function canUseLegacyCloudSync() {
    return Boolean(supabase && ENABLE_LEGACY_SUPABASE_SYNC);
}

function getLocalOnlySyncStatus() {
    if (REQUIRE_SUPABASE_AUTH && HAS_SUPABASE_CONFIG) return 'auth only';
    return HAS_SUPABASE_CONFIG ? 'cloud locked' : 'local only';
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

function clearRosterDom() {
    ['grade-list', 'user-list'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.innerHTML = '';
    });
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

export async function signOutSupabaseAuth() {
    if (!REQUIRE_SUPABASE_AUTH) return false;

    authGatePromise = null;
    authGateResolve = null;
    authGateAfterLogin = null;
    users = {};
    clearRosterDom();

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

    loadLocalUsers();

    if (!canUseLegacyCloudSync()) {
        if (!users || typeof users !== 'object') users = {};
        if (typeof loadCustomGlobalSettings === 'function') loadCustomGlobalSettings();
        setSyncStatus(getLocalOnlySyncStatus());
        const loadingMsg = titleScreen.querySelector('.loading-msg');
        if (loadingMsg) loadingMsg.remove();
        return;
    }

    let cloudLoadFailed = false;

    try {
        // Legacy roster sync reads the full table. Keep it disabled on public URLs.
        const { data, error } = await supabase.from(TARGET_TABLE).select('*');
        if (error) throw error;

        if(data && data.length > 0) {
            let newUsers = {};
            data.forEach(row => { newUsers[row.id] = row.data; });
            
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
            users = newUsers;
            localStorage.setItem(STORAGE_KEY, JSON.stringify(users)); 
        } else {
            // If the cloud table is empty, keep local data.
            const localDataStr = localStorage.getItem(STORAGE_KEY);
            if (localDataStr) { try { users = JSON.parse(localDataStr); } catch(err) { users = {}; } }
        }
    } catch(e) {
        console.error("通信エラー", e);
        loadLocalUsers();
        cloudLoadFailed = true;
        setSyncStatus('sync error');
    }
    
    if (!users || typeof users !== 'object') users = {};
    if (typeof loadCustomGlobalSettings === 'function') loadCustomGlobalSettings();
    if (canUseLegacyCloudSync() && !cloudLoadFailed) setSyncStatus('synced');

    const loadingMsg = titleScreen.querySelector('.loading-msg');
    if (loadingMsg) loadingMsg.remove();
}

export async function saveUsers(forceOverwrite = false) {
    if (!users || typeof users !== 'object') users = {};
    localStorage.setItem(STORAGE_KEY, JSON.stringify(users));
    updateGlobalHeader(); 

    if (!canUseLegacyCloudSync()) {
        setSyncStatus(getLocalOnlySyncStatus());
        return;
    }
    
    if (!navigator.onLine) { setSyncStatus('offline'); return; }
    setSyncStatus('syncing');

    try {
        // Build the legacy upsert payload.
        let upsertData =[];
        if (forceOverwrite) {
            for (let name in users) { upsertData.push({ id: name, data: users[name] }); }
        } else {
            if (currentUser && users[currentUser]) upsertData.push({ id: currentUser, data: users[currentUser] });
            if (users['__GLOBAL_SETTINGS__']) upsertData.push({ id: '__GLOBAL_SETTINGS__', data: users['__GLOBAL_SETTINGS__'] });
        }

        if (upsertData.length > 0) {
            // Upsert to Supabase.
            const { error } = await supabase.from(TARGET_TABLE).upsert(upsertData);
            if (error) throw error;
        }
        setSyncStatus('synced'); 
    } catch (e) { 
        console.error("保存エラー:", e); 
        setSyncStatus('sync error'); 
    }
}

export function goToGradeSelect() { renderGradeList(); showScreen('screen-grade'); }

export function renderGradeList() {
    const gradeList = document.getElementById('grade-list'); gradeList.innerHTML = '';
    const existingGrades = new Set();
    Object.keys(users).forEach(n => { if(!users[n].isMaster && n !== '__GLOBAL_SETTINGS__') existingGrades.add(calculateGrade(users[n].birthdate || users[n].birth)); });
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
    Object.keys(users).forEach(n => {
        if(!users[n].isMaster && n !== '__GLOBAL_SETTINGS__' && calculateGrade(users[n].birthdate) === grade) {
            const btn = document.createElement('div'); btn.className = 'user-card'; btn.innerText = n;
            btn.onclick = () => login(n); userList.appendChild(btn);
        }
    });
}

export function login(n) {
    currentUser = n;
    if(!users[n]) users[n] = {};
    if(users[n].wordProgress === undefined) users[n].wordProgress = {};
    if(users[n].mouseLevel===undefined) users[n].mouseLevel=0;
    if(users[n].keyboardSequence===undefined) users[n].keyboardSequence=0;
    if(users[n].examRecords===undefined) users[n].examRecords={};
    if(users[n].textRecords===undefined) users[n].textRecords={}; 
    if(users[n].globalMistakes===undefined) users[n].globalMistakes={};
    if(users[n].theme===undefined) users[n].theme='default';
    if(users[n].birthdate===undefined) users[n].birthdate='';
    if(users[n].loginStamps===undefined) users[n].loginStamps=[];
    if(users[n].minigameHighscore===undefined) users[n].minigameHighscore=0;
    if(users[n].dChallengeHighscore===undefined) users[n].dChallengeHighscore=0;
    if(users[n].coins === undefined) users[n].coins = 0;           
    if(users[n].items === undefined) users[n].items =[];          
    if(users[n].tickets === undefined) users[n].tickets =[];      
    if(users[n].activeEffect === undefined) users[n].activeEffect = 'default'; 
    
    applyTheme(users[n].theme);
    document.getElementById('welcome-msg').innerText = `ようこそ、${n} さん`;

    updateGlobalHeader(); 
    updateHomeDashboard(); 

    const today = new Date().toISOString().split('T')[0];
    if (!users[n].loginStamps.includes(today) && !users[n].isMaster) {
        users[n].loginStamps.push(today);
        users[n].coins += 100; 
        saveUsers(false);
        showStampOverlay();
    } else {
        showScreen('screen-category');
    }
}

export function showStampOverlay() {
    SoundManager.init(); SoundManager.playClear(); createConfetti();
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
