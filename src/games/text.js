import { users, currentUser, saveUsers } from '../api/user.js';
import { SoundManager } from '../utils/sound.js';
import { showScreen } from '../ui/screen.js';
import { createConfetti } from '../ui/effects.js';

/* =========================================================
   [JS] 6. 文章入力練習 ＆ 自動採点
   ========================================================= */
let currentTextTask = null, textTimerInterval = null, textTimeLeft = 0;
let isRubyOn = true, isNaviOn = true;

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
    
    while (i < rawText.length) {
        if (rawText[i] === '{') {
            let closeIdx = rawText.indexOf('}', i);
            let pipeIdx = rawText.indexOf('|', i);
            if (closeIdx !== -1 && pipeIdx !== -1 && pipeIdx < closeIdx) {
                let kanji = rawText.substring(i + 1, pipeIdx);
                let ruby = rawText.substring(pipeIdx + 1, closeIdx);
                
                if (isRubyOn) html += '<ruby>';
                for (let k = 0; k < kanji.length; k++) {
                    let charClass = '';
                    if (isNaviOn) {
                        if (plainIndex < matchLen) charClass = 'text-done';
                        else if (plainIndex === matchLen) charClass = 'text-current';
                    }
                    html += `<span class="${charClass}">${kanji[k].replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</span>`;
                    plainIndex++;
                }
                if (isRubyOn) html += `<rt style="color:#E91E63; font-size:0.7em; font-weight:normal;">${ruby}</rt></ruby>`;
                
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
        } else if (char === ' ' || char === '　') {
            html += `<span class="${charClass}">&nbsp;</span>`;
            plainIndex++;
        } else {
            html += `<span class="${charClass}">${char.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</span>`;
            plainIndex++;
        }
        i++;
    }
    refBox.innerHTML = html;
}

export function goToTextMenu() { renderTextTasks(); showScreen('screen-text-menu'); }

let currentTextPage = 0;
const TEXT_ITEMS_PER_PAGE = 6;

function renderTextTasks() {
    const cont = document.getElementById('text-menu-content'); cont.innerHTML = '';
    const glob = users['__GLOBAL_SETTINGS__'];
    if (!glob || !glob.textTasks || glob.textTasks.length === 0) { cont.innerHTML = '<p style="font-size:20px; color:#666;">先生が作った課題はまだありません。</p>'; return; }
    
    const grid = document.createElement('div');
    grid.style.display = 'flex'; grid.style.flexWrap = 'wrap'; grid.style.justifyContent = 'center'; grid.style.gap = '15px'; grid.style.width = '100%';
    
    const tasks = glob.textTasks; const totalPages = Math.ceil(tasks.length / TEXT_ITEMS_PER_PAGE);
    const start = currentTextPage * TEXT_ITEMS_PER_PAGE; const pageTasks = tasks.slice(start, start + TEXT_ITEMS_PER_PAGE);

    pageTasks.forEach(task => {
        const btn = document.createElement('button'); btn.className = 'stage-btn unlocked'; 
        btn.style.height = 'auto'; btn.style.minHeight = '130px'; btn.style.padding = '15px'; btn.style.marginBottom = '0'; btn.style.width = '45%'; btn.style.minWidth = '350px';
        
        let recordHtml = '';
        if (users[currentUser] && users[currentUser].textRecords && users[currentUser].textRecords[task.id]) {
            const r = users[currentUser].textRecords[task.id]; recordHtml = `<br><span style="font-size:16px; color:#E91E63; font-weight:bold;">🏆 最高純字数: ${r.score}文字 (ミス${r.miss})</span>`;
        }
        let stars = "⭐".repeat(task.star || 3);
        btn.innerHTML = `<span style="font-size:22px; font-weight:bold;">${task.title}</span> <span class="reward-badge-text">💰最高15000</span><br><span style="font-size:16px; color:#FF9800;">難易度: ${stars}</span><br><span style="font-size:16px; color:#666;">制限時間: ${task.time}分</span>${recordHtml}`;
        btn.onclick = () => startTextPractice(task.id); grid.appendChild(btn);
    });
    cont.appendChild(grid);

    if (totalPages > 1) {
        const pc = document.createElement('div'); pc.style.display = 'flex'; pc.style.gap = '20px'; pc.style.marginTop = '20px';
        const pBtn = document.createElement('button'); pBtn.className = 'btn-secondary'; pBtn.innerText = '◀ まえのページ'; pBtn.disabled = currentTextPage === 0; pBtn.onclick = () => { currentTextPage--; renderTextTasks(); };
        const pTxt = document.createElement('span'); pTxt.style.fontSize = '20px'; pTxt.style.fontWeight = 'bold'; pTxt.style.alignSelf = 'center'; pTxt.innerText = `${currentTextPage + 1} / ${totalPages}`;
        const nBtn = document.createElement('button'); nBtn.className = 'btn-secondary'; nBtn.innerText = 'つぎのページ ▶'; nBtn.disabled = currentTextPage === totalPages - 1; nBtn.onclick = () => { currentTextPage++; renderTextTasks(); };
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
    const typeBox = document.getElementById('type-text-box');
    const rawRef = currentTextTask.content;
    const plainRef = rawRef.replace(/\{([^|]+)\|([^}]+)\}/g, '$1');
    const typed = typeBox.value;
    const refClean = plainRef.replace(/\r\n/g, '\n'); const typedClean = typed.replace(/\r\n/g, '\n');
    let missCount = calcMissCount(refClean, typedClean); let totalCount = typedClean.length; let netCount = Math.max(0, totalCount - missCount);

    if (!users[currentUser].textRecords) users[currentUser].textRecords = {};
    let isNewRecord = false, prev = users[currentUser].textRecords[currentTextTask.id];
    if (!prev || netCount > prev.score) { users[currentUser].textRecords[currentTextTask.id] = { score: netCount, total: totalCount, miss: missCount }; isNewRecord = true; }
    
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

    users[currentUser].coins = (users[currentUser].coins || 0) + coinGain; 
    saveUsers(false); SoundManager.playClear(); createConfetti();

    let diffHtml = generateDiffHtml(refClean, typedClean);

    const details = document.getElementById('text-result-details');
    details.innerHTML = `
        <div style="display:flex; gap:20px; justify-content:center; margin-bottom:15px; font-size:24px;">
            <div>総字数： <span style="color:#0288d1">${totalCount}</span> 文字</div>
            <div>ミス数： <span style="color:#d32f2f">${missCount}</span> 箇所</div>
        </div>
        <div style="font-size:36px; text-align:center;">純字数： <span style="color:#4CAF50; font-weight:bold;">${netCount}</span> (スコア)</div>
        <div style="font-size:24px; color:#FF9800; text-align:center; margin-top:10px; font-weight:bold;">💰 獲得コイン: ${coinGain} 枚</div>
        ${isNewRecord ? '<div style="color:#ffeb3b; font-size:24px; text-shadow: 1px 1px #000; animation:bounce 1s infinite; text-align:center; margin-top:10px;">★しんきろく！★</div>' : ''}
        <div style="margin-top: 15px; padding-top: 15px; border-top: 2px dashed #81d4fa; text-align: left; font-size: 18px; max-height: 150px; overflow-y: auto; background: rgba(255,255,255,0.7); padding: 10px; border-radius: 8px;">
            <div style="font-size:14px; color:#555; font-weight:bold; margin-bottom:5px;">🔍 ミスした場所のふりかえり（赤=お手本 / 緑=あなたの入力）</div>
            ${diffHtml}
        </div>
    `;
    document.getElementById('text-result-overlay').style.display = 'flex';
}

