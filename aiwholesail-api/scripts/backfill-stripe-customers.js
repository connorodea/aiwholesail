#!/usr/bin/env node
/**
 * Backfill Stripe customers for existing trial users.
 *
 * Why: signup didn't create Stripe customers until the fix that landed
 * alongside this script (routes/auth.js). Trial users who signed up before
 * that fix have a subscribers row with stripe_customer_id = NULL, are
 * invisible in the Stripe dashboard, and get 404s on /api/stripe/portal.
 *
 * This script finds every subscriber whose stripe_customer_id is NULL,
 * either reuses an existing Stripe customer (matched by email) or creates a
 * new one, and writes the id back to the subscribers row.
 *
 * Idempotent: re-running skips rows that already have an id. Safe to run
 * multiple times during/after a partial failure.
 *
 * Usage:
 *   node scripts/backfill-stripe-customers.js --dry-run
 *   node scripts/backfill-stripe-customers.js
 *
 * Flags:
 *   --dry-run     count + sample but do not call Stripe or mutate the DB
 *   --limit=N     cap to first N rows (default: no cap)
 *   --rps=N       requests per second (default: 5; Stripe allows ~100)
 */

require('dotenv').config();
const { Pool } = require('pg');
const Stripe = require('stripe');

const DRY_RUN = process.argv.includes('--dry-run');
const LIMIT = Number((process.argv.find(a => a.startsWith('--limit=')) || '').split('=')[1]) || null;
const RPS = Number((process.argv.find(a => a.startsWith('--rps=')) || '').split('=')[1]) || 5;
const SLEEP_MS = Math.max(50, Math.floor(1000 / RPS));

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY)
  : null;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL not set');
    process.exit(1);
  }
  if (!DRY_RUN && !stripe) {
    console.error('STRIPE_SECRET_KEY not set (only --dry-run can run without it)');
    process.exit(1);
  }

  console.log(`[backfill] mode=${DRY_RUN ? 'DRY-RUN' : 'LIVE'} rps=${RPS} limit=${LIMIT ?? 'none'}`);

  // Find every subscriber row that's missing a stripe_customer_id, joined
  // to users so we can pass a full name + phone to Stripe.
  const { rows } = await pool.query(
    `SELECT s.user_id, s.email, s.is_trial, s.trial_start, s.trial_end,
            s.subscription_tier, s.subscribed,
            u.full_name, p.phone_number
       FROM subscribers s
       LEFT JOIN users u ON u.id = s.user_id
       LEFT JOIN profiles p ON p.user_id = s.user_id
      WHERE s.stripe_customer_id IS NULL
        AND s.user_id IS NOT NULL
      ORDER BY s.trial_start DESC NULLS LAST
      ${LIMIT ? `LIMIT ${LIMIT}` : ''}`
  );

  console.log(`[backfill] found ${rows.length} subscriber rows without stripe_customer_id`);
  if (rows.length === 0) {
    await pool.end();
    return;
  }

  // Sample for the operator
  console.log('[backfill] first 3 rows:');
  for (const r of rows.slice(0, 3)) {
    console.log(`  ${r.email} | trial=${r.is_trial} | tier=${r.subscription_tier} | name=${r.full_name || 'n/a'}`);
  }

  if (DRY_RUN) {
    console.log('[backfill] DRY-RUN — exiting without Stripe or DB writes.');
    await pool.end();
    return;
  }

  let created = 0;
  let reused = 0;
  let failed = 0;

  for (const row of rows) {
    try {
      let stripeCustomerId;

      // Reuse if Stripe already has a customer with this email
      const existing = await stripe.customers.list({ email: row.email, limit: 1 });
      if (existing.data.length > 0) {
        stripeCustomerId = existing.data[0].id;
        // Patch metadata to link our user_id
        await stripe.customers.update(stripeCustomerId, {
          name: row.full_name || existing.data[0].name || undefined,
          phone: row.phone_number || existing.data[0].phone || undefined,
          metadata: {
            ...(existing.data[0].metadata || {}),
            user_id: row.user_id,
            source: 'backfill',
            backfilled_at: new Date().toISOString(),
          },
        });
        reused++;
      } else {
        const cust = await stripe.customers.create({
          email: row.email,
          name: row.full_name || undefined,
          phone: row.phone_number || undefined,
          metadata: {
            user_id: row.user_id,
            source: 'backfill',
            backfilled_at: new Date().toISOString(),
            trial_started_at: row.trial_start?.toISOString?.() || '',
            trial_ends_at: row.trial_end?.toISOString?.() || '',
            subscription_tier: row.subscription_tier || '',
            is_trial: String(row.is_trial),
          },
        });
        stripeCustomerId = cust.id;
        created++;
      }

      await pool.query(
        'UPDATE subscribers SET stripe_customer_id = $1, updated_at = NOW() WHERE user_id = $2',
        [stripeCustomerId, row.user_id]
      );

      const total = created + reused + failed;
      if (total % 10 === 0) {
        console.log(`[backfill] progress ${total}/${rows.length} (created=${created} reused=${reused} failed=${failed})`);
      }
    } catch (err) {
      failed++;
      console.error(`[backfill] FAILED for ${row.email}: ${err.message}`);
    }
    await sleep(SLEEP_MS);
  }

  console.log(`[backfill] done. created=${created} reused=${reused} failed=${failed} total_seen=${rows.length}`);
  await pool.end();
}

main().catch((err) => {
  console.error('[backfill] fatal:', err);
  process.exit(1);
});
