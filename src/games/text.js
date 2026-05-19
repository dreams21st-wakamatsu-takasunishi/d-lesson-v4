import { users, currentUser, saveUsers, canWriteCurrentUserRow, recordPracticeActivity } from '../api/user.js';
import { SoundManager } from '../utils/sound.js';
import { showScreen } from '../ui/screen.js';
import { createConfetti } from '../ui/reward.js';

/* =========================================================
   [JS] 6. 文章入力練習 ＆ 自動採点
   ========================================================= */
let currentTextTask = null, textTimerInterval = null, textTimeLeft = 0;
let isRubyOn = true, isNaviOn = true;
let cancelStartHandler = null;

export function getCurrentTextTask() {
    return currentTextTask;
}

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function renderTextChar(char, charClass) {
    return `<span class="${charClass}">${escapeHtml(char)}</span>`;
}

function renderTextSpace(charClass, isLineHead) {
    const classes = ['text-space', charClass, isLineHead ? 'text-space-leading' : '']
        .filter(Boolean)
        .join(' ');
    return `<span class="${classes}" aria-label="スペース">&nbsp;</span>`;
}

export function toggleRuby() {
    isRubyOn = !isRubyOn;
    const btn = document.getElementById('btn-toggle-ruby');
    if (btn) { btn.innerText = `よみがな: ${isRubyOn ? 'ON' : 'OFF'}`; btn.style.background = isRubyOn ? '#00bcd4' : '#9e9e9e'; }
    const refBox = document.getElementById('ref-text-box');
    if (refBox && refBox.innerHTML && !refBox.innerText.includes('待 機 中')) renderTextContent();
    if (document.activeElement) document.activeElement.blur();
}

export function toggleNavi() {
    isNaviOn = !isNaviOn;
    const btn = document.getElementById('btn-toggle-navi');
    if (btn) { btn.innerText = `ナビ: ${isNaviOn ? 'ON' : 'OFF'}`; btn.style.background = isNaviOn ? '#ff9800' : '#9e9e9e'; }
    const refBox = document.getElementById('ref-text-box');
    if (refBox && refBox.innerHTML && !refBox.innerText.includes('待 機 中')) renderTextContent();
    if (document.activeElement) document.activeElement.blur();
}

function renderTextContent() {
    const refBox = document.getElementById('ref-text-box'); 
    if (!currentTextTask) return;
    
    const rawText = currentTextTask.content.replace(/\r\n/g, '\n');
    const plainRef = rawText.replace(/\{([^|]+)\|([^}]+)\}/g, '$1'); 
    const typeBox = document.getElementById('type-text-box');
    const typedText = typeBox ? typeBox.value.replace(/\r\n/g, '\n') : "";

    let matchLen = 0;
    for (let j = 0; j < typedText.length; j++) {
        if (typedText[j] === plainRef[j]) {
            matchLen++;
        } else {
            break; 
        }
    }

    let html = '';
    let plainIndex = 0;
    let i = 0;
    let isLineHead = true;
    
    while (i < rawText.length) {
        if (rawText[i] === '{') {
            let closeIdx = rawText.indexOf('}', i);
            let pipeIdx = rawText.indexOf('|', i);
            if (closeIdx !== -1 && pipeIdx !== -1 && pipeIdx < closeIdx) {
                let kanji = rawText.substring(i + 1, pipeIdx);
                let ruby = rawText.substring(pipeIdx + 1, closeIdx);
                
                if (isRubyOn) html += '<ruby class="text-ruby">';
                for (let k = 0; k < kanji.length; k++) {
                    let charClass = '';
                    if (isNaviOn) {
                        if (plainIndex < matchLen) charClass = 'text-done';
                        else if (plainIndex === matchLen) charClass = 'text-current';
                    }
                    html += renderTextChar(kanji[k], charClass);
                    plainIndex++;
                    isLineHead = false;
                }
                if (isRubyOn) html += `<rt class="text-ruby-reading">${escapeHtml(ruby)}</rt></ruby>`;
                
                i = closeIdx + 1;
                continue;
            }
        }
        
        let char = rawText[i];
        let charClass = '';
        if (isNaviOn) {
            if (plainIndex < matchLen) charClass = 'text-done';
            else if (plainIndex === matchLen) charClass = 'text-current';
        }
        
        if (char === '\n') {
            html += `<span class="${charClass}" style="color:#ccc;">↵</span><br>`;
            plainIndex++;
            isLineHead = true;
        } else if (char === ' ' || char === '　') {
            html += renderTextSpace(charClass, isLineHead);
            plainIndex++;
        } else {
            html += renderTextChar(char, charClass);
            plainIndex++;
            isLineHead = false;
        }
        i++;
    }
    refBox.innerHTML = html;
}

