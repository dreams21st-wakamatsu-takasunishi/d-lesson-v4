import { getCurrentTextTask } from '../games/text.js';

function speakText(text) {
    if ('speechSynthesis' in window) {
        speechSynthesis.cancel();
        const msg = new SpeechSynthesisUtterance(text);
        msg.lang = 'ja-JP';
        msg.rate = 1.0;
        speechSynthesis.speak(msg);
    }
}

export function speakInstruction() {
    let txt = document.getElementById('inst-text').innerText;
    let mq = document.getElementById('main-q');
    if (mq && mq.innerText && !mq.innerText.includes('👀')) txt += '。 ' + mq.innerText;
    speakText(txt);
}

export function speakTextTask() {
    const currentTextTask = getCurrentTextTask();
    if (currentTextTask && currentTextTask.content) {
        let plain = currentTextTask.content.replace(/\{([^|]+)\|([^}]+)\}/g, '$1');
        speakText(plain);
    }
}
