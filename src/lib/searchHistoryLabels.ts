/**
 * Human-readable label builders for SearchHistory chips. Kept separate from
 * the storage layer so PropertySearch (on-market) and AbsenteeOwnerSearch
 * (off-market) can share a consistent summarization style and we can
 * node-test the pure label logic.
 */

import type { PropertySearchParams } from '@/types/zillow';

interface OnMarketLabelInput {
  location?: string;
  homeType?: string;
  price_min?: string;
  price_max?: string;
  bed_min?: string | number;
  bathrooms?: string | number;
  wholesaleOnly?: boolean;
  motivatedSellersOnly?: boolean;
  fsboOnly?: boolean;
  auctionOnly?: boolean;
  radiusMi?: number;
}

function fmtPrice(v?: string | number): string | null {
  if (v == null || v === '') return null;
  const n = typeof v === 'string' ? Number(v) : v;
  if (!Number.isFinite(n) || n <= 0) return null;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)}M`;
  if (n >= 1_000) return `$${Math.round(n / 1_000)}K`;
  return `$${n}`;
}

function priceRange(min?: string | number, max?: string | number): string | null {
  const lo = fmtPrice(min);
  const hi = fmtPrice(max);
  if (lo && hi) return `${lo}–${hi}`;
  if (lo) return `${lo}+`;
  if (hi) return `≤${hi}`;
  return null;
}

export function buildOnMarketHistoryLabel(p: OnMarketLabelInput | PropertySearchParams): string {
  const parts: string[] = [];
  const loc = (p.location || '').trim();
  parts.push(loc || 'Anywhere');

  if (p.radiusMi && Number(p.radiusMi) > 0) parts.push(`${p.radiusMi}mi`);

  const price = priceRange(p.price_min, p.price_max);
  if (price) parts.push(price);

  if (p.bed_min && Number(p.bed_min) > 0) parts.push(`${p.bed_min}+bd`);
  if (p.bathrooms && Number(p.bathrooms) > 0) parts.push(`${p.bathrooms}+ba`);

  const tags: string[] = [];
  if (p.wholesaleOnly) tags.push('wholesale');
  if (p.motivatedSellersOnly) tags.push('motivated');
  if (p.fsboOnly) tags.push('FSBO');
  if (p.auctionOnly) tags.push('auction');
  if (tags.length) parts.push(tags.join('+'));

  return parts.join(' · ');
}

interface OffMarketLabelInput {
  locationInput: string;
  limit?: number;
  equityFilter?: 'any' | 'gte_40' | 'gte_60' | 'gte_80';
  taxDelinquentOnly?: boolean;
  minYearsHeld?: 0 | 5 | 10 | 20;
  excludeRecentSales?: boolean;
  selectedLeadTypes?: string[];
}

const EQUITY_LABEL: Record<NonNullable<OffMarketLabelInput['equityFilter']>, string> = {
  any: '',
  gte_40: '≥40% eq',
  gte_60: '≥60% eq',
  gte_80: '≥80% eq',
};

export function buildOffMarketHistoryLabel(p: OffMarketLabelInput): string {
  const parts: string[] = [];
  parts.push((p.locationInput || '').trim() || 'Anywhere');

  if (p.selectedLeadTypes && p.selectedLeadTypes.length > 0) {
    if (p.selectedLeadTypes.length === 1) {
      parts.push(p.selectedLeadTypes[0]);
    } else {
      parts.push(`${p.selectedLeadTypes.length} types`);
    }
  }

  if (p.equityFilter && p.equityFilter !== 'any') {
    parts.push(EQUITY_LABEL[p.equityFilter]);
  }

  if (p.taxDelinquentOnly) parts.push('tax-delq');
  if (p.minYearsHeld && p.minYearsHeld > 0) parts.push(`≥${p.minYearsHeld}yr held`);
  if (p.excludeRecentSales) parts.push('no recent sales');

  if (p.limit && p.limit !== 25) parts.push(`${p.limit}`);

  return parts.join(' · ');
}
