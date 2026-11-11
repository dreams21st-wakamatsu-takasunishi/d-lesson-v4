import { currentUser, users, canWriteCurrentUserRow, saveUsers, recordPracticeActivity, refreshStudentIdleLogoutTimer, loadCurrentMockExamCatalog } from '../api/user.js';
import { showScreen } from '../ui/screen.js';
import { showCustomAlert, showCustomConfirm } from '../ui/modal.js';
import { attachOfficialExamFrame } from '../utils/official-exam-frame.js';
import { scoreMockExam, getMockExamReviewOperations } from '../utils/mock-exam-scoring.js';
import { getMockExamCoinReward } from '../utils/text-coin-rewards.js';
import { mockGuidePlainText, renderMockGuide } from '../utils/mock-exam-guide.js';

let catalog = [], run = null, bridge = null, interval = null, generation = 0, narration = null, currentGuide = '';
let catalogVersion = 0, catalogLoading = false, catalogPoll = null;
const $ = id => document.getElementById(id);
const active = () => $('screen-mock-exam').classList.contains('active');

function cancelNarration(completed = false) {
    const pending = narration; narration = null;
    if (pending) {
        clearTimeout(pending.timeout);
        if (pending.utterance) { pending.utterance.onend = null; pending.utterance.onerror = null; }
    }
    window.speechSynthesis?.cancel();
    pending?.resolve(completed);
}
function playNarration(pending) {
    clearTimeout(pending.timeout);
    if (pending.utterance) { pending.utterance.onend = null; pending.utterance.onerror = null; }
    window.speechSynthesis?.cancel();
    if (!$('mock-voice').checked || !('speechSynthesis' in window)) return cancelNarration(true);
    const utterance = new SpeechSynthesisUtterance(pending.text);
    utterance.lang = 'ja-JP'; utterance.rate = 0.9; pending.utterance = utterance;
    const done = () => { if (narration === pending && pending.utterance === utterance) cancelNarration(true); };
    pending.timeout = setTimeout(done, 60000);
    utterance.onend = done; utterance.onerror = done;
    try { window.speechSynthesis.speak(utterance); } catch { done(); }
}
function speak(text) {
    cancelNarration();
    return new Promise(resolve => { narration = { text, resolve }; playNarration(narration); });
}
function guide(text, target) {
    currentGuide = mockGuidePlainText(text);
    renderMockGuide($('mock-guide-text'), text);
    if (target !== undefined) {
        $('mock-next').classList.toggle('mock-action-highlight', target === '#mock-next');
        bridge?.highlight(target === '#mock-next' ? null : target);
    }
    return speak(currentGuide);
}
export function repeatMockGuide() {
    if (run?.phase === 'audio-check') $('mock-voice').checked = true;
    if (narration) playNarration(narration);
    else void speak(currentGuide);
}
export function stopMockVoice() { if (!$('mock-voice').checked) cancelNarration(true); }

function setGuideExpanded(expanded) {
    $('mock-guide-toggle').setAttribute('aria-expanded', String(expanded));
}

$('mock-guide-toggle').addEventListener('click', () => {
    const expanded = $('mock-guide-toggle').getAttribute('aria-expanded') !== 'true';
    setGuideExpanded(expanded);
    if (expanded) $('mock-guide-text').focus({ preventScroll: true });
});
$('mock-guide-toggle').closest('.mock-guide').addEventListener('keydown', event => {
    if (event.target === $('mock-guide-text') && ['ArrowUp', 'ArrowDown'].includes(event.key)) event.stopPropagation();
    if (event.key !== 'Escape' || !$('mock-guide-toggle').getClientRects().length || $('mock-guide-toggle').getAttribute('aria-expanded') !== 'true') return;
    event.preventDefault();
    event.stopPropagation();
    setGuideExpanded(false);
    $('mock-guide-toggle').focus();
});

function cleanup() {
    generation++; clearInterval(interval); interval = null; cancelNarration();
    catalogVersion++; catalogLoading = false; clearInterval(catalogPoll); catalogPoll = null;
    bridge?.destroy(); bridge = null; run = null;
    setGuideExpanded(false);
    $('mock-next').classList.remove('mock-action-highlight');
    $('mock-official-frame').src = 'about:blank';
    $('mock-answer-review').replaceChildren();
    $('mock-result-summary').textContent = ''; $('mock-result-details').textContent = ''; $('mock-result-coins').textContent = '';
}

