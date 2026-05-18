import {
    users,
    saveUsers,
    GLOBAL_SETTINGS_ID
} from '../api/user.js';
import { showCustomAlert, showCustomConfirm } from './modal.js';
import { recordAdminAudit } from './admin-audit.js';

let editingTextTaskId = null; 

const TEXT_TASK_TEMPLATES = [
    {
        id: 'tpl_text_first_steps',
        title: 'はじめての文章入力',
        time: 3,
        star: 1,
        content: 'きょうは、パソコンで文章を入力します。\nゆっくりでもよいので、正しく入力しましょう。\nまちがえたときは、落ち着いて直します。'
    },
    {
        id: 'tpl_text_comma_period',
        title: '読点と句点の練習',
        time: 4,
        star: 2,
        content: '朝、教室に入ったら、先生にあいさつをします。\nイスにすわったら、パソコンを開きます。\n準備ができたら、Dレッスンを始めます。'
    },
    {
        id: 'tpl_text_pc_actions',
        title: 'パソコン操作の文',
        time: 4,
        star: 2,
        content: 'ファイルを開いて、文字を入力します。\n入力が終わったら、名前をつけて保存します。\nわからないときは、先生に聞きます。'
    },
    {
        id: 'tpl_text_report',
        title: '短い報告文',
        time: 5,
        star: 3,
        content: '今日の練習では、マウス操作とキーボード入力に取り組みました。\nマウスでは、ねらった場所を正しくクリックできました。\nキーボードでは、前よりも落ち着いて入力できました。'
    },
    {
        id: 'tpl_text_story',
        title: '物語文の練習',
        time: 6,
        star: 3,
        content: '{昔|むかし}々、あるところに、パソコンが好きな子どもがいました。\nその子は毎日少しずつ練習して、できることを増やしていきました。\nうまくいかない日もありましたが、あきらめずに続けました。'
    },
    {
        id: 'tpl_text_long_challenge',
        title: '長文チャレンジ',
        time: 8,
        star: 4,
        content: '文章入力では、速さだけでなく、正確さも大切です。\nまずはお手本をよく見て、同じように入力します。\n次に、まちがえた場所を確認して、どうすれば正しく入力できるか考えます。\n毎回の練習を記録していくことで、自分の成長がわかります。'
    }
];

function getTextTasks() {
    if (!users[GLOBAL_SETTINGS_ID]) users[GLOBAL_SETTINGS_ID] = { isMaster: true };
    if (!users[GLOBAL_SETTINGS_ID].textTasks) users[GLOBAL_SETTINGS_ID].textTasks = [];
    return users[GLOBAL_SETTINGS_ID].textTasks;
}

export function adminAddTextTask() {
    const title = document.getElementById('admin-text-title').value.trim();
    const time = parseInt(document.getElementById('admin-text-time').value, 10);
    const star = parseInt(document.getElementById('admin-text-star').value, 10) || 3; 
    const content = document.getElementById('admin-text-content').value;
    if (!title || !time || !content.trim()) return showCustomAlert("タイトル、制限時間、お手本文章をすべて入力してください。");
    
    const textTasks = getTextTasks();
    
    if (editingTextTaskId) {
        let task = textTasks.find(t => t.id === editingTextTaskId);
        if (task) {
            task.title = title;
            task.time = time;
            task.star = star;
            task.content = content;
        }
        editingTextTaskId = null;
        document.getElementById('btn-admin-text-save').innerText = '課題を追加';
        recordAdminAudit('文章課題更新', { title, time, star });
        showCustomAlert('課題を更新しました！');
    } else {
        const taskId = 'tt_' + Date.now();
        textTasks.push({ id: taskId, title: title, time: time, star: star, content: content });
        recordAdminAudit('文章課題追加', { title, time, star });
        showCustomAlert('新しい課題を追加しました！');
    }
    
    saveUsers(true); 
    document.getElementById('admin-text-title').value = ''; 
    document.getElementById('admin-text-time').value = ''; 
    document.getElementById('admin-text-star').value = '3'; 
    document.getElementById('admin-text-content').value = '';
    renderAdminTextTasks();
}

export function loadTextTaskTemplate(templateId) {
    const template = TEXT_TASK_TEMPLATES.find(item => item.id === templateId);
    if (!template) return showCustomAlert('テンプレートが見つかりませんでした。');
    editingTextTaskId = null;
    document.getElementById('admin-text-title').value = template.title;
    document.getElementById('admin-text-time').value = template.time;
    document.getElementById('admin-text-star').value = template.star;
    document.getElementById('admin-text-content').value = template.content;
    document.getElementById('btn-admin-text-save').innerText = '課題を追加';
}

