import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { STAGE_ORDER } from '../src/data/constants.js';
import { ONE_HAND_STAGES, getHandKeys, getHandWords } from '../src/data/one-hand.js';
import { createRomajiInputMatcher } from '../src/utils/romaji-input.js';
import { normalizeOfficialAnswer } from '../src/utils/official-exam-frame.js';
import officialProblems from '../src/data/mock-exam-problems.json' with { type: 'json' };
import { scoreMockExam } from '../src/utils/mock-exam-scoring.js';
import { loadExamCatalog, saveExamProblem, deleteExamProblem, parseManagedMockExamCatalog, defaultMockExamCatalog } from '../src/utils/mock-exam-catalog.js';
import { getTextCoinReward, getMockExamCoinReward } from '../src/utils/text-coin-rewards.js';
import { parseMockGuide, mockGuidePlainText } from '../src/utils/mock-exam-guide.js';

assert.deepEqual(parseMockGuide('「{準備|じゅんび}できた」を{押|お}す。'), [{text:'「'}, {text:'準備', reading:'じゅんび'}, {text:'できた」を'}, {text:'押', reading:'お'}, {text:'す。'}]);
assert.equal(mockGuidePlainText('{結果|けっか}を{表示|ひょうじ}します。'), '結果を表示します。');
assert.equal(mockGuidePlainText('<img onerror=alert(1)>'), '<img onerror=alert(1)>');

assert.equal(ONE_HAND_STAGES.length, 8);
for (const hand of ['left', 'right']) {
    const keys = getHandKeys(hand);
    assert.ok(keys.length > 15);
    for (const word of getHandWords(hand)) {
        const matcher = createRomajiInputMatcher(word.h, word.r, { allowedKeys: keys });
        assert.ok(matcher.isComplete(word.r[0]), word.h);
        assert.ok([...matcher.getSuggestion()].every(key => keys.includes(key)), word.h);
        for (const key of getHandKeys(hand === 'left' ? 'right' : 'left')) assert.equal(matcher.acceptsPrefix(key), false);
    }
    assert.deepEqual(ONE_HAND_STAGES.filter(stage => stage.hand === hand).map(stage => [stage.keyboard, stage.romaji, Boolean(stage.exam)]), [[true, true, false], [false, true, false], [false, false, false], [false, false, true]]);
}
assert.equal(createRomajiInputMatcher('か', ['CA'], { allowedKeys: getHandKeys('left') }).getSuggestion(), '');
assert.ok(createRomajiInputMatcher('もみじ', [], { allowedKeys: getHandKeys('right') }).isComplete('MOMIJI'));

assert.ok(STAGE_ORDER.every(id => typeof id === 'number'));
assert.equal(ONE_HAND_STAGES.find(stage => stage.id === 'hand_left_3').typedRomaji, true);
assert.equal(ONE_HAND_STAGES.find(stage => stage.id === 'hand_right_4').typedRomaji, true);
assert.equal(ONE_HAND_STAGES.find(stage => stage.id === 'hand_left_4').typedRomaji, true);
const tiers = [[1,20],[51,30],[101,50],[251,100],[351,500],[451,1000],[601,2500],[801,5000],[1001,8500],[1501,10000],[2001,15000]];
for (const [minimum, coins] of tiers) {
    assert.equal(getTextCoinReward(minimum), coins, `text reward at ${minimum}`);
    assert.equal(getTextCoinReward(minimum - 1), tiers.filter(([start]) => start < minimum).at(-1)?.[1] || 0);
    const examMinimum = Math.max(1, minimum - 1);
    assert.equal(getMockExamCoinReward(examMinimum), coins * 1.5, `mock reward at ${examMinimum}`);
    assert.equal(getMockExamCoinReward(examMinimum - 1), (tiers.filter(([start]) => start < minimum).at(-1)?.[1] || 0) * 1.5);
}
assert.equal(getMockExamCoinReward(0), 0);
assert.equal(getMockExamCoinReward(600), 3750);
assert.equal(normalizeOfficialAnswer(['　　　　　本文\n','続き']), '　本文\n続き');
assert.equal(officialProblems.length, 8);
assert.equal(defaultMockExamCatalog().length, 8);
assert.deepEqual(parseManagedMockExamCatalog([]), []);
const managed = defaultMockExamCatalog()[0];
for (const patch of [{id:'round-1'},{round:0},{title:'別問題'},{permissionConfirmed:false},{hidden:'false'},{reference:'　\n '}]) assert.throws(() => parseManagedMockExamCatalog([{...managed,...patch}]));
assert.throws(() => parseManagedMockExamCatalog([managed, managed]));
const officialManifest = JSON.parse(readFileSync(new URL('../public/official-exam/source-manifest.json', import.meta.url)));
for (const file of officialManifest.files.filter(file => !file.path.endsWith('.html'))) {
    const bytes = readFileSync(new URL('../public/official-exam/' + file.path, import.meta.url));
    assert.equal(createHash('sha256').update(bytes).digest('hex'), file.sourceSha256, `unchanged official asset ${file.path}`);
}
for (const problem of officialProblems) {
    let cumulative = 0;
    const paragraphs = problem.reference.split('\n');
    paragraphs.forEach((paragraph, i) => {
        assert.ok(paragraph.startsWith('　'));
        cumulative += [...paragraph].length + (i < paragraphs.length - 1 ? 1 : 0);
        assert.equal(cumulative, problem.printedParagraphCounts[i], `${problem.round} printed checkpoint ${i + 1}`);
    });
    const score = scoreMockExam(problem.reference, problem.reference, { fullText: true });
    assert.equal(score.mistakes, 0);
    assert.equal(score.net, cumulative, `${problem.round} official total includes paragraph breaks`);
}

