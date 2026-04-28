import './style.css';

const IS_DEV_MODE = true; 

/* =========================================================
   [JS] 1. 効果音管理 (Sound) ＆ システム制御 ＆ 音声読み上げ
   ========================================================= */

const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

let isSfxMuted = localStorage.getItem('pc_practice_sfx_muted') === 'true';
let isBgmMuted = localStorage.getItem('pc_practice_bgm_muted') === 'true';
let bgmInterval = null;

window.addEventListener('DOMContentLoaded', () => {
    document.getElementById('btn-sfx').innerText = isSfxMuted ? '🔇' : '🔊';
    document.getElementById('btn-bgm').innerText = isBgmMuted ? '🔇' : '🎵';
    loadUsers();
    if (!isBgmMuted) startBGM();
});

function toggleSFX() {
    isSfxMuted = !isSfxMuted;
    localStorage.setItem('pc_practice_sfx_muted', isSfxMuted);
    document.getElementById('btn-sfx').innerText = isSfxMuted ? '🔇' : '🔊';
    if (document.activeElement) document.activeElement.blur(); 
}

function toggleBGM() {
    isBgmMuted = !isBgmMuted;
    localStorage.setItem('pc_practice_bgm_muted', isBgmMuted);
    document.getElementById('btn-bgm').innerText = isBgmMuted ? '🔇' : '🎵';
    if (isBgmMuted) stopBGM(); else startBGM();
    if (document.activeElement) document.activeElement.blur(); 
}

function toggleFullScreen() {
    if (!document.fullscreenElement) { document.documentElement.requestFullscreen().catch(err => { alert(`エラー: ${err.message}`); }); } 
    else { if (document.exitFullscreen) document.exitFullscreen(); }
    if (document.activeElement) document.activeElement.blur(); 
}

function playBGMTick() {
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
function startBGM() { if(!bgmInterval) bgmInterval = setInterval(playBGMTick, 2000); }
function stopBGM() { clearInterval(bgmInterval); bgmInterval = null; }

function showImeWarning() {
    const w = document.getElementById('ime-warning');
    if(w) { w.style.display = 'block'; setTimeout(() => w.style.display = 'none', 3000); }
}
function speakText(text) {
    if ('speechSynthesis' in window) {
        speechSynthesis.cancel();
        const msg = new SpeechSynthesisUtterance(text);
        msg.lang = 'ja-JP'; msg.rate = 1.0;
        speechSynthesis.speak(msg);
    }
}
function speakInstruction() {
    let txt = document.getElementById('inst-text').innerText;
    let mq = document.getElementById('main-q');
    if(mq && mq.innerText && !mq.innerText.includes('👀')) txt += "。 " + mq.innerText;
    speakText(txt);
}
function speakTextTask() {
    if(currentTextTask && currentTextTask.content) {
        let plain = currentTextTask.content.replace(/\{([^|]+)\|([^}]+)\}/g, '$1');
        speakText(plain);
    }
}

const SoundManager = {
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

/* =========================================================
   [JS] 2. データ定義と定数 (Data)
   ========================================================= */
const STORAGE_KEY = 'pc_practice_v5_split';
const ADMIN_PASS = '7188';
const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwrfcSdSC1ilSbuHVpS6KTQI6_CxNI5g2u73UJTvRprQQaeCu5ERX1QlbbGaH7fRq9h/exec';

const GRADE_ORDER =["未就学", "小学1年", "小学2年", "小学3年", "小学4年", "小学5年", "小学6年", "中学1年", "中学2年", "中学3年", "高校1年", "高校2年", "高校3年", "おとな", "学年未設定"];

const ACHIEVEMENTS =[
    { id: 'login_3', title: '三日坊主じゃない！', desc: 'ログインスタンプを 3こ あつめる', icon: '📅', check: u => u.loginStamps && u.loginStamps.length >= 3 },
    { id: 'login_10', title: 'けいぞくは 力なり', desc: 'ログインスタンプを 10こ あつめる', icon: '🔥', check: u => u.loginStamps && u.loginStamps.length >= 10 },
    { id: 'type_1000', title: 'タイピング ビギナー', desc: 'キーを るいけい 1000回 タイプする', icon: '⌨️', check: u => (u.totalKeysTyped || 0) >= 1000 },
    { id: 'type_10000', title: 'タイピング マスター', desc: 'キーを るいけい 10000回 タイプする', icon: '✨', check: u => (u.totalKeysTyped || 0) >= 10000 },
    { id: 'nomiss', title: 'パーフェクト！', desc: 'しけん を ミス0 で クリアする', icon: '🎯', check: u => u.hasPerfectClear },
    { id: 'mouse_master', title: 'マウスの達人', desc: 'マウスれんしゅう を Lv.7まで クリア', icon: '🖱️', check: u => (u.mouseLevel || 0) >= 7 },
    { id: 'gacha_10', title: 'ガチャマニア', desc: 'アイテム を 10こ以上 あつめる', icon: '🎁', check: u => u.items && u.items.length >= 10 }
];

let THEMES =[
    { id: 'default', name: 'いつもの', icon: '🏠', isDynamic: false },
    { id: 'ocean', name: 'うみのそこ', icon: '🌊', bg: '#e1f5fe', text: '#01579b', btnBg: '#0288d1', btnText: '#fff' },
    { id: 'magic', name: 'まほうのしろ', icon: '🏰', bg: '#f3e5f5', text: '#6a1b9a', btnBg: '#8e24aa', btnText: '#fff' },
    { id: 'space', name: 'うちゅう', icon: '🚀', bg: '#1c2541', text: '#66fcf1', btnBg: '#45a29e', btnText: '#1c2541' },
    { id: 'ninja', name: 'にんじゃ', icon: '🥷', bg: '#212121', text: '#f5f5f5', btnBg: '#616161', btnText: '#fff' },
    { id: 'sakura', name: 'さくら', icon: '🌸', bg: '#fce4ec', text: '#d81b60', btnBg: '#ec407a', btnText: '#fff' },
    { id: 'night', name: 'よるのまち', icon: '🌃', bg: '#1a237e', text: '#ffeb3b', btnBg: '#3f51b5', btnText: '#fff' },
    { id: 'spring', name: 'はるののはら', icon: '🌷', bg: '#f1f8e9', text: '#33691e', btnBg: '#8bc34a', btnText: '#fff' },
    { id: 'sunflower', name: 'ひまわりばたけ', icon: '🌻', bg: '#fffde7', text: '#f57f17', btnBg: '#fbc02d', btnText: '#fff' },
    { id: 'autumn', name: 'あきのこうよう', icon: '🍁', bg: '#fff3e0', text: '#bf360c', btnBg: '#ff5722', btnText: '#fff' },
    { id: 'ice', name: 'こおりのしろ', icon: '❄️', bg: '#e0f7fa', text: '#006064', btnBg: '#00bcd4', btnText: '#fff' },
    { id: 'volcano', name: 'しゃくねつかざん', icon: '🔥', bg: '#ffebee', text: '#b71c1c', btnBg: '#f44336', btnText: '#fff' },
    { id: 'forest', name: 'ふかいもり', icon: '🌲', bg: '#e8f5e9', text: '#1b5e20', btnBg: '#4caf50', btnText: '#fff' },
    { id: 'desert', name: 'さばくのオアシス', icon: '🌴', bg: '#fff8e1', text: '#ff6f00', btnBg: '#ffc107', btnText: '#fff' },
    { id: 'thunder', name: 'かみなりぐも', icon: '⚡', bg: '#eceff1', text: '#263238', btnBg: '#607d8b', btnText: '#fff' },
    { id: 'rainbow', name: 'にじのそら', icon: '🌈', bg: '#f3e5f5', text: '#4a148c', btnBg: '#9c27b0', btnText: '#fff' },
    { id: 'sunset', name: 'ゆうやけ', icon: '🌇', bg: '#fbe9e7', text: '#d84315', btnBg: '#ff7043', btnText: '#fff' },
    { id: 'beach', name: 'トロピカルビーチ', icon: '🏖️', bg: '#e0f2f1', text: '#004d40', btnBg: '#26a69a', btnText: '#fff' },
    { id: 'cave', name: 'どうくつたんけん', icon: '🦇', bg: '#3e2723', text: '#d7ccc8', btnBg: '#795548', btnText: '#fff' },
    { id: 'savanna', name: 'サバンナ', icon: '🦁', bg: '#fff8e1', text: '#e65100', btnBg: '#ff9800', btnText: '#fff' },
    { id: 'penguin', name: 'ペンギンこおりやま', icon: '🐧', bg: '#e1f5fe', text: '#01579b', btnBg: '#03a9f4', btnText: '#fff' },
    { id: 'dino', name: 'きょうりゅうじだい', icon: '🦖', bg: '#f0f4c3', text: '#827717', btnBg: '#afb42b', btnText: '#fff' },
    { id: 'insect', name: 'むしとり', icon: '🦋', bg: '#f9fbe7', text: '#33691e', btnBg: '#c0ca33', btnText: '#fff' },
    { id: 'deepsea', name: 'しんかい', icon: '🦑', bg: '#000051', text: '#80d8ff', btnBg: '#00b0ff', btnText: '#fff' },
    { id: 'jungle', name: 'ジャングル', icon: '🐅', bg: '#1b5e20', text: '#c8e6c9', btnBg: '#388e3c', btnText: '#fff' },
    { id: 'nebula', name: 'うちゅうのせいうん', icon: '🌌', bg: '#12005e', text: '#ea80fc', btnBg: '#651fff', btnText: '#fff' },
    { id: 'frog', name: 'カエルのいけ', icon: '🐸', bg: '#e0f2f1', text: '#00695c', btnBg: '#00897b', btnText: '#fff' }
];

let EFFECTS =[
    {id:'default', name:'紙吹雪', icon:'🎉', emojis:[]},
    {id:'effect_star', name:'お星さま', icon:'🌟', emojis:['🌟', '⭐', '✨']},
    {id:'effect_heart', name:'ハート', icon:'💖', emojis:['💖', '💕', '💗']},
    {id:'effect_flower', name:'お花', icon:'🌸', emojis:['🌸', '💮', '🌺']},
    {id:'effect_snow', name:'ゆき', icon:'❄️', emojis:['❄️', '⛄', '🧊']},
    {id:'eff_spring', name:'さくらふぶき', icon:'🌸', emojis:['🌸', '💮', '🍃']},
    {id:'eff_sunflower', name:'ひまわり', icon:'🌻', emojis:['🌻', '✨', '💛']},
    {id:'eff_autumn', name:'もみじとはっぱ', icon:'🍁', emojis:['🍁', '🍂', '🍄']},
    {id:'eff_ice', name:'ゆきだるま', icon:'⛄', emojis:['⛄', '❄️', '🧊']},
    {id:'eff_volcano', name:'ほのお', icon:'🔥', emojis:['🔥', '💥', '🎇']},
    {id:'eff_forest', name:'もりのどうぶつ', icon:'🐻', emojis:['🐻', '🐰', '🦊']},
    {id:'eff_desert', name:'ヤシのき', icon:'🌴', emojis:['🌴', '🥥', '☀️']},
    {id:'eff_thunder', name:'かみなり', icon:'⚡', emojis:['⚡', '🌩️', '💧']},
    {id:'eff_rainbow', name:'にじとくも', icon:'🌈', emojis:['🌈', '☁️', '🕊️']},
    {id:'eff_sunset', name:'ゆうやけカラス', icon:'🌇', emojis:['🌇', '🐦', '🌆']},
    {id:'eff_beach', name:'うみのいきもの', icon:'🐠', emojis:['🐠', '🐬', '🐚']},
    {id:'eff_cave', name:'コウモリ', icon:'🦇', emojis:['🦇', '🕸️', '🌑']},
    {id:'eff_savanna', name:'サバンナのけもの', icon:'🦁', emojis:['🦁', '🦓', '🦒']},
    {id:'eff_penguin', name:'ペンギン', icon:'🐧', emojis:['🐧', '🐟', '❄️']},
    {id:'eff_dino', name:'きょうりゅう', icon:'🦖', emojis:['🦖', '🦕', '🌋']},
    {id:'eff_insect', name:'むし', icon:'🦋', emojis:['🦋', '🐞', '🐝']},
    {id:'eff_deepsea', name:'しんかい', icon:'🦑', emojis:['🦑', '🐙', '🫧']},
    {id:'eff_jungle', name:'トラとサル', icon:'🐅', emojis:['🐅', '🐒', '🍌']},
    {id:'eff_nebula', name:'ほしとつき', icon:'🌌', emojis:['⭐', '🌙', '🌠']},
    {id:'eff_frog', name:'カエルとたまじゃくし', icon:'🐸', emojis:['🐸', '💧', '🌿']}
];

let GACHA_ITEMS =[ { id: 'coin_50', type: 'coin', name: '💰 50コイン', rate: 0.40 } ];
let itemRate = 0.60 / ((THEMES.length - 1) + (EFFECTS.length - 1)); 
THEMES.forEach(t => { if(t.id !== 'default') GACHA_ITEMS.push({ id: 'theme_' + t.id, type: 'theme', name: `${t.icon} テーマ：${t.name}`, rate: itemRate }); });
EFFECTS.forEach(e => { if(e.id !== 'default') GACHA_ITEMS.push({ id: e.id, type: 'effect', name: `${e.icon} 演出：${e.name}`, rate: itemRate }); });

const VISION_STAGES =[
    { id: 'v1', title: 'じゅんばんタッチ', sub: 'めをすばやくうごかそう', icon: '🔢', color: '#2196F3' },
    { id: 'v2', title: 'まちがいさがし', sub: 'ちがうもじをみつけよう', icon: '🔍', color: '#FF9800' },
    { id: 'v3', title: 'ロックオン', sub: 'まとをマウスでおおいかけよう', icon: '🎯', color: '#F44336' },
    { id: 'v4', title: 'フラッシュきおく', sub: 'いっしゅんでおぼえよう', icon: '⚡', color: '#9C27B0' },
    { id: 'v5', title: 'さがしもの', sub: 'おなじえをぜんぶみつけよう', icon: '🍎', color: '#E91E63' },
    { id: 'v6', title: 'もぐらたたき', sub: 'でてきたらすぐクリック！', icon: '🔨', color: '#795548' },
    { id: 'v7', title: 'メモリーゲーム', sub: 'ひかったじゅんばんをおぼえよう', icon: '🧠', color: '#00BCD4' },
    { id: 'v8', title: 'なぞりめいろ', sub: 'みちからはみださないようにすすもう', icon: '〰️', color: '#4CAF50' },
    { id: 'v9', title: 'むきあてクイズ', sub: 'おなじむきのものをえらぼう', icon: '🔄', color: '#673AB7' }
];

function calculateGrade(birthdateStr) {
    if (!birthdateStr) return "学年未設定";
    const birthDate = new Date(birthdateStr);
    if (isNaN(birthDate.getTime())) return "学年未設定";

    const today = new Date();
    let currentYear = today.getFullYear();
    if (today.getMonth() + 1 < 4 || (today.getMonth() + 1 === 4 && today.getDate() === 1)) currentYear--;

    let bYear = birthDate.getFullYear();
    if (birthDate.getMonth() + 1 < 4 || (birthDate.getMonth() + 1 === 4 && birthDate.getDate() === 1)) bYear--;

    const diff = currentYear - bYear;
    if (diff < 7) return "未就学";
    if (diff >= 7 && diff <= 12) return `小学${diff - 6}年`;
    if (diff >= 13 && diff <= 15) return `中学${diff - 12}年`;
    if (diff >= 16 && diff <= 18) return `高校${diff - 15}年`;
    return "おとな";
}

function sortGrades(grades) {
    return grades.sort((a, b) => {
        let indexA = GRADE_ORDER.indexOf(a);
        let indexB = GRADE_ORDER.indexOf(b);
        if(indexA === -1) indexA = 999;
        if(indexB === -1) indexB = 999;
        return indexA - indexB;
    });
}

const KANA_MAP = {
    'あ':'A','い':'I','う':'U','え':'E','お':'O',
    'か':'KA','き':'KI','く':'KU','け':'KE','こ':'KO',
    'さ':'SA','し':'SHI','す':'SU','せ':'SE','そ':'SO',
    'た':'TA','ち':'CHI','つ':'TSU','て':'TE','と':'TO',
    'な':'NA','に':'NI','ぬ':'NU','ね':'NE','の':'NO',
    'は':'HA','ひ':'HI','ふ':'FU','へ':'HE','ほ':'HO',
    'ま':'MA','み':'MI','む':'MU','め':'ME','も':'MO',
    'や':'YA','ゆ':'YU','よ':'YO',
    'ら':'RA','り':'RI','る':'RU','れ':'RE','ろ':'RO',
    'わ':'WA','を':'WO','が':'GA','ぎ':'GI','ぐ':'GU','げ':'GE','ご':'GO',
    'ざ':'ZA','じ':'JI','ず':'ZU','ぜ':'ZE','ぞ':'ZO',
    'だ':'DA','ぢ':'JI','づ':'ZU','で':'DE','ど':'DO',
    'ば':'BA','び':'BI','ぶ':'BU','べ':'BE','ぼ':'BO',
    'ぱ':'PA','ぴ':'PI','ぷ':'PU','ぺ':'PE','ぽ':'PO',
    'きゃ':'KYA','きゅ':'KYU','きょ':'KYO','しゃ':'SHA','しゅ':'SHU','しょ':'SHO',
    'ちゃ':'CHA','ちゅ':'CHU','ちょ':'CHO','にゃ':'NYA','にゅ':'NYU','にょ':'NYO',
    'ひゃ':'HYA','ひゅ':'HYU','ひょ':'HYO','みゃ':'MYA','みゅ':'MYU','みょ':'MYO',
    'りゃ':'RYA','りゅ':'RYU','りょ':'RYO','ぎゃ':'GYA','ぎゅ':'GYU','ぎょ':'GYO',
    'じゃ':'JA','じゅ':'JU','じょ':'JO','びゃ':'BYA','びゅ':'BYU','びょ':'BYO',
    'ぴゃ':'PYA','ぴゅ':'PYU','ぴょ':'PYO','ふぁ':'FA','ふぃ':'FI','ふぇ':'FE','ふぉ':'FO',
    'てぃ':'TI','でぃ':'DI','ぁ':'LA','ぃ':'LI','ぅ':'LU','ぇ':'LE','ぉ':'LO',
    'ゃ':'LYA','ゅ':'LYU','ょ':'LYO','ー':'-'
};

function convertNameToRomaji(name) {
    if (!name) return 'NAME';
    let hira = name.replace(/[\u30a1-\u30f6]/g, match => String.fromCharCode(match.charCodeAt(0) - 0x60));
    let romaji = '';
    for (let i = 0; i < hira.length; i++) {
        let char2 = hira.substring(i, i+2);
        let char1 = hira.substring(i, i+1);
        let nextChar = i + 1 < hira.length ? hira.substring(i+1, i+2) : '';

        if (char1 === ' ' || char1 === '　') {
            romaji += ' ';
        } else if (char1 === 'ん') {
            const requireNN =['あ','い','う','え','お','な','に','ぬ','ね','の','や','ゆ','よ'].includes(nextChar) || nextChar === '';
            romaji += requireNN ? 'NN' : 'N';
        } else if (KANA_MAP[char2]) {
            romaji += KANA_MAP[char2];
            i++;
        } else if (char1 === 'っ' && nextChar) {
            let next2 = hira.substring(i+1, i+3);
            let next1 = hira.substring(i+1, i+2);
            let nextRomaji = KANA_MAP[next2] || KANA_MAP[next1];
            if (nextRomaji && /[A-Z]/.test(nextRomaji[0]) && !/^[AEIOU]/.test(nextRomaji[0])) {
                romaji += nextRomaji[0]; 
            } else {
                romaji += 'LTU';
            }
        } else if (KANA_MAP[char1]) {
            romaji += KANA_MAP[char1];
        } else {
            romaji += char1.toUpperCase();
        }
    }
    return romaji || 'NAME';
}

const FINGER_MAP = {
    '1':'l-pinky','Q':'l-pinky','A':'l-pinky','Z':'l-pinky','2':'l-ring','W':'l-ring','S':'l-ring','X':'l-ring','3':'l-middle','E':'l-middle','D':'l-middle','C':'l-middle','4':'l-index','R':'l-index','F':'l-index','V':'l-index','5':'l-index','T':'l-index','G':'l-index','B':'l-index','6':'r-index','Y':'r-index','H':'r-index','N':'r-index','7':'r-index','U':'r-index','J':'r-index','M':'r-index','8':'r-middle','I':'r-middle','K':'r-middle',',':'r-middle','9':'r-ring','O':'r-ring','L':'r-ring','.':'r-ring','0':'r-pinky','P':'r-pinky',';':'r-pinky','/':'r-pinky','-':'r-pinky','@':'r-pinky',':':'r-pinky','^':'r-pinky','SPACE':'thumb'
};
const FINGER_HOME_MAP = {'l-pinky':'A','l-ring':'S','l-middle':'D','l-index':'F','r-index':'J','r-middle':'K','r-ring':'L','r-pinky':';','thumb':'SPACE'};
const COLOR_CLASS_MAP = {'thumb':'color-thumb','l-index':'color-index','r-index':'color-index','l-middle':'color-middle','r-middle':'color-middle','l-ring':'color-ring','r-ring':'color-ring','l-pinky':'color-pinky','r-pinky':'color-pinky'};

const KEYBOARD_STAGES =[
    {id:1001,keys:['F','J','SPACE'],title:'人差し指(ホーム)'},{id:1002,keys:['D','K','SPACE'],title:'中指(ホーム)'},{id:1003,keys:['S','L','SPACE'],title:'薬指(ホーム)'},{id:1004,keys:['A',';','SPACE'],title:'小指(ホーム)'},{id:1005,keys:['G','H','SPACE'],title:'人差し指(うち)'},
    {id:1006,keys:['R','U','SPACE'],title:'人差し指(うえ)'},{id:1007,keys:['E','I','SPACE'],title:'中指(うえ)'},{id:1008,keys:['W','O','SPACE'],title:'薬指(うえ)'},{id:1009,keys:['Q','P','SPACE'],title:'小指(うえ)'},{id:1010,keys:['T','Y','SPACE'],title:'人差し指(遠うえ)'},
    {id:1011,keys:['V','M','SPACE'],title:'人差し指(した)'},{id:1012,keys:['C',',','SPACE'],title:'中指(した)'},{id:1013,keys:['X','.','SPACE'],title:'薬指(した)'},{id:1014,keys:['Z','/','SPACE'],title:'小指(した)'},{id:1015,keys:['B','N','SPACE'],title:'人差し指(遠した)'},
    {id:1016,keys:['4','7','SPACE'],title:'人差し指(数)'},{id:1017,keys:['3','8','SPACE'],title:'中指(数)'},{id:1018,keys:['2','9','SPACE'],title:'薬指(数)'},{id:1019,keys:['1','0','SPACE'],title:'小指(数)'},{id:1020,keys:['5','6','-','SPACE'],title:'人差/小(遠数)'}
];
const BLIND_STAGES =[
    {id:2001,title:'ホーム(練)',ref:'home',type:'practice'},{id:2101,title:'ホーム(試)',ref:'home',type:'exam'},
    {id:2002,title:'上段(練)',ref:'top',type:'practice'},{id:2102,title:'上段(試)',ref:'top',type:'exam'},
    {id:2003,title:'下段(練)',ref:'bottom',type:'practice'},{id:2103,title:'下段(試)',ref:'bottom',type:'exam'},
    {id:2004,title:'数字(練)',ref:'number',type:'practice'},{id:2104,title:'数字(試)',ref:'number',type:'exam'}
];
const BRIDGE_STAGES =[
    {id:1051,title:'ホーム総復習',keys:[],refChapter:'home'},{id:1052,title:'上段総復習',keys:[],refChapter:'top'},{id:1053,title:'下段総復習',keys:[],refChapter:'bottom'},{id:1054,title:'数字総復習',keys:[],refChapter:'number'}
];
const HIRAGANA_DATA =[
    {id:3001,title:'あ行',chars:[{h:'あ',r:['A']},{h:'い',r:['I']},{h:'う',r:['U']},{h:'え',r:['E']},{h:'お',r:['O']}]},
    {id:3002,title:'か行',chars:[{h:'か',r:['KA']},{h:'き',r:['KI']},{h:'く',r:['KU']},{h:'け',r:['KE']},{h:'こ',r:['KO']}]},
    {id:3003,title:'さ行',chars:[{h:'さ',r:['SA']},{h:'し',r:['SHI','SI']},{h:'す',r:['SU']},{h:'せ',r:['SE']},{h:'そ',r:['SO']}]},
    {id:3004,title:'た行',chars:[{h:'た',r:['TA']},{h:'ち',r:['CHI','TI']},{h:'つ',r:['TSU','TU']},{h:'て',r:['TE']},{h:'と',r:['TO']}]},
    {id:3005,title:'な行',chars:[{h:'な',r:['NA']},{h:'に',r:['NI']},{h:'ぬ',r:['NU']},{h:'ね',r:['NE']},{h:'の',r:['NO']}]},
    {id:3006,title:'は行',chars:[{h:'は',r:['HA']},{h:'ひ',r:['HI']},{h:'ふ',r:['FU','HU']},{h:'へ',r:['HE']},{h:'ほ',r:['HO']}]},
    {id:3007,title:'ま行',chars:[{h:'ま',r:['MA']},{h:'み',r:['MI']},{h:'む',r:['MU']},{h:'め',r:['ME']},{h:'も',r:['MO']}]},
    {id:3008,title:'や行',chars:[{h:'や',r:['YA']},{h:'ゆ',r:['YU']},{h:'よ',r:['YO']}]},
    {id:3009,title:'ら行',chars:[{h:'ら',r:['RA']},{h:'り',r:['RI']},{h:'る',r:['RU']},{h:'れ',r:['RE']},{h:'ろ',r:['RO']}]},
    {id:3010,title:'わ行',chars:[{h:'わ',r:['WA']},{h:'を',r:['WO']},{h:'ん',r:['NN']}]},
    {id:3011,title:'が行',chars:[{h:'が',r:['GA']},{h:'ぎ',r:['GI']},{h:'ぐ',r:['GU']},{h:'げ',r:['GE']},{h:'ご',r:['GO']}]},
    {id:3012,title:'ざ行',chars:[{h:'ざ',r:['ZA']},{h:'じ',r:['JI','ZI']},{h:'ず',r:['ZU']},{h:'ぜ',r:['ZE']},{h:'ぞ',r:['ZO']}]},
    {id:3013,title:'だ行',chars:[{h:'だ',r:['DA']},{h:'ぢ',r:['DI','JI']},{h:'づ',r:['DU','ZU']},{h:'で',r:['DE']},{h:'ど',r:['DO']}]},
    {id:3014,title:'ば行',chars:[{h:'ば',r:['BA']},{h:'び',r:['BI']},{h:'ぶ',r:['BU']},{h:'べ',r:['BE']},{h:'ぼ',r:['BO']}]},
    {id:3015,title:'ぱ行',chars:[{h:'ぱ',r:['PA']},{h:'ぴ',r:['PI']},{h:'ぷ',r:['PU']},{h:'ぺ',r:['PE']},{h:'ぽ',r:['PO']}]}
];

const ADVICE_HINT_MAP = {
    'F':1001,'J':1001,'D':1002,'K':1002,'S':1003,'L':1003,'A':1004,';':1004,'G':1005,'H':1005,
    'R':1006,'U':1006,'E':1007,'I':1007,'W':1008,'O':1008,'Q':1009,'P':1009,'T':1010,'Y':1010,
    'V':1011,'M':1011,'C':1012,',':1012,'X':1013,'.':1013,'Z':1014,'/':1014,'B':1015,'N':1015,
    '4':1016,'7':1016,'3':1017,'8':1017,'2':1018,'9':1018,'1':1019,'0':1019,'5':1020,'6':1020,'-':1020
};
HIRAGANA_DATA.forEach(d=>{d.chars.forEach(c=>{ADVICE_HINT_MAP[c.h]=d.id;})});

const WORD_DATA =[
    { id: 4001, title: 'どうぶつ', chars:[{h:'いぬ', r:['INU']}, {h:'ねこ', r:['NEKO']}, {h:'くま', r:['KUMA']}, {h:'うさぎ', r:['USAGI']}, {h:'さる', r:['SARU']}, {h:'きりん', r:['KIRINN']}, {h:'ぞう', r:['ZOU']}, {h:'らいおん', r:['RAIONN']}]},
    { id: 4002, title: 'たべもの', chars:[{h:'りんご', r:['RINGO', 'RINNGO']}, {h:'みかん', r:['MIKANN']}, {h:'いちご', r:['ITIGO', 'ICHIGO']}, {h:'すいか', r:['SUIKA']}, {h:'ぶどう', r:['BUDOU']}, {h:'ばなな', r:['BANANA']}, {h:'めろん', r:['MERONN']}]},
    { id: 4003, title: 'のりもの', chars:[{h:'くるま', r:['KURUMA']}, {h:'でんしゃ', r:['DENSHA','DENSYA','DENNSHA','DENNSYA']}, {h:'ひこうき', r:['HIKOUKI']}, {h:'ふね', r:['HUNE', 'FUNE']}, {h:'じてんしゃ', r:['ZITENSHA','JITENSHA','ZITENSYA','JITENSYA','ZITENNSHA','JITENNSHA','ZITENNSYA','JITENNSYA','ZITENSIXYA','JITENSIXYA','ZITENSILYA','JITENSILYA','ZITENSHIXYA','JITENSHIXYA','ZITENSHILYA','JITENSHILYA']}, {h:'ばす', r:['BASU']}]},
    { id: 4004, title: 'がっこう', chars:[{h:'つくえ', r:['TUKUE', 'TSUKUE']}, {h:'いす', r:['ISU']}, {h:'えんぴつ', r:['ENPITU', 'ENPITSU', 'ENNPITU', 'ENNPITSU']}, {h:'けしごむ', r:['KESIGOMU', 'KESHIGOMU']}, {h:'はさみ', r:['HASAMI']}, {h:'せんせい', r:['SENSEI', 'SENNSEI']}]},
    { id: 4005, title: '「ん」のれんしゅう', chars:[{h:'しんぶん', r:['SINBUNN', 'SHINBUNN', 'SINNBUNN', 'SHINNBUNN']},{h:'みんな', r:['MINNNA']}, {h:'にんじん', r:['NINZINN', 'NINJINN', 'NINNZINN', 'NINNJINN']},{h:'てんき', r:['TENKI', 'TENNKI']},{h:'こんにゃく', r:['KONNNYAKU']}]},
    { id: 4006, title: '「っ」のれんしゅう', chars:[{h:'がっこう', r:['GAKKOU', 'GALTUKOU', 'GAXTUKOU', 'GALTSUKOU', 'GAXTSUKOU']},{h:'きっぷ', r:['KIPPU', 'KILTUPU', 'KIXTUPU']},{h:'らっぱ', r:['RAPPA', 'RALTUPA', 'RAXTUPA']},{h:'きって', r:['KITTE', 'KILTUTE', 'KIXTUTE']},{h:'ざっし', r:['ZASSI', 'ZASSHI', 'ZALTUSI', 'ZAXTUSI', 'ZALTUSHI', 'ZAXTUSHI']}]},
    { id: 4007, title: '「ゃ・ゅ・ょ」', chars:[{h:'きんぎょ', r:['KINGYO', 'KINNGYO']},{h:'じどうしゃ', r:['ZIDOUSHA','JIDOUSHA','ZIDOUSYA','JIDOUSYA']},{h:'きゅうり', r:['KYUURI']},{h:'ひゃく', r:['HYAKU']},{h:'きょうりゅう', r:['KYOURYUU','KYOURYUXYUU','KYOURYULYUU']}]},
    { id: 4008, title: '「ー」ばすおと', chars:[{h:'けーき', r:['KE-KI']},{h:'すーぱー', r:['SU-PA-']},{h:'こーひー', r:['KO-HI-']},{h:'すぽーつ', r:['SUPO-TU', 'SUPO-TSU']},{h:'のーと', r:['NO-TO']}]},
    { id: 4009, title: 'とどうふけん', chars:[{h:'ほっかいどう', r:['HOKKAIDOU', 'HOLTUKAIDOU']},{h:'とうきょう', r:['TOUKYOU']},{h:'おおさか', r:['OOSAKA']},{h:'ふくおか', r:['HUKUOKA', 'FUKUOKA']},{h:'おきなわ', r:['OKINAWA']}]},
    { id: 4010, title: 'えいたんご', chars:[{h:'ＡＰＰＬＥ(りんご)', r:['APPLE']},{h:'ＢＯＯＫ(ほん)', r:['BOOK']},{h:'ＤＯＧ(いぬ)', r:['DOG']},{h:'ＣＡＴ(ねこ)', r:['CAT']},{h:'ＰＬＡＹ(あそぶ)', r:['PLAY']}]}
];

const EXAMS =[
    {id:1101, title:'ホーム試験', gold: 30, silver: 45},{id:1102, title:'上段試験', gold: 35, silver: 50},{id:1103, title:'下段試験', gold: 35, silver: 50},{id:1104, title:'数字試験', gold: 40, silver: 60},
    {id:3301, title:'あ～さ試験', gold: 40, silver: 60},{id:3302, title:'た～は試験', gold: 40, silver: 60},{id:3303, title:'ま～ん試験', gold: 50, silver: 70},{id:3304, title:'濁点試験', gold: 70, silver: 100},
    {id:4101, title:'ことばまとめ(基本)', gold: 60, silver: 90},{id:4102, title:'ことばまとめ(特殊)', gold: 60, silver: 90},{id:4103, title:'ことばまとめ(レベルアップ)', gold: 60, silver: 90},
    {id:1999, title:'総合試験(きほん)', gold: 100, silver: 150},
    {id:2999, title:'総合試験(ブラインド)', gold: 120, silver: 180},
    {id:3999, title:'総合試験(ひらがな)', gold: 150, silver: 200},
    {id:4999, title:'総合試験(ことば)', gold: 150, silver: 200}
];

const STAGE_ORDER =[
    1001,1002,1003,1004,1005, 1051, 1101, 1006,1007,1008,1009,1010, 1052, 1102, 1011,1012,1013,1014,1015, 1053, 1103, 1016,1017,1018,1019,1020, 1054, 1104, 1999,
    2001,2101,2002,2102,2003,2103,2004,2104, 2999,
    3001,3101,3201,3002,3102,3202,3003,3103,3203,3301, 3004,3104,3204,3005,3105,3205,3006,3106,3206,3302,
    3007,3107,3207,3008,3108,3208,3009,3109,3209,3010,3110,3210,3303, 3011,3111,3211,3012,3112,3212,3013,3113,3213,3014,3114,3214,3015,3115,3215,3304, 3999,
    4001,4002,4003,4004,4101, 4005,4006,4007,4008,4102, 4009,4010,4103, 4999
];

const KB_CHAPTERS =[
    {id:'home',title:'ホームポジション編',stages:[1001,1002,1003,1004,1005],bridge:1051,exam:1101},
    {id:'top',title:'上の段編',stages:[1006,1007,1008,1009,1010],bridge:1052,exam:1102},
    {id:'bottom',title:'下の段編',stages:[1011,1012,1013,1014,1015],bridge:1053,exam:1103},
    {id:'number',title:'数字の段編',stages:[1016,1017,1018,1019,1020],bridge:1054,exam:1104},
    {id:'blind',title:'ブラインドタッチ',stages:[2001,2101,2002,2102,2003,2103,2004,2104],bridge:null,exam:null},
    {id:'h_1',title:'ひらがな(あ〜さ)',stages:[3001,3101,3201,3002,3102,3202,3003,3103,3203],bridge:null,exam:3301},
    {id:'h_2',title:'ひらがな(た〜は)',stages:[3004,3104,3204,3005,3105,3205,3006,3106,3206],bridge:null,exam:3302},
    {id:'h_3',title:'ひらがな(ま〜ん)',stages:[3007,3107,3207,3008,3108,3208,3009,3109,3209,3010,3110,3210],bridge:null,exam:3303},
    {id:'h_4',title:'ひらがな(濁点)',stages:[3011,3111,3211,3012,3112,3212,3013,3113,3213,3014,3114,3214,3015,3115,3215],bridge:null,exam:3304},
    {id:'word1',title:'ことばのれんしゅう(きほん)',stages:[4001,4002,4003,4004],bridge:null,exam:4101}, 
    {id:'word2',title:'ことばのれんしゅう(とくしゅ)',stages:[4005,4006,4007,4008],bridge:null,exam:4102},
    {id:'word3',title:'ことばのれんしゅう(レベルアップ)',stages:[4009,4010],bridge:null,exam:4103}
];

const KB_LAYOUT = [['1','2','3','4','5','6','7','8','9','0','-'],['Q','W','E','R','T','Y','U','I','O','P'],['A','S','D','F','G','H','J','K','L',';'],['Z','X','C','V','B','N','M',',','.','/'],['SPACE']];

/* =========================================================
   [JS] 3. ユーザー管理 (GAS連携)
   ========================================================= */
let users = {};
let currentUser = null;
let currentSelectedGrade = null; 

async function loadUsers() {
    const titleScreen = document.getElementById('screen-title');
    if (!titleScreen.querySelector('.loading-msg')) {
        titleScreen.querySelector('.screen-content').insertAdjacentHTML('beforeend', '<div class="loading-msg" style="color:#555; font-size:20px; margin-top:20px;">データをよみこんでいます... 🔄</div>');
    }

    try {
        // ★修正: テストモードの時はURLに「?dev=1」をつけ、GASのテスト用シートから読み込む
        const url = SCRIPT_URL + (IS_DEV_MODE ? '?dev=1' : '');
        const response = await fetch(url);
        const data = await response.json();
        const localDataStr = localStorage.getItem(STORAGE_KEY);
        let localUsers = null;
        if (localDataStr) { try { localUsers = JSON.parse(localDataStr); } catch(err) {} }

        if(data && Object.keys(data).length > 0) {
            if (localUsers) {
                for (let n in localUsers) {
                    if (!data[n]) {
                        data[n] = localUsers[n];
                    } else {
                        // ★修正: 末尾に 'wordProgress' を追加し、Wordの進捗データが消えないように保護
                        const props =['coins', 'items', 'tickets', 'activeEffect', 'textRecords', 'textTasks', 'dChallengeHighscore', 'minigameHighscore', 'examRecords', 'globalMistakes', 'ticketHistory', 'loginStamps', 'visionCleared', 'currentWeakKeys', 'group', 'wordProgress'];
                        props.forEach(p => {
                            if (data[n][p] === undefined && localUsers[n][p] !== undefined) {
                                data[n][p] = localUsers[n][p];
                            }
                        });
                    }
                }
            }
            users = data; localStorage.setItem(STORAGE_KEY, JSON.stringify(users)); 
        } else {
            if (localUsers) users = localUsers;
        }
    } catch(e) {
        console.error("通信エラー", e);
        const d = localStorage.getItem(STORAGE_KEY);
        if (d) { try { let parsed = JSON.parse(d); if (parsed) users = parsed; } catch(err) {} }
    }
    if (!users || typeof users !== 'object') users = {};
    if (typeof loadCustomGlobalSettings === 'function') loadCustomGlobalSettings();

    const loadingMsg = titleScreen.querySelector('.loading-msg');
    if (loadingMsg) loadingMsg.remove();
}

async function saveUsers(forceOverwrite = false) {
    if (!users || typeof users !== 'object') users = {};
    localStorage.setItem(STORAGE_KEY, JSON.stringify(users));
    updateGlobalHeader(); 
    
    if (!navigator.onLine) { document.getElementById('sync-status').innerText = '☁️❌'; return; }
    document.getElementById('sync-status').innerText = '☁️🔄'; 

    try {
        let payload;
        if (forceOverwrite) {
            // ★修正: 全件上書き時にもテストモードフラグを含めて送信する
            payload = { action: 'overwrite_all', users: users, isDevMode: IS_DEV_MODE };
        } else {
            // ★修正: 個別更新時にもテストモードフラグを含めて送信する
            payload = {
                action: 'update_single',
                currentUser: currentUser,
                userData: currentUser ? users[currentUser] : null,
                globalData: users['__GLOBAL_SETTINGS__'] || null,
                isDevMode: IS_DEV_MODE
            };
            // 他のPCの最新データを読み込む際も、テストモードならテスト環境から読み込む
            const url = SCRIPT_URL + (IS_DEV_MODE ? '?dev=1' : '');
            fetch(url)
                .then(res => res.json())
                .then(latestUsers => {
                    if (latestUsers && typeof latestUsers === 'object') {
                        for (let name in latestUsers) {
                            if (name !== currentUser && name !== '__GLOBAL_SETTINGS__') {
                                users[name] = latestUsers[name];
                            }
                        }
                        localStorage.setItem(STORAGE_KEY, JSON.stringify(users));
                    }
                }).catch(e => console.error("データ同期エラー:", e));
        }

        // 保存（POST送信）
        fetch(SCRIPT_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain' },
            body: JSON.stringify(payload)
        }).then(() => {
            document.getElementById('sync-status').innerText = '☁️✅'; 
        }).catch(e => { console.error("送信エラー:", e); document.getElementById('sync-status').innerText = '☁️❌'; });

    } catch (e) { console.error("保存エラー:", e); document.getElementById('sync-status').innerText = '☁️❌'; }
}

