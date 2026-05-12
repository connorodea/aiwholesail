/**
 * PropData Real Estate Market Intelligence API client.
 *
 * All calls go through our backend proxy (`/api/propdata/*`) so the RapidAPI
 * key stays server-side. Per-user rate limit + 1h LRU cache live in the
 * backend; this file is just a typed wrapper around the apiFetch transport.
 *
 * The old shape (`new PropDataAPI()`, `propDataAPI.getMarketProfile(...)`)
 * is preserved so existing components don't break.
 */

import { propdata as backend } from './api-client';

// ============ TYPES ============

export interface PropDataMarketResponse {
  zip?: string;
  state?: string;
  metro?: string;
  zori?: {
    median_rent?: number;
    trend_12m?: number[];
    yoy_change?: number;
  };
  realtor?: {
    days_on_market?: number;
    active_inventory?: number;
    price_per_sqft?: number;
    new_listings?: number;
    median_list_price?: number;
  };
  redfin?: {
    sale_to_list_ratio?: number;
    pct_sold_above_list?: number;
    months_of_supply?: number;
    median_sale_price?: number;
  };
  hud_fmr?: {
    studio?: number;
    one_br?: number;
    two_br?: number;
    three_br?: number;
    four_br?: number;
    county?: string;
  };
  census_zip?: {
    vacancy_rate?: number;
    renter_pct?: number;
    poverty_rate?: number;
    median_household_income?: number;
    population?: number;
  };
  census_county?: {
    vacancy_rate?: number;
    renter_pct?: number;
    poverty_rate?: number;
    median_household_income?: number;
    county?: string;
  };
  fhfa?: {
    hpi_1yr?: number;
    hpi_5yr?: number;
    state_appreciation?: number;
    metro_appreciation?: number;
  };
  fred?: {
    mortgage_rate_30yr?: number;
    shelter_cpi?: number;
    housing_starts?: number;
  };
  propdata_estimate?: {
    rent_low?: number;
    rent_mid?: number;
    rent_high?: number;
    confidence?: number;
    weighted_estimate?: number;
  };
  fema_nri?: {
    overall_risk?: string;
    flood?: number;
    wind?: number;
    earthquake?: number;
    wildfire?: number;
    tornado?: number;
    hail?: number;
    hurricane?: number;
    [key: string]: any;
  };
  fema_nsi?: { [key: string]: any };
  schools?: {
    district_quality?: string;
    title_i_concentration?: number;
    [key: string]: any;
  };
  safety?: {
    grade?: string;
    score?: number;
    narrative?: string;
  };
  [key: string]: any;
}

export interface PropDataPropertyResponse {
  address?: string;
  owner_name?: string;
  owner_first_name?: string;
  owner_last_name?: string;
  mailing_address?: string;
  mailing_city?: string;
  mailing_state?: string;
  mailing_zip?: string;
  assessed_value?: number;
  market_value?: number;
  improvement_value?: number;
  land_value?: number;
  last_sale_price?: number;
  last_sale_date?: string;
  year_built?: number;
  bedrooms?: number;
  bathrooms?: number;
  sqft?: number;
  lot_sqft?: number;
  property_type?: string;
  tax_amount?: number;
  tax_year?: number;
  tax_delinquent?: boolean;
  owner_occupied?: boolean;
  county?: string;
  state?: string;
  zip?: string;
  apn?: string;
  fips?: string;
  latitude?: number;
  longitude?: number;
  [key: string]: any;
}

// New richer shape for /v1/property — bulk + single use both fit here.
export interface PropDataPropertyRecord {
  parcel_id?: string;
  county_fips?: string;
  county_name?: string;
  state?: string;
  address?: { street?: string; city?: string; zip?: string };
  owner?: {
    name?: string;
    mailing_address?: string;
    mailing_city?: string;
    mailing_state?: string;
    mailing_zip?: string;
  };
  valuation?: {
    market_value?: number;
    assessed_value?: number;
    land_value?: number;
    improvement_value?: number;
    tax_year?: number;
  };
  sale?: { last_sale_date?: string; last_sale_price?: number };
  characteristics?: {
    property_type?: string;
    sq_ft_living?: number | null;
    sq_ft_lot?: number | null;
    year_built?: number;
    bedrooms?: number | null;
    bathrooms?: number | null;
    zoning?: string | null;
  };
  tax_status?: string;
  source?: string;
  data_as_of?: string;
  equity?: {
    estimated_equity?: number;
    equity_pct?: number;
    est_loan_balance?: number;
    years_held?: number;
    confidence?: string;
  };
  flags?: {
    is_absentee_owner?: boolean;
    is_vacant_land?: boolean;
    has_owner_data?: boolean;
    has_phone?: boolean;
  };
  [key: string]: any;
}

