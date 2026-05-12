/**
 * Shared SLI computation — single source of truth for both:
 *   - scripts/funnel-metrics.js (daily email digest cron)
 *   - routes/exec.js            (live dashboard at exec.aiwholesail.com)
 *
 * Returns the same shape both consumers render: a `summary` object with
 * raw numbers + computed ratios + an array of breached SLO names.
 *
 * SLO targets live here; keep in sync with docs/OBSERVABILITY.md.
 */

const axios = require('axios');

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

const pct = (num, den) => (den > 0 ? num / den : null);
const pctStr = (p) => (p === null ? 'n/a' : `${(p * 100).toFixed(1)}%`);

/**
 * Compute the funnel-metrics SLI rollup. Pure read — DB SELECTs and
 * external GET requests only.
 *
 * @param {object} opts
 * @param {import('pg').Pool} opts.pool   pg pool
 * @param {import('stripe').Stripe} opts.stripe  Stripe client
 * @param {string} [opts.resendApiKey]   if provided, pulls Resend email stats
 */
async function computeFunnelStats({ pool, stripe, resendApiKey }) {
  if (!stripe) throw new Error('stripe client required');

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

  // --- Subscription state ---
  const subState = (await pool.query(
    `SELECT
       COUNT(*) FILTER (WHERE is_trial = true AND subscribed = true)::int AS active_trials,
       COUNT(*) FILTER (WHERE is_trial = false AND subscribed = true)::int AS paid_subs,
       COUNT(*) FILTER (WHERE subscribed = true AND trial_end < NOW() AND is_trial = true)::int AS expired_unconverted,
       COUNT(*)::int AS total
     FROM subscribers`
  )).rows[0];

  // --- Stripe events (30d) ---
  const thirtyDaysAgo = Math.floor((Date.now() - 30 * 86400e3) / 1000);
  const eventCounts = {
    'checkout.session.completed': 0,
    'customer.subscription.created': 0,
    'invoice.payment_succeeded': 0,
    'invoice.payment_failed': 0,
    'customer.subscription.deleted': 0,
  };
  for await (const ev of stripe.events.list({ limit: 100, created: { gte: thirtyDaysAgo } })) {
    if (eventCounts[ev.type] !== undefined) eventCounts[ev.type]++;
  }

  // Stripe live state
  let stripeActivePaid = 0, stripeTrialing = 0;
  for await (const s of stripe.subscriptions.list({ status: 'all', limit: 100 })) {
    if (s.status === 'active') stripeActivePaid++;
    if (s.status === 'trialing') stripeTrialing++;
  }

  // --- Alert worker (24h) ---
  const workerStats = (await pool.query(
    `SELECT
       COUNT(*)::int AS total_runs,
       COUNT(*) FILTER (WHERE status = 'completed')::int AS clean_runs,
       SUM(alerts_sent)::int AS alerts_sent,
       SUM(deals_found)::int AS deals_found
     FROM alert_job_runs
     WHERE started_at > NOW() - INTERVAL '24 hours'`
  )).rows[0];

  // --- Resend (last 100 events, bucketed by subject) ---
  const resendStats = {
    delivered: 0, opened: 0, clicked: 0, bounced: 0, complained: 0, total: 0,
    welcomes: { delivered: 0, opened: 0, clicked: 0, total: 0 },
    alerts: { delivered: 0, opened: 0, clicked: 0, total: 0 },
  };
  if (resendApiKey) {
    try {
      const r = await axios.get('https://api.resend.com/emails', {
        headers: { Authorization: `Bearer ${resendApiKey}` },
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
        const bucket = isWelcome ? resendStats.welcomes : isAlert ? resendStats.alerts : null;
        if (bucket) {
          bucket.total++;
          if (ev === 'delivered' || ev === 'opened' || ev === 'clicked') bucket.delivered++;
          if (ev === 'opened' || ev === 'clicked') bucket.opened++;
          if (ev === 'clicked') bucket.clicked++;
        }
      }
    } catch (e) {
      // Resend outage shouldn't crash the dashboard — just leave zeros in place
    }
  }

  // --- Lifecycle email lifetime counts ---
  const lifecycle = (await pool.query(
    `SELECT email_type, COUNT(*)::int AS sent FROM trial_lifecycle_emails_sent GROUP BY email_type ORDER BY sent DESC`
  )).rows.reduce((acc, r) => { acc[r.email_type] = r.sent; return acc; }, {});

  // --- SLO breach detection ---
  const verifiedPct = pct(verifiedRate.verified, verifiedRate.total);
  const firstActionPct = pct(firstActionCohort.did_action, firstActionCohort.total);
  const workerSuccessRate = pct(workerStats.clean_runs, workerStats.total_runs);
  const welcomeDelivery = pct(resendStats.welcomes.delivered, resendStats.welcomes.total);
  const welcomeOpen = pct(resendStats.welcomes.opened, resendStats.welcomes.delivered);
  const alertDelivery = pct(resendStats.alerts.delivered, resendStats.alerts.total);
  const alertOpen = pct(resendStats.alerts.opened, resendStats.alerts.delivered);

  const breaches = [];
  if (welcomeDelivery !== null && welcomeDelivery < SLO.welcome_email_delivery_rate)
    breaches.push(`Welcome delivery ${pctStr(welcomeDelivery)} < ${pctStr(SLO.welcome_email_delivery_rate)}`);
  if (welcomeOpen !== null && resendStats.welcomes.total >= 10 && welcomeOpen < SLO.welcome_email_open_rate)
    breaches.push(`Welcome open ${pctStr(welcomeOpen)} < ${pctStr(SLO.welcome_email_open_rate)}`);
  if (firstActionPct !== null && firstActionPct < SLO.first_action_rate)
    breaches.push(`First-action ${pctStr(firstActionPct)} < ${pctStr(SLO.first_action_rate)}`);
  if (workerSuccessRate !== null && workerSuccessRate < SLO.worker_success_rate)
    breaches.push(`Worker success ${pctStr(workerSuccessRate)} < ${pctStr(SLO.worker_success_rate)}`);
  if (alertDelivery !== null && alertDelivery < SLO.alert_email_delivery_rate)
    breaches.push(`Alert delivery ${pctStr(alertDelivery)} < ${pctStr(SLO.alert_email_delivery_rate)}`);
  if (alertOpen !== null && resendStats.alerts.total >= 10 && alertOpen < SLO.alert_email_open_rate)
    breaches.push(`Alert open ${pctStr(alertOpen)} < ${pctStr(SLO.alert_email_open_rate)}`);
  if (signups30d >= 30 && stripeActivePaid === 0)
    breaches.push('CRITICAL: 30+ signups, 0 active paid subs');

  return {
    ts: new Date().toISOString(),
    signups_30d: signups30d,
    verified_30d: { verified: verifiedRate.verified, total: verifiedRate.total, pct: verifiedPct, pct_str: pctStr(verifiedPct) },
    first_action: { did_action: firstActionCohort.did_action, total: firstActionCohort.total, pct: firstActionPct, pct_str: pctStr(firstActionPct) },
    subscriptions: subState,
    stripe_now: { active_paid: stripeActivePaid, trialing: stripeTrialing },
    stripe_events_30d: eventCounts,
    worker_24h: { ...workerStats, success_rate: workerSuccessRate, success_rate_str: pctStr(workerSuccessRate) },
    welcome_emails: { ...resendStats.welcomes, delivery: welcomeDelivery, delivery_str: pctStr(welcomeDelivery), open: welcomeOpen, open_str: pctStr(welcomeOpen) },
    alert_emails: { ...resendStats.alerts, delivery: alertDelivery, delivery_str: pctStr(alertDelivery), open: alertOpen, open_str: pctStr(alertOpen) },
    lifecycle_sent: lifecycle,
    breaches,
    alerts: breaches.length,
  };
}

module.exports = { computeFunnelStats, SLO, pctStr };
