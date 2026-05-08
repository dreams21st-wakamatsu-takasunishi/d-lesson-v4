import './style.css';

import {
  GRADE_ORDER,
  VISION_STAGES,
  FINGER_MAP,
  FINGER_HOME_MAP,
  COLOR_CLASS_MAP,
  KEYBOARD_STAGES,
  BLIND_STAGES,
  BRIDGE_STAGES,
  HIRAGANA_DATA,
  ADVICE_HINT_MAP,
  WORD_DATA,
  EXAMS,
  STAGE_ORDER,
  KB_CHAPTERS,
  KB_LAYOUT,
  WORD_STAGES,
  THEMES,
  EFFECTS
} from './data/constants.js';
import { GACHA_ITEMS } from './data/gacha-items.js';

import { toggleSFX, toggleBGM, SoundManager, initAudio } from './utils/sound.js';
import {
  users,
  currentUser,
  currentSelectedGrade,
  loadUsers,
  saveUsers,
  goToGradeSelect,
  renderGradeList,
  renderUserList,
  login,
  showStampOverlay,
  closeStampOverlay,
  setCurrentUser,
  setCurrentSelectedGrade,
  hasLessonRole,
  GLOBAL_SETTINGS_ID,
  MASTER_DEBUG_ID,
  getUserDisplayName,
  isSystemUserId,
  canWriteCurrentUserRow,
  recordPracticeActivity
} from './api/user.js';

import * as Admin from './ui/admin.js';

import { showCustomAlert, showCustomConfirm } from './ui/modal.js';
import { createBtn } from './utils/dom.js';
import { getRewardText } from './utils/rewards.js';
import { getStageName } from './utils/stages.js';
import {
    closeRewardOverlay,
    createConfetti
} from './ui/reward.js';
import {
    renderLastPracticeCard,
    renderPracticeHistorySection
} from './ui/practice-history.js';
import { setCurrentKeyboardChapter } from './ui/keyboard-state.js';

import {
    showScreen,
    toggleFullScreen,
    showImeWarning,
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
drawGacha,
useTicket,
changeTheme,
changeEffect,
setGachaUiHandlers
} from './games/gacha.js'

import {
    startVisionGame,
    showVisionCompare,
    renderVisionMenu
} from './games/vision.js';

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
   [JS] 2. データ定義と定数 (Data)
   ========================================================= */
const ACHIEVEMENTS =[
    { id: 'login_3', title: '三日坊主じゃない！', desc: 'ログインスタンプを 3こ あつめる', icon: '📅', check: u => u.loginStamps && u.loginStamps.length >= 3 },
    { id: 'login_10', title: 'けいぞくは 力なり', desc: 'ログインスタンプを 10こ あつめる', icon: '🔥', check: u => u.loginStamps && u.loginStamps.length >= 10 },
    { id: 'type_1000', title: 'タイピング ビギナー', desc: 'キーを るいけい 1000回 タイプする', icon: '⌨️', check: u => (u.totalKeysTyped || 0) >= 1000 },
    { id: 'type_10000', title: 'タイピング マスター', desc: 'キーを るいけい 10000回 タイプする', icon: '✨', check: u => (u.totalKeysTyped || 0) >= 10000 },
    { id: 'nomiss', title: 'パーフェクト！', desc: 'しけん を ミス0 で クリアする', icon: '🎯', check: u => u.hasPerfectClear },
    { id: 'mouse_master', title: 'マウスの達人', desc: 'マウスれんしゅう を Lv.7まで クリア', icon: '🖱️', check: u => (u.mouseLevel || 0) >= 7 },
    { id: 'gacha_10', title: 'ガチャマニア', desc: 'アイテム を 10こ以上 あつめる', icon: '🎁', check: u => u.items && u.items.length >= 10 }
];

/* =========================================================
   [JS] 7. ミニゲーム（メテオ ＆ Dチャレンジ）
   ========================================================= */
let mgInterval, mgSpawnInterval, mgTimeInterval, mgTime = 60, mgScore = 0, mgWords =[], mgActiveWord = null, cancelMgStartHandler = null; 
let currentMinigameType = 'meteor';

let dBoost = 1.0;
let dLevel = 1;
let dClearedWords = 0;
let dChallengeWords = { 1:[], 2:[], 3:[], 4:[] };
let dCurrentWordMissed = false; 

function initDChallengeWords() {
    dChallengeWords = { 1: [], 2: [], 3:[], 4:[] };
    const addWord = (c) => {
        let len = c.h.length;
        if (len <= 2) dChallengeWords[1].push(c);
        else if (len === 3) dChallengeWords[2].push(c);
        else if (len >= 4 && len <= 5) dChallengeWords[3].push(c);
        else dChallengeWords[4].push(c);
    };
    WORD_DATA.forEach(d => { d.chars.forEach(addWord); });
    const MG_NOUNS = WORD_DATA[0].chars; 
    const MG_EXTRA_WORDS = WORD_DATA[1].chars; 
    MG_NOUNS.forEach(addWord);
    MG_EXTRA_WORDS.forEach(addWord);
}

