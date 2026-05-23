/**
 * Unit tests for lib/observability/scrapeMetrics.
 *
 * Strategy: substitute the cached `../../config/database` module with a
 * fake `query` BEFORE requiring scrapeMetrics. node:test runs each .test.js
 * in its own process, so cache mutation here doesn't leak into other tests.
 *
 *   $ npm test                                       (from aiwholesail-api/)
 *   $ node --test test/lib/scrapeMetrics.test.js
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const Module = require('node:module');

// ─── Mock setup ────────────────────────────────────────────────────────────
//
// We pre-populate require.cache for ../../config/database so that when
// scrapeMetrics requires it, our fake is returned. This avoids importing
// the real pg.Pool (which would attempt a DB connection on module load).

const DB_PATH = require.resolve('../../config/database');

// Resettable per-test container. Tests reach in via `setQueryImpl(fn)` to
// install whatever behavior they need for that test.
let queryImpl = async () => ({ rows: [], rowCount: 0 });
const queryCalls = [];

function setQueryImpl(fn) {
  queryImpl = fn;
}

function resetQueryCalls() {
  queryCalls.length = 0;
}

const fakeDatabase = {
  query: async (text, params) => {
    queryCalls.push({ text, params });
    return queryImpl(text, params);
  },
  // unused by scrapeMetrics but present on the real module
  pool: {},
  getClient: async () => { throw new Error('not mocked'); },
};

// Install fake before requiring SUT.
const fakeMod = new Module(DB_PATH);
fakeMod.filename = DB_PATH;
fakeMod.loaded = true;
fakeMod.exports = fakeDatabase;
require.cache[DB_PATH] = fakeMod;

const {
  recordScrapeCall,
  getMetricsSnapshot,
  _internal,
} = require('../../lib/observability/scrapeMetrics');

// ─── Helper: drain setImmediate so we can observe the metric insert ────────
// scrapeMetrics fires inserts via setImmediate. To assert they happened we
// need to yield the macrotask queue once and let them run.
function flushImmediates() {
  return new Promise((resolve) => setImmediate(resolve));
}

// ─── Tests ─────────────────────────────────────────────────────────────────

test('recordScrapeCall — happy path returns fn value unchanged', async () => {
  resetQueryCalls();
  setQueryImpl(async () => ({ rows: [], rowCount: 1 }));

  const result = await recordScrapeCall(
    {
      provider: 'scrape-do-zillow',
      action: 'propertyDetails',
      callKind: 'primary',
      userId: '00000000-0000-0000-0000-000000000001',
    },
    async () => ({ zpid: 12345, ok: true }),
  );

  assert.deepEqual(result, { zpid: 12345, ok: true });

  await flushImmediates();
  assert.equal(queryCalls.length, 1, 'expected exactly one metric insert');
  const call = queryCalls[0];
  assert.match(call.text, /INSERT INTO scrape_provider_metrics/);
  // params order: provider, action, call_kind, success, duration_ms, error_excerpt, http_status, user_id
  assert.equal(call.params[0], 'scrape-do-zillow');
  assert.equal(call.params[1], 'propertyDetails');
  assert.equal(call.params[2], 'primary');
  assert.equal(call.params[3], true, 'success=true on happy path');
  assert.equal(typeof call.params[4], 'number', 'duration_ms is a number');
  assert.ok(call.params[4] >= 0, 'duration_ms is non-negative');
  assert.equal(call.params[5], null, 'error_excerpt is null on success');
  assert.equal(call.params[7], '00000000-0000-0000-0000-000000000001');
});

test('recordScrapeCall — fn throws: helper rethrows + records failure', async () => {
  resetQueryCalls();
  setQueryImpl(async () => ({ rows: [], rowCount: 1 }));

  await assert.rejects(
    () => recordScrapeCall(
      { provider: 'rapidapi-zillow', action: 'search', callKind: 'primary', userId: null },
      async () => { throw new Error('upstream 503 Service Unavailable'); },
    ),
    /upstream 503/,
  );

  await flushImmediates();
  assert.equal(queryCalls.length, 1);
  const params = queryCalls[0].params;
  assert.equal(params[0], 'rapidapi-zillow');
  assert.equal(params[3], false, 'success=false on throw');
  assert.match(params[5], /upstream 503/, 'error_excerpt captures the message');
  assert.equal(params[7], null, 'userId=null is passed through');
});

test('recordScrapeCall — duration_ms is a non-negative integer', async () => {
  resetQueryCalls();
  setQueryImpl(async () => ({ rows: [], rowCount: 1 }));

  await recordScrapeCall(
    { provider: 'scrape-do-zillow', action: 'photos', callKind: 'primary' },
    async () => {
      // Force a tiny but non-zero delay so duration_ms shouldn't be 0.
      await new Promise((r) => setTimeout(r, 5));
      return { ok: true };
    },
  );

  await flushImmediates();
  const durationMs = queryCalls[0].params[4];
  assert.equal(typeof durationMs, 'number');
  assert.ok(Number.isInteger(durationMs), 'duration_ms is rounded to int');
  assert.ok(durationMs >= 0, 'duration_ms >= 0');
});

test('recordScrapeCall — DB insert failure does NOT propagate to caller', async () => {
  resetQueryCalls();
  // Mock query to ALWAYS throw — simulating Postgres being down or the
  // grant missing. The wrapped fn's return value MUST still come through
  // and the helper must not throw.
  setQueryImpl(async () => { throw new Error('connection refused'); });

  const originalWarn = console.warn;
  const warnings = [];
  console.warn = (...args) => { warnings.push(args); };

  try {
    const result = await recordScrapeCall(
      { provider: 'scrape-do-zillow', action: 'propertyDetails', callKind: 'primary' },
      async () => 'payload-still-arrives',
    );

    assert.equal(result, 'payload-still-arrives',
      'wrapped fn result must be returned even when metric insert fails');

    // Wait for the setImmediate-scheduled insert to run + fail + warn.
    await flushImmediates();
    // The .catch inside scheduleInsert runs after the rejected promise
    // settles — yield one more turn so the warn fires.
    await new Promise((r) => setImmediate(r));

    assert.equal(queryCalls.length, 1, 'insert was attempted');
    assert.ok(
      warnings.some(args => /scrapeMetrics/.test(String(args[0]))),
      'a console.warn fired with the scrapeMetrics tag',
    );
  } finally {
    console.warn = originalWarn;
  }
});

test('recordScrapeCall — wrapped-fn throw is preserved even when DB insert also throws', async () => {
  resetQueryCalls();
  setQueryImpl(async () => { throw new Error('DB exploded'); });

  const originalWarn = console.warn;
  console.warn = () => {};

  try {
    await assert.rejects(
      () => recordScrapeCall(
        { provider: 'rapidapi-tps', action: 'byaddress', callKind: 'fallback' },
        async () => { throw new Error('upstream 429 rate limited'); },
      ),
      // The caller sees the ORIGINAL upstream error, never the DB error —
      // that's the whole point of fire-and-forget metric writes.
      /upstream 429 rate limited/,
    );

    await flushImmediates();
    await new Promise((r) => setImmediate(r));
  } finally {
    console.warn = originalWarn;
  }
});

test('recordScrapeCall — extracts http_status from axios-style error.response.status', async () => {
  resetQueryCalls();
  setQueryImpl(async () => ({ rows: [], rowCount: 1 }));

  const axiosLikeError = new Error('Request failed with status code 403');
  axiosLikeError.response = { status: 403, data: { error: 'forbidden' } };

  await assert.rejects(
    () => recordScrapeCall(
      { provider: 'rapidapi-zillow', action: 'search', callKind: 'primary' },
      async () => { throw axiosLikeError; },
    ),
    /403/,
  );

  await flushImmediates();
  assert.equal(queryCalls[0].params[6], 403, 'http_status pulled from err.response.status');
});

test('recordScrapeCall — invalid meta: still runs fn, skips insert', async () => {
  resetQueryCalls();
  setQueryImpl(async () => ({ rows: [], rowCount: 1 }));

  const originalWarn = console.warn;
  console.warn = () => {};

  try {
    const result = await recordScrapeCall(
      { provider: 'scrape-do-zillow' /* missing action + callKind */ },
      async () => 'still-runs',
    );
    assert.equal(result, 'still-runs');

    await flushImmediates();
    assert.equal(queryCalls.length, 0, 'no insert attempted with invalid meta');
  } finally {
    console.warn = originalWarn;
  }
});

