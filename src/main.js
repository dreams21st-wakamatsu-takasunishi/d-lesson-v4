import './style.css';

import {
  KEYBOARD_STAGES,
  BLIND_STAGES,
  BRIDGE_STAGES,
  HIRAGANA_DATA,
  WORD_DATA,
  EXAMS,
  STAGE_ORDER,
  KB_CHAPTERS,
  THEMES,
  EFFECTS
} from './data/constants.js';
import { GACHA_ITEMS } from './data/gacha-items.js';

import { toggleSFX, toggleBGM, initAudio } from './utils/sound.js';
import {
  users,
  currentUser,
  loadUsers,
  goToGradeSelect,
  login,
  closeStampOverlay,
  hasLessonRole,
  GLOBAL_SETTINGS_ID,
  MASTER_DEBUG_ID
} from './api/user.js';

import * as Admin from './ui/admin.js';

import { showCustomAlert, showCustomConfirm } from './ui/modal.js';
import { createBtn } from './utils/dom.js';
import { getRewardText } from './utils/rewards.js';
import { getStageName } from './utils/stages.js';
import { closeRewardOverlay } from './ui/reward.js';
import {
    showRecordSection,
    backToRecordMenu,
    renderRecords
} from './ui/records.js';
import { renderLastPracticeCard } from './ui/practice-history.js';
import { setCurrentKeyboardChapter } from './ui/keyboard-state.js';

import {
    showScreen,
    toggleFullScreen,
    handleGlobalBack,
    handleGlobalHome,
    handleGlobalLogout
} from './ui/screen.js';

import {
    toggleRuby,
    toggleNavi,
    getCurrentTextTask,
    goToTextMenu,
    toggleRubyInPrep,
    toggleNaviInPrep,
    closeTextPrepModal,
    confirmStartTextPractice,
    submitTextPractice,
    closeTextResult,
    backToMenuFromText
} from './games/text.js';

import {
    goToWordMenu,
    openWordText,
    suspendWordTask,
    confirmWordClear,
    processWordClear
} from './games/word.js';

import {
    drawGacha,
    useTicket,
    changeTheme,
    changeEffect,
    setGachaUiHandlers
} from './games/gacha.js';

import {
    startVisionGame,
    showVisionCompare,
    renderVisionMenu
} from './games/vision.js';

import {
    startMinigame,
    stopMinigame
} from './games/minigame.js';

import {
  startGame,
  backToMenu,
  retryExam,
  handleSecretMenuClick,
  setMenuRefreshHandlers,
  startRecommendedStage
} from './games/core.js';

const BUILD_COMMIT = import.meta.env.VITE_BUILD_COMMIT || 'local';
if (typeof window !== 'undefined') {
  window.__D_LESSON_BUILD__ = { commit: BUILD_COMMIT };
}

/* =========================================================
   [JS] 1. 効果音管理 (Sound) ＆ システム制御 ＆ 音声読み上げ
   ========================================================= */

window.addEventListener('DOMContentLoaded', () => {

    void loadUsers().then(() => updateGlobalHeader());

    document.addEventListener("click", () => {
        initAudio();
    }, { once:true });

});

function speakText(text) {
    if ('speechSynthesis' in window) {
        speechSynthesis.cancel();
        const msg = new SpeechSynthesisUtterance(text);
        msg.lang = 'ja-JP'; msg.rate = 1.0;
        speechSynthesis.speak(msg);
    }
}
function speakInstruction() {
    let txt = document.getElementById('inst-text').innerText;
    let mq = document.getElementById('main-q');
    if(mq && mq.innerText && !mq.innerText.includes('👀')) txt += "。 " + mq.innerText;
    speakText(txt);
}
function speakTextTask() {
    const currentTextTask = getCurrentTextTask();
    if(currentTextTask && currentTextTask.content) {
        let plain = currentTextTask.content.replace(/\{([^|]+)\|([^}]+)\}/g, '$1');
        speakText(plain);
    }
}


