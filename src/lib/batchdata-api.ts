/**
 * BatchData client — off-market data + skip tracing.
 *
 * Mirrors the PropData client surface (`@/lib/propdata-api`) so the
 * AbsenteeOwnerSearch component can swap providers behind the
 * `batchdata_offmarket` feature flag without changing call sites.
 *
 * All calls go through our backend proxy (`/api/batchdata/*`) — the
 * BatchData API key never lives in the browser bundle. The proxy
 * pass-throughs the request body verbatim, so this client speaks
 * BatchData's native schema (searchCriteria + quicklists + options).
 *
 * Reference: developer.batchdata.com (BatchData v1)
 */
import { apiFetch } from './api-client';

/* -------------------------------------------------------------------------- */
/*  Shared types                                                              */
/* -------------------------------------------------------------------------- */

export interface BatchAddress {
  street?: string;
  city?: string;
  state?: string;
  zip?: string;
  county?: string;
}

export interface BatchOwner {
  firstName?: string;
  lastName?: string;
  fullName?: string;
  mailingAddress?: BatchAddress;
  isAbsenteeOwner?: boolean;
  isCorporateOwner?: boolean;
}

export interface BatchValuation {
  estimatedValue?: number;
  estimatedEquity?: number;
  ltv?: number;
  lastSalePrice?: number;
  lastSaleDate?: string;
}

/**
 * BatchData property record. The shape varies slightly by quicklist
 * (e.g. preForeclosure has auction/notice fields, taxDelinquent has
 * delinquency amount). All known fields included as optional.
 */
export interface BatchPropertyRecord {
  _id?: string;
  parcelId?: string;
  address?: BatchAddress;
  owner?: BatchOwner;
  valuation?: BatchValuation;
  characteristics?: {
    bedrooms?: number;
    bathrooms?: number;
    squareFeet?: number;
    lotSize?: number;
    yearBuilt?: number;
    propertyType?: string;
  };
  quickLists?: {
    preForeclosure?: boolean;
    absenteeOwner?: boolean;
    highEquity?: boolean;
    taxDelinquent?: boolean;
    vacant?: boolean;
    cashBuyer?: boolean;
    [k: string]: boolean | undefined;
  };
  foreclosure?: {
    noticeDate?: string;
    auctionDate?: string;
    defaultAmount?: number;
    [k: string]: any;
  };
  // Forward-compat for fields we haven't typed yet
  [k: string]: any;
}

export interface BatchSearchResponse {
  status?: { code: number; text: string; message?: string };
  results?: {
    properties?: BatchPropertyRecord[];
    [k: string]: any;
  };
  // Some responses put properties at top level
  properties?: BatchPropertyRecord[];
  [k: string]: any;
}

/**
 * BatchData's available "quicklists" — pre-built filters they maintain.
 * Pass any subset; the result set narrows to properties matching ALL
 * selected lists (logical AND).
 *
 * Names mirror BatchData's documented filter keys. If their API adds
 * new ones, the proxy is pure pass-through — the new key just needs
 * to be added to this union and the UI's lead-type mapping.
 */
export type BatchQuickList =
  | 'preForeclosure'
  | 'absenteeOwner'
  | 'absenteeOutOfState'
  | 'highEquity'
  | 'freeAndClear'
  | 'lowEquity'
  | 'taxDelinquent'
  | 'vacant'
  | 'cashBuyer'
  | 'tiredLandlord'
  | 'inherited'
  | 'expiredListing';

export interface BatchSearchCriteria {
  // Geo — typically one of these or a combination
  compAddress?: { city?: string; state?: string; zip?: string };
  zip?: string;
  zipCodes?: string[];
  city?: string;
  state?: string;
  county?: string;

  // Filters
  quickLists?: BatchQuickList[];
  ownerOccupied?: boolean;
  minEquity?: number;
  maxEquity?: number;
  minEstimatedValue?: number;
  maxEstimatedValue?: number;
  minBedrooms?: number;
  minBathrooms?: number;
  minSquareFeet?: number;
  maxSquareFeet?: number;
  yearBuiltMin?: number;
  yearBuiltMax?: number;

  // Pass-through escape hatch for any filter we don't have typed yet
  [k: string]: any;
}

export interface BatchSearchOptions {
  take?: number;
  skip?: number;
  [k: string]: any;
}

/* -------------------------------------------------------------------------- */
/*  Client                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Property search with arbitrary BatchData criteria + quicklists.
 *
 * Examples:
 *   search({ searchCriteria: { zip: '78737', quickLists: ['absenteeOwner','highEquity'] } })
 *   search({ searchCriteria: { city: 'Austin', state: 'TX', quickLists: ['preForeclosure'] }, options: { take: 50 } })
 */
