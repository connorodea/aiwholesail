/**
 * Writer for the metrics collector — inserts one row per minute into
 * rapidapi_request_metrics. Computes percentiles from the latency samples
 * before persisting (samples are dropped after; we only keep the rollup).
 *
 * Tested with a stubbed pg pool — no real DB required.
 */

const test = require('node:test');
const assert = require('node:assert/strict');

const { computeWriteParams } = require('../../../lib/observability/rapidapi-metrics-writer');

// ── percentile computation ────────────────────────────────────────────────

test('computes p50/p95/p99 from latency samples', () => {
  // 100 samples 1..100ms — exact percentile boundaries.
  const samples = Array.from({ length: 100 }, (_, i) => i + 1);
  const params = computeWriteParams({
    requests_total: 100,
    latency_samples_ms: samples,
    bucket_minute: new Date('2026-05-14T12:00:00Z'),
  });

  assert.equal(params.p50_latency_ms, 50);
  assert.equal(params.p95_latency_ms, 95);
  assert.equal(params.p99_latency_ms, 99);
});

test('handles single-sample window (p50=p95=p99=that one value)', () => {
  const params = computeWriteParams({
    requests_total: 1,
    latency_samples_ms: [42],
    bucket_minute: new Date(),
  });
  assert.equal(params.p50_latency_ms, 42);
  assert.equal(params.p95_latency_ms, 42);
  assert.equal(params.p99_latency_ms, 42);
});

test('returns null percentiles when no latency samples', () => {
  const params = computeWriteParams({
    requests_total: 0,
    latency_samples_ms: [],
    bucket_minute: new Date(),
  });
  assert.equal(params.p50_latency_ms, null);
  assert.equal(params.p95_latency_ms, null);
  assert.equal(params.p99_latency_ms, null);
});

test('drops the latency_samples_ms array (only the rollup persists)', () => {
  const params = computeWriteParams({
    requests_total: 5,
    latency_samples_ms: [10, 20, 30, 40, 50],
    bucket_minute: new Date(),
  });
  // Sample array must NOT be in the params handed to pg — we don't store it
  // and including it would make the query unnecessarily large.
  assert.equal(params.latency_samples_ms, undefined);
});

test('passes through all count fields verbatim', () => {
  const snap = {
    requests_total: 100,
    requests_2xx: 80,
    requests_3xx: 5,
    requests_401_our_middleware: 3,
    requests_401_rapidapi_gateway: 2,
    requests_403: 1,
    requests_4xx_other: 4,
    requests_5xx: 5,
    requests_503_gateway_unconfigured: 1,
    latency_samples_ms: [100, 200, 300],
    bucket_minute: new Date('2026-05-14T12:00:00Z'),
  };
  const params = computeWriteParams(snap);
  for (const k of [
    'requests_total', 'requests_2xx', 'requests_3xx',
    'requests_401_our_middleware', 'requests_401_rapidapi_gateway',
    'requests_403', 'requests_4xx_other',
    'requests_5xx', 'requests_503_gateway_unconfigured',
    'bucket_minute',
  ]) {
    assert.deepEqual(params[k], snap[k], `${k} should pass through`);
  }
});
