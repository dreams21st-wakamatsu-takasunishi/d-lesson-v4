import './style.css';

import { toggleSFX, toggleBGM, initAudio } from './utils/sound.js';
import {
  loadUsers,
  goToGradeSelect,
  closeStampOverlay
} from './api/user.js';

import * as Admin from './ui/admin.js';

import { showCustomAlert } from './ui/modal.js';
import { closeRewardOverlay } from './ui/reward.js';
import {
    speakInstruction,
    speakTextTask
} from './ui/speech.js';
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
import { exportDashboardCSV } from './ui/dashboard-export.js';
import { initFocusNavigation } from './ui/focus-navigation.js';
import {
    goToMinigameMenu,
    goToRecords,
    goToVisionMenu,
    loginAsMaster,
    goToWeakTraining
} from './ui/app-navigation.js';
import { loadCustomGlobalSettings } from './ui/custom-settings.js';
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
    showVisionCompare
} from './games/vision.js';

import {
    startMinigame,
    stopMinigame
} from './games/minigame.js';

import {
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

/* =========================================================
   [JS] 8. 共通ゲーム進行 ＆ キーボード・マウスのコアロジック
   ========================================================= */
/* =========================================================
   [JS] 9. UI・画面遷移 ＆ ガチャ・きせかえ管理
   ========================================================= */
setHomeUiHandlers({
    openMouseMenu: goToMouseMenu,
    openRecords: goToRecords
});

setMenuRefreshHandlers({
    updateMouseButtons,
    updateKeyboardButtons,
    renderKeyboardStages
});

initFocusNavigation({
    backToMenu,
    stopMinigame,
    backToMenuFromText
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
