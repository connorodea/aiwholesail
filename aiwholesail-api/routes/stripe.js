const express = require('express');
const Stripe = require('stripe');
const { body, validationResult } = require('express-validator');
const { query } = require('../config/database');
const { authenticate, optionalAuth } = require('../middleware/auth');
const { asyncHandler, logSecurityEvent } = require('../middleware/errorHandler');

const router = express.Router();

// Initialize Stripe (may be null if key not configured)
const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2023-10-16' })
  : null;

// Middleware to check Stripe is configured
const requireStripe = (req, res, next) => {
  if (!stripe) {
    return res.json({ subscribed: false, message: 'Stripe not configured' });
  }
  next();
};

/**
 * Resolve canonical tier ('Elite' | 'Pro') from a Stripe Price object.
 *
 * Priority order — first match wins:
 *  1. `price.metadata.tier`            — set in the Stripe dashboard / API. Wins
 *                                         outright. Supports founder / annual /
 *                                         comped Elite pricing under $99.
 *  2. `price.lookup_key`               — convention: starts with 'elite' or 'pro'.
 *  3. `price.unit_amount` thresholds   — legacy fallback. $99+ → Elite, $29+ → Pro.
 *
 * Returns 'Pro' when no signal indicates Elite. This is the canonical writer for
 * the `subscribers.subscription_tier` column and is shared by both the on-demand
 * GET /subscription path AND the webhook reconciler so the two never disagree.
 */
function resolveTierFromPrice(price) {
  if (!price) return 'Pro';

  // 1. Explicit metadata wins.
  const metaTier = typeof price.metadata?.tier === 'string'
    ? price.metadata.tier.trim().toLowerCase()
    : '';
  if (metaTier === 'elite' || metaTier === 'premium') return 'Elite';
  if (metaTier === 'pro') return 'Pro';

  // 2. Lookup key convention.
  const lookupKey = typeof price.lookup_key === 'string'
    ? price.lookup_key.trim().toLowerCase()
    : '';
  if (lookupKey.startsWith('elite')) return 'Elite';
  if (lookupKey.startsWith('pro')) return 'Pro';

  // 3. Legacy unit_amount fallback. Cents, monthly billing cycle.
  const amount = Number(price.unit_amount) || 0;
  if (amount >= 9900) return 'Elite';
  return 'Pro';
}

/**
 * POST /api/stripe/checkout
 * Create a checkout session for subscription
 */
