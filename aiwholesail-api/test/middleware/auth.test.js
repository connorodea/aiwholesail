/**
 * Unit tests for middleware/auth.js covering every exported function
 * EXCEPT the zombie-auth path (which has its own dedicated test in
 * test/middleware/auth-zombie.test.js).
 *
 * Lifts middleware/auth.js from ~56% line / 20% function coverage
 * to ~95+%. The middleware sits in front of every authenticated route
 * — every branch deserves a regression pin.
 *
 * Mock strategy mirrors auth-zombie.test.js: substitute the cached
 * `../../config/database` and `../../lib/observability/authMetrics`
 * modules with fakes BEFORE requiring the SUT, then exercise via
 * handcrafted req/res/next stubs.
 *
 * Run:
 *   node --test test/middleware/auth.test.js
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');
const jwt = require('jsonwebtoken');

process.env.JWT_SECRET = 'test-secret-do-not-use-in-prod';
process.env.JWT_EXPIRES_IN = '1h';
process.env.JWT_REFRESH_EXPIRES_IN = '30d';

// ─── Module substitution ──────────────────────────────────────────────────

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

const AUTH_METRICS_PATH = require.resolve('../../lib/observability/authMetrics');
const fakeAuthMetrics = {
  recordZombieAuthEvent: () => {},
  getZombieAuthSnapshot: async () => ({}),
};
const fakeAuthMetricsMod = new Module(AUTH_METRICS_PATH);
fakeAuthMetricsMod.filename = AUTH_METRICS_PATH;
fakeAuthMetricsMod.loaded = true;
fakeAuthMetricsMod.exports = fakeAuthMetrics;
require.cache[AUTH_METRICS_PATH] = fakeAuthMetricsMod;

const {
  authenticate,
  optionalAuth,
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
} = require('../../middleware/auth');

// ─── Stub helpers ─────────────────────────────────────────────────────────

function makeReq({ authHeader } = {}) {
  return {
    headers: authHeader === undefined ? {} : { authorization: authHeader },
    ip: '203.0.113.7',
    originalUrl: '/api/test',
    path: '/api/test',
    get() { return 'Mozilla/5.0 (Test)'; },
  };
}

function makeRes() {
  const calls = [];
  const res = {
    statusCode: null,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.body = payload; calls.push({ statusCode: this.statusCode, payload }); return this; },
    calls,
  };
  return res;
}

function makeNext() {
  const calls = [];
  const fn = (...args) => { calls.push(args); };
  fn.calls = calls;
  return fn;
}

function validJwt({ userId = 'usr_123', email = 'a@b.com' } = {}) {
  return jwt.sign({ userId, email }, process.env.JWT_SECRET, { expiresIn: '1h' });
}

function expiredJwt({ userId = 'usr_123' } = {}) {
  return jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: -10 });
}

// ─── authenticate ─────────────────────────────────────────────────────────

test('authenticate: 401 when Authorization header is missing', async () => {
  resetDbCalls();
  const req = makeReq();
  const res = makeRes();
  const next = makeNext();
  await authenticate(req, res, next);
  assert.equal(res.statusCode, 401);
  assert.equal(res.body.error, 'Authorization header required');
  assert.equal(next.calls.length, 0);
  assert.equal(dbCalls.length, 0, 'no DB hit when header missing');
});

test('authenticate: 401 when Bearer header has empty token', async () => {
  resetDbCalls();
  const req = makeReq({ authHeader: 'Bearer ' });
  const res = makeRes();
  const next = makeNext();
  await authenticate(req, res, next);
  assert.equal(res.statusCode, 401);
  assert.equal(res.body.error, 'Token required');
  assert.equal(next.calls.length, 0);
});

test('authenticate: 401 + code=TOKEN_EXPIRED on expired JWT', async () => {
  const req = makeReq({ authHeader: `Bearer ${expiredJwt()}` });
  const res = makeRes();
  const next = makeNext();
  await authenticate(req, res, next);
  assert.equal(res.statusCode, 401);
  assert.equal(res.body.error, 'Token expired');
  assert.equal(res.body.code, 'TOKEN_EXPIRED');
  assert.equal(next.calls.length, 0);
});

test('authenticate: 401 "Invalid token" on JsonWebTokenError (malformed)', async () => {
  const req = makeReq({ authHeader: 'Bearer not-a-real-jwt' });
  const res = makeRes();
  const next = makeNext();
  await authenticate(req, res, next);
  assert.equal(res.statusCode, 401);
  assert.equal(res.body.error, 'Invalid token');
});

test('authenticate: valid token + user found attaches req.user and calls next()', async () => {
  setDbQuery(async () => ({
    rows: [{ id: 'usr_42', email: 'jane@example.com', full_name: 'Jane Doe', email_verified: true }],
    rowCount: 1,
  }));
  const req = makeReq({ authHeader: `Bearer ${validJwt({ userId: 'usr_42', email: 'jane@example.com' })}` });
  const res = makeRes();
  const next = makeNext();
  await authenticate(req, res, next);
  assert.equal(res.statusCode, null, 'no status set on success');
  assert.equal(next.calls.length, 1);
  assert.deepEqual(req.user, {
    id: 'usr_42',
    email: 'jane@example.com',
    fullName: 'Jane Doe',
    emailVerified: true,
  });
});

test('authenticate: 500 when DB throws (unexpected error path)', async () => {
  setDbQuery(async () => { throw new Error('connection refused'); });
  const req = makeReq({ authHeader: `Bearer ${validJwt()}` });
  const res = makeRes();
  const next = makeNext();
  const origErr = console.error;
  console.error = () => {}; // silence the expected error log
  try {
    await authenticate(req, res, next);
  } finally {
    console.error = origErr;
  }
  assert.equal(res.statusCode, 500);
  assert.equal(res.body.error, 'Authentication failed');
  assert.equal(next.calls.length, 0);
});

// ─── optionalAuth ─────────────────────────────────────────────────────────

test('optionalAuth: no header → req.user=null + next()', async () => {
  const req = makeReq();
  const res = makeRes();
  const next = makeNext();
  await optionalAuth(req, res, next);
  assert.equal(req.user, null);
  assert.equal(next.calls.length, 1);
  assert.equal(res.statusCode, null);
});

test('optionalAuth: empty Bearer token → req.user=null + next()', async () => {
  const req = makeReq({ authHeader: 'Bearer ' });
  const res = makeRes();
  const next = makeNext();
  await optionalAuth(req, res, next);
  assert.equal(req.user, null);
  assert.equal(next.calls.length, 1);
});

test('optionalAuth: invalid JWT silently falls through with req.user=null', async () => {
  // The inner try/catch around jwt.verify swallows errors so the request
  // continues as an anonymous request — that's the optional contract.
  const req = makeReq({ authHeader: 'Bearer not-a-real-jwt' });
  const res = makeRes();
  const next = makeNext();
  await optionalAuth(req, res, next);
  assert.equal(req.user, null);
  assert.equal(next.calls.length, 1);
  assert.equal(res.statusCode, null);
});

test('optionalAuth: valid JWT + user found → req.user attached + next()', async () => {
  setDbQuery(async () => ({
    rows: [{ id: 'usr_77', email: 'sam@example.com', full_name: 'Sam', email_verified: false }],
    rowCount: 1,
  }));
  const req = makeReq({ authHeader: `Bearer ${validJwt({ userId: 'usr_77' })}` });
  const res = makeRes();
  const next = makeNext();
  await optionalAuth(req, res, next);
  assert.deepEqual(req.user, {
    id: 'usr_77',
    email: 'sam@example.com',
    fullName: 'Sam',
    emailVerified: false,
  });
  assert.equal(next.calls.length, 1);
});

test('optionalAuth: valid JWT but user row missing → req.user=null + next()', async () => {
  // Zombie-auth at the OPTIONAL boundary: still safe, just anonymizes.
  setDbQuery(async () => ({ rows: [], rowCount: 0 }));
  const req = makeReq({ authHeader: `Bearer ${validJwt({ userId: 'usr_ghost' })}` });
  const res = makeRes();
  const next = makeNext();
  await optionalAuth(req, res, next);
  assert.equal(req.user, null);
  assert.equal(next.calls.length, 1);
});

// ─── generateAccessToken ──────────────────────────────────────────────────

test('generateAccessToken: returns a verifiable JWT containing {userId, email}', () => {
  const token = generateAccessToken('usr_55', 'q@e.com');
  assert.equal(typeof token, 'string');
  const decoded = jwt.verify(token, process.env.JWT_SECRET);
  assert.equal(decoded.userId, 'usr_55');
  assert.equal(decoded.email, 'q@e.com');
  assert.equal(decoded.type, undefined, 'access tokens carry no type claim');
});

test('generateAccessToken: respects JWT_EXPIRES_IN env (exp claim is set)', () => {
  const token = generateAccessToken('u1', 'a@b.com');
  const decoded = jwt.verify(token, process.env.JWT_SECRET);
  assert.equal(typeof decoded.exp, 'number');
  assert.ok(decoded.exp > Math.floor(Date.now() / 1000), 'expiry must be in the future');
});

// ─── generateRefreshToken ─────────────────────────────────────────────────

test('generateRefreshToken: returns a verifiable JWT with type=refresh', () => {
  const token = generateRefreshToken('usr_99');
  const decoded = jwt.verify(token, process.env.JWT_SECRET);
  assert.equal(decoded.userId, 'usr_99');
  assert.equal(decoded.type, 'refresh');
});

// ─── verifyRefreshToken ───────────────────────────────────────────────────

test('verifyRefreshToken: returns decoded payload when valid + present in sessions', async () => {
  setDbQuery(async () => ({ rows: [{ id: 'sess_1' }], rowCount: 1 }));
  const rt = generateRefreshToken('usr_12');
  const decoded = await verifyRefreshToken(rt);
  assert.equal(decoded.userId, 'usr_12');
  assert.equal(decoded.type, 'refresh');
});

test('verifyRefreshToken: throws when token type is not refresh (e.g., access token reused)', async () => {
  const accessToken = generateAccessToken('usr_12', 'a@b.com');
  await assert.rejects(() => verifyRefreshToken(accessToken), /Invalid token type/);
});

test('verifyRefreshToken: throws when session is revoked / expired / absent in DB', async () => {
  setDbQuery(async () => ({ rows: [], rowCount: 0 }));
  const rt = generateRefreshToken('usr_12');
  await assert.rejects(() => verifyRefreshToken(rt), /Refresh token not found or expired/);
});

test('verifyRefreshToken: bubbles up jwt.verify failures (malformed token)', async () => {
  await assert.rejects(() => verifyRefreshToken('not-a-real-token'), /jwt malformed|invalid/i);
});

test('verifyRefreshToken: queries sessions with the refresh-token string as param', async () => {
  resetDbCalls();
  setDbQuery(async () => ({ rows: [{ id: 'sess_2' }], rowCount: 1 }));
  const rt = generateRefreshToken('usr_44');
  await verifyRefreshToken(rt);
  assert.equal(dbCalls.length, 1);
  assert.match(dbCalls[0].text, /SELECT \* FROM sessions WHERE refresh_token = \$1/);
  assert.deepEqual(dbCalls[0].params, [rt]);
});
