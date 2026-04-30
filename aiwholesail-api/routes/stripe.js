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

  // Find the correct price based on plan type
  let actualPriceId;
  if (priceId === 'Pro') {
    const proPrice = prices.data.find(price =>
      price.unit_amount === 2900 &&
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
    // For logged-in users, check for existing customer
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
      console.log('[Stripe] Found existing customer', { customerId });
    }
  }

  const frontendUrl = process.env.FRONTEND_URL || 'https://aiwholesail.com';

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    customer_email: guestCheckout ? undefined : customerEmail,
    line_items: [
      {
        price: actualPriceId,
        quantity: 1
      }
    ],
    mode: 'subscription',
    payment_method_collection: 'if_required',
    subscription_data: {
      trial_period_days: 7,
      trial_settings: {
        end_behavior: {
          missing_payment_method: 'cancel'
        }
      }
    },
    success_url: `${frontendUrl}/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${frontendUrl}/pricing`,
    custom_text: {
      submit: {
        message: 'Start your 7-day free trial! Get access to AI-powered real estate deal analysis, property scoring, and market intelligence. No charge until trial ends.'
      }
    },
    metadata: {
      company_name: 'AI Wholesail',
      guest_checkout: String(guestCheckout || false),
      user_id: user?.id || ''
    }
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

  // If Stripe is not configured, return DB state only
  if (!stripe) {
    if (dbSub.rows.length > 0) {
      const sub = dbSub.rows[0];
      return res.json({
        subscribed: sub.subscribed,
        subscription_tier: sub.subscription_tier,
        subscription_end: sub.subscription_end,
        is_trial: sub.is_trial,
        trial_start: sub.trial_start,
        trial_end: sub.trial_end,
      });
    }
    return res.json({ subscribed: false });
  }

  const customers = await stripe.customers.list({ email: user.email, limit: 1 });

  if (customers.data.length === 0) {
    // No Stripe customer — return DB trial state if it exists
    if (dbSub.rows.length > 0) {
      const sub = dbSub.rows[0];
      return res.json({
        subscribed: sub.subscribed,
        subscription_tier: sub.subscription_tier,
        subscription_end: sub.subscription_end,
        is_trial: sub.is_trial,
        trial_start: sub.trial_start,
        trial_end: sub.trial_end,
      });
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

      // Determine subscription tier from price
      const priceId = subscription.items.data[0].price.id;
      const price = await stripe.prices.retrieve(priceId);
      const amount = price.unit_amount || 0;

      if (amount >= 9900) {
        subscriptionTier = 'Elite';
      } else if (amount >= 2900) {
        subscriptionTier = 'Pro';
      } else {
        subscriptionTier = 'Pro';
      }

      break;
    }
  }

  // Update database
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
 * Helper: Handle subscription update
 */
async function handleSubscriptionUpdate(subscription) {
  const customerId = subscription.customer;

  // Get customer email
  const customer = await stripe.customers.retrieve(customerId);
  const email = customer.email;

  if (!email) {
    console.error('[Stripe] Customer has no email:', customerId);
    return;
  }

  const hasActiveSub = subscription.status === 'active' || subscription.status === 'trialing';
  const subscriptionEnd = new Date(subscription.current_period_end * 1000).toISOString();

  let isOnTrial = false;
  let trialEnd = null;
  let trialStart = null;

  if (subscription.status === 'trialing' && subscription.trial_end) {
    isOnTrial = true;
    trialEnd = new Date(subscription.trial_end * 1000).toISOString();
    if (subscription.trial_start) {
      trialStart = new Date(subscription.trial_start * 1000).toISOString();
    }
  }

  // Determine tier
  let subscriptionTier = 'Pro';
  if (subscription.items?.data?.[0]?.price?.unit_amount >= 9900) {
    subscriptionTier = 'Elite';
  }

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

  console.log('[Stripe] Updated subscription for:', email);
}

/**
 * Helper: Handle subscription canceled
 */
async function handleSubscriptionCanceled(subscription) {
  const customerId = subscription.customer;
  const customer = await stripe.customers.retrieve(customerId);
  const email = customer.email;

  if (!email) {
    console.error('[Stripe] Customer has no email:', customerId);
    return;
  }

  await query(
    `UPDATE subscribers SET
       subscribed = false,
       subscription_tier = NULL,
       is_trial = false,
       updated_at = NOW()
     WHERE email = $1`,
    [email]
  );

  console.log('[Stripe] Subscription canceled for:', email);
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

module.exports = router;