router.post('/checkout', authenticate, [
  body('priceId').notEmpty().withMessage('Plan type required')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: 'Validation failed', errors: errors.array() });
  }

  const { priceId, guestCheckout } = req.body;
  const user = req.user;

  console.log('[Stripe] Creating checkout session', { priceId, userId: user?.id, guestCheckout });

  // Fetch all prices from Stripe to find the correct ones
  const prices = await stripe.prices.list({
    active: true,
    type: 'recurring',
    expand: ['data.product']
  });

  // Find the correct price based on plan type. We look up by amount so the
  // priceId stored on the frontend is purely a label; new Stripe Price
  // objects (e.g. after a price change) get picked up automatically.
  // Existing subscribers stay on the price object their subscription was
  // created with — this only affects new checkout sessions.
  let actualPriceId;
  if (priceId === 'Pro') {
    const proPrice = prices.data.find(price =>
      price.unit_amount === 4900 &&
      price.recurring?.interval === 'month'
    );
    actualPriceId = proPrice?.id;
  } else if (priceId === 'Elite') {
    const elitePrice = prices.data.find(price =>
      price.unit_amount === 9900 &&
      price.recurring?.interval === 'month'
    );
    actualPriceId = elitePrice?.id;
  }

  if (!actualPriceId) {
    return res.status(400).json({
      error: `No price found for ${priceId} plan. Please ensure you have created the products in Stripe.`
    });
  }

  let customerId;
  let customerEmail = user?.email;

  if (!guestCheckout && user?.email) {
    // Prefer the customer id stored in our DB (populated at signup since the
    // trial-customer fix, or backfilled for older trials). Falls back to
    // Stripe customer search if we don't have one locally. Reduces a Stripe
    // API roundtrip on the hot path.
    try {
      const local = await query(
        'SELECT stripe_customer_id FROM subscribers WHERE user_id = $1 OR email = $2 LIMIT 1',
        [user.id, user.email]
      );
      if (local.rows[0]?.stripe_customer_id) {
        customerId = local.rows[0].stripe_customer_id;
        console.log('[Stripe] Using stripe_customer_id from subscribers', { customerId });
      }
    } catch (err) {
      console.warn('[Stripe] subscribers lookup failed, falling back to API:', err.message);
    }

    if (!customerId) {
      const customers = await stripe.customers.list({ email: user.email, limit: 1 });
      if (customers.data.length > 0) {
        customerId = customers.data[0].id;
        console.log('[Stripe] Found existing customer via API', { customerId });
      }
    }
  }

  const frontendUrl = process.env.FRONTEND_URL || 'https://aiwholesail.com';

  // Marketing-attribution metadata — pulled from the users row (populated
  // at signup). Propagated to BOTH the Checkout Session and the resulting
  // Subscription so paid conversions can be sliced by ad set in Stripe
  // (and so the Meta CAPI webhook handler can read them from the
  // subscription object when sending Purchase events).
  let attrMetadata = {};
  if (user?.id) {
    try {
      const u = await query(
        `SELECT utm_source, utm_medium, utm_campaign, utm_content, utm_term,
                fbclid, gclid
           FROM users WHERE id = $1 LIMIT 1`,
        [user.id]
      );
      if (u.rows[0]) {
        for (const [k, v] of Object.entries(u.rows[0])) {
          if (v) attrMetadata[k] = String(v).slice(0, 500);
        }
      }
    } catch (err) {
      console.warn('[Stripe] attribution lookup failed (non-fatal):', err.message);
    }
  }

  // Stripe rejects requests that set BOTH `customer` and `customer_email`
  // ("You may only specify one of these parameters"). When we have a known
  // customer id, omit the email — Stripe uses the customer's stored email.
  // Only fall back to customer_email when we have no customer id (e.g. a
  // truly anonymous guest checkout or a brand-new signup whose customer
  // creation in routes/auth.js failed).
  // CRITICAL: do NOT stack another 7-day Stripe trial on top of the app's
  // in-product 7-day trial. The prior config was:
  //   payment_method_collection: 'if_required'   // no card up front
  //   subscription_data.trial_period_days: 7     // a second 7-day free trial
  //   trial_settings.end_behavior.missing_payment_method: 'cancel'
  // Result: 13 subscriptions ever created, 11 already auto-canceled, 2 mid-
  // trial — zero dollars collected through the entire flow. This was the
  // root cause of the "no paid subscriptions" mystery.
  //
  // New config: card required at Checkout, no second trial. The user's
  // in-app 7-day trial (enforced via subscribers.trial_end + requireTier-
  // WithLimit) remains as the lead magnet; Checkout is now the actual
  // conversion event.
  const session = await stripe.checkout.sessions.create({
    customer: customerId || undefined,
    customer_email: customerId ? undefined : (guestCheckout ? undefined : customerEmail),
    line_items: [
      {
        price: actualPriceId,
        quantity: 1
      }
    ],
    mode: 'subscription',
    payment_method_collection: 'always',
    success_url: `${frontendUrl}/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${frontendUrl}/pricing`,
    custom_text: {
      submit: {
        message: "You've used your 7-day free trial. Subscribe now to keep full access — cancel anytime from your account."
      }
    },
    metadata: {
      company_name: 'AI Wholesail',
      guest_checkout: String(guestCheckout || false),
      user_id: user?.id || '',
      ...attrMetadata,
    },
    // Also tag the resulting Subscription with the same attribution so
    // webhook handlers (Meta CAPI Purchase event in Layer 2) can read it
    // straight off the subscription object without an extra DB call.
    subscription_data: {
      metadata: {
        user_id: user?.id || '',
        ...attrMetadata,
      },
    },
  });

  console.log('[Stripe] Checkout session created', { sessionId: session.id });

  res.json({ url: session.url, sessionId: session.id });
}));

/**
 * POST /api/stripe/portal
 * Create a customer portal session
 */
