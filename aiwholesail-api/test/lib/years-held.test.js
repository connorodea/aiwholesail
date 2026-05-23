// Tests for yearsHeldFromPriceHistory — derives `years_held` from Zillow's
// priceHistory[] "Sold" events. Companion to failed-listing.js: same data
// source (priceHistory), same Phase-2 goal (replace PropData fields with
// scrape.do-derivable signals).
//
// Why this matters: 4 of the 12 shipped lead types depend on
// `r.equity.years_held` from PropData (`tired-landlord`, `senior-owner`,
// `cash-buyer`, `flippers`). When PropData rips out, those predicates
// need a different source. Zillow's priceHistory has dated "Sold" events
// for any property that's been on Zillow at least once — date math gives
// years held from the most recent sale.
//
// Run:
//   node --test aiwholesail-api/test/lib/years-held.test.js

const test = require('node:test');
const assert = require('node:assert/strict');
const { yearsHeldFromPriceHistory } = require('../../lib/years-held.js');

// Pinned "now" so date math is stable across runs.
const NOW = new Date('2026-05-23T00:00:00.000Z');
const opts = { now: NOW };

const ph = (...entries) => entries;
const e = (date, event, price = 350000) => ({ date, event, price });

test('returns years since most recent Sold event', () => {
  // Sold 2018-05-23 → exactly 8 years.
  const history = ph(
    e('2018-05-23', 'Sold'),
  );
  assert.equal(yearsHeldFromPriceHistory(history, opts), 8);
});

test('uses MOST RECENT Sold event when multiple exist', () => {
  // Two sales — flip pattern. Want the latest one (most recent ownership change).
  const history = ph(
    e('2005-01-01', 'Sold'),
    e('2020-05-23', 'Sold'),
  );
  assert.equal(yearsHeldFromPriceHistory(history, opts), 6);
});

test('returns null when no Sold event exists', () => {
  // New listing, never previously sold on Zillow.
  const history = ph(
    e('2026-04-01', 'Listed for sale'),
    e('2026-05-01', 'Price change'),
  );
  assert.equal(yearsHeldFromPriceHistory(history, opts), null);
});

test('returns null for empty priceHistory', () => {
  assert.equal(yearsHeldFromPriceHistory([], opts), null);
});

test('returns null for missing / null / non-array input', () => {
  for (const input of [null, undefined, 'not an array', 42, {}]) {
    assert.equal(yearsHeldFromPriceHistory(input, opts), null);
  }
});

test('floors fractional years (10.7 years → 10)', () => {
  // The lead-type predicates use thresholds like ">= 15" and ">= 25" —
  // they need integer years. Floor gives the conservative answer
  // (10.7 years is "10+ years held", not "11+").
  const history = ph(
    e('2015-09-15', 'Sold'),
  );
  // 2015-09-15 → 2026-05-23 is ~10.7 years; floor to 10.
  assert.equal(yearsHeldFromPriceHistory(history, opts), 10);
});

test('"Sold to third party" counts as a sale', () => {
  // Same as SALE_EVENTS in failed-listing.js — Zillow occasionally uses
  // this variant for non-MLS transfers. Should still anchor the years_held.
  const history = ph(
    e('2019-05-23', 'Sold to third party'),
  );
  assert.equal(yearsHeldFromPriceHistory(history, opts), 7);
});

test('ignores non-Sold events even if more recent', () => {
  // "Listed for sale" later than "Sold" doesn't reset years_held —
  // listing doesn't transfer ownership.
  const history = ph(
    e('2010-01-01', 'Sold'),
    e('2024-03-01', 'Listed for sale'),
    e('2024-08-01', 'Listing removed'),
  );
  assert.equal(yearsHeldFromPriceHistory(history, opts), 16);
});

test('returns null for Sold events with unparseable dates', () => {
  const history = ph(
    { date: 'not-a-date', event: 'Sold', price: 300000 },
    { date: '', event: 'Sold', price: 300000 },
    { date: null, event: 'Sold', price: 300000 },
  );
  assert.equal(yearsHeldFromPriceHistory(history, opts), null);
});

test('skips entries with unparseable dates, uses next valid one', () => {
  const history = ph(
    { date: 'garbage', event: 'Sold', price: 200000 },
    e('2019-05-23', 'Sold'),
  );
  assert.equal(yearsHeldFromPriceHistory(history, opts), 7);
});

test('returns null for future-dated Sold events (data corruption guard)', () => {
  // A Sold event in the future is bad data — Zillow occasionally returns
  // dates in foreign formats that parse to wrong years. Don't return a
  // negative years_held; fall through to the next source or return null.
  const history = ph(
    e('2030-05-23', 'Sold'),
  );
  assert.equal(yearsHeldFromPriceHistory(history, opts), null);
});

test('future-dated entry falls through to next valid Sold event', () => {
  const history = ph(
    e('2030-05-23', 'Sold'),
    e('2018-05-23', 'Sold'),
  );
  assert.equal(yearsHeldFromPriceHistory(history, opts), 8);
});

test('tolerates entries without an event field', () => {
  const history = ph(
    { date: '2020-01-01', price: 300000 }, // no event
    e('2019-05-23', 'Sold'),
  );
  assert.equal(yearsHeldFromPriceHistory(history, opts), 7);
});

test('default now is `new Date()` when omitted', () => {
  // Smoke test — no opts at all. Just verify no throw + returns a number
  // for a clear-cut input. Don't pin to a specific value (changes daily).
  const history = ph(
    e('2010-01-01', 'Sold'),
  );
  const result = yearsHeldFromPriceHistory(history);
  assert.ok(typeof result === 'number' && result > 10);
});
