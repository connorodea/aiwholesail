/**
 * /api/admin/* — operator-only endpoints.
 *
 * Auth model: bearer-JWT user (`authenticate`) PLUS a hardcoded allowlist
 * of admin emails. There's no `is_admin` column on `users` today, so the
 * allowlist is the canonical check. If/when an admin flag lands, swap the
 * email check for `req.user?.is_admin === true` and remove the constant.
 *
 * These endpoints are intentionally NOT mounted on the exec vhost
 * (exec.aiwholesail.com) — that vhost has its own single-user JWT cookie
 * for the founder dashboard. Admin endpoints here are API-token-style:
 * useful from curl / scripts / a future ops dashboard, and live on the
 * same vhost as the rest of /api.
 */

const express = require('express');
const router = express.Router();

const { authenticate } = require('../middleware/auth');
const { getMetricsSnapshot } = require('../lib/observability/scrapeMetrics');

// Hardcoded admin allowlist. Keep this list small. Anyone added here can
// read every scrape_provider_metrics row, so treat it as production-secret.
// If you need to grant ops access to someone NOT here, add an is_admin
// column to users and switch the check below — don't grow this list.
const ADMIN_EMAILS = new Set([
  'connor@upscaledinc.com',
  'cpodea5@gmail.com',
]);

function requireAdmin(req, res, next) {
  const email = req.user && req.user.email;
  // Defensive normalization — emails from the DB should already be lowercase
  // (auth.js stores them that way), but a manual SQL insert could slip
  // through. Compare normalized.
  const normalized = typeof email === 'string' ? email.trim().toLowerCase() : '';

  // Allow either the email allowlist OR a future is_admin=true column.
  const isAdminFlag = req.user && req.user.is_admin === true;
  if (isAdminFlag || ADMIN_EMAILS.has(normalized)) {
    return next();
  }
  return res.status(403).json({
    error: 'admin only',
    timestamp: new Date().toISOString(),
  });
}

/**
 * GET /api/admin/scrape-metrics?windowMinutes=60
 *
 * Returns the per (provider, action, call_kind) snapshot for the last N
 * minutes. Used to track the RapidAPI → scrape.do migration (success rate
 * + p50/p95 latency per backend, how often the fallback is firing).
 *
 * windowMinutes defaults to 60, clamped server-side to [1, 10080].
 */
router.get('/scrape-metrics', authenticate, requireAdmin, async (req, res) => {
  try {
    const raw = req.query.windowMinutes;
    const parsed = raw === undefined ? 60 : parseInt(raw, 10);
    // NaN here is fine — the helper clamps and defaults.
    const rows = await getMetricsSnapshot({ windowMinutes: parsed });
    return res.json({
      windowMinutes: parsed,
      rows,
      generatedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[admin/scrape-metrics] failed:', err && err.message);
    return res.status(500).json({
      error: 'failed to load scrape metrics',
      timestamp: new Date().toISOString(),
    });
  }
});

module.exports = router;
