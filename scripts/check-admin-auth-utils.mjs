#!/usr/bin/env node
import assert from 'node:assert/strict';

import {
  buildAccessSql,
  getRoleAccessDataId,
  isMissingLessonScopeColumnError,
  isUuid,
  normalizeAccessScope,
  normalizeTeacherScope
} from '../src/ui/admin-auth-utils.js';

assert.equal(isUuid('36c95d17-621a-447d-b44b-638e21219ca1'), true);
assert.equal(isUuid('00000000-0000-0000-0000-000000000000'), false);
assert.equal(isUuid('not-a-uuid'), false);

assert.equal(getRoleAccessDataId('admin'), '__admin__');
assert.equal(getRoleAccessDataId('teacher'), '__teacher__');
assert.equal(getRoleAccessDataId('student'), '');

assert.deepEqual(normalizeTeacherScope('group', '  monday-a  '), {
  scope_type: 'group',
  scope_value: 'monday-a'
});
assert.deepEqual(normalizeTeacherScope('all', 'monday-a'), {
  scope_type: 'all',
  scope_value: ''
});
assert.deepEqual(normalizeAccessScope('student'), {
  scope_type: 'all',
  scope_value: ''
});
assert.deepEqual(normalizeAccessScope('admin'), {
  scope_type: 'all',
  scope_value: ''
});
assert.deepEqual(normalizeAccessScope('teacher', { scope_type: 'group', scope_value: ' A ' }), {
  scope_type: 'group',
  scope_value: 'A'
});

assert.equal(isMissingLessonScopeColumnError({ message: 'column scope_type does not exist' }), true);
assert.equal(isMissingLessonScopeColumnError({ details: 'scope_value missing' }), true);
assert.equal(isMissingLessonScopeColumnError({ message: 'permission denied' }), false);

const teacherSql = buildAccessSql(
  '36c95d17-621a-447d-b44b-638e21219ca1',
  'student_001',
  'teacher',
  { scope_type: 'group', scope_value: "mon'day-a" }
);
assert.match(teacherSql, /insert into public\.lesson_user_access/);
assert.match(teacherSql, /'teacher'/);
assert.match(teacherSql, /'group'/);
assert.match(teacherSql, /'mon''day-a'/);
assert.match(teacherSql, /on conflict \(auth_user_id, user_data_id\)/);

const studentSql = buildAccessSql('36c95d17-621a-447d-b44b-638e21219ca1', 'student_001', 'student');
assert.match(studentSql, /'student_001', 'student', 'all', ''/);

console.log('Admin auth utility check passed.');
