import { users, currentUser, saveUsers, GLOBAL_SETTINGS_ID, getUserDisplayName, canWriteCurrentUserRow, recordPracticeActivity } from '../api/user.js';

import {
  ALPHABET_READING_STAGES,
  ALPHABET_READING_NAMES,
  KEYBOARD_STAGES,
  VISION_STAGES,
  BLIND_STAGES,
  BRIDGE_STAGES,
  HIRAGANA_DATA,
  WORD_DATA,
  EXAMS,
  STAGE_ORDER,
  KB_CHAPTERS,
  KB_LAYOUT,
  FINGER_MAP,
  FINGER_HOME_MAP,
  COLOR_CLASS_MAP,
  ADVICE_HINT_MAP,
  KANA_MAP,
  ROMAJI_TABLE_DATA
} from '../data/constants.js';

import { SoundManager } from '../utils/sound.js';
import { showScreen, showImeWarning } from '../ui/screen.js';
import { showCustomAlert, showCustomConfirm } from '../ui/modal.js';
import { getStageName } from '../utils/stages.js';
import { convertNameToRomaji, shuffle } from '../utils/helpers.js';
import { getTrainableMistakeEntries, getValidMistakeEntries, hasTrainableMistakes, normalizeMistakeCount } from '../utils/weak-mistakes.js';
import { createConfetti, showRewardOverlay } from '../ui/reward.js';
import { getCurrentKeyboardChapter } from '../ui/keyboard-state.js';
import { renderRecords, showRecordSection } from '../ui/records.js';
import { getNextIncompleteDailyMission, markDailyMissionComplete } from '../ui/daily-missions.js';
import { startVisionGame, renderVisionMenu, openVisionDifficultyForStage } from './vision.js';
export { getStageName } from '../utils/stages.js';

let gameMode, currentStage, isProcessing = false;
let mainQueue =[], currentCount = 0, totalCount = 1;
let totalKeysTyped = 0, missKeysTyped = 0, targetKey = '', isHomeReturn = false, pendingHome = null;
let isHiragana = false, isWord = false, currHiraObj = null, activeRomajiList =[], currRomajiIdx = 0;
let isExam = false, mistakeCount = 0, maxMistakes = 3, mistakeStats = {}, hasMissLimit = false;
let isAlphabetReading = false;
let timerInterval = null, startTime = 0, isTimeAttackMode = false;
let cancelStartHandler = null; 
let typedRomajiStr = "";
let romajiMode = '';
let romajiTotalCells = 0;
let romajiCorrectCells = 0;
let isClearProcessing = false;
let pendingCertificateAward = null;
let pendingDailyMissionTask = null;
let isMissionPracticeActive = false;

export let visionScore = 0;
export let visionTarget = 0;
export let visionInterval = null;
export let visionTimeout = null;
export let isVisionHardMode = false;
export let isVisionEasyMode = false;

export function getProcessing() { return isProcessing; }
export function setProcessing(value) { isProcessing = value; }
export function getCurrentCount() { return currentCount; }
export function setCurrentCount(value) { currentCount = value; }
export function addCurrentCount(value = 1) { currentCount += value; }
export function getTotalCount() { return totalCount; }
export function setTotalCount(value) { totalCount = value; }
export function getVisionScore() { return visionScore; }
export function setVisionScore(value) { visionScore = value; }
export function addVisionScore(value = 1) { visionScore += value; }
export function getVisionTarget() { return visionTarget; }
export function setVisionTarget(value) { visionTarget = value; }
export function addVisionTarget(value = 1) { visionTarget += value; }
export function getVisionInterval() { return visionInterval; }
export function setVisionInterval(value) { visionInterval = value; }
export function getVisionTimeout() { return visionTimeout; }
export function setVisionTimeout(value) { visionTimeout = value; }
export function getVisionHardMode() { return isVisionHardMode; }
export function getVisionEasyMode() { return isVisionEasyMode; }

const menuRefreshHandlers = {
    updateMouseButtons: () => {},
    updateKeyboardButtons: () => {},
    renderKeyboardStages: () => {}
};

export function setMenuRefreshHandlers(handlers = {}) {
    if (typeof handlers.updateMouseButtons === 'function') {
        menuRefreshHandlers.updateMouseButtons = handlers.updateMouseButtons;
    }
    if (typeof handlers.updateKeyboardButtons === 'function') {
        menuRefreshHandlers.updateKeyboardButtons = handlers.updateKeyboardButtons;
    }
    if (typeof handlers.renderKeyboardStages === 'function') {
        menuRefreshHandlers.renderKeyboardStages = handlers.renderKeyboardStages;
    }
}

export const els = {
    playArea: document.getElementById('play-area'), 
    instText: document.getElementById('inst-text'),
    missCounter: document.getElementById('mistake-counter'), 
    progressFill: document.getElementById('progress-bar-fill'),
    progressText: document.getElementById('progress-text'), 
    timerDisplay: document.getElementById('timer-display'), 
    fbOverlay: document.getElementById('feedback-overlay'), 
    fbText: document.getElementById('feedback-text'),
    fbTime: document.getElementById('feedback-time'), 
    fbActions: document.getElementById('feedback-actions'),
    failOverlay: document.getElementById('fail-overlay'),
    advice: document.getElementById('fail-advice'), 
    ctxMenu: document.getElementById('fake-context-menu'),
    startOverlay: document.getElementById('start-overlay')
};

function getPracticeTitle() {
    if (gameMode === 'mouse') return `マウス練習 M-${currentStage}`;
    if (isAlphabetReading) {
        const stage = ALPHABET_READING_STAGES.find(st => st.id === currentStage);
        return `ABCをおぼえる ${stage ? stage.title : currentStage}`;
    }
    if (gameMode === 'vision') {
        const stageId = String(currentStage).replace('_hard', '').replace('_easy', '');
        const stage = VISION_STAGES.find(st => st.id === stageId);
        const level = isVisionHardMode ? 'ハード' : (isVisionEasyMode ? 'やさしい' : '通常');
        return `ビジョントレーニング ${stage ? stage.title : stageId} (${level})`;
    }
    if (gameMode === 'romaji') {
        const baseId = String(currentStage).replace('_exam', '').replace('_prac', '');
        const modeText = romajiMode === 'exam' ? 'テスト' : '練習';
        return `ローマ字表 ${baseId} (${modeText})`;
    }
    return `キーボード ${getStageName(currentStage).replace(/\[ID:[^\]]+\]\s*/, '')}`;
}

function getPracticeAmount(elapsed) {
    if (gameMode === 'mouse') return 'ステージをクリア';
    if (gameMode === 'vision') return `タイム ${elapsed.toFixed(1)}秒`;
    if (gameMode === 'romaji') return `正解 ${romajiCorrectCells}/${romajiTotalCells} / タイム ${elapsed.toFixed(1)}秒`;
    const total = totalKeysTyped + missKeysTyped;
    const acc = total > 0 ? Math.floor((totalKeysTyped / total) * 100) : 0;
    return `打鍵 ${totalKeysTyped}回 / ミス ${missKeysTyped}回 / 正確率 ${acc}%`;
}

function clearFeedbackActions() {
    const actions = els.fbActions || document.getElementById('feedback-actions');
    if (!actions) return;
    actions.innerHTML = '';
    actions.style.display = 'none';
}

export function startDailyMissionPractice(task) {
    if (!task) return;
    els.fbOverlay.style.display = 'none';
    clearFeedbackActions();
    pendingDailyMissionTask = null;

    if (task.type === 'mouse') {
        startGame(Number(task.stage), 'mouse', { fromMission: true });
        return;
    }

    if (task.type === 'keyboard') {
        showScreen('screen-keyboard-menu');
        startGame(Number(task.stage), 'keyboard', { fromMission: true });
        return;
    }

    if (task.type === 'vision') {
        startGame(String(task.stage), 'vision', { fromMission: true });
    }
}