export function openMockExam() {
    cleanup();
    if (!currentUser || !users[currentUser]) { showCustomAlert('ユーザーを選択してください。'); showScreen('screen-title'); return; }
    document.querySelectorAll('.confetti').forEach(particle => particle.remove());
    catalog = [];
    $('mock-menu').hidden = false; $('mock-official-host').hidden = true; $('mock-results').hidden = true; $('mock-audio-check').hidden = true;
    $('mock-next').hidden = true; $('mock-stop').hidden = true;
    $('mock-exam-title').textContent = '検定模擬試験';
    const menuGuide = '{受検|じゅけん}する{回|かい}をえらびましょう。';
    currentGuide = mockGuidePlainText(menuGuide); renderMockGuide($('mock-guide-text'), menuGuide); $('mock-timer').textContent = '10:00';
    $('mock-round-grid').replaceChildren();
    showScreen('screen-mock-exam');
    void refreshMockExamMenu();
    catalogPoll = setInterval(() => { if (active() && !run && !document.hidden) void refreshMockExamMenu(); }, 60000);
}

export async function refreshMockExamMenu() {
    if (!active() || run || !currentUser || !users[currentUser]) return false;
    const version = ++catalogVersion, owner = currentUser;
    catalogLoading = true; $('mock-catalog-status').textContent = '問題を確認しています...';
    $('mock-round-grid').querySelectorAll('button').forEach(button => { button.disabled = true; });
    $('mock-refresh').disabled = true;
    try {
        const result = await loadCurrentMockExamCatalog();
        if (version !== catalogVersion || owner !== currentUser || !active() || run) return false;
        catalog = result.catalog.filter(problem => !problem.hidden);
        renderMockExamCards();
        $('mock-catalog-status').textContent = catalog.length ? (result.revision ? `配信版 ${result.revision}` : '') : '受検できる問題はありません。';
        return true;
    } catch (error) {
        if (version === catalogVersion && active() && !run) {
            catalog = []; $('mock-round-grid').replaceChildren();
            $('mock-catalog-status').textContent = error instanceof Error ? error.message : '問題を取得できませんでした。';
        }
        return false;
    } finally { if (version === catalogVersion) { catalogLoading = false; $('mock-refresh').disabled = false; } }
}
function renderMockExamCards() {
    const grid = $('mock-round-grid'); grid.replaceChildren();
    for (const problem of catalog) {
        const item = document.createElement('article'); item.className = 'mock-round-item';
        const button = document.createElement('button'); button.className = 'stage-btn text-task-card unlocked mock-round-card'; button.dataset.round = problem.id;
        const title = document.createElement('strong'); title.textContent = problem.title;
        const detail = document.createElement('span'); detail.textContent = `10分間 / ${[...problem.reference].length.toLocaleString()}文字`;
        const previous = (users[currentUser].mockExamRecords || []).filter(record => record.problemId === problem.id);
        const best = document.createElement('small'); best.textContent = previous.length ? `さいこう ${Math.max(...previous.map(record => record.net))}文字` : 'まだ';
        button.append(title, detail, best); button.onclick = () => selectMockExam(problem.id); item.append(button);
        grid.append(item);
    }
}

export async function selectMockExam(id) {
    if (catalogLoading || !await refreshMockExamMenu()) return;
    const problem = catalog.find(problem => problem.id === id);
    if (!problem || !currentUser || !users[currentUser]) return;
    cleanup();
    run = { userId: currentUser, problem: structuredClone(problem), phase: 'audio-check', number: '', name: '', committed: '', answer: '', result: null, coins: 0 };
    $('mock-menu').hidden = true; $('mock-official-host').hidden = true; $('mock-results').hidden = true; $('mock-audio-check').hidden = false;
    $('mock-next').hidden = true; $('mock-stop').hidden = true;
    $('mock-exam-title').textContent = problem.title;
    setPhase(); next('{聞|き}こえた・{次|つぎ}へ');
    void guide('ヘッドホンをつけてください。この{音声|おんせい}が、はっきり{聞|き}こえますか。{音|おと}が{小|ちい}さいときや{大|おお}きすぎるときは、{音量|おんりょう}を{調整|ちょうせい}しましょう。{聞|き}こえたら「{聞|き}こえた・{次|つぎ}へ」を{押|お}してください。', '#mock-next');
}

