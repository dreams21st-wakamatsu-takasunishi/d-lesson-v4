import { users, currentUser, saveUsers } from '../api/user.js'
import { VISION_STAGES } from '../data/constants.js'
import { SoundManager } from '../utils/sound.js'
import { showScreen } from '../ui/screen.js'
import { createBtn } from '../utils/dom.js'
import { getRewardText } from '../utils/rewards.js'
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

function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}


export function showVisionCompare() {
    let sumNormal = {}, countNormal = {}, sumHard = {}, countHard = {}, sumEasy = {}, countEasy = {};
    VISION_STAGES.forEach(st => {
        sumNormal[st.id] = 0; countNormal[st.id] = 0;
        sumHard[st.id] = 0; countHard[st.id] = 0;
        sumEasy[st.id] = 0; countEasy[st.id] = 0;
    });
    
    Object.keys(users).forEach(n => {
        if(users[n].isMaster || n === '__GLOBAL_SETTINGS__') return;
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
        if (!users[n] || users[n].isMaster || n === '__GLOBAL_SETTINGS__') return;
        list.push({ name: n, user: users[n] });
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
    const cont = document.getElementById('vision-menu-content'); cont.innerHTML = '';
    const u = users[currentUser]; if (!u.visionCleared) u.visionCleared =[];

    VISION_STAGES.forEach((st) => {
        const wrapper = document.createElement('div');
        wrapper.style.display = 'flex'; wrapper.style.flexDirection = 'column'; wrapper.style.gap = '5px';

        const isEasyCleared = u.visionCleared.includes(st.id + '_easy');
        const isCleared = u.visionCleared.includes(st.id);
        const isHardCleared = u.visionCleared.includes(st.id + '_hard');

        const eb = document.createElement('div');
        eb.className = 'stage-btn unlocked' + (isEasyCleared ? ' cleared' : '');
        eb.style.borderColor = '#4CAF50'; eb.style.height = '40px'; eb.style.backgroundColor = '#e8f5e9';
        eb.innerHTML = `<span style="font-size:14px; font-weight:bold; color:#2E7D32;">🔰 イージー</span> <span class="reward-badge">${getRewardText('vision', st.id + '_easy')}</span>`;
        createBtn(eb, () => startGame(st.id + '_easy', 'vision'));
        wrapper.appendChild(eb);

        const b = document.createElement('div'); b.className = 'stage-btn unlocked' + (isCleared ? ' cleared' : ''); b.style.borderColor = st.color; b.style.height = '100px';
        b.innerHTML = `<span style="font-size:30px;">${st.icon}</span><span style="font-size:16px; font-weight:bold; color:#333; margin-top:5px;">${st.title}</span><span style="font-size:10px; color:#666;">${st.sub}</span> <span class="reward-badge">${getRewardText('vision', st.id)}</span>`;
        createBtn(b, () => startGame(st.id, 'vision')); 
        wrapper.appendChild(b);

        if (isCleared || u.isMaster) {
            const hb = document.createElement('div'); hb.className = 'stage-btn unlocked' + (isHardCleared ? ' cleared' : ''); 
            hb.style.borderColor = '#d84315'; hb.style.height = '40px'; hb.style.backgroundColor = '#fff3e0';
            hb.innerHTML = `<span style="font-size:14px; font-weight:bold; color:#d84315;">🔥 ハード</span> <span class="reward-badge">${getRewardText('vision', st.id + '_hard')}</span>`;
            createBtn(hb, () => startGame(st.id + '_hard', 'vision')); wrapper.appendChild(hb);
        } else {
            const hb = document.createElement('div'); hb.className = 'stage-btn'; hb.style.height = '40px'; hb.style.opacity = '0.3'; hb.innerHTML = `<span style="font-size:14px;">🔒 クリアで解放</span>`; wrapper.appendChild(hb);
        }
        cont.appendChild(wrapper);
    });
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
}

function nextVisionV2() {
    els.playArea.innerHTML = '';
    const qList =[ {base:'め', diff:'ぬ'}, {base:'わ', diff:'れ'}, {base:'大', diff:'犬'}, {base:'ソ', diff:'ン'}, {base:'O', diff:'Q'}, {base:'土', diff:'士'}, {base:'は', diff:'ほ'}, {base:'シ', diff:'ツ'}, {base:'E', diff:'F'}, {base:'あ', diff:'お'}, {base:'ね', diff:'れ'}, {base:'b', diff:'d'} ];
    const q = qList[Math.floor(Math.random() * qList.length)];
    
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
    
    const areaRect = els.playArea.getBoundingClientRect();
    const itemSize = getVisionHardMode() ? 40 : (getVisionEasyMode() ? 80 : 60);
    const maxX = areaRect.width - itemSize; const maxY = areaRect.height - itemSize;
    
    allItems.forEach(item => {
        const el = document.createElement('div'); el.className = 'vision-find-item'; el.innerText = item;
        el.style.width = itemSize + 'px'; el.style.height = itemSize + 'px'; el.style.fontSize = (itemSize * 0.75) + 'px';
        el.style.left = Math.floor(Math.random() * maxX) + 'px'; el.style.top = Math.floor(Math.random() * maxY) + 'px';
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
