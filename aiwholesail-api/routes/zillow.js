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

module.exports = router;
