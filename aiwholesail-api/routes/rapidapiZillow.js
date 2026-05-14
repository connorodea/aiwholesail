const express = require('express');
const { asyncHandler } = require('../middleware/errorHandler');
const { checkDatabaseRateLimit } = require('../middleware/rateLimit');
const { proxyZillow } = require('../lib/agent/zillowProxy');
const { ZillowScrapeError } = require('../lib/scrapers/zillowScrapeDo');

const router = express.Router();

router.post('/proxy', asyncHandler(async (req, res) => {
  const { action, searchParams } = req.body || {};
  if (!action || typeof action !== 'string') {
    return res.status(400).json({ success: false, error: 'action required' });
  }
}));

module.exports = router;
