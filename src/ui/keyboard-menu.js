import {
    ALPHABET_READING_STAGES,
    KEYBOARD_STAGES,
    BLIND_STAGES,
    BRIDGE_STAGES,
    HIRAGANA_DATA,
    WORD_DATA,
    EXAMS,
    STAGE_ORDER,
    KB_CHAPTERS
} from '../data/constants.js';
import { users, currentUser } from '../api/user.js';
import { createBtn } from '../utils/dom.js';
import { getRewardText } from '../utils/rewards.js';
import { hasTrainableMistakes } from '../utils/weak-mistakes.js';
import { showCustomAlert } from './modal.js';
import { showScreen } from './screen.js';
import { setCurrentKeyboardChapter } from './keyboard-state.js';
import { startGame } from '../games/core.js';

let currentKeyboardCategory = 'basic';

const KEYBOARD_CHAPTER_GUIDE = {
    alphabet: {
        focus: 'ABCをおぼえる',
        goal: 'ABCをみて、おなじキーをおします。'
    },
    home: {
        focus: 'ホームポジション',
        goal: 'F と J から、いつもの手のばしょをおぼえます。'
    },
    top: {
        focus: 'うえのキー',
        goal: 'うえのキーをおして、ホームにもどります。'
    },
    bottom: {
        focus: 'したのキー',
        goal: 'したのキーを、ゆっくりたしかめます。'
    },
    number: {
        focus: 'すうじキー',
        goal: '1 から 0 と - をおします。'
    },
    blind: {
        focus: 'みないでうつ',
        goal: 'キーボードを見ないで、おしてみます。'
    },
    h_1: {
        focus: 'ひらがな あ〜さ',
        goal: 'あ〜さをれんしゅうします。'
    },
    h_2: {
        focus: 'ひらがな た〜は',
        goal: 'た〜はをれんしゅうします。'
    },
    h_3: {
        focus: 'ひらがな ま〜ん',
        goal: 'ま〜んをれんしゅうします。'
    },
    h_4: {
        focus: 'だくてん',
        goal: 'が、ざ、だ、ば、ぱをれんしゅうします。'
    },
    word1: {
        focus: 'みじかいことば',
        goal: 'みじかいことばをうちます。'
    },
    word2: {
        focus: 'むずかしいおと',
        goal: 'ん、っ、ゃゅょ、ーをれんしゅうします。'
    },
    word3: {
        focus: 'レベルアップ',
        goal: 'すこしながいことばにちょうせんします。'
    },
    word4: {
        focus: 'つかうことば',
        goal: 'よくつかうことばをうちます。'
    },
    word5: {
        focus: 'ぶん・カタカナ',
        goal: 'みじかいぶんやカタカナをうちます。'
    },
    word6: {
        focus: 'みじかいぶん',
        goal: '「、」のあるぶんをうちます。'
    },
    word7: {
        focus: 'れんしゅうぶん',
        goal: 'つかいやすいぶんをうちます。'
    },
    word8: {
        focus: 'きごう',
        goal: 'ひづけやきごうをうちます。'
    },
    word9: {
        focus: 'つかうぶん',
        goal: 'すうじやきごうのあるぶんをうちます。'
    },
    word10: {
        focus: 'ぶんのじゅんび',
        goal: 'ながいぶんのまえに、ぶんをうつれんしゅうです。'
    }
};

const KEYBOARD_CATEGORY_SUMMARY = {
    alphabet: { label: 'ABC', copy: 'ABCのかたちとよみをおぼえます。' },
    basic: { label: 'きほん', copy: '手のばしょとキーのいちをおぼえます。' },
    blind: { label: 'みないで', copy: 'キーボードを見ないでうつれんしゅうです。' },
    hiragana: { label: 'ひらがな', copy: 'ローマ字でひらがなをうちます。' },
    word: { label: 'ことば', copy: 'ことばやみじかいぶんをうちます。' }
};

