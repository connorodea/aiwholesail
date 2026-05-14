const crypto = require('node:crypto');

// Cap + scrub the consumer id before it becomes part of req.user.id (which
// gets used downstream as a rate-limit bucket key and log field). Unbounded
// header values would otherwise let one bad actor fill the rate-limit table
// with junk keys; non-alphanumeric chars could break log parsers or SQL.
const SAFE_USER_RE = /[^A-Za-z0-9_-]/g;
function safeUser(raw) {
  if (!raw || typeof raw !== 'string') return 'unknown';
  return raw.replace(SAFE_USER_RE, '').slice(0, 64) || 'unknown';
}

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

  // Synthesize req.user from the RapidAPI consumer headers so downstream
  // handlers (which expect req.user from the JWT path) keep working without
  // forking. Namespaced id prefix distinguishes gateway traffic from frontend.
  req.user = req.user || {
    id: `rapidapi:${safeUser(req.get('x-rapidapi-user'))}`,
    plan: req.get('x-rapidapi-subscription') || 'BASIC',
    source: 'rapidapi',
  };
  next();
}

module.exports = { rapidapiProxySecret, safeUser };