export function closeTextResult() { document.getElementById('text-result-overlay').style.display = 'none'; showScreen('screen-text-menu'); renderTextTasks(); }
export function backToMenuFromText() {
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

function generateDiffHtml(ref, typed) {
    const N = ref.length, M = typed.length;
    const dp = Array.from({length: N + 1}, () => Array(M + 1).fill(0));
    for (let i = 0; i <= N; i++) dp[i][0] = i; for (let j = 0; j <= M; j++) dp[0][j] = j;
    for (let i = 1; i <= N; i++) {
        for (let j = 1; j <= M; j++) {
            if (ref[i - 1] === typed[j - 1]) dp[i][j] = dp[i - 1][j - 1];
            else dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + 1);
        }
    }
    let diffHtml = '', i = N, j = M, ops =[];
    while (i > 0 || j > 0) {
        if (i > 0 && j > 0 && ref[i - 1] === typed[j - 1]) { ops.push({ type: 'match', char: ref[i - 1] }); i--; j--; } 
        else {
            let cDel = i > 0 ? dp[i - 1][j] : Infinity, cIns = j > 0 ? dp[i][j - 1] : Infinity, cRep = (i > 0 && j > 0) ? dp[i - 1][j - 1] : Infinity;
            let minC = Math.min(cDel, cIns, cRep);
            if (minC === cRep && dp[i][j] === cRep + 1) { ops.push({ type: 'replace', exp: ref[i - 1], act: typed[j - 1] }); i--; j--; } 
            else if (minC === cIns && dp[i][j] === cIns + 1) { ops.push({ type: 'insert', act: typed[j - 1] }); j--; } 
            else if (minC === cDel && dp[i][j] === cDel + 1) { ops.push({ type: 'delete', exp: ref[i - 1] }); i--; } 
            else { if (i > 0 && j > 0) { ops.push({ type: 'replace', exp: ref[i - 1], act: typed[j - 1] }); i--; j--; } else if (i > 0) { ops.push({ type: 'delete', exp: ref[i - 1] }); i--; } else { ops.push({ type: 'insert', act: typed[j - 1] }); j--; } }
        }
    }
    ops.reverse();
    ops.forEach(op => {
        let esc = (str) => str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '↵<br>');
        if (op.type === 'match') diffHtml += `<span class="diff-match">${esc(op.char)}</span>`;
        else if (op.type === 'replace') diffHtml += `<span class="diff-delete">${esc(op.exp)}</span><span class="diff-insert">${esc(op.act)}</span>`;
        else if (op.type === 'insert') diffHtml += `<span class="diff-insert">${esc(op.act)}</span>`;
        else if (op.type === 'delete') diffHtml += `<span class="diff-delete">${esc(op.exp)}</span>`;
    });
    return diffHtml;
}
