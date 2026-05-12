#!/usr/bin/env node
/**
 * AIWholesail Subscriber Health Audit
 *
 * Daily cron. Cross-references the `subscribers` table against live
 * Stripe subscription state and surfaces any anomalies that indicate
 * a wipe-regression — i.e. a return of the bugs fixed in PR #192,
 * #193, #194.
 *
 * Classification per DB row:
 *   - wipe_already: subscribed=false in DB BUT Stripe has an active or
 *       trialing sub for that customer. The user is locked out of a
 *       paid feature they paid for. Highest-severity alert.
 *   - wipe_imminent: subscribed=true in DB, Stripe has 0 live subs,
 *       AND local state (trial_end, subscription_end) is expired or
 *       missing. Without the preservation patches landed in #192/3/4
 *       this row would be wiped on the next webhook / page load.
 *       Medium-severity — points at a new wipe surface we missed.
 *   - db_only_grant: subscribed=true, Stripe 0 live subs, but local
 *       trial_end OR subscription_end > now. Expected state for
 *       in-app trials + manual Elite grants. Logged, not alerted.
 *   - healthy: DB and Stripe agree, or DB unsubscribed + Stripe also
 *       has no live sub.
 *
 * Always emits one JSON line on stdout (machine-readable). Sends an
 * email via Resend when:
 *   - any anomaly count > 0
 *   - run is the daily green-ping window (09:00 UTC ± 30 min)
 *   - --force-email is passed
 *
 * Usage:
 *   node scripts/subscriber-health-audit.js              # normal run
 *   node scripts/subscriber-health-audit.js --dry-run    # skip email
 *   node scripts/subscriber-health-audit.js --force-email
 */

require('dotenv').config();
const { Pool } = require('pg');
const Stripe = require('stripe');
const { Resend } = require('resend');

const DRY_RUN = process.argv.includes('--dry-run');
const FORCE_EMAIL = process.argv.includes('--force-email');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY)
  : null;
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

const OPERATOR_EMAIL = process.env.OPERATOR_EMAIL || 'cpodea5@gmail.com';
const FROM_EMAIL = process.env.HEALTH_FROM_EMAIL || 'AIWholesail Health <ops@aiwholesail.com>';

async function main() {
  if (!stripe) {
    console.error(JSON.stringify({ ts: new Date().toISOString(), fatal: 'STRIPE_SECRET_KEY not set' }));
    process.exit(2);
  }

  const { rows } = await pool.query(
    `SELECT email, user_id, stripe_customer_id, subscribed, subscription_tier,
            is_trial, trial_end, subscription_end, updated_at
       FROM subscribers`
  );

  // Map customer_id -> [subs]
  const subsByCustomer = {};
  for await (const s of stripe.subscriptions.list({ status: 'all', limit: 100 })) {
    (subsByCustomer[s.customer] ||= []).push(s);
  }

  const anomalies = {
    wipe_already: [],
    wipe_imminent: [],
    db_only_grant: 0,
    healthy: 0,
    no_stripe_customer: 0,
  };
  const now = new Date();

  for (const r of rows) {
    if (!r.stripe_customer_id) {
      anomalies.no_stripe_customer++;
      continue;
    }
    const subs = subsByCustomer[r.stripe_customer_id] || [];
    const liveSubs = subs.filter(s => s.status === 'active' || s.status === 'trialing');
    const trialStillActive = !!(r.is_trial && r.trial_end && new Date(r.trial_end) > now);
    const subStillActive = !!(r.subscription_end && new Date(r.subscription_end) > now);

    if (r.subscribed && liveSubs.length === 0) {
      if (trialStillActive || subStillActive) {
        anomalies.db_only_grant++;
      } else {
        anomalies.wipe_imminent.push({
          email: r.email,
          tier: r.subscription_tier,
          trial_end: r.trial_end,
          subscription_end: r.subscription_end,
          updated_at: r.updated_at,
        });
      }
    } else if (!r.subscribed && liveSubs.length > 0) {
      anomalies.wipe_already.push({
        email: r.email,
        db_tier: r.subscription_tier,
        stripe_sub_id: liveSubs[0].id,
        stripe_status: liveSubs[0].status,
        stripe_unit_amount: liveSubs[0].items?.data?.[0]?.price?.unit_amount,
      });
    } else {
      anomalies.healthy++;
    }
  }

  const alertCount = anomalies.wipe_already.length + anomalies.wipe_imminent.length;
  const summary = {
    ts: new Date().toISOString(),
    total_rows: rows.length,
    healthy: anomalies.healthy,
    db_only_grants: anomalies.db_only_grant,
    no_stripe_customer: anomalies.no_stripe_customer,
    wipe_imminent: anomalies.wipe_imminent.length,
    wipe_already: anomalies.wipe_already.length,
    alert_count: alertCount,
  };
  console.log(JSON.stringify(summary));

  const utcHour = new Date().getUTCHours();
  const isGreenPing = utcHour === 9; // matches health-monitor cadence
  const shouldEmail = !DRY_RUN && resend && (FORCE_EMAIL || alertCount > 0 || isGreenPing);

  if (shouldEmail) {
    const subject = alertCount > 0
      ? `[AIW][ALERT] Subscriber health: ${alertCount} anomalies (${anomalies.wipe_already.length} wiped, ${anomalies.wipe_imminent.length} at-risk)`
      : `[AIW] Subscriber health OK (${rows.length} rows, ${anomalies.healthy} healthy, ${anomalies.db_only_grant} grants)`;

    const html = renderEmail({ summary, anomalies });
    try {
      await resend.emails.send({ from: FROM_EMAIL, to: OPERATOR_EMAIL, subject, html });
      console.log(JSON.stringify({ ts: new Date().toISOString(), email_sent: OPERATOR_EMAIL, subject }));
    } catch (e) {
      console.error(JSON.stringify({ ts: new Date().toISOString(), email_error: e.message }));
      // Don't exit non-zero just on email failure — the JSON log line above is still useful.
    }
  }

  await pool.end();
  // Exit 0 even with alerts — alert delivery is the email; non-zero would
  // trigger systemd OnFailure paging which is overkill for a data drift.
  process.exit(0);
}

