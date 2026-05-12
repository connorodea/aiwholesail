#!/usr/bin/env node
/**
 * AIWholesail Funnel Metrics Cron
 *
 * Daily 09:30 UTC. Pulls the conversion-funnel SLIs documented in
 * docs/OBSERVABILITY.md, rolls them up into one digest, and emails the
 * operator. Catches business-level regressions ("nobody is converting")
 * within 24h, vs the weeks it took to surface the wipe-vector bugs.
 *
 * Sources:
 *   - DB: users, subscribers, leads, favorites, rate_limits, property_alerts,
 *         alert_job_runs, alert_sent_deals, property_alert_matches,
 *         trial_lifecycle_emails_sent
 *   - Stripe REST: customers, subscriptions, events, invoices
 *   - Resend REST: emails list with last_event (delivered/opened/clicked)
 *
 * Output:
 *   - One JSON summary line to stdout (machine-readable for jq / future
 *     dashboard ingestion)
 *   - One HTML digest to OPERATOR_EMAIL via Resend
 *
 * Usage:
 *   node scripts/funnel-metrics.js              # normal daily run
 *   node scripts/funnel-metrics.js --dry-run    # skip email
 *   node scripts/funnel-metrics.js --force-email
 */

require('dotenv').config();
const { Pool } = require('pg');
const Stripe = require('stripe');
const { Resend } = require('resend');
const axios = require('axios');

const DRY_RUN = process.argv.includes('--dry-run');
const FORCE_EMAIL = process.argv.includes('--force-email');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null;
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

const OPERATOR_EMAIL = process.env.OPERATOR_EMAIL || 'cpodea5@gmail.com';
const FROM_EMAIL = process.env.HEALTH_FROM_EMAIL || 'AIWholesail Health <ops@aiwholesail.com>';

// SLO targets from docs/OBSERVABILITY.md. Any SLI breaching its target
// gets the row red-flagged in the email and counts toward `alerts`.
const SLO = {
  welcome_email_delivery_rate: 0.99,
  welcome_email_open_rate: 0.30,
  first_action_rate: 0.50,
  trial_to_checkout_rate: 0.30,
  checkout_to_paid_rate: 0.50,
  worker_success_rate: 0.95,
  alert_email_delivery_rate: 0.99,
  alert_email_open_rate: 0.25,
};

