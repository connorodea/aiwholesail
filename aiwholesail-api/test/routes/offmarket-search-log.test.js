/**
 * Tests for POST /api/offmarket-search-log — the structured-log emission
 * endpoint that feeds SLI-1 (endpoint diversity) and SLI-3 (empty-result
 * rate) of the off-market routing monitor.
 *
 * Uses supertest with a minimal express app stubbed to bypass the real
 * auth middleware — we test the route's input validation + log emission
 * shape, not authentication.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const http = require('node:http');

function makeAppWithStubAuth(userId = 'test-user-id') {
  const app = express();
  app.use(express.json());
  // Stub auth: attaches req.user = { id } and passes through.
  app.use((req, _res, next) => { req.user = { id: userId }; next(); });

  // Inject the route, but override authenticate import by doing a fresh
  // require with a stubbed middleware on the proxy path.
  const Module = require('node:module');
  const originalResolve = Module._resolveFilename;
  Module._resolveFilename = function (request, ...rest) {
    if (request.endsWith('middleware/auth')) {
      return originalResolve.call(this, require.resolve('node:path'), ...rest);
    }
    return originalResolve.call(this, request, ...rest);
  };
  try {
    const path = require('node:path');
    require.cache[require.resolve(path.join(__dirname, '..', '..', 'middleware', 'auth.js'))] = {
      id: 'stub-auth',
      filename: 'stub-auth',
      loaded: true,
      exports: { authenticate: (req, _res, next) => { req.user = { id: userId }; next(); } },
    };
  } catch { /* path may not exist on first run */ }
  Module._resolveFilename = originalResolve;

  // Direct mount — clear require.cache for the route to pick up the auth stub.
  delete require.cache[require.resolve('../../routes/offmarketSearchLog')];
  const route = require('../../routes/offmarketSearchLog');
  app.use('/api/offmarket-search-log', route);
  return app;
}

function postJson(app, body) {
  return new Promise((resolve, reject) => {
    const server = app.listen(0, () => {
      const port = server.address().port;
      const payload = JSON.stringify(body);
      const req = http.request({
        method: 'POST',
        host: '127.0.0.1',
        port,
        path: '/api/offmarket-search-log',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) },
      }, (res) => {
        let raw = '';
        res.on('data', (c) => { raw += c; });
        res.on('end', () => {
          server.close();
          try { resolve({ status: res.statusCode, body: raw ? JSON.parse(raw) : null }); }
          catch { resolve({ status: res.statusCode, body: raw }); }
        });
      });
      req.on('error', (err) => { server.close(); reject(err); });
      req.write(payload);
      req.end();
    });
  });
}

function captureConsoleLog(fn) {
  const original = console.log;
  const captured = [];
  console.log = (...args) => { captured.push(args.join(' ')); };
  return Promise.resolve(fn()).finally(() => { console.log = original; }).then(() => captured);
}

test('POST /api/offmarket-search-log', async (t) => {
  const app = makeAppWithStubAuth('user-1');

  await t.test('accepts a healthy single-feed search summary', async () => {
    const captured = await captureConsoleLog(async () => {
      const res = await postJson(app, {
        lead_types_selected: ['absentee'],
        endpoints_dispatched: ['property'],
        result_count: 24,
        region_label: 'Hennepin County, MN',
        search_id: 'abc-123',
      });
      assert.equal(res.status, 200);
      assert.deepEqual(res.body, { ok: true });
    });
    assert.equal(captured.length, 1, 'must emit exactly one log line');
    const log = JSON.parse(captured[0]);
    assert.equal(log.component, 'offmarket-search');
    assert.equal(log.user_id, 'user-1');
    assert.deepEqual(log.lead_types_selected, ['absentee']);
    assert.deepEqual(log.endpoints_dispatched, ['property']);
    assert.equal(log.result_count, 24);
    assert.equal(log.region_label, 'Hennepin County, MN');
    assert.equal(log.search_id, 'abc-123');
    assert.ok(log.ts, 'ts is present');
  });

  await t.test('accepts the dual-feed shape (the PR #311 fix output)', async () => {
    const captured = await captureConsoleLog(async () => {
      const res = await postJson(app, {
        lead_types_selected: ['absentee', 'pre-foreclosure', 'high-equity'],
        endpoints_dispatched: ['property', 'preforeclosure'],
        result_count: 17,
        region_label: 'FL',
        search_id: 'mixed-1',
      });
      assert.equal(res.status, 200);
    });
    const log = JSON.parse(captured[0]);
    assert.deepEqual(log.endpoints_dispatched, ['property', 'preforeclosure']);
  });

  await t.test('accepts empty lead_types_selected (v1 search)', async () => {
    const res = await postJson(app, {
      lead_types_selected: [],
      endpoints_dispatched: ['property'],
      result_count: 5,
    });
    assert.equal(res.status, 200);
  });

  await t.test('rejects non-array lead_types_selected', async () => {
    const res = await postJson(app, {
      lead_types_selected: 'absentee',
      endpoints_dispatched: ['property'],
      result_count: 0,
    });
    assert.equal(res.status, 400);
  });

  await t.test('rejects too many lead types (DOS guard)', async () => {
    const res = await postJson(app, {
      lead_types_selected: Array(25).fill('absentee'),
      endpoints_dispatched: ['property'],
      result_count: 0,
    });
    assert.equal(res.status, 400);
  });

  await t.test('rejects non-string entries in arrays', async () => {
    const res = await postJson(app, {
      lead_types_selected: ['absentee', 42],
      endpoints_dispatched: ['property'],
      result_count: 0,
    });
    assert.equal(res.status, 400);
  });

  await t.test('rejects negative or non-finite result_count', async () => {
    const r1 = await postJson(app, {
      lead_types_selected: ['absentee'],
      endpoints_dispatched: ['property'],
      result_count: -1,
    });
    assert.equal(r1.status, 400);

    const r2 = await postJson(app, {
      lead_types_selected: ['absentee'],
      endpoints_dispatched: ['property'],
      result_count: 'NaN',
    });
    assert.equal(r2.status, 400);
  });

  await t.test('rejects result_count above the DOS ceiling', async () => {
    const res = await postJson(app, {
      lead_types_selected: ['absentee'],
      endpoints_dispatched: ['property'],
      result_count: 999_999,
    });
    assert.equal(res.status, 400);
  });

  await t.test('silently drops oversized region_label (still 200, label nulled)', async () => {
    const captured = await captureConsoleLog(async () => {
      const res = await postJson(app, {
        lead_types_selected: ['absentee'],
        endpoints_dispatched: ['property'],
        result_count: 1,
        region_label: 'x'.repeat(500),
      });
      assert.equal(res.status, 200);
    });
    const log = JSON.parse(captured[0]);
    assert.equal(log.region_label, null);
  });
});
