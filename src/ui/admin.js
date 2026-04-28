import { users, currentUser, saveUsers, login } from '../api/user.js';
import { STAGE_ORDER, THEMES, EFFECTS, VISION_STAGES } from '../data/constants.js';
import { SoundManager } from '../utils/sound.js';
import { 
    calculateGrade, sortGrades, showScreen, showCustomAlert, showCustomConfirm, 
    getStageName, loadCustomGlobalSettings 
} from '../main.js';

const ADMIN_PASS = '7188';

let passwordCallback = null;
export function showPasswordModal(title, callback) {
    const modal = document.getElementById('password-modal');
    if (!modal) { showCustomAlert("パスワード機能の準備ができていません"); return; }
    document.getElementById('password-modal-title').innerText = title;
    document.getElementById('password-input').value = '';
    modal.style.display = 'flex';
    setTimeout(() => document.getElementById('password-input').focus(), 100);
    passwordCallback = callback;
}
export function closePasswordModal() {
    document.getElementById('password-modal').style.display = 'none';
    passwordCallback = null;
}
export function submitPassword() {
    const pass = document.getElementById('password-input').value;
    const callback = passwordCallback; 
    closePasswordModal();
    if (callback) callback(pass); 
}

window.addEventListener('DOMContentLoaded', () => {
    const pwdInput = document.getElementById('password-input');
    if(pwdInput) {
        pwdInput.addEventListener('keydown', function(e) {
            if (e.key === 'Enter') submitPassword();
        });
    }
});

export function adminAddUser() {
    const name = document.getElementById('admin-add-name').value.trim();
    const birth = document.getElementById('admin-add-birth').value;
    const grp = document.getElementById('admin-add-group').value.trim(); 
    if(!name) return showCustomAlert("名前を入力してください");
    if(users[name]) return showCustomAlert("その名前はすでに登録されています");
    if(!birth) return showCustomAlert("生年月日を入力してください");
    const grade = calculateGrade(birth);
    users[name] = { birthdate: birth, grade: grade, mouseLevel: 1, keyboardSequence: 0, coins: 0, items: [], tickets:[], loginStamps:[], group: grp };
    saveUsers(true);
    document.getElementById('admin-add-name').value = '';
    document.getElementById('admin-add-group').value = '';
    updateAdminUserTable(); renderDashboardTable(); showCustomAlert(`${name} さんを追加しました！`);
}

export function adminBulkAddUsers() {
    const text = document.getElementById('admin-bulk-names').value;
    if(!text.trim()) return showCustomAlert("入力してください");
    const lines = text.split('\n');
    let added = 0;
    lines.forEach(line => {
        if(!line.trim()) return;
        let parts = line.split(/[,、]+/);
        let name = parts[0].trim();
        let birth = parts.length > 1 ? parts[1].trim() : "2015-04-01";
        let grp = parts.length > 2 ? parts[2].trim() : ""; 
        if(name && !users[name]) {
            let grade = calculateGrade(birth);
            users[name] = { birthdate: birth, grade: grade, mouseLevel: 1, keyboardSequence: 0, coins: 0, items: [], tickets:[], loginStamps:[], group: grp };
            added++;
        }
    });
    saveUsers(true); updateAdminUserTable(); renderDashboardTable();
    document.getElementById('admin-bulk-names').value = '';
    showCustomAlert(`${added} 人を追加しました！`);
}

export function adminDeleteUser() {
    const n = getSelUser();
    if(n) { 
        showCustomConfirm(`${n}さんを削除しますか？`, () => {
            delete users[n]; saveUsers(true); updateAdminUserTable(); renderDashboardTable();
        });
    }
}
export function adminAddCoins() { 
    const n = getSelUser(); 
    if (!n || !users[n]) return showCustomAlert('ユーザーを選択してください'); 
    const amt = parseInt(document.getElementById('admin-custom-coin-amount').value, 10);
    if(isNaN(amt) || amt <= 0) return showCustomAlert('正しいコイン数を入力してください');
    users[n].coins = (users[n].coins || 0) + amt; 
    saveUsers(true); 
    showCustomAlert(`${n} さんに ${amt} コインを付与しました！\n（現在のコイン: ${users[n].coins}枚）`); 
}

