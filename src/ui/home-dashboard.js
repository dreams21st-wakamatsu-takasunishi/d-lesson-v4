import { ALPHABET_READING_STAGES, STAGE_ORDER, VISION_STAGES, WORD_STAGES } from '../data/constants.js';
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
import { goToTextMenu } from '../games/text.js';
import { renderVisionMenu } from '../games/vision.js';
import { goToWordMenu } from '../games/word.js';
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

function getLearningPathLabel(user) {
    const mouseLevel = Number(user?.mouseLevel || 0);
    const alphabetSeq = Number(user?.alphabetSequence || 0);
    const keyboardSeq = Number(user?.keyboardSequence || 0);
    if (mouseLevel < 7) return `マウス M-${mouseLevel + 1}`;
    if (alphabetSeq < ALPHABET_READING_STAGES.length) return `ABC ${alphabetSeq + 1}/${ALPHABET_READING_STAGES.length}`;
    if (keyboardSeq < STAGE_ORDER.length) return `キーボード ${keyboardSeq + 1}/${STAGE_ORDER.length}`;
    return '応用練習';
}

function buildNextLearningActions(user, progressMap) {
    const actions = [];
    const mouseLevel = Number(user?.mouseLevel || 0);
    const alphabetSeq = Number(user?.alphabetSequence || 0);
    const keyboardSeq = Number(user?.keyboardSequence || 0);

    if (mouseLevel < 7) {
        actions.push({
            title: 'マウスれんしゅう',
            detail: `M-${mouseLevel + 1} へすすむ`,
            run: () => {
                homeUiHandlers.openMouseMenu();
                startGame(mouseLevel + 1, 'mouse');
            }
        });
    }

    if (alphabetSeq < ALPHABET_READING_STAGES.length) {
        const nextAlphabet = ALPHABET_READING_STAGES[alphabetSeq];
        actions.push({
            title: 'ABCをおぼえる',
            detail: `${nextAlphabet.title} へすすむ`,
            run: () => {
                showScreen('screen-keyboard-menu');
                startGame(nextAlphabet.id, 'keyboard');
            }
        });
    }

    if (keyboardSeq < STAGE_ORDER.length) {
        const nextId = STAGE_ORDER[keyboardSeq];
        const stageName = getStageName(nextId).replace(/\[ID:\d+\]\s*/, '');
        actions.push({
            title: 'キーボードれんしゅう',
            detail: `${stageName} へすすむ`,
            run: () => {
                showScreen('screen-keyboard-menu');
                startGame(nextId, 'keyboard');
            }
        });
    }

    if (progressMap.vision.total > 0 && progressMap.vision.done < progressMap.vision.total) {
        actions.push({
            title: 'ビジョントレーニング',
            detail: `${progressMap.vision.done}/${progressMap.vision.total} からつづき`,
            run: () => {
                renderVisionMenu();
                showScreen('screen-vision-menu');
            }
        });
    }

    if (progressMap.text.total > 0 && progressMap.text.done < progressMap.text.total) {
        actions.push({
            title: '文章入力れんしゅう',
            detail: `${progressMap.text.done}/${progressMap.text.total} からつづき`,
            run: () => goToTextMenu()
        });
    }

    if (progressMap.word.total > 0 && progressMap.word.done < progressMap.word.total) {
        actions.push({
            title: 'Wordれんしゅう',
            detail: `${progressMap.word.done}/${progressMap.word.total} からつづき`,
            run: () => goToWordMenu()
        });
    }

    if (progressMap.minigame.done < progressMap.minigame.total) {
        actions.push({
            title: 'タイピングゲーム',
            detail: 'スコアにちょうせん',
            run: () => showScreen('screen-minigame-menu')
        });
    }

    if (!actions.length) {
        actions.push({
            title: 'マイページ',
            detail: '記録と賞状をみる',
            run: () => homeUiHandlers.openRecords()
        });
    }

    return actions;
}

function renderHomeNextActions(user, actions) {
    const currentPath = document.getElementById('home-current-path');
    if (currentPath) currentPath.textContent = getLearningPathLabel(user);

    const list = document.getElementById('home-next-action-list');
    if (!list) return;
    list.innerHTML = '';
    actions.slice(0, 3).forEach((action, index) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = index === 0 ? 'home-next-action is-primary' : 'home-next-action';
        button.onclick = () => {
            void action.run();
        };

        const number = document.createElement('span');
        number.className = 'home-next-number';
        number.textContent = String(index + 1);

        const copy = document.createElement('span');
        copy.className = 'home-next-copy';
        const title = document.createElement('strong');
        title.textContent = action.title;
        const detail = document.createElement('small');
        detail.textContent = action.detail;
        copy.appendChild(title);
        copy.appendChild(detail);

        button.appendChild(number);
        button.appendChild(copy);
        list.appendChild(button);
    });
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
    const alphabetSeq = Number(u.alphabetSequence || 0);
    const maxAlphabet = ALPHABET_READING_STAGES.length;
    const kPct = Math.floor((kSeq / maxKb) * 100);
    const kbPctDisplay = document.getElementById('home-kb-pct');
    const kbBar = document.getElementById('home-kb-bar');
    if (kbPctDisplay) kbPctDisplay.innerText = `${kPct}%`;
    if (kbBar) kbBar.style.width = `${kPct}%`;

    const progressMap = {
        mouse: { done: mLv, total: maxMouse },
        keyboard: { done: kSeq, total: maxKb },
        text: getTextTaskProgress(u),
        vision: getVisionProgress(u),
        word: getWordProgress(u),
        minigame: getTypingGameProgress(u)
    };
    updatePracticeCategoryProgress(u, progressMap);

    const nextActions = buildNextLearningActions(u, progressMap);
    renderHomeNextActions(u, nextActions);

    const btn = document.getElementById('btn-recommend');
    if (!btn) return;
    btn.style.animation = 'pulse 2s infinite';
    btn.style.backgroundColor = '';
    btn.style.color = '';
    const primaryAction = nextActions[0];
    if (primaryAction?.title !== 'マイページ') {
        btn.innerHTML = `<span class="recommend-main">${primaryAction.title}</span><span class="recommend-sub">${primaryAction.detail}</span>`;
        btn.onclick = () => {
            void primaryAction.run();
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
