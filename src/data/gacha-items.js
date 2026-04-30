import { EFFECTS, THEMES } from './constants.js';

export const GACHA_ITEMS = [
    { id: 'coin_50', type: 'coin', name: '💰 50コイン', rate: 0.40 }
];

const itemRate = 0.60 / ((THEMES.length - 1) + (EFFECTS.length - 1));

THEMES.forEach(t => {
    if (t.id !== 'default') {
        GACHA_ITEMS.push({ id: 'theme_' + t.id, type: 'theme', name: `${t.icon} テーマ：${t.name}`, rate: itemRate });
    }
});

EFFECTS.forEach(e => {
    if (e.id !== 'default') {
        GACHA_ITEMS.push({ id: e.id, type: 'effect', name: `${e.icon} 演出：${e.name}`, rate: itemRate });
    }
});