const KEYBOARD_CHAPTER_SHORT_TEXT = {
    alphabet: 'ABCを みて おす',
    home: 'F と J から',
    top: 'うえのキー',
    bottom: 'したのキー',
    number: 'すうじキー',
    blind: 'みないでうつ',
    h_1: 'あ か さ',
    h_2: 'た な は',
    h_3: 'ま や ら わ',
    h_4: 'だくてん',
    word1: 'みじかいことば',
    word2: 'むずかしいおと',
    word3: 'レベルアップ',
    word4: 'つかうことば',
    word5: 'みじかいぶん',
    word6: '「、」のぶん',
    word7: 'れんしゅうぶん',
    word8: 'きごう',
    word9: 'つかうぶん',
    word10: 'ぶんのじゅんび'
};

function getKeyboardTargetId(user, sequence) {
    if (currentKeyboardCategory === 'alphabet') {
        return ALPHABET_READING_STAGES[Math.min(Number(user.alphabetSequence || 0), ALPHABET_READING_STAGES.length - 1)]?.id;
    }
    return STAGE_ORDER[sequence];
}

function getKeyboardChapterStageIds(chap) {
    return [
        ...chap.stages,
        ...(chap.bridge ? [chap.bridge] : []),
        ...(chap.exam ? [chap.exam] : [])
    ];
}

function getKeyboardChapterShortText(chap) {
    return KEYBOARD_CHAPTER_SHORT_TEXT[chap.id] || KEYBOARD_CHAPTER_GUIDE[chap.id]?.focus || chap.title;
}

function getActiveUserOrTitle() {
    const u = currentUser ? users[currentUser] : null;
    if (u) return u;
    showCustomAlert('ユーザーを選択してください');
    showScreen('screen-title');
    return null;
}

export function goToKeyboardCategory() {
    showScreen('screen-keyboard-category');
    updateWeakTrainingEntryVisibility();
}

function updateWeakTrainingEntryVisibility() {
    const card = document.getElementById('keyboard-weak-training-card');
    const alphabetCard = document.getElementById('keyboard-alphabet-card');
    const grid = document.getElementById('keyboard-category-choice-grid');
    if (!card || !grid) return;

    const u = currentUser ? users[currentUser] : null;
    const hasWeakTraining = Boolean(u && hasTrainableMistakes(u.globalMistakes));
    card.style.display = hasWeakTraining ? 'grid' : 'none';
    grid.classList.toggle('no-weak-training', !hasWeakTraining);

    if (alphabetCard) {
        const canUseAlphabet = Boolean(u && Number(u.mouseLevel || 0) >= 7);
        alphabetCard.classList.toggle('keyboard-category-card-locked', !canUseAlphabet);
        alphabetCard.setAttribute('aria-disabled', canUseAlphabet ? 'false' : 'true');
        alphabetCard.onclick = canUseAlphabet
            ? () => goToKeyboardMenu('alphabet')
            : () => showCustomAlert('マウスれんしゅうを M-7 まで クリアすると、ABCをおぼえる れんしゅうが できます。');
    }
}

export function goToKeyboardMenu(type) {
    if (type) currentKeyboardCategory = type;
    document.getElementById('kb-chapter-container').style.display = 'grid';
    document.getElementById('kb-stage-container').style.display = 'none';
    document.getElementById('kb-bottom-back-btn').style.display = 'block';

    let title = 'キーボードのれんしゅう';
    if (type === 'alphabet') title = 'ABCをおぼえる';
    if (type === 'basic') title = 'きほんれんしゅう';
    if (type === 'blind') title = 'タッチタイピング';
    if (type === 'hiragana') title = 'ひらがなれんしゅう';
    if (type === 'word') title = 'ことばのれんしゅう';
    document.getElementById('kb-menu-title').innerText = title;

    setCurrentKeyboardChapter(null);
    renderKeyboardChapters();
    showScreen('screen-keyboard-menu');
}

export function updateKeyboardButtons() {
    renderKeyboardChapters();
}