function getNextStageAfterClear() {
    if (gameMode === 'mouse') {
        const nextStage = Number(currentStage || 0) + 1;
        if (nextStage <= 7) {
            return {
                label: 'つぎのステージへすすむ',
                detail: `M-${nextStage}`,
                run: () => startGame(nextStage, 'mouse')
            };
        }
        return null;
    }

    if (gameMode === 'keyboard' && currentStage !== 9888) {
        if (isAlphabetReading) {
            const idx = ALPHABET_READING_STAGES.findIndex(stage => stage.id === currentStage);
            const nextStage = idx !== -1 ? ALPHABET_READING_STAGES[idx + 1] : null;
            if (nextStage) {
                return {
                    label: 'つぎのステージへすすむ',
                    detail: nextStage.title,
                    run: () => startGame(nextStage.id, 'keyboard')
                };
            }
            return null;
        }

        const idx = STAGE_ORDER.indexOf(currentStage);
        const nextStage = idx !== -1 ? STAGE_ORDER[idx + 1] : null;
        if (nextStage) {
            return {
                label: 'つぎのステージへすすむ',
                detail: getStageName(nextStage).replace(/\[ID:[^\]]+\]\s*/, ''),
                run: () => startGame(nextStage, 'keyboard')
            };
        }
        return null;
    }

    if (gameMode === 'vision') {
        const stageKey = String(currentStage || '');
        const baseId = stageKey.replace('_hard', '').replace('_easy', '');
        const stage = VISION_STAGES.find(item => item.id === baseId);
        if (stage) {
            return {
                label: 'ほかのむずかしさにちょうせんする',
                detail: stage.title,
                run: () => {
                    els.fbOverlay.style.display = 'none';
                    clearFeedbackActions();
                    if (!openVisionDifficultyForStage(baseId)) {
                        renderVisionMenu();
                        showScreen('screen-vision-menu');
                    }
                }
            };
        }
    }

    return null;
}

function renderFeedbackActions() {
    const actions = els.fbActions || document.getElementById('feedback-actions');
    if (!actions) return;
    actions.innerHTML = '';

    if (pendingCertificateAward) {
        const certificateButton = document.createElement('button');
        certificateButton.className = 'btn-primary feedback-certificate-button';
        certificateButton.type = 'button';
        certificateButton.innerHTML = `賞状ゲットを見る<small>${pendingCertificateAward.title}</small>`;
        certificateButton.onclick = () => showCertificateAwardOverlay(pendingCertificateAward);
        actions.appendChild(certificateButton);
    }

    if (pendingDailyMissionTask) {
        const missionButton = document.createElement('button');
        missionButton.className = 'btn-primary feedback-mission-button';
        missionButton.type = 'button';
        missionButton.innerHTML = `つぎのミッションへすすむ<small>${pendingDailyMissionTask.title}</small>`;
        missionButton.onclick = () => showCustomConfirm(
            `つぎのミッション「${pendingDailyMissionTask.title}」に取り組みますか？`,
            () => startDailyMissionPractice(pendingDailyMissionTask)
        );
        actions.appendChild(missionButton);
    }

    const nextStage = isMissionPracticeActive ? null : getNextStageAfterClear();
    if (nextStage) {
        const nextButton = document.createElement('button');
        nextButton.className = 'btn-primary feedback-next-button';
        nextButton.type = 'button';
        nextButton.innerHTML = `${nextStage.label}<small>${nextStage.detail}</small>`;
        nextButton.onclick = nextStage.run;
        actions.appendChild(nextButton);
    }

    const menuButton = document.createElement('button');
    menuButton.className = 'btn-secondary feedback-menu-button';
    menuButton.type = 'button';
    menuButton.textContent = 'メニューへもどる';
    menuButton.onclick = () => backToMenu();
    actions.appendChild(menuButton);
    actions.style.display = 'flex';
}

function openCertificateSectionFromFeedback() {
    els.fbOverlay.style.display = 'none';
    clearFeedbackActions();
    renderRecords();
    showScreen('screen-records');
    requestAnimationFrame(() => showRecordSection('rec-certificate'));
}

function showCertificateAwardOverlay(award) {
    els.fbOverlay.style.display = 'none';
    clearFeedbackActions();
    if (!award) {
        backToMenu();
        return;
    }
    showRewardOverlay('🏆 賞状ゲット！ 🏆', `${award.title}\n印刷画面へすすみます`, '📜', openCertificateSectionFromFeedback);
}

function getKeyboardCertificateAward(previousSequence, nextSequence) {
    const total = STAGE_ORDER.length;
    const awards = [
        { threshold: Math.ceil(total * 0.25), title: 'キーボード 努力賞' },
        { threshold: Math.ceil(total * 0.5), title: 'キーボード 上達賞' },
        { threshold: total, title: 'キーボード 達成賞' }
    ];
    return awards.find(award => previousSequence < award.threshold && nextSequence >= award.threshold) || null;
}

function getPracticeInterruptAmount(elapsed) {
    if (gameMode === 'mouse') return `進行 ${currentCount}/${totalCount}`;
    if (gameMode === 'vision') return `正解 ${visionScore}/${visionTarget} / 経過 ${elapsed.toFixed(1)}秒`;
    if (gameMode === 'romaji') return `正解 ${romajiCorrectCells}/${romajiTotalCells} / 経過 ${elapsed.toFixed(1)}秒`;
    return getPracticeAmount(elapsed);
}

function isOverlayVisible(element) {
    return element && element.style.display !== 'none' && element.style.display !== '';
}

function recordPracticeInterrupt(shouldRecord) {
    if (!shouldRecord || !currentStage || !gameMode || !startTime || !canWriteCurrentUserRow()) return;
    if (isOverlayVisible(els.fbOverlay) || isOverlayVisible(els.failOverlay)) return;
    const elapsed = Math.max(0, (Date.now() - startTime) / 1000);
    const hasActivity = elapsed >= 1
        || currentCount > 0
        || totalKeysTyped + missKeysTyped > 0
        || visionScore > 0
        || romajiCorrectCells > 0;
    if (!hasActivity) return;
    recordPracticeActivity({
        category: gameMode || 'practice',
        title: getPracticeTitle(),
        detail: '中断',
        amount: getPracticeInterruptAmount(elapsed),
        coins: 0
    });
    saveUsers(false);
}

