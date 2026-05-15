/**
 * Unit tests for config/database.js — the singleton pg.Pool wrapper used
 * by every route handler. Prior coverage was 60.66% line / 25% function.
 *
 * Untested paths before this:
 *  - 'connect' event handler (just logs — defensive but no assertion)
 *  - 'error' event handler (calls process.exit(-1) — risky path on
 *    idle-client connection loss, deserves a test pin)
 *  - production-mode skip of the debug query log
 *  - the entire getClient() body (transaction helper with 5s checkout
 *    timeout + release-monkey-patch)
 *
 * Strategy: substitute the cached `pg` module with a FakePool that
 * exposes `.on(event, cb)` so we can synthesize 'connect' / 'error'
 * events, and a `.connect()` that hands out a synthetic client whose
 * release/query we can introspect. Same substitution pattern as
 * test/middleware/auth.test.js and test/lib/observability/rapidapi-metrics-writer.test.js.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');

// ─── Fake pg module ───────────────────────────────────────────────────────

const PG_PATH = require.resolve('pg');

const events = { connect: [], error: [] };
let lastPoolOpts = null;
let queryImpl = async () => ({ rows: [], rowCount: 0 });
let clientFactory = null;

class FakePool {
  constructor(opts) {
    lastPoolOpts = opts;
  }
  on(name, cb) {
    if (events[name]) events[name].push(cb);
  }
  async query(text, params) {
    return queryImpl(text, params);
  }
  async connect() {
    if (clientFactory) return clientFactory();
    return { query: async () => ({ rows: [], rowCount: 0 }), release: () => {} };
  }
}

function emit(name, ...args) {
  for (const cb of events[name] || []) cb(...args);
}

const fakePg = { Pool: FakePool };
const fakePgMod = new Module(PG_PATH);
fakePgMod.filename = PG_PATH;
fakePgMod.loaded = true;
fakePgMod.exports = fakePg;
require.cache[PG_PATH] = fakePgMod;

process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgres://test/test';

// Force a fresh load of the SUT so it picks up our fake pg.
const DB_PATH = require.resolve('../../config/database');
delete require.cache[DB_PATH];
const db = require('../../config/database');

// ─── Console + process.exit harness ───────────────────────────────────────

function captureConsole(fn) {
  const origLog = console.log;
  const origErr = console.error;
  const logs = [];
  const errs = [];
  console.log = (...args) => { logs.push(args); };
  console.error = (...args) => { errs.push(args); };
  return Promise.resolve(fn(logs, errs)).finally(() => {
    console.log = origLog;
    console.error = origErr;
  });
}

function captureProcessExit(fn) {
  const orig = process.exit;
  const calls = [];
  // Override but DO NOT actually exit — would kill the test runner.
  process.exit = (code) => { calls.push(code); };
  return Promise.resolve(fn(calls)).finally(() => {
    process.exit = orig;
  });
}

// ─── Pool construction ────────────────────────────────────────────────────

test('Pool: constructed with DATABASE_URL + size/timeout knobs', () => {
  assert.ok(lastPoolOpts, 'Pool was constructed at module load');
  assert.equal(lastPoolOpts.connectionString, process.env.DATABASE_URL);
  assert.equal(lastPoolOpts.max, 20);
  assert.equal(lastPoolOpts.idleTimeoutMillis, 30000);
  assert.equal(lastPoolOpts.connectionTimeoutMillis, 2000);
});

test('Pool: ssl disabled outside production (default test env)', () => {
  // NODE_ENV is unset/test → ssl should be false per the source.
  assert.equal(lastPoolOpts.ssl, false);
});

test("module exports {pool, query, getClient}", () => {
  assert.equal(typeof db.query, 'function');
  assert.equal(typeof db.getClient, 'function');
  assert.ok(db.pool);
});

// ─── 'connect' event handler ──────────────────────────────────────────────

test("'connect' event logs [Database] Connected to PostgreSQL", async () => {
  await captureConsole(async (logs) => {
    emit('connect');
    const joined = logs.map((l) => l.join(' ')).join('\n');
    assert.match(joined, /\[Database\] Connected to PostgreSQL/);
  });
});

// ─── 'error' event handler ────────────────────────────────────────────────

test("'error' event calls process.exit(-1) and logs the error", async () => {
  await captureProcessExit(async (exits) => {
    await captureConsole(async (_, errs) => {
      emit('error', new Error('idle client conn lost'));
      const joined = errs.map((e) => e.map(String).join(' ')).join('\n');
      assert.match(joined, /\[Database\] Unexpected error on idle client/);
    });
    assert.deepEqual(exits, [-1], 'process.exit(-1) fired exactly once');
  });
});

// ─── query() ──────────────────────────────────────────────────────────────

test('query: returns the pool.query result', async () => {
  queryImpl = async () => ({ rows: [{ x: 1 }], rowCount: 1 });
  const r = await db.query('SELECT 1', []);
  assert.equal(r.rowCount, 1);
  assert.deepEqual(r.rows, [{ x: 1 }]);
});

test('query: logs duration in non-production, NOT in production', async () => {
  queryImpl = async () => ({ rows: [], rowCount: 0 });
  // dev path → expect at least one log line containing "Query executed"
  process.env.NODE_ENV = 'development';
  await captureConsole(async (logs) => {
    await db.query('SELECT 1', []);
    const joined = logs.map((l) => l.map(String).join(' ')).join('\n');
    assert.match(joined, /\[Database\] Query executed/);
  });
  // prod path → must NOT log
  process.env.NODE_ENV = 'production';
  await captureConsole(async (logs) => {
    await db.query('SELECT 1', []);
    const joined = logs.map((l) => l.map(String).join(' ')).join('\n');
    assert.doesNotMatch(joined, /\[Database\] Query executed/);
  });
  delete process.env.NODE_ENV;
});

test('query: re-throws DB errors after logging them', async () => {
  queryImpl = async () => { throw new Error('boom'); };
  await captureConsole(async (_, errs) => {
    await assert.rejects(() => db.query('SELECT crash', []), /boom/);
    const joined = errs.map((e) => e.map(String).join(' ')).join('\n');
    assert.match(joined, /\[Database\] Query error/);
  });
  // Restore for subsequent tests.
  queryImpl = async () => ({ rows: [], rowCount: 0 });
});

// ─── getClient() ──────────────────────────────────────────────────────────

test('getClient: returns the connected client', async () => {
  const fakeClient = {
    query: async (t) => ({ rows: [{ t }], rowCount: 1 }),
    release: () => {},
  };
  clientFactory = () => fakeClient;
  const c = await db.getClient();
  assert.equal(typeof c.query, 'function');
  assert.equal(typeof c.release, 'function');
  c.release();  // clear the real 5s checkout-timeout so it doesn't fire after the run
});

test('getClient: wraps release() to clear the checkout-timeout warning', async () => {
  let releasedOriginal = false;
  const fakeClient = {
    originalQuery: null,
    query: async () => ({ rows: [], rowCount: 0 }),
    release: () => { releasedOriginal = true; },
  };
  clientFactory = () => fakeClient;
  const c = await db.getClient();
  c.release();
  assert.equal(releasedOriginal, true, 'patched release() forwarded to the original');
});

test('getClient: 5-second checkout warning fires if client never released', async () => {
  const fakeClient = {
    query: async () => ({ rows: [], rowCount: 0 }),
    release: () => {},
  };
  clientFactory = () => fakeClient;

  // Patch setTimeout/clearTimeout so we can fast-forward.
  const origSetTimeout = global.setTimeout;
  const origClearTimeout = global.clearTimeout;
  let scheduled = null;
  global.setTimeout = (cb, ms) => {
    scheduled = { cb, ms };
    return 'fake-handle';
  };
  global.clearTimeout = () => {};

  try {
    await captureConsole(async (_, errs) => {
      const c = await db.getClient();
      assert.ok(scheduled, 'setTimeout was scheduled');
      assert.equal(scheduled.ms, 5000, 'timeout window is 5s');
      // Fire the timeout manually to exercise the warning path.
      scheduled.cb();
      const joined = errs.map((e) => e.map(String).join(' ')).join('\n');
      assert.match(joined, /checked out for more than 5 seconds/);
      // Clean up: release the client.
      c.release();
    });
  } finally {
    global.setTimeout = origSetTimeout;
    global.clearTimeout = origClearTimeout;
  }
});
