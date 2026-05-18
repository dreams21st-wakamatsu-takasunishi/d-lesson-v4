import { convertNameToRomaji } from '../utils/helpers.js';

const EXTRA_WORDS = [
    'あおぞら', 'くも', 'にじ', 'さくら', 'ひまわり', 'どんぐり', 'ゆき', 'かぜ', 'ほしぞら',
    'きょうしつ', 'こくばん', 'じかんわり', 'れんらくちょう', 'きゅうしょく', 'としょしつ', 'うんどうじょう',
    'さんぽ', 'べんきょう', 'そうじ', 'どくしょ', 'たいそう', 'れんしゅう', 'はっぴょう', 'てつだい',
    'かばん', 'すいとう', 'ぼうし', 'うわぐつ', 'たいこ', 'ぴあの', 'しゃしん', 'にっき',
    'まど', 'とびら', 'かいだん', 'ろうか', 'けいさん', 'かんじ', 'おんどく', 'しゅくだい',
    'はっぱ', 'こっぷ', 'きっぷ', 'ざっし', 'にっき', 'はっけん', 'しっぱい', 'せっけん',
    'きょうりゅう', 'しょうぼうしゃ', 'きゅうきゅうしゃ', 'しゃぼんだま', 'ちゃわん', 'ちょきんばこ'
];

const NOUNS = [
    'そら', 'はな', 'くも', 'みず', 'ほん', 'かばん', 'にっき', 'えんぴつ', 'ぼうし', 'つくえ',
    'こくばん', 'まど', 'とびら', 'かいだん', 'ろうか', 'きょうしつ', 'としょしつ', 'うんどうじょう'
];

const ADJECTIVES = [
    'あかい', 'あおい', 'しろい', 'おおきい', 'ちいさい', 'たのしい', 'しずかな', 'げんきな',
    'きれいな', 'あたらしい', 'やさしい', 'すてきな'
];

const VERBS = [
    'みつける', 'あつめる', 'ならべる', 'かぞえる', 'よくみる', 'たしかめる', 'れんしゅうする',
    'ていねいにうつ', 'すばやくうつ', 'ゆっくりよむ'
];

const SHORT_SENTENCES = [
    'きょうは、いい、てんき',
    'みんなで、れんしゅう',
    'ゆっくり、ただしく、うつ',
    'まいにち、すこしずつ',
    'あせらず、よくみる',
    'さいごまで、がんばる',
    'しせいを、ただしく',
    'てを、もとに、もどす',
    'ことばを、よくみる',
    'みすを、へらして、うつ'
];

const D_CHALLENGE_LEVEL_WORDS = {
    1: ['そら', 'はな', 'くも', 'みず', 'ほん', 'まど', 'かぜ', 'ゆき'],
    2: ['あおぞら', 'えんぴつ', 'かいだん', 'こくばん', 'にっき', 'きっぷ', 'ざっし', 'さんぽ'],
    3: ['きょうしつ', 'れんしゅう', 'はっぴょう', 'しゅくだい', 'としょしつ', 'しゃしん', 'どんぐり'],
    4: ['ゆっくり、ただしく', 'みんなで、れんしゅう', 'あせらず、よくみる', 'さいごまで、がんばる']
};

const ROMAJI_REPLACEMENTS = [
    ['SHI', 'SI'], ['CHI', 'TI'], ['TSU', 'TU'], ['FU', 'HU'], ['JI', 'ZI'],
    ['SHA', 'SYA'], ['SHU', 'SYU'], ['SHO', 'SYO'],
    ['CHA', 'TYA'], ['CHU', 'TYU'], ['CHO', 'TYO'],
    ['JA', 'ZYA'], ['JU', 'ZYU'], ['JO', 'ZYO']
];

function pick(list) {
    return list[Math.floor(Math.random() * list.length)];
}

function joinSentenceParts(...parts) {
    return parts.filter(Boolean).join('、');
}

function buildRomajiVariants(text) {
    const primary = convertNameToRomaji(text).replaceAll('、', ',').toUpperCase();
    const variants = new Set([primary]);

    ROMAJI_REPLACEMENTS.forEach(([from, to]) => {
        Array.from(variants).forEach(value => {
            if (variants.size >= 32) return;
            if (value.includes(from)) variants.add(value.replaceAll(from, to));
        });
    });

    return Array.from(variants);
}

function toPrompt(text) {
    return {
        h: text,
        r: buildRomajiVariants(text)
    };
}

function generatePhrase() {
    const pattern = Math.floor(Math.random() * 6);
    if (pattern === 0) return joinSentenceParts(pick(ADJECTIVES), pick(NOUNS));
    if (pattern === 1) return `${pick(NOUNS)}を、${pick(VERBS)}`;
    if (pattern === 2) return `${pick(NOUNS)}を、よくみる`;
    if (pattern === 3) return `${pick(ADJECTIVES)}、${pick(NOUNS)}を、${pick(VERBS)}`;
    if (pattern === 4) return pick(SHORT_SENTENCES);
    return pick(EXTRA_WORDS);
}

export function getExtraTypingPrompts() {
    return EXTRA_WORDS.concat(SHORT_SENTENCES).map(toPrompt);
}

export function getDynamicTypingPrompt() {
    return toPrompt(generatePhrase());
}

export function getDynamicDChallengeWord(level) {
    const list = D_CHALLENGE_LEVEL_WORDS[level] || D_CHALLENGE_LEVEL_WORDS[1];
    return toPrompt(pick(list));
}