export function goToTextMenu() { renderTextTasks(); showScreen('screen-text-menu'); }

let currentTextPage = 0;
let currentTextFilter = 'all';
const TEXT_ITEMS_PER_PAGE = 6;

function getTextTaskFilterLabel(filter) {
    const labels = {
        all: 'すべて',
        easy: 'かんたん',
        normal: 'ふつう',
        hard: 'むずかしい',
        todo: 'まだ',
        done: 'やったことあり'
    };
    return labels[filter] || labels.all;
}

function textTaskMatchesFilter(task, filter) {
    const star = Number(task.star || 3);
    if (filter === 'easy') return star <= 2;
    if (filter === 'normal') return star === 3;
    if (filter === 'hard') return star >= 4;
    if (filter === 'todo') return !users[currentUser]?.textRecords?.[task.id];
    if (filter === 'done') return Boolean(users[currentUser]?.textRecords?.[task.id]);
    return true;
}

function filterTextTasks(tasks) {
    return tasks.filter(task => textTaskMatchesFilter(task, currentTextFilter));
}

function updateTextTaskFilterButtons(tasks = []) {
    document.querySelectorAll('[data-text-task-filter]').forEach(button => {
        const filter = button.dataset.textTaskFilter || 'all';
        const active = filter === currentTextFilter;
        const count = tasks.filter(task => textTaskMatchesFilter(task, filter)).length;
        button.classList.toggle('active', active);
        button.setAttribute('aria-pressed', active ? 'true' : 'false');
        button.innerHTML = `${escapeHtml(getTextTaskFilterLabel(filter))}<span class="text-task-filter-count">${escapeHtml(count)}</span>`;
    });
}

export function setTextTaskFilter(filter = 'all') {
    const allowed = new Set(['all', 'easy', 'normal', 'hard', 'todo', 'done']);
    currentTextFilter = allowed.has(filter) ? filter : 'all';
    currentTextPage = 0;
    renderTextTasks();
}

function textTaskMatchesCurrentUser(task) {
    const targetGroup = String(task?.targetGroup || '').trim();
    if (!targetGroup) return true;
    const userGroup = String(users[currentUser]?.group || '').trim();
    return userGroup === targetGroup;
}

function getTextTaskRecord(task) {
    return users[currentUser]?.textRecords?.[task.id] || null;
}

function getTextTaskPlainContent(task) {
    return String(task?.content || '').replace(/\{([^|]+)\|([^}]+)\}/g, '$1');
}

function getRecommendedTextTask(tasks) {
    return tasks.find(task => !getTextTaskRecord(task)) || null;
}

function renderTextTaskSummary(container, tasks) {
    const totalCount = tasks.length;
    if (totalCount === 0) return;

    const doneCount = tasks.filter(task => getTextTaskRecord(task)).length;
    const remainingCount = Math.max(0, totalCount - doneCount);
    const progressPercent = Math.round((doneCount / totalCount) * 100);
    const statusText = remainingCount > 0
        ? `あと ${remainingCount} こ`
        : 'ぜんぶ できました';

    const box = document.createElement('div');
    box.className = 'text-task-summary';
    box.innerHTML = `
        <div class="text-task-summary-main">
            <span class="text-task-summary-label">すすみぐあい</span>
            <strong>${escapeHtml(doneCount)} / ${escapeHtml(totalCount)}</strong>
            <span>${escapeHtml(statusText)}</span>
        </div>
        <div class="text-task-summary-bar" aria-label="文章課題の進み具合">
            <span style="width:${escapeHtml(progressPercent)}%;"></span>
        </div>
    `;
    container.appendChild(box);
}

