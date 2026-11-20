import { getRecentPracticeDays, getLearningStageGroups, getTypingAccuracySeries, recordStageName } from '../utils/learning-records.js';
import { buildRouteSteps, getAvailableRouteSteps } from '../utils/standard-route.js';
import { goToKeyboardCategory, startRecommendedKeyboardStage } from './keyboard-menu.js';
import { setLessonIcon } from './interface.js';

const count = value => Number.isFinite(value) && value >= 0 ? value.toLocaleString('ja-JP') : null;
const dateFormat = new Intl.DateTimeFormat('ja-JP', { timeZone: 'Asia/Tokyo', month: 'numeric', day: 'numeric' });
const routeLabels = { mouse: 'マウス', alphabet: 'ABC', keyboard: 'キーボード', text: '文章入力', vision: 'ビジョン', word: 'Word' };
const stageLabels = { done: 'できた', next: 'つぎ', waiting: 'これから', ready: 'ちょうせんできる', locked: 'テスト合格のあと' };

function node(tag, text, className) {
    const el = document.createElement(tag);
    if (text !== undefined) el.textContent = text;
    if (className) el.className = className;
    return el;
}

function action(label, icon, run) {
    const button = node('button', undefined, 'btn-secondary learning-action');
    button.type = 'button';
    const symbol = node('span');
    setLessonIcon(symbol, icon);
    button.append(symbol, node('span', label));
    button.onclick = run;
    return button;
}

function section(title, className) {
    const el = node('section', undefined, className);
    el.append(node('h4', title));
    return el;
}

function appendFact(list, label, value) {
    const item = node('div');
    item.append(node('dt', label), node('dd', value));
    list.append(item);
}

function renderTyping(typing, logs) {
    const series = getTypingAccuracySeries(logs);
    if (!series.length) {
        typing.append(node('p', 'まだタイピングのクリアきろくがありません。', 'learning-empty'));
        return;
    }
    const control = node('label', 'ステージ', 'learning-select');
    const select = node('select');
    select.setAttribute('aria-label', 'ステージ');
    for (const group of series) {
        const option = node('option', group.title.replace(/^キーボード /, '') + (group.id.startsWith('legacy:') ? '（旧記録）' : ''));
        option.value = group.id;
        select.append(option);
    }
    control.append(select);
    typing.append(control);
    const body = node('div');
    body.setAttribute('aria-live', 'polite');
    typing.append(body);
    const draw = () => {
        const { attempts } = series.find(group => group.id === select.value);
        const latest = attempts[0], previous = attempts[1];
        const facts = node('dl', undefined, 'learning-facts');
        appendFact(facts, 'さいしん', latest.accuracy + '%');
        appendFact(facts, 'きろく内の最高', Math.max(...attempts.map(a => a.accuracy)) + '%');
        if (previous) {
            const delta = latest.accuracy - previous.accuracy;
            appendFact(facts, 'まえの回とくらべて', delta === 0 ? 'おなじ' : (delta > 0 ? '+' : '−') + Math.abs(delta) + 'ポイント');
        }
        const chart = node('ol', undefined, 'learning-bars learning-accuracy-bars');
        chart.setAttribute('aria-label', '同じステージの正確さ・古い順');
        for (const attempt of attempts.slice(0, 6).reverse()) {
            const item = node('li');
            item.setAttribute('aria-label', `${dateFormat.format(attempt.at)}、正確さ${attempt.accuracy}%、正しく入力${attempt.correct}回、ミス${attempt.misses}回`);
            const bar = node('span', undefined, 'learning-bar-track');
            const fill = node('span', undefined, 'learning-bar-fill');
            fill.style.height = attempt.accuracy + '%';
            bar.append(fill);
            item.append(node('strong', attempt.accuracy + '%'), bar, node('span', dateFormat.format(attempt.at)));
            chart.append(item);
        }
        body.replaceChildren(facts, chart, node('p', `直近${Math.min(attempts.length, 6)}回のクリア記録 ／ 最新のミス ${latest.misses}回`, 'learning-caption'));
    };
    select.onchange = draw;
    draw();
}