/* =========================================================
   [JS] 8. 共通ゲーム進行 ＆ キーボード・マウスのコアロジック
   ========================================================= */
/* =========================================================
   [JS] 9. UI・画面遷移 ＆ ガチャ・きせかえ管理
   ========================================================= */
let currentKeyboardCategory = 'basic';

function getActiveUserOrTitle() {
    const u = currentUser ? users[currentUser] : null;
    if (u) return u;
    showCustomAlert('ユーザーを選択してください');
    showScreen('screen-title');
    return null;
}

function goToMouseMenu() { updateMouseButtons(); showScreen('screen-mouse-menu'); }
function goToKeyboardCategory() { showScreen('screen-keyboard-category'); }

function goToKeyboardMenu(type) { 
    if (type) currentKeyboardCategory = type; 
    document.getElementById('kb-chapter-container').style.display = 'flex';
    document.getElementById('kb-stage-container').style.display = 'none';
    document.getElementById('kb-bottom-back-btn').style.display = 'block';
    
    let title = "キーボードのれんしゅう";
    if(type === 'basic') title = "きほんれんしゅう";
    if(type === 'blind') title = "タッチタイピング";
    if(type === 'hiragana') title = "ひらがなれんしゅう";
    if(type === 'word') title = "ことばのれんしゅう";
    document.getElementById('kb-menu-title').innerText = title;
    
    setCurrentKeyboardChapter(null);
    renderKeyboardChapters(); 
    showScreen('screen-keyboard-menu'); 
}

function goToMinigameMenu() {
    showScreen('screen-minigame-menu');
}

function goToRecords() { renderRecords(); showScreen('screen-records'); }
function goToVisionMenu() { renderVisionMenu(); showScreen('screen-vision-menu'); }

function enterMasterMode() {
    if (!users[MASTER_DEBUG_ID]) {
        users[MASTER_DEBUG_ID] = { mouseLevel:7, keyboardSequence:999, examRecords:{}, textRecords:{}, globalMistakes:{}, theme:'default', birthdate:'', isMaster:true };
    }
    document.getElementById('screen-title').classList.remove('active');
    login(MASTER_DEBUG_ID);
}

function loginAsMaster() {
    if (hasLessonRole('teacher', 'admin')) {
        enterMasterMode();
        return;
    }

    showCustomAlert('先生または管理者アカウントでログインしてください。');
}

function updateTitleRoleActions() {
    const teacherPreviewBtn = document.getElementById('title-teacher-preview-btn');
    const adminBtn = document.getElementById('title-admin-btn');
    const canUseTeacherPreview = hasLessonRole('teacher', 'admin');
    const canUseAdmin = hasLessonRole('admin');

    if (teacherPreviewBtn) teacherPreviewBtn.style.display = canUseTeacherPreview ? 'inline-flex' : 'none';
    if (adminBtn) adminBtn.style.display = canUseAdmin ? 'inline-flex' : 'none';
}

function goToWeakTraining() {
    const u = getActiveUserOrTitle();
    if (!u) return;
    const mistakes = u.globalMistakes || {};
    const hasMistakes = Object.values(mistakes).some(count => count > 0);
    if (hasMistakes) {
        startGame(9888, 'keyboard');
    } else {
        showCustomAlert('ミスのデータがないか、すべて克服しました！\nいろいろな練習をしてからまた挑戦してみてね！'); // ★修正
    }
}

