import { users, currentUser, saveUsers, getUserDisplayName, isSystemUserId } from '../api/user.js'
import { VISION_STAGES } from '../data/constants.js'
import { SoundManager } from '../utils/sound.js'
import { showScreen } from '../ui/screen.js'
import { createBtn } from '../utils/dom.js'
import { getRewardText } from '../utils/rewards.js'
import { shuffle } from '../utils/helpers.js'
import {
    startGame,
    els,
    addCurrentCount,
    addVisionScore,
    addVisionTarget,
    getCurrentCount,
    getProcessing,
    getTotalCount,
    getVisionEasyMode,
    getVisionHardMode,
    getVisionInterval,
    getVisionScore,
    getVisionTarget,
    getVisionTimeout,
    markClear,
    setCurrentCount,
    setProcessing,
    setTotalCount,
    setVisionInterval,
    setVisionScore,
    setVisionTarget,
    setVisionTimeout,
    updateProgress
} from './core.js';

let memoryLevel = 0;
let memorySeq = [];
let memoryInputIdx = 0;

const WIDE_SCAN_TARGET_SIZE = 78;
const WIDE_SCAN_TARGET_GAP = 16;
const FIND_DIFF_QUESTIONS = Object.freeze([
    { base: 'め', diff: 'ぬ' },
    { base: 'わ', diff: 'れ' },
    { base: 'は', diff: 'ほ' },
    { base: 'シ', diff: 'ツ' },
    { base: 'O', diff: 'Q' },
    { base: '大', diff: '犬' },
    { base: 'ソ', diff: 'ン' },
    { base: 'E', diff: 'F' },
    { base: 'あ', diff: 'お' },
    { base: 'ね', diff: 'れ' },
    { base: 'b', diff: 'd' }
]);
let lastSideCompareQuestionKey = '';
const VISION_MENU_GROUPS = [
    {
        title: '見つける・くらべる',
        description: '似ているもの、目標のもの、おなじ かたちを見つける練習です。',
        stageIds: ['v1', 'v2', 'v5', 'v12', 'v14', 'v15', 'v18', 'v20']
    },
    {
        title: '目で追う・反応する',
        description: '画面の広い範囲を見て、すばやく反応する練習です。',
        stageIds: ['v3', 'v4', 'v6', 'v10']
    },
    {
        title: '覚える・見通す',
        description: '見たものを覚える、周辺を見る、道をたどる練習です。',
        stageIds: ['v7', 'v8', 'v9', 'v11', 'v13', 'v16', 'v17', 'v19']
    }
];
let activeVisionMenuGroupIndex = null;

function getVisionStageClearCount(user, stageId) {
    return (user.visionCleared.includes(stageId + '_easy') ? 1 : 0)
        + (user.visionCleared.includes(stageId) ? 1 : 0)
        + (user.visionCleared.includes(stageId + '_hard') ? 1 : 0);
}

function getVisionGroupProgress(user, group) {
    const total = group.stageIds.length * 3;
    const cleared = group.stageIds.reduce((count, stageId) => count + getVisionStageClearCount(user, stageId), 0);
    return { cleared, total };
}

function getPreferredVisionGroupIndex(user) {
    const firstIncomplete = VISION_MENU_GROUPS.findIndex((group) => {
        const progress = getVisionGroupProgress(user, group);
        return progress.cleared < progress.total;
    });
    return firstIncomplete === -1 ? 0 : firstIncomplete;
}

export function showVisionCompare() {
    let sumNormal = {}, countNormal = {}, sumHard = {}, countHard = {}, sumEasy = {}, countEasy = {};
    VISION_STAGES.forEach(st => {
        sumNormal[st.id] = 0; countNormal[st.id] = 0;
        sumHard[st.id] = 0; countHard[st.id] = 0;
        sumEasy[st.id] = 0; countEasy[st.id] = 0;
    });
    
    Object.keys(users).forEach(n => {
        if(users[n].isMaster || isSystemUserId(n)) return;
        VISION_STAGES.forEach(st => {
           let recN = users[n].examRecords && users[n].examRecords[st.id];
           if(recN) { sumNormal[st.id] += recN; countNormal[st.id]++; }
           
           let recH = users[n].examRecords && users[n].examRecords[st.id+'_hard'];
           if(recH) { sumHard[st.id] += recH; countHard[st.id]++; }
           
           let recE = users[n].examRecords && users[n].examRecords[st.id+'_easy'];
           if(recE) { sumEasy[st.id] += recE; countEasy[st.id]++; }
        });
    });

    let html = '<table style="width:100%; border-collapse:collapse; font-size:16px;">';
    html += '<tr style="background:#f2f2f2; position:sticky; top:0; z-index:5;"><th style="border:1px solid #ccc; padding:8px;">ステージ</th><th style="border:1px solid #ccc; padding:8px;">難易度</th><th style="border:1px solid #ccc; padding:8px;">あなたのタイム</th><th style="border:1px solid #ccc; padding:8px;">みんなの平均</th></tr>';
    
    const u = users[currentUser];
    VISION_STAGES.forEach(st => {
        // イージー
        let myE = (u.examRecords && u.examRecords[st.id+'_easy']) ? u.examRecords[st.id+'_easy'].toFixed(1)+'秒' : '-';
        let avgE = countEasy[st.id] > 0 ? (sumEasy[st.id]/countEasy[st.id]).toFixed(1)+'秒' : '-';
        html += `<tr style="background:#e8f5e9;"><td style="border:1px solid #ccc; padding:8px; font-weight:bold;" rowspan="3">${st.icon} ${st.title}</td><td style="border:1px solid #ccc; padding:8px; color:#2E7D32;">🔰 イージー</td><td style="border:1px solid #ccc; padding:8px; text-align:center; color:#2E7D32;">${myE}</td><td style="border:1px solid #ccc; padding:8px; text-align:center; color:#2E7D32;">${avgE}</td></tr>`;

        // ノーマル
        let myN = (u.examRecords && u.examRecords[st.id]) ? u.examRecords[st.id].toFixed(1)+'秒' : '-';
        let avgN = countNormal[st.id] > 0 ? (sumNormal[st.id]/countNormal[st.id]).toFixed(1)+'秒' : '-';
        html += `<tr><td style="border:1px solid #ccc; padding:8px;">🟢 ノーマル</td><td style="border:1px solid #ccc; padding:8px; text-align:center;">${myN}</td><td style="border:1px solid #ccc; padding:8px; text-align:center;">${avgN}</td></tr>`;
        
        // ハード
        let myH = (u.examRecords && u.examRecords[st.id+'_hard']) ? u.examRecords[st.id+'_hard'].toFixed(1)+'秒' : '-';
        let avgH = countHard[st.id] > 0 ? (sumHard[st.id]/countHard[st.id]).toFixed(1)+'秒' : '-';
        html += `<tr style="background:#fff3e0;"><td style="border:1px solid #ccc; padding:8px; color:#d84315;">🔥 ハード</td><td style="border:1px solid #ccc; padding:8px; text-align:center; color:#d84315;">${myH}</td><td style="border:1px solid #ccc; padding:8px; text-align:center; color:#d84315;">${avgH}</td></tr>`;
    });
    html += '</table>';

    document.getElementById('vision-compare-content').innerHTML = html;
    document.getElementById('vision-compare-modal').style.display = 'flex';
}

export function renderVisionDashboardTable() {
    const tbody = document.getElementById('dash-vision-tbody');
    const thead = document.getElementById('dash-vision-thead');
    const diffSelect = document.getElementById('vision-diff-select');
    if (!tbody || !thead || !diffSelect) return;
    
    let diffVal = diffSelect.value; 
    let suffix = diffVal === 'normal' ? '' : '_' + diffVal;

    let htmlHead = '<tr><th style="border:1px solid #ccc; padding:8px; position:sticky; left:0; background:#f2f2f2; z-index:11;">名前</th>';
    VISION_STAGES.forEach(st => { htmlHead += `<th style="border:1px solid #ccc; padding:8px; font-size:14px;">${st.title}</th>`; });
    htmlHead += '</tr>';
    thead.innerHTML = htmlHead; tbody.innerHTML = '';
    
    let sumTimes = {}; let countTimes = {};
    VISION_STAGES.forEach(st => { sumTimes[st.id] = 0; countTimes[st.id] = 0; });

    let list =[];
    Object.keys(users).forEach(n => {
        if (!users[n] || users[n].isMaster || isSystemUserId(n)) return;
        list.push({ id: n, name: getUserDisplayName(n), user: users[n] });
    });
    list.sort((a, b) => a.name.localeCompare(b.name, 'ja'));

    list.forEach(item => {
        let tr = document.createElement('tr');
        let tdName = document.createElement('td');
        tdName.style.cssText = 'border:1px solid #ccc; padding:8px; font-weight:bold; position:sticky; left:0; background:#fff; z-index:5;';
        tdName.innerText = item.name; tr.appendChild(tdName);

        VISION_STAGES.forEach(st => {
            let td = document.createElement('td');
            td.style.cssText = 'border:1px solid #ccc; padding:8px; text-align:center;';
            let key = st.id + suffix;
            let rec = item.user.examRecords && item.user.examRecords[key];
            if (rec) {
                td.innerText = rec.toFixed(1) + '秒';
                sumTimes[st.id] += rec; countTimes[st.id]++;
            } else { td.innerText = '-'; td.style.color = '#ccc'; }
            tr.appendChild(td);
        });
        tbody.appendChild(tr);
    });

    let trAvg = document.createElement('tr');
    trAvg.style.backgroundColor = '#fff9c4'; trAvg.style.fontWeight = 'bold';
    let tdAvgName = document.createElement('td');
    tdAvgName.style.cssText = 'border:1px solid #ccc; padding:8px; position:sticky; left:0; background:#fff9c4; z-index:6; color:#f57f17;';
    tdAvgName.innerText = '★平均タイム'; trAvg.appendChild(tdAvgName);

    VISION_STAGES.forEach(st => {
        let td = document.createElement('td');
        td.style.cssText = 'border:1px solid #ccc; padding:8px; text-align:center; color:#d32f2f; font-size:18px;';
        if (countTimes[st.id] > 0) {
            td.innerText = (sumTimes[st.id] / countTimes[st.id]).toFixed(1) + '秒';
        } else { td.innerText = '-'; }
        trAvg.appendChild(td);
    });
    tbody.prepend(trAvg); 
}

