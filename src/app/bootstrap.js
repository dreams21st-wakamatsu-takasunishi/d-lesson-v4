import { loadUsers } from '../api/user.js';
import { backToMenu, setMenuRefreshHandlers } from '../games/core.js';
import { setGachaUiHandlers } from '../games/gacha.js';
import { stopMinigame } from '../games/minigame.js';
import { backToMenuFromText } from '../games/text.js';
import { initAudio } from '../utils/sound.js';
import { goToRecords } from '../ui/app-navigation.js';
import { initFocusNavigation } from '../ui/focus-navigation.js';
import { registerAppGlobalHandlers } from './global-functions.js';
import { setHomeUiHandlers, updateGlobalHeader } from '../ui/home-dashboard.js';
import { renderKeyboardStages, updateKeyboardButtons } from '../ui/keyboard-menu.js';
import { goToMouseMenu, updateMouseButtons } from '../ui/mouse-menu.js';
import { renderRecords } from '../ui/records.js';

export function initApp({ buildCommit = 'local' } = {}) {
    if (typeof window !== 'undefined') {
        window.__D_LESSON_BUILD__ = { commit: buildCommit };
    }

    window.addEventListener('DOMContentLoaded', () => {
        void loadUsers().then(() => updateGlobalHeader());

        document.addEventListener('click', () => {
            initAudio();
        }, { once: true });
    });

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

    registerAppGlobalHandlers();
}
