#!/usr/bin/env node
import assert from 'node:assert/strict';

import {
  escapeHtml,
  getTopMistakeDetails,
  formatWeakKeyLabel,
  formatRecordSeconds,
  getTopMistakes,
  progressPercent,
  reportBar,
  reportSection
} from '../src/ui/admin-report-utils.js';

assert.equal(escapeHtml(`<b>"A"&'B'</b>`), '&lt;b&gt;&quot;A&quot;&amp;&#39;B&#39;&lt;/b&gt;');

assert.equal(progressPercent(0, 10), 0);
assert.equal(progressPercent(5, 10), 50);
assert.equal(progressPercent(15, 10), 100);
assert.equal(progressPercent(-1, 10), 0);
assert.equal(progressPercent(3, 0), 0);

assert.equal(formatRecordSeconds(12.345), '12.3\u79d2');
assert.equal(formatRecordSeconds(null), '-');
assert.equal(formatWeakKeyLabel('='), 'キー「=（イコール）」');
assert.equal(formatWeakKeyLabel('SPACE'), 'スペースキー');

assert.deepEqual(getTopMistakes({
  globalMistakes: {
    A: 2,
    '=': 3,
    J: 1.2e+48,
    customThemes: [{ name: 'legacy' }],
    B: 0,
    SPACE: 5
  }
}), ['スペースキー：5回', 'キー「=（イコール）」：3回', 'キー「A」：2回']);

assert.deepEqual(getTopMistakeDetails({
  globalMistakes: {
    A: 2,
    '=': 3,
    '-': 1.4e+48
  }
}), [
  { key: '=', label: 'キー「=（イコール）」', count: 3 },
  { key: 'A', label: 'キー「A」', count: 2 }
]);

const barHtml = reportBar('<mouse>', 3, 7, '#2196F3');
assert.match(barHtml, /&lt;mouse&gt;/);
assert.match(barHtml, /3\/7 \(42%\)/);
assert.match(barHtml, /width:42%/);

const sectionHtml = reportSection('<title>', '<p>body</p>');
assert.match(sectionHtml, /&lt;title&gt;/);
assert.match(sectionHtml, /<p>body<\/p>/);

console.log('Admin report utility check passed.');