function goToGradeSelect() { renderGradeList(); showScreen('screen-grade'); }

function renderGradeList() {
    const gradeList = document.getElementById('grade-list'); gradeList.innerHTML = '';
    const existingGrades = new Set();
    Object.keys(users).forEach(n => { if(!users[n].isMaster && n !== '__GLOBAL_SETTINGS__') existingGrades.add(calculateGrade(users[n].birthdate || users[n].birth)); });
    const sortedGrades = sortGrades(Array.from(existingGrades));
    
    if(sortedGrades.length === 0) {
        gradeList.innerHTML = '<p style="font-size:24px;">ユーザーが登録されていません。<br>右下の「管理者」からユーザーを追加してください。</p>';
        return;
    }
    sortedGrades.forEach(grade => {
        const btn = document.createElement('div'); btn.className = 'grade-card'; btn.innerText = grade;
        btn.onclick = () => { currentSelectedGrade = grade; renderUserList(grade); showScreen('screen-login'); };
        gradeList.appendChild(btn);
    });
}

function renderUserList(grade) {
    const userList = document.getElementById('user-list'); userList.innerHTML = '';
    document.getElementById('login-grade-title').innerText = `${grade} の なまえをえらんでね`;
    Object.keys(users).forEach(n => {
        if(!users[n].isMaster && n !== '__GLOBAL_SETTINGS__' && calculateGrade(users[n].birthdate) === grade) {
            const btn = document.createElement('div'); btn.className = 'user-card'; btn.innerText = n;
            btn.onclick = () => login(n); userList.appendChild(btn);
        }
    });
}

function login(n) {
    currentUser = n;
    if(!users[n]) users[n] = {};
    if(users[n].mouseLevel===undefined) users[n].mouseLevel=0;
    if(users[n].keyboardSequence===undefined) users[n].keyboardSequence=0;
    if(users[n].examRecords===undefined) users[n].examRecords={};
    if(users[n].textRecords===undefined) users[n].textRecords={}; 
    if(users[n].globalMistakes===undefined) users[n].globalMistakes={};
    if(users[n].theme===undefined) users[n].theme='default';
    if(users[n].birthdate===undefined) users[n].birthdate='';
    if(users[n].loginStamps===undefined) users[n].loginStamps=[];
    if(users[n].minigameHighscore===undefined) users[n].minigameHighscore=0;
    if(users[n].dChallengeHighscore===undefined) users[n].dChallengeHighscore=0;
    if(users[n].coins === undefined) users[n].coins = 0;           
    if(users[n].items === undefined) users[n].items =[];          
    if(users[n].tickets === undefined) users[n].tickets =[];      
    if(users[n].activeEffect === undefined) users[n].activeEffect = 'default'; 
    
    applyTheme(users[n].theme);
    document.getElementById('welcome-msg').innerText = `ようこそ、${n} さん`;

    updateGlobalHeader(); 
    updateHomeDashboard(); 

    const today = new Date().toISOString().split('T')[0];
    if (!users[n].loginStamps.includes(today) && !users[n].isMaster) {
        users[n].loginStamps.push(today);
        users[n].coins += 100; 
        saveUsers(false);
        showStampOverlay();
    } else {
        showScreen('screen-category');
    }
}

function showStampOverlay() {
    SoundManager.init(); SoundManager.playClear(); createConfetti();
    document.getElementById('stamp-count').innerText = users[currentUser].loginStamps.length;
    document.getElementById('stamp-overlay').style.display = 'flex';
}
function closeStampOverlay() {
    document.getElementById('stamp-overlay').style.display = 'none';
    showScreen('screen-category');
}

/* =========================================================
   [JS] 4. 管理者 (Admin) ＆ 成績表示（修正版）
   ========================================================= */
let passwordCallback = null;
function showPasswordModal(title, callback) {
    const modal = document.getElementById('password-modal');
    if (!modal) { alert("パスワード機能の準備ができていません"); return; }
    document.getElementById('password-modal-title').innerText = title;
    document.getElementById('password-input').value = '';
    modal.style.display = 'flex';
    setTimeout(() => document.getElementById('password-input').focus(), 100);
    passwordCallback = callback;
}
function closePasswordModal() {
    document.getElementById('password-modal').style.display = 'none';
    passwordCallback = null;
}
function submitPassword() {
    const pass = document.getElementById('password-input').value;
    const callback = passwordCallback; 
    closePasswordModal();
    if (callback) callback(pass); 
}

window.addEventListener('DOMContentLoaded', () => {
    const pwdInput = document.getElementById('password-input');
    if(pwdInput) {
        pwdInput.addEventListener('keydown', function(e) {
            if (e.key === 'Enter') submitPassword();
        });
    }
});

function adminAddUser() {
    const name = document.getElementById('admin-add-name').value.trim();
    const birth = document.getElementById('admin-add-birth').value;
    const grp = document.getElementById('admin-add-group').value.trim(); 
    if(!name) return alert("名前を入力してください");
    if(users[name]) return alert("その名前はすでに登録されています");
    if(!birth) return alert("生年月日を入力してください");
    const grade = calculateGrade(birth);
    users[name] = { birthdate: birth, grade: grade, mouseLevel: 1, keyboardSequence: 0, coins: 0, items: [], tickets:[], loginStamps:[], group: grp };
    saveUsers(true);
    document.getElementById('admin-add-name').value = '';
    document.getElementById('admin-add-group').value = '';
    updateAdminUserTable(); renderDashboardTable(); alert(`${name} さんを追加しました！`);
}

function adminBulkAddUsers() {
    const text = document.getElementById('admin-bulk-names').value;
    if(!text.trim()) return alert("入力してください");
    const lines = text.split('\n');
    let added = 0;
    lines.forEach(line => {
        if(!line.trim()) return;
        let parts = line.split(/[,、]+/);
        let name = parts[0].trim();
        let birth = parts.length > 1 ? parts[1].trim() : "2015-04-01";
        let grp = parts.length > 2 ? parts[2].trim() : ""; 
        if(name && !users[name]) {
            let grade = calculateGrade(birth);
            users[name] = { birthdate: birth, grade: grade, mouseLevel: 1, keyboardSequence: 0, coins: 0, items: [], tickets:[], loginStamps:[], group: grp };
            added++;
        }
    });
    saveUsers(true); updateAdminUserTable(); renderDashboardTable();
    document.getElementById('admin-bulk-names').value = '';
    alert(`${added} 人を追加しました！`);
}

function adminDeleteUser() {
    const n = getSelUser();
    if(n && confirm(`${n}を削除しますか？`)) { 
        delete users[n]; saveUsers(true); updateAdminUserTable(); renderDashboardTable();
    }
}
function adminAddCoins() { 
    const n = getSelUser(); 
    if (!n || !users[n]) return alert('ユーザーを選択してください'); 
    const amt = parseInt(document.getElementById('admin-custom-coin-amount').value, 10);
    if(isNaN(amt) || amt <= 0) return alert('正しいコイン数を入力してください');
    users[n].coins = (users[n].coins || 0) + amt; 
    saveUsers(true); 
    alert(`${n} さんに ${amt} コインを付与しました！\n（現在のコイン: ${users[n].coins}枚）`); 
}

function showAdminSection(secId) {
    document.getElementById('admin-main-menu').style.display = 'none';
    document.getElementById('admin-panel-content').style.display = 'flex';
    document.getElementById('admin-bottom-back-btn').style.display = 'none'; 
    document.querySelectorAll('.admin-section').forEach(sec => sec.style.display = 'none');
    const target = document.getElementById(secId);
    if(target) {
        target.style.display = 'flex';
        target.style.flexDirection = 'column';
        if(secId === 'admin-sec-dashboard') switchDashTab('basic'); 
    }
}

function backToAdminMenu() {
    document.getElementById('admin-main-menu').style.display = 'flex';
    document.getElementById('admin-panel-content').style.display = 'none';
    document.getElementById('admin-bottom-back-btn').style.display = 'block';
}

function openAdmin() { 
    showPasswordModal('管理者パスワード', (pass) => {
        if(pass === ADMIN_PASS) { 
            updateAdminUserTable(); 
            renderAdminTextTasks(); 
            renderTicketAdmin(); 
            backToAdminMenu();
            showScreen('screen-admin'); 
        } else { alert('パスワードが違います'); }
    });
}

function renderTicketAdmin() {
    const glob = users['__GLOBAL_SETTINGS__'];
    if(!glob.ticketConfig) glob.ticketConfig = { normal: { name: '👍 いいねポイント 5こ', icon: '🎟️' }, newRecord: { name: '👍 いいねポイント 1こ', icon: '🎟️' } };
    document.getElementById('admin-ticket-normal').value = glob.ticketConfig.normal.name;
    document.getElementById('admin-ticket-newrecord').value = glob.ticketConfig.newRecord.name;

    const histList = document.getElementById('admin-ticket-history');
    if(!histList) return; histList.innerHTML = '';
    let allHistory =[];
    Object.keys(users).forEach(n => {
        if (!users[n].isMaster && n !== '__GLOBAL_SETTINGS__' && users[n].ticketHistory) {
            users[n].ticketHistory.forEach(h => { allHistory.push({ user: n, ticketName: h.ticketName, date: h.date, timestamp: h.timestamp }); });
        }
    });
    allHistory.sort((a, b) => b.timestamp - a.timestamp);
    if(allHistory.length === 0) { histList.innerHTML = '<li style="color:#999;">まだ履歴がありません</li>'; } 
    else {
        allHistory.slice(0, 30).forEach(h => {
            const li = document.createElement('li');
            li.style.borderBottom = "1px dotted #ccc"; li.style.padding = "8px 0";
            li.innerHTML = `<span style="color:#666; font-size:14px;">${h.date}</span><br><b>【${h.user}】</b>さんが「<span style="color:#E91E63;">${h.ticketName}</span>」を使用しました。`;
            histList.appendChild(li);
        });
    }
}

function saveTicketSettings() {
    const nName = document.getElementById('admin-ticket-normal').value.trim();
    const rName = document.getElementById('admin-ticket-newrecord').value.trim();
    if(!nName || !rName) return alert('チケット名を入力してください');
    if (!users['__GLOBAL_SETTINGS__']) users['__GLOBAL_SETTINGS__'] = { isMaster:true };
    if (!users['__GLOBAL_SETTINGS__'].ticketConfig) users['__GLOBAL_SETTINGS__'].ticketConfig = { normal:{icon:'🎟️'}, newRecord:{icon:'🎟️'} };
    users['__GLOBAL_SETTINGS__'].ticketConfig.normal.name = nName; users['__GLOBAL_SETTINGS__'].ticketConfig.newRecord.name = rName;
    saveUsers(true); alert('チケット設定を保存しました！');
}

function getSelUser() { const r = document.querySelector('input[name="asel"]:checked'); return r ? r.value : null; }
function adminResetUser() { const n = getSelUser(); if(n && confirm('リセットしますか？')) { users[n].mouseLevel=0; users[n].keyboardSequence=0; users[n].examRecords={}; users[n].textRecords={}; users[n].globalMistakes={}; users[n].theme='default'; saveUsers(true); updateAdminUserTable(); } }
function adminForceProgress() { const n = getSelUser(); if(n && confirm('全開放しますか？')) { users[n].mouseLevel=7; users[n].keyboardSequence=STAGE_ORDER.length; saveUsers(true); updateAdminUserTable(); } }
function adminCreateMasterUser() { users['Master_Debug'] = { mouseLevel:7, keyboardSequence:999, examRecords:{}, textRecords:{}, globalMistakes:{}, theme:'default', birthdate:'', isMaster:true }; saveUsers(true); updateAdminUserTable(); alert('マスターユーザーを作成しました'); }
function playAsMaster() { if (!users['Master_Debug']) { alert('先にマスター作成ボタンを押してください。'); return; } document.getElementById('screen-admin').classList.remove('active'); login('Master_Debug'); }

let editTargetUser = null;
function openEditProgress() {
    const n = getSelUser(); if (!n) return alert('ユーザーを選択してください');
    editTargetUser = n; document.getElementById('edit-modal-title').innerText = `${n} さんの進捗編集`;
    document.getElementById('edit-mouse-level').value = users[n].mouseLevel || 0;
    const kbSelect = document.getElementById('edit-keyboard-seq'); kbSelect.innerHTML = `<option value="0">0: 初期状態</option>`;
    STAGE_ORDER.forEach((sid, idx) => { kbSelect.innerHTML += `<option value="${idx + 1}">${idx + 1}: ${getStageName(sid)} までクリア済</option>`; });
    kbSelect.value = users[n].keyboardSequence || 0; 
    const itemsContainer = document.getElementById('edit-items-container'); itemsContainer.innerHTML = '';
    const userItems = users[n].items ||[];
    let allCollectibles =[];
    THEMES.forEach(t => { if(t.id !== 'default') allCollectibles.push({ id: t.isCustom ? t.id : 'theme_' + t.id, name: '🎨 ' + t.name }); });
    EFFECTS.forEach(e => { if(e.id !== 'default') allCollectibles.push({ id: e.id, name: '🎉 ' + e.name }); });
    if (allCollectibles.length === 0) { itemsContainer.innerHTML = '<span style="color:#999;">ガチャアイテムがまだシステムにありません</span>'; } 
    else {
        allCollectibles.forEach(item => {
            const isOwned = userItems.includes(item.id) || (item.id.startsWith('theme_') && userItems.includes(item.id.replace('theme_', '')));
            const lbl = document.createElement('label'); lbl.style.cssText = 'display:inline-block; background:#fff; border:1px solid #ccc; padding:5px 10px; border-radius:20px; cursor:pointer; user-select:none; font-size:14px;';
            lbl.innerHTML = `<input type="checkbox" value="${item.id}" class="edit-item-cb" ${isOwned ? 'checked' : ''} style="margin-right:5px; transform:scale(1.2); cursor:pointer;">${item.name}`;
            itemsContainer.appendChild(lbl);
        });
    }
    document.getElementById('admin-edit-modal').style.display = 'flex';
}
function closeEditProgress() { document.getElementById('admin-edit-modal').style.display = 'none'; editTargetUser = null; }

function saveEditProgress() {
    if (!editTargetUser) return;
    users[editTargetUser].mouseLevel = parseInt(document.getElementById('edit-mouse-level').value, 10);
    users[editTargetUser].keyboardSequence = parseInt(document.getElementById('edit-keyboard-seq').value, 10);
    const cbs = document.querySelectorAll('.edit-item-cb'); let newItems =[];
    cbs.forEach(cb => { if (cb.checked) newItems.push(cb.value); }); users[editTargetUser].items = newItems;
    let currentThemeCheckId = THEMES.find(t=>t.id === users[editTargetUser].theme)?.isCustom ? users[editTargetUser].theme : 'theme_' + users[editTargetUser].theme;
    if(users[editTargetUser].theme !== 'default' && !newItems.includes(currentThemeCheckId) && !newItems.includes(users[editTargetUser].theme)) { users[editTargetUser].theme = 'default'; }
    if(users[editTargetUser].activeEffect !== 'default' && !newItems.includes(users[editTargetUser].activeEffect)) { users[editTargetUser].activeEffect = 'default'; }
    saveUsers(true); updateAdminUserTable(); closeEditProgress(); alert('進捗とアイテム情報を保存しました。');
}

// ----------------------------------------------------
// 【修正版】ダッシュボード描画関数群（エラー回避対応済）
// ----------------------------------------------------
function switchDashTab(tab) {
    if(tab === 'basic') {
        document.getElementById('dash-basic').style.display = 'block';
        document.getElementById('dash-vision').style.display = 'none';
        document.getElementById('tab-btn-basic').style.background = '#2196F3';
        document.getElementById('tab-btn-vision').style.background = '#9e9e9e';
        renderDashboardTable();
    } else {
        document.getElementById('dash-basic').style.display = 'none';
        document.getElementById('dash-vision').style.display = 'block';
        document.getElementById('tab-btn-basic').style.background = '#9e9e9e';
        document.getElementById('tab-btn-vision').style.background = '#9C27B0';
        renderVisionDashboardTable();
    }
}

function updateAdminUserTable() {
    const tbody = document.getElementById('admin-user-tbody'); tbody.innerHTML = '';
    let list = Object.keys(users).filter(n => !users[n].isMaster && n !== '__GLOBAL_SETTINGS__').map(n => ({ name: n, user: users[n] }));
    list.sort((a,b) => a.name.localeCompare(b.name, 'ja'));
    list.forEach(item => {
        let uBirth = item.user.birthdate || item.user.birth;
        let dispGrade = (item.user.grade && String(item.user.grade) !== 'undefined') ? item.user.grade : calculateGrade(uBirth);
        
        let tr = document.createElement('tr');
        tr.innerHTML = `
            <td style="padding:5px; border:1px solid #ddd;"><input type="radio" name="asel" class="admin-user-check" value="${item.name}"></td>
            <td style="padding:5px; border:1px solid #ddd; font-weight:bold;">${item.name}</td>
            <td style="padding:5px; border:1px solid #ddd;">${dispGrade}</td>
            <td style="padding:5px; border:1px solid #ddd;"><input type="text" value="${item.user.group || ''}" onchange="updateUserGroup('${item.name}', this.value)" style="width:80px; padding:2px; font-size:12px; border:1px solid #ccc;"></td>
            <td style="padding:5px; border:1px solid #ddd;">Lv.${item.user.mouseLevel || 1}</td>
            <td style="padding:5px; border:1px solid #ddd;">${item.user.keyboardSequence || 0}/${STAGE_ORDER.length}</td>
        `;
        tbody.appendChild(tr);
    });
}

function updateUserGroup(name, newGroup) {
    if(users[name]) { 
        users[name].group = newGroup.trim(); 
        saveUsers(false); 
        renderDashboardTable(); 
    }
}

function renderDashboardTable() {
    try {
        const tbody = document.getElementById('dash-tbody');
        const gradeSelect = document.getElementById('dash-filter-grade');
        const grpSelect = document.getElementById('dash-filter-group'); 
        const sortSelect = document.getElementById('dash-sort');
        if(!tbody || !gradeSelect || !grpSelect || !sortSelect) return;

        const fGrade = gradeSelect.value || 'all';
        const fGroup = grpSelect.value || 'all';
        const sortVal = sortSelect.value || 'name';

        let existingGrades = new Set();
        let groups = new Set();
        let list =[];
        let isDataFixed = false;

        Object.keys(users).forEach(n => { 
            if(!users[n] || users[n].isMaster || n === '__GLOBAL_SETTINGS__') return;
            
            let uBirth = users[n].birthdate || users[n].birth;
            let uGrade = users[n].grade;
            if (!uGrade || String(uGrade) === 'undefined') {
                uGrade = calculateGrade(uBirth);
                users[n].grade = uGrade; 
                users[n].birthdate = uBirth; 
                isDataFixed = true;
            }

            existingGrades.add(uGrade);
            if(users[n].group) groups.add(users[n].group);

            if (fGrade !== 'all' && uGrade !== fGrade) return;
            if (fGroup !== 'all' && (users[n].group || '') !== fGroup) return; 
            
            list.push({ name: n, user: users[n] });
        });

        if (isDataFixed) saveUsers(false); 

        gradeSelect.innerHTML = '<option value="all">すべての学年</option>';
        sortGrades(Array.from(existingGrades)).forEach(g => {
            let opt = document.createElement('option'); opt.value = g; opt.innerText = g;
            if(g === fGrade) opt.selected = true;
            gradeSelect.appendChild(opt);
        });

        grpSelect.innerHTML = '<option value="all">すべてのグループ</option>';
        Array.from(groups).sort().forEach(g => {
            let opt = document.createElement('option'); opt.value = g; opt.innerText = g;
            if(g === fGroup) opt.selected = true;
            grpSelect.appendChild(opt);
        });

        if (sortVal === 'name') list.sort((a,b) => a.name.localeCompare(b.name, 'ja'));
        else if (sortVal === 'mouse_desc') list.sort((a,b) => (b.user.mouseLevel || 0) - (a.user.mouseLevel || 0));
        else if (sortVal === 'kb_desc') list.sort((a,b) => (b.user.keyboardSequence || 0) - (a.user.keyboardSequence || 0));

        tbody.innerHTML = '';
        list.forEach(item => {
            let tr = document.createElement('tr');
            
            let tdName = document.createElement('td'); 
            tdName.style.cssText = 'border:1px solid #ccc; padding:8px; font-weight:bold;'; 
            let grpBadge = item.user.group ? `<span style="font-size:12px; color:#666; background:#e0e0e0; padding:2px 6px; border-radius:10px; margin-left:8px;">${item.user.group}</span>` : '';
            tdName.innerHTML = item.name + grpBadge; 
            tr.appendChild(tdName);

            let tdGrade = document.createElement('td'); 
            tdGrade.style.cssText = 'border:1px solid #ccc; padding:8px;'; 
            tdGrade.innerText = item.user.grade; 
            tr.appendChild(tdGrade);

            let tdMouse = document.createElement('td'); 
            tdMouse.style.cssText = 'border:1px solid #ccc; padding:8px;';
            let mouseLevel = item.user.mouseLevel || 0;
            let mousePct = Math.floor((mouseLevel / 7) * 100);
            tdMouse.innerHTML = `<div style="width:100%; background:#eee; border-radius:5px;"><div style="width:${mousePct}%; background:#2196F3; color:#fff; text-align:center; font-size:12px; border-radius:5px;">${mousePct}%</div></div>`; 
            tr.appendChild(tdMouse);

            let tdKb = document.createElement('td'); 
            tdKb.style.cssText = 'border:1px solid #ccc; padding:8px;';
            let kbSeq = item.user.keyboardSequence || 0;
            let kbPct = Math.floor((kbSeq / STAGE_ORDER.length) * 100);
            tdKb.innerHTML = `<div style="width:100%; background:#eee; border-radius:5px;"><div style="width:${kbPct}%; background:#FF9800; color:#fff; text-align:center; font-size:12px; border-radius:5px;">${kbPct}%</div></div>`; 
            tr.appendChild(tdKb);

            tbody.appendChild(tr);
        });
    } catch(e) { console.error(e); }
}

function renderVisionDashboardTable() {
    const tbody = document.getElementById('dash-vision-tbody');
    const thead = document.getElementById('dash-vision-thead');
    const diffSelect = document.getElementById('vision-diff-select');
    if (!tbody || !thead || !diffSelect) return;
    
    let diffVal = diffSelect.value; 
    let suffix = diffVal === 'normal' ? '' : '_' + diffVal;

    let htmlHead = '<tr><th style="border:1px solid #ccc; padding:8px; position:sticky; left:0; background:#f2f2f2; z-index:11;">名前</th>';
    VISION_STAGES.forEach(st => { htmlHead += `<th style="border:1px solid #ccc; padding:8px; font-size:14px;">${st.title}</th>`; });
    htmlHead += '</tr>';
    thead.innerHTML = htmlHead; tbody.innerHTML = '';
    
    let sumTimes = {}; let countTimes = {};
    VISION_STAGES.forEach(st => { sumTimes[st.id] = 0; countTimes[st.id] = 0; });

    let list =[];
    Object.keys(users).forEach(n => {
        if (!users[n] || users[n].isMaster || n === '__GLOBAL_SETTINGS__') return;
        list.push({ name: n, user: users[n] });
    });
    list.sort((a, b) => a.name.localeCompare(b.name, 'ja'));

    list.forEach(item => {
        let tr = document.createElement('tr');
        let tdName = document.createElement('td');
        tdName.style.cssText = 'border:1px solid #ccc; padding:8px; font-weight:bold; position:sticky; left:0; background:#fff; z-index:5;';
        tdName.innerText = item.name; tr.appendChild(tdName);

        VISION_STAGES.forEach(st => {
            let td = document.createElement('td');
            td.style.cssText = 'border:1px solid #ccc; padding:8px; text-align:center;';
            let key = st.id + suffix;
            let rec = item.user.examRecords && item.user.examRecords[key];
            if (rec) {
                td.innerText = rec.toFixed(1) + '秒';
                sumTimes[st.id] += rec; countTimes[st.id]++;
            } else { td.innerText = '-'; td.style.color = '#ccc'; }
            tr.appendChild(td);
        });
        tbody.appendChild(tr);
    });

    let trAvg = document.createElement('tr');
    trAvg.style.backgroundColor = '#fff9c4'; trAvg.style.fontWeight = 'bold';
    let tdAvgName = document.createElement('td');
    tdAvgName.style.cssText = 'border:1px solid #ccc; padding:8px; position:sticky; left:0; background:#fff9c4; z-index:6; color:#f57f17;';
    tdAvgName.innerText = '★平均タイム'; trAvg.appendChild(tdAvgName);

    VISION_STAGES.forEach(st => {
        let td = document.createElement('td');
        td.style.cssText = 'border:1px solid #ccc; padding:8px; text-align:center; color:#d32f2f; font-size:18px;';
        if (countTimes[st.id] > 0) {
            td.innerText = (sumTimes[st.id] / countTimes[st.id]).toFixed(1) + '秒';
        } else { td.innerText = '-'; }
        trAvg.appendChild(td);
    });
    tbody.prepend(trAvg); 
}

/* =========================================================
   [JS] 5. 文章入力課題管理 (Admin)
   ========================================================= */
let editingTextTaskId = null; 

