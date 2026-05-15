// Tests for comp-filter helpers — pure-JS module per the repo's existing
// pattern (auth-coherence, brand-flags, comps-similarity, etc.).
//
// Filters comps by:
//   - distance from subject (radius miles)
//   - bedroom count (exact, ±1, or any)
//   - bathroom count (exact, ±1, or any)
//   - square-footage band (±% tolerance — "similar size")

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_COMPS_FILTERS,
  filterComps,
  isSqftWithinTolerance,
  matchesBedFilter,
  matchesBathFilter,
  matchesDistanceFilter,
} from '../comps-filter.js';

const SUBJECT = { bedrooms: 3, bathrooms: 2, sqft: 1800 };

function comp(overrides = {}) {
  return {
    address: '123 Test St',
    price: 250000,
    sqft: 1800,
    bedrooms: 3,
    bathrooms: 2,
    distance: 0.5,
    ...overrides,
  };
}

// ─── DEFAULT_COMPS_FILTERS ─────────────────────────────────────────

test('DEFAULT_COMPS_FILTERS exposes the canonical filter shape', () => {
  assert.equal(typeof DEFAULT_COMPS_FILTERS, 'object');
  // All "any" by default so first render shows every comp.
  assert.equal(DEFAULT_COMPS_FILTERS.maxDistanceMi, null);
  assert.equal(DEFAULT_COMPS_FILTERS.bedTolerance, 'any');
  assert.equal(DEFAULT_COMPS_FILTERS.bathTolerance, 'any');
  assert.equal(DEFAULT_COMPS_FILTERS.sqftTolerancePct, null);
});

// ─── isSqftWithinTolerance ────────────────────────────────────────

test('isSqftWithinTolerance: returns true when subject sqft missing (cannot filter)', () => {
  assert.equal(isSqftWithinTolerance(1800, undefined, 20), true);
  assert.equal(isSqftWithinTolerance(1800, null, 20), true);
});

test('isSqftWithinTolerance: returns true when comp sqft missing (no-data row)', () => {
  // We keep comps without sqft rather than drop them silently.
  assert.equal(isSqftWithinTolerance(undefined, 1800, 20), true);
});

test('isSqftWithinTolerance: ±20% band against 1800 sqft subject', () => {
  // ±20% of 1800 = ±360 → window [1440, 2160]
  assert.equal(isSqftWithinTolerance(1440, 1800, 20), true);
  assert.equal(isSqftWithinTolerance(2160, 1800, 20), true);
  assert.equal(isSqftWithinTolerance(1800, 1800, 20), true);
  assert.equal(isSqftWithinTolerance(1439, 1800, 20), false);
  assert.equal(isSqftWithinTolerance(2161, 1800, 20), false);
});

test('isSqftWithinTolerance: ±10% band is stricter', () => {
  // ±10% of 1800 = ±180 → window [1620, 1980]
  assert.equal(isSqftWithinTolerance(1620, 1800, 10), true);
  assert.equal(isSqftWithinTolerance(1980, 1800, 10), true);
  assert.equal(isSqftWithinTolerance(1619, 1800, 10), false);
});

test('isSqftWithinTolerance: passes through on null tolerance ("any")', () => {
  assert.equal(isSqftWithinTolerance(1, 1800, null), true);
  assert.equal(isSqftWithinTolerance(100000, 1800, null), true);
});

// ─── matchesBedFilter ─────────────────────────────────────────────

test('matchesBedFilter: "any" passes everything', () => {
  assert.equal(matchesBedFilter(2, 3, 'any'), true);
  assert.equal(matchesBedFilter(undefined, 3, 'any'), true);
});

test('matchesBedFilter: "exact" requires same count', () => {
  assert.equal(matchesBedFilter(3, 3, 'exact'), true);
  assert.equal(matchesBedFilter(2, 3, 'exact'), false);
  assert.equal(matchesBedFilter(4, 3, 'exact'), false);
});

test('matchesBedFilter: "+/-1" allows one bedroom of slack either side', () => {
  assert.equal(matchesBedFilter(2, 3, '+/-1'), true);
  assert.equal(matchesBedFilter(3, 3, '+/-1'), true);
  assert.equal(matchesBedFilter(4, 3, '+/-1'), true);
  assert.equal(matchesBedFilter(1, 3, '+/-1'), false);
  assert.equal(matchesBedFilter(5, 3, '+/-1'), false);
});

test('matchesBedFilter: passes when subject missing (cannot compare)', () => {
  assert.equal(matchesBedFilter(2, undefined, 'exact'), true);
});

test('matchesBedFilter: passes when comp missing (no-data row, do not drop)', () => {
  assert.equal(matchesBedFilter(undefined, 3, 'exact'), true);
});

// ─── matchesBathFilter ────────────────────────────────────────────

