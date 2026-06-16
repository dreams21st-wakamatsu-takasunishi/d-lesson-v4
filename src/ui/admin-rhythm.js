import {
    GLOBAL_SETTINGS_ID,
    saveUsers,
    supabase,
    users
} from '../api/user.js';
import { showCustomAlert, showCustomConfirm } from './modal.js';
import { recordAdminAudit } from './admin-audit.js';

const RHYTHM_CUSTOM_SONGS_KEY = 'rhythmCustomSongs';
const RHYTHM_AUDIO_BUCKET = 'lesson-rhythm-audio';
const RHYTHM_DIFFICULTIES = ['easy', 'normal', 'hard'];
const RHYTHM_DIFFICULTY_LABELS = {
    easy: 'イージー',
    normal: 'ノーマル',
    hard: 'ハード'
};
const ADMIN_RHYTHM_TARGET_X = 8;
const ADMIN_RHYTHM_SCROLL_SPEED = 16.5;
const ADMIN_RHYTHM_LEAD_IN_BEATS = 2;
const ADMIN_RHYTHM_TIMELINE_ZOOM_MIN = 1;
const ADMIN_RHYTHM_TIMELINE_ZOOM_MAX = 8;
const ADMIN_RHYTHM_TIMELINE_ZOOM_STEP = 0.25;
const ADMIN_RHYTHM_NUDGE_SECONDS = 0.02;
const ADMIN_RHYTHM_FAST_NUDGE_SECONDS = 0.1;
const ADMIN_RHYTHM_HIT_WINDOW_BEATS = 0.38;
const ADMIN_RHYTHM_PERFECT_WINDOW_BEATS = 0.13;
const ADMIN_RHYTHM_GREAT_WINDOW_BEATS = 0.24;

let draftId = '';
let draftAudioUrl = '';
let draftStorageBucket = '';
let draftStoragePath = '';
let draftCharts = createEmptyCharts();
let draftObjectUrl = '';
let draftBpm = 100;
let isRecording = false;
let isRecordingCountdown = false;
let recordingKeyHandler = null;
let recordingTapHandler = null;
let recordingEndedHandler = null;
let recordingCountdownTimer = null;
let adminPreviewFrameId = null;
let adminPreviewAudioTimer = null;
let adminPreviewStartMs = 0;
let isAdminPreviewPlaying = false;
let timelineDragState = null;
let timelineZoom = 2;
let selectedTimelineNote = null;
let adminRhythmView = 'menu';
let adminTestFrameId = null;
let adminTestAudioTimer = null;
let adminTestStartMs = 0;
let isAdminTestPlaying = false;
let adminTestNotes = [];
let adminTestStats = createAdminTestStats();
let adminTestKeyHandler = null;
let adminTestTapHandler = null;

function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, (char) => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    }[char]));
}

function createEmptyCharts() {
    return { easy: [], normal: [], hard: [] };
}

function createAdminTestStats() {
    return { score: 0, combo: 0, maxCombo: 0, perfect: 0, great: 0, ok: 0, miss: 0 };
}

function cloneCharts(charts = {}) {
    const result = createEmptyCharts();
    RHYTHM_DIFFICULTIES.forEach((key) => {
        result[key] = Array.isArray(charts[key])
            ? charts[key]
                .map(note => ({
                    beat: Number(note.beat),
                    timeMs: Number(note.timeMs)
                }))
                .filter(note => Number.isFinite(note.beat))
                .sort((a, b) => a.beat - b.beat)
            : [];
    });
    return result;
}

function ensureGlobalSettings() {
    if (!users[GLOBAL_SETTINGS_ID] || typeof users[GLOBAL_SETTINGS_ID] !== 'object') {
        users[GLOBAL_SETTINGS_ID] = { isMaster: true };
    }
    if (!Array.isArray(users[GLOBAL_SETTINGS_ID][RHYTHM_CUSTOM_SONGS_KEY])) {
        users[GLOBAL_SETTINGS_ID][RHYTHM_CUSTOM_SONGS_KEY] = [];
    }
    return users[GLOBAL_SETTINGS_ID];
}

function getCustomRhythmSongs() {
    return ensureGlobalSettings()[RHYTHM_CUSTOM_SONGS_KEY];
}

function resetDraft() {
    stopAdminRhythmRecording();
    stopAdminRhythmPreview();
    stopAdminRhythmTestPlay();
    draftId = '';
    draftAudioUrl = '';
    draftStorageBucket = '';
    draftStoragePath = '';
    draftCharts = createEmptyCharts();
    draftBpm = 100;
    selectedTimelineNote = null;
    if (draftObjectUrl) URL.revokeObjectURL(draftObjectUrl);
    draftObjectUrl = '';
}

function getSelectedDifficulty() {
    return document.getElementById('admin-rhythm-difficulty')?.value || 'normal';
}

function getDraftBpm() {
    return Math.max(40, Math.min(240, Number.isFinite(draftBpm) ? draftBpm : 100));
}

function getAudioElement() {
    return document.getElementById('admin-rhythm-audio');
}

function getDraftTimelineDurationSeconds() {
    const audio = getAudioElement();
    if (audio && Number.isFinite(audio.duration) && audio.duration > 0) return audio.duration;
    const difficulty = getSelectedDifficulty();
    const chart = draftCharts[difficulty] || [];
    const maxSecond = Math.max(0, ...chart.map(note => Number(note.timeMs) / 1000).filter(Number.isFinite));
    return Math.max(1, maxSecond + 2);
}

function getNoteSecond(note) {
    if (Number.isFinite(Number(note?.timeMs))) return Math.max(0, Number(note.timeMs) / 1000);
    return Math.max(0, (Number(note?.beat) || 0) * 60 / getDraftBpm());
}

function setNoteSecond(note, seconds) {
    const safeSeconds = Math.max(0, Number(seconds) || 0);
    const bpm = getDraftBpm();
    note.timeMs = Math.round(safeSeconds * 1000);
    note.beat = Math.round((safeSeconds * bpm / 60) * 1000) / 1000;
}

function getSelectedChart() {
    const difficulty = getSelectedDifficulty();
    if (!Array.isArray(draftCharts[difficulty])) draftCharts[difficulty] = [];
    return draftCharts[difficulty];
}

function sortSelectedChart() {
    getSelectedChart().sort((a, b) => getNoteSecond(a) - getNoteSecond(b));
}

function getSelectedNoteIndex() {
    return getSelectedChart().indexOf(selectedTimelineNote);
}

function ensureSelectedTimelineNote() {
    const chart = getSelectedChart();
    if (!chart.length) {
        selectedTimelineNote = null;
        return null;
    }
    if (!chart.includes(selectedTimelineNote)) selectedTimelineNote = chart[0];
    return selectedTimelineNote;
}

function selectTimelineNoteByIndex(index) {
    const chart = getSelectedChart();
    if (!chart.length) {
        selectedTimelineNote = null;
        renderDraftTimeline();
        return;
    }
    const safeIndex = Math.max(0, Math.min(chart.length - 1, Number(index) || 0));
    selectedTimelineNote = chart[safeIndex];
    renderDraftTimeline();
}

