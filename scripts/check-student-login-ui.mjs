#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync('src/api/user.js', 'utf8');

function assertMatch(pattern, label) {
  assert.match(source, pattern, `${label} is missing.`);
}

function assertNoMatch(pattern, label) {
  assert.doesNotMatch(source, pattern, `${label} should not be present.`);
}

assertMatch(
  /let\s+studentLoginState\s*=\s*\{\s*number:\s*''\s*,\s*passcode:\s*''\s*,\s*showPasscode:\s*false\s*\}\s*;/,
  'Student login state with passcode visibility'
);

assertMatch(
  /function\s+resetStudentLoginState\s*\(\)\s*\{\s*studentLoginState\s*=\s*\{\s*number:\s*''\s*,\s*passcode:\s*''\s*,\s*showPasscode:\s*false\s*\}\s*;/,
  'Student login visibility reset'
);

assertMatch(
  /id="student-login-passcode-toggle"[\s\S]*?type="button"[\s\S]*?aria-pressed="false"/,
  'Student passcode visibility toggle button'
);

assertMatch(
  /passcodeInput\.type\s*=\s*studentLoginState\.showPasscode\s*\?\s*'text'\s*:\s*'password'\s*;/,
  'Student passcode input type switch'
);

assertMatch(
  /passcodeToggle\.setAttribute\(\s*'aria-pressed'\s*,\s*studentLoginState\.showPasscode\s*\?\s*'true'\s*:\s*'false'\s*\)/,
  'Student passcode toggle pressed state'
);

assertMatch(
  /passcodeToggle\.onclick\s*=\s*\(\)\s*=>\s*\{[\s\S]*?studentLoginState\.showPasscode\s*=\s*!studentLoginState\.showPasscode;[\s\S]*?updateStudentLoginUi\(\);/,
  'Student passcode click toggle behavior'
);

assertNoMatch(
  /student-login-passcode-toggle[\s\S]{0,240}onmouse(?:down|up)|onmouse(?:down|up)[\s\S]{0,240}student-login-passcode-toggle/,
  'Hold-to-show mouse behavior on student passcode toggle'
);

console.log('Student login UI check passed.');
