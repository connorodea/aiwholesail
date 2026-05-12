import { Property } from '@/types/zillow';

export interface WholesalePotential {
  spreadAmount: number;
  spreadPercentage: number;
  score: number;
  tier: 'excellent' | 'great' | 'good' | 'fair' | 'poor';
}

export function calculateWholesalePotential(property: Property): WholesalePotential {
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
      return { property, potential: calculateWholesalePotential(property), hasZestimate, rawSpread, daysOnMarket, isQualifiedDeal };
    })
    .sort((a, b) => {
      // 1. Qualified deals ($30k+ spread) always first
      if (a.isQualifiedDeal && !b.isQualifiedDeal) return -1;
      if (!a.isQualifiedDeal && b.isQualifiedDeal) return 1;

      // 2. Among qualified deals: SPREAD primary (user expectation — biggest
      //    spread on top), days-on-market as a tiebreaker. Previously this
      //    had days primary, which buried $200K-spread 30-day-old listings
      //    under $30K-spread brand-new ones — user reported "highest spreads
      //    aren't autopopulating to the top anymore".
      if (a.isQualifiedDeal && b.isQualifiedDeal) {
        if (a.rawSpread !== b.rawSpread) {
          return b.rawSpread - a.rawSpread;
        }
        return a.daysOnMarket - b.daysOnMarket;
      }

      // 3. Properties with positive spread (but < $30k) next.
      //    Same priority: spread primary, days-on-market tiebreaker.
      const aPositive = a.rawSpread > 0;
      const bPositive = b.rawSpread > 0;
      if (aPositive && !bPositive) return -1;
      if (!aPositive && bPositive) return 1;

      if (aPositive && bPositive) {
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