function deleteSelectedTimelineNote() {
    const chart = getSelectedChart();
    const index = chart.indexOf(selectedTimelineNote);
    if (index < 0) {
        updateDraftStatus('削除するノーツを選択してください。');
        return;
    }
    chart.splice(index, 1);
    selectedTimelineNote = chart[Math.min(index, chart.length - 1)] || null;
    renderDraftTimeline();
    updateDraftStatus('選択中のノーツを削除しました。');
}

function updateSelectedNotePanel() {
    const panel = document.getElementById('admin-rhythm-selected-note');
    if (!panel) return;
    const note = ensureSelectedTimelineNote();
    if (!note) {
        panel.innerHTML = '<strong>選択中ノーツ</strong><span>ノーツを置くと、ここに時間が表示されます。</span>';
        return;
    }
    const chart = getSelectedChart();
    const index = chart.indexOf(note);
    panel.innerHTML = `
        <strong>選択中ノーツ: ${index + 1} / ${chart.length}</strong>
        <span>${getNoteSecond(note).toFixed(2)}秒</span>
        <small>← → で0.02秒、Shift + ← → で0.1秒ずつ調整できます。</small>
    `;
}

function nudgeSelectedTimelineNote(deltaSeconds) {
    const note = ensureSelectedTimelineNote();
    if (!note) {
        updateDraftStatus('調整するノーツがありません。');
        return;
    }
    const duration = getDraftTimelineDurationSeconds();
    const nextSecond = Math.max(0, Math.min(duration, getNoteSecond(note) + deltaSeconds));
    setNoteSecond(note, nextSecond);
    sortSelectedChart();
    renderDraftTimeline();
    updateDraftStatus(`選択中ノーツを ${nextSecond.toFixed(2)}秒 に調整しました。`);
}

function getTimelineZoom() {
    const value = Number(timelineZoom);
    if (!Number.isFinite(value)) return 2;
    return Math.max(ADMIN_RHYTHM_TIMELINE_ZOOM_MIN, Math.min(ADMIN_RHYTHM_TIMELINE_ZOOM_MAX, value));
}

function updateTimelineZoomControls() {
    const zoom = getTimelineZoom();
    const slider = document.getElementById('admin-rhythm-timeline-zoom');
    const label = document.getElementById('admin-rhythm-timeline-zoom-label');
    if (slider) slider.value = String(zoom);
    if (label) label.textContent = `${Math.round(zoom * 100)}%`;
}

function setTimelineZoom(value) {
    const numeric = Number(value);
    const safeValue = Number.isFinite(numeric) ? numeric : 2;
    timelineZoom = Math.max(ADMIN_RHYTHM_TIMELINE_ZOOM_MIN, Math.min(ADMIN_RHYTHM_TIMELINE_ZOOM_MAX, safeValue));
    renderDraftTimeline();
}

function setAdminRhythmOverlay(message = '', visible = false) {
    const overlay = document.getElementById('admin-rhythm-preview-countdown');
    if (!overlay) return;
    overlay.textContent = message;
    overlay.style.display = visible ? 'flex' : 'none';
}

function updateAdminRhythmTestHud(message = '') {
    const scoreEl = document.getElementById('admin-rhythm-test-score');
    const comboEl = document.getElementById('admin-rhythm-test-combo');
    const missEl = document.getElementById('admin-rhythm-test-miss');
    const feedbackEl = document.getElementById('admin-rhythm-test-feedback');
    if (scoreEl) scoreEl.textContent = String(adminTestStats.score);
    if (comboEl) comboEl.textContent = String(adminTestStats.combo);
    if (missEl) missEl.textContent = String(adminTestStats.miss);
    if (feedbackEl && message) {
        feedbackEl.textContent = message;
        feedbackEl.classList.add('is-visible');
        setTimeout(() => feedbackEl.classList.remove('is-visible'), 420);
    }
}

function renderAdminRhythmPreviewNotes(currentBeat = null) {
    const layer = document.getElementById('admin-rhythm-preview-notes');
    if (!layer) return;
    const chart = isAdminTestPlaying
        ? adminTestNotes.filter(note => !note.hit && !note.miss)
        : getSelectedChart();
    const safeCurrentBeat = Number.isFinite(currentBeat) ? currentBeat : -ADMIN_RHYTHM_LEAD_IN_BEATS;
    const visibleNotes = chart.filter(note => {
        const distance = Number(note.beat) - safeCurrentBeat;
        return distance > -0.45 && distance < 4.9;
    });

    layer.innerHTML = visibleNotes.map(note => {
        const beatDistance = Number(note.beat) - safeCurrentBeat;
        const left = ADMIN_RHYTHM_TARGET_X + beatDistance * ADMIN_RHYTHM_SCROLL_SPEED;
        const near = beatDistance > 0 && beatDistance < 1.2 ? ' is-near' : '';
        return `
            <div class="rhythm-note admin-rhythm-preview-note${near}"
                style="left:${left}%; top:50%">
                <span>🥁</span>
            </div>
        `;
    }).join('');
}

function detachAdminTestHandlers() {
    if (adminTestKeyHandler) document.removeEventListener('keydown', adminTestKeyHandler);
    const drum = document.querySelector('#admin-rhythm-play-preview .rhythm-target-drum');
    if (adminTestTapHandler && drum) drum.removeEventListener('pointerdown', adminTestTapHandler);
    adminTestKeyHandler = null;
    adminTestTapHandler = null;
}

function stopAdminRhythmTestPlay() {
    if (adminTestFrameId) {
        cancelAnimationFrame(adminTestFrameId);
        adminTestFrameId = null;
    }
    if (adminTestAudioTimer) {
        clearTimeout(adminTestAudioTimer);
        adminTestAudioTimer = null;
    }
    isAdminTestPlaying = false;
    adminTestStartMs = 0;
    detachAdminTestHandlers();
    const audio = getAudioElement();
    if (audio) audio.pause();
    setAdminRhythmOverlay('', false);
    renderAdminRhythmPreviewNotes();
}

function getAdminTestCurrentBeat() {
    const elapsedSeconds = (performance.now() - adminTestStartMs) / 1000;
    return elapsedSeconds * getDraftBpm() / 60;
}

function markAdminRhythmTestMisses(currentBeat) {
    let changed = false;
    adminTestNotes.forEach(note => {
        if (note.hit || note.miss) return;
        if (note.beat - currentBeat >= -0.45) return;
        note.miss = true;
        adminTestStats.combo = 0;
        adminTestStats.miss++;
        changed = true;
    });
    if (changed) updateAdminRhythmTestHud('ミス');
}

function tickAdminRhythmTestPlay() {
    if (!isAdminTestPlaying) return;
    const currentBeat = getAdminTestCurrentBeat();
    markAdminRhythmTestMisses(currentBeat);
    renderAdminRhythmPreviewNotes(currentBeat);

    const duration = getDraftTimelineDurationSeconds();
    const elapsedSeconds = (performance.now() - adminTestStartMs) / 1000;
    if (elapsedSeconds > duration + 1.2) {
        stopAdminRhythmTestPlay();
        updateDraftStatus('テストプレイを終了しました。');
        return;
    }
    adminTestFrameId = requestAnimationFrame(tickAdminRhythmTestPlay);
}

