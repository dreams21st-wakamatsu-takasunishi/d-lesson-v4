import {
    users,
    saveUsers,
    GLOBAL_SETTINGS_ID,
    getUserDisplayName,
    isSystemUserId
} from '../api/user.js';
import { showCustomAlert } from './modal.js';
import { recordAdminAudit } from './admin-audit.js';

export function renderTicketAdmin() {
    // ★修正: let に変更し、データが無ければ新しく作る処理を追加
    let glob = users[GLOBAL_SETTINGS_ID];
    if (!glob) {
        glob = { isMaster: true };
        users[GLOBAL_SETTINGS_ID] = glob;
    }
    
    if(!glob.ticketConfig) glob.ticketConfig = { normal: { name: '👍 いいねポイント 5こ', icon: '🎟️' }, newRecord: { name: '👍 いいねポイント 1こ', icon: '🎟️' } };
    document.getElementById('admin-ticket-normal').value = glob.ticketConfig.normal.name;
    document.getElementById('admin-ticket-newrecord').value = glob.ticketConfig.newRecord.name;

    const histList = document.getElementById('admin-ticket-history');
    if(!histList) return; histList.innerHTML = '';
    let allHistory =[];
    Object.keys(users).forEach(n => {
        if (!users[n].isMaster && !isSystemUserId(n) && users[n].ticketHistory) {
            users[n].ticketHistory.forEach(h => { allHistory.push({ user: getUserDisplayName(n), ticketName: h.ticketName, date: h.date, timestamp: h.timestamp }); });
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
    if (!users[GLOBAL_SETTINGS_ID]) users[GLOBAL_SETTINGS_ID] = { isMaster:true };
    if (!users[GLOBAL_SETTINGS_ID].ticketConfig) users[GLOBAL_SETTINGS_ID].ticketConfig = { normal:{icon:'🎟️'}, newRecord:{icon:'🎟️'} };
    users[GLOBAL_SETTINGS_ID].ticketConfig.normal.name = nName; users[GLOBAL_SETTINGS_ID].ticketConfig.newRecord.name = rName;
    recordAdminAudit('チケット設定変更', { normal: nName, newRecord: rName });
    saveUsers(true); showCustomAlert('チケット設定を保存しました！');
}
