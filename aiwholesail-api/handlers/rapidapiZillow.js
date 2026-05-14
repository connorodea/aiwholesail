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
  const { action } = req.body || {};
  if (!action || typeof action !== 'string') {
    return res.status(400).json({ success: false, error: 'action required' });
  }
}

module.exports = { proxyHandler };