function triggerAdminRhythmTestHit() {
    if (!isAdminTestPlaying) return;
    const currentBeat = getAdminTestCurrentBeat();
    const candidates = adminTestNotes.filter(note => !note.hit && !note.miss);
    if (!candidates.length) {
        updateAdminRhythmTestHud('ノーツなし');
        return;
    }
    const note = candidates.reduce((best, item) => (
        Math.abs(item.beat - currentBeat) < Math.abs(best.beat - currentBeat) ? item : best
    ), candidates[0]);
    const diff = Math.abs(note.beat - currentBeat);
    if (diff > ADMIN_RHYTHM_HIT_WINDOW_BEATS) {
        updateAdminRhythmTestHud(note.beat > currentBeat ? 'まって' : 'おそい');
        return;
    }
    note.hit = true;
    adminTestStats.combo++;
    adminTestStats.maxCombo = Math.max(adminTestStats.maxCombo, adminTestStats.combo);
    let scoreAdd = 60;
    let feedback = 'OK';
    if (diff <= ADMIN_RHYTHM_PERFECT_WINDOW_BEATS) {
        adminTestStats.perfect++;
        scoreAdd = 160;
        feedback = 'ぴったり';
    } else if (diff <= ADMIN_RHYTHM_GREAT_WINDOW_BEATS) {
        adminTestStats.great++;
        scoreAdd = 110;
        feedback = 'いいね';
    } else {
        adminTestStats.ok++;
    }
    adminTestStats.score += scoreAdd + Math.min(80, adminTestStats.combo * 4);
    updateAdminRhythmTestHud(feedback);
    renderAdminRhythmPreviewNotes(currentBeat);
}

function startAdminRhythmTestPlay() {
    const audio = getAudioElement();
    if (!audio || !getPreviewSource()) {
        showCustomAlert('先に音声ファイルを選んでください。');
        return;
    }
    const chart = getSelectedChart();
    if (!chart.length) {
        showCustomAlert('テストプレイするノーツがありません。録音または現在位置に追加してください。');
        return;
    }
    stopAdminRhythmRecording();
    stopAdminRhythmPreview();
    stopAdminRhythmTestPlay();
    audio.currentTime = 0;
    adminTestNotes = chart.map(note => ({
        beat: Number(note.beat),
        timeMs: Number(note.timeMs),
        hit: false,
        miss: false
    })).filter(note => Number.isFinite(note.beat));
    adminTestStats = createAdminTestStats();
    updateAdminRhythmTestHud('');
    const leadInSeconds = ADMIN_RHYTHM_LEAD_IN_BEATS * 60 / getDraftBpm();
    adminTestStartMs = performance.now() + leadInSeconds * 1000;
    isAdminTestPlaying = true;
    setAdminRhythmOverlay('テスト', true);
    adminTestKeyHandler = (event) => {
        const key = event.key === ' ' ? 'SPACE' : String(event.key || '').toUpperCase();
        if (!['F', 'J', 'SPACE'].includes(key)) return;
        event.preventDefault();
        triggerAdminRhythmTestHit();
    };
    adminTestTapHandler = (event) => {
        event.preventDefault();
        triggerAdminRhythmTestHit();
    };
    document.addEventListener('keydown', adminTestKeyHandler);
    document.querySelector('#admin-rhythm-play-preview .rhythm-target-drum')?.addEventListener('pointerdown', adminTestTapHandler);
    adminTestAudioTimer = setTimeout(() => {
        adminTestAudioTimer = null;
        if (!isAdminTestPlaying) return;
        setAdminRhythmOverlay('', false);
        audio.play().catch(error => {
            console.warn('管理者リズムテストプレイの再生に失敗しました:', error);
            stopAdminRhythmTestPlay();
            showCustomAlert('音声を再生できませんでした。ブラウザの音声許可やファイル形式を確認してください。');
        });
    }, leadInSeconds * 1000);
    updateDraftStatus('テストプレイ中です。F / J / スペース、または太鼓を押して判定を確認できます。');
    adminTestFrameId = requestAnimationFrame(tickAdminRhythmTestPlay);
}

function renderDraftTimeline() {
    const timeline = document.getElementById('admin-rhythm-timeline-notes');
    const playhead = document.getElementById('admin-rhythm-timeline-playhead');
    const timeLabel = document.getElementById('admin-rhythm-timeline-time');
    const track = document.getElementById('admin-rhythm-timeline-track');
    const ruler = document.getElementById('admin-rhythm-timeline-ruler');
    if (!timeline) return;

    const audio = getAudioElement();
    const difficulty = getSelectedDifficulty();
    const duration = getDraftTimelineDurationSeconds();
    const chart = draftCharts[difficulty] || [];
    ensureSelectedTimelineNote();
    if (track) {
        const zoom = getTimelineZoom();
        track.style.width = `${Math.round(zoom * 100)}%`;
        track.style.minWidth = `${Math.max(960, Math.round(zoom * 720))}px`;
    }
    timeline.innerHTML = chart.map((note, index) => {
        const second = getNoteSecond(note);
        const left = Math.max(0, Math.min(100, (second / duration) * 100));
        const selected = note === selectedTimelineNote ? ' is-selected' : '';
        return `<span class="admin-rhythm-timeline-note${selected}" data-note-index="${index}" style="left:${left}%;" title="${index + 1}こめ ${second.toFixed(2)}秒"></span>`;
    }).join('');
    if (ruler) {
        const tickStep = duration <= 15 ? 1 : duration <= 30 ? 2 : duration <= 60 ? 5 : duration <= 120 ? 10 : 15;
        const ticks = [];
        for (let second = 0; second <= duration + 0.001; second += tickStep) {
            const left = Math.max(0, Math.min(100, (second / duration) * 100));
            ticks.push(`<span class="admin-rhythm-timeline-tick" style="left:${left}%"><small>${Math.round(second)}秒</small></span>`);
        }
        ruler.innerHTML = ticks.join('');
    }

    const currentSecond = Math.max(0, Number(audio?.currentTime) || 0);
    const playheadLeft = Math.max(0, Math.min(100, (currentSecond / duration) * 100));
    if (playhead) playhead.style.left = `${playheadLeft}%`;
    if (timeLabel) timeLabel.textContent = `${currentSecond.toFixed(1)}秒 / ${duration.toFixed(1)}秒`;
    updateTimelineZoomControls();
    updateSelectedNotePanel();
    if (!isAdminPreviewPlaying && !isAdminTestPlaying) renderAdminRhythmPreviewNotes();
}

function updateDraftStatus(message = '') {
    const status = document.getElementById('admin-rhythm-status');
    if (status) status.textContent = message;
    const counts = document.getElementById('admin-rhythm-note-counts');
    if (counts) {
        counts.innerHTML = RHYTHM_DIFFICULTIES.map(key => {
            const active = key === getSelectedDifficulty() ? ' is-active' : '';
            return `<span class="admin-rhythm-note-count${active}">${RHYTHM_DIFFICULTY_LABELS[key]}: ${draftCharts[key].length}こ</span>`;
        }).join('');
    }
    renderDraftTimeline();
}

