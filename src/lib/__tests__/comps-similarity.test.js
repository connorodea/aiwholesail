// Tests for the pure comp-ranking helper used as a tiebreaker in
// ZillowAPI.getPropertyComps fallback path. Ranks fallback comps by
// closeness in beds/sqft to the subject property, preserving
// distance-sort behavior when subject metadata is missing.
//
// Plain JS / ESM so node:test can run without a transpiler — matches
// the seo/comparison-meta.test.js pattern already in this repo.
//
// Run:
//   node --test src/lib/__tests__/comps-similarity.test.js

import test from 'node:test';
import assert from 'node:assert/strict';
import { rankCompsBySimilarity } from '../comps-similarity.js';

// Helper to build a comp shape matching the one constructed inside
// getPropertyComps' fallback (mapped object).
function comp(overrides = {}) {
  return {
    address: '123 Main St',
    price: 300000,
    sqft: 1500,
    pricePerSqft: 200,
    bedrooms: 3,
    bathrooms: 2,
    distance: 1.0,
    ...overrides,
  };
}

test('comps closer in beds rank higher than comps farther in beds (sqft equal)', () => {
  const subject = { beds: 3, sqft: 1500 };
  const closeBeds = comp({ address: 'A', bedrooms: 3, sqft: 1500, distance: 1.0 });
  const farBeds = comp({ address: 'B', bedrooms: 6, sqft: 1500, distance: 1.0 });

  const ranked = rankCompsBySimilarity(subject, [farBeds, closeBeds]);
  assert.equal(ranked[0].address, 'A', 'closer-beds comp should come first');
  assert.equal(ranked[1].address, 'B');
});

test('comps closer in sqft rank higher when beds tie', () => {
  const subject = { beds: 3, sqft: 1500 };
  const closeSqft = comp({ address: 'A', bedrooms: 3, sqft: 1500, distance: 1.0 });
  const farSqft = comp({ address: 'B', bedrooms: 3, sqft: 3500, distance: 1.0 });

  const ranked = rankCompsBySimilarity(subject, [farSqft, closeSqft]);
  assert.equal(ranked[0].address, 'A', 'closer-sqft comp should come first');
  assert.equal(ranked[1].address, 'B');
});

test('comps with missing beds/sqft do not crash; ranking falls back to distance', () => {
  const subject = { beds: 3, sqft: 1500 };
  const noMeta = comp({ address: 'A', bedrooms: 0, sqft: 0, distance: 0.5 });
  const farDistance = comp({ address: 'B', bedrooms: 3, sqft: 1500, distance: 5.0 });

  // Should not throw
  const ranked = rankCompsBySimilarity(subject, [farDistance, noMeta]);
  assert.equal(ranked.length, 2, 'both comps preserved');

  // Comps lacking beds/sqft fall back to distance-only ordering — the
  // closer-by-distance comp (noMeta at 0.5mi) should outrank the
  // farther one once similarity is undefined.
  assert.equal(ranked[0].address, 'A', 'distance-only fallback for missing-metadata comp');
});

test('when subject metadata is missing, ranking preserves input distance order', () => {
  // No beds/sqft on subject → behave as a no-op except by distance.
  const subject = {};
  const closeDist = comp({ address: 'A', bedrooms: 3, sqft: 1500, distance: 0.5 });
  const midDist = comp({ address: 'B', bedrooms: 3, sqft: 1500, distance: 2.0 });
  const farDist = comp({ address: 'C', bedrooms: 3, sqft: 1500, distance: 5.0 });

  const ranked = rankCompsBySimilarity(subject, [farDist, closeDist, midDist]);
  assert.deepEqual(
    ranked.map((c) => c.address),
    ['A', 'B', 'C'],
    'should sort by distance ascending when no subject beds/sqft'
  );
});

test('function is pure: does not mutate the input array', () => {
  const subject = { beds: 3, sqft: 1500 };
  const input = [
    comp({ address: 'A', bedrooms: 5, sqft: 2500, distance: 1.0 }),
    comp({ address: 'B', bedrooms: 3, sqft: 1500, distance: 1.0 }),
  ];
  const inputCopy = input.map((c) => ({ ...c }));

  rankCompsBySimilarity(subject, input);

  assert.deepEqual(input, inputCopy, 'input array should not be mutated');
});

test('function makes no API calls (pure scoring logic)', () => {
  // Sanity: rankCompsBySimilarity should be synchronous and not return
  // a thenable. If a future refactor accidentally makes it async or
  // tacks on a network call, this test guards against that.
  const subject = { beds: 3, sqft: 1500 };
  const out = rankCompsBySimilarity(subject, [comp()]);
  assert.ok(Array.isArray(out), 'returns an Array (not a Promise)');
  assert.equal(typeof out.then, 'undefined', 'is not a thenable');
});

test('returned array length equals input length (no comps dropped)', () => {
  const subject = { beds: 3, sqft: 1500 };
  const comps = [
    comp({ address: 'A', bedrooms: 3, sqft: 1500, distance: 1.0 }),
    comp({ address: 'B', bedrooms: 0, sqft: 0, distance: 2.0 }), // missing meta
    comp({ address: 'C', bedrooms: 5, sqft: 4000, distance: 3.0 }), // very different
  ];

  const ranked = rankCompsBySimilarity(subject, comps);
  assert.equal(ranked.length, 3, 'no comps dropped — ranking is reorder-only');
});
