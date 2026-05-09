import { users, saveUsers, getUserDisplayName } from '../api/user.js';
import { STAGE_ORDER, THEMES, EFFECTS } from '../data/constants.js';
import { getStageName } from '../utils/stages.js';
import { showCustomAlert, showCustomConfirm } from './modal.js';
import { recordAdminAudit } from './admin-audit.js';
import {
    buildForceProgressPatch,
    buildProgressEditPatch,
    buildResetProgressPatch
} from './admin-progress-editor-utils.js';

let editTargetUser = null;

function runAfterChange(afterChange) {
    if (typeof afterChange === 'function') afterChange();
}

export function resetUserProgress(userId, afterChange) {
    if (!userId) return;

    showCustomConfirm('リセットしますか？', () => {
        recordAdminAudit('進捗リセット', {
            user: getUserDisplayName(userId),
            userDataId: userId
        });
        Object.assign(users[userId], buildResetProgressPatch());
        saveUsers(true);
        runAfterChange(afterChange);
    });
}

export function forceUserProgress(userId, afterChange) {
    if (!userId) return;

    showCustomConfirm('全開放しますか？', () => {
        recordAdminAudit('進捗全開放', {
            user: getUserDisplayName(userId),
            userDataId: userId
        });
        Object.assign(users[userId], buildForceProgressPatch(STAGE_ORDER.length));
        saveUsers(true);
        runAfterChange(afterChange);
    });
}

export function openEditProgress(userId) {
    if (!userId) {
        showCustomAlert('ユーザーを選択してください');
        return;
    }

    editTargetUser = userId;
    document.getElementById('edit-modal-title').innerText = `${getUserDisplayName(userId)} さんの進捗編集`;
    document.getElementById('edit-mouse-level').value = users[userId].mouseLevel || 0;

    const kbSelect = document.getElementById('edit-keyboard-seq');
    kbSelect.innerHTML = '<option value="0">0: 初期状態</option>';
    STAGE_ORDER.forEach((stageId, idx) => {
        kbSelect.innerHTML += `<option value="${idx + 1}">${idx + 1}: ${getStageName(stageId)} までクリア済</option>`;
    });
    kbSelect.value = users[userId].keyboardSequence || 0;

    const itemsContainer = document.getElementById('edit-items-container');
    itemsContainer.innerHTML = '';
    const userItems = users[userId].items || [];
    const allCollectibles = [];

    THEMES.forEach(theme => {
        if (theme.id !== 'default') {
            allCollectibles.push({
                id: theme.isCustom ? theme.id : `theme_${theme.id}`,
                name: `🎨 ${theme.name}`
            });
        }
    });
    EFFECTS.forEach(effect => {
        if (effect.id !== 'default') {
            allCollectibles.push({
                id: effect.id,
                name: `🎉 ${effect.name}`
            });
        }
    });

    if (allCollectibles.length === 0) {
        itemsContainer.innerHTML = '<span style="color:#999;">ガチャアイテムがまだシステムにありません</span>';
    } else {
        allCollectibles.forEach(item => {
            const isOwned = userItems.includes(item.id)
                || (item.id.startsWith('theme_') && userItems.includes(item.id.replace('theme_', '')));
            const label = document.createElement('label');
            label.style.cssText = 'display:inline-block; background:#fff; border:1px solid #ccc; padding:5px 10px; border-radius:20px; cursor:pointer; user-select:none; font-size:14px;';
            label.innerHTML = `<input type="checkbox" value="${item.id}" class="edit-item-cb" ${isOwned ? 'checked' : ''} style="margin-right:5px; transform:scale(1.2); cursor:pointer;">${item.name}`;
            itemsContainer.appendChild(label);
        });
    }

    document.getElementById('admin-edit-modal').style.display = 'flex';
}

export function closeEditProgress() {
    document.getElementById('admin-edit-modal').style.display = 'none';
    editTargetUser = null;
}

export function saveEditProgress(afterChange) {
    if (!editTargetUser) return;

    const newItems = [];
    document.querySelectorAll('.edit-item-cb').forEach(checkbox => {
        if (checkbox.checked) newItems.push(checkbox.value);
    });
    Object.assign(users[editTargetUser], buildProgressEditPatch({
        mouseLevel: document.getElementById('edit-mouse-level').value,
        keyboardSequence: document.getElementById('edit-keyboard-seq').value,
        items: newItems
    }, users[editTargetUser], THEMES));

    recordAdminAudit('進捗編集', {
        user: getUserDisplayName(editTargetUser),
        userDataId: editTargetUser,
        mouseLevel: users[editTargetUser].mouseLevel,
        keyboardSequence: users[editTargetUser].keyboardSequence
    });
    saveUsers(true);
    runAfterChange(afterChange);
    closeEditProgress();
    showCustomAlert('進捗とアイテム情報を保存しました。');
}
