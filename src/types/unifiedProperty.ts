/**
 * UnifiedProperty
 *
 * Single canonical shape that downstream features (analyzer, favorites,
 * pipeline, AI agent, CSV exports, contracts) read from, regardless of
 * whether the property came from Zillow (on-market) or PropData
 * (off-market / county assessor).
 *
 * Mapping rules:
 *   Zillow `Property`      → mapZillowToUnified()      in src/lib/unifiedPropertyAdapters.ts
 *   PropData property rec  → mapPropDataToUnified()    in src/lib/unifiedPropertyAdapters.ts
 *
 * Source-tagged optional fields are present only when the source supplies
 * them — never invented or hallucinated. Consumers should `?? '—'` rather
 * than assume presence.
 */

export type PropertySource = 'on-market' | 'off-market';

export interface UnifiedAgent {
  name?: string;
  phone?: string;
  email?: string;
  licenseNumber?: string;
  brokerage?: string;
  photoUrl?: string;
}

export interface UnifiedOwner {
  /** Full legal name (often an LLC for absentee owners) */
  name?: string;
  /** Mailing address separate from the property — the direct-mail target */
  mailingAddress?: string;
  mailingCity?: string;
  mailingState?: string;
  mailingZip?: string;
  isAbsentee?: boolean;
  /** Computed equity dollars from PropData (market value − loan balance estimate) */
  estimatedEquity?: number;
  /** 0–100 */
  equityPct?: number;
  yearsHeld?: number;
}

export interface UnifiedListing {
  /** Asking price (only on-market) */
  listPrice?: number;
  /** Algorithmic estimate (Zillow Zestimate or PropData AVM) */
  estimate?: number;
  daysOnMarket?: number;
  listDate?: string;
  pricePerSqft?: number;
  isFSBO?: boolean;
  status?: string;
  listingUrl?: string;
  mlsId?: string;
  mlsName?: string;
  /** Recent photo URLs */
  photos?: string[];
}

export interface UnifiedRecord {
  /** Last recorded sale (county assessor data, or Zillow sale history) */
  lastSalePrice?: number;
  lastSaleDate?: string;
  /** Tax assessor figures */
  assessedValue?: number;
  marketValue?: number;
  landValue?: number;
  improvementValue?: number;
  taxAmount?: number;
  taxYear?: number;
  taxDelinquent?: boolean;
  /** Assessor parcel number */
  apn?: string;
}

export interface UnifiedRiskFlags {
  /** FEMA flood zone code (e.g. "A", "AE", "X") */
  floodZone?: string;
  isOpportunityZone?: boolean;
  usdaRuralEligible?: boolean;
  /** 0–100, lower = riskier */
  crimeIndex?: number;
  /** 0–10 or A–F depending on source */
  schoolScore?: number | string;
}

export interface UnifiedProperty {
  /** Stable id: zpid for Zillow, parcel_id for PropData. Use this for React keys + dedup. */
  id: string;
  source: PropertySource;

  // ─── Geo ─────────────────────────────────────────────────────────────────
  address: string;
  city?: string;
  state?: string;
  zip?: string;
  county?: string;
  /** Lat/lng if geocoded */
  lat?: number;
  lng?: number;

  // ─── Structure ───────────────────────────────────────────────────────────
  bedrooms?: number;
  bathrooms?: number;
  sqft?: number;
  lotSqft?: number;
  yearBuilt?: number;
  propertyType?: string;

  // ─── Source-specific blocks (always nullable) ────────────────────────────
  listing?: UnifiedListing;
  owner?: UnifiedOwner;
  agent?: UnifiedAgent;
  record?: UnifiedRecord;
  risk?: UnifiedRiskFlags;

  // ─── Computed downstream (analyzer fills these) ──────────────────────────
  arv?: number;
  estimatedRepairs?: number;
  mao?: number;
  flipMargin?: number;
  /** 0–100 — composite "is this worth chasing" score */
  motivationScore?: number;

  // ─── Raw escape hatch ────────────────────────────────────────────────────
  /**
   * Original source object preserved verbatim. Use sparingly — anything
   * read from here defeats the point of normalization. Mostly for
   * debugging and one-off edge cases.
   */
  _raw?: unknown;
}

/** Type guards for source-tagged consumers (e.g. analyzer, exporters). */
export const isOnMarket = (p: UnifiedProperty): boolean => p.source === 'on-market';
export const isOffMarket = (p: UnifiedProperty): boolean => p.source === 'off-market';