router.post('/portal', authenticate, asyncHandler(async (req, res) => {
  const user = req.user;

  // Find customer by email
  const customers = await stripe.customers.list({ email: user.email, limit: 1 });

  if (customers.data.length === 0) {
    return res.status(404).json({ error: 'No Stripe customer found for this account' });
  }

  const customerId = customers.data[0].id;
  const frontendUrl = process.env.FRONTEND_URL || 'https://aiwholesail.com';

  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: `${frontendUrl}/dashboard`
  });

  res.json({ url: session.url });
}));

/**
 * GET /api/stripe/subscription
 * Check subscription status
 */
router.get('/subscription', authenticate, asyncHandler(async (req, res) => {
  const user = req.user;

  console.log('[Stripe] Checking subscription for user', { userId: user.id, email: user.email });

  // First check database for existing subscription/trial
  const dbSub = await query(
    'SELECT * FROM subscribers WHERE user_id = $1 OR email = $2 LIMIT 1',
    [user.id, user.email]
  );

  // Helper: return DB subscription state, auto-downgrading if expired
  const returnDbState = async (sub) => {
    if (!sub) return res.json({ subscribed: false });

    // Check if trial or subscription has expired
    const now = new Date();
    const trialExpired = sub.is_trial && sub.trial_end && new Date(sub.trial_end) < now;
    const subExpired = sub.subscription_end && new Date(sub.subscription_end) < now;

    if (trialExpired || subExpired) {
      // Downgrade in database
      await query(
        `UPDATE subscribers SET subscribed = false, is_trial = false, updated_at = NOW() WHERE email = $1`,
        [sub.email]
      );
      return res.json({
        subscribed: false,
        subscription_tier: null,
        subscription_end: sub.subscription_end,
        is_trial: false,
        trial_start: sub.trial_start,
        trial_end: sub.trial_end,
      });
    }

    return res.json({
      subscribed: sub.subscribed,
      subscription_tier: sub.subscription_tier,
      subscription_end: sub.subscription_end,
      is_trial: sub.is_trial,
      trial_start: sub.trial_start,
      trial_end: sub.trial_end,
    });
  };

  // If Stripe is not configured, return DB state only
  if (!stripe) {
    if (dbSub.rows.length > 0) {
      return returnDbState(dbSub.rows[0]);
    }
    return res.json({ subscribed: false });
  }

  const customers = await stripe.customers.list({ email: user.email, limit: 1 });

  if (customers.data.length === 0) {
    // No Stripe customer — return DB trial state if it exists
    if (dbSub.rows.length > 0) {
      return returnDbState(dbSub.rows[0]);
    }
    return res.json({ subscribed: false });
  }

  const customerId = customers.data[0].id;

  const subscriptions = await stripe.subscriptions.list({
    customer: customerId,
    status: 'all',
    limit: 10
  });

  let hasActiveSub = false;
  let subscriptionTier = null;
  let subscriptionEnd = null;
  let isOnTrial = false;
  let trialEnd = null;
  let trialStart = null;

  for (const subscription of subscriptions.data) {
    if (subscription.status === 'active' || subscription.status === 'trialing') {
      hasActiveSub = true;
      subscriptionEnd = new Date(subscription.current_period_end * 1000).toISOString();

      if (subscription.status === 'trialing' && subscription.trial_end) {
        isOnTrial = true;
        trialEnd = new Date(subscription.trial_end * 1000).toISOString();
        if (subscription.trial_start) {
          trialStart = new Date(subscription.trial_start * 1000).toISOString();
        }
      }

      // Determine subscription tier from the active price. We resolve in this
      // priority order so annual / discounted / founder prices don't silently
      // demote a paying Elite customer to 'Pro':
      //   1. price.metadata.tier === 'Elite' | 'Pro'         (admin sets in Stripe)
      //   2. price.lookup_key starts with 'elite' or 'pro'    (admin sets in Stripe)
      //   3. unit_amount >= 9900 → Elite, >= 2900 → Pro
      const priceId = subscription.items.data[0].price.id;
      const price = await stripe.prices.retrieve(priceId);
      subscriptionTier = resolveTierFromPrice(price);

      break;
    }
  }

  // CRITICAL — third wipe vector (caught after PR #192 + #193 shipped).
  //
  // The useSubscription React hook calls this endpoint on every authenticated
  // page load. The original handler unconditionally UPSERTed whatever it got
  // back from stripe.subscriptions.list() — including the empty case (which
  // is true for every in-app DB trialer and every manual Elite grant). That
  // wiped the locally-managed trial/Elite row within seconds of any affected
  // user opening the app. Confirmed reproduction (2026-05-12):
  //   - Test user with active Pro trial (trial_end = 2026-05-19)
  //   - Single GET /api/stripe/subscription
  //   - Row wiped to (NULL, false, false, NULL, NULL)
  //
  // Two-layer fix (combined from PR #194 + PR #195):
  //   1. If Stripe shows no live subs AND the local row has an active trial
  //      OR future subscription_end, preserve the row and return its state.
  //      Skip the UPSERT entirely.
  //   2. If Stripe shows no live subs AND local state is also expired,
  //      use a lighter UPDATE that preserves subscription_tier as a
  //      historical breadcrumb (matches the PR #193 middleware pattern).
  //      Setting subscribed=false + is_trial=false is enough to gate.
  if (!hasActiveSub && dbSub.rows.length > 0) {
    const localRow = dbSub.rows[0];
    const now = new Date();
    const trialStillActive = !!(localRow.is_trial && localRow.trial_end && new Date(localRow.trial_end) > now);
    const subStillActive = !!(localRow.subscription_end && new Date(localRow.subscription_end) > now);

    if (trialStillActive || subStillActive) {
      console.log(`[Stripe] GET /subscription: ${user.email} — Stripe 0 live subs but local state active (trial=${trialStillActive} sub=${subStillActive}). Preserving.`);
      return res.json({
        subscribed: localRow.subscribed,
        subscription_tier: localRow.subscription_tier,
        subscription_end: localRow.subscription_end,
        is_trial: localRow.is_trial,
        trial_start: localRow.trial_start,
        trial_end: localRow.trial_end,
      });
    }
  }

  // Update database — split by case so genuine downgrades preserve the
  // tier breadcrumb.
  if (hasActiveSub) {
    await query(
      `INSERT INTO subscribers (email, user_id, stripe_customer_id, subscribed, subscription_tier, subscription_end, is_trial, trial_start, trial_end, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
       ON CONFLICT (email) DO UPDATE SET
         stripe_customer_id = EXCLUDED.stripe_customer_id,
         subscribed = EXCLUDED.subscribed,
         subscription_tier = EXCLUDED.subscription_tier,
         subscription_end = EXCLUDED.subscription_end,
         is_trial = EXCLUDED.is_trial,
         trial_start = EXCLUDED.trial_start,
         trial_end = EXCLUDED.trial_end,
         updated_at = NOW()`,
      [user.email, user.id, customerId, hasActiveSub, subscriptionTier, subscriptionEnd, isOnTrial, trialStart, trialEnd]
    );
  } else {
    await query(
      `UPDATE subscribers
         SET stripe_customer_id = $2,
             subscribed = false,
             is_trial = false,
             updated_at = NOW()
       WHERE email = $1`,
      [user.email, customerId]
    );
  }

  res.json({
    subscribed: hasActiveSub,
    subscription_tier: subscriptionTier,
    subscription_end: subscriptionEnd,
    is_trial: isOnTrial,
    trial_start: trialStart,
    trial_end: trialEnd
  });
}));