export function startGame(sid, mode, options = {}) {
    if (mode === 'keyboard' && sid === 9888 && !hasTrainableMistakes(users[currentUser]?.globalMistakes)) {
        showCustomAlert('ミスのデータがないか、すべて克服しました！\nいろいろな練習をしてからまた挑戦してみてね！');
        showScreen('screen-keyboard-category');
        return;
    }

    SoundManager.init(); currentStage = sid; gameMode = mode; isProcessing = false;
    isClearProcessing = false;
    pendingCertificateAward = null;
    pendingDailyMissionTask = null;
    isMissionPracticeActive = options.fromMission === true;
    mainQueue =[]; currentCount = 0; totalCount = 1; pendingHome = null; isHomeReturn = false;
    mistakeCount = 0; mistakeStats = {}; currRomajiIdx = 0; activeRomajiList =[]; currHiraObj = null; totalKeysTyped = 0; missKeysTyped = 0;
    typedRomajiStr = ""; 
    startTime = 0;
    
    isExam = EXAMS.some(ex => ex.id === sid) || [2101, 2102, 2103, 2104].includes(sid) || (sid >= 3200 && sid < 3300);
    isAlphabetReading = mode === 'keyboard' && sid >= 9000 && sid < 9100;
    isHiragana = (sid >= 3000 && sid < 4000) || sid === 9888;
    isWord = (sid >= 4000 && sid < 5000);
    hasMissLimit = isExam;
    
    if (hasMissLimit) maxMistakes = ((sid >= 2100 && sid < 2200) || (sid >= 3200 && sid <= 3300) || isHiragana) ? 5 : 3;

    let alreadyCleared = false;
    if (mode === 'keyboard' && sid !== 9888) {
        const idx = STAGE_ORDER.indexOf(sid);
        alreadyCleared = (idx !== -1 && users[currentUser].keyboardSequence > idx);
    }
    isTimeAttackMode = isExam && alreadyCleared;

    if (document.activeElement) document.activeElement.blur();
    els.playArea.innerHTML = ''; els.fbOverlay.style.display = 'none'; els.fbTime.style.display = 'none'; els.failOverlay.style.display = 'none'; els.ctxMenu.style.display = 'none';
    els.playArea.style.display = 'flex';
    els.playArea.style.justifyContent = 'center';
    els.playArea.style.alignItems = 'center';
    els.playArea.style.overflow = 'hidden';
    els.playArea.style.overflowY = 'hidden';
    els.fbOverlay.classList.remove('certificate-earned-feedback');
    clearFeedbackActions();
    els.playArea.classList.toggle('vision-play-area', mode === 'vision');
    let statDiv = document.getElementById('feedback-stats'); if(statDiv) statDiv.style.display = 'none';
    document.removeEventListener('keydown', handleKeyDown);

    if (hasMissLimit) { els.missCounter.style.display = 'inline-block'; els.missCounter.innerText = `ミス：0 / ${maxMistakes}`; els.missCounter.classList.remove('status-danger'); } 
    else { els.missCounter.style.display = 'none'; }
    
    if (timerInterval) clearInterval(timerInterval);
    if (visionInterval) clearInterval(visionInterval);
    if (visionTimeout) clearTimeout(visionTimeout);
    
    showScreen('screen-game');
    
    if (mode === 'mouse') { 
        setupMouse(sid); 
        document.getElementById('start-message').innerText = 'がめんを クリックして はじめるよ！'; 
        document.oncontextmenu = (e) => { e.preventDefault(); }; 
    } 
    else if (mode === 'vision') { 
        isVisionHardMode = String(sid).endsWith('_hard');
        isVisionEasyMode = String(sid).endsWith('_easy'); 
        let baseSid = String(sid).replace('_hard', '').replace('_easy', ''); 
        setupVision(baseSid); 
        document.getElementById('start-message').innerText = 'がめんを クリックして はじめるよ！'; 
        document.oncontextmenu = null;
    } 
    else if (mode === 'romaji') { 
        setupRomajiTable(sid); 
        document.getElementById('start-message').innerText = 'スペースキーをおして スタート！'; 
        document.oncontextmenu = null;
    }
    else { 
        setupKeyboard(sid); 
        document.getElementById('start-message').innerText = 'スペースキーをおして スタート！'; 
        document.oncontextmenu = null;
    }
    
    els.startOverlay.style.display = 'flex'; isProcessing = true; 
    if (cancelStartHandler) { document.removeEventListener('keydown', cancelStartHandler); els.startOverlay.removeEventListener('mousedown', cancelStartHandler); }

    const startHandler = (e) => {
        if (((mode === 'mouse' || mode === 'vision') && e.type === 'mousedown') || 
            ((mode === 'keyboard' || mode === 'romaji') && (e.type === 'mousedown' || e.key === ' ' || e.key === '　' || e.key === 'Enter'))) {
            
            e.preventDefault(); 
            document.removeEventListener('keydown', startHandler); 
            els.startOverlay.removeEventListener('mousedown', startHandler);
            cancelStartHandler = null; 
            els.startOverlay.style.display = 'none'; 
            isProcessing = false;
            
            if (gameMode === 'keyboard') document.addEventListener('keydown', handleKeyDown);
            
            startTime = Date.now(); 
            if (isTimeAttackMode || mode === 'vision' || mode === 'romaji') {
                els.timerDisplay.style.display = 'inline-block'; 
                els.timerDisplay.innerText = '0.0秒';
                timerInterval = setInterval(() => {
                    if (isProcessing && mainQueue.length === 0 && mode !== 'vision' && mode !== 'romaji') return; 
                    els.timerDisplay.innerText = ((Date.now() - startTime) / 1000).toFixed(1) + '秒';
                }, 100);
            } else { 
                els.timerDisplay.style.display = 'none'; 
            }
            
            if (mode === 'mouse') nextTask(); 
            else if (mode === 'vision') startVisionGame(String(sid).replace('_hard', '').replace('_easy', '')); 
            else if (mode === 'romaji') {
                const firstInp = document.querySelector('.romaji-input:not(:disabled)');
                if(firstInp) firstInp.focus();
            }
            else nextKeyQ();
        }
    };
    cancelStartHandler = startHandler; document.addEventListener('keydown', startHandler); els.startOverlay.addEventListener('mousedown', startHandler);
}

export function backToMenu(recordInterrupt = false) {
    try {
        recordPracticeInterrupt(recordInterrupt);
        if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
        if (visionInterval) { clearInterval(visionInterval); visionInterval = null; }
        if (visionTimeout) { clearTimeout(visionTimeout); visionTimeout = null; }
        
        if (cancelStartHandler) {
            document.removeEventListener('keydown', cancelStartHandler);
            const overlay = document.getElementById('start-overlay');
            if(overlay) overlay.removeEventListener('mousedown', cancelStartHandler);
            cancelStartHandler = null;
        }
        document.getElementById('start-overlay').style.display = 'none';
        document.getElementById('feedback-overlay').style.display = 'none';
        document.getElementById('fail-overlay').style.display = 'none';
        clearFeedbackActions();
        pendingDailyMissionTask = null;
        isMissionPracticeActive = false;

        document.removeEventListener('keydown', handleKeyDown);
        
        document.oncontextmenu = null; 
        els.playArea.oncontextmenu = null;
        els.playArea.onclick = null;
        els.playArea.onmousemove = null;
        els.playArea.onmouseup = null;
        els.playArea.onmouseleave = null;
        els.playArea.onwheel = null;
        
        isProcessing = false;
        
        if (gameMode === 'mouse') {
            menuRefreshHandlers.updateMouseButtons();
            showScreen('screen-mouse-menu');
        }
        else if (gameMode === 'vision') {
            renderVisionMenu();
            showScreen('screen-vision-menu');
        }
        else {
            menuRefreshHandlers.updateKeyboardButtons();
            // ★追加: もしステージ一覧を開いていたなら、最新の進捗で再描画する
            const currentKeyboardChapter = getCurrentKeyboardChapter();
            if (currentKeyboardChapter && document.getElementById('kb-stage-container').style.display === 'flex') {
                menuRefreshHandlers.renderKeyboardStages(currentKeyboardChapter);
            }
            showScreen('screen-keyboard-menu');
        }
    } catch(e) {
        console.error("backToMenuエラー:", e);
        showScreen('screen-category');
    }
}

export function retryExam() { startGame(currentStage, gameMode); }

function isTextInputQuestion() {
    return Boolean(currHiraObj) && (isHiragana || isWord || currentStage === 9888);
}

function speakAlphabetName(key) {
    const reading = ALPHABET_READING_NAMES[key] || key;
    if ('speechSynthesis' in window) {
        speechSynthesis.cancel();
        const speechText = key === 'O' ? 'オー。' : reading;
        const msg = new SpeechSynthesisUtterance(speechText);
        msg.lang = 'ja-JP';
        msg.rate = key === 'O' ? 0.65 : 0.85;
        speechSynthesis.speak(msg);
    }
    return reading;
}