function getDChallengeWord(level) {
    const list = dChallengeWords[level] || dChallengeWords[1];
    return list[Math.floor(Math.random() * list.length)];
}

function getRandomMinigameWord() {
    const group = WORD_DATA[Math.floor(Math.random() * WORD_DATA.length)];
    return group.chars[Math.floor(Math.random() * group.chars.length)];
}

function updateBoostGauge() {
    if (currentMinigameType !== 'd_challenge') return;
    const maxBoost = 5.0;
    let fillPercent = ((dBoost - 1.0) / (maxBoost - 1.0)) * 100;
    if (fillPercent < 0) fillPercent = 0; if (fillPercent > 100) fillPercent = 100;
    const gaugeFill = document.getElementById('boost-gauge-fill');
    const multiplier = document.getElementById('boost-multiplier');
    if (gaugeFill && multiplier) {
        gaugeFill.style.height = fillPercent + '%';
        multiplier.innerText = 'x' + dBoost.toFixed(1);
    }
}

function startMinigame(type) {
    SoundManager.init(); if (document.activeElement) document.activeElement.blur(); 
    showScreen('screen-minigame');
    currentMinigameType = type || 'meteor';
    
    document.getElementById('mg-result-overlay').style.display = 'none'; 
    const mgArea = document.getElementById('minigame-area');
    mgArea.innerHTML = '';
    
    if (currentMinigameType === 'd_challenge') {
        mgArea.classList.add('d-challenge-mode');
        document.getElementById('boost-gauge-container').style.display = 'flex';
        document.getElementById('mg-score-label').innerHTML = `スコア: <span id="mg-score">0</span>`;
        initDChallengeWords();
        dBoost = 1.0; dLevel = 1; dClearedWords = 0;
        updateBoostGauge();
    } else {
        mgArea.classList.remove('d-challenge-mode');
        document.getElementById('boost-gauge-container').style.display = 'none';
        document.getElementById('mg-score-label').innerHTML = `スコア: <span id="mg-score">0</span>`;
    }

    mgTime = 60; mgScore = 0; mgWords =[]; mgActiveWord = null; updateMgHud();
    const overlay = document.getElementById('mg-start-overlay'); overlay.style.display = 'flex';
    
    if (cancelMgStartHandler) {
        document.removeEventListener('keydown', cancelMgStartHandler);
        overlay.removeEventListener('mousedown', cancelMgStartHandler);
    }
    
    const mgStartHandler = (e) => {
        if (e.isComposing || e.key === 'Process') { showImeWarning(); return; }

        if (e.key === ' ' || e.key === '　' || e.key === 'Enter' || e.type === 'mousedown') {
            e.preventDefault(); document.removeEventListener('keydown', mgStartHandler); 
            overlay.removeEventListener('mousedown', mgStartHandler); cancelMgStartHandler = null; 
            overlay.style.display = 'none';
            
            document.addEventListener('keydown', mgHandleKey);
            mgTimeInterval = setInterval(() => { mgTime--; updateMgHud(); if (mgTime <= 0) endMinigame(); }, 1000);
            
            if (currentMinigameType === 'meteor') {
                mgSpawnInterval = setInterval(spawnMgWordMeteor, 1500);
                mgInterval = setInterval(() => { 
                    mgWords.forEach((w, i) => { 
                        w.y += w.speed; w.el.style.top = w.y + 'px'; 
                        if (w.y > mgArea.offsetHeight - 50) { 
                            w.el.remove(); mgWords.splice(i, 1); 
                            if (mgActiveWord === w) mgActiveWord = null; 
                        } 
                    }); 
                }, 50);
            } else {
                spawnMgWordDChallenge();
                mgInterval = setInterval(() => {
                    if (mgTime > 0 && dBoost > 1.0) {
                        dBoost = Math.max(1.0, dBoost - 0.01);
                        updateBoostGauge();
                    }
                }, 100);
            }
        }
    };
    
    cancelMgStartHandler = mgStartHandler; 
    setTimeout(() => { document.addEventListener('keydown', mgStartHandler); overlay.addEventListener('mousedown', mgStartHandler); }, 300);
}

function stopMinigame() { 
    if (cancelMgStartHandler) { 
        document.removeEventListener('keydown', cancelMgStartHandler); 
        const overlay = document.getElementById('mg-start-overlay');
        if(overlay) overlay.removeEventListener('mousedown', cancelMgStartHandler);
        cancelMgStartHandler = null; 
    } 
    clearInterval(mgTimeInterval); clearInterval(mgSpawnInterval); clearInterval(mgInterval); 
    document.removeEventListener('keydown', mgHandleKey); 
}

