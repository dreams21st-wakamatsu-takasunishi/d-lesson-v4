import {
    VISION_STAGES,
    EXAMS,
    STAGE_ORDER,
    KB_LAYOUT,
    THEMES,
    EFFECTS
} from '../data/constants.js';
import {
    users,
    currentUser,
    canWriteCurrentUserRow,
    isSystemUserId
} from '../api/user.js';
import { renderCertificateSection } from './certificates.js';
import { renderPracticeHistorySection } from './practice-history.js';
import { getValidMistakeEntries, normalizeMistakeCount } from '../utils/weak-mistakes.js';
import { buildVisionRadarData, renderVisionRadarChart } from './admin-report-utils.js';

function countCurrentVisionClears(user) {
    const validIds = new Set(VISION_STAGES.flatMap(stage => [
        stage.id,
        `${stage.id}_easy`,
        `${stage.id}_hard`
    ]));
    return new Set((Array.isArray(user?.visionCleared) ? user.visionCleared : [])
        .map(id => String(id))
        .filter(id => validIds.has(id)))
        .size;
}

export function showRecordSection(secId) {
    document.getElementById('records-main-menu').style.display = 'none';
    document.getElementById('records-panel-content').style.display = 'flex';
    document.getElementById('records-bottom-back-btn').style.display = 'none';
    document.querySelectorAll('.record-section-content').forEach(el => el.style.display = 'none');
    document.getElementById(secId).style.display = 'block';
}

export function backToRecordMenu() {
    document.getElementById('records-main-menu').style.display = 'flex';
    document.getElementById('records-panel-content').style.display = 'none';
    document.getElementById('records-bottom-back-btn').style.display = 'block';
    if (users[currentUser]) document.getElementById('global-coin-display').innerText = `💰 ${users[currentUser].coins || 0}`;
}

