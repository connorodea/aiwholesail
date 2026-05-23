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

// Counter for unique default event.ids — each call gets a fresh id so
// repeated test invocations don't dedup-collide with each other.
let _eventIdSeq = 1;

function initialPurchaseEvent({
  appUserId = 'user-abc-123',
  productId = 'aiwholesail_pro_monthly',
  eventId, // optional override; default auto-generates unique
} = {}) {
  return {
    event: {
      // RC always sends an event.id. The webhook dedups on it (migration 037).
      // Default to a fresh unique value; explicit tests override with a
      // specific id to assert dedup behavior.
      id: eventId || `evt-test-${_eventIdSeq++}`,
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

// Convenience: queue a "new event, dedup OK" response. Use this BEFORE
// queueing the user-lookup + state-mutation responses in every test
// that expects the handler to proceed past the dedup gate.
function pushDedupNew(pool) {
  pool.responses.push({ rowCount: 1 });
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
    pushDedupNew(pool); // 1st query: idempotency dedup INSERT (new event)
    pool.responses.push({ rows: [{ id: 'user-abc-123', email: 'u@example.com' }], rowCount: 1 }); // 2nd: user lookup
    pool.responses.push({ rows: [], rowCount: 1 }); // 3rd: subscribers upsert

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
    assert.equal(pool.calls.length, 3);
    assert.match(pool.calls[0].text, /INSERT INTO revenuecat_processed_events/i);
    assert.match(pool.calls[1].text, /FROM users WHERE id =/);
    assert.match(pool.calls[2].text, /INSERT INTO subscribers/);
    assert.match(pool.calls[2].text, /ON CONFLICT \(email\) DO UPDATE/);
    assert.equal(pool.calls[2].params[2], 'Pro'); // tier is param 3
    assert.match(pool.calls[2].text, /'revenuecat'/); // source literal in SQL
  });

  await t.test('CANCELLATION → only updates rows where source=revenuecat', async () => {
    const pool = makeMockPool();
    pushDedupNew(pool);
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
    assert.match(pool.calls[2].text, /UPDATE subscribers SET/);
    assert.match(pool.calls[2].text, /source = 'revenuecat'/);
    assert.match(pool.calls[2].text, /subscribed = FALSE/);
  });

  await t.test('anonymous $RCAnonymousID app_user_id → 200 noop, only dedup INSERT touches DB', async () => {
    const pool = makeMockPool();
    pushDedupNew(pool); // dedup runs before the anonymous-id guard
    const app = makeAppWithStubs({ pool });
    const event = initialPurchaseEvent({ appUserId: '$RCAnonymousID:abc123' });
    const res = await postJson(app, '/api/iap/revenuecat/webhook', event, {
      Authorization: WEBHOOK_AUTH,
    });
    assert.equal(res.status, 200);
    assert.equal(res.body.ignored, 'anonymous app_user_id');
    assert.equal(pool.calls.length, 1, 'only the dedup INSERT — no user lookup, no upsert');
    assert.match(pool.calls[0].text, /INSERT INTO revenuecat_processed_events/i);
  });

  await t.test('unknown user_id → 200 noop (no upsert for orphan event)', async () => {
    const pool = makeMockPool();
    pushDedupNew(pool);
    pool.responses.push({ rows: [], rowCount: 0 }); // user lookup miss
    const app = makeAppWithStubs({ pool });
    const res = await postJson(app, '/api/iap/revenuecat/webhook', initialPurchaseEvent(), {
      Authorization: WEBHOOK_AUTH,
    });
    assert.equal(res.status, 200);
    assert.equal(res.body.ignored, 'unknown user');
    assert.equal(pool.calls.length, 2, 'dedup INSERT + user lookup; no upsert');
  });

  await t.test('event for an unrelated entitlement → 200 noop, only dedup INSERT touches DB', async () => {
    const pool = makeMockPool();
    pushDedupNew(pool); // dedup runs before the entitlement guard
    const app = makeAppWithStubs({ pool });
    const event = initialPurchaseEvent();
    event.event.entitlement_ids = ['some_other_entitlement'];
    const res = await postJson(app, '/api/iap/revenuecat/webhook', event, {
      Authorization: WEBHOOK_AUTH,
    });
    assert.equal(res.status, 200);
    assert.equal(res.body.ignored, 'entitlement not Pro');
    assert.equal(pool.calls.length, 1, 'only the dedup INSERT');
  });

  await t.test('elite product id resolves tier=Elite', async () => {
    const pool = makeMockPool();
    pushDedupNew(pool);
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
    assert.equal(pool.calls[2].params[2], 'Elite'); // index +1 due to dedup
  });

  await t.test('TRIAL period_type sets is_trial=true and trial_end', async () => {
    const pool = makeMockPool();
    pushDedupNew(pool);
    pool.responses.push({ rows: [{ id: 'user-t', email: 't@example.com' }], rowCount: 1 });
    pool.responses.push({ rows: [], rowCount: 1 });
    const app = makeAppWithStubs({ pool });
    const event = initialPurchaseEvent({ appUserId: 'user-t' });
    event.event.period_type = 'TRIAL';
    const res = await postJson(app, '/api/iap/revenuecat/webhook', event, {
      Authorization: WEBHOOK_AUTH,
    });
    assert.equal(res.status, 200);
    // is_trial is param 5; index +1 on calls due to dedup
    assert.equal(pool.calls[2].params[4], true);
    // trial_end (param 6) must equal subscription_end (param 4) when trial
    assert.equal(pool.calls[2].params[5], pool.calls[2].params[3]);
  });

  await t.test('BILLING_ISSUE → 200 noop without state change', async () => {
    const pool = makeMockPool();
    pushDedupNew(pool);
    pool.responses.push({ rows: [{ id: 'user-b', email: 'b@example.com' }], rowCount: 1 });
    const app = makeAppWithStubs({ pool });
    const event = initialPurchaseEvent({ appUserId: 'user-b' });
    event.event.type = 'BILLING_ISSUE';
    const res = await postJson(app, '/api/iap/revenuecat/webhook', event, {
      Authorization: WEBHOOK_AUTH,
    });
    assert.equal(res.status, 200);
    assert.equal(res.body.action, 'noop');
    assert.equal(pool.calls.length, 2, 'dedup INSERT + user lookup; no state mutation');
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

  // ── Security regression guards (reviewer fix 2026-05-23) ──
  // Source-level guards: a future refactor that removes the constant-time
  // comparator or reverts to bare `!==` would expose the shared secret to
  // timing-side-channel attacks. Fail loudly if that happens.
  // Pattern matches PR #470's regression-guard tests.

  await t.test('auth check uses crypto.timingSafeEqual (timing-attack guard)', () => {
    const fs = require('node:fs');
    const routePath = path.join(__dirname, '..', '..', 'routes', 'revenuecat.js');
    const src = fs.readFileSync(routePath, 'utf8');
    assert.match(
      src,
      /crypto\.timingSafeEqual/,
      'revenuecat.js auth check must use crypto.timingSafeEqual to prevent timing leaks',
    );
  });

  await t.test('auth check does NOT use bare !== on the shared secret', () => {
    const fs = require('node:fs');
    const routePath = path.join(__dirname, '..', '..', 'routes', 'revenuecat.js');
    const src = fs.readFileSync(routePath, 'utf8');
    assert.doesNotMatch(
      src,
      /req\.headers\.authorization\s*!==\s*REVENUECAT_WEBHOOK_AUTH/,
      'revenuecat.js must not compare the auth secret with bare !==; use crypto.timingSafeEqual',
    );
  });

  // ── Cross-source state machine guard (reviewer Blocker 1, fix 2026-05-23) ──
  // Migration 036 adds a `source` column. RC writes `source='revenuecat'`,
  // Stripe must write `source='stripe'`. If a Stripe upsert lands on a row
  // currently owned by RC and DOES NOT stamp source, the row keeps
  // `source='revenuecat'`. Then RC's downgrade query
  //   UPDATE subscribers SET subscribed=FALSE WHERE source='revenuecat'
  // would wrongly downgrade a Stripe-owned subscription. Fix: every
  // Stripe upsert's ON CONFLICT SET clause must include `source='stripe'`.

  await t.test('every ON CONFLICT block in routes/stripe.js stamps source=stripe', () => {
    const fs = require('node:fs');
    const stripePath = path.join(__dirname, '..', '..', 'routes', 'stripe.js');
    const src = fs.readFileSync(stripePath, 'utf8');

    // Find every "ON CONFLICT (email) DO UPDATE SET" block that targets
    // the subscribers table. For each, the SET clause (everything up to
    // the closing backtick / next sql operation) must mention source.
    const blocks = src.match(/ON CONFLICT \(email\) DO UPDATE SET[\s\S]*?updated_at = NOW\(\)/g) || [];
    assert.ok(
      blocks.length >= 2,
      `Expected ≥2 ON CONFLICT (email) blocks in routes/stripe.js (subscribers upserts); found ${blocks.length}`,
    );

    const missing = blocks.filter((b) => !/source\s*=\s*'stripe'/i.test(b));
    assert.equal(
      missing.length,
      0,
      `${missing.length} of ${blocks.length} ON CONFLICT blocks in routes/stripe.js are missing source='stripe'. ` +
      `Without this, RC's WHERE source='revenuecat' downgrade can wrongly nuke a Stripe-owned row. ` +
      `First missing block (truncated): ${missing[0]?.slice(0, 200) ?? '(none)'}`,
    );
  });

  // ── Idempotency on event.id (reviewer fix 2026-05-23) ──
  // RC retries non-2xx webhooks aggressively. Without per-event dedup, a
  // retry can re-process a stale CANCELLATION/PURCHASE after the state has
  // moved on — flipping subscribed back, double-billing analytics, etc.
  // Fix: dedup INSERT-OR-CONFLICT on event.id into a processed-events
  // table BEFORE any state mutation. New event → INSERT succeeds (rowCount=1)
  // → proceed. Retry → INSERT conflicts (rowCount=0) → 200 noop, no work.

  await t.test('new event.id → dedup INSERT runs FIRST before any other query', async () => {
    const pool = makeMockPool();
    pool.responses.push({ rowCount: 1 });  // dedup INSERT — new event, succeeds
    pool.responses.push({ rows: [{ id: 'user-abc-123', email: 'u@example.com' }], rowCount: 1 }); // user lookup
    pool.responses.push({ rowCount: 1 }); // subscribers upsert

    const app = makeAppWithStubs({ pool });
    const event = initialPurchaseEvent({ appUserId: 'user-abc-123' });
    event.event.id = 'evt-test-new-001';
    const res = await postJson(app, '/api/iap/revenuecat/webhook', event, {
      Authorization: WEBHOOK_AUTH,
    });

    assert.equal(res.status, 200);
    assert.equal(pool.calls.length >= 1, true);
    assert.match(
      pool.calls[0].text,
      /INSERT\s+INTO\s+revenuecat_processed_events/i,
      'first query MUST be the dedup INSERT against revenuecat_processed_events',
    );
    assert.deepEqual(pool.calls[0].params, ['evt-test-new-001']);
  });

  await t.test('duplicate event.id → 200 noop, NO state-mutation queries fire', async () => {
    const pool = makeMockPool();
    pool.responses.push({ rowCount: 0 });  // dedup INSERT conflicts — event already processed

    const app = makeAppWithStubs({ pool });
    const event = initialPurchaseEvent({ appUserId: 'user-abc-123' });
    event.event.id = 'evt-test-dup-001';
    const res = await postJson(app, '/api/iap/revenuecat/webhook', event, {
      Authorization: WEBHOOK_AUTH,
    });

    assert.equal(res.status, 200);
    assert.match(
      JSON.stringify(res.body).toLowerCase(),
      /duplicate|already.processed|idempotent/,
      'response body must indicate the event was a duplicate',
    );
    assert.equal(
      pool.calls.length,
      1,
      `only the dedup INSERT should fire; no user lookup, no upsert. Got ${pool.calls.length} calls: ${JSON.stringify(pool.calls.map((c) => c.text.slice(0, 40)))}`,
    );
  });

  await t.test('missing event.id → 400 (RC always sends id; missing means malformed)', async () => {
    const pool = makeMockPool();
    const app = makeAppWithStubs({ pool });
    const event = initialPurchaseEvent({ appUserId: 'user-abc-123' });
    // Fixture auto-sets event.id by default; delete it to simulate
    // malformed payload or non-RC source. Without event_id we can't dedup.
    delete event.event.id;
    const res = await postJson(app, '/api/iap/revenuecat/webhook', event, {
      Authorization: WEBHOOK_AUTH,
    });

    assert.equal(res.status, 400);
    assert.equal(pool.calls.length, 0, 'malformed payload must not touch DB');
  });
});
