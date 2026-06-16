import {
    users,
    currentUser,
    saveUsers,
    isSystemUserId,
    canWriteCurrentUserRow,
    recordPracticeActivity,
    supabase,
    REQUIRE_SUPABASE_AUTH,
    ENABLE_RLS_CLOUD_SYNC,
    GLOBAL_SETTINGS_ID
} from '../api/user.js';
import { WORD_DATA } from '../data/constants.js';
import {
    getDynamicDChallengeWord,
    getDynamicTypingPrompt,
    getExtraTypingPrompts
} from '../data/typing-prompts.js';
import { getTypingRankingNicknameBlockWords } from '../data/typing-ranking-settings.js';
import { SoundManager } from '../utils/sound.js';
import { showScreen, showImeWarning } from '../ui/screen.js';
import { createConfetti } from '../ui/reward.js';

let mgInterval, mgSpawnInterval, mgTimeInterval, mgTime = 60, mgScore = 0, mgWords =[], mgActiveWord = null, cancelMgStartHandler = null;
let currentMinigameType = 'meteor';
let mgStartedAt = 0;
let minigameReturnScreen = 'screen-minigame-menu';

let dBoost = 1.0;
let dLevel = 1;
let dClearedWords = 0;
let dChallengeWords = { 1:[], 2:[], 3:[], 4:[] };
let dCurrentWordMissed = false;
let rankingWarningShown = false;
let lastTypingPromptByBucket = {};

let rhythmAudioContext = null;
let rhythmFrameId = null;
let rhythmCountdownTimer = null;
let rhythmStartDelayTimer = null;
let rhythmSongEndTimer = null;
let rhythmAudioStartTimer = null;
let rhythmScheduledNodes = [];
let rhythmExternalAudio = null;
let rhythmCurrentSong = null;
let rhythmLiveNotes = [];
let rhythmStartTime = 0;
let rhythmCurrentBeat = 0;
let rhythmIsPlaying = false;
let rhythmPerfectCount = 0;
let rhythmGreatCount = 0;
let rhythmGoodCount = 0;
let rhythmMissCount = 0;
let rhythmCombo = 0;
let rhythmMaxCombo = 0;
let rhythmLastFeedbackId = 0;
let rhythmSelectedSongId = null;
let rhythmCurrentDifficulty = 'normal';

const RHYTHM_NOTE_WINDOW_BEATS = 0.38;
const RHYTHM_PERFECT_WINDOW_BEATS = 0.13;
const RHYTHM_GREAT_WINDOW_BEATS = 0.24;
const RHYTHM_TARGET_X = 8;
const RHYTHM_SCROLL_SPEED = 16.5;
const RHYTHM_START_DELAY_MS = 1500;
const RHYTHM_LEAD_IN_BEATS = 2;
const RHYTHM_CUSTOM_SONGS_KEY = 'rhythmCustomSongs';

const RHYTHM_DIFFICULTIES = {
    easy: {
        label: 'イージー',
        description: '音は同じ。ノーツ少なめで合わせやすい',
        bpmMultiplier: 1,
        chartMode: 'easy',
        hitWindowBeats: 0.50,
        perfectWindowBeats: 0.18,
        greatWindowBeats: 0.32,
        scoreMultiplier: 0.85
    },
    normal: {
        label: 'ノーマル',
        description: '標準のノーツ数。いままでに近い難しさ',
        bpmMultiplier: 1,
        chartMode: 'normal',
        hitWindowBeats: RHYTHM_NOTE_WINDOW_BEATS,
        perfectWindowBeats: RHYTHM_PERFECT_WINDOW_BEATS,
        greatWindowBeats: RHYTHM_GREAT_WINDOW_BEATS,
        scoreMultiplier: 1
    },
    hard: {
        label: 'ハード',
        description: 'ノーツ多め。細かいリズムも出ます',
        bpmMultiplier: 1,
        chartMode: 'hard',
        hitWindowBeats: 0.28,
        perfectWindowBeats: 0.10,
        greatWindowBeats: 0.19,
        scoreMultiplier: 1.18
    }
};

const RHYTHM_LANES = [
    { id: 0, name: 'たいこ', emoji: '🥁', soundType: 'drum' }
];


const TYPING_RANKING_TABLE = 'lesson_typing_rankings';
const TYPING_RANKING_TOP_LIMIT = 5;
const NICKNAME_MAX_LENGTH = 10;
const EXTRA_TYPING_PROMPTS = getExtraTypingPrompts();
const EXTERNAL_WINDOW_FEATURES = 'popup=yes,width=1180,height=820,menubar=no,toolbar=no,location=yes,status=no,scrollbars=yes,resizable=yes';

const EXTERNAL_TYPING_SITES = {
    sushida: {
        title: '寿司打',
        url: 'https://sushida.net/'
    },
    pop: {
        title: 'Popタイピング',
        url: 'https://keyx0.net/pop/'
    }
};

const FREE_TIME_SITES = {
    youtube: {
        title: 'YouTube',
        url: 'https://www.youtube.com/'
    },
    poki: {
        title: 'Poki',
        url: 'https://poki.com/'
    }
};

function formatLogTime(date) {
    return date.toLocaleTimeString('ja-JP', {
        hour: '2-digit',
        minute: '2-digit'
    });
}

function recordExternalLog(site, options, detail, amount) {
    if (!canWriteCurrentUserRow()) return;
    recordPracticeActivity({
        category: options.category,
        title: `${options.titlePrefix} ${site.title}`,
        detail,
        amount,
        coins: 0
    });
    saveUsers(false);
}

function openTrackedExternalSite(site, options) {
    if (!site) return;

    const openedAt = new Date();
    const popup = window.open('about:blank', '_blank', EXTERNAL_WINDOW_FEATURES);
    if (!popup) {
        alert('外部サイトを開けませんでした。ブラウザのポップアップ許可を確認してください。');
        return;
    }

    popup.opener = null;
    popup.location.href = site.url;
    recordExternalLog(site, options, '開始', `開始 ${formatLogTime(openedAt)}`);

    const closeCheck = setInterval(() => {
        if (!popup.closed) return;
        clearInterval(closeCheck);
        const closedAt = new Date();
        const elapsedMinutes = Math.max(0, Math.round((closedAt.getTime() - openedAt.getTime()) / 60000));
        recordExternalLog(site, options, '終了', `開始 ${formatLogTime(openedAt)} / 終了 ${formatLogTime(closedAt)} / 約${elapsedMinutes}分`);
    }, 2000);
}

function getCurrentMinigameModeKey() {
    if (currentMinigameType === 'rhythm') return 'rhythm';
    return currentMinigameType === 'd_challenge' ? 'd_challenge' : 'meteor';
}

function getCurrentMinigameTitle() {
    if (currentMinigameType === 'rhythm') {
        return rhythmCurrentSong
            ? `リズムゲーム ${rhythmCurrentSong.title} ${getRhythmDifficultyConfig().label}`
            : 'ぽんぽんリズム';
    }
    return currentMinigameType === 'd_challenge' ? 'Dチャレンジ' : 'タイピングゲーム';
}

function getCurrentMinigameActivityCategory() {
    return currentMinigameType === 'rhythm' ? 'free-time' : 'minigame';
}

function getCurrentMinigameActivityTitle() {
    return currentMinigameType === 'rhythm' ? `じゆうじかん ${getCurrentMinigameTitle()}` : getCurrentMinigameTitle();
}

function canUseCloudTypingRanking() {
    return Boolean(supabase && REQUIRE_SUPABASE_AUTH && ENABLE_RLS_CLOUD_SYNC);
}

function getAnonymousRankingLabel(userId) {
    const text = String(userId || '');
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
        hash = (hash * 31 + text.charCodeAt(i)) % 997;
    }
    return `児童 ${String(hash + 1).padStart(3, '0')}`;
}

function getMinigameTitleByMode(modeKey) {
    return modeKey === 'd_challenge' ? 'Dチャレンジ' : 'メテオタイピング';
}

