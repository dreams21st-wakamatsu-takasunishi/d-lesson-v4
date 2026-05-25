import {
    currentUser,
    users,
    GLOBAL_SETTINGS_ID,
    canWriteCurrentUserRow,
    recordPracticeActivity
} from '../api/user.js';
import {
    STAGE_ORDER,
    VISION_STAGES
} from '../data/constants.js';
import { getStageName } from '../utils/stages.js';

export const DAILY_MISSION_DEFAULTS = Object.freeze({
    enabled: true,
    count: 3,
    reward: 500
});

const DAILY_MISSION_LOGIC_VERSION = 2;
const MOUSE_STAGE_COUNT = 7;

function clampInteger(value, fallback, min, max) {
    const parsed = Number.parseInt(value, 10);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.min(max, Math.max(min, parsed));
}

export function getDailyMissionSettings(source = users?.[GLOBAL_SETTINGS_ID]) {
    const raw = source?.dailyMissionSettings || {};
    return {
        enabled: raw.enabled !== false,
        count: clampInteger(raw.count, DAILY_MISSION_DEFAULTS.count, 3, 5),
        reward: clampInteger(raw.reward, DAILY_MISSION_DEFAULTS.reward, 0, 9999)
    };
}

function getTodayKey() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function hashText(value) {
    let hash = 0;
    String(value || '').split('').forEach(char => {
        hash = ((hash << 5) - hash) + char.charCodeAt(0);
        hash |= 0;
    });
    return Math.abs(hash);
}

function cleanStageName(stageId) {
    return getStageName(stageId).replace(/\[ID:[^\]]+\]\s*/, '');
}

function getMouseLevel(user) {
    return clampInteger(user?.mouseLevel, 0, 0, MOUSE_STAGE_COUNT);
}

function getKeyboardSequence(user) {
    return clampInteger(user?.keyboardSequence, 0, 0, STAGE_ORDER.length);
}

function getNormalVisionClearedSet(user) {
    return new Set((Array.isArray(user?.visionCleared) ? user.visionCleared : [])
        .map(String)
        .filter(stageId => VISION_STAGES.some(stage => stage.id === stageId)));
}

function makeMouseMission(user, offset = 0) {
    const level = getMouseLevel(user);
    if (level >= MOUSE_STAGE_COUNT) return null;
    const stage = offset === 0
        ? level + 1
        : (level > 0 ? (((hashText(`${currentUser}:mouse:${getTodayKey()}`) + offset) % level) + 1) : null);
    if (!stage) return null;
    return {
        id: `mouse:${stage}`,
        type: 'mouse',
        stage,
        title: `マウス M-${stage}`,
        note: offset === 0 ? 'つぎのマウス練習' : 'マウスの復習'
    };
}

function makeKeyboardMission(user, offset = 0) {
    const sequence = getKeyboardSequence(user);
    if (sequence >= STAGE_ORDER.length) return null;
    const stage = offset === 0
        ? STAGE_ORDER[sequence]
        : (sequence > 0 ? STAGE_ORDER[(hashText(`${currentUser}:keyboard:${getTodayKey()}`) + offset) % sequence] : null);
    if (!stage) return null;
    return {
        id: `keyboard:${stage}`,
        type: 'keyboard',
        stage,
        title: cleanStageName(stage),
        note: offset === 0 ? 'つぎのキーボード練習' : 'キーボードの復習'
    };
}

function makeVisionMission(user, offset = 0) {
    const cleared = getNormalVisionClearedSet(user);
    const clearedStages = VISION_STAGES.filter(stage => cleared.has(stage.id));
    const nextStage = offset === 0
        ? VISION_STAGES.find(stage => !cleared.has(stage.id))
        : (clearedStages.length > 0 && cleared.size < VISION_STAGES.length
            ? clearedStages[(hashText(`${currentUser}:vision:${getTodayKey()}`) + offset) % clearedStages.length]
            : null);
    if (!nextStage) return null;
    return {
        id: `vision:${nextStage.id}`,
        type: 'vision',
        stage: nextStage.id,
        title: nextStage.title,
        note: offset > 0 ? 'ビジョンの復習' : 'まだのビジョン練習'
    };
}

