import { WORD_STAGES } from '../data/constants.js';
import {canOpenTaskStage} from '../utils/task-stages.js';
import {
    users,
    currentUser,
    saveUsers,
    isGuestMode,
    getUserDisplayName,
    canWriteCurrentUserRow,
    recordPracticeActivity,
    getPracticeLogs
} from '../api/user.js';
import {getCurrentLessonRole} from '../api/user.js';
import {loadStudentWordReviews,readWordStudentSnapshot} from '../api/word-review.js';
import {showWordSubmissionDialog} from '../ui/word-submission-dialog.js';
import { SoundManager } from '../utils/sound.js';
import { createBtn } from '../utils/dom.js';
import { showCustomAlert } from '../ui/modal.js';
import { showScreen } from '../ui/screen.js';
import { createConfetti } from '../ui/reward.js';
import { buildProgressLabel, findLatestPracticeLog, formatPracticeLogShort } from '../utils/practice-guidance.js';
import { showWordApprovalDialog } from '../ui/word-approval-dialog.js';
import { updateGlobalHeader } from '../ui/home-dashboard.js';

let currentWordStageId = null;
let savingWord = false;
let wordReviewState={userId:null,linked:false,requests:[]};
let loadingReviews=false;
function wordRequest(stageId){return wordReviewState.userId===currentUser?wordReviewState.requests.find(row=>row.stageId===stageId):null;}
function renderReviewStatus(){
    const section=document.getElementById('word-review-status');if(!section)return;
    const linked=wordReviewState.userId===currentUser&&wordReviewState.linked;
    section.hidden=!linked;
    const row=wordRequest(currentWordStageId),button=document.querySelector('[onclick="confirmWordClear()"]');
    if(button)button.disabled=linked&&['pending','approved'].includes(row?.status);
    section.querySelector('[role="status"]').textContent=row?.status==='pending'?'先生のかくにんをまっています':row?.status==='approved'?'先生がかくにんしました！':row?.status==='returned'?`もう一度チャレンジしよう！\n先生より: ${row.reason}`:row?.status==='expired'?'申請の期限・連携が変わりました。先生にかくにんしてね。':'作品を先生に送れます';
}
async function refreshWordReviews(){
    if(loadingReviews||!currentUser||isGuestMode()||getCurrentLessonRole()!=='student')return;
    const userId=currentUser;loadingReviews=true;
    try{
        const result=await loadStudentWordReviews(userId);if(currentUser!==userId)return;
        wordReviewState={userId,linked:result.linked,requests:result.requests};
        if(result.requests.some(row=>row.status==='approved')){
            const data=await readWordStudentSnapshot(userId);if(currentUser!==userId)return;
            if(data.supportWordRevision!==users[userId]?.supportWordRevision){users[userId]=data;updateGlobalHeader();}
        }
        if(document.getElementById('screen-word-menu').classList.contains('active'))renderWordMenu();
        renderReviewStatus();
    }catch(error){
        if(currentUser===userId){const section=document.getElementById('word-review-status');section.hidden=false;section.querySelector('[role="status"]').textContent=error.message||'先生の確認結果を取得できませんでした。';}
    }finally{loadingReviews=false;}
}
setInterval(()=>{if(document.visibilityState==='visible'&&(document.getElementById('screen-word-menu')?.classList.contains('active')||document.getElementById('screen-word-game')?.classList.contains('active')))void refreshWordReviews();},30000);
const WORD_TEXT_WINDOW_FEATURES = 'popup=yes,width=1180,height=820,menubar=no,toolbar=no,location=yes,status=no,scrollbars=yes,resizable=yes';

function getActiveUserOrTitle() {
    const u = currentUser ? users[currentUser] : null;
    if (u) return u;
    showCustomAlert('ユーザーを選択してください');
    showScreen('screen-title');
    return null;
}

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function getWordStageProgress(user, stageId) {
    const prog = user?.wordProgress?.[stageId];
    if (typeof prog === 'string') {
        return {
            isCleared: prog === 'cleared',
            isWorking: prog === 'working',
            workingPage: ''
        };
    }
    return {
        isCleared: prog?.status === 'cleared',
        isWorking: prog?.status === 'working',
        workingPage: prog?.page || ''
    };
}

function getWordMenuState(user) {
    let previousCleared = true;
    const rows = WORD_STAGES.map(stage => {
        const progress = getWordStageProgress(user, stage.id);
        const isUnlocked = previousCleared || user?.isMaster;
        const row = { stage, ...progress, isUnlocked };
        previousCleared = progress.isCleared;
        return row;
    });
    const done = rows.filter(row => row.isCleared).length;
    const next = rows.find(row => row.isUnlocked && !row.isCleared) || null;
    return { rows, done, total: WORD_STAGES.length, next };
}