function normalizeRankingMode(modeKey) {
    return modeKey === 'd_challenge' ? 'd_challenge' : 'meteor';
}

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function normalizeNicknameInput(value) {
    return String(value || '').trim().replace(/\s+/g, ' ');
}

function compactForNicknameSafety(value) {
    return normalizeNicknameInput(value)
        .normalize('NFKC')
        .toLowerCase()
        .replace(/[\s　]+/g, '');
}

function getNicknameBlockWords() {
    return getTypingRankingNicknameBlockWords(users[GLOBAL_SETTINGS_ID] || {});
}

function isAnonymousRankingLabel(label, userId) {
    return compactForNicknameSafety(label) === compactForNicknameSafety(getAnonymousRankingLabel(userId));
}

function validateRankingNickname(rawNickname, userId = currentUser) {
    const nickname = normalizeNicknameInput(rawNickname);
    const compactNickname = compactForNicknameSafety(nickname);
    const compactUserId = compactForNicknameSafety(userId);

    if (!nickname) return { ok: false, message: 'ニックネームを入力してください。' };
    if (Array.from(nickname).length > NICKNAME_MAX_LENGTH) {
        return { ok: false, message: `ニックネームは${NICKNAME_MAX_LENGTH}文字までです。` };
    }
    if (!/^[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}\p{Letter}\p{Number}ーｰ・\s_-]+$/u.test(nickname)) {
        return { ok: false, message: '記号、絵文字、URLは使えません。' };
    }
    if (/@|https?:\/\/|www\.|[0-9０-９]{4,}/i.test(nickname)) {
        return { ok: false, message: 'メールアドレス、URL、電話番号のような文字は使えません。' };
    }
    if (getNicknameBlockWords().some(word => compactNickname.includes(compactForNicknameSafety(word)))) {
        return { ok: false, message: 'その言葉はニックネームに使えません。' };
    }
    if (
        compactUserId
        && compactNickname.length >= 2
        && compactUserId.includes(compactNickname)
        && !isAnonymousRankingLabel(nickname, userId)
    ) {
        return { ok: false, message: '実名や名字は使わず、別のニックネームにしてください。' };
    }

    return { ok: true, nickname };
}

function getVisibleRankingLabel(userId, rawDisplayLabel) {
    const anonymousLabel = getAnonymousRankingLabel(userId);
    const displayLabel = normalizeNicknameInput(rawDisplayLabel) || anonymousLabel;
    const validation = validateRankingNickname(displayLabel, userId);
    const safeLabel = validation.ok ? displayLabel : anonymousLabel;

    if (userId === currentUser) {
        return isAnonymousRankingLabel(safeLabel, userId) ? '自分' : `${safeLabel}（自分）`;
    }
    return safeLabel;
}

function getEditableNickname(row) {
    const label = normalizeNicknameInput(row?.displayLabel);
    if (!row || !label || isAnonymousRankingLabel(label, row.id)) return '';
    return validateRankingNickname(label, row.id).ok ? label : '';
}

function getLocalMinigameRanking(modeKey) {
    const ranking =[];
    Object.keys(users).forEach(userId => {
        const user = users[userId];
        if (!user || user.isMaster || isSystemUserId(userId)) return;
        const score = modeKey === 'd_challenge'
            ? (user.examRecords?.mg_d_challenge || user.dChallengeHighscore || 0)
            : (user.examRecords?.mg_meteor || user.minigameHighscore || 0);
        if (score > 0) ranking.push({
            id: userId,
            label: userId === currentUser ? '自分' : getAnonymousRankingLabel(userId),
            score
        });
    });
    return ranking.sort((a, b) => b.score - a.score);
}

function dedupeRankingRows(rows) {
    const byUser = new Map();

    (rows || []).forEach(row => {
        const userId = row?.id || row?.user_data_id;
        if (!userId) return;
        const score = Number(row?.score || 0);
        const existing = byUser.get(userId);
        const isBetter = !existing
            || score > existing.score
            || (score === existing.score && String(row?.updatedAt || row?.updated_at || '') < String(existing.updatedAt || ''));
        if (!isBetter) return;

        byUser.set(userId, {
            id: userId,
            label: row.label ?? getVisibleRankingLabel(userId, row.displayLabel ?? row.display_label),
            displayLabel: normalizeNicknameInput(row.displayLabel ?? row.display_label) || getAnonymousRankingLabel(userId),
            score,
            updatedAt: row.updatedAt ?? row.updated_at
        });
    });

    return Array.from(byUser.values()).sort((a, b) => (
        b.score - a.score || String(a.updatedAt || '').localeCompare(String(b.updatedAt || ''))
    ));
}

function renderTypingRankingBoard(rankBoard, ranking, options = {}) {
    if (!rankBoard) return;

    const modeKey = normalizeRankingMode(options.modeKey || getCurrentMinigameModeKey());
    const context = options.context || 'result';
    const sourceLabel = options.sourceLabel || 'ランキング';
    const topRows = ranking.slice(0, TYPING_RANKING_TOP_LIMIT);
    const myRankIdx = ranking.findIndex(row => row.id === currentUser);
    const showNicknameForm = Boolean(
        options.allowNickname
        && canUseCloudTypingRanking()
        && myRankIdx >= 0
        && myRankIdx < TYPING_RANKING_TOP_LIMIT
    );
    const currentRow = myRankIdx >= 0 ? ranking[myRankIdx] : null;
    const inputId = `typing-ranking-nickname-${context}`;
    const messageId = `typing-ranking-message-${context}`;
    const statusHtml = options.status
        ? `<div class="typing-ranking-status">${escapeHtml(options.status)}</div>`
        : '';

    let rankHtml = `<h3 class="typing-ranking-title">${escapeHtml(sourceLabel)}</h3>${statusHtml}`;

    if (topRows.length === 0) {
        rankHtml += '<div class="typing-ranking-empty">まだランキング記録がありません。</div>';
    } else {
        rankHtml += '<ol class="typing-ranking-list">';
        topRows.forEach((row, index) => {
            const medal = ['🥇', '🥈', '🥉', '4.', '5.'][index];
            const isMe = row.id === currentUser ? ' is-me' : '';
            rankHtml += `
                <li class="typing-ranking-row${isMe}">
                    <span class="typing-ranking-rank">${escapeHtml(medal)}</span>
                    <span class="typing-ranking-name">${escapeHtml(row.label)}</span>
                    <span class="typing-ranking-score">${escapeHtml(row.score)} 点</span>
                </li>
            `;
        });
        rankHtml += '</ol>';
    }

    const myRankText = myRankIdx !== -1 ? `あなたの順位： ${myRankIdx + 1} 位` : 'あなたの順位： ランク外';
    rankHtml += `<div class="typing-ranking-my-rank">${escapeHtml(myRankText)}</div>`;

    if (options.isNewRecord) {
        rankHtml += '<div class="typing-ranking-new-record">★しんきろく 達成！★</div>';
    }

    if (showNicknameForm) {
        rankHtml += `
            <div class="typing-ranking-nickname-panel">
                <div class="typing-ranking-nickname-title">上位5位に入りました。ニックネームを登録できます。</div>
                <div class="typing-ranking-warning">実名、名字、学校名、人を傷つける言葉、電話番号やメールアドレスは使わないでください。</div>
                <div class="typing-ranking-nickname-form">
                    <input id="${inputId}" type="text" maxlength="${NICKNAME_MAX_LENGTH}" value="${escapeHtml(getEditableNickname(currentRow))}" placeholder="ニックネーム">
                    <button class="btn-primary typing-ranking-save-btn" onclick="saveTypingRankingNickname('${modeKey}', '${context}')">登録</button>
                </div>
                <div id="${messageId}" class="typing-ranking-message">${escapeHtml(options.nicknameMessage || '')}</div>
            </div>
        `;
    }

    rankBoard.classList.add('typing-ranking-board');
    rankBoard.innerHTML = rankHtml;
    rankBoard.style.display = 'block';
}

function renderMinigameRanking(ranking, options = {}) {
    renderTypingRankingBoard(document.getElementById('mg-ranking-board'), ranking, {
        ...options,
        context: 'result'
    });
}

