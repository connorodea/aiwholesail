// Default comparator for property search results.
//
// Hard tiers (highest first):
//   1. Brand-new (≤1d) qualified deals (spread ≥ $30K) — by spread DESC
//   2. Other qualified deals — by freshness-weighted rank DESC
//   3. Positive-spread non-deals — by freshness-weighted rank DESC
//   4. With-zestimate (negative spread) — by spread DESC
//   5. Without zestimate — by daysOnMarket ASC (newest first)
//
// User-validated 2026-05-15: brand-new qualified deals must always
// surface above older ones, even when the older ones have a much
// larger spread. The freshness-weighted multiplier alone (1.5x boost
// for ≤1d) isn't enough to overcome a 2-3x spread differential, which
// was burying just-listed deals behind 4-5 day old higher-spread ones.

import { freshnessWeightedRank } from './freshness-weighted-rank.js';

export const MIN_DEAL_SPREAD = 30000;
const BRAND_NEW_DAYS = 1;

function attrs(prop) {
  const price = prop.price || 0;
  const zestimate = prop.zestimate || 0;
  const hasZestimate = !!(prop.zestimate && prop.price);
  const rawSpread = hasZestimate ? zestimate - price : -Infinity;
  const daysOnMarket = prop.daysOnMarket ?? 9999;
  const isQualifiedDeal = rawSpread >= MIN_DEAL_SPREAD;
  const isBrandNew = daysOnMarket <= BRAND_NEW_DAYS;
  return { hasZestimate, rawSpread, daysOnMarket, isQualifiedDeal, isBrandNew };
}

function tier(a) {
  if (a.isBrandNew && a.isQualifiedDeal) return 1;
  if (a.isQualifiedDeal) return 2;
  if (a.rawSpread > 0) return 3;
  if (a.hasZestimate) return 4;
  return 5;
}

export function compareWholesalePotential(propA, propB) {
  const a = attrs(propA);
  const b = attrs(propB);

  const tA = tier(a);
  const tB = tier(b);
  if (tA !== tB) return tA - tB;

  // Same tier — apply tier-specific ordering.
  switch (tA) {
    case 1:
      // Brand-new qualified deals: bigger spread first, then newest first.
      if (a.rawSpread !== b.rawSpread) return b.rawSpread - a.rawSpread;
      return a.daysOnMarket - b.daysOnMarket;

    case 2:
    case 3: {
      // Existing freshness-weighted-rank semantics.
      const rA = freshnessWeightedRank(a.rawSpread, a.daysOnMarket);
      const rB = freshnessWeightedRank(b.rawSpread, b.daysOnMarket);
      if (rA !== rB) return rB - rA;
      if (a.rawSpread !== b.rawSpread) return b.rawSpread - a.rawSpread;
      return a.daysOnMarket - b.daysOnMarket;
    }

    case 4:
      // With-zestimate (negative spread): less-negative first.
      return b.rawSpread - a.rawSpread;

    case 5:
      // No zestimate: newest first.
      return a.daysOnMarket - b.daysOnMarket;

    default:
      return 0;
  }
}
