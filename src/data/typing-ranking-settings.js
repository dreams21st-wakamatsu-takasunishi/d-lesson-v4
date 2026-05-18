export const DEFAULT_TYPING_RANKING_NICKNAME_BLOCK_WORDS = [
    'ばか', 'バカ', 'あほ', 'アホ', '死ね', 'しね', 'ころす', '殺す',
    'きもい', 'うざい', 'くそ', 'クソ', 'fuck', 'shit', 'admin',
    'teacher', '先生', '管理者', '学校', '小学校', '中学校'
];

export function normalizeNicknameBlockWords(words) {
    const source = Array.isArray(words) ? words : [];
    const seen = new Set();
    const normalized = [];

    source.forEach(word => {
        const clean = String(word || '').trim();
        if (!clean) return;
        const key = clean.normalize('NFKC').toLowerCase();
        if (seen.has(key)) return;
        seen.add(key);
        normalized.push(clean);
    });

    return normalized;
}

export function parseNicknameBlockWordsText(text) {
    return normalizeNicknameBlockWords(
        String(text || '')
            .split(/[\n,，、]+/)
            .map(word => word.trim())
    );
}

export function formatNicknameBlockWords(words) {
    return normalizeNicknameBlockWords(words).join('\n');
}

export function getCustomTypingRankingNicknameBlockWords(settings = {}) {
    return normalizeNicknameBlockWords(settings.typingRankingNicknameBlockWords);
}

export function getTypingRankingNicknameBlockWords(settings = {}) {
    return normalizeNicknameBlockWords([
        ...DEFAULT_TYPING_RANKING_NICKNAME_BLOCK_WORDS,
        ...getCustomTypingRankingNicknameBlockWords(settings)
    ]);
}
