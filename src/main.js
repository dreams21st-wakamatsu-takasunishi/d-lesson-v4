import './style.css';

import {
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
import { closeRewardOverlay } from './ui/reward.js';
import {
    goToMouseMenu,
    updateMouseButtons
} from './ui/mouse-menu.js';
import {
    goToKeyboardCategory,
    goToKeyboardMenu,
    updateKeyboardButtons,
    showRomajiMenu,
    renderKeyboardStages,
    backToKbChapter
} from './ui/keyboard-menu.js';
import {
    showRecordSection,
    backToRecordMenu,
    renderRecords
} from './ui/records.js';
import {
    setHomeUiHandlers,
    updateGlobalHeader,
    updateHomeDashboard
} from './ui/home-dashboard.js';

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
function getActiveUserOrTitle() {
    const u = currentUser ? users[currentUser] : null;
    if (u) return u;
    showCustomAlert('ユーザーを選択してください');
    showScreen('screen-title');
    return null;
}

function goToMinigameMenu() {
    showScreen('screen-minigame-menu');
}

function goToRecords() { renderRecords(); showScreen('screen-records'); }
function goToVisionMenu() { renderVisionMenu(); showScreen('screen-vision-menu'); }

setHomeUiHandlers({
    openMouseMenu: goToMouseMenu,
    openRecords: goToRecords
});

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
