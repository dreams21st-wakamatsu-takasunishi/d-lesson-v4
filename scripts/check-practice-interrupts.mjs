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

const coreSource = readProjectFile('src/games/core.js');
const textSource = readProjectFile('src/games/text.js');
const minigameSource = readProjectFile('src/games/minigame.js');
const focusSource = readProjectFile('src/ui/focus-navigation.js');
const htmlSource = readProjectFile('index.html');

assertIncludes(coreSource, 'function recordPracticeInterrupt(shouldRecord)', 'Core practice interrupt recorder');
assertPattern(
  coreSource,
  /function recordPracticeInterrupt\(shouldRecord\)[\s\S]*recordPracticeActivity\(\{[\s\S]*detail:\s*'中断'[\s\S]*saveUsers\(false\);/,
  'Core practice interrupt log save'
);
assertPattern(
  coreSource,
  /export function backToMenu\(recordInterrupt = false\)[\s\S]*recordPracticeInterrupt\(recordInterrupt\);/,
  'Core backToMenu interrupt hook'
);

assertIncludes(textSource, 'function recordTextPracticeInterrupt()', 'Text practice interrupt recorder');
assertPattern(
  textSource,
  /function recordTextPracticeInterrupt\(\)[\s\S]*recordPracticeActivity\(\{[\s\S]*detail:\s*'中断'[\s\S]*saveUsers\(false\);/,
  'Text practice interrupt log save'
);
assertPattern(
  textSource,
  /export function backToMenuFromText\(\)[\s\S]*if \(isTextPracticeFinishing \|\| isTextResultProcessed\) return;[\s\S]*recordTextPracticeInterrupt\(\);/,
  'Text back button interrupt hook'
);

assertIncludes(minigameSource, 'function recordMinigameInterrupt(shouldRecord)', 'Typing game interrupt recorder');
assertPattern(
  minigameSource,
  /function recordMinigameInterrupt\(shouldRecord\)[\s\S]*recordPracticeActivity\(\{[\s\S]*detail:\s*'中断'[\s\S]*saveUsers\(false\);/,
  'Typing game interrupt log save'
);
assertPattern(
  minigameSource,
  /export function stopMinigame\(recordInterrupt = false\)[\s\S]*recordMinigameInterrupt\(recordInterrupt\);/,
  'Typing game stop interrupt hook'
);
assertIncludes(minigameSource, 'stopMinigame(false); SoundManager.playClear();', 'Typing game completion must not be logged as interrupted');

assertIncludes(focusSource, 'backToMenu(true);', 'Escape key records core game interruption');
assertIncludes(focusSource, 'stopMinigame(true);', 'Escape key records typing game interruption');
assertIncludes(focusSource, 'backToMenuFromText();', 'Escape key records text practice interruption');

assertIncludes(htmlSource, 'onclick="backToMenu(true)"', 'Core game quit button records interruption');
assertIncludes(htmlSource, 'onclick="backToMenuFromText()"', 'Text practice quit button records interruption');
assertIncludes(
  htmlSource,
  'onclick="backFromMinigame(true)"',
  'Typing game quit button records interruption'
);

console.log('Practice interruption logging check passed.');
