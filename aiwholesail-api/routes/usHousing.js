/**
 * US Housing Market Data (apimaker/us-housing-market-data1) proxy.
 *
 * Selectively integrates the 3 endpoints from this RapidAPI host that
 * are net-new vs our existing Zillow Scraper + PropData proxies:
 *
 *   - GET /walkAndTransitScore  — fills the PR #207 gap (Zillow Scraper
 *     rejected the walkScore action; this provider has it working).
 *     Returns {walkScore, transitScore, bikeScore}.
 *   - GET /propertyByCoordinates — lat/lng radius search. We don't have
 *     a direct coord-based search anywhere else.
 *   - GET /valueHistory/localHomeValues — ZIP-level appreciation chart
 *     going back to 2016. Useful for ARV confidence + market context.
 *
 * The remaining ~44 endpoints are largely duplicative of Zillow Scraper
 * (zpid → details, zestimate, comps, photos, etc.) so we do NOT proxy
 * them — they'd burn our 100-req/month plan budget for no marginal value.
 *
 * Auth: shared RAPIDAPI_KEY (same RapidAPI account as Zillow/PropData/
 * skip-trace). The plan has a tight per-minute throttle (~5-10 req/min
 * at the gateway level). 1h LRU cache keeps that headroom for real
 * traffic.
 */

const express = require('express');
const axios = require('axios');
const crypto = require('crypto');
const { authenticate } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');
const { checkDatabaseRateLimit } = require('../middleware/rateLimit');

const router = express.Router();

const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY;
const RAPIDAPI_HOST = process.env.US_HOUSING_RAPIDAPI_HOST || 'us-housing-market-data1.p.rapidapi.com';
const BASE_URL = `https://${RAPIDAPI_HOST}`;

// 1h LRU cache. The 100/month plan + per-minute throttle make caching
// essential — repeat lookups for the same zpid/zip should never burn quota.
const CACHE_MAX = 500;
const CACHE_TTL_MS = 60 * 60 * 1000;
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
  cache.delete(key);
  cache.set(key, entry);
  return entry.body;
}

function cacheSet(key, body) {
  if (cache.size >= CACHE_MAX) {
    const oldest = cache.keys().next().value;
    cache.delete(oldest);
  }
  cache.set(key, { body, expiresAt: Date.now() + CACHE_TTL_MS });
}

// Tighter rate limit than PropData (60/min) because this plan is
// 100-req/MONTHLY total. 20/min per user gives 5 active users their
// own headroom while preventing a single user from burning the
// monthly budget in one search.
const RATE_LIMIT_PER_MIN = 20;

async function proxy(req, res, endpoint, allowedParams) {
  const requestId = crypto.randomBytes(6).toString('hex');
  res.set('X-USHousing-RequestId', requestId);

  if (!RAPIDAPI_KEY) {
    return res.status(503).json({
      error: 'US Housing data not configured',
      code: 'NOT_CONFIGURED',
    });
  }

  const params = {};
  for (const key of allowedParams) {
    const v = req.query[key];
    if (v !== undefined && v !== '') params[key] = String(v);
  }

  const key = cacheKey(endpoint, params);
  const cached = cacheGet(key);
  if (cached) {
    res.set('X-USHousing-Cache', 'HIT');
    return res.json(cached);
  }

  const rateLimit = await checkDatabaseRateLimit(req.user.id, 'us-housing', RATE_LIMIT_PER_MIN, 1);
  if (!rateLimit.allowed) {
    return res.status(429).json({
      error: 'Rate limit exceeded. Try again in a minute.',
      code: 'RATE_LIMITED',
    });
  }

  const startedAt = Date.now();
  try {
    const upstream = await axios.get(`${BASE_URL}${endpoint}`, {
      params,
      headers: {
        'x-rapidapi-key': RAPIDAPI_KEY,
        'x-rapidapi-host': RAPIDAPI_HOST,
      },
      timeout: 15_000,
      validateStatus: () => true,
    });

    const elapsedMs = Date.now() - startedAt;
    // Structured log for ops monitoring — same pattern as propdata proxy.
    console.log(JSON.stringify({
      component: 'us-housing',
      endpoint,
      request_id: requestId,
      user_id: req.user?.id,
      status: upstream.status,
      elapsed_ms: elapsedMs,
    }));

    const body = upstream.data;

    // Upstream sometimes returns 200 with {status:'error',errors:[...]} —
    // a coverage-gap or param-validation issue. Don't cache, surface 400/404.
    if (body && typeof body === 'object' && body.status === 'error') {
      return res.status(400).json({
        error: Array.isArray(body.errors) ? body.errors.join('; ') : (body.errors || 'Upstream rejected'),
        code: 'UPSTREAM_VALIDATION',
      });
    }

    // Upstream's own monthly-quota / per-minute exhaustion message.
    if (upstream.status === 429) {
      return res.status(429).json({
        error: 'Upstream rate limit hit. Try again in a minute.',
        code: 'RATE_LIMITED',
      });
    }

    if (upstream.status >= 200 && upstream.status < 300) {
      cacheSet(key, body);
      res.set('X-USHousing-Cache', 'MISS');
      return res.json(body);
    }

    return res.status(502).json({
      error: `Upstream returned ${upstream.status}`,
      code: 'UPSTREAM_ERROR',
    });
  } catch (err) {
    const code = err.code === 'ECONNABORTED' ? 'TIMEOUT' : 'NETWORK';
    console.error(`[us-housing] ${endpoint} failed:`, err.message);
    return res.status(502).json({ error: err.message || 'Network error', code });
  }
}

// ─── Routes ────────────────────────────────────────────────────────────

router.get('/walkAndTransitScore', authenticate, asyncHandler((req, res) =>
  proxy(req, res, '/walkAndTransitScore', ['zpid'])
));

router.get('/propertyByCoordinates', authenticate, asyncHandler((req, res) =>
  proxy(req, res, '/propertyByCoordinates', ['lat', 'long', 'radius'])
));

router.get('/valueHistory/localHomeValues', authenticate, asyncHandler((req, res) =>
  proxy(req, res, '/valueHistory/localHomeValues', ['zpid'])
));

module.exports = router;
