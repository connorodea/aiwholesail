// Tests for the wholesale-potential comparator used to default-sort
// property search results.
//
// User intent (2026-05-15 follow-up to the freshness-weighted-rank work):
//
//   "Property search should pull in the BEST spreads + the NEWEST
//    spreads as the default. It was finding listings that JUST hit
//    Zillow, now it's finding spreads that are 4-5 days old."
//
// The pure freshness-weighted multiplier (1.5x boost ≤1d, 1.0x at 4-7d)
// lets a 4-day $200K spread (rank 200K) beat a brand-new $80K spread
// (rank 120K). User wants brand-new qualified deals to surface
// regardless of spread differential — even a brand-new $30K should
// beat a 4-day $200K.
//
// Resolution: hard tier within qualified deals.
//   1. Brand-new (≤1d) qualified deals — sorted by spread DESC
//   2. Other qualified deals — sorted by freshness-weighted rank
//   3. Positive-spread non-deals — sorted by freshness-weighted rank
//   4. With-zestimate (negative spread) — by spread DESC
//   5. Without zestimate — by daysOnMarket ASC
//
// freshnessWeightedRank itself is unchanged — only how the comparator
// applies it changes.

import test from 'node:test';
import assert from 'node:assert/strict';
import { compareWholesalePotential } from '../wholesale-sort.js';

function p(props) {
  return { price: 100000, zestimate: 100000, daysOnMarket: 5, ...props };
}

function sorted(items) {
  return [...items].sort(compareWholesalePotential).map((x) => x.id);
}

test('brand-new qualified deal beats older qualified deal regardless of spread differential', () => {
  // 4-day $200K spread vs brand-new $80K spread — old algo: 4-day wins.
  // New algo: brand-new wins because brand-new is its own tier.
  const fresh = p({ id: 'fresh-80k', price: 100000, zestimate: 180000, daysOnMarket: 0 });
  const stale = p({ id: 'stale-200k', price: 100000, zestimate: 300000, daysOnMarket: 4 });
  assert.deepEqual(sorted([stale, fresh]), ['fresh-80k', 'stale-200k']);
});

test('brand-new $30K (just qualifies) beats 14-day $200K', () => {
  // The test the user EXPLICITLY changed their mind on. Old test in
  // freshness-weighted-rank.test.js asserted the opposite for the
  // multiplier alone — that test is still valid (multiplier unchanged),
  // but the SORT semantics now elevate brand-new to a separate tier.
  const fresh = p({ id: 'fresh-30k', price: 100000, zestimate: 130000, daysOnMarket: 0 });
  const stale = p({ id: 'stale-200k', price: 100000, zestimate: 300000, daysOnMarket: 14 });
  assert.deepEqual(sorted([stale, fresh]), ['fresh-30k', 'stale-200k']);
});

test('within brand-new tier: bigger spread first', () => {
  const fresh100k = p({ id: 'fresh-100k', price: 100000, zestimate: 200000, daysOnMarket: 0 });
  const fresh50k = p({ id: 'fresh-50k', price: 100000, zestimate: 150000, daysOnMarket: 0 });
  const fresh200k = p({ id: 'fresh-200k', price: 100000, zestimate: 300000, daysOnMarket: 0 });
  assert.deepEqual(
    sorted([fresh50k, fresh100k, fresh200k]),
    ['fresh-200k', 'fresh-100k', 'fresh-50k'],
  );
});

test('brand-new tier requires QUALIFIED spread (≥$30K) — small fresh spreads do NOT trump big older qualified deals', () => {
  // Guards against the over-correction: a brand-new $5K spread should
  // NOT beat a 4-day $200K qualified deal. Brand-new tier gates on
  // both freshness AND spread ≥ $30K.
  const tinyFresh = p({ id: 'fresh-5k', price: 100000, zestimate: 105000, daysOnMarket: 0 });
  const bigStale = p({ id: 'stale-200k', price: 100000, zestimate: 300000, daysOnMarket: 4 });
  assert.deepEqual(sorted([tinyFresh, bigStale]), ['stale-200k', 'fresh-5k']);
});

test('brand-new with negative spread does NOT come first (it isn\'t a deal at all)', () => {
  const overpriced = p({ id: 'fresh-neg', price: 200000, zestimate: 180000, daysOnMarket: 0 });
  const stale = p({ id: 'stale-200k', price: 100000, zestimate: 300000, daysOnMarket: 4 });
  assert.deepEqual(sorted([overpriced, stale]), ['stale-200k', 'fresh-neg']);
});

test('non-brand-new qualified deals: freshness-weighted rank still applies (existing semantics)', () => {
  // Two listings, neither brand-new, both qualified. Old algo's
  // freshness-weighted-rank decides ordering. 3-day $80K (×1.25 = 100K)
  // beats 8-day $100K (×0.75 = 75K).
  const day3 = p({ id: 'day3-80k', price: 100000, zestimate: 180000, daysOnMarket: 3 });
  const day8 = p({ id: 'day8-100k', price: 100000, zestimate: 200000, daysOnMarket: 8 });
  assert.deepEqual(sorted([day8, day3]), ['day3-80k', 'day8-100k']);
});

test('properties without zestimate sort to the bottom', () => {
  const noZest = p({ id: 'no-zest', price: 100000, zestimate: undefined, daysOnMarket: 0 });
  const stale = p({ id: 'stale-deal', price: 100000, zestimate: 200000, daysOnMarket: 30 });
  // Stale qualified deal still beats a brand-new property with no zestimate.
  assert.deepEqual(sorted([noZest, stale]), ['stale-deal', 'no-zest']);
});

test('among no-zestimate properties, newest first', () => {
  const newer = p({ id: 'no-zest-new', price: 100000, zestimate: undefined, daysOnMarket: 1 });
  const older = p({ id: 'no-zest-old', price: 100000, zestimate: undefined, daysOnMarket: 30 });
  assert.deepEqual(sorted([older, newer]), ['no-zest-new', 'no-zest-old']);
});

test('comparator is stable for identical inputs', () => {
  const x = p({ id: 'x', price: 100000, zestimate: 200000, daysOnMarket: 5 });
  const y = p({ id: 'y', price: 100000, zestimate: 200000, daysOnMarket: 5 });
  assert.equal(compareWholesalePotential(x, y), 0);
});