test('_internal.buildErrorExcerpt — truncates at column width', () => {
  const long = 'x'.repeat(500);
  const excerpt = _internal.buildErrorExcerpt(new Error(long));
  assert.ok(excerpt.length <= _internal.ERROR_EXCERPT_MAX_LEN);
});

test('_internal.buildErrorExcerpt — collapses newlines to spaces', () => {
  const excerpt = _internal.buildErrorExcerpt(new Error('line1\nline2\r\nline3'));
  assert.equal(excerpt.includes('\n'), false);
  assert.equal(excerpt.includes('\r'), false);
});

test('_internal.buildErrorExcerpt — null/undefined returns null', () => {
  assert.equal(_internal.buildErrorExcerpt(null), null);
  assert.equal(_internal.buildErrorExcerpt(undefined), null);
});

test('_internal.extractHttpStatus — null when shape unrecognised', () => {
  assert.equal(_internal.extractHttpStatus(null), null);
  assert.equal(_internal.extractHttpStatus({}), null);
  assert.equal(_internal.extractHttpStatus('string'), null);
});

test('_internal.extractHttpStatus — pulls from common shapes', () => {
  assert.equal(_internal.extractHttpStatus({ status: 200 }), 200);
  assert.equal(_internal.extractHttpStatus({ statusCode: 404 }), 404);
  assert.equal(_internal.extractHttpStatus({ response: { status: 502 } }), 502);
});

