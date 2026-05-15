// Tests for the auction-gate filter in the spread-alert email worker.
//
// Why this exists (silent gap surfaced 2026-05-15 after PR #408/#430/#433):
//
//   PR #408/#430/#433 wired isAuctionSubject() into the in-app UI so
//   foreclosure auctions don't render with a "Great Deal" badge or rank
//   at the top of search results. The spread-alert email worker
//   (aiwholesail-api/scripts/spread-alert-worker.js) was NOT touched.
//
//   The worker queries `property_search_cache` for rows where
//   `spread >= min_spread`. A foreclosure auction with a $5K opening
//   bid and $300K zestimate has spread=$295K — comfortably above every
//   user's threshold. The email subject "1 New Deal in DeKalb County —
//   +$295,000 total spread" lands in the user's inbox, they click,
//   discover it's an auction, lose trust in the deal-finder service.
//
//   Fix: import isAuctionSubject() and JS-filter the result rows.
//   The cache currently has price + sqft (not description, not
//   isForeclosure), so the keyword + isForeclosure branches can't
//   fire — but the PPSF and low-absolute-price+sqft branches DO,
//   catching the most common pattern (very low opening bids on
//   real-size homes). Closing the description / isForeclosure
//   branches in the alert path requires a cache-schema migration,
//   deferred to a follow-up.
//
// Source-introspection style — the worker is async, talks to Postgres,
// and depends on real Resend creds, so behavioral testing is heavy.
// These tests pin the WIRING contract:
//   1. The worker imports isAuctionSubject from auction-detection.js
//   2. The worker references isAuctionSubject inside the deal-processing
//      loop (not just at the top of the file)
//   3. The new lib file exists and exports the same shape as the
//      frontend src/lib/auction-detection.js
//
// Run:
//   node --test aiwholesail-api/test/lib/spread-alert-auction-gate.test.js

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const WORKER_PATH = path.join(__dirname, '..', '..', 'scripts', 'spread-alert-worker.js');
const WORKER_SRC = fs.readFileSync(WORKER_PATH, 'utf8');

const LIB_PATH = path.join(__dirname, '..', '..', 'lib', 'auction-detection.js');

test('aiwholesail-api/lib/auction-detection.js exists', () => {
  // Backend mirror of src/lib/auction-detection.js so the worker can
  // require() it without crossing the api/web boundary. Identical
  // detection logic — pin the existence of the file. (Future
  // refactor: consolidate into a single shared/ directory.)
  assert.ok(fs.existsSync(LIB_PATH), 'lib/auction-detection.js must exist');
});

test('aiwholesail-api/lib/auction-detection.js exports isAuctionSubject', () => {
  // Use require() since the backend uses CommonJS — keep the import
  // shape compatible with the worker.
  const mod = require(LIB_PATH);
  assert.equal(typeof mod.isAuctionSubject, 'function');
});

test('aiwholesail-api lib auction-detection: ports the PPSF and low-price heuristics', () => {
  // Sanity check that the backend copy isn't just an empty stub.
  // Behavioral parity with the frontend version is what we need.
  const { isAuctionSubject } = require(LIB_PATH);
  assert.equal(isAuctionSubject({ price: 1000, sqft: 1500 }), true, 'low PPSF');
  assert.equal(isAuctionSubject({ price: 20000, sqft: 1200 }), true, 'low price + decent sqft');
  assert.equal(isAuctionSubject({ price: 350000, sqft: 1800 }), false, 'normal listing');
});

test('aiwholesail-api lib auction-detection: isForeclosure boolean signal works', () => {
  // Pin the isForeclosure branch — when the cache schema later carries
  // this field, the worker filter will use it automatically.
  const { isAuctionSubject } = require(LIB_PATH);
  assert.equal(isAuctionSubject({ isForeclosure: true }), true);
  assert.equal(isAuctionSubject({ isForeclosure: false, price: 350000, sqft: 1800 }), false);
});

test('spread-alert-worker.js imports isAuctionSubject from the backend lib', () => {
  const importPattern = /(require|import).*isAuctionSubject.*from.*['"].+\/auction-detection['"]/;
  // require() shape used by this worker — match both:
  //   const { isAuctionSubject } = require('../lib/auction-detection');
  //   const { isAuctionSubject } = require('../lib/auction-detection.js');
  const requirePattern = /require\(['"]\.\.\/lib\/auction-detection(\.js)?['"]\)/;
  assert.match(
    WORKER_SRC,
    requirePattern,
    'worker must require ../lib/auction-detection',
  );
});

test('spread-alert-worker.js references isAuctionSubject in the deal-processing loop', () => {
  // Pin the integration — not just the import, but actually calling
  // it on each deal. We allow `deals.rows.filter(...)` or
  // `for (const d of deals) { if (isAuctionSubject(d)) continue; }`
  // — the source must mention isAuctionSubject AT LEAST in the
  // body context after the dealQuery section.
  const dealLoopStart = WORKER_SRC.indexOf('const deals = await pool.query(dealQuery');
  assert.notEqual(dealLoopStart, -1, 'worker must still query deals');
  const afterLoop = WORKER_SRC.slice(dealLoopStart, dealLoopStart + 4000);
  assert.match(
    afterLoop,
    /isAuctionSubject\s*\(/,
    'worker must call isAuctionSubject on the queried deal rows',
  );
});

test('spread-alert-worker.js: when no real deals remain after auction filter, skip the email', () => {
  // The filter must produce a continue / skip path — sending an email
  // titled "0 New Deals" because we filtered everything out is worse
  // than sending nothing.
  const continuePattern =
    /(deals\.rows.length === 0|filteredDeals\.length === 0|realDeals\.length === 0|nonAuctionDeals\.length === 0)/;
  assert.match(
    WORKER_SRC,
    continuePattern,
    'worker must have a length-check that skips empty deal sets',
  );
});
