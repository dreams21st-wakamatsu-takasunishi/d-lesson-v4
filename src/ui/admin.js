import { renderAdminAuditLog, exportAdminAuditCsv } from './admin-audit.js';
import {
    showAdminSection as showAdminSectionImpl,
    backToAdminMenu as backToAdminMenuImpl,
    openAdmin as openAdminImpl
} from './admin-shell.js';
import {
    exportAdminBackupData,
    importAdminBackupData
} from './admin-backup.js';
import {
    openStudentReportPanel,
    closeStudentReportPanel,
    printStudentReportPanel
} from './admin-student-report.js';
import {
    renderPracticeHistoryPanel,
    clearPracticeHistoryPanelFilters,
    exportPracticeHistoryPanelCsv
} from './admin-practice-history.js';
import {
    switchDashTab,
    renderDashboardTable,
    renderVisionDashboardTable,
    renderTextDashboardTable
} from './admin-dashboard.js';
import {
    adminAddTextTask,
    editTextTask,
    moveTextTask,
    renderAdminTextTasks,
    deleteTextTask,
    insertRuby,
    toggleAutoRubyTool,
    generateAutoRuby,
    processAutoRuby,
    duplicateTextTask,
    cancelTextTaskEdit,
    toggleTextTaskVisibility,
    resetAdminTextTaskFilters,
    applyAdminTextTaskBulkTargetGroup,
    applyAdminTextTaskBulkVisibility,
    exportVisibleAdminTextTaskProgressCsv,
    exportVisibleAdminTextTaskIncompleteCsv,
    loadTextTaskTemplate,
    addStandardTextTaskTemplates,
    renderTextTaskTemplateOptions
} from './admin-text-tasks.js';
import {
    openThemeCreator,
    closeThemeCreator,
    updateThemePreview,
    saveCustomTheme,
    openEffectCreator,
    closeEffectCreator,
    saveCustomEffect,
    openCustomManager,
    closeCustomManager,
    renderCustomManagerList,
    deleteCustomElement
} from './admin-custom.js';
import {
    renderTicketAdmin,
    saveTicketSettings
} from './admin-tickets.js';
import {
    saveStudentIdleLogoutSetting,
    saveDailyMissionSettings,
    renderOpsGuideAdmin,
    copyInternalIdCheckGuide,
    copyDeviceHandoffChecklist,
    copyLessonSettingsCheckGuide
} from './admin-ops-guide.js';
import {
    renderTypingRankingSettingsAdmin,
    saveTypingRankingNicknameBlockWords
} from './admin-ranking-settings.js';
import {
    renderAdminRhythmSongs
} from './admin-rhythm.js';
import {
    linkRoleAuthUser,
    linkStudentAuthUser,
    copyStudentAccessSql,
    copyRoleAccessSql,
    renderAuthAccessOverview,
    renderAuthLinkingAdmin,
    openStudentLoginCardForUser
} from './admin-auth-linking.js';
import {
    resetUserProgress,
    forceUserProgress,
    openEditProgress as openEditProgressPanel,
    closeEditProgress,
    saveEditProgress as saveEditProgressPanel
} from './admin-progress-editor.js';
import {
    updateAdminUserTable as renderAdminUserTable,
    clearAdminUserFilters as clearAdminUserFiltersPanel,
    updateUserDisplayName as updateUserDisplayNameRow,
    updateUserBirthdate as updateUserBirthdateRow,
    updateUserCampus as updateUserCampusRow,
    updateUserGroup as updateUserGroupRow
} from './admin-user-table.js';
import {
    adminAddUser as addUserData,
    adminBulkAddUsers as bulkAddUserData,
    exportStudentCsv,
    applyStudentCsvUpdates as applyStudentCsvUpdatesData,
    adminDeleteUser as deleteStudentData,
    adminAddCoins as addCoinsData,
    adminAddCampus as addCampusData,
    renderCampusAdmin
} from './admin-student-data.js';