export function addStandardTextTaskTemplates() {
    const textTasks = getTextTasks();
    const existingIds = new Set(textTasks.map(task => task.id));
    const added = [];
    TEXT_TASK_TEMPLATES.forEach(template => {
        if (existingIds.has(template.id)) return;
        textTasks.push({ ...template });
        added.push(template.title);
    });
    if (added.length === 0) {
        showCustomAlert('標準課題はすでに追加されています。');
        return;
    }
    recordAdminAudit('文章入力 標準課題追加', { count: added.length, titles: added });
    saveUsers(true);
    renderAdminTextTasks();
    showCustomAlert(`標準課題を ${added.length} 件追加しました。`);
}

export function renderTextTaskTemplateOptions() {
    const select = document.getElementById('admin-text-template-select');
    if (!select) return;
    select.innerHTML = '<option value="">テンプレートを選択</option>' + TEXT_TASK_TEMPLATES
        .map(template => `<option value="${template.id}">★${template.star} ${template.title}</option>`)
        .join('');
}

export function editTextTask(id) {
    const task = getTextTasks().find(t => t.id === id);
    if (!task) return;
    editingTextTaskId = id;
    document.getElementById('admin-text-title').value = task.title;
    document.getElementById('admin-text-time').value = task.time;
    document.getElementById('admin-text-star').value = task.star || 3;
    document.getElementById('admin-text-content').value = task.content;
    document.getElementById('btn-admin-text-save').innerText = '課題を更新';
    document.getElementById('admin-text-title').focus();
}

export function moveTextTask(idx, dir) {
    const tasks = getTextTasks();
    if (dir === -1 && idx > 0) {
        [tasks[idx-1], tasks[idx]] =[tasks[idx], tasks[idx-1]];
    } else if (dir === 1 && idx < tasks.length - 1) {
        [tasks[idx+1], tasks[idx]] = [tasks[idx], tasks[idx+1]];
    }
    recordAdminAudit('文章課題並び替え', { index: idx + 1, direction: dir === -1 ? 'up' : 'down' });
    saveUsers(true);
    renderAdminTextTasks();
}

export function renderAdminTextTasks() {
    const list = document.getElementById('admin-text-task-list'); list.innerHTML = '';
    renderTextTaskTemplateOptions();
    const tasks = getTextTasks();
    if (tasks.length === 0) { list.innerHTML = '<li style="color:#999; text-align:center;">まだ課題がありません</li>'; return; }
    tasks.forEach((task, idx) => {
        const li = document.createElement('li');
        li.style.display = 'flex'; li.style.justifyContent = 'space-between'; li.style.alignItems = 'center'; li.style.marginBottom = '10px'; li.style.background = '#f9f9f9'; li.style.padding = '10px'; li.style.borderRadius = '5px'; li.style.border = '1px solid #ccc';
        
        let stars = "⭐".repeat(task.star || 3);
        
        li.innerHTML = `
            <div style="flex:1;">
                <strong>${task.title}</strong> <span style="font-size:12px; color:#FF9800;">${stars}</span> (${task.time}分)<br>
                <span style="font-size:12px; color:#666;">${task.content.substring(0, 30)}...</span>
            </div>
            <div style="display:flex; gap:5px;">
                <button class="btn-secondary" style="font-size:14px; padding:5px 10px;" onclick="moveTextTask(${idx}, -1)" ${idx === 0 ? 'disabled' : ''}>▲</button>
                <button class="btn-secondary" style="font-size:14px; padding:5px 10px;" onclick="moveTextTask(${idx}, 1)" ${idx === tasks.length - 1 ? 'disabled' : ''}>▼</button>
                <button class="btn-primary" style="font-size:14px; padding:5px 15px;" onclick="editTextTask('${task.id}')">編集</button>
                <button class="btn-danger" style="font-size:14px; padding:5px 15px;" onclick="deleteTextTask(${idx}, '${task.title}')">削除</button>
            </div>
        `;
        list.appendChild(li);
    });
}

export function deleteTextTask(idx, title) { 
    showCustomConfirm(`本当に課題「${title}」を削除しますか？`, () => {
        getTextTasks().splice(idx, 1);
        recordAdminAudit('文章課題削除', { title });
        saveUsers(true); renderAdminTextTasks();
    });
}

export function insertRuby() {
    const ta = document.getElementById('admin-text-content');
    const rubyInp = document.getElementById('admin-ruby-input');
    const ruby = rubyInp.value.trim();
    if (!ruby) return showCustomAlert('よみがなを入力してください');
    const start = ta.selectionStart; const end = ta.selectionEnd;
    if (start === end) return showCustomAlert('テキストボックス内で、ルビを振りたい漢字をマウスで選択（ハイライト）してからボタンを押してください。');
    const text = ta.value; const selected = text.substring(start, end); const before = text.substring(0, start); const after = text.substring(end);
    ta.value = `${before}{${selected}|${ruby}}${after}`; rubyInp.value = ''; ta.focus();
    const newCursorPos = start + selected.length + ruby.length + 3; ta.setSelectionRange(newCursorPos, newCursorPos);
}

