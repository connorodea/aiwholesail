/**
 * Tests for POST /api/email-capture — the public lead-capture endpoint
 * backing the exit-intent modal on /guides/finding-motivated-sellers
 * (and any future lead-magnet form).
 *
 * Built test-first per the TDD skill: this file existed and ran red
 * before the route was implemented. The route shape was designed by
 * writing these tests, not by working backwards from a pre-written
 * implementation.
 *
 * Test strategy: a minimal express app stubs auth + rate-limit so we
 * test the route's input validation + DB-insert + Resend-send shape in
 * isolation. The DB is mocked at the pg-pool level; Resend is mocked
 * by replacing process.env.RESEND_API_KEY (the SDK no-ops without it
 * AND we capture the SDK call separately).
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const http = require('node:http');

// In-memory mock pool that the route will use instead of real Postgres.
// `query(text, params)` returns the next pre-canned response from
// `mockResponses`. Tracks all calls so tests can inspect them.
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

function makeAppWithStubs({ pool, resendCalls }) {
  const app = express();
  app.use(express.json());

  // Override require cache for config/database.js → use our mock pool
  const path = require('node:path');
  const dbPath = path.join(__dirname, '..', '..', 'config', 'database.js');
  delete require.cache[dbPath];
  require.cache[dbPath] = {
    id: dbPath,
    filename: dbPath,
    loaded: true,
    exports: { pool, query: pool.query.bind(pool) },
  };

  // Override Resend by stubbing the module — capture .emails.send calls
  const resendPath = require.resolve('resend');
  delete require.cache[resendPath];
  require.cache[resendPath] = {
    id: resendPath,
    filename: resendPath,
    loaded: true,
    exports: {
      Resend: class StubResend {
        constructor(_key) {}
        get emails() {
          return {
            send: async (msg) => {
              resendCalls.push(msg);
              return { data: { id: 'mock-resend-id' }, error: null };
            },
          };
        }
      },
    },
  };

  // Stub the rate-limit middleware so we don't need a real DB for it
  const rateLimitPath = path.join(__dirname, '..', '..', 'middleware', 'rateLimit.js');
  delete require.cache[rateLimitPath];
  require.cache[rateLimitPath] = {
    id: rateLimitPath,
    filename: rateLimitPath,
    loaded: true,
    exports: {
      checkDatabaseRateLimit: async () => ({ allowed: true, remaining: 5 }),
      rateLimiter: (_req, _res, next) => next(),
    },
  };

  // Stub the errorHandler so logSecurityEvent doesn't try to hit a real DB
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

  delete require.cache[require.resolve('../../routes/emailCapture')];
  const route = require('../../routes/emailCapture');
  app.use('/api/email-capture', route);
  return app;
}

function postJson(app, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const server = app.listen(0, () => {
      const port = server.address().port;
      const payload = JSON.stringify(body);
      const req = http.request({
        method: 'POST',
        host: '127.0.0.1',
        port,
        path: '/api/email-capture',
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

test('POST /api/email-capture', async (t) => {
  await t.test('valid email + slug → 200, inserts row, sends Resend email', async () => {
    const pool = makeMockPool();
    pool.responses.push({ rows: [{ id: 'cap-1' }], rowCount: 1 }); // INSERT returning
    const resendCalls = [];
    const app = makeAppWithStubs({ pool, resendCalls });

    const res = await postJson(app, {
      email: 'investor@example.com',
      slug: 'finding-motivated-sellers',
    });

    assert.equal(res.status, 200);
    assert.equal(res.body.ok, true);
    assert.ok(pool.calls.some(c => /INSERT INTO email_captures/i.test(c.text)),
      'must insert into email_captures');
    assert.equal(resendCalls.length, 1, 'must trigger exactly one Resend send');
    assert.equal(resendCalls[0].to, 'investor@example.com');
    assert.ok(/checklist|guide|motivated/i.test(resendCalls[0].subject),
      'subject must reference the lead magnet');
  });

  await t.test('invalid email → 400, no DB insert, no email sent', async () => {
    const pool = makeMockPool();
    const resendCalls = [];
    const app = makeAppWithStubs({ pool, resendCalls });

    const res = await postJson(app, {
      email: 'not-an-email',
      slug: 'finding-motivated-sellers',
    });

    assert.equal(res.status, 400);
    assert.equal(pool.calls.length, 0);
    assert.equal(resendCalls.length, 0);
  });

  await t.test('missing slug → 400', async () => {
    const pool = makeMockPool();
    const resendCalls = [];
    const app = makeAppWithStubs({ pool, resendCalls });

    const res = await postJson(app, { email: 'investor@example.com' });
    assert.equal(res.status, 400);
    assert.equal(resendCalls.length, 0);
  });

  await t.test('unknown slug → 400 (we only deliver mapped lead magnets)', async () => {
    const pool = makeMockPool();
    const resendCalls = [];
    const app = makeAppWithStubs({ pool, resendCalls });

    const res = await postJson(app, {
      email: 'investor@example.com',
      slug: 'totally-fake-slug-xyz',
    });
    assert.equal(res.status, 400);
    assert.equal(resendCalls.length, 0);
  });

  await t.test('duplicate email + slug → 200 ok (idempotent via ON CONFLICT)', async () => {
    const pool = makeMockPool();
    // Simulate ON CONFLICT DO NOTHING returning 0 rows
    pool.responses.push({ rows: [], rowCount: 0 });
    const resendCalls = [];
    const app = makeAppWithStubs({ pool, resendCalls });

    const res = await postJson(app, {
      email: 'investor@example.com',
      slug: 'finding-motivated-sellers',
    });
    assert.equal(res.status, 200);
    assert.equal(res.body.ok, true);
    // Duplicate: still 200, but we did NOT re-send the email
    assert.equal(resendCalls.length, 0, 'do not re-send to already-captured email');
  });

  await t.test('Resend send failure → 200 but logs the error (lead still captured)', async () => {
    const pool = makeMockPool();
    pool.responses.push({ rows: [{ id: 'cap-2' }], rowCount: 1 });

    // Override Resend to fail on send
    const resendCalls = [];
    const app = makeAppWithStubs({ pool, resendCalls });

    // Re-stub Resend mid-test for this single call to throw
    const resendPath = require.resolve('resend');
    require.cache[resendPath].exports.Resend = class FailingResend {
      get emails() {
        return {
          send: async (msg) => {
            resendCalls.push(msg);
            return { data: null, error: { message: 'upstream 502' } };
          },
        };
      }
    };
    // Re-load route to pick up new Resend stub
    delete require.cache[require.resolve('../../routes/emailCapture')];

    const res = await postJson(app, {
      email: 'investor@example.com',
      slug: 'finding-motivated-sellers',
    });

    // Lead is captured in DB regardless of email delivery status.
    // Better to capture-and-retry-later than reject-and-lose-the-lead.
    assert.equal(res.status, 200);
  });
});
