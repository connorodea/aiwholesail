/**
 * Bug-reproduction tests for the frontend subscription tier module.
 *
 * Runs with Node's built-in test runner via native TS support:
 *
 *   node --experimental-strip-types --test tests/subscription-tier.test.ts
 *
 * Zero deps. The tests import directly from src/lib/subscription-tier.ts
 * (relative path — no Vite path aliases at this layer so node:test can
 * resolve them without a bundler).
 *
 * Each test names the exact bug it would catch if regressed.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeTier,
  getCachedTier,
  setCachedTier,
  clearCachedTier,
  __testInternals,
  type SubscriptionTier,
} from '../src/lib/subscription-tier.ts';

// ---------------------------------------------------------------------------
// In-memory localStorage stub so the helpers run under plain Node.
// ---------------------------------------------------------------------------
function makeStorage() {
  const store = new Map<string, string>();
  return {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => { store.set(k, v); },
    removeItem: (k: string) => { store.delete(k); },
    _size: () => store.size,
    _peek: () => Object.fromEntries(store),
  };
}

// ---------------------------------------------------------------------------
// Bug #4 — Case-sensitive tier comparison
// ---------------------------------------------------------------------------
test('BUG #4: lowercase "elite" normalizes to canonical "Elite"', () => {
  assert.equal(normalizeTier('elite'), 'Elite');
});

test('BUG #4: uppercase / mixed-case variants all resolve to "Elite"', () => {
  assert.equal(normalizeTier('ELITE'), 'Elite');
  assert.equal(normalizeTier('eLiTe'), 'Elite');
  assert.equal(normalizeTier(' Elite '), 'Elite');
});

test('BUG #4: legacy "Premium" alias resolves to "Elite"', () => {
  assert.equal(normalizeTier('Premium'), 'Elite');
  assert.equal(normalizeTier('premium'), 'Elite');
});

test('normalizeTier: unknown strings return "none"', () => {
  assert.equal(normalizeTier('Free'), 'none');
  assert.equal(normalizeTier('platinum'), 'none');
  assert.equal(normalizeTier(''), 'none');
});

test('normalizeTier: non-string inputs return "none"', () => {
  assert.equal(normalizeTier(null), 'none');
  assert.equal(normalizeTier(undefined), 'none');
  assert.equal(normalizeTier(42), 'none');
  assert.equal(normalizeTier({}), 'none');
});

// ---------------------------------------------------------------------------
// Bug #1 — Cache leakage between users on the same device
// ---------------------------------------------------------------------------
test('BUG #1: cache written by user A is NOT visible to user B', () => {
  const storage = makeStorage();
  setCachedTier('Elite', 'user-A', storage);
  // User B (different id) asking for cache → must miss.
  const tier = getCachedTier('user-B', storage);
  assert.equal(tier, null);
});

test('BUG #1: cache written by signed-in user is NOT visible to signed-out state', () => {
  const storage = makeStorage();
  setCachedTier('Elite', 'user-A', storage);
  // Signed-out → userId is null. Must miss.
  assert.equal(getCachedTier(null, storage), null);
  assert.equal(getCachedTier(undefined, storage), null);
});

test('BUG #1: cache written by signed-out user is NOT visible to a signed-in user', () => {
  const storage = makeStorage();
  // A user that was never authenticated wrote 'none'. A real user signing
  // in afterwards must not inherit that.
  setCachedTier('none', null, storage);
  assert.equal(getCachedTier('user-A', storage), null);
});

test('getCachedTier: same userId hits the cache', () => {
  const storage = makeStorage();
  setCachedTier('Elite', 'user-A', storage);
  assert.equal(getCachedTier('user-A', storage), 'Elite');
});

// ---------------------------------------------------------------------------
// Bug #3 — signOut left cache behind
// ---------------------------------------------------------------------------
test('BUG #3: clearCachedTier removes the entry entirely', () => {
  const storage = makeStorage();
  setCachedTier('Elite', 'user-A', storage);
  assert.equal(storage._size(), 1);
  clearCachedTier(storage);
  assert.equal(storage._size(), 0);
  // And: a fresh getCachedTier (any user) returns null after clear.
  assert.equal(getCachedTier('user-A', storage), null);
  assert.equal(getCachedTier(null, storage), null);
});

// ---------------------------------------------------------------------------
// Cache TTL
// ---------------------------------------------------------------------------
test('getCachedTier: entries older than TTL miss and are evicted', () => {
  const storage = makeStorage();
  // Write a stale entry by hand to bypass setCachedTier's fresh timestamp.
  const stale = {
    tier: 'Elite' as SubscriptionTier,
    userId: 'user-A',
    timestamp: Date.now() - (__testInternals.CACHE_TTL_MS + 1000),
  };
  storage.setItem(__testInternals.CACHE_KEY, JSON.stringify(stale));
  assert.equal(getCachedTier('user-A', storage), null);
  // Stale entry should also have been removed by the read.
  assert.equal(storage._size(), 0);
});

test('getCachedTier: corrupt JSON returns null safely', () => {
  const storage = makeStorage();
  storage.setItem(__testInternals.CACHE_KEY, 'not-json-{');
  assert.equal(getCachedTier('user-A', storage), null);
});

test('getCachedTier: no entry → null (no throw)', () => {
  const storage = makeStorage();
  assert.equal(getCachedTier('user-A', storage), null);
});

// ---------------------------------------------------------------------------
// Defensive: null storage (SSR / private browsing)
// ---------------------------------------------------------------------------
test('helpers gracefully no-op when storage is null', () => {
  // Production calls fall back to localStorage; if it's missing (Node SSR,
  // private mode that throws on access), these must not crash.
  assert.equal(getCachedTier('user-A', null), null);
  assert.doesNotThrow(() => setCachedTier('Elite', 'user-A', null));
  assert.doesNotThrow(() => clearCachedTier(null));
});