export function renderRecords() {
    backToRecordMenu();
    const u = users[currentUser];
    if (!u) return;
    const canSaveResult = canWriteCurrentUserRow();

    const pCont = document.getElementById('rec-practice');
    if (pCont) renderPracticeHistorySection(pCont, currentUser);

    const certificateCont = document.getElementById('rec-certificate');
    if (certificateCont) renderCertificateSection(certificateCont, currentUser);

    const gCont = document.getElementById('rec-gacha');
    gCont.innerHTML = `<div class="gacha-section">
        <div class="coin-display">💰 コイン: ${u.coins || 0} 枚</div>
        ${canSaveResult ? '<p style="margin: 5px 0 15px 0;">ガチャをひいて アイテムをゲットしよう！</p>' : '<p style="margin: 5px 0 15px 0; color:#00695c; font-weight:bold;">先生確認モード：ガチャ・チケット・着せ替えは保存されません</p>'}
        ${canSaveResult ? `
            <div style="display:flex; justify-content:center; gap:15px; flex-wrap:wrap;">
                <button class="btn-gacha" style="padding: 10px 20px; font-size: 20px;" onclick="drawGacha(1)">1回 (100)</button>
                <button class="btn-gacha" style="padding: 10px 20px; font-size: 20px; background:linear-gradient(135deg, #4CAF50, #8BC34A);" onclick="drawGacha(10)">10回 (1000)</button>
                <button class="btn-gacha" style="padding: 10px 20px; font-size: 20px; background:linear-gradient(135deg, #E91E63, #9C27B0);" onclick="drawGacha(1, true)">🔮 レア確定 (500)</button>
            </div>
        ` : `
            <div style="padding:12px; border:2px solid #80cbc4; border-radius:8px; background:#e0f2f1; color:#004d40; font-weight:bold;">確認専用のため、保存を伴う操作は無効です。</div>
        `}
    </div>`;
    if (u.tickets && u.tickets.length > 0) {
        gCont.innerHTML += `<h3 style="color:#FF5722;">🎟️ もっている ひきかえけん</h3>`;
        gCont.innerHTML += `<p class="ticket-use-note">いいねポイントを使うときは、先生に画面を見せてからボタンを押してください。</p>`;
        u.tickets.forEach((t, idx) => {
            const ticketButton = canSaveResult
                ? `<button class="ticket-btn" onclick="useTicket(${idx})">この場でつかう</button>`
                : '<button class="ticket-btn" disabled style="opacity:0.5; cursor:not-allowed;">確認専用</button>';
            gCont.innerHTML += `<div class="ticket-card"><div><div class="ticket-name">${t.name}</div><div style="font-size:12px; color:#555;">ゲットした日: ${t.date}</div></div>${ticketButton}</div>`;
        });
    } else {
        gCont.innerHTML += `<div class="ticket-empty-card">いま使えるいいねポイントはありません。</div>`;
    }

    const tCont = document.getElementById('rec-theme');
    tCont.innerHTML = '';
    let tHtml = `<h3>🎨 きせかえテーマ</h3><div class="theme-grid">`;
    THEMES.forEach(t => {
        let checkId = t.isCustom ? t.id : 'theme_' + t.id;
        let isUnlocked = (u.items && (u.items.includes(checkId) || u.items.includes(t.id))) || u.isMaster || (t.id === 'default');
        let isActive = (u.theme === t.id);
        tHtml += `<button class="theme-btn ${!isUnlocked ? 'locked' : ''} ${isActive ? 'active-theme' : ''}" ${isUnlocked ? `onclick="changeTheme('${t.id}')"` : `onclick="showCustomAlert('ガチャでゲットするとつかえるよ！')"`}>${t.icon} ${t.name}</button>`;
    });
    tHtml += `</div><h3 style="margin-top:20px;">🎉 クリアえんしゅつ</h3><div class="theme-grid">`;
    EFFECTS.forEach(e => {
        let isUnlocked = (e.id === 'default') || (u.items && u.items.includes(e.id)) || u.isMaster;
        let isActive = (u.activeEffect === e.id);
        tHtml += `<button class="theme-btn ${!isUnlocked ? 'locked' : ''} ${isActive ? 'active-theme' : ''}" ${isUnlocked ? `onclick="changeEffect('${e.id}')"` : `onclick="showCustomAlert('ガチャでゲットするとつかえるよ！')"`}>${e.icon} ${e.name}</button>`;
    });
    tCont.innerHTML = tHtml + `</div>`;

    const bCont = document.getElementById('rec-badge');
    bCont.innerHTML = '';
    const badgeGrid = document.createElement('div');
    badgeGrid.className = 'badge-grid';
    const mLv = u.mouseLevel || 0;
    badgeGrid.innerHTML += `<div class="badge-item ${mLv >= 7 ? 'earned' : ''}"><div class="badge-icon">👑</div><div class="badge-name">マウス<br>めんきょかいでん</div></div>`;
    const kSeq = u.keyboardSequence || 0;
    const records = u.examRecords || {};
    EXAMS.forEach(ex => {
        const isClr = (STAGE_ORDER.indexOf(ex.id) !== -1 && kSeq > STAGE_ORDER.indexOf(ex.id));
        let icon = '🏆';
        if ([1999, 2999, 3999, 4999].includes(ex.id)) icon = '👑';
        let medal = '';
        if (isClr && records[ex.id]) {
            if (records[ex.id] <= ex.gold) medal = '<div class="badge-medal">🥇</div>';
            else if (records[ex.id] <= ex.silver) medal = '<div class="badge-medal">🥈</div>';
            else medal = '<div class="badge-medal">🥉</div>';
        }
        badgeGrid.innerHTML += `<div class="badge-item ${isClr ? 'earned' : ''}">${medal}<div class="badge-icon">${icon}</div><div class="badge-name">${ex.title}</div></div>`;
    });
    bCont.appendChild(badgeGrid);

    const timeCont = document.getElementById('rec-time');
    timeCont.innerHTML = '';
    let kbTimes = `<h4 style="color:#555; margin-bottom:5px; border-bottom:1px solid #ccc; padding-bottom:5px;">⌨️ キーボード試験</h4><div style="display:flex; flex-wrap:wrap; gap:10px; margin-bottom:15px;">`;
    let hasKbRecord = false;
    EXAMS.forEach(ex => {
        if (records[ex.id]) {
            hasKbRecord = true;
            let medal = '🥉';
            if (records[ex.id] <= ex.gold) medal = '🥇';
            else if (records[ex.id] <= ex.silver) medal = '🥈';
            kbTimes += `<div style="background:#f5f5f5; border:2px solid #ccc; padding:5px 15px; border-radius:8px; font-weight:bold; color:#333;">${ex.title}: <span style="color:#e65100;">${records[ex.id].toFixed(1)}秒</span> ${medal}</div>`;
        }
    });
    if (!hasKbRecord) kbTimes += `<span style="color:#999; font-size:14px; margin-left:10px;">まだ記録がありません</span>`;

    let viTimes = `<h4 style="color:#555; margin-bottom:5px; border-bottom:1px solid #ccc; padding-bottom:5px;">👁️ ビジョントレーニング</h4><div style="display:flex; flex-wrap:wrap; gap:10px;">`;
    let hasViRecord = false;
    VISION_STAGES.forEach(st => {
        if (records[st.id + '_easy']) {
            hasViRecord = true;
            viTimes += `<div style="background:#e8f5e9; border:2px solid #a5d6a7; padding:5px 15px; border-radius:8px; font-weight:bold; color:#2e7d32;">${st.title}(やさしい): <span style="color:#e65100;">${records[st.id + '_easy'].toFixed(1)}秒</span></div>`;
        }
        if (records[st.id]) {
            hasViRecord = true;
            viTimes += `<div style="background:#e3f2fd; border:2px solid #90caf9; padding:5px 15px; border-radius:8px; font-weight:bold; color:#0277bd;">${st.title}: <span style="color:#e65100;">${records[st.id].toFixed(1)}秒</span></div>`;
        }
        if (records[st.id + '_hard']) {
            hasViRecord = true;
            viTimes += `<div style="background:#fff3e0; border:2px solid #ffcc80; padding:5px 15px; border-radius:8px; font-weight:bold; color:#d84315;">${st.title}(🔥): <span style="color:#e65100;">${records[st.id + '_hard'].toFixed(1)}秒</span></div>`;
        }
    });
    if (!hasViRecord) viTimes += `<span style="color:#999; font-size:14px; margin-left:10px;">まだ記録がありません</span>`;
    timeCont.innerHTML = kbTimes + `</div>` + viTimes + `</div>`;

    const graphCont = document.getElementById('rec-graph');
    graphCont.innerHTML = '';
    const gWrap = document.createElement('div');
    gWrap.className = 'record-graph-grid';

    const vPct = Math.min(100, Math.floor((countCurrentVisionClears(u) / (VISION_STAGES.length * 3)) * 100));
    gWrap.innerHTML += `<div class="record-graph-card">
        <h4 style="margin-top:0; color:#555; border-bottom:2px solid #eee; padding-bottom:10px;">🎮 全体の達成度</h4>
        <div style="margin-bottom:15px;"><div style="display:flex; justify-content:space-between; margin-bottom:5px;"><span>🖱️ マウス</span><span>${Math.floor((mLv / 7) * 100)}%</span></div><div style="width:100%; height:20px; background:#eee; border-radius:10px; overflow:hidden;"><div style="width:${Math.floor((mLv / 7) * 100)}%; height:100%; background:#2196F3;"></div></div></div>
        <div style="margin-bottom:15px;"><div style="display:flex; justify-content:space-between; margin-bottom:5px;"><span>⌨️ キーボード</span><span>${Math.floor((kSeq / STAGE_ORDER.length) * 100)}%</span></div><div style="width:100%; height:20px; background:#eee; border-radius:10px; overflow:hidden;"><div style="width:${Math.floor((kSeq / STAGE_ORDER.length) * 100)}%; height:100%; background:#FF9800;"></div></div></div>
        <div style="margin-bottom:15px;"><div style="display:flex; justify-content:space-between; margin-bottom:5px;"><span>👁️ ビジョン</span><span>${vPct}%</span></div><div style="width:100%; height:20px; background:#eee; border-radius:10px; overflow:hidden;"><div style="width:${vPct}%; height:100%; background:#9C27B0;"></div></div></div>
    </div>`;

    const radarDiv = document.createElement('div');
    const radarData = buildVisionRadarData(u, users, VISION_STAGES, isSystemUserId);
    radarDiv.innerHTML = renderVisionRadarChart(radarData, { title: '👁️ ビジョン平均との差' });
    gWrap.appendChild(radarDiv.firstElementChild);

    const weakDiv = document.createElement('div');
    weakDiv.className = 'record-graph-card';
    weakDiv.innerHTML = `<h4 style="margin-top:0; color:#555; border-bottom:2px solid #eee; padding-bottom:10px;">⚠️ あなたの苦手なキー</h4>`;
    let mistakes = u.globalMistakes || {};
    let sorted = getValidMistakeEntries(mistakes);

    if (sorted.length === 0) {
        weakDiv.innerHTML += `<div style="color:#4CAF50; font-weight:bold; margin-top:20px; text-align:center; font-size:20px;">✨ すばらしい！<br>弱点はありません。</div>`;
    } else {
        let maxMiss = sorted[0].count;
        let heatmapHtml = `<div class="heatmap-kb">`;
        KB_LAYOUT.forEach(row => {
            heatmapHtml += `<div class="heatmap-row">`;
            row.forEach(k => {
                let disp = k === 'SPACE' ? '空白' : k;
                let count = normalizeMistakeCount(mistakes[k]);
                let pct = maxMiss > 0 ? (count / maxMiss) * 100 : 0;
                let cls = k === 'SPACE' ? 'heatmap-key space' : 'heatmap-key';
                heatmapHtml += `<div class="${cls}" title="${disp}: ${count}回ミス"><div class="heatmap-bg" style="height:${pct}%;"></div><span class="heatmap-text">${disp}</span></div>`;
            });
            heatmapHtml += `</div>`;
        });
        heatmapHtml += `</div><div style="text-align:center; font-size:12px; color:#999; margin-top:5px;">※ミスが多いキーほど赤くなります</div>`;
        weakDiv.innerHTML += heatmapHtml;
    }
    gWrap.appendChild(weakDiv);
    graphCont.appendChild(gWrap);

}