export function renderVisionMenu() {
    const cont = document.getElementById('vision-menu-content');
    cont.innerHTML = '';
    cont.className = 'vision-menu-layout';
    cont.removeAttribute('style');

    const u = users[currentUser];
    if (!u) {
        showScreen('screen-title');
        return;
    }
    if (!Array.isArray(u.visionCleared)) u.visionCleared = [];

    if (activeVisionMenuGroupIndex === null || !VISION_MENU_GROUPS[activeVisionMenuGroupIndex]) {
        activeVisionMenuGroupIndex = getPreferredVisionGroupIndex(u);
    }

    const totalProgress = VISION_MENU_GROUPS.reduce((acc, group) => {
        const progress = getVisionGroupProgress(u, group);
        acc.cleared += progress.cleared;
        acc.total += progress.total;
        return acc;
    }, { cleared: 0, total: 0 });

    const overview = document.createElement('div');
    overview.className = 'vision-menu-overview';
    overview.innerHTML = `
        <div>
            <span class="vision-menu-kicker">分野をえらぶ</span>
            <strong>1つの分野だけ表示します</strong>
        </div>
        <span class="vision-menu-total">${totalProgress.cleared}/${totalProgress.total}</span>
    `;
    cont.appendChild(overview);

    const tabs = document.createElement('div');
    tabs.className = 'vision-group-tabs';
    VISION_MENU_GROUPS.forEach((group, index) => {
        const progress = getVisionGroupProgress(u, group);
        const tab = document.createElement('button');
        tab.type = 'button';
        tab.className = 'vision-group-tab' + (index === activeVisionMenuGroupIndex ? ' is-active' : '');
        tab.innerHTML = `
            <span class="vision-group-title">${group.title}</span>
            <span class="vision-group-desc">${group.description}</span>
            <span class="vision-group-progress">${progress.cleared}/${progress.total}</span>
        `;
        createBtn(tab, () => {
            activeVisionMenuGroupIndex = index;
            renderVisionMenu();
        });
        tabs.appendChild(tab);
    });
    cont.appendChild(tabs);

    const group = VISION_MENU_GROUPS[activeVisionMenuGroupIndex];
    const section = document.createElement('section');
    section.className = 'vision-stage-section vision-stage-section-current';

    const header = document.createElement('div');
    header.className = 'vision-stage-section-header';

    const copy = document.createElement('div');
    const title = document.createElement('h3');
    title.textContent = group.title;
    const desc = document.createElement('p');
    desc.textContent = group.description;
    copy.appendChild(title);
    copy.appendChild(desc);

    const groupProgress = getVisionGroupProgress(u, group);
    const progress = document.createElement('span');
    progress.className = 'vision-section-progress';
    progress.textContent = `${groupProgress.cleared}/${groupProgress.total}`;

    header.appendChild(copy);
    header.appendChild(progress);
    section.appendChild(header);

    const grid = document.createElement('div');
    grid.className = 'vision-stage-grid';

    group.stageIds.forEach((stageId) => {
        const st = VISION_STAGES.find((stage) => stage.id === stageId);
        if (st) grid.appendChild(createVisionStageCard(st, u));
    });

    section.appendChild(grid);
    cont.appendChild(section);
}

function createVisionStageCard(st, user) {
    const card = document.createElement('article');
    card.className = 'vision-stage-card';
    card.style.setProperty('--vision-accent', st.color || '#9C27B0');

    const main = document.createElement('div');
    main.setAttribute('role', 'button');
    main.className = 'vision-stage-main' + (user.visionCleared.includes(st.id) ? ' is-cleared' : '');
    createBtn(main, () => openVisionDifficultyDialog(st, user));

    const icon = document.createElement('span');
    icon.className = 'vision-stage-icon';
    icon.textContent = st.icon;
    const text = document.createElement('span');
    text.className = 'vision-stage-text';
    const title = document.createElement('span');
    title.className = 'vision-stage-title';
    title.textContent = st.title;
    const sub = document.createElement('span');
    sub.className = 'vision-stage-sub';
    sub.textContent = st.sub;
    text.appendChild(title);
    text.appendChild(sub);
    const reward = document.createElement('span');
    reward.className = 'reward-badge vision-stage-reward';
    reward.textContent = getRewardText('vision', st.id);
    const clearStatus = document.createElement('span');
    clearStatus.className = 'vision-stage-clear-status';
    [
        { label: 'イージー', key: `${st.id}_easy`, locked: false },
        { label: 'ノーマル', key: st.id, locked: false },
        { label: 'ハード', key: `${st.id}_hard`, locked: !user.visionCleared.includes(st.id) && !user.isMaster }
    ].forEach((difficulty) => {
        const chip = document.createElement('span');
        const cleared = user.visionCleared.includes(difficulty.key);
        chip.className = 'vision-stage-clear-chip'
            + (cleared ? ' is-cleared' : '')
            + (difficulty.locked ? ' is-locked' : '');
        chip.textContent = cleared ? `✓ ${difficulty.label}` : (difficulty.locked ? `🔒 ${difficulty.label}` : `□ ${difficulty.label}`);
        clearStatus.appendChild(chip);
    });

    main.appendChild(icon);
    main.appendChild(text);
    main.appendChild(reward);
    main.appendChild(clearStatus);
    card.appendChild(main);

    return card;
}

function openVisionDifficultyDialog(stage, user) {
    const dialog = ensureVisionDifficultyDialog();
    dialog.style.setProperty('--vision-accent', stage.color || '#9C27B0');
    dialog.querySelector('.vision-difficulty-stage-icon').textContent = stage.icon;
    dialog.querySelector('.vision-difficulty-stage-title').textContent = stage.title;
    dialog.querySelector('.vision-difficulty-stage-sub').textContent = stage.sub;

    const choices = dialog.querySelector('.vision-difficulty-choices');
    choices.innerHTML = '';
    choices.appendChild(createVisionDifficultyChoice({
        label: 'イージー',
        detail: 'まずはゆっくり取り組む',
        levelClass: 'easy',
        stageId: stage.id + '_easy',
        unlocked: true,
        user
    }));
    choices.appendChild(createVisionDifficultyChoice({
        label: 'ノーマル',
        detail: 'いつもの難しさ',
        levelClass: 'normal',
        stageId: stage.id,
        unlocked: true,
        user
    }));
    choices.appendChild(createVisionDifficultyChoice({
        label: 'ハード',
        detail: 'ノーマルクリアで解放',
        levelClass: 'hard',
        stageId: stage.id + '_hard',
        unlocked: user.visionCleared.includes(stage.id) || user.isMaster,
        user
    }));

    dialog.style.display = 'flex';
    dialog.setAttribute('aria-hidden', 'false');

    const firstChoice = dialog.querySelector('.vision-difficulty-choice:not(.is-locked)');
    if (firstChoice) firstChoice.focus();
}

export function openVisionDifficultyForStage(stageId) {
    const stage = VISION_STAGES.find(item => item.id === String(stageId || '').replace('_hard', '').replace('_easy', ''));
    const user = users[currentUser];
    if (!stage || !user) return false;
    if (!Array.isArray(user.visionCleared)) user.visionCleared = [];
    openVisionDifficultyDialog(stage, user);
    return true;
}

function ensureVisionDifficultyDialog() {
    let dialog = document.getElementById('vision-difficulty-modal');
    if (dialog) return dialog;

    dialog = document.createElement('div');
    dialog.id = 'vision-difficulty-modal';
    dialog.className = 'vision-difficulty-modal';
    dialog.setAttribute('aria-hidden', 'true');
    dialog.innerHTML = `
        <div class="vision-difficulty-panel" role="dialog" aria-modal="true" aria-label="難易度を選ぶ">
            <button type="button" class="vision-difficulty-close" aria-label="閉じる">×</button>
            <div class="vision-difficulty-stage">
                <span class="vision-difficulty-stage-icon"></span>
                <div>
                    <h3 class="vision-difficulty-stage-title"></h3>
                    <p class="vision-difficulty-stage-sub"></p>
                </div>
            </div>
            <div class="vision-difficulty-choices"></div>
        </div>
    `;
    dialog.addEventListener('click', (event) => {
        if (event.target === dialog) closeVisionDifficultyDialog();
    });
    dialog.querySelector('.vision-difficulty-close').addEventListener('click', closeVisionDifficultyDialog);
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && dialog.style.display === 'flex') closeVisionDifficultyDialog();
    });
    document.body.appendChild(dialog);
    return dialog;
}

function createVisionDifficultyChoice({ label, detail, levelClass, stageId, unlocked, user }) {
    const choice = document.createElement('div');
    choice.className = `vision-difficulty-choice ${levelClass}`;
    choice.setAttribute('role', 'button');
    const cleared = user.visionCleared.includes(stageId);
    if (cleared) choice.classList.add('is-cleared');
    if (!unlocked) choice.classList.add('is-locked');

    const status = !unlocked ? 'ロック中' : (cleared ? 'クリア済み' : getRewardText('vision', stageId));
    choice.innerHTML = `
        <span class="vision-difficulty-label">${label}</span>
        <span class="vision-difficulty-detail">${detail}</span>
        <span class="vision-difficulty-status">${status}</span>
    `;

    if (unlocked) {
        createBtn(choice, () => {
            closeVisionDifficultyDialog();
            startGame(stageId, 'vision');
        });
    } else {
        choice.tabIndex = -1;
    }
    return choice;
}

function closeVisionDifficultyDialog() {
    const dialog = document.getElementById('vision-difficulty-modal');
    if (!dialog) return;
    dialog.style.display = 'none';
    dialog.setAttribute('aria-hidden', 'true');
}

export function startVisionGame(sid) {
    if (sid === 'v1') playVisionV1();
    else if (sid === 'v2') playVisionV2();
    else if (sid === 'v3') playVisionV3();
    else if (sid === 'v4') playVisionV4();
    else if (sid === 'v5') playVisionV5();
    else if (sid === 'v6') playVisionV6();
    else if (sid === 'v7') playVisionV7();
    else if (sid === 'v8') playVisionV8();
    else if (sid === 'v9') playVisionV9();
    else if (sid === 'v10') playVisionV10();
    else if (sid === 'v11') playVisionV11();
    else if (sid === 'v12') playVisionV12();
    else if (sid === 'v13') playVisionV13();
    else if (sid === 'v14') playVisionV14();
    else if (sid === 'v15') playVisionV15();
    else if (sid === 'v16') playVisionV16();
    else if (sid === 'v17') playVisionV17();
    else if (sid === 'v18') playVisionV18();
    else if (sid === 'v19') playVisionV19();
    else if (sid === 'v20') playVisionV20();
}

function advanceVisionRound(nextRound, delay = 500) {
    SoundManager.playSuccess();
    addVisionScore();
    addCurrentCount();
    updateProgress();
    if (getVisionScore() >= getVisionTarget()) {
        setProcessing(true);
        setTimeout(markClear, 500);
    } else {
        setProcessing(true);
        setTimeout(() => {
            setProcessing(false);
            nextRound();
        }, delay);
    }
}

function getStageSize(stage) {
    const rect = stage.getBoundingClientRect();
    return {
        width: Math.max(rect.width || stage.clientWidth || 900, 320),
        height: Math.max(rect.height || stage.clientHeight || 430, 320)
    };
}

