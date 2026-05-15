// Tests for the freshness-weighted ranking score.
//
// Why this exists (user-reported regression 2026-05-15):
//
//   PR #201 changed the qualified-deals sort from days-primary to
//   spread-primary because $200K-spread 30-day-old listings were being
//   buried under $30K-spread brand-new ones. Now the user wants the
//   pendulum the other way — brand-new listings JUST hitting market
//   should surface, even if the spread is smaller than a stale listing.
//
//   User's exact ask: "newest first + highest spread first. It should
//   be both."
//
//   This module exposes a pure scoring function that combines both
//   factors. Used by sortPropertiesByWholesalePotential (called by
//   PropertyCard list rendering) so the ranking reflects the actual
//   wholesaler decision: a brand-new $50K spread beats a 14-day-old
//   $50K spread, but a $200K 30-day-old still beats a $50K brand-new
//   (because the spread differential is large enough to overcome the
//   freshness penalty).
//
// Run:
//   node --test src/lib/__tests__/freshness-weighted-rank.test.js

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  freshnessMultiplier,
  freshnessWeightedRank,
} from '../freshness-weighted-rank.js';

test('freshnessMultiplier: brand-new (0 days) = 1.5x boost', () => {
  // Wholesalers love brand-new listings — competitive edge before other
  // wholesalers see them. 1.5x means a $100K brand-new beats a $140K
  // listing that's been sitting for >1 week.
  assert.equal(freshnessMultiplier(0), 1.5);
});

test('freshnessMultiplier: 1 day old still gets the new-listing boost', () => {
  // A listing posted yesterday is still meaningfully fresh — most
  // wholesalers don't refresh searches more than once per day.
  assert.equal(freshnessMultiplier(1), 1.5);
});

test('freshnessMultiplier: 2-3 days = 1.25x moderate boost', () => {
  assert.equal(freshnessMultiplier(2), 1.25);
  assert.equal(freshnessMultiplier(3), 1.25);
});

test('freshnessMultiplier: 4-7 days = 1.0x baseline (no adjustment)', () => {
  // Within a week is still actionable — the original spread carries
  // the ranking weight at this point.
  assert.equal(freshnessMultiplier(4), 1.0);
  assert.equal(freshnessMultiplier(7), 1.0);
});

test('freshnessMultiplier: 8-14 days = 0.75x penalty', () => {
  // Other wholesalers have likely seen it; reduce its rank.
  assert.equal(freshnessMultiplier(8), 0.75);
  assert.equal(freshnessMultiplier(14), 0.75);
});

test('freshnessMultiplier: 15+ days = 0.5x stale penalty', () => {
  // Saturated — every wholesaler in the market has already evaluated.
  // 0.5x means a $200K stale listing equals a $100K fresh one.
  assert.equal(freshnessMultiplier(15), 0.5);
  assert.equal(freshnessMultiplier(30), 0.5);
  assert.equal(freshnessMultiplier(180), 0.5);
});

test('freshnessMultiplier: null / undefined / missing daysOnMarket = 1.0 baseline', () => {
  // Defensive: when Zillow doesn't surface daysOnMarket (some scrape
  // paths drop it), don't penalize or boost — use baseline.
  assert.equal(freshnessMultiplier(null), 1.0);
  assert.equal(freshnessMultiplier(undefined), 1.0);
  assert.equal(freshnessMultiplier(NaN), 1.0);
});

test('freshnessMultiplier: negative daysOnMarket (Zillow data error) treated as 0 days', () => {
  // Some Zillow records have negative daysOnMarket from listing-date
  // anomalies. Cap to the brand-new bucket — that's the safer default.
  assert.equal(freshnessMultiplier(-1), 1.5);
  assert.equal(freshnessMultiplier(-7), 1.5);
});

test('freshnessWeightedRank: combines spread × freshness multiplier', () => {
  // Brand-new $200K spread → $300K effective
  assert.equal(freshnessWeightedRank(200000, 0), 300000);
  // 30-day-old $200K spread → $100K effective
  assert.equal(freshnessWeightedRank(200000, 30), 100000);
});

test('freshnessWeightedRank: brand-new $100K spread beats 30-day-old $200K spread', () => {
  // The crux of the user's ask — fresh listings must surface even
  // with smaller spreads.
  //   $100K × 1.5 (brand-new) = $150K
  //   $200K × 0.5 (stale)     = $100K
  assert.ok(
    freshnessWeightedRank(100000, 0) > freshnessWeightedRank(200000, 30),
    'fresh $100K must rank higher than stale $200K',
  );
});

test('freshnessWeightedRank: brand-new $50K does NOT beat 14-day-old $200K', () => {
  // Counter-test — the freshness boost shouldn't trample huge spreads.
  // A 4x spread differential survives an 8-14 day staleness penalty.
  //   $50K × 1.5 (brand-new) = $75K
  //   $200K × 0.75 (8-14 d)  = $150K
  assert.ok(
    freshnessWeightedRank(50000, 0) < freshnessWeightedRank(200000, 10),
    'fresh $50K must NOT rank above 10-day-old $200K — spread differential too large',
  );
});

test('freshnessWeightedRank: zero / negative spread returns 0 (filtered out by callers)', () => {
  // Defensive — non-deals shouldn't get freshness boosts.
  assert.equal(freshnessWeightedRank(0, 0), 0);
  assert.equal(freshnessWeightedRank(-10000, 0), 0);
});

test('freshnessWeightedRank: null spread treated as 0', () => {
  assert.equal(freshnessWeightedRank(null, 0), 0);
  assert.equal(freshnessWeightedRank(undefined, 0), 0);
});

test('freshnessWeightedRank: pure function — same input → same output', () => {
  const a = freshnessWeightedRank(100000, 5);
  const b = freshnessWeightedRank(100000, 5);
  assert.equal(a, b);
});
