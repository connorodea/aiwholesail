/**
 * scrape.do response cache — generic wrapper for paid-per-request scrapers.
 *
 * The aiwholesail-api is moving off RapidAPI's `zillow-working-api` to a
 * self-hosted scrape.do scraper. scrape.do is billed per request — at
 * 10K+ daily lookups, a response cache can roughly halve the spend.
 *
 * This module is intentionally provider-agnostic. It wraps ANY async fn
 * of shape `(args) => data` whose `args` are JSON-stringifiable and whose
 * result is JSON-stringifiable. Today's first user is the scrape.do based
 * Zillow scraper; tomorrow's could be TruePeopleSearch, ATTOM, or any
 * other paid upstream.
 *
 * Backed by the `scrape_response_cache` table (migration 018).
 *
 * Key design choices:
 *  - The cache is a cost optimization, NEVER a hard dependency. Any DB
 *    error in get/set is logged and swallowed — the wrapped fn always
 *    runs as the source of truth when the cache is unavailable.
 *  - Cache key: sha256(scope + ':' + canonical-json(sorted, lowercased args))
 *    so case-insensitive lookups (e.g. address: 'AUSTIN' vs 'austin') hit
 *    the same row, and arg-order doesn't fragment the cache.
 *  - On hit we bump hit_count + last_hit_at via a fire-and-forget UPDATE
 *    so the cached body is returned without waiting on the metric write.
 *  - On miss we upsert with ON CONFLICT DO UPDATE so concurrent misses
 *    don't collide on the primary key.
 *
 * Public surface:
 *   - withCache({ scope, ttlSec, fn, keyFn? }) → wrapped async fn
 *   - get(scope, key)               → cached body or null
 *   - set(scope, key, body, ttlSec) → upsert one row
 *   - deleteExpired()               → cron-callable; returns rows removed
 *   - canonicalArgs(args)           → exported for testing / debugging
 *   - cacheKey(scope, args)         → exported for testing / debugging
 *
 * Dependency injection: every public fn accepts an optional `db` arg with
 * the shape `{ query: (sql, params) => Promise<{rows, rowCount}> }`. When
 * omitted it falls back to `config/database`. This lets the test suite
 * stub the DB without touching Postgres.
 */

const crypto = require('crypto');

// Lazy-load the real DB so tests can import this module without
// require('pg') resolving / connecting on import.
let _defaultDb = null;
function defaultDb() {
  if (_defaultDb) return _defaultDb;
  // eslint-disable-next-line global-require
  _defaultDb = require('../../config/database');
  return _defaultDb;
}

/**
 * Recursively canonicalize a JSON-stringifiable value:
 *   - Object keys sorted ascending.
 *   - String values lowercased + trimmed (so case-insensitive lookups
 *     hit the same cache row).
 *   - Arrays preserved in order (order is often meaningful).
 *   - Numbers, booleans, null preserved as-is.
 *
 * Returns a new value (does not mutate the input).
 */
function canonicalArgs(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string') return value.trim().toLowerCase();
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (Array.isArray(value)) return value.map(canonicalArgs);
  if (typeof value === 'object') {
    const out = {};
    for (const k of Object.keys(value).sort()) {
      out[k] = canonicalArgs(value[k]);
    }
    return out;
  }
  // Fallback: stringify whatever it is.
  return String(value);
}

/**
 * Build a stable sha256 cache key from a scope namespace + args object.
 * Same args in any order, any string casing, produce the same hex digest.
 */
function cacheKey(scope, args) {
  const canon = canonicalArgs(args);
  const payload = `${scope}:${JSON.stringify(canon)}`;
  return crypto.createHash('sha256').update(payload).digest('hex');
}

/**
 * Look up a single cache row by (scope, key). Returns the JSONB body if
 * found AND not expired, else null. Swallows DB errors (returns null +
 * console.warn) — the cache is best-effort.
 *
 * Side effect on hit: fires (does NOT await) an UPDATE bumping hit_count
 * and last_hit_at. The returned body is not blocked on that write.
 */
