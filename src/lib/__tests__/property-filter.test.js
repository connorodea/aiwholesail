// Tests for property-filter.js — the "Listed within N days" search filter.
//
// Background: Zillow's search payload sometimes omits daysOnZillow on FSBO
// and recently-relisted properties (zillow-api.ts:394 only checks 3 field-
// name variants). property-filter.js compensates by falling back to listDate
// then datePostedString. These tests pin both the fallback chain and the
// inclusive-on-unknown policy.
//
// Run:
//   node --test src/lib/__tests__/property-filter.test.js

import test from 'node:test';
import assert from 'node:assert/strict';
import { effectiveDaysOnMarket, filterByMaxDaysOnMarket } from '../property-filter.js';

// Pinned "now" so date-arithmetic tests don't drift by wall-clock.
const NOW = new Date('2026-05-21T00:00:00.000Z');

const make = (id, fields) => ({ id, price: 100000, ...fields });

// --- effectiveDaysOnMarket ---

test('effective: returns daysOnMarket when present and non-negative', () => {
  assert.equal(effectiveDaysOnMarket({ daysOnMarket: 7 }, NOW), 7);
  assert.equal(effectiveDaysOnMarket({ daysOnMarket: 0 }, NOW), 0);
});

test('effective: ignores negative daysOnMarket (Zillow data corruption guard)', () => {
  // Sometimes Zillow returns -1; that should fall through, not be treated as 0.
  assert.equal(effectiveDaysOnMarket({ daysOnMarket: -1, listDate: '2026-05-14T00:00:00Z' }, NOW), 7);
});

test('effective: falls back to listDate when daysOnMarket missing', () => {
  assert.equal(effectiveDaysOnMarket({ listDate: '2026-05-14T00:00:00Z' }, NOW), 7);
});

test('effective: falls back to datePostedString when listDate also missing', () => {
  assert.equal(effectiveDaysOnMarket({ datePostedString: '2026-05-10T00:00:00Z' }, NOW), 11);
});

test('effective: prefers listDate over datePostedString when both present', () => {
  // listDate is the MLS on-market date (more authoritative). datePostedString
  // can be a re-post date that resets when the seller relists.
  const p = { listDate: '2026-05-14T00:00:00Z', datePostedString: '2026-05-20T00:00:00Z' };
  assert.equal(effectiveDaysOnMarket(p, NOW), 7);
});

test('effective: returns undefined when no source resolves', () => {
  assert.equal(effectiveDaysOnMarket({}, NOW), undefined);
  assert.equal(effectiveDaysOnMarket({ listDate: 'not-a-date' }, NOW), undefined);
  assert.equal(effectiveDaysOnMarket({ listDate: '' }, NOW), undefined);
});

test('effective: tolerates future-dated listings as unknown', () => {
  // A future listDate is almost certainly bad data. Don't return a negative
  // age — fall through to the next source or return undefined.
  assert.equal(effectiveDaysOnMarket({ listDate: '2026-06-01T00:00:00Z' }, NOW), undefined);
});

test('effective: future listDate falls through to datePostedString if valid', () => {
  const p = { listDate: '2026-06-01T00:00:00Z', datePostedString: '2026-05-19T00:00:00Z' };
  assert.equal(effectiveDaysOnMarket(p, NOW), 2);
});

test('effective: tolerates null/undefined property', () => {
  assert.equal(effectiveDaysOnMarket(null, NOW), undefined);
  assert.equal(effectiveDaysOnMarket(undefined, NOW), undefined);
});

// --- filterByMaxDaysOnMarket ---

test('filter: returns input unchanged when maxDaysOnMarket is undefined', () => {
  const input = [make('a', { daysOnMarket: 3 }), make('b', { daysOnMarket: 95 })];
  assert.equal(filterByMaxDaysOnMarket(input, undefined, NOW), input);
});

test('filter: returns input unchanged when maxDaysOnMarket is "any"', () => {
  const input = [make('a', { daysOnMarket: 3 })];
  assert.equal(filterByMaxDaysOnMarket(input, 'any', NOW), input);
});

test('filter: keeps properties at or below threshold via daysOnMarket', () => {
  const out = filterByMaxDaysOnMarket(
    [
      make('a', { daysOnMarket: 3 }),
      make('b', { daysOnMarket: 12 }),
      make('c', { daysOnMarket: 95 }),
    ],
    '14',
    NOW,
  );
  assert.deepEqual(out.map((p) => p.id), ['a', 'b']);
});

test('filter: boundary — threshold equal to age is INCLUDED', () => {
  const out = filterByMaxDaysOnMarket([make('exact', { daysOnMarket: 14 })], '14', NOW);
  assert.deepEqual(out.map((p) => p.id), ['exact']);
});

test('filter: uses listDate fallback when daysOnMarket missing', () => {
  // The regression this prevents: prior version excluded any property whose
  // daysOnMarket was undefined, even if listDate said it was fresh. A FSBO
  // listing without daysOnZillow + listDate = 5 days ago should pass a
  // "Last 7 days" filter.
  const out = filterByMaxDaysOnMarket(
    [
      make('fsbo-fresh', { listDate: '2026-05-16T00:00:00Z' }), // 5 days
      make('fsbo-stale', { listDate: '2026-02-01T00:00:00Z' }), // 109 days
    ],
    '7',
    NOW,
  );
  assert.deepEqual(out.map((p) => p.id), ['fsbo-fresh']);
});

test('filter: KEEPS properties with unknown age (inclusive-on-unknown policy)', () => {
  // Critical decision: when we can't resolve age from any source, keep the
  // property. Cost of one stale listing slipping through is lower than cost
  // of hiding a genuine fresh deal because Zillow's payload was incomplete.
  const out = filterByMaxDaysOnMarket(
    [
      make('fresh', { daysOnMarket: 3 }),
      make('unknown', {}), // no daysOnMarket, listDate, or datePostedString
      make('stale', { daysOnMarket: 95 }),
    ],
    '14',
    NOW,
  );
  assert.deepEqual(out.map((p) => p.id), ['fresh', 'unknown']);
});

test('filter: treats non-numeric maxDaysOnMarket as "no filter"', () => {
  const input = [make('a', { daysOnMarket: 3 }), make('b', { daysOnMarket: 95 })];
  assert.equal(filterByMaxDaysOnMarket(input, 'garbage', NOW), input);
});

test('filter: treats zero or negative maxDaysOnMarket as "no filter"', () => {
  const input = [make('a', { daysOnMarket: 3 })];
  assert.equal(filterByMaxDaysOnMarket(input, '0', NOW), input);
  assert.equal(filterByMaxDaysOnMarket(input, '-7', NOW), input);
});

test('filter: does not mutate input array', () => {
  const input = [make('a', { daysOnMarket: 3 }), make('b', { daysOnMarket: 95 })];
  const snapshot = [...input];
  filterByMaxDaysOnMarket(input, '14', NOW);
  assert.deepEqual(input, snapshot);
});

test('filter: returns empty array when nothing matches and no unknowns', () => {
  const out = filterByMaxDaysOnMarket(
    [make('a', { daysOnMarket: 95 }), make('b', { daysOnMarket: 200 })],
    '7',
    NOW,
  );
  assert.deepEqual(out, []);
});