async function main() {
  if (!stripe) {
    console.error(JSON.stringify({ ts: new Date().toISOString(), fatal: 'STRIPE_SECRET_KEY not set' }));
    process.exit(2);
  }

  // --- Signup → Activation (30d) ---
  const signups30d = (await pool.query(
    `SELECT COUNT(*)::int AS n FROM users WHERE created_at > NOW() - INTERVAL '30 days'`
  )).rows[0].n;

  const verifiedRate = (await pool.query(
    `SELECT
       COUNT(*) FILTER (WHERE email_verified = true)::int AS verified,
       COUNT(*)::int AS total
     FROM users WHERE created_at > NOW() - INTERVAL '30 days'`
  )).rows[0];

  const firstActionCohort = (await pool.query(
    `WITH cohort AS (
       SELECT id FROM users
       WHERE created_at BETWEEN NOW() - INTERVAL '37 days' AND NOW() - INTERVAL '7 days'
     )
     SELECT
       (SELECT COUNT(*) FROM cohort)::int AS total,
       (SELECT COUNT(DISTINCT c.id) FROM cohort c
         WHERE EXISTS (SELECT 1 FROM leads WHERE user_id = c.id)
            OR EXISTS (SELECT 1 FROM favorites WHERE user_id = c.id)
            OR EXISTS (SELECT 1 FROM property_alerts WHERE user_id = c.id)
            OR EXISTS (SELECT 1 FROM rate_limits WHERE identifier = c.id::text))::int AS did_action`
  )).rows[0];

  // --- Trial / Subscription state ---
  const subState = (await pool.query(
    `SELECT
       COUNT(*) FILTER (WHERE is_trial = true AND subscribed = true)::int AS active_trials,
       COUNT(*) FILTER (WHERE is_trial = false AND subscribed = true)::int AS paid_subs,
       COUNT(*) FILTER (WHERE subscribed = true AND trial_end < NOW() AND is_trial = true)::int AS expired_unconverted,
       COUNT(*)::int AS total
     FROM subscribers`
  )).rows[0];

  // --- Stripe events (last 30d) ---
  const thirtyDaysAgo = Math.floor((Date.now() - 30*86400e3) / 1000);
  const eventCounts = { 'checkout.session.completed': 0, 'customer.subscription.created': 0, 'invoice.payment_succeeded': 0, 'invoice.payment_failed': 0, 'customer.subscription.deleted': 0 };
  for await (const ev of stripe.events.list({ limit: 100, created: { gte: thirtyDaysAgo } })) {
    if (eventCounts[ev.type] !== undefined) eventCounts[ev.type]++;
  }

  // Active paid subs on Stripe right now (source of truth for `paid_subs`)
  let stripeActivePaid = 0, stripeTrialing = 0;
  for await (const s of stripe.subscriptions.list({ status: 'all', limit: 100 })) {
    if (s.status === 'active') stripeActivePaid++;
    if (s.status === 'trialing') stripeTrialing++;
  }

  // --- Worker / Alerts (last 24h) ---
  const workerStats = (await pool.query(
    `SELECT
       COUNT(*)::int AS total_runs,
       COUNT(*) FILTER (WHERE status = 'completed')::int AS clean_runs,
       SUM(alerts_sent)::int AS alerts_sent,
       SUM(deals_found)::int AS deals_found
     FROM alert_job_runs
     WHERE started_at > NOW() - INTERVAL '24 hours'`
  )).rows[0];

  // --- Resend deliverability (last 100 emails, classify by subject) ---
  let resendStats = { delivered: 0, opened: 0, clicked: 0, bounced: 0, complained: 0, total: 0,
                      welcomes: { delivered: 0, opened: 0, clicked: 0, total: 0 },
                      alerts:   { delivered: 0, opened: 0, clicked: 0, total: 0 } };
  if (process.env.RESEND_API_KEY) {
    try {
      const r = await axios.get('https://api.resend.com/emails', {
        headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}` },
        params: { limit: 100 }, timeout: 15000,
      });
      const emails = r.data?.data || [];
      resendStats.total = emails.length;
      for (const e of emails) {
        const ev = e.last_event;
        if (ev === 'delivered') resendStats.delivered++;
        if (ev === 'opened') { resendStats.delivered++; resendStats.opened++; }
        if (ev === 'clicked') { resendStats.delivered++; resendStats.opened++; resendStats.clicked++; }
        if (ev === 'bounced') resendStats.bounced++;
        if (ev === 'complained') resendStats.complained++;

        const subj = (e.subject || '').toLowerCase();
        const isWelcome = /welcome|7-day pro trial/.test(subj);
        const isAlert = /new deal/.test(subj);
        if (isWelcome || isAlert) {
          const bucket = isWelcome ? resendStats.welcomes : resendStats.alerts;
          bucket.total++;
          if (ev === 'delivered' || ev === 'opened' || ev === 'clicked') bucket.delivered++;
          if (ev === 'opened' || ev === 'clicked') bucket.opened++;
          if (ev === 'clicked') bucket.clicked++;
        }
      }
    } catch (e) {
      console.error(JSON.stringify({ ts: new Date().toISOString(), resend_error: e.message }));
    }
  }

  // --- Lifecycle email coverage ---
  const lifecycle = (await pool.query(
    `SELECT email_type, COUNT(*)::int AS sent FROM trial_lifecycle_emails_sent GROUP BY email_type ORDER BY sent DESC`
  )).rows.reduce((acc, r) => { acc[r.email_type] = r.sent; return acc; }, {});

  // --- Compute SLI ratios + SLO breach flags ---
  const pct = (num, den) => den > 0 ? num / den : null;
  const verifiedPct = pct(verifiedRate.verified, verifiedRate.total);
  const firstActionPct = pct(firstActionCohort.did_action, firstActionCohort.total);
  const workerSuccessRate = pct(workerStats.clean_runs, workerStats.total_runs);
  const welcomeDelivery = pct(resendStats.welcomes.delivered, resendStats.welcomes.total);
  const welcomeOpen = pct(resendStats.welcomes.opened, resendStats.welcomes.delivered);
  const alertDelivery = pct(resendStats.alerts.delivered, resendStats.alerts.total);
  const alertOpen = pct(resendStats.alerts.opened, resendStats.alerts.delivered);

  const breaches = [];
  if (welcomeDelivery !== null && welcomeDelivery < SLO.welcome_email_delivery_rate) breaches.push(`welcome email delivery ${pctStr(welcomeDelivery)} < ${pctStr(SLO.welcome_email_delivery_rate)}`);
  if (welcomeOpen !== null && resendStats.welcomes.total >= 10 && welcomeOpen < SLO.welcome_email_open_rate) breaches.push(`welcome email open ${pctStr(welcomeOpen)} < ${pctStr(SLO.welcome_email_open_rate)}`);
  if (firstActionPct !== null && firstActionPct < SLO.first_action_rate) breaches.push(`first-action rate ${pctStr(firstActionPct)} < ${pctStr(SLO.first_action_rate)}`);
  if (workerSuccessRate !== null && workerSuccessRate < SLO.worker_success_rate) breaches.push(`worker success ${pctStr(workerSuccessRate)} < ${pctStr(SLO.worker_success_rate)}`);
  if (alertDelivery !== null && alertDelivery < SLO.alert_email_delivery_rate) breaches.push(`alert email delivery ${pctStr(alertDelivery)} < ${pctStr(SLO.alert_email_delivery_rate)}`);
  if (alertOpen !== null && resendStats.alerts.total >= 10 && alertOpen < SLO.alert_email_open_rate) breaches.push(`alert email open ${pctStr(alertOpen)} < ${pctStr(SLO.alert_email_open_rate)}`);
  if (signups30d >= 30 && stripeActivePaid === 0) breaches.push('CRITICAL: 30+ signups, 0 active paid subs');

  const summary = {
    ts: new Date().toISOString(),
    signups_30d: signups30d,
    verified_30d: `${verifiedRate.verified}/${verifiedRate.total}` + (verifiedPct !== null ? ` (${pctStr(verifiedPct)})` : ''),
    first_action_rate: firstActionPct !== null ? `${firstActionCohort.did_action}/${firstActionCohort.total} (${pctStr(firstActionPct)})` : 'n/a',
    subscriptions: subState,
    stripe_now: { active_paid: stripeActivePaid, trialing: stripeTrialing },
    stripe_events_30d: eventCounts,
    worker_24h: { ...workerStats, success_rate: pctStr(workerSuccessRate) },
    welcome_emails: { ...resendStats.welcomes, delivery: pctStr(welcomeDelivery), open: pctStr(welcomeOpen) },
    alert_emails:   { ...resendStats.alerts,   delivery: pctStr(alertDelivery),   open: pctStr(alertOpen) },
    lifecycle_sent: lifecycle,
    breaches,
    alerts: breaches.length,
  };
  console.log(JSON.stringify(summary));

  // --- Email digest ---
  const utcHour = new Date().getUTCHours();
  const isGreenPing = utcHour === 9;
  const shouldEmail = !DRY_RUN && resend && (FORCE_EMAIL || breaches.length > 0 || isGreenPing);

  if (shouldEmail) {
    const subject = breaches.length > 0
      ? `[AIW][SLO BREACH] Funnel digest: ${breaches.length} SLI${breaches.length > 1 ? 's' : ''} below target`
      : `[AIW] Funnel digest — ${signups30d} signups 30d, ${stripeActivePaid} paid, ${stripeTrialing} trialing`;

    try {
      await resend.emails.send({ from: FROM_EMAIL, to: OPERATOR_EMAIL, subject, html: renderHtml(summary) });
      console.log(JSON.stringify({ ts: new Date().toISOString(), email_sent: OPERATOR_EMAIL, subject }));
    } catch (e) {
      console.error(JSON.stringify({ ts: new Date().toISOString(), email_error: e.message }));
    }
  }

  await pool.end();
  process.exit(0);
}

function pctStr(p) { return p === null ? 'n/a' : `${(p * 100).toFixed(1)}%`; }
function esc(s) { return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

function renderHtml(s) {
  const breachBlock = s.breaches.length === 0
    ? '<p style="color:#22c55e;margin:0 0 16px 0">All tracked SLIs within target.</p>'
    : '<div style="background:#fef3c7;border-left:4px solid #f59e0b;padding:12px 16px;margin:0 0 20px 0;border-radius:0 6px 6px 0;"><strong style="color:#92400e">SLO breaches:</strong><ul style="margin:6px 0 0 0;padding-left:20px;color:#92400e">' + s.breaches.map(b => `<li>${esc(b)}</li>`).join('') + '</ul></div>';

  const row = (k, v) => `<tr><td style="padding:6px 12px;border-bottom:1px solid #eee;color:#555">${esc(k)}</td><td style="padding:6px 12px;border-bottom:1px solid #eee;font-weight:600;color:#111;text-align:right;font-variant-numeric:tabular-nums">${esc(typeof v === 'object' ? JSON.stringify(v) : String(v))}</td></tr>`;

  return `
<!doctype html><html><body style="font-family:system-ui,-apple-system,sans-serif;color:#222;max-width:760px;margin:0 auto;padding:24px;background:#f9fafb">
<h2 style="margin:0 0 4px 0;color:#111">Funnel Metrics — ${s.ts.slice(0, 10)}</h2>
<p style="color:#666;margin:0 0 20px 0;font-size:13px">SLO targets per docs/OBSERVABILITY.md</p>
${breachBlock}

<h3 style="margin:24px 0 8px 0;color:#111;font-size:15px">Signup → Activation</h3>
<table style="border-collapse:collapse;width:100%;background:#fff;border:1px solid #eee;border-radius:6px;overflow:hidden">
${row('Signups (last 30d)', s.signups_30d)}
${row('Email verified (30d)', s.verified_30d)}
${row('First in-app action (7-37d cohort)', s.first_action_rate)}
</table>

<h3 style="margin:24px 0 8px 0;color:#111;font-size:15px">Subscription State</h3>
<table style="border-collapse:collapse;width:100%;background:#fff;border:1px solid #eee;border-radius:6px;overflow:hidden">
${row('Active trials (DB)', s.subscriptions.active_trials)}
${row('Paid subs (DB)', s.subscriptions.paid_subs)}
${row('Expired but unconverted', s.subscriptions.expired_unconverted)}
${row('Active paid (Stripe)', s.stripe_now.active_paid)}
${row('Trialing (Stripe)', s.stripe_now.trialing)}
</table>

<h3 style="margin:24px 0 8px 0;color:#111;font-size:15px">Stripe Events (last 30d)</h3>
<table style="border-collapse:collapse;width:100%;background:#fff;border:1px solid #eee;border-radius:6px;overflow:hidden">
${Object.entries(s.stripe_events_30d).map(([k, v]) => row(k, v)).join('')}
</table>

<h3 style="margin:24px 0 8px 0;color:#111;font-size:15px">Alert Worker (last 24h)</h3>
<table style="border-collapse:collapse;width:100%;background:#fff;border:1px solid #eee;border-radius:6px;overflow:hidden">
${row('Runs', s.worker_24h.total_runs)}
${row('Clean (no errors)', s.worker_24h.clean_runs)}
${row('Success rate', s.worker_24h.success_rate)}
${row('Deals found', s.worker_24h.deals_found || 0)}
${row('Alerts sent', s.worker_24h.alerts_sent || 0)}
</table>

<h3 style="margin:24px 0 8px 0;color:#111;font-size:15px">Welcome Emails (last 100 Resend events)</h3>
<table style="border-collapse:collapse;width:100%;background:#fff;border:1px solid #eee;border-radius:6px;overflow:hidden">
${row('Sent', s.welcome_emails.total)}
${row('Delivered', s.welcome_emails.delivered)}
${row('Opened', s.welcome_emails.opened)}
${row('Clicked', s.welcome_emails.clicked)}
${row('Open rate', s.welcome_emails.open)}
</table>

<h3 style="margin:24px 0 8px 0;color:#111;font-size:15px">Alert Emails</h3>
<table style="border-collapse:collapse;width:100%;background:#fff;border:1px solid #eee;border-radius:6px;overflow:hidden">
${row('Sent', s.alert_emails.total)}
${row('Delivered', s.alert_emails.delivered)}
${row('Opened', s.alert_emails.opened)}
${row('Clicked', s.alert_emails.clicked)}
${row('Open rate', s.alert_emails.open)}
</table>

<h3 style="margin:24px 0 8px 0;color:#111;font-size:15px">Lifecycle Emails (lifetime)</h3>
<table style="border-collapse:collapse;width:100%;background:#fff;border:1px solid #eee;border-radius:6px;overflow:hidden">
${Object.entries(s.lifecycle_sent).map(([k, v]) => row(k, v)).join('')}
</table>

<p style="color:#888;font-size:12px;margin-top:32px">Source: aiwholesail-api/scripts/funnel-metrics.js · See docs/OBSERVABILITY.md for SLO definitions.</p>
</body></html>`;
}

main().catch(err => {
  console.error(JSON.stringify({ ts: new Date().toISOString(), fatal: err.message, stack: err.stack }));
  process.exit(2);
});
