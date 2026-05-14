import { showScreen } from './screen.js';

let isFocusNavigationInitialized = false;

function getFocusableElements() {
    const activeScreen = document.querySelector('.screen.active');
    if (!activeScreen) return [];

    const elements = Array.from(activeScreen.querySelectorAll('[tabindex="0"], button:not([tabindex="-1"])'));
    return elements.filter(el => {
        const style = window.getComputedStyle(el);
        return el.offsetParent !== null
            && style.display !== 'none'
            && style.visibility !== 'hidden'
            && style.opacity !== '0.5';
    });
}

export function initFocusNavigation({ backToMenu, stopMinigame, backToMenuFromText }) {
    if (isFocusNavigationInitialized) return;
    isFocusNavigationInitialized = true;

    window.addEventListener('keydown', (e) => {
        const activeScreen = document.querySelector('.screen.active');
        if (!activeScreen) return;

        if (e.key === 'Escape') {
            e.preventDefault();
            if (activeScreen.id === 'screen-game') {
                backToMenu(true);
            } else if (activeScreen.id === 'screen-minigame') {
                stopMinigame(true);
                showScreen('screen-minigame-menu');
            } else if (activeScreen.id === 'screen-text-game') {
                backToMenuFromText();
            } else {
                const backBtn = activeScreen.querySelector('.bottom-back-btn');
                if (backBtn) backBtn.click();
            }
            return;
        }

        if (activeScreen.id === 'screen-game' || activeScreen.id === 'screen-minigame' || activeScreen.id === 'screen-text-game') return;
        if (typeof e.key !== 'string') return;

        const key = e.key.toUpperCase();
        if (!['F', 'J', 'ARROWLEFT', 'ARROWRIGHT', 'ARROWUP', 'ARROWDOWN'].includes(key)) return;

        e.preventDefault();
        const focusables = getFocusableElements();
        if (focusables.length === 0) return;

        let currentIndex = focusables.indexOf(document.activeElement);
        if (currentIndex === -1) {
            focusables[0].focus();
            return;
        }

        if (key === 'F' || key === 'ARROWLEFT' || key === 'ARROWUP') {
            currentIndex = (currentIndex - 1 + focusables.length) % focusables.length;
        } else {
            currentIndex = (currentIndex + 1) % focusables.length;
        }

        focusables[currentIndex].focus();
        focusables[currentIndex].scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
}