function getPreviewSource() {
    return draftObjectUrl || draftAudioUrl;
}

function setPreviewSource(source) {
    const audio = getAudioElement();
    if (!audio) return;
    audio.src = source || '';
    audio.load();
}

function handleFileChange(event) {
    stopAdminRhythmPreview();
    stopAdminRhythmTestPlay();
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('audio/')) {
        showCustomAlert('音声ファイルを選んでください。');
        event.target.value = '';
        return;
    }
    if (draftObjectUrl) URL.revokeObjectURL(draftObjectUrl);
    draftObjectUrl = URL.createObjectURL(file);
    setPreviewSource(draftObjectUrl);
    updateDraftStatus('音声を読み込みました。難易度を選んで録音できます。');
}

function getRecordingSecond() {
    const audio = getAudioElement();
    if (!audio) return 0;
    return Math.max(0, Number(audio.currentTime) || 0);
}

function addNoteAtCurrentPosition(source = 'manual') {
    const difficulty = getSelectedDifficulty();
    const seconds = getRecordingSecond();
    const bpm = getDraftBpm();
    const beat = Math.round((seconds * bpm / 60) * 1000) / 1000;
    if (!Number.isFinite(beat) || beat < 0.05) return;
    const chart = getSelectedChart();
    const last = chart[chart.length - 1];
    if (last && Math.abs(last.beat - beat) < 0.12) return;
    const note = { beat, timeMs: Math.round(seconds * 1000) };
    chart.push(note);
    chart.sort((a, b) => a.beat - b.beat);
    selectedTimelineNote = note;
    updateDraftStatus(`${RHYTHM_DIFFICULTY_LABELS[difficulty]}にノーツを追加しました。`);
    const tapPad = document.getElementById('admin-rhythm-tap-pad');
    if (tapPad) {
        tapPad.classList.remove('is-hit');
        void tapPad.offsetWidth;
        tapPad.classList.add('is-hit');
    }
}

function clearRecordingCountdown() {
    if (recordingCountdownTimer) {
        clearInterval(recordingCountdownTimer);
        recordingCountdownTimer = null;
    }
    isRecordingCountdown = false;
}

function stopAdminRhythmPreview() {
    if (adminPreviewFrameId) {
        cancelAnimationFrame(adminPreviewFrameId);
        adminPreviewFrameId = null;
    }
    if (adminPreviewAudioTimer) {
        clearTimeout(adminPreviewAudioTimer);
        adminPreviewAudioTimer = null;
    }
    isAdminPreviewPlaying = false;
    adminPreviewStartMs = 0;
    const audio = getAudioElement();
    if (audio) audio.pause();
    setAdminRhythmOverlay('', false);
    renderAdminRhythmPreviewNotes();
}

function tickAdminRhythmPreview() {
    if (!isAdminPreviewPlaying) return;
    const bpm = getDraftBpm();
    const elapsedSeconds = (performance.now() - adminPreviewStartMs) / 1000;
    const currentBeat = elapsedSeconds * bpm / 60;
    renderAdminRhythmPreviewNotes(currentBeat);

    const duration = getDraftTimelineDurationSeconds();
    if (elapsedSeconds > duration + 1.2) {
        stopAdminRhythmPreview();
        updateDraftStatus('プレビューを終了しました。');
        return;
    }
    adminPreviewFrameId = requestAnimationFrame(tickAdminRhythmPreview);
}

function startAdminRhythmPreview() {
    const audio = getAudioElement();
    if (!audio || !getPreviewSource()) {
        showCustomAlert('先に音声ファイルを選んでください。');
        return;
    }
    const chart = getSelectedChart();
    if (!chart.length) {
        showCustomAlert('プレビューするノーツがありません。録音または現在位置に追加してください。');
        return;
    }
    stopAdminRhythmRecording();
    stopAdminRhythmPreview();
    stopAdminRhythmTestPlay();
    audio.currentTime = 0;
    const leadInSeconds = ADMIN_RHYTHM_LEAD_IN_BEATS * 60 / getDraftBpm();
    adminPreviewStartMs = performance.now() + leadInSeconds * 1000;
    isAdminPreviewPlaying = true;
    setAdminRhythmOverlay('プレビュー', true);
    adminPreviewAudioTimer = setTimeout(() => {
        adminPreviewAudioTimer = null;
        if (!isAdminPreviewPlaying) return;
        setAdminRhythmOverlay('', false);
        audio.play().catch(error => {
            console.warn('管理者リズムプレビューの再生に失敗しました:', error);
            stopAdminRhythmPreview();
            showCustomAlert('音声を再生できませんでした。ブラウザの音声許可やファイル形式を確認してください。');
        });
    }, leadInSeconds * 1000);
    updateDraftStatus('実際のプレイ画面に近い流れでプレビューしています。');
    adminPreviewFrameId = requestAnimationFrame(tickAdminRhythmPreview);
}

function getTimelineSecondFromEvent(event, track) {
    const rect = track.getBoundingClientRect();
    const ratio = rect.width > 0 ? (event.clientX - rect.left) / rect.width : 0;
    const clampedRatio = Math.max(0, Math.min(1, ratio));
    return clampedRatio * getDraftTimelineDurationSeconds();
}

function autoScrollTimelineDuringDrag(event) {
    const scroller = timelineDragState?.track?.closest('.admin-rhythm-timeline-scroll');
    if (!scroller) return;
    const rect = scroller.getBoundingClientRect();
    const edge = 52;
    if (event.clientX > rect.right - edge) scroller.scrollLeft += 18;
    if (event.clientX < rect.left + edge) scroller.scrollLeft -= 18;
}

function startTimelineNoteDrag(event) {
    const noteEl = event.target.closest('.admin-rhythm-timeline-note');
    const track = document.querySelector('.admin-rhythm-timeline-track');
    if (!noteEl || !track) return;
    event.preventDefault();
    stopAdminRhythmPreview();
    const index = Number(noteEl.dataset.noteIndex);
    const chart = getSelectedChart();
    const note = chart[index];
    if (!note) return;
    selectedTimelineNote = note;
    renderDraftTimeline();
    const dragNoteEl = document.querySelector(`.admin-rhythm-timeline-note[data-note-index="${index}"]`) || noteEl;
    timelineDragState = {
        note,
        noteEl: dragNoteEl,
        track,
        pointerId: event.pointerId
    };
    dragNoteEl.classList.add('is-dragging');
    try {
        dragNoteEl.setPointerCapture?.(event.pointerId);
    } catch {
        // Some browsers only allow pointer capture on the original event target.
    }
}