function renderTextTaskRecommendation(container, tasks) {
    if (currentTextFilter === 'done') return;
    const recommendedTask = getRecommendedTextTask(tasks);
    if (!recommendedTask) return;

    const plainContent = getTextTaskPlainContent(recommendedTask);
    const box = document.createElement('div');
    box.className = 'text-task-recommend';
    box.innerHTML = `
        <div class="text-task-recommend-copy">
            <span class="text-task-recommend-label">まずはこれ</span>
            <strong>${escapeHtml(recommendedTask.title)}</strong>
            <span>★${escapeHtml(recommendedTask.star || 3)} / ${escapeHtml(recommendedTask.time)}分 / ${escapeHtml(plainContent.length)}文字</span>
        </div>
    `;
    const startButton = document.createElement('button');
    startButton.className = 'text-task-recommend-btn';
    startButton.type = 'button';
    startButton.textContent = 'はじめる';
    startButton.onclick = () => startTextPractice(recommendedTask.id);
    box.appendChild(startButton);
    container.appendChild(box);
}

function renderTextTasks() {
    const cont = document.getElementById('text-menu-content');
    cont.innerHTML = '';
    const glob = users['__GLOBAL_SETTINGS__'];
    const allTasks = Array.isArray(glob?.textTasks) ? glob.textTasks : [];
    const visibleTasks = allTasks.filter(task => task.hidden !== true);
    const tasks = visibleTasks.filter(textTaskMatchesCurrentUser);
    updateTextTaskFilterButtons(tasks);
    if (allTasks.length === 0) {
        cont.innerHTML = `
            <div class="text-empty-state">
                <div class="text-empty-title">まだ文章課題がありません</div>
                <div class="text-empty-note">先生・管理者画面で課題を作ると、ここに表示されます。</div>
            </div>
        `;
        return;
    }
    if (visibleTasks.length === 0) {
        cont.innerHTML = `
            <div class="text-empty-state">
                <div class="text-empty-title">表示中の文章課題がありません</div>
                <div class="text-empty-note">先生・管理者画面で課題を「表示する」にすると、ここに出ます。</div>
            </div>
        `;
        return;
    }
    if (tasks.length === 0) {
        cont.innerHTML = `
            <div class="text-empty-state">
                <div class="text-empty-title">このグループで表示中の文章課題がありません</div>
                <div class="text-empty-note">先生・管理者画面で、課題の対象グループを確認してください。</div>
            </div>
        `;
        return;
    }

    const filteredTasks = filterTextTasks(tasks);
    if (filteredTasks.length === 0) {
        cont.innerHTML = `
            <div class="text-empty-state">
                <div class="text-empty-title">${escapeHtml(getTextTaskFilterLabel(currentTextFilter))} の課題はありません</div>
                <div class="text-empty-note">別のボタンをえらぶと、ほかの課題を表示できます。</div>
            </div>
        `;
        return;
    }

    const totalPages = Math.ceil(filteredTasks.length / TEXT_ITEMS_PER_PAGE);
    if (currentTextPage >= totalPages) currentTextPage = Math.max(0, totalPages - 1);

    renderTextTaskSummary(cont, tasks);
    renderTextTaskRecommendation(cont, filteredTasks);

    const grid = document.createElement('div');
    grid.className = 'text-task-grid';
    
    const start = currentTextPage * TEXT_ITEMS_PER_PAGE; const pageTasks = filteredTasks.slice(start, start + TEXT_ITEMS_PER_PAGE);

    pageTasks.forEach(task => {
        const btn = document.createElement('button'); btn.className = 'stage-btn unlocked text-task-card';
        
        let recordHtml = '';
        const record = getTextTaskRecord(task);
        const isDone = Boolean(record);
        if (record) {
            const r = record;
            recordHtml = `<span class="text-task-record">🏆 最高純字数: ${escapeHtml(r.score)}文字 / ミス${escapeHtml(r.miss)}</span>`;
        }
        let stars = "⭐".repeat(task.star || 3);
        const plainContent = getTextTaskPlainContent(task);
        btn.innerHTML = `
            <span class="text-task-card-head">
                <span class="text-task-title">${escapeHtml(task.title)}</span>
                <span class="text-task-status ${isDone ? 'done' : 'todo'}">${isDone ? 'やった' : 'まだ'}</span>
            </span>
            <span class="text-task-meta">
                <span>難易度: ${escapeHtml(stars)}</span>
                <span>制限時間: ${escapeHtml(task.time)}分</span>
                <span>${escapeHtml(plainContent.length)}文字</span>
            </span>
            ${recordHtml}
            <span class="text-task-reward">💰最高15000</span>
        `;
        btn.onclick = () => startTextPractice(task.id); grid.appendChild(btn);
    });
    cont.appendChild(grid);

    if (totalPages > 1) {
        const pc = document.createElement('div'); pc.className = 'text-task-pager';
        const pBtn = document.createElement('button'); pBtn.className = 'btn-secondary'; pBtn.innerText = '◀ まえ'; pBtn.disabled = currentTextPage === 0; pBtn.onclick = () => { currentTextPage--; renderTextTasks(); };
        const pTxt = document.createElement('span'); pTxt.className = 'text-task-page-label'; pTxt.innerText = `${currentTextPage + 1} / ${totalPages}`;
        const nBtn = document.createElement('button'); nBtn.className = 'btn-secondary'; nBtn.innerText = 'つぎ ▶'; nBtn.disabled = currentTextPage === totalPages - 1; nBtn.onclick = () => { currentTextPage++; renderTextTasks(); };
        pc.appendChild(pBtn); pc.appendChild(pTxt); pc.appendChild(nBtn); cont.appendChild(pc);
    }
}

