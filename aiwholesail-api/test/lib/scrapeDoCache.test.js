/**
 * Unit tests for the scrape.do response cache wrapper.
 *
 * Pure helpers (canonicalArgs, cacheKey) are tested directly. The
 * stateful surface (withCache + get/set) is tested with an injected
 * stub DB whose `query` function we control, so no Postgres needed.
 *
 *   $ npm test    (from aiwholesail-api/)
 *   $ node --test test/lib/scrapeDoCache.test.js
 */

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  withCache,
  get,
  set,
  deleteExpired,
  canonicalArgs,
  cacheKey,
} = require('../../lib/scrapers/scrapeDoCache');

// ---- shared stub-DB helper ----------------------------------------------
//
// Each stubDb instance records every query call (sql + params) on
// `db.calls` so tests can assert on read/write traffic, and accepts a
// `handler(sql, params)` to script per-test return values / errors.

function stubDb(handler) {
  const calls = [];
  return {
    calls,
    query: async (sql, params) => {
      calls.push({ sql, params });
      if (typeof handler === 'function') {
        return handler(sql, params);
      }
      return { rows: [], rowCount: 0 };
    },
  };
}

// Wait one microtask tick so fire-and-forget writes get a chance to land.
function flushMicrotasks() {
  return new Promise((r) => setImmediate(r));
}

// Silence intentional console.warn from cache fallthrough paths.
function muteWarnings(fn) {
  return async (...args) => {
    const orig = console.warn;
    console.warn = () => {};
    try { return await fn(...args); } finally { console.warn = orig; }
  };
}

// ---- canonicalArgs + cacheKey ------------------------------------------

test('canonicalArgs', async (t) => {
  await t.test('sorts object keys', () => {
    assert.deepEqual(canonicalArgs({ b: 1, a: 2 }), { a: 2, b: 1 });
    assert.deepEqual(Object.keys(canonicalArgs({ z: 1, a: 1, m: 1 })), ['a', 'm', 'z']);
  });

  await t.test('lowercases + trims string values', () => {
    assert.deepEqual(canonicalArgs({ city: '  AUSTIN  ' }), { city: 'austin' });
  });

  await t.test('preserves numbers / booleans / null', () => {
    assert.deepEqual(
      canonicalArgs({ n: 42, b: true, x: null }),
      { b: true, n: 42, x: null }
    );
  });

  await t.test('recurses into nested objects + arrays', () => {
    const out = canonicalArgs({
      filters: { Beds: 3, City: 'Austin' },
      types: ['Single Family', 'Multi'],
    });
    // Keys are sorted but NOT lowercased; only string *values* are lowercased.
    assert.deepEqual(out, {
      filters: { Beds: 3, City: 'austin' },
      types: ['single family', 'multi'],
    });
    assert.deepEqual(Object.keys(out.filters), ['Beds', 'City']);
  });
});

test('cacheKey', async (t) => {
  await t.test('produces a 64-char hex digest', () => {
    const k = cacheKey('zillow:propertyDetails', { zpid: 12345 });
    assert.equal(k.length, 64);
    assert.match(k, /^[0-9a-f]{64}$/);
  });

  await t.test('is stable across arg-order: {a:1,b:2} === {b:2,a:1}', () => {
    const k1 = cacheKey('zillow:search', { a: 1, b: 2 });
    const k2 = cacheKey('zillow:search', { b: 2, a: 1 });
    assert.equal(k1, k2);
  });

  await t.test('is case-insensitive on string values', () => {
    const k1 = cacheKey('tps:byaddress', { address: 'austin' });
    const k2 = cacheKey('tps:byaddress', { address: 'AUSTIN' });
    assert.equal(k1, k2);
  });

  await t.test('differs when scope differs', () => {
    const k1 = cacheKey('zillow:propertyDetails', { zpid: 1 });
    const k2 = cacheKey('zillow:search', { zpid: 1 });
    assert.notEqual(k1, k2);
  });

  await t.test('differs when args differ', () => {
    const k1 = cacheKey('zillow:propertyDetails', { zpid: 1 });
    const k2 = cacheKey('zillow:propertyDetails', { zpid: 2 });
    assert.notEqual(k1, k2);
  });
});

