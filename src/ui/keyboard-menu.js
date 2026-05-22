import {
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
    home: {
        focus: 'ホームポジション',
        goal: 'F/J から始めて、A/S/D/F/J/K/L/; を安定して押す練習です。'
    },
    top: {
        focus: '上段キー',
        goal: 'Q/W/E/R/T と Y/U/I/O/P を、ホームポジションから手を戻しながら押す練習です。'
    },
    bottom: {
        focus: '下段キー',
        goal: 'Z/X/C/V/B と N/M/,/./ を、指を大きく動かしすぎずに押す練習です。'
    },
    number: {
        focus: '数字キー',
        goal: '1 から 0、- までを、左右の指の担当を意識して押す練習です。'
    },
    blind: {
        focus: '見ないで入力',
        goal: 'キーボードを見ずに、手の位置と指の動きだけで入力する練習です。'
    },
    h_1: {
        focus: 'ひらがな あ行からさ行',
        goal: '短いローマ字入力から、見ないで入力する段階へ進みます。'
    },
    h_2: {
        focus: 'ひらがな た行からは行',
        goal: 'よく使う行を増やし、ローマ字入力の幅を広げます。'
    },
    h_3: {
        focus: 'ひらがな ま行からん',
        goal: 'や行、ら行、わ行、んを加えて、基本のひらがなを仕上げます。'
    },
    h_4: {
        focus: '濁音・半濁音',
        goal: 'が、ざ、だ、ば、ぱ行を入力し、苦手になりやすい音を整理します。'
    },
    word1: {
        focus: '短いことば',
        goal: '身近なことばを使って、単語入力に慣れます。'
    },
    word2: {
        focus: '特殊な音',
        goal: 'ん、っ、ゃゅょ、ーなど、迷いやすい入力を練習します。'
    },
    word3: {
        focus: 'レベルアップ',
        goal: '地名や英単語を含む、少し難しいことばに取り組みます。'
    },
    word4: {
        focus: '実用ことば',
        goal: '生活や学習で使うことばを入力します。'
    },
    word5: {
        focus: '文・カタカナ',
        goal: '短い文やカタカナ語を入力し、文章入力へつなげます。'
    },
    word6: {
        focus: '短文入力',
        goal: '読点「、」を含む短い文を入力し、実際の文章入力へ近づけます。'
    },
    word7: {
        focus: '実践文入力',
        goal: '教室やパソコン操作で使う文を入力し、Dレッスン外の学習や文章入力へつなげます。'
    },
    word8: {
        focus: '記号・実用入力',
        goal: '日付、番号、ハイフン、スラッシュなど、実際の入力で使う記号に慣れます。'
    },
    word9: {
        focus: '実用文入力',
        goal: '番号や記号を含む短い文を入力し、文章入力練習へ進む準備をします。'
    },
    word10: {
        focus: '文章入力の準備',
        goal: '読点で区切る文や二つ続く文を入力し、長い文章へ入る前の準備をします。'
    }
};

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
    const grid = document.getElementById('keyboard-category-choice-grid');
    if (!card || !grid) return;

    const u = currentUser ? users[currentUser] : null;
    const hasWeakTraining = Boolean(u && hasTrainableMistakes(u.globalMistakes));
    card.style.display = hasWeakTraining ? 'grid' : 'none';
    grid.classList.toggle('no-weak-training', !hasWeakTraining);
}

