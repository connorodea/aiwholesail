// Pure-logic tests for the 401-storm detector.
//
// ESM + node:test, matches the in-repo convention used by
// locationValidation.test.js, comps-similarity.test.js, etc.
//
// Run:
//   node --test src/lib/__tests__/auth-storm-detector.test.js

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  STORM_THRESHOLD,
  STORM_WINDOW_MS,
  AUTH_FAILURE_CODES,
  createDetector,
  getDetector,
  _resetForTests,
} from '../auth-storm-detector.js';

// ─── Constants ────────────────────────────────────────────────────────────

test('STORM_THRESHOLD is 5', () => {
  assert.equal(STORM_THRESHOLD, 5);
});

test('STORM_WINDOW_MS is 10 seconds', () => {
  assert.equal(STORM_WINDOW_MS, 10_000);
});

test('AUTH_FAILURE_CODES includes the three documented codes', () => {
  assert.ok(AUTH_FAILURE_CODES.has('TOKEN_EXPIRED'));
  assert.ok(AUTH_FAILURE_CODES.has('NOT_AUTHENTICATED'));
  assert.ok(AUTH_FAILURE_CODES.has('INVALID_TOKEN'));
});

// ─── createDetector — happy path ────────────────────────────────────────

test('createDetector: single failure does not trip', () => {
  const d = createDetector();
  assert.equal(d.recordAuthFailure(1000).shouldTrip, false);
  assert.equal(d.getState().count, 1);
  assert.equal(d.getState().tripped, false);
});

test('createDetector: trips on the 5th failure inside the window', () => {
  const d = createDetector();
  // 4 failures, all in the same window
  for (let i = 0; i < 4; i++) {
    assert.equal(d.recordAuthFailure(1000 + i * 100).shouldTrip, false);
  }
  // 5th failure inside the window → trip
  assert.equal(d.recordAuthFailure(1500).shouldTrip, true);
  assert.equal(d.getState().tripped, true);
});

test('createDetector: does NOT trip if failures are spread across windows', () => {
  const d = createDetector();
  // 4 failures across a 30s spread → never reaches threshold inside any 10s window
  d.recordAuthFailure(0);
  d.recordAuthFailure(11_000);   // outside window — resets count to 1
  d.recordAuthFailure(22_000);   // outside again — resets count to 1
  d.recordAuthFailure(33_000);   // ditto
  const r = d.recordAuthFailure(44_000);
  assert.equal(r.shouldTrip, false, 'spread-out failures must not trip');
  assert.equal(d.getState().count, 1, 'window reset means count is back to 1');
});

test('createDetector: trips only ONCE per storm (latched until recordSuccess)', () => {
  const d = createDetector();
  // Trip
  for (let i = 0; i < 4; i++) d.recordAuthFailure(1000 + i * 100);
  assert.equal(d.recordAuthFailure(1500).shouldTrip, true);
  // Subsequent failures in the same storm must NOT re-trip — prevents
  // in-flight 401s from re-firing the clear cascade
  for (let i = 0; i < 10; i++) {
    assert.equal(d.recordAuthFailure(1600 + i * 100).shouldTrip, false,
      `failure ${i + 1} after trip must not re-trip`);
  }
});

test('createDetector: recordSuccess resets the trip latch', () => {
  const d = createDetector();
  for (let i = 0; i < 4; i++) d.recordAuthFailure(1000 + i * 100);
  d.recordAuthFailure(1500); // trip
  assert.equal(d.getState().tripped, true);

  d.recordSuccess();
  assert.equal(d.getState().tripped, false, 'recordSuccess must clear trip latch');
  assert.equal(d.getState().count, 0, 'and reset the counter');
});

test('createDetector: recordSuccess mid-window resets the count (genuine token still valid)', () => {
  const d = createDetector();
  d.recordAuthFailure(1000);
  d.recordAuthFailure(1100);
  // Successful 2xx — token must be working; reset
  d.recordSuccess();
  // Next four failures should NOT push us to trip (only 4 in the fresh window)
  d.recordAuthFailure(1200);
  d.recordAuthFailure(1300);
  d.recordAuthFailure(1400);
  d.recordAuthFailure(1500);
  // 5th failure since reset → trip is correct
  const r = d.recordAuthFailure(1600);
  assert.equal(r.shouldTrip, true);
});

// ─── getDetector singleton ────────────────────────────────────────────

test('getDetector returns the same instance across calls', () => {
  _resetForTests();
  const a = getDetector();
  const b = getDetector();
  assert.equal(a, b, 'singleton must be referentially equal');
});

test('_resetForTests creates a new singleton on next getDetector()', () => {
  const a = getDetector();
  a.recordAuthFailure(1000);
  assert.equal(a.getState().count, 1);

  _resetForTests();
  const b = getDetector();
  assert.equal(b.getState().count, 0, 'reset singleton starts fresh');
});

// ─── Boundary cases ────────────────────────────────────────────────────

test('recordAuthFailure: failure exactly at the window boundary still counts (10000ms inclusive)', () => {
  const d = createDetector();
  d.recordAuthFailure(0);
  // 10000ms later is EXACTLY at the boundary — still in-window (we use `>`)
  for (let i = 1; i < 4; i++) d.recordAuthFailure(i * 100);
  const r = d.recordAuthFailure(10_000);
  assert.equal(r.shouldTrip, true, 'failure at boundary counts toward storm');
});

test('recordAuthFailure: failure just past the window starts a new window', () => {
  const d = createDetector();
  d.recordAuthFailure(0);
  for (let i = 1; i < 4; i++) d.recordAuthFailure(i * 100);
  // 10001ms later → OUTSIDE the window → reset to count=1
  const r = d.recordAuthFailure(10_001);
  assert.equal(r.shouldTrip, false);
  assert.equal(d.getState().count, 1);
});