function moveTimelineNoteDrag(event) {
    if (!timelineDragState) return;
    event.preventDefault();
    autoScrollTimelineDuringDrag(event);
    const seconds = getTimelineSecondFromEvent(event, timelineDragState.track);
    setNoteSecond(timelineDragState.note, seconds);
    const duration = getDraftTimelineDurationSeconds();
    const left = Math.max(0, Math.min(100, (seconds / duration) * 100));
    timelineDragState.noteEl.style.left = `${left}%`;
    timelineDragState.noteEl.title = `${seconds.toFixed(2)}秒`;
    renderAdminRhythmPreviewNotes();
}

function endTimelineNoteDrag(event) {
    if (!timelineDragState) return;
    try {
        timelineDragState.noteEl.releasePointerCapture?.(timelineDragState.pointerId);
    } catch {
        // Pointer capture may already be released.
    }
    timelineDragState.noteEl.classList.remove('is-dragging');
    timelineDragState = null;
    sortSelectedChart();
    updateDraftStatus('ノーツの位置を調整しました。');
    renderDraftTimeline();
}

function detachRecordingHandlers() {
    if (recordingKeyHandler) document.removeEventListener('keydown', recordingKeyHandler);
    const tapPad = document.getElementById('admin-rhythm-tap-pad');
    if (recordingTapHandler && tapPad) tapPad.removeEventListener('pointerdown', recordingTapHandler);
    const audio = getAudioElement();
    if (recordingEndedHandler && audio) audio.removeEventListener('ended', recordingEndedHandler);
    recordingKeyHandler = null;
    recordingTapHandler = null;
    recordingEndedHandler = null;
}

function stopAdminRhythmRecording() {
    const wasCounting = isRecordingCountdown;
    clearRecordingCountdown();
    if (!isRecording) {
        detachRecordingHandlers();
        if (wasCounting) {
            setAdminRhythmOverlay('', false);
            updateDraftStatus('録音カウントを止めました。');
        }
        return;
    }
    const audio = getAudioElement();
    if (audio) audio.pause();
    isRecording = false;
    detachRecordingHandlers();
    updateDraftStatus('録音を停止しました。必要なら保存してください。');
}

function beginAdminRhythmRecording(difficulty) {
    const audio = getAudioElement();
    if (!audio) return;
    audio.currentTime = 0;
    isRecording = true;
    isRecordingCountdown = false;
    detachRecordingHandlers();
    recordingKeyHandler = (event) => {
        if (event.repeat) return;
        const key = event.key === ' ' ? 'SPACE' : String(event.key || '').toUpperCase();
        if (!['F', 'J', 'SPACE'].includes(key)) return;
        event.preventDefault();
        addNoteAtCurrentPosition('key');
    };
    recordingTapHandler = (event) => {
        event.preventDefault();
        addNoteAtCurrentPosition('tap');
    };
    recordingEndedHandler = () => stopAdminRhythmRecording();
    document.addEventListener('keydown', recordingKeyHandler);
    document.getElementById('admin-rhythm-tap-pad')?.addEventListener('pointerdown', recordingTapHandler);
    audio.addEventListener('ended', recordingEndedHandler);
    setAdminRhythmOverlay('スタート', true);
    setTimeout(() => {
        if (isRecording) setAdminRhythmOverlay('', false);
    }, 420);
    audio.play().catch(error => {
        console.warn('管理者リズム録音の再生に失敗しました:', error);
        stopAdminRhythmRecording();
        showCustomAlert('音声を再生できませんでした。ブラウザの音声許可やファイル形式を確認してください。');
    });
    updateDraftStatus(`${RHYTHM_DIFFICULTY_LABELS[difficulty]}を録音中です。F/J/スペース、または下のボタンでノーツを置けます。`);
}

function startAdminRhythmRecording() {
    const audio = getAudioElement();
    if (!audio || !getPreviewSource()) {
        showCustomAlert('先に音声ファイルを選んでください。');
        return;
    }
    stopAdminRhythmPreview();
    stopAdminRhythmTestPlay();
    stopAdminRhythmRecording();
    const difficulty = getSelectedDifficulty();
    draftCharts[difficulty] = [];
    selectedTimelineNote = null;
    audio.currentTime = 0;
    isRecordingCountdown = true;
    detachRecordingHandlers();
    let count = 3;
    setAdminRhythmOverlay(String(count), true);
    updateDraftStatus(`${RHYTHM_DIFFICULTY_LABELS[difficulty]}の録音を始めます。3カウント後に音が流れます。`);
    recordingCountdownTimer = setInterval(() => {
        count--;
        if (count > 0) {
            setAdminRhythmOverlay(String(count), true);
            updateDraftStatus(`${count}...`);
            return;
        }
        clearRecordingCountdown();
        beginAdminRhythmRecording(difficulty);
    }, 1000);
}

function undoAdminRhythmNote() {
    const difficulty = getSelectedDifficulty();
    draftCharts[difficulty].pop();
    selectedTimelineNote = null;
    updateDraftStatus(`${RHYTHM_DIFFICULTY_LABELS[difficulty]}の最後のノーツを消しました。`);
}

function clearAdminRhythmNotes() {
    const difficulty = getSelectedDifficulty();
    showCustomConfirm(`${RHYTHM_DIFFICULTY_LABELS[difficulty]}のノーツをすべて消しますか？`, () => {
        draftCharts[difficulty] = [];
        selectedTimelineNote = null;
        updateDraftStatus(`${RHYTHM_DIFFICULTY_LABELS[difficulty]}のノーツを消しました。`);
    });
}

function fillMissingCharts(charts) {
    const fallback = charts.normal.length ? charts.normal : charts.easy.length ? charts.easy : charts.hard;
    if (!fallback.length) return charts;
    RHYTHM_DIFFICULTIES.forEach((key) => {
        if (!charts[key].length) charts[key] = fallback.map(note => ({ ...note }));
    });
    return charts;
}

function getDurationSeconds(bpm, charts) {
    const audio = getAudioElement();
    if (audio && Number.isFinite(audio.duration) && audio.duration > 0) return Math.round(audio.duration * 100) / 100;
    const maxBeat = Math.max(0, ...Object.values(charts).flat().map(note => Number(note.beat) || 0));
    return Math.round((maxBeat * 60 / bpm + 3) * 100) / 100;
}

function makeStoragePath(file) {
    const ext = (file.name.split('.').pop() || 'mp3').toLowerCase().replace(/[^a-z0-9]/g, '') || 'mp3';
    const suffix = Math.random().toString(36).slice(2, 8);
    return `rhythm/${Date.now()}-${suffix}.${ext}`;
}

async function uploadRhythmAudio(file) {
    if (!supabase) throw new Error('Supabase接続がありません。');
    const storagePath = makeStoragePath(file);
    const { error } = await supabase.storage
        .from(RHYTHM_AUDIO_BUCKET)
        .upload(storagePath, file, {
            cacheControl: '3600',
            contentType: file.type || 'audio/mpeg',
            upsert: false
        });
    if (error) throw error;
    const { data } = supabase.storage.from(RHYTHM_AUDIO_BUCKET).getPublicUrl(storagePath);
    if (!data?.publicUrl) throw new Error('音声URLを取得できませんでした。');
    return {
        audioUrl: data.publicUrl,
        storageBucket: RHYTHM_AUDIO_BUCKET,
        storagePath
    };
}

