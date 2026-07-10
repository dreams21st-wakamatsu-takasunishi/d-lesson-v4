import {
    VISION_STAGES,
    EXAMS,
    STAGE_ORDER,
    KB_LAYOUT,
    THEMES,
    EFFECTS
} from '../data/constants.js';
import {
    users,
    currentUser,
    GLOBAL_SETTINGS_ID,
    canWriteCurrentUserRow,
    isSystemUserId,
    saveUsers
} from '../api/user.js';
import { renderCertificateSection } from './certificates.js';
import { renderPracticeHistorySection } from './practice-history.js';
import { showCustomAlert } from './modal.js';
import { getValidMistakeEntries, normalizeMistakeCount } from '../utils/weak-mistakes.js';
import {
    buildVisionRadarData,
    buildVisionRadarBenchmarkData,
    buildVisionRadarDataFromAverageSnapshot,
    renderVisionRadarChart
} from './admin-report-utils.js';

const THEME_CATEGORY_RULES = [
    {
        name: '基本・学習',
        ids: ['default', 'classroom', 'library', 'workshop', 'paper', 'chalk', 'map', 'compass', 'puzzle', 'piano']
    },
    {
        name: '自然・季節',
        ids: ['ocean', 'sakura', 'spring', 'sunflower', 'autumn', 'ice', 'forest', 'desert', 'beach', 'deepsea', 'jungle', 'frog', 'garden', 'fireworks', 'snowtown', 'rain', 'cloud']
    },
    {
        name: '冒険・ファンタジー',
        ids: ['magic', 'space', 'ninja', 'night', 'volcano', 'rainbow', 'sunset', 'cave', 'savanna', 'penguin', 'dino', 'insect', 'nebula', 'castle_gold', 'aurora', 'star_room', 'moonlight', 'rocket_base', 'cloud_castle', 'treasure']
    },
    {
        name: '色・デザイン',
        ids: ['crystal', 'candy', 'festival', 'music', 'sports', 'mint', 'lavender', 'peach', 'cocoa', 'marble', 'neon', 'cyber', 'retro', 'lemon', 'soda', 'grape', 'coral', 'emerald', 'royal', 'pearl', 'tea', 'candy_night', 'prism', 'candy_shop', 'morning', 'bakery', 'robot_lab', 'ribbon', 'pastel']
    }
];

const EFFECT_CATEGORY_RULES = [
    {
        name: '基本・かわいい',
        ids: ['default', 'effect_star', 'effect_heart', 'effect_flower', 'effect_snow', 'eff_candy', 'eff_mint', 'eff_lavender', 'eff_peach', 'eff_ribbon', 'eff_pastel']
    },
    {
        name: '自然・季節',
        ids: ['eff_spring', 'eff_sunflower', 'eff_autumn', 'eff_ice', 'eff_volcano', 'eff_forest', 'eff_desert', 'eff_rainbow', 'eff_beach', 'eff_deepsea', 'eff_frog', 'eff_garden', 'eff_fireworks', 'eff_snowtown', 'eff_rain', 'eff_cloud']
    },
    {
        name: 'どうぶつ・冒険',
        ids: ['eff_cave', 'eff_savanna', 'eff_penguin', 'eff_dino', 'eff_insect', 'eff_jungle', 'eff_nebula', 'eff_castle_gold', 'eff_map', 'eff_compass', 'eff_rocket_base', 'eff_cloud_castle', 'eff_treasure']
    },
    {
        name: 'きらきら・イベント',
        ids: ['eff_crystal', 'eff_festival', 'eff_classroom', 'eff_library', 'eff_music', 'eff_sports', 'eff_workshop', 'eff_aurora', 'eff_cocoa', 'eff_marble', 'eff_neon', 'eff_cyber', 'eff_retro', 'eff_paper', 'eff_chalk', 'eff_lemon', 'eff_soda', 'eff_grape', 'eff_coral', 'eff_emerald', 'eff_royal', 'eff_pearl', 'eff_tea', 'eff_candy_night', 'eff_prism', 'eff_candy_shop', 'eff_star_room', 'eff_moonlight', 'eff_morning', 'eff_bakery', 'eff_robot_lab', 'eff_puzzle', 'eff_piano']
    }
];

