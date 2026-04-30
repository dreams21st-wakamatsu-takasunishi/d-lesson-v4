import { currentUser, users } from '../api/user.js';
import { STAGE_ORDER } from '../data/constants.js';

export function getRewardText(mode, sid) {
    const u = users[currentUser];
    if (!u || u.isMaster) return '';

    if (mode === 'mouse') {
        return u.mouseLevel < sid ? '💰50' : '💰1';
    }

    if (mode === 'vision') {
        const isFirst = !(u.visionCleared && u.visionCleared.includes(sid));
        if (String(sid).endsWith('_hard')) return isFirst ? '💰100' : '💰50(更新)';
        if (String(sid).endsWith('_easy')) return isFirst ? '💰20' : '💰10(更新)';
        return isFirst ? '💰50' : '💰30(更新)';
    }

    if (mode === 'romaji') {
        return String(sid).endsWith('_exam') ? '💰50' : '💰20';
    }

    if (mode === 'keyboard') {
        if (sid === 9888) return '💰10';
        const idx = STAGE_ORDER.indexOf(sid);
        const isFirst = idx !== -1 && u.keyboardSequence <= idx;
        const cat = Math.floor(sid / 1000);
        if (cat === 1) return isFirst ? '💰100' : '💰10';
        if (cat === 2) return isFirst ? '💰150' : '💰20';
        if (cat === 3) return isFirst ? '💰200' : '💰30';
        if (cat === 4) return isFirst ? '💰250' : '💰50';
        return isFirst ? '💰50' : '💰10';
    }

    return '';
}
