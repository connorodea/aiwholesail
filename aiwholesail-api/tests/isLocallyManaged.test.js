/**
 * Bug-reproduction tests for the wipe-prevention predicate.
 *
 * Three independent code paths in stripe.js + subscription.js each had their
 * own inline version of "is this row still alive locally even if Stripe says
 * no?". That class of predicate produced the "20 wiped trials" incident
 * (PRs #192, #193, #194, #196). This file tests the shared helper that those
 * call sites should converge on.
 *
 *   node --test aiwholesail-api/tests/isLocallyManaged.test.js
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const { isLocallyManaged } = require('../lib/subscriptionTier');

const NOW = new Date('2026-05-12T00:00:00.000Z');
const PAST = new Date('2026-05-01T00:00:00.000Z').toISOString();
const FUTURE = new Date('2026-05-19T00:00:00.000Z').toISOString();

// ---------------------------------------------------------------------------
// Preserve cases — these MUST short-circuit any Stripe-driven wipe.
// ---------------------------------------------------------------------------
test('PRESERVE: active in-app DB trial (is_trial=true, trial_end in future)', () => {
  const row = { is_trial: true, trial_end: FUTURE, subscription_end: null };
  assert.equal(isLocallyManaged(row, NOW), true);
});

test('PRESERVE: manual Elite grant (subscription_end in future, no Stripe sub)', () => {
  // The exact case PR #194 fixed — admin manually granted Elite, Stripe has
  // no live subscription for the customer, but we should NOT wipe.
  const row = { is_trial: false, trial_end: null, subscription_end: FUTURE };
  assert.equal(isLocallyManaged(row, NOW), true);
});

test('PRESERVE: trial + future end (defensive — both set)', () => {
  const row = { is_trial: true, trial_end: FUTURE, subscription_end: FUTURE };
  assert.equal(isLocallyManaged(row, NOW), true);
});

// ---------------------------------------------------------------------------
// Wipe-OK cases — these are genuine downgrades, safe to clear.
// ---------------------------------------------------------------------------
test('WIPE OK: trial expired AND no subscription_end', () => {
  const row = { is_trial: true, trial_end: PAST, subscription_end: null };
  assert.equal(isLocallyManaged(row, NOW), false);
});

test('WIPE OK: both trial and sub expired', () => {
  const row = { is_trial: true, trial_end: PAST, subscription_end: PAST };
  assert.equal(isLocallyManaged(row, NOW), false);
});

test('WIPE OK: not on trial, no subscription_end at all', () => {
  const row = { is_trial: false, trial_end: null, subscription_end: null };
  assert.equal(isLocallyManaged(row, NOW), false);
});

test('WIPE OK: is_trial=false even with future trial_end (stale data)', () => {
  // is_trial is the source of truth for trial state. A stale trial_end on a
  // non-trial row should NOT keep them subscribed.
  const row = { is_trial: false, trial_end: FUTURE, subscription_end: null };
  assert.equal(isLocallyManaged(row, NOW), false);
});

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------
test('edge: trial_end exactly at "now" is NOT preserved (strict future)', () => {
  const row = { is_trial: true, trial_end: NOW.toISOString(), subscription_end: null };
  assert.equal(isLocallyManaged(row, NOW), false);
});

test('edge: subscription_end exactly at "now" is NOT preserved (strict future)', () => {
  const row = { is_trial: false, subscription_end: NOW.toISOString() };
  assert.equal(isLocallyManaged(row, NOW), false);
});

test('edge: null row → not managed', () => {
  assert.equal(isLocallyManaged(null, NOW), false);
  assert.equal(isLocallyManaged(undefined, NOW), false);
});

test('edge: empty row → not managed', () => {
  assert.equal(isLocallyManaged({}, NOW), false);
});

test('edge: invalid date strings → not managed (not preserved)', () => {
  const row = { is_trial: true, trial_end: 'not-a-date', subscription_end: 'also-bad' };
  // new Date('not-a-date').getTime() = NaN, NaN > anything = false → not preserved.
  assert.equal(isLocallyManaged(row, NOW), false);
});

test('edge: numeric epoch ms accepted as `now`', () => {
  const row = { is_trial: true, trial_end: FUTURE };
  assert.equal(isLocallyManaged(row, NOW.getTime()), true);
});

test('edge: bogus `now` value → not managed (fail safe)', () => {
  const row = { is_trial: true, trial_end: FUTURE };
  // If clock injection misfires, we'd rather under-preserve (gate harder)
  // than over-preserve (let an expired trial slip through forever).
  assert.equal(isLocallyManaged(row, NaN), false);
});

// ---------------------------------------------------------------------------
// Real incident — "qdog500@gmail.com" pattern (PR #200 reference)
// ---------------------------------------------------------------------------
test('REAL CASE: Pro trial mid-flight at 2026-05-12 — must be preserved', () => {
  // Reproduces a user mid-Pro-trial when a Stripe webhook fires with 0 subs:
  // pre-fix, this wiped the user. With this predicate, the wipe is skipped.
  const row = {
    user_id: 'user-qdog500',
    is_trial: true,
    trial_end: '2026-05-19T00:00:00.000Z',
    subscription_end: '2026-05-19T00:00:00.000Z',
    subscription_tier: 'Pro',
    subscribed: true,
  };
  assert.equal(
    isLocallyManaged(row, NOW),
    true,
    'A user mid-trial must never be wiped by a Stripe-driven webhook.',
  );
});
