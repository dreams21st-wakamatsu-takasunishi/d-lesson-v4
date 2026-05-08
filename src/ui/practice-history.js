import {
    getPracticeLogs,
    formatPracticeActivity
} from '../api/user.js';

function appendPracticeMetric(container, label, value, color) {
    const box = document.createElement('div');
    box.style.cssText = `flex:1; min-width:160px; background:#fff; border:2px solid ${color}; border-radius:8px; padding:12px; text-align:center; box-sizing:border-box;`;

    const labelEl = document.createElement('div');
    labelEl.textContent = label;
    labelEl.style.cssText = 'font-size:13px; color:#546e7a; font-weight:bold; margin-bottom:6px;';
    box.appendChild(labelEl);

    const valueEl = document.createElement('div');
    valueEl.textContent = value;
    valueEl.style.cssText = `font-size:26px; color:${color}; font-weight:bold;`;
    box.appendChild(valueEl);

    container.appendChild(box);
}

export function renderPracticeHistorySection(container, userId) {
    container.innerHTML = '';
    const logs = getPracticeLogs(userId);
    const todayKey = new Date().toLocaleDateString('ja-JP');
    const todayCount = logs.filter(log => {
        const at = Date.parse(log.at);
        return at && new Date(at).toLocaleDateString('ja-JP') === todayKey;
    }).length;
    const totalCoins = logs.reduce((sum, log) => sum + (Number(log.coins) || 0), 0);

    const summary = document.createElement('div');
    summary.style.cssText = 'display:flex; gap:12px; flex-wrap:wrap; margin-bottom:16px;';
    appendPracticeMetric(summary, '今日の取り組み', `${todayCount}回`, '#2196F3');
    appendPracticeMetric(summary, '記録された回数', `${logs.length}回`, '#4CAF50');
    appendPracticeMetric(summary, '記録内の獲得コイン', `${totalCoins}コイン`, '#FF9800');
    container.appendChild(summary);

    const latestInfo = formatPracticeActivity(logs[0]);
    const latestBox = document.createElement('div');
    latestBox.style.cssText = 'background:#e3f2fd; border:2px solid #90caf9; border-radius:8px; padding:14px; margin-bottom:16px; text-align:left;';
    latestBox.innerHTML = '<div style="font-weight:bold; color:#0d47a1; margin-bottom:6px;">前回の練習</div>';
    const latestTitle = document.createElement('div');
    latestTitle.textContent = logs[0] ? `${latestInfo.title}${latestInfo.when ? ` (${latestInfo.when})` : ''}` : latestInfo.title;
    latestTitle.style.cssText = 'font-size:20px; font-weight:bold; color:#263238;';
    latestBox.appendChild(latestTitle);
    const latestDetail = document.createElement('div');
    latestDetail.textContent = latestInfo.detail;
    latestDetail.style.cssText = 'font-size:14px; color:#455a64; margin-top:4px;';
    latestBox.appendChild(latestDetail);
    container.appendChild(latestBox);

    const listTitle = document.createElement('h3');
    listTitle.textContent = '取り組み履歴';
    listTitle.style.cssText = 'margin:0 0 10px; color:#37474f;';
    container.appendChild(listTitle);

    const list = document.createElement('div');
    list.style.cssText = 'display:flex; flex-direction:column; gap:8px; max-height:430px; overflow:auto; padding-right:6px;';
    if (logs.length === 0) {
        const empty = document.createElement('div');
        empty.textContent = 'まだ練習履歴がありません。練習を終えるとここに記録されます。';
        empty.style.cssText = 'background:#fff; border:1px dashed #b0bec5; border-radius:8px; padding:18px; color:#607d8b; text-align:center;';
        list.appendChild(empty);
    } else {
        logs.slice(0, 30).forEach(log => {
            const info = formatPracticeActivity(log);
            const row = document.createElement('div');
            row.style.cssText = 'display:grid; grid-template-columns:140px 1fr auto; gap:12px; align-items:center; background:#fff; border:1px solid #d7dee8; border-radius:8px; padding:10px 12px; text-align:left;';

            const when = document.createElement('div');
            when.textContent = info.when || '-';
            when.style.cssText = 'font-size:13px; color:#607d8b; font-weight:bold;';
            row.appendChild(when);

            const body = document.createElement('div');
            const title = document.createElement('div');
            title.textContent = info.title;
            title.style.cssText = 'font-size:16px; color:#263238; font-weight:bold;';
            const detail = document.createElement('div');
            detail.textContent = info.detail;
            detail.style.cssText = 'font-size:13px; color:#546e7a; margin-top:3px;';
            body.appendChild(title);
            body.appendChild(detail);
            row.appendChild(body);

            const coins = document.createElement('div');
            coins.textContent = info.coinsText || '';
            coins.style.cssText = 'font-size:14px; color:#f57c00; font-weight:bold; white-space:nowrap;';
            row.appendChild(coins);
            list.appendChild(row);
        });
    }
    container.appendChild(list);
}