function endMinigame() {
    stopMinigame(); SoundManager.playClear(); 
    let scoreText = `スコア: ${mgScore}`;
    document.getElementById('mg-final-score').innerText = scoreText;
    
    let isNewRecord = false; let u = users[currentUser];
    const canSaveResult = canWriteCurrentUserRow();
    if (!u.examRecords) u.examRecords = {}; 

    if (currentMinigameType === 'd_challenge') {
        let prev = u.examRecords['mg_d_challenge'] || u.dChallengeHighscore || 0;
        if (canSaveResult && mgScore > prev) { u.examRecords['mg_d_challenge'] = mgScore; u.dChallengeHighscore = mgScore; isNewRecord = true; }
    } else {
        let prev = u.examRecords['mg_meteor'] || u.minigameHighscore || 0;
        if (canSaveResult && mgScore > prev) { u.examRecords['mg_meteor'] = mgScore; u.minigameHighscore = mgScore; isNewRecord = true; }
    }

    if (canSaveResult) {
        recordPracticeActivity({
            category: 'minigame',
            title: currentMinigameType === 'd_challenge' ? 'Dチャレンジ' : 'タイピングゲーム',
            detail: isNewRecord ? '新記録' : '練習完了',
            amount: `スコア ${mgScore}点`,
            coins: 0
        });
        saveUsers(false);
    }
    
    let rankHtml = `<h3 style="margin-top:0; color:#E91E63; border-bottom:2px solid #E91E63;">👑 トップ5 👑</h3><ul style="list-style:none; padding:0; font-size:20px; text-align:left; color:#333;">`;
    let ranking =[]; 
    Object.keys(users).forEach(n => { 
        if (!users[n].isMaster && !isSystemUserId(n)) {
            let s = currentMinigameType === 'd_challenge' ? (users[n].examRecords?.['mg_d_challenge'] || users[n].dChallengeHighscore || 0) : (users[n].examRecords?.['mg_meteor'] || users[n].minigameHighscore || 0);
            if (s > 0) ranking.push({ id: n, name: getUserDisplayName(n), score: s });
        }
    }); 
    ranking.sort((a, b) => b.score - a.score);
    
    let displayRank = ranking.slice(0, 5); 
    displayRank.forEach((r, i) => { 
        let medal =['🥇', '🥈', '🥉', '４.', '５.'][i]; 
        let isMe = (r.id === currentUser) ? 'background:#fff9c4; font-weight:bold; border-radius:5px;' : '';
        rankHtml += `<li style="padding:5px; margin-bottom:5px; ${isMe}">${medal} ${r.name} : ${r.score} 点</li>`; 
    });
    rankHtml += `</ul>`; 
    
    let myRankIdx = ranking.findIndex(r => r.id === currentUser);
    let myRankText = myRankIdx !== -1 ? `あなたの順位： ${myRankIdx + 1} 位` : `あなたの順位： ランク外`;
    rankHtml += `<div style="margin-top: 15px; font-weight: bold; font-size: 22px; color: #1565C0; border-top: 2px dashed #90CAF9; padding-top: 10px;">${myRankText}</div>`;

    if (isNewRecord) rankHtml += `<div style="color:#E91E63; font-weight:bold; font-size:24px; animation:bounce 1s infinite; margin-top: 10px;">★しんきろく 達成！★</div>`;
    
    const rankBoard = document.getElementById('mg-ranking-board'); 
    rankBoard.innerHTML = rankHtml; rankBoard.style.display = 'block'; 
    document.getElementById('mg-result-overlay').style.display = 'flex'; 
    createConfetti();
}

function updateMgHud() { document.getElementById('mg-score').innerText = mgScore; document.getElementById('mg-time').innerText = `のこり: ${mgTime}秒`; }

function spawnMgWordMeteor() {
    const wordData = getRandomMinigameWord();
    const text = wordData.h; const romajiList = wordData.r; const el = document.createElement('div'); el.className = 'falling-word'; el.innerHTML = `${text}<br><span style="font-size:16px;">${romajiList[0]}</span>`;
    const areaWidth = document.getElementById('minigame-area').offsetWidth; let x = Math.random() * (areaWidth - 200) + 20; el.style.left = x + 'px'; el.style.top = '-50px';
    document.getElementById('minigame-area').appendChild(el); mgWords.push({ el: el, text: text, romajiList:[...romajiList], idx: 0, y: -50, speed: Math.random() * 1.5 + 0.8 });
}

function spawnMgWordDChallenge() {
    dCurrentWordMissed = false; 
    const wordData = getDChallengeWord(dLevel);
    const text = wordData.h; const romajiList = wordData.r; 
    const el = document.createElement('div'); el.className = 'd-challenge-word-display'; 
    el.innerHTML = `${text}<br><span class="romaji">${romajiList[0]}</span>`;
    document.getElementById('minigame-area').appendChild(el); 
    mgActiveWord = { el: el, text: text, romajiList:[...romajiList], idx: 0 };
}

