const express = require('express');
const axios = require('axios');
const crypto = require('crypto');
const { authenticate } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');
const { checkDatabaseRateLimit } = require('../middleware/rateLimit');
const {
  ERROR_CODES,
  getEndpointTimeout,
  normalizeUpstreamResponse,
  isRetryableError,
} = require('../lib/propdata-normalizer');
const { applyAbsenteeFilterToBody } = require('../lib/propdata-absentee-filter');
const { respondError } = require('../lib/responses');

const router = express.Router();

const RAPIDAPI_KEY = process.env.PROPDATA_RAPIDAPI_KEY;
const RAPIDAPI_HOST = process.env.PROPDATA_RAPIDAPI_HOST || 'propdata-real-estate-market-intelligence-api.p.rapidapi.com';
const BASE_URL = `https://${RAPIDAPI_HOST}`;

// Single retry for transient upstream errors (502/503/network). Idempotent
// GETs only, which all PropData endpoints are. Sleep 200ms before retry
// to give upstream a beat without holding the request too long.
const RETRY_DELAY_MS = 200;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// In-process LRU cache. Key = `${path}?${sortedParams}`. Value = { body, expiresAt }.
// 1-hour TTL keeps RapidAPI quota healthy. 500 entry cap is enough for normal usage
// without bloating the node process — eviction is FIFO via Map insertion order.
const CACHE_MAX = 500;
const CACHE_TTL_MS = 60 * 60 * 1000;
// Delta endpoints are polled for freshness — a 1h cache would mask newly added
// inventory between polls with an identical `since` cursor. 60s lets the proxy
// absorb burst polling without hiding new records for long.
const DELTA_CACHE_TTL_MS = 60 * 1000;
const cache = new Map();

function cacheKey(path, params) {
  const sorted = Object.keys(params).sort().map(k => `${k}=${params[k]}`).join('&');
  return `${path}?${sorted}`;
}

function cacheGet(key) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (entry.expiresAt < Date.now()) {
    cache.delete(key);
    return null;
  }
  // LRU touch: re-insert to move to end of Map iteration order
  cache.delete(key);
  cache.set(key, entry);
  return entry.body;
}

function cacheSet(key, body, ttlMs = CACHE_TTL_MS) {
  if (cache.size >= CACHE_MAX) {
    const oldest = cache.keys().next().value;
    cache.delete(oldest);
  }
  cache.set(key, { body, expiresAt: Date.now() + ttlMs });
}

// Cheap ISO 8601 guard. PropData's delta endpoints require a parseable
// timestamp; anything else just wastes upstream quota.
function isIso8601(s) {
  if (typeof s !== 'string' || s.length < 10) return false;
  const d = new Date(s);
  return !Number.isNaN(d.getTime());
}

// Per-user rate limit for PropData. Bumped from 5 → 60 after PR #183's
// multi-location fan-out — a single state search fires up to 25 ZIPs in
// seconds. 60/min still protects the shared RapidAPI quota (~1k/min at
// our plan tier) from any single user spamming. Cache hits don't count.
const RATE_LIMIT_PER_MIN = 60;
// Delta endpoints serve polling loops (alert workers, discovery loops).
// The 60s cache TTL already makes repeated polls cheap, so we give the
// polling bucket double the budget — a single user can run ~20-30
// concurrent polling loops at a 30s cadence without throttling. Polling
// keyed to its own bucket so it doesn't starve the interactive UI's
// /market / /property / /comps calls.
const RATE_LIMIT_DELTA_PER_MIN = 120;

/** Single upstream attempt. Wraps axios to surface a uniform shape. */
async function callUpstream(endpoint, params, timeoutMs) {
  try {
    const upstream = await axios.get(`${BASE_URL}${endpoint}`, {
      params,
      headers: {
        'x-rapidapi-key': RAPIDAPI_KEY,
        'x-rapidapi-host': RAPIDAPI_HOST,
      },
      timeout: timeoutMs,
      validateStatus: () => true,
    });
    return normalizeUpstreamResponse(upstream);
  } catch (err) {
    if (err.code === 'ECONNABORTED') {
      return {
        ok: false,
        status: 504,
        code: ERROR_CODES.TIMEOUT,
        body: { error: 'PropData upstream timeout', code: ERROR_CODES.TIMEOUT },
      };
    }
    return {
      ok: false,
      status: 502,
      code: ERROR_CODES.NETWORK,
      body: { error: err.message || 'Network error', code: ERROR_CODES.NETWORK },
    };
  }
}

