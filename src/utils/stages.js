import {
    BLIND_STAGES,
    BRIDGE_STAGES,
    EXAMS,
    HIRAGANA_DATA,
    KEYBOARD_STAGES,
    WORD_DATA
} from '../data/constants.js';

export function getStageName(sid) {
    if (sid === 9888) return '[ID:9888] にがてとっくん';

    let st = KEYBOARD_STAGES.find(s => s.id === sid) ||
        BLIND_STAGES.find(s => s.id === sid) ||
        BRIDGE_STAGES.find(s => s.id === sid) ||
        EXAMS.find(s => s.id === sid) ||
        HIRAGANA_DATA.find(s => s.id === sid) ||
        WORD_DATA.find(s => s.id === sid);

    if (st) return `[ID:${sid}] ${st.title}`;

    if (sid >= 3100 && sid <= 3299) {
        const base = sid - (sid >= 3200 ? 200 : 100);
        st = HIRAGANA_DATA.find(s => s.id === base);
        if (st) return `[ID:${sid}] ${st.title}(ブラインド)`;
    }

    return `[ID:${sid}] 未知のステージ`;
}