export function showAdminSection(secId) {
    document.getElementById('admin-main-menu').style.display = 'none';
    document.getElementById('admin-panel-content').style.display = 'flex';
    document.getElementById('admin-bottom-back-btn').style.display = 'none'; 
    document.querySelectorAll('.admin-section').forEach(sec => sec.style.display = 'none');
    const target = document.getElementById(secId);
    if(target) {
        target.style.display = 'flex';
        target.style.flexDirection = 'column';
        if(secId === 'admin-sec-dashboard') switchDashTab('basic'); 
    }
}

export function backToAdminMenu() {
    document.getElementById('admin-main-menu').style.display = 'flex';
    document.getElementById('admin-panel-content').style.display = 'none';
    document.getElementById('admin-bottom-back-btn').style.display = 'block';
}

export function openAdmin() { 
    showPasswordModal('管理者パスワード', (pass) => {
        if(pass === ADMIN_PASS) { 
            updateAdminUserTable(); 
            renderAdminTextTasks(); 
            renderTicketAdmin(); 
            backToAdminMenu();
            showScreen('screen-admin'); 
        } else { showCustomAlert('パスワードが違います'); }
    });
}

export function renderTicketAdmin() {
    // ★修正: let に変更し、データが無ければ新しく作る処理を追加
    let glob = users['__GLOBAL_SETTINGS__'];
    if (!glob) {
        glob = { isMaster: true };
        users['__GLOBAL_SETTINGS__'] = glob;
    }
    
    if(!glob.ticketConfig) glob.ticketConfig = { normal: { name: '👍 いいねポイント 5こ', icon: '🎟️' }, newRecord: { name: '👍 いいねポイント 1こ', icon: '🎟️' } };
    document.getElementById('admin-ticket-normal').value = glob.ticketConfig.normal.name;
    document.getElementById('admin-ticket-newrecord').value = glob.ticketConfig.newRecord.name;

    const histList = document.getElementById('admin-ticket-history');
    if(!histList) return; histList.innerHTML = '';
    let allHistory =[];
    Object.keys(users).forEach(n => {
        if (!users[n].isMaster && n !== '__GLOBAL_SETTINGS__' && users[n].ticketHistory) {
            users[n].ticketHistory.forEach(h => { allHistory.push({ user: n, ticketName: h.ticketName, date: h.date, timestamp: h.timestamp }); });
        }
    });
    allHistory.sort((a, b) => b.timestamp - a.timestamp);
    if(allHistory.length === 0) { histList.innerHTML = '<li style="color:#999;">まだ履歴がありません</li>'; } 
    else {
        allHistory.slice(0, 30).forEach(h => {
            const li = document.createElement('li');
            li.style.borderBottom = "1px dotted #ccc"; li.style.padding = "8px 0";
            li.innerHTML = `<span style="color:#666; font-size:14px;">${h.date}</span><br><b>【${h.user}】</b>さんが「<span style="color:#E91E63;">${h.ticketName}</span>」を使用しました。`;
            histList.appendChild(li);
        });
    }
}

export function saveTicketSettings() {
    const nName = document.getElementById('admin-ticket-normal').value.trim();
    const rName = document.getElementById('admin-ticket-newrecord').value.trim();
    if(!nName || !rName) return showCustomAlert('チケット名を入力してください');
    if (!users['__GLOBAL_SETTINGS__']) users['__GLOBAL_SETTINGS__'] = { isMaster:true };
    if (!users['__GLOBAL_SETTINGS__'].ticketConfig) users['__GLOBAL_SETTINGS__'].ticketConfig = { normal:{icon:'🎟️'}, newRecord:{icon:'🎟️'} };
    users['__GLOBAL_SETTINGS__'].ticketConfig.normal.name = nName; users['__GLOBAL_SETTINGS__'].ticketConfig.newRecord.name = rName;
    saveUsers(true); showCustomAlert('チケット設定を保存しました！');
}