function renderWordNextPanel(container, menuState) {
    const latestLog = findLatestPracticeLog(getPracticeLogs(), ['word']);
    const panel = document.createElement('div');
    panel.className = 'course-next-panel word-next-panel' + (menuState.next ? '' : ' is-complete');
    panel.innerHTML = `
        <div class="course-next-copy">
            <span class="course-next-label">つぎ</span>
            <strong>${escapeHtml(menuState.next?.stage?.title || 'Wordれんしゅうはできています')}</strong>
            <span class="course-next-meta">${escapeHtml(menuState.next?.stage?.sub || 'すべてみられます')}</span>
            <span class="course-next-log">${escapeHtml(formatPracticeLogShort(latestLog))}</span>
        </div>
        <div class="course-next-progress">
            <span>${escapeHtml(buildProgressLabel(menuState.done, menuState.total))}</span>
            <div class="course-next-bar"><i style="width:${menuState.total ? Math.round((menuState.done / menuState.total) * 100) : 0}%;"></i></div>
        </div>
    `;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'course-next-btn';
    button.textContent = menuState.next ? 'はじめる' : 'できた';
    button.disabled = !menuState.next;
    if (menuState.next) createBtn(button, () => startWordStage(menuState.next.stage.id));
    panel.appendChild(button);
    container.appendChild(panel);
}

export function goToWordMenu() {
    const u = getActiveUserOrTitle();
    if (!u) return;
    if (!u.isMaster) {
        if (!u.examRecords || !u.examRecords['romaji_daku_exam']) {
            showCustomAlert('Wordれんしゅう は、キーボードれんしゅうの\n「ローマ字いちらん表（だくてん テスト）」を\nクリアすると あそべるようになるよ！');
            return;
        }
    }
    renderWordMenu();
    showScreen('screen-word-menu');
    void refreshWordReviews();
}

function renderWordMenu() {
    const cont = document.getElementById('word-menu-content');
    cont.innerHTML = '';
    const u = users[currentUser];
    if (!u.wordProgress) u.wordProgress = {};

    const menuState = getWordMenuState(u);
    renderWordNextPanel(cont, menuState);

    menuState.rows.forEach(({ stage: st, isCleared, isWorking, workingPage, isUnlocked }) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'stage-btn';
        b.style.height = '100px';

        if (isUnlocked) {
            b.classList.add('unlocked');
            if (isCleared) b.classList.add('cleared');
            else if (isWorking) b.classList.add('working');
            if (menuState.next?.stage?.id === st.id) b.classList.add('next-target');

            createBtn(b, () => startWordStage(st.id));
        } else {
            b.disabled = true;
            b.style.opacity = '0.5';
        }

        b.innerHTML = `<span style="font-size:24px;">📘</span><span style="font-size:16px; font-weight:bold; color:#333; margin-top:5px;">${escapeHtml(st.title)}</span><span style="font-size:12px; color:#666;">${escapeHtml(st.sub)}</span>`;

        if (isCleared) b.innerHTML += `<span class="reward-badge" style="background:#e8f5e9; border-color:#4CAF50; color:#2e7d32;">クリア</span>`;
        else if(wordRequest(st.id)?.status==='pending')b.innerHTML+=`<span class="reward-badge">先生のかくにんまち</span>`;
        else if(wordRequest(st.id)?.status==='returned')b.innerHTML+=`<span class="reward-badge">もう一度チャレンジ</span>`;
        else if (isWorking) b.innerHTML += `<span class="reward-badge" style="background:#fffde7; border-color:#FFEB3B; color:#fbc02d;">やっているところ ⏸️ ${workingPage ? 'P.' + escapeHtml(workingPage) : ''}</span>`;
        else if (isUnlocked) b.innerHTML += `<span class="reward-badge">💰500</span>`;

        cont.appendChild(b);
    });
}

export function openAssignedWordStage(sid) {
    const user=users[currentUser];
    if(!canOpenTaskStage(user,'word',sid))return;
    if(!user.wordProgress)user.wordProgress={};
    startWordStage(sid);
}

function startWordStage(sid) {
    currentWordStageId = sid;
    const st = WORD_STAGES.find(s => s.id === sid);
    document.getElementById('word-stage-title').innerText = `${st.title}：${st.sub}`;

    let prog = users[currentUser].wordProgress[sid];
    let pageVal = '';
    if (prog && typeof prog === 'object') {
        pageVal = prog.page || '';
    }
    document.getElementById('word-page-input').value = pageVal;
    document.getElementById('word-stage-status').textContent = getWordStageProgress(users[currentUser], sid).isCleared ? 'クリアずみ' : pageVal ? `${pageVal}ページからのつづき` : 'これからチャレンジ';

    showScreen('screen-word-game');
    renderReviewStatus();
    document.querySelector('[data-word-review-refresh]').onclick=()=>void refreshWordReviews();
    void refreshWordReviews();
}

export function openWordText() {
    const st = WORD_STAGES.find(s => s.id === currentWordStageId);
    if (st && st.pdf && st.pdf !== '') {
        const popup = window.open(st.pdf, '_blank', WORD_TEXT_WINDOW_FEATURES);
        if (popup) popup.opener = null;
    }
    else showCustomAlert('テキストのURLが設定されていません。先生に確認してください。');
}

