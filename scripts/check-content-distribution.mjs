import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import { CONTENT_DISTRIBUTION } from '../src/data/content-distribution.js';
import { WORD_STAGES } from '../src/data/constants.js';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
assert.deepEqual(CONTENT_DISTRIBUTION, { wordPdfSuspended: true, rhythmAudioSuspended: true });
assert.deepEqual(WORD_STAGES.map(stage => stage.id), ['w_b1_1','w_b1_2','w_b1_3','w_b1_4','w_b1_5','w_m4_1','w_m4_2','w_m4_3']);
assert.ok(WORD_STAGES.every(stage => !stage.pdf), 'No unverified PDF links may be shipped.');

const ts = createRequire(import.meta.url)('typescript');
const word = read('src/games/word.js');
const js = ts.transpileModule(word, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
let alerts = 0;
let opened = 0;
const fakeModule = { exports: {} };
vm.runInNewContext(js, {
    module: fakeModule, exports: fakeModule.exports, setInterval() {},
    require(path) {
        if (path.endsWith('content-distribution.js')) return { CONTENT_DISTRIBUTION, WORD_PDF_SUSPENSION_MESSAGE: 'suspended' };
        if (path.endsWith('modal.js')) return { showCustomAlert() { alerts++; } };
        return {};
    },
    window: { open() { opened++; } }
});
fakeModule.exports.openWordText();
assert.equal(alerts, 1);
assert.equal(opened, 0, 'Programmatic calls must not open the suspended PDF.');

const game = read('src/games/minigame.js');
assert.match(game, /function getAllRhythmSongs\(\)\s*\{\s*if \(CONTENT_DISTRIBUTION.rhythmAudioSuspended\) return \[\];/);
assert.match(game, /RHYTHM_AUDIO_SUSPENSION_MESSAGE/);
const admin = read('src/ui/admin-rhythm.js');
assert.match(admin, /async function uploadRhythmAudio\(file\)\s*\{\s*if \(CONTENT_DISTRIBUTION.rhythmAudioSuspended\) throw/);
assert.match(admin, /async function saveAdminRhythmSong\(\)\s*\{\s*if \(CONTENT_DISTRIBUTION.rhythmAudioSuspended\)/);
assert.match(admin, /container\.textContent = '音源の利用許諾/);
const html = read('index.html');
assert.match(html, /onclick="openWordText\(\)" disabled aria-describedby="word-text-availability"/);
for (const path of ['supabase/sql/suspend_unverified_media.sql', 'supabase/sql/rhythm_audio_storage.sql']) {
    const sql = read(path);
    assert.match(sql, /on storage\.objects as restrictive\s+for all to anon, authenticated/);
    assert.match(sql, /using \(bucket_id <> 'lesson-rhythm-audio'\)/);
    assert.match(sql, /with check \(bucket_id <> 'lesson-rhythm-audio'\)/);
}
console.log('Unverified PDF/audio distribution guards and stable Word stage IDs passed.');
