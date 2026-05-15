/**
 * Per-request metrics collector for /rapidapi/zillow/* — feeds the alert
 * evaluator (lib/observability/rapidapi-alerts.js) via the rollup table
 * created in migration 030.
 *
 * Pure in-memory counter + a flush() that hands its buffer to a writer
 * callback. The writer is the only IO concern — tests pass a sync stub.
 *
 * Runs under built-in node:test.
 *   $ node --test test/lib/observability/rapidapi-metrics-collector.test.js
 */

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  createCollector,
} = require('../../../lib/observability/rapidapi-metrics-collector');

// ── helpers ───────────────────────────────────────────────────────────────
function makeReq(opts = {}) {
  return {
    originalUrl: opts.url || '/rapidapi/zillow/proxy',
    method: opts.method || 'POST',
  };
}
function makeRes(statusCode = 200, body = '') {
  // Mimic the express res lifecycle bits the collector observes.
  const handlers = { finish: [], close: [] };
  return {
    statusCode,
    body,
    on(event, fn) { handlers[event] = handlers[event] || []; handlers[event].push(fn); },
    _fire(event) { (handlers[event] || []).forEach((fn) => fn()); },
    json(b) { this.body = JSON.stringify(b); return this; },
  };
}

// ── basic counting ────────────────────────────────────────────────────────

test('counts a single 200 request as 2xx', () => {
  const c = createCollector();
  const req = makeReq();
  const res = makeRes(200);

  c.middleware(req, res, () => {});
  res._fire('finish');

  const snap = c.snapshot();
  assert.equal(snap.requests_total, 1);
  assert.equal(snap.requests_2xx, 1);
  assert.equal(snap.requests_5xx, 0);
});

test('counts 5xx separately from 2xx', () => {
  const c = createCollector();
  const r1 = makeRes(200);
  const r2 = makeRes(500);
  c.middleware(makeReq(), r1, () => {}); r1._fire('finish');
  c.middleware(makeReq(), r2, () => {}); r2._fire('finish');

  const snap = c.snapshot();
  assert.equal(snap.requests_total, 2);
  assert.equal(snap.requests_2xx, 1);
  assert.equal(snap.requests_5xx, 1);
});

test('skips counting requests outside /rapidapi/zillow/*', () => {
  const c = createCollector();
  const res = makeRes(200);
  c.middleware(makeReq({ url: '/api/zillow/proxy' }), res, () => {});
  res._fire('finish');
  assert.equal(c.snapshot().requests_total, 0);
});

// ── 401 source split (W6's whole point) ───────────────────────────────────

test('counts 401 with our middleware body shape as our_middleware bucket', () => {
  const c = createCollector();
  const res = makeRes(401);
  res.body = JSON.stringify({ success: false, error: 'Invalid or missing proxy secret' });
  c.middleware(makeReq(), res, () => {});
  res._fire('finish');

  const snap = c.snapshot();
  assert.equal(snap.requests_401_our_middleware, 1);
  assert.equal(snap.requests_401_rapidapi_gateway, 0);
});

test('counts 401 from RapidAPI gateway separately (different body shape)', () => {
  // Gateway-side 401s never actually reach our backend, but if we ever see
  // one (e.g., via a request-mirror or proxy middleware), it goes to the
  // RapidAPI bucket so W6 doesn't false-fire.
  const c = createCollector();
  const res = makeRes(401);
  res.body = JSON.stringify({ message: 'Invalid API key' });
  c.middleware(makeReq(), res, () => {});
  res._fire('finish');

  const snap = c.snapshot();
  assert.equal(snap.requests_401_our_middleware, 0);
  assert.equal(snap.requests_401_rapidapi_gateway, 1);
});

// ── 503 carve-out (C5's special path) ─────────────────────────────────────

test('counts 503 with "Gateway not configured" in its dedicated bucket', () => {
  const c = createCollector();
  const res = makeRes(503);
  res.body = JSON.stringify({ success: false, error: 'Gateway not configured' });
  c.middleware(makeReq(), res, () => {});
  res._fire('finish');

  const snap = c.snapshot();
  assert.equal(snap.requests_503_gateway_unconfigured, 1);
  assert.equal(snap.requests_5xx, 1, 'still counts toward general 5xx for SLO 9');
});

test('generic 503 (not gateway-unconfigured) only counts as 5xx', () => {
  const c = createCollector();
  const res = makeRes(503);
  res.body = 'Service Unavailable';
  c.middleware(makeReq(), res, () => {});
  res._fire('finish');

  const snap = c.snapshot();
  assert.equal(snap.requests_503_gateway_unconfigured, 0);
  assert.equal(snap.requests_5xx, 1);
});

// ── latency ────────────────────────────────────────────────────────────────

test('records latency samples per request', () => {
  const c = createCollector();
  const res = makeRes(200);
  c.middleware(makeReq(), res, () => {});
  // Simulate ~50ms request
  setTimeout(() => res._fire('finish'), 0);
  return new Promise((resolve) => setTimeout(() => {
    const snap = c.snapshot();
    assert.ok(snap.latency_samples_ms.length === 1, 'one sample recorded');
    assert.ok(snap.latency_samples_ms[0] >= 0, 'latency is non-negative');
    resolve();
  }, 10));
});

// ── flush ─────────────────────────────────────────────────────────────────

test('flush() drains the buffer and hands it to the writer', async () => {
  const c = createCollector();
  const res = makeRes(200);
  c.middleware(makeReq(), res, () => {}); res._fire('finish');

  const writes = [];
  await c.flush(async (snapshot) => writes.push(snapshot));

  assert.equal(writes.length, 1, 'writer called once');
  assert.equal(writes[0].requests_total, 1);

  // After flush, the snapshot is empty (buffer drained).
  const after = c.snapshot();
  assert.equal(after.requests_total, 0);
});

test('flush() with no requests does nothing (no empty rows)', async () => {
  const c = createCollector();
  const writes = [];
  await c.flush(async (snapshot) => writes.push(snapshot));
  assert.equal(writes.length, 0, 'no write call when buffer is empty');
});

test('flush() includes the bucket_minute timestamp', async () => {
  const c = createCollector();
  const res = makeRes(200);
  c.middleware(makeReq(), res, () => {}); res._fire('finish');

  let captured;
  await c.flush(async (s) => { captured = s; });

  assert.ok(captured.bucket_minute instanceof Date);
  // Truncated to the minute boundary.
  assert.equal(captured.bucket_minute.getSeconds(), 0);
  assert.equal(captured.bucket_minute.getMilliseconds(), 0);
});