function handleKeyDown(e) {
    if (typeof e.key !== 'string') return;
    if (isProcessing ||['Enter', 'Shift', 'Control', 'Alt', 'Meta', 'Tab', 'CapsLock', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) return;
    
    if (e.isComposing || e.key === 'Process' || e.key === 'Unidentified') {
        showImeWarning();
        return;
    }
    
    const textInputQuestion = isTextInputQuestion();
    
    if (e.key === 'Backspace') {
        if (textInputQuestion && currRomajiIdx > 0) {
            SoundManager.playHover();
            currRomajiIdx--;
            typedRomajiStr = typedRomajiStr.slice(0, -1);
            let baseList = Array.isArray(currHiraObj.r) ?[...currHiraObj.r] :[currHiraObj.r];
            activeRomajiList = baseList.filter(r => r.startsWith(typedRomajiStr));
            let nextChar = activeRomajiList[0].charAt(currRomajiIdx);
            targetKey = (nextChar === ' ') ? 'SPACE' : nextChar;
            if (!document.getElementById('keyboard-wrapper').classList.contains('blind-active')) updRomaji();
            updateVisuals();
        }
        return;
    }

    let k = e.key; if (k === 'Process' || k === 'Unidentified') return;
    const map = { '、': ',', '。': '.', '・': '/', 'ー': '-' }; if (map[k]) k = map[k];
    const upper = k.toUpperCase(); const chk = (k === ' ') ? ' ' : upper;
    const el = document.querySelector(`.key[data-key="${chk}"]`);
    if (el) { el.classList.add('pressed'); setTimeout(() => el.classList.remove('pressed'), 150); }

    let isCorrect = false;
    let inputChar = (k === ' ') ? ' ' : upper; 
    if (textInputQuestion) {
        const validPatterns = activeRomajiList.filter(r => r[currRomajiIdx] === inputChar);
        if (validPatterns.length > 0) { isCorrect = true; activeRomajiList = validPatterns; }
    } else { isCorrect = (targetKey === 'SPACE' ? k === ' ' : upper === targetKey); }

    if (isCorrect) {
        totalKeysTyped++; SoundManager.playType();
        if (users[currentUser]) users[currentUser].totalKeysTyped = (users[currentUser].totalKeysTyped || 0) + 1; 
        if (isAlphabetReading) {
            const reading = speakAlphabetName(targetKey);
            const hq = document.getElementById('romaji-hint');
            if (hq) hq.innerHTML = `<span class="alphabet-reading-result">${targetKey} は ${reading}</span>`;
        }
        if (isHomeReturn) { 
            mainQueue.shift(); currentCount++; updateProgress(); pendingHome = null; isProcessing = true; 
            setTimeout(() => { if (mainQueue.length === 0) markClear(); else nextKeyQ(); }, 200); return; 
        }
        if (textInputQuestion) {
            typedRomajiStr += inputChar; 
            currRomajiIdx++;
            if (activeRomajiList.some(r => currRomajiIdx >= r.length)) finishItemSuccess();
            else {
                let nextChar = activeRomajiList[0].charAt(currRomajiIdx);
                targetKey = (nextChar === ' ') ? 'SPACE' : nextChar;
                if (!document.getElementById('keyboard-wrapper').classList.contains('blind-active')) updRomaji();
                updateVisuals();
            }
        } else {
            if (currentStage < 1500 && !isExam && ![1051, 1052, 1053, 1054].includes(currentStage) && targetKey !== 'SPACE') {
                const f = FINGER_MAP[targetKey], h = FINGER_HOME_MAP[f];
                if (h && targetKey !== h) pendingHome = h;
            }
            finishItemSuccess();
        }
    } else {
        missKeysTyped++; SoundManager.playError(); if (el) { el.classList.add('error-flash'); setTimeout(() => el.classList.remove('error-flash'), 300); }
        if (gameMode === 'keyboard' && currentStage !== 9888) { 
            let sk = textInputQuestion ? currHiraObj.h : targetKey; 
            if (users[currentUser]) {
                if (!users[currentUser].globalMistakes) users[currentUser].globalMistakes = {};
                users[currentUser].globalMistakes[sk] = normalizeMistakeCount(users[currentUser].globalMistakes[sk]) + 1;
            }
        }
        if (hasMissLimit) {
            let sk = textInputQuestion ? currHiraObj.h : targetKey; 
            mistakeStats[sk] = (mistakeStats[sk] || 0) + 1; mistakeCount++; els.missCounter.innerText = `ミス：${mistakeCount} / ${maxMistakes}`;
            if (mistakeCount >= maxMistakes) { els.missCounter.classList.add('status-danger'); isProcessing = true; setTimeout(failExam, 500); }
        }
    }
}

export function updateProgress() {
    let p = 0; if (totalCount > 0) p = Math.min(100, Math.floor((currentCount / totalCount) * 100));
    els.progressFill.style.width = p + '%'; els.progressText.innerText = p + '%';
}

function setupMouse(s) {
    els.playArea.style.justifyContent = 'normal'; els.playArea.style.alignItems = 'normal'; mainQueue =[];
    if (s===1) { for(let i=0;i<15;i++) mainQueue.push({type:'move'}); } else if (s===2) { for(let i=0;i<15;i++) mainQueue.push({type:'click'}); } else if (s===3) { for(let i=0;i<6;i++) mainQueue.push({type:'dbl'}); } else if (s===4) { for(let i=0;i<3;i++) mainQueue.push({type:'menu'}); } else if (s===5) { for(let i=0;i<4;i++) mainQueue.push({type:'drag'}); } else if (s===6) { for(let i=0;i<3;i++) mainQueue.push({type:'scroll'}); } else if (s===7) { for(let i=0;i<3;i++) mainQueue.push({type:'move'}); for(let i=0;i<3;i++) mainQueue.push({type:'click'}); for(let i=0;i<2;i++) mainQueue.push({type:'dbl'}); for(let i=0;i<2;i++) mainQueue.push({type:'drag'}); mainQueue.push({type:'menu'}); mainQueue.push({type:'scroll'}); }
    totalCount = mainQueue.length; updateProgress(); 
}

function setupVision(sid) {
    els.playArea.style.display = 'flex'; 
    els.playArea.style.justifyContent = 'center'; els.playArea.style.alignItems = 'center'; els.playArea.innerHTML = '';
    totalCount = 1; currentCount = 0; updateProgress();
    
    if (sid === 'v1') els.instText.innerText = "1から 順番に すばやく クリックしてね！";
    else if (sid === 'v2') els.instText.innerText = "1つだけ 違う文字を さがして クリックしてね！";
    else if (sid === 'v3') els.instText.innerText = "的(まと)の 上に マウスを ずっと 合わせてね！";
    else if (sid === 'v4') els.instText.innerText = "一瞬だけ 出てくる 絵を おぼえよう！";
    else if (sid === 'v5') els.instText.innerText = "おなじ絵を ぜんぶ さがして クリックしてね！";
    else if (sid === 'v6') els.instText.innerText = "でてきた 的(まと)を すばやく クリックしてね！";
    else if (sid === 'v7') els.instText.innerText = "光った 順番を おぼえて、同じように クリックしてね！";
    else if (sid === 'v8') els.instText.innerText = "青いスタートから 赤いゴールまで はみ出さずに すすんでね！";
    else if (sid === 'v9') els.instText.innerText = "真ん中と 同じ向きの ものを えらんでね！";
}

function setupRomajiTable(sid) {
    els.playArea.innerHTML = '';
    els.playArea.style.justifyContent = 'center';
    
    romajiMode = sid.endsWith('_exam') ? 'exam' : 'prac';
    let baseId = sid.replace('_exam', '').replace('_prac', '');
    const data = ROMAJI_TABLE_DATA[baseId];
    
    els.instText.innerText = (romajiMode === 'exam') ? "ヒントなしで ぜんぶ うめてみよう！" : "ローマじを にゅうりょく して 表を うめよう！";

    const container = document.createElement('div');
    container.className = 'romaji-table-container';

    if (romajiMode === 'prac') {
        const hintBtn = document.createElement('button');
        hintBtn.className = 'btn-secondary';
        hintBtn.innerText = '💡 ヒントをみる';
        hintBtn.style.alignSelf = 'center';
        hintBtn.style.marginBottom = '10px';
        hintBtn.onclick = () => {
            document.querySelectorAll('.romaji-cell').forEach(c => c.classList.add('show-hint'));
            hintBtn.disabled = true; hintBtn.innerText = '💡 ヒント表示中';
            const firstInp = container.querySelector('.romaji-input:not(:disabled)');
            if(firstInp) firstInp.focus();
        };
        container.appendChild(hintBtn);
    }

    romajiTotalCells = 0;
    romajiCorrectCells = 0;

    const tableWrap = document.createElement('div');
    tableWrap.style.display = 'flex'; 
    tableWrap.style.flexWrap = 'wrap'; 
    tableWrap.style.justifyContent = 'center'; 
    tableWrap.style.gap = '40px'; 

    let currentCol = document.createElement('div');
    currentCol.style.display = 'flex'; currentCol.style.flexDirection = 'column'; currentCol.style.gap = '5px';
    
    const splitIndex = data.rows.length > 8 ? Math.ceil(data.rows.length / 2) : data.rows.length;

    data.rows.forEach((row, index) => {
        if (index === splitIndex) {
            tableWrap.appendChild(currentCol);
            currentCol = document.createElement('div');
            currentCol.style.display = 'flex'; currentCol.style.flexDirection = 'column'; currentCol.style.gap = '5px';
        }
        
        const rowDiv = document.createElement('div'); rowDiv.className = 'romaji-table-row';
        row.forEach(cell => {
            const cellDiv = document.createElement('div');
            cellDiv.className = 'romaji-cell' + (cell ? '' : ' empty');
            if (cell) {
                romajiTotalCells++;
                cellDiv.innerHTML = `<div class="romaji-hira">${cell.h}</div><input type="text" class="romaji-input" maxlength="5" data-ans="${cell.r.join(',')}"><div class="romaji-hint-text">${cell.r[0]}</div>`;
                const inp = cellDiv.querySelector('input');
                inp.oninput = () => {
                    let val = inp.value.toUpperCase(); inp.value = val;
                    let ansList = inp.getAttribute('data-ans').split(',');
                    if (ansList.includes(val)) {
                        inp.classList.add('correct'); inp.disabled = true; SoundManager.playType(); romajiCorrectCells++;
                        const allInputs = Array.from(container.querySelectorAll('.romaji-input:not(:disabled)'));
                        if (allInputs.length > 0) allInputs[0].focus();
                        if (romajiCorrectCells >= romajiTotalCells) {
                            SoundManager.playSuccess();
                            setTimeout(() => { currentStage = sid; markClear(); }, 500);
                        }
                    }
                };
            }
            rowDiv.appendChild(cellDiv);
        });
        currentCol.appendChild(rowDiv);
    });
    tableWrap.appendChild(currentCol);

    container.appendChild(tableWrap);
    els.playArea.appendChild(container);
}

function setupKeyboard(s) {
    renderKeyboard(); let pool =[];
    if (isAlphabetReading) {
        const stage = ALPHABET_READING_STAGES.find(item => item.id === s);
        const keys = stage ? stage.keys : [];
        const raw = [];
        keys.forEach(key => {
            raw.push({ key, alphabetName: ALPHABET_READING_NAMES[key] || key });
            raw.push({ key, alphabetName: ALPHABET_READING_NAMES[key] || key });
        });
        pool = shuffle(raw);
    } else if (s === 9888) { 
        let mistakes = users[currentUser].globalMistakes || {};
        let sortedKeys = getTrainableMistakeEntries(mistakes, 8).map(item => item.key);
        let raw =[];
        sortedKeys.forEach(k => { 
            if (/[ぁ-ん]/.test(k) || WORD_DATA.some(d => d.chars.some(c=>c.h===k))) { 
                let r =[convertNameToRomaji(k)]; 
                HIRAGANA_DATA.forEach(d => d.chars.forEach(c => { if(c.h === k) r = c.r; })); 
                WORD_DATA.forEach(d => d.chars.forEach(c => { if(c.h === k) r = c.r; })); 
                for(let i=0; i<3; i++) raw.push({h: k, r: r, blind: false}); 
            } else { 
                for(let i=0; i<3; i++) raw.push(k); 
            } 
        }); 
        pool = shuffle(raw);
        
        users[currentUser].currentWeakKeys = sortedKeys;

    } else if (s >= 2000 && s < 3000) { 
        if (s === 2999) { const keys = new Set(); KEYBOARD_STAGES.forEach(st => st.keys.forEach(k => keys.add(k))); let raw =[]; Array.from(keys).forEach(k => { raw.push({key: k, blind: true}); raw.push({key: k, blind: true}); }); pool = shuffle(raw); } 
        else { const bSt = BLIND_STAGES.find(x => x.id === s); const ref = KB_CHAPTERS.find(c => c.id === bSt.ref); const keys = new Set(); ref.stages.forEach(id => { const st = KEYBOARD_STAGES.find(x => x.id === id); if (st) st.keys.forEach(k => keys.add(k)) }); const list = Array.from(keys); if (bSt.type === 'practice') { let rawList = shuffle(list); rawList.forEach(k => { const f = FINGER_MAP[k], h = FINGER_HOME_MAP[f]; pool.push({key: k, blind: false}); if (h && h !== k && h !== 'SPACE') pool.push({key: h, blind: false, ret: true}); pool.push({key: k, blind: true}); if (h && h !== k && h !== 'SPACE') pool.push({key: h, blind: true, ret: true}); }); } else { let raw =[]; list.forEach(k => { for (let i = 0; i < 3; i++) raw.push({key: k, blind: true}) }); pool = shuffle(raw); } }
    } else if (isHiragana && !isWord) { 
        let raw =[]; if (s === 3999) { HIRAGANA_DATA.forEach(d => { d.chars.forEach(c => { raw.push({...c, blind: true}) }); }); pool = shuffle(raw).slice(0, 40); } 
        else if ([3301, 3302, 3303, 3304].includes(s)) { 
            let targetIds =[]; if (s === 3301) targetIds =[3001, 3002, 3003]; else if (s === 3302) targetIds =[3004, 3005, 3006]; else if (s === 3303) targetIds =[3007, 3008, 3009, 3010]; else if (s === 3304) targetIds =[3011, 3012, 3013, 3014, 3015]; 
            HIRAGANA_DATA.forEach(d => { if (targetIds.includes(d.id)) { d.chars.forEach(c => { for (let i = 0; i < 2; i++) raw.push({...c, blind: true}) }); } }); pool = shuffle(raw); 
        } else if (s >= 3100 && s < 3200) { const d = HIRAGANA_DATA.find(x => x.id === (s - 100)); let tmp = shuffle(d.chars); tmp.forEach(c => { pool.push({...c, blind: false}); pool.push({...c, blind: true}); }); } 
        else if (s >= 3200 && s < 3300) { const d = HIRAGANA_DATA.find(x => x.id === (s - 200)); d.chars.forEach(c => { for (let i = 0; i < 3; i++) raw.push({...c, blind: true}) }); pool = shuffle(raw); } 
        else { const d = HIRAGANA_DATA.find(x => x.id === s); d.chars.forEach(c => { for (let i = 0; i < 3; i++) raw.push(c); }); pool = shuffle(raw); }
    } else if (isWord) { 
        let raw =[]; if (s === 4999) { const finalExamIndex = STAGE_ORDER.indexOf(4999); WORD_DATA.forEach(d => { if (STAGE_ORDER.indexOf(d.id) !== -1 && STAGE_ORDER.indexOf(d.id) < finalExamIndex) d.chars.forEach(c => { raw.push({...c, blind: false}) }); }); pool = shuffle(raw).slice(0, 20); }
        else if (EXAMS.some(ex => ex.id === s)) { const chap = KB_CHAPTERS.find(c => c.exam === s); const stageIds = chap ? chap.stages : []; WORD_DATA.forEach(d => { if (stageIds.includes(d.id)) d.chars.forEach(c => raw.push({...c, blind: false})); }); raw = shuffle(raw).slice(0, 18); }
        else { const d = WORD_DATA.find(x => x.id === s); if(d) { d.chars.forEach(c => { for (let i = 0; i < 2; i++) raw.push({...c, blind: false}) }); raw = shuffle(raw); } }
        if (s !== 4999) { const displayName = getUserDisplayName(currentUser); const nameRomaji = convertNameToRomaji(displayName); raw.unshift({ h: displayName, r:[nameRomaji], blind: false }); } pool = raw;
    } else if (s === 1999) { 
        const keys = new Set(); KEYBOARD_STAGES.forEach(st => st.keys.forEach(k => keys.add(k))); let raw =[]; Array.from(keys).forEach(k => { raw.push(k); raw.push(k); }); pool = shuffle(raw); 
    } else if ([1051, 1052, 1053, 1054, 1101, 1102, 1103, 1104].includes(s)) { 
        let ref = 'home'; if (s % 10 === 2) ref = 'top'; if (s % 10 === 3) ref = 'bottom'; if (s % 10 === 4) ref = 'number'; const chap = KB_CHAPTERS.find(c => c.id === ref); const keys = new Set(); chap.stages.forEach(id => { const st = KEYBOARD_STAGES.find(x => x.id === id); if (st) st.keys.forEach(k => keys.add(k)) }); let raw =[]; Array.from(keys).forEach(k => { raw.push(k); raw.push(k); raw.push(k); }); pool = shuffle(raw); 
    } else { 
        const st = KEYBOARD_STAGES.find(x => x.id === s); if (st) { let rawList =[]; st.keys.forEach(k => { for (let i = 0; i < 5; i++) rawList.push(k); }); rawList = shuffle(rawList); rawList.forEach(k => { pool.push(k); const f = FINGER_MAP[k], h = FINGER_HOME_MAP[f]; if (h && h !== k && h !== 'SPACE') pool.push({key: h, ret: true}); }); } 
    }
    mainQueue = pool; totalCount = mainQueue.length; updateProgress();
}

function nextTask() {
    if (gameMode === 'mouse') {
        els.playArea.innerHTML = ''; els.ctxMenu.style.display = 'none'; 
        els.playArea.onclick = null;
        els.playArea.onmousemove = null;
        els.playArea.onmouseup = null;
        els.playArea.onmouseleave = null;
        els.playArea.onwheel = null;
        els.playArea.oncontextmenu = (e) => { e.preventDefault(); }; 
        els.playArea.style.overflowY = 'hidden'; els.playArea.style.display = 'flex'; isProcessing = false;
        const task = mainQueue.shift(); if (!task) return;
        if (task.type === 'move') m_move(); else if (task.type === 'click') m_click(); else if (task.type === 'dbl') m_dbl(); else if (task.type === 'menu') m_menu(); else if (task.type === 'drag') m_drag(); else if (task.type === 'scroll') m_scroll();
    } else { nextKeyQ(); }
}

function nextKeyQ() {
    isProcessing = false; const mq = document.getElementById('main-q'), hq = document.getElementById('romaji-hint'); mq.innerText = ''; hq.innerText = ''; if (mainQueue.length === 0) return;
    let item = mainQueue[0], isBlindItem = false;
    if (typeof item === 'object') { if (item.key) { targetKey = item.key; isBlindItem = !!item.blind; isHomeReturn = !!item.ret; currHiraObj = null; } else if (item.h) { currHiraObj = item; isBlindItem = !!item.blind; isHomeReturn = false; } } else { targetKey = item; isHomeReturn = false; currHiraObj = null; }
    const wrap = document.getElementById('keyboard-wrapper'); if (isBlindItem) { wrap.classList.add('blind-active'); els.instText.innerText = 'みないで うってみよう！'; } else { wrap.classList.remove('blind-active'); }
    wrap.classList.toggle('alphabet-reading-active', isAlphabetReading);
    const isTextInputItem = Boolean(currHiraObj) && (isHiragana || isWord || currentStage === 9888);
    if (isAlphabetReading) {
        els.instText.innerText = 'おなじ かたちの キーを おしてね';
        mq.innerHTML = `<span class="alphabet-question-letter">${targetKey}</span>`;
        hq.innerHTML = '<span class="alphabet-reading-hint">できたら よみかたが きこえます</span>';
    } else if (isTextInputItem) {
        if (currentStage === 9888) els.instText.innerText = 'にがて とっくん！'; else els.instText.innerText = isWord ? 'ローマじで ことばを うとう！' : 'したのローマじを みて おそう！';
        
        if (currRomajiIdx === 0 || activeRomajiList.length === 0) { 
            activeRomajiList = Array.isArray(currHiraObj.r) ?[...currHiraObj.r] :[currHiraObj.r]; 
            currRomajiIdx = 0; 
            typedRomajiStr = ""; 
        }
        
        targetKey = (activeRomajiList[0].charAt(currRomajiIdx) === ' ') ? 'SPACE' : activeRomajiList[0].charAt(currRomajiIdx);
        mq.innerText = currHiraObj.h; if (!isBlindItem) updRomaji();
    } else {
        if (currentStage === 9888) els.instText.innerText = 'にがて とっくん！'; else if (!isBlindItem) els.instText.innerText = isExam ? 'もんだいのキーを おそう！' : 'ひかるキーを おそう！';
        if (isHomeReturn) els.instText.innerText = 'ホームポジションに もどろう！'; mq.innerText = (targetKey === 'SPACE' ? 'スペース' : targetKey);
    }
    updateVisuals();
}

function completeTask(delay) {
    currentCount++; updateProgress();
    if (mainQueue.length === 0 && !pendingHome) setTimeout(markClear, delay); else setTimeout(nextTask, delay);
}

export function markClear() {
    if (isClearProcessing) return;
    isClearProcessing = true;
    isProcessing = true;
    pendingDailyMissionTask = null;
    try {
        if (timerInterval) clearInterval(timerInterval);
        if (visionInterval) clearInterval(visionInterval);
        if (visionTimeout) clearTimeout(visionTimeout);
        let clearMsg = 'クリア！', timeMsg = '', statsMsg = ''; 
        const elapsed = (Date.now() - startTime) / 1000;
        let isNewRecord = false; 
        const canSaveResult = canWriteCurrentUserRow();
        const originalUserData = users[currentUser] ? JSON.parse(JSON.stringify(users[currentUser])) : null;

        let coinGain = 0;
        if (gameMode === 'mouse') {
            let isFirst = users[currentUser] && users[currentUser].mouseLevel < currentStage;
            coinGain = isFirst ? 50 : 1; 
            if (isFirst) users[currentUser].mouseLevel = currentStage;
            if (canSaveResult && isFirst && Number(currentStage) === 7) {
                pendingCertificateAward = { id: 'mouse-master', title: 'マウスれんしゅう 免許皆伝' };
            }
        } else if (gameMode === 'vision') {
            if (!users[currentUser].visionCleared) users[currentUser].visionCleared =[];
            let isFirst = !users[currentUser].visionCleared.includes(currentStage);
            if (isFirst) users[currentUser].visionCleared.push(currentStage);

            if (!users[currentUser].examRecords) users[currentUser].examRecords = {};
            const prev = users[currentUser].examRecords[currentStage];
            if (!prev || elapsed < prev) { 
                users[currentUser].examRecords[currentStage] = elapsed; 
                isNewRecord = true; 
            }
            
            if (isVisionHardMode) {
                if (isFirst) coinGain = 100; 
                else if (isNewRecord && prev) coinGain = 50; 
                else coinGain = 0; 
            } else {
                if (isFirst) coinGain = 50; 
                else if (isNewRecord && prev) coinGain = 30; 
                else coinGain = 0; 
            }

            timeMsg = `タイム: ${elapsed.toFixed(1)}秒${isVisionHardMode ? '<br><span style="font-size:24px; color:#d84315;">(🔥 ハードモード)</span>' : ''}`;
            if (isNewRecord && prev) timeMsg += `<br><span style="font-size:24px; color:#ffeb3b;">★しんきろく！★</span>`;
        } else if (gameMode === 'romaji') {
            let isExamMode = String(currentStage).endsWith('_exam');
            coinGain = isExamMode ? 50 : 20;
            
            // ★追加: ローマ字テストのクリア履歴を保存する
            if (!users[currentUser].examRecords) users[currentUser].examRecords = {};
            const prev = users[currentUser].examRecords[currentStage];
            if (!prev || elapsed < prev) { 
                users[currentUser].examRecords[currentStage] = elapsed; 
            }
            
            timeMsg = `タイム: ${elapsed.toFixed(1)}秒${isExamMode ? '<br><span style="font-size:24px; color:#E91E63;">(🔥 テスト合格！)</span>' : ''}`;
        } else {
            let acc = 0; if (totalKeysTyped + missKeysTyped > 0) acc = Math.floor((totalKeysTyped / (totalKeysTyped + missKeysTyped)) * 100);
            let kpm = Math.floor((totalKeysTyped / Math.max(elapsed, 1)) * 60);
            statsMsg = `🎯 せいかくりつ: ${acc}%　⚡ はやさ: ${kpm} 打/分`;
            if (missKeysTyped === 0 && isExam && users[currentUser]) users[currentUser].hasPerfectClear = true;

            let isFirst = false;
            if (isAlphabetReading) {
                const idx = ALPHABET_READING_STAGES.findIndex(stage => stage.id === currentStage);
                if (idx !== -1 && users[currentUser] && Number(users[currentUser].alphabetSequence || 0) <= idx) {
                    users[currentUser].alphabetSequence = idx + 1;
                    isFirst = true;
                }
            } else if (currentStage !== 9888) {
                const idx = STAGE_ORDER.indexOf(currentStage);
                if (idx !== -1 && users[currentUser] && users[currentUser].keyboardSequence <= idx) {
                    const previousSequence = Number(users[currentUser].keyboardSequence || 0);
                    users[currentUser].keyboardSequence = idx + 1; isFirst = true;
                    if (canSaveResult) {
                        pendingCertificateAward = getKeyboardCertificateAward(previousSequence, users[currentUser].keyboardSequence);
                    }
                }
            }
            
            if (isTimeAttackMode && currentStage !== 9888) {
                if (users[currentUser]) {
                    if (!users[currentUser].examRecords) users[currentUser].examRecords = {};
                    const prev = users[currentUser].examRecords[currentStage];
                    if (!prev || elapsed < prev) { users[currentUser].examRecords[currentStage] = elapsed; isNewRecord = true; }

                    const exData = EXAMS.find(e => e.id === currentStage);
                    if (exData) {
                        let medal = '🥉 銅メダル';
                        if (elapsed <= exData.gold) medal = '🥇 金メダル!!'; else if (elapsed <= exData.silver) medal = '🥈 銀メダル!';
                        timeMsg = `タイム: ${elapsed.toFixed(1)}秒 <br><span style="font-size:30px;">(${medal})</span>`;
                        if (isNewRecord && prev) timeMsg += `<br><span style="font-size:24px; color:#ffeb3b;">★しんきろく！★</span>`;
                    }
                }
            } else if (isExam && !isTimeAttackMode && currentStage !== 9888) {
                timeMsg = `<span style="font-size:24px; color:#E91E63;">✨ごうかく！ 次からタイムアタックができるよ！✨</span>`;
            }

            if (currentStage === 9888) { 
                coinGain = 10; 
                if (users[currentUser].currentWeakKeys) {
                    users[currentUser].currentWeakKeys.forEach(k => {
                        if (users[currentUser].globalMistakes && users[currentUser].globalMistakes[k]) {
                            delete users[currentUser].globalMistakes[k]; 
                        }
                    });
                    delete users[currentUser].currentWeakKeys;
                }
            } else {
                let cat = Math.floor(currentStage / 1000);
                if (isAlphabetReading) { coinGain = isFirst ? 40 : 5; }
                else if (cat === 1) { coinGain = isFirst ? 100 : 10; }      
                else if (cat === 2) { coinGain = isFirst ? 150 : 20; } 
                else if (cat === 3) { coinGain = isFirst ? 200 : 30; } 
                else if (cat === 4) { coinGain = isFirst ? 250 : 50; } 
                else { coinGain = isFirst ? 50 : 10; } 
            }
        }
        
        let earnedTicket = null;
        if (canSaveResult && [1999, 2999, 4999, 3999].includes(currentStage)) {
            if (!users[currentUser].tickets) users[currentUser].tickets =[];
            
            const glob = users[GLOBAL_SETTINGS_ID] || {};
            const config = glob.ticketConfig || { normal: { name: '👍 いいねポイント 5こ', icon: '🎟️' }, newRecord: { name: '👍 いいねポイント 1こ', icon: '🎟️' } };

            if (!isTimeAttackMode) earnedTicket = { id: 'ticket_normal', name: config.normal.name, icon: config.normal.icon };
            else if (isNewRecord) earnedTicket = { id: 'ticket_newrecord', name: config.newRecord.name, icon: config.newRecord.icon };
            
            if (earnedTicket) {
                users[currentUser].tickets.push({ id: earnedTicket.id, name: earnedTicket.name, date: new Date().toLocaleDateString() });
                clearMsg += `<br><span style="font-size:24px; color:#FF5722;">${earnedTicket.icon} チケットゲット！</span>`;
            }
        }

        if (canSaveResult && users[currentUser]) {
            users[currentUser].coins = (users[currentUser].coins || 0) + coinGain;
            recordPracticeActivity({
                category: gameMode || 'practice',
                title: getPracticeTitle(),
                detail: isNewRecord ? 'クリア / 新記録' : 'クリア',
                amount: getPracticeAmount(elapsed),
                coins: coinGain
            });
            const dailyMissionResult = markDailyMissionComplete({
                type: gameMode || 'practice',
                stage: currentStage
            });
            clearMsg += `<br><span style="font-size:24px; color:#FFD700;">💰 +${coinGain} コインゲット！</span>`;
            if (dailyMissionResult?.task) {
                clearMsg += `<br><span style="font-size:20px; color:#00c853;">今日のミッション達成！ ${dailyMissionResult.doneCount}/${dailyMissionResult.total}</span>`;
                pendingDailyMissionTask = dailyMissionResult.doneCount < dailyMissionResult.total
                    ? getNextIncompleteDailyMission()
                    : null;
                if (dailyMissionResult.reward) {
                    clearMsg += `<br><span style="font-size:26px; color:#ff9800;">ミッションボーナス +${dailyMissionResult.reward} コイン！</span>`;
                }
            }
            saveUsers(false);
        } else {
            if (originalUserData) users[currentUser] = originalUserData;
            clearMsg += `<br><span style="font-size:20px; color:#607D8B;">先生確認モード：結果は保存されません</span>`;
        }
        
        SoundManager.playClear();
        els.fbText.innerHTML = clearMsg; els.fbTime.innerHTML = timeMsg; els.fbTime.style.display = timeMsg ? 'block' : 'none';
        els.fbOverlay.classList.remove('certificate-earned-feedback');
        let statDiv = document.getElementById('feedback-stats');
        if (!statDiv) { statDiv = document.createElement('div'); statDiv.id = 'feedback-stats'; els.fbOverlay.appendChild(statDiv); }
        statDiv.innerHTML = statsMsg; statDiv.style.display = statsMsg ? 'block' : 'none';
        
        if (earnedTicket) clearFeedbackActions();
        else renderFeedbackActions();
        els.fbOverlay.style.display = 'flex'; document.getElementById('progress-bar-fill').style.width = '100%';
        createConfetti();

        if (earnedTicket) {
            setTimeout(() => {
                els.fbOverlay.style.display = 'none';
                showRewardOverlay("🎉 チケット ゲット！ 🎉", earnedTicket.name, earnedTicket.icon, () => {
                    if (pendingCertificateAward) showCertificateAwardOverlay(pendingCertificateAward);
                    else backToMenu();
                });
            }, 3000);
        }
    } catch(err) {
        console.error("markClearエラー:", err);
        setTimeout(backToMenu, 2000); 
    }
}

function failExam() {
    if (timerInterval) clearInterval(timerInterval);
    SoundManager.playError(); const keys = Object.keys(mistakeStats);
    if (keys.length > 0) {
        const worst = keys.reduce((a, b) => mistakeStats[a] > mistakeStats[b] ? a : b);
        const hintId = ADVICE_HINT_MAP[worst];
        if (hintId) {
            const btn = document.createElement('button'); btn.className = 'btn-primary'; btn.innerText = 'ふくしゅうする';
            btn.onclick = () => startGame(hintId, 'keyboard');
            const area = document.getElementById('fail-buttons-area');
            if (area.children.length > 2) area.removeChild(area.firstChild);
            area.insertBefore(btn, area.firstChild);
        }
        els.advice.innerHTML = `「${worst}」が にがてかも。<br>ふくしゅうしよう！`; els.advice.style.display = 'block';
    } else { els.advice.style.display = 'none'; }
    els.failOverlay.style.display = 'flex'; setTimeout(() => { document.getElementById('btn-retry-exam').focus(); }, 100);
}

function finishItemSuccess() {
    const cur = mainQueue.shift(); const nxt = mainQueue[0]; currRomajiIdx = 0; activeRomajiList =[];
    let delay = 500;
    if (isAlphabetReading) delay = 900;
    if (cur && !cur.blind && nxt && nxt.blind && !nxt.ret && ((cur.key && cur.key === nxt.key) || (cur.h && cur.h === nxt.h))) {
        delay = 1500; 
        setTimeout(() => {
            const mq = document.getElementById('main-q');
            if (mq) mq.innerText = '👀 みないで うとう！';
            const hq = document.getElementById('romaji-hint');
            if (hq) hq.innerText = '';
            document.querySelectorAll('.key').forEach(k => k.className = 'key' + (k.classList.contains('space') ? ' space' : ''));
            document.querySelectorAll('.finger').forEach(f => f.className = f.className.replace(/ active| color-\w+/g, ''));
        }, 400);
    }
    isProcessing = true; SoundManager.playSuccess(); completeTask(delay);
}

function renderKeyboard() {
    const w = document.createElement('div'); w.id = 'keyboard-wrapper'; w.innerHTML = `<div id="question-display"><div id="romaji-hint"></div><div id="main-q"></div></div>`;
    const kb = document.createElement('div'); kb.id = 'virtual-keyboard';
    KB_LAYOUT.forEach((row, i) => { const r = document.createElement('div'); r.className = `kb-row row-${i}`; r.style.setProperty('--key-count', row.length); row.forEach(c => { const k = document.createElement('div'); k.className = 'key' + (c === 'SPACE' ? ' space' : ''); k.dataset.key = c === 'SPACE' ? ' ' : c; k.innerText = c === 'SPACE' ? 'スペース' : c; r.appendChild(k) }); kb.appendChild(r); }); w.appendChild(kb);
    w.innerHTML += `<div id="hands-display"><div class="hand left"><div class="finger f-pinky" data-finger="l-pinky"></div><div class="finger f-ring" data-finger="l-ring"></div><div class="finger f-middle" data-finger="l-middle"></div><div class="finger f-index" data-finger="l-index"></div><div class="finger f-thumb" data-finger="thumb"></div></div><div class="hand right"><div class="finger f-thumb" data-finger="thumb"></div><div class="finger f-index" data-finger="r-index"></div><div class="finger f-middle" data-finger="r-middle"></div><div class="finger f-ring" data-finger="r-ring"></div><div class="finger f-pinky" data-finger="r-pinky"></div></div></div>`; els.playArea.appendChild(w);
}

function updateVisuals() { const fn = targetKey === 'SPACE' ? 'thumb' : FINGER_MAP[targetKey]; const cl = COLOR_CLASS_MAP[fn]; document.querySelectorAll('.key').forEach(k => { k.className = 'key' + (k.classList.contains('space') ? ' space' : ''); if (k.dataset.key === (targetKey === 'SPACE' ? ' ' : targetKey)) { k.classList.add('target'); if (cl) k.classList.add(cl); } }); document.querySelectorAll('.finger').forEach(f => { f.className = f.className.replace(/ active| color-\w+/g, ''); if (f.dataset.finger === fn) { f.classList.add('active'); if (cl) f.classList.add(cl); } }); }

function updRomaji() { let h = ''; let target = activeRomajiList[0]; for (let i = 0; i < target.length; i++) { let dispChar = target[i] === ' ' ? '␣' : target[i]; if (i < currRomajiIdx) h += `<span class="romaji-done">${dispChar}</span>`; else if (i === currRomajiIdx) h += `<span class="romaji-current">${dispChar}</span>`; else h += `<span>${dispChar}</span>`; } document.getElementById('romaji-hint').innerHTML = h; }

function mkEl(c, h) { const d = document.createElement('div'); d.className = c; d.innerHTML = h; return d; }

function rndPos(e, safeWidth = 150, safeHeight = 150) {
    const r = els.playArea.getBoundingClientRect();
    const pad = 40;
    const maxLeft = Math.max(pad, r.width - safeWidth - pad);
    const maxTop = Math.max(pad, r.height - safeHeight - pad);
    e.style.left = (Math.random() * Math.max(1, maxLeft - pad) + pad) + 'px';
    e.style.top = (Math.random() * Math.max(1, maxTop - pad) + pad) + 'px';
}

function m_move() { els.instText.innerText="★に マウスの やじるし を あわせてね"; const s=mkEl('target star','★'); s.style.color='#FFC107'; rndPos(s); s.onmouseenter=()=>{if(isProcessing)return; isProcessing=true; SoundManager.playHover(); s.innerText='😊'; s.style.transform='scale(1.3)'; setTimeout(()=>{s.remove(); completeTask(300);},500);}; els.playArea.appendChild(s); }

function m_click() { els.instText.innerText="「トン」！ １かい クリックしてね"; const s=mkEl('target star','☆'); s.style.color='#E91E63'; rndPos(s); s.onclick=()=>{if(isProcessing)return; isProcessing=true; SoundManager.playClick(); s.innerText='✨'; setTimeout(()=>{s.remove(); completeTask(200);},200);}; els.playArea.appendChild(s); }

function m_dbl() {
        els.instText.innerText="「トントン」！ ２かい はやく クリックしてね";
const f=mkEl('target folder','<span class="folder-icon">📁</span><span class="folder-text">ひみつ</span>'); f.style.color='#FFCA28'; rndPos(f, 150, 150); f.ondblclick=()=>{if(isProcessing)return; isProcessing=true; SoundManager.playClick(); f.innerHTML='<span class="folder-icon">📂</span><span class="folder-text">あいた！</span>'; setTimeout(()=>{f.remove(); completeTask(300);},500);}; els.playArea.appendChild(f); }

function m_menu() { 
    els.instText.innerText="マウスの みぎがわ を「トン」と おして「★ひみつのメニュー★」を えらんでね";
    els.playArea.oncontextmenu=(e)=>{
        e.preventDefault(); 
        SoundManager.playHover(); 
        const m=els.ctxMenu; 
        
        let x = e.clientX; 
        let y = e.clientY; 
        if(x > window.innerWidth - 220) x = window.innerWidth - 220; 
        if(y > window.innerHeight - 150) y = window.innerHeight - 150; 
        
        m.style.position = 'fixed';
        m.style.left = x + 'px'; 
        m.style.top = y + 'px'; 
        m.style.display = 'block';
    }; 
    els.playArea.onclick=()=>{els.ctxMenu.style.display='none';}; 
}

export function handleSecretMenuClick() {
    if (isProcessing) return;
    isProcessing = true;
    SoundManager.playSuccess();
    els.ctxMenu.style.display = 'none';
    els.playArea.oncontextmenu = null;
    completeTask(300);
}

function m_scroll() { 
    els.instText.innerText="コロコロ（ホイール）を まわして、一番下の ボタンを おしてね"; 
    els.playArea.style.display='flex'; 
    els.playArea.style.overflow='hidden'; 

    const sc=document.createElement('div'); 
    sc.className = 'mouse-scroll-practice';
    sc.innerHTML = `
        <div class="mouse-scroll-road">
            <div class="mouse-scroll-cloud top">ホイールを 下に コロコロ</div>
            <div class="mouse-scroll-arrow">↓</div>
            <div class="mouse-scroll-cloud middle">あと すこし</div>
            <button type="button" class="mouse-scroll-finish is-locked">ゴールまで コロコロ</button>
        </div>
    `;
    const road = sc.querySelector('.mouse-scroll-road');
    const btn = sc.querySelector('.mouse-scroll-finish');
    let virtualScroll = 0;

    btn.onclick=()=>{
        if(isProcessing || !btn.classList.contains('is-ready')) return; 
        isProcessing=true; 
        SoundManager.playClick(); 
        btn.innerText='⭕️ できた！'; 
        setTimeout(()=>{
            els.playArea.onwheel = null;
            els.playArea.style.overflow='hidden'; 
            els.playArea.style.display='flex'; 
            sc.remove(); 
            completeTask(300);
        },500);
    };
    els.playArea.appendChild(sc); 

    const getMaxScroll = () => Math.max(0, road.offsetHeight - sc.clientHeight);
    const updateScrollPractice = () => {
        const maxScroll = getMaxScroll();
        virtualScroll = Math.max(0, Math.min(maxScroll, virtualScroll));
        road.style.transform = `translateY(${-virtualScroll}px)`;
        if (maxScroll > 0 && virtualScroll >= maxScroll - 8) {
            btn.classList.remove('is-locked');
            btn.classList.add('is-ready');
            btn.innerText = '✨ ここを クリック！ ✨';
        }
    };

    els.playArea.onwheel = (event) => {
        event.preventDefault();
        if (isProcessing) return;
        virtualScroll += Math.max(0, event.deltaY);
        updateScrollPractice();
    };
    updateScrollPractice();
}

function m_drag() { 
    els.instText.innerText="あかいボールを ゴミばこまで ひっぱって いってね"; 
    let t=mkEl('trash','🗑️'); els.playArea.appendChild(t); 
    const b=mkEl('draggable','●'); b.style.left='50px'; b.style.top='50px'; els.playArea.appendChild(b); 
    let d=false; 
    b.onmousedown=()=>{
        if(!isProcessing){
            d=true; SoundManager.playHover(); b.style.cursor='grabbing'; b.style.transform='scale(1.1)';
        }
    }; 
    els.playArea.onmousemove=(e)=>{
        if(d){
            const r=els.playArea.getBoundingClientRect(); 
            b.style.left=(e.clientX-r.left-45)+'px'; 
            b.style.top=(e.clientY-r.top-45)+'px';
            const br=b.getBoundingClientRect(), tr=t.getBoundingClientRect();
            if(Math.hypot(br.x-tr.x, br.y-tr.y) < 180) {
                t.classList.add('ready-to-eat');
            } else {
                t.classList.remove('ready-to-eat');
            }
        }
    }; 
    els.playArea.onmouseup=()=>{
        if(d){
            d=false; b.style.cursor='grab'; b.style.transform='scale(1)'; 
            t.classList.remove('ready-to-eat');
            const br=b.getBoundingClientRect(), tr=t.getBoundingClientRect(); 
            if(Math.hypot(br.x-tr.x, br.y-tr.y)<180){
                if(!isProcessing){
                    isProcessing=true; b.style.display='none'; SoundManager.playTrash(); 
                    t.classList.add('active'); 
                    const burst=mkEl('drag-success-burst','<span>できた！</span><small>じょうずに はこべたね</small>');
                    els.playArea.appendChild(burst);
                    setTimeout(()=>{t.classList.remove('active'); burst.remove(); completeTask(300);},1200);
                }
            }
        }
    }; 
    els.playArea.onmouseleave=()=>{
        d=false; b.style.cursor='grab'; b.style.transform='scale(1)'; t.classList.remove('ready-to-eat');
    }; 
}

export function startRecommendedStage() {
    const user = currentUser ? users[currentUser] : null;
    if (!user) {
        showCustomAlert('ユーザーを選択してください');
        showScreen('screen-title');
        return;
    }

    const mouseLevel = user.mouseLevel || 0;
    if (mouseLevel < 7) {
        startGame(mouseLevel + 1, 'mouse');
        return;
    }

    const keyboardSequence = user.keyboardSequence || 0;
    if (keyboardSequence < STAGE_ORDER.length) {
        startGame(STAGE_ORDER[keyboardSequence], 'keyboard');
        return;
    }

    showCustomAlert('すべてクリア済みです。にがてとっくんやガチャであそべます。');
}