async function get(scope, key, db = null) {
  const conn = db || defaultDb();
  try {
    const result = await conn.query(
      `SELECT body, expires_at
         FROM scrape_response_cache
        WHERE cache_key = $1
          AND expires_at > NOW()
        LIMIT 1`,
      [key]
    );
    if (!result.rows || result.rows.length === 0) return null;
    // Fire-and-forget hit-count bump. We intentionally don't await; a
    // metric write should never delay returning the cached body.
    Promise.resolve(
      conn.query(
        `UPDATE scrape_response_cache
            SET hit_count = hit_count + 1,
                last_hit_at = NOW()
          WHERE cache_key = $1`,
        [key]
      )
    ).catch((err) => {
      console.warn('[scrapeDoCache] hit-count update failed:', err.message);
    });
    return result.rows[0].body;
  } catch (err) {
    console.warn(
      `[scrapeDoCache] get(${scope}) read failed; falling through:`,
      err.message
    );
    return null;
  }
}

/**
 * Upsert one row. ON CONFLICT DO UPDATE so concurrent misses for the
 * same key don't collide on the primary key. Swallows DB errors.
 */
async function set(scope, key, body, ttlSec, db = null) {
  const conn = db || defaultDb();
  try {
    await conn.query(
      `INSERT INTO scrape_response_cache
            (cache_key, scope, body, expires_at, hit_count, created_at)
       VALUES ($1, $2, $3::jsonb, NOW() + ($4 || ' seconds')::interval, 0, NOW())
       ON CONFLICT (cache_key) DO UPDATE
         SET body = EXCLUDED.body,
             scope = EXCLUDED.scope,
             expires_at = EXCLUDED.expires_at`,
      [key, scope, JSON.stringify(body), String(ttlSec)]
    );
  } catch (err) {
    console.warn(
      `[scrapeDoCache] set(${scope}) write failed; ignoring:`,
      err.message
    );
  }
}

/**
 * Delete all rows whose expires_at is in the past. Returns the number
 * of rows removed. Intended for a cron sweep (see
 * scripts/sweep-scrape-cache.js). Re-throws on DB error so the cron
 * exits non-zero and gets alerted.
 */
async function deleteExpired(db = null) {
  const conn = db || defaultDb();
  const result = await conn.query(
    `DELETE FROM scrape_response_cache WHERE expires_at <= NOW()`
  );
  return result.rowCount || 0;
}

/**
 * Wrap an async fn with the cache. The returned fn has the same
 * signature as `fn` — `(args) => Promise<data>`.
 *
 *   scope:   short namespace string ('zillow:propertyDetails')
 *   ttlSec:  TTL in seconds. Use shorter for search-style fns,
 *            longer for property-detail style fns.
 *   fn:      async (args) => data. Args must be JSON-stringifiable.
 *   keyFn:   optional (args) => stable string key. Default: canonical
 *            sha256 of the args. Pass keyFn when args contain
 *            non-JSON-stringifiable junk that needs reducing first.
 *   db:      optional DB module override (for tests).
 */
function withCache({ scope, ttlSec, fn, keyFn, db } = {}) {
  if (!scope || typeof scope !== 'string') {
    throw new Error('withCache: scope is required (string)');
  }
  if (!Number.isFinite(ttlSec) || ttlSec <= 0) {
    throw new Error('withCache: ttlSec must be a positive number');
  }
  if (typeof fn !== 'function') {
    throw new Error('withCache: fn must be a function');
  }

  return async function cached(args) {
    const key = typeof keyFn === 'function'
      ? keyFn(args)
      : cacheKey(scope, args);

    // 1) Try the cache. On any read failure, fall through to the live fn.
    const hit = await get(scope, key, db);
    if (hit !== null && hit !== undefined) return hit;

    // 2) Cache miss (or read error) → call the wrapped fn.
    const fresh = await fn(args);

    // 3) Write the result. Fire-and-forget so the caller doesn't wait
    //    on the cache write. set() already swallows DB errors.
    Promise.resolve(set(scope, key, fresh, ttlSec, db)).catch((err) => {
      console.warn(`[scrapeDoCache] background set(${scope}) failed:`, err.message);
    });

    return fresh;
  };
}

module.exports = {
  withCache,
  get,
  set,
  deleteExpired,
  // Exported for tests + debugging:
  canonicalArgs,
  cacheKey,
};
