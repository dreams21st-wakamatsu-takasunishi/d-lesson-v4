export function createBtn(el, act) { 
    el.tabIndex = 0; el.onclick = act; 
    el.onkeydown = (e) => { 
        const activeScreen = document.querySelector('.screen.active');
        if (activeScreen && (activeScreen.id === 'screen-game' || activeScreen.id === 'screen-minigame' || activeScreen.id === 'screen-text-game')) return;
        if(e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); act(); } 
    }; 
}