function loadOfficialExam() {
    if (!run || run.userId !== currentUser || !active()) return;
    run.phase = 'loading'; setPhase(); $('mock-audio-check').hidden = true; $('mock-official-host').hidden = false;
    $('mock-next').hidden = true;
    void guide('{画面|がめん}を{開|ひら}いています。', null);
    const frame = $('mock-official-frame'); frame.style.visibility = 'hidden'; frame.inert = false;
    bridge = attachOfficialExamFrame(frame, {
        onActivity: refreshStudentIdleLogoutTimer,
        canEdit: () => Boolean(run && currentUser === run.userId && run.phase === 'exam' && Date.now() < run.deadline),
        onStart() { if (!run) return; run.phase = 'registration'; setPhase(); void guide('{受験者登録|じゅけんしゃとうろく}を{押|お}してください。', '#start'); },
        onLoading() { if (!run) return; run.phase = 'loading-editor'; setPhase(); void guide('{入力画面|にゅうりょくがめん}を{開|ひら}いています。'); },
        onRegistrationDialog() { if (!run) return; void guide('{受験番号|じゅけんばんごう}と{名前|なまえ}を{入力|にゅうりょく}してください。{入力|にゅうりょく}できたら、ＯＫを{押|お}してください。'); },
        onRegistered(number, name) {
            if (!run) return; run.number = number; run.name = name; run.phase = 'registered'; setPhase();
            void guide('{表示|ひょうじ}された{受験番号|じゅけんばんごう}と{名前|なまえ}を{確認|かくにん}してください。{間違|まちが}いがなければ、{入力画面|にゅうりょくがめん}を{開|ひら}く、を{押|お}してください。', '#startExam');
        },
        onEditor: preparePaper,
        onAnswer(answer) { if (run?.phase === 'exam') run.committed = answer; },
        onSave: saveMockAnswer,
        onError(message) { showCustomAlert(message); openMockExam(); }
    });
    frame.src = new URL(`${import.meta.env.BASE_URL}official-exam/start.html`, document.baseURI).href;
}

function setPhase() { $('mock-official-host').dataset.phase = run?.phase || ''; }
function next(label) { renderMockGuide($('mock-next'), label); $('mock-next').hidden = false; $('mock-next').disabled = false; }
function preparePaper() {
    if (!run) return;
    run.phase = 'paper'; setPhase(); next('{準備|じゅんび}できた');
    void guide(`{第|だい}${run.problem.round}{回|かい}{過去問題|かこもんだい}の{問題用紙|もんだいようし}を、{教室内|きょうしつない}にあるファイルから{持|も}ってきてください。{裏面|うらめん}の{白紙|はくし}を{上|うえ}にして{置|お}きます。{準備|じゅんび}ができたら、「{準備|じゅんび}できた」を{押|お}してください。`, '#mock-next');
}

export async function advanceMockExam() {
    if (run?.phase === 'audio-check') { loadOfficialExam(); return; }
    if (!run || run.phase !== 'paper') return;
    setGuideExpanded(false);
    const session = run, token = generation;
    const current = () => run === session && token === generation && currentUser === session.userId && active();
    run.phase = 'countdown'; setPhase(); $('mock-next').disabled = true;
    await guide('{試験時間|しけんじかん}は１０{分間|ぷんかん}です。{用意|ようい}して、の{合図|あいず}で{用紙|ようし}を{開|ひら}いてください。{始|はじ}め、の{合図|あいず}で{入力|にゅうりょく}を{始|はじ}めます。{残|のこ}り{時間|じかん}２{分|ふん}になったらお{知|し}らせします。{試験中|しけんちゅう}の{質問|しつもん}はできません。', null);
    if (!current()) return;
    await guide('{用意|ようい}して。');
    for (let count = 3; count > 0; count--) { if (!current()) return; $('mock-timer').textContent = String(count); await new Promise(resolve => setTimeout(resolve, 1000)); }
    if (!current()) return;
    bridge.clear(); run.committed = ''; run.phase = 'exam'; setPhase();
    run.startedAt = Date.now(); run.deadline = run.startedAt + 10 * 60000; run.warned = false;
    $('mock-next').hidden = true; $('mock-stop').hidden = false;
    bridge.setEditable(true); bridge.focus(); void guide('{始|はじ}め！', null);
    interval = setInterval(updateClock, 200); updateClock();
}

