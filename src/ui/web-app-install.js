import { setLessonIcon } from './interface.js';

let installPrompt = null;

function syncInstallButton() {
    const button = document.getElementById('install-web-app');
    if (button) button.hidden = !installPrompt || window.matchMedia('(display-mode: standalone)').matches;
}

export function initWebAppInstall() {
    window.addEventListener('beforeinstallprompt', event => {
        event.preventDefault();
        installPrompt = event;
        syncInstallButton();
    });
    window.addEventListener('appinstalled', () => {
        installPrompt = null;
        syncInstallButton();
    });
}

export function bindWebAppInstallButton() {
    const button = document.getElementById('install-web-app');
    if (!button) return;
    setLessonIcon(button.firstElementChild, 'download');
    syncInstallButton();
    button.onclick = async () => {
        const prompt = installPrompt;
        if (!prompt) return;
        installPrompt = null;
        syncInstallButton();
        try {
            await prompt.prompt();
        } catch (error) {
            console.warn('Web app install prompt unavailable:', error);
        }
    };
}
