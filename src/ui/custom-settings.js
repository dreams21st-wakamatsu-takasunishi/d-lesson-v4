import { THEMES, EFFECTS } from '../data/constants.js';
import { GACHA_ITEMS } from '../data/gacha-items.js';
import { users, GLOBAL_SETTINGS_ID } from '../api/user.js';

export function loadCustomGlobalSettings() {
    const glob = users[GLOBAL_SETTINGS_ID];
    if (!glob || !glob.globalMistakes) return;

    if (Array.isArray(glob.globalMistakes.customThemes)) {
        glob.globalMistakes.customThemes.forEach(ct => {
            if (!THEMES.find(t => t.id === ct.id)) {
                THEMES.push({
                    id: ct.id,
                    name: ct.name,
                    icon: '🎨',
                    isCustom: true,
                    data: ct,
                    bg: ct.bg,
                    text: ct.text,
                    btnBg: ct.btnBg,
                    btnText: ct.btnText
                });
                GACHA_ITEMS.push({
                    id: ct.id,
                    type: 'theme',
                    name: `🎨 カスタムテーマ：${ct.name}`,
                    rate: 0.05
                });
            }
        });
    }

    if (Array.isArray(glob.globalMistakes.customEffects)) {
        glob.globalMistakes.customEffects.forEach(ce => {
            if (!EFFECTS.find(e => e.id === ce.id)) {
                EFFECTS.push({
                    id: ce.id,
                    name: ce.name,
                    icon: ce.emojis[0],
                    isCustom: true,
                    data: ce,
                    emojis: ce.emojis
                });
                GACHA_ITEMS.push({
                    id: ce.id,
                    type: 'effect',
                    name: `🎉 カスタム演出：${ce.name}`,
                    rate: 0.05
                });
            }
        });
    }
}
