/**
 * scrape_provider_metrics helper.
 *
 * Wraps each outbound call to a Zillow / TPS backend (RapidAPI or self-hosted
 * scrape.do) with timing + outcome recording. The insert is fire-and-forget
 * via setImmediate so a slow / failing DB never adds latency to the user-
 * facing request. Metric loss on a DB blip is acceptable; user-facing
 * latency or 500s from a metric write are NOT.
 *
 * Usage (will be wired in a follow-up PR once #288 / #291 land):
 *
 *   const { recordScrapeCall } = require('../observability/scrapeMetrics');
 *
 *   const data = await recordScrapeCall(
 *     {
 *       provider: 'scrape-do-zillow',  // or 'rapidapi-zillow', 'scrape-do-tps', ...
 *       action: 'propertyDetails',     // short string action label
 *       callKind: 'primary',           // 'primary' | 'fallback'
 *       userId: req.user?.id ?? null,
 *     },
 *     () => actuallyFetchTheThing(zpid),
 *   );
 *
 * Provider vocabulary (do not invent new values without updating this list):
 *   - rapidapi-zillow      legacy zillow-working-api on RapidAPI
 *   - scrape-do-zillow     self-hosted scrape.do Zillow scraper
 *   - rapidapi-tps         legacy TruePeopleSearch on RapidAPI
 *   - scrape-do-tps        self-hosted scrape.do TPS scraper
 *
 * callKind vocabulary:
 *   - primary              the first backend we tried
 *   - fallback             we tried this because primary failed
 *
 * (The 'dogfood-primary' value was retired 2026-05-13 along with the
 * zillow_scrape_do flag — scrape.do is now the unconditional primary so the
 * cohort distinction is no longer meaningful.)
 */

const { query } = require('../../config/database');

// Cap stored error excerpts at the column width. The migration declares
// VARCHAR(200); going over throws a 22001 at insert time. We truncate
// here so the wrapped fn's error message can be arbitrarily long without
// blowing up the metric write.
const ERROR_EXCERPT_MAX_LEN = 200;

/**
 * Extract a short, single-line excerpt from whatever the caller threw.
 * Falls back to String(err) for non-Error throws.
 */
function buildErrorExcerpt(err) {
  if (err === null || err === undefined) return null;
  const raw = (err && typeof err.message === 'string') ? err.message : String(err);
  // Collapse newlines + control chars so the excerpt fits one logical line.
  const oneLine = raw.replace(/[\r\n\t]+/g, ' ').trim();
  if (oneLine.length <= ERROR_EXCERPT_MAX_LEN) return oneLine;
  return oneLine.slice(0, ERROR_EXCERPT_MAX_LEN - 1) + '…';
}

/**
 * Best-effort HTTP-status extraction from common axios / fetch / proxy shapes.
 * Returns null if we can't find one — null is a valid column value.
 */
function extractHttpStatus(errOrResult) {
  if (!errOrResult || typeof errOrResult !== 'object') return null;
  // axios error
  if (errOrResult.response && typeof errOrResult.response.status === 'number') {
    return errOrResult.response.status;
  }
  // direct response-like shape
  if (typeof errOrResult.status === 'number') return errOrResult.status;
  if (typeof errOrResult.statusCode === 'number') return errOrResult.statusCode;
  return null;
}

/**
 * Schedule the insert without blocking the caller. Any failure is swallowed
 * with a console.warn — metric writes MUST NOT propagate errors to the
 * user-facing path.
 */