function adminAddTextTask() {
    const title = document.getElementById('admin-text-title').value.trim();
    const time = parseInt(document.getElementById('admin-text-time').value, 10);
    const star = parseInt(document.getElementById('admin-text-star').value, 10) || 3; 
    const content = document.getElementById('admin-text-content').value;
    if (!title || !time || !content.trim()) return alert("タイトル、制限時間、お手本文章をすべて入力してください。");
    
    if (!users['__GLOBAL_SETTINGS__']) users['__GLOBAL_SETTINGS__'] = { isMaster:true };
    if (!users['__GLOBAL_SETTINGS__'].textTasks) users['__GLOBAL_SETTINGS__'].textTasks =[];
    
    if (editingTextTaskId) {
        let task = users['__GLOBAL_SETTINGS__'].textTasks.find(t => t.id === editingTextTaskId);
        if (task) {
            task.title = title;
            task.time = time;
            task.star = star;
            task.content = content;
        }
        editingTextTaskId = null;
        document.getElementById('btn-admin-text-save').innerText = '課題を追加';
        alert('課題を更新しました！');
    } else {
        const taskId = 'tt_' + Date.now();
        users['__GLOBAL_SETTINGS__'].textTasks.push({ id: taskId, title: title, time: time, star: star, content: content });
        alert('新しい課題を追加しました！');
    }
    
    saveUsers(true); 
    document.getElementById('admin-text-title').value = ''; 
    document.getElementById('admin-text-time').value = ''; 
    document.getElementById('admin-text-star').value = '3'; 
    document.getElementById('admin-text-content').value = '';
    renderAdminTextTasks();
}

function editTextTask(id) {
    const task = users['__GLOBAL_SETTINGS__'].textTasks.find(t => t.id === id);
    if (!task) return;
    editingTextTaskId = id;
    document.getElementById('admin-text-title').value = task.title;
    document.getElementById('admin-text-time').value = task.time;
    document.getElementById('admin-text-star').value = task.star || 3;
    document.getElementById('admin-text-content').value = task.content;
    document.getElementById('btn-admin-text-save').innerText = '課題を更新';
    document.getElementById('admin-text-title').focus();
}

function moveTextTask(idx, dir) {
    const tasks = users['__GLOBAL_SETTINGS__'].textTasks;
    if (dir === -1 && idx > 0) {
        [tasks[idx-1], tasks[idx]] =[tasks[idx], tasks[idx-1]];
    } else if (dir === 1 && idx < tasks.length - 1) {
        [tasks[idx+1], tasks[idx]] = [tasks[idx], tasks[idx+1]];
    }
    saveUsers(true);
    renderAdminTextTasks();
}

function renderAdminTextTasks() {
    const list = document.getElementById('admin-text-task-list'); list.innerHTML = '';
    const glob = users['__GLOBAL_SETTINGS__'];
    if (!glob || !glob.textTasks || glob.textTasks.length === 0) { list.innerHTML = '<li style="color:#999; text-align:center;">まだ課題がありません</li>'; return; }
    glob.textTasks.forEach((task, idx) => {
        const li = document.createElement('li');
        li.style.display = 'flex'; li.style.justifyContent = 'space-between'; li.style.alignItems = 'center'; li.style.marginBottom = '10px'; li.style.background = '#f9f9f9'; li.style.padding = '10px'; li.style.borderRadius = '5px'; li.style.border = '1px solid #ccc';
        
        let stars = "⭐".repeat(task.star || 3);
        
        li.innerHTML = `
            <div style="flex:1;">
                <strong>${task.title}</strong> <span style="font-size:12px; color:#FF9800;">${stars}</span> (${task.time}分)<br>
                <span style="font-size:12px; color:#666;">${task.content.substring(0, 30)}...</span>
            </div>
            <div style="display:flex; gap:5px;">
                <button class="btn-secondary" style="font-size:14px; padding:5px 10px;" onclick="moveTextTask(${idx}, -1)" ${idx === 0 ? 'disabled' : ''}>▲</button>
                <button class="btn-secondary" style="font-size:14px; padding:5px 10px;" onclick="moveTextTask(${idx}, 1)" ${idx === glob.textTasks.length - 1 ? 'disabled' : ''}>▼</button>
                <button class="btn-primary" style="font-size:14px; padding:5px 15px;" onclick="editTextTask('${task.id}')">編集</button>
                <button class="btn-danger" style="font-size:14px; padding:5px 15px;" onclick="deleteTextTask(${idx}, '${task.title}')">削除</button>
            </div>
        `;
        list.appendChild(li);
    });
}

function deleteTextTask(idx, title) { if (!confirm(`本当に課題「${title}」を削除しますか？`)) return; users['__GLOBAL_SETTINGS__'].textTasks.splice(idx, 1); saveUsers(true); renderAdminTextTasks(); }

function insertRuby() {
    const ta = document.getElementById('admin-text-content');
    const rubyInp = document.getElementById('admin-ruby-input');
    const ruby = rubyInp.value.trim();
    if (!ruby) return alert('よみがなを入力してください');
    const start = ta.selectionStart; const end = ta.selectionEnd;
    if (start === end) return alert('テキストボックス内で、ルビを振りたい漢字をマウスで選択（ハイライト）してからボタンを押してください。');
    const text = ta.value; const selected = text.substring(start, end); const before = text.substring(0, start); const after = text.substring(end);
    ta.value = `${before}{${selected}|${ruby}}${after}`; rubyInp.value = ''; ta.focus();
    const newCursorPos = start + selected.length + ruby.length + 3; ta.setSelectionRange(newCursorPos, newCursorPos);
}

function toggleAutoRubyTool() {
    const tool = document.getElementById('admin-auto-ruby-tool');
    tool.style.display = tool.style.display === 'none' ? 'flex' : 'none';
}

function generateAutoRuby() {
    const tool = document.getElementById('admin-auto-ruby-tool');
    const btn = tool.querySelector('.btn-primary');
    const originalText = btn.innerText;
    btn.innerText = '⏳ 処理中...'; btn.disabled = true; btn.style.backgroundColor = '#9e9e9e';
    setTimeout(() => {
        try { processAutoRuby(); } catch(e) { console.error(e); alert("エラーが発生しました。入力内容を確認してください。"); } 
        finally { btn.innerText = originalText; btn.disabled = false; btn.style.backgroundColor = ''; }
    }, 50);
}

function processAutoRuby() {
    const original = document.getElementById('auto-ruby-origin').value.trim();
    const yomiInput = document.getElementById('auto-ruby-yomi').value.trim();
    if(!original || !yomiInput) return alert('「原文」と「よみ」の両方を入力してください。');
    const toHira = (str) => str.replace(/[\u30a1-\u30f6]/g, match => String.fromCharCode(match.charCodeAt(0) - 0x60)).toLowerCase();
    const isKanji = (c) => /[\u4E00-\u9FFF\u3400-\u4DBF\uF900-\uFAFF々]/.test(c);
    const yStr = toHira(yomiInput.replace(/\s+/g, ''));
    let blocks =[]; let currentBlock = ""; let currentType = null; 
    const getType = (c) => { if (/\s/.test(c)) return 'space'; if (isKanji(c)) return 'kanji'; return 'other'; };
    for (let i = 0; i < original.length; i++) {
        let c = original[i]; let t = getType(c);
        if (i === 0) { currentType = t; currentBlock = c; } 
        else { if (currentType === t) { currentBlock += c; } else { blocks.push({ type: currentType, text: currentBlock }); currentType = t; currentBlock = c; } }
    }
    if (currentBlock) blocks.push({ type: currentType, text: currentBlock });
    let searchBlocks = blocks.filter(b => b.type !== 'space');
    let memo = {};
    function dfs(bIdx, yIdx) {
        let key = bIdx + "," + yIdx; if (memo[key] !== undefined) return memo[key];
        if (bIdx === searchBlocks.length) return yIdx === yStr.length ?[] : null;
        let b = searchBlocks[bIdx];
        if (b.type === 'other') {
            let compStr = toHira(b.text).replace(/\s+/g, ''); let len = compStr.length;
            if (yStr.substring(yIdx, yIdx + len) === compStr) { let res = dfs(bIdx + 1, yIdx + len); if (res !== null) { memo[key] = res; return res; } }
        } else {
            let nextB = searchBlocks[bIdx + 1];
            if (nextB && nextB.type === 'other') {
                let nextStr = toHira(nextB.text).replace(/\s+/g, ''); let searchStart = yIdx + 1;
                while (true) {
                    let matchIdx = yStr.indexOf(nextStr, searchStart); if (matchIdx === -1) break;
                    let res = dfs(bIdx + 1, matchIdx); if (res !== null) { let result =[yStr.substring(yIdx, matchIdx)].concat(res); memo[key] = result; return result; }
                    searchStart = matchIdx + 1;
                }
            } else {
                if (bIdx === searchBlocks.length - 1) {
                    let ruby = yStr.substring(yIdx); if (ruby.length > 0) { let result = [ruby]; memo[key] = result; return result; }
                } else {
                    for (let i = 1; yIdx + i <= yStr.length; i++) {
                        let res = dfs(bIdx + 1, yIdx + i); if (res !== null) { let result =[yStr.substring(yIdx, yIdx + i)].concat(res); memo[key] = result; return result; }
                    }
                }
            }
        }
        memo[key] = null; return null;
    }
    let rubies = dfs(0, 0);
    if (!rubies) return alert("【ズレを発見しました！】\n「原文」と「よみ」の構成が一致しません。");
    let result = ""; let rubyIndex = 0;
    for (let i = 0; i < blocks.length; i++) {
        let b = blocks[i];
        if (b.type === 'space' || b.type === 'other') { result += b.text; } 
        else { result += `{${b.text}|${rubies[rubyIndex]}}`; rubyIndex++; }
    }
    document.getElementById('admin-text-content').value = result; toggleAutoRubyTool();
    alert('✨ 自動ルビ振りが完了しました！\n\n上のテキストボックスの内容を確認し、問題なければ「課題を追加・更新」ボタンを押してください。');
}

/* =========================================================
   [JS] 6. 文章入力練習 ＆ 自動採点
   ========================================================= */
let currentTextTask = null, textTimerInterval = null, textTimeLeft = 0;
let isRubyOn = true, isNaviOn = true;

function toggleRuby() {
    isRubyOn = !isRubyOn;
    const btn = document.getElementById('btn-toggle-ruby');
    if (btn) { btn.innerText = `よみがな: ${isRubyOn ? 'ON' : 'OFF'}`; btn.style.background = isRubyOn ? '#00bcd4' : '#9e9e9e'; }
    const refBox = document.getElementById('ref-text-box');
    if (refBox && refBox.innerHTML && !refBox.innerText.includes('待 機 中')) renderTextContent();
    if (document.activeElement) document.activeElement.blur();
}

function toggleNavi() {
    isNaviOn = !isNaviOn;
    const btn = document.getElementById('btn-toggle-navi');
    if (btn) { btn.innerText = `ナビ: ${isNaviOn ? 'ON' : 'OFF'}`; btn.style.background = isNaviOn ? '#ff9800' : '#9e9e9e'; }
    const refBox = document.getElementById('ref-text-box');
    if (refBox && refBox.innerHTML && !refBox.innerText.includes('待 機 中')) renderTextContent();
    if (document.activeElement) document.activeElement.blur();
}

function renderTextContent() {
    const refBox = document.getElementById('ref-text-box'); 
    if (!currentTextTask) return;
    
    const rawText = currentTextTask.content.replace(/\r\n/g, '\n');
    const plainRef = rawText.replace(/\{([^|]+)\|([^}]+)\}/g, '$1'); 
    const typeBox = document.getElementById('type-text-box');
    const typedText = typeBox ? typeBox.value.replace(/\r\n/g, '\n') : "";

    let matchLen = 0;
    for (let j = 0; j < typedText.length; j++) {
        if (typedText[j] === plainRef[j]) {
            matchLen++;
        } else {
            break; 
        }
    }

    let html = '';
    let plainIndex = 0;
    let i = 0;
    
    while (i < rawText.length) {
        if (rawText[i] === '{') {
            let closeIdx = rawText.indexOf('}', i);
            let pipeIdx = rawText.indexOf('|', i);
            if (closeIdx !== -1 && pipeIdx !== -1 && pipeIdx < closeIdx) {
                let kanji = rawText.substring(i + 1, pipeIdx);
                let ruby = rawText.substring(pipeIdx + 1, closeIdx);
                
                if (isRubyOn) html += '<ruby>';
                for (let k = 0; k < kanji.length; k++) {
                    let charClass = '';
                    if (isNaviOn) {
                        if (plainIndex < matchLen) charClass = 'text-done';
                        else if (plainIndex === matchLen) charClass = 'text-current';
                    }
                    html += `<span class="${charClass}">${kanji[k].replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</span>`;
                    plainIndex++;
                }
                if (isRubyOn) html += `<rt style="color:#E91E63; font-size:0.7em; font-weight:normal;">${ruby}</rt></ruby>`;
                
                i = closeIdx + 1;
                continue;
            }
        }
        
        let char = rawText[i];
        let charClass = '';
        if (isNaviOn) {
            if (plainIndex < matchLen) charClass = 'text-done';
            else if (plainIndex === matchLen) charClass = 'text-current';
        }
        
        if (char === '\n') {
            html += `<span class="${charClass}" style="color:#ccc;">↵</span><br>`;
            plainIndex++;
        } else if (char === ' ' || char === '　') {
            html += `<span class="${charClass}">&nbsp;</span>`;
            plainIndex++;
        } else {
            html += `<span class="${charClass}">${char.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</span>`;
            plainIndex++;
        }
        i++;
    }
    refBox.innerHTML = html;
}

function goToTextMenu() { renderTextTasks(); showScreen('screen-text-menu'); }

let currentTextPage = 0;
const TEXT_ITEMS_PER_PAGE = 6;

function renderTextTasks() {
    const cont = document.getElementById('text-menu-content'); cont.innerHTML = '';
    const glob = users['__GLOBAL_SETTINGS__'];
    if (!glob || !glob.textTasks || glob.textTasks.length === 0) { cont.innerHTML = '<p style="font-size:20px; color:#666;">先生が作った課題はまだありません。</p>'; return; }
    
    const grid = document.createElement('div');
    grid.style.display = 'flex'; grid.style.flexWrap = 'wrap'; grid.style.justifyContent = 'center'; grid.style.gap = '15px'; grid.style.width = '100%';
    
    const tasks = glob.textTasks; const totalPages = Math.ceil(tasks.length / TEXT_ITEMS_PER_PAGE);
    const start = currentTextPage * TEXT_ITEMS_PER_PAGE; const pageTasks = tasks.slice(start, start + TEXT_ITEMS_PER_PAGE);

    pageTasks.forEach(task => {
        const btn = document.createElement('button'); btn.className = 'stage-btn unlocked'; 
        btn.style.height = 'auto'; btn.style.minHeight = '130px'; btn.style.padding = '15px'; btn.style.marginBottom = '0'; btn.style.width = '45%'; btn.style.minWidth = '350px';
        
        let recordHtml = '';
        if (users[currentUser] && users[currentUser].textRecords && users[currentUser].textRecords[task.id]) {
            const r = users[currentUser].textRecords[task.id]; recordHtml = `<br><span style="font-size:16px; color:#E91E63; font-weight:bold;">🏆 最高純字数: ${r.score}文字 (ミス${r.miss})</span>`;
        }
        let stars = "⭐".repeat(task.star || 3);
        btn.innerHTML = `<span style="font-size:22px; font-weight:bold;">${task.title}</span> <span class="reward-badge-text">💰最高15000</span><br><span style="font-size:16px; color:#FF9800;">難易度: ${stars}</span><br><span style="font-size:16px; color:#666;">制限時間: ${task.time}分</span>${recordHtml}`;
        btn.onclick = () => startTextPractice(task.id); grid.appendChild(btn);
    });
    cont.appendChild(grid);

    if (totalPages > 1) {
        const pc = document.createElement('div'); pc.style.display = 'flex'; pc.style.gap = '20px'; pc.style.marginTop = '20px';
        const pBtn = document.createElement('button'); pBtn.className = 'btn-secondary'; pBtn.innerText = '◀ まえのページ'; pBtn.disabled = currentTextPage === 0; pBtn.onclick = () => { currentTextPage--; renderTextTasks(); };
        const pTxt = document.createElement('span'); pTxt.style.fontSize = '20px'; pTxt.style.fontWeight = 'bold'; pTxt.style.alignSelf = 'center'; pTxt.innerText = `${currentTextPage + 1} / ${totalPages}`;
        const nBtn = document.createElement('button'); nBtn.className = 'btn-secondary'; nBtn.innerText = 'つぎのページ ▶'; nBtn.disabled = currentTextPage === totalPages - 1; nBtn.onclick = () => { currentTextPage++; renderTextTasks(); };
        pc.appendChild(pBtn); pc.appendChild(pTxt); pc.appendChild(nBtn); cont.appendChild(pc);
    }
}

function startTextPractice(taskId) {
    SoundManager.init(); if (document.activeElement) document.activeElement.blur();
    const glob = users['__GLOBAL_SETTINGS__']; currentTextTask = glob.textTasks.find(t => t.id === taskId);
    if (!currentTextTask) return;
    
    let modal = document.getElementById('text-prep-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'text-prep-modal';
        modal.style.cssText = 'display:none; position:absolute; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.8); z-index:9000; flex-direction:column; justify-content:center; align-items:center;';
        document.body.appendChild(modal);
    }
    
    let plainText = currentTextTask.content.replace(/\{([^|]+)\|([^}]+)\}/g, '$1');
    let previewText = plainText.length > 100 ? plainText.substring(0, 100) + '...' : plainText;

    modal.innerHTML = `
        <div style="background:#fff; padding:30px; border-radius:15px; width:80%; max-width:800px; max-height:90vh; display:flex; flex-direction:column; text-align:center; box-shadow: 0 10px 30px rgba(0,0,0,0.5);">
            <h2 style="margin-top:0; color:#333;">課題の確認と設定</h2>
            <h3 style="color:#00695c; margin:10px 0;">${currentTextTask.title} (${currentTextTask.time}分)</h3>
            
            <div style="flex:1; overflow-y:auto; background:#f9f9f9; border:2px solid #ccc; border-radius:10px; padding:15px; margin-bottom:20px; font-size:18px; text-align:left; white-space:pre-wrap; color:#555;">${previewText}</div>
            
            <p style="font-size:16px; margin-bottom:10px; color:#666;">お好みで設定を変更してからスタートしてね</p>
            <div style="display:flex; justify-content:center; gap:20px; margin-bottom:25px;">
                <button id="prep-toggle-ruby" onclick="toggleRubyInPrep()" style="padding:10px 20px; font-size:18px; border-radius:10px; border:none; cursor:pointer; font-weight:bold; box-shadow:0 4px 0 rgba(0,0,0,0.2); background:${isRubyOn ? '#00bcd4' : '#9e9e9e'}; color:#fff;">
                    よみがな: ${isRubyOn ? 'ON' : 'OFF'}
                </button>
                <button id="prep-toggle-navi" onclick="toggleNaviInPrep()" style="padding:10px 20px; font-size:18px; border-radius:10px; border:none; cursor:pointer; font-weight:bold; box-shadow:0 4px 0 rgba(0,0,0,0.2); background:${isNaviOn ? '#ff9800' : '#9e9e9e'}; color:#fff;">
                    ナビ: ${isNaviOn ? 'ON' : 'OFF'}
                </button>
            </div>
            
            <div style="display:flex; justify-content:center; gap:20px;">
                <button class="btn-gacha" style="padding:15px 40px; font-size:24px; border:none;" onclick="confirmStartTextPractice()">スタート！</button>
                <button class="btn-secondary" style="padding:15px 40px; font-size:24px;" onclick="closeTextPrepModal()">やめる</button>
            </div>
        </div>
    `;
    modal.style.display = 'flex';
}

function toggleRubyInPrep() {
    isRubyOn = !isRubyOn;
    const btn = document.getElementById('prep-toggle-ruby');
    btn.innerText = `よみがな: ${isRubyOn ? 'ON' : 'OFF'}`;
    btn.style.background = isRubyOn ? '#00bcd4' : '#9e9e9e';
}

function toggleNaviInPrep() {
    isNaviOn = !isNaviOn;
    const btn = document.getElementById('prep-toggle-navi');
    btn.innerText = `ナビ: ${isNaviOn ? 'ON' : 'OFF'}`;
    btn.style.background = isNaviOn ? '#ff9800' : '#9e9e9e';
}

function closeTextPrepModal() {
    const modal = document.getElementById('text-prep-modal');
    if (modal) modal.style.display = 'none';
}

function confirmStartTextPractice() {
    closeTextPrepModal();
    showScreen('screen-text-game'); 
    document.getElementById('text-result-overlay').style.display = 'none';
    document.getElementById('text-title-display').innerText = currentTextTask.title;
    document.getElementById('btn-submit-text').style.display = 'none'; 
    
    const btnRuby = document.getElementById('btn-toggle-ruby');
    if (btnRuby) { btnRuby.innerText = `よみがな: ${isRubyOn ? 'ON' : 'OFF'}`; btnRuby.style.background = isRubyOn ? '#00bcd4' : '#9e9e9e'; }
    const btnNavi = document.getElementById('btn-toggle-navi');
    if (btnNavi) { btnNavi.innerText = `ナビ: ${isNaviOn ? 'ON' : 'OFF'}`; btnNavi.style.background = isNaviOn ? '#ff9800' : '#9e9e9e'; }

    const refBox = document.getElementById('ref-text-box'); refBox.style.cssText = ''; 
    refBox.innerHTML = '<div style="display:flex; flex-direction:column; justify-content:center; align-items:center; height:100%; color:#999; text-align:center;"><span style="font-size:24px; font-weight:bold; margin-bottom:15px;">【 待 機 中 】</span><span>スペースキーを押すと、ここに問題が表示されて<br>タイマーがスタートします。</span></div>';
    
    const typeBox = document.getElementById('type-text-box'); typeBox.value = ''; typeBox.disabled = true; 
    typeBox.oninput = () => { renderTextContent(); };

    textTimeLeft = currentTextTask.time * 60; updateTextHud(); 
    
    let overlay = document.getElementById('text-start-overlay');
    if (!overlay) {
        overlay = document.createElement('div'); overlay.id = 'text-start-overlay'; overlay.style.position = 'absolute'; overlay.style.top = '0'; overlay.style.left = '0'; overlay.style.width = '100%'; overlay.style.height = '100%'; overlay.style.background = 'rgba(0,0,0,0.8)'; overlay.style.display = 'flex'; overlay.style.flexDirection = 'column'; overlay.style.justifyContent = 'center'; overlay.style.alignItems = 'center'; overlay.style.zIndex = '150';
        overlay.innerHTML = '<div style="font-size: 50px; color: #fff; font-weight: bold; text-shadow: 2px 2px 4px #000; animation: pulse 1.5s infinite; text-align: center;">スペースキーをおして スタート！</div>';
        document.getElementById('screen-text-game').appendChild(overlay);
    }
    overlay.style.display = 'flex';

    if (cancelStartHandler) { document.removeEventListener('keydown', cancelStartHandler); overlay.removeEventListener('mousedown', cancelStartHandler); }
    
    const startHandler = (e) => {
        if (e.key === ' ' || e.type === 'mousedown') { 
            e.preventDefault(); document.removeEventListener('keydown', startHandler); overlay.removeEventListener('mousedown', startHandler); cancelStartHandler = null; overlay.style.display = 'none';
            document.getElementById('btn-submit-text').style.display = 'block'; 
            renderTextContent(); typeBox.disabled = false; setTimeout(() => { typeBox.focus(); }, 50);
            textTimerInterval = setInterval(() => { textTimeLeft--; updateTextHud(); if (textTimeLeft <= 0) submitTextPractice(); }, 1000);
        }
    };
    cancelStartHandler = startHandler; setTimeout(() => { document.addEventListener('keydown', startHandler); overlay.addEventListener('mousedown', startHandler); }, 300);
}

function updateTextHud() {
    const m = Math.floor(textTimeLeft / 60); const s = textTimeLeft % 60;
    const timerDisplay = document.getElementById('text-timer-display');
    if (timerDisplay) timerDisplay.innerText = `のこり: ${m}分${s.toString().padStart(2, '0')}秒`;
}

function submitTextPractice() {
    if (textTimerInterval) { clearInterval(textTimerInterval); textTimerInterval = null; }
    const typeBox = document.getElementById('type-text-box'); typeBox.disabled = true;
    typeBox.oninput = null; 
    document.getElementById('btn-submit-text').style.display = 'none';
    
    const finishOverlay = document.getElementById('text-finish-overlay');
    if (finishOverlay) finishOverlay.style.display = 'flex';
    SoundManager.playClear(); 

    setTimeout(() => {
        if (finishOverlay) finishOverlay.style.display = 'none';
        showTextResult();
    }, 2000);
}

function showTextResult() {
    const typeBox = document.getElementById('type-text-box');
    const rawRef = currentTextTask.content;
    const plainRef = rawRef.replace(/\{([^|]+)\|([^}]+)\}/g, '$1');
    const typed = typeBox.value;
    const refClean = plainRef.replace(/\r\n/g, '\n'); const typedClean = typed.replace(/\r\n/g, '\n');
    let missCount = calcMissCount(refClean, typedClean); let totalCount = typedClean.length; let netCount = Math.max(0, totalCount - missCount);

    if (!users[currentUser].textRecords) users[currentUser].textRecords = {};
    let isNewRecord = false, prev = users[currentUser].textRecords[currentTextTask.id];
    if (!prev || netCount > prev.score) { users[currentUser].textRecords[currentTextTask.id] = { score: netCount, total: totalCount, miss: missCount }; isNewRecord = true; }
    
    let coinGain = 0;
    if (netCount >= 2001) coinGain = 15000;
    else if (netCount >= 1501) coinGain = 10000;
    else if (netCount >= 1001) coinGain = 8500;
    else if (netCount >= 801) coinGain = 5000;
    else if (netCount >= 601) coinGain = 2500;
    else if (netCount >= 451) coinGain = 1000;
    else if (netCount >= 351) coinGain = 500;
    else if (netCount >= 251) coinGain = 100;
    else if (netCount >= 101) coinGain = 50;
    else if (netCount >= 51) coinGain = 30;
    else if (netCount >= 1) coinGain = 20;

    users[currentUser].coins = (users[currentUser].coins || 0) + coinGain; 
    saveUsers(false); SoundManager.playClear(); createConfetti();

    let diffHtml = generateDiffHtml(refClean, typedClean);

    const details = document.getElementById('text-result-details');
    details.innerHTML = `
        <div style="display:flex; gap:20px; justify-content:center; margin-bottom:15px; font-size:24px;">
            <div>総字数： <span style="color:#0288d1">${totalCount}</span> 文字</div>
            <div>ミス数： <span style="color:#d32f2f">${missCount}</span> 箇所</div>
        </div>
        <div style="font-size:36px; text-align:center;">純字数： <span style="color:#4CAF50; font-weight:bold;">${netCount}</span> (スコア)</div>
        <div style="font-size:24px; color:#FF9800; text-align:center; margin-top:10px; font-weight:bold;">💰 獲得コイン: ${coinGain} 枚</div>
        ${isNewRecord ? '<div style="color:#ffeb3b; font-size:24px; text-shadow: 1px 1px #000; animation:bounce 1s infinite; text-align:center; margin-top:10px;">★しんきろく！★</div>' : ''}
        <div style="margin-top: 15px; padding-top: 15px; border-top: 2px dashed #81d4fa; text-align: left; font-size: 18px; max-height: 150px; overflow-y: auto; background: rgba(255,255,255,0.7); padding: 10px; border-radius: 8px;">
            <div style="font-size:14px; color:#555; font-weight:bold; margin-bottom:5px;">🔍 ミスした場所のふりかえり（赤=お手本 / 緑=あなたの入力）</div>
            ${diffHtml}
        </div>
    `;
    document.getElementById('text-result-overlay').style.display = 'flex';
}

function closeTextResult() { document.getElementById('text-result-overlay').style.display = 'none'; showScreen('screen-text-menu'); renderTextTasks(); }
function backToMenuFromText() {
    if (textTimerInterval) { clearInterval(textTimerInterval); textTimerInterval = null; }
    if (cancelStartHandler) { document.removeEventListener('keydown', cancelStartHandler); cancelStartHandler = null; const overlay = document.getElementById('text-start-overlay'); if (overlay) overlay.style.display = 'none'; }
    const typeBox = document.getElementById('type-text-box');
    if(typeBox) typeBox.oninput = null;
    showScreen('screen-text-menu');
}

function calcMissCount(ref, typed) {
    if (typed.length === 0) return 0;
    const N = ref.length, M = typed.length, dp = Array.from({length: N + 1}, () => Array(M + 1).fill(0));
    for (let i = 0; i <= N; i++) dp[i][0] = i; for (let j = 0; j <= M; j++) dp[0][j] = j;
    for (let i = 1; i <= N; i++) {
        for (let j = 1; j <= M; j++) {
            const cost = ref[i - 1] === typed[j - 1] ? 0 : 1;
            dp[i][j] = Math.min( dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost );
        }
    }
    let minMiss = Infinity; for (let i = 0; i <= N; i++) { if (dp[i][M] < minMiss) minMiss = dp[i][M]; }
    return minMiss;
}

function generateDiffHtml(ref, typed) {
    const N = ref.length, M = typed.length;
    const dp = Array.from({length: N + 1}, () => Array(M + 1).fill(0));
    for (let i = 0; i <= N; i++) dp[i][0] = i; for (let j = 0; j <= M; j++) dp[0][j] = j;
    for (let i = 1; i <= N; i++) {
        for (let j = 1; j <= M; j++) {
            if (ref[i - 1] === typed[j - 1]) dp[i][j] = dp[i - 1][j - 1];
            else dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + 1);
        }
    }
    let diffHtml = '', i = N, j = M, ops =[];
    while (i > 0 || j > 0) {
        if (i > 0 && j > 0 && ref[i - 1] === typed[j - 1]) { ops.push({ type: 'match', char: ref[i - 1] }); i--; j--; } 
        else {
            let cDel = i > 0 ? dp[i - 1][j] : Infinity, cIns = j > 0 ? dp[i][j - 1] : Infinity, cRep = (i > 0 && j > 0) ? dp[i - 1][j - 1] : Infinity;
            let minC = Math.min(cDel, cIns, cRep);
            if (minC === cRep && dp[i][j] === cRep + 1) { ops.push({ type: 'replace', exp: ref[i - 1], act: typed[j - 1] }); i--; j--; } 
            else if (minC === cIns && dp[i][j] === cIns + 1) { ops.push({ type: 'insert', act: typed[j - 1] }); j--; } 
            else if (minC === cDel && dp[i][j] === cDel + 1) { ops.push({ type: 'delete', exp: ref[i - 1] }); i--; } 
            else { if (i > 0 && j > 0) { ops.push({ type: 'replace', exp: ref[i - 1], act: typed[j - 1] }); i--; j--; } else if (i > 0) { ops.push({ type: 'delete', exp: ref[i - 1] }); i--; } else { ops.push({ type: 'insert', act: typed[j - 1] }); j--; } }
        }
    }
    ops.reverse();
    ops.forEach(op => {
        let esc = (str) => str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '↵<br>');
        if (op.type === 'match') diffHtml += `<span class="diff-match">${esc(op.char)}</span>`;
        else if (op.type === 'replace') diffHtml += `<span class="diff-delete">${esc(op.exp)}</span><span class="diff-insert">${esc(op.act)}</span>`;
        else if (op.type === 'insert') diffHtml += `<span class="diff-insert">${esc(op.act)}</span>`;
        else if (op.type === 'delete') diffHtml += `<span class="diff-delete">${esc(op.exp)}</span>`;
    });
    return diffHtml;
}

/* =========================================================
   [JS] 7. ミニゲーム（メテオ ＆ Dチャレンジ）
   ========================================================= */
let mgInterval, mgSpawnInterval, mgTimeInterval, mgTime = 60, mgScore = 0, mgWords =[], mgActiveWord = null, cancelMgStartHandler = null; 
let currentMinigameType = 'meteor';

let dBoost = 1.0;
let dLevel = 1;
let dClearedWords = 0;
let dChallengeWords = { 1:[], 2:[], 3:[], 4:[] };
let dCurrentWordMissed = false; 

function initDChallengeWords() {
    dChallengeWords = { 1: [], 2: [], 3:[], 4:[] };
    const addWord = (c) => {
        let len = c.h.length;
        if (len <= 2) dChallengeWords[1].push(c);
        else if (len === 3) dChallengeWords[2].push(c);
        else if (len >= 4 && len <= 5) dChallengeWords[3].push(c);
        else dChallengeWords[4].push(c);
    };
    WORD_DATA.forEach(d => { d.chars.forEach(addWord); });
    const MG_NOUNS = WORD_DATA[0].chars; 
    const MG_EXTRA_WORDS = WORD_DATA[1].chars; 
    MG_NOUNS.forEach(addWord);
    MG_EXTRA_WORDS.forEach(addWord);
}

function getDChallengeWord(level) {
    const list = dChallengeWords[level] || dChallengeWords[1];
    return list[Math.floor(Math.random() * list.length)];
}

function getRandomMinigameWord() {
    const group = WORD_DATA[Math.floor(Math.random() * WORD_DATA.length)];
    return group.chars[Math.floor(Math.random() * group.chars.length)];
}

function updateBoostGauge() {
    if (currentMinigameType !== 'd_challenge') return;
    const maxBoost = 5.0;
    let fillPercent = ((dBoost - 1.0) / (maxBoost - 1.0)) * 100;
    if (fillPercent < 0) fillPercent = 0; if (fillPercent > 100) fillPercent = 100;
    const gaugeFill = document.getElementById('boost-gauge-fill');
    const multiplier = document.getElementById('boost-multiplier');
    if (gaugeFill && multiplier) {
        gaugeFill.style.height = fillPercent + '%';
        multiplier.innerText = 'x' + dBoost.toFixed(1);
    }
}