function renderKeyboardChapters() {
    const u = getActiveUserOrTitle();
    if (!u) return;
    const seq = u.keyboardSequence || 0;
    const cont = document.getElementById('kb-chapter-container');
    cont.innerHTML = '';

    let displayChapters = [];
    let showMasterExam = null;

    if (currentKeyboardCategory === 'basic') {
        displayChapters = KB_CHAPTERS.filter(c => ['home', 'top', 'bottom', 'number'].includes(c.id));
        showMasterExam = 1999;
    } else if (currentKeyboardCategory === 'alphabet') {
        displayChapters = KB_CHAPTERS.filter(c => c.id === 'alphabet');
    } else if (currentKeyboardCategory === 'blind') {
        displayChapters = KB_CHAPTERS.filter(c => c.id === 'blind');
        showMasterExam = 2999;
    } else if (currentKeyboardCategory === 'hiragana') {
        displayChapters = KB_CHAPTERS.filter(c => c.id.startsWith('h_'));
        showMasterExam = 3999;
    } else if (currentKeyboardCategory === 'word') {
        displayChapters = KB_CHAPTERS.filter(c => c.id.startsWith('word'));
        showMasterExam = 4999;
    }

    const isUnlocked = (id) => {
        if (currentKeyboardCategory === 'alphabet') {
            const index = ALPHABET_READING_STAGES.findIndex(stage => stage.id === id);
            return index === 0 || (index !== -1 && Number(u.alphabetSequence || 0) >= index);
        }
        const x = STAGE_ORDER.indexOf(id);
        return x === 0 || (x !== -1 && seq >= x);
    };
    const isCleared = (id) => {
        if (currentKeyboardCategory === 'alphabet') {
            const index = ALPHABET_READING_STAGES.findIndex(stage => stage.id === id);
            return index !== -1 && Number(u.alphabetSequence || 0) > index;
        }
        const x = STAGE_ORDER.indexOf(id);
        return x !== -1 && seq > x;
    };

    const targetId = getKeyboardTargetId(u, seq);
    const allStageIds = [
        ...displayChapters.flatMap(getKeyboardChapterStageIds),
        ...(showMasterExam ? [showMasterExam] : [])
    ];
    const allDoneCount = allStageIds.filter(isCleared).length;
    const allTotalCount = allStageIds.length;
    const allProgressPercent = allTotalCount ? Math.round((allDoneCount / allTotalCount) * 100) : 0;
    const nextChapter = displayChapters.find(chap => {
        const ids = getKeyboardChapterStageIds(chap);
        return ids.includes(targetId) && !ids.every(isCleared);
    });
    const summaryInfo = KEYBOARD_CATEGORY_SUMMARY[currentKeyboardCategory] || KEYBOARD_CATEGORY_SUMMARY.basic;
    const summary = document.createElement('section');
    summary.className = 'kb-chapter-summary';
    if (allTotalCount && allDoneCount >= allTotalCount) summary.classList.add('is-complete');
    const nextTitle = allTotalCount && allDoneCount >= allTotalCount
        ? 'このれんしゅうは できています'
        : (nextChapter ? `つぎは「${nextChapter.title}」` : 'つぎは「まとめテスト」');
    const nextCopy = allTotalCount && allDoneCount >= allTotalCount
        ? 'ほかのれんしゅうにも ちょうせんできます。'
        : (nextChapter ? getKeyboardChapterShortText(nextChapter) : 'ここまでの力をたしかめます。');
    summary.innerHTML = `
        <div class="kb-chapter-summary-main">
            <span class="kb-chapter-summary-kicker">${summaryInfo.label}</span>
            <strong>${nextTitle}</strong>
            <small>${summaryInfo.copy}</small>
        </div>
        <div class="kb-chapter-summary-next">
            <span>やること</span>
            <b>${nextCopy}</b>
        </div>
        <div class="kb-chapter-summary-progress">
            <span>${allDoneCount}/${allTotalCount}</span>
            <i><em style="width:${allProgressPercent}%;"></em></i>
        </div>
    `;
    cont.appendChild(summary);

    if (currentKeyboardCategory === 'hiragana') {
        const btn = document.createElement('button');
        btn.className = 'category-btn kb-chapter-card kb-romaji-card';
        btn.innerHTML = `
            <span class="kb-chapter-card-top">
                <span class="kb-chapter-status">みる</span>
            </span>
            <span class="kb-chapter-title">ローマ字いちらん</span>
            <span class="kb-chapter-focus">こまったらみる</span>
            <span class="kb-chapter-progress">
                <span class="kb-chapter-progress-bar"><i style="width:100%;"></i></span>
            </span>
        `;
        btn.onclick = () => showRomajiMenu();
        cont.appendChild(btn);
    }

    const appendChapterButton = (chap) => {
        let chapUnlocked = isUnlocked(chap.stages[0]);
        let chapCleared = true;
        chap.stages.forEach(sid => {
            if (!isCleared(sid)) chapCleared = false;
        });
        if (chap.exam && !isCleared(chap.exam)) chapCleared = false;

        const stageIds = getKeyboardChapterStageIds(chap);
        const doneCount = stageIds.filter(isCleared).length;
        const totalCount = stageIds.length;
        const progressPercent = totalCount ? Math.round((doneCount / totalCount) * 100) : 0;
        const isNextChapter = chapUnlocked && !chapCleared && stageIds.includes(targetId);
        const shortText = getKeyboardChapterShortText(chap);

        const btn = document.createElement('button');
        btn.className = 'category-btn kb-chapter-card';
        if (!chapUnlocked) {
            btn.classList.add('kb-chapter-locked');
            btn.style.cursor = 'not-allowed';
        } else {
            if (isNextChapter) btn.classList.add('kb-chapter-next');
            if (chapCleared) btn.classList.add('kb-chapter-cleared');
            btn.onclick = () => renderKeyboardStages(chap);
        }

        const statusText = chapCleared ? 'できた' : (isNextChapter ? 'つぎ' : (chapUnlocked ? `${doneCount}/${totalCount}` : 'まだ'));
        btn.innerHTML = `
            <span class="kb-chapter-card-top">
                <span class="kb-chapter-status">${statusText}</span>
            </span>
            <span class="kb-chapter-title">${chap.title}</span>
            <span class="kb-chapter-focus">${shortText}</span>
            <span class="kb-chapter-progress">
                <span class="kb-chapter-progress-bar"><i style="width:${progressPercent}%;"></i></span>
            </span>
        `;

        cont.appendChild(btn);
    };

    const masterExamIndex = showMasterExam ? STAGE_ORDER.indexOf(showMasterExam) : -1;
    const primaryChapters = masterExamIndex === -1
        ? displayChapters
        : displayChapters.filter(chap => STAGE_ORDER.indexOf(chap.stages[0]) <= masterExamIndex);
    const advancedChapters = masterExamIndex === -1
        ? []
        : displayChapters.filter(chap => STAGE_ORDER.indexOf(chap.stages[0]) > masterExamIndex);

    primaryChapters.forEach(appendChapterButton);

    if (showMasterExam) {
        const mid = showMasterExam;
        const ed = EXAMS.find(x => x.id === mid);
        const btn = document.createElement('button');
        const masterUnlocked = isUnlocked(mid);
        const masterCleared = isCleared(mid);
        const masterIsNext = masterUnlocked && !masterCleared && mid === targetId;
        btn.className = 'category-btn kb-chapter-card kb-master-exam-card';

        if (!masterUnlocked) {
            btn.classList.add('kb-chapter-locked');
            btn.style.cursor = 'not-allowed';
        } else {
            if (masterCleared) btn.classList.add('kb-chapter-cleared');
            if (masterIsNext) btn.classList.add('kb-chapter-next');
            btn.onclick = () => startGame(mid, 'keyboard');
        }

        const statusText = masterCleared ? 'できた' : (masterIsNext ? 'つぎ' : (masterUnlocked ? 'テスト' : 'まだ'));
        btn.innerHTML = `
            <span class="kb-chapter-card-top">
                <span class="kb-chapter-status">${statusText}</span>
            </span>
            <span class="kb-chapter-title">${ed.title}</span>
            <span class="kb-chapter-focus">まとめテスト</span>
            <span class="kb-chapter-progress">
                <span class="kb-chapter-progress-bar"><i style="width:${masterCleared ? 100 : 0}%;"></i></span>
            </span>
        `;
        cont.appendChild(btn);
    }

    if (advancedChapters.length > 0) {
        const divider = document.createElement('div');
        divider.className = 'kb-advanced-divider';
        divider.textContent = 'もっとれんしゅう';
        cont.appendChild(divider);
        advancedChapters.forEach(appendChapterButton);
    }
}