function startTextPractice(taskId) {
    SoundManager.init(); if (document.activeElement) document.activeElement.blur();
    const glob = users['__GLOBAL_SETTINGS__']; currentTextTask = glob.textTasks.find(t => t.id === taskId);
    if (!currentTextTask) return;
    
    let modal = document.getElementById('text-prep-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'text-prep-modal';
        modal.style.cssText = 'display:none; position:absolute; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.8); z-index:9000; flex-direction:column; justify-content:center; align-items:center;';
        document.body.appendChild(modal);
    }
    
    let plainText = currentTextTask.content.replace(/\{([^|]+)\|([^}]+)\}/g, '$1');
    let previewText = plainText.length > 100 ? plainText.substring(0, 100) + '...' : plainText;

    modal.innerHTML = `
        <div style="background:#fff; padding:30px; border-radius:15px; width:80%; max-width:800px; max-height:90vh; display:flex; flex-direction:column; text-align:center; box-shadow: 0 10px 30px rgba(0,0,0,0.5);">
            <h2 style="margin-top:0; color:#333;">課題の確認と設定</h2>
            <h3 style="color:#00695c; margin:10px 0;">${currentTextTask.title} (${currentTextTask.time}分)</h3>
            
            <div style="flex:1; overflow-y:auto; background:#f9f9f9; border:2px solid #ccc; border-radius:10px; padding:15px; margin-bottom:20px; font-size:18px; text-align:left; white-space:pre-wrap; color:#555;">${previewText}</div>
            
            <p style="font-size:16px; margin-bottom:10px; color:#666;">お好みで設定を変更してからスタートしてね</p>
            <div style="display:flex; justify-content:center; gap:20px; margin-bottom:25px;">
                <button id="prep-toggle-ruby" onclick="toggleRubyInPrep()" style="padding:10px 20px; font-size:18px; border-radius:10px; border:none; cursor:pointer; font-weight:bold; box-shadow:0 4px 0 rgba(0,0,0,0.2); background:${isRubyOn ? '#00bcd4' : '#9e9e9e'}; color:#fff;">
                    よみがな: ${isRubyOn ? 'ON' : 'OFF'}
                </button>
                <button id="prep-toggle-navi" onclick="toggleNaviInPrep()" style="padding:10px 20px; font-size:18px; border-radius:10px; border:none; cursor:pointer; font-weight:bold; box-shadow:0 4px 0 rgba(0,0,0,0.2); background:${isNaviOn ? '#ff9800' : '#9e9e9e'}; color:#fff;">
                    ナビ: ${isNaviOn ? 'ON' : 'OFF'}
                </button>
            </div>
            
            <div style="display:flex; justify-content:center; gap:20px;">
                <button class="btn-gacha" style="padding:15px 40px; font-size:24px; border:none;" onclick="confirmStartTextPractice()">スタート！</button>
                <button class="btn-secondary" style="padding:15px 40px; font-size:24px;" onclick="closeTextPrepModal()">やめる</button>
            </div>
        </div>
    `;
    modal.style.display = 'flex';
}

export function toggleRubyInPrep() {
    isRubyOn = !isRubyOn;
    const btn = document.getElementById('prep-toggle-ruby');
    btn.innerText = `よみがな: ${isRubyOn ? 'ON' : 'OFF'}`;
    btn.style.background = isRubyOn ? '#00bcd4' : '#9e9e9e';
}

