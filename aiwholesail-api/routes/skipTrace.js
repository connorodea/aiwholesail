/**
 * Skip Tracing routes
 *
 * Wraps RapidAPI's skip-tracing-working-api with:
 *   - Auth + tier gating (Pro / Elite only — Trial users are blocked with an
 *     upgrade nudge)
 *   - Per-user monthly quota (Pro = 25, Elite = 200) — counts non-cached
 *     lookups in skip_trace_lookups for the current calendar month
 *   - Short-window dedup (same user + same params within 24h returns the
 *     prior result without hitting upstream)
 *   - Shared peo_id details cache (skip_trace_details, 30-day TTL) — once
 *     anyone resolves a peo_id, all users serve from cache until refresh
 *
 * Upstream endpoints (all GET):
 *   /search/byname            ?name & page
 *   /search/byaddress         ?street & citystatezip & page
 *   /search/bynameaddress     ?name & citystatezip & page
 *   /search/byphone           ?phoneno & page
 *   /search/byemail           ?email & phone
 *   /search/detailsbyID       ?peo_id
 *
 * Local API (mounted at /api/skip-trace):
 *   POST  /search             { searchType, ...params }
 *   GET   /details/:peoId
 *   GET   /history?limit=     — caller's recent lookups
 *   GET   /quota              — { used, limit, tier, resetsAt }
 */

const express = require('express');
const axios = require('axios');
const crypto = require('crypto');
const { body, param, validationResult } = require('express-validator');
const { query } = require('../config/database');
const { authenticate } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');
const { attachSubscription, TIERS } = require('../middleware/subscription');
const { logEvent, EVENTS } = require('../lib/events');
const { callV2Fallback, SUPPORTED_FALLBACKS } = require('../lib/skip-trace-v2');
const tps = require('../lib/scrapers/truePeopleSearch');

// Search-types we have a TPS implementation for. Mirrors SUPPORTED_FALLBACKS
// but stays in this file so the source of truth lives next to the TPS call.
const TPS_SUPPORTED = new Set(['byaddress', 'bynameaddress']);

/**
 * Call TruePeopleSearch via scrape.do. Returns the V1-shaped payload
 * (people: [...]) the rest of the route already expects, or null if TPS
 * couldn't answer (caller falls back to RapidAPI V1).
 */
async function callTpsPrimary(searchType, params) {
  try {
    if (searchType === 'byaddress') {
      const out = await tps.byaddress({
        street: params.street,
        citystatezip: params.citystatezip,
      });
      return out;
    }
    if (searchType === 'bynameaddress') {
      const out = await tps.bynameaddress({
        name: params.name,
        citystatezip: params.citystatezip,
      });
      return out;
    }
    return null;
  } catch (err) {
    console.warn(`[skip-trace] TPS primary failed (${searchType}): ${err.message}`);
    return null;
  }
}

const router = express.Router();

const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY;
const RAPIDAPI_HOST = 'skip-tracing-working-api.p.rapidapi.com';
const RAPIDAPI_BASE = `https://${RAPIDAPI_HOST}`;

// Quota: monthly lookups per tier. Counts NON-cached calls only.
const MONTHLY_QUOTA = {
  [TIERS.ELITE]: 200,
  [TIERS.PRO]: 25,
  [TIERS.TRIAL]: 0,
  [TIERS.NONE]: 0,
};

// Search-type → upstream config
const SEARCH_TYPES = {
  byname: {
    path: '/search/byname',
    required: ['name'],
    optional: ['page'],
  },
  byaddress: {
    path: '/search/byaddress',
    required: ['street', 'citystatezip'],
    optional: ['page'],
  },
  bynameaddress: {
    path: '/search/bynameaddress',
    required: ['name', 'citystatezip'],
    optional: ['page'],
  },
  byphone: {
    path: '/search/byphone',
    required: ['phoneno'],
    optional: ['page'],
  },
  byemail: {
    path: '/search/byemail',
    required: ['email'],
    optional: ['phone'],
  },
};

