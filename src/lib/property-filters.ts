/**
 * Client-side toggle filters for the on-market property search.
 *
 * Up until this commit only `motivatedSellersOnly` and the post-enrichment
 * `wholesaleOnly` (via `hideNegativeSpreads`) filters were actually applied.
 * The other three toggles — Hide Auction, Hide Foreclosure, FSBO Only —
 * updated state but never narrowed the result set. This module centralises
 * the toggle → filter logic so RealEstateWholesaler's handleSearch can do
 * one pass after fetch + before enrichment.
 *
 * Detection uses heuristics over Zillow's free-form fields (listingType,
 * listingSubType, description, foreclosureStatus) because Zillow doesn't
 * surface clean isAuction/isForeclosure booleans on every record.
 */

import type { Property, PropertySearchParams } from '@/types/zillow';

type Loose = Property & {
  listingType?: string;
  listingSubType?: string;
  marketingStatus?: string;
  property_listing_listingType?: string;
  property_listingSubType_description?: string;
  property_listing_listingSubType_isAuction?: boolean;
  property_listing_listingSubType_isForeclosure?: boolean;
};

const AUCTION_NEEDLES = ['auction', 'foreclosure auction', 'sheriff sale', 'courthouse'];
const FORECLOSURE_NEEDLES = [
  'foreclosure', 'foreclosed', 'reo', 'bank-owned', 'bank owned',
  'pre-foreclosure', 'notice of default', 'short sale',
];

function fieldsAsText(p: Loose): string {
  return [
    p.listingType,
    p.listingSubType,
    p.marketingStatus,
    p.property_listing_listingType,
    p.property_listingSubType_description,
    p.description,
    p.attomData?.foreclosureStatus,
  ]
    .filter((s) => typeof s === 'string')
    .join(' ')
    .toLowerCase();
}

export function isAuctionProperty(p: Property): boolean {
  const loose = p as Loose;
  if (loose.property_listing_listingSubType_isAuction === true) return true;
  const text = fieldsAsText(loose);
  return AUCTION_NEEDLES.some((kw) => text.includes(kw));
}

export function isForeclosureProperty(p: Property): boolean {
  const loose = p as Loose;
  if (loose.property_listing_listingSubType_isForeclosure === true) return true;
  if (loose.attomData?.preForeclosure === true) return true;
  if (loose.attomData?.foreclosureStatus) return true;
  const text = fieldsAsText(loose);
  return FORECLOSURE_NEEDLES.some((kw) => text.includes(kw));
}

/**
 * Apply all the on-market toggles that need to narrow the result set
 * BEFORE expensive zestimate enrichment runs (saves API spend).
 *
 *  - auctionOnly         → hide auction listings (label says "Hide Auction")
 *  - hideForeclosures    → hide foreclosure-flavored listings
 *  - fsboOnly            → keep ONLY isFSBO==true (set by detectFSBO()
 *                          during result processing in zillow-api.ts)
 *
 * `motivatedSellersOnly` is applied AFTER enrichment (it depends on a
 * computed score), and `wholesaleOnly` is applied at render time via
 * the hideNegativeSpreads toggle — both stay as-is. This function is
 * just the pre-enrichment filters.
 */
export function applyPreEnrichmentToggles(
  properties: Property[],
  params: PropertySearchParams
): Property[] {
  let out = properties;
  if (params.auctionOnly) {
    out = out.filter((p) => !isAuctionProperty(p));
  }
  if (params.hideForeclosures) {
    out = out.filter((p) => !isForeclosureProperty(p));
  }
  if (params.fsboOnly) {
    out = out.filter((p) => (p as { isFSBO?: boolean }).isFSBO === true);
  }
  return out;
}
