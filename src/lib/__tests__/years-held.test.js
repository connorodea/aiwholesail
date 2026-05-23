// Frontend predicate-mirror canary tests for src/lib/years-held.js.
//
// Full exhaustive coverage lives in
// aiwholesail-api/test/lib/years-held.test.js (14 cases). This file is
// intentionally smaller — tests the FRONTEND MIRROR specifically (ESM
// resolves, exports the right symbol, produces correct output on the
// cases most likely to drift if the mirror gets out of sync with backend).
//
// Run:
//   node --test src/lib/__tests__/years-held.test.js

import test from 'node:test';
import assert from 'node:assert/strict';
import { yearsHeldFromPriceHistory } from '../years-held.js';

const NOW = new Date('2026-05-23T00:00:00.000Z');
const opts = { now: NOW };

test('frontend mirror: most recent Sold event sets years_held', () => {
  const history = [
    { date: '2005-01-01', event: 'Sold', price: 200000 },
    { date: '2020-05-23', event: 'Sold', price: 350000 },
  ];
  assert.equal(yearsHeldFromPriceHistory(history, opts), 6);
});

test('frontend mirror: no Sold event → null', () => {
  const history = [
    { date: '2026-04-01', event: 'Listed for sale', price: 350000 },
  ];
  assert.equal(yearsHeldFromPriceHistory(history, opts), null);
});

test('frontend mirror: empty / null / non-array input → null', () => {
  for (const input of [[], null, undefined, 'foo', 42, {}]) {
    assert.equal(yearsHeldFromPriceHistory(input, opts), null);
  }
});

test('frontend mirror: future-dated Sold event is ignored, falls through', () => {
  // Most likely drift-catcher between backend + frontend mirrors:
  // both must reject future-dated entries the same way.
  const history = [
    { date: '2030-05-23', event: 'Sold', price: 500000 }, // bad data
    { date: '2018-05-23', event: 'Sold', price: 300000 },
  ];
  assert.equal(yearsHeldFromPriceHistory(history, opts), 8);
});

test('frontend mirror: floors fractional years (10.7 → 10)', () => {
  const history = [
    { date: '2015-09-15', event: 'Sold', price: 300000 },
  ];
  assert.equal(yearsHeldFromPriceHistory(history, opts), 10);
});