function buildDailyMissionTasks(user) {
    const count = getDailyMissionSettings().count;
    const candidates = [
        makeMouseMission(user),
        makeKeyboardMission(user),
        makeVisionMission(user),
        makeKeyboardMission(user, 7),
        makeVisionMission(user, 11),
        makeMouseMission(user, 3),
        makeKeyboardMission(user, 13),
        makeVisionMission(user, 17)
    ];
    const tasks = [];
    const usedIds = new Set();

    candidates.forEach(task => {
        if (!task || usedIds.has(task.id) || tasks.length >= count) return;
        usedIds.add(task.id);
        tasks.push(task);
    });

    return tasks;
}

function isMissionTaskStillEligible(task, user) {
    if (!task || typeof task !== 'object') return false;
    if (task.doneAt) return true;

    if (task.type === 'mouse') {
        const level = getMouseLevel(user);
        const stage = Number(task.stage);
        return Number.isInteger(stage)
            && stage >= 1
            && stage <= MOUSE_STAGE_COUNT
            && level < MOUSE_STAGE_COUNT
            && (stage === level + 1 || stage <= level);
    }

    if (task.type === 'keyboard') {
        const sequence = getKeyboardSequence(user);
        const stage = Number(task.stage);
        const index = STAGE_ORDER.indexOf(stage);
        return sequence < STAGE_ORDER.length && index !== -1 && index <= sequence;
    }

    if (task.type === 'vision') {
        const cleared = getNormalVisionClearedSet(user);
        const stageId = String(task.stage || '').replace('_easy', '').replace('_hard', '');
        const exists = VISION_STAGES.some(stage => stage.id === stageId);
        const nextStage = VISION_STAGES.find(stage => !cleared.has(stage.id));
        return exists && cleared.size < VISION_STAGES.length && (cleared.has(stageId) || nextStage?.id === stageId);
    }

    return false;
}

function createDailyMission(user) {
    return {
        date: getTodayKey(),
        version: DAILY_MISSION_LOGIC_VERSION,
        rewardClaimed: false,
        tasks: buildDailyMissionTasks(user)
    };
}

function normalizeDailyMission(mission, user) {
    const count = getDailyMissionSettings().count;
    const today = getTodayKey();
    if (!mission || mission.date !== today || !Array.isArray(mission.tasks)) {
        return createDailyMission(user);
    }

    const keepOnlyCompletedOldTasks = mission.version !== DAILY_MISSION_LOGIC_VERSION;
    mission.tasks = mission.tasks
        .filter(task => task && typeof task === 'object')
        .map(task => ({
            id: String(task.id || `${task.type}:${task.stage}`),
            type: String(task.type || ''),
            stage: task.stage,
            title: String(task.title || ''),
            note: String(task.note || ''),
            doneAt: task.doneAt || null
        }))
        .filter(task => {
            if (keepOnlyCompletedOldTasks && !task.doneAt) return false;
            return isMissionTaskStillEligible(task, user);
        })
        .slice(0, count);

    if (mission.tasks.length < count) {
        const existingIds = new Set(mission.tasks.map(task => task.id));
        buildDailyMissionTasks(user).forEach(task => {
            if (mission.tasks.length < count && !existingIds.has(task.id)) {
                mission.tasks.push(task);
            }
        });
    }

    mission.rewardClaimed = Boolean(mission.rewardClaimed);
    mission.version = DAILY_MISSION_LOGIC_VERSION;
    return mission;
}

export function ensureDailyMission() {
    if (!currentUser || !users[currentUser]) return null;
    if (!getDailyMissionSettings().enabled) return null;
    users[currentUser].dailyMission = normalizeDailyMission(users[currentUser].dailyMission, users[currentUser]);
    return users[currentUser].dailyMission;
}

export function getNextIncompleteDailyMission() {
    const mission = ensureDailyMission();
    if (!mission) return null;
    return mission.tasks.find(task => !task.doneAt) || null;
}

