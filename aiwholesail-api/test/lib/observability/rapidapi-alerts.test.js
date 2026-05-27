/**
 * Pure alert evaluator for /rapidapi/zillow/* per the SLO spec
 * (docs/observability/SLO_SPEC.md § "RapidAPI gateway").
 *
 * Tested in isolation — no DB, no log parsing. Inputs are aggregated
 * count windows; outputs are an array of alert decisions { id, severity,
 * action, context }. Wiring (log scraping, cron, paging integration) lives
 * elsewhere and feeds this evaluator.
 *
 * Runs under built-in node:test.
 *   $ node --test test/lib/observability/rapidapi-alerts.test.js
 */

const test = require('node:test');
const assert = require('node:assert/strict');

const { evaluateAlerts } = require('../../../lib/observability/rapidapi-alerts');

// ── tiny helper: build a metrics window with sane defaults ────────────────
function metrics(overrides = {}) {
  return {
    // Counts in the most recent rolling window. Keys mirror what the
    // collector cron will emit per (path, status_code) pair.
    requests_total_5min: 0,
    requests_503_gateway_unconfigured_5min: 0,
    requests_401_our_middleware_15min: 0,
    requests_401_rapidapi_gateway_15min: 0,
    requests_total_15min: 0,
    requests_5xx_1h: 0,
    requests_total_1h: 0,
    p95_latency_ms_15min: 0,
    requests_403_1h: 0,
    // SLO 9 budget config
    slo_9_target: 0.99,           // 99% over 30 days
    slo_9_window_days: 30,
    ...overrides,
  };
}

// ── C5 — 503 "Gateway not configured" storm ───────────────────────────────

test('C5 fires Critical when 503 with gateway-unconfigured body appears', () => {
  const alerts = evaluateAlerts(metrics({
    requests_total_5min: 50,
    requests_503_gateway_unconfigured_5min: 1, // even 1 is enough
  }));

  const c5 = alerts.find((a) => a.id === 'C5');
  assert.ok(c5, 'C5 must fire when ANY gateway-unconfigured 503 is observed');
  assert.equal(c5.severity, 'critical');
  assert.match(c5.action, /page/i);
  assert.match(c5.context, /RAPIDAPI_PROXY_SECRET/i);
});

test('C5 does NOT fire when no 503 storms in window', () => {
  const alerts = evaluateAlerts(metrics({
    requests_total_5min: 100,
    requests_503_gateway_unconfigured_5min: 0,
  }));
  assert.equal(alerts.find((a) => a.id === 'C5'), undefined);
});

test('C5 does NOT fire on generic 5xx (only the proxy-secret-unset shape)', () => {
  // Generic 503 from upstream proxy chain is C6 territory, not C5.
  const alerts = evaluateAlerts(metrics({
    requests_total_5min: 100,
    requests_5xx_1h: 5,
    requests_503_gateway_unconfigured_5min: 0,
  }));
  assert.equal(alerts.find((a) => a.id === 'C5'), undefined);
});

// ── C6 — SLO 9 burn-rate critical (14.4× over 1 hour) ─────────────────────

test('C6 fires Critical when SLO 9 burn-rate exceeds 14.4× in 1h', () => {
  // SLO 9 target = 99% → 1% error budget.
  // 14.4× burn rate = 14.4% of monthly budget consumed in 1 hour.
  // For 1000 req/h: 145 errors → ~14.5× (clearly above threshold).
  const alerts = evaluateAlerts(metrics({
    requests_total_1h: 1000,
    requests_5xx_1h: 145,
  }));

  const c6 = alerts.find((a) => a.id === 'C6');
  assert.ok(c6, 'C6 must fire when burn-rate clearly exceeds 14.4×');
  assert.equal(c6.severity, 'critical');
  assert.match(c6.action, /page/i);
});

test('C6 does NOT fire when error rate is at SLO target', () => {
  const alerts = evaluateAlerts(metrics({
    requests_total_1h: 1000,
    requests_5xx_1h: 10, // exactly 1% — at SLO 9's error budget
  }));
  assert.equal(alerts.find((a) => a.id === 'C6'), undefined);
});

test('C6 does NOT fire on tiny windows (anti-flap noise floor)', () => {
  // 5 5xx out of 30 requests is 16% but the window is too small to be
  // meaningful — likely a single bad consumer or a deploy.
  const alerts = evaluateAlerts(metrics({
    requests_total_1h: 30,
    requests_5xx_1h: 5,
  }));
  assert.equal(
    alerts.find((a) => a.id === 'C6'),
    undefined,
    'C6 should require a minimum traffic floor before firing'
  );
});

// ── W6 — 401 storm from OUR middleware (proxy-secret mismatch) ────────────

