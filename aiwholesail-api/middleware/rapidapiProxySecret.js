const crypto = require('node:crypto');

function rapidapiProxySecret(req, res, next) {
  const expected = process.env.RAPIDAPI_PROXY_SECRET;
  if (!expected) {
    console.error(
      '[rapidapi-proxy-secret] RAPIDAPI_PROXY_SECRET not set — refusing all requests'
    );
    return res.status(503).json({
      success: false,
      error: 'Gateway not configured',
    });
  }
  const provided =
    req.get('x-rapidapi-proxy-secret') || req.get('X-RapidAPI-Proxy-Secret');
  if (!provided) {
    return res.status(401).json({
      success: false,
      error: 'Invalid or missing proxy secret',
    });
  }
  // Timing-safe compare. Naive === leaks the secret one byte at a time.
  const a = Buffer.from(String(provided));
  const b = Buffer.from(String(expected));
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return res.status(401).json({
      success: false,
      error: 'Invalid or missing proxy secret',
    });
  }
  next();
}

module.exports = { rapidapiProxySecret };
