#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync('src/ui/teacher-status.js', 'utf8');
const style = readFileSync('src/style.css', 'utf8');
const html = readFileSync('index.html', 'utf8');

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
assertSource(/export function openTeacherMenu/, 'Teacher menu exported opener');
assertSource(/data-teacher-menu-action/, 'Teacher menu action wiring');
assertSource(/先生メニュー/, 'Teacher menu title');
assert.match(html, /id="title-teacher-menu-btn"/, 'Teacher menu title button is missing from index.html.');

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
assertSource(/data-teacher-edit-name/, 'Teacher student name edit wiring');
assertSource(/data-teacher-edit-birthdate/, 'Teacher student birthdate edit wiring');
assertSource(/data-teacher-edit-group/, 'Teacher student group edit wiring');
assertSource(/data-teacher-delete-user-id/, 'Teacher student delete wiring');
assertSource(/data-teacher-add-student/, 'Teacher student add wiring');
assertSource(/function\s+renderTeacherStudentManagementRows\s*\(/, 'Teacher student management renderer');
assertSource(/function\s+renderTeacherHistoryRows\s*\(/, 'Teacher history renderer');
assertSource(/function\s+renderTeacherReportRows\s*\(/, 'Teacher report renderer');
assertSource(/function\s+renderTeacherTextTaskRows\s*\(/, 'Teacher text task renderer');
assertSource(/function\s+renderTeacherRewardRows\s*\(/, 'Teacher reward renderer');
assertSource(/function\s+renderTeacherGradesRows\s*\(/, 'Teacher admin-like grades renderer');
assertSource(/data-teacher-grade-tab/, 'Teacher grades tab wiring');
assertSource(/data-teacher-grade-filter/, 'Teacher grades filter wiring');
assertSource(/data-teacher-history-filter/, 'Teacher history filter wiring');
assertSource(/data-teacher-history-export/, 'Teacher history CSV wiring');
assertSource(/openStudentReportPanel/, 'Teacher report uses shared student report panel');
assertSource(/function\s+addTeacherStudentFromForm\s*\(/, 'Teacher student add handler');
assertSource(/data-teacher-grant-coins/, 'Teacher coin grant wiring');
assertSource(/data-teacher-grant-ticket/, 'Teacher ticket grant wiring');
assertSource(/data-teacher-text-export-task/, 'Teacher text task CSV wiring');

assertStyle(/\.teacher-status-controls/, 'Teacher status controls styles');
assertStyle(/\.teacher-status-alerts/, 'Teacher status attention label styles');
assertStyle(/\.teacher-status-ok/, 'Teacher status OK label styles');
assertStyle(/\.teacher-status-detail-btn/, 'Teacher status detail button styles');
assertStyle(/\.teacher-status-print/, 'Teacher status print button styles');
assertStyle(/\.teacher-menu-grid/, 'Teacher menu grid styles');
assertStyle(/\.teacher-menu-card/, 'Teacher menu card styles');
assertStyle(/\.teacher-student-manage-table/, 'Teacher student management table styles');
assertStyle(/\.teacher-student-add-card/, 'Teacher student add card styles');
assertStyle(/\.teacher-report-grid/, 'Teacher report grid styles');
assertStyle(/\.teacher-reward-grid/, 'Teacher reward grid styles');
assertStyle(/\.teacher-text-task-table/, 'Teacher text task table styles');
assertStyle(/\.teacher-admin-tabs/, 'Teacher admin-like tab styles');
assertStyle(/\.teacher-admin-filter-panel/, 'Teacher admin-like filter styles');
assertStyle(/\.teacher-admin-summary-grid/, 'Teacher admin-like summary styles');
assertStyle(/\.teacher-vision-radar-list/, 'Teacher vision radar list styles');
assertStyle(/\.teacher-text-chart-card/, 'Teacher text chart styles');

console.log('Teacher status UI check passed.');