function startMinigame(type) {
    SoundManager.init(); if (document.activeElement) document.activeElement.blur(); 
    showScreen('screen-minigame');
    currentMinigameType = type || 'meteor';
    
    document.getElementById('mg-result-overlay').style.display = 'none'; 
    const mgArea = document.getElementById('minigame-area');
    mgArea.innerHTML = '';
    
    if (currentMinigameType === 'd_challenge') {
        mgArea.classList.add('d-challenge-mode');
        document.getElementById('boost-gauge-container').style.display = 'flex';
        document.getElementById('mg-score-label').innerHTML = `スコア: <span id="mg-score">0</span>`;
        initDChallengeWords();
        dBoost = 1.0; dLevel = 1; dClearedWords = 0;
        updateBoostGauge();
    } else {
        mgArea.classList.remove('d-challenge-mode');
        document.getElementById('boost-gauge-container').style.display = 'none';
        document.getElementById('mg-score-label').innerHTML = `スコア: <span id="mg-score">0</span>`;
    }

    mgTime = 60; mgScore = 0; mgWords =[]; mgActiveWord = null; updateMgHud();
    const overlay = document.getElementById('mg-start-overlay'); overlay.style.display = 'flex';
    
    if (cancelMgStartHandler) {
        document.removeEventListener('keydown', cancelMgStartHandler);
        overlay.removeEventListener('mousedown', cancelMgStartHandler);
    }
    
    const mgStartHandler = (e) => {
        if (e.isComposing || e.key === 'Process') { showImeWarning(); return; }

        if (e.key === ' ' || e.key === '　' || e.key === 'Enter' || e.type === 'mousedown') {
            e.preventDefault(); document.removeEventListener('keydown', mgStartHandler); 
            overlay.removeEventListener('mousedown', mgStartHandler); cancelMgStartHandler = null; 
            overlay.style.display = 'none';
            
            document.addEventListener('keydown', mgHandleKey);
            mgTimeInterval = setInterval(() => { mgTime--; updateMgHud(); if (mgTime <= 0) endMinigame(); }, 1000);
            
            if (currentMinigameType === 'meteor') {
                mgSpawnInterval = setInterval(spawnMgWordMeteor, 1500);
                mgInterval = setInterval(() => { 
                    mgWords.forEach((w, i) => { 
                        w.y += w.speed; w.el.style.top = w.y + 'px'; 
                        if (w.y > mgArea.offsetHeight - 50) { 
                            w.el.remove(); mgWords.splice(i, 1); 
                            if (mgActiveWord === w) mgActiveWord = null; 
                        } 
                    }); 
                }, 50);
            } else {
                spawnMgWordDChallenge();
                mgInterval = setInterval(() => {
                    if (mgTime > 0 && dBoost > 1.0) {
                        dBoost = Math.max(1.0, dBoost - 0.01);
                        updateBoostGauge();
                    }
                }, 100);
            }
        }
    };
    
    cancelMgStartHandler = mgStartHandler; 
    setTimeout(() => { document.addEventListener('keydown', mgStartHandler); overlay.addEventListener('mousedown', mgStartHandler); }, 300);
}

function stopMinigame() { 
    if (cancelMgStartHandler) { 
        document.removeEventListener('keydown', cancelMgStartHandler); 
        const overlay = document.getElementById('mg-start-overlay');
        if(overlay) overlay.removeEventListener('mousedown', cancelMgStartHandler);
        cancelMgStartHandler = null; 
    } 
    clearInterval(mgTimeInterval); clearInterval(mgSpawnInterval); clearInterval(mgInterval); 
    document.removeEventListener('keydown', mgHandleKey); 
}

function endMinigame() {
    stopMinigame(); SoundManager.playClear(); 
    let scoreText = `スコア: ${mgScore}`;
    document.getElementById('mg-final-score').innerText = scoreText;
    
    let isNewRecord = false; let u = users[currentUser];
    if (!u.examRecords) u.examRecords = {}; 

    if (currentMinigameType === 'd_challenge') {
        let prev = u.examRecords['mg_d_challenge'] || u.dChallengeHighscore || 0;
        if (mgScore > prev) { u.examRecords['mg_d_challenge'] = mgScore; u.dChallengeHighscore = mgScore; isNewRecord = true; saveUsers(false); }
    } else {
        let prev = u.examRecords['mg_meteor'] || u.minigameHighscore || 0;
        if (mgScore > prev) { u.examRecords['mg_meteor'] = mgScore; u.minigameHighscore = mgScore; isNewRecord = true; saveUsers(false); }
    }
    
    let rankHtml = `<h3 style="margin-top:0; color:#E91E63; border-bottom:2px solid #E91E63;">👑 トップ5 👑</h3><ul style="list-style:none; padding:0; font-size:20px; text-align:left; color:#333;">`;
    let ranking =[]; 
    Object.keys(users).forEach(n => { 
        if (!users[n].isMaster && n !== '__GLOBAL_SETTINGS__') {
            let s = currentMinigameType === 'd_challenge' ? (users[n].examRecords?.['mg_d_challenge'] || users[n].dChallengeHighscore || 0) : (users[n].examRecords?.['mg_meteor'] || users[n].minigameHighscore || 0);
            if (s > 0) ranking.push({ name: n, score: s }); 
        }
    }); 
    ranking.sort((a, b) => b.score - a.score);
    
    let displayRank = ranking.slice(0, 5); 
    displayRank.forEach((r, i) => { 
        let medal =['🥇', '🥈', '🥉', '４.', '５.'][i]; 
        let isMe = (r.name === currentUser) ? 'background:#fff9c4; font-weight:bold; border-radius:5px;' : ''; 
        rankHtml += `<li style="padding:5px; margin-bottom:5px; ${isMe}">${medal} ${r.name} : ${r.score} 点</li>`; 
    });
    rankHtml += `</ul>`; 
    
    let myRankIdx = ranking.findIndex(r => r.name === currentUser);
    let myRankText = myRankIdx !== -1 ? `あなたの順位： ${myRankIdx + 1} 位` : `あなたの順位： ランク外`;
    rankHtml += `<div style="margin-top: 15px; font-weight: bold; font-size: 22px; color: #1565C0; border-top: 2px dashed #90CAF9; padding-top: 10px;">${myRankText}</div>`;

    if (isNewRecord) rankHtml += `<div style="color:#E91E63; font-weight:bold; font-size:24px; animation:bounce 1s infinite; margin-top: 10px;">★しんきろく 達成！★</div>`;
    
    const rankBoard = document.getElementById('mg-ranking-board'); 
    rankBoard.innerHTML = rankHtml; rankBoard.style.display = 'block'; 
    document.getElementById('mg-result-overlay').style.display = 'flex'; 
    createConfetti();
}

function updateMgHud() { document.getElementById('mg-score').innerText = mgScore; document.getElementById('mg-time').innerText = `のこり: ${mgTime}秒`; }

function spawnMgWordMeteor() {
    const wordData = getRandomMinigameWord();
    const text = wordData.h; const romajiList = wordData.r; const el = document.createElement('div'); el.className = 'falling-word'; el.innerHTML = `${text}<br><span style="font-size:16px;">${romajiList[0]}</span>`;
    const areaWidth = document.getElementById('minigame-area').offsetWidth; let x = Math.random() * (areaWidth - 200) + 20; el.style.left = x + 'px'; el.style.top = '-50px';
    document.getElementById('minigame-area').appendChild(el); mgWords.push({ el: el, text: text, romajiList:[...romajiList], idx: 0, y: -50, speed: Math.random() * 1.5 + 0.8 });
}

function spawnMgWordDChallenge() {
    dCurrentWordMissed = false; 
    const wordData = getDChallengeWord(dLevel);
    const text = wordData.h; const romajiList = wordData.r; 
    const el = document.createElement('div'); el.className = 'd-challenge-word-display'; 
    el.innerHTML = `${text}<br><span class="romaji">${romajiList[0]}</span>`;
    document.getElementById('minigame-area').appendChild(el); 
    mgActiveWord = { el: el, text: text, romajiList:[...romajiList], idx: 0 };
}

function mgHandleKey(e) {
    if (mgTime <= 0 ||['Shift', 'Enter', 'Control', 'Alt', 'Meta', 'Tab', 'Escape'].includes(e.key)) return;
    if (e.isComposing || e.key === 'Process') { showImeWarning(); return; }
    
    let k = e.key.toUpperCase();
    
    if (currentMinigameType === 'd_challenge') {
        if (!mgActiveWord) return;
        let isCorrect = false; let validPatterns = mgActiveWord.romajiList.filter(r => r[mgActiveWord.idx] === k);
        if (validPatterns.length > 0) { mgActiveWord.romajiList = validPatterns; mgActiveWord.idx++; isCorrect = true; }
        
        if (isCorrect) {
            SoundManager.playType(); 
            mgScore += Math.floor(10 * dBoost); updateMgHud(); 
            
            updateMgWordDisplayDChallenge(mgActiveWord);
            mgActiveWord.el.classList.remove('error');
            mgActiveWord.el.classList.add('pop');
            setTimeout(()=> { if(mgActiveWord) mgActiveWord.el.classList.remove('pop'); }, 100);

            if (mgActiveWord.idx >= mgActiveWord.romajiList[0].length) {
                SoundManager.playSuccess(); 
                mgScore += Math.floor(50 * dBoost); 
                
                if (!dCurrentWordMissed) {
                    dBoost = Math.min(5.0, dBoost + 0.5); 
                    updateBoostGauge();
                }
                updateMgHud(); 

                mgActiveWord.el.classList.add('boost-active');
                
                dClearedWords++;
                if (dClearedWords >= 3 && dLevel < 4) {
                    dLevel++; dClearedWords = 0;
                }
                
                let oldEl = mgActiveWord.el;
                mgActiveWord = null;
                setTimeout(() => { oldEl.remove(); spawnMgWordDChallenge(); }, 300);
            }
        } else { 
            SoundManager.playError(); 
            dCurrentWordMissed = true;
            dBoost = Math.max(1.0, dBoost - 0.5); 
            updateBoostGauge();
            
            mgActiveWord.el.classList.remove('pop');
            mgActiveWord.el.classList.add('error');
            setTimeout(()=> { if(mgActiveWord) mgActiveWord.el.classList.remove('error'); }, 200);
        }
    } else {
        if (mgActiveWord) {
            let isCorrect = false, validPatterns = mgActiveWord.romajiList.filter(r => r[mgActiveWord.idx] === k);
            if (validPatterns.length > 0) { mgActiveWord.romajiList = validPatterns; mgActiveWord.idx++; isCorrect = true; }
            if (isCorrect) { 
                SoundManager.playType(); updateMgWordDisplayMeteor(mgActiveWord); 
                if (mgActiveWord.idx >= mgActiveWord.romajiList[0].length) { 
                    SoundManager.playSuccess(); mgActiveWord.el.remove(); mgWords = mgWords.filter(w => w !== mgActiveWord); 
                    mgScore += mgActiveWord.romajiList[0].length * 100; mgActiveWord = null; updateMgHud(); 
                } 
            } else SoundManager.playError();
        } else {
            let found = null; for (let w of mgWords) { let valid = w.romajiList.filter(r => r[0] === k); if (valid.length > 0) { w.romajiList = valid; w.idx = 1; found = w; break; } }
            if (found) { 
                SoundManager.playType(); mgActiveWord = found; updateMgWordDisplayMeteor(mgActiveWord); 
                if (mgActiveWord.idx >= mgActiveWord.romajiList[0].length) { 
                    SoundManager.playSuccess(); mgActiveWord.el.remove(); mgWords = mgWords.filter(w => w !== mgActiveWord); 
                    mgScore += mgActiveWord.romajiList[0].length * 100; mgActiveWord = null; updateMgHud(); 
                } 
            } else SoundManager.playError();
        }
    }
}

function updateMgWordDisplayMeteor(w) { 
    mgWords.forEach(word => { if(word.el) word.el.style.zIndex = '1'; }); 
    const r = w.romajiList[0]; const typed = r.substring(0, w.idx); const untyped = r.substring(w.idx); 
    w.el.innerHTML = `${w.text}<br><span style="font-size:16px;"><span class="typed">${typed}</span>${untyped}</span>`; 
    w.el.style.borderColor = '#FFeb3b'; w.el.style.boxShadow = '0 0 15px rgba(255, 235, 59, 0.8)'; 
    w.el.style.zIndex = '100'; 
}

function updateMgWordDisplayDChallenge(w) {
    const r = w.romajiList[0]; const typed = r.substring(0, w.idx); const untyped = r.substring(w.idx); 
    w.el.innerHTML = `${w.text}<br><span class="romaji"><span class="typed">${typed}</span>${untyped}</span>`;
}

/* =========================================================
   [JS] 8. 共通ゲーム進行 ＆ キーボード・マウスのコアロジック
   ========================================================= */
let gameMode, currentStage, isProcessing = false;
let mainQueue =[], currentCount = 0, totalCount = 1;
let totalKeysTyped = 0, missKeysTyped = 0, targetKey = '', isHomeReturn = false, pendingHome = null;
let isHiragana = false, isWord = false, currHiraObj = null, activeRomajiList =[], currRomajiIdx = 0;
let isExam = false, mistakeCount = 0, maxMistakes = 3, mistakeStats = {}, hasMissLimit = false;
let timerInterval = null, startTime = 0, isTimeAttackMode = false;
let cancelStartHandler = null; 
let typedRomajiStr = "";

let visionScore = 0, visionTarget = 0, visionInterval = null, visionTimeout = null;
let isVisionHardMode = false; 
let isVisionEasyMode = false;

const els = {
    playArea: document.getElementById('play-area'), 
    instText: document.getElementById('inst-text'),
    missCounter: document.getElementById('mistake-counter'), 
    progressFill: document.getElementById('progress-bar-fill'),
    progressText: document.getElementById('progress-text'), 
    timerDisplay: document.getElementById('timer-display'), 
    fbOverlay: document.getElementById('feedback-overlay'), 
    fbText: document.getElementById('feedback-text'),
    fbTime: document.getElementById('feedback-time'), 
    failOverlay: document.getElementById('fail-overlay'),
    advice: document.getElementById('fail-advice'), 
    ctxMenu: document.getElementById('fake-context-menu'),
    startOverlay: document.getElementById('start-overlay')
};

function getStageName(sid) {
    if (sid === 9888) return "[ID:9888] にがてとっくん";
    let st = KEYBOARD_STAGES.find(s => s.id === sid) || BLIND_STAGES.find(s => s.id === sid) || 
             BRIDGE_STAGES.find(s => s.id === sid) || EXAMS.find(s => s.id === sid) ||
             HIRAGANA_DATA.find(s => s.id === sid) || WORD_DATA.find(s => s.id === sid);
    if (st) return `[ID:${sid}] ${st.title}`;

    if (sid >= 3100 && sid <= 3299) {
        let base = sid - (sid >= 3200 ? 200 : 100);
        st = HIRAGANA_DATA.find(s => s.id === base);
        if (st) return `[ID:${sid}] ${st.title}(ブラインド)`;
    }
    return `[ID:${sid}] 未知のステージ`;
}

function startGame(sid, mode) {
    SoundManager.init(); currentStage = sid; gameMode = mode; isProcessing = false;
    mainQueue =[]; currentCount = 0; totalCount = 1; pendingHome = null; isHomeReturn = false;
    mistakeCount = 0; mistakeStats = {}; currRomajiIdx = 0; activeRomajiList =[]; currHiraObj = null; totalKeysTyped = 0; missKeysTyped = 0;
    typedRomajiStr = ""; 
    
    isExam =[1101,1102,1103,1104,1999, 2101,2102,2103,2104,2999, 3301,3302,3303,3304,3999, 4101,4102,4103,4999].includes(sid) || (sid >= 3200 && sid < 3300);
    isHiragana = (sid >= 3000 && sid < 4000) || sid === 9888;
    isWord = (sid >= 4000 && sid < 5000);
    hasMissLimit = isExam;
    
    if (hasMissLimit) maxMistakes = ((sid >= 2100 && sid < 2200) || (sid >= 3200 && sid <= 3300) || isHiragana) ? 5 : 3;

    let alreadyCleared = false;
    if (mode === 'keyboard' && sid !== 9888) {
        const idx = STAGE_ORDER.indexOf(sid);
        alreadyCleared = (idx !== -1 && users[currentUser].keyboardSequence > idx);
    }
    isTimeAttackMode = isExam && alreadyCleared;

    if (document.activeElement) document.activeElement.blur();
    els.playArea.innerHTML = ''; els.fbOverlay.style.display = 'none'; els.fbTime.style.display = 'none'; els.failOverlay.style.display = 'none'; els.ctxMenu.style.display = 'none';
    let statDiv = document.getElementById('feedback-stats'); if(statDiv) statDiv.style.display = 'none';
    document.removeEventListener('keydown', handleKeyDown);

    if (hasMissLimit) { els.missCounter.style.display = 'inline-block'; els.missCounter.innerText = `ミス：0 / ${maxMistakes}`; els.missCounter.classList.remove('status-danger'); } 
    else { els.missCounter.style.display = 'none'; }
    
    if (timerInterval) clearInterval(timerInterval);
    if (visionInterval) clearInterval(visionInterval);
    if (visionTimeout) clearTimeout(visionTimeout);
    
    showScreen('screen-game');
    
    if (mode === 'mouse') { 
        setupMouse(sid); 
        document.getElementById('start-message').innerText = 'がめんを クリックして はじめるよ！'; 
        document.oncontextmenu = (e) => { e.preventDefault(); }; 
    } 
    else if (mode === 'vision') { 
        isVisionHardMode = String(sid).endsWith('_hard');
        isVisionEasyMode = String(sid).endsWith('_easy'); 
        let baseSid = String(sid).replace('_hard', '').replace('_easy', ''); 
        setupVision(baseSid); 
        document.getElementById('start-message').innerText = 'がめんを クリックして はじめるよ！'; 
        document.oncontextmenu = null;
    } 
    else if (mode === 'romaji') { 
        setupRomajiTable(sid); 
        document.getElementById('start-message').innerText = 'スペースキーをおして スタート！'; 
        document.oncontextmenu = null;
    }
    else { 
        setupKeyboard(sid); 
        document.getElementById('start-message').innerText = 'スペースキーをおして スタート！'; 
        document.oncontextmenu = null;
    }
    
    els.startOverlay.style.display = 'flex'; isProcessing = true; 
    if (cancelStartHandler) { document.removeEventListener('keydown', cancelStartHandler); els.startOverlay.removeEventListener('mousedown', cancelStartHandler); }

    const startHandler = (e) => {
        if (((mode === 'mouse' || mode === 'vision') && e.type === 'mousedown') || 
            ((mode === 'keyboard' || mode === 'romaji') && (e.type === 'mousedown' || e.key === ' ' || e.key === '　' || e.key === 'Enter'))) {
            
            e.preventDefault(); 
            document.removeEventListener('keydown', startHandler); 
            els.startOverlay.removeEventListener('mousedown', startHandler);
            cancelStartHandler = null; 
            els.startOverlay.style.display = 'none'; 
            isProcessing = false;
            
            if (gameMode === 'keyboard') document.addEventListener('keydown', handleKeyDown);
            
            startTime = Date.now(); 
            if (isTimeAttackMode || mode === 'vision' || mode === 'romaji') {
                els.timerDisplay.style.display = 'inline-block'; 
                els.timerDisplay.innerText = '0.0秒';
                timerInterval = setInterval(() => {
                    if (isProcessing && mainQueue.length === 0 && mode !== 'vision' && mode !== 'romaji') return; 
                    els.timerDisplay.innerText = ((Date.now() - startTime) / 1000).toFixed(1) + '秒';
                }, 100);
            } else { 
                els.timerDisplay.style.display = 'none'; 
            }
            
            if (mode === 'mouse') nextTask(); 
            else if (mode === 'vision') startVisionGame(String(sid).replace('_hard', '').replace('_easy', '')); 
            else if (mode === 'romaji') {
                const firstInp = document.querySelector('.romaji-input:not(:disabled)');
                if(firstInp) firstInp.focus();
            }
            else nextKeyQ();
        }
    };
    cancelStartHandler = startHandler; document.addEventListener('keydown', startHandler); els.startOverlay.addEventListener('mousedown', startHandler);
}

function updateProgress() {
    let p = 0; if (totalCount > 0) p = Math.min(100, Math.floor((currentCount / totalCount) * 100));
    els.progressFill.style.width = p + '%'; els.progressText.innerText = p + '%';
}

function completeTask(delay) {
    currentCount++; updateProgress();
    if (mainQueue.length === 0 && !pendingHome) setTimeout(markClear, delay); else setTimeout(nextTask, delay);
}

function markClear() {
    try {
        if (timerInterval) clearInterval(timerInterval);
        if (visionInterval) clearInterval(visionInterval);
        if (visionTimeout) clearTimeout(visionTimeout);
        let clearMsg = 'クリア！', timeMsg = '', statsMsg = ''; 
        const elapsed = (Date.now() - startTime) / 1000;
        let isNewRecord = false; 

        let coinGain = 0;
        if (gameMode === 'mouse') {
            let isFirst = users[currentUser] && users[currentUser].mouseLevel < currentStage;
            coinGain = isFirst ? 50 : 1; 
            if (isFirst) users[currentUser].mouseLevel = currentStage;
        } else if (gameMode === 'vision') {
            if (!users[currentUser].visionCleared) users[currentUser].visionCleared =[];
            let isFirst = !users[currentUser].visionCleared.includes(currentStage);
            if (isFirst) users[currentUser].visionCleared.push(currentStage);

            if (!users[currentUser].examRecords) users[currentUser].examRecords = {};
            const prev = users[currentUser].examRecords[currentStage];
            if (!prev || elapsed < prev) { 
                users[currentUser].examRecords[currentStage] = elapsed; 
                isNewRecord = true; 
            }
            
            if (isVisionHardMode) {
                if (isFirst) coinGain = 100; 
                else if (isNewRecord && prev) coinGain = 50; 
                else coinGain = 0; 
            } else {
                if (isFirst) coinGain = 50; 
                else if (isNewRecord && prev) coinGain = 30; 
                else coinGain = 0; 
            }

            timeMsg = `タイム: ${elapsed.toFixed(1)}秒${isVisionHardMode ? '<br><span style="font-size:24px; color:#d84315;">(🔥 ハードモード)</span>' : ''}`;
            if (isNewRecord && prev) timeMsg += `<br><span style="font-size:24px; color:#ffeb3b;">★しんきろく！★</span>`;
        } else if (gameMode === 'romaji') {
            let isExamMode = String(currentStage).endsWith('_exam');
            coinGain = isExamMode ? 50 : 20;
            
            // ★追加: ローマ字テストのクリア履歴を保存する
            if (!users[currentUser].examRecords) users[currentUser].examRecords = {};
            const prev = users[currentUser].examRecords[currentStage];
            if (!prev || elapsed < prev) { 
                users[currentUser].examRecords[currentStage] = elapsed; 
            }
            
            timeMsg = `タイム: ${elapsed.toFixed(1)}秒${isExamMode ? '<br><span style="font-size:24px; color:#E91E63;">(🔥 テスト合格！)</span>' : ''}`;
        } else {
            let acc = 0; if (totalKeysTyped + missKeysTyped > 0) acc = Math.floor((totalKeysTyped / (totalKeysTyped + missKeysTyped)) * 100);
            let kpm = Math.floor((totalKeysTyped / Math.max(elapsed, 1)) * 60);
            statsMsg = `🎯 せいかくりつ: ${acc}%　⚡ はやさ: ${kpm} 打/分`;
            if (missKeysTyped === 0 && isExam && users[currentUser]) users[currentUser].hasPerfectClear = true;

            let isFirst = false;
            if (currentStage !== 9888) {
                const idx = STAGE_ORDER.indexOf(currentStage);
                if (idx !== -1 && users[currentUser] && users[currentUser].keyboardSequence <= idx) {
                    users[currentUser].keyboardSequence = idx + 1; isFirst = true;
                }
            }
            
            if (isTimeAttackMode && currentStage !== 9888) {
                if (users[currentUser]) {
                    if (!users[currentUser].examRecords) users[currentUser].examRecords = {};
                    const prev = users[currentUser].examRecords[currentStage];
                    if (!prev || elapsed < prev) { users[currentUser].examRecords[currentStage] = elapsed; isNewRecord = true; }

                    const exData = EXAMS.find(e => e.id === currentStage);
                    if (exData) {
                        let medal = '🥉 銅メダル';
                        if (elapsed <= exData.gold) medal = '🥇 金メダル!!'; else if (elapsed <= exData.silver) medal = '🥈 銀メダル!';
                        timeMsg = `タイム: ${elapsed.toFixed(1)}秒 <br><span style="font-size:30px;">(${medal})</span>`;
                        if (isNewRecord && prev) timeMsg += `<br><span style="font-size:24px; color:#ffeb3b;">★しんきろく！★</span>`;
                    }
                }
            } else if (isExam && !isTimeAttackMode && currentStage !== 9888) {
                timeMsg = `<span style="font-size:24px; color:#E91E63;">✨ごうかく！ 次からタイムアタックができるよ！✨</span>`;
            }

            if (currentStage === 9888) { 
                coinGain = 10; 
                if (users[currentUser].currentWeakKeys) {
                    users[currentUser].currentWeakKeys.forEach(k => {
                        if (users[currentUser].globalMistakes && users[currentUser].globalMistakes[k]) {
                            delete users[currentUser].globalMistakes[k]; 
                        }
                    });
                    delete users[currentUser].currentWeakKeys;
                }
            } else {
                let cat = Math.floor(currentStage / 1000);
                if (cat === 1) { coinGain = isFirst ? 100 : 10; }      
                else if (cat === 2) { coinGain = isFirst ? 150 : 20; } 
                else if (cat === 3) { coinGain = isFirst ? 200 : 30; } 
                else if (cat === 4) { coinGain = isFirst ? 250 : 50; } 
                else { coinGain = isFirst ? 50 : 10; } 
            }
        }
        
        let earnedTicket = null;
        if ([1999, 2999, 4999, 3999].includes(currentStage)) {
            if (!users[currentUser].tickets) users[currentUser].tickets =[];
            
            const glob = users['__GLOBAL_SETTINGS__'] || {};
            const config = glob.ticketConfig || { normal: { name: '👍 いいねポイント 5こ', icon: '🎟️' }, newRecord: { name: '👍 いいねポイント 1こ', icon: '🎟️' } };

            if (!isTimeAttackMode) earnedTicket = { id: 'ticket_normal', name: config.normal.name, icon: config.normal.icon };
            else if (isNewRecord) earnedTicket = { id: 'ticket_newrecord', name: config.newRecord.name, icon: config.newRecord.icon };
            
            if (earnedTicket) {
                users[currentUser].tickets.push({ id: earnedTicket.id, name: earnedTicket.name, date: new Date().toLocaleDateString() });
                clearMsg += `<br><span style="font-size:24px; color:#FF5722;">${earnedTicket.icon} チケットゲット！</span>`;
            }
        }

        if (users[currentUser]) {
            users[currentUser].coins = (users[currentUser].coins || 0) + coinGain;
            clearMsg += `<br><span style="font-size:24px; color:#FFD700;">💰 +${coinGain} コインゲット！</span>`;
        }
        saveUsers(false);
        
        SoundManager.playClear();
        els.fbText.innerHTML = clearMsg; els.fbTime.innerHTML = timeMsg; els.fbTime.style.display = timeMsg ? 'block' : 'none';
        let statDiv = document.getElementById('feedback-stats');
        if (!statDiv) { statDiv = document.createElement('div'); statDiv.id = 'feedback-stats'; els.fbOverlay.appendChild(statDiv); }
        statDiv.innerHTML = statsMsg; statDiv.style.display = statsMsg ? 'block' : 'none';
        
        els.fbOverlay.style.display = 'flex'; document.getElementById('progress-bar-fill').style.width = '100%';
        createConfetti();

        if (earnedTicket) {
            setTimeout(() => {
                els.fbOverlay.style.display = 'none';
                showRewardOverlay("🎉 チケット ゲット！ 🎉", earnedTicket.name, earnedTicket.icon, () => { backToMenu(); });
            }, 3000);
        } else { setTimeout(backToMenu, 4000); }
    } catch(err) {
        console.error("markClearエラー:", err);
        setTimeout(backToMenu, 2000); 
    }
}

// ★完全復活した backToMenu 関数
function backToMenu() {
    try {
        if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
        if (visionInterval) { clearInterval(visionInterval); visionInterval = null; }
        if (visionTimeout) { clearTimeout(visionTimeout); visionTimeout = null; }
        
        if (cancelStartHandler) {
            document.removeEventListener('keydown', cancelStartHandler);
            const overlay = document.getElementById('start-overlay');
            if(overlay) overlay.removeEventListener('mousedown', cancelStartHandler);
            cancelStartHandler = null;
        }
        document.getElementById('start-overlay').style.display = 'none';
        document.getElementById('feedback-overlay').style.display = 'none';
        document.getElementById('fail-overlay').style.display = 'none';

        document.removeEventListener('keydown', handleKeyDown);
        
        document.oncontextmenu = null; 
        els.playArea.oncontextmenu = null;
        
        isProcessing = false;
        
        if (gameMode === 'mouse') {
            updateMouseButtons();
            showScreen('screen-mouse-menu');
        }
        else if (gameMode === 'vision') {
            renderVisionMenu();
            showScreen('screen-vision-menu');
        }
        else {
            updateKeyboardButtons();
            // ★追加: もしステージ一覧を開いていたなら、最新の進捗で再描画する
            if (currentKeyboardChapter && document.getElementById('kb-stage-container').style.display === 'flex') {
                renderKeyboardStages(currentKeyboardChapter);
            }
            showScreen('screen-keyboard-menu');
        }
    } catch(e) {
        console.error("backToMenuエラー:", e);
        showScreen('screen-category');
    }
}

function retryExam() { startGame(currentStage, gameMode); }

function failExam() {
    if (timerInterval) clearInterval(timerInterval);
    SoundManager.playError(); const keys = Object.keys(mistakeStats);
    if (keys.length > 0) {
        const worst = keys.reduce((a, b) => mistakeStats[a] > mistakeStats[b] ? a : b);
        const hintId = ADVICE_HINT_MAP[worst];
        if (hintId) {
            const btn = document.createElement('button'); btn.className = 'btn-primary'; btn.innerText = 'ふくしゅうする';
            btn.onclick = () => startGame(hintId, 'keyboard');
            const area = document.getElementById('fail-buttons-area');
            if (area.children.length > 2) area.removeChild(area.firstChild);
            area.insertBefore(btn, area.firstChild);
        }
        els.advice.innerHTML = `「${worst}」が にがてかも。<br>ふくしゅうしよう！`; els.advice.style.display = 'block';
    } else { els.advice.style.display = 'none'; }
    els.failOverlay.style.display = 'flex'; setTimeout(() => { document.getElementById('btn-retry-exam').focus(); }, 100);
}

function nextTask() {
    if (gameMode === 'mouse') {
        els.playArea.innerHTML = ''; els.ctxMenu.style.display = 'none'; 
        els.playArea.oncontextmenu = (e) => { e.preventDefault(); }; 
        els.playArea.style.overflowY = 'hidden'; els.playArea.style.display = 'flex'; isProcessing = false;
        const task = mainQueue.shift(); if (!task) return;
        if (task.type === 'move') m_move(); else if (task.type === 'click') m_click(); else if (task.type === 'dbl') m_dbl(); else if (task.type === 'menu') m_menu(); else if (task.type === 'drag') m_drag(); else if (task.type === 'scroll') m_scroll();
    } else { nextKeyQ(); }
}

