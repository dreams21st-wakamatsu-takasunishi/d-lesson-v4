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
import { showCustomAlert } from './modal.js';
import { showScreen } from './screen.js';
import { setCurrentKeyboardChapter } from './keyboard-state.js';
import { startGame } from '../games/core.js';

let currentKeyboardCategory = 'basic';

function getActiveUserOrTitle() {
    const u = currentUser ? users[currentUser] : null;
    if (u) return u;
    showCustomAlert('ユーザーを選択してください');
    showScreen('screen-title');
    return null;
}

export function goToKeyboardCategory() {
    showScreen('screen-keyboard-category');
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

    displayChapters.forEach(chap => {
        let chapUnlocked = isUnlocked(chap.stages[0]);
        let chapCleared = true;
        chap.stages.forEach(sid => {
            if (!isCleared(sid)) chapCleared = false;
        });
        if (chap.exam && !isCleared(chap.exam)) chapCleared = false;

        const btn = document.createElement('button');
        btn.className = 'category-btn';
        if (!chapUnlocked) {
            btn.style.opacity = '0.5';
            btn.style.cursor = 'not-allowed';
            btn.style.backgroundColor = '#9e9e9e';
        } else {
            btn.style.backgroundColor = chapCleared ? '#4CAF50' : '#FF9800';
            btn.onclick = () => renderKeyboardStages(chap);
        }
        btn.style.width = '280px';
        btn.style.height = '120px';

        let icon = '⌨️';
        if (currentKeyboardCategory === 'basic') icon = '🅰️';
        if (currentKeyboardCategory === 'blind') icon = '🙈';
        if (currentKeyboardCategory === 'hiragana') icon = 'あ';
        if (currentKeyboardCategory === 'word') icon = '🍎';

        btn.innerHTML = `<span style="font-size:40px;">${icon}</span><span style="font-size:16px; font-weight:bold; margin-top:5px; line-height:1.3; width:100%; word-wrap:break-word;">${chap.title}</span>`;
        if (chapCleared) btn.innerHTML += `<span style="font-size:14px; margin-top:5px; color:#fff;">✅ クリア済</span>`;

        cont.appendChild(btn);
    });

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

    chap.stages.forEach((sid, index) => {
        let title = `ステップ ${index + 1}`;
        let keys = '';
        let sub = '';
        let exCls = '';
        const act = () => startGame(sid, 'keyboard');
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
                    sub = '(ブラインド試)';
                    exCls = 'blind-exam';
                } else if (sid >= 3100) {
                    sub = '(ブラインド練)';
                    exCls = 'blind-practice';
                } else {
                    sub = st.title.split('(')[0];
                }
            }
        } else if (sid >= 2000 && sid < 3000) {
            const st = BLIND_STAGES.find(s => s.id === sid);
            if (st) {
                keys = st.title.split('(')[0];
                sub = st.type === 'exam' ? '(試)' : '(練)';
                exCls = st.type === 'exam' ? 'blind-exam' : 'blind-practice';
            }
        } else {
            const st = KEYBOARD_STAGES.find(s => s.id === sid);
            if (st) {
                keys = st.keys.filter(k => k !== 'SPACE').join('');
                sub = st.title;
            }
        }

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
}

export function backToKbChapter() {
    document.getElementById('kb-chapter-container').style.display = 'flex';
    document.getElementById('kb-stage-container').style.display = 'none';
    document.getElementById('kb-bottom-back-btn').style.display = 'block';
}