function overlapsPlacedTarget(candidate, placed, gap = WIDE_SCAN_TARGET_GAP) {
    return placed.some((rect) => !(
        candidate.x + candidate.size + gap <= rect.x ||
        rect.x + rect.size + gap <= candidate.x ||
        candidate.y + candidate.size + gap <= rect.y ||
        rect.y + rect.size + gap <= candidate.y
    ));
}

function getWideScanPosition(stage, side, placed) {
    const { width, height } = getStageSize(stage);
    const size = WIDE_SCAN_TARGET_SIZE;
    const pad = 18;
    const centerGap = 28;
    const leftMin = pad;
    const leftMax = Math.max(leftMin, (width / 2) - centerGap - size);
    const rightMin = Math.min(Math.max((width / 2) + centerGap, pad), width - pad - size);
    const rightMax = Math.max(rightMin, width - pad - size);
    const minX = side === 'left' ? leftMin : rightMin;
    const maxX = side === 'left' ? leftMax : rightMax;
    const minY = pad;
    const maxY = Math.max(minY, height - pad - size);

    for (let attempt = 0; attempt < 120; attempt++) {
        const x = Math.floor(Math.random() * (maxX - minX + 1)) + minX;
        const y = Math.floor(Math.random() * (maxY - minY + 1)) + minY;
        const candidate = { x, y, size };
        if (!overlapsPlacedTarget(candidate, placed)) return candidate;
    }

    const columns = side === 'left'
        ? [minX, Math.max(minX, minX + (maxX - minX) / 2), maxX]
        : [minX, Math.min(maxX, minX + (maxX - minX) / 2), maxX];
    const rows = [minY, minY + (maxY - minY) / 3, minY + ((maxY - minY) * 2) / 3, maxY];
    const grid = shuffle(rows.flatMap((y) => columns.map((x) => ({
        x: Math.round(x),
        y: Math.round(y),
        size
    }))));
    return grid.find((candidate) => !overlapsPlacedTarget(candidate, placed, 10)) || grid[0] || { x: minX, y: minY, size };
}

function getNonOverlappingPosition(areaSize, itemSize, placed, gap = 14) {
    const pad = 12;
    const minX = pad;
    const minY = pad;
    const maxX = Math.max(minX, areaSize.width - itemSize - pad);
    const maxY = Math.max(minY, areaSize.height - itemSize - pad);

    for (let attempt = 0; attempt < 140; attempt++) {
        const candidate = {
            x: Math.floor(Math.random() * (maxX - minX + 1)) + minX,
            y: Math.floor(Math.random() * (maxY - minY + 1)) + minY,
            size: itemSize
        };
        if (!overlapsPlacedTarget(candidate, placed, gap)) return candidate;
    }

    const cell = itemSize + gap;
    const cols = Math.max(1, Math.floor((maxX - minX + cell) / cell));
    const rows = Math.max(1, Math.floor((maxY - minY + cell) / cell));
    const grid = [];
    for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
            grid.push({
                x: Math.min(maxX, minX + col * cell),
                y: Math.min(maxY, minY + row * cell),
                size: itemSize
            });
        }
    }

    return shuffle(grid).find((candidate) => !overlapsPlacedTarget(candidate, placed, Math.max(6, gap / 2)))
        || { x: minX, y: minY, size: itemSize };
}

function nextVisionV2() {
    els.playArea.innerHTML = '';
    const q = FIND_DIFF_QUESTIONS[getVisionScore() % FIND_DIFF_QUESTIONS.length];
    
    const grid = document.createElement('div'); grid.className = 'find-diff-grid';
    const totalChars = getVisionHardMode() ? 100 : (getVisionEasyMode() ? 20 : 50); 
    const diffIndex = Math.floor(Math.random() * totalChars);
    if (getVisionHardMode()) { grid.style.gridTemplateColumns = 'repeat(20, 1fr)'; }

    for(let i=0; i<totalChars; i++) {
        const span = document.createElement('span'); span.className = 'find-diff-char';
        if (getVisionHardMode()) span.style.fontSize = '24px';
        const isDiff = (i === diffIndex); span.innerText = isDiff ? q.diff : q.base;
        span.onclick = () => {
            if(getProcessing()) return;
            if (isDiff) {
                SoundManager.playSuccess(); addVisionScore(); addCurrentCount(); updateProgress();
                if (getVisionScore() >= getVisionTarget()) { setProcessing(true); setTimeout(markClear, 500); } else { nextVisionV2(); }
            } else { SoundManager.playError(); span.style.color = '#f44336'; setTimeout(() => span.style.color = '#333', 300); }
        };
        grid.appendChild(span);
    }
    els.playArea.appendChild(grid);
}

function nextVisionV4() {
    els.playArea.innerHTML = ''; els.instText.innerText = "まんなかの「＋」をみてね...";
    const cross = document.createElement('div'); cross.className = 'flash-cross animated-cross'; cross.innerText = '＋'; els.playArea.appendChild(cross);
    const items =['🍎','🐶','🚗','⭐','🍓','🐱','🚀','💖','🍉','🐸','🚲','🎵','🍕','⚽','🍄'];
    const shuffled = shuffle([...items]); const answer = shuffled[0];
    
    const itemEl = document.createElement('div'); itemEl.className = 'flash-item'; itemEl.innerText = answer; itemEl.style.display = 'none';
    const pos = Math.floor(Math.random() * 4);
    if(pos===0) { itemEl.style.top='50px'; itemEl.style.left='50px'; } if(pos===1) { itemEl.style.top='50px'; itemEl.style.right='50px'; }
    if(pos===2) { itemEl.style.bottom='50px'; itemEl.style.left='50px'; } if(pos===3) { itemEl.style.bottom='50px'; itemEl.style.right='50px'; }
    els.playArea.appendChild(itemEl);
    
    let displayTime = getVisionHardMode() ? 150 : (getVisionEasyMode() ? 600 : 300); 

    setVisionTimeout(setTimeout(() => {
        itemEl.style.display = 'block'; SoundManager.playTone(800, 'sine', 0.1);
        setVisionTimeout(setTimeout(() => {
            itemEl.style.display = 'none'; cross.style.display = 'none';
            showFlashChoices(answer, shuffled.slice(1, 4));
        }, displayTime)); 
    }, 1000));
}

function showFlashChoices(answer, dummies) {
    els.instText.innerText = "なにが でたかな？"; const choices = shuffle([answer, ...dummies]);
    const container = document.createElement('div'); container.className = 'flash-choices';
    choices.forEach(c => {
        const btn = document.createElement('button'); btn.className = 'flash-choice-btn'; btn.innerText = c;
        btn.onclick = () => {
            if(getProcessing()) return;
            if(c === answer) {
                SoundManager.playSuccess(); addVisionScore(); addCurrentCount(); updateProgress();
                if (getVisionScore() >= getVisionTarget()) { setProcessing(true); setTimeout(markClear, 500); } else { setProcessing(true); setTimeout(() => { setProcessing(false); nextVisionV4(); }, 1000); }
            } else { SoundManager.playError(); btn.style.backgroundColor = '#ffcdd2'; setTimeout(() => btn.style.backgroundColor = '#fff', 200); }
        };
        container.appendChild(btn);
    });
    els.playArea.appendChild(container);
}

function nextVisionV9(qList) {
    els.playArea.innerHTML = '';
    const group = qList[Math.floor(Math.random() * qList.length)]; const shuffledGroup = shuffle([...group]); const answer = shuffledGroup[0]; 
    
    const questionEl = document.createElement('div'); questionEl.className = 'vision-q-main'; questionEl.innerText = answer;
    
    const isRotated = getVisionHardMode() ? true : (getVisionEasyMode() ? false : (Math.random() < 0.3));
    const rotateDeg = isRotated ? (Math.random() < 0.5 ? 90 : -90) : 0;
    
    if (isRotated) {
        questionEl.style.transform = `rotate(${rotateDeg}deg)`;
        els.instText.innerText = "かたむいているよ！ おなじものを さがしてね！";
    } else {
        els.instText.innerText = "まんなかと まったくおなじものを えらんでね！";
    }
    
    const choicesContainer = document.createElement('div'); choicesContainer.className = 'vision-q-choices';
    const displayChoices = shuffle([...group]);
    
    displayChoices.forEach(c => {
        const btn = document.createElement('button'); btn.className = 'vision-q-btn'; btn.innerText = c;
        btn.style.setProperty('--vision-q-rotation', `${rotateDeg}deg`);
        if (isRotated) btn.style.transform = `rotate(${rotateDeg}deg)`;
        
        btn.onclick = () => {
            if(getProcessing()) return;
            if(c === answer) {
                SoundManager.playSuccess(); addVisionScore(); addCurrentCount(); updateProgress();
                if (getVisionScore() >= getVisionTarget()) { setProcessing(true); setTimeout(markClear, 500); } else { setProcessing(true); setTimeout(() => { setProcessing(false); nextVisionV9(qList); }, 500); }
            } else { SoundManager.playError(); btn.style.backgroundColor = '#ffcdd2'; setTimeout(() => btn.style.backgroundColor = '#fff', 300); }
        };
        choicesContainer.appendChild(btn);
    });
    
    els.playArea.appendChild(questionEl); els.playArea.appendChild(choicesContainer);
}

function playVisionV1() {
    els.playArea.style.display = 'block';
    setVisionTarget(1);
    const maxNum = getVisionHardMode() ? 30 : (getVisionEasyMode() ? 10 : 20);
    setTotalCount(maxNum); setCurrentCount(0); updateProgress();
    
    const container = document.createElement('div'); 
    container.style.position = 'relative'; container.style.width = '100%'; container.style.height = '100%';
    
    let nums =[]; for(let i=1; i<=maxNum; i++) nums.push(i); nums = shuffle(nums);
    const areaRect = els.playArea.getBoundingClientRect();
    
    let placedRects =[]; 

    nums.forEach(n => {
        const btn = document.createElement('div'); btn.className = 'schulte-btn'; btn.innerText = n;
        
        let size = getVisionHardMode() ? (Math.random() * 20 + 40) : (Math.random() * 30 + 50); 
        btn.style.position = 'absolute';
        btn.style.width = size + 'px'; btn.style.height = size + 'px';
        btn.style.borderRadius = '50%';
        btn.style.fontSize = (size * 0.5) + 'px';
        
        let x, y;
        let attempts = 0;
        let overlap = true;
        while (overlap && attempts < 100) {
            x = Math.random() * (areaRect.width - size - 40) + 20;
            y = Math.random() * (areaRect.height - size - 40) + 20;
            overlap = false;
            for (let rect of placedRects) {
                let dx = x + size/2 - (rect.x + rect.size/2);
                let dy = y + size/2 - (rect.y + rect.size/2);
                let distance = Math.sqrt(dx*dx + dy*dy);
                if (distance < (size/2 + rect.size/2 + 5)) { overlap = true; break; }
            }
            attempts++;
        }
        placedRects.push({x: x, y: y, size: size});
        btn.style.left = x + 'px'; btn.style.top = y + 'px';

        btn.onclick = () => {
            if (getProcessing()) return;
            if (n === getVisionTarget()) {
                SoundManager.playClick(); btn.style.visibility = 'hidden'; addVisionTarget(); addCurrentCount(); updateProgress();
                if (getVisionTarget() > maxNum) { setProcessing(true); setTimeout(markClear, 500); }
            } else { SoundManager.playError(); btn.style.backgroundColor = '#ffcdd2'; setTimeout(() => btn.style.backgroundColor = '#fff', 200); }
        };
        container.appendChild(btn);
    });
    els.playArea.appendChild(container);
}

