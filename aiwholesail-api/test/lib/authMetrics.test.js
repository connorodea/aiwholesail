/**
 * Unit tests for lib/observability/authMetrics.
 *
 * Mirrors the strategy in test/lib/scrapeMetrics.test.js: substitute the
 * cached `../../config/database` module with a fake `query` BEFORE
 * requiring the SUT, so the real pg.Pool is never instantiated.
 *
 *   $ node --test test/lib/authMetrics.test.js
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');

// ─── Mock setup ────────────────────────────────────────────────────────────

const DB_PATH = require.resolve('../../config/database');

let queryImpl = async () => ({ rows: [], rowCount: 0 });
const queryCalls = [];
function setQueryImpl(fn) { queryImpl = fn; }
function resetQueryCalls() { queryCalls.length = 0; }

const fakeDatabase = {
  query: async (text, params) => {
    queryCalls.push({ text, params });
    return queryImpl(text, params);
  },
  pool: {},
  getClient: async () => { throw new Error('not mocked'); },
};

const fakeMod = new Module(DB_PATH);
fakeMod.filename = DB_PATH;
fakeMod.loaded = true;
fakeMod.exports = fakeDatabase;
require.cache[DB_PATH] = fakeMod;

const {
  recordZombieAuthEvent,
  getZombieAuthSnapshot,
  _internal,
} = require('../../lib/observability/authMetrics');

function flushImmediates() {
  return new Promise((resolve) => setImmediate(resolve));
}

// ─── Tests ─────────────────────────────────────────────────────────────────

test('recordZombieAuthEvent — schedules an insert with the expected columns', async () => {
  resetQueryCalls();
  setQueryImpl(async () => ({ rows: [], rowCount: 1 }));

  recordZombieAuthEvent({
    jwtUserId: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
    clientIp: '203.0.113.7',
    userAgent: 'Mozilla/5.0 (Macintosh)',
    requestPath: '/api/whoami',
  });

  // setImmediate-scheduled — must drain.
  await flushImmediates();

  assert.equal(queryCalls.length, 1, 'expected exactly one insert');
  const call = queryCalls[0];
  assert.match(call.text, /INSERT INTO auth_zombie_events/);
  // params order: jwt_user_id, client_ip, user_agent, request_path
  assert.equal(call.params[0], 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee');
  assert.equal(call.params[1], '203.0.113.7');
  assert.equal(call.params[2], 'Mozilla/5.0 (Macintosh)');
  assert.equal(call.params[3], '/api/whoami');
});

test('recordZombieAuthEvent — never throws on bad input (defensive)', async () => {
  resetQueryCalls();
  setQueryImpl(async () => ({ rows: [], rowCount: 1 }));

  // None of these should throw — bad input degrades to "skip insert" or
  // "insert with nulls", never an exception that propagates to the 401.
  assert.doesNotThrow(() => recordZombieAuthEvent(null));
  assert.doesNotThrow(() => recordZombieAuthEvent(undefined));
  assert.doesNotThrow(() => recordZombieAuthEvent({}));
  assert.doesNotThrow(() => recordZombieAuthEvent({
    jwtUserId: undefined, clientIp: undefined,
    userAgent: undefined, requestPath: undefined,
  }));
});

test('recordZombieAuthEvent — DB failure is swallowed (does NOT throw)', async () => {
  // Drain any setImmediates queued by previous tests so their inserts
  // are flushed before we reset the call counter.
  await flushImmediates();
  await new Promise((r) => setImmediate(r));
  resetQueryCalls();
  setQueryImpl(async () => { throw new Error('connection refused'); });

  const origWarn = console.warn;
  const warnings = [];
  console.warn = (...args) => { warnings.push(args); };

  try {
    // Call returns synchronously (no await).
    const ret = recordZombieAuthEvent({
      jwtUserId: 'u1', clientIp: '127.0.0.1',
      userAgent: 'curl', requestPath: '/api/x',
    });
    assert.equal(ret, undefined, 'fire-and-forget — returns undefined synchronously');

    await flushImmediates();
    await new Promise((r) => setImmediate(r));

    assert.equal(queryCalls.length, 1, 'insert was attempted');
    assert.ok(
      warnings.some((args) => /authMetrics/.test(String(args[0]))),
      'a console.warn fired with the authMetrics tag',
    );
  } finally {
    console.warn = origWarn;
  }
});

test('_internal.normalizeIp — strips IPv4-mapped IPv6 prefix', () => {
  assert.equal(_internal.normalizeIp('::ffff:192.0.2.5'), '192.0.2.5');
});

test('_internal.normalizeIp — takes first entry of comma-separated XFF', () => {
  assert.equal(
    _internal.normalizeIp('203.0.113.1, 198.51.100.99, 10.0.0.1'),
    '203.0.113.1',
  );
});

test('_internal.normalizeIp — null/empty returns null', () => {
  assert.equal(_internal.normalizeIp(null), null);
  assert.equal(_internal.normalizeIp(undefined), null);
  assert.equal(_internal.normalizeIp(''), null);
  assert.equal(_internal.normalizeIp('   '), null);
});

test('_internal.clamp — truncates oversized strings', () => {
  const big = 'x'.repeat(1000);
  const clamped = _internal.clamp(big, 100);
  assert.equal(clamped.length, 100);
  assert.ok(clamped.endsWith('…'));
});

test('_internal.clamp — passes through short strings unchanged', () => {
  assert.equal(_internal.clamp('hello', 100), 'hello');
});

test('_internal.clamp — null/undefined returns null', () => {
  assert.equal(_internal.clamp(null, 100), null);
  assert.equal(_internal.clamp(undefined, 100), null);
});

test('recordZombieAuthEvent — clamps oversized UA, path, and userId values', async () => {
  resetQueryCalls();
  setQueryImpl(async () => ({ rows: [], rowCount: 1 }));

  const hugeUa = 'A'.repeat(2000);
  const hugePath = '/api/x?' + 'q='.repeat(2000);
  const hugeUid = 'B'.repeat(2000);

  recordZombieAuthEvent({
    jwtUserId: hugeUid,
    clientIp: '203.0.113.1',
    userAgent: hugeUa,
    requestPath: hugePath,
  });
  await flushImmediates();

  const params = queryCalls[0].params;
  assert.ok(params[0].length <= _internal.JWT_USER_ID_MAX_LEN);
  assert.ok(params[2].length <= _internal.USER_AGENT_MAX_LEN);
  assert.ok(params[3].length <= _internal.REQUEST_PATH_MAX_LEN);
});

test('getZombieAuthSnapshot — runs aggregate query and returns the row', async () => {
  resetQueryCalls();
  const fakeRow = {
    totalEvents: 17,
    uniqueUsers: 3,
    uniqueIps: 5,
    firstSeen: new Date('2026-05-14T18:01:00Z'),
    lastSeen: new Date('2026-05-14T18:42:00Z'),
  };
  setQueryImpl(async () => ({ rows: [fakeRow], rowCount: 1 }));

  const result = await getZombieAuthSnapshot({ windowMinutes: 30 });
  assert.deepEqual(result, fakeRow);
  assert.match(queryCalls[0].text, /FROM auth_zombie_events/);
  assert.equal(queryCalls[0].params[0], '30');
});

test('getZombieAuthSnapshot — defaults windowMinutes to 60, clamps absurd values', async () => {
  resetQueryCalls();
  setQueryImpl(async () => ({ rows: [{}], rowCount: 1 }));

  await getZombieAuthSnapshot();
  assert.equal(queryCalls[0].params[0], '60');

  resetQueryCalls();
  await getZombieAuthSnapshot({ windowMinutes: -100 });
  assert.equal(queryCalls[0].params[0], '1', 'negative clamps to 1');

  resetQueryCalls();
  await getZombieAuthSnapshot({ windowMinutes: 999999 });
  assert.equal(queryCalls[0].params[0], '10080', 'huge clamps to 7d');

  resetQueryCalls();
  await getZombieAuthSnapshot({ windowMinutes: NaN });
  assert.equal(queryCalls[0].params[0], '60', 'NaN falls back to 60');
});

test('getZombieAuthSnapshot — returns zero-shaped object when DB returns no rows', async () => {
  resetQueryCalls();
  setQueryImpl(async () => ({ rows: [], rowCount: 0 }));

  const result = await getZombieAuthSnapshot();
  assert.equal(result.totalEvents, 0);
  assert.equal(result.uniqueUsers, 0);
  assert.equal(result.uniqueIps, 0);
  assert.equal(result.firstSeen, null);
  assert.equal(result.lastSeen, null);
});
