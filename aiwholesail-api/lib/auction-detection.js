// Backend mirror of src/lib/auction-detection.js.
//
// Why the duplication: src/lib/* is the React app's pure-JS module
// pool, importable as `@/lib/auction-detection`. The Node workers
// under aiwholesail-api/scripts/ live in a separate package (CommonJS,
// no @ path resolution) and can't cross that boundary. This copy
// keeps the auction-detection logic accessible from the worker
// (spread-alert-worker.js) so foreclosure auctions don't slip into
// "Great Deal" alert emails — the same gate already applied to the
// in-app UI by PR #408/#430/#433.
//
// Future refactor: consolidate both into a single shared/ directory.
// For now, behavioral parity is enforced by both modules carrying
// identical heuristics + cross-referenced unit tests.
//
// Plain JS / CommonJS so node:test runs without a transpiler from
// inside the aiwholesail-api/ subproject. The frontend copy uses
// ESM `export` since src/* uses Vite. Same logic, different module
// system.

'use strict';

const AUCTION_KEYWORDS = /foreclosure auction|opening bid|trustee'?s sale|sheriff'?s sale|federa home/i;
const MIN_PPSF_FOR_REAL_LISTING = 10;
const MAX_PRICE_FOR_AUCTION = 25000;
const MIN_SQFT_FOR_LOW_PRICE_AUCTION = 800;

/**
 * Returns true when the property looks like an auction/foreclosure
 * opening bid rather than a market-priced sale. Defensive — missing
 * fields don't throw, they just don't contribute a positive signal.
 *
 * Four independent signals — any one is enough:
 *   0. `isForeclosure === true` (Zillow's explicit boolean)
 *   1. Description contains an auction/foreclosure keyword
 *   2. Price-per-square-foot under $10
 *   3. Absolute price under $25k AND living area over 800 sqft
 *
 * @param {{price?: number, sqft?: number, description?: string, isForeclosure?: boolean}} property
 * @returns {boolean}
 */
function isAuctionSubject(property) {
  if (!property || typeof property !== 'object') return false;

  if (property.isForeclosure === true) return true;

  const description = typeof property.description === 'string' ? property.description : '';
  if (AUCTION_KEYWORDS.test(description)) return true;

  const price = typeof property.price === 'number' && property.price > 0 ? property.price : null;
  const sqft = typeof property.sqft === 'number' && property.sqft > 0 ? property.sqft : null;

  if (price !== null && sqft !== null) {
    const ppsf = price / sqft;
    if (ppsf < MIN_PPSF_FOR_REAL_LISTING) return true;
    if (price < MAX_PRICE_FOR_AUCTION && sqft > MIN_SQFT_FOR_LOW_PRICE_AUCTION) return true;
  }

  return false;
}

module.exports = { isAuctionSubject };
