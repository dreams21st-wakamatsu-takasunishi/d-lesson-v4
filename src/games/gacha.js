import { users, currentUser, saveUsers, hasLessonRole, REQUIRE_SUPABASE_AUTH } from '../api/user.js'
import { GACHA_ITEMS } from '../data/gacha-items.js'
import { THEMES, EFFECTS } from '../data/constants.js'
import { SoundManager } from '../utils/sound.js'
import { showCustomAlert, showCustomConfirm } from '../ui/modal.js'
import { showPasswordModal } from '../ui/admin.js'
import { createConfetti, renderRecords, showCapsuleAnimation, showRewardOverlay } from '../main.js'
import { hasLegacyAdminPass, verifyLegacyAdminPass } from '../utils/security.js'

export function drawGacha(times = 1, isRareGuaranteed = false) {
    const u = users[currentUser]; const COST = isRareGuaranteed ? 500 : 100 * times;
    
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
            
            u.coins += totalCoinsWon + refundCoins; saveUsers(false); renderRecords(); 
            
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
    const consumeTicket = () => {
        u.tickets.splice(idx, 1);
        if (!u.ticketHistory) u.ticketHistory =[];
        const now = new Date();
        const dateStr = `${now.getFullYear()}/${now.getMonth()+1}/${now.getDate()} ${now.getHours()}:${now.getMinutes().toString().padStart(2,'0')}`;
        u.ticketHistory.push({ ticketName: t.name, date: dateStr, timestamp: now.getTime() });

        saveUsers(false);
        SoundManager.playClear();
        showCustomAlert(`✅ 交換しました！\n\n${t.name} を渡してあげてください。`); // ★修正
        renderRecords();
    };

    if (hasLessonRole('teacher', 'admin')) {
        consumeTicket();
        return;
    }

    if (REQUIRE_SUPABASE_AUTH && !hasLegacyAdminPass()) {
        showCustomAlert('先生または管理者アカウントでログインして確認してください。');
        return;
    }

    showPasswordModal(`【先生確認】\n「${t.name}」を使います。\nパスワードを入力:`, (pass) => {
        if (verifyLegacyAdminPass(pass)) { 
            consumeTicket();
        } else { 
            if (pass !== null && pass !== '') showCustomAlert('パスワードがちがいます'); // ★修正
        }
    });
}

export function changeTheme(themeId) { applyTheme(themeId); if (users[currentUser]) { users[currentUser].theme = themeId; saveUsers(false); } if (typeof window.renderRecords === 'function') {
    window.renderRecords();
} }

export function changeEffect(effId) { users[currentUser].activeEffect = effId; saveUsers(false); if (typeof window.renderRecords === 'function') {
    window.renderRecords();
} createConfetti(); }

function applyTheme(themeId) {
    document.body.className = '';
    let styleTag = document.getElementById('custom-theme-style');
    if (!styleTag) { styleTag = document.createElement('style'); styleTag.id = 'custom-theme-style'; document.head.appendChild(styleTag); }
    styleTag.innerHTML = ''; 
    
    if (themeId !== 'default') {
        const t = THEMES.find(th => th.id === themeId);
        if (t) {
            styleTag.innerHTML = `
                body, #game-container, #play-area, 
                .admin-section, #records-container, 
                #instruction, #header-right, .text-hud, #mg-hud,
                #ref-text-box, #type-text-box, .gacha-section { 
                    background-color: ${t.bg} !important; 
                    color: ${t.text} !important;
                    border-color: ${t.text} !important;
                }
                .screen h1, .screen h2, .screen h3, .screen p { 
                    color: ${t.text} !important; 
                    border-bottom-color: ${t.text} !important; 
                }
                button, .btn-primary, .btn-secondary, .btn-danger, .btn-gacha, .btn-retry, .category-btn { 
                    background-color: ${t.btnBg} !important; 
                    color: ${t.btnText} !important; 
                }
                button span, .btn-primary span, .btn-secondary span, .btn-danger span, .btn-gacha span, .btn-retry span, .category-btn span {
                    color: ${t.btnText} !important;
                }
                .stage-btn, .exam-btn { 
                    background-color: transparent !important; 
                    color: ${t.text} !important; 
                    border-color: ${t.text} !important;
                    opacity: 0.5 !important;
                }
                .stage-btn span, .exam-btn span { color: ${t.text} !important; }
                .stage-btn.unlocked, .exam-btn.unlocked { 
                    background-color: ${t.btnBg} !important; 
                    color: ${t.btnText} !important; 
                    border-color: ${t.btnText} !important;
                    opacity: 1 !important;
                }
                .stage-btn.unlocked span, .exam-btn.unlocked span { color: ${t.btnText} !important; }
                .stage-btn.cleared, .exam-btn.cleared { opacity: 0.7 !important; }
                
                .reward-badge, .reward-badge-text, 
                button span.reward-badge, button span.reward-badge-text {
                    background-color: #FF9800 !important;
                    color: #ffffff !important;
                    border: 2px solid #ffffff !important;
                    text-shadow: 1px 1px 2px rgba(0,0,0,0.8) !important;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.3) !important;
                }

                .badge-item { background-color: transparent !important; border-color: ${t.text} !important; }
                .badge-item span, .badge-item div { color: ${t.text} !important; }
                .badge-item.earned { background-color: ${t.btnBg} !important; border-color: ${t.btnText} !important; }
                .badge-item.earned span, .badge-item.earned div { color: ${t.btnText} !important; }
            `;
        }
    }
}

