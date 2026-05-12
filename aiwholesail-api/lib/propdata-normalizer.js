/**
 * PropData response normalizer.
 *
 * PropData has two failure modes that look identical to a naive proxy:
 *
 *   1. HTTP 2xx + body `{ error: "...", status: 404 }` — "no data for
 *      this region". Coverage gap, not a server error.
 *   2. HTTP 5xx — actual upstream error (RapidAPI / PropData down).
 *
 * Without normalization, both flow to the client as `{ error }` with
 * inconsistent HTTP semantics, forcing callers to string-match the
 * message to decide what to do. This module converts upstream responses
 * into a uniform shape with a structured `code` so callers can branch
 * cleanly.
 *
 * Pure functions only — no axios, no Express. Unit-testable with
 * `node:test`. The Express adapter lives in routes/propdata.js.
 */

const ERROR_CODES = Object.freeze({
  OK: 'OK',
  NO_COVERAGE: 'NO_COVERAGE',           // upstream 2xx + body.error (coverage gap, retry won't help)
  NOT_FOUND: 'NOT_FOUND',               // upstream 404 — record doesn't exist
  RATE_LIMITED: 'RATE_LIMITED',         // upstream 429
  UPSTREAM_ERROR: 'UPSTREAM_ERROR',     // upstream 5xx
  TIMEOUT: 'TIMEOUT',                   // request aborted client-side
  NOT_CONFIGURED: 'NOT_CONFIGURED',     // env var missing
  NETWORK: 'NETWORK',                   // ECONNRESET / DNS / etc
});

/**
 * Per-endpoint timeout (milliseconds). Tighter for health checks,
 * looser for bulk property fan-outs which can legitimately take 10-20s
 * upstream when PropData is paginating large counties.
 */
const TIMEOUTS = Object.freeze({
  '/v1/health':       5_000,
  '/v1/stats':        5_000,
  '/v1/geocode':      8_000,
  '/v1/property':    30_000,   // bulk absentee_only=true can be slow
  // sensible default for everything else
  _default:          15_000,
});

function getEndpointTimeout(endpoint) {
  return TIMEOUTS[endpoint] ?? TIMEOUTS._default;
}

/**
 * Convert an axios-shaped upstream response into the normalized shape
 * the proxy returns to clients.
 *
 * @param {{status: number, data: any}} upstream — axios response
 * @returns {{ok: boolean, status: number, body: any, code: string}}
 *   - status: HTTP status to send to the client (may differ from upstream)
 *   - body: response body to forward (may add a `code` field)
 *   - code: structured error code (one of ERROR_CODES)
 */
function normalizeUpstreamResponse(upstream) {
  // Null / undefined / non-object → treat as upstream error so callers
  // never see "ok=true with no body" for a malformed response.
  if (!upstream || typeof upstream !== 'object') {
    return {
      ok: false,
      status: 502,
      code: ERROR_CODES.UPSTREAM_ERROR,
      body: { error: 'Empty upstream response', code: ERROR_CODES.UPSTREAM_ERROR },
    };
  }

  const { status, data } = upstream;

  // Hard upstream failure modes first.
  if (status === 429) {
    return {
      ok: false,
      status: 429,
      code: ERROR_CODES.RATE_LIMITED,
      body: { error: 'PropData rate limit hit. Try again in a minute.', code: ERROR_CODES.RATE_LIMITED },
    };
  }
  if (status === 404) {
    return {
      ok: false,
      status: 404,
      code: ERROR_CODES.NOT_FOUND,
      body: { error: 'Not found.', code: ERROR_CODES.NOT_FOUND },
    };
  }
  if (status >= 500) {
    return {
      ok: false,
      status: 502,
      code: ERROR_CODES.UPSTREAM_ERROR,
      body: { error: `Upstream returned ${status}.`, code: ERROR_CODES.UPSTREAM_ERROR },
    };
  }
  if (status < 200 || status >= 300) {
    return {
      ok: false,
      status: 502,
      code: ERROR_CODES.UPSTREAM_ERROR,
      body: { error: `Unexpected upstream status ${status}.`, code: ERROR_CODES.UPSTREAM_ERROR },
    };
  }

  // HTTP 2xx — but PropData's "no coverage for this region" footgun:
  // body = { error: "...", status: 404 } or similar. Surface that as
  // a 404 with NO_COVERAGE code so the client can show a meaningful
  // "PropData doesn't have parcel data for this state yet" message
  // instead of a generic upstream-error toast.
  if (data && typeof data === 'object' && (data.error || data.status === 404)) {
    return {
      ok: false,
      status: 404,
      code: ERROR_CODES.NO_COVERAGE,
      body: {
        error: data.error || 'No data available for this region.',
        code: ERROR_CODES.NO_COVERAGE,
      },
    };
  }

  // True success.
  return {
    ok: true,
    status: 200,
    code: ERROR_CODES.OK,
    body: data,
  };
}

/**
 * True iff this is a transient upstream error worth a single retry.
 * Network / 502 / 503 / 504 — yes. 429 / 4xx / NO_COVERAGE — no
 * (retry won't help and would burn quota).
 */
function isRetryableError(normalized) {
  return normalized.code === ERROR_CODES.UPSTREAM_ERROR;
}

module.exports = {
  ERROR_CODES,
  TIMEOUTS,
  getEndpointTimeout,
  normalizeUpstreamResponse,
  isRetryableError,
};
