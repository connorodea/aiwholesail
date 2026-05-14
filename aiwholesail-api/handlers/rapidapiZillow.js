/**
 * Pure handler functions for /rapidapi/zillow/*.
 *
 * Kept separate from routes/rapidapiZillow.js so they can be unit-tested
 * without booting express. The route file is a thin wrapper that just wires
 * these handlers into a Router.
 */
const { checkDatabaseRateLimit } = require('../middleware/rateLimit');
const { proxyZillow } = require('../lib/agent/zillowProxy');
const { ZillowScrapeError } = require('../lib/scrapers/zillowScrapeDo');

async function proxyHandler(req, res) {
  const { action, searchParams } = req.body || {};
  if (!action || typeof action !== 'string') {
    return res.status(400).json({ success: false, error: 'action required' });
  }

  // Per-consumer throttle. RapidAPI's gateway enforces plan quotas upstream;
  // this is the inner guard so a single consumer can't drain the scrape budget.
  const rateLimit = await checkDatabaseRateLimit(
    req.user.id,
    'rapidapi-zillow-proxy',
    60,
    1
  );
  if (!rateLimit.allowed) {
    return res.status(429).json({ success: false, error: 'Rate limit exceeded' });
  }

  try {
    const data = await proxyZillow(action, searchParams || {}, {
      userId: req.user.id,
    });
    return res.json({ success: true, data });
  } catch (err) {
    // Soft-200 the "listing exists but this widget genuinely isn't there"
    // case. Consumers branch on data=null + reason; returning 500 here would
    // page on-call for a normal absence-of-data signal.
    if (
      err instanceof ZillowScrapeError &&
      (err.reason === 'no_data_in_payload' || err.reason === 'no_property_in_payload')
    ) {
      console.log(
        `[rapidapi-zillow] no-data passthrough action=${action} reason=${err.reason}`
      );
      return res.json({ success: true, data: null, reason: err.reason });
    }
    console.error(
      `[rapidapi-zillow] both backends failed for action=${action}: ${err.message}`
    );
    return res.status(500).json({
      success: false,
      error: err.message || 'Zillow proxy error',
    });
  }
}

async function batchHandler(req, res) {
  const zpids = Array.isArray(req.body?.zpids)
    ? req.body.zpids.filter((z) => typeof z === 'string' && z)
    : null;
  if (!zpids || zpids.length === 0) {
    return res.status(400).json({ success: false, error: 'zpids array required' });
  }
  if (zpids.length > 100) {
    return res.status(400).json({ success: false, error: 'max 100 zpids per batch' });
  }
}

module.exports = { proxyHandler, batchHandler };
