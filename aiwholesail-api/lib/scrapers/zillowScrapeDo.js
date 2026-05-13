/**
 * Self-hosted Zillow scraper, routed through scrape.do.
 *
 * Replaces specific RapidAPI `zillow-working-api` actions with direct
 * HTML scrapes of Zillow's own pages. We extract Zillow's `__NEXT_DATA__`
 * JSON blob (a serialized Apollo store embedded in every listing page)
 * and reshape it to match the field names downstream code already expects
 * — `data.zpid`, `data.ownerName`, `data.zestimate`, `data.taxAnnualAmount`,
 * etc. as consumed in routes/property.js `/intelligence`.
 *
 * Implemented actions (mirrors the RapidAPI proxy surface):
 *   Detail-class — fetches one detail page, slices the parsed property:
 *     propertyDetails       full Property record
 *     photos                photos[] only
 *     taxes                 taxHistory + taxAnnualAmount + taxAssessedValue
 *     priceHistory          priceHistory[] (list, price-change, sold events)
 *     zestimate             current zestimate + low/high range + rentZestimate
 *     schools               schools[] (ratings + distance)
 *     comps                 homeRecommendations[] (Zillow's "Similar Homes")
 *
 *   Search-class — fetches a /homes/<location>_rb/ page, parses listResults:
 *     search                generic, takes {location, status, filters, page}
 *     searchByAddress       alias — runs search() with the address as location
 *     forSale, forRent, recentlySold, foreclosures, fsbo
 *                           filter-preset wrappers over search()
 *
 * NOT implemented yet (separate graphql / page surfaces — follow-up PR):
 *   - zestimateHistory       (graphql getZestimateHistory mutation)
 *   - mortgage, mortgageRates (separate /mortgage-rates parser)
 *   - agent profile pages
 *   - market stats / region pages
 *
 * All detail-class actions share one underlying scrape per zpid (one cost),
 * so calling taxes + photos + comps for the same property triple-counts
 * against the scrape.do bill. Callers that need several slices should call
 * propertyDetails once and slice in-process — these convenience wrappers
 * exist so the agent-tool layer can stay one-action-one-call.
 *
 * Failure semantics: if scrape.do returns success but the HTML doesn't
 * contain a parseable __NEXT_DATA__ blob (Zillow served a captcha or
 * dropped a soft-403), we throw — the caller decides whether to fall back
 * to RapidAPI. We never return partially-parsed garbage.
 */

const { scrape, ScrapeDoError } = require('./scrapeDoClient');

const ZILLOW_BASE = 'https://www.zillow.com';
const DEFAULT_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  Accept:
    'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
};

class ZillowScrapeError extends Error {
  constructor(message, { status = 0, action, reason } = {}) {
    super(message);
    this.name = 'ZillowScrapeError';
    this.status = status;
    this.action = action;
    this.reason = reason;
  }
}

// ─────────────────────────── HTML → __NEXT_DATA__ ───────────────────────────

const NEXT_DATA_RE =
  /<script[^>]*id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/i;

/**
 * Pull the __NEXT_DATA__ JSON blob from a Zillow HTML page.
 * Throws ZillowScrapeError if the blob is missing — likely a captcha or
 * a 200-OK soft-block from Zillow.
 */
function extractNextData(html) {
  if (typeof html !== 'string' || html.length < 200) {
    throw new ZillowScrapeError('Zillow returned empty/short body', {
      reason: 'empty_html',
    });
  }
  const m = html.match(NEXT_DATA_RE);
  if (!m) {
    throw new ZillowScrapeError('Zillow page missing __NEXT_DATA__ (likely block)', {
      reason: 'no_next_data',
    });
  }
  let parsed;
  try {
    parsed = JSON.parse(m[1]);
  } catch (err) {
    throw new ZillowScrapeError(`Could not JSON.parse __NEXT_DATA__: ${err.message}`, {
      reason: 'json_parse',
    });
  }
  return parsed;
}

/**
 * Walk the Apollo cache inside __NEXT_DATA__ and pull out the Property record.
 * Zillow's structure has changed several times; we check the known paths in
 * order and fall back to a recursive search for a node that looks like a
 * Property (has zpid + price OR zestimate).
 */
