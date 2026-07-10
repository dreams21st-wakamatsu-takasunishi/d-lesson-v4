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

const PRACTICE_CATEGORY_COURSES = Object.freeze({
    mouse: 'マウス',
    keyboard: 'もじをうつ',
    text: 'ぶんしょう',
    word: 'Word',
    vision: 'みる力',
    minigame: 'あそび'
});

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
    return 'あそび';
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
            title: 'ぶんしょうをうつ',
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
            detail: 'きろくとしょうじょうをみる',
            run: () => homeUiHandlers.openRecords()
        });
    }

    return actions;
}

function renderHomeNextActions(user, actions) {
    const currentPath = document.getElementById('home-current-path');
    if (currentPath) currentPath.textContent = `いまここ：${getLearningPathLabel(user)}`;

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
    if (mouseLvDisplay) mouseLvDisplay.innerText = mLv >= 7 ? 'Lv.MAX' : `Lv.${mLv} / 7`;
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
        keyboard: {
            done: Math.min(alphabetSeq, maxAlphabet) + Math.min(kSeq, maxKb),
            total: maxAlphabet + maxKb
        },
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

function getVisibleTextTasksForUser(user) {
    return (Array.isArray(users?.[GLOBAL_SETTINGS_ID]?.textTasks) ? users[GLOBAL_SETTINGS_ID].textTasks : [])
        .filter(task => task && task.hidden !== true)
        .filter(task => {
            const targetGroup = String(task?.targetGroup || '').trim();
            if (!targetGroup) return true;
            return String(user?.group || '').trim() === targetGroup;
        });
}

function getTextTaskProgress(user) {
    const tasks = getVisibleTextTasksForUser(user);
    const done = tasks.filter(task => user?.textRecords?.[task.id]).length;
    const nextTask = tasks.find(task => !user?.textRecords?.[task.id]);
    return { done, total: tasks.length, nextTitle: nextTask?.title ? String(nextTask.title) : '' };
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
    const nextStage = VISION_STAGES.find(stage => [
        `${stage.id}_easy`,
        stage.id,
        `${stage.id}_hard`
    ].some(id => !cleared.has(id)));
    return { done: cleared.size, total: VISION_STAGES.length * 3, nextTitle: nextStage?.title || '' };
}

function getWordProgress(user) {
    const progress = user?.wordProgress || {};
    const done = WORD_STAGES.filter(stage => progress?.[stage.id]?.status === 'cleared').length;
    const nextStage = WORD_STAGES.find(stage => progress?.[stage.id]?.status !== 'cleared');
    return { done, total: WORD_STAGES.length, nextTitle: nextStage?.title || '' };
}

function getTypingGameProgress(user) {
    const done = [
        Number(user?.minigameHighscore || 0) > 0,
        Number(user?.dChallengeHighscore || 0) > 0
    ].filter(Boolean).length;
    return { done, total: 2 };
}

function cleanStageName(stageId) {
    return getStageName(stageId).replace(/\[ID:\d+\]\s*/, '').trim();
}

function buildPracticeCategoryStatus(user, progressMap) {
    const mouseLevel = Number(user?.mouseLevel || 0);
    const alphabetSeq = Number(user?.alphabetSequence || 0);
    const keyboardSeq = Number(user?.keyboardSequence || 0);
    const wordLocked = !user?.isMaster && !user?.examRecords?.romaji_daku_exam;

    const keyboardNext = (() => {
        if (alphabetSeq < ALPHABET_READING_STAGES.length) {
            return `つぎ: ${ALPHABET_READING_STAGES[alphabetSeq]?.title || `ABC ${alphabetSeq + 1}`}`;
        }
        if (keyboardSeq < STAGE_ORDER.length) {
            return `つぎ: ${cleanStageName(STAGE_ORDER[keyboardSeq])}`;
        }
        return 'できた';
    })();

    return {
        mouse: {
            course: PRACTICE_CATEGORY_COURSES.mouse,
            next: mouseLevel >= 7 ? 'できた' : `つぎ: M-${mouseLevel + 1}`,
            state: mouseLevel >= 7 ? 'complete' : ''
        },
        keyboard: {
            course: PRACTICE_CATEGORY_COURSES.keyboard,
            next: keyboardNext,
            state: progressMap.keyboard.done >= progressMap.keyboard.total ? 'complete' : ''
        },
        text: {
            course: PRACTICE_CATEGORY_COURSES.text,
            next: getProgressNextLabel(progressMap.text, 'やるものなし', progressMap.text.nextTitle),
            state: getProgressState(progressMap.text)
        },
        word: {
            course: PRACTICE_CATEGORY_COURSES.word,
            next: wordLocked ? 'ローマ字テストのあと' : getProgressNextLabel(progressMap.word, 'やるものなし', progressMap.word.nextTitle),
            state: wordLocked ? 'locked' : getProgressState(progressMap.word)
        },
        vision: {
            course: PRACTICE_CATEGORY_COURSES.vision,
            next: getProgressNextLabel(progressMap.vision, 'やるものなし', progressMap.vision.nextTitle),
            state: getProgressState(progressMap.vision)
        },
        minigame: {
            course: PRACTICE_CATEGORY_COURSES.minigame,
            next: progressMap.minigame.done >= progressMap.minigame.total ? 'きろくあり' : 'スコアにちょうせん',
            state: progressMap.minigame.done >= progressMap.minigame.total ? 'complete' : ''
        }
    };
}

function getProgressNextLabel(progress, emptyLabel, nextTitle) {
    const done = Math.max(0, Number(progress?.done || 0));
    const total = Math.max(0, Number(progress?.total || 0));
    if (total <= 0) return emptyLabel;
    if (done >= total) return 'できた';
    return nextTitle ? `つぎ: ${nextTitle}` : `あと ${total - done}`;
}

function getProgressState(progress) {
    const done = Math.max(0, Number(progress?.done || 0));
    const total = Math.max(0, Number(progress?.total || 0));
    return total > 0 && done >= total ? 'complete' : '';
}

function updatePracticeCategoryProgress(user, progressMap) {
    const statusMap = buildPracticeCategoryStatus(user, progressMap);
    Object.entries(progressMap).forEach(([key, progress]) => {
        const done = Math.max(0, Number(progress?.done || 0));
        const total = Math.max(0, Number(progress?.total || 0));
        const percent = total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 0;
        const card = document.getElementById(`cat-${key}`);
        const course = document.getElementById(`cat-${key}-course`);
        const label = document.getElementById(`cat-${key}-progress`);
        const next = document.getElementById(`cat-${key}-next`);
        const meter = document.getElementById(`cat-${key}-meter`);
        const status = statusMap[key] || {};
        if (card) {
            card.classList.toggle('is-complete', status.state === 'complete');
            card.classList.toggle('is-locked', status.state === 'locked');
        }
        if (course) {
            course.textContent = status.course || PRACTICE_CATEGORY_COURSES[key] || '';
        }
        if (label) {
            label.textContent = total > 0 ? `${done}/${total}` : 'まだ';
        }
        if (next) {
            next.textContent = status.next || '';
        }
        if (meter) {
            meter.style.width = `${percent}%`;
        }
    });
}