// ---- withCache: happy paths --------------------------------------------

test('withCache — happy hit: fn never called, body returned', async () => {
  const cachedBody = { price: 425000, beds: 3 };
  const db = stubDb((sql) => {
    if (/^\s*SELECT/i.test(sql)) {
      return { rows: [{ body: cachedBody, expires_at: new Date(Date.now() + 60_000) }], rowCount: 1 };
    }
    return { rows: [], rowCount: 1 };  // UPDATE hit_count
  });
  let fnCalls = 0;
  const cached = withCache({
    scope: 'zillow:propertyDetails',
    ttlSec: 3600,
    fn: async () => { fnCalls++; return { price: 999999 }; },
    db,
  });

  const out = await cached({ zpid: 12345 });
  assert.deepEqual(out, cachedBody);
  assert.equal(fnCalls, 0, 'wrapped fn should not run on cache hit');
  // First call is the SELECT.
  assert.match(db.calls[0].sql, /SELECT/);
});

test('withCache — miss: fn called, body inserted, body returned', async () => {
  const freshBody = { price: 425000, beds: 3 };
  const db = stubDb((sql) => {
    if (/^\s*SELECT/i.test(sql)) return { rows: [], rowCount: 0 };
    return { rows: [], rowCount: 1 };
  });
  let fnCalls = 0;
  const cached = withCache({
    scope: 'zillow:propertyDetails',
    ttlSec: 3600,
    fn: async (args) => { fnCalls++; return { ...freshBody, zpid: args.zpid }; },
    db,
  });

  const out = await cached({ zpid: 999 });
  assert.deepEqual(out, { ...freshBody, zpid: 999 });
  assert.equal(fnCalls, 1);

  // Cache write fires fire-and-forget; give it a tick to land.
  await flushMicrotasks();
  const inserts = db.calls.filter((c) => /INSERT INTO scrape_response_cache/i.test(c.sql));
  assert.equal(inserts.length, 1, 'should have queued one INSERT on miss');
});

test('withCache — expired row treated as miss', async () => {
  // get() filters by `expires_at > NOW()`, so an expired row simply
  // doesn't come back from the SELECT. The stub mirrors that: returns
  // empty rows whenever asked, fn must run, INSERT must fire.
  const db = stubDb((sql) => {
    if (/^\s*SELECT/i.test(sql)) return { rows: [], rowCount: 0 };
    return { rows: [], rowCount: 1 };
  });
  let fnCalls = 0;
  const cached = withCache({
    scope: 'zillow:propertyDetails',
    ttlSec: 60,
    fn: async () => { fnCalls++; return { fresh: true }; },
    db,
  });

  const out = await cached({ zpid: 1 });
  assert.deepEqual(out, { fresh: true });
  assert.equal(fnCalls, 1);
  await flushMicrotasks();
  assert.equal(
    db.calls.filter((c) => /INSERT INTO scrape_response_cache/i.test(c.sql)).length,
    1
  );
});

// ---- withCache: DB-error resilience ------------------------------------

test('withCache — DB error on read: fn called (fallthrough), no throw', muteWarnings(async () => {
  const db = stubDb((sql) => {
    if (/^\s*SELECT/i.test(sql)) throw new Error('connection refused');
    return { rows: [], rowCount: 1 };
  });
  let fnCalls = 0;
  const cached = withCache({
    scope: 'zillow:propertyDetails',
    ttlSec: 60,
    fn: async () => { fnCalls++; return { live: true }; },
    db,
  });

  const out = await cached({ zpid: 1 });
  assert.deepEqual(out, { live: true });
  assert.equal(fnCalls, 1, 'must fall through to live fn when cache read fails');
}));

test("withCache — DB error on write: fn's result still returned, no throw", muteWarnings(async () => {
  const db = stubDb((sql) => {
    if (/^\s*SELECT/i.test(sql)) return { rows: [], rowCount: 0 };
    throw new Error('disk full');
  });
  const cached = withCache({
    scope: 'zillow:propertyDetails',
    ttlSec: 60,
    fn: async () => ({ live: true, zpid: 7 }),
    db,
  });

  // Must not throw even though the background INSERT fails.
  const out = await cached({ zpid: 7 });
  assert.deepEqual(out, { live: true, zpid: 7 });
  await flushMicrotasks();   // let the background set() reject
}));

