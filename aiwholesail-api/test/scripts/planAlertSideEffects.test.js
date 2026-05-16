// Tests for the spread-alert worker's per-alert side-effect planner.
//
// Real incident 2026-05-15: when Resend 429'd 12 alert dispatches, the
// worker still ran the alert_sent_deals INSERT and the last_alert_sent
// UPDATE for those 12 users — silently locking them out of receiving
// the batch in any future run (alert_sent_deals is a permanent dedup
// gate; the deal-find query excludes any zpid already there for that
// alert_id).
//
// Per-PR-#464 fix: gate those two writes on emailSent === true. The
// property_alert_matches insert (audit row) and webhook dispatch
// (independent contract) still run regardless.
//
// This module exposes a pure planner that returns a list of action
// objects describing the writes to perform. The worker iterates and
// executes. Tests verify the action list — no DB or network needed.
//
// Run:
//   node --test aiwholesail-api/test/scripts/planAlertSideEffects.test.js

const test = require('node:test');
const assert = require('node:assert/strict');
const { planAlertSideEffects } = require('../../lib/planAlertSideEffects');

const ALERT = { id: 'alert-1', user_id: 'u-1' };
const DEALS = [
  { zpid: 'z-100', spread: 45000 },
  { zpid: 'z-200', spread: 80000 },
];

function actionTypes(actions) {
  return actions.map((a) => a.type);
}

test('emailSent=true: plans dedup INSERTs + last_alert_sent UPDATE + match audit rows', () => {
  const actions = planAlertSideEffects({
    alert: ALERT,
    deals: DEALS,
    emailSent: true,
    smsSent: false,
  });

  assert.deepEqual(actionTypes(actions), [
    'insert_sent_deal',
    'insert_sent_deal',
    'bump_last_alert_sent',
    'insert_match',
    'insert_match',
  ]);
});

test('emailSent=false: NO dedup INSERTs and NO bump (the data-integrity fix)', () => {
  // The crux. Failed-email dispatches must NOT be marked as sent —
  // those zpids stay eligible for the next run's dispatch.
  const actions = planAlertSideEffects({
    alert: ALERT,
    deals: DEALS,
    emailSent: false,
    smsSent: false,
  });

  const types = actionTypes(actions);
  assert.equal(types.includes('insert_sent_deal'), false, 'must NOT mark deals as sent on email failure');
  assert.equal(types.includes('bump_last_alert_sent'), false, 'must NOT advance frequency window on email failure');
});

test('emailSent=false: still inserts match audit rows (with email_sent=false)', () => {
  // The audit trail records what we attempted, including failures.
  // Marketing/ops dashboards need to see that the user had matching
  // deals even when delivery failed, so they can investigate.
  const actions = planAlertSideEffects({
    alert: ALERT,
    deals: DEALS,
    emailSent: false,
    smsSent: false,
  });

  const matchActions = actions.filter((a) => a.type === 'insert_match');
  assert.equal(matchActions.length, 2);
  assert.equal(matchActions[0].emailSent, false);
  assert.equal(matchActions[0].smsSent, false);
});

test('emailSent=true: match audit rows record emailSent=true', () => {
  const actions = planAlertSideEffects({
    alert: ALERT,
    deals: DEALS,
    emailSent: true,
    smsSent: false,
  });

  const matchActions = actions.filter((a) => a.type === 'insert_match');
  assert.equal(matchActions.every((a) => a.emailSent === true), true);
});

test('insert_sent_deal action carries alertId, zpid, spread (worker writes these into alert_sent_deals)', () => {
  const actions = planAlertSideEffects({
    alert: ALERT,
    deals: DEALS,
    emailSent: true,
    smsSent: false,
  });

  const sentDeals = actions.filter((a) => a.type === 'insert_sent_deal');
  assert.equal(sentDeals.length, 2);
  assert.equal(sentDeals[0].alertId, 'alert-1');
  assert.equal(sentDeals[0].zpid, 'z-100');
  assert.equal(sentDeals[0].spread, 45000);
  assert.equal(sentDeals[1].zpid, 'z-200');
  assert.equal(sentDeals[1].spread, 80000);
});

test('bump_last_alert_sent action carries alertId only', () => {
  const actions = planAlertSideEffects({
    alert: ALERT,
    deals: DEALS,
    emailSent: true,
    smsSent: false,
  });

  const bump = actions.find((a) => a.type === 'bump_last_alert_sent');
  assert.equal(bump.alertId, 'alert-1');
});

test('insert_match action carries the deal payload as JSON-encodable data', () => {
  const richDeal = {
    zpid: 'z-300',
    spread: 60000,
    address: '123 Main St',
    bedrooms: 3,
    price: 100000,
    zestimate: 160000,
  };
  const actions = planAlertSideEffects({
    alert: ALERT,
    deals: [richDeal],
    emailSent: true,
    smsSent: false,
  });

  const match = actions.find((a) => a.type === 'insert_match');
  assert.equal(match.alertId, 'alert-1');
  assert.equal(match.zpid, 'z-300');
  assert.deepEqual(match.dealPayload, richDeal);
  assert.equal(match.emailSent, true);
  assert.equal(match.smsSent, false);
});

test('empty deals list returns no actions (worker should `continue` before calling)', () => {
  const actions = planAlertSideEffects({
    alert: ALERT,
    deals: [],
    emailSent: true,
    smsSent: false,
  });
  assert.deepEqual(actions, []);
});
