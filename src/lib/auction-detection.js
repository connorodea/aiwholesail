// Pure detection helper: is a property listing an auction/foreclosure
// "opening bid" rather than a market-priced sale?
//
// Used by ComparableSalesTable (and potentially future server-side
// enrichment) so the UI doesn't render a misleading "Great Deal +$X"
// against a non-market price. Three independent signals — any one is
// enough to classify the listing as auction-like:
//
//   1. Description contains an auction/foreclosure keyword
//      ("Foreclosure Auction", "Opening Bid", "Trustee's Sale",
//      "Sheriff's Sale", "Federa Home" — preserved for REO matches)
//   2. Price-per-square-foot under $10 (essentially unheard of for a
//      real listing in 2026 US market — almost always an opening bid)
//   3. Absolute price under $25k AND living area over 800 sqft (rare
//      for non-auction listings even in low-cost markets)
//
// Rework of stale PR #94. Original implementation was inline in
// `src/components/ComparableSalesTable.tsx`. Extracted to a pure
// module so we can unit-test in isolation and reuse server-side later.
//
// Plain JS / ESM so node:test runs without a transpiler — mirrors
// comps-similarity.js (PR #371), comps-location-parser.js (PR #380).

const AUCTION_KEYWORDS = /foreclosure auction|opening bid|trustee'?s sale|sheriff'?s sale|federa home/i;
const MIN_PPSF_FOR_REAL_LISTING = 10;
const MAX_PRICE_FOR_AUCTION = 25000;
const MIN_SQFT_FOR_LOW_PRICE_AUCTION = 800;

/**
 * Returns true when the property looks like an auction/foreclosure
 * opening bid rather than a market-priced sale. Defensive — missing
 * fields don't throw, they just don't contribute a positive signal.
 *
 * @param {{price?: number, sqft?: number, description?: string}} property
 * @returns {boolean}
 */
export function isAuctionSubject(property) {
  if (!property || typeof property !== 'object') return false;

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