test('matchesBathFilter: "any" passes everything', () => {
  assert.equal(matchesBathFilter(1.5, 2, 'any'), true);
});

test('matchesBathFilter: "exact" rounds to nearest half-bath then compares', () => {
  assert.equal(matchesBathFilter(2, 2, 'exact'), true);
  assert.equal(matchesBathFilter(2.0, 2, 'exact'), true);
  assert.equal(matchesBathFilter(2.5, 2, 'exact'), false);
  assert.equal(matchesBathFilter(1.5, 2, 'exact'), false);
});

test('matchesBathFilter: "+/-1" allows one full bath of slack', () => {
  // ±1 of 2 → window [1.0, 3.0]
  assert.equal(matchesBathFilter(1, 2, '+/-1'), true);
  assert.equal(matchesBathFilter(3, 2, '+/-1'), true);
  assert.equal(matchesBathFilter(0.5, 2, '+/-1'), false);
  assert.equal(matchesBathFilter(3.5, 2, '+/-1'), false);
});

// ─── matchesDistanceFilter ────────────────────────────────────────

test('matchesDistanceFilter: null max passes everything', () => {
  assert.equal(matchesDistanceFilter(99, null), true);
});

test('matchesDistanceFilter: <= max passes, > max fails', () => {
  assert.equal(matchesDistanceFilter(0.5, 1), true);
  assert.equal(matchesDistanceFilter(1, 1), true);
  assert.equal(matchesDistanceFilter(1.01, 1), false);
});

test('matchesDistanceFilter: missing distance passes (no-data row, do not drop)', () => {
  assert.equal(matchesDistanceFilter(undefined, 1), true);
  assert.equal(matchesDistanceFilter(null, 1), true);
});

// ─── filterComps (composition) ────────────────────────────────────

test('filterComps: empty array in, empty array out (no throw)', () => {
  assert.deepEqual(filterComps([], SUBJECT, DEFAULT_COMPS_FILTERS), []);
});

test('filterComps: defaults pass every comp', () => {
  const comps = [
    comp({ bedrooms: 5, bathrooms: 4, sqft: 4000, distance: 3 }),
    comp({ bedrooms: 1, bathrooms: 1, sqft: 600, distance: 0.1 }),
  ];
  assert.equal(filterComps(comps, SUBJECT, DEFAULT_COMPS_FILTERS).length, 2);
});

test('filterComps: all-knobs-tight returns only matching comps', () => {
  const comps = [
    comp({ bedrooms: 3, bathrooms: 2, sqft: 1750, distance: 0.4 }),  // pass
    comp({ bedrooms: 4, bathrooms: 2, sqft: 1800, distance: 0.5 }),  // fail beds
    comp({ bedrooms: 3, bathrooms: 3, sqft: 1800, distance: 0.5 }),  // fail baths
    comp({ bedrooms: 3, bathrooms: 2, sqft: 1200, distance: 0.5 }),  // fail sqft (-33%)
    comp({ bedrooms: 3, bathrooms: 2, sqft: 1800, distance: 2.5 }),  // fail distance
  ];
  const filters = {
    maxDistanceMi: 1,
    bedTolerance: 'exact',
    bathTolerance: 'exact',
    sqftTolerancePct: 20,
  };
  const out = filterComps(comps, SUBJECT, filters);
  assert.equal(out.length, 1);
  assert.equal(out[0].sqft, 1750);
});

test('filterComps: subject without sqft skips sqft constraint instead of dropping all', () => {
  const comps = [comp({ sqft: 800 }), comp({ sqft: 5000 })];
  const out = filterComps(comps, { bedrooms: 3, bathrooms: 2 /* no sqft */ }, {
    ...DEFAULT_COMPS_FILTERS,
    sqftTolerancePct: 10,
  });
  assert.equal(out.length, 2);
});

test('filterComps: distance filter handles common UI options', () => {
  const comps = [
    comp({ distance: 0.2 }),
    comp({ distance: 0.5 }),
    comp({ distance: 0.9 }),
    comp({ distance: 1.8 }),
    comp({ distance: 4 }),
  ];
  assert.equal(filterComps(comps, SUBJECT, { ...DEFAULT_COMPS_FILTERS, maxDistanceMi: 0.5 }).length, 2);
  assert.equal(filterComps(comps, SUBJECT, { ...DEFAULT_COMPS_FILTERS, maxDistanceMi: 1 }).length, 3);
  assert.equal(filterComps(comps, SUBJECT, { ...DEFAULT_COMPS_FILTERS, maxDistanceMi: 2 }).length, 4);
  assert.equal(filterComps(comps, SUBJECT, { ...DEFAULT_COMPS_FILTERS, maxDistanceMi: 5 }).length, 5);
});
