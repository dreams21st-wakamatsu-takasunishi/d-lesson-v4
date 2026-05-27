import { closeStampOverlay, goToGradeSelect } from '../api/user.js';
import { backToMenu, handleSecretMenuClick, retryExam, startRecommendedStage } from '../games/core.js';
import { changeEffect, changeTheme, drawGacha, useTicket } from '../games/gacha.js';
import {
    openExternalTypingSite,
    openFreeTimeSite,
    openTypingRankingPage,
    saveTypingRankingNickname,
    startMinigame,
    stopMinigame
} from '../games/minigame.js';
import {
    backToMenuFromText,
    closeTextPrepModal,
    closeTextResult,
    confirmStartTextPractice,
    goToTextMenu,
    setTextTaskFilter,
    submitTextPractice,
    toggleNavi,
    toggleNaviInPrep,
    toggleRuby,
    toggleRubyInPrep
} from '../games/text.js';
import { showVisionCompare } from '../games/vision.js';
import { confirmWordClear, goToWordMenu, openWordText, processWordClear, suspendWordTask } from '../games/word.js';
import { toggleBGM, toggleSFX } from '../utils/sound.js';
import * as Admin from '../ui/admin.js';
import { goToFreeTimeMenu, goToMinigameMenu, goToRecords, goToVisionMenu, goToWeakTraining, loginAsMaster } from '../ui/app-navigation.js';
import { loadCustomGlobalSettings } from '../ui/custom-settings.js';
import { exportDashboardCSV } from '../ui/dashboard-export.js';
import { registerGlobalFunctions, registerModuleFunctions, validateInlineEventHandlers } from '../ui/global-handlers.js';
import { updateGlobalHeader, updateHomeDashboard } from '../ui/home-dashboard.js';
import {
    backToKbChapter,
    goToKeyboardCategory,
    goToKeyboardMenu,
    renderKeyboardStages,
    showRomajiMenu
} from '../ui/keyboard-menu.js';
import { showCustomAlert } from '../ui/modal.js';
import { goToMouseMenu } from '../ui/mouse-menu.js';
import { printCertificate, printEarnedCertificates } from '../ui/certificates.js';
import {
    backToRecordMenu,
    showRecordSection,
    toggleEffectFavorite,
    toggleRandomEffect,
    toggleRandomTheme,
    toggleThemeFavorite
} from '../ui/records.js';
import { closeRewardOverlay } from '../ui/reward.js';
import { handleGlobalBack, handleGlobalHome, handleGlobalLogout, showScreen, toggleFullScreen } from '../ui/screen.js';
import { speakInstruction, speakTextTask } from '../ui/speech.js';
import { closeTeacherStatus, openTeacherMenu, openTeacherStatus } from '../ui/teacher-status.js';

export function registerAppGlobalHandlers() {
    const globalFunctions = [
        toggleSFX, toggleBGM, toggleFullScreen, goToGradeSelect, loginAsMaster, showScreen, showCustomAlert,

        goToMouseMenu, goToKeyboardCategory, goToKeyboardMenu, goToWeakTraining, goToTextMenu, goToMinigameMenu, goToFreeTimeMenu, goToVisionMenu,
        goToWordMenu, goToRecords,

        handleGlobalBack, handleGlobalHome, handleGlobalLogout,
        closeStampOverlay, closeRewardOverlay,
        openTeacherMenu, openTeacherStatus, closeTeacherStatus,

        startMinigame, stopMinigame, openExternalTypingSite, openFreeTimeSite, openTypingRankingPage, saveTypingRankingNickname,
        toggleRubyInPrep, toggleNaviInPrep, confirmStartTextPractice, closeTextPrepModal,
        submitTextPractice, closeTextResult, backToMenuFromText, setTextTaskFilter,

        retryExam, backToMenu, handleSecretMenuClick,
        showRomajiMenu, renderKeyboardStages, backToKbChapter,
        showRecordSection, backToRecordMenu, toggleThemeFavorite, toggleEffectFavorite, toggleRandomTheme, toggleRandomEffect,
        printCertificate, printEarnedCertificates, exportDashboardCSV, startRecommendedStage, loadCustomGlobalSettings,
        updateGlobalHeader, updateHomeDashboard,

        drawGacha, useTicket, changeTheme, changeEffect,
        showVisionCompare,

        openWordText, suspendWordTask, confirmWordClear, processWordClear,

        speakInstruction, speakTextTask, toggleRuby, toggleNavi
    ];

    registerGlobalFunctions(globalFunctions);
    registerModuleFunctions(Admin);
    validateInlineEventHandlers();
}
