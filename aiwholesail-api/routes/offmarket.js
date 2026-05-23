/**
 * Proxy to the aiwholesail-offmarket-api Python service.
 *
 * Mounted at `/api/offmarket-iq/*` to live alongside the existing
 * `/api/property/off-market` (PropData) and `/api/propdata/*` paths
 * without colliding.
 *
 * Routes:
 *   POST /api/offmarket-iq/lists/build         → POST  /api/v1/lists/build
 *   GET  /api/offmarket-iq/scores/top          → GET   /api/v1/scores/top
 *   GET  /api/offmarket-iq/properties/by-parcel  → GET   /api/v1/properties/by-parcel
 *   GET  /api/offmarket-iq/properties/by-address → GET   /api/v1/properties/by-address
 *   GET  /api/offmarket-iq/counties            → GET   /api/v1/counties/
 *   GET  /api/offmarket-iq/health              → GET   /health (open; sanity check)
 *
 * Auth: each customer-facing route requires the AIWholesail user to be
 * authenticated (same authenticate middleware as PropData routes). The
 * proxy itself adds the OFFMARKET_API_KEY bearer when calling upstream.
 * Per-user rate limiting still lives in the Node service via
 * checkDatabaseRateLimit; the Python service ALSO rate-limits at its key.
 */

const express = require('express');
const { authenticate } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');
const { checkDatabaseRateLimit } = require('../middleware/rateLimit');
const { buildRequest, getOffmarketBaseUrl } = require('../lib/offmarket-client');

const router = express.Router();

const RATE_LIMIT_PER_MIN = 60;  // Match PropData interactive bucket.

function getOffmarketApiKey() {
  return process.env.OFFMARKET_API_KEY;
}

async function proxy(req, res, method, path, options = {}) {
  const apiKey = getOffmarketApiKey();
  if (!apiKey) {
    return res.status(503).json({
      error: 'OffMarketIQ not configured',
      code: 'NOT_CONFIGURED',
    });
  }

  // Per-user rate limit on the AIWholesail side.
  if (req.user?.id) {
    const rl = await checkDatabaseRateLimit(
      req.user.id,
      'offmarket-iq',
      RATE_LIMIT_PER_MIN,
      1,
    );
    if (!rl.allowed) {
      return res.status(429).json({
        error: 'Rate limit exceeded. Try again in a minute.',
        code: 'RATE_LIMITED',
      });
    }
  }

  let request;
  try {
    request = buildRequest({
      apiKey,
      baseUrl: getOffmarketBaseUrl(),
      method,
      path,
      body: options.body,
      query: options.query,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message, code: 'CLIENT_BUILD_ERROR' });
  }

  let upstream;
  try {
    upstream = await fetch(request.url, {
      method: request.method,
      headers: request.headers,
      body: request.body,
      signal: AbortSignal.timeout(30_000),
    });
  } catch (err) {
    const isTimeout = err.name === 'TimeoutError' || /timed out/i.test(err.message || '');
    return res.status(isTimeout ? 504 : 502).json({
      error: isTimeout ? 'OffMarketIQ upstream timeout' : 'OffMarketIQ network error',
      code: isTimeout ? 'TIMEOUT' : 'NETWORK',
    });
  }

  // Forward whatever the Python service returned. Carry status code AND
  // body verbatim — 401 / 403 / 429 / 200 all have meaningful semantics.
  const ct = upstream.headers.get('content-type') || '';
  res.status(upstream.status);
  if (ct.includes('text/csv')) {
    // Streaming export — pipe body through.
    const cd = upstream.headers.get('content-disposition');
    if (cd) res.set('Content-Disposition', cd);
    res.set('Content-Type', 'text/csv');
    const text = await upstream.text();
    return res.send(text);
  }
  const data = await upstream.json().catch(() => ({}));
  return res.json(data);
}

// Health probe — open, no per-user rate limit, no auth check (matches
// the Python service's open /health).
router.get('/health', asyncHandler(async (req, res) => {
  const apiKey = getOffmarketApiKey();
  if (!apiKey) {
    return res.status(503).json({ error: 'OffMarketIQ not configured', code: 'NOT_CONFIGURED' });
  }
  try {
    const r = await fetch(`${getOffmarketBaseUrl()}/health`, {
      signal: AbortSignal.timeout(5_000),
    });
    const body = await r.json().catch(() => ({}));
    return res.status(r.status).json(body);
  } catch (err) {
    return res.status(502).json({ error: err.message, code: 'NETWORK' });
  }
}));

// Counties catalog — open on the Python side; we still authenticate the
// AIWholesail user so trial / unauth callers don't bypass our funnel.
router.get('/counties', authenticate, asyncHandler((req, res) =>
  proxy(req, res, 'GET', '/api/v1/counties/'),
));

// Top-N scores feed.
router.get('/scores/top', authenticate, asyncHandler((req, res) =>
  proxy(req, res, 'GET', '/api/v1/scores/top', {
    query: {
      state: req.query.state,
      county_fips: req.query.county_fips,
      zip: req.query.zip,
      score_tier: req.query.score_tier,
      score_min: req.query.score_min,
      limit: req.query.limit,
      offset: req.query.offset,
    },
  }),
));

// Filter-based list builder.
router.post('/lists/build', authenticate, asyncHandler((req, res) =>
  proxy(req, res, 'POST', '/api/v1/lists/build', { body: req.body }),
));

// Single-property lookups.
router.get('/properties/by-parcel', authenticate, asyncHandler((req, res) =>
  proxy(req, res, 'GET', '/api/v1/properties/by-parcel', {
    query: { parcel_id: req.query.parcel_id, county_fips: req.query.county_fips },
  }),
));

router.get('/properties/by-address', authenticate, asyncHandler((req, res) =>
  proxy(req, res, 'GET', '/api/v1/properties/by-address', {
    query: {
      address: req.query.address,
      city: req.query.city,
      state: req.query.state,
      zip: req.query.zip,
    },
  }),
));

module.exports = router;
