import { Property } from '@/types/zillow';
import { isAuctionSubject } from '@/lib/auction-detection';
import { freshnessWeightedRank } from '@/lib/freshness-weighted-rank';

export interface WholesalePotential {
  spreadAmount: number;
  spreadPercentage: number;
  score: number;
  tier: 'excellent' | 'great' | 'good' | 'fair' | 'poor';
}

export function calculateWholesalePotential(property: Property): WholesalePotential {
  // Auction subjects (foreclosure / trustee's sale / opening-bid listings)
  // have a `price` that is the opening bid, not a market price. Computing
  // `zestimate - price` produces a wildly inflated "spread" that ranks
  // them above every legitimate market deal. Bail to poor tier with a
  // zero score so the sorter demotes them and the modal/banner renders
  // neutral. Pairs with the ComparableSalesTable gate from PR #408 and
  // the PropertyCard gate added alongside this change.
  if (isAuctionSubject(property as { price?: number; sqft?: number; description?: string })) {
    return {
      spreadAmount: 0,
      spreadPercentage: 0,
      score: 0,
      tier: 'poor'
    };
  }

  const price = property.price || 0;
  const zestimate = property.zestimate || 0;

  // If no price or zestimate, return poor potential
  if (!price || !zestimate || price >= zestimate) {
    return {
      spreadAmount: 0,
      spreadPercentage: 0,
      score: 0,
      tier: 'poor'
    };
  }

  const spreadAmount = zestimate - price;
  const spreadPercentage = (spreadAmount / zestimate) * 100;
  
  // Calculate score based on multiple factors
  let score = 0;
  
  // Primary factor: Spread percentage (0-70 points)
  if (spreadPercentage >= 25) {
    score += 70; // Excellent spread
  } else if (spreadPercentage >= 20) {
    score += 60; // Great spread
  } else if (spreadPercentage >= 15) {
    score += 50; // Good spread
  } else if (spreadPercentage >= 10) {
    score += 40; // Fair spread
  } else if (spreadPercentage >= 5) {
    score += 30; // Minimal spread
  } else {
    score += 10; // Very low spread
  }
  
  // Bonus factors (0-30 points total)
  
  // Days on market bonus (0-10 points)
  const daysOnMarket = property.daysOnMarket || 0;
  if (daysOnMarket >= 90) {
    score += 10; // Property sitting long, motivated seller
  } else if (daysOnMarket >= 60) {
    score += 7;
  } else if (daysOnMarket >= 30) {
    score += 5;
  } else if (daysOnMarket >= 14) {
    score += 3;
  }
  
  // FSBO bonus (0-5 points)
  if (property.isFSBO) {
    score += 5; // Direct negotiation with owner
  }
  
  // Property condition indicators from description (0-10 points)
  const description = (property.description || '').toLowerCase();
  const distressIndicators = [
    'needs tlc', 'repairs needed', 'fixer upper', 'handyman special',
    'as is', 'motivated seller', 'must sell', 'quick sale',
    'below market', 'investment opportunity', 'cash only'
  ];
  
  const foundIndicators = distressIndicators.filter(indicator => 
    description.includes(indicator)
  ).length;
  
  if (foundIndicators >= 3) {
    score += 10;
  } else if (foundIndicators >= 2) {
    score += 7;
  } else if (foundIndicators >= 1) {
    score += 5;
  }
  
  // Price range bonus (0-5 points) - mid-range properties often have better potential
  if (price >= 100000 && price <= 500000) {
    score += 5;
  } else if (price >= 50000 && price <= 750000) {
    score += 3;
  }
  
  // Determine tier based on final score
  let tier: WholesalePotential['tier'];
  if (score >= 85) {
    tier = 'excellent';
  } else if (score >= 70) {
    tier = 'great';
  } else if (score >= 55) {
    tier = 'good';
  } else if (score >= 40) {
    tier = 'fair';
  } else {
    tier = 'poor';
  }
  
  return {
    spreadAmount,
    spreadPercentage,
    score,
    tier
  };
}

// Minimum spread to qualify as a wholesale deal
export const MIN_DEAL_SPREAD = 30000;

export function sortPropertiesByWholesalePotential(properties: Property[]): Property[] {
  return properties
    .map(property => {
      const price = property.price || 0;
      const zestimate = property.zestimate || 0;
      const hasZestimate = !!(property.zestimate && property.price);
      const rawSpread = hasZestimate ? zestimate - price : -Infinity;
      const daysOnMarket = property.daysOnMarket ?? 9999; // Default to high if unknown
      const isQualifiedDeal = rawSpread >= MIN_DEAL_SPREAD;
      // Compound ranking: freshness-weighted spread. Brand-new listings
      // (≤1 day) get a 1.5x boost; stale listings (15+ days) get 0.5x.
      // Matches the user's actual decision ("newest first + highest spread
      // first") — fresh listings surface even with smaller spreads, but a
      // huge spread differential still wins against staleness.
      // See src/lib/freshness-weighted-rank.js for the multiplier table.
      const rankScore = freshnessWeightedRank(rawSpread, daysOnMarket);
      return { property, potential: calculateWholesalePotential(property), hasZestimate, rawSpread, daysOnMarket, isQualifiedDeal, rankScore };
    })
    .sort((a, b) => {
      // 1. Qualified deals ($30k+ spread) always first
      if (a.isQualifiedDeal && !b.isQualifiedDeal) return -1;
      if (!a.isQualifiedDeal && b.isQualifiedDeal) return 1;

      // 2. Among qualified deals: freshness-weighted rank. Brand-new $100K
      //    spread beats stale $200K spread; brand-new $50K does NOT beat
      //    aging $200K (spread differential too large). PR #201's pure-
      //    spread sort buried minutes-old listings; pre-#201's pure-newest
      //    buried huge spreads. This hybrid lands between.
      //    Tiebreaker: raw spread DESC, then days ASC.
      if (a.isQualifiedDeal && b.isQualifiedDeal) {
        if (a.rankScore !== b.rankScore) {
          return b.rankScore - a.rankScore;
        }
        if (a.rawSpread !== b.rawSpread) {
          return b.rawSpread - a.rawSpread;
        }
        return a.daysOnMarket - b.daysOnMarket;
      }

      // 3. Properties with positive spread (but < $30k) next.
      //    Same freshness-weighted ranking applies.
      const aPositive = a.rawSpread > 0;
      const bPositive = b.rawSpread > 0;
      if (aPositive && !bPositive) return -1;
      if (!aPositive && bPositive) return 1;

      if (aPositive && bPositive) {
        if (a.rankScore !== b.rankScore) {
          return b.rankScore - a.rankScore;
        }
        if (a.rawSpread !== b.rawSpread) {
          return b.rawSpread - a.rawSpread;
        }
        return a.daysOnMarket - b.daysOnMarket;
      }

      // 4. Properties with zestimates next (even if negative spread)
      if (a.hasZestimate && !b.hasZestimate) return -1;
      if (!a.hasZestimate && b.hasZestimate) return 1;

      // 5. Among properties with zestimates, sort by spread descending
      if (a.hasZestimate && b.hasZestimate) {
        return b.rawSpread - a.rawSpread;
      }

      // 6. Properties without zestimates: sort by newest first
      return a.daysOnMarket - b.daysOnMarket;
    })
    .map(item => item.property);
}