function updateClock() {
    if (!run || run.phase !== 'exam') return;
    if (currentUser !== run.userId || !active()) return cleanup();
    const seconds = Math.max(0, Math.ceil((run.deadline - Date.now()) / 1000));
    $('mock-timer').textContent = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
    if (!seconds) return finish();
    if (run.phase === 'exam' && seconds <= 120 && !run.warned) { run.warned = true; void guide('８{分|ふん}{経過|けいか}しました。{残|のこ}り{時間|じかん}２{分|ふん}です。'); }
}
async function finish(early = false) {
    if (!run || run.phase !== 'exam') return;
    clearInterval(interval); interval = null; bridge.lock(); run.committed = bridge.getAnswer();
    $('mock-stop').hidden = true;
    const session = run, token = generation;
    run.phase = 'announcing-result'; setPhase(); run.answer = run.committed; run.early = early;
    $('mock-official-frame').inert = true;
    run.elapsedSeconds = Math.min(600, Math.max(0, Math.floor((Date.now() - run.startedAt) / 1000)));
    run.result = scoreMockExam(run.problem.reference, run.answer); $('mock-full-text').checked = false;
    const announcement = guide('やめ。キーボードから{手|て}を{離|はな}し、{問題用紙|もんだいようし}を{閉|と}じて{裏面|うらめん}の{白紙|はくし}を{上|うえ}にしてください。{結果|けっか}を{表示|ひょうじ}します。', null);
    if (run.userId === currentUser && users[currentUser] && canWriteCurrentUserRow()) {
        const { gross, mistakes, net, grade } = run.result;
        run.coins = getMockExamCoinReward(net);
        const record = { id: crypto.randomUUID(), problemId: run.problem.id, title: run.problem.title, gross, mistakes, net, grade, coins: run.coins, early, fullText: false, elapsedSeconds: run.elapsedSeconds, finishedAt: new Date().toISOString() };
        const user = users[currentUser];
        user.coins = (Number(user.coins) || 0) + run.coins;
        user.mockExamRecords = [...(Array.isArray(user.mockExamRecords) ? user.mockExamRecords : []), record].slice(-50);
        recordPracticeActivity({ category: 'keyboard', stageId: `mock_exam_${run.problem.id.replace(/-/g,'_')}`, title: `検定模擬試験 ${run.problem.title}`, detail: early ? '途中終了' : '10分間終了', amount: `純字数 ${net} / 総字数 ${gross} / ミス ${mistakes}`, coins: run.coins });
        void saveUsers(false);
    }
    const completed = await announcement;
    if (!completed || run !== session || generation !== token || currentUser !== session.userId || !active()) return;
    bridge.destroy(); bridge = null; $('mock-official-frame').src = 'about:blank';
    $('mock-official-host').hidden = true;
    run.phase = 'finished'; setPhase();
    renderResult();
}
export function stopMockExam() {
    if (!run || run.phase !== 'exam') return;
    const session = run; showCustomConfirm('時間になる前に終了しますか？', () => { if (run === session) finish(true); });
}
export function toggleMockFullText() {
    if (!run || run.phase !== 'finished' || run.userId !== currentUser) return;
    renderResult();
}
function renderResult() {
    const { gross, mistakes, net, grade, details } = run.result;
    const operations = getMockExamReviewOperations(run.result, { fullText: $('mock-full-text').checked });
    $('mock-results').hidden = false;
    $('mock-result-summary').textContent = `${run.early ? '途中終了・' : ''}参考採点：純字数 ${net}文字（総字数 ${gross} − ミス ${mistakes}）／ ${grade}相当`;
    $('mock-result-details').textContent = `誤字・空白 ${details.wrong} ／ 脱字・改行抜け ${details.omitted} ／ 余分な文字・改行 ${details.extra} ／ 半角 ${details.halfWidth} ／ 読点混在 ${details.commaMix}`;
    $('mock-result-coins').textContent = `獲得コイン：${run.coins.toLocaleString('ja-JP')} 枚`;
    const review = $('mock-answer-review'); review.replaceChildren();
    for (const op of operations) {
        const span = document.createElement('span'); span.className = `mock-diff-${op.type}`;
        span.textContent = (op.type === 'omitted' || op.type === 'untyped' ? op.expected : op.typed).replace(/\n/g,'↵\n').replace(/ /g,'␣').replace(/　/g,'□');
        span.title = op.type === 'untyped' ? '未入力（採点対象外）' : op.type === 'correct' ? '' : `正解：${op.expected || '（なし）'} ／ 入力：${op.typed || '（抜け）'}`;
        review.append(span);
    }
    if (!operations.length) review.textContent = '入力はありません。';
}
export function saveMockAnswer() {
    if (!run) return;
    const result = run.result;
    const text = `Dレッスン 模擬試験（本番提出用ではありません）\n${run.problem.title}\n受験番号：${run.number}\n名前：${run.name}\n${result ? `参考採点：総字数 ${result.gross} / ミス ${result.mistakes} / 純字数 ${result.net}` : '途中保存'}\n\n${result ? run.answer : bridge.getAnswer()}`;
    const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }));
    const link = document.createElement('a'); link.href = url; link.download = `Dレッスン模擬試験_${run.problem.id}_${new Date().toISOString().slice(0,10)}.txt`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function leaveMockExam() {
    const leave = () => { cleanup(); showScreen('screen-text-category'); };
    if (run && run.phase !== 'finished') showCustomConfirm('模擬試験をやめて戻りますか？ 入力中の内容は消えます。', leave);
    else leave();
}
document.addEventListener('lesson:screen-change', event => {
    if (event.detail.id !== 'screen-mock-exam' && (run || catalogPoll)) {
        cleanup(); catalog = []; $('mock-round-grid').replaceChildren();
    }
});
document.addEventListener('visibilitychange', () => { updateClock(); if (!document.hidden && active() && !run) void refreshMockExamMenu(); });
window.addEventListener('focus', () => { if (active() && !run) void refreshMockExamMenu(); });