async function saveAdminRhythmSong() {
    stopAdminRhythmRecording();
    stopAdminRhythmPreview();
    stopAdminRhythmTestPlay();
    const title = document.getElementById('admin-rhythm-title')?.value.trim() || '';
    const description = document.getElementById('admin-rhythm-description')?.value.trim() || '';
    const emoji = document.getElementById('admin-rhythm-emoji')?.value.trim() || '🎵';
    const bpm = getDraftBpm();
    const file = document.getElementById('admin-rhythm-file')?.files?.[0] || null;
    if (!title) {
        showCustomAlert('曲名を入力してください。');
        return;
    }

    const charts = fillMissingCharts(cloneCharts(draftCharts));
    const noteCount = Object.values(charts).reduce((sum, chart) => sum + chart.length, 0);
    if (!noteCount) {
        showCustomAlert('ノーツを1つ以上記録してください。');
        return;
    }

    let audioUrl = draftAudioUrl;
    let storageBucket = draftStorageBucket;
    let storagePath = draftStoragePath;
    try {
        if (file) {
            updateDraftStatus('音声ファイルをアップロードしています...');
            const uploaded = await uploadRhythmAudio(file);
            audioUrl = uploaded.audioUrl;
            storageBucket = uploaded.storageBucket;
            storagePath = uploaded.storagePath;
        }
    } catch (error) {
        console.error('リズム音声アップロードエラー:', error);
        showCustomAlert(`音声ファイルをアップロードできませんでした。\nSupabase Storageの「${RHYTHM_AUDIO_BUCKET}」バケットと権限を確認してください。`);
        updateDraftStatus('アップロードに失敗しました。');
        return;
    }

    if (!audioUrl) {
        showCustomAlert('音声ファイルを選んでください。');
        return;
    }

    const songs = getCustomRhythmSongs();
    const previousSong = draftId ? songs.find(item => item.id === draftId) : null;
    const song = {
        id: draftId || `custom_rhythm_${Date.now()}`,
        title,
        description: description || '先生が追加したリズム曲です。',
        emoji,
        bpm,
        difficulty: '管理者作成',
        visible: previousSong?.visible !== false,
        audioUrl,
        storageBucket,
        storagePath,
        durationSeconds: getDurationSeconds(bpm, charts),
        charts,
        updatedAt: new Date().toISOString()
    };
    if (!draftId) song.createdAt = song.updatedAt;

    const existingIndex = songs.findIndex(item => item.id === song.id);
    if (existingIndex >= 0) songs[existingIndex] = { ...songs[existingIndex], ...song };
    else songs.push(song);

    recordAdminAudit(draftId ? 'リズム曲更新' : 'リズム曲追加', { title: song.title, notes: noteCount });
    const saved = await saveUsers(true);
    if (!saved) {
        showCustomAlert('保存に失敗しました。通信状態を確認してください。');
        return;
    }
    resetDraft();
    adminRhythmView = 'menu';
    renderAdminRhythmSongs();
    showCustomAlert('リズム曲を保存しました。児童側の曲選択に表示されます。');
}

function openNewAdminRhythmSongEditor() {
    resetDraft();
    adminRhythmView = 'editor';
    renderAdminRhythmSongs();
}

function backToAdminRhythmMenu() {
    stopAdminRhythmRecording();
    stopAdminRhythmPreview();
    stopAdminRhythmTestPlay();
    adminRhythmView = 'menu';
    renderAdminRhythmSongs();
}

async function deleteRhythmStorageObject(song) {
    if (!supabase || !song?.storageBucket || !song?.storagePath) return;
    try {
        await supabase.storage.from(song.storageBucket).remove([song.storagePath]);
    } catch (error) {
        console.warn('リズム音声の削除に失敗しました:', error);
    }
}

function editAdminRhythmSong(id) {
    const song = getCustomRhythmSongs().find(item => item.id === id);
    if (!song) return;
    stopAdminRhythmRecording();
    stopAdminRhythmPreview();
    stopAdminRhythmTestPlay();
    if (draftObjectUrl) URL.revokeObjectURL(draftObjectUrl);
    draftObjectUrl = '';
    draftId = song.id;
    draftAudioUrl = song.audioUrl || '';
    draftStorageBucket = song.storageBucket || '';
    draftStoragePath = song.storagePath || '';
    draftCharts = cloneCharts(song.charts);
    draftBpm = Number(song.bpm) || 100;
    selectedTimelineNote = null;
    adminRhythmView = 'editor';
    renderAdminRhythmSongs();
    updateDraftStatus('編集する曲を読み込みました。');
}

function toggleAdminRhythmSongVisible(id) {
    const song = getCustomRhythmSongs().find(item => item.id === id);
    if (!song) return;
    song.visible = song.visible === false;
    song.updatedAt = new Date().toISOString();
    recordAdminAudit('リズム曲表示切替', { title: song.title, visible: song.visible ? 'yes' : 'no' });
    void saveUsers(true);
    renderAdminRhythmSongs();
}

function deleteAdminRhythmSong(id) {
    const songs = getCustomRhythmSongs();
    const song = songs.find(item => item.id === id);
    if (!song) return;
    showCustomConfirm(`「${song.title}」を削除しますか？`, async () => {
        stopAdminRhythmRecording();
        const index = songs.findIndex(item => item.id === id);
        if (index >= 0) songs.splice(index, 1);
        await deleteRhythmStorageObject(song);
        recordAdminAudit('リズム曲削除', { title: song.title });
        await saveUsers(true);
        if (draftId === id) resetDraft();
        renderAdminRhythmSongs();
    });
}

function handleTimelineKeyboardNudge(event) {
    if (adminRhythmView !== 'editor') return;
    if (!document.getElementById('admin-rhythm-editor')) return;
    if (isRecording || isRecordingCountdown || isAdminTestPlaying) return;

    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        event.preventDefault();
        event.stopPropagation();
        const step = event.shiftKey ? ADMIN_RHYTHM_FAST_NUDGE_SECONDS : ADMIN_RHYTHM_NUDGE_SECONDS;
        nudgeSelectedTimelineNote(event.key === 'ArrowLeft' ? -step : step);
        return;
    }
    if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
        event.preventDefault();
        event.stopPropagation();
        const chart = getSelectedChart();
        if (!chart.length) return;
        const currentIndex = Math.max(0, getSelectedNoteIndex());
        const nextIndex = event.key === 'ArrowUp' ? currentIndex - 1 : currentIndex + 1;
        selectTimelineNoteByIndex(nextIndex);
        return;
    }
    if (event.key === 'Delete') {
        const targetName = String(event.target?.tagName || '').toLowerCase();
        if (['input', 'select', 'textarea'].includes(targetName) || event.target?.isContentEditable) return;
        event.preventDefault();
        event.stopPropagation();
        deleteSelectedTimelineNote();
    }
}

