#!/usr/bin/env node
import assert from 'node:assert/strict';

import {
  buildForceProgressPatch,
  buildProgressEditPatch,
  buildResetProgressPatch,
  getThemeCheckId
} from '../src/ui/admin-progress-editor-utils.js';

const themes = [
  { id: 'default' },
  { id: 'blue' },
  { id: 'custom_theme_1', isCustom: true }
];

assert.deepEqual(buildResetProgressPatch(), {
  mouseLevel: 0,
  keyboardSequence: 0,
  examRecords: {},
  textRecords: {},
  globalMistakes: {},
  theme: 'default'
});

assert.deepEqual(buildForceProgressPatch(42), {
  mouseLevel: 7,
  keyboardSequence: 42
});

assert.equal(getThemeCheckId('blue', themes), 'theme_blue');
assert.equal(getThemeCheckId('custom_theme_1', themes), 'custom_theme_1');

assert.deepEqual(buildProgressEditPatch({
  mouseLevel: '3',
  keyboardSequence: '12',
  items: ['theme_blue', 'spark']
}, {
  theme: 'blue',
  activeEffect: 'spark'
}, themes), {
  mouseLevel: 3,
  keyboardSequence: 12,
  items: ['theme_blue', 'spark'],
  theme: 'blue',
  activeEffect: 'spark'
});

assert.deepEqual(buildProgressEditPatch({
  mouseLevel: 'x',
  keyboardSequence: '',
  items: []
}, {
  theme: 'blue',
  activeEffect: 'spark'
}, themes), {
  mouseLevel: 0,
  keyboardSequence: 0,
  items: [],
  theme: 'default',
  activeEffect: 'default'
});

console.log('Admin progress editor utility check passed.');