function handleKeyDown(e) {
    if (isProcessing ||['Enter', 'Shift', 'Control', 'Alt', 'Meta', 'Tab', 'CapsLock', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) return;
    
    if (e.isComposing || e.key === 'Process' || e.key === 'Unidentified') {
        showImeWarning();
        return;
    }
    
    if (e.key === 'Backspace') {
        if ((isHiragana || isWord) && currRomajiIdx > 0) {
            SoundManager.playHover();
            currRomajiIdx--;
            typedRomajiStr = typedRomajiStr.slice(0, -1);
            let baseList = Array.isArray(currHiraObj.r) ?[...currHiraObj.r] :[currHiraObj.r];
            activeRomajiList = baseList.filter(r => r.startsWith(typedRomajiStr));
            let nextChar = activeRomajiList[0].charAt(currRomajiIdx);
            targetKey = (nextChar === ' ') ? 'SPACE' : nextChar;
            if (!document.getElementById('keyboard-wrapper').classList.contains('blind-active')) updRomaji();
            updateVisuals();
        }
        return;
    }

    let k = e.key; if (k === 'Process' || k === 'Unidentified') return;
    const map = { '、': ',', '。': '.', '・': '/', 'ー': '-' }; if (map[k]) k = map[k];
    const upper = k.toUpperCase(); const chk = (k === ' ') ? ' ' : upper;
    const el = document.querySelector(`.key[data-key="${chk}"]`);
    if (el) { el.classList.add('pressed'); setTimeout(() => el.classList.remove('pressed'), 150); }

    let isCorrect = false;
    let inputChar = (k === ' ') ? ' ' : upper; 
    if (isHiragana || isWord) {
        const validPatterns = activeRomajiList.filter(r => r[currRomajiIdx] === inputChar);
        if (validPatterns.length > 0) { isCorrect = true; activeRomajiList = validPatterns; }
    } else { isCorrect = (targetKey === 'SPACE' ? k === ' ' : upper === targetKey); }

    if (isCorrect) {
        totalKeysTyped++; SoundManager.playType();
        if (users[currentUser]) users[currentUser].totalKeysTyped = (users[currentUser].totalKeysTyped || 0) + 1; 
        if (isHomeReturn) { 
            mainQueue.shift(); currentCount++; updateProgress(); pendingHome = null; isProcessing = true; 
            setTimeout(() => { if (mainQueue.length === 0) markClear(); else nextKeyQ(); }, 200); return; 
        }
        if (isHiragana || isWord) {
            typedRomajiStr += inputChar; 
            currRomajiIdx++;
            if (activeRomajiList.some(r => currRomajiIdx >= r.length)) finishItemSuccess();
            else {
                let nextChar = activeRomajiList[0].charAt(currRomajiIdx);
                targetKey = (nextChar === ' ') ? 'SPACE' : nextChar;
                if (!document.getElementById('keyboard-wrapper').classList.contains('blind-active')) updRomaji();
                updateVisuals();
            }
        } else {
            if (currentStage < 1500 && !isExam && ![1051, 1052, 1053, 1054].includes(currentStage) && targetKey !== 'SPACE') {
                const f = FINGER_MAP[targetKey], h = FINGER_HOME_MAP[f];
                if (h && targetKey !== h) pendingHome = h;
            }
            finishItemSuccess();
        }
    } else {
        missKeysTyped++; SoundManager.playError(); if (el) { el.classList.add('error-flash'); setTimeout(() => el.classList.remove('error-flash'), 300); }
        if (gameMode === 'keyboard' && currentStage !== 9888) { 
            let sk = (isHiragana || isWord) ? currHiraObj.h : targetKey; 
            if (users[currentUser]) {
                if (!users[currentUser].globalMistakes) users[currentUser].globalMistakes = {};
                users[currentUser].globalMistakes[sk] = (users[currentUser].globalMistakes[sk] || 0) + 1;
            }
        }
        if (hasMissLimit) {
            let sk = (isHiragana || isWord) ? currHiraObj.h : targetKey; 
            mistakeStats[sk] = (mistakeStats[sk] || 0) + 1; mistakeCount++; els.missCounter.innerText = `ミス：${mistakeCount} / ${maxMistakes}`;
            if (mistakeCount >= maxMistakes) { els.missCounter.classList.add('status-danger'); isProcessing = true; setTimeout(failExam, 500); }
        }
    }
}

function finishItemSuccess() {
    const cur = mainQueue.shift(); const nxt = mainQueue[0]; currRomajiIdx = 0; activeRomajiList =[];
    let delay = 500;
    if (cur && !cur.blind && nxt && nxt.blind && !nxt.ret && ((cur.key && cur.key === nxt.key) || (cur.h && cur.h === nxt.h))) {
        delay = 1500; 
        setTimeout(() => {
            const mq = document.getElementById('main-q');
            if (mq) mq.innerText = '👀 みないで うとう！';
            const hq = document.getElementById('romaji-hint');
            if (hq) hq.innerText = '';
            document.querySelectorAll('.key').forEach(k => k.className = 'key' + (k.classList.contains('space') ? ' space' : ''));
            document.querySelectorAll('.finger').forEach(f => f.className = f.className.replace(/ active| color-\w+/g, ''));
        }, 400);
    }
    isProcessing = true; SoundManager.playSuccess(); completeTask(delay);
}

function mkEl(c, h) { const d = document.createElement('div'); d.className = c; d.innerHTML = h; return d; }
function rndPos(e) { const r = els.playArea.getBoundingClientRect(); e.style.left = (Math.random() * (r.width - 150) + 50) + 'px'; e.style.top = (Math.random() * (r.height - 150) + 50) + 'px'; }

function setupMouse(s) {
    els.playArea.style.justifyContent = 'normal'; els.playArea.style.alignItems = 'normal'; mainQueue =[];
    if (s===1) { for(let i=0;i<15;i++) mainQueue.push({type:'move'}); } else if (s===2) { for(let i=0;i<15;i++) mainQueue.push({type:'click'}); } else if (s===3) { for(let i=0;i<6;i++) mainQueue.push({type:'dbl'}); } else if (s===4) { for(let i=0;i<3;i++) mainQueue.push({type:'menu'}); } else if (s===5) { for(let i=0;i<4;i++) mainQueue.push({type:'drag'}); } else if (s===6) { for(let i=0;i<3;i++) mainQueue.push({type:'scroll'}); } else if (s===7) { for(let i=0;i<3;i++) mainQueue.push({type:'move'}); for(let i=0;i<3;i++) mainQueue.push({type:'click'}); for(let i=0;i<2;i++) mainQueue.push({type:'dbl'}); for(let i=0;i<2;i++) mainQueue.push({type:'drag'}); mainQueue.push({type:'menu'}); mainQueue.push({type:'scroll'}); }
    totalCount = mainQueue.length; updateProgress(); 
}

function m_move() { els.instText.innerText="★に マウスの やじるし を あわせてね"; const s=mkEl('target star','★'); s.style.color='#FFC107'; rndPos(s); s.onmouseenter=()=>{if(isProcessing)return; isProcessing=true; SoundManager.playHover(); s.innerText='😊'; s.style.transform='scale(1.3)'; setTimeout(()=>{s.remove(); completeTask(300);},500);}; els.playArea.appendChild(s); }
function m_click() { els.instText.innerText="「トン」！ １かい クリックしてね"; const s=mkEl('target star','☆'); s.style.color='#E91E63'; rndPos(s); s.onclick=()=>{if(isProcessing)return; isProcessing=true; SoundManager.playClick(); s.innerText='✨'; setTimeout(()=>{s.remove(); completeTask(200);},200);}; els.playArea.appendChild(s); }

function m_dbl() {
        els.instText.innerText="「トントン」！ ２かい はやく クリックしてね";
const f=mkEl('target folder','📁<span class="folder-text">ひみつ</span>'); f.style.color='#FFCA28'; rndPos(f); f.ondblclick=()=>{if(isProcessing)return; isProcessing=true; SoundManager.playClick(); f.innerHTML='📂<span class="folder-text">あいた！</span>'; setTimeout(()=>{f.remove(); completeTask(300);},500);}; els.playArea.appendChild(f); }

function m_menu() { 
    els.instText.innerText="マウスの みぎがわ を「トン」と おして「★ひみつのメニュー★」を えらんでね";
    els.playArea.oncontextmenu=(e)=>{
        e.preventDefault(); 
        SoundManager.playHover(); 
        const m=els.ctxMenu; 
        
        let x = e.clientX; 
        let y = e.clientY; 
        if(x > window.innerWidth - 220) x = window.innerWidth - 220; 
        if(y > window.innerHeight - 150) y = window.innerHeight - 150; 
        
        m.style.position = 'fixed';
        m.style.left = x + 'px'; 
        m.style.top = y + 'px'; 
        m.style.display = 'block';
    }; 
    els.playArea.onclick=()=>{els.ctxMenu.style.display='none';}; 
}

window.handleSecretMenuClick = () => { 
    if(isProcessing)return; 
    isProcessing=true; 
    SoundManager.playSuccess(); 
    els.ctxMenu.style.display='none'; 
    els.playArea.oncontextmenu = null; 
    completeTask(300); 
};

function m_scroll() { 
    els.instText.innerText="コロコロ（ホイール）を まわして、一番下の ボタンを おしてね"; 
    els.playArea.style.display='block'; 
    els.playArea.style.overflowY='auto'; 
    els.playArea.scrollTop = 0; 
    
    const sc=document.createElement('div'); 
    sc.style.height='2000px'; 
    sc.style.width='100%'; 
    sc.style.position='relative'; 
    sc.style.background='linear-gradient(to bottom, #e1f5fe, #81d4fa, #29b6f6)'; 
    const btn=document.createElement('div'); 
    btn.className='stage-btn unlocked'; 
    btn.innerText='✨ ここを クリック！ ✨'; 
    btn.style.position='absolute'; 
    btn.style.bottom='20px'; 
    btn.style.left='50%'; 
    btn.style.transform='translateX(-50%)'; 
    btn.style.width='300px'; 
    btn.style.fontSize='24px'; 
    btn.style.backgroundColor='#FFC107'; 
    btn.onclick=()=>{
        if(isProcessing)return; 
        isProcessing=true; 
        SoundManager.playClick(); 
        btn.innerText='⭕️'; 
        setTimeout(()=>{
            els.playArea.style.overflowY='hidden'; 
            els.playArea.style.display='flex'; 
            sc.remove(); 
            completeTask(300);
        },500);
    }; 
    sc.appendChild(btn); 
    els.playArea.appendChild(sc); 
}

function m_drag() { 
    els.instText.innerText="あかいボールを ゴミばこまで ひっぱって いってね"; 
    let t=mkEl('trash','🗑️'); els.playArea.appendChild(t); 
    const b=mkEl('draggable','●'); b.style.left='50px'; b.style.top='50px'; els.playArea.appendChild(b); 
    let d=false; 
    b.onmousedown=()=>{
        if(!isProcessing){
            d=true; SoundManager.playHover(); b.style.cursor='grabbing'; b.style.transform='scale(1.1)';
        }
    }; 
    els.playArea.onmousemove=(e)=>{
        if(d){
            const r=els.playArea.getBoundingClientRect(); 
            b.style.left=(e.clientX-r.left-45)+'px'; 
            b.style.top=(e.clientY-r.top-45)+'px';
            const br=b.getBoundingClientRect(), tr=t.getBoundingClientRect();
            if(Math.hypot(br.x-tr.x, br.y-tr.y) < 180) {
                t.classList.add('ready-to-eat');
            } else {
                t.classList.remove('ready-to-eat');
            }
        }
    }; 
    els.playArea.onmouseup=()=>{
        if(d){
            d=false; b.style.cursor='grab'; b.style.transform='scale(1)'; 
            t.classList.remove('ready-to-eat');
            const br=b.getBoundingClientRect(), tr=t.getBoundingClientRect(); 
            if(Math.hypot(br.x-tr.x, br.y-tr.y)<180){
                if(!isProcessing){
                    isProcessing=true; b.style.display='none'; SoundManager.playTrash(); 
                    t.classList.add('active'); 
                    const ok=mkEl('ok-mark','⭕️'); 
                    ok.style.left='50%'; ok.style.top='50%'; 
                    ok.style.transform='translate(-50%, -50%)'; ok.style.bottom='auto';
                    els.playArea.appendChild(ok); 
                    setTimeout(()=>{t.classList.remove('active'); ok.remove(); completeTask(300);},1000);
                }
            }
        }
    }; 
    els.playArea.onmouseleave=()=>{
        d=false; b.style.cursor='grab'; b.style.transform='scale(1)'; t.classList.remove('ready-to-eat');
    }; 
}

function setupKeyboard(s) {
    renderKeyboard(); let pool =[];
    if (s === 9888) { 
        let mistakes = users[currentUser].globalMistakes || {}; 
        let validKeys = Object.keys(mistakes).filter(k => mistakes[k] > 0); 
        let sortedKeys = validKeys.sort((a, b) => mistakes[b] - mistakes[a]).slice(0, 8); 
        let raw =[];
        sortedKeys.forEach(k => { 
            if (/[ぁ-ん]/.test(k) || WORD_DATA.some(d => d.chars.some(c=>c.h===k))) { 
                let r =[convertNameToRomaji(k)]; 
                HIRAGANA_DATA.forEach(d => d.chars.forEach(c => { if(c.h === k) r = c.r; })); 
                WORD_DATA.forEach(d => d.chars.forEach(c => { if(c.h === k) r = c.r; })); 
                for(let i=0; i<3; i++) raw.push({h: k, r: r, blind: false}); 
            } else { 
                for(let i=0; i<3; i++) raw.push(k); 
            } 
        }); 
        pool = shuffle(raw); 
        if(pool.length === 0) pool =['F', 'J', 'SPACE']; 
        
        users[currentUser].currentWeakKeys = sortedKeys;

    } else if (s >= 2000 && s < 3000) { 
        if (s === 2999) { const keys = new Set(); KEYBOARD_STAGES.forEach(st => st.keys.forEach(k => keys.add(k))); let raw =[]; Array.from(keys).forEach(k => { raw.push({key: k, blind: true}); raw.push({key: k, blind: true}); }); pool = shuffle(raw); } 
        else { const bSt = BLIND_STAGES.find(x => x.id === s); const ref = KB_CHAPTERS.find(c => c.id === bSt.ref); const keys = new Set(); ref.stages.forEach(id => { const st = KEYBOARD_STAGES.find(x => x.id === id); if (st) st.keys.forEach(k => keys.add(k)) }); const list = Array.from(keys); if (bSt.type === 'practice') { let rawList = shuffle(list); rawList.forEach(k => { const f = FINGER_MAP[k], h = FINGER_HOME_MAP[f]; pool.push({key: k, blind: false}); if (h && h !== k && h !== 'SPACE') pool.push({key: h, blind: false, ret: true}); pool.push({key: k, blind: true}); if (h && h !== k && h !== 'SPACE') pool.push({key: h, blind: true, ret: true}); }); } else { let raw =[]; list.forEach(k => { for (let i = 0; i < 3; i++) raw.push({key: k, blind: true}) }); pool = shuffle(raw); } }
    } else if (isHiragana && !isWord) { 
        let raw =[]; if (s === 3999) { HIRAGANA_DATA.forEach(d => { d.chars.forEach(c => { raw.push({...c, blind: true}) }); }); pool = shuffle(raw).slice(0, 40); } 
        else if ([3301, 3302, 3303, 3304].includes(s)) { 
            let targetIds =[]; if (s === 3301) targetIds =[3001, 3002, 3003]; else if (s === 3302) targetIds =[3004, 3005, 3006]; else if (s === 3303) targetIds =[3007, 3008, 3009, 3010]; else if (s === 3304) targetIds =[3011, 3012, 3013, 3014, 3015]; 
            HIRAGANA_DATA.forEach(d => { if (targetIds.includes(d.id)) { d.chars.forEach(c => { for (let i = 0; i < 2; i++) raw.push({...c, blind: true}) }); } }); pool = shuffle(raw); 
        } else if (s >= 3100 && s < 3200) { const d = HIRAGANA_DATA.find(x => x.id === (s - 100)); let tmp = shuffle(d.chars); tmp.forEach(c => { pool.push({...c, blind: false}); pool.push({...c, blind: true}); }); } 
        else if (s >= 3200 && s < 3300) { const d = HIRAGANA_DATA.find(x => x.id === (s - 200)); d.chars.forEach(c => { for (let i = 0; i < 3; i++) raw.push({...c, blind: true}) }); pool = shuffle(raw); } 
        else { const d = HIRAGANA_DATA.find(x => x.id === s); d.chars.forEach(c => { for (let i = 0; i < 3; i++) raw.push(c); }); pool = shuffle(raw); }
    } else if (isWord) { 
        let raw =[]; if (s === 4999) { WORD_DATA.forEach(d => { d.chars.forEach(c => { raw.push({...c, blind: false}) }); }); pool = shuffle(raw).slice(0, 20); } 
        else if (s === 4101) { WORD_DATA.slice(0, 4).forEach(d => { d.chars.forEach(c => raw.push({...c, blind: false})); }); raw = shuffle(raw).slice(0, 15); } 
        else if (s === 4102) { WORD_DATA.slice(4, 8).forEach(d => { d.chars.forEach(c => raw.push({...c, blind: false})); }); raw = shuffle(raw).slice(0, 15); } 
        else if (s === 4103) { WORD_DATA.slice(8, 13).forEach(d => { d.chars.forEach(c => raw.push({...c, blind: false})); }); raw = shuffle(raw).slice(0, 15); } 
        else { const d = WORD_DATA.find(x => x.id === s); if(d) { d.chars.forEach(c => { for (let i = 0; i < 2; i++) raw.push({...c, blind: false}) }); raw = shuffle(raw); } }
        if (s !== 4999) { const nameRomaji = convertNameToRomaji(currentUser); raw.unshift({ h: currentUser, r:[nameRomaji], blind: false }); } pool = raw; 
    } else if (s === 1999) { 
        const keys = new Set(); KEYBOARD_STAGES.forEach(st => st.keys.forEach(k => keys.add(k))); let raw =[]; Array.from(keys).forEach(k => { raw.push(k); raw.push(k); }); pool = shuffle(raw); 
    } else if ([1051, 1052, 1053, 1054, 1101, 1102, 1103, 1104].includes(s)) { 
        let ref = 'home'; if (s % 10 === 2) ref = 'top'; if (s % 10 === 3) ref = 'bottom'; if (s % 10 === 4) ref = 'number'; const chap = KB_CHAPTERS.find(c => c.id === ref); const keys = new Set(); chap.stages.forEach(id => { const st = KEYBOARD_STAGES.find(x => x.id === id); if (st) st.keys.forEach(k => keys.add(k)) }); let raw =[]; Array.from(keys).forEach(k => { raw.push(k); raw.push(k); raw.push(k); }); pool = shuffle(raw); 
    } else { 
        const st = KEYBOARD_STAGES.find(x => x.id === s); if (st) { let rawList =[]; st.keys.forEach(k => { for (let i = 0; i < 5; i++) rawList.push(k); }); rawList = shuffle(rawList); rawList.forEach(k => { pool.push(k); const f = FINGER_MAP[k], h = FINGER_HOME_MAP[f]; if (h && h !== k && h !== 'SPACE') pool.push({key: h, ret: true}); }); } 
    }
    mainQueue = pool; totalCount = mainQueue.length; updateProgress();
}

function shuffle(arr) { for (let i=arr.length-1; i>0; i--) { const j=Math.floor(Math.random()*(i+1));[arr[i],arr[j]]=[arr[j],arr[i]]; } for (let i=1; i<arr.length; i++) { let a=arr[i], b=arr[i-1], va=(a.key||a.h||a), vb=(b.key||b.h||b); if (va===vb) { for (let j=i+1; j<arr.length; j++) { let vc=(arr[j].key||arr[j].h||arr[j]); if (vc!==va) {[arr[i],arr[j]]=[arr[j],arr[i]]; break; } } } } return arr; }

function renderKeyboard() {
    const w = document.createElement('div'); w.id = 'keyboard-wrapper'; w.innerHTML = `<div id="question-display"><div id="romaji-hint"></div><div id="main-q"></div></div>`;
    const kb = document.createElement('div'); kb.id = 'virtual-keyboard';
    KB_LAYOUT.forEach((row, i) => { const r = document.createElement('div'); r.className = `kb-row row-${i}`; row.forEach(c => { const k = document.createElement('div'); k.className = 'key' + (c === 'SPACE' ? ' space' : ''); k.dataset.key = c === 'SPACE' ? ' ' : c; k.innerText = c === 'SPACE' ? '' : c; r.appendChild(k) }); kb.appendChild(r); }); w.appendChild(kb);
    w.innerHTML += `<div id="hands-display"><div class="hand left"><div class="finger f-pinky" data-finger="l-pinky"></div><div class="finger f-ring" data-finger="l-ring"></div><div class="finger f-middle" data-finger="l-middle"></div><div class="finger f-index" data-finger="l-index"></div><div class="finger f-thumb" data-finger="thumb"></div></div><div class="hand right"><div class="finger f-thumb" data-finger="thumb"></div><div class="finger f-index" data-finger="r-index"></div><div class="finger f-middle" data-finger="r-middle"></div><div class="finger f-ring" data-finger="r-ring"></div><div class="finger f-pinky" data-finger="r-pinky"></div></div></div>`; els.playArea.appendChild(w);
}

function nextKeyQ() {
    isProcessing = false; const mq = document.getElementById('main-q'), hq = document.getElementById('romaji-hint'); mq.innerText = ''; hq.innerText = ''; if (mainQueue.length === 0) return;
    let item = mainQueue[0], isBlindItem = false;
    if (typeof item === 'object') { if (item.key) { targetKey = item.key; isBlindItem = !!item.blind; isHomeReturn = !!item.ret; currHiraObj = null; } else if (item.h) { currHiraObj = item; isBlindItem = !!item.blind; isHomeReturn = false; } } else { targetKey = item; isHomeReturn = false; currHiraObj = null; }
    const wrap = document.getElementById('keyboard-wrapper'); if (isBlindItem) { wrap.classList.add('blind-active'); els.instText.innerText = 'みないで うってみよう！'; } else { wrap.classList.remove('blind-active'); }
    if (isHiragana || isWord || currentStage === 9888) {
        if (currentStage === 9888) els.instText.innerText = 'にがて とっくん！'; else els.instText.innerText = isWord ? 'ローマじで ことばを うとう！' : 'したのローマじを みて おそう！';
        
        if (currRomajiIdx === 0 || activeRomajiList.length === 0) { 
            activeRomajiList = Array.isArray(currHiraObj.r) ?[...currHiraObj.r] :[currHiraObj.r]; 
            currRomajiIdx = 0; 
            typedRomajiStr = ""; 
        }
        
        targetKey = (activeRomajiList[0].charAt(currRomajiIdx) === ' ') ? 'SPACE' : activeRomajiList[0].charAt(currRomajiIdx);
        mq.innerText = currHiraObj.h; if (!isBlindItem) updRomaji();
    } else {
        if (currentStage === 9888) els.instText.innerText = 'にがて とっくん！'; else if (!isBlindItem) els.instText.innerText = isExam ? 'もんだいのキーを おそう！' : 'ひかるキーを おそう！';
        if (isHomeReturn) els.instText.innerText = 'ホームポジションに もどろう！'; mq.innerText = (targetKey === 'SPACE' ? 'スペース' : targetKey);
    }
    updateVisuals();
}

function updRomaji() { let h = ''; let target = activeRomajiList[0]; for (let i = 0; i < target.length; i++) { let dispChar = target[i] === ' ' ? '␣' : target[i]; if (i < currRomajiIdx) h += `<span class="romaji-done">${dispChar}</span>`; else if (i === currRomajiIdx) h += `<span class="romaji-current">${dispChar}</span>`; else h += `<span>${dispChar}</span>`; } document.getElementById('romaji-hint').innerHTML = h; }
function updateVisuals() { const fn = targetKey === 'SPACE' ? 'thumb' : FINGER_MAP[targetKey]; const cl = COLOR_CLASS_MAP[fn]; document.querySelectorAll('.key').forEach(k => { k.className = 'key' + (k.classList.contains('space') ? ' space' : ''); if (k.dataset.key === (targetKey === 'SPACE' ? ' ' : targetKey)) { k.classList.add('target'); if (cl) k.classList.add(cl); } }); document.querySelectorAll('.finger').forEach(f => { f.className = f.className.replace(/ active| color-\w+/g, ''); if (f.dataset.finger === fn) { f.classList.add('active'); if (cl) f.classList.add(cl); } }); }

/* =========================================================
   [JS] 9. UI・画面遷移 ＆ ガチャ・きせかえ管理
   ========================================================= */
let currentKeyboardCategory = 'basic';

function showCapsuleAnimation(isRare, callback) {
    const overlay = document.getElementById('capsule-overlay');
    const cap = document.getElementById('gacha-capsule');
    cap.innerText = isRare ? '🔮' : '💊';
    overlay.style.display = 'flex';
    cap.style.animation = 'none'; void cap.offsetWidth; // リセット
    cap.style.animation = 'capsuleDrop 1s cubic-bezier(0.25, 1, 0.5, 1) forwards';
    SoundManager.playGachaDrop();
    
    setTimeout(() => {
        cap.style.animation = 'capsuleBurst 0.5s ease-out forwards';
        SoundManager.playGachaBurst();
        setTimeout(() => { overlay.style.display = 'none'; callback(); }, 500);
    }, 1200);
}

function applyTheme(themeId) {
    document.body.className = '';
    let styleTag = document.getElementById('custom-theme-style');
    if (!styleTag) { styleTag = document.createElement('style'); styleTag.id = 'custom-theme-style'; document.head.appendChild(styleTag); }
    styleTag.innerHTML = ''; 
    
    if (themeId !== 'default') {
        const t = THEMES.find(th => th.id === themeId);
        if (t) {
            styleTag.innerHTML = `
                body, #game-container, #play-area, 
                .admin-section, #records-container, 
                #instruction, #header-right, .text-hud, #mg-hud,
                #ref-text-box, #type-text-box, .gacha-section { 
                    background-color: ${t.bg} !important; 
                    color: ${t.text} !important;
                    border-color: ${t.text} !important;
                }
                .screen h1, .screen h2, .screen h3, .screen p { 
                    color: ${t.text} !important; 
                    border-bottom-color: ${t.text} !important; 
                }
                button, .btn-primary, .btn-secondary, .btn-danger, .btn-gacha, .btn-retry, .category-btn { 
                    background-color: ${t.btnBg} !important; 
                    color: ${t.btnText} !important; 
                }
                button span, .btn-primary span, .btn-secondary span, .btn-danger span, .btn-gacha span, .btn-retry span, .category-btn span {
                    color: ${t.btnText} !important;
                }
                .stage-btn, .exam-btn { 
                    background-color: transparent !important; 
                    color: ${t.text} !important; 
                    border-color: ${t.text} !important;
                    opacity: 0.5 !important;
                }
                .stage-btn span, .exam-btn span { color: ${t.text} !important; }
                .stage-btn.unlocked, .exam-btn.unlocked { 
                    background-color: ${t.btnBg} !important; 
                    color: ${t.btnText} !important; 
                    border-color: ${t.btnText} !important;
                    opacity: 1 !important;
                }
                .stage-btn.unlocked span, .exam-btn.unlocked span { color: ${t.btnText} !important; }
                .stage-btn.cleared, .exam-btn.cleared { opacity: 0.7 !important; }
                
                .reward-badge, .reward-badge-text, 
                button span.reward-badge, button span.reward-badge-text {
                    background-color: #FF9800 !important;
                    color: #ffffff !important;
                    border: 2px solid #ffffff !important;
                    text-shadow: 1px 1px 2px rgba(0,0,0,0.8) !important;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.3) !important;
                }

                .badge-item { background-color: transparent !important; border-color: ${t.text} !important; }
                .badge-item span, .badge-item div { color: ${t.text} !important; }
                .badge-item.earned { background-color: ${t.btnBg} !important; border-color: ${t.btnText} !important; }
                .badge-item.earned span, .badge-item.earned div { color: ${t.btnText} !important; }
            `;
        }
    }
}

function changeTheme(themeId) { applyTheme(themeId); if (users[currentUser]) { users[currentUser].theme = themeId; saveUsers(false); } renderRecords(); }

function showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(id).classList.add('active');
    if (document.activeElement) document.activeElement.blur();
    if (id !== 'screen-game' && id !== 'screen-minigame') document.removeEventListener('keydown', handleKeyDown);
    
    const header = document.getElementById('global-header');
    const container = document.getElementById('game-container'); 
    
    if (header && container) {
        if (id === 'screen-title' || id === 'screen-grade' || id === 'screen-login') {
            header.style.display = 'none';
            container.classList.remove('has-header'); 
        } else {
            header.style.display = 'flex';
            container.classList.add('has-header'); 
            updateHomeDashboard(); 
        }
    }
    
    setTimeout(() => {
        const activeScreen = document.getElementById(id);
        if (!activeScreen) return;
        if (id !== 'screen-game' && id !== 'screen-minigame' && id !== 'screen-text-game') {
            const t = activeScreen.querySelector('.next-target');
            if(t) { t.focus(); t.scrollIntoView({block:'center'}); }
            else { const focusables = getFocusableElements(); if (focusables.length > 0) focusables[0].focus(); }
        }
    }, 100);
}

function createBtn(el, act) { 
    el.tabIndex = 0; el.onclick = act; 
    el.onkeydown = (e) => { 
        const activeScreen = document.querySelector('.screen.active');
        if (activeScreen && (activeScreen.id === 'screen-game' || activeScreen.id === 'screen-minigame' || activeScreen.id === 'screen-text-game')) return;
        if(e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); act(); } 
    }; 
}

function goToMouseMenu() { updateMouseButtons(); showScreen('screen-mouse-menu'); }
function goToKeyboardCategory() { showScreen('screen-keyboard-category'); }

let currentKeyboardChapter = null;
function goToKeyboardMenu(type) { 
    if (type) currentKeyboardCategory = type; 
    document.getElementById('kb-chapter-container').style.display = 'flex';
    document.getElementById('kb-stage-container').style.display = 'none';
    document.getElementById('kb-bottom-back-btn').style.display = 'block';
    
    let title = "キーボードのれんしゅう";
    if(type === 'basic') title = "きほんれんしゅう";
    if(type === 'blind') title = "タッチタイピング";
    if(type === 'hiragana') title = "ひらがなれんしゅう";
    if(type === 'word') title = "ことばのれんしゅう";
    document.getElementById('kb-menu-title').innerText = title;
    
    currentKeyboardChapter = null;
    renderKeyboardChapters(); 
    showScreen('screen-keyboard-menu'); 
}

function goToMinigameMenu() {
    showScreen('screen-minigame-menu');
}

function goToRecords() { renderRecords(); showScreen('screen-records'); }
function goToVisionMenu() { renderVisionMenu(); showScreen('screen-vision-menu'); }

function loginAsMaster() {
    showPasswordModal('先生用パスワード', (pass) => {
        if(pass === ADMIN_PASS) {
            if (!users['Master_Debug']) {
                users['Master_Debug'] = { mouseLevel:7, keyboardSequence:999, examRecords:{}, textRecords:{}, globalMistakes:{}, theme:'default', birthdate:'', isMaster:true };
            }
            document.getElementById('screen-title').classList.remove('active');
            login('Master_Debug');
        } else {
            alert('パスワードが違います');
        }
    });
}

function goToWeakTraining() {
    const mistakes = users[currentUser].globalMistakes || {};
    const hasMistakes = Object.values(mistakes).some(count => count > 0);
    if (hasMistakes) {
        startGame(9888, 'keyboard');
    } else {
        showCustomAlert('ミスのデータがないか、すべて克服しました！\nいろいろな練習をしてからまた挑戦してみてね！'); // ★修正
    }
}

function updateMouseButtons() {
    const l = users[currentUser].mouseLevel; document.getElementById('master-badge').style.display = (l >= 7) ? 'block' : 'none';
    for(let i=1; i<=7; i++) {
        const b = document.getElementById(`btn-m${i}`); if(!b) continue;
        b.classList.remove('unlocked','cleared','next-target'); b.style.opacity='1'; b.onclick=null; b.onkeydown=null; b.tabIndex=-1;
        if(i===1 || l >= i-1) { 
            b.classList.add('unlocked'); createBtn(b, () => startGame(i, 'mouse')); 
            if (l === i-1) b.classList.add('next-target'); 
            if (users[currentUser] && !users[currentUser].isMaster) {
                let badge = b.querySelector('.reward-badge');
                if(!badge){ badge = document.createElement('span'); badge.className = 'reward-badge'; b.appendChild(badge); }
                badge.innerText = getRewardText('mouse', i);
            }
        } else { 
            b.style.opacity='0.5'; 
            let badge = b.querySelector('.reward-badge'); if(badge) badge.remove();
        }
        if(l >= i) b.classList.add('cleared');
    }
}

function updateKeyboardButtons() {
    renderKeyboardChapters();
}