/**
 * POST /api/stripe/webhook
 * Handle Stripe webhooks
 */
router.post('/webhook', express.raw({ type: 'application/json' }), asyncHandler(async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
  } catch (err) {
    console.error('[Stripe] Webhook signature verification failed:', err.message);
    await logSecurityEvent('stripe_webhook_invalid_signature', { error: err.message }, null, req);
    return res.status(400).json({ error: 'Webhook signature verification failed' });
  }

  console.log('[Stripe] Webhook received:', event.type);

  // Handle the event
  switch (event.type) {
    case 'customer.subscription.created':
    case 'customer.subscription.updated': {
      const subscription = event.data.object;
      await handleSubscriptionUpdate(subscription);
      break;
    }

    case 'customer.subscription.deleted': {
      const subscription = event.data.object;
      await handleSubscriptionCanceled(subscription);
      break;
    }

    case 'checkout.session.completed': {
      const session = event.data.object;
      await handleCheckoutCompleted(session);
      break;
    }

    case 'invoice.payment_succeeded': {
      const invoice = event.data.object;
      console.log('[Stripe] Payment succeeded for invoice:', invoice.id);
      break;
    }

    case 'invoice.payment_failed': {
      const invoice = event.data.object;
      console.log('[Stripe] Payment failed for invoice:', invoice.id);
      // TODO: Send notification email
      break;
    }

    default:
      console.log('[Stripe] Unhandled event type:', event.type);
  }

  res.json({ received: true });
}));

