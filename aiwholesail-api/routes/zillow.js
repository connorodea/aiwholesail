/**
 * Zillow proxy — wraps the agent-tool `proxyZillow` helper as a generic
 * `POST /api/zillow/proxy` endpoint for the frontend on-market path.
 *
 * Why this exists
 * ---------------
 * The frontend `src/lib/zillow-api.ts` calls a Zillow proxy with the shape
 * `{ action, searchParams }` and expects `{ success, data }` back. Until
 * now it hit a standalone proxy service at `api.aiwholesail.com/zillow/zillow`
 * (port 3201) directly — which is the SAME service `proxyZillow` calls as
 * its RapidAPI primary. But the frontend's path bypassed the wrapper
 * entirely, so when the proxy 500'd on quota (its RapidAPI hit limits),
 * the frontend never got the scrape.do fallback.
 *
 * This route puts the wrapper IN FRONT of the frontend's call so the
 * fallback chain (RapidAPI → scrape.do) actually fires for on-market
 * search too — same protection the backend routes have had since PR #291.
 *
 * Contract:
 *   POST /api/zillow/proxy
 *   body: { action: string, searchParams?: object }
 *   200:  { success: true, data: <whatever proxyZillow returned> }
 *   500:  { success: false, error: <message> }   (after both backends failed)
 */
const express = require('express');
const { authenticate } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');
const { checkDatabaseRateLimit } = require('../middleware/rateLimit');
const { proxyZillow } = require('../lib/agent/zillowProxy');

const router = express.Router();

router.post('/proxy', authenticate, asyncHandler(async (req, res) => {
  const { action, searchParams } = req.body || {};
  if (!action || typeof action !== 'string') {
    return res.status(400).json({ success: false, error: 'action required' });
  }

  // Per-user rate limit. The standalone proxy already enforces an upstream
  // quota; this throttle just keeps a single client from monopolising it.
  // 60/min matches the propdata budget — covers typing-fast autocomplete
  // and ad-hoc searches without bothering normal usage.
  const rateLimit = await checkDatabaseRateLimit(req.user.id, 'zillow-proxy', 60, 1);
  if (!rateLimit.allowed) {
    return res.status(429).json({ success: false, error: 'Rate limit exceeded' });
  }

  try {
    const data = await proxyZillow(action, searchParams || {}, { userId: req.user.id });
    res.json({ success: true, data });
  } catch (err) {
    // proxyZillow throws the ORIGINAL RapidAPI error when both backends
    // fail (preserved error shape contract). Log + return 500 with the
    // existing `{ success: false, error }` envelope the frontend expects.
    console.error(`[zillow-proxy] both backends failed for action=${action}: ${err.message}`);
    res.status(500).json({ success: false, error: err.message || 'Zillow proxy error' });
  }
}));

/**
 * POST /api/zillow/proxy/batch-zestimates
 *
 * Frontend `enrichWithZestimates` (src/lib/zillow-api.ts) computes the
 * batch URL by stripping a trailing `/zillow` from ZILLOW_API_URL and
 * appending `/batch-zestimates`. After PR #313 switched the URL to
 * `/api/zillow/proxy`, that regex no longer matches and the resulting
 * path becomes `/api/zillow/proxy/batch-zestimates` — which had no
 * route until now (live 404s for every search that completed).
 *
 * This handler fans out to proxyZillow('zestimate', {zpid}) per zpid
 * with bounded concurrency (8) so a 50-zpid batch finishes in ~3-5s
 * instead of 20+s sequential. Failed zpids resolve to null; the
 * caller already tolerates that.
 *
 * Body:   { zpids: string[] }       (max 100 per call)
 * Reply:  { success: true, data: { [zpid]: number|null } }
 */
router.post('/proxy/batch-zestimates', authenticate, asyncHandler(async (req, res) => {
  const zpids = Array.isArray(req.body?.zpids) ? req.body.zpids.filter((z) => typeof z === 'string' && z) : null;
  if (!zpids || zpids.length === 0) {
    return res.status(400).json({ success: false, error: 'zpids array required' });
  }
  if (zpids.length > 100) {
    return res.status(400).json({ success: false, error: 'max 100 zpids per batch' });
  }

  const rateLimit = await checkDatabaseRateLimit(req.user.id, 'zillow-proxy', 60, 1);
  if (!rateLimit.allowed) {
    return res.status(429).json({ success: false, error: 'Rate limit exceeded' });
  }

  // Concurrency-bounded fan-out. The standalone proxy + scrape.do both
  // get hit per-zpid; 8 in flight gives ~4s wall-clock for 50 zpids
  // without blowing the upstream rate limits.
  const CONCURRENCY = 8;
  const data = {};
  let idx = 0;
  const workers = new Array(Math.min(CONCURRENCY, zpids.length)).fill(0).map(async () => {
    while (idx < zpids.length) {
      const zpid = zpids[idx++];
      try {
        const r = await proxyZillow('zestimate', { zpid }, { userId: req.user.id });
        // Normalize: proxy returns either {zestimate: N} or N directly.
        data[zpid] = typeof r === 'number' ? r : (r?.zestimate ?? r?.value ?? null);
      } catch (err) {
        // Single-zpid failure shouldn't kill the batch.
        data[zpid] = null;
      }
    }
  });
  await Promise.all(workers);
  res.json({ success: true, data });
}));

module.exports = router;