export function updateMouseButtons() {
    const u = getActiveUserOrTitle();
    if (!u) return;
    const l = u.mouseLevel || 0; document.getElementById('master-badge').style.display = (l >= 7) ? 'block' : 'none';
    for(let i=1; i<=7; i++) {
        const b = document.getElementById(`btn-m${i}`); if(!b) continue;
        b.classList.remove('unlocked','cleared','next-target'); b.style.opacity='1'; b.onclick=null; b.onkeydown=null; b.tabIndex=-1;
        if(i===1 || l >= i-1) { 
            b.classList.add('unlocked'); createBtn(b, () => startGame(i, 'mouse')); 
            if (l === i-1) b.classList.add('next-target'); 
            if (users[currentUser] && !users[currentUser].isMaster) {
                let badge = b.querySelector('.reward-badge');
                if(!badge){ badge = document.createElement('span'); badge.className = 'reward-badge'; b.appendChild(badge); }
                badge.innerText = getRewardText('mouse', i);
            }
        } else { 
            b.style.opacity='0.5'; 
            let badge = b.querySelector('.reward-badge'); if(badge) badge.remove();
        }
        if(l >= i) b.classList.add('cleared');
    }
}

export function updateKeyboardButtons() {
    renderKeyboardChapters();
}

function renderKeyboardChapters() {
    const u = getActiveUserOrTitle();
    if (!u) return;
    const seq = u.keyboardSequence || 0;
    const cont = document.getElementById('kb-chapter-container'); 
    cont.innerHTML='';
    
    let displayChapters =[]; 
    let showMasterExam = null;

    if (currentKeyboardCategory === 'basic') { displayChapters = KB_CHAPTERS.filter(c =>['home', 'top', 'bottom', 'number'].includes(c.id)); showMasterExam = 1999; } 
    else if (currentKeyboardCategory === 'blind') { displayChapters = KB_CHAPTERS.filter(c => c.id === 'blind'); showMasterExam = 2999; } 
    else if (currentKeyboardCategory === 'hiragana') { 
        displayChapters = KB_CHAPTERS.filter(c => c.id.startsWith('h_')); showMasterExam = 3999; 
    } 
    else if (currentKeyboardCategory === 'word') { displayChapters = KB_CHAPTERS.filter(c => c.id.startsWith('word')); showMasterExam = 4999; }

    const isUnlocked = (id) => { const x=STAGE_ORDER.indexOf(id); return x===0 || (x!==-1 && seq>=x); };
    const isCleared = (id) => { const x=STAGE_ORDER.indexOf(id); return x!==-1 && seq>x; };

    if (currentKeyboardCategory === 'hiragana') {
        const btn = document.createElement('button');
        btn.className = 'category-btn';
        btn.style.backgroundColor = '#00bcd4';
        btn.style.width = '280px'; btn.style.height = '120px';
        btn.innerHTML = `<span style="font-size:40px;">📋</span><span style="font-size:18px; font-weight:bold; margin-top:5px;">ローマ字いちらん表</span>`;
        btn.onclick = () => showRomajiMenu();
        cont.appendChild(btn);
    }

    displayChapters.forEach(chap => {
        let chapUnlocked = isUnlocked(chap.stages[0]);
        let chapCleared = true;
        chap.stages.forEach(sid => { if(!isCleared(sid)) chapCleared = false; });
        if(chap.exam && !isCleared(chap.exam)) chapCleared = false;

        const btn = document.createElement('button');
        btn.className = 'category-btn';
        if(!chapUnlocked) {
            btn.style.opacity = '0.5'; btn.style.cursor = 'not-allowed'; btn.style.backgroundColor = '#9e9e9e';
        } else {
            btn.style.backgroundColor = chapCleared ? '#4CAF50' : '#FF9800';
            btn.onclick = () => renderKeyboardStages(chap);
        }
        btn.style.width = '280px'; btn.style.height = '120px';
        
        let icon = '⌨️';
        if(currentKeyboardCategory === 'basic') icon = '🅰️';
        if(currentKeyboardCategory === 'blind') icon = '🙈';
        if(currentKeyboardCategory === 'hiragana') icon = 'あ';
        if(currentKeyboardCategory === 'word') icon = '🍎';
        
        btn.innerHTML = `<span style="font-size:40px;">${icon}</span><span style="font-size:16px; font-weight:bold; margin-top:5px; line-height:1.3; width:100%; word-wrap:break-word;">${chap.title}</span>`;
        if(chapCleared) btn.innerHTML += `<span style="font-size:14px; margin-top:5px; color:#fff;">✅ クリア済</span>`;
        
        cont.appendChild(btn);
    });

    if (showMasterExam) {
        const mid = showMasterExam; const ed = EXAMS.find(x => x.id === mid); 
        const btn = document.createElement('button');
        btn.className = 'category-btn'; 
        btn.style.width = '280px'; btn.style.height = 'auto'; btn.style.minHeight = '140px'; btn.style.padding = '10px';
        
        if (!isUnlocked(mid)) {
            btn.style.opacity = '0.5'; btn.style.cursor = 'not-allowed'; btn.style.backgroundColor = '#9e9e9e';
        } else {
            btn.style.background = 'linear-gradient(45deg, #FFC107, #FF9800)';
            btn.onclick = () => startGame(mid, 'keyboard');
        }
        
        if (isCleared(mid)) { btn.innerHTML = `<span style="font-size:40px;">👑</span><span style="font-size:16px; font-weight:bold; margin-top:5px; line-height:1.3; width:100%; word-wrap:break-word;">★${ed.title} 合格★</span><span style="font-size:12px; margin-top:5px; color:#fff;">(🎟️ クリアでチケット)</span>`; } 
        else { btn.innerHTML = `<span style="font-size:40px;">👑</span><span style="font-size:16px; font-weight:bold; margin-top:5px; line-height:1.3; width:100%; word-wrap:break-word;">★${ed.title}★</span><span style="font-size:12px; margin-top:5px; color:#fff;">(🎟️ クリアでチケット)</span>`; }
        cont.appendChild(btn);
    }
}