/**
 * Pick the "winning" subscription from a customer's set when they have multiple.
 *
 * Priority order:
 *   1. active        — fully paid, in good standing
 *   2. trialing      — on a trial (paid or unpaid)
 *   3. past_due      — paying but card retry pending
 *   4. anything else (incomplete, paused, etc.) — surface but flag as inactive
 *
 * Within the same status tier, prefer the most recently created. We also
 * prefer subscriptions that have a payment method attached (i.e. real
 * intent to pay) over no-card trials.
 */
function pickRepresentativeSub(subs) {
  if (!Array.isArray(subs) || subs.length === 0) return null;
  const score = (s) => {
    const status = s.status;
    let base = 0;
    if (status === 'active') base = 4000;
    else if (status === 'trialing') base = 3000;
    else if (status === 'past_due') base = 2000;
    else if (status === 'unpaid') base = 1000;
    // Has a default payment method? Strong signal of real intent
    if (s.default_payment_method || s.collection_method === 'send_invoice') base += 500;
    // Recency tiebreaker — created is unix seconds, just add as-is (rank ms apart)
    return base + (s.created || 0) / 1e6;
  };
  return subs.slice().sort((a, b) => score(b) - score(a))[0];
}

/**
 * Re-derive the subscribers row state for a customer by asking Stripe for
 * their current sub list and picking the winner. Used by both update and
 * cancel handlers so that:
 *   - events arriving out of order don't clobber state
 *   - a customer with multiple subs (e.g. ghost trial + new paid) reflects
 *     the active paid sub, not the ghost
 *   - a cancellation only downgrades if no other active sub remains
 */