export function toggleAutoRubyTool() {
    const tool = document.getElementById('admin-auto-ruby-tool');
    tool.style.display = tool.style.display === 'none' ? 'flex' : 'none';
}

export function generateAutoRuby() {
    const tool = document.getElementById('admin-auto-ruby-tool');
    const btn = tool.querySelector('.btn-primary');
    const originalText = btn.innerText;
    btn.innerText = '⏳ 処理中...'; btn.disabled = true; btn.style.backgroundColor = '#9e9e9e';
    setTimeout(() => {
        try { processAutoRuby(); } catch(e) { console.error(e); showCustomAlert("エラーが発生しました。入力内容を確認してください。"); } 
        finally { btn.innerText = originalText; btn.disabled = false; btn.style.backgroundColor = ''; }
    }, 50);
}

export function processAutoRuby() {
    const original = document.getElementById('auto-ruby-origin').value.trim();
    const yomiInput = document.getElementById('auto-ruby-yomi').value.trim();
    if(!original || !yomiInput) return showCustomAlert('「原文」と「よみ」の両方を入力してください。');
    const toHira = (str) => str.replace(/[\u30a1-\u30f6]/g, match => String.fromCharCode(match.charCodeAt(0) - 0x60)).toLowerCase();
    const isKanji = (c) => /[\u4E00-\u9FFF\u3400-\u4DBF\uF900-\uFAFF々]/.test(c);
    const yStr = toHira(yomiInput.replace(/\s+/g, ''));
    let blocks =[]; let currentBlock = ""; let currentType = null; 
    const getType = (c) => { if (/\s/.test(c)) return 'space'; if (isKanji(c)) return 'kanji'; return 'other'; };
    for (let i = 0; i < original.length; i++) {
        let c = original[i]; let t = getType(c);
        if (i === 0) { currentType = t; currentBlock = c; } 
        else { if (currentType === t) { currentBlock += c; } else { blocks.push({ type: currentType, text: currentBlock }); currentType = t; currentBlock = c; } }
    }
    if (currentBlock) blocks.push({ type: currentType, text: currentBlock });
    let searchBlocks = blocks.filter(b => b.type !== 'space');
    let memo = {};
    function dfs(bIdx, yIdx) {
        let key = bIdx + "," + yIdx; if (memo[key] !== undefined) return memo[key];
        if (bIdx === searchBlocks.length) return yIdx === yStr.length ?[] : null;
        let b = searchBlocks[bIdx];
        if (b.type === 'other') {
            let compStr = toHira(b.text).replace(/\s+/g, ''); let len = compStr.length;
            if (yStr.substring(yIdx, yIdx + len) === compStr) { let res = dfs(bIdx + 1, yIdx + len); if (res !== null) { memo[key] = res; return res; } }
        } else {
            let nextB = searchBlocks[bIdx + 1];
            if (nextB && nextB.type === 'other') {
                let nextStr = toHira(nextB.text).replace(/\s+/g, ''); let searchStart = yIdx + 1;
                while (true) {
                    let matchIdx = yStr.indexOf(nextStr, searchStart); if (matchIdx === -1) break;
                    let res = dfs(bIdx + 1, matchIdx); if (res !== null) { let result =[yStr.substring(yIdx, matchIdx)].concat(res); memo[key] = result; return result; }
                    searchStart = matchIdx + 1;
                }
            } else {
                if (bIdx === searchBlocks.length - 1) {
                    let ruby = yStr.substring(yIdx); if (ruby.length > 0) { let result = [ruby]; memo[key] = result; return result; }
                } else {
                    for (let i = 1; yIdx + i <= yStr.length; i++) {
                        let res = dfs(bIdx + 1, yIdx + i); if (res !== null) { let result =[yStr.substring(yIdx, yIdx + i)].concat(res); memo[key] = result; return result; }
                    }
                }
            }
        }
        memo[key] = null; return null;
    }
    let rubies = dfs(0, 0);
    if (!rubies) return showCustomAlert("【ズレを発見しました！】\n「原文」と「よみ」の構成が一致しません。");
    let result = ""; let rubyIndex = 0;
    for (let i = 0; i < blocks.length; i++) {
        let b = blocks[i];
        if (b.type === 'space' || b.type === 'other') { result += b.text; } 
        else { result += `{${b.text}|${rubies[rubyIndex]}}`; rubyIndex++; }
    }
    document.getElementById('admin-text-content').value = result; toggleAutoRubyTool();
    showCustomAlert('✨ 自動ルビ振りが完了しました！\n\n上のテキストボックスの内容を確認し、問題なければ「課題を追加・更新」ボタンを押してください。');
}
