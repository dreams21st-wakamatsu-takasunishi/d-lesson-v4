import { GLOBAL_SETTINGS_ID, saveUsers, users } from '../api/user.js';
import {
    DEFAULT_TYPING_RANKING_NICKNAME_BLOCK_WORDS,
    formatNicknameBlockWords,
    getCustomTypingRankingNicknameBlockWords,
    parseNicknameBlockWordsText
} from '../data/typing-ranking-settings.js';
import { showCustomAlert } from './modal.js';
import { recordAdminAudit } from './admin-audit.js';

function ensureGlobalSettings() {
    if (!users[GLOBAL_SETTINGS_ID]) users[GLOBAL_SETTINGS_ID] = { isMaster: true };
    users[GLOBAL_SETTINGS_ID].isMaster = true;
    return users[GLOBAL_SETTINGS_ID];
}

export function renderTypingRankingSettingsAdmin() {
    const textarea = document.getElementById('typing-ranking-ng-words');
    const status = document.getElementById('typing-ranking-ng-words-status');
    if (!textarea) return;

    const settings = ensureGlobalSettings();
    const customWords = getCustomTypingRankingNicknameBlockWords(settings);
    textarea.value = formatNicknameBlockWords(customWords);

    if (status) {
        status.innerText = `標準NGワード ${DEFAULT_TYPING_RANKING_NICKNAME_BLOCK_WORDS.length}件 + 追加 ${customWords.length}件`;
    }
}

export async function saveTypingRankingNicknameBlockWords() {
    const textarea = document.getElementById('typing-ranking-ng-words');
    if (!textarea) return;

    const settings = ensureGlobalSettings();
    const beforeWords = getCustomTypingRankingNicknameBlockWords(settings);
    const nextWords = parseNicknameBlockWordsText(textarea.value)
        .filter(word => word.length <= 20)
        .slice(0, 80);

    settings.typingRankingNicknameBlockWords = nextWords;

    recordAdminAudit('タイピングランキングNGワード設定変更', {
        before: beforeWords.length,
        after: nextWords.length
    });

    const saved = await saveUsers(true);
    renderTypingRankingSettingsAdmin();

    if (!saved) {
        showCustomAlert('設定を保存しましたが、クラウド同期が完了していません。通信状態を確認してください。');
        return;
    }

    showCustomAlert('タイピングランキングの追加NGワードを保存しました。');
}