function missionMatchesPractice(mission, practice = {}) {
    if (!mission || mission.doneAt) return false;
    const type = String(practice.type || practice.category || '');
    if (mission.type !== type) return false;

    if (mission.type === 'vision') {
        const practiceStage = String(practice.stage || '').replace('_easy', '').replace('_hard', '');
        return String(mission.stage) === practiceStage;
    }

    return String(mission.stage) === String(practice.stage);
}

export function markDailyMissionComplete(practice = {}) {
    if (!canWriteCurrentUserRow()) return null;
    const settings = getDailyMissionSettings();
    if (!settings.enabled) return null;
    const mission = ensureDailyMission();
    if (!mission) return null;

    const task = mission.tasks.find(item => missionMatchesPractice(item, practice));
    if (!task) return null;

    task.doneAt = new Date().toISOString();
    const doneCount = mission.tasks.filter(item => item.doneAt).length;
    const allDone = doneCount === mission.tasks.length;

    if (allDone && !mission.rewardClaimed) {
        mission.rewardClaimed = true;
        users[currentUser].coins = (users[currentUser].coins || 0) + settings.reward;
        recordPracticeActivity({
            category: 'daily_mission',
            title: 'デイリーミッション',
            detail: '達成ボーナス',
            amount: `${doneCount}/${mission.tasks.length} 達成`,
            coins: settings.reward
        });
        return { task, reward: settings.reward, doneCount, total: mission.tasks.length };
    }

    return { task, reward: 0, doneCount, total: mission.tasks.length };
}

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

export function renderDailyMissionPanel(container, handlers = {}) {
    if (!container) return;
    const settings = getDailyMissionSettings();
    if (!settings.enabled || !currentUser || !users[currentUser] || !canWriteCurrentUserRow()) {
        container.style.display = 'none';
        container.innerHTML = '';
        return;
    }

    const mission = ensureDailyMission();
    if (!mission) {
        container.style.display = 'none';
        return;
    }

    if (!mission.tasks.length) {
        container.style.display = 'block';
        container.innerHTML = `
            <div class="daily-mission-head">
                <div>
                    <span class="daily-mission-kicker">今日のミッション</span>
                    <strong>なし</strong>
                </div>
            </div>
            <div class="daily-mission-empty">今の進捗では、新しくおすすめできる未達成課題がありません。</div>
        `;
        return;
    }

    const doneCount = mission.tasks.filter(task => task.doneAt).length;
    const percent = mission.tasks.length ? Math.round((doneCount / mission.tasks.length) * 100) : 0;
    container.style.display = 'block';
    container.innerHTML = `
        <div class="daily-mission-head">
            <div>
                <span class="daily-mission-kicker">今日のミッション</span>
                <strong>${escapeHtml(doneCount)} / ${escapeHtml(mission.tasks.length)}</strong>
            </div>
            <span class="daily-mission-reward">${mission.rewardClaimed ? `${escapeHtml(settings.reward)}コイン 受け取り済み` : `全部で ${escapeHtml(settings.reward)}コイン`}</span>
        </div>
        <div class="daily-mission-progress"><span style="width:${escapeHtml(percent)}%;"></span></div>
        <div class="daily-mission-list"></div>
    `;

    const list = container.querySelector('.daily-mission-list');
    mission.tasks.forEach((task, index) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = `daily-mission-task${task.doneAt ? ' is-done' : ''}`;
        button.innerHTML = `
            <span class="daily-mission-number">${escapeHtml(index + 1)}</span>
            <span class="daily-mission-copy">
                <strong>${escapeHtml(task.title)}</strong>
                <small>${task.doneAt ? 'できました' : escapeHtml(task.note || 'れんしゅう')}</small>
            </span>
            <span class="daily-mission-check">${task.doneAt ? 'OK' : '▶'}</span>
        `;
        button.onclick = () => {
            if (task.doneAt) return;
            if (typeof handlers.startMission === 'function') handlers.startMission(task);
        };
        list.appendChild(button);
    });
}
