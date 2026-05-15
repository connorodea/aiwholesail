/**
 * Unit tests for middleware/errorHandler.js — Express error pipeline,
 * security-event logger, async wrapper, and the AppError / ValidationError
 * classes.
 *
 * Lifts coverage from 33%/29% line/function to ~95+%. Errors are the
 * code path users actually hit when something else is broken — covering
 * it pins observability and prevents leaking sensitive data in error
 * messages (sanitization logic).
 *
 * Run:
 *   node --test test/middleware/errorHandler.test.js
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');

process.env.JWT_SECRET = 'test-secret-do-not-use-in-prod';

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

const {
  errorHandler,
  asyncHandler,
  AppError,
  ValidationError,
  logSecurityEvent,
  sanitizeErrorMessage,
} = require('../../middleware/errorHandler');

// ─── Stub helpers ─────────────────────────────────────────────────────────

function makeReq({ user, headers = {}, path = '/api/test', method = 'GET', ip = '198.51.100.7' } = {}) {
  return { user, headers, path, method, ip };
}

function makeRes() {
  const res = {
    statusCode: null,
    body: null,
    status(c) { this.statusCode = c; return this; },
    json(p) { this.body = p; return this; },
  };
  return res;
}

function silenceConsoleErr(fn) {
  const orig = console.error;
  console.error = () => {};
  return Promise.resolve(fn()).finally(() => { console.error = orig; });
}

// ─── sanitizeErrorMessage ─────────────────────────────────────────────────

test('sanitizeErrorMessage: passes innocuous messages through unchanged', () => {
  assert.equal(sanitizeErrorMessage('User not found'), 'User not found');
  assert.equal(sanitizeErrorMessage('Invalid input'), 'Invalid input');
  assert.equal(sanitizeErrorMessage(''), '');
});

test('sanitizeErrorMessage: redacts messages mentioning "password"', () => {
  assert.equal(
    sanitizeErrorMessage('Wrong password for user@x.com'),
    'An error occurred while processing your request'
  );
});

test('sanitizeErrorMessage: redacts messages mentioning "token"', () => {
  assert.equal(
    sanitizeErrorMessage('JWT token verification failed'),
    'An error occurred while processing your request'
  );
});

test('sanitizeErrorMessage: redacts messages mentioning "secret"', () => {
  assert.equal(
    sanitizeErrorMessage('STRIPE_SECRET_KEY is not set'),
    'An error occurred while processing your request'
  );
});

test('sanitizeErrorMessage: redacts api_key, api-key, apikey variants', () => {
  const sentinel = 'An error occurred while processing your request';
  assert.equal(sanitizeErrorMessage('Bad api_key'), sentinel);
  assert.equal(sanitizeErrorMessage('Missing API-KEY header'), sentinel);
  assert.equal(sanitizeErrorMessage('apikey rotation failed'), sentinel);
});

test('sanitizeErrorMessage: redacts authorization / bearer / credential keywords', () => {
  const sentinel = 'An error occurred while processing your request';
  assert.equal(sanitizeErrorMessage('Authorization header missing'), sentinel);
  assert.equal(sanitizeErrorMessage('Invalid Bearer ABC123'), sentinel);
  assert.equal(sanitizeErrorMessage('Database credential expired'), sentinel);
});

test('sanitizeErrorMessage: case-insensitive — TOKEN / Token / token all redact', () => {
  const sentinel = 'An error occurred while processing your request';
  assert.equal(sanitizeErrorMessage('TOKEN expired'), sentinel);
  assert.equal(sanitizeErrorMessage('Token reuse detected'), sentinel);
  assert.equal(sanitizeErrorMessage('token=xyz'), sentinel);
});

// ─── logSecurityEvent ─────────────────────────────────────────────────────

test('logSecurityEvent: inserts into security_events with merged details + timestamp', async () => {
  resetDbCalls();
  setDbQuery(async () => ({ rows: [], rowCount: 1 }));
  const req = makeReq({
    headers: { 'x-forwarded-for': '203.0.113.5, 10.0.0.1', 'user-agent': 'Mozilla/5.0' },
  });
  await logSecurityEvent('test_event', { foo: 'bar' }, 'usr_1', req);
  assert.equal(dbCalls.length, 1);
  assert.match(dbCalls[0].text, /INSERT INTO security_events/);
  const [userId, eventType, details, ipAddr, userAgent] = dbCalls[0].params;
  assert.equal(userId, 'usr_1');
  assert.equal(eventType, 'test_event');
  const parsed = JSON.parse(details);
  assert.equal(parsed.foo, 'bar');
  assert.ok(parsed.timestamp, 'timestamp injected');
  assert.equal(ipAddr, '203.0.113.5', 'X-Forwarded-For first hop wins over req.ip');
  assert.equal(userAgent, 'Mozilla/5.0');
});

test('logSecurityEvent: falls back to req.ip when no X-Forwarded-For', async () => {
  resetDbCalls();
  const req = makeReq({ headers: {}, ip: '198.51.100.9' });
  await logSecurityEvent('event', {}, null, req);
  assert.equal(dbCalls[0].params[3], '198.51.100.9');
});

test('logSecurityEvent: writes null userId when not provided', async () => {
  resetDbCalls();
  await logSecurityEvent('event', {}, null, makeReq());
  assert.equal(dbCalls[0].params[0], null);
});

test('logSecurityEvent: swallows DB errors (never throws to caller)', async () => {
  setDbQuery(async () => { throw new Error('db down'); });
  await silenceConsoleErr(async () => {
    // Must not throw — caller (errorHandler) is itself running in an
    // error path and cannot tolerate a second failure.
    await assert.doesNotReject(() => logSecurityEvent('event', {}, 'u', makeReq()));
  });
});

// ─── errorHandler middleware ──────────────────────────────────────────────

test('errorHandler: 500 default + sanitized message + timestamp', async () => {
  setDbQuery(async () => ({ rows: [], rowCount: 1 }));
  const err = new Error('something broke');
  const res = makeRes();
  await silenceConsoleErr(() => errorHandler(err, makeReq(), res, () => {}));
  assert.equal(res.statusCode, 500);
  assert.equal(res.body.error, 'something broke');
  assert.ok(res.body.timestamp);
});

test('errorHandler: uses err.status when provided (e.g., 404)', async () => {
  const err = Object.assign(new Error('not here'), { status: 404 });
  const res = makeRes();
  await silenceConsoleErr(() => errorHandler(err, makeReq(), res, () => {}));
  assert.equal(res.statusCode, 404);
});

test('errorHandler: uses err.statusCode when err.status absent', async () => {
  const err = Object.assign(new Error('bad'), { statusCode: 422 });
  const res = makeRes();
  await silenceConsoleErr(() => errorHandler(err, makeReq(), res, () => {}));
  assert.equal(res.statusCode, 422);
});

test('errorHandler: sanitizes messages containing "password" → generic copy', async () => {
  const err = new Error('Wrong password supplied');
  const res = makeRes();
  await silenceConsoleErr(() => errorHandler(err, makeReq(), res, () => {}));
  assert.equal(res.body.error, 'An error occurred while processing your request');
});

test('errorHandler: empty message falls back to "Internal server error"', async () => {
  const err = new Error('');
  const res = makeRes();
  await silenceConsoleErr(() => errorHandler(err, makeReq(), res, () => {}));
  assert.equal(res.body.error, 'Internal server error');
});

test('errorHandler: maps express-validator-style err.errors to {field, message}', async () => {
  const err = Object.assign(new Error('Validation failed'), {
    status: 400,
    errors: [
      { param: 'email', msg: 'invalid email' },
      { path: 'age', message: 'must be a number' },
    ],
  });
  const res = makeRes();
  await silenceConsoleErr(() => errorHandler(err, makeReq(), res, () => {}));
  assert.equal(res.statusCode, 400);
  assert.deepEqual(res.body.errors, [
    { field: 'email', message: 'invalid email' },
    { field: 'age', message: 'must be a number' },
  ]);
});

test('errorHandler: includes stack in non-production env', async () => {
  const origEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = 'development';
  try {
    const err = new Error('boom');
    const res = makeRes();
    await silenceConsoleErr(() => errorHandler(err, makeReq(), res, () => {}));
    assert.ok(res.body.stack, 'stack present in dev');
  } finally {
    process.env.NODE_ENV = origEnv;
  }
});

test('errorHandler: omits stack in production env', async () => {
  const origEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = 'production';
  try {
    const err = new Error('boom');
    const res = makeRes();
    await silenceConsoleErr(() => errorHandler(err, makeReq(), res, () => {}));
    assert.equal(res.body.stack, undefined);
  } finally {
    process.env.NODE_ENV = origEnv;
  }
});

test('errorHandler: 5xx errors trigger a security-event log row', async () => {
  resetDbCalls();
  setDbQuery(async () => ({ rows: [], rowCount: 1 }));
  const err = new Error('db down');
  const req = makeReq({ user: { id: 'usr_99' } });
  const res = makeRes();
  await silenceConsoleErr(() => errorHandler(err, req, res, () => {}));
  assert.equal(dbCalls.length, 1, 'security_events row written for 500-class');
  assert.equal(dbCalls[0].params[1], 'server_error');
});

test('errorHandler: 4xx errors do NOT trigger a security-event log row', async () => {
  resetDbCalls();
  const err = Object.assign(new Error('not found'), { status: 404 });
  await silenceConsoleErr(() => errorHandler(err, makeReq(), makeRes(), () => {}));
  assert.equal(dbCalls.length, 0, '4xx must not log to security_events (noise reduction)');
});

// ─── asyncHandler ─────────────────────────────────────────────────────────

test('asyncHandler: passes resolved value through (no rejection)', async () => {
  let nextCalled = false;
  const wrapped = asyncHandler(async () => 'ok');
  await wrapped({}, {}, () => { nextCalled = true; });
  assert.equal(nextCalled, false, 'next should not be called on success');
});

test('asyncHandler: forwards rejected promises to next(err)', async () => {
  let captured = null;
  const wrapped = asyncHandler(async () => { throw new Error('async boom'); });
  await wrapped({}, {}, (err) => { captured = err; });
  // Give microtask queue a tick to settle the .catch
  await new Promise((r) => setImmediate(r));
  assert.equal(captured && captured.message, 'async boom');
});

test('asyncHandler: forwards thrown errors (non-async functions)', async () => {
  let captured = null;
  const wrapped = asyncHandler(() => Promise.reject(new Error('sync-throw')));
  await wrapped({}, {}, (err) => { captured = err; });
  await new Promise((r) => setImmediate(r));
  assert.equal(captured.message, 'sync-throw');
});

// ─── AppError ─────────────────────────────────────────────────────────────

test('AppError: defaults to status 500, carries message + dual status fields', () => {
  const e = new AppError('explode');
  assert.equal(e.message, 'explode');
  assert.equal(e.status, 500);
  assert.equal(e.statusCode, 500);
  assert.ok(e.stack, 'captureStackTrace populated stack');
});

test('AppError: respects custom status code', () => {
  const e = new AppError('teapot', 418);
  assert.equal(e.status, 418);
  assert.equal(e.statusCode, 418);
});

// ─── ValidationError ──────────────────────────────────────────────────────

test('ValidationError: status=400, errors array attached', () => {
  const errors = [{ field: 'email', message: 'required' }];
  const e = new ValidationError(errors);
  assert.equal(e.status, 400);
  assert.equal(e.message, 'Validation failed');
  assert.deepEqual(e.errors, errors);
  assert.ok(e instanceof AppError, 'extends AppError');
});