export {
    renderAdminAuditLog,
    exportAdminAuditCsv,
    exportStudentCsv,
    renderTicketAdmin,
    saveTicketSettings,
    saveStudentIdleLogoutSetting,
    saveDailyMissionSettings,
    renderCampusAdmin,
    renderOpsGuideAdmin,
    renderTypingRankingSettingsAdmin,
    renderAdminRhythmSongs,
    saveTypingRankingNicknameBlockWords,
    copyInternalIdCheckGuide,
    copyDeviceHandoffChecklist,
    copyLessonSettingsCheckGuide,
    switchDashTab,
    renderDashboardTable,
    renderVisionDashboardTable,
    renderTextDashboardTable,
    adminAddTextTask,
    editTextTask,
    moveTextTask,
    renderAdminTextTasks,
    deleteTextTask,
    insertRuby,
    toggleAutoRubyTool,
    generateAutoRuby,
    processAutoRuby,
    duplicateTextTask,
    cancelTextTaskEdit,
    toggleTextTaskVisibility,
    resetAdminTextTaskFilters,
    applyAdminTextTaskBulkTargetGroup,
    applyAdminTextTaskBulkVisibility,
    exportVisibleAdminTextTaskProgressCsv,
    exportVisibleAdminTextTaskIncompleteCsv,
    loadTextTaskTemplate,
    addStandardTextTaskTemplates,
    renderTextTaskTemplateOptions,
    openThemeCreator,
    closeThemeCreator,
    updateThemePreview,
    saveCustomTheme,
    openEffectCreator,
    closeEffectCreator,
    saveCustomEffect,
    openCustomManager,
    closeCustomManager,
    renderCustomManagerList,
    deleteCustomElement,
    linkRoleAuthUser,
    linkStudentAuthUser,
    copyStudentAccessSql,
    copyRoleAccessSql,
    renderAuthAccessOverview,
    renderAuthLinkingAdmin,
    closeEditProgress
};

export {
    exportAdminBackupData as exportData,
    importAdminBackupData as importData,
    renderPracticeHistoryPanel as renderPracticeHistoryAdmin,
    clearPracticeHistoryPanelFilters as clearPracticeHistoryFilters,
    exportPracticeHistoryPanelCsv as exportPracticeHistoryCsv
};

function refreshAdminStudentDataViews() {
    renderCampusAdmin();
    updateAdminUserTable();
    renderDashboardTable();
}

export function adminAddUser() {
    addUserData(refreshAdminStudentDataViews);
}

export function adminBulkAddUsers() {
    bulkAddUserData(refreshAdminStudentDataViews);
}

export function adminAddCampus() {
    addCampusData(refreshAdminStudentDataViews);
}

export function applyStudentCsvUpdates() {
    applyStudentCsvUpdatesData(refreshAdminStudentDataViews);
}

export function adminDeleteUser() {
    deleteStudentData(getSelUser(), refreshAdminStudentDataViews);
}

export function adminAddCoins() {
    addCoinsData(getSelUser(), refreshAdminStudentDataViews);
}

function adminShellCallbacks() {
    return {
        switchDashTab,
        renderTextDashboardTable,
        renderPracticeHistoryAdmin: renderPracticeHistoryPanel,
        renderAuthLinkingAdmin,
        renderCampusAdmin,
        renderAdminAuditLog,
        renderOpsGuideAdmin,
        renderTypingRankingSettingsAdmin,
        renderAdminRhythmSongs,
        updateAdminUserTable,
        renderAdminTextTasks,
        renderTicketAdmin
    };
}

export function showAdminSection(sectionId) {
    showAdminSectionImpl(sectionId, adminShellCallbacks());
}

export function backToAdminMenu() {
    backToAdminMenuImpl();
}

export async function openAdmin() {
    await openAdminImpl(adminShellCallbacks());
}

export function getSelUser() {
    const selected = document.querySelector('input[name="asel"]:checked');
    return selected ? selected.value : null;
}

function refreshAdminStudentViews() {
    updateAdminUserTable();
    renderDashboardTable();
}

export function adminResetUser() {
    resetUserProgress(getSelUser(), refreshAdminStudentViews);
}

export function adminForceProgress() {
    forceUserProgress(getSelUser(), refreshAdminStudentViews);
}

export function openEditProgress() {
    openEditProgressPanel(getSelUser());
}

export function adminPrintLoginCard() {
    openStudentLoginCardForUser(getSelUser());
}

export function saveEditProgress() {
    saveEditProgressPanel(refreshAdminStudentViews);
}

function adminUserTableOptions() {
    return { onUserChanged: renderDashboardTable };
}

export function updateAdminUserTable() {
    renderAdminUserTable(adminUserTableOptions());
}

export function clearAdminUserFilters() {
    clearAdminUserFiltersPanel(adminUserTableOptions());
}

export function updateUserDisplayName(userId, newName) {
    updateUserDisplayNameRow(userId, newName, adminUserTableOptions());
}

export function updateUserBirthdate(userId, newBirthdate) {
    updateUserBirthdateRow(userId, newBirthdate, adminUserTableOptions());
}

export function updateUserCampus(userId, newCampusId) {
    updateUserCampusRow(userId, newCampusId, adminUserTableOptions());
}

export function updateUserGroup(userId, newGroup) {
    updateUserGroupRow(userId, newGroup, adminUserTableOptions());
}

export function openStudentReport() {
    openStudentReportPanel(getSelUser());
}

export function openStudentReportById(userId) {
    openStudentReportPanel(userId);
}

export function closeStudentReport() {
    closeStudentReportPanel();
}

export function printStudentReport() {
    printStudentReportPanel();
}
