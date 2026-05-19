#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

function read(path) {
  return readFileSync(path, 'utf8');
}

function assertMatch(source, pattern, label) {
  assert.match(source, pattern, `${label} is missing.`);
}

const coreSource = read('src/games/core.js');
const textSource = read('src/games/text.js');

assertMatch(
  coreSource,
  /let\s+isClearProcessing\s*=\s*false\s*;/,
  'Common clear guard state'
);

assertMatch(
  coreSource,
  /export\s+function\s+startGame\s*\([\s\S]*?isClearProcessing\s*=\s*false\s*;/,
  'Common clear guard reset in startGame'
);

assertMatch(
  coreSource,
  /export\s+function\s+markClear\s*\(\)\s*\{\s*if\s*\(\s*isClearProcessing\s*\)\s*return\s*;\s*isClearProcessing\s*=\s*true\s*;/,
  'Common clear guard at the start of markClear'
);

assertMatch(
  textSource,
  /let\s+isTextPracticeFinishing\s*=\s*false\s*;\s*let\s+isTextResultProcessed\s*=\s*false\s*;/,
  'Text practice finish/result guard state'
);

assertMatch(
  textSource,
  /export\s+function\s+confirmStartTextPractice\s*\([\s\S]*?isTextPracticeFinishing\s*=\s*false\s*;[\s\S]*?isTextResultProcessed\s*=\s*false\s*;/,
  'Text practice guard reset on start'
);

assertMatch(
  textSource,
  /export\s+function\s+submitTextPractice\s*\(\)\s*\{\s*if\s*\(\s*isTextPracticeFinishing\s*\|\|\s*isTextResultProcessed\s*\)\s*return\s*;\s*isTextPracticeFinishing\s*=\s*true\s*;/,
  'Text practice submit guard'
);

assertMatch(
  textSource,
  /function\s+showTextResult\s*\(\)\s*\{\s*if\s*\(\s*isTextResultProcessed\s*\)\s*return\s*;\s*isTextResultProcessed\s*=\s*true\s*;/,
  'Text practice result guard'
);

console.log('Clear guard check passed.');