export interface PropDataPropertyListResponse {
  query?: Record<string, any>;
  count?: number;
  enrichment?: {
    is_opportunity_zone?: boolean;
    usda_rural_eligible?: boolean;
    fema_flood_zone?: string | null;
  };
  properties?: PropDataPropertyRecord[];
  error?: string;
  status?: number;
  [key: string]: any;
}

export interface PropDataEstimateResponse {
  zip?: string;
  state?: string;
  beds?: number;
  rent_low?: number;
  rent_mid?: number;
  rent_high?: number;
  confidence?: number;
  weighted_estimate?: number;
  sources?: { zori?: number; hud_fmr?: number; census?: number };
  // Newer API shape: nested `estimate`
  estimate?: {
    bedrooms?: number;
    monthly_low?: number;
    monthly_mid?: number;
    monthly_high?: number;
    confidence_pct?: number;
    market_trend?: string;
    yoy_rent_change?: string;
  };
  [key: string]: any;
}

export interface PropDataSafetyResponse {
  zip?: string;
  state?: string;
  grade?: string;
  score?: number;
  narrative?: string;
  factors?: {
    poverty_rate?: number;
    unemployment?: number;
    school_quality?: string;
    hazard_risk?: string;
  };
  [key: string]: any;
}

export interface PropDataGeocodeResponse {
  results?: Array<{
    lat?: number;
    lng?: number;
    fips_state?: string;
    fips_county?: string;
    fips_tract?: string;
    fips_block_group?: string;
    formatted_address?: string;
    [key: string]: any;
  }>;
  count?: number;
  source?: string;
  // Back-compat: flat shape
  lat?: number;
  lng?: number;
  formatted_address?: string;
  [key: string]: any;
}

export interface PropDataNeighborhoodResponse {
  zip?: string;
  demographics?: {
    total_population?: number | null;
    median_age?: number | null;
    median_household_income?: number | null;
    owner_occupied_pct?: number | null;
    college_degree_pct?: number | null;
  };
  housing?: {
    median_value?: number | null;
    avg_sqft?: number | null;
    avg_year_built?: number | null;
    total_parcels?: number;
  };
  scores?: {
    walkability?: number;
    crime_index?: number;
    school_score?: number;
    note?: string;
  };
  source?: string;
  [key: string]: any;
}

export interface PropDataRentResponse {
  location?: { zip?: string; state?: string; metro?: string };
  rent?: {
    median_asking_rent?: number;
    yoy_pct?: number;
    mom_pct?: number;
    period?: string;
    fmr_efficiency?: number;
    fmr_1br?: number;
    fmr_2br?: number;
    fmr_3br?: number;
    fmr_4br?: number;
    fmr_year?: number;
  };
  history?: Array<Record<string, any>>;
  error?: string;
  [key: string]: any;
}

export interface PropDataCompsResponse {
  zip?: string;
  comps?: Array<{
    parcel_id?: string;
    address?: string;
    value?: number | null;
    last_sale_price?: number | null;
    last_sale_date?: string | null;
    beds?: number | null;
    baths?: number | null;
    sqft?: number | null;
    year_built?: number | null;
  }>;
  count?: number;
  source?: string;
  [key: string]: any;
}

// ============ ERRORS ============

/**
 * Structured error codes mirrored from the backend proxy's
 * propdata-normalizer.js. Keep this list in sync — adding a code here
 * requires adding it server-side too, and vice versa.
 */
export type PropDataErrorCode =
  | 'OK'
  | 'NO_COVERAGE'       // PropData doesn't have parcel/market data for this region
  | 'NOT_FOUND'         // The specific record doesn't exist
  | 'RATE_LIMITED'      // We hit our per-user rate limit OR PropData rate-limited us
  | 'UPSTREAM_ERROR'    // PropData / RapidAPI returned 5xx
  | 'TIMEOUT'           // Upstream timed out
  | 'NOT_CONFIGURED'    // Backend missing PROPDATA_RAPIDAPI_KEY
  | 'NETWORK'           // ECONNRESET / DNS / etc
  | 'UNKNOWN';          // Fallback when no code surfaces

/**
 * Rich PropData error that exposes the structured `code` from the backend
 * so consumers (toast messages, retry logic, UI states) can branch
 * cleanly without string-matching the error message.
 *
 * Replaces the prior `throw new Error(res.error)` pattern.
 */
export class PropDataError extends Error {
  constructor(
    message: string,
    public readonly code: PropDataErrorCode,
  ) {
    super(message);
    this.name = 'PropDataError';
  }

  /** Convenience: was this a coverage gap (vs an actual failure)? */
  get isCoverageGap(): boolean {
    return this.code === 'NO_COVERAGE' || this.code === 'NOT_FOUND';
  }

  /** Convenience: is a retry likely to help? */
  get isTransient(): boolean {
    return this.code === 'UPSTREAM_ERROR' || this.code === 'TIMEOUT' || this.code === 'NETWORK';
  }
}

// ============ SERVICE ============