test('W6 fires Warning when >20% of 15min requests return our 401', () => {
  const alerts = evaluateAlerts(metrics({
    requests_total_15min: 100,
    requests_401_our_middleware_15min: 25, // 25%
  }));

  const w6 = alerts.find((a) => a.id === 'W6');
  assert.ok(w6, 'W6 must fire when OUR middleware 401-rate > 20%');
  assert.equal(w6.severity, 'warning');
  assert.match(w6.action, /email/i);
  assert.match(w6.context, /proxy.secret.mismatch/i);
});

test('W6 distinguishes our 401 from RapidAPI gateway 401 (different cause)', () => {
  // 100 requests, 25 RapidAPI 401s (consumer-side bad keys), 0 of ours.
  // RapidAPI's 401s mean their consumer messed up; that's NOT W6.
  const alerts = evaluateAlerts(metrics({
    requests_total_15min: 100,
    requests_401_rapidapi_gateway_15min: 25,
    requests_401_our_middleware_15min: 0,
  }));
  assert.equal(alerts.find((a) => a.id === 'W6'), undefined);
});

test('W6 does NOT fire when 401 rate is below threshold', () => {
  const alerts = evaluateAlerts(metrics({
    requests_total_15min: 100,
    requests_401_our_middleware_15min: 5, // 5% < 20% threshold
  }));
  assert.equal(alerts.find((a) => a.id === 'W6'), undefined);
});

// ── W7 — p95 latency degraded (>5s for 15min) ─────────────────────────────

test('W7 fires Warning when p95 latency exceeds 5s sustained', () => {
  const alerts = evaluateAlerts(metrics({
    requests_total_15min: 100,
    p95_latency_ms_15min: 5500,
  }));

  const w7 = alerts.find((a) => a.id === 'W7');
  assert.ok(w7, 'W7 must fire when p95 > 5s for 15min');
  assert.equal(w7.severity, 'warning');
  assert.match(w7.action, /email/i);
  assert.match(w7.context, /scrape\.do/i, 'should hint at correlated scrape.do degradation');
});

test('W7 does NOT fire at the SLO 10 target', () => {
  // SLO 10 target: p95 ≤ 3s. W7 fires at >5s (67% headroom for noise).
  const alerts = evaluateAlerts(metrics({
    requests_total_15min: 100,
    p95_latency_ms_15min: 3000,
  }));
  assert.equal(alerts.find((a) => a.id === 'W7'), undefined);
});

test('W7 does NOT fire on tiny traffic windows (single slow consumer dominates p95)', () => {
  const alerts = evaluateAlerts(metrics({
    requests_total_15min: 5,
    p95_latency_ms_15min: 8000,
  }));
  assert.equal(
    alerts.find((a) => a.id === 'W7'),
    undefined,
    'W7 should require meaningful sample before firing'
  );
});

// ── W8 — 403 storm (consumer hit plan quota — INFORMATIONAL, upsell) ──────

test('W8 fires Info when 403 rate exceeds 10% in last hour', () => {
  const alerts = evaluateAlerts(metrics({
    requests_total_1h: 1000,
    requests_403_1h: 150, // 15%
  }));

  const w8 = alerts.find((a) => a.id === 'W8');
  assert.ok(w8, 'W8 must fire when 403 rate > 10% in last hour');
  assert.equal(w8.severity, 'info', 'W8 is INFORMATIONAL, not warning');
  assert.match(w8.context, /upsell|quota/i, 'context should frame as revenue signal, not outage');
});

test('W8 does NOT fire at low 403 rates (normal consumer behaviour)', () => {
  const alerts = evaluateAlerts(metrics({
    requests_total_1h: 1000,
    requests_403_1h: 30, // 3% — within normal subscription-mismatch noise
  }));
  assert.equal(alerts.find((a) => a.id === 'W8'), undefined);
});

// ── Multi-alert composition ───────────────────────────────────────────────

test('multiple alerts can fire concurrently when conditions overlap', () => {
  // Bad-day scenario: secret rotation gone wrong + scrape.do degraded.
  // Should fire W6 (mismatch) AND C6 (burn-rate from upstream errors).
  const alerts = evaluateAlerts(metrics({
    requests_total_15min: 200,
    requests_401_our_middleware_15min: 60, // 30%
    requests_total_1h: 800,
    requests_5xx_1h: 200, // 25% error rate → 25× burn
  }));

  const ids = alerts.map((a) => a.id).sort();
  assert.deepEqual(ids, ['C6', 'W6'], 'both should fire on a real bad day');
});

test('returns empty array when nothing is firing', () => {
  const alerts = evaluateAlerts(metrics({
    requests_total_15min: 100,
    requests_total_1h: 1000,
    requests_5xx_1h: 5,                    // 0.5%, well within budget
    requests_401_our_middleware_15min: 0,
    requests_403_1h: 10,                   // 1%
    p95_latency_ms_15min: 1500,
  }));
  assert.deepEqual(alerts, []);
});
