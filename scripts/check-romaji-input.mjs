import assert from 'node:assert/strict';
import { HIRAGANA_DATA, WORD_DATA } from '../src/data/constants.js';
import { createRomajiInputMatcher } from '../src/utils/romaji-input.js';

function accepts(kana, input) {
    return createRomajiInputMatcher(kana).isComplete(input);
}

assert.equal(accepts('し', 'SI'), true);
assert.equal(accepts('し', 'SHI'), true);
assert.equal(accepts('し', 'CI'), true);
assert.equal(accepts('ち', 'CHI'), true);
assert.equal(accepts('つ', 'TSU'), true);
assert.equal(accepts('ふ', 'FU'), true);
assert.equal(accepts('じてんしゃ', 'JITENSHA'), true);
assert.equal(accepts('じてんしゃ', 'ZITENNSYA'), true);
assert.equal(accepts('ぁ', 'XA'), true);
assert.equal(accepts('きゃ', 'KYA'), true);
assert.equal(accepts('きゃ', 'KIXYA'), true);
assert.equal(accepts('しゃ', 'SHA'), true);
assert.equal(accepts('ちゃ', 'CYA'), true);
assert.equal(accepts('てぃ', 'THI'), true);
assert.equal(accepts('てぃ', 'TEXI'), true);
assert.equal(accepts('ピッピ', 'PIPPI'), true);
assert.equal(accepts('ピッピ', 'PIXTUPI'), true);
assert.equal(accepts('けーき', 'KE-KI'), true);
assert.equal(accepts('かんい', 'KANNI'), true);
assert.equal(accepts('かんい', "KAN'I"), true);
assert.equal(accepts('かんい', 'KANI'), false);
assert.equal(accepts('かんたん', 'KANTANN'), true);
assert.equal(accepts('かんたん', 'KANNTANN'), true);
assert.equal(createRomajiInputMatcher('し', ['CUSTOM']).isComplete('CUSTOM'), true);

for (const item of [...HIRAGANA_DATA, ...WORD_DATA]) {
    for (const question of item.chars) {
        const matcher = createRomajiInputMatcher(question.h, question.r || []);
        const suggestion = matcher.getSuggestion('');
        assert.ok(suggestion, `${item.id}: ${question.h} has no romaji suggestion`);
        assert.equal(matcher.isComplete(suggestion), true, `${item.id}: ${question.h} rejects ${suggestion}`);
        for (const manualPattern of question.r || []) {
            assert.equal(
                matcher.isComplete(manualPattern),
                true,
                `${item.id}: ${question.h} rejects registered pattern ${manualPattern}`
            );
        }
    }
}

const learnedHiragana = new Set(HIRAGANA_DATA.flatMap(stage => stage.chars.map(question => question.h)));
const basicWordStage = WORD_DATA.find(stage => stage.id === 4001);
assert.ok(basicWordStage, 'Hiragana word-practice stage 4001 is missing');

const usedHiragana = new Set();
for (const question of basicWordStage.chars) {
    for (const character of question.h) {
        assert.equal(
            learnedHiragana.has(character),
            true,
            `4001: ${question.h} contains unlearned character ${character}`
        );
        usedHiragana.add(character);
    }
}

assert.deepEqual(
    [...learnedHiragana].filter(character => !usedHiragana.has(character)),
    [],
    'Hiragana word practice does not cover every learned character'
);

console.log('Romaji input checks passed.');
