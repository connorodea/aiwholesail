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

export function sortPropertiesByWholesalePotential(properties: Property[]): Property[] {
  return properties
    .map(property => ({
      property,
      potential: calculateWholesalePotential(property)
    }))
    .sort((a, b) => {
      // Primary sort: wholesale potential score (descending)
      if (b.potential.score !== a.potential.score) {
        return b.potential.score - a.potential.score;
      }
      
      // Secondary sort: spread amount (descending)
      if (b.potential.spreadAmount !== a.potential.spreadAmount) {
        return b.potential.spreadAmount - a.potential.spreadAmount;
      }
      
      // Tertiary sort: days on market (descending - longer is better for negotiation)
      const aDays = a.property.daysOnMarket || 0;
      const bDays = b.property.daysOnMarket || 0;
      return bDays - aDays;
    })
    .map(item => item.property);
}