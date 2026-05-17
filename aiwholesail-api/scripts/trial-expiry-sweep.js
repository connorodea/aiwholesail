#!/usr/bin/env node
/**
 * Trial Expiry Sweep
 *
 * Runs hourly via systemd timer. Finds subscribers whose trial_end has
 * passed but are still flagged as active trials (subscribed=true,
 * is_trial=true) in our DB, and flips them to (subscribed=false,
 * is_trial=false) so the app's downstream gates (subscription middleware,
 * TrialExpiredModal) recognize them as expired.
 *
 * Why this is needed:
 *   The subscription middleware (middleware/subscription.js) already
 *   downgrades expired trials — but only when the user hits an
 *   authenticated route. Users who abandon the product never trigger it,
 *   so their rows stay subscribed=true forever. That:
 *     - breaks the trial-lifecycle worker's day_plus_1/day_plus_7
 *       cohorts (which key off subscribed/is_trial flags),
 *     - hides expired trials from analytics rollups,
 *     - means subscriber-health-audit reports them as "wipe_imminent"
 *       indefinitely.
 *
 * Before flipping, we double-check Stripe: if the customer has an
 * `active` or `trialing` subscription, they paid (or are mid-paid-trial)
 * and the local row is the one that's wrong — log it but don't downgrade.
 * The reconcile path in routes/stripe.js will catch up on the next webhook.
 *
 * Usage:
 *   node scripts/trial-expiry-sweep.js           # Live run
 *   node scripts/trial-expiry-sweep.js --dry-run # Preview
 */

require('dotenv').config();
const { Pool } = require('pg');
const Stripe = require('stripe');
const { decide } = require('./lib/trialExpiryDecision');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2023-10-16' })
  : null;

const DRY_RUN = process.argv.includes('--dry-run');

async function findExpiredTrials() {
  // is_trial MUST be in the SELECT — decide() inspects it. Filtering on it
  // in WHERE only narrows the result set; the column still needs to be
  // returned for the decision helper to see it. A prior version selected
  // only the filter-by columns; decide() saw row.is_trial===undefined and
  // returned `keep_not_trial` for every row, so the sweep never downgraded
  // anyone.
  const r = await pool.query(`
    SELECT id, user_id, email, stripe_customer_id, trial_end, is_trial, subscription_tier
    FROM subscribers
    WHERE is_trial = true
      AND trial_end IS NOT NULL
      AND trial_end < NOW()
    ORDER BY trial_end ASC
  `);
  return r.rows;
}

async function fetchStripeSubs(stripeCustomerId) {
  if (!stripe || !stripeCustomerId) return { ok: true, subs: [] };
  try {
    const r = await stripe.subscriptions.list({
      customer: stripeCustomerId,
      status: 'all',
      limit: 10,
    });
    return { ok: true, subs: r.data };
  } catch (err) {
    // If Stripe lookup fails, fail SAFE — don't downgrade. We'd rather leave
    // a stale flag on the row for one more hour than wrongly cut off a
    // paying customer because of a transient Stripe outage.
    console.error(`  [stripe-check-failed] ${stripeCustomerId}: ${err.message}`);
    return { ok: false, subs: [] };
  }
}

async function downgrade(subscriberId) {
  if (DRY_RUN) return;
  await pool.query(
    `UPDATE subscribers
       SET subscribed = false,
           is_trial = false,
           updated_at = NOW()
     WHERE id = $1`,
    [subscriberId]
  );
}

async function run() {
  console.log(`=== Trial Expiry Sweep started at ${new Date().toISOString()} ===`);
  if (DRY_RUN) console.log('*** DRY RUN MODE — no rows will be updated ***\n');
  if (!stripe) console.log('*** STRIPE_SECRET_KEY not set — skipping Stripe paying-customer check ***\n');

  const expired = await findExpiredTrials();
  console.log(`Found ${expired.length} expired trial(s) still flagged active`);

  const stats = { evaluated: 0, downgraded: 0, paying: 0, stripe_lookup_failed: 0, errors: 0 };

  for (const row of expired) {
    stats.evaluated += 1;
    try {
      const { ok, subs } = await fetchStripeSubs(row.stripe_customer_id);
      if (!ok) {
        stats.stripe_lookup_failed += 1;
        // Skip — fail-safe: don't downgrade if we can't verify with Stripe
        continue;
      }
      const { action } = decide({ row, stripeSubs: subs });
      if (action === 'keep_paying') {
        stats.paying += 1;
        console.log(`  [keep] ${row.email} (sub ${row.id}) — Stripe shows active/trialing sub; reconcile webhook will catch up`);
        continue;
      }
      if (action === 'downgrade') {
        await downgrade(row.id);
        stats.downgraded += 1;
        console.log(`  [downgrade] ${row.email} (sub ${row.id}) — trial_end ${row.trial_end.toISOString()}, tier was ${row.subscription_tier}`);
      }
    } catch (err) {
      stats.errors += 1;
      console.error(`  [error] ${row.email}: ${err.message}`);
    }
  }

  console.log(`\n=== Sweep complete ===`);
  console.log(JSON.stringify(stats));

  await pool.end();
}

run().catch(err => {
  console.error('Sweep crashed:', err);
  process.exit(1);
});