function scheduleInsert(row) {
  setImmediate(() => {
    query(
      `INSERT INTO scrape_provider_metrics
        (provider, action, call_kind, success, duration_ms, error_excerpt, http_status, user_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        row.provider,
        row.action,
        row.callKind,
        row.success,
        row.durationMs,
        row.errorExcerpt,
        row.httpStatus,
        row.userId,
      ],
    ).catch((err) => {
      // Intentionally only warn — losing a metric row is acceptable.
      console.warn('[scrapeMetrics] insert failed (swallowed):', err && err.message);
    });
  });
}

/**
 * Wrap an async function, time it, record the outcome to
 * `scrape_provider_metrics`. Returns whatever fn returns; rethrows whatever
 * fn throws. The metric insert is fire-and-forget — the caller never waits
 * on it and is never affected by its failure.
 *
 * @param {object} meta
 * @param {string} meta.provider   one of the provider vocabulary values
 * @param {string} meta.action     short action label
 * @param {string} meta.callKind   'primary' | 'fallback'
 * @param {string|null} [meta.userId]  null for anonymous / background jobs
 * @param {Function} fn  async function to execute
 * @returns {Promise<any>}
 */
async function recordScrapeCall(meta, fn) {
  const provider = meta && meta.provider;
  const action = meta && meta.action;
  const callKind = meta && meta.callKind;
  const userId = (meta && meta.userId) || null;

  // Defensive: a missing required field shouldn't crash the user's request,
  // it should just degrade to "no metric". The wrapped fn still runs.
  const metaValid = typeof provider === 'string'
    && typeof action === 'string'
    && typeof callKind === 'string';

  if (!metaValid) {
    console.warn('[scrapeMetrics] recordScrapeCall called with invalid meta — skipping insert', {
      provider, action, callKind,
    });
    return fn();
  }

  const startNs = performance.now();
  let result;
  let success = false;
  let errorExcerpt = null;
  let httpStatus = null;
  let thrown = null;

  try {
    result = await fn();
    success = true;
    httpStatus = extractHttpStatus(result);
    return result;
  } catch (err) {
    thrown = err;
    success = false;
    errorExcerpt = buildErrorExcerpt(err);
    httpStatus = extractHttpStatus(err);
    throw err;
  } finally {
    const endNs = performance.now();
    const rawMs = endNs - startNs;
    // performance.now() returns ms as a float. Round to int for the column.
    // Clamp to >= 0 — should never be negative but be defensive against
    // mocked-clock weirdness in tests.
    const durationMs = Number.isFinite(rawMs) ? Math.max(0, Math.round(rawMs)) : null;

    scheduleInsert({
      provider,
      action,
      callKind,
      success,
      durationMs,
      errorExcerpt,
      httpStatus,
      userId,
    });

    // suppress unused-var lint while keeping `thrown` referenced for clarity
    void thrown;
  }
}

/**
 * Aggregate the last `windowMinutes` of scrape_provider_metrics into a
 * per (provider, action, call_kind) snapshot.
 *
 *   [
 *     {
 *       provider: 'scrape-do-zillow',
 *       action: 'propertyDetails',
 *       callKind: 'primary',
 *       totalCalls: 142,
 *       successRate: 0.965,        // 0..1
 *       p50_ms: 412,
 *       p95_ms: 1840,
 *     },
 *     ...
 *   ]
 *
 * Single query — percentile_cont over duration_ms, filtered to the window.
 * Returns [] when nothing happened in the window (rather than null).
 */
async function getMetricsSnapshot({ windowMinutes = 60 } = {}) {
  // Clamp the window to a sane range. Negative / NaN would produce a
  // confusing empty result; > 7 days would scan too much without an index
  // hint, and admins should use a proper query tool for that.
  const safeMinutes = Math.max(
    1,
    Math.min(
      Number.isFinite(windowMinutes) ? Math.floor(windowMinutes) : 60,
      // 7 days in minutes
      7 * 24 * 60,
    ),
  );

  const sql = `
    SELECT
      provider,
      action,
      call_kind AS "callKind",
      COUNT(*)::int AS "totalCalls",
      (SUM(CASE WHEN success THEN 1 ELSE 0 END)::float / NULLIF(COUNT(*), 0))
        AS "successRate",
      PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY duration_ms)
        FILTER (WHERE duration_ms IS NOT NULL)::int AS "p50_ms",
      PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY duration_ms)
        FILTER (WHERE duration_ms IS NOT NULL)::int AS "p95_ms"
    FROM scrape_provider_metrics
    WHERE created_at >= NOW() - ($1 || ' minutes')::interval
    GROUP BY provider, action, call_kind
    ORDER BY provider, action, call_kind
  `;

  const result = await query(sql, [String(safeMinutes)]);
  return result.rows;
}

module.exports = {
  recordScrapeCall,
  getMetricsSnapshot,
  // exported for tests
  _internal: {
    buildErrorExcerpt,
    extractHttpStatus,
    ERROR_EXCERPT_MAX_LEN,
  },
};
