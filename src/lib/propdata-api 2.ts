/**
 * PropData Real Estate Market Intelligence API
 * 82M+ parcels · 14 data sources · One endpoint
 * https://propdata.proptechusa.ai
 */

const RAPIDAPI_KEY = import.meta.env.VITE_PROPDATA_RAPIDAPI_KEY || '';
const RAPIDAPI_HOST = import.meta.env.VITE_PROPDATA_RAPIDAPI_HOST || 'propdata-real-estate-market-intelligence-api.p.rapidapi.com';
const BASE_URL = `https://${RAPIDAPI_HOST}`;

// ============ TYPES ============

export interface PropDataMarketResponse {
  zip?: string;
  state?: string;
  metro?: string;
  // Zillow ZORI rent data
  zori?: {
    median_rent?: number;
    trend_12m?: number[];
    yoy_change?: number;
  };
  // Realtor.com market data
  realtor?: {
    days_on_market?: number;
    active_inventory?: number;
    price_per_sqft?: number;
    new_listings?: number;
    median_list_price?: number;
  };
  // Redfin metrics
  redfin?: {
    sale_to_list_ratio?: number;
    pct_sold_above_list?: number;
    months_of_supply?: number;
    median_sale_price?: number;
  };
  // HUD Fair Market Rents
  hud_fmr?: {
    studio?: number;
    one_br?: number;
    two_br?: number;
    three_br?: number;
    four_br?: number;
    county?: string;
  };
  // Census ACS (ZIP level)
  census_zip?: {
    vacancy_rate?: number;
    renter_pct?: number;
    poverty_rate?: number;
    median_household_income?: number;
    population?: number;
  };
  // Census ACS (County level)
  census_county?: {
    vacancy_rate?: number;
    renter_pct?: number;
    poverty_rate?: number;
    median_household_income?: number;
    county?: string;
  };
  // FHFA House Price Index
  fhfa?: {
    hpi_1yr?: number;
    hpi_5yr?: number;
    state_appreciation?: number;
    metro_appreciation?: number;
  };
  // FRED economic data
  fred?: {
    mortgage_rate_30yr?: number;
    shelter_cpi?: number;
    housing_starts?: number;
  };
  // PropData Estimate Engine
  propdata_estimate?: {
    rent_low?: number;
    rent_mid?: number;
    rent_high?: number;
    confidence?: number;
    weighted_estimate?: number;
  };
  // FEMA Natural Risk Index
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
  // FEMA National Structures Inventory
  fema_nsi?: {
    [key: string]: any;
  };
  // NCES School Quality
  schools?: {
    district_quality?: string;
    title_i_concentration?: number;
    [key: string]: any;
  };
  // Community Safety Engine
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

export interface PropDataEstimateResponse {
  zip?: string;
  state?: string;
  beds?: number;
  rent_low?: number;
  rent_mid?: number;
  rent_high?: number;
  confidence?: number;
  weighted_estimate?: number;
  sources?: {
    zori?: number;
    hud_fmr?: number;
    census?: number;
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
  lat?: number;
  lng?: number;
  fips_state?: string;
  fips_county?: string;
  fips_tract?: string;
  fips_block_group?: string;
  formatted_address?: string;
  [key: string]: any;
}

// ============ SERVICE ============

class PropDataAPI {
  private headers: Record<string, string>;

  constructor() {
    this.headers = {
      'x-rapidapi-key': RAPIDAPI_KEY,
      'x-rapidapi-host': RAPIDAPI_HOST,
      'Content-Type': 'application/json',
    };
  }

  private async request<T>(endpoint: string, params: Record<string, string> = {}): Promise<T> {
    const url = new URL(`${BASE_URL}${endpoint}`);
    Object.entries(params).forEach(([key, value]) => {
      if (value) url.searchParams.set(key, value);
    });

    console.log(`[PropData] GET ${endpoint}`, params);

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: this.headers,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[PropData] Error ${response.status}:`, errorText);
      throw new Error(`PropData API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    console.log(`[PropData] Response from ${endpoint}:`, JSON.stringify(data).substring(0, 500));
    return data as T;
  }

