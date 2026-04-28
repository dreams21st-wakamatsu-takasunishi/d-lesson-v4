export const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

export let isSfxMuted = localStorage.getItem('pc_practice_sfx_muted') === 'true';
export let isBgmMuted = localStorage.getItem('pc_practice_bgm_muted') === 'true';
let bgmInterval = null;

export function toggleSFX() {
    isSfxMuted = !isSfxMuted;
    localStorage.setItem('pc_practice_sfx_muted', isSfxMuted);
    document.getElementById('btn-sfx').innerText = isSfxMuted ? '🔇' : '🔊';
    if (document.activeElement) document.activeElement.blur(); 
}

export function toggleBGM() {
    isBgmMuted = !isBgmMuted;
    localStorage.setItem('pc_practice_bgm_muted', isBgmMuted);
    document.getElementById('btn-bgm').innerText = isBgmMuted ? '🔇' : '🎵';
    if (isBgmMuted) stopBGM(); else startBGM();
    if (document.activeElement) document.activeElement.blur(); 
}

export function playBGMTick() {
    if(isBgmMuted) return;
    const notes =[261.63, 329.63, 392.00, 440.00, 523.25]; 
    const freq = notes[Math.floor(Math.random() * notes.length)] / 2; 
    try {
        SoundManager.init(); const osc = audioCtx.createOscillator(); const gain = audioCtx.createGain();
        osc.type = 'sine'; osc.frequency.value = freq;
        gain.gain.setValueAtTime(0, audioCtx.currentTime);
        gain.gain.linearRampToValueAtTime(0.02, audioCtx.currentTime + 1); 
        gain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 3);
        osc.connect(gain); gain.connect(audioCtx.destination);
        osc.start(audioCtx.currentTime); osc.stop(audioCtx.currentTime + 3);
    } catch(e){}
}
export function startBGM() { if(!bgmInterval) bgmInterval = setInterval(playBGMTick, 2000); }
export function stopBGM() { clearInterval(bgmInterval); bgmInterval = null; }

export const SoundManager = {
    init: () => { try { if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume(); } catch(e) { console.error(e); } },
    playTone: (freq, type, duration) => {
        if (isSfxMuted) return;
        SoundManager.init(); const osc = audioCtx.createOscillator(); const gain = audioCtx.createGain();
        osc.type = type; osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
        gain.gain.setValueAtTime(0.1, audioCtx.currentTime); gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + duration);
        osc.connect(gain); gain.connect(audioCtx.destination); osc.start(); osc.stop(audioCtx.currentTime + duration);
    },
    playHover: () => { if (!isSfxMuted) SoundManager.playTone(800, 'sine', 0.1); },
    playClick: () => { if (!isSfxMuted) SoundManager.playTone(600, 'square', 0.05); },
    playType: () => { if (!isSfxMuted) SoundManager.playTone(400, 'triangle', 0.05); },
    playTrash: () => { if (!isSfxMuted) SoundManager.playTone(100, 'sawtooth', 0.2); },
    playError: () => {
        if (isSfxMuted) return;
        SoundManager.init(); const now = audioCtx.currentTime; const osc = audioCtx.createOscillator(); const gain = audioCtx.createGain();
        osc.type = 'sawtooth'; osc.frequency.setValueAtTime(150, now); osc.frequency.linearRampToValueAtTime(100, now + 0.3);
        gain.gain.setValueAtTime(0.2, now); gain.gain.linearRampToValueAtTime(0, now + 0.3);
        osc.connect(gain); gain.connect(audioCtx.destination); osc.start(now); osc.stop(now + 0.3);
    },
    playSuccess: () => {
        if (isSfxMuted) return;
        SoundManager.init(); const now = audioCtx.currentTime;[523, 659, 784, 1046].forEach((f, i) => {
            const osc = audioCtx.createOscillator(); const gain = audioCtx.createGain();
            osc.type = 'triangle'; osc.frequency.value = f;
            gain.gain.setValueAtTime(0.05, now + i*0.05); gain.gain.linearRampToValueAtTime(0, now + i*0.05 + 0.3);
            osc.connect(gain); gain.connect(audioCtx.destination); osc.start(now + i*0.05); osc.stop(now + i*0.05 + 0.3);
        });
    },
    playGachaDrop: () => {
        if (isSfxMuted) return;
        SoundManager.init(); const now = audioCtx.currentTime; const osc = audioCtx.createOscillator(); const gain = audioCtx.createGain();
        osc.type = 'sine'; osc.frequency.setValueAtTime(800, now); osc.frequency.exponentialRampToValueAtTime(200, now + 0.5);
        gain.gain.setValueAtTime(0.1, now); gain.gain.linearRampToValueAtTime(0, now + 0.5);
        osc.connect(gain); gain.connect(audioCtx.destination); osc.start(now); osc.stop(now + 0.5);
    },
    playGachaBurst: () => {
        if (isSfxMuted) return;
        SoundManager.init(); const now = audioCtx.currentTime;[800, 1000, 1200].forEach((f, i) => {
            const osc = audioCtx.createOscillator(); const gain = audioCtx.createGain();
            osc.type = 'square'; osc.frequency.value = f;
            gain.gain.setValueAtTime(0.1, now + i*0.1); gain.gain.exponentialRampToValueAtTime(0.01, now + i*0.1 + 0.3);
            osc.connect(gain); gain.connect(audioCtx.destination); osc.start(now + i*0.1); osc.stop(now + i*0.1 + 0.3);
        });
    },
    playClear: () => {
        if (isSfxMuted) return;
        SoundManager.init(); const now = audioCtx.currentTime;[440, 440, 440, 523, 659, 523, 659].forEach((f, i) => {
            const osc = audioCtx.createOscillator(); const gain = audioCtx.createGain();
            osc.type = 'square'; osc.frequency.value = f;
            let t = now + i*0.15; if(i > 2) t = now + 0.45 + (i-3)*0.3;
            gain.gain.setValueAtTime(0.1, t); gain.gain.exponentialRampToValueAtTime(0.01, t + 0.2);
            osc.connect(gain); gain.connect(audioCtx.destination); osc.start(t); osc.stop(t + 0.2);
        });
    }
};

export function initAudio() {
    document.getElementById('btn-sfx').innerText = isSfxMuted ? '🔇' : '🔊';
    document.getElementById('btn-bgm').innerText = isBgmMuted ? '🔇' : '🎵';
    if (!isBgmMuted) startBGM();
}