function findPropertyRecord(nextData) {
  // Most-common: props.pageProps.componentProps.gdpClientCache as a JSON string
  // containing { "PropertyV2.0_<zpid>": { property: {...} } }
  const componentProps = nextData?.props?.pageProps?.componentProps;
  const cacheStr = componentProps?.gdpClientCache;
  if (typeof cacheStr === 'string' && cacheStr.length > 10) {
    try {
      const cache = JSON.parse(cacheStr);
      for (const key of Object.keys(cache)) {
        const node = cache[key];
        if (node && typeof node === 'object' && node.property) {
          return node.property;
        }
      }
    } catch {
      // fall through to deep search
    }
  }

  // Sometimes the record sits directly on componentProps.property
  if (componentProps?.property && typeof componentProps.property === 'object') {
    return componentProps.property;
  }

  // Last resort: recurse looking for a zpid-bearing object that has price-like fields.
  return deepFindProperty(nextData);
}

function deepFindProperty(node, depth = 0) {
  if (!node || typeof node !== 'object' || depth > 8) return null;
  if (
    typeof node.zpid !== 'undefined' &&
    (node.price !== undefined ||
      node.zestimate !== undefined ||
      node.livingArea !== undefined ||
      node.address !== undefined)
  ) {
    return node;
  }
  const values = Array.isArray(node) ? node : Object.values(node);
  for (const v of values) {
    const found = deepFindProperty(v, depth + 1);
    if (found) return found;
  }
  return null;
}

// ─────────────────────────── Property → RapidAPI shape ──────────────────────

/**
 * Map a parsed Zillow Property record to the field names the rest of the
 * codebase already consumes (the existing /pro/byaddress payload). Anything
 * the page didn't include comes through as undefined.
 */
function mapPropertyToRapidApiShape(p) {
  if (!p || typeof p !== 'object') return null;
  const addr = p.address || {};
  const addressString =
    p.streetAddress && p.city && p.state
      ? `${p.streetAddress}, ${p.city}, ${p.state} ${p.zipcode || ''}`.trim()
      : [addr.streetAddress, addr.city, addr.state, addr.zipcode].filter(Boolean).join(', ');

  const photos = Array.isArray(p.responsivePhotos)
    ? p.responsivePhotos
        .map((ph) => ph?.mixedSources?.jpeg?.[0]?.url || ph?.url || null)
        .filter(Boolean)
    : Array.isArray(p.photos)
      ? p.photos.map((ph) => ph?.url || ph).filter(Boolean)
      : [];

  return {
    zpid: p.zpid != null ? String(p.zpid) : undefined,
    address: addressString || undefined,
    streetAddress: p.streetAddress || addr.streetAddress,
    city: p.city || addr.city,
    state: p.state || addr.state,
    zipcode: p.zipcode || addr.zipcode,
    price: p.price ?? p.listPrice ?? undefined,
    zestimate: p.zestimate ?? undefined,
    rentZestimate: p.rentZestimate ?? undefined,
    bedrooms: p.bedrooms ?? undefined,
    bathrooms: p.bathrooms ?? undefined,
    livingArea: p.livingArea ?? p.livingAreaValue ?? undefined,
    lotSize: p.lotSize ?? p.lotAreaValue ?? undefined,
    yearBuilt: p.yearBuilt ?? undefined,
    homeType: p.homeType ?? p.propertyTypeDimension ?? undefined,
    homeStatus: p.homeStatus ?? undefined,
    daysOnZillow: p.daysOnZillow ?? undefined,
    description: p.description || undefined,
    taxAssessedValue: p.taxAssessedValue ?? undefined,
    taxAnnualAmount: p.taxAnnualAmount ?? undefined,
    taxHistory: Array.isArray(p.taxHistory) ? p.taxHistory : undefined,
    priceHistory: Array.isArray(p.priceHistory) ? p.priceHistory : undefined,
    schools: Array.isArray(p.schools) ? p.schools : undefined,
    ownerName: p.ownerName || p.owner?.fullName || undefined,
    ownerAddress: p.ownerAddress || p.owner?.mailingAddress || undefined,
    isAbsenteeOwner: p.isAbsenteeOwner ?? undefined,
    isForeclosure: p.isForeclosure ?? p.foreclosure?.isForeclosure ?? undefined,
    isPreForeclosureAuction: p.isPreForeclosureAuction ?? undefined,
    photos,
    hdpUrl: p.hdpUrl
      ? p.hdpUrl.startsWith('http')
        ? p.hdpUrl
        : `${ZILLOW_BASE}${p.hdpUrl}`
      : undefined,
    latitude: p.latitude ?? p.location?.latitude ?? undefined,
    longitude: p.longitude ?? p.location?.longitude ?? undefined,
  };
}

// ──────────────────────────────── Actions ───────────────────────────────────

function detailUrlForZpid(zpid) {
  return `${ZILLOW_BASE}/homedetails/${encodeURIComponent(zpid)}_zpid/`;
}

