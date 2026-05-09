#!/usr/bin/env node
import assert from 'node:assert/strict';

import {
  getDashboardProgressPercent,
  getVisionDifficultySuffix
} from '../src/ui/admin-dashboard-utils.js';

assert.equal(getDashboardProgressPercent(0, 7), 0);
assert.equal(getDashboardProgressPercent(3, 7), 42);
assert.equal(getDashboardProgressPercent(7, 7), 100);
assert.equal(getDashboardProgressPercent(9, 7), 100);
assert.equal(getDashboardProgressPercent(-1, 7), 0);
assert.equal(getDashboardProgressPercent(3, 0), 0);

assert.equal(getVisionDifficultySuffix('normal'), '');
assert.equal(getVisionDifficultySuffix('easy'), '_easy');
assert.equal(getVisionDifficultySuffix('hard'), '_hard');

console.log('Admin dashboard utility check passed.');