// ---- key derivation invariants come back end-to-end --------------------

test('withCache — canonical key is stable across arg order', async () => {
  // Same args in different key order should hit the same cache row.
  // Verify by pre-seeding one body for the canonical key derived from
  // {a:1, b:2} and confirming a call with {b:2, a:1} reads it without
  // invoking fn.
  const cachedBody = { hello: 'world' };
  const expectedKey = cacheKey('zillow:search', { a: 1, b: 2 });

  const db = stubDb((sql, params) => {
    if (/^\s*SELECT/i.test(sql)) {
      if (params[0] === expectedKey) {
        return { rows: [{ body: cachedBody, expires_at: new Date(Date.now() + 60_000) }], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    }
    return { rows: [], rowCount: 1 };
  });

  let fnCalls = 0;
  const cached = withCache({
    scope: 'zillow:search',
    ttlSec: 60,
    fn: async () => { fnCalls++; return { fresh: true }; },
    db,
  });

  // Call with reversed key order — must hit the same row.
  const out = await cached({ b: 2, a: 1 });
  assert.deepEqual(out, cachedBody);
  assert.equal(fnCalls, 0, 'arg order must not break cache lookup');
});

test('withCache — case-insensitive string keys hit the same row', async () => {
  const cachedBody = { owner: 'doe' };
  const expectedKey = cacheKey('tps:byaddress', { address: 'austin' });

  const db = stubDb((sql, params) => {
    if (/^\s*SELECT/i.test(sql)) {
      if (params[0] === expectedKey) {
        return { rows: [{ body: cachedBody, expires_at: new Date(Date.now() + 60_000) }], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    }
    return { rows: [], rowCount: 1 };
  });

  let fnCalls = 0;
  const cached = withCache({
    scope: 'tps:byaddress',
    ttlSec: 60,
    fn: async () => { fnCalls++; return { fresh: true }; },
    db,
  });

  // Uppercase variant must hit the same row as the lowercase canonical.
  const out = await cached({ address: 'AUSTIN' });
  assert.deepEqual(out, cachedBody);
  assert.equal(fnCalls, 0);
});

// ---- low-level get/set/deleteExpired primitives ------------------------

test('get — returns null on miss, body on hit, swallows read error',
  muteWarnings(async () => {
    // Hit
    const dbHit = stubDb(() => ({ rows: [{ body: { a: 1 }, expires_at: new Date(Date.now() + 60_000) }], rowCount: 1 }));
    assert.deepEqual(await get('zillow:propertyDetails', 'key1', dbHit), { a: 1 });

    // Miss
    const dbMiss = stubDb(() => ({ rows: [], rowCount: 0 }));
    assert.equal(await get('zillow:propertyDetails', 'key2', dbMiss), null);

    // Error: must return null (not throw)
    const dbErr = stubDb(() => { throw new Error('db down'); });
    assert.equal(await get('zillow:propertyDetails', 'key3', dbErr), null);
  })
);

test('set — issues an upsert, swallows DB error', muteWarnings(async () => {
  const okDb = stubDb(() => ({ rows: [], rowCount: 1 }));
  await set('zillow:propertyDetails', 'k', { x: 1 }, 60, okDb);
  assert.equal(okDb.calls.length, 1);
  assert.match(okDb.calls[0].sql, /INSERT INTO scrape_response_cache/i);
  assert.match(okDb.calls[0].sql, /ON CONFLICT \(cache_key\) DO UPDATE/i);

  // Error path must not throw.
  const errDb = stubDb(() => { throw new Error('connection lost'); });
  await assert.doesNotReject(() => set('zillow:propertyDetails', 'k', { x: 1 }, 60, errDb));
}));

test('deleteExpired — returns rowCount from the DELETE', async () => {
  const db = stubDb(() => ({ rows: [], rowCount: 42 }));
  const removed = await deleteExpired(db);
  assert.equal(removed, 42);
  assert.match(db.calls[0].sql, /DELETE FROM scrape_response_cache WHERE expires_at <= NOW\(\)/i);
});