async function saveCloudMinigameRanking(modeKey, score) {
    if (!canUseCloudTypingRanking() || !currentUser || score <= 0) return false;
    const { data: existing, error: readError } = await supabase
        .from(TYPING_RANKING_TABLE)
        .select('score,display_label')
        .eq('mode', modeKey)
        .eq('user_data_id', currentUser)
        .order('score', { ascending: false })
        .order('updated_at', { ascending: true })
        .limit(1)
        .maybeSingle();

    if (readError) throw readError;
    if (Number(existing?.score || 0) >= score) return true;

    const existingLabel = normalizeNicknameInput(existing?.display_label);
    const safeExistingLabel = existingLabel && validateRankingNickname(existingLabel, currentUser).ok
        ? existingLabel
        : '';

    const { error } = await supabase
        .from(TYPING_RANKING_TABLE)
        .upsert({
            mode: modeKey,
            user_data_id: currentUser,
            display_label: safeExistingLabel || getAnonymousRankingLabel(currentUser),
            score,
            updated_at: new Date().toISOString()
        }, { onConflict: 'mode,user_data_id' });

    if (error) throw error;
    return true;
}

async function loadCloudMinigameRanking(modeKey) {
    if (!canUseCloudTypingRanking()) return null;
    const { data, error } = await supabase
        .from(TYPING_RANKING_TABLE)
        .select('user_data_id,display_label,score,updated_at')
        .eq('mode', modeKey)
        .order('score', { ascending: false })
        .order('updated_at', { ascending: true })
        .limit(50);

    if (error) throw error;
    return dedupeRankingRows((data || []).map(row => ({
        id: row.user_data_id,
        label: getVisibleRankingLabel(row.user_data_id, row.display_label),
        displayLabel: normalizeNicknameInput(row.display_label) || getAnonymousRankingLabel(row.user_data_id),
        score: Number(row.score || 0),
        updatedAt: row.updated_at
    })));
}

async function refreshCloudMinigameRanking(modeKey, score, isNewRecord) {
    try {
        await saveCloudMinigameRanking(modeKey, score);
        const cloudRanking = await loadCloudMinigameRanking(modeKey);
        if (cloudRanking) {
            renderMinigameRanking(cloudRanking, {
                sourceLabel: 'クラス匿名ランキング',
                status: '名前は表示せず、匿名ラベルとスコアだけを表示しています。',
                isNewRecord,
                allowNickname: true,
                modeKey
            });
        }
    } catch (err) {
        if (!rankingWarningShown) {
            console.warn('Typing ranking table is unavailable. Falling back to local ranking:', err);
            rankingWarningShown = true;
        }
        const localRanking = getLocalMinigameRanking(modeKey);
        renderMinigameRanking(localRanking, {
            sourceLabel: 'この端末のランキング',
            status: '匿名ランキングテーブル未設定のため、この画面で読める範囲だけ表示しています。',
            isNewRecord
        });
    }
}

async function updateCloudTypingRankingNickname(modeKey, nickname) {
    const { error } = await supabase
        .from(TYPING_RANKING_TABLE)
        .update({
            display_label: nickname,
            updated_at: new Date().toISOString()
        })
        .eq('mode', normalizeRankingMode(modeKey))
        .eq('user_data_id', currentUser);

    if (error) throw error;
}

function setNicknameMessage(context, message, isError = false) {
    const messageEl = document.getElementById(`typing-ranking-message-${context}`);
    if (!messageEl) return;
    messageEl.textContent = message;
    messageEl.classList.toggle('is-error', isError);
}

async function loadRankingForView(modeKey) {
    const mode = normalizeRankingMode(modeKey);
    if (canUseCloudTypingRanking()) {
        const cloudRanking = await loadCloudMinigameRanking(mode);
        if (cloudRanking) {
            return {
                ranking: cloudRanking,
                sourceLabel: 'クラス匿名ランキング',
                status: '公開用ランキングです。実名ではなく、匿名ラベルまたはニックネームで表示します。',
                allowNickname: true
            };
        }
    }

    return {
        ranking: getLocalMinigameRanking(mode),
        sourceLabel: 'この端末のランキング',
        status: 'クラウドランキング未設定のため、この画面で読める範囲だけ表示しています。',
        allowNickname: false
    };
}

export async function openTypingRankingPage(modeKey = 'meteor', nicknameMessage = '') {
    const mode = normalizeRankingMode(modeKey);
    showScreen('screen-typing-ranking');

    const titleEl = document.getElementById('typing-ranking-mode-title');
    const board = document.getElementById('typing-ranking-page-board');
    document.querySelectorAll('[data-ranking-mode]').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.rankingMode === mode);
    });
    if (titleEl) titleEl.textContent = `${getMinigameTitleByMode(mode)} ランキング`;
    if (board) {
        board.style.display = 'block';
        board.innerHTML = '<div class="typing-ranking-loading">ランキングを読み込み中...</div>';
    }

    try {
        const view = await loadRankingForView(mode);
        renderTypingRankingBoard(board, view.ranking, {
            modeKey: mode,
            context: 'page',
            sourceLabel: view.sourceLabel,
            status: view.status,
            allowNickname: view.allowNickname,
            nicknameMessage
        });
    } catch (err) {
        console.warn('Typing ranking page failed:', err);
        renderTypingRankingBoard(board, getLocalMinigameRanking(mode), {
            modeKey: mode,
            context: 'page',
            sourceLabel: 'この端末のランキング',
            status: 'クラウドランキングを読み込めませんでした。時間をおいてもう一度確認してください。',
            allowNickname: false
        });
    }
}

export async function saveTypingRankingNickname(modeKey = 'meteor', context = 'page') {
    if (!canUseCloudTypingRanking() || !currentUser) {
        setNicknameMessage(context, 'クラウドランキング利用時だけ登録できます。', true);
        return;
    }

    const input = document.getElementById(`typing-ranking-nickname-${context}`);
    const validation = validateRankingNickname(input?.value || '', currentUser);
    if (!validation.ok) {
        setNicknameMessage(context, validation.message, true);
        return;
    }

    try {
        setNicknameMessage(context, '保存中です...');
        await updateCloudTypingRankingNickname(modeKey, validation.nickname);
        if (context === 'page') {
            await openTypingRankingPage(modeKey, 'ニックネームを保存しました。');
        } else {
            const cloudRanking = await loadCloudMinigameRanking(normalizeRankingMode(modeKey));
            renderMinigameRanking(cloudRanking || [], {
                modeKey,
                sourceLabel: 'クラス匿名ランキング',
                status: '名前は表示せず、匿名ラベルとスコアだけを表示しています。',
                allowNickname: true,
                nicknameMessage: 'ニックネームを保存しました。'
            });
        }
    } catch (err) {
        console.warn('Typing ranking nickname update failed:', err);
        setNicknameMessage(context, '保存できませんでした。言葉を変えるか、時間をおいてもう一度ためしてください。', true);
    }
}

export function openExternalTypingSite(siteId) {
    const site = EXTERNAL_TYPING_SITES[siteId];
    openTrackedExternalSite(site, {
        category: 'external-typing',
        titlePrefix: '外部タイピング'
    });
}

export function openFreeTimeSite(siteId) {
    const site = FREE_TIME_SITES[siteId];
    openTrackedExternalSite(site, {
        category: 'free-time',
        titlePrefix: 'じゆうじかん'
    });
}

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
    EXTRA_TYPING_PROMPTS.forEach(addWord);
}

function getTypingPromptKey(wordData) {
    return String(wordData?.h || wordData?.r?.[0] || '');
}

function pickNonRepeatingTypingPrompt(bucket, picker, maxAttempts = 10) {
    let candidate = null;
    for (let i = 0; i < maxAttempts; i++) {
        candidate = picker();
        const key = getTypingPromptKey(candidate);
        if (!key || key !== lastTypingPromptByBucket[bucket]) break;
    }

    const key = getTypingPromptKey(candidate);
    if (key) lastTypingPromptByBucket[bucket] = key;
    return candidate;
}

