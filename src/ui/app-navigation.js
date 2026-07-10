import { users, currentUser, login, hasLessonRole, MASTER_DEBUG_ID } from '../api/user.js';
import { startGame } from '../games/core.js';
import { renderVisionMenu } from '../games/vision.js';
import { showCustomAlert } from './modal.js';
import { renderRecords } from './records.js';
import { showScreen } from './screen.js';
import { loadCustomGlobalSettings } from './custom-settings.js';
import { hasTrainableMistakes } from '../utils/weak-mistakes.js';

function getActiveUserOrTitle() {
    const u = currentUser ? users[currentUser] : null;
    if (u) return u;
    showCustomAlert('つかう人をえらんでください');
    showScreen('screen-title');
    return null;
}

export function goToMinigameMenu() {
    showScreen('screen-minigame-menu');
}

export function goToFreeTimeMenu() {
    showScreen('screen-free-time-menu');
}

export function goToRecords() {
    loadCustomGlobalSettings();
    renderRecords();
    showScreen('screen-records');
}

export function goToVisionMenu() {
    renderVisionMenu();
    showScreen('screen-vision-menu');
}

function enterMasterMode() {
    if (!users[MASTER_DEBUG_ID]) {
        users[MASTER_DEBUG_ID] = {
            mouseLevel: 7,
            keyboardSequence: 999,
            examRecords: {},
            textRecords: {},
            globalMistakes: {},
            theme: 'default',
            birthdate: '',
            isMaster: true
        };
    }
    document.getElementById('screen-title').classList.remove('active');
    login(MASTER_DEBUG_ID);
}

export function loginAsMaster() {
    if (hasLessonRole('teacher', 'admin')) {
        enterMasterMode();
        return;
    }

    showCustomAlert('先生か管理者アカウントでログインしてください。');
}

export function goToWeakTraining() {
    const u = getActiveUserOrTitle();
    if (!u) return;

    if (hasTrainableMistakes(u.globalMistakes)) {
        startGame(9888, 'keyboard');
        return;
    }

    showCustomAlert('ミスのデータがないか、ぜんぶできています！\nいろいろなれんしゅうをしてからまたやってみてね！');
}
