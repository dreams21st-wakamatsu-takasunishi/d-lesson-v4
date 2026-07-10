import { WORD_STAGES } from '../data/constants.js';
import {
    users,
    currentUser,
    saveUsers,
    hasLessonRole,
    canWriteCurrentUserRow,
    recordPracticeActivity,
    getPracticeLogs
} from '../api/user.js';
import { SoundManager } from '../utils/sound.js';
import { createBtn } from '../utils/dom.js';
import { showCustomAlert } from '../ui/modal.js';
import { showScreen } from '../ui/screen.js';
import { createConfetti } from '../ui/reward.js';
import { buildProgressLabel, findLatestPracticeLog, formatPracticeLogShort } from '../utils/practice-guidance.js';

let currentWordStageId = null;
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
}

function renderWordMenu() {
    const cont = document.getElementById('word-menu-content');
    cont.innerHTML = '';
    const u = users[currentUser];
    if (!u.wordProgress) u.wordProgress = {};

    const menuState = getWordMenuState(u);
    renderWordNextPanel(cont, menuState);

    menuState.rows.forEach(({ stage: st, isCleared, isWorking, workingPage, isUnlocked }) => {
        const b = document.createElement('div');
        b.className = 'stage-btn';
        b.style.height = '100px';

        if (isUnlocked) {
            b.classList.add('unlocked');
            if (isCleared) b.classList.add('cleared');
            else if (isWorking) b.classList.add('working');
            if (menuState.next?.stage?.id === st.id) b.classList.add('next-target');

            createBtn(b, () => startWordStage(st.id));
        } else {
            b.style.opacity = '0.5';
        }

        b.innerHTML = `<span style="font-size:24px;">📘</span><span style="font-size:16px; font-weight:bold; color:#333; margin-top:5px;">${escapeHtml(st.title)}</span><span style="font-size:12px; color:#666;">${escapeHtml(st.sub)}</span>`;

        if (isCleared) b.innerHTML += `<span class="reward-badge" style="background:#e8f5e9; border-color:#4CAF50; color:#2e7d32;">クリア</span>`;
        else if (isWorking) b.innerHTML += `<span class="reward-badge" style="background:#fffde7; border-color:#FFEB3B; color:#fbc02d;">やっているところ ⏸️ ${workingPage ? 'P.' + escapeHtml(workingPage) : ''}</span>`;
        else if (isUnlocked) b.innerHTML += `<span class="reward-badge">💰500</span>`;

        cont.appendChild(b);
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
    if (st && st.pdf && st.pdf !== '') {
        const popup = window.open(st.pdf, '_blank', WORD_TEXT_WINDOW_FEATURES);
        if (popup) popup.opener = null;
    }
    else showCustomAlert('テキストのURLが設定されていません。\n（先生へ：script.js 内の WORD_STAGES にPDFのURLを入れてください）');
}

function getCurrentWordStageLabel() {
    const st = WORD_STAGES.find(s => s.id === currentWordStageId);
    if (!st) return 'Word練習';
    return `Word ${st.title}${st.sub ? ` / ${st.sub}` : ''}`;
}

export function suspendWordTask() {
    if (!canWriteCurrentUserRow()) {
        showCustomAlert('先生のかくにん中は、Wordのとちゅうほぞんはできません。生徒本人または管理者で操作してください。');
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
        detail: isCleared ? 'クリアずみページをこうしん' : 'とちゅうほぞん',
        amount: pageVal ? `${pageVal}ページまで` : 'ページなし',
        coins: 0
    });
    saveUsers(false);
    SoundManager.playClick();
    showCustomAlert('「やっているところ ⏸️」としてきろくしました！\nデータをほぞんしてWordをとじたら、つぎはつづきからできます。');
    goToWordMenu();
}

export function confirmWordClear() {
    if (hasLessonRole('teacher', 'admin')) {
        processWordClear();
        return;
    }

    showCustomAlert('先生または管理者アカウントでログインして、かくにんしてください。');
}

export function processWordClear() {
    if (!canWriteCurrentUserRow()) {
        showCustomAlert('先生のかくにん中は、Wordのクリアけっかはほぞんされません。管理者アカウントで操作してください。');
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
        detail: isFirstClear ? 'クリア' : 'クリアをもういちどかくにん',
        amount: pageVal ? `${pageVal}ページまで` : 'ページなし',
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
