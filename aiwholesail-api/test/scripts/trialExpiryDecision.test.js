/**
 * Tests for the trial-expiry sweep decision helper.
 *
 * The full sweep script (scripts/trial-expiry-sweep.js) is IO-heavy
 * (Postgres + Stripe + systemd timer entry-point). The decision logic
 * is extracted to scripts/lib/trialExpiryDecision.js so it can be tested
 * deterministically without a DB or live Stripe.
 *
 * Run:
 *   node --test aiwholesail-api/test/scripts/trialExpiryDecision.test.js
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const { decide } = require('../../scripts/lib/trialExpiryDecision');

const NOW = new Date('2026-05-17T12:00:00Z');
const PAST = new Date('2026-05-10T12:00:00Z').toISOString();
const FUTURE = new Date('2026-05-24T12:00:00Z').toISOString();

test('downgrades expired trial with no Stripe subs', () => {
  const r = decide({
    row: { is_trial: true, trial_end: PAST },
    now: NOW,
    stripeSubs: [],
  });
  assert.equal(r.action, 'downgrade');
});

test('keeps row when Stripe shows an active subscription (paid converted)', () => {
  const r = decide({
    row: { is_trial: true, trial_end: PAST },
    now: NOW,
    stripeSubs: [{ status: 'active' }],
  });
  assert.equal(r.action, 'keep_paying');
});

test('keeps row when Stripe shows a trialing subscription (paid sub in its own trial window)', () => {
  const r = decide({
    row: { is_trial: true, trial_end: PAST },
    now: NOW,
    stripeSubs: [{ status: 'trialing' }],
  });
  assert.equal(r.action, 'keep_paying');
});

test('ignores Stripe subs in dead states (canceled, incomplete_expired)', () => {
  const r = decide({
    row: { is_trial: true, trial_end: PAST },
    now: NOW,
    stripeSubs: [{ status: 'canceled' }, { status: 'incomplete_expired' }],
  });
  assert.equal(r.action, 'downgrade');
});

// Regression: every Stripe status that the canonical reconciler in
// routes/stripe.js treats as `live` (i.e. not canceled / incomplete_expired)
// must keep the customer's row intact. Pre-fix the helper only honored
// active/trialing — past_due and incomplete users were getting wrongly
// downgraded during their payment-retry / first-charge windows.
for (const status of ['past_due', 'unpaid', 'incomplete', 'paused']) {
  test(`Stripe status '${status}' keeps the row (mid-retry / mid-charge / paused billing)`, () => {
    const r = decide({
      row: { is_trial: true, trial_end: PAST },
      now: NOW,
      stripeSubs: [{ status }],
    });
    assert.equal(r.action, 'keep_paying',
      `status='${status}' should be treated as paying — Stripe will retry or confirm shortly`);
  });
}

test('keeps row whose trial is still active (trial_end in future)', () => {
  const r = decide({
    row: { is_trial: true, trial_end: FUTURE },
    now: NOW,
    stripeSubs: [],
  });
  assert.equal(r.action, 'keep_active');
});

test('keeps row that is not a trial', () => {
  const r = decide({
    row: { is_trial: false, trial_end: PAST },
    now: NOW,
    stripeSubs: [],
  });
  assert.equal(r.action, 'keep_not_trial');
});

test('keeps row with null trial_end (never set)', () => {
  const r = decide({
    row: { is_trial: true, trial_end: null },
    now: NOW,
    stripeSubs: [],
  });
  assert.equal(r.action, 'keep_active');
});

test('mixed sub list: one active among many canceled → keep_paying', () => {
  const r = decide({
    row: { is_trial: true, trial_end: PAST },
    now: NOW,
    stripeSubs: [
      { status: 'canceled' },
      { status: 'incomplete_expired' },
      { status: 'active' },
    ],
  });
  assert.equal(r.action, 'keep_paying');
});

test('tolerates null/undefined elements in stripeSubs', () => {
  const r = decide({
    row: { is_trial: true, trial_end: PAST },
    now: NOW,
    stripeSubs: [null, undefined, { status: 'active' }],
  });
  assert.equal(r.action, 'keep_paying');
});

test('regression: row missing is_trial column → keep_not_trial (caught the prod dry-run bug)', () => {
  // The sweep originally SELECTed only filter-by columns and omitted is_trial,
  // so every row arrived with is_trial=undefined. decide() correctly returns
  // keep_not_trial in that case — pinning this here so future SELECT changes
  // that drop is_trial fail loud in tests instead of silently no-op'ing the
  // sweep in production. See findExpiredTrials() comment.
  const r = decide({
    row: { trial_end: PAST }, // is_trial intentionally omitted
    now: NOW,
    stripeSubs: [],
  });
  assert.equal(r.action, 'keep_not_trial');
});
