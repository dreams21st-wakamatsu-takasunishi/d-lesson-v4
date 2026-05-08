import {
    users,
    currentUser,
    saveUsers,
    getUserDisplayName,
    isSystemUserId,
    canWriteCurrentUserRow,
    recordPracticeActivity
} from '../api/user.js';
import { WORD_DATA } from '../data/constants.js';
import { SoundManager } from '../utils/sound.js';
import { showScreen, showImeWarning } from '../ui/screen.js';
import { createConfetti } from '../ui/reward.js';

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

export function startMinigame(type) {
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

export function stopMinigame() {
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
