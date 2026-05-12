const express = require('express');
const axios = require('axios');
const { authenticate } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');
const { checkDatabaseRateLimit } = require('../middleware/rateLimit');

const router = express.Router();

const RAPIDAPI_KEY = process.env.PROPDATA_RAPIDAPI_KEY;
const RAPIDAPI_HOST = process.env.PROPDATA_RAPIDAPI_HOST || 'propdata-real-estate-market-intelligence-api.p.rapidapi.com';
const BASE_URL = `https://${RAPIDAPI_HOST}`;

// In-process LRU cache. Key = `${path}?${sortedParams}`. Value = { body, expiresAt }.
// 1-hour TTL keeps RapidAPI quota healthy. 500 entry cap is enough for normal usage
// without bloating the node process — eviction is FIFO via Map insertion order.
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
  // LRU touch: re-insert to move to end of Map iteration order
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

// Per-user rate limit for PropData. Bumped from 5 → 60 after PR #183's
// multi-location fan-out — a single state search fires up to 25 ZIPs in
// seconds. 60/min still protects the shared RapidAPI quota (~1k/min at
// our plan tier) from any single user spamming. Cache hits don't count.
const RATE_LIMIT_PER_MIN = 60;

async function proxy(req, res, endpoint, allowedParams) {
  if (!RAPIDAPI_KEY) {
    return res.status(503).json({ error: 'PropData not configured' });
  }

  // Whitelist params: only forward keys the endpoint actually accepts, so a
  // malicious client can't smuggle arbitrary query strings to the upstream.
  const params = {};
  for (const key of allowedParams) {
    const v = req.query[key];
    if (v !== undefined && v !== '') params[key] = String(v);
  }

  const key = cacheKey(endpoint, params);
  const cached = cacheGet(key);
  if (cached) {
    res.set('X-PropData-Cache', 'HIT');
    return res.json(cached);
  }

  const rateLimit = await checkDatabaseRateLimit(req.user.id, 'propdata', RATE_LIMIT_PER_MIN, 1);
  if (!rateLimit.allowed) {
    return res.status(429).json({ error: 'Rate limit exceeded. Try again in a minute.' });
  }

  try {
    const upstream = await axios.get(`${BASE_URL}${endpoint}`, {
      params,
      headers: {
        'x-rapidapi-key': RAPIDAPI_KEY,
        'x-rapidapi-host': RAPIDAPI_HOST,
      },
      timeout: 15000,
      validateStatus: () => true,
    });

    // PropData often returns `{error, status: 404}` with HTTP 200. Don't cache
    // those — the data may show up tomorrow.
    const body = upstream.data;
    if (upstream.status >= 200 && upstream.status < 300 && !body?.error) {
      cacheSet(key, body);
    }

    res.set('X-PropData-Cache', 'MISS');
    return res.status(upstream.status).json(body);
  } catch (err) {
    const msg = err.code === 'ECONNABORTED' ? 'PropData upstream timeout' : err.message;
    console.error(`[propdata] ${endpoint} failed:`, msg);
    return res.status(502).json({ error: msg });
  }
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
router.get('/property',      authenticate, asyncHandler((req, res) => proxy(req, res, '/v1/property', [
  'zip', 'address', 'apn', 'owner', 'absentee_only', 'limit',
])));

// Zillow autocomplete — different RapidAPI host but SAME marketplace subscription.
// Migrated here so the key never leaves the backend.
router.get('/zillow-autocomplete', authenticate, asyncHandler(async (req, res) => {
  if (!RAPIDAPI_KEY) return res.status(503).json({ error: 'Not configured' });
  const q = String(req.query.query || '').trim();
  if (!q) return res.json({ suggestions: [] });

  const key = `zillow-autocomplete?q=${q.toLowerCase()}`;
  const cached = cacheGet(key);
  if (cached) {
    res.set('X-PropData-Cache', 'HIT');
    return res.json(cached);
  }

  const rateLimit = await checkDatabaseRateLimit(req.user.id, 'propdata-autocomplete', 30, 1);
  if (!rateLimit.allowed) return res.status(429).json({ error: 'Rate limit exceeded' });

  try {
    const upstream = await axios.get('https://zillow-scraper-api.p.rapidapi.com/zillow/search/autocomplete', {
      params: { query: q },
      headers: {
        'x-rapidapi-key': RAPIDAPI_KEY,
        'x-rapidapi-host': 'zillow-scraper-api.p.rapidapi.com',
      },
      timeout: 8000,
      validateStatus: () => true,
    });
    const suggestions = upstream.data?.data?.suggestions || [];
    const body = { suggestions };
    if (upstream.status >= 200 && upstream.status < 300) cacheSet(key, body);
    res.set('X-PropData-Cache', 'MISS');
    return res.json(body);
  } catch (err) {
    console.error('[propdata] zillow-autocomplete failed:', err.message);
    return res.json({ suggestions: [] });
  }
}));

module.exports = router;
