import { STAGE_ORDER } from '../data/constants.js';
import {
    users,
    currentUser,
    hasLessonRole
} from '../api/user.js';
import { getStageName } from '../utils/stages.js';
import { renderLastPracticeCard } from './practice-history.js';
import { showScreen } from './screen.js';
import { startGame } from '../games/core.js';

const homeUiHandlers = {
    openMouseMenu: () => showScreen('screen-mouse-menu'),
    openRecords: () => showScreen('screen-records')
};

export function setHomeUiHandlers(handlers = {}) {
    Object.assign(homeUiHandlers, handlers);
}

function updateTitleRoleActions() {
    const teacherPreviewBtn = document.getElementById('title-teacher-preview-btn');
    const teacherStatusBtn = document.getElementById('title-teacher-status-btn');
    const adminBtn = document.getElementById('title-admin-btn');
    const canUseTeacherPreview = hasLessonRole('teacher', 'admin');
    const canUseTeacherStatus = hasLessonRole('teacher', 'admin');
    const canUseAdmin = hasLessonRole('admin');

    if (teacherPreviewBtn) teacherPreviewBtn.style.display = canUseTeacherPreview ? 'inline-flex' : 'none';
    if (teacherStatusBtn) teacherStatusBtn.style.display = canUseTeacherStatus ? 'inline-flex' : 'none';
    if (adminBtn) adminBtn.style.display = canUseAdmin ? 'inline-flex' : 'none';
}

export function updateGlobalHeader() {
    updateTitleRoleActions();

    if (currentUser && users[currentUser]) {
        const coinDisplay = document.getElementById('global-coin-display');
        if (coinDisplay) coinDisplay.innerText = `💰 ${users[currentUser].coins || 0}`;
    }
}

export function updateHomeDashboard() {
    if (!currentUser || !users[currentUser]) return;
    const u = users[currentUser];

    const lastPracticeCard = document.getElementById('last-practice-card');
    if (lastPracticeCard) {
        renderLastPracticeCard(lastPracticeCard, currentUser);
    }

    const maxMouse = 7;
    const mLv = u.mouseLevel || 0;
    const mPct = Math.floor((mLv / maxMouse) * 100);
    const mouseLvDisplay = document.getElementById('home-mouse-lv');
    const mouseBar = document.getElementById('home-mouse-bar');
    if (mouseLvDisplay) mouseLvDisplay.innerText = mLv >= 7 ? 'Lv.MAX (免許皆伝)' : `Lv.${mLv} / 7`;
    if (mouseBar) mouseBar.style.width = `${mPct}%`;

    const maxKb = STAGE_ORDER.length;
    const kSeq = u.keyboardSequence || 0;
    const kPct = Math.floor((kSeq / maxKb) * 100);
    const kbPctDisplay = document.getElementById('home-kb-pct');
    const kbBar = document.getElementById('home-kb-bar');
    if (kbPctDisplay) kbPctDisplay.innerText = `${kPct}%`;
    if (kbBar) kbBar.style.width = `${kPct}%`;

    const btn = document.getElementById('btn-recommend');
    if (!btn) return;
    if (mLv < 7) {
        btn.innerHTML = `🖱️ マウスのれんしゅう<br><span style="font-size:14px;">(M-${mLv + 1} へ)</span>`;
        btn.onclick = () => {
            homeUiHandlers.openMouseMenu();
            startGame(mLv + 1, 'mouse');
        };
    } else if (kSeq < maxKb) {
        const nextId = STAGE_ORDER[kSeq];
        const stageName = getStageName(nextId).replace(/\[ID:\d+\]\s*/, '');
        btn.innerHTML = `⌨️ キーボードれんしゅう<br><span style="font-size:14px;">(${stageName} へ)</span>`;
        btn.onclick = () => {
            showScreen('screen-keyboard-menu');
            startGame(nextId, 'keyboard');
        };
    } else {
        btn.innerHTML = `🏆 すべてクリア！<br><span style="font-size:14px;">(にがてとっくん や ガチャであそぼう)</span>`;
        btn.onclick = () => homeUiHandlers.openRecords();
        btn.style.animation = 'none';
        btn.style.backgroundColor = '#FFD700';
        btn.style.color = '#333';
    }
}
