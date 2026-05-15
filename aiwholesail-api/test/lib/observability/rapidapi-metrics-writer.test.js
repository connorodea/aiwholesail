/**
 * Writer for the metrics collector — inserts one row per minute into
 * rapidapi_request_metrics. Computes percentiles from the latency samples
 * before persisting (samples are dropped after; we only keep the rollup).
 *
 * Tested with a stubbed pg pool — no real DB required.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');

// ─── Fake pg pool (for writeMetrics tests below) ─────────────────────────
//
// The writer lazy-requires('pg') inside getPool() the first time
// writeMetrics is called. We substitute the cached pg module BEFORE the
// SUT lazy-loads it so every query goes through our recorder. Mirrors
// the substitution pattern in test/middleware/auth.test.js.

const PG_PATH = require.resolve('pg');
const poolQueries = [];
let poolQueryImpl = async () => ({ rows: [], rowCount: 1 });

class FakePool {
  constructor(opts) { this.opts = opts; }
  async query(sql, params) {
    poolQueries.push({ sql, params });
    return poolQueryImpl(sql, params);
  }
}

const fakePgMod = new Module(PG_PATH);
fakePgMod.filename = PG_PATH;
fakePgMod.loaded = true;
fakePgMod.exports = { Pool: FakePool };
require.cache[PG_PATH] = fakePgMod;

process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgres://test/test';

const WRITER_PATH = require.resolve('../../../lib/observability/rapidapi-metrics-writer');
delete require.cache[WRITER_PATH];
const { computeWriteParams, writeMetrics } = require('../../../lib/observability/rapidapi-metrics-writer');

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

// ── writeMetrics — the actual INSERT path ─────────────────────────────────
//
// Before this section the writer module sat at 45.71% line / 60% function
// coverage — every `computeWriteParams` branch was tested but the
// `writeMetrics` body that calls pool.query was not. These tests pin the
// SQL shape, ON CONFLICT clause, param order, and error-bubble behavior.

function snap(overrides = {}) {
  return {
    bucket_minute: new Date('2026-05-15T00:00:00Z'),
    requests_total: 100,
    requests_2xx: 90,
    requests_3xx: 0,
    requests_401_our_middleware: 1,
    requests_401_rapidapi_gateway: 2,
    requests_403: 0,
    requests_4xx_other: 5,
    requests_5xx: 1,
    requests_503_gateway_unconfigured: 1,
    latency_samples_ms: Array.from({ length: 100 }, (_, i) => i + 1),
    ...overrides,
  };
}

test('writeMetrics: issues one INSERT into rapidapi_request_metrics with 13 params', async () => {
  poolQueries.length = 0;
  await writeMetrics(snap());
  assert.equal(poolQueries.length, 1);
  assert.match(poolQueries[0].sql, /INSERT INTO rapidapi_request_metrics/);
  assert.equal(poolQueries[0].params.length, 13);
});

test('writeMetrics: SQL uses ON CONFLICT (bucket_minute) DO NOTHING (idempotent)', async () => {
  poolQueries.length = 0;
  await writeMetrics(snap());
  assert.match(poolQueries[0].sql, /ON CONFLICT \(bucket_minute\) DO NOTHING/);
});

test('writeMetrics: param order matches the INSERT column list', async () => {
  poolQueries.length = 0;
  const s = snap({
    requests_total: 5,
    requests_2xx: 4,
    requests_3xx: 0,
    requests_401_our_middleware: 0,
    requests_401_rapidapi_gateway: 0,
    requests_403: 0,
    requests_4xx_other: 1,
    requests_5xx: 0,
    requests_503_gateway_unconfigured: 0,
    latency_samples_ms: [50, 100, 200],
  });
  await writeMetrics(s);
  const p = poolQueries[0].params;
  assert.equal(p[0].getTime(), s.bucket_minute.getTime());
  assert.equal(p[1], 5);   // requests_total
  assert.equal(p[2], 4);   // requests_2xx
  assert.equal(p[3], 0);   // requests_3xx
  assert.equal(p[4], 0);   // requests_401_our_middleware
  assert.equal(p[5], 0);   // requests_401_rapidapi_gateway
  assert.equal(p[6], 0);   // requests_403
  assert.equal(p[7], 1);   // requests_4xx_other
  assert.equal(p[8], 0);   // requests_5xx
  assert.equal(p[9], 0);   // requests_503_gateway_unconfigured
  // p50/p95/p99 of [50,100,200] (sorted): nearest-rank
  // p50 idx=ceil(0.5*3)-1=1 →100; p95 idx=ceil(0.95*3)-1=2 →200
  assert.equal(p[10], 100);
  assert.equal(p[11], 200);
  assert.equal(p[12], 200);
});

test('writeMetrics: bubbles DB errors so the cron worker can log + retry', async () => {
  poolQueryImpl = async () => { throw new Error('db unavailable'); };
  await assert.rejects(() => writeMetrics(snap()), /db unavailable/);
  poolQueryImpl = async () => ({ rows: [], rowCount: 1 });
});

test('writeMetrics: lazy Pool reused across calls (singleton getPool)', async () => {
  poolQueries.length = 0;
  await writeMetrics(snap());
  await writeMetrics(snap({ bucket_minute: new Date('2026-05-15T00:01:00Z') }));
  await writeMetrics(snap({ bucket_minute: new Date('2026-05-15T00:02:00Z') }));
  assert.equal(poolQueries.length, 3);
});
