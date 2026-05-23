/**
 * Integration test for the zombie-auth observability hook in
 * middleware/auth.js.
 *
 * Scenario: a request arrives with a Bearer JWT that VERIFIES (correct
 * signature, not expired) but whose `userId` claim does NOT resolve to
 * any row in `users`. This is the cpodea5 incident class at the API
 * level — the server-side analogue of the frontend zombie session.
 *
 * The middleware must:
 *   1. Still return 401 (no behavior change for the user-facing path)
 *   2. Record a row via lib/observability/authMetrics.recordZombieAuthEvent
 *   3. Schedule that record via setImmediate (fire-and-forget — never
 *      blocks the 401 response)
 *
 * Strategy: substitute the cached `../../config/database` module and the
 * cached authMetrics module with fakes BEFORE requiring the SUT. We then
 * invoke the middleware with handcrafted req/res/next stubs and assert
 * on the call shape.
 *
 *   $ node --test test/middleware/auth-zombie.test.js
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');
const jwt = require('jsonwebtoken');

// ─── Mock setup ────────────────────────────────────────────────────────────
//
// Order matters. We have to install the database mock first because
// authMetrics itself requires '../../config/database' on load.

process.env.JWT_SECRET = 'test-secret-do-not-use-in-prod';

// 1) Fake database — controllable per-test.
const DB_PATH = require.resolve('../../config/database');

let dbQueryImpl = async () => ({ rows: [], rowCount: 0 });
const dbCalls = [];
function setDbQuery(fn) { dbQueryImpl = fn; }
function resetDbCalls() { dbCalls.length = 0; }

const fakeDatabase = {
  query: async (text, params) => {
    dbCalls.push({ text, params });
    return dbQueryImpl(text, params);
  },
  pool: {},
  getClient: async () => { throw new Error('not mocked'); },
};

const fakeDbMod = new Module(DB_PATH);
fakeDbMod.filename = DB_PATH;
fakeDbMod.loaded = true;
fakeDbMod.exports = fakeDatabase;
require.cache[DB_PATH] = fakeDbMod;

// 2) Fake authMetrics — we want to assert the middleware CALLED it with
// the right shape, separately from asserting the helper's own behavior
// (which is covered in test/lib/authMetrics.test.js — see the dedicated
// unit tests for the helper's clamp/normalize/setImmediate path).
const AUTH_METRICS_PATH = require.resolve('../../lib/observability/authMetrics');

const recordedZombieEvents = [];
function resetRecorded() { recordedZombieEvents.length = 0; }

const fakeAuthMetrics = {
  recordZombieAuthEvent: (event) => {
    recordedZombieEvents.push(event);
  },
  getZombieAuthSnapshot: async () => ({}),
};

const fakeAuthMetricsMod = new Module(AUTH_METRICS_PATH);
fakeAuthMetricsMod.filename = AUTH_METRICS_PATH;
fakeAuthMetricsMod.loaded = true;
fakeAuthMetricsMod.exports = fakeAuthMetrics;
require.cache[AUTH_METRICS_PATH] = fakeAuthMetricsMod;

// Now require the SUT — it'll pick up both fakes.
const { authenticate } = require('../../middleware/auth');

// ─── Test helpers ──────────────────────────────────────────────────────────

function makeReq({ token, ip = '203.0.113.42', ua = 'Mozilla/5.0 (Test)', path = '/api/foo' } = {}) {
  return {
    headers: {
      authorization: token ? `Bearer ${token}` : undefined,
    },
    ip,
    originalUrl: path,
    path,
    get(name) {
      if (name && name.toLowerCase() === 'user-agent') return ua;
      return undefined;
    },
  };
}

function makeRes() {
  const res = {
    statusCode: null,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.body = payload; return this; },
  };
  return res;
}

// ─── Tests ─────────────────────────────────────────────────────────────────

test('authenticate — zombie state: verified JWT + missing user row → 401 AND records event', async () => {
  resetDbCalls();
  resetRecorded();

  // DB returns no rows for the users lookup → zombie state.
  setDbQuery(async () => ({ rows: [], rowCount: 0 }));

  const ZOMBIE_USER_ID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
  const token = jwt.sign({ userId: ZOMBIE_USER_ID, email: 'ghost@example.com' }, process.env.JWT_SECRET, { expiresIn: '1h' });

  const req = makeReq({ token, ip: '198.51.100.7', ua: 'AcmeBrowser/1.0', path: '/api/whoami' });
  const res = makeRes();
  let nextCalled = false;
  const next = () => { nextCalled = true; };

  await authenticate(req, res, next);

  // 1) Behavior unchanged — still 401 with same payload
  assert.equal(res.statusCode, 401, 'returns 401 on zombie state (unchanged behavior)');
  assert.equal(res.body && res.body.error, 'User not found',
    '401 body matches existing "User not found" string');
  assert.equal(nextCalled, false, 'next() is NOT called on the zombie 401 path');

  // 2) The users lookup happened with the JWT claim
  assert.ok(dbCalls.length >= 1, 'users lookup happened');
  assert.match(dbCalls[0].text, /FROM users WHERE id = \$1/);
  assert.equal(dbCalls[0].params[0], ZOMBIE_USER_ID);

  // 3) Zombie event was recorded with the expected shape
  assert.equal(recordedZombieEvents.length, 1, 'recordZombieAuthEvent was called exactly once');
  const event = recordedZombieEvents[0];
  assert.equal(event.jwtUserId, ZOMBIE_USER_ID,
    'jwtUserId carries the claim that failed to match');
  assert.equal(event.clientIp, '198.51.100.7', 'clientIp comes from req.ip');
  assert.equal(event.userAgent, 'AcmeBrowser/1.0', 'userAgent comes from the UA header');
  assert.equal(event.requestPath, '/api/whoami', 'requestPath comes from req.originalUrl');
});

test('authenticate — happy path: valid JWT + existing user → next() AND no zombie event', async () => {
  resetDbCalls();
  resetRecorded();

  const REAL_USER_ID = '11111111-2222-3333-4444-555555555555';
  setDbQuery(async () => ({
    rows: [{
      id: REAL_USER_ID,
      email: 'real@example.com',
      full_name: 'Real User',
      email_verified: true,
    }],
    rowCount: 1,
  }));

  const token = jwt.sign({ userId: REAL_USER_ID, email: 'real@example.com' }, process.env.JWT_SECRET, { expiresIn: '1h' });

  const req = makeReq({ token });
  const res = makeRes();
  let nextCalled = false;
  const next = () => { nextCalled = true; };

  await authenticate(req, res, next);

  assert.equal(res.statusCode, null, 'no status set on happy path');
  assert.equal(nextCalled, true, 'next() is called when user exists');
  assert.equal(req.user && req.user.id, REAL_USER_ID, 'req.user is attached');
  assert.equal(recordedZombieEvents.length, 0,
    'happy path must NOT record a zombie event');
});

test('authenticate — bad signature: 401 fires BUT no zombie event (not a zombie state)', async () => {
  resetDbCalls();
  resetRecorded();

  // Sign with a DIFFERENT secret so jwt.verify throws JsonWebTokenError.
  const badToken = jwt.sign({ userId: 'whatever' }, 'wrong-secret', { expiresIn: '1h' });

  const req = makeReq({ token: badToken });
  const res = makeRes();
  let nextCalled = false;
  const next = () => { nextCalled = true; };

  await authenticate(req, res, next);

  assert.equal(res.statusCode, 401);
  assert.equal(res.body && res.body.error, 'Invalid token');
  assert.equal(nextCalled, false);

  // Critical: an invalid signature is NOT a zombie state. The JWT didn't
  // verify, so we never even got to the users lookup. The counter must
  // not fire for this case — otherwise C3 burns budget on garbage
  // traffic from script kiddies hitting the API with random tokens.
  assert.equal(recordedZombieEvents.length, 0,
    'invalid-signature 401 must NOT record a zombie event');
});

test('authenticate — missing auth header: 401 fires BUT no zombie event', async () => {
  resetDbCalls();
  resetRecorded();

  const req = makeReq({ token: null });
  const res = makeRes();
  let nextCalled = false;
  const next = () => { nextCalled = true; };

  await authenticate(req, res, next);

  assert.equal(res.statusCode, 401);
  assert.equal(res.body && res.body.error, 'Authorization header required');
  assert.equal(nextCalled, false);
  assert.equal(recordedZombieEvents.length, 0,
    'no-auth-header 401 must NOT record a zombie event');
});

test('authenticate — expired token: 401 with TOKEN_EXPIRED code, no zombie event', async () => {
  resetDbCalls();
  resetRecorded();

  // Sign with a negative expiry → already expired.
  const expiredToken = jwt.sign({ userId: 'whatever' }, process.env.JWT_SECRET, { expiresIn: '-1h' });

  const req = makeReq({ token: expiredToken });
  const res = makeRes();
  await authenticate(req, res, () => {});

  assert.equal(res.statusCode, 401);
  assert.equal(res.body && res.body.code, 'TOKEN_EXPIRED');
  assert.equal(recordedZombieEvents.length, 0,
    'expired-token 401 must NOT record a zombie event (legit auth expiry, not zombie)');
});