function renderProgress(progress, user, settings) {
    const steps = buildRouteSteps(user, settings);
    const recommendation = getAvailableRouteSteps(user, settings).find(step => step.step === 'alphabet' || step.step === 'keyboard');
    if (recommendation?.stageId) {
        const next = node('div', undefined, 'learning-next');
        const stageId = recommendation.stageId;
        const description = node('div');
        description.append(node('span', 'つぎのキーボードれんしゅう'), node('strong', recordStageName(stageId)));
        next.append(description, action('れんしゅうする', 'keyboard', () => startRecommendedKeyboardStage(stageId)));
        progress.append(next);
    } else {
        progress.append(action('キーボードのメニュー', 'keyboard', goToKeyboardCategory));
    }
    const bars = node('div', undefined, 'learning-progress-list');
    for (const [key, label] of Object.entries(routeLabels)) {
        const { done, total, tone } = steps[key];
        const row = node('div', undefined, 'learning-progress-row');
        const meter = node('progress');
        meter.max = total || 1;
        meter.value = done;
        meter.setAttribute('aria-label', label + 'のクリア数');
        const status = total === 0 ? '課題なし' : `${done} / ${total}${tone === 'blocked' ? '・じゅんび中' : ''}`;
        row.append(node('strong', label), meter, node('span', status));
        bars.append(row);
    }
    progress.append(bars);
    const details = node('details', undefined, 'learning-details');
    details.append(node('summary', 'キーボード・片手のステージを見る'));
    for (const group of getLearningStageGroups(user)) {
        const chapter = node('details', undefined, 'learning-chapter');
        const summary = node('summary');
        summary.append(node('span', group.title), node('strong', group.done + ' / ' + group.stages.length));
        const list = node('ul', undefined, 'learning-stages');
        for (const stage of group.stages) {
            const item = node('li');
            item.append(node('span', stage.title), node('span', stage.review ? 'ふくしゅう' : stageLabels[stage.state], 'learning-stage-' + stage.state));
            list.append(item);
        }
        chapter.append(summary, list);
        details.append(chapter);
    }
    progress.append(details);
}

function renderScores(scores, user) {
    const facts = node('dl', undefined, 'learning-facts');
    for (const [hand, title] of [['left', '左手90秒'], ['right', '右手90秒']]) {
        const score = count(user.oneHandChallenges?.[hand]?.best?.score);
        appendFact(facts, title + 'の最高', score === null ? '記録なし' : score + '点');
    }
    const mock = (Array.isArray(user.mockExamRecords) ? user.mockExamRecords : [])
        .filter(row => row && count(row.net) !== null)
        .sort((a, b) => String(b.finishedAt || '').localeCompare(String(a.finishedAt || '')))[0];
    appendFact(facts, '模擬試験の最新', mock ? (mock.grade || '級なし') + '・' + count(mock.net) + '純字' : '記録なし');
    scores.append(facts);
    if (mock) scores.append(node('p', [mock.title, mock.early ? '途中終了' : '10分間終了', '参考採点'].filter(Boolean).join(' ／ '), 'learning-caption'));
}

export function renderLearningOverview(container, user, settings, logs) {
    const heading = node('h3', 'せいせき・とりくみ');
    const weekly = section('さいきん7日間のとりくみ', 'learning-week');
    const days = getRecentPracticeDays(logs);
    const activeDays = days.filter(day => day.count > 0).length;
    const facts = node('dl', undefined, 'learning-facts');
    appendFact(facts, 'きょうのきろく', days.at(-1).count + '回');
    appendFact(facts, 'とりくんだ日', activeDays + ' / 7日');
    const chart = node('ol', undefined, 'learning-bars learning-week-bars');
    chart.setAttribute('aria-label', '直近7日間のとりくみ記録数');
    const max = Math.max(1, ...days.map(day => day.count));
    for (const day of days) {
        const date = dateFormat.format(new Date(day.date + 'T00:00:00+09:00'));
        const item = node('li');
        item.setAttribute('aria-label', `${date}、${day.count}回`);
        const track = node('span', undefined, 'learning-bar-track');
        const fill = node('span', undefined, 'learning-bar-fill');
        fill.style.height = day.count / max * 100 + '%';
        track.append(fill);
        item.append(node('strong', String(day.count)), track, node('span', date));
        chart.append(item);
    }
    weekly.append(facts, chart);
    const columns = node('div', undefined, 'learning-columns');
    const typing = section('タイピングの正確さ', 'learning-typing');
    renderTyping(typing, logs);
    const progress = section('クリアのすすみ', 'learning-progress');
    renderProgress(progress, user, settings);
    columns.append(typing, progress);
    const scores = section('チャレンジのきろく', 'learning-scores');
    renderScores(scores, user);
    container.append(heading, columns, scores, weekly);
}
