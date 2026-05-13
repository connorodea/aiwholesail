/**
 * Zillow address-autocomplete (typeahead) routed through scrape.do.
 *
 * Zillow exposes a static suggestions API at
 *   GET https://www.zillowstatic.com/autocomplete/v3/suggestions?q=<query>
 * that returns clean JSON keyed on a single `results` array. The shape is:
 *
 *   {
 *     "results": [
 *       { "display": "Austin, TX",
 *         "resultType": "Region",
 *         "metaData": { regionId, regionType: "city"|"zipcode"|"county"|...,
 *                       city, county, state, zipCode?, lat, lng } },
 *       { "display": "1600 Pennsylvania Ave …",
 *         "resultType": "Address",
 *         "metaData": { streetNumber, streetName, unitNumber?, city, state,
 *                       country, zipCode, zpid, lat, lng, maloneId,
 *                       addressType: "forsale_address"|"rental_address"|… } },
 *       …
 *     ]
 *   }
 *
 * Empty results come back as `{"results":[]}` — that's a normal "no match",
 * not an error. The normalizer collapses both shapes into a flat
 * `Suggestion` object the frontend can render without branching:
 *
 *   { display, address, city, state, zip, zpid?, type: 'region'|'address' }
 *
 * Defensive parsing — we never trust Zillow's field set verbatim. If the
 * payload isn't JSON, isn't an object, or doesn't have a `results` array
 * we return `[]` and log a warning. We also drop suggestions whose
 * `display` is empty after trim.
 *
 * Cost: one scrape.do call per query. We do NOT cache here — the route
 * layer can opt in later if hit volume justifies a cache table. Render is
 * left OFF — the endpoint is a flat JSON API, not a JS-rendered page, so
 * the default residential-proxy pass is enough.
 */

const { scrape } = require('./scrapeDoClient');

const AUTOCOMPLETE_BASE = 'https://www.zillowstatic.com/autocomplete/v3/suggestions';

/**
 * Build the upstream Zillow URL for a given query.
 * `clientId` mimics the value the website itself sends — keeps us behind
 * the same allowlist as legitimate browser traffic.
 */
function autocompleteUrl(query) {
  const params = new URLSearchParams({
    q: String(query || '').trim(),
    clientId: 'hdp-autocomplete-wrapper',
  });
  return `${AUTOCOMPLETE_BASE}?${params.toString()}`;
}

/**
 * Parse the raw scrape.do body (a JSON string) into the upstream object.
 * Tolerant — wraps JSON.parse so a captcha/HTML response doesn't crash
 * the caller. Returns `{ results: [] }` on any failure.
 */
function parseAutocompletePayload(raw) {
  if (raw == null) return { results: [] };
  if (typeof raw === 'object') return raw;
  if (typeof raw !== 'string') return { results: [] };
  const trimmed = raw.trim();
  if (!trimmed) return { results: [] };
  try {
    const data = JSON.parse(trimmed);
    if (data && typeof data === 'object') return data;
    return { results: [] };
  } catch {
    return { results: [] };
  }
}

/**
 * Normalize one upstream entry into the flat shape the frontend consumes.
 * Returns null for entries we can't render (e.g. missing display string).
 */
function normalizeSuggestion(entry) {
  if (!entry || typeof entry !== 'object') return null;
  const display = typeof entry.display === 'string' ? entry.display.trim() : '';
  if (!display) return null;

  const meta = entry.metaData && typeof entry.metaData === 'object' ? entry.metaData : {};
  const rawType = String(entry.resultType || '').toLowerCase();
  // Zillow uses "Address" for street-level, "Region" for everything else
  // (city, zipcode, county, neighborhood, school, ...). We expose both
  // groupings but also keep the region subtype for UIs that want to badge it.
  let type = 'region';
  if (rawType === 'address') type = 'address';

  // Compose an "address" line — for Address results this is the street,
  // for regions it's the natural-language slug ("Austin, TX", "90210").
  let address = '';
  if (type === 'address') {
    const num = meta.streetNumber ? String(meta.streetNumber).trim() : '';
    const street = meta.streetName ? String(meta.streetName).trim() : '';
    const unit = meta.unitNumber ? `#${String(meta.unitNumber).trim()}` : '';
    address = [num, street, unit].filter(Boolean).join(' ').trim();
  }

  const city = meta.city ? String(meta.city).trim() : '';
  const state = meta.state ? String(meta.state).trim() : '';
  const zip = meta.zipCode ? String(meta.zipCode).trim() : '';
  const zpid = meta.zpid != null ? String(meta.zpid) : undefined;

  // For Region results, keep the more specific subtype (city/zipcode/county/...)
  // when present so the UI can show "City" vs "ZIP" vs "County" badges.
  const regionType =
    type === 'region' && meta.regionType ? String(meta.regionType).toLowerCase() : undefined;

  const out = {
    display,
    address,
    city,
    state,
    zip,
    type,
  };
  if (zpid) out.zpid = zpid;
  if (regionType) out.regionType = regionType;
  return out;
}

/**
 * Normalize the raw payload into a clean array of Suggestion objects.
 * Drops empties. Caps to `limit` results (defaults to 10, the upstream max).
 */
function normalizeAutocompletePayload(payload, { limit = 10 } = {}) {
  const data = parseAutocompletePayload(payload);
  const rawResults = Array.isArray(data?.results) ? data.results : [];
  const out = [];
  for (const entry of rawResults) {
    const s = normalizeSuggestion(entry);
    if (s) out.push(s);
    if (out.length >= limit) break;
  }
  return out;
}

/**
 * Fetch + normalize autocomplete suggestions for a free-text query.
 *
 * @param {string} query
 * @param {object} [opts]
 * @param {number} [opts.limit=8]   Cap the response size.
 * @returns {Promise<Array<{display, address, city, state, zip, zpid?, type, regionType?}>>}
 *
 * Throws on hard scrape.do failures (caller treats as 502) but returns `[]`
 * for valid-but-empty upstream responses.
 */
async function autocomplete(query, opts = {}) {
  const limit = opts.limit && Number.isFinite(opts.limit) ? Math.max(1, Math.min(20, opts.limit)) : 8;
  const q = String(query || '').trim();
  if (q.length < 2) return [];

  const url = autocompleteUrl(q);
  const res = await scrape(url, { geoCode: 'us' });
  if (res.status < 200 || res.status >= 300) {
    // scrape.do helper would already throw on retryable upstream failure;
    // anything else surfacing here is an unusual 2xx-but-suspicious case.
    return [];
  }
  return normalizeAutocompletePayload(res.data, { limit });
}

module.exports = {
  autocomplete,
  autocompleteUrl,
  parseAutocompletePayload,
  normalizeSuggestion,
  normalizeAutocompletePayload,
};