function playVisionV2() {
    setVisionScore(0); setVisionTarget(5); setTotalCount(getVisionTarget()); setCurrentCount(0); updateProgress();
    nextVisionV2();
}

function playVisionV3() {
    setTotalCount(100); setCurrentCount(0); updateProgress(); els.playArea.style.position = 'relative';
    const target = document.createElement('div'); target.className = 'lockon-target'; els.playArea.appendChild(target);
    
    let isHovering = false; let targetX = 100, targetY = 100; 
    let baseSpeed = getVisionHardMode() ? 8 : (getVisionEasyMode() ? 2 : 4);
    let vx = baseSpeed, vy = baseSpeed;
    let tSize = getVisionHardMode() ? 40 : (getVisionEasyMode() ? 120 : 80);
    
    target.style.width = tSize + 'px'; target.style.height = tSize + 'px';
    target.onmouseenter = () => { isHovering = true; target.classList.add('active'); };
    target.onmouseleave = () => { isHovering = false; target.classList.remove('active'); };
    
    const areaRect = els.playArea.getBoundingClientRect();
    
    setVisionInterval(setInterval(() => {
        if(getProcessing()) return;
        targetX += vx; targetY += vy;
        
        if (targetX <= 0 || targetX >= areaRect.width - tSize) { vx *= -1; targetX = Math.max(0, Math.min(targetX, areaRect.width - tSize)); }
        if (targetY <= 0 || targetY >= areaRect.height - tSize) { vy *= -1; targetY = Math.max(0, Math.min(targetY, areaRect.height - tSize)); }
        
        let feintRate = getVisionHardMode() ? 0.08 : (getVisionEasyMode() ? 0.01 : 0.03);
        if (Math.random() < feintRate) { 
            vx = (Math.random() > 0.5 ? 1 : -1) * (Math.random() * baseSpeed + (baseSpeed/2)); 
            vy = (Math.random() > 0.5 ? 1 : -1) * (Math.random() * baseSpeed + (baseSpeed/2)); 
        }
        
        target.style.left = targetX + 'px'; target.style.top = targetY + 'px';
        
        if (isHovering) {
            addCurrentCount(); updateProgress();
            if (getCurrentCount() % 10 === 0) SoundManager.playClick();
            if (getCurrentCount() >= getTotalCount()) {
                setProcessing(true); clearInterval(getVisionInterval());
                target.style.backgroundColor = '#4CAF50'; target.style.background = 'none'; target.innerText = '⭕'; target.style.display='flex'; target.style.justifyContent='center'; target.style.alignItems='center'; target.style.fontSize='30px';
                setTimeout(markClear, 800);
            }
        }
    }, 30)); 
}

function playVisionV4() {
    setVisionScore(0); setVisionTarget(3); setTotalCount(getVisionTarget()); setCurrentCount(0); updateProgress();
    nextVisionV4();
}

function playVisionV5() {
    els.playArea.style.display = 'block'; 
    setVisionScore(0); 
    setVisionTarget(getVisionHardMode() ? 8 : (getVisionEasyMode() ? 3 : 5));
    let dummyCount = getVisionHardMode() ? 70 : (getVisionEasyMode() ? 15 : 35);
    setTotalCount(getVisionTarget()); setCurrentCount(0); updateProgress();
    
    els.playArea.innerHTML = '';
    const items =['🍎','🐶','🚗','⭐','🍓','🐱','🚀','💖','🍉','🐸','🚲','🎵','🍕','⚽','🍄','🌻','🍔','🧸'];
    const shuffled = shuffle([...items]); const targetItem = shuffled[0]; 
    
    els.instText.innerHTML = `「<span style="font-size:30px;">${targetItem}</span>」を <span style="color:#E91E63; font-weight:bold;">${getVisionTarget()}こ</span> さがしてね！`;
    const container = document.createElement('div'); container.style.position = 'relative'; container.style.width = '100%'; container.style.height = '100%';
    
    let allItems =[];
    for(let i=0; i<getVisionTarget(); i++) allItems.push(targetItem);
    for(let i=0; i<dummyCount; i++) allItems.push(shuffled[Math.floor(Math.random() * (shuffled.length - 1)) + 1]);
    allItems = shuffle(allItems);
    
    const areaSize = getStageSize(els.playArea);
    const itemSize = getVisionHardMode() ? 40 : (getVisionEasyMode() ? 80 : 60);
    const collisionSize = Math.ceil(itemSize * 1.25);
    const placedItems = [];
    
    allItems.forEach(item => {
        const el = document.createElement('div'); el.className = 'vision-find-item'; el.innerText = item;
        el.style.width = itemSize + 'px'; el.style.height = itemSize + 'px'; el.style.fontSize = (itemSize * 0.75) + 'px';
        const pos = getNonOverlappingPosition(areaSize, collisionSize, placedItems, getVisionHardMode() ? 6 : 14);
        placedItems.push(pos);
        el.style.left = pos.x + 'px'; el.style.top = pos.y + 'px';
        el.style.transform = `rotate(${Math.floor(Math.random() * 60) - 30}deg)`;
        
        el.onclick = () => {
            if(getProcessing()) return;
            if(item === targetItem && !el.classList.contains('found')) {
                SoundManager.playSuccess(); el.classList.add('found'); el.style.opacity = '0.2'; el.style.transform = 'scale(1.5)';
                addVisionScore(); addCurrentCount(); updateProgress();
                if (getVisionScore() >= getVisionTarget()) { setProcessing(true); setTimeout(markClear, 500); }
            } else if (item !== targetItem) {
                SoundManager.playError(); el.style.color = 'red'; el.style.backgroundColor = '#ffcdd2';
                setTimeout(() => { el.style.backgroundColor = 'transparent'; el.style.color = ''; }, 300);
            }
        };
        container.appendChild(el);
    });
    els.playArea.appendChild(container);
}

function playVisionV6() {
    els.playArea.style.display = 'block'; 
    setVisionScore(0); setVisionTarget(getVisionHardMode() ? 15 : (getVisionEasyMode() ? 5 : 10)); 
    setTotalCount(getVisionTarget()); setCurrentCount(0); updateProgress(); els.playArea.innerHTML = '';    
    const container = document.createElement('div'); container.style.position = 'relative'; container.style.width = '100%'; container.style.height = '100%'; els.playArea.appendChild(container);
    const areaRect = els.playArea.getBoundingClientRect();
    const tSize = getVisionHardMode() ? 50 : (getVisionEasyMode() ? 100 : 80);
    const disappearTime = getVisionHardMode() ? 800 : (getVisionEasyMode() ? 2000 : 1500);
    let currentTarget = null;
    
    function spawnTarget() {
        if(getProcessing()) return;
        if(currentTarget) currentTarget.remove();
        
        const el = document.createElement('div'); el.className = 'vision-mole'; el.innerText = '👾'; 
        el.style.width = tSize + 'px'; el.style.height = tSize + 'px'; el.style.fontSize = (tSize * 0.6) + 'px';
        
        const x = Math.floor(Math.random() * (areaRect.width - tSize)); const y = Math.floor(Math.random() * (areaRect.height - tSize));
        el.style.left = x + 'px'; el.style.top = y + 'px';
        
        el.onmousedown = () => {
            if(getProcessing() || el.dataset.clicked) return;
            el.dataset.clicked = "true";
            
            SoundManager.playClick(); el.innerText = '💥'; el.style.backgroundColor = '#FF9800';
            addVisionScore(); addCurrentCount(); updateProgress(); clearTimeout(getVisionTimeout()); currentTarget = null;
            if (getVisionScore() >= getVisionTarget()) { setProcessing(true); setTimeout(markClear, 500); } else { setTimeout(spawnTarget, getVisionHardMode() ? 100 : 200); }
        };
        container.appendChild(el); currentTarget = el;
        
        setVisionTimeout(setTimeout(() => { if (currentTarget === el) spawnTarget(); }, disappearTime));
    }
    setTimeout(spawnTarget, 500);
}

function playVisionV7() {
    setVisionTarget(3); 
    setTotalCount(getVisionTarget()); 
    setCurrentCount(0); 
    updateProgress(); 
    els.playArea.innerHTML = '';
    
    memoryLevel = getVisionEasyMode() ? 2 : 3; 
    
    const container = document.createElement('div'); 
    container.className = 'memory-grid';
    
    let colors =['#f44336', '#4CAF50', '#2196F3', '#FFEB3B']; 
    if (getVisionHardMode()) {
        colors =['#f44336', '#4CAF50', '#2196F3', '#FFEB3B', '#9C27B0', '#FF9800'];
        container.classList.add('hard');
    } else if (getVisionEasyMode()) {
        colors =['#f44336', '#4CAF50', '#2196F3']; 
        container.classList.add('easy'); 
        container.style.display = 'flex';
        container.style.flexWrap = 'wrap';
        container.style.justifyContent = 'center';
    }
    
    const btns =[];
    colors.forEach((c, idx) => {
        const btn = document.createElement('div'); 
        btn.className = 'memory-btn'; 
        btn.style.backgroundColor = c; 
        btn.dataset.idx = idx;
        if(getVisionEasyMode()) {
            btn.style.width = '130px'; 
            btn.style.height = '130px';
            btn.style.margin = '10px';
        }
        btn.onmousedown = () => handleMemoryInput(idx, btn); 
        container.appendChild(btn); 
        btns.push(btn);
    });
    els.playArea.appendChild(container);
    
    let intervalSpeed = getVisionHardMode() ? 400 : (getVisionEasyMode() ? 1200 : 800);
    let flashSpeed = getVisionHardMode() ? 200 : (getVisionEasyMode() ? 600 : 400);

    function startMemoryRound() {
        memorySeq =[]; 
        memoryInputIdx = 0;
        for(let i=0; i<memoryLevel; i++) memorySeq.push(Math.floor(Math.random() * colors.length));
        let step = 0; 
        els.instText.innerText = "よく みて おぼえてね..."; 
        container.style.pointerEvents = 'none'; 
        
        if (getVisionInterval()) clearInterval(getVisionInterval()); 
        
        setVisionInterval(setInterval(() => {
            if(getProcessing()) { clearInterval(getVisionInterval()); return; }
            if(step >= memorySeq.length) { 
                clearInterval(getVisionInterval()); 
                els.instText.innerText = "おなじ じゅんばんで おしてね！"; 
                container.style.pointerEvents = 'auto'; 
                return; 
            }
            const b = btns[memorySeq[step]]; 
            SoundManager.playTone(400 + memorySeq[step] * 100, 'sine', 0.2);
            b.classList.add('flash'); 
            setTimeout(() => b.classList.remove('flash'), flashSpeed); 
            step++;
        }, intervalSpeed));
    }
    
    function handleMemoryInput(idx, btn) {
        if(getProcessing() || container.style.pointerEvents === 'none') return;
        btn.classList.add('flash'); 
        setTimeout(() => btn.classList.remove('flash'), 200);
        
        if (idx === memorySeq[memoryInputIdx]) {
            SoundManager.playTone(400 + idx * 100, 'sine', 0.1); 
            memoryInputIdx++;
            if (memoryInputIdx >= memorySeq.length) {
                container.style.pointerEvents = 'none'; 
                SoundManager.playSuccess(); 
                addCurrentCount(); 
                updateProgress();
                if (getCurrentCount() >= getVisionTarget()) { 
                    setProcessing(true); 
                    setTimeout(markClear, 500); 
                } 
                else { 
                    memoryLevel++; 
                    setTimeout(startMemoryRound, 1000); 
                }
            }
        } else {
            container.style.pointerEvents = 'none'; 
            SoundManager.playError(); 
            els.instText.innerText = "ちがうよ！ もういちど！"; 
            btn.style.backgroundColor = '#000';
            setTimeout(() => btn.style.backgroundColor = colors[idx], 300); 
            setTimeout(startMemoryRound, 1000); 
        }
    }
    setTimeout(startMemoryRound, 1000);
}