function renderKeyboardChapters() {
    const seq = users[currentUser].keyboardSequence; 
    const cont = document.getElementById('kb-chapter-container'); 
    cont.innerHTML='';
    
    let displayChapters =[]; 
    let showMasterExam = null;

    if (currentKeyboardCategory === 'basic') { displayChapters = KB_CHAPTERS.filter(c =>['home', 'top', 'bottom', 'number'].includes(c.id)); showMasterExam = 1999; } 
    else if (currentKeyboardCategory === 'blind') { displayChapters = KB_CHAPTERS.filter(c => c.id === 'blind'); showMasterExam = 2999; } 
    else if (currentKeyboardCategory === 'hiragana') { 
        displayChapters = KB_CHAPTERS.filter(c => c.id.startsWith('h_')); showMasterExam = 3999; 
    } 
    else if (currentKeyboardCategory === 'word') { displayChapters = KB_CHAPTERS.filter(c => c.id.startsWith('word')); showMasterExam = 4999; }

    const isUnlocked = (id) => { const x=STAGE_ORDER.indexOf(id); return x===0 || (x!==-1 && seq>=x); };
    const isCleared = (id) => { const x=STAGE_ORDER.indexOf(id); return x!==-1 && seq>x; };

    if (currentKeyboardCategory === 'hiragana') {
        const btn = document.createElement('button');
        btn.className = 'category-btn';
        btn.style.backgroundColor = '#00bcd4';
        btn.style.width = '280px'; btn.style.height = '120px';
        btn.innerHTML = `<span style="font-size:40px;">📋</span><span style="font-size:18px; font-weight:bold; margin-top:5px;">ローマ字いちらん表</span>`;
        btn.onclick = () => showRomajiMenu();
        cont.appendChild(btn);
    }

    displayChapters.forEach(chap => {
        let chapUnlocked = isUnlocked(chap.stages[0]);
        let chapCleared = true;
        chap.stages.forEach(sid => { if(!isCleared(sid)) chapCleared = false; });
        if(chap.exam && !isCleared(chap.exam)) chapCleared = false;

        const btn = document.createElement('button');
        btn.className = 'category-btn';
        if(!chapUnlocked) {
            btn.style.opacity = '0.5'; btn.style.cursor = 'not-allowed'; btn.style.backgroundColor = '#9e9e9e';
        } else {
            btn.style.backgroundColor = chapCleared ? '#4CAF50' : '#FF9800';
            btn.onclick = () => renderKeyboardStages(chap);
        }
        btn.style.width = '280px'; btn.style.height = '120px';
        
        let icon = '⌨️';
        if(currentKeyboardCategory === 'basic') icon = '🅰️';
        if(currentKeyboardCategory === 'blind') icon = '🙈';
        if(currentKeyboardCategory === 'hiragana') icon = 'あ';
        if(currentKeyboardCategory === 'word') icon = '🍎';
        
        btn.innerHTML = `<span style="font-size:40px;">${icon}</span><span style="font-size:16px; font-weight:bold; margin-top:5px; line-height:1.3; width:100%; word-wrap:break-word;">${chap.title}</span>`;
        if(chapCleared) btn.innerHTML += `<span style="font-size:14px; margin-top:5px; color:#fff;">✅ クリア済</span>`;
        
        cont.appendChild(btn);
    });

    if (showMasterExam) {
        const mid = showMasterExam; const ed = EXAMS.find(x => x.id === mid); 
        const btn = document.createElement('button');
        btn.className = 'category-btn'; 
        btn.style.width = '280px'; btn.style.height = 'auto'; btn.style.minHeight = '140px'; btn.style.padding = '10px';
        
        if (!isUnlocked(mid)) {
            btn.style.opacity = '0.5'; btn.style.cursor = 'not-allowed'; btn.style.backgroundColor = '#9e9e9e';
        } else {
            btn.style.background = 'linear-gradient(45deg, #FFC107, #FF9800)';
            btn.onclick = () => startGame(mid, 'keyboard');
        }
        
        if (isCleared(mid)) { btn.innerHTML = `<span style="font-size:40px;">👑</span><span style="font-size:16px; font-weight:bold; margin-top:5px; line-height:1.3; width:100%; word-wrap:break-word;">★${ed.title} 合格★</span><span style="font-size:12px; margin-top:5px; color:#fff;">(🎟️ クリアでチケット)</span>`; } 
        else { btn.innerHTML = `<span style="font-size:40px;">👑</span><span style="font-size:16px; font-weight:bold; margin-top:5px; line-height:1.3; width:100%; word-wrap:break-word;">★${ed.title}★</span><span style="font-size:12px; margin-top:5px; color:#fff;">(🎟️ クリアでチケット)</span>`; }
        cont.appendChild(btn);
    }
}

function showRomajiMenu() {
    document.getElementById('kb-chapter-container').style.display = 'none';
    document.getElementById('kb-stage-container').style.display = 'flex';
    document.getElementById('kb-bottom-back-btn').style.display = 'none';
    document.getElementById('kb-stage-title').innerText = "ローマ字いちらん表";
    
    const grid = document.getElementById('kb-stage-grid'); grid.innerHTML = '';
    document.getElementById('kb-stage-exams').innerHTML = ''; 

    const stages =[
        {id:'romaji_basic_prac', title:'あ〜ん', sub:'(れんしゅう)', icon:'📖', color:'#00bcd4'},
        {id:'romaji_basic_exam', title:'あ〜ん', sub:'(テスト)', icon:'🔥', color:'#e91e63'},
        {id:'romaji_daku_prac', title:'だくてん', sub:'(れんしゅう)', icon:'📖', color:'#00bcd4'},
        {id:'romaji_daku_exam', title:'だくてん', sub:'(テスト)', icon:'🔥', color:'#e91e63'}
    ];

    stages.forEach(st => {
        const b = document.createElement('div'); b.className = 'stage-btn unlocked cleared'; b.style.borderColor = st.color; b.style.backgroundColor = st.color === '#00bcd4' ? '#e0f7fa' : '#fce4ec'; b.style.cursor = 'pointer'; b.tabIndex = 0;
        b.innerHTML = `<span style="font-size:30px;">${st.icon}</span><span style="font-size:16px; font-weight:bold; color:#333; margin-top:5px;">${st.title}</span><span style="font-size:12px;">${st.sub}</span>`;
        createBtn(b, () => startGame(st.id, 'romaji')); grid.appendChild(b);
    });
}

function renderKeyboardStages(chap) {
    currentKeyboardChapter = chap; // ★追加

    document.getElementById('kb-chapter-container').style.display = 'none';
    document.getElementById('kb-stage-container').style.display = 'flex';
    document.getElementById('kb-bottom-back-btn').style.display = 'none';
    document.getElementById('kb-stage-title').innerText = chap.title;
    
    const seq = users[currentUser].keyboardSequence; 
    const isUnlocked = (id) => { const x=STAGE_ORDER.indexOf(id); return x===0 || (x!==-1 && seq>=x); };
    const isCleared = (id) => { const x=STAGE_ORDER.indexOf(id); return x!==-1 && seq>x; };
    const targetId = STAGE_ORDER[seq];

    const grid = document.getElementById('kb-stage-grid'); grid.innerHTML = '';
    const examsCont = document.getElementById('kb-stage-exams'); examsCont.innerHTML = '';

    chap.stages.forEach((sid, index) => {
        let title = `ステップ ${index + 1}`, keys='', sub='', exCls=''; const act = () => startGame(sid, 'keyboard');
        if (sid >= 4000 && sid < 5000) { const st = WORD_DATA.find(s=>s.id===sid); if (st) { keys = st.chars.slice(0,1).map(c=>c.h).join(''); sub = st.title; exCls = 'word-practice'; } } 
        else if (sid >= 3000 && sid < 4000) { let base = sid; if(sid>=3100) base-=100; if(sid>=3200) base-=100; const st = HIRAGANA_DATA.find(s=>s.id===base); if (st) { keys = st.chars.slice(0,3).map(c=>c.h).join(''); if(sid >= 3200) { sub='(ブラインド試)'; exCls='blind-exam'; } else if(sid >= 3100) { sub='(ブラインド練)'; exCls='blind-practice'; } else sub = st.title.split('(')[0]; } } 
        else if (sid >= 2000 && sid < 3000) { const st = BLIND_STAGES.find(s=>s.id===sid); if(st) { keys = st.title.split('(')[0]; sub = st.type==='exam'?'(試)':'(練)'; exCls = st.type==='exam'?'blind-exam':'blind-practice'; } } 
        else { const st = KEYBOARD_STAGES.find(s=>s.id===sid); if(st) { keys = st.keys.filter(k=>k!=='SPACE').join(''); sub = st.title; } }
        
        const b = document.createElement('div'); b.className=`stage-btn ${exCls}`; b.tabIndex=-1;
        if (isUnlocked(sid)) { 
            b.classList.add('unlocked'); createBtn(b, act); if (sid === targetId) b.classList.add('next-target'); 
            b.innerHTML=`<span class="stage-title">${title}</span><span class="kb-keys" style="font-size:18px">${keys}</span><span class="stage-name" style="font-size:12px">${sub}</span><span class="reward-badge">${getRewardText('keyboard', sid)}</span>`; 
        } else {
            b.style.opacity='0.5';
            b.innerHTML=`<span class="stage-title">${title}</span><span class="kb-keys" style="font-size:18px">${keys}</span><span class="stage-name" style="font-size:12px">${sub}</span>`; 
        }
        if (isCleared(sid)) b.classList.add('cleared');
        grid.appendChild(b);
    });

    if (chap.bridge) {
        const bid = chap.bridge; const bd = BRIDGE_STAGES.find(x=>x.id===bid); const b = document.createElement('div'); b.className='exam-btn practice-bridge-btn'; b.tabIndex=-1; b.style.width = '300px';
        if (isUnlocked(bid)) { b.classList.add('unlocked'); createBtn(b, () => startGame(bid, 'keyboard')); if (bid === targetId) b.classList.add('next-target'); } else b.style.opacity='0.5';
        if (isCleared(bid)) { b.classList.add('cleared'); b.innerText='総復習クリア'; } else b.innerText = bd.title + '(ミスOK)'; examsCont.appendChild(b);
    }
    if (chap.exam) {
        const eid = chap.exam; const ed = EXAMS.find(x=>x.id===eid); const b = document.createElement('div'); b.className='exam-btn'; b.tabIndex=-1; b.style.width = '300px';
        if (isUnlocked(eid)) { b.classList.add('unlocked'); createBtn(b, () => startGame(eid, 'keyboard')); if (eid === targetId) b.classList.add('next-target'); } else b.style.opacity='0.5';
        if (isCleared(eid)) { b.classList.add('cleared'); b.innerText = ed.title+'合格'; } else b.innerText = ed.title; examsCont.appendChild(b);
    }
}

function backToKbChapter() {
    document.getElementById('kb-chapter-container').style.display = 'flex';
    document.getElementById('kb-stage-container').style.display = 'none';
    document.getElementById('kb-bottom-back-btn').style.display = 'block';
}

