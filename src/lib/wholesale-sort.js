// Default comparator for property search results.
//
// Tiers (highest first):
//   1. Qualified deals (spread ≥ $30K) — by spread DESC
//   2. Positive-spread non-deals — by spread DESC
//   3. With-zestimate (negative spread) — by spread DESC (less-negative first)
//   4. Without zestimate — by daysOnMarket ASC (newest first)
//
// Within every tier the primary sort is spread amount descending. Days-
// on-market is the secondary tiebreak (newer first) and the only signal
// in tier 4 where there's no spread to compare. No freshness multiplier:
// the user's validated decision is "biggest deals come first, period."

const MIN_DEAL_SPREAD = 30000;

function attrs(prop) {
  const price = prop.price || 0;
  const zestimate = prop.zestimate || 0;
  const hasZestimate = !!(prop.zestimate && prop.price);
  const rawSpread = hasZestimate ? zestimate - price : -Infinity;
  const daysOnMarket = prop.daysOnMarket ?? 9999;
  return { hasZestimate, rawSpread, daysOnMarket };
}

function tier(a) {
  if (a.rawSpread >= MIN_DEAL_SPREAD) return 1;
  if (a.rawSpread > 0) return 2;
  if (a.hasZestimate) return 3;
  return 4;
}

export function compareWholesalePotential(propA, propB) {
  const a = attrs(propA);
  const b = attrs(propB);

  const tA = tier(a);
  const tB = tier(b);
  if (tA !== tB) return tA - tB;

  if (tA === 4) {
    // No zestimate — newest first is the only signal we have.
    return a.daysOnMarket - b.daysOnMarket;
  }

  // Tiers 1-3: spread DESC, then newest first as tiebreak.
  if (a.rawSpread !== b.rawSpread) return b.rawSpread - a.rawSpread;
  return a.daysOnMarket - b.daysOnMarket;
}