function playVisionV8() {
    setTotalCount(100); setCurrentCount(0); updateProgress(); els.playArea.innerHTML = '';
    const maze = document.createElement('div'); maze.className = 'maze-container';
    const startObj = document.createElement('div'); startObj.className = 'maze-start'; startObj.innerText = 'START';
    const goalObj = document.createElement('div'); goalObj.className = 'maze-goal'; goalObj.innerText = 'GOAL';
    
    let pathGap = getVisionHardMode() ? 20 : (getVisionEasyMode() ? 100 : 60); 
    let wallWidth = getVisionHardMode() ? 520 : (getVisionEasyMode() ? 440 : 480);

    const pattern = Math.floor(Math.random() * 3);
    
    if (pattern === 0) {
        const w1 = document.createElement('div'); w1.className = 'maze-wall';
        const w2 = document.createElement('div'); w2.className = 'maze-wall';
        let wallHeight = (180 - pathGap) / 2;
        w1.style.left = '0'; w1.style.top = '120px'; w1.style.width = wallWidth + 'px'; w1.style.height = wallHeight + 'px';
        w2.style.right = '0'; w2.style.top = (120 + wallHeight + pathGap) + 'px'; w2.style.width = wallWidth + 'px'; w2.style.height = wallHeight + 'px';
        maze.appendChild(w1); maze.appendChild(w2);
    } else if (pattern === 1) {
        const w1 = document.createElement('div'); w1.className = 'maze-wall';
        w1.style.left = '200px'; w1.style.top = '0'; w1.style.width = '200px'; w1.style.height = (400 - pathGap*2) + 'px';
        maze.appendChild(w1);
        startObj.style.top = '20px'; goalObj.style.bottom = '20px';
    } else {
        const w1 = document.createElement('div'); w1.className = 'maze-wall';
        const w2 = document.createElement('div'); w2.className = 'maze-wall';
        w1.style.left = '150px'; w1.style.top = '0'; w1.style.width = '50px'; w1.style.height = '250px';
        w2.style.right = '150px'; w2.style.bottom = '0'; w2.style.width = '50px'; w2.style.height = '250px';
        maze.appendChild(w1); maze.appendChild(w2);
    }
    
    maze.appendChild(startObj); maze.appendChild(goalObj); els.playArea.appendChild(maze);
    let isPlaying = false;

    function failMaze() {
        if(!isPlaying || getProcessing()) return;
        isPlaying = false; SoundManager.playError(); els.instText.innerText = "壁にあたっちゃった！ スタートから やりなおし！";
        maze.classList.add('error'); setTimeout(() => maze.classList.remove('error'), 300);
        setCurrentCount(0); updateProgress();
    }
    
    startObj.onmouseenter = () => {
        if(getProcessing()) return; isPlaying = true; SoundManager.playClick();
        els.instText.innerText = getVisionHardMode() ? "🔥 極細の道を はみださずに すすめ！" : "はみださないように ゴールをめざせ！";
        maze.classList.remove('error');
    };
    
    maze.onmouseleave = (e) => { failMaze(); };
    maze.querySelectorAll('.maze-wall').forEach(w => w.onmouseenter = () => failMaze());
    
    goalObj.onmouseenter = () => {
        if(!isPlaying || getProcessing()) return;
        isPlaying = false; SoundManager.playSuccess(); setCurrentCount(100); updateProgress(); setProcessing(true); setTimeout(markClear, 500);
    };
}

function playVisionV9() {
    setVisionScore(0); setVisionTarget(getVisionEasyMode() ? 3 : 5); setTotalCount(getVisionTarget()); setCurrentCount(0); updateProgress();
    const qList = [['b', 'd', 'p', 'q'],['⬆️', '⬇️', '⬅️', '➡️'],['わ', 'ね', 'れ', 'め'],['シ', 'ツ', 'ン', 'ソ'],['E', 'ヨ', 'm', 'w'] ];
    nextVisionV9(qList);
}

function playVisionV10() {
    setVisionScore(0);
    setVisionTarget(getVisionHardMode() ? 14 : (getVisionEasyMode() ? 6 : 10));
    setTotalCount(getVisionTarget());
    setCurrentCount(0);
    updateProgress();
    els.playArea.style.display = 'block';
    els.playArea.style.position = 'relative';
    els.instText.innerText = '左右に出る「★」をすばやく見つけよう！';

    let nextSide = Math.random() < 0.5 ? 'left' : 'right';

    function spawnWideTarget() {
        els.playArea.innerHTML = '';
        const stage = document.createElement('div');
        stage.className = 'wide-scan-stage';
        els.playArea.appendChild(stage);

        const targetSide = nextSide;
        nextSide = nextSide === 'left' ? 'right' : 'left';
        const decoyCount = getVisionHardMode() ? 5 : (getVisionEasyMode() ? 2 : 3);
        const marks = [];
        marks.push({ side: targetSide, answer: true, label: '★' });
        for (let i = 0; i < decoyCount; i++) {
            marks.push({ side: Math.random() < 0.5 ? 'left' : 'right', answer: false, label: ['●', '◆', '▲'][i % 3] });
        }

        const placedTargets = [];
        shuffle(marks).forEach((mark) => {
            const btn = document.createElement('button');
            btn.className = 'wide-scan-target';
            btn.textContent = mark.label;
            const pos = getWideScanPosition(stage, mark.side, placedTargets);
            placedTargets.push(pos);
            btn.style.left = `${pos.x}px`;
            btn.style.top = `${pos.y}px`;
            if (!mark.answer) btn.classList.add('decoy');
            btn.onclick = () => {
                if (getProcessing()) return;
                if (mark.answer) {
                    advanceVisionRound(spawnWideTarget, 180);
                } else {
                    SoundManager.playError();
                    btn.classList.add('miss');
                    setTimeout(() => btn.classList.remove('miss'), 250);
                }
            };
            stage.appendChild(btn);
        });
    }

    spawnWideTarget();
}

function playVisionV11() {
    setVisionScore(0);
    setVisionTarget(getVisionHardMode() ? 8 : (getVisionEasyMode() ? 4 : 6));
    setTotalCount(getVisionTarget());
    setCurrentCount(0);
    updateProgress();
    els.playArea.style.display = 'block';
    els.playArea.style.position = 'relative';
    nextVisionV11();
}

function nextVisionV11() {
    els.playArea.innerHTML = '';
    els.instText.innerText = 'まんなかの「＋」を見て、どこに出たかえらぼう';

    const stage = document.createElement('div');
    stage.className = 'peripheral-stage';
    const cross = document.createElement('div');
    cross.className = 'peripheral-cross';
    cross.textContent = '＋';
    stage.appendChild(cross);
    els.playArea.appendChild(stage);

    const directions = [
        { id: 'up', label: 'うえ', icon: '↑', x: '50%', y: '12%' },
        { id: 'right', label: 'みぎ', icon: '→', x: '84%', y: '50%' },
        { id: 'down', label: 'した', icon: '↓', x: '50%', y: '86%' },
        { id: 'left', label: 'ひだり', icon: '←', x: '16%', y: '50%' }
    ];
    const answer = directions[Math.floor(Math.random() * directions.length)];
    const flash = document.createElement('div');
    flash.className = 'peripheral-flash';
    flash.textContent = getVisionHardMode() ? '•' : '●';
    flash.style.left = answer.x;
    flash.style.top = answer.y;
    stage.appendChild(flash);

    const focusMs = getVisionEasyMode() ? 900 : 650;
    const displayMs = getVisionHardMode() ? 160 : (getVisionEasyMode() ? 520 : 300);
    flash.style.display = 'none';

    setVisionTimeout(setTimeout(() => {
        if (getProcessing()) return;
        SoundManager.playTone(760, 'sine', 0.08);
        flash.style.display = 'flex';
        setVisionTimeout(setTimeout(() => {
            if (getProcessing()) return;
            flash.style.display = 'none';
            const choices = document.createElement('div');
            choices.className = 'peripheral-choices';
            shuffle(directions).forEach((dir) => {
                const btn = document.createElement('button');
                btn.className = 'peripheral-choice-btn';
                btn.innerHTML = `<span>${dir.icon}</span><small>${dir.label}</small>`;
                btn.onclick = () => {
                    if (getProcessing()) return;
                    if (dir.id === answer.id) {
                        advanceVisionRound(nextVisionV11, 350);
                    } else {
                        SoundManager.playError();
                        btn.classList.add('miss');
                        setTimeout(() => btn.classList.remove('miss'), 250);
                    }
                };
                choices.appendChild(btn);
            });
            stage.appendChild(choices);
        }, displayMs));
    }, focusMs));
}

function playVisionV12() {
    setVisionScore(0);
    setVisionTarget(getVisionHardMode() ? 8 : (getVisionEasyMode() ? 4 : 6));
    setTotalCount(getVisionTarget());
    setCurrentCount(0);
    updateProgress();
    els.playArea.style.display = 'block';
    els.playArea.style.position = 'relative';
    nextVisionV12();
}

