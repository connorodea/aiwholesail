const express = require('express');
const crypto = require('node:crypto');
const { query } = require('../config/database');
const { asyncHandler, logSecurityEvent } = require('../middleware/errorHandler');

const router = express.Router();

const REVENUECAT_PRO_ENTITLEMENT = process.env.REVENUECAT_PRO_ENTITLEMENT || 'AIWHOLESAIL Pro';
const REVENUECAT_WEBHOOK_AUTH = process.env.REVENUECAT_WEBHOOK_AUTH;

/**
 * Constant-time string comparison for the RC shared-secret auth header.
 * Plain `===` / `!==` short-circuits at the first byte mismatch, leaking
 * per-byte timing info that lets an attacker incrementally guess the
 * secret. `crypto.timingSafeEqual` runs in length-dependent (NOT
 * content-dependent) time. Length-mismatched buffers throw — we explicitly
 * return false up front to keep the comparator side-channel-clean.
 *
 * Reviewer fix 2026-05-23.
 */
function timingSafeStringEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

// RC sends absolute ms-since-epoch timestamps. Coerce to ISO for Postgres.
function msToIso(ms) {
  if (!ms || typeof ms !== 'number') return null;
  return new Date(ms).toISOString();
}

// Map RC product identifier → our internal tier. We currently sell only Pro
// on iOS; if Elite ships later this is the place to fan it out.
function productToTier(productId) {
  if (!productId) return 'Pro';
  if (productId.toLowerCase().includes('elite')) return 'Elite';
  return 'Pro';
}

// Event types that mean "this user currently has Pro" — upsert active state.
const ACTIVE_EVENTS = new Set([
  'INITIAL_PURCHASE',
  'RENEWAL',
  'PRODUCT_CHANGE',
  'UNCANCELLATION',
  'NON_RENEWING_PURCHASE',
  'TEMPORARY_ENTITLEMENT_GRANT',
  'SUBSCRIPTION_EXTENDED',
]);

// Event types that mean "Pro should no longer apply" — only downgrade
// rows where source='revenuecat' so we don't touch Stripe subs.
const INACTIVE_EVENTS = new Set([
  'CANCELLATION',
  'EXPIRATION',
  'SUBSCRIPTION_PAUSED',
]);

// Refunds and billing issues need special care — log them but don't auto-
// downgrade in v1 (RC re-sends RENEWAL or EXPIRATION as appropriate).
const NOTIFY_ONLY_EVENTS = new Set([
  'BILLING_ISSUE',
  'REFUND_REVERSED',
  'TRANSFER',
  'SUBSCRIBER_ALIAS',
]);

/**
 * POST /api/iap/revenuecat/webhook
 *
 * RevenueCat fires this whenever a subscriber's entitlement state changes
 * (purchase, renewal, cancellation, refund, etc.). Mirrors the entitlement
 * into the subscribers table so server-gated routes can grant access to
 * iOS subscribers the same way they do for Stripe subscribers.
 *
 * Auth: RC sends a shared secret in the Authorization header configured
 * at https://app.revenuecat.com/projects/<id>/integrations/webhooks.
 * Set REVENUECAT_WEBHOOK_AUTH to the EXACT header value (RC sends it
 * verbatim — no Bearer prefix unless you typed one in the dashboard).
 */