function pickDChallengeWord(level) {
    if (Math.random() < 0.45) return getDynamicDChallengeWord(level);
    const list = dChallengeWords[level] || dChallengeWords[1];
    return list[Math.floor(Math.random() * list.length)];
}

function getDChallengeWord(level) {
    return pickNonRepeatingTypingPrompt(`d_challenge_${level}`, () => pickDChallengeWord(level));
}

function pickRandomMinigameWord() {
    if (Math.random() < 0.55) return getDynamicTypingPrompt();
    if (Math.random() < 0.35) return EXTRA_TYPING_PROMPTS[Math.floor(Math.random() * EXTRA_TYPING_PROMPTS.length)];
    const group = WORD_DATA[Math.floor(Math.random() * WORD_DATA.length)];
    return group.chars[Math.floor(Math.random() * group.chars.length)];
}

function getRandomMinigameWord() {
    return pickNonRepeatingTypingPrompt('meteor', pickRandomMinigameWord);
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

function getRhythmAudioContext() {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return null;
    if (!rhythmAudioContext) rhythmAudioContext = new AudioContextClass();
    if (rhythmAudioContext.state === 'suspended') {
        void rhythmAudioContext.resume();
    }
    return rhythmAudioContext;
}

function createRhythmGain(ctx, startAt, gainValue, duration, attack = 0.01) {
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, startAt);
    gain.gain.linearRampToValueAtTime(gainValue, startAt + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);
    return gain;
}

function playRhythmOscillator({
    frequency,
    startAt,
    duration,
    type = 'sine',
    gainValue = 0.08,
    attack = 0.01,
    frequencyEnd = null
}) {
    const ctx = getRhythmAudioContext();
    if (!ctx) return;

    const oscillator = ctx.createOscillator();
    const gain = createRhythmGain(ctx, startAt, gainValue, duration, attack);
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, startAt);
    if (frequencyEnd) {
        oscillator.frequency.exponentialRampToValueAtTime(frequencyEnd, startAt + duration);
    }
    oscillator.connect(gain);
    gain.connect(ctx.destination);
    oscillator.start(startAt);
    oscillator.stop(startAt + duration + 0.02);
}

function playRhythmNoise(startAt, duration, gainValue, filterType, frequency) {
    const ctx = getRhythmAudioContext();
    if (!ctx) return;

    const bufferSize = Math.max(1, Math.floor(ctx.sampleRate * duration));
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
    }

    const source = ctx.createBufferSource();
    const filter = ctx.createBiquadFilter();
    const gain = createRhythmGain(ctx, startAt, gainValue, duration, 0.004);
    source.buffer = buffer;
    filter.type = filterType;
    filter.frequency.setValueAtTime(frequency, startAt);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    source.start(startAt);
}

function playRhythmKick(startAt) {
    playRhythmOscillator({
        frequency: 150,
        frequencyEnd: 50,
        startAt,
        duration: 0.18,
        type: 'sine',
        gainValue: 0.18,
        attack: 0.002
    });
}

function playRhythmMelody(frequency, startAt, gainValue = 0.075) {
    playRhythmOscillator({
        frequency,
        startAt,
        duration: 0.24,
        type: 'sine',
        gainValue,
        attack: 0.01
    });
}

function playRhythmMissSound() {
    const ctx = getRhythmAudioContext();
    if (!ctx) return;
    const startAt = ctx.currentTime + 0.005;
    playRhythmOscillator({
        frequency: 160,
        frequencyEnd: 80,
        startAt,
        duration: 0.2,
        type: 'sawtooth',
        gainValue: 0.09,
        attack: 0.004
    });
}

function stopRhythmScheduledAudio() {
    rhythmScheduledNodes.forEach((node) => {
        try {
            node.stop();
        } catch {
            // Already stopped.
        }
    });
    rhythmScheduledNodes = [];
}

function stopRhythmExternalAudio() {
    if (rhythmAudioStartTimer) {
        clearTimeout(rhythmAudioStartTimer);
        rhythmAudioStartTimer = null;
    }
    if (!rhythmExternalAudio) return;
    try {
        rhythmExternalAudio.pause();
        rhythmExternalAudio.currentTime = 0;
    } catch {
        // The audio element may be in a browser-controlled state.
    }
    rhythmExternalAudio = null;
}

