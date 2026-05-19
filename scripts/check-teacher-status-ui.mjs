#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync('src/ui/teacher-status.js', 'utf8');
const style = readFileSync('src/style.css', 'utf8');

function assertSource(pattern, label) {
  assert.match(source, pattern, `${label} is missing from teacher-status.js.`);
}

function assertStyle(pattern, label) {
  assert.match(style, pattern, `${label} is missing from style.css.`);
}

assertSource(/id="teacher-status-search"/, 'Teacher status search input');
assertSource(/id="teacher-status-group-filter"/, 'Teacher status group filter');
assertSource(/id="teacher-status-status-filter"/, 'Teacher status status filter');
assertSource(/id="teacher-status-sort"/, 'Teacher status sort selector');
assertSource(/value="keyboard-low"/, 'Keyboard-low sort option');
assertSource(/value="mouse-low"/, 'Mouse-low sort option');
assertSource(/value="latest-old"/, 'Oldest-practice sort option');

assertSource(/function\s+sortTeacherStatusRows\s*\(/, 'Teacher status sort function');
assertSource(/teacherStatusFilters\.sort\s*=\s*event\.target\.value\s*\|\|\s*'group-name'/, 'Teacher status sort change handler');
assertSource(/teacherStatusFilters\.sort\s*=\s*'group-name'/, 'Teacher status sort reset');

assertSource(/function\s+getTeacherStatusAttention\s*\(/, 'Teacher status attention builder');
assertSource(/function\s+renderTeacherStatusAttention\s*\(/, 'Teacher status attention renderer');
assertSource(/row\.attention\.length/, 'Teacher status attention count usage');
assertSource(/getTeacherStatusAttentionText\(row\)/, 'Teacher status attention export/print text');

assertSource(/id="teacher-status-print"/, 'Teacher status print button');
assertSource(/id="teacher-status-export"/, 'Teacher status CSV export button');
assertSource(/id="teacher-status-incomplete-export"/, 'Teacher status incomplete CSV button');
assertSource(/data-teacher-status-user-id/, 'Teacher status detail button wiring');
assertSource(/data-teacher-detail-print-user-id/, 'Teacher status detail print wiring');
assertSource(/function\s+renderTeacherStatusDetail\s*\(/, 'Teacher status detail panel');
assertSource(/function\s+printTeacherStatus\s*\(/, 'Teacher status print handler');
assertSource(/function\s+exportTeacherStatusCsv\s*\(/, 'Teacher status CSV handler');

assertStyle(/\.teacher-status-controls/, 'Teacher status controls styles');
assertStyle(/\.teacher-status-alerts/, 'Teacher status attention label styles');
assertStyle(/\.teacher-status-ok/, 'Teacher status OK label styles');
assertStyle(/\.teacher-status-detail-btn/, 'Teacher status detail button styles');
assertStyle(/\.teacher-status-print/, 'Teacher status print button styles');

console.log('Teacher status UI check passed.');