function mgHandleKey(e) {
    if (typeof e.key !== 'string') return;
    if (mgTime <= 0 ||['Shift', 'Enter', 'Control', 'Alt', 'Meta', 'Tab', 'Escape'].includes(e.key)) return;
    if (e.isComposing || e.key === 'Process') { showImeWarning(); return; }
    
    let k = e.key.toUpperCase();
    
    if (currentMinigameType === 'd_challenge') {
        if (!mgActiveWord) return;
        let isCorrect = false; let validPatterns = mgActiveWord.romajiList.filter(r => r[mgActiveWord.idx] === k);
        if (validPatterns.length > 0) { mgActiveWord.romajiList = validPatterns; mgActiveWord.idx++; isCorrect = true; }
        
        if (isCorrect) {
            SoundManager.playType(); 
            mgScore += Math.floor(10 * dBoost); updateMgHud(); 
            
            updateMgWordDisplayDChallenge(mgActiveWord);
            mgActiveWord.el.classList.remove('error');
            mgActiveWord.el.classList.add('pop');
            setTimeout(()=> { if(mgActiveWord) mgActiveWord.el.classList.remove('pop'); }, 100);

            if (mgActiveWord.idx >= mgActiveWord.romajiList[0].length) {
                SoundManager.playSuccess(); 
                mgScore += Math.floor(50 * dBoost); 
                
                if (!dCurrentWordMissed) {
                    dBoost = Math.min(5.0, dBoost + 0.5); 
                    updateBoostGauge();
                }
                updateMgHud(); 

                mgActiveWord.el.classList.add('boost-active');
                
                dClearedWords++;
                if (dClearedWords >= 3 && dLevel < 4) {
                    dLevel++; dClearedWords = 0;
                }
                
                let oldEl = mgActiveWord.el;
                mgActiveWord = null;
                setTimeout(() => { oldEl.remove(); spawnMgWordDChallenge(); }, 300);
            }
        } else { 
            SoundManager.playError(); 
            dCurrentWordMissed = true;
            dBoost = Math.max(1.0, dBoost - 0.5); 
            updateBoostGauge();
            
            mgActiveWord.el.classList.remove('pop');
            mgActiveWord.el.classList.add('error');
            setTimeout(()=> { if(mgActiveWord) mgActiveWord.el.classList.remove('error'); }, 200);
        }
    } else {
        if (mgActiveWord) {
            let isCorrect = false, validPatterns = mgActiveWord.romajiList.filter(r => r[mgActiveWord.idx] === k);
            if (validPatterns.length > 0) { mgActiveWord.romajiList = validPatterns; mgActiveWord.idx++; isCorrect = true; }
            if (isCorrect) { 
                SoundManager.playType(); updateMgWordDisplayMeteor(mgActiveWord); 
                if (mgActiveWord.idx >= mgActiveWord.romajiList[0].length) { 
                    SoundManager.playSuccess(); mgActiveWord.el.remove(); mgWords = mgWords.filter(w => w !== mgActiveWord); 
                    mgScore += mgActiveWord.romajiList[0].length * 100; mgActiveWord = null; updateMgHud(); 
                } 
            } else SoundManager.playError();
        } else {
            let found = null; for (let w of mgWords) { let valid = w.romajiList.filter(r => r[0] === k); if (valid.length > 0) { w.romajiList = valid; w.idx = 1; found = w; break; } }
            if (found) { 
                SoundManager.playType(); mgActiveWord = found; updateMgWordDisplayMeteor(mgActiveWord); 
                if (mgActiveWord.idx >= mgActiveWord.romajiList[0].length) { 
                    SoundManager.playSuccess(); mgActiveWord.el.remove(); mgWords = mgWords.filter(w => w !== mgActiveWord); 
                    mgScore += mgActiveWord.romajiList[0].length * 100; mgActiveWord = null; updateMgHud(); 
                } 
            } else SoundManager.playError();
        }
    }
}

function updateMgWordDisplayMeteor(w) { 
    mgWords.forEach(word => { if(word.el) word.el.style.zIndex = '1'; }); 
    const r = w.romajiList[0]; const typed = r.substring(0, w.idx); const untyped = r.substring(w.idx); 
    w.el.innerHTML = `${w.text}<br><span style="font-size:16px;"><span class="typed">${typed}</span>${untyped}</span>`; 
    w.el.style.borderColor = '#FFeb3b'; w.el.style.boxShadow = '0 0 15px rgba(255, 235, 59, 0.8)'; 
    w.el.style.zIndex = '100'; 
}