function countCurrentVisionClears(user) {
    const validIds = new Set(VISION_STAGES.flatMap(stage => [
        stage.id,
        `${stage.id}_easy`,
        `${stage.id}_hard`
    ]));
    return new Set((Array.isArray(user?.visionCleared) ? user.visionCleared : [])
        .map(id => String(id))
        .filter(id => validIds.has(id)))
        .size;
}

function escapeAttr(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

function escapeJs(value) {
    return String(value ?? '')
        .replace(/\\/g, '\\\\')
        .replace(/'/g, "\\'")
        .replace(/\r/g, '\\r')
        .replace(/\n/g, '\\n');
}

function normalizeStyleSettings(user) {
    if (!Array.isArray(user.themeFavorites)) user.themeFavorites = [];
    if (!Array.isArray(user.effectFavorites)) user.effectFavorites = [];
    user.themeFavorites = Array.from(new Set(user.themeFavorites.map(String)));
    user.effectFavorites = Array.from(new Set(user.effectFavorites.map(String)));
    user.randomThemeEnabled = Boolean(user.randomThemeEnabled);
    user.randomEffectEnabled = Boolean(user.randomEffectEnabled);
}

function isThemeUnlocked(user, theme) {
    if (!theme || !user) return false;
    const checkId = theme.isCustom ? theme.id : `theme_${theme.id}`;
    return theme.id === 'default'
        || user.isMaster
        || (Array.isArray(user.items) && (user.items.includes(checkId) || user.items.includes(theme.id)));
}

function isEffectUnlocked(user, effect) {
    if (!effect || !user) return false;
    return effect.id === 'default'
        || user.isMaster
        || (Array.isArray(user.items) && user.items.includes(effect.id));
}

function getCategoryName(itemId, rules) {
    const rule = rules.find(entry => entry.ids.includes(itemId));
    return rule?.name || 'そのほか';
}

function groupItems(items, rules) {
    const groups = new Map();
    items.forEach(item => {
        const category = getCategoryName(item.id, rules);
        if (!groups.has(category)) groups.set(category, []);
        groups.get(category).push(item);
    });
    return groups;
}

function unlockedFavoriteCount(user, type) {
    const favorites = type === 'theme' ? user.themeFavorites : user.effectFavorites;
    const items = type === 'theme' ? THEMES : EFFECTS;
    const checker = type === 'theme' ? isThemeUnlocked : isEffectUnlocked;
    return favorites.filter(id => {
        const item = items.find(entry => entry.id === id);
        return item && checker(user, item);
    }).length;
}

function toggleFavorite(user, type, itemId) {
    normalizeStyleSettings(user);
    const key = type === 'theme' ? 'themeFavorites' : 'effectFavorites';
    const index = user[key].indexOf(itemId);
    if (index >= 0) user[key].splice(index, 1);
    else user[key].push(itemId);

    if (type === 'theme' && user.randomThemeEnabled && unlockedFavoriteCount(user, 'theme') === 0) {
        user.randomThemeEnabled = false;
    }
    if (type === 'effect' && user.randomEffectEnabled && unlockedFavoriteCount(user, 'effect') === 0) {
        user.randomEffectEnabled = false;
    }
}

function rerenderThemeEffectSection() {
    renderRecords();
    showRecordSection('rec-theme');
}

function ensureCanChangeStyle() {
    if (!users[currentUser] || !canWriteCurrentUserRow()) {
        showCustomAlert('かくにん用の画面では、きせかえはほぞんされません。児童本人でログインしてからかえてください。');
        return false;
    }
    return true;
}

export function toggleThemeFavorite(themeId) {
    if (!ensureCanChangeStyle()) return;
    const user = users[currentUser];
    const theme = THEMES.find(item => item.id === themeId);
    if (!isThemeUnlocked(user, theme)) return showCustomAlert('ガチャでゲットするとおきにいりにできます。');
    toggleFavorite(user, 'theme', themeId);
    saveUsers(false);
    rerenderThemeEffectSection();
}

export function toggleEffectFavorite(effectId) {
    if (!ensureCanChangeStyle()) return;
    const user = users[currentUser];
    const effect = EFFECTS.find(item => item.id === effectId);
    if (!isEffectUnlocked(user, effect)) return showCustomAlert('ガチャでゲットするとおきにいりにできます。');
    toggleFavorite(user, 'effect', effectId);
    saveUsers(false);
    rerenderThemeEffectSection();
}

export function toggleRandomTheme() {
    if (!ensureCanChangeStyle()) return;
    const user = users[currentUser];
    normalizeStyleSettings(user);
    if (!user.randomThemeEnabled && unlockedFavoriteCount(user, 'theme') === 0) {
        showCustomAlert('ランダムきせかえをつかうには、先にきせかえを1つ以上おきにいりにしてください。');
        return;
    }
    user.randomThemeEnabled = !user.randomThemeEnabled;
    saveUsers(false);
    rerenderThemeEffectSection();
}

export function toggleRandomEffect() {
    if (!ensureCanChangeStyle()) return;
    const user = users[currentUser];
    normalizeStyleSettings(user);
    if (!user.randomEffectEnabled && unlockedFavoriteCount(user, 'effect') === 0) {
        showCustomAlert('ランダムえんしゅつをつかうには、先にえんしゅつを1つ以上おきにいりにしてください。');
        return;
    }
    user.randomEffectEnabled = !user.randomEffectEnabled;
    saveUsers(false);
    rerenderThemeEffectSection();
}

export function showRecordSection(secId) {
    document.getElementById('records-main-menu').style.display = 'none';
    document.getElementById('records-panel-content').style.display = 'flex';
    document.getElementById('records-bottom-back-btn').style.display = 'none';
    document.querySelectorAll('.record-section-content').forEach(el => { el.style.display = 'none'; });
    const target = document.getElementById(secId);
    if (target) target.style.display = 'block';
}

export function backToRecordMenu() {
    document.getElementById('records-main-menu').style.display = 'grid';
    document.getElementById('records-panel-content').style.display = 'none';
    document.getElementById('records-bottom-back-btn').style.display = 'block';
    if (users[currentUser]) document.getElementById('global-coin-display').innerText = `🪙 ${users[currentUser].coins || 0}`;
}

function renderGachaSection(container, user, canSaveResult) {
    container.innerHTML = `<div class="gacha-section">
        <div class="coin-display">🪙 コイン: ${user.coins || 0} 枚</div>
        ${canSaveResult ? '<p style="margin: 5px 0 15px 0;">ガチャをひいて、きせかえやえんしゅつをゲットしよう！</p>' : '<p style="margin: 5px 0 15px 0; color:#00695c; font-weight:bold;">先生のかくにん中は、ガチャ・チケット・きせかえはほぞんされません。</p>'}
        ${canSaveResult ? `
            <div style="display:flex; justify-content:center; gap:15px; flex-wrap:wrap;">
                <button class="btn-gacha" style="padding: 10px 20px; font-size: 20px;" onclick="drawGacha(1)">1回 (100)</button>
                <button class="btn-gacha" style="padding: 10px 20px; font-size: 20px; background:linear-gradient(135deg, #4CAF50, #8BC34A);" onclick="drawGacha(10)">10回 (1000)</button>
                <button class="btn-gacha" style="padding: 10px 20px; font-size: 20px; background:linear-gradient(135deg, #E91E63, #9C27B0);" onclick="drawGacha(1, true)">🔮 レア確定 (500)</button>
            </div>
        ` : `
            <div style="padding:12px; border:2px solid #80cbc4; border-radius:8px; background:#e0f2f1; color:#004d40; font-weight:bold;">かくにん用のため、ほぞんする操作はできません。</div>
        `}
    </div>`;

    if (user.tickets && user.tickets.length > 0) {
        container.innerHTML += '<h3 style="color:#FF5722;">🎟️ もっている ひきかえけん</h3>';
        container.innerHTML += '<p class="ticket-use-note">いいねポイントを使うときは、先生に画面を見せてからボタンを押してください。</p>';
        user.tickets.forEach((ticket, index) => {
            const ticketButton = canSaveResult
                ? `<button class="ticket-btn" onclick="useTicket(${index})">この場でつかう</button>`
                : '<button class="ticket-btn" disabled style="opacity:0.5; cursor:not-allowed;">かくにん用</button>';
            container.innerHTML += `<div class="ticket-card"><div><div class="ticket-name">${escapeAttr(ticket.name)}</div><div style="font-size:12px; color:#555;">ゲットした日: ${escapeAttr(ticket.date)}</div></div>${ticketButton}</div>`;
        });
    } else {
        container.innerHTML += '<div class="ticket-empty-card">いま使えるいいねポイントはありません。</div>';
    }
}

function renderRandomPanel(user) {
    const themeFavs = unlockedFavoriteCount(user, 'theme');
    const effectFavs = unlockedFavoriteCount(user, 'effect');
    return `
        <div class="style-random-panel">
            <div>
                <h3>⭐ お気に入りランダム</h3>
                <p>お気に入りにしたものだけを、ログイン時にランダムで切り替えます。</p>
            </div>
            <div class="style-random-actions">
                <button class="style-random-toggle ${user.randomThemeEnabled ? 'is-on' : ''}" onclick="toggleRandomTheme()">
                    きせかえ ${user.randomThemeEnabled ? 'ON' : 'OFF'} <span>${themeFavs}件</span>
                </button>
                <button class="style-random-toggle ${user.randomEffectEnabled ? 'is-on' : ''}" onclick="toggleRandomEffect()">
                    えんしゅつ ${user.randomEffectEnabled ? 'ON' : 'OFF'} <span>${effectFavs}件</span>
                </button>
            </div>
        </div>
    `;
}

function renderStyleCard(item, options) {
    const {
        type,
        unlocked,
        active,
        favorite
    } = options;
    const selectFn = type === 'theme' ? 'changeTheme' : 'changeEffect';
    const favoriteFn = type === 'theme' ? 'toggleThemeFavorite' : 'toggleEffectFavorite';
    const lockedAction = "showCustomAlert('ガチャでゲットするとつかえるよ！')";
    const clickAction = unlocked ? `${selectFn}('${escapeJs(item.id)}')` : lockedAction;
    const favoriteAction = unlocked ? `${favoriteFn}('${escapeJs(item.id)}')` : lockedAction;
    const favoriteLabel = favorite ? 'お気に入り中' : 'お気に入り';
    return `
        <div class="style-card ${unlocked ? '' : 'locked'} ${active ? 'active' : ''}">
            <button class="style-equip-btn" onclick="${clickAction}">
                <span class="style-icon">${item.icon}</span>
                <span class="style-name">${escapeAttr(item.name)}</span>
                <span class="style-state">${active ? '使用中' : (unlocked ? 'つかう' : 'ロック')}</span>
            </button>
            <button class="style-favorite-btn ${favorite ? 'is-favorite' : ''}" onclick="${favoriteAction}" aria-label="${favoriteLabel}" title="${favoriteLabel}">
                ${favorite ? '★' : '☆'}
            </button>
        </div>
    `;
}

function renderStyleGroup(title, items, type, user) {
    const isTheme = type === 'theme';
    const favorites = isTheme ? user.themeFavorites : user.effectFavorites;
    const activeId = isTheme ? user.theme : user.activeEffect;
    const unlockedChecker = isTheme ? isThemeUnlocked : isEffectUnlocked;
    return `
        <section class="style-category">
            <h4>${escapeAttr(title)}</h4>
            <div class="style-card-grid">
                ${items.map(item => renderStyleCard(item, {
                    type,
                    unlocked: unlockedChecker(user, item),
                    active: activeId === item.id,
                    favorite: favorites.includes(item.id)
                })).join('')}
            </div>
        </section>
    `;
}

function renderThemeEffectSection(container, user) {
    normalizeStyleSettings(user);
    const themeGroups = groupItems(THEMES, THEME_CATEGORY_RULES);
    const effectGroups = groupItems(EFFECTS, EFFECT_CATEGORY_RULES);
    container.innerHTML = `
        ${renderRandomPanel(user)}
        <div class="style-board">
            <div class="style-board-column">
                <div class="style-board-head">
                    <h3>🎨 きせかえ</h3>
                    <p>画面の色や雰囲気を変えます。</p>
                </div>
                ${Array.from(themeGroups.entries()).map(([name, items]) => renderStyleGroup(name, items, 'theme', user)).join('')}
            </div>
            <div class="style-board-column">
                <div class="style-board-head">
                    <h3>🎉 えんしゅつ</h3>
                    <p>クリア時の紙吹雪を変えます。</p>
                </div>
                ${Array.from(effectGroups.entries()).map(([name, items]) => renderStyleGroup(name, items, 'effect', user)).join('')}
            </div>
        </div>
    `;
}

function renderTimeRecordsSection(container, user) {
    container.innerHTML = '';
    const records = user.examRecords || {};
    let kbTimes = '<h4 class="record-subtitle">⌨️ キーボード タイムアタック</h4><div class="record-chip-list">';
    let hasKbRecord = false;
    EXAMS.forEach(exam => {
        if (records[exam.id]) {
            hasKbRecord = true;
            let medal = '🥉';
            if (records[exam.id] <= exam.gold) medal = '🥇';
            else if (records[exam.id] <= exam.silver) medal = '🥈';
            kbTimes += `<div class="record-chip">${escapeAttr(exam.title)}: <span>${records[exam.id].toFixed(1)}秒</span> ${medal}</div>`;
        }
    });
    if (!hasKbRecord) kbTimes += '<span class="record-empty-inline">まだきろくがありません</span>';

    let visionTimes = '<h4 class="record-subtitle">👁️ ビジョンのきろく</h4><div class="record-chip-list">';
    let hasVisionRecord = false;
    VISION_STAGES.forEach(stage => {
        [
            { suffix: '_easy', label: 'イージー', cls: 'easy' },
            { suffix: '', label: 'ノーマル', cls: 'normal' },
            { suffix: '_hard', label: 'ハード', cls: 'hard' }
        ].forEach(diff => {
            const value = records[stage.id + diff.suffix];
            if (!value) return;
            hasVisionRecord = true;
            visionTimes += `<div class="record-chip ${diff.cls}">${escapeAttr(stage.title)} (${diff.label}): <span>${value.toFixed(1)}秒</span></div>`;
        });
    });
    if (!hasVisionRecord) visionTimes += '<span class="record-empty-inline">まだきろくがありません</span>';

    container.innerHTML = `${kbTimes}</div>${visionTimes}</div>`;
}

function getSharedVisionRadarAverageSnapshot() {
    const snapshot = users?.[GLOBAL_SETTINGS_ID]?.visionRadarAverageSnapshot;
    return snapshot && Array.isArray(snapshot.groups) ? snapshot : null;
}

function renderGraphSection(container, user) {
    container.innerHTML = '';
    const graphGrid = document.createElement('div');
    graphGrid.className = 'record-graph-grid';

    const mouseLevel = user.mouseLevel || 0;
    const keyboardSequence = user.keyboardSequence || 0;
    const visionPercent = Math.min(100, Math.floor((countCurrentVisionClears(user) / (VISION_STAGES.length * 3)) * 100));
    graphGrid.innerHTML += `<div class="record-graph-card">
        <h4 style="margin-top:0; color:#555; border-bottom:2px solid #eee; padding-bottom:10px;">🎮 ぜんたいのすすみ</h4>
        <div class="record-progress-row"><span>🖱️ マウス</span><b>${Math.floor((mouseLevel / 7) * 100)}%</b></div><div class="record-progress"><div style="width:${Math.floor((mouseLevel / 7) * 100)}%; background:#2196F3;"></div></div>
        <div class="record-progress-row"><span>⌨️ キーボード</span><b>${Math.floor((keyboardSequence / STAGE_ORDER.length) * 100)}%</b></div><div class="record-progress"><div style="width:${Math.floor((keyboardSequence / STAGE_ORDER.length) * 100)}%; background:#FF9800;"></div></div>
        <div class="record-progress-row"><span>👁️ ビジョン</span><b>${visionPercent}%</b></div><div class="record-progress"><div style="width:${visionPercent}%; background:#9C27B0;"></div></div>
    </div>`;

    const radarDiv = document.createElement('div');
    const sharedAverageSnapshot = getSharedVisionRadarAverageSnapshot();
    const sharedAverageData = sharedAverageSnapshot
        ? buildVisionRadarDataFromAverageSnapshot(user, sharedAverageSnapshot, VISION_STAGES)
        : null;
    const comparableVisionUsers = Object.fromEntries(Object.entries(users || {}).filter(([userId, row]) => {
        if (!userId || !row || row.isMaster) return false;
        if (String(userId).startsWith('__')) return false;
        if (typeof isSystemUserId === 'function' && isSystemUserId(userId)) return false;
        return Boolean(row.examRecords && typeof row.examRecords === 'object');
    }));
    const liveAverageData = Object.keys(comparableVisionUsers).length > 1
        ? buildVisionRadarData(user, comparableVisionUsers, VISION_STAGES, isSystemUserId)
        : null;
    const benchmarkRadarData = buildVisionRadarBenchmarkData(user, VISION_STAGES);
    const radarData = sharedAverageData || liveAverageData || benchmarkRadarData;
    const radarTitle = sharedAverageData || liveAverageData
        ? '👁️ ビジョンのみんなとの差'
        : '👁️ ビジョンのきろく';
    radarDiv.innerHTML = renderVisionRadarChart(radarData, { title: radarTitle });
    const myPageRadarCard = radarDiv.firstElementChild;
    if (!sharedAverageData && !liveAverageData) {
        const myPageRadarBasis = myPageRadarCard?.querySelector('.vision-radar-head span');
        if (myPageRadarBasis) myPageRadarBasis.textContent = 'めやす 100';
        myPageRadarCard?.querySelectorAll('.vision-radar-summary span, .vision-radar-legend span, .vision-radar-note').forEach(element => {
            element.textContent = element.textContent.replace(/平均/g, 'めやす');
        });
    }
    if (myPageRadarCard) graphGrid.appendChild(myPageRadarCard);

    const weakDiv = document.createElement('div');
    weakDiv.className = 'record-graph-card';
    weakDiv.innerHTML = '<h4 style="margin-top:0; color:#555; border-bottom:2px solid #eee; padding-bottom:10px;">⚠️ にがてなキー</h4>';
    const mistakes = user.globalMistakes || {};
    const sorted = getValidMistakeEntries(mistakes);

    if (sorted.length === 0) {
        weakDiv.innerHTML += '<div style="color:#4CAF50; font-weight:bold; margin-top:20px; text-align:center; font-size:20px;">✨ すばらしい！<br>にがてなキーはまだありません。</div>';
    } else {
        const maxMiss = sorted[0].count;
        let heatmapHtml = '<div class="heatmap-kb">';
        KB_LAYOUT.forEach(row => {
            heatmapHtml += '<div class="heatmap-row">';
            row.forEach(key => {
                const display = key === 'SPACE' ? '空白' : key;
                const count = normalizeMistakeCount(mistakes[key]);
                const percent = maxMiss > 0 ? (count / maxMiss) * 100 : 0;
                const cls = key === 'SPACE' ? 'heatmap-key space' : 'heatmap-key';
                heatmapHtml += `<div class="${cls}" title="${display}: ${count}回ミス"><div class="heatmap-bg" style="height:${percent}%;"></div><span class="heatmap-text">${display}</span></div>`;
            });
            heatmapHtml += '</div>';
        });
        heatmapHtml += '</div><div style="text-align:center; font-size:12px; color:#999; margin-top:5px;">※ミスが多いキーほど赤くなります</div>';
        weakDiv.innerHTML += heatmapHtml;
    }
    graphGrid.appendChild(weakDiv);
    container.appendChild(graphGrid);
}

function renderLearningSection(container, user) {
    container.innerHTML = '';
    const layout = document.createElement('div');
    layout.className = 'record-learning-layout';

    const graph = document.createElement('section');
    graph.className = 'record-combined-panel record-learning-graph';
    graph.innerHTML = '<h3>📊 せいせきグラフ</h3>';
    const graphBody = document.createElement('div');
    renderGraphSection(graphBody, user);
    graph.appendChild(graphBody);
    layout.appendChild(graph);

    const times = document.createElement('section');
    times.className = 'record-combined-panel record-learning-times';
    times.innerHTML = '<h3>⏱️ タイムアタック</h3>';
    const timesBody = document.createElement('div');
    renderTimeRecordsSection(timesBody, user);
    times.appendChild(timesBody);
    layout.appendChild(times);

    const practice = document.createElement('section');
    practice.className = 'record-combined-panel record-learning-practice';
    practice.innerHTML = '<h3>📝 とりくみきろく</h3>';
    const practiceBody = document.createElement('div');
    renderPracticeHistorySection(practiceBody, currentUser);
    practice.appendChild(practiceBody);
    layout.appendChild(practice);
    container.appendChild(layout);
}

function renderAchievementSection(container) {
    container.innerHTML = '';
    const certificates = document.createElement('section');
    certificates.className = 'record-combined-panel record-certificate-panel';
    certificates.innerHTML = '<h3>🏅 しょうじょう</h3>';
    const certificateBody = document.createElement('div');
    certificateBody.className = 'record-certificate-body';
    renderCertificateSection(certificateBody, currentUser);
    certificates.appendChild(certificateBody);
    container.appendChild(certificates);
}

export function renderRecords() {
    backToRecordMenu();
    const user = users[currentUser];
    if (!user) return;
    normalizeStyleSettings(user);
    const canSaveResult = canWriteCurrentUserRow();

    const practiceCont = document.getElementById('rec-practice');
    if (practiceCont) renderPracticeHistorySection(practiceCont, currentUser);

    const certificateCont = document.getElementById('rec-certificate');
    if (certificateCont) renderCertificateSection(certificateCont, currentUser);

    const gachaCont = document.getElementById('rec-gacha');
    if (gachaCont) renderGachaSection(gachaCont, user, canSaveResult);

    const themeCont = document.getElementById('rec-theme');
    if (themeCont) renderThemeEffectSection(themeCont, user);

    const timeCont = document.getElementById('rec-time');
    if (timeCont) renderTimeRecordsSection(timeCont, user);

    const graphCont = document.getElementById('rec-graph');
    if (graphCont) renderGraphSection(graphCont, user);

    const learningCont = document.getElementById('rec-learning');
    if (learningCont) renderLearningSection(learningCont, user);

    const achievementCont = document.getElementById('rec-achievement');
    if (achievementCont) renderAchievementSection(achievementCont);
}
