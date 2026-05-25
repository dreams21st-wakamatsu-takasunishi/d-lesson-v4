import { users, currentUser, saveUsers, canWriteCurrentUserRow, recordPracticeActivity } from '../api/user.js'
import { GACHA_ITEMS } from '../data/gacha-items.js'
import { SoundManager } from '../utils/sound.js'
import { showCustomAlert, showCustomConfirm } from '../ui/modal.js'
import { createConfetti, showCapsuleAnimation, showRewardOverlay } from '../ui/reward.js'
import { applyTheme } from '../ui/home.js'

let renderRecordsHandler = () => {
    if (typeof window.renderRecords === 'function') window.renderRecords();
};

export function setGachaUiHandlers(handlers = {}) {
    if (typeof handlers.renderRecords === 'function') {
        renderRecordsHandler = handlers.renderRecords;
    }
}

function refreshRecords() {
    renderRecordsHandler();
}

function isThemeEffectPanelOpen() {
    return document.getElementById('rec-theme')?.style.display === 'block';
}

function keepThemeEffectPanelOpen(wasOpen) {
    if (wasOpen && typeof window.showRecordSection === 'function') {
        window.showRecordSection('rec-theme');
    }
}

export function drawGacha(times = 1, isRareGuaranteed = false) {
    const u = users[currentUser]; const COST = isRareGuaranteed ? 500 : 100 * times;
    if (!canWriteCurrentUserRow()) return showCustomAlert('先生確認モードでは、ガチャ結果は保存されません。生徒本人または管理者で操作してください。');
    
    if (u.coins < COST) return showCustomAlert(`コインがたりないよ！\nあと ${COST - u.coins} コイン ひつようです。`);
    
    showCustomConfirm(`${COST}コインをつかって ガチャをひきますか？\n(のこり: ${u.coins}枚)`, () => {
        showCapsuleAnimation(isRareGuaranteed, () => {
            u.coins -= COST; let newItems =[], refundCoins = 0, totalCoinsWon = 0;
            
            if (isRareGuaranteed) {
                let unowned = GACHA_ITEMS.filter(item => {
                    if(item.type === 'coin') return false;
                    let checkId = item.id; if (item.type === 'theme' && !checkId.startsWith('ct_')) checkId = checkId.replace('theme_', '');
                    return !u.items.includes(checkId) && u.theme !== checkId;
                });
                if (unowned.length === 0) { refundCoins = 500; } 
                else {
                    let result = unowned[Math.floor(Math.random() * unowned.length)];
                    let checkId = result.id; if (result.type === 'theme' && !checkId.startsWith('ct_')) checkId = checkId.replace('theme_', '');
                    u.items.push(checkId); newItems.push(result.name);
                }
            } else {
                let totalRate = 0; for (let item of GACHA_ITEMS) totalRate += item.rate;
                for (let i = 0; i < times; i++) {
                    const r = Math.random() * totalRate; let currentRate = 0, result = null;
                    for (let item of GACHA_ITEMS) { currentRate += item.rate; if (r < currentRate) { result = item; break; } }
                    if (!result) result = GACHA_ITEMS[GACHA_ITEMS.length - 1];
                    if (result.type === 'coin') { totalCoinsWon += parseInt(result.id.split('_')[1]); } 
                    else {
                        let checkId = result.id; if (result.type === 'theme' && !checkId.startsWith('ct_')) checkId = checkId.replace('theme_', '');
                        if (u.items.includes(checkId) || u.theme === checkId || newItems.includes(result.name)) { refundCoins += 30; } 
                        else { u.items.push(checkId); newItems.push(result.name); }
                    }
                }
            }
            
            u.coins += totalCoinsWon + refundCoins;
            recordPracticeActivity({
                category: 'gacha',
                title: isRareGuaranteed ? 'ガチャ レア確定' : (times > 1 ? `ガチャ ${times}連` : 'ガチャ 1回'),
                detail: newItems.length ? `新アイテム: ${newItems.join('、')}` : (refundCoins > 0 ? 'かぶり' : 'コイン当せん'),
                amount: `消費 ${COST} / コイン当せん ${totalCoinsWon} / かぶり返却 ${refundCoins}`,
                coins: totalCoinsWon + refundCoins - COST
            });
            saveUsers(false); refreshRecords(); 
            
            let rewardTitle = times > 1 ? `✨ ${times}連ガチャ けっか ✨` : "✨ ガチャけっか ✨"; 
            if (isRareGuaranteed) rewardTitle = "✨ レア確定ガチャ けっか ✨";
            let rewardIcon = times > 1 ? "🎊" : "🎁"; let msg = "";
            
            if (newItems.length > 0) { msg += `【あたらしいアイテム！】\n${newItems.join('\n')}\n\n`; rewardTitle = "🎊 大当たり！！ 🎊"; }
            if (totalCoinsWon > 0) msg += `💰 コイン当せん: ${totalCoinsWon}枚\n`; if (refundCoins > 0) msg += `🔄 かぶりコイン: ${refundCoins}枚\n`;
            if (isRareGuaranteed && newItems.length === 0) { msg += "💡 もうぜんぶ持っていたよ！ 500コインお返しします。"; rewardIcon = "🔄"; }
            else if (times === 1 && newItems.length === 0 && totalCoinsWon === 0 && refundCoins > 0) { rewardTitle = "💡 もう持っていたよ！"; rewardIcon = "🔄"; } 
            else if (times === 1 && totalCoinsWon > 0 && newItems.length === 0) rewardIcon = "💰";
            
            const nameEl = document.getElementById('reward-name');
            if (times > 1) { nameEl.style.fontSize = '24px'; nameEl.style.maxHeight = '40vh'; nameEl.style.overflowY = 'auto'; nameEl.style.textAlign = 'left'; } else { nameEl.style.fontSize = '40px'; nameEl.style.maxHeight = 'none'; nameEl.style.overflowY = 'visible'; nameEl.style.textAlign = 'center'; }
            showRewardOverlay(rewardTitle, msg.trim(), rewardIcon, null);
        });
    });
}

