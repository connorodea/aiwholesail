/**
 * Writer for the RapidAPI metrics collector. Computes p50/p95/p99 from
 * the per-window latency samples, then INSERTs one row into
 * rapidapi_request_metrics.
 *
 * Idempotency: relies on the UNIQUE(bucket_minute) constraint in
 * migration 030. ON CONFLICT DO NOTHING means a rare double-flush
 * (e.g., during pm2 reload race) silently no-ops the second insert
 * rather than failing.
 */

let pool;
function getPool() {
  if (!pool) {
    const { Pool } = require('pg');
    pool = new Pool({ connectionString: process.env.DATABASE_URL });
  }
  return pool;
}

function percentile(sortedSamples, p) {
  if (sortedSamples.length === 0) return null;
  // Nearest-rank method — exact for the test's "1..100, p95=95" case.
  const idx = Math.ceil((p / 100) * sortedSamples.length) - 1;
  return sortedSamples[Math.max(0, Math.min(idx, sortedSamples.length - 1))];
}

function computeWriteParams(snapshot) {
  const samples = (snapshot.latency_samples_ms || []).slice().sort((a, b) => a - b);
  const params = { ...snapshot };
  delete params.latency_samples_ms;
  params.p50_latency_ms = percentile(samples, 50);
  params.p95_latency_ms = percentile(samples, 95);
  params.p99_latency_ms = percentile(samples, 99);
  return params;
}

async function writeMetrics(snapshot) {
  const params = computeWriteParams(snapshot);
  const sql = `
    INSERT INTO rapidapi_request_metrics (
      bucket_minute,
      requests_total, requests_2xx, requests_3xx,
      requests_401_our_middleware, requests_401_rapidapi_gateway,
      requests_403, requests_4xx_other,
      requests_5xx, requests_503_gateway_unconfigured,
      p50_latency_ms, p95_latency_ms, p99_latency_ms
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13
    )
    ON CONFLICT (bucket_minute) DO NOTHING
  `;
  await getPool().query(sql, [
    params.bucket_minute,
    params.requests_total,
    params.requests_2xx,
    params.requests_3xx,
    params.requests_401_our_middleware,
    params.requests_401_rapidapi_gateway,
    params.requests_403,
    params.requests_4xx_other,
    params.requests_5xx,
    params.requests_503_gateway_unconfigured,
    params.p50_latency_ms,
    params.p95_latency_ms,
    params.p99_latency_ms,
  ]);
}

module.exports = { writeMetrics, computeWriteParams };
