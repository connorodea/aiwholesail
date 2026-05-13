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
 *   Coordinate / URL search variants:
 *     searchByCoordinates   {lat, lng, radius_mi} → builds searchQueryState mapBounds
 *     searchByBounds        {sw_lat, sw_lng, ne_lat, ne_lng} → direct rectangle
 *     searchByUrl           accepts a full Zillow URL (validated to www.zillow.com)
 *
 *   Value / agent / market / mortgage:
 *     zestimateHistory      time-series snapshots from homeValueChartData on
 *                           the detail page
 *     mortgageRates         scrapes /mortgage-rates/<zip|state> page
 *     mortgageCalculator    pure math — no network call (PMT formula)
 *     agentProfile          scrapes /profile/<slug>/ page
 *     marketStats           scrapes /<region>/home-values/ page
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
 *
 * Compound-case names need a hyphen at the internal case-break BEFORE
 * lowercasing. Zillow's canonical slugs:
 *   "DeKalb County, AL"  → "de-kalb-county-al"  (NOT "dekalb-county-al")
 *   "McKinney, TX"       → "mc-kinney-tx"
 *   "LaGrange, GA"       → "la-grange-ga"
 * Without the case-break insertion, the page renders but the search
 * results widget is absent — Zillow doesn't recognise the location and
 * scraping fails with `no_list_results`.
 *
 * Discovered live on 2026-05-13 against DeKalb County, AL (real customer
 * search). The `[a-z][A-Z]` regex handles all the common "MacXxxx"
 * compound-name patterns. Acronyms like "USA" with no internal lowercase
 * are unaffected.
 */
