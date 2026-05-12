/**
 * Webhooks management API.
 *
 * Pro/Elite-only. Pro is limited to 3 endpoints (enforced on create).
 * Elite has no cap. Trial users are blocked entirely with an upgrade nudge.
 *
 * Routes (mounted at /api/webhooks):
 *   GET    /                  list caller's endpoints
 *   POST   /                  create endpoint  { url, events[], description? }
 *   PATCH  /:id               update           { events?, active?, description? }
 *   DELETE /:id               remove
 *   POST   /:id/test          fire a test event (synchronous; returns result)
 *   GET    /:id/deliveries    recent delivery log (last 50)
 */

const express = require('express');
const { body, param, validationResult } = require('express-validator');
const { query } = require('../config/database');
const { authenticate } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');
const { attachSubscription, TIERS } = require('../middleware/subscription');
const { WEBHOOK_EVENTS, newSecret, deliver } = require('../lib/webhooks');
const { validateWebhookUrl } = require('../lib/url-safety');
const { respondError } = require('../lib/responses');

const router = express.Router();

const PRO_ENDPOINT_LIMIT = 3;
const KNOWN_EVENTS = Object.values(WEBHOOK_EVENTS);

function gateTier(req, res) {
  const tier = req.subscription?.tier;
  if (tier === TIERS.PRO || tier === TIERS.ELITE) return true;
  res.status(403).json({
    error: 'Webhooks require Pro or Elite',
    code: 'TIER_REQUIRED',
    message: 'Webhooks are a Pro and Elite feature. Upgrade to get instant property and owner updates pushed to your CRM or workflows.',
    currentTier: tier || TIERS.NONE,
  });
  return false;
}

function validateEvents(events) {
  if (!Array.isArray(events) || events.length === 0) return 'events must be a non-empty array';
  const unknown = events.filter((e) => !KNOWN_EVENTS.includes(e));
  if (unknown.length) return `unknown event types: ${unknown.join(', ')}`;
  return null;
}

// URL validation lives in lib/url-safety.validateWebhookUrl. It's async (resolves
// DNS to enforce blocking against the *resolved* IP, not just the literal
// hostname) so callers must `await` it.

function publicShape(row) {
  // Don't leak the secret in list/get responses (it's only revealed on create
  // and on POST /:id/rotate). secret_rotated_at IS exposed so the UI can show
  // "rotated 2h ago" indicators.
  return {
    id: row.id,
    url: row.url,
    events: row.events,
    description: row.description,
    active: row.active,
    lastSuccessAt: row.last_success_at,
    lastFailureAt: row.last_failure_at,
    consecutiveFailures: row.consecutive_failures,
    createdAt: row.created_at,
    secretRotatedAt: row.secret_rotated_at ?? null,
  };
}

// ─────────────────────────────── Routes ───────────────────────────────

router.get('/', authenticate, attachSubscription, asyncHandler(async (req, res) => {
  if (!gateTier(req, res)) return;
  const r = await query(
    `SELECT id, url, events, description, active, last_success_at, last_failure_at,
            consecutive_failures, created_at, secret_rotated_at
       FROM webhook_endpoints
      WHERE user_id = $1
   ORDER BY created_at DESC`,
    [req.user.id]
  );
  res.json({
    endpoints: r.rows.map(publicShape),
    knownEvents: KNOWN_EVENTS,
    limit: req.subscription.tier === TIERS.ELITE ? null : PRO_ENDPOINT_LIMIT,
  });
}));

