// Freshness-weighted rank score for property search results.
//
// User-reported regression 2026-05-15: PR #201 made qualified-deal
// sorting spread-primary so big spreads always surfaced. The side
// effect was that brand-new listings JUST hitting the market got
// buried under stale-but-high-spread listings. The user's actual
// decision is two-factor:
//
//   "newest first + highest spread first. It should be both."
//
// This module exposes a pure scoring function that combines both
// signals via a stepped freshness multiplier. The pendulum lands
// between PR #201's pure-spread and the pre-#201 pure-newest:
//
//   - brand-new (≤1 day)  1.5x — competitive edge bonus
//   - very fresh (2-3 d)  1.25x
//   - actionable (4-7 d)  1.0x baseline
//   - aging (8-14 d)      0.75x — most wholesalers have seen it
//   - stale (15+ d)       0.5x — market-saturated
//
// Pure JS / ESM so the tests run under `node --test` without a
// transpiler — mirrors auction-detection.js (#408),
// comps-similarity.js (#371), comps-location-parser.js (#380).

const BRAND_NEW_BOOST = 1.5;
const FRESH_BOOST = 1.25;
const BASELINE = 1.0;
const AGING_PENALTY = 0.75;
const STALE_PENALTY = 0.5;

/**
 * Returns a multiplier on a property's raw spread based on how long
 * it's been on the market. Brand-new listings get boosted; stale
 * listings get penalized. Missing / NaN / negative inputs are
 * treated defensively (negative → 0 days, missing → baseline).
 *
 * @param {number|null|undefined} daysOnMarket
 * @returns {number}
 */
export function freshnessMultiplier(daysOnMarket) {
  if (daysOnMarket === null || daysOnMarket === undefined) return BASELINE;
  if (typeof daysOnMarket !== 'number' || Number.isNaN(daysOnMarket)) return BASELINE;

  const days = daysOnMarket < 0 ? 0 : daysOnMarket;

  if (days <= 1) return BRAND_NEW_BOOST;
  if (days <= 3) return FRESH_BOOST;
  if (days <= 7) return BASELINE;
  if (days <= 14) return AGING_PENALTY;
  return STALE_PENALTY;
}

/**
 * Returns a single ranking score combining spread (dollar amount the
 * listing is below comp / zestimate) and freshness. Caller uses this
 * to sort search results so the user's actual intent — "best spreads
 * that JUST hit the market" — surfaces fresh listings without
 * trampling huge-spread older listings.
 *
 * @param {number|null|undefined} spread - in dollars, ≥0
 * @param {number|null|undefined} daysOnMarket
 * @returns {number}  0 for non-deals, otherwise spread × multiplier
 */
export function freshnessWeightedRank(spread, daysOnMarket) {
  if (typeof spread !== 'number' || Number.isNaN(spread) || spread <= 0) return 0;
  return spread * freshnessMultiplier(daysOnMarket);
}
