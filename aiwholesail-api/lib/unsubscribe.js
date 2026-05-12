/**
 * Unsubscribe-link tokens.
 *
 * One-click unsubscribe (TCPA / CAN-SPAM compliance) requires a token
 * the recipient can click from their email client without first
 * authenticating. We sign a short JWT with:
 *
 *   { aud: 'buyer' | 'lead', id: row_id, iat, exp }
 *
 * The audience claim is a hard gate at verify time — a buyer-token
 * can NEVER be used to unsubscribe a lead and vice versa, even if
 * the IDs happen to collide.
 *
 * Tokens are valid for 1 year. CAN-SPAM requires the link to work
 * for at least 30 days; 1 year covers users who archive emails and
 * dig them up later. The audience+id pair is also stable across the
 * lifetime of the buyer row, so old emails keep working until the
 * row is deleted.
 *
 * Signing key: reuses the main JWT_SECRET. If the operator rotates
 * that secret, old unsubscribe links break — that's acceptable
 * (the recipient can still email support to opt out).
 */

const jwt = require('jsonwebtoken');

const TOKEN_TTL_SECONDS = 365 * 24 * 60 * 60; // 1 year

const VALID_AUDIENCES = new Set(['buyer', 'lead']);

function sign(audience, id) {
  if (!VALID_AUDIENCES.has(audience)) {
    throw new Error(`unsubscribe token: unknown audience '${audience}'`);
  }
  if (!id || typeof id !== 'string') {
    throw new Error('unsubscribe token: id required');
  }
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET not configured');
  return jwt.sign({ aud: audience, id }, secret, {
    expiresIn: TOKEN_TTL_SECONDS,
  });
}

/**
 * Returns { audience, id } on success, null on any failure (invalid
 * signature, expired, malformed, unknown audience). Never throws to
 * the public endpoint — the route returns a generic 400 to avoid
 * leaking which tokens are valid.
 */
function verify(token) {
  if (!token || typeof token !== 'string') return null;
  const secret = process.env.JWT_SECRET;
  if (!secret) return null;
  try {
    const decoded = jwt.verify(token, secret);
    if (!decoded || typeof decoded !== 'object') return null;
    if (!VALID_AUDIENCES.has(decoded.aud)) return null;
    if (!decoded.id || typeof decoded.id !== 'string') return null;
    return { audience: decoded.aud, id: decoded.id };
  } catch {
    return null;
  }
}

/**
 * Build the public URL the recipient clicks. Reads FRONTEND_URL with a
 * production default — same convention as other email-link builders
 * in this codebase. Note: the link points at the API host because the
 * endpoint is a pure server-rendered HTML page (no client app needed).
 */
function buildUnsubscribeUrl(audience, id) {
  const token = sign(audience, id);
  const { apiUrl } = require('./env-urls');
  return `${apiUrl()}/api/unsubscribe/${encodeURIComponent(token)}`;
}

module.exports = { sign, verify, buildUnsubscribeUrl };
