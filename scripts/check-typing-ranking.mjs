#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function readProjectFile(relativePath) {
  return fs.readFileSync(path.join(rootDir, relativePath), 'utf8');
}

function assertIncludes(source, needle, label) {
  assert.ok(source.includes(needle), `${label} is missing`);
}

function assertPattern(source, pattern, label) {
  assert.match(source, pattern, `${label} is missing`);
}

const minigameSource = readProjectFile('src/games/minigame.js');
const adminRankingSource = readProjectFile('src/ui/admin-ranking-settings.js');
const rankingSettingsSource = readProjectFile('src/data/typing-ranking-settings.js');
const rankingSqlSource = readProjectFile('supabase/sql/lesson_typing_rankings.sql');
const verifySqlSource = readProjectFile('supabase/sql/verify_lesson_typing_rankings.sql');

assertIncludes(minigameSource, "const TYPING_RANKING_TABLE = 'lesson_typing_rankings';", 'Typing ranking table name');
assertIncludes(minigameSource, 'const TYPING_RANKING_TOP_LIMIT = 5;', 'Typing ranking top-five limit');
assertIncludes(minigameSource, 'getTypingRankingNicknameBlockWords', 'Nickname block word lookup');
assertIncludes(minigameSource, 'function validateRankingNickname', 'Nickname validation function');
assertIncludes(minigameSource, 'const NICKNAME_MAX_LENGTH = 10;', 'Nickname length limit');
assertPattern(minigameSource, /@\|https\?:\\\/\\\/\|www\\\.\|\[0-9/, 'Nickname contact/URL block pattern');
assertIncludes(minigameSource, 'getNicknameBlockWords().some', 'Nickname custom block word enforcement');

assertIncludes(minigameSource, 'function dedupeRankingRows(rows)', 'Ranking de-duplication function');
assertPattern(minigameSource, /const byUser = new Map\(\);[\s\S]*byUser\.set\(userId,[\s\S]*return Array\.from\(byUser\.values\(\)\)\.sort/, 'Ranking de-duplicates rows by user');
assertIncludes(minigameSource, 'ranking.slice(0, TYPING_RANKING_TOP_LIMIT)', 'Ranking display is limited to top five');
assertIncludes(minigameSource, 'myRankIdx < TYPING_RANKING_TOP_LIMIT', 'Nickname form is limited to top five users');

assertPattern(
  minigameSource,
  /async function saveCloudMinigameRanking\(modeKey, score\)[\s\S]*\.select\('score,display_label'\)[\s\S]*Number\(existing\?\.score \|\| 0\) >= score[\s\S]*return true;/,
  'Cloud ranking keeps the existing high score when it is higher'
);
assertPattern(
  minigameSource,
  /\.upsert\(\{[\s\S]*mode: modeKey,[\s\S]*user_data_id: currentUser,[\s\S]*score,[\s\S]*\}, \{ onConflict: 'mode,user_data_id' \}\)/,
  'Cloud ranking upserts one row per mode and user'
);
assertPattern(
  minigameSource,
  /mgScore > prev[\s\S]*mg_meteor[\s\S]*mgScore > prev|mg_meteor[\s\S]*mgScore > prev[\s\S]*mg_d_challenge/,
  'Local typing game records only improve when the score is higher'
);

assertIncludes(adminRankingSource, 'renderTypingRankingSettingsAdmin', 'Admin ranking settings renderer');
assertIncludes(adminRankingSource, 'saveTypingRankingNicknameBlockWords', 'Admin ranking settings saver');
assertIncludes(adminRankingSource, 'typingRankingNicknameBlockWords', 'Admin saves custom nickname block words');
assertIncludes(adminRankingSource, '.filter(word => word.length <= 20)', 'Admin limits individual NG word length');
assertIncludes(adminRankingSource, '.slice(0, 80)', 'Admin limits custom NG word count');
assertIncludes(adminRankingSource, 'saveUsers(true)', 'Admin ranking settings persist through cloud sync');

assertIncludes(rankingSettingsSource, 'DEFAULT_TYPING_RANKING_NICKNAME_BLOCK_WORDS', 'Default nickname block words');
assertIncludes(rankingSettingsSource, 'normalizeNicknameBlockWords', 'Nickname block word normalization');
assertIncludes(rankingSettingsSource, 'getCustomTypingRankingNicknameBlockWords', 'Custom nickname block word getter');
assertPattern(
  rankingSettingsSource,
  /getTypingRankingNicknameBlockWords\(settings = \{\}\)[\s\S]*DEFAULT_TYPING_RANKING_NICKNAME_BLOCK_WORDS[\s\S]*getCustomTypingRankingNicknameBlockWords\(settings\)/,
  'Default and custom nickname block words are combined'
);

assertIncludes(rankingSqlSource, 'lesson_typing_rankings_mode_user_data_id_uidx', 'Unique ranking index');
assertIncludes(rankingSqlSource, 'primary key (mode, user_data_id)', 'Ranking table primary key');
assertIncludes(rankingSqlSource, 'keep_lesson_typing_ranking_highscore', 'Database high-score trigger');
assertIncludes(rankingSqlSource, 'new.score < old.score', 'Database blocks lower score overwrite');
assertIncludes(rankingSqlSource, 'is_safe_typing_ranking_label(display_label, user_data_id)', 'Database nickname safety check');
assertIncludes(rankingSqlSource, 'revoke all on public.lesson_typing_rankings from anon;', 'Anonymous table access revoked');
assertIncludes(rankingSqlSource, 'public.can_write_lesson_typing_ranking(user_data_id)', 'Ranking write policy is user-scoped');

assertIncludes(verifySqlSource, 'unique_user_mode_ranking', 'Verification checks one row per user and mode');
assertIncludes(verifySqlSource, 'no_anon_table_grants', 'Verification checks anon has no table access');
assertIncludes(verifySqlSource, 'safe_label_constraint', 'Verification checks nickname safety constraint');
assertIncludes(verifySqlSource, 'highscore_trigger', 'Verification checks high-score trigger');

console.log('Typing ranking safety check passed.');
