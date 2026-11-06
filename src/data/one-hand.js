import { FINGER_MAP } from './constants.js';
import { createRomajiInputMatcher } from '../utils/romaji-input.js';

const WORDS = {
    left: ['あさ', 'あせ', 'さら', 'たら', 'たて', 'て', 'だれ', 'あれ', 'あられ', 'わた', 'わざ', 'さわ', 'さわら', 'えさ', 'あざ', 'あげ', 'ささえ', 'てら', 'えだ', 'たわら'],
    right: ['もも', 'みみ', 'いぬ', 'うみ', 'こい', 'くも', 'きく', 'きみ', 'ゆき', 'ゆみ', 'きのこ', 'ひも', 'ひよこ', 'におい', 'いも', 'ここ', 'ほほ', 'むこう', 'もくよう', 'もみじ']
};

export function getHandKeys(hand) {
    return Object.keys(FINGER_MAP).filter(key => FINGER_MAP[key].startsWith(hand === 'left' ? 'l-' : 'r-'));
}

export const ONE_HAND_STAGES = ['left', 'right'].flatMap(hand => [
    { number: 1, name: 'キーと ローマ字を みる', keyboard: true, romaji: true },
    { number: 2, name: 'ローマ字だけ みる', keyboard: false, romaji: true },
    { number: 3, name: 'ことばだけで れんしゅう', keyboard: false, romaji: false, typedRomaji: true },
    { number: 4, name: 'かくにんテスト', keyboard: false, romaji: false, typedRomaji: true, exam: true }
].map(stage => ({ ...stage, hand, id: `hand_${hand}_${stage.number}`, title: `${hand === 'left' ? '左手' : '右手'}タイピング ${stage.name}` })));

export function getOneHandStage(id) {
    return ONE_HAND_STAGES.find(stage => stage.id === id) || null;
}

export function getHandWords(hand) {
    return WORDS[hand].map(h => {
        const matcher = createRomajiInputMatcher(h, [], { allowedKeys: getHandKeys(hand) });
        const romaji = matcher.getSuggestion();
        if (!romaji || !matcher.isComplete(romaji)) throw new Error(`Invalid ${hand} word: ${h}`);
        return { h, r: [romaji] };
    });
}