function getFocusableElements() {
    const activeScreen = document.querySelector('.screen.active'); if (!activeScreen) return[];
    const elements = Array.from(activeScreen.querySelectorAll('[tabindex="0"], button:not([tabindex="-1"])'));
    return elements.filter(el => { const style = window.getComputedStyle(el); return el.offsetParent !== null && style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0.5'; });
}

window.addEventListener('keydown', (e) => {
    const activeScreen = document.querySelector('.screen.active'); if (!activeScreen) return;
    if (e.key === 'Escape') {
        e.preventDefault();
        if (activeScreen.id === 'screen-game') backToMenu(); 
        else if (activeScreen.id === 'screen-minigame') { stopMinigame(); showScreen('screen-minigame-menu'); } 
        else if (activeScreen.id === 'screen-text-game') backToMenuFromText();
        else { const backBtn = activeScreen.querySelector('.bottom-back-btn'); if (backBtn) backBtn.click(); }
        return;
    }
    if (activeScreen.id === 'screen-game' || activeScreen.id === 'screen-minigame' || activeScreen.id === 'screen-text-game') return;

    const key = e.key.toUpperCase();
    if (['F', 'J', 'ARROWLEFT', 'ARROWRIGHT', 'ARROWUP', 'ARROWDOWN'].includes(key)) {
        e.preventDefault(); const focusables = getFocusableElements(); if (focusables.length === 0) return;
        let currentIndex = focusables.indexOf(document.activeElement); if (currentIndex === -1) { focusables[0].focus(); return; }
        if (key === 'F' || key === 'ARROWLEFT' || key === 'ARROWUP') currentIndex = (currentIndex - 1 + focusables.length) % focusables.length;
        else if (key === 'J' || key === 'ARROWRIGHT' || key === 'ARROWDOWN') currentIndex = (currentIndex + 1) % focusables.length;
        focusables[currentIndex].focus(); focusables[currentIndex].scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
});

function showRecordSection(secId) {
    document.getElementById('records-main-menu').style.display = 'none';
    document.getElementById('records-panel-content').style.display = 'flex';
    document.getElementById('records-bottom-back-btn').style.display = 'none';
    document.querySelectorAll('.record-section-content').forEach(el => el.style.display = 'none');
    document.getElementById(secId).style.display = 'block';
}

function backToRecordMenu() {
    document.getElementById('records-main-menu').style.display = 'flex';
    document.getElementById('records-panel-content').style.display = 'none';
    document.getElementById('records-bottom-back-btn').style.display = 'block';
    if(users[currentUser]) document.getElementById('global-coin-display').innerText = `💰 ${users[currentUser].coins || 0}`;
}

function renderRecords() {
    backToRecordMenu();
    const u = users[currentUser];
    if(!u) return;

    const gCont = document.getElementById('rec-gacha'); gCont.innerHTML = '';
    gCont.innerHTML = `<div class="gacha-section">
        <div class="coin-display">💰 コイン: ${u.coins || 0} 枚</div>
        <p style="margin: 5px 0 15px 0;">ガチャをひいて アイテムをゲットしよう！</p>
        <div style="display:flex; justify-content:center; gap:15px; flex-wrap:wrap;">
            <button class="btn-gacha" style="padding: 10px 20px; font-size: 20px;" onclick="drawGacha(1)">1回 (100)</button>
            <button class="btn-gacha" style="padding: 10px 20px; font-size: 20px; background:linear-gradient(135deg, #4CAF50, #8BC34A);" onclick="drawGacha(10)">10回 (1000)</button>
            <button class="btn-gacha" style="padding: 10px 20px; font-size: 20px; background:linear-gradient(135deg, #E91E63, #9C27B0);" onclick="drawGacha(1, true)">🔮 レア確定 (500)</button>
        </div>
    </div>`;
    if (u.tickets && u.tickets.length > 0) {
        gCont.innerHTML += `<h3 style="color:#FF5722;">🎟️ もっている ひきかえけん</h3>`;
        u.tickets.forEach((t, idx) => {
            gCont.innerHTML += `<div class="ticket-card"><div><div class="ticket-name">${t.name}</div><div style="font-size:12px; color:#555;">ゲットした日: ${t.date}</div></div><button class="ticket-btn" onclick="useTicket(${idx})">先生につかってもらう</button></div>`;
        });
    }

    const tCont = document.getElementById('rec-theme'); tCont.innerHTML = '';
    let tHtml = `<h3>🎨 きせかえテーマ</h3><div class="theme-grid">`;
    THEMES.forEach(t => {
        let checkId = t.isCustom ? t.id : 'theme_' + t.id;
        let isUnlocked = (u.items && (u.items.includes(checkId) || u.items.includes(t.id))) || u.isMaster || (t.id === 'default');
        let isActive = (u.theme === t.id);
        tHtml += `<button class="theme-btn ${!isUnlocked ? 'locked' : ''} ${isActive ? 'active-theme' : ''}" ${isUnlocked ? `onclick="changeTheme('${t.id}')"` : `onclick="showCustomAlert('ガチャでゲットするとつかえるよ！')"`}>${t.icon} ${t.name}</button>`;
    });
    tHtml += `</div><h3 style="margin-top:20px;">🎉 クリアえんしゅつ</h3><div class="theme-grid">`;
    EFFECTS.forEach(e => {
        let isUnlocked = (e.id === 'default') || (u.items && u.items.includes(e.id)) || u.isMaster;
        let isActive = (u.activeEffect === e.id);
        tHtml += `<button class="theme-btn ${!isUnlocked ? 'locked' : ''} ${isActive ? 'active-theme' : ''}" ${isUnlocked ? `onclick="changeEffect('${e.id}')"` : `onclick="showCustomAlert('ガチャでゲットするとつかえるよ！')"`}>${e.icon} ${e.name}</button>`;
    });
    tCont.innerHTML = tHtml + `</div>`;

    const bCont = document.getElementById('rec-badge'); bCont.innerHTML = '';
    const badgeGrid = document.createElement('div'); badgeGrid.className = 'badge-grid';
    const mLv = u.mouseLevel || 0;
    badgeGrid.innerHTML += `<div class="badge-item ${mLv >= 7 ? 'earned' : ''}"><div class="badge-icon">👑</div><div class="badge-name">マウス<br>めんきょかいでん</div></div>`;
    const kSeq = u.keyboardSequence || 0; const records = u.examRecords || {};
    EXAMS.forEach(ex => {
        const isClr = (STAGE_ORDER.indexOf(ex.id) !== -1 && kSeq > STAGE_ORDER.indexOf(ex.id));
        let icon = '🏆'; if([1999,2999,3999,4999].includes(ex.id)) icon='👑';
        let medal = '';
        if(isClr && records[ex.id]) {
            if(records[ex.id] <= ex.gold) medal='<div class="badge-medal">🥇</div>';
            else if(records[ex.id] <= ex.silver) medal='<div class="badge-medal">🥈</div>';
            else medal='<div class="badge-medal">🥉</div>';
        }
        badgeGrid.innerHTML += `<div class="badge-item ${isClr ? 'earned' : ''}">${medal}<div class="badge-icon">${icon}</div><div class="badge-name">${ex.title}</div></div>`;
    });
    bCont.appendChild(badgeGrid);

    const timeCont = document.getElementById('rec-time'); timeCont.innerHTML = '';
    let kbTimes = `<h4 style="color:#555; margin-bottom:5px; border-bottom:1px solid #ccc; padding-bottom:5px;">⌨️ キーボード試験</h4><div style="display:flex; flex-wrap:wrap; gap:10px; margin-bottom:15px;">`;
    let hasKbRecord = false;
    EXAMS.forEach(ex => {
        if(records[ex.id]) {
            hasKbRecord = true; let medal = '🥉'; if(records[ex.id] <= ex.gold) medal = '🥇'; else if(records[ex.id] <= ex.silver) medal = '🥈';
            kbTimes += `<div style="background:#f5f5f5; border:2px solid #ccc; padding:5px 15px; border-radius:8px; font-weight:bold; color:#333;">${ex.title}: <span style="color:#e65100;">${records[ex.id].toFixed(1)}秒</span> ${medal}</div>`;
        }
    });
    if(!hasKbRecord) kbTimes += `<span style="color:#999; font-size:14px; margin-left:10px;">まだ記録がありません</span>`;
    
    let viTimes = `<h4 style="color:#555; margin-bottom:5px; border-bottom:1px solid #ccc; padding-bottom:5px;">👁️ ビジョントレーニング</h4><div style="display:flex; flex-wrap:wrap; gap:10px;">`;
    let hasViRecord = false;
    VISION_STAGES.forEach(st => {
        if(records[st.id]) { hasViRecord = true; viTimes += `<div style="background:#e3f2fd; border:2px solid #90caf9; padding:5px 15px; border-radius:8px; font-weight:bold; color:#0277bd;">${st.title}: <span style="color:#e65100;">${records[st.id].toFixed(1)}秒</span></div>`; }
        if(records[st.id + '_hard']) { hasViRecord = true; viTimes += `<div style="background:#fff3e0; border:2px solid #ffcc80; padding:5px 15px; border-radius:8px; font-weight:bold; color:#d84315;">${st.title}(🔥): <span style="color:#e65100;">${records[st.id + '_hard'].toFixed(1)}秒</span></div>`; }
    });
    if(!hasViRecord) viTimes += `<span style="color:#999; font-size:14px; margin-left:10px;">まだ記録がありません</span>`;
    timeCont.innerHTML = kbTimes + `</div>` + viTimes + `</div>`;

    const graphCont = document.getElementById('rec-graph'); graphCont.innerHTML = '';
    const gWrap = document.createElement('div'); gWrap.style.display = 'flex'; gWrap.style.gap = '20px'; gWrap.style.justifyContent = 'center'; gWrap.style.width = '100%';
    
    const vPct = Math.floor(((u.visionCleared ? u.visionCleared.length : 0) / (VISION_STAGES.length * 2)) * 100);
    gWrap.innerHTML += `<div style="flex:1; background:#fff; padding:20px; border-radius:12px; border:1px solid #ccc; box-shadow:0 4px 6px rgba(0,0,0,0.05);">
        <h4 style="margin-top:0; color:#555; border-bottom:2px solid #eee; padding-bottom:10px;">🎮 全体の達成度</h4>
        <div style="margin-bottom:15px;"><div style="display:flex; justify-content:space-between; margin-bottom:5px;"><span>🖱️ マウス</span><span>${Math.floor((mLv/7)*100)}%</span></div><div style="width:100%; height:20px; background:#eee; border-radius:10px; overflow:hidden;"><div style="width:${Math.floor((mLv/7)*100)}%; height:100%; background:#2196F3;"></div></div></div>
        <div style="margin-bottom:15px;"><div style="display:flex; justify-content:space-between; margin-bottom:5px;"><span>⌨️ キーボード</span><span>${Math.floor((kSeq/STAGE_ORDER.length)*100)}%</span></div><div style="width:100%; height:20px; background:#eee; border-radius:10px; overflow:hidden;"><div style="width:${Math.floor((kSeq/STAGE_ORDER.length)*100)}%; height:100%; background:#FF9800;"></div></div></div>
        <div style="margin-bottom:15px;"><div style="display:flex; justify-content:space-between; margin-bottom:5px;"><span>👁️ ビジョン</span><span>${vPct}%</span></div><div style="width:100%; height:20px; background:#eee; border-radius:10px; overflow:hidden;"><div style="width:${vPct}%; height:100%; background:#9C27B0;"></div></div></div>
    </div>`;

    const weakDiv = document.createElement('div'); weakDiv.style.flex = '1'; weakDiv.style.background = '#fff'; weakDiv.style.padding = '20px'; weakDiv.style.borderRadius = '12px'; weakDiv.style.border = '1px solid #ccc'; weakDiv.style.boxShadow = '0 4px 6px rgba(0,0,0,0.05)';
    weakDiv.innerHTML = `<h4 style="margin-top:0; color:#555; border-bottom:2px solid #eee; padding-bottom:10px;">⚠️ あなたの苦手なキー</h4>`;
    let mistakes = u.globalMistakes || {};
    let sorted = Object.keys(mistakes).filter(k => mistakes[k] > 0).sort((a, b) => mistakes[b] - mistakes[a]);
    
    if (sorted.length === 0) {
        weakDiv.innerHTML += `<div style="color:#4CAF50; font-weight:bold; margin-top:20px; text-align:center; font-size:20px;">✨ すばらしい！<br>弱点はありません。</div>`;
    } else {
        let maxMiss = mistakes[sorted[0]];
        let heatmapHtml = `<div class="heatmap-kb">`;
        KB_LAYOUT.forEach(row => {
            heatmapHtml += `<div class="heatmap-row">`;
            row.forEach(k => {
                let disp = k === 'SPACE' ? '空白' : k;
                let count = mistakes[k] || 0;
                let pct = maxMiss > 0 ? (count / maxMiss) * 100 : 0;
                let cls = k === 'SPACE' ? 'heatmap-key space' : 'heatmap-key';
                heatmapHtml += `<div class="${cls}" title="${disp}: ${count}回ミス"><div class="heatmap-bg" style="height:${pct}%;"></div><span class="heatmap-text">${disp}</span></div>`;
            });
            heatmapHtml += `</div>`;
        });
        heatmapHtml += `</div><div style="text-align:center; font-size:12px; color:#999; margin-top:5px;">※ミスが多いキーほど赤くなります</div>`;
        weakDiv.innerHTML += heatmapHtml;
    }
    gWrap.appendChild(weakDiv); graphCont.appendChild(gWrap);

    const titleCont = document.getElementById('rec-title'); titleCont.innerHTML = '';
    const titleHeader = document.createElement('h3'); titleHeader.innerText = '🎖️ あつめた称号'; titleCont.appendChild(titleHeader);
    const titleGrid = document.createElement('div'); titleGrid.style.display = 'flex'; titleGrid.style.flexWrap = 'wrap'; titleGrid.style.gap = '15px'; titleGrid.style.justifyContent = 'center';
    
    ACHIEVEMENTS.forEach(ac => {
        let isEarned = ac.check(u) || u.isMaster;
        const b = document.createElement('div'); b.className = 'title-badge' + (isEarned ? ' earned' : '');
        b.innerHTML = `<div class="title-icon">${ac.icon}</div><div class="title-info"><div class="title-name">${ac.title}</div><div class="title-desc">${ac.desc}</div></div>`;
        titleGrid.appendChild(b);
    });
    titleCont.appendChild(titleGrid);
}

function showCustomAlert(msg) {
    let overlay = document.getElementById('custom-alert-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'custom-alert-overlay';
        overlay.style.cssText = 'position:absolute; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.8); z-index:10000; display:flex; flex-direction:column; justify-content:center; align-items:center;';
        document.body.appendChild(overlay);
    }
    // ★ max-width を 500px に拡張し、文字が綺麗に収まるように変更
    overlay.innerHTML = `<div style="background:#fff; padding:30px; border-radius:15px; text-align:center; max-width: 500px; box-shadow: 0 10px 30px rgba(0,0,0,0.5);">
            <p style="font-size:20px; color:#333; margin-bottom:20px; white-space:pre-wrap; line-height:1.5;">${msg}</p>
            <button class="btn-primary" id="btn-custom-ok" style="padding: 10px 30px;">OK</button>
        </div>`;
    overlay.style.display = 'flex';
    document.getElementById('btn-custom-ok').onclick = () => { overlay.style.display = 'none'; };
}

function showCustomConfirm(msg, onYes) {
    let overlay = document.getElementById('custom-confirm-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'custom-confirm-overlay';
        overlay.style.cssText = 'position:absolute; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.8); z-index:10000; display:flex; flex-direction:column; justify-content:center; align-items:center;';
        document.body.appendChild(overlay);
    }
    // ★ max-width を 500px に拡張
    overlay.innerHTML = `<div style="background:#fff; padding:30px; border-radius:15px; text-align:center; max-width: 500px; box-shadow: 0 10px 30px rgba(0,0,0,0.5);">
            <p style="font-size:20px; color:#333; margin-bottom:20px; white-space:pre-wrap; line-height:1.5;">${msg}</p>
            <div style="display:flex; justify-content:center; gap:20px;">
                <button class="btn-primary" id="btn-custom-yes" style="padding: 10px 30px;">はい</button>
                <button class="btn-secondary" id="btn-custom-no" style="padding: 10px 30px;">いいえ</button>
            </div>
        </div>`;
    overlay.style.display = 'flex';
    document.getElementById('btn-custom-yes').onclick = () => { overlay.style.display = 'none'; onYes(); };
    document.getElementById('btn-custom-no').onclick = () => { overlay.style.display = 'none'; };
}

function drawGacha(times = 1, isRareGuaranteed = false) {
    const u = users[currentUser]; const COST = isRareGuaranteed ? 500 : 100 * times;
    
    if (u.coins < COST) return showCustomAlert(`コインがたりないよ！\nあと ${COST - u.coins} コイン ひつようです。`);
    
    showCustomConfirm(`${COST}コインをつかって ガチャをひきますか？\n(のこり: ${u.coins}枚)`, () => {
        showCapsuleAnimation(isRareGuaranteed, () => {
            u.coins -= COST; let newItems =[], refundCoins = 0, totalCoinsWon = 0;
            
            if (isRareGuaranteed) {
                let unowned = GACHA_ITEMS.filter(item => {
                    if(item.type === 'coin') return false;
                    let checkId = item.id; if (item.type === 'theme' && !checkId.startsWith('ct_')) checkId = checkId.replace('theme_', '');
                    return !u.items.includes(checkId) && u.theme !== checkId;
                });
                if (unowned.length === 0) { refundCoins = 500; } 
                else {
                    let result = unowned[Math.floor(Math.random() * unowned.length)];
                    let checkId = result.id; if (result.type === 'theme' && !checkId.startsWith('ct_')) checkId = checkId.replace('theme_', '');
                    u.items.push(checkId); newItems.push(result.name);
                }
            } else {
                let totalRate = 0; for (let item of GACHA_ITEMS) totalRate += item.rate;
                for (let i = 0; i < times; i++) {
                    const r = Math.random() * totalRate; let currentRate = 0, result = null;
                    for (let item of GACHA_ITEMS) { currentRate += item.rate; if (r < currentRate) { result = item; break; } }
                    if (!result) result = GACHA_ITEMS[GACHA_ITEMS.length - 1];
                    if (result.type === 'coin') { totalCoinsWon += parseInt(result.id.split('_')[1]); } 
                    else {
                        let checkId = result.id; if (result.type === 'theme' && !checkId.startsWith('ct_')) checkId = checkId.replace('theme_', '');
                        if (u.items.includes(checkId) || u.theme === checkId || newItems.includes(result.name)) { refundCoins += 30; } 
                        else { u.items.push(checkId); newItems.push(result.name); }
                    }
                }
            }
            
            u.coins += totalCoinsWon + refundCoins; saveUsers(false); renderRecords(); 
            
            let rewardTitle = times > 1 ? `✨ ${times}連ガチャ けっか ✨` : "✨ ガチャけっか ✨"; 
            if (isRareGuaranteed) rewardTitle = "✨ レア確定ガチャ けっか ✨";
            let rewardIcon = times > 1 ? "🎊" : "🎁"; let msg = "";
            
            if (newItems.length > 0) { msg += `【あたらしいアイテム！】\n${newItems.join('\n')}\n\n`; rewardTitle = "🎊 大当たり！！ 🎊"; }
            if (totalCoinsWon > 0) msg += `💰 コイン当せん: ${totalCoinsWon}枚\n`; if (refundCoins > 0) msg += `🔄 かぶりコイン: ${refundCoins}枚\n`;
            if (isRareGuaranteed && newItems.length === 0) { msg += "💡 もうぜんぶ持っていたよ！ 500コインお返しします。"; rewardIcon = "🔄"; }
            else if (times === 1 && newItems.length === 0 && totalCoinsWon === 0 && refundCoins > 0) { rewardTitle = "💡 もう持っていたよ！"; rewardIcon = "🔄"; } 
            else if (times === 1 && totalCoinsWon > 0 && newItems.length === 0) rewardIcon = "💰";
            
            const nameEl = document.getElementById('reward-name');
            if (times > 1) { nameEl.style.fontSize = '24px'; nameEl.style.maxHeight = '40vh'; nameEl.style.overflowY = 'auto'; nameEl.style.textAlign = 'left'; } else { nameEl.style.fontSize = '40px'; nameEl.style.maxHeight = 'none'; nameEl.style.overflowY = 'visible'; nameEl.style.textAlign = 'center'; }
            showRewardOverlay(rewardTitle, msg.trim(), rewardIcon, null);
        });
    });
}

// 修正後
function useTicket(idx) {
    const u = users[currentUser], t = u.tickets[idx];
    showPasswordModal(`【先生確認】\n「${t.name}」を使います。\nパスワードを入力:`, (pass) => {
        if (pass === ADMIN_PASS) { 
            u.tickets.splice(idx, 1); 
            if (!u.ticketHistory) u.ticketHistory =[];
            const now = new Date();
            const dateStr = `${now.getFullYear()}/${now.getMonth()+1}/${now.getDate()} ${now.getHours()}:${now.getMinutes().toString().padStart(2,'0')}`;
            u.ticketHistory.push({ ticketName: t.name, date: dateStr, timestamp: now.getTime() });
            
            saveUsers(false); 
            SoundManager.playClear(); 
            showCustomAlert(`✅ 交換しました！\n\n${t.name} を渡してあげてください。`); // ★修正
            renderRecords(); 
        } else { 
            if (pass !== null && pass !== '') showCustomAlert('パスワードがちがいます'); // ★修正
        }
    });
}

function changeEffect(effId) { users[currentUser].activeEffect = effId; saveUsers(false); renderRecords(); createConfetti(); }

function updateGlobalHeader() {
    if (currentUser && users[currentUser]) {
        const coinDisplay = document.getElementById('global-coin-display');
        if (coinDisplay) coinDisplay.innerText = `💰 ${users[currentUser].coins || 0}`;
    }
}

function updateHomeDashboard() {
    if (!currentUser || !users[currentUser]) return;
    const u = users[currentUser];
    
    const maxMouse = 7; const mLv = u.mouseLevel || 0;
    const mPct = Math.floor((mLv / maxMouse) * 100);
    const mouseLvDisplay = document.getElementById('home-mouse-lv');
    const mouseBar = document.getElementById('home-mouse-bar');
    if (mouseLvDisplay) mouseLvDisplay.innerText = mLv >= 7 ? 'Lv.MAX (免許皆伝)' : `Lv.${mLv} / 7`;
    if (mouseBar) mouseBar.style.width = `${mPct}%`;

    const maxKb = STAGE_ORDER.length; const kSeq = u.keyboardSequence || 0;
    const kPct = Math.floor((kSeq / maxKb) * 100);
    const kbPctDisplay = document.getElementById('home-kb-pct');
    const kbBar = document.getElementById('home-kb-bar');
    if (kbPctDisplay) kbPctDisplay.innerText = `${kPct}%`;
    if (kbBar) kbBar.style.width = `${kPct}%`;

    const btn = document.getElementById('btn-recommend');
    if (!btn) return;
    if (mLv < 7) {
        btn.innerHTML = `🖱️ マウスのれんしゅう<br><span style="font-size:14px;">(M-${mLv + 1} へ)</span>`;
        btn.onclick = () => { goToMouseMenu(); startGame(mLv + 1, 'mouse'); };
    } else if (kSeq < maxKb) {
        const nextId = STAGE_ORDER[kSeq];
        const stageName = getStageName(nextId).replace(/\[ID:\d+\]\s*/, '');
        btn.innerHTML = `⌨️ キーボードれんしゅう<br><span style="font-size:14px;">(${stageName} へ)</span>`;
        btn.onclick = () => { showScreen('screen-keyboard-menu'); startGame(nextId, 'keyboard'); };
    } else {
        btn.innerHTML = `🏆 すべてクリア！<br><span style="font-size:14px;">(にがてとっくん や ガチャであそぼう)</span>`;
        btn.onclick = () => goToRecords();
        btn.style.animation = 'none';
        btn.style.backgroundColor = '#FFD700'; btn.style.color = '#333';
    }
}

function handleGlobalBack() {
    const activeScreen = document.querySelector('.screen.active');
    if (!activeScreen) return;
    if (activeScreen.id === 'screen-game') backToMenu();
    else if (activeScreen.id === 'screen-minigame') { stopMinigame(); showScreen('screen-minigame-menu'); }
    else if (activeScreen.id === 'screen-text-game') backToMenuFromText();
    else {
        const backBtn = activeScreen.querySelector('.bottom-back-btn');
        if (backBtn) backBtn.click();
    }
}

function handleGlobalHome() {
    if (document.querySelector('.screen.active').id === 'screen-game') backToMenu();
    if (document.querySelector('.screen.active').id === 'screen-minigame') stopMinigame();
    if (document.querySelector('.screen.active').id === 'screen-text-game') backToMenuFromText();
    showScreen('screen-category');
}

function createConfetti() {
    const u = users[currentUser]; const effId = u ? (u.activeEffect || 'default') : 'default';
    const effectData = EFFECTS.find(e => e.id === effId) || EFFECTS[0];
    const isEmoji = effectData.emojis && effectData.emojis.length > 0;
    const particleCount = isEmoji ? 60 : 100;
    
    const colors =['#f44336', '#e91e63', '#9c27b0', '#673ab7', '#3f51b5', '#2196f3', '#03a9f4', '#00bcd4', '#009688', '#4caf50', '#8bc34a', '#cddc39', '#ffeb3b', '#ffc107', '#ff9800', '#ff5722'];

    for (let i = 0; i < particleCount; i++) {
        const c = document.createElement('div'); c.className = 'confetti'; c.style.left = Math.random() * 100 + 'vw';
        
        if (isEmoji) {
            c.innerText = effectData.emojis[Math.floor(Math.random() * effectData.emojis.length)]; 
            c.style.fontSize = (Math.random() * 25 + 20) + 'px'; 
            c.style.background = 'transparent'; c.style.boxShadow = 'none'; c.style.clipPath = 'none';
        } else { 
            c.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)]; 
            c.style.width = '15px'; c.style.height = '15px';
        }
        
        c.style.animationDuration = (Math.random() * 3 + 2) + 's'; 
        c.style.animationDelay = (Math.random() * 2) + 's';
        document.body.appendChild(c); setTimeout(() => c.remove(), 5000); 
    }
}

let rewardCloseCallback = null;
function showRewardOverlay(title, name, icon, callback) {
    SoundManager.playClear(); createConfetti();
    document.getElementById('reward-title').innerText = title; document.getElementById('reward-name').innerText = name; document.getElementById('reward-icon').innerText = icon;
    document.getElementById('reward-overlay').style.display = 'flex'; rewardCloseCallback = callback;
    setTimeout(() => { const btn = document.querySelector('#reward-overlay button'); if (btn) btn.focus(); }, 100);
}
function closeRewardOverlay() { SoundManager.playClick(); document.getElementById('reward-overlay').style.display = 'none'; if (rewardCloseCallback) { rewardCloseCallback(); rewardCloseCallback = null; } }

/* =========================================================
   [JS] 10. カスタム要素の作成・削除管理 ＆ バックアップ
   ========================================================= */

function exportData() {
    const dataStr = JSON.stringify(users, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const date = new Date();
    const dateStr = `${date.getFullYear()}${(date.getMonth()+1).toString().padStart(2,'0')}${date.getDate().toString().padStart(2,'0')}`;
    a.download = `d-lesson_backup_${dateStr}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function importData(event) {
    const file = event.target.files[0];
    if (!file) return;
    if (!confirm('【警告】現在のデータがすべて上書きされます！\n本当に復元してよろしいですか？')) {
        event.target.value = '';
        return;
    }
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const importedUsers = JSON.parse(e.target.result);
            if (typeof importedUsers === 'object' && importedUsers !== null) {
                users = importedUsers;
                saveUsers(true);
                updateAdminUserTable();
                renderAdminTextTasks();
                alert('データを正常に復元しました！');
            } else {
                alert('データ形式が正しくありません。');
            }
        } catch (err) {
            alert('ファイルの読み込みに失敗しました。JSONファイルを選択してください。');
        }
        event.target.value = '';
    };
    reader.readAsText(file);
}

function openThemeCreator() { 
    document.getElementById('admin-theme-modal').style.display='flex'; 
    updateThemePreview(); 
}
function closeThemeCreator() { document.getElementById('admin-theme-modal').style.display='none'; }

function updateThemePreview() {
    const bg = document.getElementById('ct-bg').value;
    const text = document.getElementById('ct-text').value;
    const btnBg = document.getElementById('ct-btn-bg').value;
    const btnText = document.getElementById('ct-btn-text').value;
    const name = document.getElementById('ct-name').value || 'プレビュー';
    
    document.getElementById('ct-preview-text').innerText = name;

    let styleTag = document.getElementById('preview-dynamic-style');
    if (!styleTag) {
        styleTag = document.createElement('style');
        styleTag.id = 'preview-dynamic-style';
        document.head.appendChild(styleTag);
    }
    
    styleTag.innerHTML = `
        #ct-preview {
            background-color: ${bg} !important;
            border-color: ${text} !important;
        }
        #ct-preview-text {
            color: ${text} !important;
        }
        #ct-preview-btn {
            background-color: ${btnBg} !important;
            color: ${btnText} !important;
        }
    `;
}

function saveCustomTheme() {
    const name = document.getElementById('ct-name').value.trim(); if(!name) return alert('名前を入力してください');
    const bg = document.getElementById('ct-bg').value, text = document.getElementById('ct-text').value, btnBg = document.getElementById('ct-btn-bg').value, btnText = document.getElementById('ct-btn-text').value;
    const isPresent = document.getElementById('ct-present').checked; 
    
    if (!users['__GLOBAL_SETTINGS__']) users['__GLOBAL_SETTINGS__'] = { isMaster:true }; if (!users['__GLOBAL_SETTINGS__'].globalMistakes) users['__GLOBAL_SETTINGS__'].globalMistakes = {};
    if (!Array.isArray(users['__GLOBAL_SETTINGS__'].globalMistakes.customThemes)) users['__GLOBAL_SETTINGS__'].globalMistakes.customThemes =[];
    const newId = 'ct_' + Date.now(); 
    users['__GLOBAL_SETTINGS__'].globalMistakes.customThemes.push({ id: newId, name: name, bg: bg, text: text, btnBg: btnBg, btnText: btnText });
    
    if (isPresent) {
        Object.keys(users).forEach(n => {
            if (n !== '__GLOBAL_SETTINGS__') {
                if (!users[n].items) users[n].items =[];
                if (!users[n].items.includes(newId)) users[n].items.push(newId);
            }
        });
        alert('「' + name + '」を全員にプレゼントしました！');
    } else {
        alert('「' + name + '」をガチャのラインナップに追加しました！'); 
    }
    
    saveUsers(true); loadCustomGlobalSettings(); closeThemeCreator();
    document.getElementById('ct-name').value = ''; document.getElementById('ct-present').checked = false;
}

function openEffectCreator() { document.getElementById('admin-effect-modal').style.display='flex'; }
function closeEffectCreator() { document.getElementById('admin-effect-modal').style.display='none'; }

function saveCustomEffect() {
    const name = document.getElementById('ce-name').value.trim(); if(!name) return alert('名前を入力してください');
    const emojis =[document.getElementById('ce-emo1').value.trim(), document.getElementById('ce-emo2').value.trim(), document.getElementById('ce-emo3').value.trim()].filter(e => e !== '');
    if(emojis.length === 0) return alert('絵文字を1つ以上入力してください');
    const isPresent = document.getElementById('ce-present').checked; 
    
    if (!users['__GLOBAL_SETTINGS__']) users['__GLOBAL_SETTINGS__'] = { isMaster:true }; if (!users['__GLOBAL_SETTINGS__'].globalMistakes) users['__GLOBAL_SETTINGS__'].globalMistakes = {};
    if (!Array.isArray(users['__GLOBAL_SETTINGS__'].globalMistakes.customEffects)) users['__GLOBAL_SETTINGS__'].globalMistakes.customEffects =[];
    const newId = 'ce_' + Date.now(); 
    users['__GLOBAL_SETTINGS__'].globalMistakes.customEffects.push({ id: newId, name: name, emojis: emojis });
    
    if (isPresent) {
        Object.keys(users).forEach(n => {
            if (n !== '__GLOBAL_SETTINGS__') {
                if (!users[n].items) users[n].items =[];
                if (!users[n].items.includes(newId)) users[n].items.push(newId);
            }
        });
        alert('「' + name + '」を全員にプレゼントしました！');
    } else {
        alert('「' + name + '」をガチャのラインナップに追加しました！'); 
    }
    
    saveUsers(true); loadCustomGlobalSettings(); closeEffectCreator();
    document.getElementById('ce-name').value = ''; document.getElementById('ce-present').checked = false;
}

function openCustomManager() { const modal = document.getElementById('admin-custom-manage-modal'); if (!modal) return; renderCustomManagerList(); modal.style.display = 'flex'; }
function closeCustomManager() { document.getElementById('admin-custom-manage-modal').style.display = 'none'; }
function renderCustomManagerList() {
    const glob = users['__GLOBAL_SETTINGS__'], themeUl = document.getElementById('manage-theme-list'), effectUl = document.getElementById('manage-effect-list');
    if (!themeUl || !effectUl) return; themeUl.innerHTML = ''; effectUl.innerHTML = '';
    let hasTheme = false;
    if (glob && glob.globalMistakes && Array.isArray(glob.globalMistakes.customThemes)) {
        glob.globalMistakes.customThemes.forEach((ct, idx) => {
            hasTheme = true; const li = document.createElement('li'); li.style.display = 'flex'; li.style.justifyContent = 'space-between'; li.style.alignItems = 'center'; li.style.marginBottom = '10px';
            li.innerHTML = `<span>🎨 ${ct.name}</span> <button class="btn-danger" style="font-size:14px; padding:5px 15px;" onclick="deleteCustomElement('theme', ${idx}, '${ct.name}')">削除</button>`; themeUl.appendChild(li);
        });
    }
    if (!hasTheme) themeUl.innerHTML = '<li style="color:#999; text-align:center;">作ったテーマはありません</li>';
    let hasEffect = false;
    if (glob && glob.globalMistakes && Array.isArray(glob.globalMistakes.customEffects)) {
        glob.globalMistakes.customEffects.forEach((ce, idx) => {
            hasEffect = true; const li = document.createElement('li'); li.style.display = 'flex'; li.style.justifyContent = 'space-between'; li.style.alignItems = 'center'; li.style.marginBottom = '10px';
            li.innerHTML = `<span>🎉 ${ce.name} (${ce.emojis.join('')})</span> <button class="btn-danger" style="font-size:14px; padding:5px 15px;" onclick="deleteCustomElement('effect', ${idx}, '${ce.name}')">削除</button>`; effectUl.appendChild(li);
        });
    }
    if (!hasEffect) effectUl.innerHTML = '<li style="color:#999; text-align:center;">作った演出はありません</li>';
}
function deleteCustomElement(type, idx, name) {
    if (!confirm(`本当に「${name}」を削除しますか？\n（※削除後、設定を反映するためにページが再読み込みされます）`)) return;
    const glob = users['__GLOBAL_SETTINGS__'];
    if (type === 'theme') glob.globalMistakes.customThemes.splice(idx, 1); else if (type === 'effect') glob.globalMistakes.customEffects.splice(idx, 1);
    saveUsers(true); alert('削除しました。画面を再読み込みします。'); location.reload();
}

window.addEventListener('DOMContentLoaded', () => { setTimeout(loadCustomGlobalSettings, 1000); });

/* =========================================================
   [JS] 11. ビジョントレーニング
   ========================================================= */

function renderVisionMenu() {
    const cont = document.getElementById('vision-menu-content'); cont.innerHTML = '';
    const u = users[currentUser]; if (!u.visionCleared) u.visionCleared =[];

    VISION_STAGES.forEach((st) => {
        const wrapper = document.createElement('div');
        wrapper.style.display = 'flex'; wrapper.style.flexDirection = 'column'; wrapper.style.gap = '5px';

        const isEasyCleared = u.visionCleared.includes(st.id + '_easy');
        const isCleared = u.visionCleared.includes(st.id);
        const isHardCleared = u.visionCleared.includes(st.id + '_hard');

        const eb = document.createElement('div');
        eb.className = 'stage-btn unlocked' + (isEasyCleared ? ' cleared' : '');
        eb.style.borderColor = '#4CAF50'; eb.style.height = '40px'; eb.style.backgroundColor = '#e8f5e9';
        eb.innerHTML = `<span style="font-size:14px; font-weight:bold; color:#2E7D32;">🔰 イージー</span> <span class="reward-badge">${getRewardText('vision', st.id + '_easy')}</span>`;
        createBtn(eb, () => startGame(st.id + '_easy', 'vision'));
        wrapper.appendChild(eb);

        const b = document.createElement('div'); b.className = 'stage-btn unlocked' + (isCleared ? ' cleared' : ''); b.style.borderColor = st.color; b.style.height = '100px';
        b.innerHTML = `<span style="font-size:30px;">${st.icon}</span><span style="font-size:16px; font-weight:bold; color:#333; margin-top:5px;">${st.title}</span><span style="font-size:10px; color:#666;">${st.sub}</span> <span class="reward-badge">${getRewardText('vision', st.id)}</span>`;
        createBtn(b, () => startGame(st.id, 'vision')); 
        wrapper.appendChild(b);

        if (isCleared || u.isMaster) {
            const hb = document.createElement('div'); hb.className = 'stage-btn unlocked' + (isHardCleared ? ' cleared' : ''); 
            hb.style.borderColor = '#d84315'; hb.style.height = '40px'; hb.style.backgroundColor = '#fff3e0';
            hb.innerHTML = `<span style="font-size:14px; font-weight:bold; color:#d84315;">🔥 ハード</span> <span class="reward-badge">${getRewardText('vision', st.id + '_hard')}</span>`;
            createBtn(hb, () => startGame(st.id + '_hard', 'vision')); wrapper.appendChild(hb);
        } else {
            const hb = document.createElement('div'); hb.className = 'stage-btn'; hb.style.height = '40px'; hb.style.opacity = '0.3'; hb.innerHTML = `<span style="font-size:14px;">🔒 クリアで解放</span>`; wrapper.appendChild(hb);
        }
        cont.appendChild(wrapper);
    });
}

function setupVision(sid) {
    els.playArea.style.display = 'flex'; 
    els.playArea.style.justifyContent = 'center'; els.playArea.style.alignItems = 'center'; els.playArea.innerHTML = '';
    totalCount = 1; currentCount = 0; updateProgress();
    
    if (sid === 'v1') els.instText.innerText = "1から 順番に すばやく クリックしてね！";
    else if (sid === 'v2') els.instText.innerText = "1つだけ 違う文字を さがして クリックしてね！";
    else if (sid === 'v3') els.instText.innerText = "的(まと)の 上に マウスを ずっと 合わせてね！";
    else if (sid === 'v4') els.instText.innerText = "一瞬だけ 出てくる 絵を おぼえよう！";
    else if (sid === 'v5') els.instText.innerText = "おなじ絵を ぜんぶ さがして クリックしてね！";
    else if (sid === 'v6') els.instText.innerText = "でてきた 的(まと)を すばやく クリックしてね！";
    else if (sid === 'v7') els.instText.innerText = "光った 順番を おぼえて、同じように クリックしてね！";
    else if (sid === 'v8') els.instText.innerText = "青いスタートから 赤いゴールまで はみ出さずに すすんでね！";
    else if (sid === 'v9') els.instText.innerText = "真ん中と 同じ向きの ものを えらんでね！";
}

function startVisionGame(sid) {
    if (sid === 'v1') playVisionV1();
    else if (sid === 'v2') playVisionV2();
    else if (sid === 'v3') playVisionV3();
    else if (sid === 'v4') playVisionV4();
    else if (sid === 'v5') playVisionV5();
    else if (sid === 'v6') playVisionV6();
    else if (sid === 'v7') playVisionV7();
    else if (sid === 'v8') playVisionV8();
    else if (sid === 'v9') playVisionV9();
}

function playVisionV1() {
    els.playArea.style.display = 'block';
    visionTarget = 1;
    const maxNum = isVisionHardMode ? 30 : (isVisionEasyMode ? 10 : 20);
    totalCount = maxNum; currentCount = 0; updateProgress();
    
    const container = document.createElement('div'); 
    container.style.position = 'relative'; container.style.width = '100%'; container.style.height = '100%';
    
    let nums =[]; for(let i=1; i<=maxNum; i++) nums.push(i); nums = shuffle(nums);
    const areaRect = els.playArea.getBoundingClientRect();
    
    let placedRects =[]; 

    nums.forEach(n => {
        const btn = document.createElement('div'); btn.className = 'schulte-btn'; btn.innerText = n;
        
        let size = isVisionHardMode ? (Math.random() * 20 + 40) : (Math.random() * 30 + 50); 
        btn.style.position = 'absolute';
        btn.style.width = size + 'px'; btn.style.height = size + 'px';
        btn.style.borderRadius = '50%';
        btn.style.fontSize = (size * 0.5) + 'px';
        
        let x, y;
        let attempts = 0;
        let overlap = true;
        while (overlap && attempts < 100) {
            x = Math.random() * (areaRect.width - size - 40) + 20;
            y = Math.random() * (areaRect.height - size - 40) + 20;
            overlap = false;
            for (let rect of placedRects) {
                let dx = x + size/2 - (rect.x + rect.size/2);
                let dy = y + size/2 - (rect.y + rect.size/2);
                let distance = Math.sqrt(dx*dx + dy*dy);
                if (distance < (size/2 + rect.size/2 + 5)) { overlap = true; break; }
            }
            attempts++;
        }
        placedRects.push({x: x, y: y, size: size});
        btn.style.left = x + 'px'; btn.style.top = y + 'px';

        btn.onclick = () => {
            if (isProcessing) return;
            if (n === visionTarget) {
                SoundManager.playClick(); btn.style.visibility = 'hidden'; visionTarget++; currentCount++; updateProgress();
                if (visionTarget > maxNum) { isProcessing = true; setTimeout(markClear, 500); }
            } else { SoundManager.playError(); btn.style.backgroundColor = '#ffcdd2'; setTimeout(() => btn.style.backgroundColor = '#fff', 200); }
        };
        container.appendChild(btn);
    });
    els.playArea.appendChild(container);
}

function playVisionV2() {
    visionScore = 0; visionTarget = 5; totalCount = visionTarget; currentCount = 0; updateProgress();
    nextVisionV2();
}
function nextVisionV2() {
    els.playArea.innerHTML = '';
    const qList =[ {base:'め', diff:'ぬ'}, {base:'わ', diff:'れ'}, {base:'大', diff:'犬'}, {base:'ソ', diff:'ン'}, {base:'O', diff:'Q'}, {base:'土', diff:'士'}, {base:'は', diff:'ほ'}, {base:'シ', diff:'ツ'}, {base:'E', diff:'F'}, {base:'あ', diff:'お'}, {base:'ね', diff:'れ'}, {base:'b', diff:'d'} ];
    const q = qList[Math.floor(Math.random() * qList.length)];
    
    const grid = document.createElement('div'); grid.className = 'find-diff-grid';
    const totalChars = isVisionHardMode ? 100 : (isVisionEasyMode ? 20 : 50); 
    const diffIndex = Math.floor(Math.random() * totalChars);
    if (isVisionHardMode) { grid.style.gridTemplateColumns = 'repeat(20, 1fr)'; }

    for(let i=0; i<totalChars; i++) {
        const span = document.createElement('span'); span.className = 'find-diff-char';
        if (isVisionHardMode) span.style.fontSize = '24px';
        const isDiff = (i === diffIndex); span.innerText = isDiff ? q.diff : q.base;
        span.onclick = () => {
            if(isProcessing) return;
            if (isDiff) {
                SoundManager.playSuccess(); visionScore++; currentCount++; updateProgress();
                if (visionScore >= visionTarget) { isProcessing = true; setTimeout(markClear, 500); } else { nextVisionV2(); }
            } else { SoundManager.playError(); span.style.color = '#f44336'; setTimeout(() => span.style.color = '#333', 300); }
        };
        grid.appendChild(span);
    }
    els.playArea.appendChild(grid);
}

function playVisionV3() {
    totalCount = 100; currentCount = 0; updateProgress(); els.playArea.style.position = 'relative';
    const target = document.createElement('div'); target.className = 'lockon-target'; els.playArea.appendChild(target);
    
    let isHovering = false; let targetX = 100, targetY = 100; 
    let baseSpeed = isVisionHardMode ? 8 : (isVisionEasyMode ? 2 : 4);
    let vx = baseSpeed, vy = baseSpeed;
    let tSize = isVisionHardMode ? 40 : (isVisionEasyMode ? 120 : 80);
    
    target.style.width = tSize + 'px'; target.style.height = tSize + 'px';
    target.onmouseenter = () => { isHovering = true; target.classList.add('active'); };
    target.onmouseleave = () => { isHovering = false; target.classList.remove('active'); };
    
    const areaRect = els.playArea.getBoundingClientRect();
    
    visionInterval = setInterval(() => {
        if(isProcessing) return;
        targetX += vx; targetY += vy;
        
        if (targetX <= 0 || targetX >= areaRect.width - tSize) { vx *= -1; targetX = Math.max(0, Math.min(targetX, areaRect.width - tSize)); }
        if (targetY <= 0 || targetY >= areaRect.height - tSize) { vy *= -1; targetY = Math.max(0, Math.min(targetY, areaRect.height - tSize)); }
        
        let feintRate = isVisionHardMode ? 0.08 : (isVisionEasyMode ? 0.01 : 0.03);
        if (Math.random() < feintRate) { 
            vx = (Math.random() > 0.5 ? 1 : -1) * (Math.random() * baseSpeed + (baseSpeed/2)); 
            vy = (Math.random() > 0.5 ? 1 : -1) * (Math.random() * baseSpeed + (baseSpeed/2)); 
        }
        
        target.style.left = targetX + 'px'; target.style.top = targetY + 'px';
        
        if (isHovering) {
            currentCount++; updateProgress();
            if (currentCount % 10 === 0) SoundManager.playClick();
            if (currentCount >= totalCount) {
                isProcessing = true; clearInterval(visionInterval);
                target.style.backgroundColor = '#4CAF50'; target.style.background = 'none'; target.innerText = '⭕'; target.style.display='flex'; target.style.justifyContent='center'; target.style.alignItems='center'; target.style.fontSize='30px';
                setTimeout(markClear, 800);
            }
        }
    }, 30); 
}

function playVisionV4() {
    visionScore = 0; visionTarget = 3; totalCount = visionTarget; currentCount = 0; updateProgress();
    nextVisionV4();
}
function nextVisionV4() {
    els.playArea.innerHTML = ''; els.instText.innerText = "まんなかの「＋」をみてね...";
    const cross = document.createElement('div'); cross.className = 'flash-cross animated-cross'; cross.innerText = '＋'; els.playArea.appendChild(cross);
    const items =['🍎','🐶','🚗','⭐','🍓','🐱','🚀','💖','🍉','🐸','🚲','🎵','🍕','⚽','🍄'];
    const shuffled = shuffle([...items]); const answer = shuffled[0];
    
    const itemEl = document.createElement('div'); itemEl.className = 'flash-item'; itemEl.innerText = answer; itemEl.style.display = 'none';
    const pos = Math.floor(Math.random() * 4);
    if(pos===0) { itemEl.style.top='50px'; itemEl.style.left='50px'; } if(pos===1) { itemEl.style.top='50px'; itemEl.style.right='50px'; }
    if(pos===2) { itemEl.style.bottom='50px'; itemEl.style.left='50px'; } if(pos===3) { itemEl.style.bottom='50px'; itemEl.style.right='50px'; }
    els.playArea.appendChild(itemEl);
    
    let displayTime = isVisionHardMode ? 150 : (isVisionEasyMode ? 600 : 300); 

    visionTimeout = setTimeout(() => {
        itemEl.style.display = 'block'; SoundManager.playTone(800, 'sine', 0.1);
        visionTimeout = setTimeout(() => {
            itemEl.style.display = 'none'; cross.style.display = 'none';
            showFlashChoices(answer, shuffled.slice(1, 4));
        }, displayTime); 
    }, 1000);
}
function showFlashChoices(answer, dummies) {
    els.instText.innerText = "なにが でたかな？"; const choices = shuffle([answer, ...dummies]);
    const container = document.createElement('div'); container.className = 'flash-choices';
    choices.forEach(c => {
        const btn = document.createElement('button'); btn.className = 'flash-choice-btn'; btn.innerText = c;
        btn.onclick = () => {
            if(isProcessing) return;
            if(c === answer) {
                SoundManager.playSuccess(); visionScore++; currentCount++; updateProgress();
                if (visionScore >= visionTarget) { isProcessing = true; setTimeout(markClear, 500); } else { isProcessing = true; setTimeout(() => { isProcessing = false; nextVisionV4(); }, 1000); }
            } else { SoundManager.playError(); btn.style.backgroundColor = '#ffcdd2'; setTimeout(() => btn.style.backgroundColor = '#fff', 200); }
        };
        container.appendChild(btn);
    });
    els.playArea.appendChild(container);
}

function playVisionV5() {
    els.playArea.style.display = 'block'; 
    visionScore = 0; 
    visionTarget = isVisionHardMode ? 8 : (isVisionEasyMode ? 3 : 5);
    let dummyCount = isVisionHardMode ? 70 : (isVisionEasyMode ? 15 : 35);
    totalCount = visionTarget; currentCount = 0; updateProgress();
    
    els.playArea.innerHTML = '';
    const items =['🍎','🐶','🚗','⭐','🍓','🐱','🚀','💖','🍉','🐸','🚲','🎵','🍕','⚽','🍄','🌻','🍔','🧸'];
    const shuffled = shuffle([...items]); const targetItem = shuffled[0]; 
    
    els.instText.innerHTML = `「<span style="font-size:30px;">${targetItem}</span>」を <span style="color:#E91E63; font-weight:bold;">${visionTarget}こ</span> さがしてね！`;
    const container = document.createElement('div'); container.style.position = 'relative'; container.style.width = '100%'; container.style.height = '100%';
    
    let allItems =[];
    for(let i=0; i<visionTarget; i++) allItems.push(targetItem);
    for(let i=0; i<dummyCount; i++) allItems.push(shuffled[Math.floor(Math.random() * (shuffled.length - 1)) + 1]);
    allItems = shuffle(allItems);
    
    const areaRect = els.playArea.getBoundingClientRect();
    const itemSize = isVisionHardMode ? 40 : (isVisionEasyMode ? 80 : 60);
    const maxX = areaRect.width - itemSize; const maxY = areaRect.height - itemSize;
    
    allItems.forEach(item => {
        const el = document.createElement('div'); el.className = 'vision-find-item'; el.innerText = item;
        el.style.width = itemSize + 'px'; el.style.height = itemSize + 'px'; el.style.fontSize = (itemSize * 0.75) + 'px';
        el.style.left = Math.floor(Math.random() * maxX) + 'px'; el.style.top = Math.floor(Math.random() * maxY) + 'px';
        el.style.transform = `rotate(${Math.floor(Math.random() * 60) - 30}deg)`;
        
        el.onclick = () => {
            if(isProcessing) return;
            if(item === targetItem && !el.classList.contains('found')) {
                SoundManager.playSuccess(); el.classList.add('found'); el.style.opacity = '0.2'; el.style.transform = 'scale(1.5)';
                visionScore++; currentCount++; updateProgress();
                if (visionScore >= visionTarget) { isProcessing = true; setTimeout(markClear, 500); }
            } else if (item !== targetItem) {
                SoundManager.playError(); el.style.color = 'red'; el.style.backgroundColor = '#ffcdd2';
                setTimeout(() => { el.style.backgroundColor = 'transparent'; el.style.color = ''; }, 300);
            }
        };
        container.appendChild(el);
    });
    els.playArea.appendChild(container);
}

function playVisionV6() {
    els.playArea.style.display = 'block'; 
    visionScore = 0; visionTarget = isVisionHardMode ? 15 : (isVisionEasyMode ? 5 : 10); 
    totalCount = visionTarget; currentCount = 0; updateProgress(); els.playArea.innerHTML = '';    
    const container = document.createElement('div'); container.style.position = 'relative'; container.style.width = '100%'; container.style.height = '100%'; els.playArea.appendChild(container);
    const areaRect = els.playArea.getBoundingClientRect();
    const tSize = isVisionHardMode ? 50 : (isVisionEasyMode ? 100 : 80);
    const disappearTime = isVisionHardMode ? 800 : (isVisionEasyMode ? 2000 : 1500);
    let currentTarget = null;
    
    function spawnTarget() {
        if(isProcessing) return;
        if(currentTarget) currentTarget.remove();
        
        const el = document.createElement('div'); el.className = 'vision-mole'; el.innerText = '👾'; 
        el.style.width = tSize + 'px'; el.style.height = tSize + 'px'; el.style.fontSize = (tSize * 0.6) + 'px';
        
        const x = Math.floor(Math.random() * (areaRect.width - tSize)); const y = Math.floor(Math.random() * (areaRect.height - tSize));
        el.style.left = x + 'px'; el.style.top = y + 'px';
        
        el.onmousedown = () => {
            if(isProcessing || el.dataset.clicked) return;
            el.dataset.clicked = "true";
            
            SoundManager.playClick(); el.innerText = '💥'; el.style.backgroundColor = '#FF9800';
            visionScore++; currentCount++; updateProgress(); clearTimeout(visionTimeout); currentTarget = null;
            if (visionScore >= visionTarget) { isProcessing = true; setTimeout(markClear, 500); } else { setTimeout(spawnTarget, isVisionHardMode ? 100 : 200); }
        };
        container.appendChild(el); currentTarget = el;
        
        visionTimeout = setTimeout(() => { if (currentTarget === el) spawnTarget(); }, disappearTime);
    }
    setTimeout(spawnTarget, 500);
}

function playVisionV7() {
    visionTarget = 3; 
    totalCount = visionTarget; 
    currentCount = 0; 
    updateProgress(); 
    els.playArea.innerHTML = '';
    
    memoryLevel = isVisionEasyMode ? 2 : 3; 
    
    const container = document.createElement('div'); 
    container.className = 'memory-grid';
    
    let colors =['#f44336', '#4CAF50', '#2196F3', '#FFEB3B']; 
    if (isVisionHardMode) {
        colors =['#f44336', '#4CAF50', '#2196F3', '#FFEB3B', '#9C27B0', '#FF9800'];
        container.classList.add('hard');
    } else if (isVisionEasyMode) {
        colors =['#f44336', '#4CAF50', '#2196F3']; 
        container.classList.add('easy'); 
        container.style.display = 'flex';
        container.style.flexWrap = 'wrap';
        container.style.justifyContent = 'center';
    }
    
    const btns =[];
    colors.forEach((c, idx) => {
        const btn = document.createElement('div'); 
        btn.className = 'memory-btn'; 
        btn.style.backgroundColor = c; 
        btn.dataset.idx = idx;
        if(isVisionEasyMode) {
            btn.style.width = '130px'; 
            btn.style.height = '130px';
            btn.style.margin = '10px';
        }
        btn.onmousedown = () => handleMemoryInput(idx, btn); 
        container.appendChild(btn); 
        btns.push(btn);
    });
    els.playArea.appendChild(container);
    
    let intervalSpeed = isVisionHardMode ? 400 : (isVisionEasyMode ? 1200 : 800);
    let flashSpeed = isVisionHardMode ? 200 : (isVisionEasyMode ? 600 : 400);

    function startMemoryRound() {
        memorySeq =[]; 
        memoryInputIdx = 0;
        for(let i=0; i<memoryLevel; i++) memorySeq.push(Math.floor(Math.random() * colors.length));
        let step = 0; 
        els.instText.innerText = "よく みて おぼえてね..."; 
        container.style.pointerEvents = 'none'; 
        
        if (visionInterval) clearInterval(visionInterval); 
        
        visionInterval = setInterval(() => {
            if(isProcessing) { clearInterval(visionInterval); return; }
            if(step >= memorySeq.length) { 
                clearInterval(visionInterval); 
                els.instText.innerText = "おなじ じゅんばんで おしてね！"; 
                container.style.pointerEvents = 'auto'; 
                return; 
            }
            const b = btns[memorySeq[step]]; 
            SoundManager.playTone(400 + memorySeq[step] * 100, 'sine', 0.2);
            b.classList.add('flash'); 
            setTimeout(() => b.classList.remove('flash'), flashSpeed); 
            step++;
        }, intervalSpeed);
    }
    
    function handleMemoryInput(idx, btn) {
        if(isProcessing || container.style.pointerEvents === 'none') return;
        btn.classList.add('flash'); 
        setTimeout(() => btn.classList.remove('flash'), 200);
        
        if (idx === memorySeq[memoryInputIdx]) {
            SoundManager.playTone(400 + idx * 100, 'sine', 0.1); 
            memoryInputIdx++;
            if (memoryInputIdx >= memorySeq.length) {
                container.style.pointerEvents = 'none'; 
                SoundManager.playSuccess(); 
                currentCount++; 
                updateProgress();
                if (currentCount >= visionTarget) { 
                    isProcessing = true; 
                    setTimeout(markClear, 500); 
                } 
                else { 
                    memoryLevel++; 
                    setTimeout(startMemoryRound, 1000); 
                }
            }
        } else {
            container.style.pointerEvents = 'none'; 
            SoundManager.playError(); 
            els.instText.innerText = "ちがうよ！ もういちど！"; 
            btn.style.backgroundColor = '#000';
            setTimeout(() => btn.style.backgroundColor = colors[idx], 300); 
            setTimeout(startMemoryRound, 1000); 
        }
    }
    setTimeout(startMemoryRound, 1000);
}

function playVisionV8() {
    totalCount = 100; currentCount = 0; updateProgress(); els.playArea.innerHTML = '';
    const maze = document.createElement('div'); maze.className = 'maze-container';
    const startObj = document.createElement('div'); startObj.className = 'maze-start'; startObj.innerText = 'START';
    const goalObj = document.createElement('div'); goalObj.className = 'maze-goal'; goalObj.innerText = 'GOAL';
    
    let pathGap = isVisionHardMode ? 20 : (isVisionEasyMode ? 100 : 60); 
    let wallWidth = isVisionHardMode ? 520 : (isVisionEasyMode ? 440 : 480);

    const pattern = Math.floor(Math.random() * 3);
    
    if (pattern === 0) {
        const w1 = document.createElement('div'); w1.className = 'maze-wall';
        const w2 = document.createElement('div'); w2.className = 'maze-wall';
        let wallHeight = (180 - pathGap) / 2;
        w1.style.left = '0'; w1.style.top = '120px'; w1.style.width = wallWidth + 'px'; w1.style.height = wallHeight + 'px';
        w2.style.right = '0'; w2.style.top = (120 + wallHeight + pathGap) + 'px'; w2.style.width = wallWidth + 'px'; w2.style.height = wallHeight + 'px';
        maze.appendChild(w1); maze.appendChild(w2);
    } else if (pattern === 1) {
        const w1 = document.createElement('div'); w1.className = 'maze-wall';
        w1.style.left = '200px'; w1.style.top = '0'; w1.style.width = '200px'; w1.style.height = (400 - pathGap*2) + 'px';
        maze.appendChild(w1);
        startObj.style.top = '20px'; goalObj.style.bottom = '20px';
    } else {
        const w1 = document.createElement('div'); w1.className = 'maze-wall';
        const w2 = document.createElement('div'); w2.className = 'maze-wall';
        w1.style.left = '150px'; w1.style.top = '0'; w1.style.width = '50px'; w1.style.height = '250px';
        w2.style.right = '150px'; w2.style.bottom = '0'; w2.style.width = '50px'; w2.style.height = '250px';
        maze.appendChild(w1); maze.appendChild(w2);
    }
    
    maze.appendChild(startObj); maze.appendChild(goalObj); els.playArea.appendChild(maze);
    let isPlaying = false;

    function failMaze() {
        if(!isPlaying || isProcessing) return;
        isPlaying = false; SoundManager.playError(); els.instText.innerText = "壁にあたっちゃった！ スタートから やりなおし！";
        maze.classList.add('error'); setTimeout(() => maze.classList.remove('error'), 300);
        currentCount = 0; updateProgress();
    }
    
    startObj.onmouseenter = () => {
        if(isProcessing) return; isPlaying = true; SoundManager.playClick();
        els.instText.innerText = isVisionHardMode ? "🔥 極細の道を はみださずに すすめ！" : "はみださないように ゴールをめざせ！";
        maze.classList.remove('error');
    };
    
    maze.onmouseleave = (e) => { failMaze(); };
    maze.querySelectorAll('.maze-wall').forEach(w => w.onmouseenter = () => failMaze());
    
    goalObj.onmouseenter = () => {
        if(!isPlaying || isProcessing) return;
        isPlaying = false; SoundManager.playSuccess(); currentCount = 100; updateProgress(); isProcessing = true; setTimeout(markClear, 500);
    };
}

function playVisionV9() {
    visionScore = 0; visionTarget = isVisionEasyMode ? 3 : 5; totalCount = visionTarget; currentCount = 0; updateProgress();
    const qList = [['b', 'd', 'p', 'q'],['⬆️', '⬇️', '⬅️', '➡️'],['わ', 'ね', 'れ', 'め'],['シ', 'ツ', 'ン', 'ソ'],['E', 'ヨ', 'm', 'w'] ];
    nextVisionV9(qList);
}

function nextVisionV9(qList) {
    els.playArea.innerHTML = '';
    const group = qList[Math.floor(Math.random() * qList.length)]; const shuffledGroup = shuffle([...group]); const answer = shuffledGroup[0]; 
    
    const questionEl = document.createElement('div'); questionEl.className = 'vision-q-main'; questionEl.innerText = answer;
    
    const isRotated = isVisionHardMode ? true : (isVisionEasyMode ? false : (Math.random() < 0.3));
    const rotateDeg = isRotated ? (Math.random() < 0.5 ? 90 : -90) : 0;
    
    if (isRotated) {
        questionEl.style.transform = `rotate(${rotateDeg}deg)`;
        els.instText.innerText = "かたむいているよ！ おなじものを さがしてね！";
    } else {
        els.instText.innerText = "まんなかと まったくおなじものを えらんでね！";
    }
    
    const choicesContainer = document.createElement('div'); choicesContainer.className = 'vision-q-choices';
    const displayChoices = shuffle([...group]);
    
    displayChoices.forEach(c => {
        const btn = document.createElement('button'); btn.className = 'vision-q-btn'; btn.innerText = c;
        if (isRotated) btn.style.transform = `rotate(${rotateDeg}deg)`;
        
        btn.onclick = () => {
            if(isProcessing) return;
            if(c === answer) {
                SoundManager.playSuccess(); visionScore++; currentCount++; updateProgress();
                if (visionScore >= visionTarget) { isProcessing = true; setTimeout(markClear, 500); } else { isProcessing = true; setTimeout(() => { isProcessing = false; nextVisionV9(qList); }, 500); }
            } else { SoundManager.playError(); btn.style.backgroundColor = '#ffcdd2'; setTimeout(() => btn.style.backgroundColor = '#fff', 300); }
        };
        choicesContainer.appendChild(btn);
    });
    
    els.playArea.appendChild(questionEl); els.playArea.appendChild(choicesContainer);
}

/* =========================================================
   [JS] 12. ローマ字一覧表ステージ
   ========================================================= */
const ROMAJI_TABLE_DATA = {
    'romaji_basic': {
        rows: [[{h:'あ',r:['A']},{h:'い',r:['I']},{h:'う',r:['U']},{h:'え',r:['E']},{h:'お',r:['O']}],[{h:'か',r:['KA']},{h:'き',r:['KI']},{h:'く',r:['KU']},{h:'け',r:['KE']},{h:'こ',r:['KO']}],[{h:'さ',r:['SA']},{h:'し',r:['SHI','SI']},{h:'す',r:['SU']},{h:'せ',r:['SE']},{h:'そ',r:['SO']}],[{h:'た',r:['TA']},{h:'ち',r:['CHI','TI']},{h:'つ',r:['TSU','TU']},{h:'て',r:['TE']},{h:'と',r:['TO']}],[{h:'な',r:['NA']},{h:'に',r:['NI']},{h:'ぬ',r:['NU']},{h:'ね',r:['NE']},{h:'の',r:['NO']}],[{h:'は',r:['HA']},{h:'ひ',r:['HI']},{h:'ふ',r:['FU','HU']},{h:'へ',r:['HE']},{h:'ほ',r:['HO']}],[{h:'ま',r:['MA']},{h:'み',r:['MI']},{h:'む',r:['MU']},{h:'め',r:['ME']},{h:'も',r:['MO']}],[{h:'や',r:['YA']},null,{h:'ゆ',r:['YU']},null,{h:'よ',r:['YO']}],[{h:'ら',r:['RA']},{h:'り',r:['RI']},{h:'る',r:['RU']},{h:'れ',r:['RE']},{h:'ろ',r:['RO']}],[{h:'わ',r:['WA']},null,null,null,{h:'を',r:['WO']}],[{h:'ん',r:['NN']},null,null,null,null]
        ]
    },
    'romaji_daku': {
        rows: [
            [{h:'が',r:['GA']},{h:'ぎ',r:['GI']},{h:'ぐ',r:['GU']},{h:'げ',r:['GE']},{h:'ご',r:['GO']}],[{h:'ざ',r:['ZA']},{h:'じ',r:['JI','ZI']},{h:'ず',r:['ZU']},{h:'ぜ',r:['ZE']},{h:'ぞ',r:['ZO']}],[{h:'だ',r:['DA']},{h:'ぢ',r:['DI']},{h:'づ',r:['DU']},{h:'で',r:['DE']},{h:'ど',r:['DO']}],[{h:'ば',r:['BA']},{h:'び',r:['BI']},{h:'ぶ',r:['BU']},{h:'べ',r:['BE']},{h:'ぼ',r:['BO']}],[{h:'ぱ',r:['PA']},{h:'ぴ',r:['PI']},{h:'ぷ',r:['PU']},{h:'ぺ',r:['PE']},{h:'ぽ',r:['PO']}],
            [{h:'きゃ',r:['KYA']},{h:'きゅ',r:['KYU']},{h:'きょ',r:['KYO']},null,null],[{h:'しゃ',r:['SHA','SYA']},{h:'しゅ',r:['SHU','SYU']},{h:'しょ',r:['SHO','SYO']},null,null],
            [{h:'ちゃ',r:['CHA','TYA']},{h:'ちゅ',r:['CHU','TYU']},{h:'ちょ',r:['CHO','TYO']},null,null],
            // ★追加: 拗音・促音[{h:'にゃ',r:['NYA']},{h:'にゅ',r:['NYU']},{h:'にょ',r:['NYO']},null,null],
            [{h:'ひゃ',r:['HYA']},{h:'ひゅ',r:['HYU']},{h:'ひょ',r:['HYO']},null,null],
            [{h:'ふぁ',r:['FA']},{h:'ふぃ',r:['FI']},{h:'ふぇ',r:['FE']},{h:'ふぉ',r:['FO']},null],[{h:'みゃ',r:['MYA']},{h:'みゅ',r:['MYU']},{h:'みょ',r:['MYO']},null,null],
            [{h:'りゃ',r:['RYA']},{h:'りゅ',r:['RYU']},{h:'りょ',r:['RYO']},null,null],
            [{h:'っか',r:['KKA','LTUKA','XTUKA']},{h:'っさ',r:['SSA','LTUSA','XTUSA']},{h:'った',r:['TTA','LTUTA','XTUTA']},{h:'っは',r:['HHA','LTUHA','XTUHA']},{h:'っま',r:['MMA','LTUMA','XTUMA']}],
            [{h:'っや',r:['YYA','LTUYA','XTUYA']},{h:'っら',r:['RRA','LTURA','XTURA']},{h:'っわ',r:['WWA','LTUWA','XTUWA']},null,null]
        ]
    }
};

let romajiMode = ''; 
let romajiTotalCells = 0;
let romajiCorrectCells = 0;

function setupRomajiTable(sid) {
    els.playArea.innerHTML = '';
    els.playArea.style.justifyContent = 'center';
    
    romajiMode = sid.endsWith('_exam') ? 'exam' : 'prac';
    let baseId = sid.replace('_exam', '').replace('_prac', '');
    const data = ROMAJI_TABLE_DATA[baseId];
    
    els.instText.innerText = (romajiMode === 'exam') ? "ヒントなしで ぜんぶ うめてみよう！" : "ローマじを にゅうりょく して 表を うめよう！";

    const container = document.createElement('div');
    container.className = 'romaji-table-container';

    if (romajiMode === 'prac') {
        const hintBtn = document.createElement('button');
        hintBtn.className = 'btn-secondary';
        hintBtn.innerText = '💡 ヒントをみる';
        hintBtn.style.alignSelf = 'center';
        hintBtn.style.marginBottom = '10px';
        hintBtn.onclick = () => {
            document.querySelectorAll('.romaji-cell').forEach(c => c.classList.add('show-hint'));
            hintBtn.disabled = true; hintBtn.innerText = '💡 ヒント表示中';
            const firstInp = container.querySelector('.romaji-input:not(:disabled)');
            if(firstInp) firstInp.focus();
        };
        container.appendChild(hintBtn);
    }

    romajiTotalCells = 0;
    romajiCorrectCells = 0;

    const tableWrap = document.createElement('div');
    tableWrap.style.display = 'flex'; 
    tableWrap.style.flexWrap = 'wrap'; 
    tableWrap.style.justifyContent = 'center'; 
    tableWrap.style.gap = '40px'; 

    let currentCol = document.createElement('div');
    currentCol.style.display = 'flex'; currentCol.style.flexDirection = 'column'; currentCol.style.gap = '5px';
    
    const splitIndex = data.rows.length > 8 ? Math.ceil(data.rows.length / 2) : data.rows.length;

    data.rows.forEach((row, index) => {
        if (index === splitIndex) {
            tableWrap.appendChild(currentCol);
            currentCol = document.createElement('div');
            currentCol.style.display = 'flex'; currentCol.style.flexDirection = 'column'; currentCol.style.gap = '5px';
        }
        
        const rowDiv = document.createElement('div'); rowDiv.className = 'romaji-table-row';
        row.forEach(cell => {
            const cellDiv = document.createElement('div');
            cellDiv.className = 'romaji-cell' + (cell ? '' : ' empty');
            if (cell) {
                romajiTotalCells++;
                cellDiv.innerHTML = `<div class="romaji-hira">${cell.h}</div><input type="text" class="romaji-input" maxlength="5" data-ans="${cell.r.join(',')}"><div class="romaji-hint-text">${cell.r[0]}</div>`;
                const inp = cellDiv.querySelector('input');
                inp.oninput = () => {
                    let val = inp.value.toUpperCase(); inp.value = val;
                    let ansList = inp.getAttribute('data-ans').split(',');
                    if (ansList.includes(val)) {
                        inp.classList.add('correct'); inp.disabled = true; SoundManager.playType(); romajiCorrectCells++;
                        const allInputs = Array.from(container.querySelectorAll('.romaji-input:not(:disabled)'));
                        if (allInputs.length > 0) allInputs[0].focus();
                        if (romajiCorrectCells >= romajiTotalCells) {
                            SoundManager.playSuccess();
                            setTimeout(() => { currentStage = sid; markClear(); }, 500);
                        }
                    }
                };
            }
            rowDiv.appendChild(cellDiv);
        });
        currentCol.appendChild(rowDiv);
    });
    tableWrap.appendChild(currentCol);

    container.appendChild(tableWrap);
    els.playArea.appendChild(container);
}

/* =========================================================
   [JS] 13. ログアウト ＆ ユーティリティ
   ========================================================= */
function handleGlobalLogout() {
    showCustomConfirm('タイトル画面にもどりますか？\n（れんしゅうの きろくは ほぞんされます）', () => {
        saveUsers(false); 
        currentUser = null;
        document.getElementById('global-header').style.display = 'none';
        document.getElementById('game-container').classList.remove('has-header');
        
        if (timerInterval) clearInterval(timerInterval);
        if (visionInterval) clearInterval(visionInterval);
        if (visionTimeout) clearTimeout(visionTimeout);
        isProcessing = false;
        
        showScreen('screen-title');
    });
}

function exportDashboardCSV() {
    const isVision = document.getElementById('dash-vision').style.display === 'block';
    let csv = "\uFEFF"; 
    let thead = document.querySelector(isVision ? '#dash-vision-thead tr' : '#dash-basic thead tr');
    let tbody = document.querySelector(isVision ? '#dash-vision-tbody' : '#dash-tbody');
    
    if(!thead || !tbody) { alert("出力するデータがありません"); return; }
    
    let headers =[];
    thead.querySelectorAll('th').forEach(th => headers.push(`"${th.innerText.replace(/"/g, '""')}"`));
    csv += headers.join(',') + "\n";
    
    tbody.querySelectorAll('tr').forEach(tr => {
        let row =[];
        tr.querySelectorAll('td').forEach(td => {
            let text = td.innerText.replace(/\r?\n/g, " ").trim();
            row.push(`"${text.replace(/"/g, '""')}"`);
        });
        csv += row.join(',') + "\n";
    });
    
    let blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    let link = document.createElement('a');
    let dateStr = new Date().toISOString().slice(0,10);
    let fileName = isVision ? `ビジョンタイム_${dateStr}.csv` : `基本進捗_${dateStr}.csv`;
    link.href = URL.createObjectURL(blob);
    link.download = fileName;
    link.click();
}

