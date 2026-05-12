/**
 * Unit tests for the PropData response normalizer.
 *
 * The normalizer's job is to convert PropData's two ambiguous failure
 * modes (HTTP 5xx + body-error-with-HTTP-2xx) into a consistent
 * `{ok, status, code, body}` shape with structured error codes.
 *
 *   $ npm test    (from aiwholesail-api/)
 *   $ node --test test/lib/propdata-normalizer.test.js
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  ERROR_CODES,
  getEndpointTimeout,
  normalizeUpstreamResponse,
  isRetryableError,
} = require('../../lib/propdata-normalizer');

test('getEndpointTimeout', async (t) => {
  await t.test('health is 5s', () => {
    assert.equal(getEndpointTimeout('/v1/health'), 5_000);
  });
  await t.test('stats is 5s', () => {
    assert.equal(getEndpointTimeout('/v1/stats'), 5_000);
  });
  await t.test('property is 30s (bulk-tolerant)', () => {
    assert.equal(getEndpointTimeout('/v1/property'), 30_000);
  });
  await t.test('unknown endpoint falls back to 15s default', () => {
    assert.equal(getEndpointTimeout('/v1/something-new'), 15_000);
    assert.equal(getEndpointTimeout('/v1/comps'), 15_000);
  });
});

test('normalizeUpstreamResponse', async (t) => {
  // ─── Happy path ──────────────────────────────────────────────────────
  await t.test('HTTP 200 with real data → ok=true, code=OK', () => {
    const r = normalizeUpstreamResponse({
      status: 200,
      data: { properties: [{ parcel_id: '123' }], count: 1 },
    });
    assert.equal(r.ok, true);
    assert.equal(r.status, 200);
    assert.equal(r.code, ERROR_CODES.OK);
    assert.deepEqual(r.body, { properties: [{ parcel_id: '123' }], count: 1 });
  });

  await t.test('HTTP 201 (uncommon but valid 2xx) → ok=true, code=OK', () => {
    const r = normalizeUpstreamResponse({ status: 201, data: { ok: true } });
    assert.equal(r.ok, true);
    assert.equal(r.code, ERROR_CODES.OK);
  });

  // ─── PropData footgun: 200 + body.error ──────────────────────────────
  await t.test('HTTP 200 + body.error → 404 with NO_COVERAGE code', () => {
    const r = normalizeUpstreamResponse({
      status: 200,
      data: { error: 'No property records found for this zip', status: 404 },
    });
    assert.equal(r.ok, false);
    assert.equal(r.status, 404);
    assert.equal(r.code, ERROR_CODES.NO_COVERAGE);
    assert.equal(r.body.code, ERROR_CODES.NO_COVERAGE);
    assert.match(r.body.error, /No property records/);
  });

  await t.test('HTTP 200 + body.status=404 (no body.error) → NO_COVERAGE', () => {
    // PropData sometimes returns {status: 404} without the explicit error key
    const r = normalizeUpstreamResponse({
      status: 200,
      data: { status: 404 },
    });
    assert.equal(r.ok, false);
    assert.equal(r.code, ERROR_CODES.NO_COVERAGE);
  });

  // ─── True upstream failures ──────────────────────────────────────────
  await t.test('HTTP 429 → status 429, code RATE_LIMITED', () => {
    const r = normalizeUpstreamResponse({
      status: 429,
      data: { message: 'Too many requests' },
    });
    assert.equal(r.ok, false);
    assert.equal(r.status, 429);
    assert.equal(r.code, ERROR_CODES.RATE_LIMITED);
    assert.equal(r.body.code, ERROR_CODES.RATE_LIMITED);
  });

  await t.test('HTTP 404 → status 404, code NOT_FOUND', () => {
    const r = normalizeUpstreamResponse({ status: 404, data: null });
    assert.equal(r.ok, false);
    assert.equal(r.status, 404);
    assert.equal(r.code, ERROR_CODES.NOT_FOUND);
  });

  await t.test('HTTP 500 → status 502, code UPSTREAM_ERROR', () => {
    // Note: we expose 502 to the client (the upstream is the "server"
    // from our caller's perspective), not the raw 500.
    const r = normalizeUpstreamResponse({ status: 500, data: null });
    assert.equal(r.ok, false);
    assert.equal(r.status, 502);
    assert.equal(r.code, ERROR_CODES.UPSTREAM_ERROR);
  });

  await t.test('HTTP 502 / 503 / 504 → status 502, code UPSTREAM_ERROR', () => {
    for (const status of [502, 503, 504]) {
      const r = normalizeUpstreamResponse({ status, data: null });
      assert.equal(r.code, ERROR_CODES.UPSTREAM_ERROR, `status=${status} should be UPSTREAM_ERROR`);
      assert.equal(r.status, 502);
    }
  });

  await t.test('HTTP 401 / 403 (non-2xx, non-4xx-specific) → UPSTREAM_ERROR', () => {
    // Upstream auth issues bubble up as upstream errors — operator-side
    // problem, not caller's problem.
    for (const status of [401, 403]) {
      const r = normalizeUpstreamResponse({ status, data: null });
      assert.equal(r.code, ERROR_CODES.UPSTREAM_ERROR, `status=${status}`);
    }
  });

  // ─── Edge cases ──────────────────────────────────────────────────────
  await t.test('null upstream object → graceful degradation', () => {
    const r = normalizeUpstreamResponse(null);
    assert.equal(r.ok, false);
    assert.equal(r.code, ERROR_CODES.UPSTREAM_ERROR);
  });

  await t.test('undefined upstream object → graceful degradation', () => {
    const r = normalizeUpstreamResponse(undefined);
    assert.equal(r.ok, false);
    assert.equal(r.code, ERROR_CODES.UPSTREAM_ERROR);
  });

  await t.test('body is empty object → still treated as OK (2xx)', () => {
    // Some PropData endpoints legitimately return {} for "no data but
    // not a coverage gap" (e.g. /v1/stats during maintenance). Don't
    // mis-categorise as NO_COVERAGE.
    const r = normalizeUpstreamResponse({ status: 200, data: {} });
    assert.equal(r.ok, true);
    assert.equal(r.code, ERROR_CODES.OK);
  });

  await t.test('body is an array (not object) → OK', () => {
    const r = normalizeUpstreamResponse({ status: 200, data: [1, 2, 3] });
    assert.equal(r.ok, true);
    assert.equal(r.code, ERROR_CODES.OK);
  });
});

test('isRetryableError', async (t) => {
  await t.test('UPSTREAM_ERROR is retryable', () => {
    assert.equal(isRetryableError({ code: ERROR_CODES.UPSTREAM_ERROR }), true);
  });
  await t.test('NETWORK is NOT retryable via isRetryableError (handled separately in proxy)', () => {
    // Caller code retries on both UPSTREAM_ERROR and NETWORK explicitly.
    // This function intentionally only flags UPSTREAM_ERROR — NETWORK
    // retry is gated on a separate code path that may want different
    // backoff / max-retry semantics later.
    assert.equal(isRetryableError({ code: ERROR_CODES.NETWORK }), false);
  });
  await t.test('OK is not retryable', () => {
    assert.equal(isRetryableError({ code: ERROR_CODES.OK }), false);
  });
  await t.test('NO_COVERAGE is NOT retryable (no point burning quota)', () => {
    assert.equal(isRetryableError({ code: ERROR_CODES.NO_COVERAGE }), false);
  });
  await t.test('RATE_LIMITED is NOT retryable (would just get rate-limited again)', () => {
    assert.equal(isRetryableError({ code: ERROR_CODES.RATE_LIMITED }), false);
  });
  await t.test('NOT_FOUND is NOT retryable', () => {
    assert.equal(isRetryableError({ code: ERROR_CODES.NOT_FOUND }), false);
  });
  await t.test('TIMEOUT is NOT retryable via this function', () => {
    // Same rationale as NETWORK — separate concern, may want different
    // policy (e.g. don't retry timeouts to avoid amplifying upstream load).
    assert.equal(isRetryableError({ code: ERROR_CODES.TIMEOUT }), false);
  });
});

test('ERROR_CODES is frozen', async (t) => {
  await t.test('mutating ERROR_CODES does not change values', () => {
    // Object.freeze in sloppy mode silently no-ops mutations rather
    // than throwing. The contract is "values don't change" — verify
    // that directly instead of relying on a strict-mode throw.
    const before = ERROR_CODES.OK;
    try { ERROR_CODES.OK = 'mutated'; } catch { /* fine either way */ }
    assert.equal(ERROR_CODES.OK, before);
  });
});