const KNOWN_CODES: ReadonlySet<string> = new Set<PropDataErrorCode>([
  'OK', 'NO_COVERAGE', 'NOT_FOUND', 'RATE_LIMITED',
  'UPSTREAM_ERROR', 'TIMEOUT', 'NOT_CONFIGURED', 'NETWORK', 'UNKNOWN',
]);

function narrowCode(raw: string | undefined): PropDataErrorCode {
  return raw && KNOWN_CODES.has(raw) ? (raw as PropDataErrorCode) : 'UNKNOWN';
}

function unwrap<T>(res: { data?: T; error?: string; code?: string }): T {
  if (res.error) {
    throw new PropDataError(res.error, narrowCode(res.code));
  }
  // Strict-mode-safe "no data" fallback. Callers either get a real response
  // or an empty object — `unknown` is used as the intermediate because
  // `{}` isn't assignable to `T` in strict mode without it.
  return (res.data ?? ({} as unknown as T));
}

class PropDataAPI {
  async getMarketProfile(params: {
    zip?: string;
    state?: string;
    metro?: string;
    months?: string;
  }): Promise<PropDataMarketResponse> {
    return unwrap(await backend.market({
      zip: params.zip,
      state: params.state,
      metro: params.metro,
      months: params.months || '12',
    }));
  }

  async getProperty(params: {
    address?: string;
    zip?: string;
    apn?: string;
    owner?: string;
  }): Promise<PropDataPropertyResponse | PropDataPropertyListResponse> {
    return unwrap(await backend.property({
      address: params.address,
      zip: params.zip,
      apn: params.apn,
      owner: params.owner,
    }));
  }

  async listAbsenteeOwners(params: {
    zip: string;
    limit?: number;
  }): Promise<PropDataPropertyListResponse> {
    return unwrap(await backend.property({
      zip: params.zip,
      absentee_only: true,
      limit: params.limit ?? 25,
    }));
  }

  async getRentEstimate(params: {
    zip?: string;
    state?: string;
    beds?: string;
  }): Promise<PropDataEstimateResponse> {
    return unwrap(await backend.estimate({
      zip: params.zip,
      state: params.state,
      beds: params.beds || '3',
    }));
  }

  async getNeighborhood(zip: string): Promise<PropDataNeighborhoodResponse> {
    return unwrap(await backend.neighborhood(zip));
  }

  async getRent(params: {
    zip?: string;
    state?: string;
    beds?: string;
  }): Promise<PropDataRentResponse> {
    return unwrap(await backend.rent({
      zip: params.zip,
      state: params.state,
      beds: params.beds,
    }));
  }

  async getListing(zip: string) {
    return unwrap(await backend.listing(zip));
  }

  async getComps(params: {
    zip?: string;
    address?: string;
    limit?: number;
    radius?: number;
  }): Promise<PropDataCompsResponse> {
    return unwrap(await backend.comps(params));
  }

  // Back-compat alias. The new API doesn't have a dedicated /v1/safety; the
  // safety signal lives inside /v1/neighborhood.scores.
  async getSafetyScore(params: { zip?: string; state?: string }): Promise<PropDataSafetyResponse> {
    if (!params.zip) return {};
    const nb = await this.getNeighborhood(params.zip);
    const score = nb.scores?.crime_index;
    const grade = score == null ? undefined
      : score >= 80 ? 'A'
      : score >= 65 ? 'B'
      : score >= 50 ? 'C'
      : score >= 35 ? 'D'
      : 'F';
    return {
      zip: params.zip,
      state: params.state,
      grade,
      score,
      narrative: nb.scores?.note,
    };
  }

  async geocode(address: string): Promise<PropDataGeocodeResponse> {
    return unwrap(await backend.geocode(address));
  }

  async healthCheck(): Promise<{ status?: string }> {
    return unwrap(await backend.health());
  }

  async getStats() {
    return unwrap(await backend.stats());
  }

  async getFullPropertyIntelligence(params: {
    address: string;
    zip: string;
    beds?: string;
  }): Promise<{
    property: PropDataPropertyResponse | PropDataPropertyListResponse;
    market: PropDataMarketResponse;
    safety: PropDataSafetyResponse;
    rentEstimate: PropDataEstimateResponse;
  }> {
    const [property, market, safety, rentEstimate] = await Promise.all([
      this.getProperty({ address: params.address, zip: params.zip }).catch(() => ({} as PropDataPropertyResponse)),
      this.getMarketProfile({ zip: params.zip }).catch(() => ({} as PropDataMarketResponse)),
      this.getSafetyScore({ zip: params.zip }).catch(() => ({} as PropDataSafetyResponse)),
      this.getRentEstimate({ zip: params.zip, beds: params.beds || '3' }).catch(() => ({} as PropDataEstimateResponse)),
    ]);
    return { property, market, safety, rentEstimate };
  }
}

export const propDataAPI = new PropDataAPI();
