/**
 * Pure alert evaluator for /rapidapi/zillow/* per the SLO spec.
 * See docs/observability/SLO_SPEC.md § "RapidAPI gateway".
 *
 * Input: an aggregated `metrics` window object (built by the cron collector).
 * Output: array of alert decisions { id, severity, action, context }.
 *
 * No DB, no IO, no time. Wiring (collector cron + paging integration) lives
 * in scripts/rapidapi-alert-worker.js and consumes this evaluator.
 */

// Anti-flap noise floor: alerts that compute rates need a minimum sample
// to avoid firing on tiny windows where one bad consumer dominates.
const MIN_TRAFFIC_FLOOR_1H = 50;
const MIN_TRAFFIC_FLOOR_15MIN = 10;

// SLO 9 burn-rate: 14.4× = "consumes 14.4% of 30-day error budget per 1h".
// budget_per_hour = (1 - target) × 14.4 ; e.g. 0.01 × 14.4 = 0.144 = 14.4%
const SLO_9_BURN_RATE_MULTIPLIER = 14.4;

// W6 threshold: >20% of 15min traffic returning OUR-middleware 401s
const W6_THRESHOLD_RATIO = 0.20;

function evaluateAlerts(metrics) {
  const alerts = [];

  // ── C5 — 503 'Gateway not configured' ────────────────────────────────
  // Even one means RAPIDAPI_PROXY_SECRET is unset in prod env.
  if ((metrics.requests_503_gateway_unconfigured_5min || 0) > 0) {
    alerts.push({
      id: 'C5',
      severity: 'critical',
      action: 'page on-call',
      context:
        'Gateway returned 503 with "Gateway not configured" — ' +
        'RAPIDAPI_PROXY_SECRET env var is unset on prod. ' +
        'Restore from RapidAPI dashboard Firewall Settings, pm2 reload. ' +
        'Runbook: docs/runbooks/rapidapi-gateway.md',
      observed: metrics.requests_503_gateway_unconfigured_5min,
    });
  }

  // ── C6 — SLO 9 burn-rate critical ────────────────────────────────────
  if ((metrics.requests_total_1h || 0) >= MIN_TRAFFIC_FLOOR_1H) {
    const targetErrorRate = 1 - (metrics.slo_9_target ?? 0.99);
    const observedErrorRate =
      (metrics.requests_5xx_1h || 0) / metrics.requests_total_1h;
    // Round to 1 decimal: avoids float-edge flap at the threshold AND is
    // exactly the precision an operator reads off a dashboard.
    const burnRate = Math.round((observedErrorRate / targetErrorRate) * 10) / 10;
    if (burnRate >= SLO_9_BURN_RATE_MULTIPLIER) {
      alerts.push({
        id: 'C6',
        severity: 'critical',
        action: 'page on-call',
        context:
          `SLO 9 burn-rate ${burnRate.toFixed(1)}× over 1h ` +
          `(observed ${(observedErrorRate * 100).toFixed(2)}% 5xx, ` +
          `target ${(targetErrorRate * 100).toFixed(2)}%). ` +
          'Likely scrape.do + RapidAPI fallback both unhealthy. ' +
          'Correlate W1 (scrape.do success rate). Runbook: docs/runbooks/rapidapi-gateway.md.',
        burn_rate: burnRate,
      });
    }
  }

  // ── W6 — 401 storm from OUR middleware (proxy-secret mismatch) ───────
  if ((metrics.requests_total_15min || 0) >= MIN_TRAFFIC_FLOOR_15MIN) {
    const ours = metrics.requests_401_our_middleware_15min || 0;
    const ratio = ours / metrics.requests_total_15min;
    if (ratio > W6_THRESHOLD_RATIO) {
      alerts.push({
        id: 'W6',
        severity: 'warning',
        action: 'email Connor',
        context:
          `${(ratio * 100).toFixed(1)}% of /rapidapi/zillow/* requests ` +
          'returned our middleware 401 (proxy-secret mismatch) in last 15min. ' +
          'Means prod .env RAPIDAPI_PROXY_SECRET differs from RapidAPI dashboard ' +
          'Firewall Settings — one side rotated, the other did not. ' +
          'Runbook: docs/runbooks/rapidapi-gateway.md § rollback.',
        observed_ratio: ratio,
      });
    }
  }

  return alerts;
}

module.exports = { evaluateAlerts };