export function toggleNaviInPrep() {
    isNaviOn = !isNaviOn;
    const btn = document.getElementById('prep-toggle-navi');
    btn.innerText = `ナビ: ${isNaviOn ? 'ON' : 'OFF'}`;
    btn.style.background = isNaviOn ? '#ff9800' : '#9e9e9e';
}

export function closeTextPrepModal() {
    const modal = document.getElementById('text-prep-modal');
    if (modal) modal.style.display = 'none';
}

export function confirmStartTextPractice() {
    closeTextPrepModal();
    showScreen('screen-text-game'); 
    document.getElementById('text-result-overlay').style.display = 'none';
    document.getElementById('text-title-display').innerText = currentTextTask.title;
    document.getElementById('btn-submit-text').style.display = 'none'; 
    
    const btnRuby = document.getElementById('btn-toggle-ruby');
    if (btnRuby) { btnRuby.innerText = `よみがな: ${isRubyOn ? 'ON' : 'OFF'}`; btnRuby.style.background = isRubyOn ? '#00bcd4' : '#9e9e9e'; }
    const btnNavi = document.getElementById('btn-toggle-navi');
    if (btnNavi) { btnNavi.innerText = `ナビ: ${isNaviOn ? 'ON' : 'OFF'}`; btnNavi.style.background = isNaviOn ? '#ff9800' : '#9e9e9e'; }

    const refBox = document.getElementById('ref-text-box'); refBox.style.cssText = ''; 
    refBox.innerHTML = '<div style="display:flex; flex-direction:column; justify-content:center; align-items:center; height:100%; color:#999; text-align:center;"><span style="font-size:24px; font-weight:bold; margin-bottom:15px;">【 待 機 中 】</span><span>スペースキーを押すと、ここに問題が表示されて<br>タイマーがスタートします。</span></div>';
    
    const typeBox = document.getElementById('type-text-box'); typeBox.value = ''; typeBox.disabled = true; 
    typeBox.oninput = () => { renderTextContent(); };

    textTimeLeft = currentTextTask.time * 60; updateTextHud(); 
    
    let overlay = document.getElementById('text-start-overlay');
    if (!overlay) {
        overlay = document.createElement('div'); overlay.id = 'text-start-overlay'; overlay.style.position = 'absolute'; overlay.style.top = '0'; overlay.style.left = '0'; overlay.style.width = '100%'; overlay.style.height = '100%'; overlay.style.background = 'rgba(0,0,0,0.8)'; overlay.style.display = 'flex'; overlay.style.flexDirection = 'column'; overlay.style.justifyContent = 'center'; overlay.style.alignItems = 'center'; overlay.style.zIndex = '150';
        overlay.innerHTML = '<div style="font-size: 50px; color: #fff; font-weight: bold; text-shadow: 2px 2px 4px #000; animation: pulse 1.5s infinite; text-align: center;">スペースキーをおして スタート！</div>';
        document.getElementById('screen-text-game').appendChild(overlay);
    }
    overlay.style.display = 'flex';

    if (cancelStartHandler) { document.removeEventListener('keydown', cancelStartHandler); overlay.removeEventListener('mousedown', cancelStartHandler); }
    
    const startHandler = (e) => {
        if (e.key === ' ' || e.type === 'mousedown') { 
            e.preventDefault(); document.removeEventListener('keydown', startHandler); overlay.removeEventListener('mousedown', startHandler); cancelStartHandler = null; overlay.style.display = 'none';
            document.getElementById('btn-submit-text').style.display = 'block'; 
            renderTextContent(); typeBox.disabled = false; setTimeout(() => { typeBox.focus(); }, 50);
            textTimerInterval = setInterval(() => { textTimeLeft--; updateTextHud(); if (textTimeLeft <= 0) submitTextPractice(); }, 1000);
        }
    };
    cancelStartHandler = startHandler; setTimeout(() => { document.addEventListener('keydown', startHandler); overlay.addEventListener('mousedown', startHandler); }, 300);
}

function updateTextHud() {
    const m = Math.floor(textTimeLeft / 60); const s = textTimeLeft % 60;
    const timerDisplay = document.getElementById('text-timer-display');
    if (timerDisplay) timerDisplay.innerText = `のこり: ${m}分${s.toString().padStart(2, '0')}秒`;
}

