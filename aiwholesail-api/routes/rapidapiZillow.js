/**
 * Express wiring for /rapidapi/zillow/*. The actual handler logic lives in
 * handlers/rapidapiZillow.js so it can be unit-tested without express.
 */
const express = require('express');
const { asyncHandler } = require('../middleware/errorHandler');
const { proxyHandler, batchHandler } = require('../handlers/rapidapiZillow');

const router = express.Router();
router.post('/proxy', asyncHandler(proxyHandler));
router.post('/proxy/batch-zestimates', asyncHandler(batchHandler));

module.exports = router;
