import {
    users,
    saveUsers,
    getUserDisplayName,
    isSystemUserId
} from '../api/user.js';
import { STAGE_ORDER, VISION_STAGES } from '../data/constants.js';
import { calculateGrade, sortGrades } from '../utils/helpers.js';

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
            if(!users[n] || users[n].isMaster || isSystemUserId(n)) return;
            
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
            
            list.push({ id: n, name: getUserDisplayName(n), user: users[n] });
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