/* =========================================================
   不足機能補填 ＆ バグ修正パッチ（最終）
   ========================================================= */

// ① 【追加】前回欠落していた報酬計算関数
// （これがないとマウスやビジョンのメニュー描画処理がエラーになり、発火しなくなります）
function getRewardText(mode, sid) {
    let u = users[currentUser];
    if (!u || u.isMaster) return "";
    let isFirst = false;
    
    if (mode === 'mouse') {
        isFirst = u.mouseLevel < sid; return isFirst ? "💰50" : "💰1";
    } else if (mode === 'vision') {
        isFirst = !(u.visionCleared && u.visionCleared.includes(sid));
        if (String(sid).endsWith('_hard')) return isFirst ? "💰100" : "💰50(更新)";
        else if (String(sid).endsWith('_easy')) return isFirst ? "💰20" : "💰10(更新)";
        else return isFirst ? "💰50" : "💰30(更新)";
    } else if (mode === 'romaji') {
        return String(sid).endsWith('_exam') ? "💰50" : "💰20";
    } else if (mode === 'keyboard') {
        if (sid === 9888) return "💰10";
        const idx = STAGE_ORDER.indexOf(sid);
        isFirst = (idx !== -1 && u.keyboardSequence <= idx);
        let cat = Math.floor(sid / 1000);
        if (cat === 1) return isFirst ? "💰100" : "💰10";
        if (cat === 2) return isFirst ? "💰150" : "💰20";
        if (cat === 3) return isFirst ? "💰200" : "💰30";
        if (cat === 4) return isFirst ? "💰250" : "💰50";
        return isFirst ? "💰50" : "💰10";
    }
    return "";
}

// ② 【修正】カスタムテーマがマイページ等に反映されない問題の修正
// ロード時に確実に THEMES と GACHA_ITEMS へ反映させる
function loadCustomGlobalSettings() {
    const glob = users['__GLOBAL_SETTINGS__'];
    if (!glob || !glob.globalMistakes) return;
    if (Array.isArray(glob.globalMistakes.customThemes)) {
        glob.globalMistakes.customThemes.forEach(ct => {
            if (!THEMES.find(t => t.id === ct.id)) {
                THEMES.push({ id: ct.id, name: ct.name, icon: '🎨', isCustom: true, data: ct, bg: ct.bg, text: ct.text, btnBg: ct.btnBg, btnText: ct.btnText });
                GACHA_ITEMS.push({ id: ct.id, type: 'theme', name: `🎨 カスタムテーマ：${ct.name}`, rate: 0.05 });
            }
        });
    }
    if (Array.isArray(glob.globalMistakes.customEffects)) {
        glob.globalMistakes.customEffects.forEach(ce => {
            if (!EFFECTS.find(e => e.id === ce.id)) {
                EFFECTS.push({ id: ce.id, name: ce.name, icon: ce.emojis[0], isCustom: true, data: ce, emojis: ce.emojis });
                GACHA_ITEMS.push({ id: ce.id, type: 'effect', name: `🎉 カスタム演出：${ce.name}`, rate: 0.05 });
            }
        });
    }
}

// マイページを開く直前に必ず強制リロードして、作ったテーマを確実に読み込ませる
const originalGoToRecords = goToRecords;
goToRecords = function() {
    loadCustomGlobalSettings(); 
    renderRecords();
    showScreen('screen-records');
};

/* =========================================================
   [JS] 14. Wordれんしゅう (外部PDF連動 ＆ 先生確認)
   ========================================================= */
// ★画像の内容から章タイトルを更新し、初級・中級を追加
const WORD_STAGES =[
    // --- 初級1 ---
    { id: 'w_b1_1', title: '初級1: 第1章', sub: 'Wordの基本操作', pdf: 'https://drive.google.com/file/d/1-FqZ40jUKyyBt3HT2rGAfYVgV8htaqHi/view?usp=drive_link' },
    { id: 'w_b1_2', title: '初級1: 第2章', sub: '文書を入力しましょう', pdf: 'https://drive.google.com/file/d/1PNhSTRREzR0DOk-ka8-zIpSzOWxDtSko/view?usp=drive_link' },
    { id: 'w_b1_3', title: '初級1: 第3章', sub: '『潮干狩りの案内』を作る', pdf: 'https://drive.google.com/file/d/1SQrbBR2dfIg1e5QpJGuyLH4ehAIz184X/view?usp=drive_link' },
    { id: 'w_b1_4', title: '初級1: 第4章', sub: '表の作成', pdf: 'https://drive.google.com/file/d/1S72do7S7pP0mtxaADaaLC2iLUiy8MKV0/view?usp=drive_link' },
    { id: 'w_b1_5', title: '初級1: 第5章', sub: '総合問題', pdf: 'https://drive.google.com/file/d/1dfuPSPAku_ixixSNU5FHCE3IK8vNwpPb/view?usp=drive_link' },
    // --- 中級4 ---
    // ※他の級や章を追加する場合は、ここにコピーして増やしてください
    { id: 'w_m4_1', title: '中級4: 第1章', sub: '図形を自由に加工する', pdf: 'https://drive.google.com/file/d/18mNWptnEPEI1tAffHsKfMpoYivD0nrkZ/view?usp=drive_link' },
    { id: 'w_m4_2', title: '中級4: 第2章', sub: 'パイプの老人のイラストを描く', pdf: 'https://drive.google.com/file/d/1FC_zSLHj-oB78huF3sw2QGsHhCkr0wpZ/view?usp=drive_link' },
    { id: 'w_m4_3', title: '中級4: 第3章', sub: '総合問題', pdf: 'https://drive.google.com/file/d/1_cktFg6o3rNPrSsGB-YyUSubAu4khlht/view?usp=drive_link' }
];

let currentWordStageId = null;

// ユーザーデータの初期化保護（loginやloadUsersでのエラー防止）
const originalLoginForWord = login;
login = function(n) {
    if (!users[n]) users[n] = {};
    if (users[n].wordProgress === undefined) users[n].wordProgress = {};
    originalLoginForWord(n);
};

function goToWordMenu() { 
    const u = users[currentUser];
    if (!u.isMaster) {
        if (!u.examRecords || !u.examRecords['romaji_daku_exam']) {
            // ★改行位置を最適化
            showCustomAlert('Wordれんしゅう は、キーボードれんしゅうの\n「ローマ字いちらん表（だくてん テスト）」を\nクリアすると あそべるようになるよ！');
            return;
        }
    }
    renderWordMenu(); 
    showScreen('screen-word-menu'); 
}

function renderWordMenu() {
    const cont = document.getElementById('word-menu-content'); cont.innerHTML = '';
    const u = users[currentUser];
    if (!u.wordProgress) u.wordProgress = {};

    let previousCleared = true; // 最初の章は無条件で挑戦可能

    WORD_STAGES.forEach((st) => {
        let prog = u.wordProgress[st.id];
        let isCleared = false;
        let isWorking = false;
        let workingPage = "";

        // ★修正: 以前の文字列データとの互換性を保ちつつ、ページ数を読み込む
        if (prog) {
            if (typeof prog === 'string') {
                isCleared = (prog === 'cleared');
                isWorking = (prog === 'working');
            } else {
                isCleared = (prog.status === 'cleared');
                isWorking = (prog.status === 'working');
                workingPage = prog.page || "";
            }
        }

        const isUnlocked = previousCleared || u.isMaster; 

        const b = document.createElement('div');
        b.className = 'stage-btn';
        b.style.height = '100px';

        if (isUnlocked) {
            b.classList.add('unlocked');
            if (isCleared) b.classList.add('cleared');
            else if (isWorking) b.classList.add('working');
            
            createBtn(b, () => startWordStage(st.id));
        } else {
            b.style.opacity = '0.5';
        }

        b.innerHTML = `<span style="font-size:24px;">📘</span><span style="font-size:16px; font-weight:bold; color:#333; margin-top:5px;">${st.title}</span><span style="font-size:12px; color:#666;">${st.sub}</span>`;
        
        // バッジ表示（ページ数があれば表示する）
        if (isCleared) b.innerHTML += `<span class="reward-badge" style="background:#e8f5e9; border-color:#4CAF50; color:#2e7d32;">クリア</span>`;
        else if (isWorking) b.innerHTML += `<span class="reward-badge" style="background:#fffde7; border-color:#FFEB3B; color:#fbc02d;">挑戦中 ⏸️ ${workingPage ? 'P.'+workingPage : ''}</span>`;
        else if (isUnlocked) b.innerHTML += `<span class="reward-badge">💰500</span>`; 

        cont.appendChild(b);
        previousCleared = isCleared; // 次の章の解放判定
    });
}

function startWordStage(sid) {
    currentWordStageId = sid;
    const st = WORD_STAGES.find(s => s.id === sid);
    document.getElementById('word-stage-title').innerText = `${st.title}：${st.sub}`;
    
    // ★追加: 以前入力したページ数があればセットする
    let prog = users[currentUser].wordProgress[sid];
    let pageVal = "";
    if (prog && typeof prog === 'object') {
        pageVal = prog.page || "";
    }
    document.getElementById('word-page-input').value = pageVal;

    showScreen('screen-word-game');
}

function openWordText() {
    const st = WORD_STAGES.find(s => s.id === currentWordStageId);
    if (st && st.pdf && st.pdf !== '') window.open(st.pdf, '_blank');
    else showCustomAlert('テキストのURLが設定されていません。\n（先生へ：script.js 内の WORD_STAGES にPDFのURLを入れてください）'); // ★修正
}

function suspendWordTask() {
    const u = users[currentUser];
    if (!u.wordProgress) u.wordProgress = {};
    
    let pageVal = document.getElementById('word-page-input').value;
    let prog = u.wordProgress[currentWordStageId];
    
    // クリア済みの場合はページ数だけ更新する
    let isCleared = (prog === 'cleared' || (prog && prog.status === 'cleared'));
    
    u.wordProgress[currentWordStageId] = {
        status: isCleared ? 'cleared' : 'working',
        page: pageVal
    };
    saveUsers(false);
    SoundManager.playClick();
    showCustomAlert('「挑戦中 ⏸️」として記録しました！\nデータを保存してWordをとじたら、また次回続きから頑張ろう！'); // ★修正
    goToWordMenu();
}

function confirmWordClear() {
    showPasswordModal('【先生確認】\n作品の出来を確認したら\nパスワードを入力:', (pass) => {
        if (pass === ADMIN_PASS) processWordClear();
        else if (pass !== null && pass !== '') alert('パスワードがちがいます');
    });
}

function processWordClear() {
    const u = users[currentUser];
    if (!u.wordProgress) u.wordProgress = {};
    
    let prog = u.wordProgress[currentWordStageId];
    let isFirstClear = !(prog === 'cleared' || (typeof prog === 'object' && prog.status === 'cleared'));
    let pageVal = document.getElementById('word-page-input').value;

    u.wordProgress[currentWordStageId] = { status: 'cleared', page: pageVal };
    
    let coinGain = isFirstClear ? 500 : 50; 
    u.coins = (u.coins || 0) + coinGain;
    
    saveUsers(false);
    SoundManager.playClear(); createConfetti();
    
    // リザルト画面を借用して表示
    document.getElementById('feedback-text').innerText = "Word マスター！";
    document.getElementById('feedback-time').innerHTML = `<span style="font-size:30px; color:#FFD700;">💰 +${coinGain} コインゲット！</span>`;
    document.getElementById('feedback-time').style.display = 'block';
    document.getElementById('feedback-stats').style.display = 'none';
    document.getElementById('feedback-overlay').style.display = 'flex';
    
    setTimeout(() => {
        document.getElementById('feedback-overlay').style.display = 'none';
        goToWordMenu();
    }, 4000);
}

// ★追加: ビジョントレーニング タイム比較用関数
function showVisionCompare() {
    let sumNormal = {}, countNormal = {}, sumHard = {}, countHard = {}, sumEasy = {}, countEasy = {};
    VISION_STAGES.forEach(st => {
        sumNormal[st.id] = 0; countNormal[st.id] = 0;
        sumHard[st.id] = 0; countHard[st.id] = 0;
        sumEasy[st.id] = 0; countEasy[st.id] = 0;
    });
    
    Object.keys(users).forEach(n => {
        if(users[n].isMaster || n === '__GLOBAL_SETTINGS__') return;
        VISION_STAGES.forEach(st => {
           let recN = users[n].examRecords && users[n].examRecords[st.id];
           if(recN) { sumNormal[st.id] += recN; countNormal[st.id]++; }
           
           let recH = users[n].examRecords && users[n].examRecords[st.id+'_hard'];
           if(recH) { sumHard[st.id] += recH; countHard[st.id]++; }
           
           let recE = users[n].examRecords && users[n].examRecords[st.id+'_easy'];
           if(recE) { sumEasy[st.id] += recE; countEasy[st.id]++; }
        });
    });

    let html = '<table style="width:100%; border-collapse:collapse; font-size:16px;">';
    html += '<tr style="background:#f2f2f2; position:sticky; top:0; z-index:5;"><th style="border:1px solid #ccc; padding:8px;">ステージ</th><th style="border:1px solid #ccc; padding:8px;">難易度</th><th style="border:1px solid #ccc; padding:8px;">あなたのタイム</th><th style="border:1px solid #ccc; padding:8px;">みんなの平均</th></tr>';
    
    const u = users[currentUser];
    VISION_STAGES.forEach(st => {
        // イージー
        let myE = (u.examRecords && u.examRecords[st.id+'_easy']) ? u.examRecords[st.id+'_easy'].toFixed(1)+'秒' : '-';
        let avgE = countEasy[st.id] > 0 ? (sumEasy[st.id]/countEasy[st.id]).toFixed(1)+'秒' : '-';
        html += `<tr style="background:#e8f5e9;"><td style="border:1px solid #ccc; padding:8px; font-weight:bold;" rowspan="3">${st.icon} ${st.title}</td><td style="border:1px solid #ccc; padding:8px; color:#2E7D32;">🔰 イージー</td><td style="border:1px solid #ccc; padding:8px; text-align:center; color:#2E7D32;">${myE}</td><td style="border:1px solid #ccc; padding:8px; text-align:center; color:#2E7D32;">${avgE}</td></tr>`;

        // ノーマル
        let myN = (u.examRecords && u.examRecords[st.id]) ? u.examRecords[st.id].toFixed(1)+'秒' : '-';
        let avgN = countNormal[st.id] > 0 ? (sumNormal[st.id]/countNormal[st.id]).toFixed(1)+'秒' : '-';
        html += `<tr><td style="border:1px solid #ccc; padding:8px;">🟢 ノーマル</td><td style="border:1px solid #ccc; padding:8px; text-align:center;">${myN}</td><td style="border:1px solid #ccc; padding:8px; text-align:center;">${avgN}</td></tr>`;
        
        // ハード
        let myH = (u.examRecords && u.examRecords[st.id+'_hard']) ? u.examRecords[st.id+'_hard'].toFixed(1)+'秒' : '-';
        let avgH = countHard[st.id] > 0 ? (sumHard[st.id]/countHard[st.id]).toFixed(1)+'秒' : '-';
        html += `<tr style="background:#fff3e0;"><td style="border:1px solid #ccc; padding:8px; color:#d84315;">🔥 ハード</td><td style="border:1px solid #ccc; padding:8px; text-align:center; color:#d84315;">${myH}</td><td style="border:1px solid #ccc; padding:8px; text-align:center; color:#d84315;">${avgH}</td></tr>`;
    });
    html += '</table>';

    document.getElementById('vision-compare-content').innerHTML = html;
    document.getElementById('vision-compare-modal').style.display = 'flex';
}

/* =========================================================
   [Vite環境用] HTMLから呼び出す関数をグローバルに登録
   ========================================================= */
// エラー回避用のダミー関数（実際の処理は後から自動で上書きされます）
function startRecommendedStage() {}

const globalFunctions =[
    toggleSFX, toggleBGM, toggleFullScreen, goToGradeSelect, loginAsMaster, openAdmin, showScreen, 
    showAdminSection, backToAdminMenu, switchDashTab, renderDashboardTable, exportDashboardCSV, 
    renderVisionDashboardTable, adminAddUser, adminBulkAddUsers, adminAddCoins, openEditProgress, 
    adminResetUser, adminForceProgress, adminDeleteUser, adminCreateMasterUser, playAsMaster, 
    insertRuby, toggleAutoRubyTool, generateAutoRuby, adminAddTextTask, saveTicketSettings, 
    closeCustomManager, openThemeCreator, openEffectCreator, saveCustomTheme, closeThemeCreator, 
    updateThemePreview, saveCustomEffect, closeEffectCreator, openCustomManager, importData, 
    exportData, goToMouseMenu, goToKeyboardCategory, goToTextMenu, goToMinigameMenu, goToVisionMenu, 
    goToWordMenu, goToRecords, handleGlobalBack, handleGlobalHome, handleGlobalLogout, submitPassword, 
    closePasswordModal, closeStampOverlay, closeRewardOverlay, startMinigame, startRecommendedStage,
    stopMinigame, toggleRubyInPrep, toggleNaviInPrep, confirmStartTextPractice, closeTextPrepModal, 
    submitTextPractice, closeTextResult, backToMenuFromText, retryExam, backToMenu, handleSecretMenuClick, 
    showRomajiMenu, renderKeyboardStages, backToKbChapter, showRecordSection, backToRecordMenu, 
    drawGacha, useTicket, changeTheme, changeEffect, showVisionCompare, openWordText, suspendWordTask, 
    confirmWordClear, updateUserGroup, deleteCustomElement, editTextTask, moveTextTask, deleteTextTask,
    saveEditProgress, speakInstruction, speakTextTask, toggleRuby, toggleNavi, processWordClear
];

globalFunctions.forEach(fn => {
    if (typeof fn === 'function') {
        window[fn.name] = fn;
    }
});