  /**
   * Full market profile — all 14 sources in one response.
   * Params: zip, state, metro (at least one required), months (default 12)
   */
  async getMarketProfile(params: {
    zip?: string;
    state?: string;
    metro?: string;
    months?: string;
  }): Promise<PropDataMarketResponse> {
    return this.request<PropDataMarketResponse>('/v1/market', {
      zip: params.zip || '',
      state: params.state || '',
      metro: params.metro || '',
      months: params.months || '12',
    });
  }

  /**
   * County assessor skip trace — owner names, mailing addresses,
   * assessed values, sale history. 82M+ records.
   */
  async getProperty(params: {
    address?: string;
    zip?: string;
    apn?: string;
    owner?: string;
  }): Promise<PropDataPropertyResponse> {
    return this.request<PropDataPropertyResponse>('/v1/property', {
      address: params.address || '',
      zip: params.zip || '',
      apn: params.apn || '',
      owner: params.owner || '',
    });
  }

  /**
   * Proprietary rent estimate by ZIP + bedroom count.
   * Returns low/mid/high range + confidence score.
   */
  async getRentEstimate(params: {
    zip?: string;
    state?: string;
    beds?: string;
  }): Promise<PropDataEstimateResponse> {
    return this.request<PropDataEstimateResponse>('/v1/estimate', {
      zip: params.zip || '',
      state: params.state || '',
      beds: params.beds || '3',
    });
  }

  /**
   * Community Safety Score — A-F grade, 0-100 score,
   * AI narrative combining poverty, unemployment, schools, hazards.
   */
  async getSafetyScore(params: {
    zip?: string;
    state?: string;
  }): Promise<PropDataSafetyResponse> {
    return this.request<PropDataSafetyResponse>('/v1/safety', {
      zip: params.zip || '',
      state: params.state || '',
    });
  }

  /**
   * Address to lat/lng + full Census FIPS chain. No auth required.
   */
  async geocode(address: string): Promise<PropDataGeocodeResponse> {
    return this.request<PropDataGeocodeResponse>('/v1/geocode', {
      address,
    });
  }

  /**
   * System health check. No auth required.
   */
  async healthCheck(): Promise<{ status: string }> {
    return this.request<{ status: string }>('/v1/health');
  }

  /**
   * Search for off-market properties by ZIP code.
   * Returns county assessor data with owner info.
   */
  async searchOffMarketByZip(zip: string): Promise<PropDataPropertyResponse[]> {
    try {
      const result = await this.getProperty({ zip });
      // API may return single object or array
      return Array.isArray(result) ? result : [result];
    } catch (error) {
      console.error('[PropData] Off-market search failed:', error);
      throw error;
    }
  }

  /**
   * Get comprehensive property intelligence:
   * property data + market profile + safety score + rent estimate
   */
  async getFullPropertyIntelligence(params: {
    address: string;
    zip: string;
    beds?: string;
  }): Promise<{
    property: PropDataPropertyResponse;
    market: PropDataMarketResponse;
    safety: PropDataSafetyResponse;
    rentEstimate: PropDataEstimateResponse;
  }> {
    const [property, market, safety, rentEstimate] = await Promise.all([
      this.getProperty({ address: params.address }).catch(() => ({} as PropDataPropertyResponse)),
      this.getMarketProfile({ zip: params.zip }).catch(() => ({} as PropDataMarketResponse)),
      this.getSafetyScore({ zip: params.zip }).catch(() => ({} as PropDataSafetyResponse)),
      this.getRentEstimate({ zip: params.zip, beds: params.beds || '3' }).catch(() => ({} as PropDataEstimateResponse)),
    ]);

    return { property, market, safety, rentEstimate };
  }
}

export const propDataAPI = new PropDataAPI();
