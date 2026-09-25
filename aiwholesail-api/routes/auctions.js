/**
 * Proxy to the aiwholesail-auctions-api Python service.
 *
 * Mounted at `/api/auctions/*`. Keeps the frontend talking to a single
 * origin (`api.aiwholesail.com`) — same posture as `/api/offmarket-iq/*`.
 *
 * Routes:
 *   GET  /api/auctions/health   → GET /health (open; sanity check)
 *   GET  /api/auctions          → GET /api/v1/auctions (list w/ filters)
 *
 * Auth: every customer-facing route requires the AIWholesail user to be
 * authenticated (same `authenticate` middleware as PropData / off-market).
 * The proxy adds the AUCTIONS_API_KEY bearer when calling upstream.
 * Per-user rate limit lives in the Node service via checkDatabaseRateLimit.
 */

const express = require('express');
const { authenticate } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');
const { checkDatabaseRateLimit } = require('../middleware/rateLimit');
const { buildRequest, getAuctionsBaseUrl } = require('../lib/auctions-client');

const router = express.Router();

const RATE_LIMIT_PER_MIN = 60;  // Match the off-market interactive bucket.

function getAuctionsApiKey() {
  return process.env.AUCTIONS_API_KEY;
}

async function proxy(req, res, method, path, options = {}) {
  const apiKey = getAuctionsApiKey();
  if (!apiKey) {
    return res.status(503).json({
      error: 'Auctions API not configured',
      code: 'NOT_CONFIGURED',
    });
  }

  if (req.user?.id) {
    const rl = await checkDatabaseRateLimit(
      req.user.id,
      'auctions',
      RATE_LIMIT_PER_MIN,
      1,
    );
    if (!rl.allowed) {
      return res.status(429).json({
        error: 'Rate limit exceeded. Try again in a minute.',
        code: 'RATE_LIMITED',
      });
    }
  }

  let request;
  try {
    request = buildRequest({
      apiKey,
      baseUrl: getAuctionsBaseUrl(),
      method,
      path,
      body: options.body,
      query: options.query,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message, code: 'CLIENT_BUILD_ERROR' });
  }

  let upstream;
  try {
    upstream = await fetch(request.url, {
      method: request.method,
      headers: request.headers,
      body: request.body,
      signal: AbortSignal.timeout(30_000),
    });
  } catch (err) {
    const isTimeout = err.name === 'TimeoutError' || /timed out/i.test(err.message || '');
    return res.status(isTimeout ? 504 : 502).json({
      error: isTimeout ? 'Auctions API upstream timeout' : 'Auctions API network error',
      code: isTimeout ? 'TIMEOUT' : 'NETWORK',
    });
  }

  res.status(upstream.status);
  const data = await upstream.json().catch(() => ({}));
  return res.json(data);
}

// Open health probe — no auth, mirrors the Python service's /health.
router.get('/health', asyncHandler(async (req, res) => {
  const apiKey = getAuctionsApiKey();
  if (!apiKey) {
    return res.status(503).json({ error: 'Auctions API not configured', code: 'NOT_CONFIGURED' });
  }
  try {
    const r = await fetch(`${getAuctionsBaseUrl()}/health`, {
      signal: AbortSignal.timeout(5_000),
    });
    const body = await r.json().catch(() => ({}));
    return res.status(r.status).json(body);
  } catch (err) {
    return res.status(502).json({ error: err.message, code: 'NETWORK' });
  }
}));

// Auction listings — paginated, filterable. Forwards query params verbatim.
router.get('/', authenticate, asyncHandler((req, res) =>
  proxy(req, res, 'GET', '/api/v1/auctions', {
    query: {
      state: req.query.state,
      city: req.query.city,
      source: req.query.source,
      auction_type: req.query.auction_type,
      status: req.query.status,
      min_price_cents: req.query.min_price_cents,
      max_price_cents: req.query.max_price_cents,
      page: req.query.page,
      page_size: req.query.page_size,
    },
  }),
));

module.exports = router;
