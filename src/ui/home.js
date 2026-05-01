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
        body, #game-container, #play-area,
        .admin-section, #records-container,
        #instruction, #header-right, .text-hud, #mg-hud,
        #ref-text-box, #type-text-box, .gacha-section {
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
        .reward-badge, .reward-badge-text,
        button span.reward-badge, button span.reward-badge-text {
            background-color: #FF9800 !important;
            color: #ffffff !important;
            border: 2px solid #ffffff !important;
            text-shadow: 1px 1px 2px rgba(0,0,0,0.8) !important;
            box-shadow: 0 2px 4px rgba(0,0,0,0.3) !important;
        }
        .badge-item { background-color: transparent !important; border-color: ${theme.text} !important; }
        .badge-item span, .badge-item div { color: ${theme.text} !important; }
        .badge-item.earned { background-color: ${theme.btnBg} !important; border-color: ${theme.btnText} !important; }
        .badge-item.earned span, .badge-item.earned div { color: ${theme.btnText} !important; }
    `;
}
