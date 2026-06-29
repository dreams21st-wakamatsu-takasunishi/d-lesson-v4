import { hasLessonRole, refreshCurrentLessonAccess } from '../api/user.js';
import { showCustomAlert } from './modal.js';
import { showScreen } from './screen.js';

function getCallback(callbacks, name) {
    return typeof callbacks?.[name] === 'function' ? callbacks[name] : () => {};
}

export function showAdminSection(sectionId, callbacks = {}) {
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
            target.appendChild(authSection);
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

function openAdminScreen(callbacks = {}) {
    getCallback(callbacks, 'renderCampusAdmin')();
    getCallback(callbacks, 'updateAdminUserTable')();
    getCallback(callbacks, 'renderAdminTextTasks')();
    getCallback(callbacks, 'renderTicketAdmin')();
    getCallback(callbacks, 'renderPracticeHistoryAdmin')();
    getCallback(callbacks, 'renderTypingRankingSettingsAdmin')();
    getCallback(callbacks, 'renderAdminRhythmSongs')();
    backToAdminMenu();
    showScreen('screen-admin');
}

export async function openAdmin(callbacks = {}) {
    await refreshCurrentLessonAccess();

    if (hasLessonRole('admin')) {
        openAdminScreen(callbacks);
        return;
    }

    showCustomAlert('管理者アカウントでログインしてください。');
}
