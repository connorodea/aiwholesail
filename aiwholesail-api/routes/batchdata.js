/**
 * BatchData proxy — off-market data + skip tracing.
 *
 * Why this exists
 * ---------------
 * PropData (RapidAPI) is dead-in-the-water for our use case:
 *   - `absentee_only=true` filter silently ignored (verified live: 0/46 records
 *     across 5 ZIPs had is_absentee_owner=true).
 *   - Coverage gaps (Austin TX: 0 records for 78737).
 *   - Pre-foreclosure delta returns 0 records w/ {message} envelope.
 *
 * BatchData is the dedicated off-market wholesaler data vendor with proper
 * absentee / equity / pre-foreclosure / tax-delinquent quick-lists. This
 * route mirrors the propdata.js shape (in-process LRU cache, per-user rate
 * limit, structured errors) so the frontend can swap providers behind a
 * feature flag without changing call sites.
 *
 * Endpoints we expose (all POST, auth required):
 *   POST /api/batchdata/property/search       — search by criteria + quicklists
 *   POST /api/batchdata/property/skip-trace   — sync skip-trace up to 100 props
 *   POST /api/batchdata/property/skip-trace/async — async skip-trace, larger batches
 *
 * Auth shape upstream: Bearer token in Authorization header. Body is
 * passed through to BatchData verbatim — we don't translate field names.
 * This keeps the proxy thin and lets the frontend speak BatchData's
 * native schema (no impedance mismatch when their API evolves).
 *
 * Cost protection:
 *   - LRU cache: 500 entries, 15-min TTL for property/search; skip-trace
 *     is NOT cached (PII + per-request billing).
 *   - Per-user rate limit: 30/min for search, 10/min for skip-trace.
 *   - Each property record in a search response counts as a billable
 *     API request per BatchData's pricing — keep `options.take` modest
 *     and prefer caching.
 *
 * Env:
 *   BATCHDATA_API_KEY     (required) — Bearer token for api.batchdata.com
 *   BATCHDATA_BASE_URL    (optional) — defaults to https://api.batchdata.com
 */
const express = require('express');
const axios = require('axios');
const { authenticate } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');
const { checkDatabaseRateLimit } = require('../middleware/rateLimit');

const router = express.Router();

const API_KEY = process.env.BATCHDATA_API_KEY;
const BASE_URL = process.env.BATCHDATA_BASE_URL || 'https://api.batchdata.com';
const TIMEOUT_MS = 30000;

const CACHE_MAX = 500;
const SEARCH_CACHE_TTL_MS = 15 * 60 * 1000;
const cache = new Map();

function cacheKey(path, body) {
  return `${path}:${JSON.stringify(body)}`;
}
function cacheGet(key) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (entry.expiresAt < Date.now()) { cache.delete(key); return null; }
  cache.delete(key);
  cache.set(key, entry);
  return entry.body;
}
function cacheSet(key, body, ttlMs) {
  if (cache.size >= CACHE_MAX) {
    const oldest = cache.keys().next().value;
    cache.delete(oldest);
  }
  cache.set(key, { body, expiresAt: Date.now() + ttlMs });
}

/**
 * POST upstream to BatchData. Pure pass-through — `body` is forwarded
 * verbatim. We don't validate the shape (BatchData's 400s carry useful
 * messages that should bubble back to the client unchanged).
 */
async function postUpstream(path, body) {
  if (!API_KEY) {
    const err = new Error('BATCHDATA_API_KEY not configured');
    err.status = 503;
    throw err;
  }
  const resp = await axios.post(`${BASE_URL}${path}`, body, {
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
    },
    timeout: TIMEOUT_MS,
    validateStatus: () => true,
  });
  return resp;
}

/**
 * POST /api/batchdata/property/search
 *
 * Forward the request body verbatim. Accepts whatever BatchData's
 * property/search endpoint accepts — including `searchCriteria` with
 * quicklists (preForeclosure, absenteeOwner, highEquity, taxDelinquent,
 * vacant, etc.) and `options` (take/skip pagination).
 *
 * Cached for 15 min keyed on the full request body — re-running the same
 * filter set within the window is free.
 */
router.post('/property/search', authenticate, asyncHandler(async (req, res) => {
  const rl = await checkDatabaseRateLimit(req.user.id, 'batchdata-search', 30, 1);
  if (!rl.allowed) return res.status(429).json({ error: 'Rate limit exceeded' });

  const body = req.body || {};
  const key = cacheKey('/api/v1/property/search', body);
  const hit = cacheGet(key);
  if (hit) {
    res.set('X-Cache', 'HIT');
    return res.json(hit);
  }

  let resp;
  try {
    resp = await postUpstream('/api/v1/property/search', body);
  } catch (err) {
    if (err.status === 503) return res.status(503).json({ error: err.message });
    console.error(`[batchdata] search upstream error: ${err.message}`);
    return res.status(502).json({ error: 'BatchData upstream unreachable', message: err.message });
  }

  // BatchData carries its own status envelope. Pass status code + body
  // straight through so the client sees the real error (validation msgs,
  // insufficient-balance hints, etc.).
  if (resp.status >= 200 && resp.status < 300) {
    cacheSet(key, resp.data, SEARCH_CACHE_TTL_MS);
    res.set('X-Cache', 'MISS');
  }
  return res.status(resp.status).json(resp.data);
}));

/**
 * POST /api/batchdata/property/skip-trace
 *
 * Synchronous skip-trace. Body forwarded verbatim — BatchData accepts up
 * to 100 properties per request. NOT cached: skip-trace is PII + per-
 * record billing, hits are pure waste.
 */
router.post('/property/skip-trace', authenticate, asyncHandler(async (req, res) => {
  const rl = await checkDatabaseRateLimit(req.user.id, 'batchdata-skip-trace', 10, 1);
  if (!rl.allowed) return res.status(429).json({ error: 'Rate limit exceeded' });

  let resp;
  try {
    resp = await postUpstream('/api/v1/property/skip-trace', req.body || {});
  } catch (err) {
    if (err.status === 503) return res.status(503).json({ error: err.message });
    console.error(`[batchdata] skip-trace upstream error: ${err.message}`);
    return res.status(502).json({ error: 'BatchData upstream unreachable', message: err.message });
  }
  return res.status(resp.status).json(resp.data);
}));

/**
 * POST /api/batchdata/property/skip-trace/async
 *
 * Async variant for large batches (BatchData docs reference an async
 * endpoint for batches that exceed the sync limit). Returns a job
 * handle the caller polls.
 */
router.post('/property/skip-trace/async', authenticate, asyncHandler(async (req, res) => {
  const rl = await checkDatabaseRateLimit(req.user.id, 'batchdata-skip-trace', 10, 1);
  if (!rl.allowed) return res.status(429).json({ error: 'Rate limit exceeded' });

  let resp;
  try {
    resp = await postUpstream('/api/v1/property/skip-trace/async', req.body || {});
  } catch (err) {
    if (err.status === 503) return res.status(503).json({ error: err.message });
    console.error(`[batchdata] skip-trace/async upstream error: ${err.message}`);
    return res.status(502).json({ error: 'BatchData upstream unreachable', message: err.message });
  }
  return res.status(resp.status).json(resp.data);
}));

module.exports = router;