test('getMetricsSnapshot — runs the aggregate query and returns rows', async () => {
  resetQueryCalls();
  const fakeRows = [
    {
      provider: 'scrape-do-zillow',
      action: 'propertyDetails',
      callKind: 'primary',
      totalCalls: 100,
      successRate: 0.97,
      p50_ms: 380,
      p95_ms: 1600,
    },
  ];
  setQueryImpl(async () => ({ rows: fakeRows, rowCount: 1 }));

  const result = await getMetricsSnapshot({ windowMinutes: 30 });
  assert.deepEqual(result, fakeRows);
  assert.equal(queryCalls.length, 1);
  assert.match(queryCalls[0].text, /scrape_provider_metrics/);
  assert.equal(queryCalls[0].params[0], '30');
});

test('getMetricsSnapshot — defaults windowMinutes to 60', async () => {
  resetQueryCalls();
  setQueryImpl(async () => ({ rows: [], rowCount: 0 }));

  await getMetricsSnapshot();
  assert.equal(queryCalls[0].params[0], '60');
});

test('getMetricsSnapshot — clamps absurd windows', async () => {
  resetQueryCalls();
  setQueryImpl(async () => ({ rows: [], rowCount: 0 }));

  await getMetricsSnapshot({ windowMinutes: -100 });
  assert.equal(queryCalls[0].params[0], '1', 'negative clamps to 1');

  resetQueryCalls();
  await getMetricsSnapshot({ windowMinutes: 999999 });
  // 7 days = 10080
  assert.equal(queryCalls[0].params[0], '10080', 'huge clamps to 7d');

  resetQueryCalls();
  await getMetricsSnapshot({ windowMinutes: NaN });
  assert.equal(queryCalls[0].params[0], '60', 'NaN falls back to 60');
});