export function submitTextPractice() {
    if (textTimerInterval) { clearInterval(textTimerInterval); textTimerInterval = null; }
    const typeBox = document.getElementById('type-text-box'); typeBox.disabled = true;
    typeBox.oninput = null; 
    document.getElementById('btn-submit-text').style.display = 'none';
    
    const finishOverlay = document.getElementById('text-finish-overlay');
    if (finishOverlay) finishOverlay.style.display = 'flex';
    SoundManager.playClear(); 

    setTimeout(() => {
        if (finishOverlay) finishOverlay.style.display = 'none';
        showTextResult();
    }, 2000);
}

function showTextResult() {
    const canSaveResult = canWriteCurrentUserRow();
    const originalUserData = users[currentUser] ? JSON.parse(JSON.stringify(users[currentUser])) : null;
    const typeBox = document.getElementById('type-text-box');
    const rawRef = currentTextTask.content;
    const plainRef = rawRef.replace(/\{([^|]+)\|([^}]+)\}/g, '$1');
    const typed = typeBox.value;
    const refClean = plainRef.replace(/\r\n/g, '\n'); const typedClean = typed.replace(/\r\n/g, '\n');
    let missCount = calcMissCount(refClean, typedClean); let totalCount = typedClean.length; let netCount = Math.max(0, totalCount - missCount);

    if (!users[currentUser].textRecords) users[currentUser].textRecords = {};
    let isNewRecord = false, prev = users[currentUser].textRecords[currentTextTask.id];
    const finishedAt = new Date().toISOString();
    const prevRecord = prev && typeof prev === 'object' ? prev : null;
    const shouldSaveBest = !prevRecord || netCount > Number(prevRecord.score || 0);
    if (canSaveResult) {
        const nextRecord = {
            ...(prevRecord || {}),
            lastCompletedAt: finishedAt,
            attempts: Number(prevRecord?.attempts || 0) + 1
        };
        if (shouldSaveBest) {
            Object.assign(nextRecord, {
                score: netCount,
                total: totalCount,
                miss: missCount,
                bestAt: finishedAt
            });
        }
        users[currentUser].textRecords[currentTextTask.id] = nextRecord;
    }
    if (shouldSaveBest) {
        isNewRecord = canSaveResult;
    }
    
    let coinGain = 0;
    if (netCount >= 2001) coinGain = 15000;
    else if (netCount >= 1501) coinGain = 10000;
    else if (netCount >= 1001) coinGain = 8500;
    else if (netCount >= 801) coinGain = 5000;
    else if (netCount >= 601) coinGain = 2500;
    else if (netCount >= 451) coinGain = 1000;
    else if (netCount >= 351) coinGain = 500;
    else if (netCount >= 251) coinGain = 100;
    else if (netCount >= 101) coinGain = 50;
    else if (netCount >= 51) coinGain = 30;
    else if (netCount >= 1) coinGain = 20;

    if (canSaveResult) {
        users[currentUser].coins = (users[currentUser].coins || 0) + coinGain;
        recordPracticeActivity({
            category: 'text',
            title: `文章入力 ${currentTextTask.title}`,
            detail: isNewRecord ? '提出 / 新記録' : '提出',
            amount: `入力 ${totalCount}文字 / ミス ${missCount}箇所 / 純字数 ${netCount}`,
            coins: coinGain
        });
        saveUsers(false);
    } else if (originalUserData) {
        users[currentUser] = originalUserData;
        coinGain = 0;
    }
    SoundManager.playClear(); createConfetti(users[currentUser]?.activeEffect || 'default');

    const sourceHtml = generateSourceHtml(refClean);
    const reviewedInputHtml = generateReviewedInputHtml(refClean, typedClean);

    const details = document.getElementById('text-result-details');
    details.innerHTML = `
        <div class="text-result-summary">
            <div style="font-size:22px; font-weight:900; color:#0277bd;">結果</div>
            <div>総字数： <span style="color:#0288d1">${totalCount}</span> 文字</div>
            <div>ミス数： <span style="color:#d32f2f">${missCount}</span> 箇所</div>
            <div>純字数： <span style="color:#4CAF50; font-weight:bold;">${netCount}</span> (スコア)</div>
            <div style="color:#FF9800; font-weight:bold;">💰 獲得コイン: ${coinGain} 枚</div>
        </div>
        ${!canSaveResult ? '<div style="font-size:18px; color:#607D8B; text-align:center; margin-top:8px;">先生確認モード：結果は保存されません</div>' : ''}
        ${isNewRecord ? '<div style="color:#ffeb3b; font-size:24px; text-shadow: 1px 1px #000; animation:bounce 1s infinite; text-align:center; margin-top:10px;">★しんきろく！★</div>' : ''}
        <div class="text-result-compare">
            <section class="text-result-card">
                <h3>原文</h3>
                <div class="text-review-box">${sourceHtml}</div>
            </section>
            <section class="text-result-card">
                <h3>入力内容の添削</h3>
                <div class="text-review-box">${reviewedInputHtml}</div>
                <div class="text-review-legend"><span class="legend-correct">正解</span><span class="legend-miss">ミス</span></div>
            </section>
        </div>
    `;
    document.getElementById('text-result-overlay').style.display = 'flex';
}

