// Tests for the listing-summary mapper carrying description through
// to the frontend.
//
// Why this exists (silent gap surfaced 2026-05-15):
//
//   PR #408 wired isAuctionSubject() into ComparableSalesTable and
//   PR #430 wired it into PropertyCard + wholesale-calculator. Both
//   rely on `property.description` for the keyword path of the auction
//   heuristic ("Foreclosure Auction", "Trustee's Sale", etc.).
//
//   But `mapListingToSummary()` in aiwholesail-api/lib/scrapers/zillowScrapeDo.js
//   (used by every search-class endpoint) did NOT map `description` —
//   the frontend receives every search-result Property with
//   description=undefined. The keyword branch of isAuctionSubject is
//   dead for the list view; only the PPSF/low-price heuristics fire,
//   missing the most reliable detection signal.
//
//   Fix: mapListingToSummary must propagate `description` AND the
//   explicit `isForeclosure` boolean from Zillow's payload (both
//   surfaces are documented at hdpData.homeInfo and on the top-level
//   listResult).
//
// Source-introspection style — pins the mapper output shape without
// touching the network. Pairs with the unit tests in
// `test/lib/zillowScrapeDo.test.js`.
//
// Run:
//   node --test aiwholesail-api/test/lib/zillow-listing-summary-description.test.js

const test = require('node:test');
const assert = require('node:assert/strict');
const { mapListingToSummary } = require('../../lib/scrapers/zillowScrapeDo');

test('mapListingToSummary: propagates description from top-level field', () => {
  const result = mapListingToSummary({
    zpid: 12345,
    address: '123 Main St',
    unformattedPrice: 250000,
    description: 'Beautiful 3-bedroom home with updated kitchen',
  });
  assert.equal(
    result.description,
    'Beautiful 3-bedroom home with updated kitchen',
    'description must be carried through to the summary',
  );
});

test('mapListingToSummary: propagates description from hdpData.homeInfo', () => {
  // Some search payloads nest the description under hdpData.homeInfo
  // (Zillow's GraphQL response shape). The mapper must check both.
  const result = mapListingToSummary({
    zpid: 12345,
    address: '123 Main St',
    unformattedPrice: 50000,
    hdpData: {
      homeInfo: {
        description: 'Foreclosure auction — opening bid $50,000',
        isForeclosure: true,
      },
    },
  });
  assert.equal(
    result.description,
    'Foreclosure auction — opening bid $50,000',
    'nested description must be carried through',
  );
  assert.equal(
    result.isForeclosure,
    true,
    'nested isForeclosure must be carried through too',
  );
});

test('mapListingToSummary: top-level description wins over nested when both present', () => {
  // If Zillow surfaces both top-level and nested, top-level is the
  // post-processing string (already cleaned for the listing card);
  // nested may be the raw MLS feed. Prefer top-level.
  const result = mapListingToSummary({
    zpid: 12345,
    address: '123 Main St',
    description: 'TOP_LEVEL',
    hdpData: {
      homeInfo: {
        description: 'NESTED',
      },
    },
  });
  assert.equal(result.description, 'TOP_LEVEL');
});

test('mapListingToSummary: missing description returns undefined (not empty string)', () => {
  // The frontend Property type has `description?: string`. Returning
  // undefined keeps the type contract clean; returning '' would
  // cause `description.length > 100` checks (used elsewhere) to
  // treat the field as present-but-empty.
  const result = mapListingToSummary({
    zpid: 12345,
    address: '123 Main St',
    unformattedPrice: 250000,
  });
  assert.equal(result.description, undefined);
});

test('mapListingToSummary: empty-string description is normalized to undefined', () => {
  // Zillow occasionally returns `description: ""`. Treat as missing
  // so downstream length / keyword checks don't fire on empty text.
  const result = mapListingToSummary({
    zpid: 12345,
    address: '123 Main St',
    description: '',
  });
  assert.equal(result.description, undefined);
});

test('mapListingToSummary: description survives the existing isForeclosure mapping', () => {
  // Regression guard — the existing test in zillowScrapeDo.test.js
  // pins isForeclosure mapping. Adding description must not break it.
  const result = mapListingToSummary({
    zpid: 12345,
    address: '123 Main St',
    hdpData: {
      homeInfo: {
        isForeclosure: true,
        isPreforeclosureAuction: false,
        description: "Trustee's Sale",
      },
    },
  });
  assert.equal(result.isForeclosure, true);
  assert.equal(result.description, "Trustee's Sale");
});