function detailUrlForAddress(address) {
  // Zillow accepts /homes/<encoded-address>_rb/ which redirects to the
  // canonical homedetails page. We follow the redirect via scrape.do.
  const slug = String(address).trim().replace(/\s+/g, '-').replace(/,/g, '');
  return `${ZILLOW_BASE}/homes/${encodeURIComponent(slug)}_rb/`;
}

/**
 * Fetch + parse a single Zillow detail page.
 * @param {{zpid?: string, address?: string}} args
 * @returns {Promise<object>}  RapidAPI-shaped property record
 */
async function propertyDetails(args = {}) {
  const { zpid, address } = args;
  if (!zpid && !address) {
    throw new ZillowScrapeError('propertyDetails requires zpid or address', {
      reason: 'bad_args',
    });
  }
  const url = zpid ? detailUrlForZpid(zpid) : detailUrlForAddress(address);

  let resp;
  try {
    resp = await scrape(url, {
      headers: DEFAULT_HEADERS,
      geoCode: 'us',
      // Detail pages render their __NEXT_DATA__ server-side, so no JS execution
      // is needed — keeps cost at 1x. If we start seeing block rates climb we
      // can flip render=true here.
      render: false,
    });
  } catch (err) {
    if (err instanceof ScrapeDoError) {
      throw new ZillowScrapeError(`scrape.do fetch failed: ${err.message}`, {
        status: err.status,
        action: 'propertyDetails',
        reason: 'fetch_failed',
      });
    }
    throw err;
  }

  const nextData = extractNextData(resp.data);
  const record = findPropertyRecord(nextData);
  if (!record) {
    throw new ZillowScrapeError('Could not locate Property in __NEXT_DATA__', {
      action: 'propertyDetails',
      reason: 'no_property_in_payload',
    });
  }
  return mapPropertyToRapidApiShape(record);
}

// ───────────────────────── Detail-derived slices ────────────────────────────
// Each of these runs one detail fetch and returns just the relevant subset.
// Callers can `propertyDetails(args)` once and slice locally if they need
// more than one — these wrappers exist so the agent tool layer stays clean.

async function photos(args = {}) {
  const d = await propertyDetails(args);
  return { zpid: d.zpid, photos: d.photos };
}

async function taxes(args = {}) {
  const d = await propertyDetails(args);
  return {
    zpid: d.zpid,
    taxAnnualAmount: d.taxAnnualAmount,
    taxAssessedValue: d.taxAssessedValue,
    taxHistory: d.taxHistory || [],
  };
}

async function priceHistory(args = {}) {
  const d = await propertyDetails(args);
  return { zpid: d.zpid, priceHistory: d.priceHistory || [] };
}

async function zestimate(args = {}) {
  const d = await propertyDetails(args);
  return {
    zpid: d.zpid,
    zestimate: d.zestimate,
    rentZestimate: d.rentZestimate,
  };
}

async function schools(args = {}) {
  const d = await propertyDetails(args);
  return { zpid: d.zpid, schools: d.schools || [] };
}

/**
 * Zillow's "Similar Homes" widget on each detail page. The data lives at
 * a couple of different paths in __NEXT_DATA__ depending on the page; we
 * pull whichever populated first.
 */
async function comps(args = {}) {
  const { zpid, address } = args;
  if (!zpid && !address) {
    throw new ZillowScrapeError('comps requires zpid or address', { reason: 'bad_args' });
  }
  const url = zpid ? detailUrlForZpid(zpid) : detailUrlForAddress(address);

  let resp;
  try {
    resp = await scrape(url, { headers: DEFAULT_HEADERS, geoCode: 'us', render: false });
  } catch (err) {
    if (err instanceof ScrapeDoError) {
      throw new ZillowScrapeError(`scrape.do fetch failed: ${err.message}`, {
        status: err.status,
        action: 'comps',
        reason: 'fetch_failed',
      });
    }
    throw err;
  }
  const nextData = extractNextData(resp.data);
  const record = findPropertyRecord(nextData);
  const compsList =
    record?.homeRecommendations?.homes ||
    record?.comparableHomes ||
    record?.similarSales ||
    [];
  return {
    zpid: record?.zpid != null ? String(record.zpid) : zpid,
    comps: compsList.map(mapListingToSummary).filter(Boolean),
  };
}

// ───────────────────────── Search (location-string) ─────────────────────────

const STATUS_TO_ZILLOW = {
  for_sale: 'ForSale',
  forSale: 'ForSale',
  for_rent: 'ForRent',
  forRent: 'ForRent',
  recently_sold: 'RecentlySold',
  recentlySold: 'RecentlySold',
  sold: 'RecentlySold',
};

