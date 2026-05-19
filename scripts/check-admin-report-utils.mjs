#!/usr/bin/env node
import assert from 'node:assert/strict';

import {
  escapeHtml,
  buildVisionRadarData,
  getTopMistakeDetails,
  formatWeakKeyLabel,
  formatRecordSeconds,
  getTopMistakes,
  progressPercent,
  renderVisionRadarChart,
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

const visionStages = [
  { id: 'v1' }, { id: 'v2' }, { id: 'v3' }, { id: 'v4' }, { id: 'v6' },
  { id: 'v8' }, { id: 'v13' }, { id: 'v14' }, { id: 'v17' }
];
const visionUsers = {
  student_a: {
    examRecords: {
      v1: 10,
      v2_easy: 14,
      v3: 8,
      v4_hard: 12,
      v8: 20,
      v13: 16,
      v14: 18
    }
  },
  student_b: {
    examRecords: {
      v1: 20,
      v2_easy: 28,
      v3: 16,
      v4_hard: 24,
      v8: 40,
      v13: 32,
      v14: 36
    }
  },
  __GLOBAL_SETTINGS__: { examRecords: { v1: 1 } },
  Master_Debug: { isMaster: true, examRecords: { v1: 1 } }
};
const radarData = buildVisionRadarData(
  visionUsers.student_a,
  visionUsers,
  visionStages,
  userId => userId === '__GLOBAL_SETTINGS__' || userId === 'Master_Debug'
);
assert.equal(radarData.groups.length, 5);
assert.equal(radarData.hasAnyUserData, true);
assert.equal(radarData.hasAnyClassData, true);
assert.ok(radarData.groups.find(group => group.id === 'find').score > 100);
assert.equal(radarData.groups.find(group => group.id === 'find').completionCount, 2);
const radarHtml = renderVisionRadarChart(radarData, { title: '<vision>' });
assert.match(radarHtml, /vision-radar-card/);
assert.match(radarHtml, /&lt;vision&gt;/);
assert.match(radarHtml, /本人/);
assert.match(radarHtml, /平均 100/);

console.log('Admin report utility check passed.');
