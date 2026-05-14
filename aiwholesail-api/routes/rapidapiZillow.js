/**
 * Zillow routes exposed to RapidAPI consumers.
 *
 * Mirrors routes/zillow.js minus the session JWT `authenticate` middleware —
 * auth here is the proxy-secret check applied at the mount level in
 * index.js. `req.user` is synthesized by that middleware to carry the
 * RapidAPI consumer identity so the rate-limit code can bucket per-consumer.
 *
 * Why a separate file (vs reusing routes/zillow.js with a swapped auth):
 * the existing zillow router has `authenticate` baked in inline per-route.
 * Editing it would risk the frontend's production path. Keeping the two
 * surfaces separate makes the gateway path strictly additive — zero blast
 * radius on the live frontend.
 *
 * Companion repo: github.com/connorodea/aiwholesail-rapidapi
 * Spec mapping:   openapi/zillow.yaml maps clean REST endpoints
 *                 (/property/{zpid}, /search, /estimate/...) onto the action
 *                 multiplexer here via x-rapidapi-target-mapping.
 */
const express = require('express');
const { asyncHandler } = require('../middleware/errorHandler');
const { checkDatabaseRateLimit } = require('../middleware/rateLimit');
const { proxyZillow } = require('../lib/agent/zillowProxy');
const { ZillowScrapeError } = require('../lib/scrapers/zillowScrapeDo');

const router = express.Router();

/**
 * POST /rapidapi/zillow/proxy
 * Body: { action: string, searchParams?: object }
 * Reply: { success: true, data: <any> } | { success: false, error: string }
 *
 * Same action vocabulary as the frontend route — see lib/agent/zillowProxy.js
 * SCRAPE_DO_ACTIONS for the full list (propertyDetails, zestimate, search,
 * forSale, forRent, foreclosures, walkScore, climateRisk, etc.).
 */
router.post('/proxy', asyncHandler(async (req, res) => {
  const { action, searchParams } = req.body || {};
  if (!action || typeof action !== 'string') {
    return res.status(400).json({ success: false, error: 'action required' });
  }

  // Per-consumer rate limit. RapidAPI's own gateway enforces the plan quota
  // (10k/100k/1M from PRO/ULTRA/MEGA) upstream; this is the inner throttle
  // so a single hyperactive consumer can't blow the scrape.do budget.
  const rateLimit = await checkDatabaseRateLimit(req.user.id, 'rapidapi-zillow-proxy', 60, 1);
  if (!rateLimit.allowed) {
    return res.status(429).json({ success: false, error: 'Rate limit exceeded' });
  }

  try {
    const data = await proxyZillow(action, searchParams || {}, { userId: req.user.id });
    res.json({ success: true, data });
  } catch (err) {
    // Soft-200 the "this listing genuinely lacks this widget" case. Same
    // contract as routes/zillow.js — see comment there for the rationale.
    if (
      err instanceof ZillowScrapeError &&
      (err.reason === 'no_data_in_payload' || err.reason === 'no_property_in_payload')
    ) {
      console.log(`[rapidapi-zillow] no-data passthrough action=${action} reason=${err.reason}`);
      return res.json({ success: true, data: null, reason: err.reason });
    }
    console.error(`[rapidapi-zillow] both backends failed for action=${action}: ${err.message}`);
    res.status(500).json({ success: false, error: err.message || 'Zillow proxy error' });
  }
}));

/**
 * POST /rapidapi/zillow/proxy/batch-zestimates
 * Body: { zpids: string[] }   (max 100)
 * Reply: { success: true, data: { [zpid]: number|null } }
 */
router.post('/proxy/batch-zestimates', asyncHandler(async (req, res) => {
  const zpids = Array.isArray(req.body?.zpids)
    ? req.body.zpids.filter((z) => typeof z === 'string' && z)
    : null;
  if (!zpids || zpids.length === 0) {
    return res.status(400).json({ success: false, error: 'zpids array required' });
  }
  if (zpids.length > 100) {
    return res.status(400).json({ success: false, error: 'max 100 zpids per batch' });
  }

  const rateLimit = await checkDatabaseRateLimit(req.user.id, 'rapidapi-zillow-proxy', 60, 1);
  if (!rateLimit.allowed) {
    return res.status(429).json({ success: false, error: 'Rate limit exceeded' });
  }

  const CONCURRENCY = 8;
  const data = {};
  let idx = 0;
  const workers = new Array(Math.min(CONCURRENCY, zpids.length)).fill(0).map(async () => {
    while (idx < zpids.length) {
      const zpid = zpids[idx++];
      try {
        const r = await proxyZillow('zestimate', { zpid }, { userId: req.user.id });
        data[zpid] = typeof r === 'number' ? r : (r?.zestimate ?? r?.value ?? null);
      } catch (err) {
        data[zpid] = null;
      }
    }
  });
  await Promise.all(workers);
  res.json({ success: true, data });
}));

module.exports = router;