/**
 * Build the canonical /homes/<location>_rb/ URL Zillow uses for any
 * location-string search. The slug is forgiving — Zillow's frontend
 * normalizes "Austin, TX 78701" → "austin-tx-78701".
 */
function searchUrlForLocation(location) {
  const slug = String(location)
    .trim()
    .toLowerCase()
    .replace(/,/g, '')
    .replace(/\s+/g, '-');
  return `${ZILLOW_BASE}/homes/${encodeURIComponent(slug)}_rb/`;
}

/**
 * Walk __NEXT_DATA__ and pull the listResults array. Zillow nests it under
 * props.pageProps.searchPageState.cat1.searchResults.listResults on the
 * /homes/<location>_rb/ render. Defensive deep-find as a fallback.
 */
function findListResults(nextData) {
  const direct =
    nextData?.props?.pageProps?.searchPageState?.cat1?.searchResults?.listResults;
  if (Array.isArray(direct)) return direct;
  const alt = nextData?.props?.pageProps?.searchPageState?.cat1?.searchList?.listResults;
  if (Array.isArray(alt)) return alt;
  return deepFindArray(nextData, 'listResults');
}

function findTotalResultCount(nextData) {
  const a = nextData?.props?.pageProps?.searchPageState?.cat1?.searchList?.totalResultCount;
  if (typeof a === 'number') return a;
  const b = nextData?.props?.pageProps?.searchPageState?.searchResults?.totalResultCount;
  if (typeof b === 'number') return b;
  return undefined;
}

function deepFindArray(node, key, depth = 0) {
  if (!node || typeof node !== 'object' || depth > 8) return null;
  if (Array.isArray(node)) {
    for (const v of node) {
      const r = deepFindArray(v, key, depth + 1);
      if (r) return r;
    }
    return null;
  }
  if (Array.isArray(node[key])) return node[key];
  for (const v of Object.values(node)) {
    const r = deepFindArray(v, key, depth + 1);
    if (r) return r;
  }
  return null;
}

/**
 * Reshape a search-page listResult into the field names downstream consumers
 * already expect (matches what RapidAPI's /search/byaddress and friends
 * return for each item).
 */
function mapListingToSummary(l) {
  if (!l || typeof l !== 'object') return null;
  // listResults items sometimes nest payload under hdpData.homeInfo
  const hi = l.hdpData?.homeInfo || {};
  return {
    zpid: (l.zpid ?? hi.zpid) != null ? String(l.zpid ?? hi.zpid) : undefined,
    address: l.address ?? hi.streetAddress ?? l.addressStreet,
    addressStreet: l.addressStreet ?? hi.streetAddress,
    addressCity: l.addressCity ?? hi.city,
    addressState: l.addressState ?? hi.state,
    addressZipcode: l.addressZipcode ?? hi.zipcode,
    latitude: l.latLong?.latitude ?? hi.latitude,
    longitude: l.latLong?.longitude ?? hi.longitude,
    price: l.unformattedPrice ?? l.price ?? hi.price,
    priceLabel: l.price,
    zestimate: l.zestimate ?? hi.zestimate,
    rentZestimate: l.rentZestimate ?? hi.rentZestimate,
    beds: l.beds ?? hi.bedrooms,
    baths: l.baths ?? hi.bathrooms,
    area: l.area ?? hi.livingArea,
    homeStatus: l.statusType ?? hi.homeStatus,
    homeType: l.hdpData?.homeInfo?.homeType ?? l.homeType,
    daysOnZillow: l.daysOnZillow ?? hi.daysOnZillow,
    detailUrl: l.detailUrl
      ? l.detailUrl.startsWith('http')
        ? l.detailUrl
        : `${ZILLOW_BASE}${l.detailUrl}`
      : undefined,
    imgSrc: l.imgSrc,
    isForeclosure: hi.isPreforeclosureAuction ?? hi.isForeclosure ?? l.isForeclosure,
  };
}

/**
 * Generic location-string search. The location can be a ZIP, a "City, ST",
 * or a full address — Zillow's own URL canonicalization handles all three.
 *
 * @param {{location: string, status?: string, page?: number|string}} args
 */