async function reconcileCustomerSubscriptions(customerId) {
  const customer = await stripe.customers.retrieve(customerId);
  if (!customer || customer.deleted) return;
  const email = customer.email;
  if (!email) {
    console.error('[Stripe] reconcile: customer has no email:', customerId);
    return;
  }

  // status: 'all' returns active + trialing + past_due + canceled + incomplete + paused + unpaid + ended
  const list = await stripe.subscriptions.list({ customer: customerId, status: 'all', limit: 20 });
  // Drop subs that are unambiguously done — they shouldn't influence current access
  const live = (list.data || []).filter(s => !['canceled', 'incomplete_expired'].includes(s.status));

  if (live.length === 0) {
    // CRITICAL — must NOT wipe locally-managed state.
    //
    // Two cohorts get reconciled with zero live Stripe subs:
    //   (a) Users on the in-app DB trial we created at signup. They have
    //       a Stripe customer (created at signup) but never started a
    //       Stripe subscription. Their trial lives in the subscribers
    //       table, not in Stripe.
    //   (b) Users we manually granted Elite via SQL (cpodea5, etc) with
    //       subscription_end far in the future. No Stripe sub, but full
    //       paid access.
    //
    // If this reconciler unconditionally wiped subscribed=false and
    // subscription_tier=NULL for those users — which it did until this
    // commit — it would silently kill their access mid-trial whenever
    // Stripe fired a `customer.subscription.deleted` webhook (e.g.
    // because the user opened Checkout and abandoned, causing Stripe to
    // eventually expire the incomplete sub). That is exactly what
    // wiped 20 users' trials and broke the manual Elite grants.
    //
    // Fix: read the local row first. If it shows an active trial or an
    // active manual subscription_end, skip the downgrade entirely.
    const existing = await query(
      `SELECT is_trial, trial_end, subscription_end, subscription_tier
         FROM subscribers WHERE email = $1`,
      [email]
    );
    const row = existing.rows[0];
    const now = new Date();
    const trialStillActive = !!(row?.is_trial && row?.trial_end && new Date(row.trial_end) > now);
    const subStillActive = !!(row?.subscription_end && new Date(row.subscription_end) > now);

    if (trialStillActive || subStillActive) {
      console.log(`[Stripe] reconcile: ${email} — Stripe shows 0 live subs but local state is active (trial=${trialStillActive} sub=${subStillActive}). Preserving.`);
      return;
    }

    // Genuine downgrade — user is past trial AND has no live Stripe sub.
    // We preserve subscription_tier as a historical breadcrumb (so the
    // UI can show "Your previous plan was Pro" upgrade nudges); the
    // (subscribed=false, is_trial=false) pair is enough to gate features.
    await query(
      `UPDATE subscribers SET
         subscribed = false,
         is_trial = false,
         updated_at = NOW()
       WHERE email = $1`,
      [email]
    );
    console.log(`[Stripe] reconcile: no live subs for ${email}, local trial/sub also expired — downgraded`);
    return;
  }

  const sub = pickRepresentativeSub(live);
  const hasActiveSub = sub.status === 'active' || sub.status === 'trialing';
  const subscriptionEnd = sub.current_period_end
    ? new Date(sub.current_period_end * 1000).toISOString()
    : null;

  let isOnTrial = false;
  let trialEnd = null;
  let trialStart = null;
  if (sub.status === 'trialing' && sub.trial_end) {
    isOnTrial = true;
    trialEnd = new Date(sub.trial_end * 1000).toISOString();
    if (sub.trial_start) trialStart = new Date(sub.trial_start * 1000).toISOString();
  }

  // Match the same priority order as the GET /subscription path so the
  // webhook reconciler and the on-demand fetch never disagree on tier.
  const reconcilePrice = sub.items?.data?.[0]?.price;
  let subscriptionTier = reconcilePrice ? resolveTierFromPrice(reconcilePrice) : 'Pro';

  await query(
    `INSERT INTO subscribers (email, stripe_customer_id, subscribed, subscription_tier, subscription_end, is_trial, trial_start, trial_end, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
     ON CONFLICT (email) DO UPDATE SET
       stripe_customer_id = EXCLUDED.stripe_customer_id,
       subscribed = EXCLUDED.subscribed,
       subscription_tier = EXCLUDED.subscription_tier,
       subscription_end = EXCLUDED.subscription_end,
       is_trial = EXCLUDED.is_trial,
       trial_start = EXCLUDED.trial_start,
       trial_end = EXCLUDED.trial_end,
       updated_at = NOW()`,
    [email, customerId, hasActiveSub, subscriptionTier, subscriptionEnd, isOnTrial, trialStart, trialEnd]
  );

  console.log(`[Stripe] reconcile: ${email} → tier=${subscriptionTier} active=${hasActiveSub} trial=${isOnTrial} (picked ${sub.id} from ${live.length} live)`);
}

/**
 * Handle subscription update — delegates to reconcileCustomerSubscriptions
 * so multi-sub customers (e.g. ghost trial + new paid) end up in the
 * correct state regardless of webhook ordering.
 */
async function handleSubscriptionUpdate(subscription) {
  await reconcileCustomerSubscriptions(subscription.customer);
}

/**
 * Handle subscription canceled — same path. Reconciliation will only
 * downgrade if the customer has NO other live subs. Prevents the false-
 * cancel bug where a ghost trial's auto-cancel would knock out a user
 * who had since started a real paid sub.
 */
async function handleSubscriptionCanceled(subscription) {
  await reconcileCustomerSubscriptions(subscription.customer);
}

/**
 * Helper: Handle checkout completed
 */
async function handleCheckoutCompleted(session) {
  const customerId = session.customer;
  const customerEmail = session.customer_email;

  console.log('[Stripe] Checkout completed', { customerId, customerEmail });

  // If we have a user_id in metadata, link the subscription
  if (session.metadata?.user_id) {
    await query(
      `UPDATE subscribers SET user_id = $1 WHERE email = $2 OR stripe_customer_id = $3`,
      [session.metadata.user_id, customerEmail, customerId]
    );
  }
}

/**
 * GET /api/stripe/debug/tier
 *
 * Self-diagnostic — returns the full tier-resolution chain for the logged-in
 * user. Safe for any authenticated user (only returns their own data).
 *
 * Use when a customer reports they have an Elite subscription but the app
 * shows them as Pro / locked / free. Walks every layer and reports where the
 * mismatch is:
 *   - subscribers row (raw)
 *   - active Stripe subscription items + price.metadata + price.lookup_key + unit_amount
 *   - resolved tier per resolveTierFromPrice()
 *   - what `req.subscription.tier` would be after the middleware runs
 *
 * Reveals only the user's own Stripe customer — no other-account leakage.
 */