export function showRomajiMenu() {
    document.getElementById('kb-chapter-container').style.display = 'none';
    document.getElementById('kb-stage-container').style.display = 'flex';
    document.getElementById('kb-bottom-back-btn').style.display = 'none';
    document.getElementById('kb-stage-title').innerText = 'ローマ字いちらん表';

    const grid = document.getElementById('kb-stage-grid');
    grid.innerHTML = '';
    document.getElementById('kb-stage-exams').innerHTML = '';

    const stages = [
        { id: 'romaji_basic_prac', title: 'あ〜ん', sub: '(れんしゅう)', icon: '📖', color: '#00bcd4' },
        { id: 'romaji_basic_exam', title: 'あ〜ん', sub: '(テスト)', icon: '🔥', color: '#e91e63' },
        { id: 'romaji_daku_prac', title: 'だくてん', sub: '(れんしゅう)', icon: '📖', color: '#00bcd4' },
        { id: 'romaji_daku_exam', title: 'だくてん', sub: '(テスト)', icon: '🔥', color: '#e91e63' }
    ];

    stages.forEach(st => {
        const b = document.createElement('div');
        b.className = 'stage-btn unlocked cleared';
        b.style.borderColor = st.color;
        b.style.backgroundColor = st.color === '#00bcd4' ? '#e0f7fa' : '#fce4ec';
        b.style.cursor = 'pointer';
        b.tabIndex = 0;
        b.innerHTML = `<span style="font-size:30px;">${st.icon}</span><span style="font-size:16px; font-weight:bold; color:#333; margin-top:5px;">${st.title}</span><span style="font-size:12px;">${st.sub}</span>`;
        createBtn(b, () => startGame(st.id, 'romaji'));
        grid.appendChild(b);
    });
}

