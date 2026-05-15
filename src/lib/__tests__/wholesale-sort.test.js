// Tests for the wholesale-potential comparator used to default-sort
// property search results.
//
// User-validated 2026-05-15 (after a brief experiment with a
// brand-new tier that the user rejected): default sort is **pure
// spread DESC** within tiers. No freshness-weighted multiplier in
// the comparator — biggest deals come first, period. Freshness only
// matters as a tiebreaker among identical spreads, and as the sole
// signal among properties that have no zestimate at all.
//
// Tier order (highest first):
//   1. Qualified deals (spread ≥ $30K) — by spread DESC
//   2. Positive-spread non-deals — by spread DESC
//   3. With-zestimate (negative spread) — by spread DESC (less-negative first)
//   4. Without zestimate — by daysOnMarket ASC (newest first)

import test from 'node:test';
import assert from 'node:assert/strict';
import { compareWholesalePotential } from '../wholesale-sort.js';

function p(props) {
  return { price: 100000, zestimate: 100000, daysOnMarket: 5, ...props };
}

function sorted(items) {
  return [...items].sort(compareWholesalePotential).map((x) => x.id);
}

test('qualified deals sort by spread DESC regardless of freshness', () => {
  // The user-corrected behavior — biggest spread always wins, even if
  // it's older. A 4-day $200K spread beats a brand-new $80K spread.
  const fresh = p({ id: 'fresh-80k', price: 100000, zestimate: 180000, daysOnMarket: 0 });
  const stale = p({ id: 'stale-200k', price: 100000, zestimate: 300000, daysOnMarket: 4 });
  assert.deepEqual(sorted([fresh, stale]), ['stale-200k', 'fresh-80k']);
});

test('a 14-day $200K spread beats a brand-new $30K spread (pure spread sort)', () => {
  const fresh = p({ id: 'fresh-30k', price: 100000, zestimate: 130000, daysOnMarket: 0 });
  const stale = p({ id: 'stale-200k', price: 100000, zestimate: 300000, daysOnMarket: 14 });
  assert.deepEqual(sorted([fresh, stale]), ['stale-200k', 'fresh-30k']);
});

test('among qualified deals: tiebreak by daysOnMarket (newer first) when spreads are equal', () => {
  // Identical $100K spreads — surface the newer one to give wholesalers
  // a competitive edge on otherwise-equivalent deals.
  const newer = p({ id: 'day-1', price: 100000, zestimate: 200000, daysOnMarket: 1 });
  const older = p({ id: 'day-10', price: 100000, zestimate: 200000, daysOnMarket: 10 });
  assert.deepEqual(sorted([older, newer]), ['day-1', 'day-10']);
});

test('qualified deals always sort above positive-spread non-deals (regardless of freshness)', () => {
  // A stale $30K qualified deal beats a brand-new $20K spread.
  const staleQualified = p({ id: 'stale-30k', price: 100000, zestimate: 130000, daysOnMarket: 30 });
  const freshNonDeal = p({ id: 'fresh-20k', price: 100000, zestimate: 120000, daysOnMarket: 0 });
  assert.deepEqual(sorted([freshNonDeal, staleQualified]), ['stale-30k', 'fresh-20k']);
});

test('positive-spread non-deals sort by spread DESC', () => {
  const sm = p({ id: 'sm-10k', price: 100000, zestimate: 110000, daysOnMarket: 1 });
  const md = p({ id: 'md-20k', price: 100000, zestimate: 120000, daysOnMarket: 5 });
  assert.deepEqual(sorted([sm, md]), ['md-20k', 'sm-10k']);
});

test('positive-spread non-deals always above with-zestimate-but-negative-spread', () => {
  const tinyPositive = p({ id: 'pos-1k', price: 100000, zestimate: 101000, daysOnMarket: 30 });
  const negative = p({ id: 'neg-50k', price: 200000, zestimate: 150000, daysOnMarket: 0 });
  assert.deepEqual(sorted([negative, tinyPositive]), ['pos-1k', 'neg-50k']);
});

test('with-zestimate (negative spread) sorts by spread DESC — less-negative first', () => {
  const lessNeg = p({ id: 'neg-10k', price: 110000, zestimate: 100000, daysOnMarket: 5 });
  const moreNeg = p({ id: 'neg-50k', price: 150000, zestimate: 100000, daysOnMarket: 5 });
  assert.deepEqual(sorted([moreNeg, lessNeg]), ['neg-10k', 'neg-50k']);
});

test('properties without zestimate sort to the bottom', () => {
  const noZest = p({ id: 'no-zest', price: 100000, zestimate: undefined, daysOnMarket: 0 });
  const stale = p({ id: 'stale-deal', price: 100000, zestimate: 200000, daysOnMarket: 30 });
  assert.deepEqual(sorted([noZest, stale]), ['stale-deal', 'no-zest']);
});

test('among no-zestimate properties, newest first', () => {
  // Freshness IS the only signal here — without a zestimate there's
  // no spread to sort on.
  const newer = p({ id: 'no-zest-new', price: 100000, zestimate: undefined, daysOnMarket: 1 });
  const older = p({ id: 'no-zest-old', price: 100000, zestimate: undefined, daysOnMarket: 30 });
  assert.deepEqual(sorted([older, newer]), ['no-zest-new', 'no-zest-old']);
});

test('comparator is stable for identical inputs', () => {
  const x = p({ id: 'x', price: 100000, zestimate: 200000, daysOnMarket: 5 });
  const y = p({ id: 'y', price: 100000, zestimate: 200000, daysOnMarket: 5 });
  assert.equal(compareWholesalePotential(x, y), 0);
});