router.get('/debug/tier', authenticate, requireStripe, asyncHandler(async (req, res) => {
  const userEmail = req.user.email;
  const userId = req.user.id;

  // 1. subscribers row as-stored
  const rowResult = await query(
    `SELECT email, user_id, stripe_customer_id, subscribed, subscription_tier,
            subscription_end, is_trial, trial_start, trial_end, updated_at
     FROM subscribers WHERE user_id = $1 OR email = $2 LIMIT 1`,
    [userId, userEmail]
  );
  const subscriberRow = rowResult.rows[0] || null;

  // 2. Active Stripe subscription chain for this customer
  let stripeChain = null;
  if (subscriberRow?.stripe_customer_id) {
    try {
      const subs = await stripe.subscriptions.list({
        customer: subscriberRow.stripe_customer_id,
        status: 'all',
        limit: 5,
      });
      stripeChain = await Promise.all(
        subs.data.map(async (sub) => {
          const priceId = sub.items?.data?.[0]?.price?.id;
          const price = priceId ? await stripe.prices.retrieve(priceId) : null;
          return {
            id: sub.id,
            status: sub.status,
            current_period_end: sub.current_period_end
              ? new Date(sub.current_period_end * 1000).toISOString()
              : null,
            trial_end: sub.trial_end ? new Date(sub.trial_end * 1000).toISOString() : null,
            cancel_at_period_end: sub.cancel_at_period_end,
            price: price ? {
              id: price.id,
              unit_amount: price.unit_amount,
              currency: price.currency,
              recurring: price.recurring,
              lookup_key: price.lookup_key || null,
              metadata: price.metadata || {},
              nickname: price.nickname || null,
            } : null,
            resolved_tier: price ? resolveTierFromPrice(price) : null,
          };
        })
      );
    } catch (err) {
      stripeChain = { error: err.message };
    }
  }

  // 3. What the subscription middleware would resolve for THIS request
  //    (re-runs the same logic from middleware/subscription.js without firing
  //    the rate-limit count, so the diagnostic is side-effect-free.)
  let middlewareTier = 'none';
  let middlewareReason = 'no subscribers row';
  if (subscriberRow) {
    if (!subscriberRow.subscribed) {
      middlewareReason = `subscribed=false (updated_at ${subscriberRow.updated_at})`;
    } else if (subscriberRow.is_trial) {
      if (subscriberRow.trial_end && new Date(subscriberRow.trial_end) < new Date()) {
        middlewareReason = `trial expired (${subscriberRow.trial_end})`;
      } else {
        const t = (subscriberRow.subscription_tier || '').trim().toLowerCase();
        middlewareTier = t === 'elite' || t === 'premium' ? 'Elite' : t === 'pro' ? 'Pro' : 'trial';
        middlewareReason = `active trial, subscription_tier='${subscriberRow.subscription_tier}' → ${middlewareTier}`;
      }
    } else {
      const t = (subscriberRow.subscription_tier || '').trim().toLowerCase();
      middlewareTier = t === 'elite' || t === 'premium' ? 'Elite' : t === 'pro' ? 'Pro' : 'none';
      middlewareReason = `paid sub, subscription_tier='${subscriberRow.subscription_tier}' → ${middlewareTier}`;
    }
  }

  res.json({
    user: { id: userId, email: userEmail },
    subscriber_row: subscriberRow,
    stripe_subscriptions: stripeChain,
    resolved_tier_from_db: middlewareTier,
    resolution_reason: middlewareReason,
    notes: [
      "If `resolved_tier_from_db` says 'Pro' but a `stripe_subscriptions` entry shows `resolved_tier='Elite'`, the DB is stale — hit POST /api/stripe/sync to reconcile.",
      "If `subscriber_row.subscription_tier` is lowercase or null, that's the bug — Stripe write path should always use 'Elite'/'Pro'.",
      "If `stripe_subscriptions` is empty but `subscriber_row.subscribed=true`, the row is orphaned from Stripe."
    ],
  });
}));

module.exports = router;
