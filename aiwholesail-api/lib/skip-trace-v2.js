/**
 * Skip Trace V2 — fallback provider.
 *
 * Wraps `skip-tracing-api.p.rapidapi.com` (different RapidAPI service,
 * same account/key as the primary `skip-tracing-working-api`). Used as
 * a fallback when the primary fails (502 / timeout / network error) so
 * a transient upstream issue on one provider doesn't break the user-
 * facing skip-trace flow.
 *
 * NOT used for primary calls — it's strictly a safety net. Both
 * providers count against the same RapidAPI account quota.
 *
 * Endpoint differences vs V1:
 *   - V1: GET with query string  | V2: POST with JSON body
 *   - V1 `byaddress(street, citystatezip)`
 *     ↔ V2 `owners-by-address {addressLine1, addressLine2}`
 *   - V1 `bynameaddress(name, citystatezip)`
 *     ↔ V2 `by-name-and-address {firstName, lastName, addressLine2}`
 *   - V1 `detailsbyID(peo_id)`
 *     ↔ V2 `person/info {tahoeId}`  (different ID space — not a clean fallback)
 *
 * V2 endpoints that have no V1 equivalent or vice-versa are NOT routed.
 * Only the three above support fallback.
 *
 * Pure data-transformation + axios wrapper. The fallback decision lives
 * in routes/skipTrace.js where the V1 result is already in hand.
 */

const axios = require('axios');

const V2_HOST = 'skip-tracing-api.p.rapidapi.com';
const V2_BASE = `https://${V2_HOST}`;

const SUPPORTED_FALLBACKS = Object.freeze(['byaddress', 'bynameaddress']);

/**
 * Convert a V1 search-type + params into V2 path + body.
 * Returns null if the search-type has no V2 equivalent.
 */
function v1ToV2Request(searchType, params) {
  if (searchType === 'byaddress') {
    return {
      path: '/search/owners-by-address',
      body: {
        addressLine1: params.street,
        addressLine2: params.citystatezip,
      },
    };
  }
  if (searchType === 'bynameaddress') {
    // Best-effort split of "First Last" → firstName / lastName. If the
    // name has 3+ tokens (middle name / suffix), bundle middle/suffix
    // into lastName so we don't drop signal.
    const parts = String(params.name || '').trim().split(/\s+/);
    const firstName = parts[0] || '';
    const lastName = parts.slice(1).join(' ') || '';
    return {
      path: '/search/by-name-and-address',
      body: {
        firstName,
        lastName,
        addressLine2: params.citystatezip,
      },
    };
  }
  return null;
}

/**
 * V2 wraps its responses in `{success, data | error, status}`. Normalize
 * to V1's expected shape so downstream extraction (extractPeoIds,
 * countResults) keeps working without branching on provider.
 *
 * The exact V2 success-case payload isn't documented externally, so we
 * defensively unwrap several possible shapes:
 *   - {success: true, data: {results: [...]}}
 *   - {success: true, data: [...]}
 *   - {success: true, results: [...]}
 *   - raw array
 *
 * Returns null if the response doesn't look like a real success.
 */
function normalizeV2Response(v2Body) {
  if (!v2Body || typeof v2Body !== 'object') return null;
  if (v2Body.success === false) return null;
  // Direct array shape
  if (Array.isArray(v2Body)) return { results: v2Body };
  // Common envelope: { success: true, data: ... }
  if (v2Body.data) {
    if (Array.isArray(v2Body.data)) return { results: v2Body.data };
    if (typeof v2Body.data === 'object' && v2Body.data.results) {
      return { results: v2Body.data.results, ...v2Body.data };
    }
    if (typeof v2Body.data === 'object') {
      return v2Body.data;
    }
  }
  // Flat results
  if (Array.isArray(v2Body.results)) return v2Body;
  // Already V1-shaped (defensive)
  if (v2Body.people || v2Body.persons) return v2Body;
  return null;
}

/**
 * Call V2 for one of the supported fallback search-types.
 *
 * @param {object} args
 * @param {string} args.searchType        V1 search-type name
 * @param {object} args.params            V1 params
 * @param {string} args.rapidApiKey       Same RAPIDAPI_KEY used by V1 (same account)
 * @param {number} [args.timeoutMs=15000] Request timeout
 *
 * @returns {Promise<{ok: boolean, data?: any, status: number, error?: string}>}
 */
async function callV2Fallback({ searchType, params, rapidApiKey, timeoutMs = 15000 }) {
  if (!SUPPORTED_FALLBACKS.includes(searchType)) {
    return { ok: false, status: 0, error: `V2 has no fallback for ${searchType}` };
  }
  if (!rapidApiKey) {
    return { ok: false, status: 0, error: 'RAPIDAPI_KEY not configured' };
  }
  const req = v1ToV2Request(searchType, params);
  if (!req) {
    return { ok: false, status: 0, error: `Could not build V2 request for ${searchType}` };
  }

  try {
    const response = await axios.post(`${V2_BASE}${req.path}`, req.body, {
      headers: {
        'x-rapidapi-key': rapidApiKey,
        'x-rapidapi-host': V2_HOST,
        'Content-Type': 'application/json',
      },
      timeout: timeoutMs,
      validateStatus: () => true,
    });

    // V2 returns {success: false, ...} with HTTP 200 when upstream
    // PeopleFinders is blocked (e.g. Cloudflare 403). Treat as failure.
    if (response.status < 200 || response.status >= 300) {
      return { ok: false, status: response.status, error: `V2 returned HTTP ${response.status}` };
    }
    if (response.data?.success === false) {
      return {
        ok: false,
        status: response.data.status || 502,
        error: response.data.error || 'V2 upstream rejected',
      };
    }
    const normalized = normalizeV2Response(response.data);
    if (!normalized) {
      return { ok: false, status: 502, error: 'V2 response shape unrecognised' };
    }
    return { ok: true, status: 200, data: normalized };
  } catch (err) {
    return { ok: false, status: 0, error: err.message || 'V2 network error' };
  }
}

module.exports = {
  V2_HOST,
  SUPPORTED_FALLBACKS,
  v1ToV2Request,
  normalizeV2Response,
  callV2Fallback,
};
