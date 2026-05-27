import { STAGE_ORDER, VISION_STAGES, WORD_STAGES } from '../data/constants.js';
import {
    users,
    currentUser,
    GLOBAL_SETTINGS_ID,
    hasLessonRole
} from '../api/user.js';
import { getStageName } from '../utils/stages.js';
import { renderLastPracticeCard } from './practice-history.js';
import { showScreen } from './screen.js';
import { startGame, startDailyMissionPractice } from '../games/core.js';
import { renderDailyMissionPanel } from './daily-missions.js';

const homeUiHandlers = {
    openMouseMenu: () => showScreen('screen-mouse-menu'),
    openRecords: () => showScreen('screen-records')
};

export function setHomeUiHandlers(handlers = {}) {
    Object.assign(homeUiHandlers, handlers);
}

function updateTitleRoleActions() {
    const teacherMenuBtn = document.getElementById('title-teacher-menu-btn');
    const adminBtn = document.getElementById('title-admin-btn');
    const canUseTeacherMenu = hasLessonRole('teacher', 'admin');
    const canUseAdmin = hasLessonRole('admin');

    if (teacherMenuBtn) teacherMenuBtn.style.display = canUseTeacherMenu ? 'inline-flex' : 'none';
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

    const dailyMissionCard = document.getElementById('daily-mission-card');
    if (dailyMissionCard) {
        renderDailyMissionPanel(dailyMissionCard, {
            startMission: (task) => {
                startDailyMissionPractice(task);
            }
        });
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

    updatePracticeCategoryProgress(u, {
        mouse: { done: mLv, total: maxMouse },
        keyboard: { done: kSeq, total: maxKb },
        text: getTextTaskProgress(u),
        vision: getVisionProgress(u),
        word: getWordProgress(u),
        minigame: getTypingGameProgress(u)
    });

    const btn = document.getElementById('btn-recommend');
    if (!btn) return;
    btn.style.animation = 'pulse 2s infinite';
    btn.style.backgroundColor = '';
    btn.style.color = '';
    if (mLv < 7) {
        btn.innerHTML = `<span class="recommend-main">🖱️ マウスのれんしゅう</span><span class="recommend-sub">M-${mLv + 1} へすすむ</span>`;
        btn.onclick = () => {
            homeUiHandlers.openMouseMenu();
            startGame(mLv + 1, 'mouse');
        };
    } else if (kSeq < maxKb) {
        const nextId = STAGE_ORDER[kSeq];
        const stageName = getStageName(nextId).replace(/\[ID:\d+\]\s*/, '');
        btn.innerHTML = `<span class="recommend-main">⌨️ キーボードれんしゅう</span><span class="recommend-sub">${stageName} へすすむ</span>`;
        btn.onclick = () => {
            showScreen('screen-keyboard-menu');
            startGame(nextId, 'keyboard');
        };
    } else {
        btn.innerHTML = `<span class="recommend-main">🏆 すべてクリア！</span><span class="recommend-sub">にがてとっくん や ガチャであそぼう</span>`;
        btn.onclick = () => homeUiHandlers.openRecords();
        btn.style.animation = 'none';
        btn.style.backgroundColor = '#FFD700';
        btn.style.color = '#333';
    }
}

function getTextTaskProgress(user) {
    const tasks = (Array.isArray(users?.[GLOBAL_SETTINGS_ID]?.textTasks) ? users[GLOBAL_SETTINGS_ID].textTasks : [])
        .filter(task => task && task.hidden !== true)
        .filter(task => {
            const targetGroup = String(task?.targetGroup || '').trim();
            if (!targetGroup) return true;
            return String(user?.group || '').trim() === targetGroup;
        });
    const done = tasks.filter(task => user?.textRecords?.[task.id]).length;
    return { done, total: tasks.length };
}

function getVisionProgress(user) {
    const validIds = new Set(VISION_STAGES.flatMap(stage => [
        stage.id,
        `${stage.id}_easy`,
        `${stage.id}_hard`
    ]));
    const cleared = new Set((Array.isArray(user?.visionCleared) ? user.visionCleared : [])
        .map(String)
        .filter(id => validIds.has(id)));
    return { done: cleared.size, total: VISION_STAGES.length * 3 };
}

function getWordProgress(user) {
    const progress = user?.wordProgress || {};
    const done = WORD_STAGES.filter(stage => progress?.[stage.id]?.status === 'cleared').length;
    return { done, total: WORD_STAGES.length };
}

function getTypingGameProgress(user) {
    const done = Number(user?.minigameHighscore || 0) > 0 || Number(user?.dChallengeHighscore || 0) > 0 ? 1 : 0;
    return { done, total: 2 };
}

function updatePracticeCategoryProgress(user, progressMap) {
    Object.entries(progressMap).forEach(([key, progress]) => {
        const done = Math.max(0, Number(progress?.done || 0));
        const total = Math.max(0, Number(progress?.total || 0));
        const percent = total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 0;
        const label = document.getElementById(`cat-${key}-progress`);
        const meter = document.getElementById(`cat-${key}-meter`);
        if (label) {
            label.textContent = total > 0 ? `${done}/${total}` : '未設定';
        }
        if (meter) {
            meter.style.width = `${percent}%`;
        }
    });
}