function getKeyboardStageDisplay(sid, index = 0) {
    let title = `ステージ${index + 1}`;
    let keys = '';
    let sub = '';
    let exCls = '';

    if (sid >= 9000 && sid < 9100) {
        const st = ALPHABET_READING_STAGES.find(s => s.id === sid);
        if (st) {
            title = st.title;
            keys = st.type === 'choice' ? '3つから えらぶ' : st.keys.join(' ');
            sub = st.sub;
            exCls = st.type === 'choice' ? 'alphabet-reading alphabet-choice-stage' : 'alphabet-reading';
        }
    } else if (sid >= 4000 && sid < 5000) {
        const st = WORD_DATA.find(s => s.id === sid);
        if (st) {
            keys = st.chars.slice(0, 1).map(c => c.h).join('');
            sub = st.title;
            exCls = 'word-practice';
        }
    } else if (sid >= 3000 && sid < 4000) {
        let base = sid;
        if (sid >= 3100) base -= 100;
        if (sid >= 3200) base -= 100;
        const st = HIRAGANA_DATA.find(s => s.id === base);
        if (st) {
            keys = st.chars.slice(0, 3).map(c => c.h).join('');
            if (sid >= 3200) {
                sub = '(みないでテスト)';
                exCls = 'blind-exam';
            } else if (sid >= 3100) {
                sub = '(みないでれんしゅう)';
                exCls = 'blind-practice';
            } else {
                sub = st.title.split('(')[0];
            }
        }
    } else if (sid >= 2000 && sid < 3000) {
        const st = BLIND_STAGES.find(s => s.id === sid);
        if (st) {
            keys = st.title.split('(')[0];
            sub = st.type === 'exam' ? '(テスト)' : '(れんしゅう)';
            exCls = st.type === 'exam' ? 'blind-exam' : 'blind-practice';
        }
    } else {
        const st = KEYBOARD_STAGES.find(s => s.id === sid);
        if (st) {
            keys = st.keys.filter(k => k !== 'SPACE').join('');
            sub = st.title;
        }
    }

    return { title, keys, sub, exCls };
}

