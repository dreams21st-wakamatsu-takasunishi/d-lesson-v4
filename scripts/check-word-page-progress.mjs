import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import vm from 'node:vm';
import {WORD_STAGES} from '../src/data/constants.js';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const ts = createRequire(import.meta.url)('typescript');
const source = read('src/games/word.js');
const ast = ts.createSourceFile('word.js', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
const names = ['getWordStageProgress', 'getCurrentWordStageLabel', 'readWordPageInput', 'startWordStage', 'suspendWordTask', 'confirmWordClear', 'openWordText'];
const functions = ast.statements.filter(node => ts.isFunctionDeclaration(node) && names.includes(node.name?.text));
assert.equal(functions.length, names.length);
const code = ts.transpileModule(functions.map(node => node.getText(ast)).join('\n'), {
    compilerOptions: {module: ts.ModuleKind.CommonJS}
}).outputText;
const html = read('index.html');
assert.match(html, /id="word-page-input"[^>]*min="1"[^>]*max="9999"[^>]*step="1"[^>]*required/);
assert.match(html, /id="word-page-saved"/);
assert.doesNotMatch(html, /onclick="openWordText\(\)"/);

const nodes = new Map();
function node(id) {
    if (!nodes.has(id)) nodes.set(id, {value:'', textContent:'', classList:{contains:()=>true}});
    return nodes.get(id);
}
const input = node('word-page-input');
input.reportValidity = () => input.value.trim() !== '' && Number.isInteger(Number(input.value)) && Number(input.value) >= 1 && Number(input.value) <= 9999;
const users = {fixture: {wordProgress:{}, practiceLogs:[{id:'old-log'}], coins:50}};
let saveResult = true;
let saveCalls = 0;
let menuCalls = 0;
let linked = true;
let requests = [];
let submission;
let approval;
let guest = false;
const alerts = [];
const fakeModule = {exports:{}};
const context = vm.createContext({
    module:fakeModule, exports:fakeModule.exports, WORD_STAGES,
    currentUser:'fixture', users, currentWordStageId:null, savingWord:false, wordReviewState:{},
    document:{getElementById:node, querySelector:()=>({})},
    showScreen() {}, renderReviewStatus() {}, refreshWordReviews() {},
    goToWordMenu() { menuCalls++; },
    canWriteCurrentUserRow:()=>true,
    async saveUsers() { saveCalls++; return saveResult; },
    recordPracticeActivity(entry) { users.fixture.practiceLogs = [{...entry}, ...users.fixture.practiceLogs]; },
    SoundManager:{playClick() {}}, showCustomAlert:message=>alerts.push(message),
    isGuestMode:()=>guest, getCurrentLessonRole:()=>'student',
    loadStudentWordReviews:async()=>({linked, requests}),
    wordRequest:stageId=>requests.find(row=>row.stageId===stageId),
    showWordSubmissionDialog:options=>{submission=options;},
    showWordApprovalDialog:options=>{approval=options;},
    getUserDisplayName:()=> 'Fixture', WORD_PDF_SUSPENSION_MESSAGE:'Paper only'
});
vm.runInContext(code, context);
const api = fakeModule.exports;
// Non-exported stage entry is exercised without unlocking or modifying real learners.
const enter = vm.runInContext('startWordStage', context);
const stageId = WORD_STAGES[0].id;
users.fixture.wordProgress[stageId] = {status:'working', page:'12', extra:'keep'};
enter(stageId);
assert.equal(input.value, '12');
assert.equal(node('word-page-saved').textContent, '前のきろく：12ページまで');
assert.equal(node('word-stage-status').textContent, '12ページまで きろくずみ');
input.value = '18';
await api.suspendWordTask();
assert.equal(saveCalls, 1);
assert.equal(menuCalls, 1);
assert.equal(users.fixture.wordProgress[stageId].page, '18');
assert.equal(users.fixture.wordProgress[stageId].status, 'working');
assert.equal(users.fixture.wordProgress[stageId].extra, 'keep');
assert.equal(users.fixture.practiceLogs[0].amount, '18ページまで');
assert.equal(users.fixture.practiceLogs[0].category, 'word');
assert.equal(users.fixture.practiceLogs[0].coins, 0);
assert.equal(users.fixture.coins, 50);
assert.equal(submission, undefined, 'Saving a page must not submit or approve a work.');
enter(stageId);
assert.equal(input.value, '18', 'Reopening must restore the saved printed-book page.');

for (const value of ['', '0', '-1', '1.5', '10000']) {
    input.value = value;
    await api.suspendWordTask();
    assert.equal(saveCalls, 1, `Invalid page must not save: ${value}`);
}
const oldProgress = users.fixture.wordProgress[stageId];
const oldLogs = users.fixture.practiceLogs;
saveResult = false;
input.value = '22';
await api.suspendWordTask();
assert.equal(users.fixture.wordProgress[stageId], oldProgress);
assert.equal(users.fixture.practiceLogs, oldLogs);
assert.equal(menuCalls, 1, 'Failed saves must remain on the current page.');

saveResult = true;
users.fixture.wordProgress[stageId] = 'cleared';
input.value = '30';
await api.suspendWordTask();
assert.equal(users.fixture.wordProgress[stageId].status, 'cleared');
users.fixture.wordProgress[stageId] = {status:'cleared', page:'30', approvedBy:'fixture-staff', approvedAt:'fixture-date'};
input.value = '31';
await api.suspendWordTask();
assert.equal(users.fixture.wordProgress[stageId].approvedBy, 'fixture-staff');
assert.equal(users.fixture.wordProgress[stageId].approvedAt, 'fixture-date');
assert.equal(users.fixture.coins, 50);

input.value = '1e2';
await api.confirmWordClear();
assert.equal(submission.page, '100', 'Submission must use the same normalized printed-book page.');
assert.equal(submission.stageId, stageId);
assert.equal(submission.studentId, 'fixture');
assert.equal(approval, undefined, 'Linked children must keep the D Support submission path.');
submission = undefined;
requests = [{stageId, status:'pending'}];
await api.confirmWordClear();
assert.equal(submission, undefined, 'Pending submissions must not be duplicated.');
requests = [];
linked = false;
await api.confirmWordClear();
assert.equal(approval.page, '100', 'Unlinked children must keep the existing teacher confirmation path.');
guest = true;
approval = undefined;
await api.confirmWordClear();
assert.equal(approval, undefined);
api.openWordText();
assert.equal(alerts.at(-1), 'Paper only', 'Discontinued textbook calls must never open a URL.');
assert.match(read('src/ui/word-submission-dialog.js'), /accept="application\/pdf,image\/png,image\/jpeg"/);
console.log('Printed-book page save/reopen, validation, rollback, legacy progress and Word submission compatibility passed.');