const miss = (ref, input, expected, label) => assert.equal(scoreMockExam(ref, input, { fullText: true }).mistakes, expected, label);
assert.equal(scoreMockExam('　今日は晴れです。明日も晴れです。', '　今日は').mistakes, 0, 'unfinished suffix is free');
assert.equal(scoreMockExam('　今日は晴れです。', '').mistakes, 0, 'empty answer');
miss('使用した紙の', '私用した紙の', 1, 'wrong character');
miss('暮らしのさまざまな', '暮らしの様々な', 4, 'rule 1 unequal strings');
miss('今後はこの数字を', '今後は数字を', 2, 'omissions');
miss('必要だと', '必要とだ', 2, 'transposition');
miss('株式会社', '会社株式', 4, 'transposition four');
miss('　日本は昔から', '日本は昔から', 1, 'paragraph indentation');
miss('　文章です。\n　次です。', '　文章です。次です。', 2, 'newline and indent missing');
miss('　文章です。', '　文\n章です。', 1, 'extra newline');
miss('そして、それらは', 'そして、　　それらは', 1, 'surplus space run');
miss('紙の再生率', '紙の再生の再生率', 3, 'repeated partial phrase');
miss('４０、ニッケン、Ｊ．Ｐａｌｍｅｒ', '40、ﾆｯｹﾝ、J.Palmer', 1, 'half width once overall');
miss('ケーキ、パン、米', 'ケ－キ，パン，米', 0, 'allowed hyphen and consistent comma');
miss('米、パン、水', '米，パン、水', 1, 'comma mix once overall');
miss('１２３', '①②③', 3, 'compatibility characters are not accepted as width variants');
const repeated = scoreMockExam('　晴れです。', '　晴れです。　晴れです。');
assert.equal(repeated.gross, 6);
assert.equal(repeated.mistakes, 0);
assert.ok(repeated.ignoredRepeat);
assert.equal(scoreMockExam('あ'.repeat(50), 'あ'.repeat(50)).grade, '6級');
assert.throws(() => scoreMockExam('', 'test'));
const memory = new Map();
const storage = { getItem: key => memory.get(key) || null, setItem: (key, value) => memory.set(key, value) };
assert.throws(() => saveExamProblem(storage, 'main', { round: 78, reference: '　架空の文章。', permissionConfirmed: false }));
saveExamProblem(storage, 'main', { round: 78, reference: '　架空の文章。', permissionConfirmed: true });
assert.equal(loadExamCatalog(storage, 'main').length, 8);
assert.equal(loadExamCatalog(storage, 'other').length, 8);
assert.equal(loadExamCatalog(storage, 'other')[0].reference, officialProblems[0].reference);
saveExamProblem(storage, 'main', { round: 78, reference: '　修正版。', permissionConfirmed: true });
assert.equal(loadExamCatalog(storage, 'main')[0].reference, '　修正版。');
deleteExamProblem(storage, 'main', 'round-78');
assert.equal(loadExamCatalog(storage, 'main')[0].reference, officialProblems[0].reference);
console.log('Keyboard extras checks passed: hand-only words, shared romaji, 8 official papers and printed paragraph counts, scoring rules, permitted catalog.');