async function proxy(req, res, endpoint, allowedParams, options = {}) {
  const requestId = crypto.randomBytes(6).toString('hex');
  res.set('X-PropData-RequestId', requestId);

  if (!RAPIDAPI_KEY) {
    return res.status(503).json({
      error: 'PropData not configured',
      code: ERROR_CODES.NOT_CONFIGURED,
    });
  }

  // Whitelist params: only forward keys the endpoint actually accepts, so a
  // malicious client can't smuggle arbitrary query strings to the upstream.
  const params = {};
  for (const key of allowedParams) {
    const v = req.query[key];
    if (v !== undefined && v !== '') params[key] = String(v);
  }

  if (options.requiredParams) {
    for (const key of options.requiredParams) {
      if (!params[key]) return res.status(400).json({ error: `${key} is required` });
    }
  }
  if (params.since && !isIso8601(params.since)) {
    return res.status(400).json({ error: 'since must be ISO 8601' });
  }

  // Cap `limit` defensively. Upstream may clamp internally, but a client
  // requesting limit=10000 still wastes a quota tick and an upstream call
  // before clamping happens. 500 is generous for the delta + list endpoints
  // (default page size is ~100). Non-numeric or invalid → drop the param.
  if (params.limit !== undefined) {
    const parsed = parseInt(params.limit, 10);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      delete params.limit;
    } else {
      params.limit = String(Math.min(parsed, 500));
    }
  }

  // Some params are accepted from the caller (for API stability / contract)
  // but MUST NOT be forwarded upstream — e.g. `absentee_only` is broken
  // server-side at the vendor (2026-05-14 live-test). We handle those
  // locally via options.transformBody on the response.
  const upstreamParams = { ...params };
  for (const key of options.stripFromUpstream || []) {
    delete upstreamParams[key];
  }

  // Cache key uses the FULL params (including locally-handled ones) so two
  // queries that differ only on a locally-handled filter (absentee_only)
  // don't share a cache entry.
  const key = cacheKey(endpoint, params);
  const cached = cacheGet(key);
  if (cached) {
    res.set('X-PropData-Cache', 'HIT');
    return res.json(cached);
  }

  // Bucket keyed per workflow so a polling loop on /property/delta can't
  // starve the user's interactive UI calls (and vice versa). Default is
  // the interactive 'propdata' bucket; delta routes opt in via DELTA_OPTS.
  const bucket = options.rateLimitBucket || 'propdata';
  const bucketMax = options.rateLimitMax || RATE_LIMIT_PER_MIN;
  const rateLimit = await checkDatabaseRateLimit(req.user.id, bucket, bucketMax, 1);
  if (!rateLimit.allowed) {
    return respondError(res, 429, 'Rate limit exceeded. Try again in a minute.', {
      code: ERROR_CODES.RATE_LIMITED,
    });
  }

  const timeoutMs = getEndpointTimeout(endpoint);
  const startedAt = Date.now();

  // Attempt 1
  let result = await callUpstream(endpoint, upstreamParams, timeoutMs);

  // Single retry on transient upstream error / network blip. NO_COVERAGE,
  // NOT_FOUND, RATE_LIMITED are never retried (won't help, would burn quota).
  let retried = false;
  if (isRetryableError(result) || result.code === ERROR_CODES.NETWORK) {
    await sleep(RETRY_DELAY_MS);
    result = await callUpstream(endpoint, upstreamParams, timeoutMs);
    retried = true;
  }

  // Post-process successful bodies — e.g. apply locally-handled filters
  // that the vendor's equivalent server-side parameter is broken for.
  if (result.ok && typeof options.transformBody === 'function') {
    result = { ...result, body: options.transformBody(result.body, params) };
  }

  const elapsedMs = Date.now() - startedAt;

  // Single structured log line per request — greppable in production.
  console.log(JSON.stringify({
    component: 'propdata',
    endpoint,
    request_id: requestId,
    user_id: req.user?.id,
    code: result.code,
    elapsed_ms: elapsedMs,
    retried,
    zip: params.zip,
    state: params.state,
  }));

  // Cache only OK responses. NO_COVERAGE responses may resolve tomorrow.
  // Delta endpoints pass a shorter ttlMs via options so polling sees fresh data.
  if (result.ok) cacheSet(key, result.body, options.ttlMs);

  res.set('X-PropData-Cache', 'MISS');
  res.set('X-PropData-Code', result.code);
  return res.status(result.status).json(result.body);
}