function getRhythmNoteFrequency(noteName) {
    const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const match = /^([A-G]#?)([0-9])$/.exec(noteName);
    if (!match) return 440;
    const noteIndex = notes.indexOf(match[1]);
    const octave = Number(match[2]);
    const midi = 12 * (octave + 1) + noteIndex;
    return 440 * Math.pow(2, (midi - 69) / 12);
}

function scheduleRhythmMelody(song, delaySeconds = 0) {
    const ctx = getRhythmAudioContext();
    if (!ctx || !song) return;
    if (song.audioUrl) return;

    stopRhythmScheduledAudio();
    const beatSeconds = 60 / song.bpm;
    const audioStart = ctx.currentTime + delaySeconds + 0.08;
    (song.melody || []).forEach(([noteName, durationBeats, beat]) => {
        const frequency = getRhythmNoteFrequency(noteName);
        const startAt = audioStart + beat * beatSeconds;
        const duration = Math.max(0.08, durationBeats * beatSeconds * 0.9);
        const oscillator = ctx.createOscillator();
        const gain = createRhythmGain(ctx, startAt, 0.06, duration, 0.015);
        oscillator.type = 'triangle';
        oscillator.frequency.setValueAtTime(frequency, startAt);
        oscillator.connect(gain);
        gain.connect(ctx.destination);
        oscillator.start(startAt);
        oscillator.stop(startAt + duration + 0.02);
        rhythmScheduledNodes.push(oscillator);
    });
}

function playRhythmInstrument(soundType) {
    const ctx = getRhythmAudioContext();
    if (!ctx) return;
    const startAt = ctx.currentTime + 0.005;
    if (soundType === 'drum') {
        playRhythmKick(startAt);
        return;
    }
    if (soundType === 'bell') {
        playRhythmMelody(987.77, startAt, 0.1);
        playRhythmMelody(1975.54, startAt + 0.02, 0.045);
        return;
    }
    if (soundType === 'frog') {
        playRhythmMelody(261.63, startAt, 0.09);
        playRhythmMelody(329.63, startAt + 0.08, 0.055);
        return;
    }
    playRhythmKick(startAt);
}

function playRhythmUiSound(kind = 'click') {
    const ctx = getRhythmAudioContext();
    if (!ctx) return;
    const startAt = ctx.currentTime + 0.005;
    if (kind === 'success') {
        playRhythmMelody(523.25, startAt, 0.08);
        playRhythmMelody(659.25, startAt + 0.08, 0.08);
        playRhythmMelody(783.99, startAt + 0.16, 0.08);
        return;
    }
    playRhythmMelody(600, startAt, 0.04);
}

function stopRhythmRuntime() {
    document.removeEventListener('keydown', mgHandleKey);
    if (rhythmFrameId) {
        cancelAnimationFrame(rhythmFrameId);
        rhythmFrameId = null;
    }
    if (rhythmCountdownTimer) {
        clearInterval(rhythmCountdownTimer);
        rhythmCountdownTimer = null;
    }
    if (rhythmStartDelayTimer) {
        clearTimeout(rhythmStartDelayTimer);
        rhythmStartDelayTimer = null;
    }
    if (rhythmSongEndTimer) {
        clearTimeout(rhythmSongEndTimer);
        rhythmSongEndTimer = null;
    }
    rhythmIsPlaying = false;
    stopRhythmScheduledAudio();
    stopRhythmExternalAudio();
}

function resetRhythmState() {
    stopRhythmRuntime();
    rhythmCurrentSong = null;
    rhythmLiveNotes = [];
    rhythmStartTime = 0;
    rhythmCurrentBeat = 0;
    rhythmPerfectCount = 0;
    rhythmGreatCount = 0;
    rhythmGoodCount = 0;
    rhythmMissCount = 0;
    rhythmCombo = 0;
    rhythmMaxCombo = 0;
    rhythmLastFeedbackId = 0;
    rhythmSelectedSongId = null;
    rhythmCurrentDifficulty = 'normal';
    mgScore = 0;
}

function getRhythmDifficultyConfig(difficultyKey = rhythmCurrentDifficulty) {
    return RHYTHM_DIFFICULTIES[difficultyKey] || RHYTHM_DIFFICULTIES.normal;
}

function getRhythmCustomSongSettings() {
    const songs = users?.[GLOBAL_SETTINGS_ID]?.[RHYTHM_CUSTOM_SONGS_KEY];
    return Array.isArray(songs) ? songs : [];
}

function normalizeRhythmCustomSongForMenu(song) {
    if (!song || typeof song !== 'object') return null;
    const id = String(song.id || '').trim();
    const title = String(song.title || '').trim();
    const audioUrl = String(song.audioUrl || '').trim();
    if (!id || !title || !audioUrl || song.visible === false) return null;
    const bpm = Math.max(40, Math.min(240, Number(song.bpm) || 100));
    const charts = song.charts && typeof song.charts === 'object' ? song.charts : {};
    const durationSeconds = Math.max(0, Number(song.durationSeconds) || 0);
    const durationBeats = durationSeconds > 0 ? durationSeconds * bpm / 60 : 0;
    return {
        id,
        title,
        emoji: song.emoji || '🎵',
        bpm,
        difficulty: song.difficulty || '管理者作成',
        description: song.description || '先生が追加したリズム曲です。',
        audioUrl,
        storageBucket: song.storageBucket || '',
        storagePath: song.storagePath || '',
        charts,
        durationSeconds,
        durationBeats,
        melody: [],
        notes: []
    };
}

function getAllRhythmSongs() {
    const customSongs = getRhythmCustomSongSettings()
        .map(normalizeRhythmCustomSongForMenu)
        .filter(Boolean);
    return customSongs;
}

function getDefaultRhythmSongId() {
    return getAllRhythmSongs()[0]?.id || '';
}

function getRhythmBaseSong(songId) {
    const songs = getAllRhythmSongs();
    return songs.find(song => song.id === songId) || songs[0] || null;
}

function getRhythmBaseBeats(notes) {
    const beats = notes
        .map(note => Number(note[0]))
        .filter(beat => Number.isFinite(beat));
    return [...new Set(beats)].sort((a, b) => a - b);
}

function addRhythmBeatIfSpaced(beats, beat, minGap = 0.38) {
    if (!Number.isFinite(beat)) return;
    const rounded = Math.round(beat * 1000) / 1000;
    if (beats.some(existing => Math.abs(existing - rounded) < minGap)) return;
    beats.push(rounded);
}

function buildEasyRhythmBeats(baseBeats) {
    const easyBeats = [];
    baseBeats.forEach((beat, index) => {
        const isFirst = index === 0;
        const isLast = index === baseBeats.length - 1;
        const farEnough = easyBeats.length === 0 || beat - easyBeats[easyBeats.length - 1] >= 1.45;
        if (isFirst || isLast || farEnough) easyBeats.push(beat);
    });

    if (easyBeats.length >= 8 || baseBeats.length <= 8) return easyBeats;
    return baseBeats.filter((_, index) => index % 2 === 0);
}

function buildHardRhythmBeats(baseBeats) {
    const hardBeats = [...baseBeats];
    baseBeats.forEach((beat, index) => {
        const nextBeat = baseBeats[index + 1];
        if (!Number.isFinite(nextBeat)) return;
        const gap = nextBeat - beat;
        if (gap >= 2.8) {
            addRhythmBeatIfSpaced(hardBeats, beat + 1);
            addRhythmBeatIfSpaced(hardBeats, nextBeat - 1);
        } else if (gap >= 1.35) {
            addRhythmBeatIfSpaced(hardBeats, beat + gap / 2);
        } else if (gap >= 0.95 && index % 4 === 1) {
            addRhythmBeatIfSpaced(hardBeats, beat + 0.5, 0.34);
        }
    });
    return hardBeats.sort((a, b) => a - b);
}

function buildRhythmChartNotes(song, config, difficultyKey) {
    const customChart = Array.isArray(song?.charts?.[difficultyKey]) ? song.charts[difficultyKey] : null;
    if (customChart && customChart.length > 0) {
        return customChart
            .map((note, index) => {
                const beat = Array.isArray(note)
                    ? Number(note[0])
                    : Number(note.beat ?? (Number(note.timeMs) / 1000) * (Number(song.bpm) || 100) / 60);
                if (!Number.isFinite(beat)) return null;
                return {
                    id: `${song.id}-${difficultyKey}-${index}-${Math.round(beat * 1000)}`,
                    beat,
                    laneId: 0,
                    hit: false,
                    miss: false,
                    result: ''
                };
            })
            .filter(Boolean)
            .sort((a, b) => a.beat - b.beat);
    }

    const baseBeats = getRhythmBaseBeats(song.notes || []);
    let beats = baseBeats;
    if (config.chartMode === 'easy') beats = buildEasyRhythmBeats(baseBeats);
    if (config.chartMode === 'hard') beats = buildHardRhythmBeats(baseBeats);
    return beats.map((beat, index) => ({
        id: `${song.id}-${difficultyKey}-${index}-${beat}`,
        beat,
        laneId: 0,
        hit: false,
        miss: false,
        result: ''
    }));
}

function normalizeRhythmSong(song, difficultyKey = rhythmCurrentDifficulty) {
    const config = getRhythmDifficultyConfig(difficultyKey);
    const chartNotes = buildRhythmChartNotes(song, config, difficultyKey);
    const noteBeats = chartNotes.map(note => note.beat);
    const melodyEndBeats = (song.melody || []).map(note => Number(note[2]) + Number(note[1])).filter(Number.isFinite);
    const durationBeats = Number(song.durationBeats) || 0;
    const totalBeats = Math.max(4, durationBeats, ...noteBeats, ...melodyEndBeats) + 3;
    const baseBpm = Math.max(40, Math.min(240, Number(song.bpm) || 100));
    return {
        ...song,
        baseBpm,
        bpm: Math.round(baseBpm * config.bpmMultiplier),
        playDifficultyKey: difficultyKey,
        playDifficultyLabel: config.label,
        totalBeats,
        notes: chartNotes
    };
}

function getRhythmSong(songId, difficultyKey = rhythmCurrentDifficulty) {
    const baseSong = getRhythmBaseSong(songId);
    return baseSong ? normalizeRhythmSong(baseSong, difficultyKey) : null;
}

function getRhythmSongDuration(song) {
    if (!song) return 0;
    return song.totalBeats * (60 / song.bpm);
}

function getRhythmLeadInSeconds(song) {
    if (!song) return 0;
    return RHYTHM_LEAD_IN_BEATS * (60 / song.bpm);
}

function getRhythmTotalDuration(song) {
    return getRhythmLeadInSeconds(song) + getRhythmSongDuration(song);
}

function setupRhythmGameArea() {
    resetRhythmState();
    mgTime = 0;
    updateMgHud();
    const mgArea = document.getElementById('minigame-area');
    const songs = getAllRhythmSongs();
    if (!songs.length) {
        mgArea.innerHTML = `
            <div class="rhythm-song-menu">
                <div class="rhythm-song-empty">
                    <strong>リズム曲がまだありません</strong>
                    <span>管理者メニューの「リズム曲の作成」から曲を追加してください。</span>
                </div>
            </div>
        `;
        return;
    }
    mgArea.innerHTML = `
        <div class="rhythm-song-menu">
            <div class="rhythm-song-hero">
                <div class="rhythm-song-eyebrow">ぽんぽんリズム</div>
                <h2>曲をえらんで、むずかしさを決めよう</h2>
                <p>マークが左のたいこに重なったら、F・J・スペース、またはクリックでポン。</p>
            </div>
            <div class="rhythm-song-grid">
                ${songs.map(song => `
                    <button class="rhythm-song-card rhythm-song-card-${song.id}" type="button" data-rhythm-song="${song.id}">
                        <span class="rhythm-song-emoji">${song.emoji}</span>
                        <span class="rhythm-song-title">${escapeHtml(song.title)}</span>
                        <span class="rhythm-song-meta">おすすめ: ${escapeHtml(song.difficulty)}</span>
                        <span class="rhythm-song-desc">${escapeHtml(song.description)}</span>
                        <span class="rhythm-song-play">むずかしさをえらぶ</span>
                    </button>
                `).join('')}
            </div>
        </div>
    `;
    mgArea.querySelectorAll('[data-rhythm-song]').forEach(button => {
        button.addEventListener('click', () => showRhythmDifficultySelect(button.dataset.rhythmSong));
    });
}

function showRhythmDifficultySelect(songId) {
    stopRhythmRuntime();
    const baseSong = getRhythmBaseSong(songId);
    if (!baseSong) {
        setupRhythmGameArea();
        return;
    }
    rhythmSelectedSongId = baseSong.id;
    mgScore = 0;
    mgTime = 0;
    updateMgHud();
    const mgArea = document.getElementById('minigame-area');
    if (!mgArea) return;

    mgArea.innerHTML = `
        <div class="rhythm-difficulty-menu">
            <div class="rhythm-difficulty-hero">
                <button class="rhythm-board-back" type="button" id="rhythm-back-to-songs">曲をえらびなおす</button>
                <div class="rhythm-difficulty-song">
                    <span>${baseSong.emoji}</span>
                    <strong>${escapeHtml(baseSong.title)}</strong>
                    <small>${escapeHtml(baseSong.description)}</small>
                </div>
            </div>
            <div class="rhythm-difficulty-grid">
                ${Object.entries(RHYTHM_DIFFICULTIES).map(([key, config]) => {
                    const previewSong = normalizeRhythmSong(baseSong, key);
                    return `
                        <button class="rhythm-difficulty-card rhythm-difficulty-${key}" type="button" data-rhythm-difficulty="${key}">
                            <span class="rhythm-difficulty-label">${escapeHtml(config.label)}</span>
                            <span class="rhythm-difficulty-desc">${escapeHtml(config.description)}</span>
                            <span class="rhythm-difficulty-bpm">${previewSong.notes.length}こ</span>
                        </button>
                    `;
                }).join('')}
            </div>
        </div>
    `;

    document.getElementById('rhythm-back-to-songs')?.addEventListener('click', setupRhythmGameArea);
    mgArea.querySelectorAll('[data-rhythm-difficulty]').forEach(button => {
        button.addEventListener('click', () => startRhythmSong(baseSong.id, button.dataset.rhythmDifficulty));
    });
}

function renderRhythmBoard() {
    const mgArea = document.getElementById('minigame-area');
    const song = rhythmCurrentSong;
    if (!mgArea || !song) return;

    mgArea.innerHTML = `
        <div class="rhythm-board">
            <div class="rhythm-board-header">
                <button class="rhythm-board-back" type="button" id="rhythm-song-back">曲をえらびなおす</button>
                <div class="rhythm-song-now">
                    <span>${song.emoji}</span>
                    <strong>${escapeHtml(song.title)}</strong>
                    <small>${escapeHtml(song.playDifficultyLabel)}</small>
                </div>
                <div class="rhythm-score-pill">スコア <strong id="rhythm-score">${mgScore}</strong></div>
            </div>
            <div class="rhythm-stage" id="rhythm-stage">
                <div class="rhythm-target">
                    <button class="rhythm-target-drum" type="button" id="rhythm-hit-button">🥁</button>
                    <span class="rhythm-target-label">ここでポン</span>
                </div>
                <div class="rhythm-note-layer" id="rhythm-note-layer" aria-hidden="true"></div>
                <div class="rhythm-feedback" id="rhythm-feedback">3</div>
                <div class="rhythm-countdown" id="rhythm-countdown">3</div>
                <div class="rhythm-mascot" id="rhythm-mascot">${song.emoji}</div>
            </div>
            <div class="rhythm-bottom-panel">
                <div class="rhythm-stat">コンボ <strong id="rhythm-combo">0</strong></div>
                <div class="rhythm-stat">最高 <strong id="rhythm-max-combo">0</strong></div>
                <div class="rhythm-stat">ミス <strong id="rhythm-miss">0</strong></div>
                <div class="rhythm-hit-guide">F / J / スペース / クリック</div>
            </div>
        </div>
    `;

    document.getElementById('rhythm-song-back')?.addEventListener('click', setupRhythmGameArea);
    document.getElementById('rhythm-hit-button')?.addEventListener('click', triggerRhythmHitAction);
    document.getElementById('rhythm-stage')?.addEventListener('pointerdown', (event) => {
        if (event.target.closest('button')) return;
        triggerRhythmHitAction();
    });
}

function startRhythmSong(songId, difficultyKey = rhythmCurrentDifficulty) {
    stopRhythmRuntime();
    rhythmSelectedSongId = songId;
    rhythmCurrentDifficulty = difficultyKey;
    rhythmCurrentSong = getRhythmSong(songId, difficultyKey);
    if (!rhythmCurrentSong) {
        setupRhythmGameArea();
        return;
    }
    rhythmLiveNotes = rhythmCurrentSong.notes;
    rhythmPerfectCount = 0;
    rhythmGreatCount = 0;
    rhythmGoodCount = 0;
    rhythmMissCount = 0;
    rhythmCombo = 0;
    rhythmMaxCombo = 0;
    rhythmCurrentBeat = 0;
    mgScore = 0;
    mgStartedAt = 0;
    mgTime = Math.ceil(getRhythmTotalDuration(rhythmCurrentSong));
    updateMgHud();
    renderRhythmBoard();
    startRhythmCountdown(3);
}

function startRhythmCountdown(count) {
    const countdownEl = document.getElementById('rhythm-countdown');
    let currentCount = count;
    if (countdownEl) {
        countdownEl.style.display = 'flex';
        countdownEl.textContent = currentCount;
    }
    playRhythmUiSound('click');
    rhythmCountdownTimer = setInterval(() => {
        currentCount--;
        if (currentCount > 0) {
            if (countdownEl) countdownEl.textContent = currentCount;
            playRhythmUiSound('click');
            return;
        }

        clearInterval(rhythmCountdownTimer);
        rhythmCountdownTimer = null;
        if (countdownEl) countdownEl.textContent = 'よーい';
        playRhythmUiSound('success');
        rhythmStartDelayTimer = setTimeout(() => {
            rhythmStartDelayTimer = null;
            if (countdownEl) {
                countdownEl.textContent = 'スタート';
                setTimeout(() => {
                    if (countdownEl) countdownEl.style.display = 'none';
                }, 360);
            }
            beginRhythmSong();
        }, RHYTHM_START_DELAY_MS);
    }, 760);
}

function beginRhythmSong() {
    if (!rhythmCurrentSong) return;
    const leadInSeconds = getRhythmLeadInSeconds(rhythmCurrentSong);
    rhythmIsPlaying = true;
    rhythmStartTime = performance.now() + leadInSeconds * 1000;
    mgStartedAt = Date.now();
    document.addEventListener('keydown', mgHandleKey);
    scheduleRhythmMelody(rhythmCurrentSong, leadInSeconds);
    if (rhythmCurrentSong.audioUrl) {
        rhythmExternalAudio = new Audio(rhythmCurrentSong.audioUrl);
        rhythmExternalAudio.preload = 'auto';
        rhythmExternalAudio.currentTime = 0;
        rhythmAudioStartTimer = setTimeout(() => {
            rhythmAudioStartTimer = null;
            rhythmExternalAudio?.play().catch(error => {
                console.warn('リズム音源の再生に失敗しました:', error);
                showRhythmFeedback('音が出ません', 'wait');
            });
        }, leadInSeconds * 1000);
    }

    const duration = getRhythmTotalDuration(rhythmCurrentSong);
    mgTimeInterval = setInterval(() => {
        const elapsed = (performance.now() - rhythmStartTime) / 1000;
        mgTime = Math.max(0, Math.ceil(duration - elapsed));
        updateMgHud();
    }, 250);
    rhythmSongEndTimer = setTimeout(() => endMinigame(), duration * 1000 + 320);
    rhythmFrameId = requestAnimationFrame(tickRhythmFrame);
}

function tickRhythmFrame() {
    if (!rhythmIsPlaying || !rhythmCurrentSong) return;

    const elapsedSeconds = (performance.now() - rhythmStartTime) / 1000;
    rhythmCurrentBeat = elapsedSeconds * (rhythmCurrentSong.bpm / 60);

    rhythmLiveNotes.forEach(note => {
        if (!note.hit && !note.miss && rhythmCurrentBeat - note.beat > getRhythmDifficultyConfig().hitWindowBeats) {
            registerRhythmNoteMiss(note);
        }
    });

    renderRhythmNotes();
    rhythmFrameId = requestAnimationFrame(tickRhythmFrame);
}

function renderRhythmNotes() {
    const layer = document.getElementById('rhythm-note-layer');
    if (!layer || !rhythmCurrentSong) return;
    const visibleNotes = rhythmLiveNotes.filter(note => (
        !note.hit
        && !note.miss
        && note.beat - rhythmCurrentBeat > -0.45
        && note.beat - rhythmCurrentBeat < 4.9
    ));

    layer.innerHTML = visibleNotes.map(note => {
        const lane = RHYTHM_LANES[0];
        const beatDistance = note.beat - rhythmCurrentBeat;
        const left = RHYTHM_TARGET_X + beatDistance * RHYTHM_SCROLL_SPEED;
        const anticipation = beatDistance > 0 && beatDistance < 1.2 ? ' is-near' : '';
        return `
            <div class="rhythm-note rhythm-note-${lane.id}${anticipation}"
                style="left:${left}%; top:50%">
                <span>${lane.emoji}</span>
            </div>
        `;
    }).join('');

    updateRhythmPanel();
}

function updateRhythmPanel() {
    const scoreEl = document.getElementById('rhythm-score');
    if (scoreEl) scoreEl.textContent = mgScore;
    const comboEl = document.getElementById('rhythm-combo');
    if (comboEl) comboEl.textContent = rhythmCombo;
    const maxComboEl = document.getElementById('rhythm-max-combo');
    if (maxComboEl) maxComboEl.textContent = rhythmMaxCombo;
    const missEl = document.getElementById('rhythm-miss');
    if (missEl) missEl.textContent = rhythmMissCount;
}

function showRhythmFeedback(message, type = 'good') {
    const feedback = document.getElementById('rhythm-feedback');
    const mascot = document.getElementById('rhythm-mascot');
    if (!feedback) return;
    const feedbackId = ++rhythmLastFeedbackId;
    feedback.textContent = message;
    feedback.className = `rhythm-feedback is-${type} is-visible`;
    if (mascot) mascot.className = `rhythm-mascot is-${type}`;
    setTimeout(() => {
        if (feedbackId !== rhythmLastFeedbackId) return;
        feedback.classList.remove('is-visible');
        if (mascot) mascot.className = 'rhythm-mascot';
    }, 320);
}

function registerRhythmNoteMiss(note) {
    note.miss = true;
    rhythmMissCount++;
    rhythmCombo = 0;
    playRhythmMissSound();
    showRhythmFeedback('ミス', 'miss');
    updateRhythmPanel();
}

function getNearestRhythmNote() {
    const candidates = rhythmLiveNotes.filter(note => !note.hit && !note.miss);
    if (candidates.length === 0) return null;
    return candidates.reduce((best, note) => {
        if (!best) return note;
        return Math.abs(note.beat - rhythmCurrentBeat) < Math.abs(best.beat - rhythmCurrentBeat) ? note : best;
    }, null);
}

function triggerRhythmHitAction() {
    if (!rhythmCurrentSong) return;
    if (!rhythmIsPlaying) {
        playRhythmUiSound('click');
        return;
    }

    const note = getNearestRhythmNote();
    if (!note) {
        playRhythmInstrument('drum');
        return;
    }

    const diff = Math.abs(note.beat - rhythmCurrentBeat);
    const difficulty = getRhythmDifficultyConfig();
    if (diff > difficulty.hitWindowBeats) {
        playRhythmInstrument('drum');
        showRhythmFeedback(diff > 0 ? 'まって' : 'おそい', 'wait');
        return;
    }

    note.hit = true;
    rhythmCombo++;
    rhythmMaxCombo = Math.max(rhythmMaxCombo, rhythmCombo);

    let scoreAdd = 60;
    let feedback = 'OK';
    let type = 'good';
    if (diff <= difficulty.perfectWindowBeats) {
        rhythmPerfectCount++;
        scoreAdd = 160;
        feedback = 'ぴったり';
        type = 'perfect';
    } else if (diff <= difficulty.greatWindowBeats) {
        rhythmGreatCount++;
        scoreAdd = 110;
        feedback = 'いいね';
        type = 'great';
    } else {
        rhythmGoodCount++;
    }

    mgScore += Math.round((scoreAdd + Math.min(80, rhythmCombo * 4)) * difficulty.scoreMultiplier);
    playRhythmInstrument(RHYTHM_LANES[0].soundType);
    showRhythmFeedback(feedback, type);
    renderRhythmNotes();
    updateMgHud();
}

function handleRhythmKey(key) {
    if (!['F', 'J', ' ', 'SPACEBAR'].includes(key)) return;
    triggerRhythmHitAction();
}

function hideMinigameResultOverlay() {
    const overlay = document.getElementById('mg-result-overlay');
    if (overlay) overlay.style.display = 'none';
    const board = document.getElementById('mg-ranking-board');
    if (board) board.style.display = 'none';
}

function renderRhythmResult(isNewRecord) {
    const board = document.getElementById('mg-ranking-board');
    if (!board) return;
    const totalNotes = rhythmLiveNotes.length || 1;
    const hitNotes = rhythmPerfectCount + rhythmGreatCount + rhythmGoodCount;
    const hitRate = Math.round((hitNotes / totalNotes) * 100);
    const stars = hitRate >= 90 ? '★★★' : hitRate >= 70 ? '★★' : hitRate >= 45 ? '★' : 'もういちど';
    board.style.display = 'block';
    board.style.width = 'min(680px, 94vw)';
    board.innerHTML = `
        <div class="rhythm-result-board">
            <h3>${isNewRecord ? 'しんきろく！' : 'リズムけっか'}</h3>
            <div class="rhythm-result-song">${rhythmCurrentSong?.emoji || '♪'} ${escapeHtml(rhythmCurrentSong?.title || 'ぽんぽんリズム')} / ${escapeHtml(getRhythmDifficultyConfig().label)}</div>
            <div class="rhythm-result-stars">${escapeHtml(stars)}</div>
            <div class="rhythm-result-grid">
                <span>スコア</span><strong>${mgScore}</strong>
                <span>ぴったり</span><strong>${rhythmPerfectCount}</strong>
                <span>いいね</span><strong>${rhythmGreatCount}</strong>
                <span>OK</span><strong>${rhythmGoodCount}</strong>
                <span>ミス</span><strong>${rhythmMissCount}</strong>
                <span>最高コンボ</span><strong>${rhythmMaxCombo}</strong>
            </div>
            <div class="rhythm-result-actions">
                <button type="button" id="rhythm-result-retry">もういちど</button>
                <button type="button" id="rhythm-result-difficulty">むずかしさをえらぶ</button>
                <button type="button" id="rhythm-result-songs">曲をえらぶ</button>
            </div>
        </div>
    `;

    document.getElementById('rhythm-result-retry')?.addEventListener('click', () => {
        hideMinigameResultOverlay();
        startRhythmSong(rhythmCurrentSong?.id || rhythmSelectedSongId || getDefaultRhythmSongId(), rhythmCurrentDifficulty);
    });
    document.getElementById('rhythm-result-difficulty')?.addEventListener('click', () => {
        hideMinigameResultOverlay();
        showRhythmDifficultySelect(rhythmCurrentSong?.id || rhythmSelectedSongId || getDefaultRhythmSongId());
    });
    document.getElementById('rhythm-result-songs')?.addEventListener('click', () => {
        hideMinigameResultOverlay();
        setupRhythmGameArea();
    });
}

export function startMinigame(type) {
    SoundManager.init(); if (document.activeElement) document.activeElement.blur();
    showScreen('screen-minigame');
    currentMinigameType = type || 'meteor';
    minigameReturnScreen = currentMinigameType === 'rhythm' ? 'screen-free-time-menu' : 'screen-minigame-menu';

    document.getElementById('mg-result-overlay').style.display = 'none';
    const mgArea = document.getElementById('minigame-area');
    mgArea.innerHTML = '';
    mgArea.classList.remove('d-challenge-mode', 'rhythm-mode');
    document.getElementById('mg-ranking-board').style.display = 'none';

    if (currentMinigameType === 'd_challenge') {
        mgArea.classList.add('d-challenge-mode');
        document.getElementById('boost-gauge-container').style.display = 'flex';
        document.getElementById('mg-score-label').innerHTML = `スコア: <span id="mg-score">0</span>`;
        initDChallengeWords();
        dBoost = 1.0; dLevel = 1; dClearedWords = 0;
        updateBoostGauge();
    } else if (currentMinigameType === 'rhythm') {
        mgArea.classList.add('rhythm-mode');
        document.getElementById('boost-gauge-container').style.display = 'none';
        document.getElementById('mg-score-label').innerHTML = `リズム: <span id="mg-score">0</span>`;
        setupRhythmGameArea();
    } else {
        document.getElementById('boost-gauge-container').style.display = 'none';
        document.getElementById('mg-score-label').innerHTML = `スコア: <span id="mg-score">0</span>`;
    }

    if (currentMinigameType === 'rhythm') {
        mgWords = [];
        mgActiveWord = null;
        mgStartedAt = 0;
        const overlay = document.getElementById('mg-start-overlay');
        if (overlay) overlay.style.display = 'none';
        return;
    }

    mgTime = 60; mgScore = 0; mgWords =[]; mgActiveWord = null; mgStartedAt = 0; updateMgHud();
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
            mgStartedAt = Date.now();
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

function recordMinigameInterrupt(shouldRecord) {
    const wasRunning = Boolean(mgTimeInterval || mgSpawnInterval || mgInterval || rhythmFrameId || rhythmCountdownTimer || rhythmSongEndTimer || rhythmIsPlaying);
    if (!shouldRecord || !wasRunning || !mgStartedAt || !canWriteCurrentUserRow()) return;
    const elapsed = Math.max(0, (Date.now() - mgStartedAt) / 1000);
    const rhythmDetail = currentMinigameType === 'rhythm'
        ? ` / ${rhythmCurrentSong?.title || '曲未選択'} / ${getRhythmDifficultyConfig().label} / コンボ ${rhythmMaxCombo} / ミス ${rhythmMissCount}`
        : '';
    recordPracticeActivity({
        category: getCurrentMinigameActivityCategory(),
        title: getCurrentMinigameActivityTitle(),
        detail: '中断',
        amount: `スコア ${mgScore}点 / 経過 ${elapsed.toFixed(0)}秒${rhythmDetail}`,
        coins: 0
    });
    saveUsers(false);
}

export function stopMinigame(recordInterrupt = false) {
    recordMinigameInterrupt(recordInterrupt);
    if (cancelMgStartHandler) {
        document.removeEventListener('keydown', cancelMgStartHandler);
        const overlay = document.getElementById('mg-start-overlay');
        if(overlay) overlay.removeEventListener('mousedown', cancelMgStartHandler);
        cancelMgStartHandler = null;
    }
    clearInterval(mgTimeInterval); clearInterval(mgSpawnInterval); clearInterval(mgInterval);
    stopRhythmRuntime();
    mgTimeInterval = null; mgSpawnInterval = null; mgInterval = null;
    document.removeEventListener('keydown', mgHandleKey);
}

export function backFromMinigame(recordInterrupt = false) {
    stopMinigame(recordInterrupt);
    showScreen(minigameReturnScreen);
}

function endMinigame() {
    stopMinigame(false); SoundManager.playClear();
    let scoreText = `スコア: ${mgScore}`;
    document.getElementById('mg-final-score').innerText = scoreText;

    let isNewRecord = false; let u = users[currentUser];
    const canSaveResult = canWriteCurrentUserRow();
    if (!u.examRecords) u.examRecords = {};

    if (currentMinigameType === 'rhythm') {
        let prev = u.examRecords['mg_rhythm'] || u.rhythmHighscore || 0;
        if (canSaveResult && mgScore > prev) { u.examRecords['mg_rhythm'] = mgScore; u.rhythmHighscore = mgScore; isNewRecord = true; }
    } else if (currentMinigameType === 'd_challenge') {
        let prev = u.examRecords['mg_d_challenge'] || u.dChallengeHighscore || 0;
        if (canSaveResult && mgScore > prev) { u.examRecords['mg_d_challenge'] = mgScore; u.dChallengeHighscore = mgScore; isNewRecord = true; }
    } else {
        let prev = u.examRecords['mg_meteor'] || u.minigameHighscore || 0;
        if (canSaveResult && mgScore > prev) { u.examRecords['mg_meteor'] = mgScore; u.minigameHighscore = mgScore; isNewRecord = true; }
    }

    if (canSaveResult) {
        recordPracticeActivity({
            category: getCurrentMinigameActivityCategory(),
            title: getCurrentMinigameActivityTitle(),
            detail: isNewRecord ? '新記録' : '練習完了',
            amount: currentMinigameType === 'rhythm'
                ? `スコア ${mgScore}点 / ${rhythmCurrentSong?.title || 'ぽんぽんリズム'} / ${getRhythmDifficultyConfig().label} / ぴったり ${rhythmPerfectCount} / いいね ${rhythmGreatCount} / OK ${rhythmGoodCount} / コンボ ${rhythmMaxCombo} / ミス ${rhythmMissCount}`
                : `スコア ${mgScore}点`,
            coins: 0
        });
        saveUsers(false);
    }

    const modeKey = getCurrentMinigameModeKey();
    if (currentMinigameType === 'rhythm') {
        renderRhythmResult(isNewRecord);
    } else {
        const localRanking = getLocalMinigameRanking(modeKey);
        renderMinigameRanking(localRanking, {
            sourceLabel: 'この端末のランキング',
            status: canUseCloudTypingRanking() ? '匿名ランキングを更新中です。' : 'この画面で読める範囲だけ表示しています。',
            isNewRecord
        });
        if (canSaveResult && canUseCloudTypingRanking()) {
            refreshCloudMinigameRanking(modeKey, mgScore, isNewRecord);
        }
    }
    const resultBackButton = document.getElementById('mg-result-back');
    if (resultBackButton) {
        resultBackButton.style.display = currentMinigameType === 'rhythm' ? 'none' : '';
    }
    document.getElementById('mg-result-overlay').style.display = 'flex';
    createConfetti();
}

function updateMgHud() {
    document.getElementById('mg-score').innerText = mgScore;
    const timeEl = document.getElementById('mg-time');
    if (!timeEl) return;
    if (currentMinigameType === 'rhythm' && !rhythmCurrentSong) {
        timeEl.innerText = '曲をえらぶ';
    } else {
        timeEl.innerText = `のこり: ${mgTime}秒`;
    }
}

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
    if (typeof e.key !== 'string') return;
    if (mgTime <= 0 ||['Shift', 'Enter', 'Control', 'Alt', 'Meta', 'Tab', 'Escape'].includes(e.key)) return;
    if (e.isComposing || e.key === 'Process') { showImeWarning(); return; }

    let k = e.key.toUpperCase();

    if (currentMinigameType === 'rhythm') {
        e.preventDefault();
        handleRhythmKey(k);
    } else if (currentMinigameType === 'd_challenge') {
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
