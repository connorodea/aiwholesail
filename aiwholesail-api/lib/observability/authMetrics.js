/**
 * auth_zombie_events helper.
 *
 * Records the API-level zombie-session pattern: a request arrives with a
 * Bearer JWT that VERIFIES correctly, but the `userId` claim doesn't
 * resolve to any row in `users`. This is the server-side complement to
 * the cpodea5 frontend incident (2026-05-14, PR #375/#376) and SLO_SPEC
 * alert C3 — auth-401 storm.
 *
 * Mirrors lib/observability/scrapeMetrics.js's fire-and-forget pattern:
 * the insert is scheduled via setImmediate so a slow / failing DB never
 * adds latency to the 401 response. Metric loss on a DB blip is
 * acceptable; user-facing latency or 500s from a metric write are NOT.
 *
 * Usage (called from middleware/auth.js after the users lookup returns
 * zero rows, immediately BEFORE the 401 res.json):
 *
 *   const { recordZombieAuthEvent } = require('../lib/observability/authMetrics');
 *
 *   if (result.rows.length === 0) {
 *     recordZombieAuthEvent({
 *       jwtUserId: decoded.userId,
 *       clientIp:  req.ip,
 *       userAgent: req.get('user-agent'),
 *       requestPath: req.originalUrl || req.path,
 *     });
 *     return res.status(401).json({ error: 'User not found', ... });
 *   }
 *
 * Privacy: we DO NOT take, log, or store the JWT itself or any other
 * claims. Only the `userId` claim that failed to resolve, plus request
 * shape that's already in the access log.
 */

const { query } = require('../../config/database');

// Cap stored UA strings. user_agent is TEXT (no hard column limit) but a
// pathological UA can be many KB — truncate for index and storage sanity.
const USER_AGENT_MAX_LEN = 500;
// Cap path. Long URLs with embedded query strings can also be enormous.
const REQUEST_PATH_MAX_LEN = 500;
// Cap the userId-claim string. Defensive — a normal UUID is 36 chars but
// a malformed token could carry anything.
const JWT_USER_ID_MAX_LEN = 200;

function clamp(value, maxLen) {
  if (value === null || value === undefined) return null;
  const str = String(value);
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen - 1) + '…';
}

/**
 * Best-effort IP normalization. Returns null if the input doesn't look
 * like something Postgres INET can accept — null is a valid column value
 * and is far better than a failed insert that drops the whole metric.
 *
 * Handles common Express shapes:
 *   - "1.2.3.4"
 *   - "::ffff:1.2.3.4"  (IPv4-mapped IPv6 from a v6 socket)
 *   - "1.2.3.4, 5.6.7.8" (comma-separated XFF — take the first)
 */
function normalizeIp(ip) {
  if (ip === null || ip === undefined) return null;
  let str = String(ip).trim();
  if (str === '') return null;
  // X-Forwarded-For style "client, proxy1, proxy2" — first entry is the client
  if (str.includes(',')) {
    str = str.split(',')[0].trim();
  }
  // Strip IPv4-mapped IPv6 prefix so we store the v4 form
  if (str.startsWith('::ffff:')) {
    str = str.slice('::ffff:'.length);
  }
  return str;
}

/**
 * Schedule the insert without blocking the caller. Any failure is
 * swallowed with a console.warn — metric writes MUST NOT propagate
 * errors to the user-facing 401 path.
 */
function scheduleInsert(row) {
  setImmediate(() => {
    query(
      `INSERT INTO auth_zombie_events
        (jwt_user_id, client_ip, user_agent, request_path)
       VALUES ($1, $2, $3, $4)`,
      [
        row.jwtUserId,
        row.clientIp,
        row.userAgent,
        row.requestPath,
      ],
    ).catch((err) => {
      // Intentionally only warn — losing a metric row is acceptable.
      console.warn('[authMetrics] insert failed (swallowed):', err && err.message);
    });
  });
}

/**
 * Record a zombie-auth event. Fire-and-forget — returns undefined
 * synchronously after scheduling the insert. The caller does NOT await.
 *
 * @param {object} event
 * @param {string|null} [event.jwtUserId]   the userId claim that didn't match
 * @param {string|null} [event.clientIp]    raw req.ip or XFF
 * @param {string|null} [event.userAgent]   raw User-Agent header
 * @param {string|null} [event.requestPath] req.originalUrl / req.path
 */
function recordZombieAuthEvent(event) {
  // Defensive: bad input shouldn't crash the user's request, it should
  // just degrade to "no metric". Never throw out of this function.
  try {
    const safe = {
      jwtUserId:   clamp(event && event.jwtUserId, JWT_USER_ID_MAX_LEN),
      clientIp:    normalizeIp(event && event.clientIp),
      userAgent:   clamp(event && event.userAgent, USER_AGENT_MAX_LEN),
      requestPath: clamp(event && event.requestPath, REQUEST_PATH_MAX_LEN),
    };
    scheduleInsert(safe);
  } catch (err) {
    // Belt-and-suspenders. If clamp/normalize somehow throws, swallow.
    console.warn('[authMetrics] recordZombieAuthEvent failed (swallowed):', err && err.message);
  }
}

/**
 * Aggregate the last `windowMinutes` of auth_zombie_events into a single
 * snapshot row. Used by future dashboard / alert wiring; exposed now so
 * the SLO C3 (auth 401 storm) calc can hit it without a second helper.
 *
 *   {
 *     totalEvents: 17,
 *     uniqueUsers: 3,           // distinct jwt_user_id values
 *     uniqueIps: 5,             // distinct client_ip values
 *     firstSeen: '2026-05-14T18:01:02Z',
 *     lastSeen:  '2026-05-14T18:42:11Z',
 *   }
 */
async function getZombieAuthSnapshot({ windowMinutes = 60 } = {}) {
  const safeMinutes = Math.max(
    1,
    Math.min(
      Number.isFinite(windowMinutes) ? Math.floor(windowMinutes) : 60,
      // 7 days in minutes — same cap as scrapeMetrics for consistency
      7 * 24 * 60,
    ),
  );

  const sql = `
    SELECT
      COUNT(*)::int                                      AS "totalEvents",
      COUNT(DISTINCT jwt_user_id)::int                   AS "uniqueUsers",
      COUNT(DISTINCT client_ip)::int                     AS "uniqueIps",
      MIN(created_at)                                    AS "firstSeen",
      MAX(created_at)                                    AS "lastSeen"
    FROM auth_zombie_events
    WHERE created_at >= NOW() - ($1 || ' minutes')::interval
  `;

  const result = await query(sql, [String(safeMinutes)]);
  return result.rows[0] || {
    totalEvents: 0, uniqueUsers: 0, uniqueIps: 0, firstSeen: null, lastSeen: null,
  };
}

module.exports = {
  recordZombieAuthEvent,
  getZombieAuthSnapshot,
  // exported for tests
  _internal: {
    clamp,
    normalizeIp,
    USER_AGENT_MAX_LEN,
    REQUEST_PATH_MAX_LEN,
    JWT_USER_ID_MAX_LEN,
  },
};
