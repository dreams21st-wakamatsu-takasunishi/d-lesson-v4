#!/usr/bin/env node
import assert from 'node:assert/strict';

import {
  buildPracticeHistoryCsv,
  getLocalDateKey
} from '../src/ui/admin-practice-history-utils.js';

const localEarlyMorning = new Date(2026, 4, 9, 1, 23);
assert.equal(getLocalDateKey(localEarlyMorning.toISOString()), '2026-05-09');
const localLateEvening = new Date(2026, 4, 9, 23, 30);
assert.equal(getLocalDateKey(localLateEvening.toISOString()), '2026-05-09');
assert.equal(getLocalDateKey('not-a-date'), '');

const csv = buildPracticeHistoryCsv([
  {
    dateKey: '2026-05-09',
    timeText: '09:30',
    name: 'Test Student',
    grade: '3',
    group: 'Monday,A',
    category: 'practice',
    title: 'Mouse "M-1"',
    detail: 'click',
    amount: '1',
    coins: 50
  }
]);

assert.equal(
  csv,
  [
    'date,time,student_name,grade,group,category,practice,detail,amount,coins',
    '2026-05-09,09:30,Test Student,3,"Monday,A",practice,"Mouse ""M-1""",click,1,50'
  ].join('\r\n')
);

console.log('Admin practice history utility check passed.');