router.get('/health',        authenticate, asyncHandler((req, res) => proxy(req, res, '/v1/health', [])));
router.get('/stats',         authenticate, asyncHandler((req, res) => proxy(req, res, '/v1/stats', [])));
router.get('/neighborhood',  authenticate, asyncHandler((req, res) => proxy(req, res, '/v1/neighborhood', ['zip'])));
router.get('/market',        authenticate, asyncHandler((req, res) => proxy(req, res, '/v1/market', ['zip', 'state', 'metro', 'months'])));
router.get('/listing',       authenticate, asyncHandler((req, res) => proxy(req, res, '/v1/listing', ['zip'])));
router.get('/rent',          authenticate, asyncHandler((req, res) => proxy(req, res, '/v1/rent', ['zip', 'state', 'beds'])));
router.get('/estimate',      authenticate, asyncHandler((req, res) => proxy(req, res, '/v1/estimate', ['zip', 'state', 'beds'])));
router.get('/comps',         authenticate, asyncHandler((req, res) => proxy(req, res, '/v1/comps', ['zip', 'address', 'limit', 'radius'])));
router.get('/geocode',       authenticate, asyncHandler((req, res) => proxy(req, res, '/v1/geocode', ['address'])));
// `/property` accepts `absentee_only` from callers (frontend contract stable)
// but does NOT forward it upstream — the vendor's filter is broken
// (2026-05-14 live-test: returns empty arrays for ZIPs that contain
// many absentee records). Instead we strip the param, fetch the
// unfiltered list, and apply the predicate locally via
// applyAbsenteeFilterToBody (definition of absentee:
// flags.is_absentee_owner=true, or mailing_zip != property zip, or
// mailing_state != property state).
router.get('/property',      authenticate, asyncHandler((req, res) => proxy(req, res, '/v1/property', [
  'zip', 'address', 'apn', 'owner', 'absentee_only', 'limit',
], {
  stripFromUpstream: ['absentee_only'],
  transformBody: (body, params) => applyAbsenteeFilterToBody(body, {
    absentee_only: params.absentee_only === 'true' || params.absentee_only === true,
  }),
})));

// Delta endpoints — return only records added/updated since the given ISO 8601
// timestamp. Cursor-paginated. Short TTL so polling loops see fresh inventory.
const DELTA_PARAMS = ['since', 'zip', 'cursor', 'limit'];
const DELTA_OPTS = {
  ttlMs: DELTA_CACHE_TTL_MS,
  requiredParams: ['since'],
  // Polling loops live in their own bucket so they don't compete with
  // interactive UI calls. See RATE_LIMIT_DELTA_PER_MIN above for the math.
  rateLimitBucket: 'propdata-delta',
  rateLimitMax: RATE_LIMIT_DELTA_PER_MIN,
};

router.get('/property/delta',       authenticate, asyncHandler((req, res) =>
  proxy(req, res, '/v1/property/delta', DELTA_PARAMS, DELTA_OPTS)));

router.get('/preforeclosure/delta', authenticate, asyncHandler((req, res) =>
  proxy(req, res, '/v1/preforeclosure/delta', DELTA_PARAMS, DELTA_OPTS)));

// On-demand pre-foreclosure lookup for interactive UI (lead-types
// multi-select, Phase 1). Wraps the cursor-paginated /preforeclosure/delta
// endpoint with a sane default `since` (30 days ago) so the UI doesn't have
// to track cursors. Routed through the INTERACTIVE rate-limit bucket and
// the 60-min cache TTL — the UI doesn't need second-by-second freshness
// the polling workers care about.
const PREFORECLOSURE_LOOKUP_DAYS = 30;
router.get('/preforeclosure', authenticate, asyncHandler((req, res) => {
  // Default `since` to N days ago if the caller didn't supply one. Mutating
  // req.query is fine — Express gives us a per-request object. We deliberately
  // do NOT touch `cursor` here; on-demand calls take the first page.
  if (!req.query.since) {
    const sinceDate = new Date(Date.now() - PREFORECLOSURE_LOOKUP_DAYS * 24 * 60 * 60 * 1000);
    req.query.since = sinceDate.toISOString();
  }
  return proxy(req, res, '/v1/preforeclosure/delta', ['since', 'zip', 'limit'], {
    requiredParams: ['zip'],
    // Interactive bucket + 60-min TTL — this is UI fetch, not polling.
  });
}));

module.exports = router;
