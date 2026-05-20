import { THEMES } from '../data/constants.js';

export function applyTheme(themeId = 'default') {
    document.body.className = '';
    let styleTag = document.getElementById('custom-theme-style');
    if (!styleTag) {
        styleTag = document.createElement('style');
        styleTag.id = 'custom-theme-style';
        document.head.appendChild(styleTag);
    }
    styleTag.innerHTML = '';

    if (themeId === 'default') return;

    const theme = THEMES.find(item => item.id === themeId);
    if (!theme) return;

    styleTag.innerHTML = `
        body, #game-container,
        .admin-section, #records-container,
        .gacha-section {
            background-color: ${theme.bg} !important;
            color: ${theme.text} !important;
            border-color: ${theme.text} !important;
        }
        .screen h1, .screen h2, .screen h3, .screen p {
            color: ${theme.text} !important;
            border-bottom-color: ${theme.text} !important;
        }
        button, .btn-primary, .btn-secondary, .btn-danger, .btn-gacha, .btn-retry, .category-btn {
            background-color: ${theme.btnBg} !important;
            color: ${theme.btnText} !important;
        }
        button span, .btn-primary span, .btn-secondary span, .btn-danger span, .btn-gacha span, .btn-retry span, .category-btn span {
            color: ${theme.btnText} !important;
        }
        .minigame-ranking-button .minigame-sub-icon,
        .minigame-ranking-button .minigame-sub-main {
            color: #0d47a1 !important;
        }
        .minigame-ranking-button .minigame-sub-note {
            color: #607d8b !important;
        }
        .minigame-external-button .minigame-sub-icon,
        .minigame-external-button .minigame-sub-main {
            color: #263238 !important;
        }
        .minigame-external-button .minigame-sub-note {
            color: #607d8b !important;
        }
        .schulte-btn,
        .schulte-btn span,
        .wide-scan-target,
        .wide-scan-target span,
        .flash-choice-btn,
        .flash-choice-btn span,
        .vision-q-btn,
        .vision-q-btn span,
        .double-check-prompt,
        .double-check-prompt span,
        .double-check-btn,
        .double-check-btn span {
            color: #263238 !important;
        }
        .double-check-prompt,
        .double-check-prompt span,
        .double-check-btn,
        .double-check-btn span {
            color: #3e2723 !important;
        }
        .peripheral-choice-btn,
        .peripheral-choice-btn span,
        .peripheral-choice-btn small {
            color: #1a237e !important;
        }
        .shape-match-target span,
        .shape-match-btn span {
            color: var(--shape-color, #263238) !important;
        }
        .side-compare-card {
            color: #263238 !important;
        }
        .side-compare-content,
        .side-compare-number,
        .side-compare-shape {
            color: var(--side-compare-color, #263238) !important;
        }
        .side-compare-label {
            color: #01579b !important;
        }
        .side-compare-answer {
            background: #ffffff !important;
            color: #01579b !important;
            border-color: #0277bd !important;
        }
        .side-compare-answer.is-different {
            color: #bf360c !important;
            border-color: #ef6c00 !important;
        }
        .side-compare-answer span {
            color: currentColor !important;
        }
        .color-catch-prompt span,
        .color-catch-choice span {
            color: var(--color-catch-color, #263238) !important;
        }
        .color-catch-prompt small {
            color: #1b5e20 !important;
        }
        .line-trace-stage {
            background: linear-gradient(135deg, #e3f2fd 0%, #ffffff 100%) !important;
            border-color: #90caf9 !important;
        }
        .line-trace-goal,
        .line-trace-goal span {
            background: #ffffff !important;
            color: #263238 !important;
            border-color: #455a64 !important;
        }
        .pattern-memory-stage {
            background: linear-gradient(135deg, #f3e5f5 0%, #ffffff 100%) !important;
            border-color: #ce93d8 !important;
        }
        .pattern-memory-preview,
        .pattern-memory-choice,
        .pattern-memory-cover {
            background: #ffffff !important;
            border-color: #6a1b9a !important;
        }
        .pattern-memory-preview-cell span,
        .pattern-memory-choice-cell span {
            color: var(--pattern-color, #263238) !important;
        }
        .pattern-memory-cover {
            color: #6a1b9a !important;
        }
        .shadow-match-stage {
            background: linear-gradient(135deg, #eceff1 0%, #ffffff 100%) !important;
            border-color: #b0bec5 !important;
        }
        .shadow-match-target,
        .shadow-match-choice {
            background: #ffffff !important;
            border-color: #607d8b !important;
        }
        .shadow-match-shadow {
            color: #263238 !important;
        }
        .shadow-match-symbol {
            color: var(--shadow-match-color, #263238) !important;
        }
        .position-memory-stage {
            background: linear-gradient(135deg, #e0f7fa 0%, #ffffff 100%) !important;
            border-color: #80deea !important;
        }
        .position-memory-grid,
        .position-memory-cover {
            background: #ffffff !important;
            border-color: #00838f !important;
        }
        .position-memory-cell {
            background: #f7fbfc !important;
            border-color: #b0bec5 !important;
        }
        .position-memory-cell.is-target,
        .position-memory-cell.selected {
            background: radial-gradient(circle at center, #fff176 0 28%, #26c6da 30% 100%) !important;
            border-color: #006064 !important;
        }
        .position-memory-cover {
            color: #006064 !important;
        }
        .hidden-shape-stage {
            background: linear-gradient(135deg, #efebe9 0%, #ffffff 100%) !important;
            border-color: #a1887f !important;
        }
        .hidden-shape-target,
        .hidden-shape-choice {
            background: #ffffff !important;
            border-color: #795548 !important;
        }
        .hidden-shape-preview-symbol {
            color: #263238 !important;
        }
        .hidden-shape-mask {
            background: #ffffff !important;
        }
        .hidden-shape-choice-symbol {
            color: var(--shadow-match-color, #263238) !important;
        }
        .maze-start,
        .maze-goal {
            color: #ffffff !important;
        }
        .folder-text,
        .menu-item {
            color: #333333 !important;
        }
        .stage-btn, .exam-btn {
            background-color: transparent !important;
            color: ${theme.text} !important;
            border-color: ${theme.text} !important;
            opacity: 0.5 !important;
        }
        .stage-btn span, .exam-btn span { color: ${theme.text} !important; }
        .stage-btn.unlocked, .exam-btn.unlocked {
            background-color: ${theme.btnBg} !important;
            color: ${theme.btnText} !important;
            border-color: ${theme.btnText} !important;
            opacity: 1 !important;
        }
        .stage-btn.unlocked span, .exam-btn.unlocked span { color: ${theme.btnText} !important; }
        .stage-btn.cleared, .exam-btn.cleared { opacity: 0.7 !important; }
        #screen-text-menu #text-menu-content .stage-btn.text-task-card {
            background: linear-gradient(180deg, #fffef8 0%, #fff8e7 100%) !important;
            border-color: #f59e0b !important;
            color: #263238 !important;
            box-shadow: 0 5px 0 #d97706 !important;
            opacity: 1 !important;
        }
        #screen-text-menu #text-menu-content .stage-btn.text-task-card span {
            color: #455a64 !important;
            text-shadow: none !important;
        }
        #screen-text-menu #text-menu-content .stage-btn.text-task-card .text-task-title {
            color: #263238 !important;
        }
        #screen-text-menu #text-menu-content .stage-btn.text-task-card .text-task-status.todo {
            background: #fff7ed !important;
            color: #c2410c !important;
            border-color: #fed7aa !important;
        }
        #screen-text-menu #text-menu-content .stage-btn.text-task-card .text-task-status.done {
            background: #e8f5e9 !important;
            color: #1b5e20 !important;
            border-color: #a5d6a7 !important;
        }
        #screen-text-menu #text-menu-content .stage-btn.text-task-card .text-task-record {
            color: #00695c !important;
        }
        #screen-text-menu #text-menu-content .stage-btn.text-task-card .text-task-reward {
            background: #f5f0e6 !important;
            color: #5d4037 !important;
        }
        .reward-badge, .reward-badge-text,
        button span.reward-badge, button span.reward-badge-text {
            background-color: #FF9800 !important;
            color: #ffffff !important;
            border: 2px solid #ffffff !important;
            text-shadow: 1px 1px 2px rgba(0,0,0,0.8) !important;
            box-shadow: 0 2px 4px rgba(0,0,0,0.3) !important;
        }
        #screen-vision-menu .vision-stage-section-header h3,
        #screen-vision-menu .vision-stage-title {
            color: #263238 !important;
            border-bottom-color: #d9e6ee !important;
        }
        #screen-vision-menu .vision-stage-section-header p,
        #screen-vision-menu .vision-stage-sub {
            color: #546e7a !important;
        }
        #screen-vision-menu .vision-section-progress {
            background: #e3f2fd !important;
            color: #0d47a1 !important;
            border-color: #90caf9 !important;
        }
        .badge-item { background-color: transparent !important; border-color: ${theme.text} !important; }
        .badge-item span, .badge-item div { color: ${theme.text} !important; }
        .badge-item.earned { background-color: ${theme.btnBg} !important; border-color: ${theme.btnText} !important; }
        .badge-item.earned span, .badge-item.earned div { color: ${theme.btnText} !important; }

        #screen-game #instruction {
            background: #e1f5fe !important;
            color: #0277bd !important;
            border-color: #81d4fa !important;
        }
        #screen-game #inst-text { color: #0277bd !important; }
        #screen-game #header-right {
            background: #ffffff !important;
            color: #263238 !important;
            border-color: #e0e0e0 !important;
        }
        #screen-game #play-area {
            background-color: #fafafa !important;
            color: #263238 !important;
            border-color: #b0bec5 !important;
        }
        #screen-game #question-display {
            background-color: #fffde7 !important;
            color: #263238 !important;
            border-color: #fff59d !important;
        }
        #screen-game #main-q { color: #263238 !important; }
        #screen-game #romaji-hint { color: #546e7a !important; }
        #screen-text-game .text-hud,
        #screen-minigame #mg-hud {
            background: #ffffff !important;
            color: #263238 !important;
            border-color: #cfd8dc !important;
        }
        #screen-text-game #ref-text-box {
            background: #fdfdfd !important;
            color: #263238 !important;
            border-color: #90a4ae !important;
        }
        #screen-text-game #type-text-box {
            background: #ffffff !important;
            color: #263238 !important;
            border-color: #4CAF50 !important;
        }
    `;
}