export function getSelUser() { const r = document.querySelector('input[name="asel"]:checked'); return r ? r.value : null; }
export function adminResetUser() { const n = getSelUser(); if(n) { showCustomConfirm('リセットしますか？', () => { users[n].mouseLevel=0; users[n].keyboardSequence=0; users[n].examRecords={}; users[n].textRecords={}; users[n].globalMistakes={}; users[n].theme='default'; saveUsers(true); updateAdminUserTable(); }); } }
export function adminForceProgress() { const n = getSelUser(); if(n) { showCustomConfirm('全開放しますか？', () => { users[n].mouseLevel=7; users[n].keyboardSequence=STAGE_ORDER.length; saveUsers(true); updateAdminUserTable(); }); } }
export function adminCreateMasterUser() { users['Master_Debug'] = { mouseLevel:7, keyboardSequence:999, examRecords:{}, textRecords:{}, globalMistakes:{}, theme:'default', birthdate:'', isMaster:true }; saveUsers(true); updateAdminUserTable(); showCustomAlert('マスターユーザーを作成しました'); }
export function playAsMaster() { if (!users['Master_Debug']) { showCustomAlert('先にマスター作成ボタンを押してください。'); return; } document.getElementById('screen-admin').classList.remove('active'); login('Master_Debug'); }

let editTargetUser = null;
export function openEditProgress() {
    const n = getSelUser(); if (!n) return showCustomAlert('ユーザーを選択してください');
    editTargetUser = n; document.getElementById('edit-modal-title').innerText = `${n} さんの進捗編集`;
    document.getElementById('edit-mouse-level').value = users[n].mouseLevel || 0;
    const kbSelect = document.getElementById('edit-keyboard-seq'); kbSelect.innerHTML = `<option value="0">0: 初期状態</option>`;
    STAGE_ORDER.forEach((sid, idx) => { kbSelect.innerHTML += `<option value="${idx + 1}">${idx + 1}: ${getStageName(sid)} までクリア済</option>`; });
    kbSelect.value = users[n].keyboardSequence || 0; 
    const itemsContainer = document.getElementById('edit-items-container'); itemsContainer.innerHTML = '';
    const userItems = users[n].items ||[];
    let allCollectibles =[];
    THEMES.forEach(t => { if(t.id !== 'default') allCollectibles.push({ id: t.isCustom ? t.id : 'theme_' + t.id, name: '🎨 ' + t.name }); });
    EFFECTS.forEach(e => { if(e.id !== 'default') allCollectibles.push({ id: e.id, name: '🎉 ' + e.name }); });
    if (allCollectibles.length === 0) { itemsContainer.innerHTML = '<span style="color:#999;">ガチャアイテムがまだシステムにありません</span>'; } 
    else {
        allCollectibles.forEach(item => {
            const isOwned = userItems.includes(item.id) || (item.id.startsWith('theme_') && userItems.includes(item.id.replace('theme_', '')));
            const lbl = document.createElement('label'); lbl.style.cssText = 'display:inline-block; background:#fff; border:1px solid #ccc; padding:5px 10px; border-radius:20px; cursor:pointer; user-select:none; font-size:14px;';
            lbl.innerHTML = `<input type="checkbox" value="${item.id}" class="edit-item-cb" ${isOwned ? 'checked' : ''} style="margin-right:5px; transform:scale(1.2); cursor:pointer;">${item.name}`;
            itemsContainer.appendChild(lbl);
        });
    }
    document.getElementById('admin-edit-modal').style.display = 'flex';
}
export function closeEditProgress() { document.getElementById('admin-edit-modal').style.display = 'none'; editTargetUser = null; }