function showRomajiMenu() {
    document.getElementById('kb-chapter-container').style.display = 'none';
    document.getElementById('kb-stage-container').style.display = 'flex';
    document.getElementById('kb-bottom-back-btn').style.display = 'none';
    document.getElementById('kb-stage-title').innerText = "ローマ字いちらん表";
    
    const grid = document.getElementById('kb-stage-grid'); grid.innerHTML = '';
    document.getElementById('kb-stage-exams').innerHTML = ''; 

    const stages =[
        {id:'romaji_basic_prac', title:'あ〜ん', sub:'(れんしゅう)', icon:'📖', color:'#00bcd4'},
        {id:'romaji_basic_exam', title:'あ〜ん', sub:'(テスト)', icon:'🔥', color:'#e91e63'},
        {id:'romaji_daku_prac', title:'だくてん', sub:'(れんしゅう)', icon:'📖', color:'#00bcd4'},
        {id:'romaji_daku_exam', title:'だくてん', sub:'(テスト)', icon:'🔥', color:'#e91e63'}
    ];

    stages.forEach(st => {
        const b = document.createElement('div'); b.className = 'stage-btn unlocked cleared'; b.style.borderColor = st.color; b.style.backgroundColor = st.color === '#00bcd4' ? '#e0f7fa' : '#fce4ec'; b.style.cursor = 'pointer'; b.tabIndex = 0;
        b.innerHTML = `<span style="font-size:30px;">${st.icon}</span><span style="font-size:16px; font-weight:bold; color:#333; margin-top:5px;">${st.title}</span><span style="font-size:12px;">${st.sub}</span>`;
        createBtn(b, () => startGame(st.id, 'romaji')); grid.appendChild(b);
    });
}