function nextVisionV12() {
    els.playArea.innerHTML = '';
    els.instText.innerText = '上と同じ「色」と「かたち」をえらぼう';

    const shapes = ['●', '■', '▲', '◆', '★', '✚'];
    const colors = ['#e53935', '#1e88e5', '#43a047', '#fb8c00', '#8e24aa', '#00897b'];
    const target = {
        shape: shapes[Math.floor(Math.random() * shapes.length)],
        color: colors[Math.floor(Math.random() * colors.length)]
    };

    const stage = document.createElement('div');
    stage.className = 'shape-match-stage';
    const targetBox = document.createElement('div');
    targetBox.className = 'shape-match-target';
    targetBox.style.setProperty('--shape-color', target.color);
    targetBox.innerHTML = `<span>${target.shape}</span>`;
    stage.appendChild(targetBox);

    const grid = document.createElement('div');
    grid.className = 'shape-match-grid';
    if (getVisionHardMode()) grid.classList.add('hard');

    const choiceCount = getVisionHardMode() ? 12 : (getVisionEasyMode() ? 6 : 9);
    const choices = [{ ...target, answer: true }];
    while (choices.length < choiceCount) {
        const choice = {
            shape: shapes[Math.floor(Math.random() * shapes.length)],
            color: colors[Math.floor(Math.random() * colors.length)],
            answer: false
        };
        if (choice.shape === target.shape && choice.color === target.color) continue;
        choices.push(choice);
    }

    shuffle(choices).forEach((choice) => {
        const btn = document.createElement('button');
        btn.className = 'shape-match-btn';
        btn.style.setProperty('--shape-color', choice.color);
        btn.innerHTML = `<span>${choice.shape}</span>`;
        btn.onclick = () => {
            if (getProcessing()) return;
            if (choice.answer) {
                advanceVisionRound(nextVisionV12, 350);
            } else {
                SoundManager.playError();
                btn.classList.add('miss');
                setTimeout(() => btn.classList.remove('miss'), 250);
            }
        };
        grid.appendChild(btn);
    });

    stage.appendChild(grid);
    els.playArea.appendChild(stage);
}

function playVisionV13() {
    setVisionScore(0);
    setVisionTarget(getVisionHardMode() ? 10 : (getVisionEasyMode() ? 5 : 7));
    setTotalCount(getVisionTarget());
    setCurrentCount(0);
    updateProgress();
    els.playArea.style.display = 'block';
    els.playArea.style.position = 'relative';
    nextVisionV13();
}

function nextVisionV13() {
    els.playArea.innerHTML = '';
    els.instText.innerText = '上と同じ「番号」と「形」のカードをえらぼう！';

    const numbers = getVisionHardMode() ? [1, 2, 3, 4, 5, 6, 7, 8, 9] : (getVisionEasyMode() ? [1, 2, 3, 4] : [1, 2, 3, 4, 5, 6]);
    const shapes = ['●', '■', '▲', '◆', '★', '＋'];
    const target = {
        number: numbers[Math.floor(Math.random() * numbers.length)],
        shape: shapes[Math.floor(Math.random() * shapes.length)]
    };

    const stage = document.createElement('div');
    stage.className = 'double-check-stage';

    const prompt = document.createElement('div');
    prompt.className = 'double-check-prompt';
    prompt.innerHTML = `<span>${target.number}</span><span>${target.shape}</span>`;
    stage.appendChild(prompt);

    const choiceCount = getVisionHardMode() ? 12 : (getVisionEasyMode() ? 6 : 9);
    const choices = [{ ...target, answer: true }];
    while (choices.length < choiceCount) {
        const choice = {
            number: numbers[Math.floor(Math.random() * numbers.length)],
            shape: shapes[Math.floor(Math.random() * shapes.length)],
            answer: false
        };
        if (choice.number === target.number && choice.shape === target.shape) continue;
        choices.push(choice);
    }

    const grid = document.createElement('div');
    grid.className = 'double-check-grid';
    if (getVisionHardMode()) grid.classList.add('hard');
    shuffle(choices).forEach((choice) => {
        const btn = document.createElement('button');
        btn.className = 'double-check-btn';
        btn.innerHTML = `<span>${choice.number}</span><span>${choice.shape}</span>`;
        btn.onclick = () => {
            if (getProcessing()) return;
            if (choice.answer) {
                advanceVisionRound(nextVisionV13, 350);
            } else {
                SoundManager.playError();
                btn.classList.add('miss');
                setTimeout(() => btn.classList.remove('miss'), 250);
            }
        };
        grid.appendChild(btn);
    });

    stage.appendChild(grid);
    els.playArea.appendChild(stage);
}

function playVisionV14() {
    setVisionScore(0);
    setVisionTarget(getVisionHardMode() ? 10 : (getVisionEasyMode() ? 5 : 7));
    setTotalCount(getVisionTarget());
    setCurrentCount(0);
    updateProgress();
    els.playArea.style.display = 'block';
    els.playArea.style.position = 'relative';
    nextVisionV14();
}

function nextVisionV14() {
    els.playArea.innerHTML = '';
    els.instText.innerText = 'ふたつが おなじなら「◯」、ちがうなら「×」をえらぼう！';

    const shapes = ['●', '■', '▲', '◆', '★', '＋'];
    const colors = ['#e53935', '#1e88e5', '#43a047', '#fb8c00', '#8e24aa', '#00897b'];
    const numbers = getVisionHardMode() ? [1, 2, 3, 4, 5, 6, 7, 8, 9] : [1, 2, 3, 4, 5, 6];
    const featureMode = getVisionEasyMode() ? 'shape' : (getVisionHardMode() ? 'all' : 'numberShape');
    const question = createSideCompareQuestion(featureMode, numbers, shapes, colors);
    const { left, right, shouldMatch } = question;

    const stage = document.createElement('div');
    stage.className = 'side-compare-stage';

    const cards = document.createElement('div');
    cards.className = 'side-compare-cards';
    cards.appendChild(createSideCompareCard(left, featureMode, '左'));
    cards.appendChild(createSideCompareCard(right, featureMode, '右'));
    stage.appendChild(cards);

    const answers = document.createElement('div');
    answers.className = 'side-compare-answers';
    [
        { label: 'おなじ', icon: '◯', className: 'is-same', value: true },
        { label: 'ちがう', icon: '×', className: 'is-different', value: false }
    ].forEach((answer) => {
        const btn = document.createElement('button');
        btn.className = `side-compare-answer ${answer.className}`;
        btn.setAttribute('aria-label', answer.label);
        btn.innerHTML = `
            <span class="side-compare-answer-icon">${answer.icon}</span>
            <span class="side-compare-answer-label">${answer.label}</span>
        `;
        btn.onclick = () => {
            if (getProcessing()) return;
            if (answer.value === shouldMatch) {
                advanceVisionRound(nextVisionV14, 350);
            } else {
                SoundManager.playError();
                btn.classList.add('miss');
                setTimeout(() => btn.classList.remove('miss'), 250);
            }
        };
        answers.appendChild(btn);
    });
    stage.appendChild(answers);

    els.playArea.appendChild(stage);
}

function createSideCompareQuestion(featureMode, numbers, shapes, colors) {
    let question = null;
    let key = '';

    for (let attempt = 0; attempt < 24; attempt++) {
        const left = createSideCompareItem(featureMode, numbers, shapes, colors);
        const shouldMatch = Math.random() < 0.5;
        let right = { ...left };
        if (!shouldMatch) {
            do {
                right = createSideCompareItem(featureMode, numbers, shapes, colors);
            } while (isSameSideCompareItem(left, right, featureMode));
        }

        question = { left, right, shouldMatch };
        key = getSideCompareQuestionKey(question, featureMode);
        if (key !== lastSideCompareQuestionKey) break;
    }

    lastSideCompareQuestionKey = key;
    return question;
}

function getSideCompareQuestionKey(question, featureMode) {
    const compact = (item) => {
        const color = featureMode === 'all' ? item.color : '';
        return `${item.number}|${item.shape}|${color}`;
    };
    return `${featureMode}|${compact(question.left)}|${compact(question.right)}|${question.shouldMatch ? 'same' : 'different'}`;
}

function createSideCompareItem(featureMode, numbers, shapes, colors) {
    return {
        number: numbers[Math.floor(Math.random() * numbers.length)],
        shape: shapes[Math.floor(Math.random() * shapes.length)],
        color: featureMode === 'all' ? colors[Math.floor(Math.random() * colors.length)] : '#263238'
    };
}

function isSameSideCompareItem(a, b, featureMode) {
    if (featureMode === 'shape') return a.shape === b.shape;
    if (featureMode === 'numberShape') return a.number === b.number && a.shape === b.shape;
    return a.number === b.number && a.shape === b.shape && a.color === b.color;
}

function createSideCompareCard(item, featureMode, label) {
    const card = document.createElement('div');
    card.className = 'side-compare-card';
    card.style.setProperty('--side-compare-color', item.color);

    const labelEl = document.createElement('div');
    labelEl.className = 'side-compare-label';
    labelEl.textContent = label;

    const content = document.createElement('div');
    content.className = 'side-compare-content';
    const number = document.createElement('span');
    number.className = 'side-compare-number';
    number.textContent = featureMode === 'shape' ? '' : item.number;
    const shape = document.createElement('span');
    shape.className = 'side-compare-shape';
    shape.textContent = item.shape;
    content.appendChild(number);
    content.appendChild(shape);

    card.appendChild(labelEl);
    card.appendChild(content);
    return card;
}

function playVisionV15() {
    setVisionScore(0);
    setVisionTarget(getVisionHardMode() ? 18 : (getVisionEasyMode() ? 8 : 12));
    setTotalCount(getVisionTarget());
    setCurrentCount(0);
    updateProgress();
    els.playArea.style.display = 'block';
    els.playArea.style.position = 'relative';
    nextVisionV15();
}

