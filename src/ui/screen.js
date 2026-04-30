import { showCustomConfirm } from './modal.js';
import { currentUser, users, setCurrentUser, setCurrentSelectedGrade, signOutSupabaseAuth } from '../api/user.js';

export function showScreen(id) {
    document.querySelectorAll('.screen').forEach(screen => {
        screen.classList.remove('active');
    });

    const target = document.getElementById(id);
    if (target) target.classList.add('active');

    const header = document.getElementById('global-header');
    if (header) {
        header.style.display = id === 'screen-title' ? 'none' : 'flex';
    }

    if (document.activeElement) document.activeElement.blur();
}

export function toggleFullScreen() {
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(err => {
            alert(`エラー: ${err.message}`);
        });
    } else {
        if (document.exitFullscreen) document.exitFullscreen();
    }

    if (document.activeElement) document.activeElement.blur();
}

export function showImeWarning() {
    const w = document.getElementById('ime-warning');
    if (w) {
        w.style.display = 'block';
        setTimeout(() => w.style.display = 'none', 3000);
    }
}

export function handleGlobalBack() {
    history.back();
}

export function handleGlobalHome() {
    if (currentUser && users[currentUser]) showScreen('screen-category');
    else showScreen('screen-title');
}

export function handleGlobalLogout() {
    showCustomConfirm('タイトル画面にもどりますか？', () => {
        setCurrentUser(null);
        setCurrentSelectedGrade(null);
        showScreen('screen-title');
        void signOutSupabaseAuth();
    });
}