router.post('/', authenticate, attachSubscription, [
  body('url').isString(),
  body('events').isArray(),
  body('description').optional().isString().isLength({ max: 120 }),
], asyncHandler(async (req, res) => {
  if (!gateTier(req, res)) return;
  const errs = validationResult(req);
  if (!errs.isEmpty()) return res.status(400).json({ error: 'Validation failed', errors: errs.array() });

  const { url, events, description } = req.body;
  if (typeof url !== 'string' || url.length === 0) {
    return res.status(400).json({ error: 'url required' });
  }
  const urlErr = await validateWebhookUrl(url, {
    allowHttp: process.env.NODE_ENV !== 'production',
  });
  if (urlErr) return res.status(400).json({ error: urlErr });
  const evErr = validateEvents(events);
  if (evErr) return res.status(400).json({ error: evErr });

  // Tier cap
  if (req.subscription.tier === TIERS.PRO) {
    const count = await query(`SELECT COUNT(*)::int AS n FROM webhook_endpoints WHERE user_id = $1`, [req.user.id]);
    if ((count.rows[0]?.n || 0) >= PRO_ENDPOINT_LIMIT) {
      return respondError(res, 403, 'Endpoint limit reached', {
        code: 'LIMIT_REACHED',
        details: {
          message: `Pro is limited to ${PRO_ENDPOINT_LIMIT} webhook endpoints. Upgrade to Elite for unlimited.`,
          limit: PRO_ENDPOINT_LIMIT,
        },
      });
    }
  }

  const secret = newSecret();
  const r = await query(
    `INSERT INTO webhook_endpoints (user_id, url, secret, events, description)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [req.user.id, url, secret, events, description || null]
  );

  // Reveal the secret ONLY on create (so the consumer can configure HMAC verification)
  res.status(201).json({
    endpoint: { ...publicShape(r.rows[0]), secret },
    note: 'Save this secret now — it will not be shown again. Use it to verify the X-AIWholesail-Signature HMAC.',
  });
}));

/**
 * POST /:id/rotate — generate a new HMAC secret for an existing webhook.
 *
 * Same one-time-reveal contract as endpoint creation: the new secret is
 * returned ONCE in the response body and never again. For 24h after
 * rotation, the delivery path signs payloads with BOTH the new secret
 * AND the old secret, sending two headers (X-AIWholesail-Signature +
 * X-AIWholesail-Signature-Previous) so subscribers can re-deploy
 * without dropping events. After the grace window the old secret is
 * cleared. See lib/webhooks.js deliver() for the dual-signing logic.
 */
router.post('/:id/rotate', authenticate, attachSubscription, [
  param('id').isUUID(),
], asyncHandler(async (req, res) => {
  if (!gateTier(req, res)) return;
  const errs = validationResult(req);
  if (!errs.isEmpty()) return res.status(400).json({ error: 'Validation failed', errors: errs.array() });

  const nextSecret = newSecret();
  // Single atomic UPDATE: capture the old secret into previous_secret,
  // overwrite secret with the new one, stamp rotated_at. Tenant-scoped.
  const r = await query(
    `UPDATE webhook_endpoints
        SET previous_secret   = secret,
            secret            = $1,
            secret_rotated_at = NOW(),
            updated_at        = NOW()
      WHERE id = $2 AND user_id = $3
   RETURNING id, url, events, description, active, last_success_at, last_failure_at,
             consecutive_failures, created_at, secret_rotated_at`,
    [nextSecret, req.params.id, req.user.id]
  );
  if (r.rows.length === 0) return res.status(404).json({ error: 'Webhook not found' });

  res.json({
    endpoint: { ...publicShape(r.rows[0]), secret: nextSecret, secret_rotated_at: r.rows[0].secret_rotated_at },
    note: 'Save this NEW secret now — it will not be shown again. For the next 24 hours, AIWholesail will sign payloads with BOTH the new secret (X-AIWholesail-Signature) AND the old secret (X-AIWholesail-Signature-Previous), so you can verify with either while you re-deploy. After 24h only the new secret is sent.',
  });
}));

router.patch('/:id', authenticate, attachSubscription, [
  param('id').isUUID(),
], asyncHandler(async (req, res) => {
  if (!gateTier(req, res)) return;
  const errs = validationResult(req);
  if (!errs.isEmpty()) return res.status(400).json({ error: 'Validation failed', errors: errs.array() });

  const { events, active, description } = req.body;
  if (events !== undefined) {
    const evErr = validateEvents(events);
    if (evErr) return res.status(400).json({ error: evErr });
  }

  const r = await query(
    `UPDATE webhook_endpoints
        SET events      = COALESCE($1, events),
            active      = COALESCE($2, active),
            description = COALESCE($3, description),
            -- A re-enable resets the failure streak so we don't immediately auto-disable
            consecutive_failures = CASE WHEN $2 = true THEN 0 ELSE consecutive_failures END,
            updated_at  = NOW()
      WHERE id = $4 AND user_id = $5
   RETURNING id, url, events, description, active, last_success_at, last_failure_at,
             consecutive_failures, created_at, secret_rotated_at`,
    [events ?? null, active ?? null, description ?? null, req.params.id, req.user.id]
  );
  if (r.rows.length === 0) return res.status(404).json({ error: 'Webhook not found' });
  res.json({ endpoint: publicShape(r.rows[0]) });
}));

router.delete('/:id', authenticate, attachSubscription, [
  param('id').isUUID(),
], asyncHandler(async (req, res) => {
  if (!gateTier(req, res)) return;
  const r = await query(`DELETE FROM webhook_endpoints WHERE id = $1 AND user_id = $2 RETURNING id`, [
    req.params.id, req.user.id,
  ]);
  if (r.rows.length === 0) return res.status(404).json({ error: 'Webhook not found' });
  res.json({ deleted: r.rows[0].id });
}));

router.post('/:id/test', authenticate, attachSubscription, [
  param('id').isUUID(),
], asyncHandler(async (req, res) => {
  if (!gateTier(req, res)) return;
  const r = await query(`SELECT * FROM webhook_endpoints WHERE id = $1 AND user_id = $2`, [
    req.params.id, req.user.id,
  ]);
  if (r.rows.length === 0) return res.status(404).json({ error: 'Webhook not found' });
  const endpoint = r.rows[0];

  const result = await deliver(
    endpoint,
    'webhook.test',
    {
      message: 'This is a test webhook delivery from AIWholesail.',
      endpoint_id: endpoint.id,
      verify_signature_with_secret: '(shown only on endpoint create)',
    }
  );
  res.json({
    ok: result.ok,
    status: result.status,
    durationMs: result.durationMs,
    message: result.ok
      ? 'Test delivered successfully.'
      : `Delivery failed (status ${result.status}). Check your endpoint and try again.`,
  });
}));

router.get('/:id/deliveries', authenticate, attachSubscription, [
  param('id').isUUID(),
], asyncHandler(async (req, res) => {
  if (!gateTier(req, res)) return;
  const own = await query(`SELECT id FROM webhook_endpoints WHERE id = $1 AND user_id = $2`, [
    req.params.id, req.user.id,
  ]);
  if (own.rows.length === 0) return res.status(404).json({ error: 'Webhook not found' });

  const r = await query(
    `SELECT id, event_type, attempt, response_status, duration_ms, status, delivered_at,
            response_body_truncated
       FROM webhook_deliveries
      WHERE endpoint_id = $1
   ORDER BY delivered_at DESC
      LIMIT 50`,
    [req.params.id]
  );
  res.json({ deliveries: r.rows });
}));

module.exports = router;
