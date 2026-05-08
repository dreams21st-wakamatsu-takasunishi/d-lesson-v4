import { WORD_STAGES } from '../data/constants.js';
import {
    users,
    currentUser,
    saveUsers,
    hasLessonRole,
    canWriteCurrentUserRow,
    recordPracticeActivity
} from '../api/user.js';
import { SoundManager } from '../utils/sound.js';
import { createBtn } from '../utils/dom.js';
import { showCustomAlert } from '../ui/modal.js';
import { showScreen } from '../ui/screen.js';
import { createConfetti } from '../ui/reward.js';

let currentWordStageId = null;

function getActiveUserOrTitle() {
    const u = currentUser ? users[currentUser] : null;
    if (u) return u;
    showCustomAlert('ユーザーを選択してください');
    showScreen('screen-title');
    return null;
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
}

function renderWordMenu() {
    const cont = document.getElementById('word-menu-content');
    cont.innerHTML = '';
    const u = users[currentUser];
    if (!u.wordProgress) u.wordProgress = {};

    let previousCleared = true;

    WORD_STAGES.forEach((st) => {
        let prog = u.wordProgress[st.id];
        let isCleared = false;
        let isWorking = false;
        let workingPage = '';

        if (prog) {
            if (typeof prog === 'string') {
                isCleared = (prog === 'cleared');
                isWorking = (prog === 'working');
            } else {
                isCleared = (prog.status === 'cleared');
                isWorking = (prog.status === 'working');
                workingPage = prog.page || '';
            }
        }

        const isUnlocked = previousCleared || u.isMaster;

        const b = document.createElement('div');
        b.className = 'stage-btn';
        b.style.height = '100px';

        if (isUnlocked) {
            b.classList.add('unlocked');
            if (isCleared) b.classList.add('cleared');
            else if (isWorking) b.classList.add('working');

            createBtn(b, () => startWordStage(st.id));
        } else {
            b.style.opacity = '0.5';
        }

        b.innerHTML = `<span style="font-size:24px;">📘</span><span style="font-size:16px; font-weight:bold; color:#333; margin-top:5px;">${st.title}</span><span style="font-size:12px; color:#666;">${st.sub}</span>`;

        if (isCleared) b.innerHTML += `<span class="reward-badge" style="background:#e8f5e9; border-color:#4CAF50; color:#2e7d32;">クリア</span>`;
        else if (isWorking) b.innerHTML += `<span class="reward-badge" style="background:#fffde7; border-color:#FFEB3B; color:#fbc02d;">挑戦中 ⏸️ ${workingPage ? 'P.' + workingPage : ''}</span>`;
        else if (isUnlocked) b.innerHTML += `<span class="reward-badge">💰500</span>`;

        cont.appendChild(b);
        previousCleared = isCleared;
    });
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

    showScreen('screen-word-game');
}

export function openWordText() {
    const st = WORD_STAGES.find(s => s.id === currentWordStageId);
    if (st && st.pdf && st.pdf !== '') window.open(st.pdf, '_blank');
    else showCustomAlert('テキストのURLが設定されていません。\n（先生へ：script.js 内の WORD_STAGES にPDFのURLを入れてください）');
}

function getCurrentWordStageLabel() {
    const st = WORD_STAGES.find(s => s.id === currentWordStageId);
    if (!st) return 'Word練習';
    return `Word ${st.title}${st.sub ? ` / ${st.sub}` : ''}`;
}

export function suspendWordTask() {
    if (!canWriteCurrentUserRow()) {
        showCustomAlert('先生確認モードでは、Wordの途中保存は保存されません。生徒本人または管理者で操作してください。');
        return;
    }

    const u = users[currentUser];
    if (!u.wordProgress) u.wordProgress = {};

    let pageVal = document.getElementById('word-page-input').value;
    let prog = u.wordProgress[currentWordStageId];

    let isCleared = (prog === 'cleared' || (prog && prog.status === 'cleared'));

    u.wordProgress[currentWordStageId] = {
        status: isCleared ? 'cleared' : 'working',
        page: pageVal
    };
    recordPracticeActivity({
        category: 'word',
        title: getCurrentWordStageLabel(),
        detail: isCleared ? 'クリア済みページ更新' : '途中保存',
        amount: pageVal ? `${pageVal}ページまで` : 'ページ未入力',
        coins: 0
    });
    saveUsers(false);
    SoundManager.playClick();
    showCustomAlert('「挑戦中 ⏸️」として記録しました！\nデータを保存してWordをとじたら、また次回続きから頑張ろう！');
    goToWordMenu();
}

export function confirmWordClear() {
    if (hasLessonRole('teacher', 'admin')) {
        processWordClear();
        return;
    }

    showCustomAlert('先生または管理者アカウントでログインして確認してください。');
}

export function processWordClear() {
    if (!canWriteCurrentUserRow()) {
        showCustomAlert('先生確認モードでは、Wordのクリア結果は保存されません。管理者アカウントで操作してください。');
        return;
    }

    const u = users[currentUser];
    if (!u.wordProgress) u.wordProgress = {};

    let prog = u.wordProgress[currentWordStageId];
    let isFirstClear = !(prog === 'cleared' || (typeof prog === 'object' && prog.status === 'cleared'));
    let pageVal = document.getElementById('word-page-input').value;

    u.wordProgress[currentWordStageId] = { status: 'cleared', page: pageVal };

    let coinGain = isFirstClear ? 500 : 50;
    u.coins = (u.coins || 0) + coinGain;
    recordPracticeActivity({
        category: 'word',
        title: getCurrentWordStageLabel(),
        detail: isFirstClear ? 'クリア' : 'クリア再確認',
        amount: pageVal ? `${pageVal}ページまで` : 'ページ未入力',
        coins: coinGain
    });

    saveUsers(false);
    SoundManager.playClear();
    createConfetti();

    document.getElementById('feedback-text').innerText = 'Word マスター！';
    document.getElementById('feedback-time').innerHTML = `<span style="font-size:30px; color:#FFD700;">💰 +${coinGain} コインゲット！</span>`;
    document.getElementById('feedback-time').style.display = 'block';
    document.getElementById('feedback-stats').style.display = 'none';
    document.getElementById('feedback-overlay').style.display = 'flex';

    setTimeout(() => {
        document.getElementById('feedback-overlay').style.display = 'none';
        goToWordMenu();
    }, 4000);
}
