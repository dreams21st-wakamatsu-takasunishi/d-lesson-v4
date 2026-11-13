import { ensureStaffRoster, hasLessonRole, refreshCurrentLessonAccess } from '../api/user.js';
import { showCustomAlert } from './modal.js';
import { showScreen } from './screen.js';

function getCallback(callbacks, name) {
    return typeof callbacks?.[name] === 'function' ? callbacks[name] : () => {};
}

export async function showAdminSection(sectionId, callbacks = {}) {
    if (!hasLessonRole('admin')) return;
    if (['admin-sec-dashboard','admin-sec-practice-history','admin-sec-users','admin-sec-auth-link','admin-sec-tasks','admin-sec-tickets','admin-sec-custom','admin-sec-rhythm','admin-sec-backup','admin-sec-ops-guide'].includes(sectionId)) {
        try { await ensureStaffRoster(true); }
        catch { showCustomAlert('詳細データを読み込めませんでした。通信状態を確認し、もう一度開いてください。'); return; }
        if (!document.getElementById('screen-admin')?.classList.contains('active')) return;
    }
    document.getElementById('admin-main-menu').style.display = 'none';
    document.getElementById('admin-panel-content').style.display = 'flex';
    document.getElementById('admin-bottom-back-btn').style.display = 'none';
    document.querySelectorAll('.admin-section').forEach(section => {
        section.style.display = 'none';
    });

    const target = document.getElementById(sectionId);
    if (!target) return;

    target.style.display = 'flex';
    target.style.flexDirection = 'column';

    if (sectionId === 'admin-sec-users') {
        const authSection = document.getElementById('admin-sec-auth-link');
        if (authSection && !target.contains(authSection)) {
            authSection.classList.add('admin-auth-embedded');
            const advanced = document.createElement('details');
            advanced.innerHTML = '<summary>先生・管理者の権限／既存ログインの詳細設定</summary>';
            advanced.appendChild(authSection); target.appendChild(advanced);
        }
        if (authSection) {
            authSection.style.display = 'flex';
            authSection.style.flexDirection = 'column';
            authSection.style.marginTop = '18px';
        }
        getCallback(callbacks, 'renderCampusAdmin')();
        getCallback(callbacks, 'updateAdminUserTable')();
        getCallback(callbacks, 'renderAuthLinkingAdmin')();
    }

    if (sectionId === 'admin-sec-dashboard') getCallback(callbacks, 'switchDashTab')('basic');
    if (sectionId === 'admin-sec-route-settings') getCallback(callbacks, 'renderStandardRouteSettingsAdmin')();
    if (sectionId === 'admin-sec-practice-history') getCallback(callbacks, 'renderPracticeHistoryAdmin')();
    if (sectionId === 'admin-sec-tasks') getCallback(callbacks, 'renderAdminTextTasks')();
    if (sectionId === 'admin-sec-tickets') getCallback(callbacks, 'renderTicketAdmin')();
    if (sectionId === 'admin-sec-auth-link') getCallback(callbacks, 'renderAuthLinkingAdmin')();
    if (sectionId === 'admin-sec-rhythm') getCallback(callbacks, 'renderAdminRhythmSongs')();
    if (sectionId === 'admin-sec-backup') getCallback(callbacks, 'renderAdminAuditLog')();
    if (sectionId === 'admin-sec-ops-guide') {
        getCallback(callbacks, 'renderOpsGuideAdmin')();
        getCallback(callbacks, 'renderTypingRankingSettingsAdmin')();
    }
}

export function backToAdminMenu() {
    document.getElementById('admin-main-menu').style.display = 'flex';
    document.getElementById('admin-panel-content').style.display = 'none';
    document.getElementById('admin-bottom-back-btn').style.display = 'block';
}

function openAdminScreen() {
    backToAdminMenu();
    showScreen('screen-admin');
}

export async function openAdmin(callbacks = {}) {
    await refreshCurrentLessonAccess();

    if (hasLessonRole('admin')) {
        try { await ensureStaffRoster(false); }
        catch { showCustomAlert('児童情報を読み込めませんでした。通信状態を確認して、管理者用をもう一度開いてください。'); return; }
        if (!hasLessonRole('admin')) return;
        openAdminScreen();
        return;
    }

    showCustomAlert('管理者アカウントでログインしてください。');
}