function searchUrlForLocation(location) {
  const slug = String(location)
    .trim()
    .replace(/([a-z])([A-Z])/g, '$1-$2')
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
 *
 * `homeRecommendations.homes` items (the comps shape) carry top-level
 * latitude/longitude rather than a latLong object, so we accept both. The
 * map view in the frontend depends on these being populated.
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
    latitude:
      l.latLong?.latitude ??
      hi.latitude ??
      l.latitude ??
      (typeof l.lat === 'number' ? l.lat : undefined),
    longitude:
      l.latLong?.longitude ??
      hi.longitude ??
      l.longitude ??
      (typeof l.lng === 'number' ? l.lng : undefined),
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
  // Pagination shape that the FRONTEND (src/lib/zillow-api.ts performSearch)
  // expects: `total_pages` + `total_results` mirror the RapidAPI/standalone-
  // proxy shape so the same iteration loop works regardless of which backend
  // answered. Without these keys, performSearch defaults to 1 page and the
  // user sees only the first ~40 of (potentially) hundreds of listings.
  //
  // Page-size derivation: prefer the actual results.length on this page
  // (Zillow may return 40-41 depending on listing density) over a hardcoded
  // constant. Falls back to 40 (Zillow's canonical page size) when the
  // current page is empty.
  const total = totalResultCount ?? results.length;
  const pageSize = results.length > 0 ? results.length : 40;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  return {
    location,
    status: z || 'ForSale',
    page: Number(page) || 1,
    totalResultCount: total,
    // Frontend-compat pagination keys — additive, original keys preserved.
    total_results: total,
    total_pages: totalPages,
    results,
    // Frontend processPropertyData() tries multiple keys (`searchResults`,
    // `props`, `results`, `listings`, ...). `results` is already in the list,
    // so no alias needed there.
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

// ───────────────────────── Coordinate / bounds search ──────────────────────

/**
 * Build a searchQueryState JSON blob that Zillow accepts as a `searchQueryState`
 * URL-parameter on /homes/. The shape is what Zillow's own frontend sends —
 * mapBounds with N/S/E/W floats, plus a regionSelection list (which we leave
 * empty for free-form coordinate searches).
 *
 * The pagination + filter sub-keys mirror what Zillow itself emits when you
 * pan the map manually — pretty stable as of 2026-04 but liable to drift.
 *
 * @param {{north: number, south: number, east: number, west: number}} bounds
 * @param {object} [filters]
 *   - status: 'forSale' | 'forRent' | 'recentlySold' | 'foreclosures' | 'fsbo'
 *   - bedsMin / bedsMax / bathsMin / bathsMax / priceMin / priceMax
 * @returns {string}  URL-encoded JSON ready for ?searchQueryState=
 */
function buildSearchQueryState(bounds, filters = {}) {
  const filterState = {};
  if (filters.bedsMin != null) filterState.beds = { min: Number(filters.bedsMin) };
  if (filters.bedsMax != null) {
    filterState.beds = { ...(filterState.beds || {}), max: Number(filters.bedsMax) };
  }
  if (filters.bathsMin != null) filterState.baths = { min: Number(filters.bathsMin) };
  if (filters.priceMin != null || filters.priceMax != null) {
    filterState.price = {};
    if (filters.priceMin != null) filterState.price.min = Number(filters.priceMin);
    if (filters.priceMax != null) filterState.price.max = Number(filters.priceMax);
  }
  const status = filters.status;
  if (status === 'recentlySold' || status === 'RecentlySold' || status === 'sold') {
    filterState.isRecentlySold = { value: true };
    filterState.isForSaleByAgent = { value: false };
    filterState.isForSaleByOwner = { value: false };
    filterState.isNewConstruction = { value: false };
    filterState.isComingSoon = { value: false };
    filterState.isAuction = { value: false };
    filterState.isForSaleForeclosure = { value: false };
  } else if (status === 'forRent' || status === 'ForRent') {
    filterState.isForRent = { value: true };
    filterState.isForSaleByAgent = { value: false };
    filterState.isForSaleByOwner = { value: false };
  } else if (status === 'fsbo' || status === 'FSBO') {
    filterState.isForSaleByOwner = { value: true };
    filterState.isForSaleByAgent = { value: false };
  } else if (status === 'foreclosures' || status === 'Foreclosure') {
    filterState.isForSaleForeclosure = { value: true };
  }

  return JSON.stringify({
    pagination: {},
    isMapVisible: true,
    mapBounds: {
      north: Number(bounds.north),
      south: Number(bounds.south),
      east: Number(bounds.east),
      west: Number(bounds.west),
    },
    filterState,
    isListVisible: true,
  });
}

/**
 * One degree of latitude ≈ 69.0 statute miles (constant). Longitude varies
 * with latitude (cos approximation). We use these to expand a centre point
 * by a radius-in-miles into N/S/E/W lat/lng bounds.
 */
function boundsFromCenterRadius(lat, lng, radiusMi) {
  const r = Math.max(0.01, Number(radiusMi));
  const latDelta = r / 69.0;
  const cos = Math.max(0.0001, Math.cos((Number(lat) * Math.PI) / 180));
  const lngDelta = r / (69.0 * cos);
  return {
    north: Number(lat) + latDelta,
    south: Number(lat) - latDelta,
    east: Number(lng) + lngDelta,
    west: Number(lng) - lngDelta,
  };
}

async function runSearchQueryState(searchQueryState, ctx) {
  const url = `${ZILLOW_BASE}/homes/?searchQueryState=${encodeURIComponent(searchQueryState)}`;
  let resp;
  try {
    resp = await scrape(url, { headers: DEFAULT_HEADERS, geoCode: 'us', render: false });
  } catch (err) {
    if (err instanceof ScrapeDoError) {
      throw new ZillowScrapeError(`scrape.do fetch failed: ${err.message}`, {
        status: err.status,
        action: ctx.action || 'searchByCoordinates',
        reason: 'fetch_failed',
      });
    }
    throw err;
  }
  const nextData = extractNextData(resp.data);
  const listResults = findListResults(nextData);
  if (!Array.isArray(listResults)) {
    throw new ZillowScrapeError('Could not locate listResults in __NEXT_DATA__', {
      action: ctx.action || 'searchByCoordinates',
      reason: 'no_list_results',
    });
  }
  const total = findTotalResultCount(nextData);
  const results = listResults.map(mapListingToSummary).filter(Boolean);
  return {
    ...ctx.echo,
    totalResultCount: total ?? results.length,
    results,
  };
}

/**
 * Search by centre + radius. radius_mi defaults to 1 if missing.
 *
 * @param {{lat: number, lng: number, radius_mi?: number, status?: string,
 *           bedsMin?: number, bedsMax?: number, bathsMin?: number,
 *           priceMin?: number, priceMax?: number}} args
 */
async function searchByCoordinates(args = {}) {
  const { lat, lng, radius_mi: radiusMi = 1 } = args;
  if (lat == null || lng == null || !Number.isFinite(Number(lat)) || !Number.isFinite(Number(lng))) {
    throw new ZillowScrapeError('searchByCoordinates requires numeric lat + lng', {
      reason: 'bad_args',
    });
  }
  const bounds = boundsFromCenterRadius(Number(lat), Number(lng), radiusMi);
  const sqs = buildSearchQueryState(bounds, args);
  return runSearchQueryState(sqs, {
    action: 'searchByCoordinates',
    echo: { lat: Number(lat), lng: Number(lng), radiusMi: Number(radiusMi), bounds },
  });
}

/**
 * Search by an explicit lat/lng rectangle. Useful when the frontend already
 * has the viewport bounds (e.g. user pans the map) and we don't want to
 * round-trip through a centre+radius approximation.
 *
 * @param {{sw_lat: number, sw_lng: number, ne_lat: number, ne_lng: number,
 *           status?: string, bedsMin?: number, ...}} args
 */
async function searchByBounds(args = {}) {
  const { sw_lat: swLat, sw_lng: swLng, ne_lat: neLat, ne_lng: neLng } = args;
  const nums = [swLat, swLng, neLat, neLng];
  if (nums.some((n) => n == null || !Number.isFinite(Number(n)))) {
    throw new ZillowScrapeError(
      'searchByBounds requires numeric sw_lat, sw_lng, ne_lat, ne_lng',
      { reason: 'bad_args' }
    );
  }
  const bounds = {
    south: Number(swLat),
    west: Number(swLng),
    north: Number(neLat),
    east: Number(neLng),
  };
  // Quick sanity: NE corner must actually be NE of SW (Zillow returns 0
  // results for inverted rectangles — fail fast so the caller sees why).
  if (bounds.north <= bounds.south || bounds.east <= bounds.west) {
    throw new ZillowScrapeError('searchByBounds: NE corner must be north-east of SW', {
      reason: 'bad_args',
    });
  }
  const sqs = buildSearchQueryState(bounds, args);
  return runSearchQueryState(sqs, {
    action: 'searchByBounds',
    echo: { bounds },
  });
}

/**
 * Search by pasting a full Zillow URL — typically a saved-search URL the
 * user copy-pasted from their browser. Host must be www.zillow.com; we don't
 * follow open redirects.
 *
 * SSRF guard: we parse the URL with the WHATWG URL parser and only accept
 * https + the canonical Zillow hostname. Any other host throws bad_args so
 * a hostile caller can't pivot scrape.do at an internal address.
 *
 * @param {string|{url: string}} arg
 */
async function searchByUrl(arg) {
  const raw = typeof arg === 'string' ? arg : arg && arg.url;
  if (!raw || typeof raw !== 'string') {
    throw new ZillowScrapeError('searchByUrl requires a url string', { reason: 'bad_args' });
  }
  let parsed;
  try {
    parsed = new URL(raw);
  } catch {
    throw new ZillowScrapeError(`searchByUrl: invalid URL: ${raw}`, { reason: 'bad_args' });
  }
  if (parsed.protocol !== 'https:') {
    throw new ZillowScrapeError('searchByUrl: only https URLs allowed', { reason: 'bad_args' });
  }
  if (parsed.hostname !== 'www.zillow.com') {
    throw new ZillowScrapeError(
      `searchByUrl: hostname must be www.zillow.com (got ${parsed.hostname})`,
      { reason: 'bad_args' }
    );
  }
  let resp;
  try {
    resp = await scrape(parsed.toString(), {
      headers: DEFAULT_HEADERS,
      geoCode: 'us',
      render: false,
    });
  } catch (err) {
    if (err instanceof ScrapeDoError) {
      throw new ZillowScrapeError(`scrape.do fetch failed: ${err.message}`, {
        status: err.status,
        action: 'searchByUrl',
        reason: 'fetch_failed',
      });
    }
    throw err;
  }
  const nextData = extractNextData(resp.data);
  const listResults = findListResults(nextData);
  if (!Array.isArray(listResults)) {
    throw new ZillowScrapeError('Could not locate listResults in __NEXT_DATA__', {
      action: 'searchByUrl',
      reason: 'no_list_results',
    });
  }
  const total = findTotalResultCount(nextData);
  const results = listResults.map(mapListingToSummary).filter(Boolean);
  return {
    url: parsed.toString(),
    totalResultCount: total ?? results.length,
    results,
  };
}

// ───────────────────────── Zestimate history ─────────────────────────

/**
 * Walk __NEXT_DATA__ for the `homeValueChartData` array that Zillow embeds on
 * detail pages. It's a series of `{ points: [{ x: timestamp_ms, y: usd }] }`
 * blocks keyed by `name` (e.g. "This home", "Local"). We return the property's
 * own series, normalised to `{ date: ISO-string, value: number }`.
 */
function findZestimateHistory(record) {
  const candidates = [
    record?.homeValueChartData,
    record?.zestimateHistory,
    record?.historicalZestimates,
  ].filter(Boolean);
  for (const c of candidates) {
    if (!Array.isArray(c)) continue;
    // If c[0].points exists, that's the canonical chart shape
    const thisHome = c.find((s) => s && (s.name === 'This home' || s.name === 'This Home')) || c[0];
    if (thisHome && Array.isArray(thisHome.points)) {
      return thisHome.points
        .filter((p) => p && p.x != null && p.y != null)
        .map((p) => ({
          date: new Date(Number(p.x)).toISOString(),
          value: Number(p.y),
        }));
    }
    // Fallback: a flat array of {date, value}
    if (c[0] && (c[0].date || c[0].timestamp)) {
      return c
        .filter((p) => p && (p.value != null || p.zestimate != null))
        .map((p) => ({
          date: p.date || new Date(Number(p.timestamp)).toISOString(),
          value: Number(p.value ?? p.zestimate),
        }));
    }
  }
  return null;
}

/**
 * Time-series of zestimate snapshots from the detail page's homeValueChartData.
 * Throws ZillowScrapeError('no_history_in_payload') if the property doesn't
 * have a chart embedded — the caller can fall back to RapidAPI.
 *
 * @param {{zpid?: string, address?: string}} args
 */
async function zestimateHistory(args = {}) {
  const { zpid, address } = args;
  if (!zpid && !address) {
    throw new ZillowScrapeError('zestimateHistory requires zpid or address', {
      reason: 'bad_args',
    });
  }
  const url = zpid ? detailUrlForZpid(zpid) : detailUrlForAddress(address);
  let resp;
  try {
    resp = await scrape(url, { headers: DEFAULT_HEADERS, geoCode: 'us', render: false });
  } catch (err) {
    if (err instanceof ScrapeDoError) {
      throw new ZillowScrapeError(`scrape.do fetch failed: ${err.message}`, {
        status: err.status,
        action: 'zestimateHistory',
        reason: 'fetch_failed',
      });
    }
    throw err;
  }
  const nextData = extractNextData(resp.data);
  const record = findPropertyRecord(nextData);
  if (!record) {
    throw new ZillowScrapeError('Could not locate Property in __NEXT_DATA__', {
      action: 'zestimateHistory',
      reason: 'no_property_in_payload',
    });
  }
  const series = findZestimateHistory(record);
  if (!series || series.length === 0) {
    throw new ZillowScrapeError('No homeValueChartData on detail page', {
      action: 'zestimateHistory',
      reason: 'no_history_in_payload',
    });
  }
  return {
    zpid: record.zpid != null ? String(record.zpid) : zpid,
    history: series,
  };
}

// ───────────────────────── Mortgage rates / calculator ──────────────────

function mortgageRatesUrlForZip(zip) {
  return `${ZILLOW_BASE}/mortgage-rates/${encodeURIComponent(String(zip))}`;
}

function mortgageRatesUrlForState(state) {
  return `${ZILLOW_BASE}/mortgage-rates/${encodeURIComponent(String(state).toLowerCase())}`;
}

/**
 * Defensive walk for mortgage-rate rows in __NEXT_DATA__. Zillow has shipped
 * three slightly different shapes here over the past year; we accept any of
 * them and normalise to a flat row.
 */
function findMortgageRates(nextData) {
  const candidates = [
    nextData?.props?.pageProps?.componentProps?.rateTable?.lenderQuotes,
    nextData?.props?.pageProps?.componentProps?.rates,
    nextData?.props?.pageProps?.componentProps?.lenders,
    nextData?.props?.pageProps?.rates,
    nextData?.props?.pageProps?.lenderQuotes,
  ];
  for (const c of candidates) {
    if (Array.isArray(c) && c.length > 0) return c;
  }
  return deepFindArray(nextData, 'lenderQuotes') || deepFindArray(nextData, 'rates');
}

function normalizeMortgageRate(r) {
  if (!r || typeof r !== 'object') return null;
  return {
    lender: r.lenderName || r.lender || r.name || undefined,
    nmlsId: r.nmlsId || r.nmls || undefined,
    apr: r.apr != null ? Number(r.apr) : undefined,
    rate: r.rate != null ? Number(r.rate) : r.interestRate != null ? Number(r.interestRate) : undefined,
    points: r.points != null ? Number(r.points) : undefined,
    monthlyPayment:
      r.monthlyPayment != null ? Number(r.monthlyPayment) : undefined,
    feesAmount: r.fees != null ? Number(r.fees) : r.totalFees != null ? Number(r.totalFees) : undefined,
    loanType: r.loanType || r.programName || undefined,
    loanTerm: r.loanTerm || r.term || undefined,
  };
}

/**
 * Mortgage rates for a ZIP (preferred) or a state code. Returns an array of
 * lender quotes parsed from /mortgage-rates/<location>.
 *
 * @param {{zip?: string|number, state?: string, loanType?: string, term?: number}} args
 */
async function mortgageRates(args = {}) {
  const { zip, state } = args;
  if (!zip && !state) {
    throw new ZillowScrapeError('mortgageRates requires zip or state', {
      reason: 'bad_args',
    });
  }
  const url = zip ? mortgageRatesUrlForZip(zip) : mortgageRatesUrlForState(state);
  let resp;
  try {
    // /mortgage-rates/* is heavily protected and the default residential
    // pool returns 502 on most attempts (observed 2026-05). The premium
    // pool (super=true) gets through. Pricing is 2x the standard call —
    // acceptable for a marketing-page surface that we cache aggressively
    // upstream.
    resp = await scrape(url, {
      headers: DEFAULT_HEADERS,
      geoCode: 'us',
      render: false,
      super: true,
      timeoutMs: 60_000,
    });
  } catch (err) {
    if (err instanceof ScrapeDoError) {
      throw new ZillowScrapeError(`scrape.do fetch failed: ${err.message}`, {
        status: err.status,
        action: 'mortgageRates',
        reason: 'fetch_failed',
      });
    }
    throw err;
  }
  const nextData = extractNextData(resp.data);
  const raw = findMortgageRates(nextData);
  if (!Array.isArray(raw) || raw.length === 0) {
    throw new ZillowScrapeError('No mortgage rate rows in __NEXT_DATA__', {
      action: 'mortgageRates',
      reason: 'no_rates_in_payload',
    });
  }
  const rates = raw.map(normalizeMortgageRate).filter(Boolean);
  return {
    zip: zip != null ? String(zip) : undefined,
    state: state || undefined,
    loanType: args.loanType,
    term: args.term,
    rates,
  };
}

/**
 * Pure-math mortgage calculator — no scrape.do round-trip. PMT formula on
 * (price - down) over `term` years at `rate`% nominal annual. Returns the
 * monthly payment plus rolled-up totals; if `args.schedule` is true we also
 * return a month-by-month amortization array (can be heavy — opt-in only).
 *
 * Caller-supplied numbers are coerced to Number. We don't enforce sanity
 * limits (someone might ask for a 100-year loan at 0%) but we throw if any
 * input would produce NaN / Infinity.
 *
 * @param {{price: number, down?: number, term: number, rate: number,
 *           schedule?: boolean}} args
 */
function mortgageCalculator(args = {}) {
  const price = Number(args.price);
  const down = Number(args.down || 0);
  const termYears = Number(args.term);
  const annualRatePct = Number(args.rate);
  if (
    !Number.isFinite(price) ||
    !Number.isFinite(down) ||
    !Number.isFinite(termYears) ||
    !Number.isFinite(annualRatePct) ||
    price <= 0 ||
    termYears <= 0 ||
    annualRatePct < 0
  ) {
    throw new ZillowScrapeError(
      'mortgageCalculator requires positive numeric price, term, and rate (down optional)',
      { reason: 'bad_args' }
    );
  }
  const principal = Math.max(0, price - down);
  const n = Math.round(termYears * 12);
  const monthlyRate = annualRatePct / 100 / 12;

  let monthlyPayment;
  if (monthlyRate === 0) {
    monthlyPayment = principal / n;
  } else {
    const factor = Math.pow(1 + monthlyRate, n);
    monthlyPayment = (principal * monthlyRate * factor) / (factor - 1);
  }
  const totalCost = monthlyPayment * n;
  const totalInterest = totalCost - principal;

  let schedule;
  if (args.schedule) {
    schedule = [];
    let remaining = principal;
    for (let i = 1; i <= n; i += 1) {
      const interest = remaining * monthlyRate;
      const princ = monthlyPayment - interest;
      remaining = Math.max(0, remaining - princ);
      schedule.push({
        month: i,
        payment: round2(monthlyPayment),
        principal: round2(princ),
        interest: round2(interest),
        balance: round2(remaining),
      });
    }
  }

  return {
    principal: round2(principal),
    monthlyPayment: round2(monthlyPayment),
    totalInterest: round2(totalInterest),
    totalCost: round2(totalCost),
    months: n,
    ...(schedule ? { schedule } : {}),
  };
}

function round2(n) {
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100) / 100;
}

// ───────────────────────── Agent profile ─────────────────────────

function agentProfileUrl(slug) {
  return `${ZILLOW_BASE}/profile/${encodeURIComponent(String(slug))}/`;
}

/**
 * Walk __NEXT_DATA__ for an agentProfile-shaped node. Zillow has used both
 * `agentProfile` (PT-built) and `agent` (Apollo) over the past year; we
 * accept both and merge the meaningful keys.
 */
function findAgentProfile(nextData) {
  const pp = nextData?.props?.pageProps;
  const direct = pp?.agentProfile || pp?.agent;
  if (direct && typeof direct === 'object') return direct;

  // 2026-05 shape: /profile/<slug>/ pages embed the agent under `displayData`
  // — the page is rendered from a single React tree, not Apollo. We accept
  // it here and let the normaliser collapse the field-name drift.
  if (pp?.displayData && typeof pp.displayData === 'object') {
    return pp.displayData;
  }

  // Sometimes the page nests it inside an Apollo cache JSON string
  const cacheStr = pp?.apolloState;
  if (cacheStr && typeof cacheStr === 'object') {
    for (const key of Object.keys(cacheStr)) {
      if (/^Agent[:_]/.test(key)) return cacheStr[key];
    }
  }
  return deepFindAgentNode(nextData);
}

function deepFindAgentNode(node, depth = 0) {
  if (!node || typeof node !== 'object' || depth > 8) return null;
  if (
    typeof node === 'object' &&
    !Array.isArray(node) &&
    // Either {first/full/displayName + brokerage/broker/business} OR a
    // node with profileDisplayName + recentSales/recentListings (the
    // 2026-05 /profile/ shape).
    ((node.firstName || node.fullName || node.displayName) &&
      (node.brokerage || node.brokerName || node.businessName ||
        node.recentListings || node.recentSales || node.profileDisplayName))
  ) {
    return node;
  }
  const values = Array.isArray(node) ? node : Object.values(node);
  for (const v of values) {
    const r = deepFindAgentNode(v, depth + 1);
    if (r) return r;
  }
  return null;
}

function normalizeAgentProfile(a) {
  if (!a || typeof a !== 'object') return null;
  const recent = Array.isArray(a.recentListings)
    ? a.recentListings
    : Array.isArray(a.activeListings)
      ? a.activeListings
      : Array.isArray(a.listings)
        ? a.listings
        : [];
  return {
    name: a.fullName || a.displayName || [a.firstName, a.lastName].filter(Boolean).join(' ') || undefined,
    firstName: a.firstName,
    lastName: a.lastName,
    brokerage: a.brokerage || a.brokerName || a.businessName || undefined,
    phone: a.phone || a.phoneNumber || a.preferredPhone || undefined,
    email: a.email || undefined,
    photoUrl: a.photoUrl || a.profilePhoto || a.profileImage || undefined,
    reviewCount: a.reviewCount != null ? Number(a.reviewCount) : undefined,
    rating: a.rating != null ? Number(a.rating) : undefined,
    reviews: Array.isArray(a.reviews) ? a.reviews : undefined,
    recentListings: recent.map(mapListingToSummary).filter(Boolean),
    languages: Array.isArray(a.languages) ? a.languages : undefined,
    licenseNumber: a.licenseNumber || a.license || undefined,
    licenseState: a.licenseState || undefined,
    profileUrl: a.profileUrl
      ? a.profileUrl.startsWith('http')
        ? a.profileUrl
        : `${ZILLOW_BASE}${a.profileUrl}`
      : undefined,
  };
}

/**
 * Agent profile page parser — name, brokerage, phone, reviews, recent listings.
 *
 * @param {{slug: string}} args  Zillow profile slug (e.g. "jane-doe-1234")
 */
async function agentProfile(args = {}) {
  const { slug } = args;
  if (!slug) {
    throw new ZillowScrapeError('agentProfile requires slug', { reason: 'bad_args' });
  }
  const url = agentProfileUrl(slug);
  let resp;
  try {
    // Agent profile pages 502 on the default pool, similar to mortgage-rates.
    // Use super=true to get a premium proxy through.
    resp = await scrape(url, {
      headers: DEFAULT_HEADERS,
      geoCode: 'us',
      render: false,
      super: true,
      timeoutMs: 60_000,
    });
  } catch (err) {
    if (err instanceof ScrapeDoError) {
      throw new ZillowScrapeError(`scrape.do fetch failed: ${err.message}`, {
        status: err.status,
        action: 'agentProfile',
        reason: 'fetch_failed',
      });
    }
    throw err;
  }
  const nextData = extractNextData(resp.data);
  const record = findAgentProfile(nextData);
  if (!record) {
    throw new ZillowScrapeError('Could not locate agentProfile in __NEXT_DATA__', {
      action: 'agentProfile',
      reason: 'no_agent_in_payload',
    });
  }
  return normalizeAgentProfile(record);
}

// ───────────────────────── Market stats / region pages ──────────────────

function marketStatsUrl(region, regionType) {
  // /<region-slug>/home-values/ is the canonical canonical regional rollup.
  // regionType is hint-only: it determines the URL prefix when known
  // ("zip", "city", "state", "county"), defaults to flat /<region>/home-values/.
  const slug = String(region)
    .trim()
    .toLowerCase()
    .replace(/,/g, '')
    .replace(/\s+/g, '-');
  if (regionType === 'zip') {
    return `${ZILLOW_BASE}/home-values/${encodeURIComponent(slug)}/`;
  }
  return `${ZILLOW_BASE}/${encodeURIComponent(slug)}/home-values/`;
}

function findMarketStats(nextData) {
  const cp = nextData?.props?.pageProps?.componentProps;
  const pp = nextData?.props?.pageProps;

  // 2026-05 shape: home-values pages expose data in two siblings —
  // `zhviRegion` (the region itself) and `odpMarketAnalytics` (the stats).
  // We merge them into one record so the downstream normaliser doesn't have
  // to branch.
  if (pp?.odpMarketAnalytics || pp?.zhviRegion) {
    const merged = {
      ...(pp.zhviRegion || {}),
      ...(pp.odpMarketAnalytics || {}),
      // Hoist deep-nested values so normalizeMarketStats sees them
      typicalHomeValue:
        pp.odpMarketAnalytics?.zhviLatest?.dataValue ??
        pp.odpMarketAnalytics?.zhviYoY,
      yoyChangePct: pp.odpMarketAnalytics?.zhviLatest?.zhviYoY,
      medianListPrice: pp.odpMarketAnalytics?.mrktListingLatest?.medianListPrice,
      medianSalePrice: pp.odpMarketAnalytics?.mrktSaleLatest?.medianSalePrice,
      inventoryCount: pp.odpMarketAnalytics?.mrktListingLatest?.forSaleInventory,
      regionName: pp.zhviRegion?.name || pp.requestedRegion?.name,
      regionType: pp.zhviRegion?.regionTypeName,
    };
    return merged;
  }

  const candidates = [
    cp?.regionInfo,
    cp?.region,
    cp?.marketStats,
    cp?.homeValueData,
    pp?.region,
    pp?.marketStats,
  ];
  for (const c of candidates) {
    if (c && typeof c === 'object') return c;
  }
  return deepFindRegionNode(nextData);
}

function deepFindRegionNode(node, depth = 0) {
  if (!node || typeof node !== 'object' || depth > 8) return null;
  if (
    !Array.isArray(node) &&
    (node.typicalHomeValue != null ||
      node.zhviValue != null ||
      node.medianHomeValue != null ||
      node.homeValueIndex != null)
  ) {
    return node;
  }
  const values = Array.isArray(node) ? node : Object.values(node);
  for (const v of values) {
    const r = deepFindRegionNode(v, depth + 1);
    if (r) return r;
  }
  return null;
}

function normalizeMarketStats(r) {
  if (!r || typeof r !== 'object') return null;
  return {
    regionName: r.regionName || r.name || r.displayName || undefined,
    regionType: r.regionType || r.type || undefined,
    typicalHomeValue:
      r.typicalHomeValue ?? r.zhviValue ?? r.medianHomeValue ?? r.homeValueIndex ?? undefined,
    momChangePct: r.monthOverMonthChange ?? r.momChange ?? r.mom ?? undefined,
    yoyChangePct: r.yearOverYearChange ?? r.yoyChange ?? r.yoy ?? undefined,
    forecastOneYearPct: r.oneYearForecast ?? r.forecast1Yr ?? undefined,
    medianListPrice: r.medianListPrice ?? r.medianListingPrice ?? undefined,
    medianSalePrice: r.medianSalePrice ?? undefined,
    medianDaysOnMarket: r.medianDaysOnMarket ?? r.medianDom ?? undefined,
    saleToListRatio: r.saleToListRatio ?? undefined,
    inventoryCount: r.inventoryCount ?? r.activeListings ?? undefined,
  };
}

/**
 * Region-level market stats (typical home value, MoM, YoY, etc.).
 *
 * @param {{region: string, regionType?: 'zip'|'city'|'state'|'county'}} args
 */
async function marketStats(args = {}) {
  const { region, regionType } = args;
  if (!region) {
    throw new ZillowScrapeError('marketStats requires region', { reason: 'bad_args' });
  }
  const url = marketStatsUrl(region, regionType);
  let resp;
  try {
    // /<region>/home-values/ is region-page heavy and 502s on the default
    // pool; super=true gets through (observed 2026-05).
    resp = await scrape(url, {
      headers: DEFAULT_HEADERS,
      geoCode: 'us',
      render: false,
      super: true,
      timeoutMs: 60_000,
    });
  } catch (err) {
    if (err instanceof ScrapeDoError) {
      throw new ZillowScrapeError(`scrape.do fetch failed: ${err.message}`, {
        status: err.status,
        action: 'marketStats',
        reason: 'fetch_failed',
      });
    }
    throw err;
  }
  const nextData = extractNextData(resp.data);
  const record = findMarketStats(nextData);
  if (!record) {
    throw new ZillowScrapeError('Could not locate region stats in __NEXT_DATA__', {
      action: 'marketStats',
      reason: 'no_region_in_payload',
    });
  }
  return normalizeMarketStats(record);
}

// `rentalEstimate` is the action name the frontend uses when it wants
// the rent estimate for a property. Zillow's detail page exposes both
// the sale Zestimate AND the Rent Zestimate from the same JSON blob, so
// `propertyDetails` carries both — we just re-key under the action name
// the caller expects. Without this alias the action falls through to
// the RapidAPI primary; if that quota'd out, the user saw 500s.
async function rentalEstimate(args = {}) {
  const r = await propertyDetails(args);
  return {
    zpid: r?.zpid,
    rentZestimate: r?.rentZestimate ?? null,
    rentZestimateLow: r?.rentZestimateLow ?? null,
    rentZestimateHigh: r?.rentZestimateHigh ?? null,
    // Preserve the rest so callers that read other fields don't break.
    ...r,
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
  rentalEstimate,
  schools,
  comps,
  zestimateHistory,
  // Search-class:
  search,
  searchByAddress,
  searchByCoordinates,
  searchByBounds,
  searchByUrl,
  forSale,
  forRent,
  recentlySold,
  foreclosures,
  fsbo,
  // Value / market / mortgage / agent:
  mortgageRates,
  mortgageCalculator,
  agentProfile,
  marketStats,
  // Exported for tests:
  extractNextData,
  findPropertyRecord,
  findListResults,
  findTotalResultCount,
  mapPropertyToRapidApiShape,
  mapListingToSummary,
  searchUrlForLocation,
  buildSearchQueryState,
  boundsFromCenterRadius,
  findZestimateHistory,
  findMortgageRates,
  normalizeMortgageRate,
  findAgentProfile,
  normalizeAgentProfile,
  findMarketStats,
  normalizeMarketStats,
  marketStatsUrl,
};