function getKeyboardSpecialStageDisplay(stageId) {
    const bridge = BRIDGE_STAGES.find(x => x.id === stageId);
    if (bridge) {
        return { title: 'ふくしゅう', keys: '', sub: bridge.title };
    }

    const exam = EXAMS.find(x => x.id === stageId);
    if (exam) {
        return { title: 'テスト', keys: '', sub: exam.title };
    }

    return getKeyboardStageDisplay(stageId, 0);
}

function renderKeyboardStageGuide(chap, isCleared, isUnlocked) {
    const guideEl = document.getElementById('kb-stage-guide');
    if (!guideEl) return;

    const stageIds = getKeyboardChapterStageIds(chap);
    const total = stageIds.length;
    const done = stageIds.filter(id => isCleared(id)).length;
    const nextId = stageIds.find(id => isUnlocked(id) && !isCleared(id));
    const nextIndex = chap.stages.indexOf(nextId);
    const nextDisplay = nextId
        ? (nextIndex >= 0
            ? getKeyboardStageDisplay(nextId, nextIndex)
            : getKeyboardSpecialStageDisplay(nextId))
        : null;
    const guide = KEYBOARD_CHAPTER_GUIDE[chap.id] || {
        focus: chap.title,
        goal: 'じゅんばんにクリアして、つぎへすすみます。'
    };

    guideEl.innerHTML = `
        <div class="kb-stage-guide-main">
            <div class="kb-stage-guide-label">このれんしゅう</div>
            <div class="kb-stage-guide-focus">${guide.focus}</div>
            <div class="kb-stage-guide-goal">${guide.goal}</div>
        </div>
        <div class="kb-stage-guide-next">
            <div class="kb-stage-guide-label">つぎ</div>
            <div class="kb-stage-guide-next-title">${nextDisplay?.title || 'できた'}</div>
            <div class="kb-stage-guide-next-keys">${nextDisplay?.keys || 'クリアずみ'}</div>
            <div class="kb-stage-guide-next-sub">${nextDisplay?.sub || 'このれんしゅうはできています。'}</div>
        </div>
        <div class="kb-stage-guide-progress">
            <span>${done}/${total}</span>
            <div class="kb-stage-guide-bar"><div style="width:${total ? Math.round((done / total) * 100) : 0}%;"></div></div>
        </div>
    `;
}

