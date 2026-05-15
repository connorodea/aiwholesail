/**
 * Human-readable label builders for SearchHistory chips. Kept separate from
 * the storage layer so PropertySearch (on-market) and AbsenteeOwnerSearch
 * (off-market) can share a consistent summarization style and we can
 * node-test the pure label logic.
 *
 * @typedef {Object} OnMarketLabelInput
 * @property {string} [location]
 * @property {string} [homeType]
 * @property {string|number} [price_min]
 * @property {string|number} [price_max]
 * @property {string|number} [bed_min]
 * @property {string|number} [bathrooms]
 * @property {boolean} [wholesaleOnly]
 * @property {boolean} [motivatedSellersOnly]
 * @property {boolean} [fsboOnly]
 * @property {boolean} [auctionOnly]
 * @property {number} [radiusMi]
 *
 * @typedef {Object} OffMarketLabelInput
 * @property {string} locationInput
 * @property {number} [limit]
 * @property {'any'|'gte_40'|'gte_60'|'gte_80'} [equityFilter]
 * @property {boolean} [taxDelinquentOnly]
 * @property {0|5|10|20} [minYearsHeld]
 * @property {boolean} [excludeRecentSales]
 * @property {string[]} [selectedLeadTypes]
 */

function fmtPrice(v) {
  if (v == null || v === '') return null;
  const n = typeof v === 'string' ? Number(v) : v;
  if (!Number.isFinite(n) || n <= 0) return null;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)}M`;
  if (n >= 1_000) return `$${Math.round(n / 1_000)}K`;
  return `$${n}`;
}

function priceRange(min, max) {
  const lo = fmtPrice(min);
  const hi = fmtPrice(max);
  if (lo && hi) return `${lo}–${hi}`;
  if (lo) return `${lo}+`;
  if (hi) return `≤${hi}`;
  return null;
}

/**
 * @param {OnMarketLabelInput} p
 * @returns {string}
 */
export function buildOnMarketHistoryLabel(p) {
  const parts = [];
  const loc = (p.location || '').trim();
  parts.push(loc || 'Anywhere');

  if (p.radiusMi && Number(p.radiusMi) > 0) parts.push(`${p.radiusMi}mi`);

  const price = priceRange(p.price_min, p.price_max);
  if (price) parts.push(price);

  if (p.bed_min && Number(p.bed_min) > 0) parts.push(`${p.bed_min}+bd`);
  if (p.bathrooms && Number(p.bathrooms) > 0) parts.push(`${p.bathrooms}+ba`);

  const tags = [];
  if (p.wholesaleOnly) tags.push('wholesale');
  if (p.motivatedSellersOnly) tags.push('motivated');
  if (p.fsboOnly) tags.push('FSBO');
  if (p.auctionOnly) tags.push('auction');
  if (tags.length) parts.push(tags.join('+'));

  return parts.join(' · ');
}

const EQUITY_LABEL = {
  any: '',
  gte_40: '≥40% eq',
  gte_60: '≥60% eq',
  gte_80: '≥80% eq',
};

/**
 * @param {OffMarketLabelInput} p
 * @returns {string}
 */
export function buildOffMarketHistoryLabel(p) {
  const parts = [];
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
