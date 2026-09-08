import { createElement, ArrowLeft, House, LogOut, Maximize, Mouse, Keyboard, FileText, BookOpen, Eye, Gamepad2, Globe, Trophy, Save, BadgeCheck, ExternalLink, Volume2, VolumeX, Music, Music2, X } from 'lucide';

const icons = { 'arrow-left': ArrowLeft, house: House, 'log-out': LogOut, maximize: Maximize, mouse: Mouse, keyboard: Keyboard, 'file-text': FileText, 'book-open': BookOpen, eye: Eye, gamepad: Gamepad2, globe: Globe, trophy: Trophy, save: Save, 'badge-check': BadgeCheck, 'external-link': ExternalLink, 'volume': Volume2, 'muted': VolumeX, music: Music, 'music-muted': Music2, x: X };

export function setLessonIcon(element, name) {
    if (!element || !icons[name]) return;
    element.replaceChildren(createElement(icons[name], { width: 24, height: 24, 'stroke-width': 1.8, 'aria-hidden': 'true', focusable: 'false' }));
}

export function updateSoundButton(id, muted) {
    const button = document.getElementById(id);
    const bgm = id === 'btn-bgm';
    setLessonIcon(button, muted ? 'muted' : bgm ? 'music' : 'volume');
    if (button) {
        button.setAttribute('aria-pressed', String(!muted));
        button.title = `${bgm ? 'BGM' : '効果音'}：${muted ? 'オフ' : 'オン'}`;
        button.setAttribute('aria-label', button.title);
    }
}

export function refreshInterface(screenId) {
    const controls = { 'btn-back-global': 'arrow-left', 'btn-home-global': 'house', 'btn-logout-global': 'log-out', 'btn-fullscreen': 'maximize' };
    Object.entries(controls).forEach(([id, icon]) => {
        const button = document.getElementById(id);
        setLessonIcon(button, icon);
        if (button) { button.tabIndex = 0; button.setAttribute('aria-label', button.title); }
    });
    const selectors = {
        '.home-action-practice .home-action-icon': 'book-open', '.home-action-free .home-action-icon': 'globe',
        '.home-action-mypage .home-action-icon': 'trophy', '.home-action-logout .home-action-icon': 'log-out',
        '#cat-mouse .practice-category-icon': 'mouse', '#cat-keyboard .practice-category-icon': 'keyboard',
        '#cat-text .practice-category-icon': 'file-text', '#cat-word .practice-category-icon': 'book-open',
        '#cat-vision .practice-category-icon': 'eye', '#cat-minigame .practice-category-icon': 'gamepad'
    };
    Object.entries(selectors).forEach(([selector, icon]) => setLessonIcon(document.querySelector(selector), icon));
    document.querySelectorAll('[data-lesson-icon]').forEach(el => setLessonIcon(el, el.dataset.lessonIcon));
    const locations = {
        'screen-category': 'ホーム', 'screen-practice-menu': 'れんしゅう', 'screen-keyboard-category': 'キーボード',
        'screen-keyboard-menu': 'キーボード', 'screen-mouse-menu': 'マウス', 'screen-text-menu': 'ぶんしょう',
        'screen-word-menu': 'Word', 'screen-word-game': 'Word', 'screen-vision-menu': 'ビジョン',
        'screen-records': 'マイページ', 'screen-admin': '管理者メニュー', 'screen-free-time-menu': 'じゆうじかん',
        'screen-minigame-menu': 'ゲーム'
    };
    const location = document.getElementById('lesson-location');
    if (location) location.textContent = locations[screenId] || document.querySelector(`#${screenId} h2`)?.textContent || '';
}