export function saveEditProgress() {
    if (!editTargetUser) return;
    users[editTargetUser].mouseLevel = parseInt(document.getElementById('edit-mouse-level').value, 10);
    users[editTargetUser].keyboardSequence = parseInt(document.getElementById('edit-keyboard-seq').value, 10);
    const cbs = document.querySelectorAll('.edit-item-cb'); let newItems =[];
    cbs.forEach(cb => { if (cb.checked) newItems.push(cb.value); }); users[editTargetUser].items = newItems;
    let currentThemeCheckId = THEMES.find(t=>t.id === users[editTargetUser].theme)?.isCustom ? users[editTargetUser].theme : 'theme_' + users[editTargetUser].theme;
    if(users[editTargetUser].theme !== 'default' && !newItems.includes(currentThemeCheckId) && !newItems.includes(users[editTargetUser].theme)) { users[editTargetUser].theme = 'default'; }
    if(users[editTargetUser].activeEffect !== 'default' && !newItems.includes(users[editTargetUser].activeEffect)) { users[editTargetUser].activeEffect = 'default'; }
    saveUsers(true); updateAdminUserTable(); closeEditProgress(); showCustomAlert('進捗とアイテム情報を保存しました。');
}

export function switchDashTab(tab) {
    if(tab === 'basic') {
        document.getElementById('dash-basic').style.display = 'block';
        document.getElementById('dash-vision').style.display = 'none';
        document.getElementById('tab-btn-basic').style.background = '#2196F3';
        document.getElementById('tab-btn-vision').style.background = '#9e9e9e';
        renderDashboardTable();
    } else {
        document.getElementById('dash-basic').style.display = 'none';
        document.getElementById('dash-vision').style.display = 'block';
        document.getElementById('tab-btn-basic').style.background = '#9e9e9e';
        document.getElementById('tab-btn-vision').style.background = '#9C27B0';
        renderVisionDashboardTable();
    }
}

export function updateAdminUserTable() {
    const tbody = document.getElementById('admin-user-tbody'); tbody.innerHTML = '';
    let list = Object.keys(users).filter(n => !users[n].isMaster && n !== '__GLOBAL_SETTINGS__').map(n => ({ name: n, user: users[n] }));
    list.sort((a,b) => a.name.localeCompare(b.name, 'ja'));
    list.forEach(item => {
        let uBirth = item.user.birthdate || item.user.birth;
        let dispGrade = (item.user.grade && String(item.user.grade) !== 'undefined') ? item.user.grade : calculateGrade(uBirth);
        
        let tr = document.createElement('tr');
        tr.innerHTML = `
            <td style="padding:5px; border:1px solid #ddd;"><input type="radio" name="asel" class="admin-user-check" value="${item.name}"></td>
            <td style="padding:5px; border:1px solid #ddd; font-weight:bold;">${item.name}</td>
            <td style="padding:5px; border:1px solid #ddd;">${dispGrade}</td>
            <td style="padding:5px; border:1px solid #ddd;"><input type="text" value="${item.user.group || ''}" onchange="updateUserGroup('${item.name}', this.value)" style="width:80px; padding:2px; font-size:12px; border:1px solid #ccc;"></td>
            <td style="padding:5px; border:1px solid #ddd;">Lv.${item.user.mouseLevel || 1}</td>
            <td style="padding:5px; border:1px solid #ddd;">${item.user.keyboardSequence || 0}/${STAGE_ORDER.length}</td>
        `;
        tbody.appendChild(tr);
    });
}

export function updateUserGroup(name, newGroup) {
    if(users[name]) { 
        users[name].group = newGroup.trim(); 
        saveUsers(false); 
        renderDashboardTable(); 
    }
}

