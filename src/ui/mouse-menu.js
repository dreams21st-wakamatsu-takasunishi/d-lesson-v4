import { users, currentUser } from '../api/user.js';
import { createBtn } from '../utils/dom.js';
import { getRewardText } from '../utils/rewards.js';
import { showCustomAlert } from './modal.js';
import { showScreen } from './screen.js';
import { startGame } from '../games/core.js';

function getActiveUserOrTitle() {
    const u = currentUser ? users[currentUser] : null;
    if (u) return u;
    showCustomAlert('ユーザーを選択してください');
    showScreen('screen-title');
    return null;
}

export function goToMouseMenu() {
    updateMouseButtons();
    showScreen('screen-mouse-menu');
}

export function updateMouseButtons() {
    const u = getActiveUserOrTitle();
    if (!u) return;

    const l = u.mouseLevel || 0;
    const masterBadge = document.getElementById('master-badge');
    if (masterBadge) masterBadge.style.display = (l >= 7) ? 'block' : 'none';

    for (let i = 1; i <= 7; i++) {
        const b = document.getElementById(`btn-m${i}`);
        if (!b) continue;

        b.classList.remove('unlocked', 'cleared', 'next-target');
        b.style.opacity = '1';
        b.onclick = null;
        b.onkeydown = null;
        b.tabIndex = -1;

        if (i === 1 || l >= i - 1) {
            b.classList.add('unlocked');
            createBtn(b, () => startGame(i, 'mouse'));
            if (l === i - 1) b.classList.add('next-target');

            if (users[currentUser] && !users[currentUser].isMaster) {
                let badge = b.querySelector('.reward-badge');
                if (!badge) {
                    badge = document.createElement('span');
                    badge.className = 'reward-badge';
                    b.appendChild(badge);
                }
                badge.innerText = getRewardText('mouse', i);
            }
        } else {
            b.style.opacity = '0.5';
            let badge = b.querySelector('.reward-badge');
            if (badge) badge.remove();
        }

        if (l >= i) b.classList.add('cleared');
    }
}