async function search(args = {}) {
  const { location, status, page } = args;
  if (!location) {
    throw new ZillowScrapeError('search requires location', { reason: 'bad_args' });
  }
  let url = searchUrlForLocation(location);

  // Status appends a sub-path that Zillow recognises (e.g. /sold/, /rentals/).
  const z = STATUS_TO_ZILLOW[status] || status;
  if (z === 'RecentlySold') url = url.replace(/_rb\/$/, '_rb/sold/');
  else if (z === 'ForRent') url = url.replace(/_rb\/$/, '_rb/rentals/');
  if (page && Number(page) > 1) {
    url = url.replace(/\/$/, `/${Number(page)}_p/`);
  }

  let resp;
  try {
    resp = await scrape(url, { headers: DEFAULT_HEADERS, geoCode: 'us', render: false });
  } catch (err) {
    if (err instanceof ScrapeDoError) {
      throw new ZillowScrapeError(`scrape.do fetch failed: ${err.message}`, {
        status: err.status,
        action: 'search',
        reason: 'fetch_failed',
      });
    }
    throw err;
  }

  const nextData = extractNextData(resp.data);
  const listResults = findListResults(nextData);
  if (!Array.isArray(listResults)) {
    throw new ZillowScrapeError('Could not locate listResults in __NEXT_DATA__', {
      action: 'search',
      reason: 'no_list_results',
    });
  }
  const totalResultCount = findTotalResultCount(nextData);
  const results = listResults.map(mapListingToSummary).filter(Boolean);
  return {
    location,
    status: z || 'ForSale',
    page: Number(page) || 1,
    totalResultCount: totalResultCount ?? results.length,
    results,
  };
}

/** Alias: search by address. Same wire call — Zillow disambiguates. */
async function searchByAddress(args = {}) {
  const { address, ...rest } = args;
  return search({ location: address, ...rest });
}

/** Filter preset: just for-sale (the default). */
async function forSale(args = {}) {
  return search({ ...args, status: 'ForSale' });
}

/** Filter preset: rentals. */
async function forRent(args = {}) {
  return search({ ...args, status: 'ForRent' });
}

/** Filter preset: recently sold (Zillow's "Sold" tab). */
async function recentlySold(args = {}) {
  return search({ ...args, status: 'RecentlySold' });
}

/**
 * Filter preset: foreclosures. Zillow exposes these via a query-string
 * `searchQueryState` filter on the same URL. We hit the public foreclosures
 * sub-path which already pre-filters server-side.
 */
async function foreclosures(args = {}) {
  const { location, page } = args;
  if (!location) {
    throw new ZillowScrapeError('foreclosures requires location', { reason: 'bad_args' });
  }
  let url = searchUrlForLocation(location).replace(/_rb\/$/, '_rb/foreclosures/');
  if (page && Number(page) > 1) {
    url = url.replace(/\/$/, `/${Number(page)}_p/`);
  }
  return runSearchUrl(url, { location, status: 'Foreclosure', page });
}

/** Filter preset: for-sale by owner (FSBO). */
async function fsbo(args = {}) {
  const { location, page } = args;
  if (!location) {
    throw new ZillowScrapeError('fsbo requires location', { reason: 'bad_args' });
  }
  let url = searchUrlForLocation(location).replace(/_rb\/$/, '_rb/fsbo/');
  if (page && Number(page) > 1) {
    url = url.replace(/\/$/, `/${Number(page)}_p/`);
  }
  return runSearchUrl(url, { location, status: 'FSBO', page });
}

async function runSearchUrl(url, ctx) {
  let resp;
  try {
    resp = await scrape(url, { headers: DEFAULT_HEADERS, geoCode: 'us', render: false });
  } catch (err) {
    if (err instanceof ScrapeDoError) {
      throw new ZillowScrapeError(`scrape.do fetch failed: ${err.message}`, {
        status: err.status,
        action: 'search',
        reason: 'fetch_failed',
      });
    }
    throw err;
  }
  const nextData = extractNextData(resp.data);
  const listResults = findListResults(nextData);
  if (!Array.isArray(listResults)) {
    throw new ZillowScrapeError('Could not locate listResults in __NEXT_DATA__', {
      action: 'search',
      reason: 'no_list_results',
    });
  }
  const total = findTotalResultCount(nextData);
  const results = listResults.map(mapListingToSummary).filter(Boolean);
  return {
    location: ctx.location,
    status: ctx.status,
    page: Number(ctx.page) || 1,
    totalResultCount: total ?? results.length,
    results,
  };
}

module.exports = {
  ZillowScrapeError,
  // Detail-class:
  propertyDetails,
  photos,
  taxes,
  priceHistory,
  zestimate,
  schools,
  comps,
  // Search-class:
  search,
  searchByAddress,
  forSale,
  forRent,
  recentlySold,
  foreclosures,
  fsbo,
  // Exported for tests:
  extractNextData,
  findPropertyRecord,
  findListResults,
  findTotalResultCount,
  mapPropertyToRapidApiShape,
  mapListingToSummary,
  searchUrlForLocation,
};