function bindAdminRhythmEvents() {
    document.getElementById('admin-rhythm-open-new')?.addEventListener('click', openNewAdminRhythmSongEditor);
    document.querySelectorAll('[data-rhythm-back-menu]').forEach(button => {
        button.addEventListener('click', backToAdminRhythmMenu);
    });
    document.getElementById('admin-rhythm-file')?.addEventListener('change', handleFileChange);
    document.getElementById('admin-rhythm-difficulty')?.addEventListener('change', () => {
        stopAdminRhythmPreview();
        updateDraftStatus();
    });
    document.getElementById('admin-rhythm-record-start')?.addEventListener('click', startAdminRhythmRecording);
    document.getElementById('admin-rhythm-record-stop')?.addEventListener('click', stopAdminRhythmRecording);
    document.getElementById('admin-rhythm-add-note')?.addEventListener('click', () => addNoteAtCurrentPosition('manual'));
    document.getElementById('admin-rhythm-undo-note')?.addEventListener('click', undoAdminRhythmNote);
    document.getElementById('admin-rhythm-clear-notes')?.addEventListener('click', clearAdminRhythmNotes);
    document.getElementById('admin-rhythm-preview-start')?.addEventListener('click', startAdminRhythmPreview);
    document.getElementById('admin-rhythm-preview-stop')?.addEventListener('click', () => {
        stopAdminRhythmPreview();
        stopAdminRhythmTestPlay();
        updateDraftStatus('プレビューを停止しました。');
    });
    document.getElementById('admin-rhythm-test-start')?.addEventListener('click', startAdminRhythmTestPlay);
    document.getElementById('admin-rhythm-timeline-zoom')?.addEventListener('input', event => {
        setTimelineZoom(event.target.value);
    });
    document.getElementById('admin-rhythm-timeline-zoom-out')?.addEventListener('click', () => {
        setTimelineZoom(getTimelineZoom() - ADMIN_RHYTHM_TIMELINE_ZOOM_STEP);
    });
    document.getElementById('admin-rhythm-timeline-zoom-in')?.addEventListener('click', () => {
        setTimelineZoom(getTimelineZoom() + ADMIN_RHYTHM_TIMELINE_ZOOM_STEP);
    });
    document.getElementById('admin-rhythm-timeline-zoom-reset')?.addEventListener('click', () => {
        setTimelineZoom(2);
    });
    document.querySelectorAll('[data-rhythm-nudge]').forEach(button => {
        button.addEventListener('click', () => nudgeSelectedTimelineNote(Number(button.dataset.rhythmNudge)));
    });
    document.getElementById('admin-rhythm-delete-selected')?.addEventListener('click', deleteSelectedTimelineNote);
    document.getElementById('admin-rhythm-timeline-notes')?.addEventListener('pointerdown', startTimelineNoteDrag);
    document.getElementById('admin-rhythm-timeline-notes')?.addEventListener('click', event => {
        const noteEl = event.target.closest('.admin-rhythm-timeline-note');
        if (!noteEl) return;
        selectTimelineNoteByIndex(Number(noteEl.dataset.noteIndex));
    });
    document.removeEventListener('pointermove', moveTimelineNoteDrag);
    document.removeEventListener('pointerup', endTimelineNoteDrag);
    document.removeEventListener('pointercancel', endTimelineNoteDrag);
    document.removeEventListener('keydown', handleTimelineKeyboardNudge);
    document.addEventListener('pointermove', moveTimelineNoteDrag);
    document.addEventListener('pointerup', endTimelineNoteDrag);
    document.addEventListener('pointercancel', endTimelineNoteDrag);
    document.addEventListener('keydown', handleTimelineKeyboardNudge);
    document.getElementById('admin-rhythm-save')?.addEventListener('click', () => void saveAdminRhythmSong());
    document.getElementById('admin-rhythm-new')?.addEventListener('click', () => {
        resetDraft();
        adminRhythmView = 'editor';
        renderAdminRhythmSongs();
    });
    document.querySelectorAll('[data-rhythm-edit]').forEach(button => {
        button.addEventListener('click', () => editAdminRhythmSong(button.dataset.rhythmEdit));
    });
    document.querySelectorAll('[data-rhythm-toggle]').forEach(button => {
        button.addEventListener('click', () => toggleAdminRhythmSongVisible(button.dataset.rhythmToggle));
    });
    document.querySelectorAll('[data-rhythm-delete]').forEach(button => {
        button.addEventListener('click', () => deleteAdminRhythmSong(button.dataset.rhythmDelete));
    });
    const audio = getAudioElement();
    audio?.addEventListener('timeupdate', renderDraftTimeline);
    audio?.addEventListener('loadedmetadata', renderDraftTimeline);
    audio?.addEventListener('seeked', renderDraftTimeline);
    setPreviewSource(getPreviewSource());
    updateDraftStatus();
}

function renderSongList() {
    const songs = getCustomRhythmSongs();
    if (!songs.length) {
        return '<div class="admin-rhythm-empty">追加したリズム曲はまだありません。</div>';
    }
    return songs.map(song => {
        const charts = cloneCharts(song.charts);
        const total = Object.values(charts).reduce((sum, chart) => sum + chart.length, 0);
        const visible = song.visible !== false;
        return `
            <div class="admin-rhythm-song-row">
                <div class="admin-rhythm-song-main">
                    <span class="admin-rhythm-song-emoji">${escapeHtml(song.emoji || '🎵')}</span>
                    <div>
                        <strong>${escapeHtml(song.title || '無題')}</strong>
                        <small>${escapeHtml(song.description || '')}</small>
                        <span>ノーツ ${total}こ / ${visible ? '表示中' : '非表示'}</span>
                    </div>
                </div>
                <div class="admin-rhythm-song-actions">
                    <button type="button" data-rhythm-edit="${escapeHtml(song.id)}">編集</button>
                    <button type="button" data-rhythm-toggle="${escapeHtml(song.id)}">${visible ? '非表示' : '表示'}</button>
                    <button type="button" class="danger" data-rhythm-delete="${escapeHtml(song.id)}">削除</button>
                </div>
            </div>
        `;
    }).join('');
}

