import { THEMES, EFFECTS } from '../data/constants.js';
import { GACHA_ITEMS } from '../data/gacha-items.js';
import { getLearningSettings } from '../api/user.js';

export function loadCustomGlobalSettings() {
    // Rebuild on learner switches so another campus's rewards cannot remain in the draw.
    for (const list of [THEMES, EFFECTS]) for (let i = list.length - 1; i >= 0; i--) if (list[i].isCustom) list.splice(i, 1);
    for (let i = GACHA_ITEMS.length - 1; i >= 0; i--) if (/^(ct_|ce_)/.test(GACHA_ITEMS[i].id)) GACHA_ITEMS.splice(i, 1);
    const glob = getLearningSettings();
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
                if (!ct.hidden && ct.distribution !== 'present') GACHA_ITEMS.push({
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
                if (!ce.hidden && ce.distribution !== 'present') GACHA_ITEMS.push({
                    id: ce.id,
                    type: 'effect',
                    name: `🎉 カスタム演出：${ce.name}`,
                    rate: 0.05
                });
            }
        });
    }
}