export function renderKeyboardStages(chap) {
    setCurrentKeyboardChapter(chap);

    document.getElementById('kb-chapter-container').style.display = 'none';
    document.getElementById('kb-stage-container').style.display = 'flex';
    document.getElementById('kb-bottom-back-btn').style.display = 'none';
    document.getElementById('kb-stage-title').innerText = chap.title;
    
    const u = getActiveUserOrTitle();
    if (!u) return;
    const seq = u.keyboardSequence || 0;
    const isUnlocked = (id) => { const x=STAGE_ORDER.indexOf(id); return x===0 || (x!==-1 && seq>=x); };
    const isCleared = (id) => { const x=STAGE_ORDER.indexOf(id); return x!==-1 && seq>x; };
    const targetId = STAGE_ORDER[seq];

    const grid = document.getElementById('kb-stage-grid'); grid.innerHTML = '';
    const examsCont = document.getElementById('kb-stage-exams'); examsCont.innerHTML = '';

    chap.stages.forEach((sid, index) => {
        let title = `ステップ ${index + 1}`, keys='', sub='', exCls=''; const act = () => startGame(sid, 'keyboard');
        if (sid >= 4000 && sid < 5000) { const st = WORD_DATA.find(s=>s.id===sid); if (st) { keys = st.chars.slice(0,1).map(c=>c.h).join(''); sub = st.title; exCls = 'word-practice'; } } 
        else if (sid >= 3000 && sid < 4000) { let base = sid; if(sid>=3100) base-=100; if(sid>=3200) base-=100; const st = HIRAGANA_DATA.find(s=>s.id===base); if (st) { keys = st.chars.slice(0,3).map(c=>c.h).join(''); if(sid >= 3200) { sub='(ブラインド試)'; exCls='blind-exam'; } else if(sid >= 3100) { sub='(ブラインド練)'; exCls='blind-practice'; } else sub = st.title.split('(')[0]; } } 
        else if (sid >= 2000 && sid < 3000) { const st = BLIND_STAGES.find(s=>s.id===sid); if(st) { keys = st.title.split('(')[0]; sub = st.type==='exam'?'(試)':'(練)'; exCls = st.type==='exam'?'blind-exam':'blind-practice'; } } 
        else { const st = KEYBOARD_STAGES.find(s=>s.id===sid); if(st) { keys = st.keys.filter(k=>k!=='SPACE').join(''); sub = st.title; } }
        
        const b = document.createElement('div'); b.className=`stage-btn ${exCls}`; b.tabIndex=-1;
        if (isUnlocked(sid)) { 
            b.classList.add('unlocked'); createBtn(b, act); if (sid === targetId) b.classList.add('next-target'); 
            b.innerHTML=`<span class="stage-title">${title}</span><span class="kb-keys" style="font-size:18px">${keys}</span><span class="stage-name" style="font-size:12px">${sub}</span><span class="reward-badge">${getRewardText('keyboard', sid)}</span>`; 
        } else {
            b.style.opacity='0.5';
            b.innerHTML=`<span class="stage-title">${title}</span><span class="kb-keys" style="font-size:18px">${keys}</span><span class="stage-name" style="font-size:12px">${sub}</span>`; 
        }
        if (isCleared(sid)) b.classList.add('cleared');
        grid.appendChild(b);
    });

    if (chap.bridge) {
        const bid = chap.bridge; const bd = BRIDGE_STAGES.find(x=>x.id===bid); const b = document.createElement('div'); b.className='exam-btn practice-bridge-btn'; b.tabIndex=-1; b.style.width = '300px';
        if (isUnlocked(bid)) { b.classList.add('unlocked'); createBtn(b, () => startGame(bid, 'keyboard')); if (bid === targetId) b.classList.add('next-target'); } else b.style.opacity='0.5';
        if (isCleared(bid)) { b.classList.add('cleared'); b.innerText='総復習クリア'; } else b.innerText = bd.title + '(ミスOK)'; examsCont.appendChild(b);
    }
    if (chap.exam) {
        const eid = chap.exam; const ed = EXAMS.find(x=>x.id===eid); const b = document.createElement('div'); b.className='exam-btn'; b.tabIndex=-1; b.style.width = '300px';
        if (isUnlocked(eid)) { b.classList.add('unlocked'); createBtn(b, () => startGame(eid, 'keyboard')); if (eid === targetId) b.classList.add('next-target'); } else b.style.opacity='0.5';
        if (isCleared(eid)) { b.classList.add('cleared'); b.innerText = ed.title+'合格'; } else b.innerText = ed.title; examsCont.appendChild(b);
    }
}

