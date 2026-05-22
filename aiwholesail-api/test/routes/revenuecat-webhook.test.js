/**
 * Tests for POST /api/iap/revenuecat/webhook — the RevenueCat → API
 * bridge that mirrors iOS IAP entitlements into the subscribers table.
 *
 * Strategy mirrors test/routes/email-capture.test.js: stub the pg pool,
 * stub auth + rate-limit + errorHandler, mount the real route, send
 * fixture HTTP requests, assert status + SQL shape.
 *
 * Auth is treated as an invariant — wrong/missing header must never
 * touch the DB. The bulk of the suite validates that the RC event-type
 * → subscribers state machine grants Pro only when it should and only
 * downgrades rows it actually owns (source='revenuecat').
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const http = require('node:http');
const path = require('node:path');

const WEBHOOK_AUTH = 'test-shared-secret';

function makeMockPool() {
  const pool = {
    calls: [],
    responses: [],
    query: async (text, params) => {
      pool.calls.push({ text, params });
      const next = pool.responses.shift();
      if (next instanceof Error) throw next;
      return next || { rows: [], rowCount: 0 };
    },
    end: async () => {},
  };
  return pool;
}

function makeAppWithStubs({ pool, env = {} }) {
  Object.assign(process.env, {
    REVENUECAT_WEBHOOK_AUTH: WEBHOOK_AUTH,
    REVENUECAT_PRO_ENTITLEMENT: 'AIWHOLESAIL Pro',
    ...env,
  });

  const dbPath = path.join(__dirname, '..', '..', 'config', 'database.js');
  delete require.cache[dbPath];
  require.cache[dbPath] = {
    id: dbPath,
    filename: dbPath,
    loaded: true,
    exports: { pool, query: pool.query.bind(pool) },
  };

  const errorHandlerPath = path.join(__dirname, '..', '..', 'middleware', 'errorHandler.js');
  delete require.cache[errorHandlerPath];
  require.cache[errorHandlerPath] = {
    id: errorHandlerPath,
    filename: errorHandlerPath,
    loaded: true,
    exports: {
      asyncHandler: (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next),
      logSecurityEvent: async () => {},
      errorHandler: (err, _req, res, _next) => res.status(err.status || 500).json({ error: err.message }),
    },
  };

  delete require.cache[require.resolve('../../routes/revenuecat')];
  const route = require('../../routes/revenuecat');
  const app = express();
  app.use('/api/iap/revenuecat', route);
  return app;
}

function postJson(app, urlPath, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const server = app.listen(0, () => {
      const port = server.address().port;
      const payload = JSON.stringify(body);
      const req = http.request({
        method: 'POST',
        host: '127.0.0.1',
        port,
        path: urlPath,
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload),
          ...headers,
        },
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

function initialPurchaseEvent({
  appUserId = 'user-abc-123',
  productId = 'aiwholesail_pro_monthly',
} = {}) {
  return {
    event: {
      type: 'INITIAL_PURCHASE',
      app_user_id: appUserId,
      original_app_user_id: appUserId,
      product_id: productId,
      original_transaction_id: 'apl_tx_1001',
      entitlement_ids: ['AIWHOLESAIL Pro'],
      expiration_at_ms: Date.UTC(2026, 5, 22),
      period_type: 'NORMAL',
    },
  };
}

test('POST /api/iap/revenuecat/webhook', async (t) => {
  await t.test('missing Authorization header → 401, no DB touched', async () => {
    const pool = makeMockPool();
    const app = makeAppWithStubs({ pool });
    const res = await postJson(app, '/api/iap/revenuecat/webhook', initialPurchaseEvent());
    assert.equal(res.status, 401);
    assert.equal(pool.calls.length, 0, 'must not query DB on auth fail');
  });

  await t.test('wrong Authorization header → 401', async () => {
    const pool = makeMockPool();
    const app = makeAppWithStubs({ pool });
    const res = await postJson(app, '/api/iap/revenuecat/webhook', initialPurchaseEvent(), {
      Authorization: 'totally-wrong',
    });
    assert.equal(res.status, 401);
    assert.equal(pool.calls.length, 0);
  });

  await t.test('REVENUECAT_WEBHOOK_AUTH unset → 503 (fail-closed)', async () => {
    delete process.env.REVENUECAT_WEBHOOK_AUTH;
    const pool = makeMockPool();
    // Bypass the helper's default — explicitly clear after.
    const dbPath = path.join(__dirname, '..', '..', 'config', 'database.js');
    delete require.cache[dbPath];
    require.cache[dbPath] = {
      id: dbPath, filename: dbPath, loaded: true,
      exports: { pool, query: pool.query.bind(pool) },
    };
    const errPath = path.join(__dirname, '..', '..', 'middleware', 'errorHandler.js');
    delete require.cache[errPath];
    require.cache[errPath] = {
      id: errPath, filename: errPath, loaded: true,
      exports: {
        asyncHandler: (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next),
        logSecurityEvent: async () => {},
        errorHandler: (err, _req, res, _next) => res.status(err.status || 500).json({ error: err.message }),
      },
    };
    delete require.cache[require.resolve('../../routes/revenuecat')];
    const route = require('../../routes/revenuecat');
    const app = express();
    app.use('/api/iap/revenuecat', route);
    const res = await postJson(app, '/api/iap/revenuecat/webhook', initialPurchaseEvent(), {
      Authorization: 'anything',
    });
    assert.equal(res.status, 503);
    assert.equal(pool.calls.length, 0);
    process.env.REVENUECAT_WEBHOOK_AUTH = WEBHOOK_AUTH;
  });

  await t.test('INITIAL_PURCHASE → upserts subscribers with subscribed=true, tier=Pro, source=revenuecat', async () => {
    const pool = makeMockPool();
    // 1st query: user lookup
    pool.responses.push({ rows: [{ id: 'user-abc-123', email: 'u@example.com' }], rowCount: 1 });
    // 2nd query: upsert
    pool.responses.push({ rows: [], rowCount: 1 });

    const app = makeAppWithStubs({ pool });
    const res = await postJson(
      app,
      '/api/iap/revenuecat/webhook',
      initialPurchaseEvent({ appUserId: 'user-abc-123' }),
      { Authorization: WEBHOOK_AUTH },
    );
    assert.equal(res.status, 200);
    assert.equal(res.body.action, 'activated');
    assert.equal(res.body.tier, 'Pro');
    assert.equal(pool.calls.length, 2);
    assert.match(pool.calls[0].text, /FROM users WHERE id =/);
    assert.match(pool.calls[1].text, /INSERT INTO subscribers/);
    assert.match(pool.calls[1].text, /ON CONFLICT \(email\) DO UPDATE/);
    // Tier is the 3rd parameter in the INSERT
    assert.equal(pool.calls[1].params[2], 'Pro');
    // source literal is in the SQL, not the params
    assert.match(pool.calls[1].text, /'revenuecat'/);
  });

  await t.test('CANCELLATION → only updates rows where source=revenuecat', async () => {
    const pool = makeMockPool();
    pool.responses.push({ rows: [{ id: 'user-x', email: 'x@example.com' }], rowCount: 1 });
    pool.responses.push({ rows: [], rowCount: 1 });

    const app = makeAppWithStubs({ pool });
    const event = initialPurchaseEvent({ appUserId: 'user-x' });
    event.event.type = 'CANCELLATION';
    const res = await postJson(app, '/api/iap/revenuecat/webhook', event, {
      Authorization: WEBHOOK_AUTH,
    });
    assert.equal(res.status, 200);
    assert.equal(res.body.action, 'deactivated');
    assert.match(pool.calls[1].text, /UPDATE subscribers SET/);
    assert.match(pool.calls[1].text, /source = 'revenuecat'/);
    assert.match(pool.calls[1].text, /subscribed = FALSE/);
  });

  await t.test('anonymous $RCAnonymousID app_user_id → 200 noop, no DB writes', async () => {
    const pool = makeMockPool();
    const app = makeAppWithStubs({ pool });
    const event = initialPurchaseEvent({ appUserId: '$RCAnonymousID:abc123' });
    const res = await postJson(app, '/api/iap/revenuecat/webhook', event, {
      Authorization: WEBHOOK_AUTH,
    });
    assert.equal(res.status, 200);
    assert.equal(res.body.ignored, 'anonymous app_user_id');
    assert.equal(pool.calls.length, 0);
  });

  await t.test('unknown user_id → 200 noop (no upsert for orphan event)', async () => {
    const pool = makeMockPool();
    pool.responses.push({ rows: [], rowCount: 0 }); // user lookup miss
    const app = makeAppWithStubs({ pool });
    const res = await postJson(app, '/api/iap/revenuecat/webhook', initialPurchaseEvent(), {
      Authorization: WEBHOOK_AUTH,
    });
    assert.equal(res.status, 200);
    assert.equal(res.body.ignored, 'unknown user');
    assert.equal(pool.calls.length, 1, 'only the user lookup, no upsert');
  });

  await t.test('event for an unrelated entitlement → 200 noop', async () => {
    const pool = makeMockPool();
    const app = makeAppWithStubs({ pool });
    const event = initialPurchaseEvent();
    event.event.entitlement_ids = ['some_other_entitlement'];
    const res = await postJson(app, '/api/iap/revenuecat/webhook', event, {
      Authorization: WEBHOOK_AUTH,
    });
    assert.equal(res.status, 200);
    assert.equal(res.body.ignored, 'entitlement not Pro');
    assert.equal(pool.calls.length, 0);
  });

  await t.test('elite product id resolves tier=Elite', async () => {
    const pool = makeMockPool();
    pool.responses.push({ rows: [{ id: 'user-e', email: 'e@example.com' }], rowCount: 1 });
    pool.responses.push({ rows: [], rowCount: 1 });
    const app = makeAppWithStubs({ pool });
    const event = initialPurchaseEvent({
      appUserId: 'user-e',
      productId: 'aiwholesail_elite_yearly',
    });
    const res = await postJson(app, '/api/iap/revenuecat/webhook', event, {
      Authorization: WEBHOOK_AUTH,
    });
    assert.equal(res.status, 200);
    assert.equal(res.body.tier, 'Elite');
    assert.equal(pool.calls[1].params[2], 'Elite');
  });

  await t.test('TRIAL period_type sets is_trial=true and trial_end', async () => {
    const pool = makeMockPool();
    pool.responses.push({ rows: [{ id: 'user-t', email: 't@example.com' }], rowCount: 1 });
    pool.responses.push({ rows: [], rowCount: 1 });
    const app = makeAppWithStubs({ pool });
    const event = initialPurchaseEvent({ appUserId: 'user-t' });
    event.event.period_type = 'TRIAL';
    const res = await postJson(app, '/api/iap/revenuecat/webhook', event, {
      Authorization: WEBHOOK_AUTH,
    });
    assert.equal(res.status, 200);
    // is_trial is param 5 in the INSERT
    assert.equal(pool.calls[1].params[4], true);
    // trial_end is param 6 — must equal subscription_end when trial
    assert.equal(pool.calls[1].params[5], pool.calls[1].params[3]);
  });

  await t.test('BILLING_ISSUE → 200 noop without state change', async () => {
    const pool = makeMockPool();
    pool.responses.push({ rows: [{ id: 'user-b', email: 'b@example.com' }], rowCount: 1 });
    const app = makeAppWithStubs({ pool });
    const event = initialPurchaseEvent({ appUserId: 'user-b' });
    event.event.type = 'BILLING_ISSUE';
    const res = await postJson(app, '/api/iap/revenuecat/webhook', event, {
      Authorization: WEBHOOK_AUTH,
    });
    assert.equal(res.status, 200);
    assert.equal(res.body.action, 'noop');
    assert.equal(pool.calls.length, 1, 'only the user lookup, no state mutation');
  });

  await t.test('malformed body (no event key) → 400', async () => {
    const pool = makeMockPool();
    const app = makeAppWithStubs({ pool });
    const res = await postJson(app, '/api/iap/revenuecat/webhook', { not: 'an event' }, {
      Authorization: WEBHOOK_AUTH,
    });
    assert.equal(res.status, 400);
    assert.equal(pool.calls.length, 0);
  });
});
