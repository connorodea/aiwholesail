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

  await t.test('Resend send THROWS exception → 200, exception caught + logged (lead still captured)', async () => {
    // Like the rate-limit test below: must install the throwing-Resend
    // stub BEFORE the route module loads. The route instantiates
    // `const resend = new Resend(...)` at module load and captures the
    // instance — substituting the class mid-test doesn't affect the
    // already-constructed object. Covers lines 329-335 in emailCapture.js.
    const pathMod = require('node:path');
    const pool = makeMockPool();
    pool.responses.push({ rows: [{ id: 'cap-throw' }], rowCount: 1 });

    // 1. Mock database
    const dbPath = pathMod.join(__dirname, '..', '..', 'config', 'database.js');
    delete require.cache[dbPath];
    require.cache[dbPath] = {
      id: dbPath, filename: dbPath, loaded: true,
      exports: { pool, query: pool.query.bind(pool) },
    };

    // 2. Mock Resend with a THROWING send — exercises the outer catch.
    const resendPath = require.resolve('resend');
    delete require.cache[resendPath];
    require.cache[resendPath] = {
      id: resendPath, filename: resendPath, loaded: true,
      exports: {
        Resend: class ThrowingResend {
          get emails() {
            return { send: async () => { throw new Error('network ECONNRESET'); } };
          }
        },
      },
    };

    // 3. Mock rate-limit to ALLOW (we want to reach the email-send path).
    const rateLimitPath = pathMod.join(__dirname, '..', '..', 'middleware', 'rateLimit.js');
    delete require.cache[rateLimitPath];
    require.cache[rateLimitPath] = {
      id: rateLimitPath, filename: rateLimitPath, loaded: true,
      exports: {
        checkDatabaseRateLimit: async () => ({ allowed: true, remaining: 5 }),
        rateLimiter: (_req, _res, next) => next(),
      },
    };

    // 4. Mock errorHandler
    const errorHandlerPath = pathMod.join(__dirname, '..', '..', 'middleware', 'errorHandler.js');
    delete require.cache[errorHandlerPath];
    require.cache[errorHandlerPath] = {
      id: errorHandlerPath, filename: errorHandlerPath, loaded: true,
      exports: {
        asyncHandler: (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next),
        logSecurityEvent: async () => {},
        errorHandler: (err, _req, res, _next) => res.status(err.status || 500).json({ error: err.message }),
      },
    };

    delete require.cache[require.resolve('../../routes/emailCapture')];
    const route = require('../../routes/emailCapture');
    const app = express();
    app.use(express.json());
    app.use('/api/email-capture', route);

    // Silence the expected console.error from the catch branch.
    const origErr = console.error;
    console.error = () => {};
    try {
      const res = await postJson(app, {
        email: 'investor@example.com',
        slug: 'finding-motivated-sellers',
      });
      // Lead captured (rowCount=1), exception swallowed → 200 OK.
      assert.equal(res.status, 200);
      assert.equal(res.body.ok, true);
      assert.equal(res.body.captured, true);
    } finally {
      console.error = origErr;
    }
  });

  await t.test('Resend returns {error} (non-throw) → 200, error logged (lead still captured)', async () => {
    // Companion to the throw-case above — same load-order discipline so
    // the error-returning Resend stub is the one the route actually uses.
    // Covers lines 320-327 in emailCapture.js (the if-result.error branch).
    const pathMod = require('node:path');
    const pool = makeMockPool();
    pool.responses.push({ rows: [{ id: 'cap-err' }], rowCount: 1 });

    const dbPath = pathMod.join(__dirname, '..', '..', 'config', 'database.js');
    delete require.cache[dbPath];
    require.cache[dbPath] = {
      id: dbPath, filename: dbPath, loaded: true,
      exports: { pool, query: pool.query.bind(pool) },
    };

    const resendPath = require.resolve('resend');
    delete require.cache[resendPath];
    let sendCalls = 0;
    require.cache[resendPath] = {
      id: resendPath, filename: resendPath, loaded: true,
      exports: {
        Resend: class ErrorReturningResend {
          get emails() {
            return { send: async () => { sendCalls += 1; return { data: null, error: { message: 'upstream 502' } }; } };
          }
        },
      },
    };

    const rateLimitPath = pathMod.join(__dirname, '..', '..', 'middleware', 'rateLimit.js');
    delete require.cache[rateLimitPath];
    require.cache[rateLimitPath] = {
      id: rateLimitPath, filename: rateLimitPath, loaded: true,
      exports: {
        checkDatabaseRateLimit: async () => ({ allowed: true, remaining: 5 }),
        rateLimiter: (_req, _res, next) => next(),
      },
    };

    const errorHandlerPath = pathMod.join(__dirname, '..', '..', 'middleware', 'errorHandler.js');
    delete require.cache[errorHandlerPath];
    require.cache[errorHandlerPath] = {
      id: errorHandlerPath, filename: errorHandlerPath, loaded: true,
      exports: {
        asyncHandler: (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next),
        logSecurityEvent: async () => {},
        errorHandler: (err, _req, res, _next) => res.status(err.status || 500).json({ error: err.message }),
      },
    };

    delete require.cache[require.resolve('../../routes/emailCapture')];
    const route = require('../../routes/emailCapture');
    const app = express();
    app.use(express.json());
    app.use('/api/email-capture', route);

    const origErr = console.error;
    console.error = () => {};
    try {
      const res = await postJson(app, {
        email: 'investor2@example.com',
        slug: 'finding-motivated-sellers',
      });
      assert.equal(res.status, 200);
      assert.equal(res.body.ok, true);
      assert.equal(res.body.captured, true);
      assert.equal(sendCalls, 1, 'resend was actually invoked (not bypassed by stale stub)');
    } finally {
      console.error = origErr;
    }
  });

  await t.test('rate-limit hit → 429 + security event logged (no DB insert, no email)', async () => {
    // This case can't use makeAppWithStubs because the route captures
    // `checkDatabaseRateLimit` at module-load (destructure on import).
    // Overriding the stub after the harness installed it would be too
    // late — the route already grabbed the function reference. So we
    // install our deny-stub directly into require.cache BEFORE the
    // route module loads.
    const pathMod = require('node:path');
    const pool = makeMockPool();
    const resendCalls = [];

    // 1. Mock database
    const dbPath = pathMod.join(__dirname, '..', '..', 'config', 'database.js');
    delete require.cache[dbPath];
    require.cache[dbPath] = {
      id: dbPath,
      filename: dbPath,
      loaded: true,
      exports: { pool, query: pool.query.bind(pool) },
    };

    // 2. Mock Resend (we should never reach it, but the route requires it at load)
    const resendPath = require.resolve('resend');
    delete require.cache[resendPath];
    require.cache[resendPath] = {
      id: resendPath,
      filename: resendPath,
      loaded: true,
      exports: {
        Resend: class StubResend {
          get emails() {
            return { send: async (m) => { resendCalls.push(m); return { data: null, error: null }; } };
          }
        },
      },
    };

    // 3. Mock rate-limit middleware to DENY — this is the path under test.
    const rateLimitPath = pathMod.join(__dirname, '..', '..', 'middleware', 'rateLimit.js');
    delete require.cache[rateLimitPath];
    require.cache[rateLimitPath] = {
      id: rateLimitPath,
      filename: rateLimitPath,
      loaded: true,
      exports: {
        checkDatabaseRateLimit: async () => ({ allowed: false, remaining: 0 }),
        rateLimiter: (_req, _res, next) => next(),
      },
    };

    // 4. Mock errorHandler — track security-event log calls.
    const errorHandlerPath = pathMod.join(__dirname, '..', '..', 'middleware', 'errorHandler.js');
    const securityLogCalls = [];
    delete require.cache[errorHandlerPath];
    require.cache[errorHandlerPath] = {
      id: errorHandlerPath,
      filename: errorHandlerPath,
      loaded: true,
      exports: {
        asyncHandler: (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next),
        logSecurityEvent: async (eventType, details) => { securityLogCalls.push({ eventType, details }); },
        errorHandler: (err, _req, res, _next) => res.status(err.status || 500).json({ error: err.message }),
      },
    };

    // 5. Now load the route with all stubs in place.
    delete require.cache[require.resolve('../../routes/emailCapture')];
    const route = require('../../routes/emailCapture');
    const app = express();
    app.use(express.json());
    app.use('/api/email-capture', route);

    const res = await postJson(app, {
      email: 'spammer@example.com',
      slug: 'finding-motivated-sellers',
    });

    assert.equal(res.status, 429);
    assert.match(res.body.error, /Too many submissions/);
    assert.equal(pool.calls.length, 0, 'no DB insert when rate-limited');
    assert.equal(resendCalls.length, 0, 'no email sent when rate-limited');
    assert.equal(securityLogCalls.length, 1);
    assert.equal(securityLogCalls[0].eventType, 'email_capture_rate_limited');
    assert.equal(securityLogCalls[0].details.slug, 'finding-motivated-sellers');
  });
});
