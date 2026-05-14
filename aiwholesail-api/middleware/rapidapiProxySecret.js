/**
 * RapidAPI gateway secret check.
 *
 * The RapidAPI gateway proxies consumer requests to our origin and injects an
 * `X-RapidAPI-Proxy-Secret` header it shares only with us. This middleware
 * validates that header (timing-safe) so bare-internet hits to our gateway
 * routes get a 401 — only metered RapidAPI traffic passes.
 *
 * Mount pattern (index.js):
 *
 *   if (process.env.RAPIDAPI_GATEWAY_ENABLED === 'true') {
 *     const { rapidapiProxySecret } = require('./middleware/rapidapiProxySecret');
 *     app.use('/rapidapi/zillow', rapidapiProxySecret, rapidapiZillowRoutes);
 *   }
 *
 * Required env:
 *   - RAPIDAPI_GATEWAY_ENABLED=true  (kill switch; default off)
 *   - RAPIDAPI_PROXY_SECRET=<value>  (copy FROM the RapidAPI provider
 *     dashboard → Hub Listing → Gateway → Firewall Settings. Don't generate
 *     your own — the gateway only knows about the dashboard-issued value.)
 *
 * Companion repo: github.com/connorodea/aiwholesail-rapidapi
 */
const crypto = require('node:crypto');

// Whitelist for the synthesized req.user.id — RapidAPI's `x-rapidapi-user`
// header is an opaque identifier we don't fully trust. Cap + sanitize so it
// can't poison rate-limit keys, logs, or downstream string contexts.
const SAFE_USER_RE = /[^A-Za-z0-9_-]/g;

function safeUser(raw) {
  if (!raw || typeof raw !== 'string') return 'unknown';
  return raw.replace(SAFE_USER_RE, '').slice(0, 64) || 'unknown';
}

function rapidapiProxySecret(req, res, next) {
  const expected = process.env.RAPIDAPI_PROXY_SECRET;
  if (!expected) {
    // Fail closed if the secret isn't configured. We'd rather 503 than let
    // anonymous traffic through by accident.
    console.error('[rapidapi-proxy-secret] RAPIDAPI_PROXY_SECRET not set — refusing all requests');
    return res.status(503).json({ success: false, error: 'Gateway not configured' });
  }
  const provided = req.get('x-rapidapi-proxy-secret') || req.get('X-RapidAPI-Proxy-Secret');
  if (!provided) {
    return res.status(401).json({ success: false, error: 'Invalid or missing proxy secret' });
  }

  // Timing-safe comparison. `provided` is attacker-controlled; a naive `===`
  // is a textbook timing oracle that can leak the secret one byte at a time.
  const a = Buffer.from(String(provided));
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return res.status(401).json({ success: false, error: 'Invalid or missing proxy secret' });
  }

  // Synthesize a system user so downstream handlers (which rely on req.user
  // from the JWT path) keep working. The RapidAPI consumer identity comes
  // from `x-rapidapi-user` (a stable, opaque per-consumer id) and
  // `x-rapidapi-subscription` (which plan they're on).
  req.user = req.user || {
    id: `rapidapi:${safeUser(req.get('x-rapidapi-user'))}`,
    plan: req.get('x-rapidapi-subscription') || 'BASIC',
    source: 'rapidapi',
  };
  next();
}

module.exports = { rapidapiProxySecret, safeUser };
