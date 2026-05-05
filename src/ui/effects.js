import { EFFECTS } from '../data/constants.js';

const CONFETTI_COLORS = [
    '#f44336', '#e91e63', '#9c27b0', '#673ab7',
    '#3f51b5', '#2196f3', '#03a9f4', '#00bcd4',
    '#009688', '#4caf50', '#8bc34a', '#cddc39',
    '#ffeb3b', '#ffc107', '#ff9800', '#ff5722'
];

export function createConfetti(activeEffect = 'default') {
    const effectData = EFFECTS.find(e => e.id === activeEffect) || EFFECTS[0];
    const isEmoji = effectData.emojis && effectData.emojis.length > 0;
    const particleCount = isEmoji ? 60 : 100;

    for (let i = 0; i < particleCount; i++) {
        const c = document.createElement('div');
        c.className = 'confetti';
        c.style.left = Math.random() * 100 + 'vw';

        if (isEmoji) {
            c.innerText = effectData.emojis[Math.floor(Math.random() * effectData.emojis.length)];
            c.style.fontSize = (Math.random() * 25 + 20) + 'px';
            c.style.background = 'transparent';
            c.style.boxShadow = 'none';
            c.style.clipPath = 'none';
        } else {
            c.style.backgroundColor = CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)];
            c.style.width = '15px';
            c.style.height = '15px';
        }

        c.style.animationDuration = (Math.random() * 3 + 2) + 's';
        c.style.animationDelay = (Math.random() * 2) + 's';
        document.body.appendChild(c);
        setTimeout(() => c.remove(), 5000);
    }
}
