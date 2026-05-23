// Tests for isFailedListing — Phase 2d off-market lead-type predicate.
//
// A "failed listing" is a Zillow record that:
//   1. Has a "Listed for sale" event in priceHistory
//   2. Has a subsequent "Listing removed" / equivalent
//   3. Does NOT have a "Sold" event after the listing started
//   4. Is NOT currently for sale (homeStatus not in FOR_SALE / PENDING)
//   5. The withdrawal happened within the lookback window (default 18mo)
//
// Run:
//   node --test aiwholesail-api/test/lib/failed-listing.test.js

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  isFailedListing,
  DEFAULT_LOOKBACK_MONTHS,
} = require('../../lib/failed-listing.js');

// Pinned "now" so date math is stable across runs.
const NOW = new Date('2026-05-23T00:00:00.000Z');
const opts = { now: NOW };

const ph = (...entries) => ({ homeStatus: 'OFF_MARKET', priceHistory: entries });
const e = (date, event, price = 350000) => ({ date, event, price });

test('classic failed listing: listed → removed, no sale, currently off-market', () => {
  const rec = ph(
    e('2026-02-15', 'Listed for sale'),
    e('2026-04-01', 'Price change'),
    e('2026-05-10', 'Listing removed'),
  );
  assert.equal(isFailedListing(rec, opts), true);
});

test('sold between listing and removal: NOT a failed listing', () => {
  // The listing succeeded — the post-sale "removed" entry is just Zillow
  // closing out the active record, not a failure signal.
  const rec = ph(
    e('2026-02-15', 'Listed for sale'),
    e('2026-04-01', 'Sold'),
    e('2026-04-02', 'Listing removed'),
  );
  assert.equal(isFailedListing(rec, opts), false);
});

test('currently FOR_SALE — even with prior withdrawal, not yet failed', () => {
  // Relisting pattern: previous attempt failed, but the current attempt
  // is still active. Don't classify as failed until THIS cycle ends.
  const rec = {
    homeStatus: 'FOR_SALE',
    priceHistory: [
      e('2024-08-01', 'Listed for sale'),
      e('2024-12-01', 'Listing removed'),
      e('2026-04-01', 'Listed for sale'), // current cycle
    ],
  };
  assert.equal(isFailedListing(rec, opts), false);
});

test('relisted-and-now-sold cycle: NOT failed', () => {
  // Earlier failure THEN current cycle sold — the SOLD wipes out the
  // failed state.
  const rec = ph(
    e('2024-08-01', 'Listed for sale'),
    e('2024-12-01', 'Listing removed'),
    e('2026-01-01', 'Listed for sale'),
    e('2026-04-01', 'Sold'),
  );
  assert.equal(isFailedListing(rec, opts), false);
});

test('relisted-then-failed-again: still failed (latest cycle is failed)', () => {
  const rec = ph(
    e('2024-08-01', 'Listed for sale'),
    e('2024-09-01', 'Sold'),
    e('2025-12-01', 'Listed for sale'), // resold, then relisted
    e('2026-04-01', 'Listing removed'),
  );
  assert.equal(isFailedListing(rec, opts), true);
});

test('withdrawal outside lookback (default 18mo): NOT failed', () => {
  // Listed and removed in 2023 — beyond 18mo window from May 2026.
  const rec = ph(
    e('2023-05-01', 'Listed for sale'),
    e('2023-08-01', 'Listing removed'),
  );
  assert.equal(isFailedListing(rec, opts), false);
});

test('withdrawal exactly at the lookback boundary: included', () => {
  // 18 months back from 2026-05-23 ≈ 2024-11-23. Withdrawal one day
  // before the cutoff falls outside; one day after falls inside.
  const recInside = ph(
    e('2024-11-01', 'Listed for sale'),
    e('2024-12-01', 'Listing removed'),
  );
  assert.equal(isFailedListing(recInside, opts), true);

  const recOutside = ph(
    e('2024-06-01', 'Listed for sale'),
    e('2024-08-01', 'Listing removed'),
  );
  assert.equal(isFailedListing(recOutside, opts), false);
});

