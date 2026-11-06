import { users, currentUser } from '../api/user.js';
import { ONE_HAND_STAGES, isOneHandChallengeUnlocked } from '../data/one-hand.js';
import { startGame } from '../games/core.js';
import { showScreen, setScreenRefreshHandlers } from './screen.js';
import { showCustomAlert } from './modal.js';

let selectedHand = 'left';
export function goToTextCategory() { showScreen('screen-text-category'); }
export function openOneHandMenu(hand = selectedHand) {
    if (!currentUser || !users[currentUser]) {
        showCustomAlert('ユーザーを選択してください。');
        showScreen('screen-title');
        return;
    }
    selectedHand = hand === 'right' ? 'right' : 'left';
    showScreen('screen-one-hand');
}
export function renderOneHandMenu() {
    const root = document.getElementById('one-hand-stages');
    root.replaceChildren();
    document.getElementById('one-hand-title').textContent = selectedHand === 'left' ? '左手タイピング' : '右手タイピング';
    const user = users[currentUser] || {};
    for (const stage of ONE_HAND_STAGES.filter(stage => stage.hand === selectedHand)) {
        const button = document.createElement('button');
        button.className = 'extra-stage-button';
        const title = document.createElement('span');
        title.className = 'hand-stage-name';
        title.textContent = `${stage.number}. ${stage.name}`;
        const status = document.createElement('span');
        status.className = 'hand-stage-status';
        if (stage.timed) {
            button.disabled = !isOneHandChallengeUnlocked(user, selectedHand);
            const best = user.oneHandChallenges?.[selectedHand]?.best;
            status.textContent = button.disabled ? 'かくにんテスト ごうかくで ひらく' : best ? `さいこう ${best.score}点` : '90びょう / ミス制限なし';
        } else status.textContent = `${stage.exam ? 'ミス5回まで' : 'ミス制限なし'}${user.oneHandProgress?.[stage.id] ? ' / クリア済み' : ''}`;
        button.append(title, status);
        button.onclick = () => startGame(stage.id, 'keyboard');
        root.append(button);
    }
}
setScreenRefreshHandlers({ 'screen-one-hand': renderOneHandMenu });
