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

  const data = await proxyZillow(action, searchParams || {}, {
    userId: req.user.id,
  });
  return res.json({ success: true, data });
}

module.exports = { proxyHandler };
