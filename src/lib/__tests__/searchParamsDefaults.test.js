// Tests for the pure default-merging helper used when replaying a stored
// recent-search entry. Pin the behavioral contract: stored values win, and
// any KEY missing from the stored entry falls back to the current default.
// This is what protects users from silent UX drift when PropertySearchParams
// gains a new field after they recorded a search.
//
// Run:
//   node --test src/lib/__tests__/searchParamsDefaults.test.js

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ON_MARKET_DEFAULTS,
  applyHistoryDefaults,
} from '../searchParamsDefaults.js';

test('ON_MARKET_DEFAULTS exports the initial on-market form state', () => {
  // Keys we contractually require — others may be added later, but these
  // must always be present so old entries get sane defaults.
  assert.equal(typeof ON_MARKET_DEFAULTS, 'object');
  assert.ok('location' in ON_MARKET_DEFAULTS);
  assert.ok('homeType' in ON_MARKET_DEFAULTS);
  assert.ok('wholesaleOnly' in ON_MARKET_DEFAULTS);
});

test('applyHistoryDefaults: missing key in stored → filled from defaults', () => {
  // Simulates an old entry recorded before `wholesaleOnly` existed —
  // replay must give the user the current default, not undefined.
  const defaults = { location: '', homeType: 'Houses', wholesaleOnly: true };
  const stored = { location: 'Detroit, MI', homeType: 'Houses' };
  const out = applyHistoryDefaults(stored, defaults);
  assert.equal(out.location, 'Detroit, MI');
  assert.equal(out.homeType, 'Houses');
  assert.equal(out.wholesaleOnly, true);
});

test('applyHistoryDefaults: stored value overrides default when present', () => {
  const defaults = { wholesaleOnly: true };
  const stored = { wholesaleOnly: false };
  const out = applyHistoryDefaults(stored, defaults);
  assert.equal(out.wholesaleOnly, false);
});

test('applyHistoryDefaults: empty stored object yields the defaults', () => {
  const defaults = { location: 'X', homeType: 'Y' };
  const out = applyHistoryDefaults({}, defaults);
  assert.deepEqual(out, defaults);
});

test('applyHistoryDefaults: extra keys in stored are preserved', () => {
  // Defensive: if a stored entry has a key the current defaults don't
  // know about (e.g. user downgraded), it shouldn't be dropped silently.
  const defaults = { location: '' };
  const stored = { location: 'X', someNewField: 'hello' };
  const out = applyHistoryDefaults(stored, defaults);
  assert.equal(out.someNewField, 'hello');
});

test('applyHistoryDefaults: does not mutate inputs', () => {
  const defaults = { a: 1, b: 2 };
  const stored = { a: 99 };
  const beforeD = JSON.stringify(defaults);
  const beforeS = JSON.stringify(stored);
  applyHistoryDefaults(stored, defaults);
  assert.equal(JSON.stringify(defaults), beforeD);
  assert.equal(JSON.stringify(stored), beforeS);
});

test('applyHistoryDefaults: returns a new object even on no-op', () => {
  // Slight redundancy but useful — callers can assume the returned object
  // is safe to mutate without affecting the originals.
  const defaults = { a: 1 };
  const stored = { a: 1 };
  const out = applyHistoryDefaults(stored, defaults);
  assert.notEqual(out, defaults);
  assert.notEqual(out, stored);
});
