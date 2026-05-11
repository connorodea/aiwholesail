/**
 * Feature flag resolution.
 *
 * Layered lookup with a 60-second in-memory cache. Resolution order:
 *   1. Per-user row in feature_flag_users → its `enabled` value wins
 *   2. Global row in feature_flag_globals →
 *        - enabled=false: false (master kill switch)
 *        - rollout_pct=100: true
 *        - 0 < rollout_pct < 100: deterministic bucket via hash(user_id || slug)
 *   3. Default: false (unknown slugs always evaluate false)
 *
 * Cache is keyed on the slug — the table state, not per-user — so a toggle
 * propagates within 60s for everyone. Individual user overrides bypass the
 * cache (looked up per-request).
 */

const crypto = require('crypto');
const { query } = require('../config/database');

const CACHE_TTL_MS = 60 * 1000;
const cache = new Map(); // slug → { enabled, rollout_pct, expiresAt }

function bucket(userId, slug) {
  const h = crypto.createHash('sha1').update(`${userId}::${slug}`).digest();
  return h.readUInt16BE(0) % 100;
}

async function getGlobal(slug) {
  const entry = cache.get(slug);
  if (entry && entry.expiresAt > Date.now()) return entry;

  const { rows } = await query(
    'SELECT enabled, rollout_pct FROM feature_flag_globals WHERE slug = $1',
    [slug]
  );
  const row = rows[0] || { enabled: false, rollout_pct: 0 };
  const next = { ...row, expiresAt: Date.now() + CACHE_TTL_MS };
  cache.set(slug, next);
  return next;
}

async function getUserOverride(userId, slug) {
  const { rows } = await query(
    'SELECT enabled FROM feature_flag_users WHERE user_id = $1 AND slug = $2',
    [userId, slug]
  );
  return rows[0]?.enabled;
}

/** Resolve a single flag for a user. Returns boolean. */
async function isEnabled(userId, slug) {
  if (userId) {
    const override = await getUserOverride(userId, slug);
    if (override !== undefined) return Boolean(override);
  }
  const g = await getGlobal(slug);
  if (!g.enabled) return false;
  if (g.rollout_pct >= 100) return true;
  if (g.rollout_pct <= 0) return false;
  if (!userId) return false;
  return bucket(userId, slug) < g.rollout_pct;
}

/** Resolve all flags for a user. Returns { [slug]: boolean }. */
async function getAllForUser(userId) {
  // Pull all known slugs from both tables — globals + any per-user overrides
  // for slugs that don't have a global yet (rare but possible).
  const { rows } = await query(
    `SELECT DISTINCT slug FROM feature_flag_globals
     UNION
     SELECT DISTINCT slug FROM feature_flag_users WHERE user_id = $1`,
    [userId]
  );
  const out = {};
  for (const { slug } of rows) {
    // eslint-disable-next-line no-await-in-loop
    out[slug] = await isEnabled(userId, slug);
  }
  return out;
}

/**
 * Express middleware. Use on routes that should 404 unless the user has
 * the named flag enabled.
 */
function requireFlag(slug) {
  return async (req, res, next) => {
    try {
      const enabled = await isEnabled(req.user?.id, slug);
      if (!enabled) return res.status(404).json({ error: 'Not found' });
      return next();
    } catch (err) {
      console.error(`[featureFlags] requireFlag(${slug}) failed:`, err.message);
      return res.status(500).json({ error: 'Feature flag check failed' });
    }
  };
}

/** Clear the global cache. For tests and post-write invalidation. */
function clearCache() {
  cache.clear();
}

module.exports = { isEnabled, getAllForUser, requireFlag, clearCache };