function backToKbChapter() {
    document.getElementById('kb-chapter-container').style.display = 'flex';
    document.getElementById('kb-stage-container').style.display = 'none';
    document.getElementById('kb-bottom-back-btn').style.display = 'block';
}

setMenuRefreshHandlers({
    updateMouseButtons,
    updateKeyboardButtons,
    renderKeyboardStages
});

function getFocusableElements() {
    const activeScreen = document.querySelector('.screen.active'); if (!activeScreen) return[];
    const elements = Array.from(activeScreen.querySelectorAll('[tabindex="0"], button:not([tabindex="-1"])'));
    return elements.filter(el => { const style = window.getComputedStyle(el); return el.offsetParent !== null && style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0.5'; });
}

window.addEventListener('keydown', (e) => {
    const activeScreen = document.querySelector('.screen.active'); if (!activeScreen) return;
    if (e.key === 'Escape') {
        e.preventDefault();
        if (activeScreen.id === 'screen-game') backToMenu(); 
        else if (activeScreen.id === 'screen-minigame') { stopMinigame(); showScreen('screen-minigame-menu'); } 
        else if (activeScreen.id === 'screen-text-game') backToMenuFromText();
        else { const backBtn = activeScreen.querySelector('.bottom-back-btn'); if (backBtn) backBtn.click(); }
        return;
    }
    if (activeScreen.id === 'screen-game' || activeScreen.id === 'screen-minigame' || activeScreen.id === 'screen-text-game') return;

    if (typeof e.key !== 'string') return;
    const key = e.key.toUpperCase();
    if (['F', 'J', 'ARROWLEFT', 'ARROWRIGHT', 'ARROWUP', 'ARROWDOWN'].includes(key)) {
        e.preventDefault(); const focusables = getFocusableElements(); if (focusables.length === 0) return;
        let currentIndex = focusables.indexOf(document.activeElement); if (currentIndex === -1) { focusables[0].focus(); return; }
        if (key === 'F' || key === 'ARROWLEFT' || key === 'ARROWUP') currentIndex = (currentIndex - 1 + focusables.length) % focusables.length;
        else if (key === 'J' || key === 'ARROWRIGHT' || key === 'ARROWDOWN') currentIndex = (currentIndex + 1) % focusables.length;
        focusables[currentIndex].focus(); focusables[currentIndex].scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
});

setGachaUiHandlers({
    renderRecords
});

// 修正後

export function updateGlobalHeader() {
    updateTitleRoleActions();

    if (currentUser && users[currentUser]) {
        const coinDisplay = document.getElementById('global-coin-display');
        if (coinDisplay) coinDisplay.innerText = `💰 ${users[currentUser].coins || 0}`;
    }
}

export function updateHomeDashboard() {
    if (!currentUser || !users[currentUser]) return;
    const u = users[currentUser];

    const lastPracticeCard = document.getElementById('last-practice-card');
    if (lastPracticeCard) {
        renderLastPracticeCard(lastPracticeCard, currentUser);
    }
    
    const maxMouse = 7; const mLv = u.mouseLevel || 0;
    const mPct = Math.floor((mLv / maxMouse) * 100);
    const mouseLvDisplay = document.getElementById('home-mouse-lv');
    const mouseBar = document.getElementById('home-mouse-bar');
    if (mouseLvDisplay) mouseLvDisplay.innerText = mLv >= 7 ? 'Lv.MAX (免許皆伝)' : `Lv.${mLv} / 7`;
    if (mouseBar) mouseBar.style.width = `${mPct}%`;

    const maxKb = STAGE_ORDER.length; const kSeq = u.keyboardSequence || 0;
    const kPct = Math.floor((kSeq / maxKb) * 100);
    const kbPctDisplay = document.getElementById('home-kb-pct');
    const kbBar = document.getElementById('home-kb-bar');
    if (kbPctDisplay) kbPctDisplay.innerText = `${kPct}%`;
    if (kbBar) kbBar.style.width = `${kPct}%`;

    const btn = document.getElementById('btn-recommend');
    if (!btn) return;
    if (mLv < 7) {
        btn.innerHTML = `🖱️ マウスのれんしゅう<br><span style="font-size:14px;">(M-${mLv + 1} へ)</span>`;
        btn.onclick = () => { goToMouseMenu(); startGame(mLv + 1, 'mouse'); };
    } else if (kSeq < maxKb) {
        const nextId = STAGE_ORDER[kSeq];
        const stageName = getStageName(nextId).replace(/\[ID:\d+\]\s*/, '');
        btn.innerHTML = `⌨️ キーボードれんしゅう<br><span style="font-size:14px;">(${stageName} へ)</span>`;
        btn.onclick = () => { showScreen('screen-keyboard-menu'); startGame(nextId, 'keyboard'); };
    } else {
        btn.innerHTML = `🏆 すべてクリア！<br><span style="font-size:14px;">(にがてとっくん や ガチャであそぼう)</span>`;
        btn.onclick = () => goToRecords();
        btn.style.animation = 'none';
        btn.style.backgroundColor = '#FFD700'; btn.style.color = '#333';
    }
}

/* =========================================================
   [JS] 11. ビジョントレーニング
   ========================================================= */

/* =========================================================
   [JS] 12. ローマ字一覧表ステージ
   ========================================================= */

/* =========================================================
   [JS] 13. ログアウト ＆ ユーティリティ
   ========================================================= */

export function exportDashboardCSV() {
    const isVision = document.getElementById('dash-vision').style.display === 'block';
    let csv = "\uFEFF"; 
    let thead = document.querySelector(isVision ? '#dash-vision-thead tr' : '#dash-basic thead tr');
    let tbody = document.querySelector(isVision ? '#dash-vision-tbody' : '#dash-tbody');
    
    if(!thead || !tbody) { alert("出力するデータがありません"); return; }
    
    let headers =[];
    thead.querySelectorAll('th').forEach(th => headers.push(`"${th.innerText.replace(/"/g, '""')}"`));
    csv += headers.join(',') + "\n";
    
    tbody.querySelectorAll('tr').forEach(tr => {
        let row =[];
        tr.querySelectorAll('td').forEach(td => {
            let text = td.innerText.replace(/\r?\n/g, " ").trim();
            row.push(`"${text.replace(/"/g, '""')}"`);
        });
        csv += row.join(',') + "\n";
    });
    
    let blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    let link = document.createElement('a');
    let dateStr = new Date().toISOString().slice(0,10);
    let fileName = isVision ? `ビジョンタイム_${dateStr}.csv` : `基本進捗_${dateStr}.csv`;
    link.href = URL.createObjectURL(blob);
    link.download = fileName;
    link.click();
}

/* =========================================================
   不足機能補填 ＆ バグ修正パッチ（最終）
   ========================================================= */

// ② 【修正】カスタムテーマがマイページ等に反映されない問題の修正
// ロード時に確実に THEMES と GACHA_ITEMS へ反映させる
export function loadCustomGlobalSettings() {
    const glob = users[GLOBAL_SETTINGS_ID];
    if (!glob || !glob.globalMistakes) return;
    if (Array.isArray(glob.globalMistakes.customThemes)) {
        glob.globalMistakes.customThemes.forEach(ct => {
            if (!THEMES.find(t => t.id === ct.id)) {
                THEMES.push({ id: ct.id, name: ct.name, icon: '🎨', isCustom: true, data: ct, bg: ct.bg, text: ct.text, btnBg: ct.btnBg, btnText: ct.btnText });
                GACHA_ITEMS.push({ id: ct.id, type: 'theme', name: `🎨 カスタムテーマ：${ct.name}`, rate: 0.05 });
            }
        });
    }
    if (Array.isArray(glob.globalMistakes.customEffects)) {
        glob.globalMistakes.customEffects.forEach(ce => {
            if (!EFFECTS.find(e => e.id === ce.id)) {
                EFFECTS.push({ id: ce.id, name: ce.name, icon: ce.emojis[0], isCustom: true, data: ce, emojis: ce.emojis });
                GACHA_ITEMS.push({ id: ce.id, type: 'effect', name: `🎉 カスタム演出：${ce.name}`, rate: 0.05 });
            }
        });
    }
}

// マイページを開く直前に必ず強制リロードして、作ったテーマを確実に読み込ませる
const originalGoToRecords = goToRecords;
goToRecords = function() {
    loadCustomGlobalSettings(); 
    renderRecords();
    showScreen('screen-records');
};

// ★追加: ビジョントレーニング タイム比較用関数

/* =========================================================
   [Vite環境用] HTMLから呼び出す関数をグローバルに登録
   ========================================================= */
const globalFunctions = [
    toggleSFX, toggleBGM, toggleFullScreen, goToGradeSelect, loginAsMaster, showScreen, showCustomAlert,

    goToMouseMenu, goToKeyboardCategory, goToKeyboardMenu, goToWeakTraining, goToTextMenu, goToMinigameMenu, goToVisionMenu,
    goToWordMenu, goToRecords,

    handleGlobalBack, handleGlobalHome, handleGlobalLogout,
    closeStampOverlay, closeRewardOverlay,

    startMinigame, stopMinigame,
    toggleRubyInPrep, toggleNaviInPrep, confirmStartTextPractice, closeTextPrepModal,
    submitTextPractice, closeTextResult, backToMenuFromText,

    retryExam, backToMenu, handleSecretMenuClick,
    showRomajiMenu, renderKeyboardStages, backToKbChapter,
    showRecordSection, backToRecordMenu, exportDashboardCSV, startRecommendedStage, loadCustomGlobalSettings,
    updateGlobalHeader, updateHomeDashboard,

    drawGacha, useTicket, changeTheme, changeEffect,
    showVisionCompare,

    openWordText, suspendWordTask, confirmWordClear, processWordClear,

    speakInstruction, speakTextTask, toggleRuby, toggleNavi
];

globalFunctions.forEach(fn => {
    if (typeof fn === 'function') {
        window[fn.name] = fn;
    }
});

// admin.js の export 関数をまとめて window 登録
Object.values(Admin).forEach(fn => {
    if (typeof fn === 'function') {
        window[fn.name] = fn;
    }
});

function validateInlineEventHandlers() {
    const eventAttrs = ['onclick', 'onchange', 'oninput', 'onkeydown', 'onsubmit'];
    const selectors = eventAttrs.map(attr => `[${attr}]`).join(',');
    const ignoredNames = new Set(['if', 'for', 'while', 'switch', 'function', 'return']);
    const missing = new Set();

    document.querySelectorAll(selectors).forEach(el => {
        eventAttrs.forEach(attr => {
            const code = el.getAttribute(attr);
            if (!code) return;

            const callPattern = /([A-Za-z_$][A-Za-z0-9_$]*)\s*\(/g;
            let match;
            while ((match = callPattern.exec(code)) !== null) {
                const name = match[1];
                const before = code[match.index - 1] || '';
                if (before === '.' || ignoredNames.has(name)) continue;
                if (typeof window[name] !== 'function') missing.add(`${name} (${attr})`);
            }
        });
    });

    if (missing.size > 0) {
        console.error('Missing inline event handlers:', Array.from(missing).sort());
    }
}

validateInlineEventHandlers();
