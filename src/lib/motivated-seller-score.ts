/**
 * Motivated-seller scoring algorithm.
 *
 * Combines four signals every Zillow listing exposes (or can be inferred
 * from) into a 0-100 motivation score. Used by the "Motivated Sellers"
 * search toggle (Elite-gated) to surface off-market-ish opportunities
 * inside our existing on-market data feed — the wedge for wholesalers
 * who spend most of their time on off-market sourcing.
 *
 * Signals
 *  • FSBO              — for-sale-by-owner, no agent buffer
 *  • Days on Zillow    — long DOM = stale = motivation grows over time
 *  • Price cuts        — each reduction signals motivation
 *  • Make-Me-Move      — owner-initiated "name a price" listings; detected
 *                         via description keywords since Zillow's `mmm`
 *                         flag isn't exposed by the RapidAPI feed
 *
 * Bonus signals (when present in AttomData)
 *  • Pre-foreclosure / distress indicators
 *
 * Thresholds
 *   MIN_MOTIVATED_SCORE = 30  → eligible for "Motivated Sellers Only" filter
 *   HIGH_MOTIVATION_SCORE = 60 → high-confidence badge
 *
 * Scoring is intentionally additive + capped at 100 so the algorithm is
 * easy to reason about and adjust. No ML black box. Tune weights here.
 */

import type { Property } from '@/types/zillow';

export interface MotivationSignals {
  fsbo: boolean;
  daysOnMarket: number | null;
  daysOnMarketScore: number;
  priceReductions: number;
  priceReductionsScore: number;
  makeMeMove: boolean;
  preForeclosure: boolean;
  distressIndicators: string[];
  keywordHits: string[];
}

export interface MotivationResult {
  score: number;               // 0-100
  signals: MotivationSignals;
  tier: 'none' | 'moderate' | 'high';
}

export const MIN_MOTIVATED_SCORE = 30;
export const HIGH_MOTIVATION_SCORE = 60;

// Description keywords that signal motivation. Weighted in two tiers:
// strong (each match adds full points) vs. soft (smaller add, capped).
const STRONG_KEYWORDS = [
  'motivated seller', 'must sell', 'bring all offers', 'priced to sell',
  'all offers considered', 'name your price', 'name a price', 'make me move',
  'make an offer', 'open to offers', 'priced below market', 'urgent sale',
  'estate sale', 'as-is', 'as is, where is', 'fixer upper', 'handyman special',
];
const SOFT_KEYWORDS = [
  'flexible', 'negotiable', 'relocation', 'job transfer', 'downsizing',
  'inherited', 'investor special', 'cash buyer preferred',
];

function scoreDaysOnMarket(dom: number | null | undefined): number {
  if (dom == null || dom <= 0) return 0;
  if (dom < 30) return 0;
  if (dom < 60) return 10;
  if (dom < 90) return 15;
  if (dom < 180) return 20;
  return 25;
}

function scorePriceReductions(count: number, originalPrice?: number, currentPrice?: number): number {
  if (!count || count <= 0) return 0;
  let score = 0;
  if (count >= 3) score = 20;
  else if (count === 2) score = 15;
  else score = 10;
  // Bonus when the total reduction is materially deep (>10%)
  if (originalPrice && currentPrice && originalPrice > currentPrice) {
    const reductionPct = (originalPrice - currentPrice) / originalPrice;
    if (reductionPct >= 0.10) score += 5;
  }
  return score;
}

function detectMakeMeMove(description: string | undefined, status: string | undefined): boolean {
  if (!description) return false;
  const desc = description.toLowerCase();
  // Direct phrases
  if (desc.includes('make me move') || desc.includes('name your price') || desc.includes('name a price')) {
    return true;
  }
  // Zillow's pre-MLS / off-market style indicators in the status field
  if (status && /make.?me.?move|pre.listing|coming.soon|off.?market/i.test(status)) {
    return true;
  }
  return false;
}

function detectKeywords(description: string | undefined): { strong: string[]; soft: string[] } {
  if (!description) return { strong: [], soft: [] };
  const desc = description.toLowerCase();
  return {
    strong: STRONG_KEYWORDS.filter((kw) => desc.includes(kw)),
    soft: SOFT_KEYWORDS.filter((kw) => desc.includes(kw)),
  };
}