export function useTicket(idx) {
    const u = users[currentUser], t = u.tickets[idx];
    if (!u || !t) {
        showCustomAlert('使えるいいねポイントが見つかりません。画面を開きなおしてください。');
        return;
    }
    if (!canWriteCurrentUserRow()) {
        showCustomAlert('先生確認モードでは、いいねポイント使用は保存されません。児童本人の画面で操作してください。');
        return;
    }

    const consumeTicket = () => {
        u.tickets.splice(idx, 1);
        if (!u.ticketHistory) u.ticketHistory =[];
        const now = new Date();
        const dateStr = `${now.getFullYear()}/${now.getMonth()+1}/${now.getDate()} ${now.getHours()}:${now.getMinutes().toString().padStart(2,'0')}`;
        u.ticketHistory.push({ ticketName: t.name, date: dateStr, timestamp: now.getTime() });

        saveUsers(false);
        SoundManager.playClear();
        showCustomAlert(`✅ つかいました！\n\n${t.name}\n\n先生からポイントやごほうびを受け取ってください。`);
        refreshRecords();
    };

    showCustomConfirm(
        `${t.name} をつかいますか？\n\n先生に見せてから「OK」を押してください。`,
        consumeTicket
    );
}

export function changeTheme(themeId) {
    const stayOnPanel = isThemeEffectPanelOpen();
    applyTheme(themeId);
    if (users[currentUser] && canWriteCurrentUserRow()) {
        users[currentUser].theme = themeId;
        saveUsers(false);
    }
    refreshRecords();
    keepThemeEffectPanelOpen(stayOnPanel);
}

export function changeEffect(effId) {
    const stayOnPanel = isThemeEffectPanelOpen();
    if (users[currentUser] && canWriteCurrentUserRow()) {
        users[currentUser].activeEffect = effId;
        window.__D_LESSON_ACTIVE_EFFECT__ = effId;
        saveUsers(false);
    }
    refreshRecords();
    keepThemeEffectPanelOpen(stayOnPanel);
    createConfetti();
}
