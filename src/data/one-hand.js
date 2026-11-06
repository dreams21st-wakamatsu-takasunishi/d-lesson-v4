import { FINGER_MAP } from './constants.js';
import { createRomajiInputMatcher } from '../utils/romaji-input.js';

const WORDS = {
    left: [
        'あさ','あせ','さら','たら','たて','て','だれ','あれ','あられ','わた',
        'わざ','さわ','さわら','えさ','あざ','あげ','ささえ','てら','えだ','たわら',
        'あわ','さらだ','あて','たれ','げた','わら','ばら','あさって','わたげ','てだて',
        'あさだ','あさだった','あれだ','あれだった','あれがさらだ','あれがてらだ','あれがえだだ','あれがわただ','あれがばらだ','あれがげただ',
        'あれがあられだ','あれがたわらだ','さらだった','さらがわれた','さらがでた','さらがあった','えだだった','えだがわれた','えだがあった','わたがでた',
        'わたがあった','わたげだ','わたげがあった','あせがでた','あせだらだら','たれがでた','たれがあった','ばらだった','ばらがあった','げただった',
        'げたがあった','あられだ','あられがあった','たわらだ','たわらがあった','てがあがった','てでささえた','てでわたせた','てであわせた','てであらった',
        'てでさわった','あれがわれた','あれがあった','たてて','ささえて','あわせて','わらって','わらわせて','たべて','さわらせて',
        'ああ','ええ','さあ','わあ','あらら','あれれ','あわわ','さあさあ','さてさて','わあわあ',
        'ざわざわ','がたがた','がらがら','げらげら','だらだら','たらたら','ばらばら','べたべた','せっせ','あら'
    ],
    right: [
        'もも','みみ','いぬ','うみ','こい','くも','きく','きみ','ゆき','ゆみ',
        'きのこ','ひも','ひよこ','におい','いも','ここ','ほほ','むこう','もくよう','もみじ',
        'きょう','きのう','ふゆ','ふく','にく','ゆのみ','こいぬ','きもの','ほん','ひこうき',
        'いぬのこ','こいぬのこ','いぬのみみ','いぬのにおい','いぬのひも','いぬのむこう','いぬのよこ','こいぬのよこ','もものにおい','もものみ',
        'みみのよこ','うみのむこう','うみのよこ','くものむこう','ゆきのひ','ゆきのにおい','ふゆのゆき','ふゆのうみ','きのうのゆき','きょうのゆき',
        'きょうのふく','きのうのふく','きみのふく','きみのほん','きみのゆのみ','きみのひこうき','きもののひも','ゆのみのよこ','ほんのよこ','ひもひく',
        'きものきよう','ふくきよう','うみいこう','ふゆのひ','きょうよむ','ほんよむ','よくよむ','よくみよう','よくきこう','にこにこよむ',
        'ひもぬこう','きみのこいぬ','こいぬのひも','ひこうきのむこう','きもののもよう','ふくのもよう','ゆのみのもよう','もみじのもよう','きのこのにおい','にくのにおい',
        'おお','うん','ううん','ふう','ほう','およよ','おいおい','にこにこ','ふむふむ','むくむく',
        'もくもく','もこもこ','ふにふに','むにむに','ひゅうひゅう','ひょいひょい','ぴょんぴょん','ぴいぴい','ぷくぷく','ぽんぽん'
    ]
};

export function getHandKeys(hand) {
    return Object.keys(FINGER_MAP).filter(key => FINGER_MAP[key].startsWith(hand === 'left' ? 'l-' : 'r-'));
}

export const ONE_HAND_STAGES = ['left', 'right'].flatMap(hand => [
    { number: 1, name: 'キーと ローマ字を みる', keyboard: true, romaji: true },
    { number: 2, name: 'ローマ字だけ みる', keyboard: false, romaji: true },
    { number: 3, name: 'ことばだけで れんしゅう', keyboard: false, romaji: false, typedRomaji: true },
    { number: 4, name: 'かくにんテスト', keyboard: false, romaji: false, typedRomaji: true, exam: true },
    { number: 5, name: '90びょうチャレンジ', keyboard: false, romaji: false, typedRomaji: true, timed: true }
].map(stage => ({ ...stage, hand, id: `hand_${hand}_${stage.number}`, title: `${hand === 'left' ? '左手' : '右手'}タイピング ${stage.name}` })));

export function getOneHandStage(id) {
    return ONE_HAND_STAGES.find(stage => stage.id === id) || null;
}

export const ONE_HAND_CHALLENGE_SECONDS = 90;
export function isOneHandChallengeUnlocked(user, hand) {
    return Number(user?.oneHandProgress?.[`hand_${hand}_4`]?.clears || 0) > 0;
}
export function calculateOneHandScore(correctChars, misses) {
    const count = value => Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
    const correct = count(correctChars), mistakes = count(misses);
    return { score: Math.max(0, correct - mistakes), correctChars: correct, misses: mistakes,
        accuracy: correct + mistakes ? Math.floor(correct / (correct + mistakes) * 100) : 0,
        durationSeconds: ONE_HAND_CHALLENGE_SECONDS };
}

export function getHandWords(hand) {
    return WORDS[hand].map(h => {
        const matcher = createRomajiInputMatcher(h, [], { allowedKeys: getHandKeys(hand) });
        const romaji = matcher.getSuggestion();
        if (!romaji || !matcher.isComplete(romaji)) throw new Error(`Invalid ${hand} word: ${h}`);
        return { h, r: [romaji] };
    });
}
