#!/usr/bin/env node
/**
 * AIWholesail Funnel Metrics Cron — daily 09:30 UTC.
 *
 * Pulls the SLI rollup from lib/funnel-stats.js (shared with the live
 * dashboard at exec.aiwholesail.com), flags SLO breaches, emails the
 * operator. Single source of truth = the shared lib.
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
const { computeFunnelStats } = require('../lib/funnel-stats');

const DRY_RUN = process.argv.includes('--dry-run');
const FORCE_EMAIL = process.argv.includes('--force-email');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null;
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

const OPERATOR_EMAIL = process.env.OPERATOR_EMAIL || 'cpodea5@gmail.com';
const FROM_EMAIL = process.env.HEALTH_FROM_EMAIL || 'AIWholesail Health <ops@aiwholesail.com>';

async function main() {
  if (!stripe) {
    console.error(JSON.stringify({ ts: new Date().toISOString(), fatal: 'STRIPE_SECRET_KEY not set' }));
    process.exit(2);
  }

  const s = await computeFunnelStats({ pool, stripe, resendApiKey: process.env.RESEND_API_KEY });

  // One-line JSON for journald + jq + future dashboard ingestion.
  console.log(JSON.stringify({
    ts: s.ts,
    signups_30d: s.signups_30d,
    verified_pct: s.verified_30d.pct_str,
    first_action_pct: s.first_action.pct_str,
    paid_subs: s.stripe_now.active_paid,
    trialing: s.stripe_now.trialing,
    worker_success_24h: s.worker_24h.success_rate_str,
    welcome_open: s.welcome_emails.open_str,
    alert_open: s.alert_emails.open_str,
    alerts: s.alerts,
    breaches: s.breaches,
  }));

  const utcHour = new Date().getUTCHours();
  const isGreenPing = utcHour === 9;
  const shouldEmail = !DRY_RUN && resend && (FORCE_EMAIL || s.breaches.length > 0 || isGreenPing);

  if (shouldEmail) {
    const subject = s.breaches.length > 0
      ? `[AIW][SLO BREACH] Funnel digest: ${s.breaches.length} SLI${s.breaches.length > 1 ? 's' : ''} below target`
      : `[AIW] Funnel digest — ${s.signups_30d} signups 30d, ${s.stripe_now.active_paid} paid, ${s.stripe_now.trialing} trialing`;
    try {
      await resend.emails.send({ from: FROM_EMAIL, to: OPERATOR_EMAIL, subject, html: renderHtml(s) });
      console.log(JSON.stringify({ ts: new Date().toISOString(), email_sent: OPERATOR_EMAIL, subject }));
    } catch (e) {
      console.error(JSON.stringify({ ts: new Date().toISOString(), email_error: e.message }));
    }
  }

  await pool.end();
  process.exit(0);
}

function esc(v) { return String(v).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
function row(k, v) { return `<tr><td style="padding:6px 12px;border-bottom:1px solid #eee;color:#555">${esc(k)}</td><td style="padding:6px 12px;border-bottom:1px solid #eee;font-weight:600;color:#111;text-align:right;font-variant-numeric:tabular-nums">${esc(v)}</td></tr>`; }

function renderHtml(s) {
  const breachBlock = s.breaches.length === 0
    ? '<p style="color:#22c55e;margin:0 0 16px 0">All tracked SLIs within target.</p>'
    : '<div style="background:#fef3c7;border-left:4px solid #f59e0b;padding:12px 16px;margin:0 0 20px 0;border-radius:0 6px 6px 0;"><strong style="color:#92400e">SLO breaches:</strong><ul style="margin:6px 0 0 0;padding-left:20px;color:#92400e">' + s.breaches.map(b => `<li>${esc(b)}</li>`).join('') + '</ul></div>';

  return `
<!doctype html><html><body style="font-family:system-ui,-apple-system,sans-serif;color:#222;max-width:760px;margin:0 auto;padding:24px;background:#f9fafb">
<h2 style="margin:0 0 4px 0;color:#111">Funnel Metrics — ${s.ts.slice(0, 10)}</h2>
<p style="color:#666;margin:0 0 20px 0;font-size:13px">SLO targets per docs/OBSERVABILITY.md · Live dashboard: <a href="https://exec.aiwholesail.com" style="color:#06b6d4">exec.aiwholesail.com</a></p>
${breachBlock}

<h3 style="margin:24px 0 8px 0;color:#111;font-size:15px">Signup → Activation</h3>
<table style="border-collapse:collapse;width:100%;background:#fff;border:1px solid #eee;border-radius:6px;overflow:hidden">
${row('Signups (last 30d)', s.signups_30d)}
${row('Email verified (30d)', `${s.verified_30d.verified}/${s.verified_30d.total} (${s.verified_30d.pct_str})`)}
${row('First in-app action (7-37d cohort)', `${s.first_action.did_action}/${s.first_action.total} (${s.first_action.pct_str})`)}
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
${row('Success rate', s.worker_24h.success_rate_str)}
${row('Deals found', s.worker_24h.deals_found || 0)}
${row('Alerts sent', s.worker_24h.alerts_sent || 0)}
</table>

<h3 style="margin:24px 0 8px 0;color:#111;font-size:15px">Welcome Emails</h3>
<table style="border-collapse:collapse;width:100%;background:#fff;border:1px solid #eee;border-radius:6px;overflow:hidden">
${row('Sent', s.welcome_emails.total)}
${row('Delivered', s.welcome_emails.delivered)}
${row('Opened', s.welcome_emails.opened)}
${row('Clicked', s.welcome_emails.clicked)}
${row('Open rate', s.welcome_emails.open_str)}
</table>

<h3 style="margin:24px 0 8px 0;color:#111;font-size:15px">Alert Emails</h3>
<table style="border-collapse:collapse;width:100%;background:#fff;border:1px solid #eee;border-radius:6px;overflow:hidden">
${row('Sent', s.alert_emails.total)}
${row('Delivered', s.alert_emails.delivered)}
${row('Opened', s.alert_emails.opened)}
${row('Clicked', s.alert_emails.clicked)}
${row('Open rate', s.alert_emails.open_str)}
</table>

<h3 style="margin:24px 0 8px 0;color:#111;font-size:15px">Lifecycle Emails (lifetime)</h3>
<table style="border-collapse:collapse;width:100%;background:#fff;border:1px solid #eee;border-radius:6px;overflow:hidden">
${Object.entries(s.lifecycle_sent).map(([k, v]) => row(k, v)).join('')}
</table>

<p style="color:#888;font-size:12px;margin-top:32px">Source: aiwholesail-api/scripts/funnel-metrics.js · See <code>docs/OBSERVABILITY.md</code> for SLO definitions.</p>
</body></html>`;
}

main().catch(err => {
  console.error(JSON.stringify({ ts: new Date().toISOString(), fatal: err.message, stack: err.stack }));
  process.exit(2);
});