export function scoreMotivation(property: Property): MotivationResult {
  const dom = property.daysOnMarket ?? null;
  const fsbo = property.isFSBO === true;
  const priceReductions = property.attomData?.priceReductions ?? 0;
  const preForeclosure = property.attomData?.preForeclosure === true;
  const distressIndicators = property.attomData?.distressIndicators ?? [];
  const makeMeMove = detectMakeMeMove(property.description, property.status);
  const { strong, soft } = detectKeywords(property.description);

  // Additive scoring — easy to reason about, easy to tune
  let score = 0;
  if (fsbo) score += 20;
  const domScore = scoreDaysOnMarket(dom);
  score += domScore;
  const priceCutScore = scorePriceReductions(priceReductions);
  score += priceCutScore;
  if (makeMeMove) score += 30;
  if (preForeclosure) score += 25;
  // Distress indicators (vacant, tax-delinquent, etc.) — each +5, capped at 15
  if (distressIndicators.length > 0) {
    score += Math.min(15, distressIndicators.length * 5);
  }
  // Strong description keywords — each +5, capped at 15
  if (strong.length > 0) {
    score += Math.min(15, strong.length * 5);
  }
  // Soft keywords — each +2, capped at 6
  if (soft.length > 0) {
    score += Math.min(6, soft.length * 2);
  }

  // Cap and round
  score = Math.min(100, Math.max(0, Math.round(score)));

  const tier: MotivationResult['tier'] =
    score >= HIGH_MOTIVATION_SCORE ? 'high' :
    score >= MIN_MOTIVATED_SCORE ? 'moderate' : 'none';

  return {
    score,
    tier,
    signals: {
      fsbo,
      daysOnMarket: dom,
      daysOnMarketScore: domScore,
      priceReductions,
      priceReductionsScore: priceCutScore,
      makeMeMove,
      preForeclosure,
      distressIndicators,
      keywordHits: [...strong, ...soft],
    },
  };
}

/**
 * Apply the motivated-seller filter to a list of properties.
 * Returns properties at or above the threshold, sorted by motivation
 * score descending (best leads first).
 */
export function filterMotivatedSellers(
  properties: Property[],
  threshold: number = MIN_MOTIVATED_SCORE
): Array<Property & { motivation: MotivationResult }> {
  return properties
    .map((p) => ({ ...p, motivation: scoreMotivation(p) }))
    .filter((p) => p.motivation.score >= threshold)
    .sort((a, b) => b.motivation.score - a.motivation.score);
}

/**
 * Score every property (no filter). Useful when the user wants to see
 * everyone with motivation indicators visible, rather than filtering out
 * non-motivated properties entirely.
 */
export function scoreAllProperties(
  properties: Property[]
): Array<Property & { motivation: MotivationResult }> {
  return properties.map((p) => ({ ...p, motivation: scoreMotivation(p) }));
}

/**
 * Generate a short human-readable summary of why a property scored high.
 * Used in the badge tooltip / property card.
 */
export function describeMotivation(result: MotivationResult): string {
  if (result.score < MIN_MOTIVATED_SCORE) return 'Low motivation indicators.';
  const parts: string[] = [];
  if (result.signals.fsbo) parts.push('FSBO');
  if (result.signals.makeMeMove) parts.push('Make Me Move');
  if (result.signals.preForeclosure) parts.push('pre-foreclosure');
  if (result.signals.daysOnMarketScore > 0 && result.signals.daysOnMarket) {
    parts.push(`${result.signals.daysOnMarket} days on market`);
  }
  if (result.signals.priceReductions > 0) {
    parts.push(`${result.signals.priceReductions} price cut${result.signals.priceReductions > 1 ? 's' : ''}`);
  }
  if (result.signals.distressIndicators.length > 0) {
    parts.push(`${result.signals.distressIndicators.length} distress signal${result.signals.distressIndicators.length > 1 ? 's' : ''}`);
  }
  if (result.signals.keywordHits.length > 0) {
    parts.push(`description keywords (${result.signals.keywordHits.slice(0, 2).join(', ')}${result.signals.keywordHits.length > 2 ? '…' : ''})`);
  }
  return parts.length > 0 ? parts.join(' · ') : 'Motivation signals detected.';
}