export function closeTextResult() { document.getElementById('text-result-overlay').style.display = 'none'; showScreen('screen-text-menu'); renderTextTasks(); }

function formatElapsedSeconds(seconds) {
    const safeSeconds = Math.max(0, Math.floor(Number(seconds || 0)));
    const minutes = Math.floor(safeSeconds / 60);
    const rest = safeSeconds % 60;
    return `${minutes}分${rest.toString().padStart(2, '0')}秒`;
}

function recordTextPracticeInterrupt() {
    if (!currentTextTask || !canWriteCurrentUserRow()) return;
    const typeBox = document.getElementById('type-text-box');
    const typedCount = (typeBox?.value || '').replace(/\r\n/g, '\n').length;
    const totalSeconds = Number(currentTextTask.time || 0) * 60;
    const elapsed = Math.max(0, totalSeconds - Number(textTimeLeft || 0));
    if (!textTimerInterval && typedCount === 0) return;
    recordPracticeActivity({
        category: 'text',
        title: `文章入力 ${currentTextTask.title}`,
        detail: '中断',
        amount: `入力 ${typedCount}文字 / 経過 ${formatElapsedSeconds(elapsed)}`,
        coins: 0
    });
    saveUsers(false);
}

export function backToMenuFromText() {
    recordTextPracticeInterrupt();
    if (textTimerInterval) { clearInterval(textTimerInterval); textTimerInterval = null; }
    if (cancelStartHandler) { document.removeEventListener('keydown', cancelStartHandler); cancelStartHandler = null; const overlay = document.getElementById('text-start-overlay'); if (overlay) overlay.style.display = 'none'; }
    const typeBox = document.getElementById('type-text-box');
    if(typeBox) typeBox.oninput = null;
    showScreen('screen-text-menu');
}

function calcMissCount(ref, typed) {
    if (typed.length === 0) return 0;
    const N = ref.length, M = typed.length, dp = Array.from({length: N + 1}, () => Array(M + 1).fill(0));
    for (let i = 0; i <= N; i++) dp[i][0] = i; for (let j = 0; j <= M; j++) dp[0][j] = j;
    for (let i = 1; i <= N; i++) {
        for (let j = 1; j <= M; j++) {
            const cost = ref[i - 1] === typed[j - 1] ? 0 : 1;
            dp[i][j] = Math.min( dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost );
        }
    }
    let minMiss = Infinity; for (let i = 0; i <= N; i++) { if (dp[i][M] < minMiss) minMiss = dp[i][M]; }
    return minMiss;
}

function generateSourceHtml(ref) {
    return `<span class="diff-source">${formatReviewText(ref)}</span>`;
}

function generateReviewedInputHtml(ref, typed) {
    if (!typed) return '<span class="diff-empty">入力はありません</span>';
    const renderDiffChar = (str, className) => `<span class="${className}">${formatReviewText(str)}</span>`;
    let reviewedHtml = '';
    const typedLength = typed.length;
    for (let i = 0; i < typedLength; i++) {
        const className = typed[i] === ref[i] ? 'diff-correct' : 'diff-miss';
        reviewedHtml += renderDiffChar(typed[i], className);
    }
    return reviewedHtml;
}

function formatReviewText(str) {
    return escapeHtml(str)
        .replace(/ /g, '&nbsp;')
        .replace(/　/g, '　')
        .replace(/\n/g, '<span class="diff-newline">↵</span><br>');
}
