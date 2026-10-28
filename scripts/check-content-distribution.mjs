import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import { CONTENT_DISTRIBUTION } from '../src/data/content-distribution.js';
import { WORD_STAGES } from '../src/data/constants.js';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
assert.deepEqual(CONTENT_DISTRIBUTION, { wordPdfSuspended: true, rhythmAudioSuspended: false });
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
function functionSource(source, names) {
    const ast = ts.createSourceFile('fixture.js', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
    const declarations = ast.statements.filter(node => ts.isFunctionDeclaration(node) && names.includes(node.name?.text));
    assert.equal(declarations.length, names.length);
    return declarations.map(node => node.getText(ast)).join('\n');
}
const songFunctions = functionSource(game, ['normalizeRhythmCustomSongForMenu', 'getAllRhythmSongs']);
const songs = [
    {id:'fixture', title:'Fixture', audioUrl:'https://audio.example.invalid/test.mp3'},
    {id:'hidden', title:'Hidden', audioUrl:'https://audio.example.invalid/hidden.mp3', visible:false},
    {id:'invalid', title:'No audio'}
];
const restoredSongs = vm.runInNewContext(songFunctions + '\ngetAllRhythmSongs()', {
    CONTENT_DISTRIBUTION, getRhythmCustomSongSettings: () => songs
});
assert.deepEqual(Array.from(restoredSongs, song => song.id), ['fixture']);
const stoppedSongs = vm.runInNewContext(songFunctions + '\ngetAllRhythmSongs()', {
    CONTENT_DISTRIBUTION: {...CONTENT_DISTRIBUTION, rhythmAudioSuspended:true},
    getRhythmCustomSongSettings: () => songs
});
assert.equal(stoppedSongs.length, 0);
const admin = read('src/ui/admin-rhythm.js');
assert.match(admin, /async function uploadRhythmAudio\(file\)\s*\{\s*if \(CONTENT_DISTRIBUTION.rhythmAudioSuspended\) throw/);
assert.match(admin, /async function saveAdminRhythmSong\(\)\s*\{\s*if \(CONTENT_DISTRIBUTION.rhythmAudioSuspended\)/);
assert.match(admin, /container\.textContent = '音源の利用許諾/);
let uploaded = 0;
const uploadAudio = vm.runInNewContext(functionSource(admin, ['uploadRhythmAudio']) + '\nuploadRhythmAudio', {
    CONTENT_DISTRIBUTION, RHYTHM_AUDIO_BUCKET:'lesson-rhythm-audio',
    makeStoragePath: () => 'fixture/test.mp3',
    supabase: {storage: {from(bucket) {
        assert.equal(bucket, 'lesson-rhythm-audio');
        return {
            async upload() { uploaded++; return {error:null}; },
            getPublicUrl() { return {data:{publicUrl:'https://audio.example.invalid/test.mp3'}}; }
        };
    }}}
});
assert.equal((await uploadAudio({type:'audio/mpeg'})).audioUrl, 'https://audio.example.invalid/test.mp3');
assert.equal(uploaded, 1);
const html = read('index.html');
assert.match(html, /onclick="openWordText\(\)" disabled aria-describedby="word-text-availability"/);
const emergency = read('supabase/sql/suspend_unverified_media.sql');
assert.match(emergency, /on storage\.objects as restrictive\s+for all to anon, authenticated/);
assert.match(emergency, /using \(bucket_id <> 'lesson-rhythm-audio'\)/);
assert.match(emergency, /with check \(bucket_id <> 'lesson-rhythm-audio'\)/);
const setup = read('supabase/sql/rhythm_audio_storage.sql');
assert.match(setup, /'lesson-rhythm-audio',\s*'lesson-rhythm-audio',\s*true,/);
assert.match(setup, /and public\.is_lesson_admin\(\)/);
assert.doesNotMatch(setup, /create policy "Rhythm distribution suspended"/);
const resume = read('supabase/sql/resume_rhythm_audio.sql');
assert.match(resume, /set public = true\s+where id = 'lesson-rhythm-audio'/);
assert.match(resume, /drop policy if exists "Rhythm distribution suspended"/);
assert.doesNotMatch(resume, /delete from|user_data|word-work/i);
console.log('Word PDF suspension, restored rhythm menu/upload, stable stage IDs and audio-only SQL checks passed.');