test('lookback window is configurable', () => {
  const rec = ph(
    e('2024-06-01', 'Listed for sale'),
    e('2024-08-01', 'Listing removed'),
  );
  // 18mo (default): outside window
  assert.equal(isFailedListing(rec, { now: NOW, lookbackMonths: 18 }), false);
  // 36mo: inside window
  assert.equal(isFailedListing(rec, { now: NOW, lookbackMonths: 36 }), true);
});

test('missing priceHistory: NOT failed (cannot classify)', () => {
  assert.equal(isFailedListing({ homeStatus: 'OFF_MARKET' }, opts), false);
});

test('empty priceHistory: NOT failed', () => {
  assert.equal(isFailedListing({ homeStatus: 'OFF_MARKET', priceHistory: [] }, opts), false);
});

test('priceHistory with no listing events: NOT failed', () => {
  // Just price changes with no "Listed for sale" or "Listing removed".
  const rec = ph(
    e('2026-01-01', 'Price change'),
    e('2026-03-01', 'Price change'),
  );
  assert.equal(isFailedListing(rec, opts), false);
});

test('listed but never removed: NOT failed', () => {
  // Active listing or under contract — not failed.
  const rec = ph(
    e('2026-02-01', 'Listed for sale'),
    e('2026-03-01', 'Price change'),
  );
  assert.equal(isFailedListing(rec, opts), false);
});

test('null / undefined / non-object: NOT failed, does not throw', () => {
  for (const input of [null, undefined, '', 0, [], 'foo', 42]) {
    assert.equal(isFailedListing(input, opts), false, `input ${JSON.stringify(input)} should be false`);
  }
});

test('priceHistory entries without date: filtered out, not crashed', () => {
  const rec = ph(
    { event: 'Listed for sale' }, // no date — filtered
    e('2026-02-01', 'Listed for sale'),
    e('2026-04-01', 'Listing removed'),
  );
  assert.equal(isFailedListing(rec, opts), true);
});

test('priceHistory entries with garbage date: filtered out', () => {
  const rec = ph(
    e('not-a-date', 'Listed for sale'),
    e('2026-02-01', 'Listed for sale'),
    e('2026-04-01', 'Listing removed'),
  );
  assert.equal(isFailedListing(rec, opts), true);
});

test('PENDING / CONTINGENT statuses count as "currently active"', () => {
  for (const status of ['PENDING', 'CONTINGENT', 'AUCTION']) {
    const rec = {
      homeStatus: status,
      priceHistory: [
        e('2026-02-01', 'Listed for sale'),
        e('2026-04-01', 'Listing removed'),
      ],
    };
    assert.equal(isFailedListing(rec, opts), false, `${status} should not be failed`);
  }
});

test('alternate withdrawal event names ("Cancelled", "Off market") still trigger', () => {
  for (const event of ['Listing withdrawn', 'Off market', 'Cancelled']) {
    const rec = ph(
      e('2026-02-01', 'Listed for sale'),
      e('2026-04-01', event),
    );
    assert.equal(isFailedListing(rec, opts), true, `${event} should trigger failed`);
  }
});

test('"Back on market" + "Relisted" reset the listing window', () => {
  // Sold → relisted → removed = current cycle failed.
  const rec = ph(
    e('2024-08-01', 'Listed for sale'),
    e('2024-09-01', 'Sold'),
    e('2025-12-01', 'Relisted'),
    e('2026-04-01', 'Listing removed'),
  );
  assert.equal(isFailedListing(rec, opts), true);
});

test('unsorted priceHistory tolerated — sorts internally', () => {
  // Real Zillow payloads come newest-first; tolerate either direction.
  const rec = ph(
    e('2026-04-01', 'Listing removed'),
    e('2026-02-01', 'Listed for sale'),
  );
  assert.equal(isFailedListing(rec, opts), true);
});

test('DEFAULT_LOOKBACK_MONTHS exported for callers that want to surface it in UI copy', () => {
  assert.equal(DEFAULT_LOOKBACK_MONTHS, 18);
});