export function renderDashboardTable() {
    try {
        const tbody = document.getElementById('dash-tbody');
        const gradeSelect = document.getElementById('dash-filter-grade');
        const grpSelect = document.getElementById('dash-filter-group'); 
        const sortSelect = document.getElementById('dash-sort');
        if(!tbody || !gradeSelect || !grpSelect || !sortSelect) return;

        const fGrade = gradeSelect.value || 'all';
        const fGroup = grpSelect.value || 'all';
        const sortVal = sortSelect.value || 'name';

        let existingGrades = new Set();
        let groups = new Set();
        let list =[];
        let isDataFixed = false;

        Object.keys(users).forEach(n => { 
            if(!users[n] || users[n].isMaster || n === '__GLOBAL_SETTINGS__') return;
            
            let uBirth = users[n].birthdate || users[n].birth;
            let uGrade = users[n].grade;
            if (!uGrade || String(uGrade) === 'undefined') {
                uGrade = calculateGrade(uBirth);
                users[n].grade = uGrade; 
                users[n].birthdate = uBirth; 
                isDataFixed = true;
            }

            existingGrades.add(uGrade);
            if(users[n].group) groups.add(users[n].group);

            if (fGrade !== 'all' && uGrade !== fGrade) return;
            if (fGroup !== 'all' && (users[n].group || '') !== fGroup) return; 
            
            list.push({ name: n, user: users[n] });
        });

        if (isDataFixed) saveUsers(false); 

        gradeSelect.innerHTML = '<option value="all">すべての学年</option>';
        sortGrades(Array.from(existingGrades)).forEach(g => {
            let opt = document.createElement('option'); opt.value = g; opt.innerText = g;
            if(g === fGrade) opt.selected = true;
            gradeSelect.appendChild(opt);
        });

        grpSelect.innerHTML = '<option value="all">すべてのグループ</option>';
        Array.from(groups).sort().forEach(g => {
            let opt = document.createElement('option'); opt.value = g; opt.innerText = g;
            if(g === fGroup) opt.selected = true;
            grpSelect.appendChild(opt);
        });

        if (sortVal === 'name') list.sort((a,b) => a.name.localeCompare(b.name, 'ja'));
        else if (sortVal === 'mouse_desc') list.sort((a,b) => (b.user.mouseLevel || 0) - (a.user.mouseLevel || 0));
        else if (sortVal === 'kb_desc') list.sort((a,b) => (b.user.keyboardSequence || 0) - (a.user.keyboardSequence || 0));

        tbody.innerHTML = '';
        list.forEach(item => {
            let tr = document.createElement('tr');
            
            let tdName = document.createElement('td'); 
            tdName.style.cssText = 'border:1px solid #ccc; padding:8px; font-weight:bold;'; 
            let grpBadge = item.user.group ? `<span style="font-size:12px; color:#666; background:#e0e0e0; padding:2px 6px; border-radius:10px; margin-left:8px;">${item.user.group}</span>` : '';
            tdName.innerHTML = item.name + grpBadge; 
            tr.appendChild(tdName);

            let tdGrade = document.createElement('td'); 
            tdGrade.style.cssText = 'border:1px solid #ccc; padding:8px;'; 
            tdGrade.innerText = item.user.grade; 
            tr.appendChild(tdGrade);

            let tdMouse = document.createElement('td'); 
            tdMouse.style.cssText = 'border:1px solid #ccc; padding:8px;';
            let mouseLevel = item.user.mouseLevel || 0;
            let mousePct = Math.floor((mouseLevel / 7) * 100);
            tdMouse.innerHTML = `<div style="width:100%; background:#eee; border-radius:5px;"><div style="width:${mousePct}%; background:#2196F3; color:#fff; text-align:center; font-size:12px; border-radius:5px;">${mousePct}%</div></div>`; 
            tr.appendChild(tdMouse);

            let tdKb = document.createElement('td'); 
            tdKb.style.cssText = 'border:1px solid #ccc; padding:8px;';
            let kbSeq = item.user.keyboardSequence || 0;
            let kbPct = Math.floor((kbSeq / STAGE_ORDER.length) * 100);
            tdKb.innerHTML = `<div style="width:100%; background:#eee; border-radius:5px;"><div style="width:${kbPct}%; background:#FF9800; color:#fff; text-align:center; font-size:12px; border-radius:5px;">${kbPct}%</div></div>`; 
            tr.appendChild(tdKb);

            tbody.appendChild(tr);
        });
    } catch(e) { console.error(e); }
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

let editingTextTaskId = null; 

export function adminAddTextTask() {
    const title = document.getElementById('admin-text-title').value.trim();
    const time = parseInt(document.getElementById('admin-text-time').value, 10);
    const star = parseInt(document.getElementById('admin-text-star').value, 10) || 3; 
    const content = document.getElementById('admin-text-content').value;
    if (!title || !time || !content.trim()) return showCustomAlert("タイトル、制限時間、お手本文章をすべて入力してください。");
    
    if (!users['__GLOBAL_SETTINGS__']) users['__GLOBAL_SETTINGS__'] = { isMaster:true };
    if (!users['__GLOBAL_SETTINGS__'].textTasks) users['__GLOBAL_SETTINGS__'].textTasks =[];
    
    if (editingTextTaskId) {
        let task = users['__GLOBAL_SETTINGS__'].textTasks.find(t => t.id === editingTextTaskId);
        if (task) {
            task.title = title;
            task.time = time;
            task.star = star;
            task.content = content;
        }
        editingTextTaskId = null;
        document.getElementById('btn-admin-text-save').innerText = '課題を追加';
        showCustomAlert('課題を更新しました！');
    } else {
        const taskId = 'tt_' + Date.now();
        users['__GLOBAL_SETTINGS__'].textTasks.push({ id: taskId, title: title, time: time, star: star, content: content });
        showCustomAlert('新しい課題を追加しました！');
    }
    
    saveUsers(true); 
    document.getElementById('admin-text-title').value = ''; 
    document.getElementById('admin-text-time').value = ''; 
    document.getElementById('admin-text-star').value = '3'; 
    document.getElementById('admin-text-content').value = '';
    renderAdminTextTasks();
}

export function editTextTask(id) {
    const task = users['__GLOBAL_SETTINGS__'].textTasks.find(t => t.id === id);
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
    const tasks = users['__GLOBAL_SETTINGS__'].textTasks;
    if (dir === -1 && idx > 0) {
        [tasks[idx-1], tasks[idx]] =[tasks[idx], tasks[idx-1]];
    } else if (dir === 1 && idx < tasks.length - 1) {
        [tasks[idx+1], tasks[idx]] = [tasks[idx], tasks[idx+1]];
    }
    saveUsers(true);
    renderAdminTextTasks();
}

export function renderAdminTextTasks() {
    const list = document.getElementById('admin-text-task-list'); list.innerHTML = '';
    const glob = users['__GLOBAL_SETTINGS__'];
    if (!glob || !glob.textTasks || glob.textTasks.length === 0) { list.innerHTML = '<li style="color:#999; text-align:center;">まだ課題がありません</li>'; return; }
    glob.textTasks.forEach((task, idx) => {
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
                <button class="btn-secondary" style="font-size:14px; padding:5px 10px;" onclick="moveTextTask(${idx}, 1)" ${idx === glob.textTasks.length - 1 ? 'disabled' : ''}>▼</button>
                <button class="btn-primary" style="font-size:14px; padding:5px 15px;" onclick="editTextTask('${task.id}')">編集</button>
                <button class="btn-danger" style="font-size:14px; padding:5px 15px;" onclick="deleteTextTask(${idx}, '${task.title}')">削除</button>
            </div>
        `;
        list.appendChild(li);
    });
}

export function deleteTextTask(idx, title) { 
    showCustomConfirm(`本当に課題「${title}」を削除しますか？`, () => {
        users['__GLOBAL_SETTINGS__'].textTasks.splice(idx, 1); saveUsers(true); renderAdminTextTasks(); 
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

export function exportData() {
    const dataStr = JSON.stringify(users, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const date = new Date();
    const dateStr = `${date.getFullYear()}${(date.getMonth()+1).toString().padStart(2,'0')}${date.getDate().toString().padStart(2,'0')}`;
    a.download = `d-lesson_backup_${dateStr}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

export function importData(event) {
    const file = event.target.files[0];
    if (!file) return;
    showCustomConfirm('【警告】現在のデータがすべて上書きされます！\n本当に復元してよろしいですか？', () => {
        const reader = new FileReader();
        reader.onload = function(e) {
            try {
                const importedUsers = JSON.parse(e.target.result);
                if (typeof importedUsers === 'object' && importedUsers !== null) {
                    // ★注意: ここのusersはmain.js側の参照なので、user.js側のusersを直接更新させる工夫が必要
                    // ひとまずこのままでもlocalStorage経由で復元できますが、画面リロード推奨
                    localStorage.setItem('pc_practice_v5_split', JSON.stringify(importedUsers));
                    saveUsers(true);
                    showCustomAlert('データを正常に復元しました！\n画面を再読み込みします。');
                    setTimeout(() => location.reload(), 1500);
                } else {
                    showCustomAlert('データ形式が正しくありません。');
                }
            } catch (err) {
                showCustomAlert('ファイルの読み込みに失敗しました。JSONファイルを選択してください。');
            }
            event.target.value = '';
        };
        reader.readAsText(file);
    });
}

export function openThemeCreator() { 
    document.getElementById('admin-theme-modal').style.display='flex'; 
    updateThemePreview(); 
}
export function closeThemeCreator() { document.getElementById('admin-theme-modal').style.display='none'; }

export function updateThemePreview() {
    const bg = document.getElementById('ct-bg').value;
    const text = document.getElementById('ct-text').value;
    const btnBg = document.getElementById('ct-btn-bg').value;
    const btnText = document.getElementById('ct-btn-text').value;
    const name = document.getElementById('ct-name').value || 'プレビュー';
    
    document.getElementById('ct-preview-text').innerText = name;

    let styleTag = document.getElementById('preview-dynamic-style');
    if (!styleTag) {
        styleTag = document.createElement('style');
        styleTag.id = 'preview-dynamic-style';
        document.head.appendChild(styleTag);
    }
    
    styleTag.innerHTML = `
        #ct-preview {
            background-color: ${bg} !important;
            border-color: ${text} !important;
        }
        #ct-preview-text {
            color: ${text} !important;
        }
        #ct-preview-btn {
            background-color: ${btnBg} !important;
            color: ${btnText} !important;
        }
    `;
}

export function saveCustomTheme() {
    const name = document.getElementById('ct-name').value.trim(); if(!name) return showCustomAlert('名前を入力してください');
    const bg = document.getElementById('ct-bg').value, text = document.getElementById('ct-text').value, btnBg = document.getElementById('ct-btn-bg').value, btnText = document.getElementById('ct-btn-text').value;
    const isPresent = document.getElementById('ct-present').checked; 
    
    if (!users['__GLOBAL_SETTINGS__']) users['__GLOBAL_SETTINGS__'] = { isMaster:true }; if (!users['__GLOBAL_SETTINGS__'].globalMistakes) users['__GLOBAL_SETTINGS__'].globalMistakes = {};
    if (!Array.isArray(users['__GLOBAL_SETTINGS__'].globalMistakes.customThemes)) users['__GLOBAL_SETTINGS__'].globalMistakes.customThemes =[];
    const newId = 'ct_' + Date.now(); 
    users['__GLOBAL_SETTINGS__'].globalMistakes.customThemes.push({ id: newId, name: name, bg: bg, text: text, btnBg: btnBg, btnText: btnText });
    
    if (isPresent) {
        Object.keys(users).forEach(n => {
            if (n !== '__GLOBAL_SETTINGS__') {
                if (!users[n].items) users[n].items =[];
                if (!users[n].items.includes(newId)) users[n].items.push(newId);
            }
        });
        showCustomAlert('「' + name + '」を全員にプレゼントしました！');
    } else {
        showCustomAlert('「' + name + '」をガチャのラインナップに追加しました！'); 
    }
    
    saveUsers(true); loadCustomGlobalSettings(); closeThemeCreator();
    document.getElementById('ct-name').value = ''; document.getElementById('ct-present').checked = false;
}

export function openEffectCreator() { document.getElementById('admin-effect-modal').style.display='flex'; }
export function closeEffectCreator() { document.getElementById('admin-effect-modal').style.display='none'; }

export function saveCustomEffect() {
    const name = document.getElementById('ce-name').value.trim(); if(!name) return showCustomAlert('名前を入力してください');
    const emojis =[document.getElementById('ce-emo1').value.trim(), document.getElementById('ce-emo2').value.trim(), document.getElementById('ce-emo3').value.trim()].filter(e => e !== '');
    if(emojis.length === 0) return showCustomAlert('絵文字を1つ以上入力してください');
    const isPresent = document.getElementById('ce-present').checked; 
    
    if (!users['__GLOBAL_SETTINGS__']) users['__GLOBAL_SETTINGS__'] = { isMaster:true }; if (!users['__GLOBAL_SETTINGS__'].globalMistakes) users['__GLOBAL_SETTINGS__'].globalMistakes = {};
    if (!Array.isArray(users['__GLOBAL_SETTINGS__'].globalMistakes.customEffects)) users['__GLOBAL_SETTINGS__'].globalMistakes.customEffects =[];
    const newId = 'ce_' + Date.now(); 
    users['__GLOBAL_SETTINGS__'].globalMistakes.customEffects.push({ id: newId, name: name, emojis: emojis });
    
    if (isPresent) {
        Object.keys(users).forEach(n => {
            if (n !== '__GLOBAL_SETTINGS__') {
                if (!users[n].items) users[n].items =[];
                if (!users[n].items.includes(newId)) users[n].items.push(newId);
            }
        });
        showCustomAlert('「' + name + '」を全員にプレゼントしました！');
    } else {
        showCustomAlert('「' + name + '」をガチャのラインナップに追加しました！'); 
    }
    
    saveUsers(true); loadCustomGlobalSettings(); closeEffectCreator();
    document.getElementById('ce-name').value = ''; document.getElementById('ce-present').checked = false;
}

export function openCustomManager() { const modal = document.getElementById('admin-custom-manage-modal'); if (!modal) return; renderCustomManagerList(); modal.style.display = 'flex'; }
export function closeCustomManager() { document.getElementById('admin-custom-manage-modal').style.display = 'none'; }
export function renderCustomManagerList() {
    const glob = users['__GLOBAL_SETTINGS__'], themeUl = document.getElementById('manage-theme-list'), effectUl = document.getElementById('manage-effect-list');
    if (!themeUl || !effectUl) return; themeUl.innerHTML = ''; effectUl.innerHTML = '';
    let hasTheme = false;
    if (glob && glob.globalMistakes && Array.isArray(glob.globalMistakes.customThemes)) {
        glob.globalMistakes.customThemes.forEach((ct, idx) => {
            hasTheme = true; const li = document.createElement('li'); li.style.display = 'flex'; li.style.justifyContent = 'space-between'; li.style.alignItems = 'center'; li.style.marginBottom = '10px';
            li.innerHTML = `<span>🎨 ${ct.name}</span> <button class="btn-danger" style="font-size:14px; padding:5px 15px;" onclick="deleteCustomElement('theme', ${idx}, '${ct.name}')">削除</button>`; themeUl.appendChild(li);
        });
    }
    if (!hasTheme) themeUl.innerHTML = '<li style="color:#999; text-align:center;">作ったテーマはありません</li>';
    let hasEffect = false;
    if (glob && glob.globalMistakes && Array.isArray(glob.globalMistakes.customEffects)) {
        glob.globalMistakes.customEffects.forEach((ce, idx) => {
            hasEffect = true; const li = document.createElement('li'); li.style.display = 'flex'; li.style.justifyContent = 'space-between'; li.style.alignItems = 'center'; li.style.marginBottom = '10px';
            li.innerHTML = `<span>🎉 ${ce.name} (${ce.emojis.join('')})</span> <button class="btn-danger" style="font-size:14px; padding:5px 15px;" onclick="deleteCustomElement('effect', ${idx}, '${ce.name}')">削除</button>`; effectUl.appendChild(li);
        });
    }
    if (!hasEffect) effectUl.innerHTML = '<li style="color:#999; text-align:center;">作った演出はありません</li>';
}
export function deleteCustomElement(type, idx, name) {
    showCustomConfirm(`本当に「${name}」を削除しますか？\n（※削除後、設定を反映するためにページが再読み込みされます）`, () => {
        const glob = users['__GLOBAL_SETTINGS__'];
        if (type === 'theme') glob.globalMistakes.customThemes.splice(idx, 1); else if (type === 'effect') glob.globalMistakes.customEffects.splice(idx, 1);
        saveUsers(true); showCustomAlert('削除しました。画面を再読み込みします。'); setTimeout(() => location.reload(), 1500);
    });
}