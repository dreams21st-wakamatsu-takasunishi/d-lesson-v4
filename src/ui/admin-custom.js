import {
    users,
    saveUsers,
    GLOBAL_SETTINGS_ID,
    isSystemUserId
} from '../api/user.js';
import { showCustomAlert, showCustomConfirm } from './modal.js';
import { recordAdminAudit } from './admin-audit.js';

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
    
    if (!users[GLOBAL_SETTINGS_ID]) users[GLOBAL_SETTINGS_ID] = { isMaster:true }; if (!users[GLOBAL_SETTINGS_ID].globalMistakes) users[GLOBAL_SETTINGS_ID].globalMistakes = {};
    if (!Array.isArray(users[GLOBAL_SETTINGS_ID].globalMistakes.customThemes)) users[GLOBAL_SETTINGS_ID].globalMistakes.customThemes =[];
    const newId = 'ct_' + Date.now(); 
    users[GLOBAL_SETTINGS_ID].globalMistakes.customThemes.push({ id: newId, name: name, bg: bg, text: text, btnBg: btnBg, btnText: btnText });
    
    if (isPresent) {
        Object.keys(users).forEach(n => {
            if (!isSystemUserId(n)) {
                if (!users[n].items) users[n].items =[];
                if (!users[n].items.includes(newId)) users[n].items.push(newId);
            }
        });
        showCustomAlert('「' + name + '」を全員にプレゼントしました！');
    } else {
        showCustomAlert('「' + name + '」をガチャのラインナップに追加しました！'); 
    }
    
    recordAdminAudit('カスタムテーマ追加', { name, present: isPresent ? 'yes' : 'no' });
    saveUsers(true);
    if (typeof window.loadCustomGlobalSettings === 'function') window.loadCustomGlobalSettings();
    closeThemeCreator();
    document.getElementById('ct-name').value = ''; document.getElementById('ct-present').checked = false;
}

export function openEffectCreator() { document.getElementById('admin-effect-modal').style.display='flex'; }
export function closeEffectCreator() { document.getElementById('admin-effect-modal').style.display='none'; }

export function saveCustomEffect() {
    const name = document.getElementById('ce-name').value.trim(); if(!name) return showCustomAlert('名前を入力してください');
    const emojis =[document.getElementById('ce-emo1').value.trim(), document.getElementById('ce-emo2').value.trim(), document.getElementById('ce-emo3').value.trim()].filter(e => e !== '');
    if(emojis.length === 0) return showCustomAlert('絵文字を1つ以上入力してください');
    const isPresent = document.getElementById('ce-present').checked; 
    
    if (!users[GLOBAL_SETTINGS_ID]) users[GLOBAL_SETTINGS_ID] = { isMaster:true }; if (!users[GLOBAL_SETTINGS_ID].globalMistakes) users[GLOBAL_SETTINGS_ID].globalMistakes = {};
    if (!Array.isArray(users[GLOBAL_SETTINGS_ID].globalMistakes.customEffects)) users[GLOBAL_SETTINGS_ID].globalMistakes.customEffects =[];
    const newId = 'ce_' + Date.now();
    users[GLOBAL_SETTINGS_ID].globalMistakes.customEffects.push({ id: newId, name: name, emojis: emojis });
    
    if (isPresent) {
        Object.keys(users).forEach(n => {
            if (!isSystemUserId(n)) {
                if (!users[n].items) users[n].items =[];
                if (!users[n].items.includes(newId)) users[n].items.push(newId);
            }
        });
        showCustomAlert('「' + name + '」を全員にプレゼントしました！');
    } else {
        showCustomAlert('「' + name + '」をガチャのラインナップに追加しました！'); 
    }
    
    recordAdminAudit('カスタム演出追加', { name, present: isPresent ? 'yes' : 'no' });
    saveUsers(true);
    if (typeof window.loadCustomGlobalSettings === 'function') window.loadCustomGlobalSettings();
    closeEffectCreator();
    document.getElementById('ce-name').value = ''; document.getElementById('ce-present').checked = false;
}

export function openCustomManager() { const modal = document.getElementById('admin-custom-manage-modal'); if (!modal) return; renderCustomManagerList(); modal.style.display = 'flex'; }
export function closeCustomManager() { document.getElementById('admin-custom-manage-modal').style.display = 'none'; }
export function renderCustomManagerList() {
    const glob = users[GLOBAL_SETTINGS_ID], themeUl = document.getElementById('manage-theme-list'), effectUl = document.getElementById('manage-effect-list');
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
    const glob = users[GLOBAL_SETTINGS_ID];
        if (type === 'theme') glob.globalMistakes.customThemes.splice(idx, 1); else if (type === 'effect') glob.globalMistakes.customEffects.splice(idx, 1);
        recordAdminAudit('カスタム要素削除', { type, name });
        saveUsers(true); showCustomAlert('削除しました。画面を再読み込みします。'); setTimeout(() => location.reload(), 1500);
    });
}