function updateMgWordDisplayDChallenge(w) {
    const r = w.romajiList[0]; const typed = r.substring(0, w.idx); const untyped = r.substring(w.idx); 
    w.el.innerHTML = `${w.text}<br><span class="romaji"><span class="typed">${typed}</span>${untyped}</span>`;
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

function showRecordSection(secId) {
    document.getElementById('records-main-menu').style.display = 'none';
    document.getElementById('records-panel-content').style.display = 'flex';
    document.getElementById('records-bottom-back-btn').style.display = 'none';
    document.querySelectorAll('.record-section-content').forEach(el => el.style.display = 'none');
    document.getElementById(secId).style.display = 'block';
}

function backToRecordMenu() {
    document.getElementById('records-main-menu').style.display = 'flex';
    document.getElementById('records-panel-content').style.display = 'none';
    document.getElementById('records-bottom-back-btn').style.display = 'block';
    if(users[currentUser]) document.getElementById('global-coin-display').innerText = `💰 ${users[currentUser].coins || 0}`;
}

export function renderRecords() {
    backToRecordMenu();
    const u = users[currentUser];
    if(!u) return;
    const canSaveResult = canWriteCurrentUserRow();

    const pCont = document.getElementById('rec-practice');
    if (pCont) renderPracticeHistorySection(pCont, currentUser);

    const gCont = document.getElementById('rec-gacha'); gCont.innerHTML = '';
    gCont.innerHTML = `<div class="gacha-section">
        <div class="coin-display">💰 コイン: ${u.coins || 0} 枚</div>
        ${canSaveResult ? '<p style="margin: 5px 0 15px 0;">ガチャをひいて アイテムをゲットしよう！</p>' : '<p style="margin: 5px 0 15px 0; color:#00695c; font-weight:bold;">先生確認モード：ガチャ・チケット・着せ替えは保存されません</p>'}
        ${canSaveResult ? `
            <div style="display:flex; justify-content:center; gap:15px; flex-wrap:wrap;">
                <button class="btn-gacha" style="padding: 10px 20px; font-size: 20px;" onclick="drawGacha(1)">1回 (100)</button>
                <button class="btn-gacha" style="padding: 10px 20px; font-size: 20px; background:linear-gradient(135deg, #4CAF50, #8BC34A);" onclick="drawGacha(10)">10回 (1000)</button>
                <button class="btn-gacha" style="padding: 10px 20px; font-size: 20px; background:linear-gradient(135deg, #E91E63, #9C27B0);" onclick="drawGacha(1, true)">🔮 レア確定 (500)</button>
            </div>
        ` : `
            <div style="padding:12px; border:2px solid #80cbc4; border-radius:8px; background:#e0f2f1; color:#004d40; font-weight:bold;">確認専用のため、保存を伴う操作は無効です。</div>
        `}
    </div>`;
    if (u.tickets && u.tickets.length > 0) {
        gCont.innerHTML += `<h3 style="color:#FF5722;">🎟️ もっている ひきかえけん</h3>`;
        u.tickets.forEach((t, idx) => {
            const ticketButton = canSaveResult
                ? `<button class="ticket-btn" onclick="useTicket(${idx})">先生につかってもらう</button>`
                : '<button class="ticket-btn" disabled style="opacity:0.5; cursor:not-allowed;">確認専用</button>';
            gCont.innerHTML += `<div class="ticket-card"><div><div class="ticket-name">${t.name}</div><div style="font-size:12px; color:#555;">ゲットした日: ${t.date}</div></div>${ticketButton}</div>`;
        });
    }

    const tCont = document.getElementById('rec-theme'); tCont.innerHTML = '';
    let tHtml = `<h3>🎨 きせかえテーマ</h3><div class="theme-grid">`;
    THEMES.forEach(t => {
        let checkId = t.isCustom ? t.id : 'theme_' + t.id;
        let isUnlocked = (u.items && (u.items.includes(checkId) || u.items.includes(t.id))) || u.isMaster || (t.id === 'default');
        let isActive = (u.theme === t.id);
        tHtml += `<button class="theme-btn ${!isUnlocked ? 'locked' : ''} ${isActive ? 'active-theme' : ''}" ${isUnlocked ? `onclick="changeTheme('${t.id}')"` : `onclick="showCustomAlert('ガチャでゲットするとつかえるよ！')"`}>${t.icon} ${t.name}</button>`;
    });
    tHtml += `</div><h3 style="margin-top:20px;">🎉 クリアえんしゅつ</h3><div class="theme-grid">`;
    EFFECTS.forEach(e => {
        let isUnlocked = (e.id === 'default') || (u.items && u.items.includes(e.id)) || u.isMaster;
        let isActive = (u.activeEffect === e.id);
        tHtml += `<button class="theme-btn ${!isUnlocked ? 'locked' : ''} ${isActive ? 'active-theme' : ''}" ${isUnlocked ? `onclick="changeEffect('${e.id}')"` : `onclick="showCustomAlert('ガチャでゲットするとつかえるよ！')"`}>${e.icon} ${e.name}</button>`;
    });
    tCont.innerHTML = tHtml + `</div>`;

    const bCont = document.getElementById('rec-badge'); bCont.innerHTML = '';
    const badgeGrid = document.createElement('div'); badgeGrid.className = 'badge-grid';
    const mLv = u.mouseLevel || 0;
    badgeGrid.innerHTML += `<div class="badge-item ${mLv >= 7 ? 'earned' : ''}"><div class="badge-icon">👑</div><div class="badge-name">マウス<br>めんきょかいでん</div></div>`;
    const kSeq = u.keyboardSequence || 0; const records = u.examRecords || {};
    EXAMS.forEach(ex => {
        const isClr = (STAGE_ORDER.indexOf(ex.id) !== -1 && kSeq > STAGE_ORDER.indexOf(ex.id));
        let icon = '🏆'; if([1999,2999,3999,4999].includes(ex.id)) icon='👑';
        let medal = '';
        if(isClr && records[ex.id]) {
            if(records[ex.id] <= ex.gold) medal='<div class="badge-medal">🥇</div>';
            else if(records[ex.id] <= ex.silver) medal='<div class="badge-medal">🥈</div>';
            else medal='<div class="badge-medal">🥉</div>';
        }
        badgeGrid.innerHTML += `<div class="badge-item ${isClr ? 'earned' : ''}">${medal}<div class="badge-icon">${icon}</div><div class="badge-name">${ex.title}</div></div>`;
    });
    bCont.appendChild(badgeGrid);

    const timeCont = document.getElementById('rec-time'); timeCont.innerHTML = '';
    let kbTimes = `<h4 style="color:#555; margin-bottom:5px; border-bottom:1px solid #ccc; padding-bottom:5px;">⌨️ キーボード試験</h4><div style="display:flex; flex-wrap:wrap; gap:10px; margin-bottom:15px;">`;
    let hasKbRecord = false;
    EXAMS.forEach(ex => {
        if(records[ex.id]) {
            hasKbRecord = true; let medal = '🥉'; if(records[ex.id] <= ex.gold) medal = '🥇'; else if(records[ex.id] <= ex.silver) medal = '🥈';
            kbTimes += `<div style="background:#f5f5f5; border:2px solid #ccc; padding:5px 15px; border-radius:8px; font-weight:bold; color:#333;">${ex.title}: <span style="color:#e65100;">${records[ex.id].toFixed(1)}秒</span> ${medal}</div>`;
        }
    });
    if(!hasKbRecord) kbTimes += `<span style="color:#999; font-size:14px; margin-left:10px;">まだ記録がありません</span>`;
    
    let viTimes = `<h4 style="color:#555; margin-bottom:5px; border-bottom:1px solid #ccc; padding-bottom:5px;">👁️ ビジョントレーニング</h4><div style="display:flex; flex-wrap:wrap; gap:10px;">`;
    let hasViRecord = false;
    VISION_STAGES.forEach(st => {
        if(records[st.id]) { hasViRecord = true; viTimes += `<div style="background:#e3f2fd; border:2px solid #90caf9; padding:5px 15px; border-radius:8px; font-weight:bold; color:#0277bd;">${st.title}: <span style="color:#e65100;">${records[st.id].toFixed(1)}秒</span></div>`; }
        if(records[st.id + '_hard']) { hasViRecord = true; viTimes += `<div style="background:#fff3e0; border:2px solid #ffcc80; padding:5px 15px; border-radius:8px; font-weight:bold; color:#d84315;">${st.title}(🔥): <span style="color:#e65100;">${records[st.id + '_hard'].toFixed(1)}秒</span></div>`; }
    });
    if(!hasViRecord) viTimes += `<span style="color:#999; font-size:14px; margin-left:10px;">まだ記録がありません</span>`;
    timeCont.innerHTML = kbTimes + `</div>` + viTimes + `</div>`;

    const graphCont = document.getElementById('rec-graph'); graphCont.innerHTML = '';
    const gWrap = document.createElement('div'); gWrap.style.display = 'flex'; gWrap.style.gap = '20px'; gWrap.style.justifyContent = 'center'; gWrap.style.width = '100%';
    
    const vPct = Math.floor(((u.visionCleared ? u.visionCleared.length : 0) / (VISION_STAGES.length * 2)) * 100);
    gWrap.innerHTML += `<div style="flex:1; background:#fff; padding:20px; border-radius:12px; border:1px solid #ccc; box-shadow:0 4px 6px rgba(0,0,0,0.05);">
        <h4 style="margin-top:0; color:#555; border-bottom:2px solid #eee; padding-bottom:10px;">🎮 全体の達成度</h4>
        <div style="margin-bottom:15px;"><div style="display:flex; justify-content:space-between; margin-bottom:5px;"><span>🖱️ マウス</span><span>${Math.floor((mLv/7)*100)}%</span></div><div style="width:100%; height:20px; background:#eee; border-radius:10px; overflow:hidden;"><div style="width:${Math.floor((mLv/7)*100)}%; height:100%; background:#2196F3;"></div></div></div>
        <div style="margin-bottom:15px;"><div style="display:flex; justify-content:space-between; margin-bottom:5px;"><span>⌨️ キーボード</span><span>${Math.floor((kSeq/STAGE_ORDER.length)*100)}%</span></div><div style="width:100%; height:20px; background:#eee; border-radius:10px; overflow:hidden;"><div style="width:${Math.floor((kSeq/STAGE_ORDER.length)*100)}%; height:100%; background:#FF9800;"></div></div></div>
        <div style="margin-bottom:15px;"><div style="display:flex; justify-content:space-between; margin-bottom:5px;"><span>👁️ ビジョン</span><span>${vPct}%</span></div><div style="width:100%; height:20px; background:#eee; border-radius:10px; overflow:hidden;"><div style="width:${vPct}%; height:100%; background:#9C27B0;"></div></div></div>
    </div>`;

    const weakDiv = document.createElement('div'); weakDiv.style.flex = '1'; weakDiv.style.background = '#fff'; weakDiv.style.padding = '20px'; weakDiv.style.borderRadius = '12px'; weakDiv.style.border = '1px solid #ccc'; weakDiv.style.boxShadow = '0 4px 6px rgba(0,0,0,0.05)';
    weakDiv.innerHTML = `<h4 style="margin-top:0; color:#555; border-bottom:2px solid #eee; padding-bottom:10px;">⚠️ あなたの苦手なキー</h4>`;
    let mistakes = u.globalMistakes || {};
    let sorted = Object.keys(mistakes).filter(k => mistakes[k] > 0).sort((a, b) => mistakes[b] - mistakes[a]);
    
    if (sorted.length === 0) {
        weakDiv.innerHTML += `<div style="color:#4CAF50; font-weight:bold; margin-top:20px; text-align:center; font-size:20px;">✨ すばらしい！<br>弱点はありません。</div>`;
    } else {
        let maxMiss = mistakes[sorted[0]];
        let heatmapHtml = `<div class="heatmap-kb">`;
        KB_LAYOUT.forEach(row => {
            heatmapHtml += `<div class="heatmap-row">`;
            row.forEach(k => {
                let disp = k === 'SPACE' ? '空白' : k;
                let count = mistakes[k] || 0;
                let pct = maxMiss > 0 ? (count / maxMiss) * 100 : 0;
                let cls = k === 'SPACE' ? 'heatmap-key space' : 'heatmap-key';
                heatmapHtml += `<div class="${cls}" title="${disp}: ${count}回ミス"><div class="heatmap-bg" style="height:${pct}%;"></div><span class="heatmap-text">${disp}</span></div>`;
            });
            heatmapHtml += `</div>`;
        });
        heatmapHtml += `</div><div style="text-align:center; font-size:12px; color:#999; margin-top:5px;">※ミスが多いキーほど赤くなります</div>`;
        weakDiv.innerHTML += heatmapHtml;
    }
    gWrap.appendChild(weakDiv); graphCont.appendChild(gWrap);

    const titleCont = document.getElementById('rec-title'); titleCont.innerHTML = '';
    const titleHeader = document.createElement('h3'); titleHeader.innerText = '🎖️ あつめた称号'; titleCont.appendChild(titleHeader);
    const titleGrid = document.createElement('div'); titleGrid.style.display = 'flex'; titleGrid.style.flexWrap = 'wrap'; titleGrid.style.gap = '15px'; titleGrid.style.justifyContent = 'center';
    
    ACHIEVEMENTS.forEach(ac => {
        let isEarned = ac.check(u) || u.isMaster;
        const b = document.createElement('div'); b.className = 'title-badge' + (isEarned ? ' earned' : '');
        b.innerHTML = `<div class="title-icon">${ac.icon}</div><div class="title-info"><div class="title-name">${ac.title}</div><div class="title-desc">${ac.desc}</div></div>`;
        titleGrid.appendChild(b);
    });
    titleCont.appendChild(titleGrid);
}

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

function goToWordMenu() { 
    const u = getActiveUserOrTitle();
    if (!u) return;
    if (!u.isMaster) {
        if (!u.examRecords || !u.examRecords['romaji_daku_exam']) {
            // ★改行位置を最適化
            showCustomAlert('Wordれんしゅう は、キーボードれんしゅうの\n「ローマ字いちらん表（だくてん テスト）」を\nクリアすると あそべるようになるよ！');
            return;
        }
    }
    renderWordMenu(); 
    showScreen('screen-word-menu'); 
}

let currentWordStageId = null;

function renderWordMenu() {
    const cont = document.getElementById('word-menu-content'); cont.innerHTML = '';
    const u = users[currentUser];
    if (!u.wordProgress) u.wordProgress = {};

    let previousCleared = true; // 最初の章は無条件で挑戦可能

    WORD_STAGES.forEach((st) => {
        let prog = u.wordProgress[st.id];
        let isCleared = false;
        let isWorking = false;
        let workingPage = "";

        // ★修正: 以前の文字列データとの互換性を保ちつつ、ページ数を読み込む
        if (prog) {
            if (typeof prog === 'string') {
                isCleared = (prog === 'cleared');
                isWorking = (prog === 'working');
            } else {
                isCleared = (prog.status === 'cleared');
                isWorking = (prog.status === 'working');
                workingPage = prog.page || "";
            }
        }

        const isUnlocked = previousCleared || u.isMaster; 

        const b = document.createElement('div');
        b.className = 'stage-btn';
        b.style.height = '100px';

        if (isUnlocked) {
            b.classList.add('unlocked');
            if (isCleared) b.classList.add('cleared');
            else if (isWorking) b.classList.add('working');
            
            createBtn(b, () => startWordStage(st.id));
        } else {
            b.style.opacity = '0.5';
        }

        b.innerHTML = `<span style="font-size:24px;">📘</span><span style="font-size:16px; font-weight:bold; color:#333; margin-top:5px;">${st.title}</span><span style="font-size:12px; color:#666;">${st.sub}</span>`;
        
        // バッジ表示（ページ数があれば表示する）
        if (isCleared) b.innerHTML += `<span class="reward-badge" style="background:#e8f5e9; border-color:#4CAF50; color:#2e7d32;">クリア</span>`;
        else if (isWorking) b.innerHTML += `<span class="reward-badge" style="background:#fffde7; border-color:#FFEB3B; color:#fbc02d;">挑戦中 ⏸️ ${workingPage ? 'P.'+workingPage : ''}</span>`;
        else if (isUnlocked) b.innerHTML += `<span class="reward-badge">💰500</span>`; 

        cont.appendChild(b);
        previousCleared = isCleared; // 次の章の解放判定
    });
}

function startWordStage(sid) {
    currentWordStageId = sid;
    const st = WORD_STAGES.find(s => s.id === sid);
    document.getElementById('word-stage-title').innerText = `${st.title}：${st.sub}`;
    
    // ★追加: 以前入力したページ数があればセットする
    let prog = users[currentUser].wordProgress[sid];
    let pageVal = "";
    if (prog && typeof prog === 'object') {
        pageVal = prog.page || "";
    }
    document.getElementById('word-page-input').value = pageVal;

    showScreen('screen-word-game');
}

function openWordText() {
    const st = WORD_STAGES.find(s => s.id === currentWordStageId);
    if (st && st.pdf && st.pdf !== '') window.open(st.pdf, '_blank');
    else showCustomAlert('テキストのURLが設定されていません。\n（先生へ：script.js 内の WORD_STAGES にPDFのURLを入れてください）'); // ★修正
}

function getCurrentWordStageLabel() {
    const st = WORD_STAGES.find(s => s.id === currentWordStageId);
    if (!st) return 'Word練習';
    return `Word ${st.title}${st.sub ? ` / ${st.sub}` : ''}`;
}

function suspendWordTask() {
    if (!canWriteCurrentUserRow()) {
        showCustomAlert('先生確認モードでは、Wordの途中保存は保存されません。生徒本人または管理者で操作してください。');
        return;
    }

    const u = users[currentUser];
    if (!u.wordProgress) u.wordProgress = {};
    
    let pageVal = document.getElementById('word-page-input').value;
    let prog = u.wordProgress[currentWordStageId];
    
    // クリア済みの場合はページ数だけ更新する
    let isCleared = (prog === 'cleared' || (prog && prog.status === 'cleared'));
    
    u.wordProgress[currentWordStageId] = {
        status: isCleared ? 'cleared' : 'working',
        page: pageVal
    };
    recordPracticeActivity({
        category: 'word',
        title: getCurrentWordStageLabel(),
        detail: isCleared ? 'クリア済みページ更新' : '途中保存',
        amount: pageVal ? `${pageVal}ページまで` : 'ページ未入力',
        coins: 0
    });
    saveUsers(false);
    SoundManager.playClick();
    showCustomAlert('「挑戦中 ⏸️」として記録しました！\nデータを保存してWordをとじたら、また次回続きから頑張ろう！'); // ★修正
    goToWordMenu();
}

function confirmWordClear() {
    if (hasLessonRole('teacher', 'admin')) {
        processWordClear();
        return;
    }

    showCustomAlert('先生または管理者アカウントでログインして確認してください。');
}

function processWordClear() {
    if (!canWriteCurrentUserRow()) {
        showCustomAlert('先生確認モードでは、Wordのクリア結果は保存されません。管理者アカウントで操作してください。');
        return;
    }

    const u = users[currentUser];
    if (!u.wordProgress) u.wordProgress = {};
    
    let prog = u.wordProgress[currentWordStageId];
    let isFirstClear = !(prog === 'cleared' || (typeof prog === 'object' && prog.status === 'cleared'));
    let pageVal = document.getElementById('word-page-input').value;

    u.wordProgress[currentWordStageId] = { status: 'cleared', page: pageVal };
    
    let coinGain = isFirstClear ? 500 : 50; 
    u.coins = (u.coins || 0) + coinGain;
    recordPracticeActivity({
        category: 'word',
        title: getCurrentWordStageLabel(),
        detail: isFirstClear ? 'クリア' : 'クリア再確認',
        amount: pageVal ? `${pageVal}ページまで` : 'ページ未入力',
        coins: coinGain
    });
    
    saveUsers(false);
    SoundManager.playClear(); createConfetti();
    
    // リザルト画面を借用して表示
    document.getElementById('feedback-text').innerText = "Word マスター！";
    document.getElementById('feedback-time').innerHTML = `<span style="font-size:30px; color:#FFD700;">💰 +${coinGain} コインゲット！</span>`;
    document.getElementById('feedback-time').style.display = 'block';
    document.getElementById('feedback-stats').style.display = 'none';
    document.getElementById('feedback-overlay').style.display = 'flex';
    
    setTimeout(() => {
        document.getElementById('feedback-overlay').style.display = 'none';
        goToWordMenu();
    }, 4000);
}

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