const DEDUP_WINDOW_HOURS = 24;
const DETAILS_TTL_DAYS = 30;

// ──────────────────────────────────── Helpers ────────────────────────────────────

function normalizeParam(value) {
  return String(value ?? '').trim().toLowerCase();
}

function hashQuery(searchType, params) {
  const canonical = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${normalizeParam(v)}`)
    .join('&');
  return crypto.createHash('sha256').update(`${searchType}|${canonical}`).digest('hex');
}

async function getMonthlyUsage(userId) {
  const r = await query(
    `SELECT COUNT(*)::int AS used
     FROM skip_trace_lookups
     WHERE user_id = $1
       AND served_from_cache = false
       AND created_at >= date_trunc('month', NOW())`,
    [userId]
  );
  return r.rows[0]?.used || 0;
}

function tierLimit(tier) {
  return MONTHLY_QUOTA[tier] ?? 0;
}

function nextMonthIso() {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1)).toISOString();
}

function ensureRapidApiConfigured(res) {
  if (!RAPIDAPI_KEY) {
    res.status(503).json({
      error: 'Skip tracing temporarily unavailable',
      code: 'UPSTREAM_NOT_CONFIGURED',
      message: 'Skip tracing is not configured on this server. Contact support.',
    });
    return false;
  }
  return true;
}

function gateTier(req, res) {
  const tier = req.subscription?.tier;
  if (tier === TIERS.PRO || tier === TIERS.ELITE) return true;

  res.status(403).json({
    error: 'Upgrade required for Skip Tracing',
    code: 'TIER_REQUIRED',
    message:
      'Skip tracing is available on Pro and Elite plans. Upgrade to look up phone numbers, emails, and addresses for property owners.',
    currentTier: tier || TIERS.NONE,
  });
  return false;
}

async function callUpstream(searchPath, params) {
  const response = await axios.get(`${RAPIDAPI_BASE}${searchPath}`, {
    params,
    headers: {
      'x-rapidapi-key': RAPIDAPI_KEY,
      'x-rapidapi-host': RAPIDAPI_HOST,
    },
    timeout: 30000,
    validateStatus: () => true, // we handle status codes ourselves
  });
  return response;
}

function extractPeoIds(payload) {
  if (!payload || typeof payload !== 'object') return [];
  // Upstream surfaces results in slightly different shapes per endpoint.
  // We pull peo_id from the most common locations defensively.
  const candidates = [];
  const visit = (node) => {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) {
      node.forEach(visit);
      return;
    }
    if (node.peo_id && typeof node.peo_id === 'string') {
      candidates.push(node.peo_id);
    }
    Object.values(node).forEach(visit);
  };
  visit(payload);
  // De-dup while preserving order
  return Array.from(new Set(candidates));
}

function countResults(payload) {
  if (!payload || typeof payload !== 'object') return 0;
  if (Array.isArray(payload?.results)) return payload.results.length;
  if (Array.isArray(payload?.data)) return payload.data.length;
  if (Array.isArray(payload?.people)) return payload.people.length;
  return extractPeoIds(payload).length;
}

// ──────────────────────────────────── Routes ────────────────────────────────────

/**
 * POST /api/skip-trace/search
 * { searchType, ...params }
 */
router.post(
  '/search',
  authenticate,
  attachSubscription,
  [
    body('searchType').isIn(Object.keys(SEARCH_TYPES)).withMessage('Invalid searchType'),
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'Validation failed', errors: errors.array() });
    }

    if (!ensureRapidApiConfigured(res)) return;
    if (!gateTier(req, res)) return;

    const { searchType } = req.body;
    const config = SEARCH_TYPES[searchType];

    // Validate required params
    const params = {};
    for (const key of config.required) {
      const v = req.body[key];
      if (v === undefined || v === null || String(v).trim() === '') {
        return res.status(400).json({
          error: 'Validation failed',
          errors: [{ field: key, message: `${key} is required for ${searchType}` }],
        });
      }
      params[key] = String(v).trim();
    }
    for (const key of config.optional) {
      if (req.body[key] !== undefined && req.body[key] !== null && req.body[key] !== '') {
        params[key] = String(req.body[key]).trim();
      }
    }

    const userId = req.user.id;
    const queryHash = hashQuery(searchType, params);

    // ─── Cache: same user, same query, within DEDUP window ───
    const cached = await query(
      `SELECT id, result, peo_ids, result_count, created_at
       FROM skip_trace_lookups
       WHERE user_id = $1
         AND query_hash = $2
         AND result IS NOT NULL
         AND upstream_status = 200
         AND created_at >= NOW() - ($3 || ' hours')::interval
       ORDER BY created_at DESC
       LIMIT 1`,
      [userId, queryHash, DEDUP_WINDOW_HOURS]
    );

    if (cached.rows.length > 0) {
      const c = cached.rows[0];
      // Log a cache-hit row so the user can see it in /history
      await query(
        `INSERT INTO skip_trace_lookups
           (user_id, search_type, query_hash, query_params, result_count, result, peo_ids,
            upstream_status, served_from_cache)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 200, true)`,
        [userId, searchType, queryHash, params, c.result_count, c.result, c.peo_ids]
      );
      return res.json({
        searchType,
        params,
        result: c.result,
        resultCount: c.result_count,
        peoIds: c.peo_ids,
        servedFromCache: true,
      });
    }

    // ─── Quota check ───
    const tier = req.subscription.tier;
    const limit = tierLimit(tier);
    const used = await getMonthlyUsage(userId);
    if (used >= limit) {
      return res.status(429).json({
        error: 'Monthly skip-trace quota reached',
        code: 'QUOTA_EXCEEDED',
        message: `You have used all ${limit} skip-trace lookups for this month. Upgrade to Elite for more, or wait until ${nextMonthIso()}.`,
        tier,
        used,
        limit,
        resetsAt: nextMonthIso(),
      });
    }

    // ─── PRIMARY: TPS via scrape.do (unconditional for supported types) ───
    // Changed 2026-05-13 (PR #321): TPS is now the unconditional primary for
    // searchTypes it supports (byaddress, bynameaddress). RapidAPI V1 + V2
    // become fallbacks. No flag check — skip_trace_tps is deprecated and
    // RapidAPI's skip-tracing-working-api has been failing every call.
    let upstreamStatus = 0;
    let upstreamData = null;
    let upstreamError = null;
    let providerUsed = 'v1';

    if (TPS_SUPPORTED.has(searchType)) {
      const tpsData = await callTpsPrimary(searchType, params);
      if (tpsData && Array.isArray(tpsData.people)) {
        upstreamData = tpsData;
        upstreamStatus = 200;
        providerUsed = 'tps';
      }
    }

    // ─── FALLBACK 1: RapidAPI V1 (skip-tracing-working-api) ───
    // Only fires when TPS didn't answer (handler missing or TPS threw). The
    // legacy RapidAPI primary path is preserved here so non-TPS search-types
    // (byname, byphone, byemail) keep working — they never had a TPS path.
    if (!upstreamData) {
      try {
        const upstream = await callUpstream(config.path, params);
        upstreamStatus = upstream.status;
        if (upstream.status >= 200 && upstream.status < 300) {
          upstreamData = upstream.data;
          // Provider stays 'v1' (default initial value) — TPS didn't answer
          // so the RapidAPI V1 path did.
        } else {
          upstreamError = typeof upstream.data === 'string'
            ? upstream.data.slice(0, 500)
            : JSON.stringify(upstream.data).slice(0, 500);
        }
      } catch (err) {
        upstreamStatus = 0;
        upstreamError = (err.message || 'unknown error').slice(0, 500);
      }
    }

    // ─── FALLBACK 2: RapidAPI V2 (skip-tracing-api) ───
    // Only fires when V1 genuinely failed AND the searchType has a V2
    // equivalent (byaddress / bynameaddress only). Treats:
    //   - HTTP 5xx, timeout, network error  → fallback
    //   - HTTP 200 + empty results          → DO NOT fallback (real "no match")
    // Both providers count against the same RapidAPI account quota; the
    // user's monthly skip_trace_lookups counter increments once regardless
    // of which provider answered.
    const v1Failed =
      !upstreamData &&
      (upstreamStatus === 0 || upstreamStatus >= 500);
    if (v1Failed && SUPPORTED_FALLBACKS.includes(searchType)) {
      console.warn(`[skip-trace] V1 fallback failed (status=${upstreamStatus}), trying V2 fallback for ${searchType}`);
      const v2 = await callV2Fallback({
        searchType,
        params,
        rapidApiKey: RAPIDAPI_KEY,
        timeoutMs: 20000,
      });
      if (v2.ok) {
        upstreamData = v2.data;
        upstreamStatus = 200;
        upstreamError = null;
        providerUsed = 'v2';
        console.log(`[skip-trace] V2 fallback succeeded for ${searchType}`);
      } else {
        console.warn(`[skip-trace] V2 fallback also failed: ${v2.error}`);
      }
    }

    const peoIds = extractPeoIds(upstreamData);
    const resultCount = countResults(upstreamData);

    // Record the lookup (even on failure — useful for debugging + abuse signal)
    await query(
      `INSERT INTO skip_trace_lookups
         (user_id, search_type, query_hash, query_params, result_count, result, peo_ids,
          upstream_status, upstream_error, served_from_cache)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, false)`,
      [userId, searchType, queryHash, params, resultCount, upstreamData, peoIds, upstreamStatus, upstreamError]
    );

    if (!upstreamData) {
      return res.status(502).json({
        error: 'Upstream skip-trace API error',
        code: 'UPSTREAM_ERROR',
        upstreamStatus,
        message: upstreamError || 'Skip tracing provider is temporarily unavailable. Please try again.',
      });
    }

    logEvent(userId, EVENTS.SKIP_TRACE_USED, {
      searchType,
      result_count: resultCount,
      cached: false,
      provider: providerUsed,
    });

    return res.json({
      searchType,
      params,
      result: upstreamData,
      resultCount,
      peoIds,
      servedFromCache: false,
      provider: providerUsed,
    });
  })
);

/**
 * GET /api/skip-trace/details/:peoId
 * Person-level details. Shared cache (peo_id → record).
 */
router.get(
  '/details/:peoId',
  authenticate,
  attachSubscription,
  [param('peoId').isString().isLength({ min: 4, max: 64 }).withMessage('Invalid peoId')],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'Validation failed', errors: errors.array() });
    }

    if (!ensureRapidApiConfigured(res)) return;
    if (!gateTier(req, res)) return;

    const { peoId } = req.params;
    const userId = req.user.id;
    const queryHash = hashQuery('detailsbyID', { peo_id: peoId });

    // Shared cache hit (any user)
    const cached = await query(
      `SELECT data, fetched_at
       FROM skip_trace_details
       WHERE peo_id = $1
         AND fetched_at >= NOW() - ($2 || ' days')::interval
       LIMIT 1`,
      [peoId, DETAILS_TTL_DAYS]
    );

    if (cached.rows.length > 0) {
      // Bump hit count + log per-user cache hit (no quota cost)
      await query(`UPDATE skip_trace_details SET hit_count = hit_count + 1 WHERE peo_id = $1`, [peoId]);
      await query(
        `INSERT INTO skip_trace_lookups
           (user_id, search_type, query_hash, query_params, result_count, result,
            upstream_status, served_from_cache)
         VALUES ($1, 'detailsbyID', $2, $3, 1, $4, 200, true)`,
        [userId, queryHash, { peo_id: peoId }, cached.rows[0].data]
      );
      return res.json({
        peoId,
        details: cached.rows[0].data,
        servedFromCache: true,
        fetchedAt: cached.rows[0].fetched_at,
      });
    }

    // Quota check (details miss = paid call)
    const tier = req.subscription.tier;
    const limit = tierLimit(tier);
    const used = await getMonthlyUsage(userId);
    if (used >= limit) {
      return res.status(429).json({
        error: 'Monthly skip-trace quota reached',
        code: 'QUOTA_EXCEEDED',
        message: `You have used all ${limit} skip-trace lookups for this month.`,
        tier,
        used,
        limit,
        resetsAt: nextMonthIso(),
      });
    }

    // Upstream call. Content-addressed routing: TPS peo_ids contain letters
    // or hyphens (e.g. "P5x9-aB2"), RapidAPI peo_ids are pure digits. So we
    // can decide which backend to use from the id alone — no extra flag check.
    let upstreamStatus = 0;
    let upstreamData = null;
    let upstreamError = null;
    const looksLikeTpsId = /[A-Za-z_-]/.test(peoId);
    try {
      if (looksLikeTpsId) {
        upstreamData = await tps.detailsByPeoId(peoId);
        upstreamStatus = 200;
      } else {
        const upstream = await callUpstream('/search/detailsbyID', { peo_id: peoId });
        upstreamStatus = upstream.status;
        if (upstream.status >= 200 && upstream.status < 300) {
          upstreamData = upstream.data;
        } else {
          upstreamError = typeof upstream.data === 'string'
            ? upstream.data.slice(0, 500)
            : JSON.stringify(upstream.data).slice(0, 500);
        }
      }
    } catch (err) {
      upstreamError = (err.message || 'unknown error').slice(0, 500);
    }

    if (!upstreamData) {
      await query(
        `INSERT INTO skip_trace_lookups
           (user_id, search_type, query_hash, query_params, result_count, upstream_status,
            upstream_error, served_from_cache)
         VALUES ($1, 'detailsbyID', $2, $3, 0, $4, $5, false)`,
        [userId, queryHash, { peo_id: peoId }, upstreamStatus, upstreamError]
      );
      return res.status(502).json({
        error: 'Upstream skip-trace API error',
        code: 'UPSTREAM_ERROR',
        upstreamStatus,
        message: upstreamError || 'Skip tracing provider is temporarily unavailable.',
      });
    }

    // Persist to shared cache + log lookup
    await query(
      `INSERT INTO skip_trace_details (peo_id, data, fetched_at, hit_count)
       VALUES ($1, $2, NOW(), 1)
       ON CONFLICT (peo_id) DO UPDATE SET
         data = EXCLUDED.data,
         fetched_at = NOW(),
         hit_count = skip_trace_details.hit_count + 1`,
      [peoId, upstreamData]
    );
    await query(
      `INSERT INTO skip_trace_lookups
         (user_id, search_type, query_hash, query_params, result_count, result, peo_ids,
          upstream_status, served_from_cache)
       VALUES ($1, 'detailsbyID', $2, $3, 1, $4, $5, 200, false)`,
      [userId, queryHash, { peo_id: peoId }, upstreamData, [peoId]]
    );

    return res.json({
      peoId,
      details: upstreamData,
      servedFromCache: false,
      fetchedAt: new Date().toISOString(),
    });
  })
);

/**
 * GET /api/skip-trace/history?limit=20
 */
router.get(
  '/history',
  authenticate,
  attachSubscription,
  asyncHandler(async (req, res) => {
    const limit = Math.min(parseInt(req.query.limit, 10) || 20, 100);
    const r = await query(
      `SELECT id, search_type, query_params, result_count, peo_ids,
              served_from_cache, upstream_status, created_at
       FROM skip_trace_lookups
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [req.user.id, limit]
    );
    res.json({ history: r.rows });
  })
);

/**
 * GET /api/skip-trace/quota
 * Returns current usage + limit for the calling user.
 */
router.get(
  '/quota',
  authenticate,
  attachSubscription,
  asyncHandler(async (req, res) => {
    const tier = req.subscription?.tier || TIERS.NONE;
    const limit = tierLimit(tier);
    const used = await getMonthlyUsage(req.user.id);
    res.json({
      tier,
      used,
      limit,
      remaining: Math.max(0, limit - used),
      resetsAt: nextMonthIso(),
      gated: tier !== TIERS.PRO && tier !== TIERS.ELITE,
    });
  })
);

module.exports = router;
