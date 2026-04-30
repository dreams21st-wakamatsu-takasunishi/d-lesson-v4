import './style.css';

import {
  GRADE_ORDER,
  VISION_STAGES,
  KANA_MAP,
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
  ROMAJI_TABLE_DATA,
  THEMES,
  EFFECTS
} from './data/constants.js';

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
  setCurrentSelectedGrade
} from './api/user.js';

import * as Admin from './ui/admin.js';

import { showCustomAlert, showCustomConfirm } from './ui/modal.js';
import { createBtn } from './utils/dom.js';
import { verifyLegacyAdminPass } from './utils/security.js';

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
changeEffect
} from './games/gacha.js'

import {
    startVisionGame,
    showVisionCompare,
    renderVisionDashboardTable,
    renderVisionMenu
} from './games/vision.js';

import {
  startGame,
  backToMenu,
  retryExam,
  startRecommendedStage
} from './games/core.js';
/* =========================================================
   [JS] 1. 効果音管理 (Sound) ＆ システム制御 ＆ 音声読み上げ
   ========================================================= */

window.addEventListener('DOMContentLoaded', () => {

    loadUsers();

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

let GACHA_ITEMS =[ { id: 'coin_50', type: 'coin', name: '💰 50コイン', rate: 0.40 } ];
let itemRate = 0.60 / ((THEMES.length - 1) + (EFFECTS.length - 1)); 
THEMES.forEach(t => { if(t.id !== 'default') GACHA_ITEMS.push({ id: 'theme_' + t.id, type: 'theme', name: `${t.icon} テーマ：${t.name}`, rate: itemRate }); });
EFFECTS.forEach(e => { if(e.id !== 'default') GACHA_ITEMS.push({ id: e.id, type: 'effect', name: `${e.icon} 演出：${e.name}`, rate: itemRate }); });

function convertNameToRomaji(name) {
    if (!name) return 'NAME';
    let hira = name.replace(/[\u30a1-\u30f6]/g, match => String.fromCharCode(match.charCodeAt(0) - 0x60));
    let romaji = '';
    for (let i = 0; i < hira.length; i++) {
        let char2 = hira.substring(i, i+2);
        let char1 = hira.substring(i, i+1);
        let nextChar = i + 1 < hira.length ? hira.substring(i+1, i+2) : '';

        if (char1 === ' ' || char1 === '　') {
            romaji += ' ';
        } else if (char1 === 'ん') {
            const requireNN =['あ','い','う','え','お','な','に','ぬ','ね','の','や','ゆ','よ'].includes(nextChar) || nextChar === '';
            romaji += requireNN ? 'NN' : 'N';
        } else if (KANA_MAP[char2]) {
            romaji += KANA_MAP[char2];
            i++;
        } else if (char1 === 'っ' && nextChar) {
            let next2 = hira.substring(i+1, i+3);
            let next1 = hira.substring(i+1, i+2);
            let nextRomaji = KANA_MAP[next2] || KANA_MAP[next1];
            if (nextRomaji && /[A-Z]/.test(nextRomaji[0]) && !/^[AEIOU]/.test(nextRomaji[0])) {
                romaji += nextRomaji[0]; 
            } else {
                romaji += 'LTU';
            }
        } else if (KANA_MAP[char1]) {
            romaji += KANA_MAP[char1];
        } else {
            romaji += char1.toUpperCase();
        }
    }
    return romaji || 'NAME';
}

// ----------------------------------------------------
// 【修正版】ダッシュボード描画関数群（エラー回避対応済）
// ----------------------------------------------------
function switchDashTab(tab) {
    if(tab === 'basic') {
        document.getElementById('dash-basic').style.display = 'block';
        document.getElementById('dash-vision').style.display = 'none';
        document.getElementById('tab-btn-basic').style.background = '#2196F3';
        document.getElementById('tab-btn-vision').style.background = '#9e9e9e';
        renderDashboardTable();
    } else {
        document.getElementById('dash-basic').style.display = 'none';
        document.getElementById('dash-vision').style.display = 'block';
        document.getElementById('tab-btn-basic').style.background = '#9e9e9e';
        document.getElementById('tab-btn-vision').style.background = '#9C27B0';
        renderVisionDashboardTable();
    }
}

function updateAdminUserTable() {
    const tbody = document.getElementById('admin-user-tbody'); tbody.innerHTML = '';
    let list = Object.keys(users).filter(n => !users[n].isMaster && n !== '__GLOBAL_SETTINGS__').map(n => ({ name: n, user: users[n] }));
    list.sort((a,b) => a.name.localeCompare(b.name, 'ja'));
    list.forEach(item => {
        let uBirth = item.user.birthdate || item.user.birth;
        let dispGrade = (item.user.grade && String(item.user.grade) !== 'undefined') ? item.user.grade : calculateGrade(uBirth);
        
        let tr = document.createElement('tr');
        tr.innerHTML = `
            <td style="padding:5px; border:1px solid #ddd;"><input type="radio" name="asel" class="admin-user-check" value="${item.name}"></td>
            <td style="padding:5px; border:1px solid #ddd; font-weight:bold;">${item.name}</td>
            <td style="padding:5px; border:1px solid #ddd;">${dispGrade}</td>
            <td style="padding:5px; border:1px solid #ddd;"><input type="text" value="${item.user.group || ''}" onchange="updateUserGroup('${item.name}', this.value)" style="width:80px; padding:2px; font-size:12px; border:1px solid #ccc;"></td>
            <td style="padding:5px; border:1px solid #ddd;">Lv.${item.user.mouseLevel || 1}</td>
            <td style="padding:5px; border:1px solid #ddd;">${item.user.keyboardSequence || 0}/${STAGE_ORDER.length}</td>
        `;
        tbody.appendChild(tr);
    });
}

function updateUserGroup(name, newGroup) {
    if(users[name]) { 
        users[name].group = newGroup.trim(); 
        saveUsers(false); 
        renderDashboardTable(); 
    }
}

function renderDashboardTable() {
    try {
        const tbody = document.getElementById('dash-tbody');
        const gradeSelect = document.getElementById('dash-filter-grade');
        const grpSelect = document.getElementById('dash-filter-group'); 
        const sortSelect = document.getElementById('dash-sort');
        if(!tbody || !gradeSelect || !grpSelect || !sortSelect) return;

        const fGrade = gradeSelect.value || 'all';
        const fGroup = grpSelect.value || 'all';
        const sortVal = sortSelect.value || 'name';

        let existingGrades = new Set();
        let groups = new Set();
        let list =[];
        let isDataFixed = false;

        Object.keys(users).forEach(n => { 
            if(!users[n] || users[n].isMaster || n === '__GLOBAL_SETTINGS__') return;
            
            let uBirth = users[n].birthdate || users[n].birth;
            let uGrade = users[n].grade;
            if (!uGrade || String(uGrade) === 'undefined') {
                uGrade = calculateGrade(uBirth);
                users[n].grade = uGrade; 
                users[n].birthdate = uBirth; 
                isDataFixed = true;
            }

            existingGrades.add(uGrade);
            if(users[n].group) groups.add(users[n].group);

            if (fGrade !== 'all' && uGrade !== fGrade) return;
            if (fGroup !== 'all' && (users[n].group || '') !== fGroup) return; 
            
            list.push({ name: n, user: users[n] });
        });

        if (isDataFixed) saveUsers(false); 

        gradeSelect.innerHTML = '<option value="all">すべての学年</option>';
        sortGrades(Array.from(existingGrades)).forEach(g => {
            let opt = document.createElement('option'); opt.value = g; opt.innerText = g;
            if(g === fGrade) opt.selected = true;
            gradeSelect.appendChild(opt);
        });

        grpSelect.innerHTML = '<option value="all">すべてのグループ</option>';
        Array.from(groups).sort().forEach(g => {
            let opt = document.createElement('option'); opt.value = g; opt.innerText = g;
            if(g === fGroup) opt.selected = true;
            grpSelect.appendChild(opt);
        });

        if (sortVal === 'name') list.sort((a,b) => a.name.localeCompare(b.name, 'ja'));
        else if (sortVal === 'mouse_desc') list.sort((a,b) => (b.user.mouseLevel || 0) - (a.user.mouseLevel || 0));
        else if (sortVal === 'kb_desc') list.sort((a,b) => (b.user.keyboardSequence || 0) - (a.user.keyboardSequence || 0));

        tbody.innerHTML = '';
        list.forEach(item => {
            let tr = document.createElement('tr');
            
            let tdName = document.createElement('td'); 
            tdName.style.cssText = 'border:1px solid #ccc; padding:8px; font-weight:bold;'; 
            let grpBadge = item.user.group ? `<span style="font-size:12px; color:#666; background:#e0e0e0; padding:2px 6px; border-radius:10px; margin-left:8px;">${item.user.group}</span>` : '';
            tdName.innerHTML = item.name + grpBadge; 
            tr.appendChild(tdName);

            let tdGrade = document.createElement('td'); 
            tdGrade.style.cssText = 'border:1px solid #ccc; padding:8px;'; 
            tdGrade.innerText = item.user.grade; 
            tr.appendChild(tdGrade);

            let tdMouse = document.createElement('td'); 
            tdMouse.style.cssText = 'border:1px solid #ccc; padding:8px;';
            let mouseLevel = item.user.mouseLevel || 0;
            let mousePct = Math.floor((mouseLevel / 7) * 100);
            tdMouse.innerHTML = `<div style="width:100%; background:#eee; border-radius:5px;"><div style="width:${mousePct}%; background:#2196F3; color:#fff; text-align:center; font-size:12px; border-radius:5px;">${mousePct}%</div></div>`; 
            tr.appendChild(tdMouse);

            let tdKb = document.createElement('td'); 
            tdKb.style.cssText = 'border:1px solid #ccc; padding:8px;';
            let kbSeq = item.user.keyboardSequence || 0;
            let kbPct = Math.floor((kbSeq / STAGE_ORDER.length) * 100);
            tdKb.innerHTML = `<div style="width:100%; background:#eee; border-radius:5px;"><div style="width:${kbPct}%; background:#FF9800; color:#fff; text-align:center; font-size:12px; border-radius:5px;">${kbPct}%</div></div>`; 
            tr.appendChild(tdKb);

            tbody.appendChild(tr);
        });
    } catch(e) { console.error(e); }
}

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
    if (!u.examRecords) u.examRecords = {}; 

    if (currentMinigameType === 'd_challenge') {
        let prev = u.examRecords['mg_d_challenge'] || u.dChallengeHighscore || 0;
        if (mgScore > prev) { u.examRecords['mg_d_challenge'] = mgScore; u.dChallengeHighscore = mgScore; isNewRecord = true; saveUsers(false); }
    } else {
        let prev = u.examRecords['mg_meteor'] || u.minigameHighscore || 0;
        if (mgScore > prev) { u.examRecords['mg_meteor'] = mgScore; u.minigameHighscore = mgScore; isNewRecord = true; saveUsers(false); }
    }
    
    let rankHtml = `<h3 style="margin-top:0; color:#E91E63; border-bottom:2px solid #E91E63;">👑 トップ5 👑</h3><ul style="list-style:none; padding:0; font-size:20px; text-align:left; color:#333;">`;
    let ranking =[]; 
    Object.keys(users).forEach(n => { 
        if (!users[n].isMaster && n !== '__GLOBAL_SETTINGS__') {
            let s = currentMinigameType === 'd_challenge' ? (users[n].examRecords?.['mg_d_challenge'] || users[n].dChallengeHighscore || 0) : (users[n].examRecords?.['mg_meteor'] || users[n].minigameHighscore || 0);
            if (s > 0) ranking.push({ name: n, score: s }); 
        }
    }); 
    ranking.sort((a, b) => b.score - a.score);
    
    let displayRank = ranking.slice(0, 5); 
    displayRank.forEach((r, i) => { 
        let medal =['🥇', '🥈', '🥉', '４.', '５.'][i]; 
        let isMe = (r.name === currentUser) ? 'background:#fff9c4; font-weight:bold; border-radius:5px;' : ''; 
        rankHtml += `<li style="padding:5px; margin-bottom:5px; ${isMe}">${medal} ${r.name} : ${r.score} 点</li>`; 
    });
    rankHtml += `</ul>`; 
    
    let myRankIdx = ranking.findIndex(r => r.name === currentUser);
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
window.handleSecretMenuClick = () => { 
    if(isProcessing)return; 
    isProcessing=true; 
    SoundManager.playSuccess(); 
    els.ctxMenu.style.display='none'; 
    els.playArea.oncontextmenu = null; 
    completeTask(300); 
};


function shuffle(arr) { for (let i=arr.length-1; i>0; i--) { const j=Math.floor(Math.random()*(i+1));[arr[i],arr[j]]=[arr[j],arr[i]]; } for (let i=1; i<arr.length; i++) { let a=arr[i], b=arr[i-1], va=(a.key||a.h||a), vb=(b.key||b.h||b); if (va===vb) { for (let j=i+1; j<arr.length; j++) { let vc=(arr[j].key||arr[j].h||arr[j]); if (vc!==va) {[arr[i],arr[j]]=[arr[j],arr[i]]; break; } } } } return arr; }

/* =========================================================
   [JS] 9. UI・画面遷移 ＆ ガチャ・きせかえ管理
   ========================================================= */
let currentKeyboardCategory = 'basic';

function showCapsuleAnimation(isRare, callback) {
    const overlay = document.getElementById('capsule-overlay');
    const cap = document.getElementById('gacha-capsule');
    cap.innerText = isRare ? '🔮' : '💊';
    overlay.style.display = 'flex';
    cap.style.animation = 'none'; void cap.offsetWidth; // リセット
    cap.style.animation = 'capsuleDrop 1s cubic-bezier(0.25, 1, 0.5, 1) forwards';
    SoundManager.playGachaDrop();
    
    setTimeout(() => {
        cap.style.animation = 'capsuleBurst 0.5s ease-out forwards';
        SoundManager.playGachaBurst();
        setTimeout(() => { overlay.style.display = 'none'; callback(); }, 500);
    }, 1200);
}

function goToMouseMenu() { updateMouseButtons(); showScreen('screen-mouse-menu'); }
function goToKeyboardCategory() { showScreen('screen-keyboard-category'); }

let currentKeyboardChapter = null;
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
    
    currentKeyboardChapter = null;
    renderKeyboardChapters(); 
    showScreen('screen-keyboard-menu'); 
}

function goToMinigameMenu() {
    showScreen('screen-minigame-menu');
}

function goToRecords() { renderRecords(); showScreen('screen-records'); }
function goToVisionMenu() { renderVisionMenu(); showScreen('screen-vision-menu'); }

function loginAsMaster() {
    showPasswordModal('先生用パスワード', (pass) => {
        if(verifyLegacyAdminPass(pass)) {
            if (!users['Master_Debug']) {
                users['Master_Debug'] = { mouseLevel:7, keyboardSequence:999, examRecords:{}, textRecords:{}, globalMistakes:{}, theme:'default', birthdate:'', isMaster:true };
            }
            document.getElementById('screen-title').classList.remove('active');
            login('Master_Debug');
        } else {
            alert('パスワードが違います');
        }
    });
}

function goToWeakTraining() {
    const mistakes = users[currentUser].globalMistakes || {};
    const hasMistakes = Object.values(mistakes).some(count => count > 0);
    if (hasMistakes) {
        startGame(9888, 'keyboard');
    } else {
        showCustomAlert('ミスのデータがないか、すべて克服しました！\nいろいろな練習をしてからまた挑戦してみてね！'); // ★修正
    }
}

function updateMouseButtons() {
    const l = users[currentUser].mouseLevel; document.getElementById('master-badge').style.display = (l >= 7) ? 'block' : 'none';
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

function updateKeyboardButtons() {
    renderKeyboardChapters();
}

function renderKeyboardChapters() {
    const seq = users[currentUser].keyboardSequence; 
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

function renderKeyboardStages(chap) {
    currentKeyboardChapter = chap; // ★追加

    document.getElementById('kb-chapter-container').style.display = 'none';
    document.getElementById('kb-stage-container').style.display = 'flex';
    document.getElementById('kb-bottom-back-btn').style.display = 'none';
    document.getElementById('kb-stage-title').innerText = chap.title;
    
    const seq = users[currentUser].keyboardSequence; 
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

function renderRecords() {
    backToRecordMenu();
    const u = users[currentUser];
    if(!u) return;

    const gCont = document.getElementById('rec-gacha'); gCont.innerHTML = '';
    gCont.innerHTML = `<div class="gacha-section">
        <div class="coin-display">💰 コイン: ${u.coins || 0} 枚</div>
        <p style="margin: 5px 0 15px 0;">ガチャをひいて アイテムをゲットしよう！</p>
        <div style="display:flex; justify-content:center; gap:15px; flex-wrap:wrap;">
            <button class="btn-gacha" style="padding: 10px 20px; font-size: 20px;" onclick="drawGacha(1)">1回 (100)</button>
            <button class="btn-gacha" style="padding: 10px 20px; font-size: 20px; background:linear-gradient(135deg, #4CAF50, #8BC34A);" onclick="drawGacha(10)">10回 (1000)</button>
            <button class="btn-gacha" style="padding: 10px 20px; font-size: 20px; background:linear-gradient(135deg, #E91E63, #9C27B0);" onclick="drawGacha(1, true)">🔮 レア確定 (500)</button>
        </div>
    </div>`;
    if (u.tickets && u.tickets.length > 0) {
        gCont.innerHTML += `<h3 style="color:#FF5722;">🎟️ もっている ひきかえけん</h3>`;
        u.tickets.forEach((t, idx) => {
            gCont.innerHTML += `<div class="ticket-card"><div><div class="ticket-name">${t.name}</div><div style="font-size:12px; color:#555;">ゲットした日: ${t.date}</div></div><button class="ticket-btn" onclick="useTicket(${idx})">先生につかってもらう</button></div>`;
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

// 修正後

export function updateGlobalHeader() {
    if (currentUser && users[currentUser]) {
        const coinDisplay = document.getElementById('global-coin-display');
        if (coinDisplay) coinDisplay.innerText = `💰 ${users[currentUser].coins || 0}`;
    }
}

export function updateHomeDashboard() {
    if (!currentUser || !users[currentUser]) return;
    const u = users[currentUser];
    
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

export function createConfetti() {
    const u = users[currentUser]; const effId = u ? (u.activeEffect || 'default') : 'default';
    const effectData = EFFECTS.find(e => e.id === effId) || EFFECTS[0];
    const isEmoji = effectData.emojis && effectData.emojis.length > 0;
    const particleCount = isEmoji ? 60 : 100;
    
    const colors =['#f44336', '#e91e63', '#9c27b0', '#673ab7', '#3f51b5', '#2196f3', '#03a9f4', '#00bcd4', '#009688', '#4caf50', '#8bc34a', '#cddc39', '#ffeb3b', '#ffc107', '#ff9800', '#ff5722'];

    for (let i = 0; i < particleCount; i++) {
        const c = document.createElement('div'); c.className = 'confetti'; c.style.left = Math.random() * 100 + 'vw';
        
        if (isEmoji) {
            c.innerText = effectData.emojis[Math.floor(Math.random() * effectData.emojis.length)]; 
            c.style.fontSize = (Math.random() * 25 + 20) + 'px'; 
            c.style.background = 'transparent'; c.style.boxShadow = 'none'; c.style.clipPath = 'none';
        } else { 
            c.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)]; 
            c.style.width = '15px'; c.style.height = '15px';
        }
        
        c.style.animationDuration = (Math.random() * 3 + 2) + 's'; 
        c.style.animationDelay = (Math.random() * 2) + 's';
        document.body.appendChild(c); setTimeout(() => c.remove(), 5000); 
    }
}

let rewardCloseCallback = null;
function showRewardOverlay(title, name, icon, callback) {
    SoundManager.playClear(); createConfetti();
    document.getElementById('reward-title').innerText = title; document.getElementById('reward-name').innerText = name; document.getElementById('reward-icon').innerText = icon;
    document.getElementById('reward-overlay').style.display = 'flex'; rewardCloseCallback = callback;
    setTimeout(() => { const btn = document.querySelector('#reward-overlay button'); if (btn) btn.focus(); }, 100);
}
function closeRewardOverlay() { SoundManager.playClick(); document.getElementById('reward-overlay').style.display = 'none'; if (rewardCloseCallback) { rewardCloseCallback(); rewardCloseCallback = null; } }

/* =========================================================
   [JS] 11. ビジョントレーニング
   ========================================================= */

/* =========================================================
   [JS] 12. ローマ字一覧表ステージ
   ========================================================= */

let romajiMode = ''; 
let romajiTotalCells = 0;
let romajiCorrectCells = 0;


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
    const glob = users['__GLOBAL_SETTINGS__'];
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
    const u = users[currentUser];
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

function suspendWordTask() {
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
    saveUsers(false);
    SoundManager.playClick();
    showCustomAlert('「挑戦中 ⏸️」として記録しました！\nデータを保存してWordをとじたら、また次回続きから頑張ろう！'); // ★修正
    goToWordMenu();
}

function confirmWordClear() {
    showPasswordModal('【先生確認】\n作品の出来を確認したら\nパスワードを入力:', (pass) => {
        if (verifyLegacyAdminPass(pass)) processWordClear();
        else if (pass !== null && pass !== '') alert('パスワードがちがいます');
    });
}

function processWordClear() {
    const u = users[currentUser];
    if (!u.wordProgress) u.wordProgress = {};
    
    let prog = u.wordProgress[currentWordStageId];
    let isFirstClear = !(prog === 'cleared' || (typeof prog === 'object' && prog.status === 'cleared'));
    let pageVal = document.getElementById('word-page-input').value;

    u.wordProgress[currentWordStageId] = { status: 'cleared', page: pageVal };
    
    let coinGain = isFirstClear ? 500 : 50; 
    u.coins = (u.coins || 0) + coinGain;
    
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
    showRecordSection, backToRecordMenu, exportDashboardCSV, startRecommendedStage,

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
