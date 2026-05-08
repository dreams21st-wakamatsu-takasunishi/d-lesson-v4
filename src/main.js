import './style.css';

import { registerAppGlobalHandlers } from './app/global-functions.js';
import { loadUsers } from './api/user.js';
import { initAudio } from './utils/sound.js';
import {
    goToMouseMenu,
    updateMouseButtons
} from './ui/mouse-menu.js';
import {
    updateKeyboardButtons,
    renderKeyboardStages
} from './ui/keyboard-menu.js';
import { renderRecords } from './ui/records.js';
import { initFocusNavigation } from './ui/focus-navigation.js';
import {
    goToRecords,
} from './ui/app-navigation.js';
import {
    setHomeUiHandlers,
    updateGlobalHeader
} from './ui/home-dashboard.js';

import { backToMenuFromText } from './games/text.js';

import { setGachaUiHandlers } from './games/gacha.js';

import {
    stopMinigame
} from './games/minigame.js';

import {
  backToMenu,
  setMenuRefreshHandlers
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

registerAppGlobalHandlers();