function getCurrentWordStageLabel() {
    const st = WORD_STAGES.find(s => s.id === currentWordStageId);
    if (!st) return 'Word練習';
    return `${st.title}${st.sub ? ` / ${st.sub}` : ''}`;
}

export async function suspendWordTask() {
    if (savingWord || !currentWordStageId || !users[currentUser]) return;
    if (!canWriteCurrentUserRow()) {
        showCustomAlert('先生のかくにん中は、Wordのとちゅうほぞんはできません。生徒本人または管理者で操作してください。');
        return;
    }

    const u = users[currentUser];
    const userId = currentUser;
    const stageId = currentWordStageId;
    const input = document.getElementById('word-page-input');
    if (!input.reportValidity()) return;
    if (!u.wordProgress) u.wordProgress = {};

    let pageVal = document.getElementById('word-page-input').value;
    let prog = u.wordProgress[currentWordStageId];
    const previousLogs = u.practiceLogs;

    let isCleared = (prog === 'cleared' || (prog && prog.status === 'cleared'));

    u.wordProgress[currentWordStageId] = {
        ...(prog && typeof prog === 'object' ? prog : {}),
        status: isCleared ? 'cleared' : 'working',
        page: pageVal
    };
    recordPracticeActivity({
        category: 'word',
        stageId: String(stageId),
        title: getCurrentWordStageLabel(),
        detail: isCleared ? 'クリアずみページをこうしん' : 'とちゅうほぞん',
        amount: pageVal ? `${pageVal}ページまで` : 'ページなし',
        coins: 0
    });
    savingWord = true;
    let saved;
    try { saved = await saveUsers(false); } catch { saved = false; } finally { savingWord = false; }
    if (!saved) {
        if (prog === undefined) delete u.wordProgress[stageId];
        else u.wordProgress[stageId] = prog;
        u.practiceLogs = previousLogs;
        showCustomAlert('保存できませんでした。通信を確認して、もう一度保存してください。');
        return;
    }
    if (currentUser !== userId || currentWordStageId !== stageId || !document.getElementById('screen-word-game').classList.contains('active')) return;
    SoundManager.playClick();
    showCustomAlert('「やっているところ ⏸️」としてきろくしました！\nデータをほぞんしてWordをとじたら、つぎはつづきからできます。');
    goToWordMenu();
}

export async function confirmWordClear() {
    if (savingWord || !currentWordStageId || !users[currentUser]) return;
    if (isGuestMode()) { showCustomAlert('ゲストでは先生の承認は保存できません。登録したアカウントで取り組んでね。'); return; }
    const input = document.getElementById('word-page-input');
    if (!input.reportValidity()) return;
    const userId = currentUser;
    const stageId = currentWordStageId;
    if(getCurrentLessonRole()==='student'){
        let state;try{state=await loadStudentWordReviews(userId);}catch(error){showCustomAlert(error.message);return;}
        if(currentUser!==userId||currentWordStageId!==stageId||!document.getElementById('screen-word-game').classList.contains('active'))return;
        wordReviewState={userId,linked:state.linked,requests:state.requests};
        if(state.linked){
            const row=wordRequest(stageId);if(row?.status==='pending'){showCustomAlert('先生のかくにんをまっています。');renderReviewStatus();return;}
            if(row?.status==='approved'){await refreshWordReviews();return;}
            showWordSubmissionDialog({studentId:userId,stageId,page:input.value,stageTitle:getCurrentWordStageLabel(),
                isCurrent:()=>currentUser===userId&&currentWordStageId===stageId&&document.getElementById('screen-word-game').classList.contains('active'),
                onSubmitted:()=>{showCustomAlert('先生に送りました！\n先生のかくにんをまってね。');void refreshWordReviews().then(()=>{if(currentUser===userId)renderWordMenu();});}});
            return;
        }
    }
    showWordApprovalDialog({
        studentName: getUserDisplayName(userId), stageTitle: getCurrentWordStageLabel(),
        userDataId: userId, stageId, page: input.value,
        isCurrent: () => currentUser === userId && currentWordStageId === stageId && document.getElementById('screen-word-game').classList.contains('active'),
        onApproved: result => {
            users[userId] = result.data;
            showWordApprovalFeedback(result.coinGain, userId);
        }
    });
}

function showWordApprovalFeedback(coinGain, userId) {
    updateGlobalHeader();
    SoundManager.playClear();
    createConfetti();

    document.getElementById('feedback-text').innerText = 'Word マスター！';
    document.getElementById('feedback-time').textContent = coinGain > 0 ? `+${coinGain} コインゲット！` : '先生のかくにんができました';
    document.getElementById('feedback-time').style.display = 'block';
    document.getElementById('feedback-stats').style.display = 'none';
    document.getElementById('feedback-overlay').style.display = 'flex';

    setTimeout(() => {
        document.getElementById('feedback-overlay').style.display = 'none';
        if (currentUser === userId && document.getElementById('screen-word-game').classList.contains('active')) goToWordMenu();
    }, 4000);
}