router.post('/webhook', express.json({ limit: '256kb' }), asyncHandler(async (req, res) => {
  // 1. Auth — reject any request without the configured shared secret.
  if (!REVENUECAT_WEBHOOK_AUTH) {
    console.error('[RevenueCat] REVENUECAT_WEBHOOK_AUTH is not set — refusing to process webhook');
    return res.status(503).json({ error: 'webhook auth not configured' });
  }
  if (!timingSafeStringEqual(req.headers.authorization, REVENUECAT_WEBHOOK_AUTH)) {
    await logSecurityEvent('revenuecat_webhook_invalid_auth', {
      provided: req.headers.authorization ? '<present>' : '<missing>',
    }, null, req);
    return res.status(401).json({ error: 'unauthorized' });
  }

  const event = req.body?.event;
  if (!event || !event.type) {
    return res.status(400).json({ error: 'missing event' });
  }

  // 2. Idempotency dedup — RC retries non-2xx webhooks aggressively; a
  //    retry of a stale CANCELLATION after state has moved on would flip
  //    `subscribed` back to false. INSERT-OR-CONFLICT on event.id rejects
  //    duplicates BEFORE any state mutation. See migration 037.
  //    Missing event.id is malformed (RC always sends one) → 400 + log.
  if (!event.id || typeof event.id !== 'string') {
    return res.status(400).json({ error: 'missing event.id' });
  }
  const dedupResult = await query(
    `INSERT INTO revenuecat_processed_events (event_id) VALUES ($1)
     ON CONFLICT (event_id) DO NOTHING`,
    [event.id],
  );
  if (dedupResult.rowCount === 0) {
    console.log('[RevenueCat] duplicate event dropped', { eventId: event.id, type: event.type });
    return res.status(200).json({ ignored: 'duplicate event', eventId: event.id });
  }

  const {
    type,
    app_user_id: appUserId,
    original_app_user_id: originalAppUserId,
    product_id: productId,
    original_transaction_id: originalTransactionId,
    entitlement_ids: entitlementIds,
    expiration_at_ms: expirationAtMs,
    period_type: periodType,
  } = event;

  console.log('[RevenueCat] webhook event', { type, appUserId, productId });

  if (!appUserId) {
    return res.status(200).json({ ignored: 'no app_user_id' });
  }

  // Only act on events that mention the Pro entitlement (or have no
  // entitlement list, which RC does for INITIAL_PURCHASE on some plans).
  const touchesPro = !Array.isArray(entitlementIds)
    || entitlementIds.length === 0
    || entitlementIds.includes(REVENUECAT_PRO_ENTITLEMENT);
  if (!touchesPro) {
    return res.status(200).json({ ignored: 'entitlement not Pro' });
  }

  // 2. Resolve the internal user. RC `app_user_id` is set by the iOS
  // client to our internal user.id (see Purchases.logIn in the app).
  // Anonymous IDs (RC-generated) start with $RCAnonymousID: — those
  // come from users who launched the app before logging in. Park them
  // until the next event arrives with a real id, or until we add a
  // linkage table.
  const userId = appUserId.startsWith('$RCAnonymousID:') ? null : appUserId;
  if (!userId) {
    console.warn('[RevenueCat] anonymous app_user_id — no user to update', { originalAppUserId });
    return res.status(200).json({ ignored: 'anonymous app_user_id' });
  }

  // 3. Look up the user's email — subscribers is keyed on email UNIQUE.
  const userRow = await query('SELECT id, email FROM users WHERE id = $1 LIMIT 1', [userId]);
  if (userRow.rows.length === 0) {
    console.warn('[RevenueCat] unknown user_id in webhook', { userId, type });
    return res.status(200).json({ ignored: 'unknown user' });
  }
  const { email } = userRow.rows[0];

  if (NOTIFY_ONLY_EVENTS.has(type)) {
    console.log('[RevenueCat] notify-only event — no state change', { type, userId });
    return res.status(200).json({ ok: true, action: 'noop' });
  }

  const tier = productToTier(productId);
  const subscriptionEnd = msToIso(expirationAtMs);
  const isTrial = periodType === 'TRIAL';

  if (ACTIVE_EVENTS.has(type)) {
    // Upsert by email. Preserve stripe_customer_id if a Stripe row already
    // exists — we just OR in the RC fields and flip source/tier.
    await query(
      `
      INSERT INTO subscribers (
        email, user_id, source,
        subscribed, subscription_tier, subscription_end,
        is_trial, trial_end,
        revenuecat_app_user_id,
        revenuecat_original_transaction_id,
        revenuecat_product_id,
        updated_at
      ) VALUES ($1, $2, 'revenuecat', TRUE, $3, $4, $5, $6, $7, $8, $9, NOW())
      ON CONFLICT (email) DO UPDATE SET
        user_id = COALESCE(subscribers.user_id, EXCLUDED.user_id),
        source = 'revenuecat',
        subscribed = TRUE,
        subscription_tier = EXCLUDED.subscription_tier,
        subscription_end = EXCLUDED.subscription_end,
        is_trial = EXCLUDED.is_trial,
        trial_end = EXCLUDED.trial_end,
        revenuecat_app_user_id = EXCLUDED.revenuecat_app_user_id,
        revenuecat_original_transaction_id = EXCLUDED.revenuecat_original_transaction_id,
        revenuecat_product_id = EXCLUDED.revenuecat_product_id,
        updated_at = NOW()
      `,
      [
        email,
        userId,
        tier,
        subscriptionEnd,
        isTrial,
        isTrial ? subscriptionEnd : null,
        userId,
        originalTransactionId || null,
        productId || null,
      ],
    );
    return res.status(200).json({ ok: true, action: 'activated', tier });
  }

  if (INACTIVE_EVENTS.has(type)) {
    // Only downgrade rows we own. Don't touch a Stripe row if for some
    // reason the same email has both (unlikely but defensive).
    await query(
      `
      UPDATE subscribers SET
        subscribed = FALSE,
        subscription_end = COALESCE($2, subscription_end),
        updated_at = NOW()
      WHERE email = $1 AND source = 'revenuecat'
      `,
      [email, subscriptionEnd],
    );
    return res.status(200).json({ ok: true, action: 'deactivated' });
  }

  console.log('[RevenueCat] unhandled event type', { type });
  return res.status(200).json({ ok: true, action: 'unhandled', type });
}));

module.exports = router;
