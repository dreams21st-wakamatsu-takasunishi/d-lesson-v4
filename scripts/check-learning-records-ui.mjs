import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const cli = process.argv[2];
if (!cli) throw Error('Usage: node scripts/check-learning-records-ui.mjs <playwright CLI path>');
const evidence = 'output/playwright';
mkdirSync(evidence, { recursive: true });
function command(...args) {
    const result = spawnSync(process.execPath, [resolve(cli), '-s=lesson-learning-records', ...args], {
        encoding: 'utf8', timeout: 90000, maxBuffer: 2000000
    });
    if (result.error) throw result.error;
    if (result.status || result.stdout.includes('### Error')) throw Error(result.stdout + result.stderr);
    return result.stdout;
}

async function check(page) {
    const assert = (value, message) => { if (!value) throw Error(message); };
    const errors = [], requests = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.context().route('https://*.supabase.co/**', async route => { requests.push(route.request().method()); await route.abort(); });
    await page.goto('http://127.0.0.1:5174/');
    await page.setViewportSize({ width: 1440, height: 960 });
    await page.locator('#guest-login-button').click();
    await page.locator('#stamp-overlay button').click();
    await page.locator('.confetti').first().waitFor({ state: 'detached' });
    const open = async () => {
        await page.evaluate(() => window.goToRecords());
        await page.getByRole('button', { name: 'せいせき・とりくみ' }).click();
    };
    await open();
    const panel = page.locator('#rec-learning');
    assert(await panel.getByText('まだタイピングのクリアきろくがありません。').isVisible(), 'empty state');
    assert(await panel.locator('.learning-week-bars li').count() === 7, 'seven day slots including no activity');

    await page.evaluate(async () => {
        const url = performance.getEntriesByType('resource').map(e => e.name).find(name => name.includes('/src/api/user.js'));
        const { users, currentUser } = await import(url);
        const timestamp = minutes => new Date(Date.now() - minutes * 60000).toISOString();
        const log = (stageId, label, when, accuracy, detail = 'クリア') => ({
            id: 'fixture-' + when, category: 'keyboard', at: timestamp(when), stageId,
            title: 'キーボード ' + label, detail, amount: `うった数 24回 / ミス 3回 / せいかく ${accuracy}%`
        });
        Object.assign(users[currentUser], {
            mouseLevel: 7, alphabetSequence: 2, keyboardSequence: 3,
            oneHandProgress: { hand_left_4: { clears: 1 } },
            oneHandChallenges: { left: { attempts: 2, best: { score: 132 } } },
            mockExamRecords: [{ title: '架空の模擬試験', net: 288, grade: '4級', early: true, finishedAt: timestamp(15) }],
            examRecords: { 1101: '27.2' },
            practiceLogs: [
                log('1001', 'ホームキー', 2, 92), log('1001', 'ホームキー', 5, 81), log('1001', 'ホームキー', 1, 100, 'とちゅうでやめた'),
                log('1002', 'となりのキー', 9, 96), log('1001', 'ホームキー', 1470, 76),
                { id: 'fixture-vision', title: '架空ビジョン', at: timestamp(45), category: 'vision', detail: 'クリア' }
            ]
        });
        window.showScreen('screen-category');
    });
    await open();
    const choice = panel.getByLabel('ステージ', { exact: true });
    assert(await choice.locator('option').count() === 2, 'separate stages');
    assert((await panel.locator('.learning-accuracy-bars strong').allTextContents()).join(',') === '76%,81%,92%', 'same stage, completed only, chronological');
    assert(await panel.getByText('+11ポイント').isVisible(), 'previous comparison');
    assert(await panel.getByText('132点', { exact: true }).isVisible(), 'hand best score');
    assert(await panel.getByText('4級・288純字', { exact: true }).isVisible(), 'mock grade and net');
    await choice.selectOption('stage:1002');
    assert((await panel.locator('.learning-accuracy-bars strong').allTextContents()).join(',') === '96%', 'stage filter updates the chart');
    await choice.selectOption('stage:1001');
    await page.waitForTimeout(350);
    await page.screenshot({ path: 'output/playwright/learning-records-desktop.png' });

    await page.setViewportSize({ width: 390, height: 844 });
    await panel.getByText('キーボード・片手のステージを見る', { exact: true }).click();
    await panel.locator('.learning-chapter summary').filter({ hasText: '左手タイピング' }).click();
    assert(await panel.getByText('90びょうチャレンジ', { exact: true }).filter({ visible: true }).count() === 1, 'stage breakdown visible');
    await panel.getByText('とりくみきろくの一覧', { exact: true }).click();
    const filter = panel.getByLabel('分野', { exact: true });
    await filter.selectOption('vision');
    assert(await panel.locator('.practice-history-row').count() === 1 && (await panel.locator('.practice-history-row').textContent()).includes('架空ビジョン'), 'history filter');
    await panel.getByText('タイムアタックのきろく', { exact: true }).click();
    assert(await panel.getByText('27.2秒', { exact: true }).isVisible(), 'existing timed records available');
    await panel.getByText('ビジョン・にがてなキーのグラフ', { exact: true }).click();
    await panel.locator('.vision-radar-card').waitFor({ state: 'visible' });
    const widths = await page.evaluate(() => {
        const root = document.querySelector('.learning-overview'), frame = document.getElementById('game-container');
        return { content: [root.scrollWidth, root.clientWidth], frame: [frame.scrollWidth, frame.clientWidth],
            overflowing: [...frame.querySelectorAll('*')].filter(e => e.getBoundingClientRect().right > frame.clientWidth + 1).slice(0, 8).map(e => [e.id, e.getAttribute('class'), e.getBoundingClientRect().right]) };
    });
    assert(widths.content[0] <= widths.content[1] + 1 && widths.frame[0] <= widths.frame[1] + 1, 'no mobile overflow even with expanded detail ' + JSON.stringify(widths));
    await page.evaluate(() => { document.getElementById('game-container').scrollTop = 0; });
    await page.screenshot({ path: 'output/playwright/learning-records-mobile.png' });
    await panel.getByRole('button', { name: 'れんしゅうする' }).click();
    await page.locator('#screen-game.active').waitFor();
    assert(!errors.length && !requests.length, JSON.stringify({ errors, requests }));
    return { passed: true, realCloudAccess: false };
}

try {
    command('open', 'about:blank');
    command('snapshot');
    const file = resolve(evidence, 'learning-records-run-code.js');
    writeFileSync(file, `async page=>{try{return await (${check.toString()})(page)}catch(error){await page.screenshot({path:'output/playwright/learning-records-failure.png'});throw error;}}`);
    const output = command('run-code', '--filename=' + file);
    assert.match(output, /"passed":true/);
    console.log('Learning records browser checks passed (guest fixture and no cloud traffic).');
} finally {
    command('close');
}