function renderEmail({ summary, anomalies }) {
  const row = (k, v, hl) => `<tr><td style="padding:6px 12px;border-bottom:1px solid #eee">${k}</td><td style="padding:6px 12px;border-bottom:1px solid #eee;font-weight:${hl ? 700 : 400};color:${hl ? '#c92a2a' : '#222'}">${v}</td></tr>`;
  const list = (items) => items.length === 0
    ? '<p style="color:#888">(none)</p>'
    : '<table style="border-collapse:collapse;width:100%;font-family:ui-monospace,Menlo,monospace;font-size:12px"><thead><tr style="background:#f5f5f5"><th style="text-align:left;padding:6px 12px">email</th><th style="text-align:left;padding:6px 12px">detail</th></tr></thead><tbody>'
      + items.map(a => `<tr><td style="padding:6px 12px;border-bottom:1px solid #eee">${esc(a.email)}</td><td style="padding:6px 12px;border-bottom:1px solid #eee">${esc(JSON.stringify(a))}</td></tr>`).join('')
      + '</tbody></table>';

  return `
<!doctype html><html><body style="font-family:system-ui,-apple-system,sans-serif;color:#222;max-width:720px;margin:0 auto;padding:24px">
<h2 style="margin:0 0 16px 0">Subscriber Health Audit — ${summary.ts}</h2>
<table style="border-collapse:collapse;width:100%;margin-bottom:24px">
  <tbody>
    ${row('Total subscriber rows', summary.total_rows)}
    ${row('Healthy', summary.healthy)}
    ${row('DB-only grants (expected, preserved)', summary.db_only_grants)}
    ${row('No stripe_customer_id', summary.no_stripe_customer)}
    ${row('Wipe imminent (would be wiped without #192/3/4)', summary.wipe_imminent, summary.wipe_imminent > 0)}
    ${row('Wipe already (user locked out of paid feature)', summary.wipe_already, summary.wipe_already > 0)}
  </tbody>
</table>
<h3 style="margin:24px 0 8px 0;color:#c92a2a">Wiped (high severity)</h3>
${list(anomalies.wipe_already)}
<h3 style="margin:24px 0 8px 0;color:#e67700">At-risk of wipe (medium severity)</h3>
${list(anomalies.wipe_imminent)}
<p style="color:#888;font-size:12px;margin-top:32px">Source: aiwholesail-api/scripts/subscriber-health-audit.js</p>
</body></html>`;
}

function esc(s) {
  return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

main().catch(err => {
  console.error(JSON.stringify({ ts: new Date().toISOString(), fatal: err.message, stack: err.stack }));
  process.exit(2);
});
