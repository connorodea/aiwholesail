// Frontend predicate-mirror canary tests — verify src/lib/failed-listing.js
// produces correct outputs for the canonical cases.
//
// Full exhaustive predicate coverage lives in
// aiwholesail-api/test/lib/failed-listing.test.js (30 cases). This file
// is intentionally smaller — it tests the FRONTEND MIRROR specifically
// (correct exports, ESM resolves, predicate parity on the cases most
// likely to drift if the mirror gets out of sync).
//
// Run:
//   node --test src/lib/__tests__/failed-listing.test.js

import test from 'node:test';
import assert from 'node:assert/strict';
import { isFailedListing, hasPreviousFailedListing } from '../failed-listing.js';

const NOW = new Date('2026-05-23T00:00:00.000Z');
const opts = { now: NOW };

test('frontend mirror: isFailedListing — classic off-market + withdrawn-no-sale → true', () => {
  const rec = {
    homeStatus: 'OFF_MARKET',
    priceHistory: [
      { date: '2026-02-15', event: 'Listed for sale', price: 350000 },
      { date: '2026-05-10', event: 'Listing removed', price: 350000 },
    ],
  };
  assert.equal(isFailedListing(rec, opts), true);
});

test('frontend mirror: isFailedListing — currently FOR_SALE → false (active, not yet failed)', () => {
  const rec = {
    homeStatus: 'FOR_SALE',
    priceHistory: [
      { date: '2026-02-15', event: 'Listed for sale', price: 350000 },
      { date: '2026-05-10', event: 'Listing removed', price: 350000 },
    ],
  };
  assert.equal(isFailedListing(rec, opts), false);
});

test('frontend mirror: hasPreviousFailedListing — relisted after prior failure → true', () => {
  const rec = {
    homeStatus: 'FOR_SALE',
    priceHistory: [
      { date: '2024-12-01', event: 'Listed for sale', price: 350000 },
      { date: '2025-04-01', event: 'Listing removed', price: 350000 },
      { date: '2026-04-01', event: 'Listed for sale', price: 340000 },
    ],
  };
  assert.equal(hasPreviousFailedListing(rec, opts), true);
});

test('frontend mirror: hasPreviousFailedListing — first-time listing → false', () => {
  const rec = {
    homeStatus: 'FOR_SALE',
    priceHistory: [
      { date: '2026-04-01', event: 'Listed for sale', price: 350000 },
    ],
  };
  assert.equal(hasPreviousFailedListing(rec, opts), false);
});

test('frontend mirror: predicates are complementary on the same record', () => {
  // Invariant: a record cannot match both predicates at once because the
  // status guards are inverses. If the mirror diverges from backend, this
  // is the most-likely test to catch it.
  const offMarketFailed = {
    homeStatus: 'OFF_MARKET',
    priceHistory: [
      { date: '2026-02-01', event: 'Listed for sale', price: 400000 },
      { date: '2026-04-01', event: 'Listing removed', price: 400000 },
    ],
  };
  assert.equal(isFailedListing(offMarketFailed, opts), true);
  assert.equal(hasPreviousFailedListing(offMarketFailed, opts), false);

  const relisted = {
    homeStatus: 'FOR_SALE',
    priceHistory: [
      { date: '2024-12-01', event: 'Listed for sale', price: 400000 },
      { date: '2025-04-01', event: 'Listing removed', price: 400000 },
      { date: '2026-04-01', event: 'Listed for sale', price: 380000 },
    ],
  };
  assert.equal(isFailedListing(relisted, opts), false);
  assert.equal(hasPreviousFailedListing(relisted, opts), true);
});

test('frontend mirror: nullish input is tolerated by both predicates', () => {
  for (const input of [null, undefined, '', 0, [], 'foo', 42]) {
    assert.equal(isFailedListing(input, opts), false);
    assert.equal(hasPreviousFailedListing(input, opts), false);
  }
});

test('frontend mirror: missing priceHistory returns false (canonical inclusive-on-unknown for failed; opposite for previous)', () => {
  assert.equal(isFailedListing({ homeStatus: 'OFF_MARKET' }, opts), false);
  assert.equal(hasPreviousFailedListing({ homeStatus: 'FOR_SALE' }, opts), false);
});
