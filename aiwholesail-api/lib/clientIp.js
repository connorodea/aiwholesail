/**
 * Single source of truth for client IP extraction.
 *
 * With `app.set('trust proxy', 1)` in index.js, Express populates req.ip from
 * the first untrusted hop in X-Forwarded-For. The header fallbacks below are
 * kept for unusual deploys (direct connections without nginx, alternate LBs
 * that set X-Real-IP, etc.) but should not normally fire.
 *
 * Callers that need a stable rate-limit key should use this helper rather
 * than reading the headers inline — keeps the parsing in one place if the
 * deploy topology ever changes.
 */
function clientIp(req) {
  const fromExpress = typeof req.ip === 'string' ? req.ip : null;
  if (fromExpress) return fromExpress;
  const xff = req.headers?.['x-forwarded-for'];
  if (typeof xff === 'string' && xff.length > 0) {
    return xff.split(',')[0].trim();
  }
  const xri = req.headers?.['x-real-ip'];
  if (typeof xri === 'string' && xri.length > 0) return xri;
  return 'unknown';
}

module.exports = { clientIp };
