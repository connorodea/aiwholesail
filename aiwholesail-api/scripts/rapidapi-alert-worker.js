#!/usr/bin/env node
/**
 * Cron worker: aggregate the last hour of rapidapi_request_metrics into
 * the window shape expected by lib/observability/rapidapi-alerts.js,
 * then evaluate alerts and dispatch any that fire.
 *
 * Run via systemd timer every 5 minutes:
 *   scripts/systemd/rapidapi-alert-worker.timer + .service
 *
 * Idempotent — safe to run as often as you want; only side effect is
 * dispatching alerts (which themselves are deduped by id+message at the
 * notification layer).
 *
 * For now alerts are emitted to stderr in a parsable format. A follow-up
 * PR can wire the dispatch to email / PagerDuty / Slack — keep that
 * concern out of this PR's scope so the alert logic is testable in
 * isolation.
 */

const { Pool } = require('pg');
const { evaluateAlerts } = require('../lib/observability/rapidapi-alerts');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function loadMetricsWindow() {
  // Aggregate the last hour into the shape evaluateAlerts expects.
  // Single query with conditional sums for cheap rollup.
  const sql = `
    SELECT
      COALESCE(SUM(CASE WHEN bucket_minute >= NOW() - INTERVAL '5 minutes'
                         THEN requests_total ELSE 0 END), 0)::int
        AS requests_total_5min,
      COALESCE(SUM(CASE WHEN bucket_minute >= NOW() - INTERVAL '5 minutes'
                         THEN requests_503_gateway_unconfigured ELSE 0 END), 0)::int
        AS requests_503_gateway_unconfigured_5min,
      COALESCE(SUM(CASE WHEN bucket_minute >= NOW() - INTERVAL '15 minutes'
                         THEN requests_total ELSE 0 END), 0)::int
        AS requests_total_15min,
      COALESCE(SUM(CASE WHEN bucket_minute >= NOW() - INTERVAL '15 minutes'
                         THEN requests_401_our_middleware ELSE 0 END), 0)::int
        AS requests_401_our_middleware_15min,
      COALESCE(SUM(CASE WHEN bucket_minute >= NOW() - INTERVAL '15 minutes'
                         THEN requests_401_rapidapi_gateway ELSE 0 END), 0)::int
        AS requests_401_rapidapi_gateway_15min,
      COALESCE(MAX(CASE WHEN bucket_minute >= NOW() - INTERVAL '15 minutes'
                         THEN p95_latency_ms END), 0)::int
        AS p95_latency_ms_15min,
      COALESCE(SUM(CASE WHEN bucket_minute >= NOW() - INTERVAL '1 hour'
                         THEN requests_total ELSE 0 END), 0)::int
        AS requests_total_1h,
      COALESCE(SUM(CASE WHEN bucket_minute >= NOW() - INTERVAL '1 hour'
                         THEN requests_5xx ELSE 0 END), 0)::int
        AS requests_5xx_1h,
      COALESCE(SUM(CASE WHEN bucket_minute >= NOW() - INTERVAL '1 hour'
                         THEN requests_403 ELSE 0 END), 0)::int
        AS requests_403_1h
    FROM rapidapi_request_metrics
  `;
  const { rows } = await pool.query(sql);
  return { ...rows[0], slo_9_target: 0.99 };
}

function emitAlert(alert) {
  // Structured one-liner per alert so the operator's log-tail OR a future
  // notifier (email/PagerDuty/Slack) can grep + deserialize.
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    source: 'rapidapi-alert-worker',
    ...alert,
  });
  if (alert.severity === 'critical') {
    console.error(line);
  } else {
    console.log(line);
  }
}

async function main() {
  try {
    const window = await loadMetricsWindow();
    const alerts = evaluateAlerts(window);
    if (alerts.length === 0) {
      console.log(
        JSON.stringify({
          ts: new Date().toISOString(),
          source: 'rapidapi-alert-worker',
          status: 'ok',
          window,
        })
      );
      return;
    }
    for (const alert of alerts) {
      emitAlert(alert);
    }
  } catch (err) {
    console.error(
      JSON.stringify({
        ts: new Date().toISOString(),
        source: 'rapidapi-alert-worker',
        status: 'error',
        message: err.message,
      })
    );
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

main();