export function goToKeyboardMenu(type) {
    if (type) currentKeyboardCategory = type;
    document.getElementById('kb-chapter-container').style.display = 'flex';
    document.getElementById('kb-stage-container').style.display = 'none';
    document.getElementById('kb-bottom-back-btn').style.display = 'block';

    let title = 'キーボードのれんしゅう';
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
        const x = STAGE_ORDER.indexOf(id);
        return x === 0 || (x !== -1 && seq >= x);
    };
    const isCleared = (id) => {
        const x = STAGE_ORDER.indexOf(id);
        return x !== -1 && seq > x;
    };

    if (currentKeyboardCategory === 'hiragana') {
        const btn = document.createElement('button');
        btn.className = 'category-btn';
        btn.style.backgroundColor = '#00bcd4';
        btn.style.width = '280px';
        btn.style.height = '120px';
        btn.innerHTML = `<span style="font-size:40px;">📋</span><span style="font-size:18px; font-weight:bold; margin-top:5px;">ローマ字いちらん表</span>`;
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

        const stageIds = [
            ...chap.stages,
            ...(chap.bridge ? [chap.bridge] : []),
            ...(chap.exam ? [chap.exam] : [])
        ];
        const doneCount = stageIds.filter(isCleared).length;
        const totalCount = stageIds.length;
        const progressPercent = totalCount ? Math.round((doneCount / totalCount) * 100) : 0;
        const guide = KEYBOARD_CHAPTER_GUIDE[chap.id] || {
            focus: chap.title,
            goal: '順番にクリアして、次のステージへ進みます。'
        };

        const btn = document.createElement('button');
        btn.className = 'category-btn kb-chapter-card';
        if (!chapUnlocked) {
            btn.classList.add('kb-chapter-locked');
            btn.style.opacity = '0.5';
            btn.style.cursor = 'not-allowed';
            btn.style.backgroundColor = '#9e9e9e';
        } else {
            if (chapCleared) btn.classList.add('kb-chapter-cleared');
            btn.style.backgroundColor = chapCleared ? '#4CAF50' : '#FF9800';
            btn.onclick = () => renderKeyboardStages(chap);
        }
        btn.style.width = '300px';
        btn.style.height = 'auto';
        btn.style.minHeight = '168px';

        let icon = '⌨️';
        if (currentKeyboardCategory === 'basic') icon = '🅰️';
        if (currentKeyboardCategory === 'blind') icon = '🙈';
        if (currentKeyboardCategory === 'hiragana') icon = 'あ';
        if (currentKeyboardCategory === 'word') icon = '🍎';

        const statusText = chapCleared ? 'クリア済' : (chapUnlocked ? `${doneCount}/${totalCount}` : 'ロック中');
        btn.innerHTML = `
            <span class="kb-chapter-card-top">
                <span class="kb-chapter-icon">${icon}</span>
                <span class="kb-chapter-status">${statusText}</span>
            </span>
            <span class="kb-chapter-title">${chap.title}</span>
            <span class="kb-chapter-focus">${guide.focus}</span>
            <span class="kb-chapter-note">${guide.goal}</span>
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
        btn.className = 'category-btn';
        btn.style.width = '280px';
        btn.style.height = 'auto';
        btn.style.minHeight = '140px';
        btn.style.padding = '10px';

        if (!isUnlocked(mid)) {
            btn.style.opacity = '0.5';
            btn.style.cursor = 'not-allowed';
            btn.style.backgroundColor = '#9e9e9e';
        } else {
            btn.style.background = 'linear-gradient(45deg, #FFC107, #FF9800)';
            btn.onclick = () => startGame(mid, 'keyboard');
        }

        if (isCleared(mid)) {
            btn.innerHTML = `<span style="font-size:40px;">👑</span><span style="font-size:16px; font-weight:bold; margin-top:5px; line-height:1.3; width:100%; word-wrap:break-word;">★${ed.title} 合格★</span><span style="font-size:12px; margin-top:5px; color:#fff;">(🎟️ クリアでチケット)</span>`;
        } else {
            btn.innerHTML = `<span style="font-size:40px;">👑</span><span style="font-size:16px; font-weight:bold; margin-top:5px; line-height:1.3; width:100%; word-wrap:break-word;">★${ed.title}★</span><span style="font-size:12px; margin-top:5px; color:#fff;">(🎟️ クリアでチケット)</span>`;
        }
        cont.appendChild(btn);
    }

    if (advancedChapters.length > 0) {
        const divider = document.createElement('div');
        divider.className = 'kb-advanced-divider';
        divider.textContent = '発展ステージ';
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

    if (sid >= 4000 && sid < 5000) {
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
                sub = '(ブラインド試験)';
                exCls = 'blind-exam';
            } else if (sid >= 3100) {
                sub = '(ブラインド練習)';
                exCls = 'blind-practice';
            } else {
                sub = st.title.split('(')[0];
            }
        }
    } else if (sid >= 2000 && sid < 3000) {
        const st = BLIND_STAGES.find(s => s.id === sid);
        if (st) {
            keys = st.title.split('(')[0];
            sub = st.type === 'exam' ? '(試験)' : '(練習)';
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
        return { title: '復習', keys: '', sub: bridge.title };
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

    const stageIds = [
        ...chap.stages,
        ...(chap.bridge ? [chap.bridge] : []),
        ...(chap.exam ? [chap.exam] : [])
    ];
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
        goal: '順番にクリアして、次のステージへ進みます。'
    };

    guideEl.innerHTML = `
        <div class="kb-stage-guide-main">
            <div class="kb-stage-guide-label">この章のめあて</div>
            <div class="kb-stage-guide-focus">${guide.focus}</div>
            <div class="kb-stage-guide-goal">${guide.goal}</div>
        </div>
        <div class="kb-stage-guide-next">
            <div class="kb-stage-guide-label">つぎ</div>
            <div class="kb-stage-guide-next-title">${nextDisplay?.title || '完了'}</div>
            <div class="kb-stage-guide-next-keys">${nextDisplay?.keys || 'クリア済み'}</div>
            <div class="kb-stage-guide-next-sub">${nextDisplay?.sub || 'この章は完了しています。'}</div>
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
        const x = STAGE_ORDER.indexOf(id);
        return x === 0 || (x !== -1 && seq >= x);
    };
    const isCleared = (id) => {
        const x = STAGE_ORDER.indexOf(id);
        return x !== -1 && seq > x;
    };
    const targetId = STAGE_ORDER[seq];

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
            b.innerText = '総復習クリア';
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
    document.getElementById('kb-chapter-container').style.display = 'flex';
    document.getElementById('kb-stage-container').style.display = 'none';
    document.getElementById('kb-bottom-back-btn').style.display = 'block';
}