export function renderKeyboardStages(chap) {
    setCurrentKeyboardChapter(chap);

    document.getElementById('kb-chapter-container').style.display = 'none';
    document.getElementById('kb-stage-container').style.display = 'flex';
    document.getElementById('kb-bottom-back-btn').style.display = 'none';
    document.getElementById('kb-stage-title').innerText = chap.title;

    const u = getActiveUserOrTitle();
    if (!u) return;
    const seq = u.keyboardSequence || 0;
    const isUnlocked = (id) => {
        if (currentKeyboardCategory === 'alphabet') {
            const index = ALPHABET_READING_STAGES.findIndex(stage => stage.id === id);
            return index === 0 || (index !== -1 && Number(u.alphabetSequence || 0) >= index);
        }
        const x = STAGE_ORDER.indexOf(id);
        return x === 0 || (x !== -1 && seq >= x);
    };
    const isCleared = (id) => {
        if (currentKeyboardCategory === 'alphabet') {
            const index = ALPHABET_READING_STAGES.findIndex(stage => stage.id === id);
            return index !== -1 && Number(u.alphabetSequence || 0) > index;
        }
        const x = STAGE_ORDER.indexOf(id);
        return x !== -1 && seq > x;
    };
    const targetId = currentKeyboardCategory === 'alphabet'
        ? ALPHABET_READING_STAGES[Math.min(Number(u.alphabetSequence || 0), ALPHABET_READING_STAGES.length - 1)]?.id
        : STAGE_ORDER[seq];

    const grid = document.getElementById('kb-stage-grid');
    grid.innerHTML = '';
    const examsCont = document.getElementById('kb-stage-exams');
    examsCont.innerHTML = '';
    renderKeyboardStageGuide(chap, isCleared, isUnlocked);

    chap.stages.forEach((sid, index) => {
        const { title, keys, sub, exCls } = getKeyboardStageDisplay(sid, index);
        const act = () => startGame(sid, 'keyboard');

        const b = document.createElement('div');
        b.className = `stage-btn ${exCls}`;
        b.tabIndex = -1;
        if (isUnlocked(sid)) {
            b.classList.add('unlocked');
            createBtn(b, act);
            if (sid === targetId) b.classList.add('next-target');
            b.innerHTML = `<span class="stage-title">${title}</span><span class="kb-keys" style="font-size:18px">${keys}</span><span class="stage-name" style="font-size:12px">${sub}</span><span class="reward-badge">${getRewardText('keyboard', sid)}</span>`;
        } else {
            b.style.opacity = '0.5';
            b.innerHTML = `<span class="stage-title">${title}</span><span class="kb-keys" style="font-size:18px">${keys}</span><span class="stage-name" style="font-size:12px">${sub}</span>`;
        }
        if (isCleared(sid)) b.classList.add('cleared');
        grid.appendChild(b);
    });

    if (chap.bridge) {
        const bid = chap.bridge;
        const bd = BRIDGE_STAGES.find(x => x.id === bid);
        const b = document.createElement('div');
        b.className = 'exam-btn practice-bridge-btn';
        b.tabIndex = -1;
        b.style.width = '300px';
        if (isUnlocked(bid)) {
            b.classList.add('unlocked');
            createBtn(b, () => startGame(bid, 'keyboard'));
            if (bid === targetId) b.classList.add('next-target');
        } else {
            b.style.opacity = '0.5';
        }
        if (isCleared(bid)) {
            b.classList.add('cleared');
            b.innerText = 'ふくしゅうクリア';
        } else {
            b.innerText = bd.title + '(ミスOK)';
        }
        examsCont.appendChild(b);
    }
    if (chap.exam) {
        const eid = chap.exam;
        const ed = EXAMS.find(x => x.id === eid);
        const b = document.createElement('div');
        b.className = 'exam-btn';
        b.tabIndex = -1;
        b.style.width = '300px';
        if (isUnlocked(eid)) {
            b.classList.add('unlocked');
            createBtn(b, () => startGame(eid, 'keyboard'));
            if (eid === targetId) b.classList.add('next-target');
        } else {
            b.style.opacity = '0.5';
        }
        if (isCleared(eid)) {
            b.classList.add('cleared');
            b.innerText = ed.title + '合格';
        } else {
            b.innerText = ed.title;
        }
        examsCont.appendChild(b);
    }

    requestAnimationFrame(() => {
        const screen = document.getElementById('screen-keyboard-menu');
        const stageContainer = document.getElementById('kb-stage-container');
        if (screen && typeof screen.scrollTo === 'function') {
            screen.scrollTo({ top: 0, behavior: 'smooth' });
        }
        if (stageContainer && typeof stageContainer.scrollIntoView === 'function') {
            stageContainer.scrollIntoView({ block: 'start', behavior: 'smooth' });
        }
    });
}

export function backToKbChapter() {
    document.getElementById('kb-chapter-container').style.display = 'grid';
    document.getElementById('kb-stage-container').style.display = 'none';
    document.getElementById('kb-bottom-back-btn').style.display = 'block';
}