function nextVisionV15() {
    els.playArea.innerHTML = '';
    els.instText.innerText = '上と おなじ「いろ」と「かたち」を ぜんぶタッチしよう！';

    const shapes = ['●', '■', '▲', '◆', '★', '＋'];
    const colors = ['#e53935', '#1e88e5', '#43a047', '#fb8c00', '#8e24aa', '#00897b'];
    const target = {
        shape: shapes[Math.floor(Math.random() * shapes.length)],
        color: colors[Math.floor(Math.random() * colors.length)]
    };

    const remaining = getVisionTarget() - getVisionScore();
    const correctCount = Math.min(remaining, getVisionHardMode() ? 4 : (getVisionEasyMode() ? 2 : 3));
    const choiceCount = getVisionHardMode() ? 30 : (getVisionEasyMode() ? 12 : 20);
    const choices = [];
    for (let i = 0; i < correctCount; i++) choices.push({ ...target, answer: true });
    while (choices.length < choiceCount) {
        const choice = {
            shape: shapes[Math.floor(Math.random() * shapes.length)],
            color: colors[Math.floor(Math.random() * colors.length)],
            answer: false
        };
        if (choice.shape === target.shape && choice.color === target.color) continue;
        choices.push(choice);
    }

    const stage = document.createElement('div');
    stage.className = 'color-catch-stage';

    const prompt = document.createElement('div');
    prompt.className = 'color-catch-prompt';
    prompt.style.setProperty('--color-catch-color', target.color);
    prompt.innerHTML = `<span>${target.shape}</span><small>これと おなじ</small>`;
    stage.appendChild(prompt);

    const grid = document.createElement('div');
    grid.className = 'color-catch-grid';
    if (getVisionHardMode()) grid.classList.add('hard');
    let foundThisRound = 0;
    shuffle(choices).forEach((choice) => {
        const btn = document.createElement('button');
        btn.className = 'color-catch-choice';
        btn.style.setProperty('--color-catch-color', choice.color);
        btn.innerHTML = `<span>${choice.shape}</span>`;
        btn.onclick = () => {
            if (getProcessing() || btn.classList.contains('found')) return;
            if (choice.answer) {
                SoundManager.playSuccess();
                btn.classList.add('found');
                foundThisRound++;
                addVisionScore();
                addCurrentCount();
                updateProgress();
                if (getVisionScore() >= getVisionTarget()) {
                    setProcessing(true);
                    setTimeout(markClear, 500);
                } else if (foundThisRound >= correctCount) {
                    setProcessing(true);
                    setTimeout(() => {
                        setProcessing(false);
                        nextVisionV15();
                    }, 450);
                }
            } else {
                SoundManager.playError();
                btn.classList.add('miss');
                setTimeout(() => btn.classList.remove('miss'), 250);
            }
        };
        grid.appendChild(btn);
    });

    stage.appendChild(grid);
    els.playArea.appendChild(stage);
}

function playVisionV16() {
    setVisionScore(0);
    setVisionTarget(getVisionHardMode() ? 10 : (getVisionEasyMode() ? 5 : 7));
    setTotalCount(getVisionTarget());
    setCurrentCount(0);
    updateProgress();
    els.playArea.style.display = 'block';
    els.playArea.style.position = 'relative';
    nextVisionV16();
}

function nextVisionV16() {
    els.playArea.innerHTML = '';
    els.instText.innerText = '線を目でたどって、つながったゴールをタッチしよう！';

    const stage = document.createElement('div');
    stage.className = 'line-trace-stage';

    const endpoints = getLineTraceEndpoints();
    const answerIndex = Math.floor(Math.random() * endpoints.length);
    const answer = endpoints[answerIndex];
    const points = createLineTracePoints(answer);

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'line-trace-svg');
    svg.setAttribute('viewBox', '0 0 1000 430');
    // Keep the SVG coordinate system aligned with the HTML goal buttons.
    svg.setAttribute('preserveAspectRatio', 'none');
    svg.setAttribute('aria-hidden', 'true');

    if (getVisionHardMode()) {
        const guide = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
        guide.setAttribute('points', points.map((point) => `${point.x},${point.y}`).join(' '));
        guide.setAttribute('class', 'line-trace-guide');
        svg.appendChild(guide);
    }

    const path = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
    path.setAttribute('points', points.map((point) => `${point.x},${point.y}`).join(' '));
    path.setAttribute('class', 'line-trace-path');
    svg.appendChild(path);

    const start = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    start.setAttribute('cx', points[0].x);
    start.setAttribute('cy', points[0].y);
    start.setAttribute('r', '20');
    start.setAttribute('class', 'line-trace-start');
    svg.appendChild(start);

    stage.appendChild(svg);

    endpoints.forEach((endpoint, index) => {
        const btn = document.createElement('button');
        btn.className = 'line-trace-goal';
        btn.style.left = `${endpoint.x / 10}%`;
        btn.style.top = `${endpoint.y / 4.3}%`;
        btn.setAttribute('aria-label', `${index + 1}ばんのゴール`);
        btn.innerHTML = `<span>${index + 1}</span>`;
        btn.onclick = () => {
            if (getProcessing()) return;
            if (index === answerIndex) {
                advanceVisionRound(nextVisionV16, 350);
            } else {
                SoundManager.playError();
                btn.classList.add('miss');
                setTimeout(() => btn.classList.remove('miss'), 250);
            }
        };
        stage.appendChild(btn);
    });

    els.playArea.appendChild(stage);
}

function getLineTraceEndpoints() {
    const base = [
        { x: 850, y: 64 },
        { x: 900, y: 150 },
        { x: 850, y: 280 },
        { x: 900, y: 366 }
    ];
    if (!getVisionHardMode()) return base;
    return [
        { x: 830, y: 52 },
        { x: 914, y: 116 },
        { x: 846, y: 206 },
        { x: 914, y: 286 },
        { x: 830, y: 374 }
    ];
}

function createLineTracePoints(answer) {
    const startY = getVisionEasyMode() ? 215 : (120 + Math.floor(Math.random() * 190));
    const points = [{ x: 82, y: startY }];
    const bendCount = getVisionHardMode() ? 6 : (getVisionEasyMode() ? 3 : 5);
    const yMin = 52;
    const yMax = 378;
    for (let i = 1; i <= bendCount; i++) {
        const ratio = i / (bendCount + 1);
        const targetY = startY + ((answer.y - startY) * ratio);
        const wave = Math.sin((i + (answer.y / 80)) * 1.35) * (getVisionHardMode() ? 90 : 62);
        const jitter = (Math.random() - 0.5) * (getVisionEasyMode() ? 28 : 60);
        points.push({
            x: Math.round(82 + ((answer.x - 100) * ratio)),
            y: Math.round(Math.min(yMax, Math.max(yMin, targetY + wave + jitter)))
        });
    }
    points.push({ x: answer.x, y: answer.y });
    return points;
}

function playVisionV17() {
    setVisionScore(0);
    setVisionTarget(getVisionHardMode() ? 9 : (getVisionEasyMode() ? 4 : 6));
    setTotalCount(getVisionTarget());
    setCurrentCount(0);
    updateProgress();
    els.playArea.style.display = 'block';
    els.playArea.style.position = 'relative';
    nextVisionV17();
}

function nextVisionV17() {
    els.playArea.innerHTML = '';
    els.instText.innerText = '出てきた ならびをおぼえて、おなじカードをえらぼう！';

    const cellCount = getVisionHardMode() ? 9 : (getVisionEasyMode() ? 4 : 6);
    const columns = getVisionEasyMode() ? 2 : 3;
    const choiceCount = getVisionEasyMode() ? 3 : 4;
    const displayMs = getVisionHardMode() ? 760 : (getVisionEasyMode() ? 1450 : 1080);
    const target = createPatternMemoryPattern(cellCount);
    const choices = createPatternMemoryChoices(target, choiceCount);

    const stage = document.createElement('div');
    stage.className = 'pattern-memory-stage';
    stage.style.setProperty('--pattern-columns', columns);

    const preview = createPatternMemoryCard(target, columns, 'pattern-memory-preview');
    const cover = document.createElement('div');
    cover.className = 'pattern-memory-cover';
    cover.textContent = '？';
    cover.style.display = 'none';

    const choicesWrap = document.createElement('div');
    choicesWrap.className = 'pattern-memory-choices';
    choicesWrap.style.display = 'none';

    stage.appendChild(preview);
    stage.appendChild(cover);
    stage.appendChild(choicesWrap);
    els.playArea.appendChild(stage);

    setVisionTimeout(setTimeout(() => {
        if (getProcessing()) return;
        preview.style.display = 'none';
        cover.style.display = 'flex';
        choicesWrap.style.display = 'grid';
        choices.forEach((pattern) => {
            const btn = createPatternMemoryCard(pattern, columns, 'pattern-memory-choice');
            btn.onclick = () => {
                if (getProcessing()) return;
                if (pattern.join('|') === target.join('|')) {
                    advanceVisionRound(nextVisionV17, 350);
                } else {
                    setProcessing(true);
                    SoundManager.playError();
                    btn.classList.add('miss');
                    preview.style.display = 'none';
                    cover.classList.add('is-message');
                    cover.textContent = 'もういちど おぼえよう';
                    cover.style.display = 'flex';
                    choicesWrap.style.display = 'none';
                    setVisionTimeout(setTimeout(() => {
                        cover.classList.remove('is-message');
                        cover.textContent = '？';
                        cover.style.display = 'none';
                        preview.style.display = 'grid';
                        setVisionTimeout(setTimeout(() => {
                            preview.style.display = 'none';
                            cover.style.display = 'flex';
                            choicesWrap.style.display = 'grid';
                            setProcessing(false);
                        }, Math.max(1000, displayMs)));
                    }, 900));
                }
            };
            choicesWrap.appendChild(btn);
        });
    }, displayMs));
}

function createPatternMemoryPattern(cellCount) {
    const palette = ['red-circle', 'blue-square', 'green-triangle', 'orange-diamond', 'purple-star', 'teal-plus'];
    const pattern = [];
    let last = '';
    for (let i = 0; i < cellCount; i++) {
        let token = palette[Math.floor(Math.random() * palette.length)];
        if (token === last) token = palette[(palette.indexOf(token) + 1) % palette.length];
        pattern.push(token);
        last = token;
    }
    return pattern;
}

function createPatternMemoryChoices(target, choiceCount) {
    const choices = [target];
    while (choices.length < choiceCount) {
        const decoy = mutatePatternMemoryPattern(target);
        if (choices.some((choice) => choice.join('|') === decoy.join('|'))) continue;
        choices.push(decoy);
    }
    return shuffle(choices);
}

function mutatePatternMemoryPattern(target) {
    const palette = ['red-circle', 'blue-square', 'green-triangle', 'orange-diamond', 'purple-star', 'teal-plus'];
    const decoy = [...target];
    const changeCount = getVisionHardMode() ? 1 : 2;
    const indexes = shuffle(decoy.map((_, index) => index)).slice(0, changeCount);
    indexes.forEach((index) => {
        const current = decoy[index];
        let next = palette[Math.floor(Math.random() * palette.length)];
        if (next === current) next = palette[(palette.indexOf(current) + 1) % palette.length];
        decoy[index] = next;
    });
    return decoy;
}

function createPatternMemoryCard(pattern, columns, className) {
    const card = document.createElement(className === 'pattern-memory-choice' ? 'button' : 'div');
    card.className = className;
    card.style.setProperty('--pattern-columns', columns);
    pattern.forEach((token) => {
        const item = getPatternMemoryItem(token);
        const cell = document.createElement('span');
        cell.className = `${className}-cell`;
        cell.style.setProperty('--pattern-color', item.color);
        cell.innerHTML = `<span>${item.shape}</span>`;
        card.appendChild(cell);
    });
    return card;
}

