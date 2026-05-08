import { users, currentUser } from '../api/user.js';
import { SoundManager } from '../utils/sound.js';
import { createConfetti as createConfettiForEffect } from './effects.js';

export function createConfetti() {
    const u = users[currentUser];
    const effId = u ? (u.activeEffect || 'default') : 'default';
    createConfettiForEffect(effId);
}

export function showCapsuleAnimation(isRare, callback) {
    const overlay = document.getElementById('capsule-overlay');
    const cap = document.getElementById('gacha-capsule');
    cap.innerText = isRare ? '🔮' : '💊';
    overlay.style.display = 'flex';
    cap.style.animation = 'none';
    void cap.offsetWidth;
    cap.style.animation = 'capsuleDrop 1s cubic-bezier(0.25, 1, 0.5, 1) forwards';
    SoundManager.playGachaDrop();

    setTimeout(() => {
        cap.style.animation = 'capsuleBurst 0.5s ease-out forwards';
        SoundManager.playGachaBurst();
        setTimeout(() => {
            overlay.style.display = 'none';
            callback();
        }, 500);
    }, 1200);
}

let rewardCloseCallback = null;

export function showRewardOverlay(title, name, icon, callback) {
    SoundManager.playClear();
    createConfetti();
    document.getElementById('reward-title').innerText = title;
    document.getElementById('reward-name').innerText = name;
    document.getElementById('reward-icon').innerText = icon;
    document.getElementById('reward-overlay').style.display = 'flex';
    rewardCloseCallback = callback;
    setTimeout(() => {
        const btn = document.querySelector('#reward-overlay button');
        if (btn) btn.focus();
    }, 100);
}

export function closeRewardOverlay() {
    SoundManager.playClick();
    document.getElementById('reward-overlay').style.display = 'none';
    if (rewardCloseCallback) {
        rewardCloseCallback();
        rewardCloseCallback = null;
    }
}
