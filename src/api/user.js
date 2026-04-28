import { createClient } from '@supabase/supabase-js'; // ★追加: Supabaseのツール
import { SoundManager } from '../utils/sound.js';
import { calculateGrade, sortGrades, applyTheme, updateGlobalHeader, updateHomeDashboard, showScreen, createConfetti } from '../main.js';

// ==========================================
// データベース (Supabase) 接続設定
// ==========================================
// ⚠️ 以下2行に、控えておいたURLとAPIキー(anon)を貼り付けてください
const supabaseUrl = 'https://lmonjfdxtefsvgtdixid.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxtb25qZmR4dGVmc3ZndGRpeGlkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzczNzM1MzEsImV4cCI6MjA5Mjk0OTUzMX0.dFfZDnSjHc7aNTL_EGBhiT9l6zt1ai32H04MJEGAhXg';
export const supabase = createClient(supabaseUrl, supabaseKey);

// ==========================================
// 環境設定・変数
// ==========================================
export const IS_DEV_MODE = true; // テスト環境ならtrue, 本番環境(児童PCやVercel)ならfalse
const TARGET_TABLE = IS_DEV_MODE ? 'test_user_data' : 'user_data'; // 自動でテーブルを振り分け

export const STORAGE_KEY = 'pc_practice_v5_split';

export let users = {};
export let currentUser = null;
export let currentSelectedGrade = null;

// ==========================================
// データ読み込み・保存関数 (Supabase版)
// ==========================================
export async function loadUsers() {
    const titleScreen = document.getElementById('screen-title');
    if (!titleScreen.querySelector('.loading-msg')) {
        titleScreen.querySelector('.screen-content').insertAdjacentHTML('beforeend', '<div class="loading-msg" style="color:#555; font-size:20px; margin-top:20px;">データベースとつうしん中... 🔄</div>');
    }

    try {
        // GASではなく、Supabaseのテーブルからデータを取得
        const { data, error } = await supabase.from(TARGET_TABLE).select('*');
        if (error) throw error;

        if(data && data.length > 0) {
            let newUsers = {};
            data.forEach(row => { newUsers[row.id] = row.data; });
            
            // ローカルに残っているデータとの合流処理
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
            // クラウドが空っぽならローカルから復旧
            const localDataStr = localStorage.getItem(STORAGE_KEY);
            if (localDataStr) { try { users = JSON.parse(localDataStr); } catch(err) { users = {}; } }
        }
    } catch(e) {
        console.error("通信エラー", e);
        const d = localStorage.getItem(STORAGE_KEY);
        if (d) { try { let parsed = JSON.parse(d); if (parsed) users = parsed; } catch(err) {} }
    }
    
    if (!users || typeof users !== 'object') users = {};
    if (typeof loadCustomGlobalSettings === 'function') loadCustomGlobalSettings();

    const loadingMsg = titleScreen.querySelector('.loading-msg');
    if (loadingMsg) loadingMsg.remove();
}

export async function saveUsers(forceOverwrite = false) {
    if (!users || typeof users !== 'object') users = {};
    localStorage.setItem(STORAGE_KEY, JSON.stringify(users));
    updateGlobalHeader(); 
    
    if (!navigator.onLine) { document.getElementById('sync-status').innerText = '☁️❌'; return; }
    document.getElementById('sync-status').innerText = '☁️🔄'; 

    try {
        // Supabase用の送信データを作成
        let upsertData =[];
        if (forceOverwrite) {
            for (let name in users) { upsertData.push({ id: name, data: users[name] }); }
        } else {
            if (currentUser && users[currentUser]) upsertData.push({ id: currentUser, data: users[currentUser] });
            if (users['__GLOBAL_SETTINGS__']) upsertData.push({ id: '__GLOBAL_SETTINGS__', data: users['__GLOBAL_SETTINGS__'] });
        }

        if (upsertData.length > 0) {
            // データベースに書き込み (存在すれば上書き、なければ新規作成)
            const { error } = await supabase.from(TARGET_TABLE).upsert(upsertData);
            if (error) throw error;

            if (!forceOverwrite) {
                // 最新データを他PCから取得してマージ
                const { data: latestData } = await supabase.from(TARGET_TABLE).select('id, data');
                if (latestData) {
                    latestData.forEach(row => {
                        if (row.id !== currentUser && row.id !== '__GLOBAL_SETTINGS__') {
                            users[row.id] = row.data;
                        }
                    });
                    localStorage.setItem(STORAGE_KEY, JSON.stringify(users));
                }
            }
        }
        document.getElementById('sync-status').innerText = '☁️✅'; 
    } catch (e) { 
        console.error("保存エラー:", e); 
        document.getElementById('sync-status').innerText = '☁️❌'; 
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

// データ保存中に画面を閉じようとした時の警告（安全装置）
window.addEventListener('beforeunload', (e) => {
    const syncStatus = document.getElementById('sync-status');
    if (syncStatus && syncStatus.innerText === '☁️🔄') {
        e.preventDefault();
        e.returnValue = 'データの保存中です。このまま閉じるとデータが失われる可能性があります。';
    }
});