function getPatternMemoryItem(token) {
    const items = {
        'red-circle': { shape: '●', color: '#e53935' },
        'blue-square': { shape: '■', color: '#1e88e5' },
        'green-triangle': { shape: '▲', color: '#43a047' },
        'orange-diamond': { shape: '◆', color: '#fb8c00' },
        'purple-star': { shape: '★', color: '#8e24aa' },
        'teal-plus': { shape: '＋', color: '#00897b' }
    };
    return items[token] || items['red-circle'];
}

function playVisionV18() {
    setVisionScore(0);
    setVisionTarget(getVisionHardMode() ? 10 : (getVisionEasyMode() ? 5 : 7));
    setTotalCount(getVisionTarget());
    setCurrentCount(0);
    updateProgress();
    els.playArea.style.display = 'block';
    els.playArea.style.position = 'relative';
    nextVisionV18();
}

function nextVisionV18() {
    els.playArea.innerHTML = '';
    els.instText.innerText = '上のかげと同じ形をえらぼう！';

    const allShapes = getShadowMatchShapes();
    const choiceCount = getVisionHardMode() ? 9 : (getVisionEasyMode() ? 4 : 6);
    const answer = allShapes[Math.floor(Math.random() * allShapes.length)];
    const dummies = shuffle(allShapes.filter((shape) => shape.id !== answer.id)).slice(0, choiceCount - 1);
    const choices = shuffle([answer, ...dummies]);

    const stage = document.createElement('div');
    stage.className = 'shadow-match-stage';

    const targetWrap = document.createElement('div');
    targetWrap.className = 'shadow-match-target';
    targetWrap.appendChild(createShadowMatchSymbol(answer, 'shadow-match-shadow', true));

    const grid = document.createElement('div');
    grid.className = 'shadow-match-grid';
    if (getVisionEasyMode()) grid.classList.add('easy');
    if (getVisionHardMode()) grid.classList.add('hard');

    choices.forEach((shape) => {
        const btn = document.createElement('button');
        btn.className = 'shadow-match-choice';
        btn.appendChild(createShadowMatchSymbol(shape, 'shadow-match-symbol'));
        btn.onclick = () => {
            if (getProcessing()) return;
            if (shape.id === answer.id) {
                advanceVisionRound(nextVisionV18, 350);
            } else {
                SoundManager.playError();
                btn.classList.add('miss');
                setTimeout(() => btn.classList.remove('miss'), 250);
            }
        };
        grid.appendChild(btn);
    });

    stage.appendChild(targetWrap);
    stage.appendChild(grid);
    els.playArea.appendChild(stage);
}

function getShadowMatchShapes() {
    return [
        { id: 'circle', symbol: '●', color: '#e53935' },
        { id: 'square', symbol: '■', color: '#1e88e5' },
        { id: 'triangle', symbol: '▲', color: '#43a047' },
        { id: 'diamond', symbol: '◆', color: '#fb8c00' },
        { id: 'star', symbol: '★', color: '#8e24aa' },
        { id: 'plus', symbol: '＋', color: '#00897b' },
        { id: 'heart', symbol: '♥', color: '#d81b60' },
        { id: 'pentagon', symbol: '⬟', color: '#5e35b1' },
        { id: 'hexagon', symbol: '⬢', color: '#546e7a' }
    ];
}

function createShadowMatchSymbol(shape, className, isShadow = false) {
    const span = document.createElement('span');
    span.className = className;
    span.textContent = shape.symbol;
    span.style.setProperty('--shadow-match-color', isShadow ? '#263238' : shape.color);
    return span;
}

function playVisionV19() {
    setVisionScore(0);
    setVisionTarget(getVisionHardMode() ? 10 : (getVisionEasyMode() ? 5 : 7));
    setTotalCount(getVisionTarget());
    setCurrentCount(0);
    updateProgress();
    els.playArea.style.display = 'block';
    els.playArea.style.position = 'relative';
    nextVisionV19();
}

function nextVisionV19() {
    els.playArea.innerHTML = '';
    els.instText.innerText = '光った場所をおぼえて、同じ場所をえらぼう！';

    const columns = getVisionEasyMode() ? 3 : 4;
    const rows = getVisionHardMode() ? 4 : (getVisionEasyMode() ? 2 : 3);
    const cellCount = columns * rows;
    const targetCount = getVisionHardMode() ? 2 : 1;
    const displayMs = getVisionHardMode() ? 850 : (getVisionEasyMode() ? 1500 : 1100);
    const targets = shuffle(Array.from({ length: cellCount }, (_, index) => index)).slice(0, targetCount);
    const selected = new Set();

    const stage = document.createElement('div');
    stage.className = 'position-memory-stage';
    stage.style.setProperty('--position-columns', columns);

    const preview = createPositionMemoryGrid(cellCount, columns, targets, true);
    const cover = document.createElement('div');
    cover.className = 'position-memory-cover';
    cover.textContent = '？';
    cover.style.display = 'none';
    const answerGrid = createPositionMemoryGrid(cellCount, columns, [], false);
    answerGrid.style.display = 'none';

    answerGrid.querySelectorAll('.position-memory-cell').forEach((btn, index) => {
        btn.onclick = () => {
            if (getProcessing()) return;
            if (targets.includes(index)) {
                btn.classList.add('selected');
                selected.add(index);
                SoundManager.playTone(700, 'sine', 0.08);
                if (selected.size >= targets.length) {
                    advanceVisionRound(nextVisionV19, 350);
                }
            } else {
                SoundManager.playError();
                btn.classList.add('miss');
                setTimeout(() => btn.classList.remove('miss'), 250);
            }
        };
    });

    stage.appendChild(preview);
    stage.appendChild(cover);
    stage.appendChild(answerGrid);
    els.playArea.appendChild(stage);

    setVisionTimeout(setTimeout(() => {
        if (getProcessing()) return;
        preview.style.display = 'none';
        cover.style.display = 'flex';
        answerGrid.style.display = 'grid';
    }, displayMs));
}

function createPositionMemoryGrid(cellCount, columns, targets, isPreview) {
    const grid = document.createElement('div');
    grid.className = `position-memory-grid${isPreview ? ' preview' : ' answer'}`;
    grid.style.setProperty('--position-columns', columns);

    for (let index = 0; index < cellCount; index++) {
        const cell = document.createElement(isPreview ? 'span' : 'button');
        cell.className = 'position-memory-cell';
        if (targets.includes(index)) cell.classList.add('is-target');
        grid.appendChild(cell);
    }
    return grid;
}

function playVisionV20() {
    setVisionScore(0);
    setVisionTarget(getVisionHardMode() ? 10 : (getVisionEasyMode() ? 5 : 7));
    setTotalCount(getVisionTarget());
    setCurrentCount(0);
    updateProgress();
    els.playArea.style.display = 'block';
    els.playArea.style.position = 'relative';
    nextVisionV20();
}

function nextVisionV20() {
    els.playArea.innerHTML = '';
    els.instText.innerText = 'かくれている形を考えて、同じ形をえらぼう！';

    const shapes = getShadowMatchShapes();
    const answer = shapes[Math.floor(Math.random() * shapes.length)];
    const choiceCount = getVisionHardMode() ? 9 : (getVisionEasyMode() ? 4 : 6);
    const choices = shuffle([
        answer,
        ...shuffle(shapes.filter((shape) => shape.id !== answer.id)).slice(0, choiceCount - 1)
    ]);

    const stage = document.createElement('div');
    stage.className = 'hidden-shape-stage';

    const target = document.createElement('div');
    target.className = 'hidden-shape-target';
    target.appendChild(createHiddenShapePreview(answer));

    const grid = document.createElement('div');
    grid.className = 'hidden-shape-grid';
    if (getVisionEasyMode()) grid.classList.add('easy');
    if (getVisionHardMode()) grid.classList.add('hard');

    choices.forEach((shape) => {
        const btn = document.createElement('button');
        btn.className = 'hidden-shape-choice';
        btn.appendChild(createShadowMatchSymbol(shape, 'hidden-shape-choice-symbol'));
        btn.onclick = () => {
            if (getProcessing()) return;
            if (shape.id === answer.id) {
                advanceVisionRound(nextVisionV20, 350);
            } else {
                SoundManager.playError();
                btn.classList.add('miss');
                setTimeout(() => btn.classList.remove('miss'), 250);
            }
        };
        grid.appendChild(btn);
    });

    stage.appendChild(target);
    stage.appendChild(grid);
    els.playArea.appendChild(stage);
}

function createHiddenShapePreview(shape) {
    const preview = document.createElement('div');
    preview.className = 'hidden-shape-preview';

    const symbol = createShadowMatchSymbol(shape, 'hidden-shape-preview-symbol', true);
    preview.appendChild(symbol);

    getHiddenShapeMasks().forEach((mask) => {
        const overlay = document.createElement('span');
        overlay.className = 'hidden-shape-mask';
        overlay.style.left = mask.left;
        overlay.style.top = mask.top;
        overlay.style.width = mask.width;
        overlay.style.height = mask.height;
        preview.appendChild(overlay);
    });
    return preview;
}

function getHiddenShapeMasks() {
    const easyMasks = [
        [{ left: '0', top: '0', width: '32%', height: '100%' }],
        [{ left: '68%', top: '0', width: '32%', height: '100%' }],
        [{ left: '0', top: '0', width: '100%', height: '32%' }],
        [{ left: '0', top: '68%', width: '100%', height: '32%' }]
    ];
    const normalMasks = [
        [{ left: '0', top: '0', width: '40%', height: '100%' }],
        [{ left: '60%', top: '0', width: '40%', height: '100%' }],
        [{ left: '0', top: '0', width: '100%', height: '40%' }],
        [{ left: '0', top: '60%', width: '100%', height: '40%' }],
        [{ left: '0', top: '0', width: '28%', height: '100%' }, { left: '0', top: '0', width: '100%', height: '24%' }]
    ];
    const hardMasks = [
        [{ left: '0', top: '0', width: '48%', height: '100%' }],
        [{ left: '52%', top: '0', width: '48%', height: '100%' }],
        [{ left: '0', top: '0', width: '100%', height: '48%' }],
        [{ left: '0', top: '52%', width: '100%', height: '48%' }],
        [{ left: '0', top: '0', width: '36%', height: '100%' }, { left: '0', top: '0', width: '100%', height: '30%' }],
        [{ left: '64%', top: '0', width: '36%', height: '100%' }, { left: '0', top: '70%', width: '100%', height: '30%' }]
    ];
    const maskSets = getVisionHardMode() ? hardMasks : (getVisionEasyMode() ? easyMasks : normalMasks);
    return maskSets[Math.floor(Math.random() * maskSets.length)];
}
