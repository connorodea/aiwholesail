const express = require('express');
const { body, param, validationResult } = require('express-validator');
const { query } = require('../config/database');
const { authenticate } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');
const { getAllForUser, clearCache } = require('../lib/featureFlags');

const router = express.Router();

/**
 * Resolve whether the requesting user is an admin. The product doesn't
 * have a role column yet — staff are identified by an env-driven email
 * allowlist. Cheap, explicit, easy to audit.
 *
 * Set ADMIN_EMAILS in .env: comma-separated list, lowercased on compare.
 */
function isAdmin(req) {
  if (!req.user?.email) return false;
  const allowlist = (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return allowlist.includes(req.user.email.toLowerCase());
}

function requireAdmin(req, res, next) {
  if (!isAdmin(req)) return res.status(403).json({ error: 'Admin only' });
  return next();
}

/**
 * GET /api/flags
 * Returns the resolved flag map for the current user.
 * Used by the React useFeatureFlag hook.
 */
router.get('/', authenticate, asyncHandler(async (req, res) => {
  const flags = await getAllForUser(req.user.id);
  res.json({ flags });
}));

/**
 * GET /api/flags/admin
 * Lists every global flag + every per-user override. Admin-only.
 */
router.get('/admin', authenticate, requireAdmin, asyncHandler(async (req, res) => {
  const { rows: globals } = await query(
    'SELECT slug, enabled, rollout_pct, description, updated_at FROM feature_flag_globals ORDER BY slug'
  );
  const { rows: overrides } = await query(
    `SELECT ffu.user_id, u.email, ffu.slug, ffu.enabled, ffu.reason, ffu.created_at
     FROM feature_flag_users ffu
     JOIN users u ON u.id = ffu.user_id
     ORDER BY ffu.slug, u.email`
  );
  res.json({ globals, overrides });
}));

/**
 * PUT /api/flags/admin/global/:slug
 * Body: { enabled?: boolean, rollout_pct?: number, description?: string }
 * Upserts the global config for a slug. Admin-only.
 */
router.put(
  '/admin/global/:slug',
  authenticate,
  requireAdmin,
  [
    param('slug').isString().isLength({ min: 1, max: 80 }),
    body('enabled').optional().isBoolean(),
    body('rollout_pct').optional().isInt({ min: 0, max: 100 }),
    body('description').optional().isString().isLength({ max: 500 }),
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ error: 'Validation failed', errors: errors.array() });

    const { slug } = req.params;
    const { enabled, rollout_pct, description } = req.body;

    await query(
      `INSERT INTO feature_flag_globals (slug, enabled, rollout_pct, description, updated_at)
       VALUES ($1, COALESCE($2, FALSE), COALESCE($3, 0), $4, NOW())
       ON CONFLICT (slug) DO UPDATE SET
         enabled = COALESCE($2, feature_flag_globals.enabled),
         rollout_pct = COALESCE($3, feature_flag_globals.rollout_pct),
         description = COALESCE($4, feature_flag_globals.description),
         updated_at = NOW()`,
      [slug, enabled ?? null, rollout_pct ?? null, description ?? null]
    );
    clearCache();
    res.json({ ok: true });
  })
);

/**
 * PUT /api/flags/admin/user/:userId/:slug
 * Body: { enabled: boolean, reason?: string }
 * Sets a per-user override. Admin-only.
 */
router.put(
  '/admin/user/:userId/:slug',
  authenticate,
  requireAdmin,
  [
    param('userId').isUUID(),
    param('slug').isString().isLength({ min: 1, max: 80 }),
    body('enabled').isBoolean(),
    body('reason').optional().isString().isLength({ max: 200 }),
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ error: 'Validation failed', errors: errors.array() });

    const { userId, slug } = req.params;
    const { enabled, reason } = req.body;

    await query(
      `INSERT INTO feature_flag_users (user_id, slug, enabled, reason)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id, slug) DO UPDATE SET
         enabled = EXCLUDED.enabled,
         reason = COALESCE(EXCLUDED.reason, feature_flag_users.reason)`,
      [userId, slug, enabled, reason || null]
    );
    res.json({ ok: true });
  })
);

/**
 * DELETE /api/flags/admin/user/:userId/:slug
 * Removes a per-user override; user falls back to global rollout.
 */
router.delete(
  '/admin/user/:userId/:slug',
  authenticate,
  requireAdmin,
  [param('userId').isUUID(), param('slug').isString()],
  asyncHandler(async (req, res) => {
    await query(
      'DELETE FROM feature_flag_users WHERE user_id = $1 AND slug = $2',
      [req.params.userId, req.params.slug]
    );
    res.json({ ok: true });
  })
);

module.exports = router;