export function renderAdminRhythmSongs() {
    const container = document.getElementById('admin-rhythm-container');
    if (!container) return;
    if (adminRhythmView !== 'editor') {
        container.innerHTML = `
            <div class="admin-rhythm-menu">
                <section class="admin-rhythm-menu-hero">
                    <div>
                        <h4>リズム曲の作成</h4>
                        <p>音声ファイルを使って、児童が遊ぶリズム曲とノーツを作成します。</p>
                    </div>
                    <button type="button" id="admin-rhythm-open-new" class="admin-rhythm-primary-action">新規追加</button>
                </section>
                <section class="admin-rhythm-menu-section">
                    <div class="admin-rhythm-section-head">
                        <div>
                            <h4>作成済み曲の編集</h4>
                            <p>編集、表示/非表示、削除をここから行います。</p>
                        </div>
                        <span>${getCustomRhythmSongs().length}曲</span>
                    </div>
                    ${renderSongList()}
                </section>
            </div>
        `;
        bindAdminRhythmEvents();
        return;
    }
    const editingSong = draftId ? getCustomRhythmSongs().find(song => song.id === draftId) : null;
    container.innerHTML = `
        <div class="admin-rhythm-layout admin-rhythm-layout-editor">
            <div id="admin-rhythm-editor" class="admin-rhythm-editor">
                <div class="admin-rhythm-editor-head">
                    <button type="button" data-rhythm-back-menu>曲一覧へ戻る</button>
                    <span>${editingSong ? '作成済み曲の編集' : '新規追加'}</span>
                </div>
                <h4>${editingSong ? '曲を編集' : '曲を追加'}</h4>
                <p class="admin-rhythm-note">音声を選び、曲を再生しながら F / J / スペース、または大きいボタンでノーツを置きます。</p>
                <div class="admin-rhythm-form-grid">
                    <label>曲名
                        <input id="admin-rhythm-title" type="text" value="${escapeHtml(editingSong?.title || '')}" placeholder="例: ぽんぽんリズム1">
                    </label>
                    <label>絵文字
                        <input id="admin-rhythm-emoji" type="text" value="${escapeHtml(editingSong?.emoji || '🎵')}" maxlength="4">
                    </label>
                    <label>難易度
                        <select id="admin-rhythm-difficulty">
                            <option value="easy">イージー</option>
                            <option value="normal" selected>ノーマル</option>
                            <option value="hard">ハード</option>
                        </select>
                    </label>
                </div>
                <label class="admin-rhythm-wide-label">説明
                    <input id="admin-rhythm-description" type="text" value="${escapeHtml(editingSong?.description || '')}" placeholder="例: ゆっくり合わせる練習">
                </label>
                <label class="admin-rhythm-wide-label">音声ファイル
                    <input id="admin-rhythm-file" type="file" accept="audio/*">
                </label>
                <audio id="admin-rhythm-audio" controls></audio>
                <div id="admin-rhythm-note-counts" class="admin-rhythm-note-counts"></div>
                <div class="admin-rhythm-timeline" aria-label="ノーツ配置">
                    <div class="admin-rhythm-timeline-head">
                        <span>ノーツの位置</span>
                        <small id="admin-rhythm-timeline-time">0.0秒 / 0.0秒</small>
                    </div>
                    <div class="admin-rhythm-timeline-tools">
                        <button type="button" id="admin-rhythm-timeline-zoom-out">縮小</button>
                        <label>
                            <span>編集バーの表示倍率</span>
                            <input
                                id="admin-rhythm-timeline-zoom"
                                type="range"
                                min="${ADMIN_RHYTHM_TIMELINE_ZOOM_MIN}"
                                max="${ADMIN_RHYTHM_TIMELINE_ZOOM_MAX}"
                                step="${ADMIN_RHYTHM_TIMELINE_ZOOM_STEP}"
                                value="${getTimelineZoom()}">
                        </label>
                        <strong id="admin-rhythm-timeline-zoom-label">${Math.round(getTimelineZoom() * 100)}%</strong>
                        <button type="button" id="admin-rhythm-timeline-zoom-in">拡大</button>
                        <button type="button" id="admin-rhythm-timeline-zoom-reset">標準</button>
                    </div>
                    <div id="admin-rhythm-selected-note" class="admin-rhythm-selected-note"></div>
                    <div class="admin-rhythm-nudge-actions">
                        <button type="button" data-rhythm-nudge="-0.1">← 0.1秒</button>
                        <button type="button" data-rhythm-nudge="-0.02">← 0.02秒</button>
                        <button type="button" data-rhythm-nudge="0.02">0.02秒 →</button>
                        <button type="button" data-rhythm-nudge="0.1">0.1秒 →</button>
                        <button type="button" id="admin-rhythm-delete-selected" class="danger">選択中ノーツを削除</button>
                    </div>
                    <p class="admin-rhythm-timeline-help">青い丸を左右にドラッグすると、ノーツの位置を調整できます。</p>
                    <div class="admin-rhythm-timeline-scroll">
                        <div id="admin-rhythm-timeline-track" class="admin-rhythm-timeline-track">
                            <div id="admin-rhythm-timeline-ruler" class="admin-rhythm-timeline-ruler"></div>
                            <div id="admin-rhythm-timeline-playhead" class="admin-rhythm-timeline-playhead"></div>
                            <div id="admin-rhythm-timeline-notes" class="admin-rhythm-timeline-notes"></div>
                        </div>
                    </div>
                </div>
                <div class="admin-rhythm-preview-panel">
                    <div class="admin-rhythm-preview-head">
                        <div>
                            <strong>プレイ画面プレビュー</strong>
                            <small>編集したノーツはここにすぐ反映されます。テストプレイではF/J/スペースで判定を確認できます。</small>
                        </div>
                        <div class="admin-rhythm-preview-actions">
                            <button type="button" id="admin-rhythm-preview-start">プレビュー再生</button>
                            <button type="button" id="admin-rhythm-test-start">テストプレイ</button>
                            <button type="button" id="admin-rhythm-preview-stop">停止</button>
                        </div>
                    </div>
                    <div class="admin-rhythm-test-hud">
                        <span>スコア <strong id="admin-rhythm-test-score">0</strong></span>
                        <span>コンボ <strong id="admin-rhythm-test-combo">0</strong></span>
                        <span>ミス <strong id="admin-rhythm-test-miss">0</strong></span>
                        <em id="admin-rhythm-test-feedback">ここに判定が出ます</em>
                    </div>
                    <div class="rhythm-stage admin-rhythm-play-preview" id="admin-rhythm-play-preview">
                        <div class="rhythm-target">
                            <button class="rhythm-target-drum" type="button" tabindex="-1">🥁</button>
                            <span class="rhythm-target-label">ここでポン</span>
                        </div>
                        <div class="rhythm-note-layer" id="admin-rhythm-preview-notes" aria-hidden="true"></div>
                        <div class="rhythm-countdown" id="admin-rhythm-preview-countdown" style="display:none;"></div>
                    </div>
                </div>
                <div class="admin-rhythm-record-actions">
                    <button type="button" id="admin-rhythm-record-start">録音開始</button>
                    <button type="button" id="admin-rhythm-record-stop">停止</button>
                    <button type="button" id="admin-rhythm-add-note">現在位置に追加</button>
                    <button type="button" id="admin-rhythm-undo-note">1つ戻す</button>
                    <button type="button" id="admin-rhythm-clear-notes">この難易度を消す</button>
                </div>
                <button type="button" id="admin-rhythm-tap-pad" class="admin-rhythm-tap-pad">ここでポン</button>
                <div id="admin-rhythm-status" class="admin-rhythm-status"></div>
                <div class="admin-rhythm-save-actions">
                    <button type="button" id="admin-rhythm-save" class="primary">保存</button>
                    <button type="button" id="admin-rhythm-new">新規追加として作り直す</button>
                    <button type="button" data-rhythm-back-menu>曲一覧へ戻る</button>
                </div>
                <p class="admin-rhythm-storage-note">初回のみ Supabase Storage の <code>${RHYTHM_AUDIO_BUCKET}</code> バケット設定が必要です。</p>
            </div>
        </div>
    `;
    bindAdminRhythmEvents();
}