export async function search(payload: {
  searchCriteria: BatchSearchCriteria;
  options?: BatchSearchOptions;
}) {
  return apiFetch<BatchSearchResponse>('/api/batchdata/property/search', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

/* -------------------------------------------------------------------------- */
/*  Convenience wrappers — one per off-market lead type                       */
/* -------------------------------------------------------------------------- */

/** Absentee owners (mailing address ≠ property address). */
export async function listAbsenteeOwners(params: {
  zip?: string;
  zipCodes?: string[];
  city?: string;
  state?: string;
  county?: string;
  take?: number;
  minEquity?: number;
}) {
  const { take, ...criteria } = params;
  return search({
    searchCriteria: { ...criteria, quickLists: ['absenteeOwner'] },
    options: { take: take ?? 25 },
  });
}

/** Pre-foreclosure properties (notice of default filed, not yet auctioned). */
export async function listPreforeclosures(params: {
  zip?: string;
  zipCodes?: string[];
  city?: string;
  state?: string;
  county?: string;
  take?: number;
}) {
  const { take, ...criteria } = params;
  return search({
    searchCriteria: { ...criteria, quickLists: ['preForeclosure'] },
    options: { take: take ?? 25 },
  });
}

/** High-equity owners (60%+ equity). */
export async function listHighEquity(params: {
  zip?: string;
  zipCodes?: string[];
  city?: string;
  state?: string;
  county?: string;
  take?: number;
}) {
  const { take, ...criteria } = params;
  return search({
    searchCriteria: { ...criteria, quickLists: ['highEquity'] },
    options: { take: take ?? 25 },
  });
}

/** Free-and-clear (100% equity, no mortgage). */
export async function listFreeAndClear(params: {
  zip?: string;
  zipCodes?: string[];
  city?: string;
  state?: string;
  county?: string;
  take?: number;
}) {
  const { take, ...criteria } = params;
  return search({
    searchCriteria: { ...criteria, quickLists: ['freeAndClear'] },
    options: { take: take ?? 25 },
  });
}

/** Tax-delinquent properties. */
export async function listTaxDelinquent(params: {
  zip?: string;
  zipCodes?: string[];
  city?: string;
  state?: string;
  county?: string;
  take?: number;
}) {
  const { take, ...criteria } = params;
  return search({
    searchCriteria: { ...criteria, quickLists: ['taxDelinquent'] },
    options: { take: take ?? 25 },
  });
}

/** Vacant properties (USPS vacancy data). */
export async function listVacant(params: {
  zip?: string;
  zipCodes?: string[];
  city?: string;
  state?: string;
  county?: string;
  take?: number;
}) {
  const { take, ...criteria } = params;
  return search({
    searchCriteria: { ...criteria, quickLists: ['vacant'] },
    options: { take: take ?? 25 },
  });
}

/** Cash buyers (purchased with cash). */
export async function listCashBuyers(params: {
  zip?: string;
  zipCodes?: string[];
  city?: string;
  state?: string;
  county?: string;
  take?: number;
}) {
  const { take, ...criteria } = params;
  return search({
    searchCriteria: { ...criteria, quickLists: ['cashBuyer'] },
    options: { take: take ?? 25 },
  });
}

/** Tired landlords (long-held rentals with motivation signals). */
export async function listTiredLandlords(params: {
  zip?: string;
  zipCodes?: string[];
  city?: string;
  state?: string;
  county?: string;
  take?: number;
}) {
  const { take, ...criteria } = params;
  return search({
    searchCriteria: { ...criteria, quickLists: ['tiredLandlord'] },
    options: { take: take ?? 25 },
  });
}

/** Inherited properties (probate / heir scenarios). */
export async function listInherited(params: {
  zip?: string;
  zipCodes?: string[];
  city?: string;
  state?: string;
  county?: string;
  take?: number;
}) {
  const { take, ...criteria } = params;
  return search({
    searchCriteria: { ...criteria, quickLists: ['inherited'] },
    options: { take: take ?? 25 },
  });
}

/** Expired listings (was on MLS, didn't sell, may be motivated). */
export async function listExpiredListings(params: {
  zip?: string;
  zipCodes?: string[];
  city?: string;
  state?: string;
  county?: string;
  take?: number;
}) {
  const { take, ...criteria } = params;
  return search({
    searchCriteria: { ...criteria, quickLists: ['expiredListing'] },
    options: { take: take ?? 25 },
  });
}

/* -------------------------------------------------------------------------- */
/*  Skip trace                                                                */
/* -------------------------------------------------------------------------- */

export interface BatchSkipTraceRequest {
  /** Array of properties to skip-trace. BatchData accepts up to 100 sync. */
  requests: Array<{
    propertyAddress?: BatchAddress;
    mailingAddress?: BatchAddress;
    name?: { first?: string; last?: string };
  }>;
  options?: {
    /** Exclude do-not-call numbers from the response. */
    excludeDoNotCall?: boolean;
    /** Skip the trace and just return cached data (cheaper). */
    skipTrace?: boolean;
  };
}

export interface BatchSkipTraceContact {
  phoneNumber?: string;
  phoneType?: 'mobile' | 'landline';
  doNotCall?: boolean;
  consentStatus?: string;
  email?: string;
}

export interface BatchSkipTraceResult {
  property?: BatchPropertyRecord;
  persons?: Array<{
    name?: { first?: string; last?: string };
    phones?: BatchSkipTraceContact[];
    emails?: BatchSkipTraceContact[];
  }>;
}

/**
 * Synchronous skip-trace. Up to 100 properties per call. For larger
 * batches use `skipTraceAsync`.
 */
export async function skipTrace(payload: BatchSkipTraceRequest) {
  return apiFetch<{ status?: any; results?: { persons?: BatchSkipTraceResult[] } }>(
    '/api/batchdata/property/skip-trace',
    { method: 'POST', body: JSON.stringify(payload) },
  );
}

/**
 * Async skip-trace for batches above the sync limit. Returns a job
 * handle the caller polls via BatchData's results endpoint.
 */
export async function skipTraceAsync(payload: BatchSkipTraceRequest) {
  return apiFetch<{ status?: any; results?: { jobId?: string } }>(
    '/api/batchdata/property/skip-trace/async',
    { method: 'POST', body: JSON.stringify(payload) },
  );
}

/* -------------------------------------------------------------------------- */
/*  Default export — flat namespace mirror of the PropData client             */
/* -------------------------------------------------------------------------- */

export const batchdata = {
  search,
  listAbsenteeOwners,
  listPreforeclosures,
  listHighEquity,
  listFreeAndClear,
  listTaxDelinquent,
  listVacant,
  listCashBuyers,
  listTiredLandlords,
  listInherited,
  listExpiredListings,
  skipTrace,
  skipTraceAsync,
};
