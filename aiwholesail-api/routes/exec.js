/**
 * Exec Dashboard — single-user authenticated SLI dashboard at
 * exec.aiwholesail.com.
 *
 * Auth model:
 *   - Single allowed user (EXEC_DASHBOARD_EMAIL, default cpodea5@gmail.com)
 *   - Password hashed once with bcrypt and stored as EXEC_DASHBOARD_PASSWORD_HASH
 *   - On successful login: signed JWT in httpOnly Secure SameSite=Lax cookie
 *     valid 7 days, sliding refresh on each request
 *   - JWT secret is a SEPARATE env var (EXEC_DASHBOARD_JWT_SECRET) — distinct
 *     from the main auth JWT_SECRET so a compromise of one doesn't impact the
 *     other
 *
 * Routes (all mounted under /exec via index.js):
 *   GET  /            → redirect to /dashboard if logged in, else /login
 *   GET  /login       → render login form
 *   POST /login       → check creds, set cookie, redirect to /dashboard
 *   GET  /dashboard   → render server-side dashboard (auth required)
 *   GET  /api/metrics → JSON snapshot for live refresh (auth required)
 *   POST /logout      → clear cookie, redirect to /login
 *
 * Why a route on the existing API server (not a separate app)?
 *   - One service to operate, one deploy, one TLS cert (via nginx vhost)
 *   - Reuse the existing DB pool + Stripe client
 *   - Share the funnel-stats lib with the cron
 */

const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');
const Stripe = require('stripe');
const { Resend } = require('resend');
const { computeFunnelStats } = require('../lib/funnel-stats');
const { asyncHandler, logSecurityEvent } = require('../middleware/errorHandler');
const { checkDatabaseRateLimit } = require('../middleware/rateLimit');
const { clientIp } = require('../lib/clientIp');
const { getSender } = require('../lib/senders');

const router = express.Router();

// Host-scope guard. The dashboard is intended to be reachable ONLY via
// the exec.aiwholesail.com nginx vhost. If the same Node process is
// reached on api.aiwholesail.com/exec/* (e.g. someone discovers the
// prefix and probes), 404 so the dashboard surface is not advertised.
// Local dev (localhost / 127.0.0.1 / .local) is allowed for testing.
const ALLOWED_HOSTS = new Set([
  'exec.aiwholesail.com',
  'localhost',
  '127.0.0.1',
]);
router.use((req, res, next) => {
  const host = (req.hostname || '').toLowerCase();
  if (ALLOWED_HOSTS.has(host) || host.endsWith('.local')) return next();
  return res.status(404).end();
});

const ALLOWED_EMAIL = (process.env.EXEC_DASHBOARD_EMAIL || 'cpodea5@gmail.com').toLowerCase();
const PASSWORD_HASH = process.env.EXEC_DASHBOARD_PASSWORD_HASH || '';
const JWT_SECRET = process.env.EXEC_DASHBOARD_JWT_SECRET || '';
const COOKIE_NAME = 'aiw_exec_session';
const COOKIE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

// Lazily reuse a single pool + Stripe client. The main app initializes its
// own pool but routes are wired with a different shape; safer to construct
// our own here. Both connect to the same DATABASE_URL.
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null;

function setSessionCookie(res, email) {
  if (!JWT_SECRET) return; // misconfig — fail closed
  const token = jwt.sign({ email, role: 'exec' }, JWT_SECRET, { expiresIn: '7d' });
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV !== 'development',
    sameSite: 'lax',
    maxAge: COOKIE_MAX_AGE_MS,
    path: '/',
  });
}

function readSession(req) {
  const raw = req.cookies?.[COOKIE_NAME];
  if (!raw || !JWT_SECRET) return null;
  try {
    return jwt.verify(raw, JWT_SECRET);
  } catch {
    return null;
  }
}

function requireExecAuth(req, res, next) {
  const session = readSession(req);
  if (!session || session.email !== ALLOWED_EMAIL) {
    if (req.accepts('html')) return res.redirect('/login');
    return res.status(401).json({ error: 'Unauthorized' });
  }
  // Sliding refresh — extend on each authenticated request
  setSessionCookie(res, session.email);
  next();
}

// ---------- Routes ----------

router.get('/', (req, res) => {
  const session = readSession(req);
  res.redirect(session ? '/dashboard' : '/login');
});

router.get('/login', (req, res) => {
  const err = req.query.error;
  let errBanner = '';
  if (err === '1') {
    errBanner = `<div style="background:#7f1d1d;border:1px solid #b91c1c;color:#fecaca;padding:10px 14px;border-radius:8px;margin-bottom:18px;font-size:13px;">Wrong email or password.</div>`;
  } else if (err === 'ratelimit') {
    errBanner = `<div style="background:#7f1d1d;border:1px solid #b91c1c;color:#fecaca;padding:10px 14px;border-radius:8px;margin-bottom:18px;font-size:13px;">Too many sign-in attempts. Try again in 10 minutes.</div>`;
  }
  res.set('Content-Type', 'text/html; charset=utf-8').send(loginHtml(errBanner));
});

router.post('/login', express.urlencoded({ extended: false }), asyncHandler(async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');

  if (!PASSWORD_HASH || !JWT_SECRET) {
    return res.status(500).set('Content-Type', 'text/html').send(errorHtml(
      'Dashboard not configured', 'EXEC_DASHBOARD_PASSWORD_HASH or EXEC_DASHBOARD_JWT_SECRET is not set on the server. Configure them in .env and restart.'
    ));
  }

  // Throttle BEFORE bcrypt.compare so the rate-limit gate doesn't introduce a
  // timing oracle of its own (DB hit is faster than bcrypt). Tight budget here
  // because this is a single-user admin surface — brute-force has no legitimate
  // upper bound.
  const ip = clientIp(req);
  const ipLimit = await checkDatabaseRateLimit(ip, 'exec-login', 5, 10);
  if (!ipLimit.allowed) {
    await logSecurityEvent('exec_login_rate_limit_exceeded', { ip }, null, req);
    return res.redirect('/login?error=ratelimit');
  }

  // Constant-time-ish comparison via bcrypt regardless of email match —
  // avoids a username-enumeration timing oracle.
  const passwordOk = await bcrypt.compare(password, PASSWORD_HASH);
  const emailOk = email === ALLOWED_EMAIL;

  if (!emailOk || !passwordOk) {
    // Secondary counter for brute-force alerting. Independent of the throttle
    // bucket so an attacker can't suppress the alert by spacing attempts.
    // After 10 failures in 1h from a single IP, fire one heads-up email to
    // the operator. Fire-and-forget — don't block the response.
    fireBruteForceAlertIfNeeded(ip, email, req).catch(err => {
      console.error('[Exec] Brute-force alert dispatch failed:', err.message);
    });
    return res.redirect('/login?error=1');
  }

  setSessionCookie(res, email);
  res.redirect('/dashboard');
}));

/**
 * Increment a separate counter for failed exec logins per IP per 1h window.
 * When the failed count crosses the alert threshold (10), email the operator
 * once per window. The counter increment is the alert signal — we read the
 * remaining-attempts return value and fire on the boundary.
 */
async function fireBruteForceAlertIfNeeded(ip, attemptedEmail, req) {
  const ALERT_THRESHOLD = 10;
  const WINDOW_MIN = 60;
  // Treat this counter as 1000-max so checkDatabaseRateLimit always returns
  // allowed=true; we only care about the per-window counter for alerting.
  const counter = await checkDatabaseRateLimit(ip, 'exec-login-failures', 1000, WINDOW_MIN);
  // remaining = max - count_so_far; count_so_far = 1000 - remaining.
  const failuresInWindow = 1000 - counter.remaining;
  if (failuresInWindow !== ALERT_THRESHOLD) return; // alert once on crossing the boundary

  await logSecurityEvent('exec_login_brute_force_alert', {
    ip,
    attempted_email_prefix: attemptedEmail.substring(0, 3) + '***',
    failures_in_last_hour: failuresInWindow,
  }, null, req);

  if (!process.env.RESEND_API_KEY) return;
  const resend = new Resend(process.env.RESEND_API_KEY);
  await resend.emails.send({
    from: getSender('security'),
    to: 'connor@upscaledinc.com',
    subject: `[Security] Exec dashboard: ${failuresInWindow} failed logins from ${ip} in the last hour`,
    text: [
      `${failuresInWindow} failed exec dashboard logins from IP ${ip} in the last hour.`,
      `Most recent attempted email: ${attemptedEmail.substring(0, 3) + '***'}`,
      `Time: ${new Date().toISOString()}`,
      ``,
      `This is an automated alert. Rate-limit gate (5 attempts / 10 min) remains active.`,
      `If this looks legitimate (e.g. password reset in flight), ignore. Otherwise consider blocking the IP at the nginx layer.`,
    ].join('\n'),
  });
}

router.post('/logout', (req, res) => {
  res.clearCookie(COOKIE_NAME, { path: '/' });
  res.redirect('/login');
});

router.get('/dashboard', requireExecAuth, asyncHandler(async (req, res) => {
  let stats;
  try {
    stats = await computeFunnelStats({ pool, stripe, resendApiKey: process.env.RESEND_API_KEY });
  } catch (e) {
    return res.status(500).set('Content-Type', 'text/html').send(errorHtml(
      'Failed to compute metrics', e.message
    ));
  }
  res.set('Content-Type', 'text/html; charset=utf-8').send(dashboardHtml(stats));
}));

router.get('/api/metrics', requireExecAuth, asyncHandler(async (req, res) => {
  const stats = await computeFunnelStats({ pool, stripe, resendApiKey: process.env.RESEND_API_KEY });
  res.json(stats);
}));

// ---------- HTML helpers ----------

function esc(v) { return String(v ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

function pageShell(title, body) {
  return `<!doctype html><html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700;800&display=swap');
  *{box-sizing:border-box}
  body{margin:0;background:#000;color:#e5e5e5;font-family:'Montserrat',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;font-feature-settings:'tnum'}
  .wrap{max-width:1100px;margin:0 auto;padding:32px 24px}
  .header{display:flex;align-items:center;justify-content:space-between;margin-bottom:28px;padding-bottom:18px;border-bottom:1px solid #1a1a1a}
  .header .logo{height:36px;width:auto;display:block}
  .header .right{display:flex;gap:18px;align-items:center;color:#737373;font-size:13px}
  .header .right a,.header .right form{color:#737373;text-decoration:none}
  .header form{display:inline}
  .header form button{background:none;border:none;color:#737373;font:inherit;cursor:pointer;padding:0}
  .header form button:hover,.header .right a:hover{color:#06b6d4}
  h1{margin:0;font-size:22px;font-weight:700;letter-spacing:-0.4px;color:#fff}
  h2{margin:32px 0 12px;font-size:14px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:#737373}
  .grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:14px}
  .card{background:#0a0a0b;border:1px solid #1a1a1a;border-radius:10px;padding:18px 20px}
  .card .label{font-size:11px;color:#525252;text-transform:uppercase;letter-spacing:0.08em;font-weight:600;margin-bottom:6px}
  .card .value{font-size:28px;font-weight:800;letter-spacing:-0.6px;color:#fff;line-height:1.1}
  .card .sub{font-size:12px;color:#737373;margin-top:4px;line-height:1.4}
  .value.green{color:#22c55e}
  .value.amber{color:#f59e0b}
  .value.red{color:#ef4444}
  .breaches{background:rgba(245,158,11,0.08);border:1px solid rgba(245,158,11,0.25);border-radius:10px;padding:14px 18px;margin-bottom:24px}
  .breaches .title{color:#f59e0b;font-weight:700;font-size:13px;margin-bottom:8px;text-transform:uppercase;letter-spacing:0.06em}
  .breaches ul{margin:0;padding-left:18px;color:#fbbf24;font-size:14px;line-height:1.7}
  .all-good{background:rgba(34,197,94,0.06);border:1px solid rgba(34,197,94,0.25);color:#22c55e;border-radius:10px;padding:14px 18px;margin-bottom:24px;font-weight:600;font-size:14px}
  table{width:100%;border-collapse:collapse;background:#0a0a0b;border:1px solid #1a1a1a;border-radius:10px;overflow:hidden}
  table td{padding:10px 16px;border-bottom:1px solid #1a1a1a;font-size:13px}
  table td:first-child{color:#737373}
  table td:last-child{color:#fff;font-weight:600;text-align:right;font-variant-numeric:tabular-nums}
  table tr:last-child td{border-bottom:none}
  .meta{color:#525252;font-size:11px;margin-top:32px;text-align:center}
  .meta a{color:#525252;text-decoration:underline}
</style>
</head><body>${body}</body></html>`;
}

function loginHtml(errBanner = '') {
  return pageShell('Sign in — AIWholesail Exec', `
<div class="wrap" style="max-width:420px">
  <div style="text-align:center;margin-bottom:32px;padding-top:48px">
    <img src="https://aiwholesail.com/logo-white.png" alt="AIWholesail" style="height:48px;width:auto"/>
  </div>
  <div class="card" style="padding:28px">
    <h1 style="font-size:20px;margin:0 0 6px 0">Exec Dashboard</h1>
    <p style="color:#737373;font-size:13px;margin:0 0 22px 0">Signed-in users only.</p>
    ${errBanner}
    <form method="post" action="/login" autocomplete="on">
      <div style="margin-bottom:14px">
        <label style="display:block;font-size:12px;color:#737373;margin-bottom:6px;font-weight:600">Email</label>
        <input type="email" name="email" required autocomplete="username"
          style="width:100%;padding:11px 12px;background:#0f0f10;border:1px solid #1a1a1a;border-radius:8px;color:#fff;font-size:14px;font-family:inherit"/>
      </div>
      <div style="margin-bottom:20px">
        <label style="display:block;font-size:12px;color:#737373;margin-bottom:6px;font-weight:600">Password</label>
        <input type="password" name="password" required autocomplete="current-password"
          style="width:100%;padding:11px 12px;background:#0f0f10;border:1px solid #1a1a1a;border-radius:8px;color:#fff;font-size:14px;font-family:inherit"/>
      </div>
      <button type="submit"
        style="width:100%;padding:12px;background:#06b6d4;color:#000;font-weight:700;font-size:14px;border:none;border-radius:8px;cursor:pointer;font-family:inherit">
        Sign in
      </button>
    </form>
  </div>
</div>`);
}

function errorHtml(title, detail) {
  return pageShell(title, `<div class="wrap" style="max-width:560px;padding-top:80px;text-align:center">
    <h1 style="margin-bottom:12px">${esc(title)}</h1>
    <p style="color:#737373;font-size:14px">${esc(detail)}</p>
  </div>`);
}

function statCard(label, value, sub = '', color = '') {
  return `<div class="card"><div class="label">${esc(label)}</div><div class="value${color ? ' ' + color : ''}">${esc(value)}</div>${sub ? `<div class="sub">${esc(sub)}</div>` : ''}</div>`;
}

function dashboardHtml(s) {
  const pctColor = (p, target) => p === null ? '' : (p >= target ? 'green' : p >= target * 0.75 ? 'amber' : 'red');

  const breachBlock = s.breaches.length === 0
    ? '<div class="all-good">✓ All tracked SLIs within target</div>'
    : `<div class="breaches"><div class="title">⚠ ${s.breaches.length} SLO breach${s.breaches.length > 1 ? 'es' : ''}</div><ul>${s.breaches.map(b => `<li>${esc(b)}</li>`).join('')}</ul></div>`;

  const fundamentalsGrid = `<div class="grid">
    ${statCard('Signups (30d)', s.signups_30d)}
    ${statCard('Active trials', s.subscriptions.active_trials)}
    ${statCard('Paid subs (Stripe)', s.stripe_now.active_paid, '', s.stripe_now.active_paid === 0 && s.signups_30d >= 30 ? 'red' : (s.stripe_now.active_paid > 0 ? 'green' : ''))}
    ${statCard('Trialing on Stripe', s.stripe_now.trialing)}
    ${statCard('Verified email', s.verified_30d.pct_str, `${s.verified_30d.verified}/${s.verified_30d.total} in 30d`, pctColor(s.verified_30d.pct, 0.50))}
    ${statCard('First in-app action', s.first_action.pct_str, `${s.first_action.did_action}/${s.first_action.total} cohort`, pctColor(s.first_action.pct, 0.50))}
    ${statCard('Worker success 24h', s.worker_24h.success_rate_str, `${s.worker_24h.clean_runs}/${s.worker_24h.total_runs} runs clean`, pctColor(s.worker_24h.success_rate, 0.95))}
    ${statCard('Deals found 24h', s.worker_24h.deals_found || 0, `${s.worker_24h.alerts_sent || 0} alerts emailed`)}
  </div>`;

  const tbl = (rows) => `<table><tbody>${rows.map(([k, v]) => `<tr><td>${esc(k)}</td><td>${esc(v)}</td></tr>`).join('')}</tbody></table>`;

  return pageShell('AIWholesail Exec Dashboard', `
<div class="wrap">
  <div class="header">
    <div style="display:flex;align-items:center;gap:14px">
      <img class="logo" src="https://aiwholesail.com/logo-white.png" alt="AIWholesail"/>
      <h1>Exec Dashboard</h1>
    </div>
    <div class="right">
      <span>${esc(s.ts.slice(0, 16).replace('T', ' '))} UTC</span>
      <a href="/dashboard">Refresh</a>
      <form method="post" action="/logout"><button type="submit">Logout</button></form>
    </div>
  </div>

  ${breachBlock}

  <h2>Funnel snapshot</h2>
  ${fundamentalsGrid}

  <h2>Stripe events (30d)</h2>
  ${tbl(Object.entries(s.stripe_events_30d))}

  <h2>Welcome emails</h2>
  ${tbl([
    ['Sent', s.welcome_emails.total],
    ['Delivered', s.welcome_emails.delivered],
    ['Opened', s.welcome_emails.opened],
    ['Clicked', s.welcome_emails.clicked],
    ['Open rate', s.welcome_emails.open_str],
  ])}

  <h2>Alert emails</h2>
  ${tbl([
    ['Sent', s.alert_emails.total],
    ['Delivered', s.alert_emails.delivered],
    ['Opened', s.alert_emails.opened],
    ['Clicked', s.alert_emails.clicked],
    ['Open rate', s.alert_emails.open_str],
  ])}

  <h2>Lifecycle emails (lifetime)</h2>
  ${tbl(Object.entries(s.lifecycle_sent).length ? Object.entries(s.lifecycle_sent) : [['(none yet)', '0']])}

  <p class="meta">
    Auto-refreshes on page reload · SLO targets in <a href="https://github.com/connorodea/aiwholesail/blob/main/docs/OBSERVABILITY.md">docs/OBSERVABILITY.md</a>
  </p>
</div>

<script>
  // Live refresh: re-fetch /api/metrics every 60s and update the key cards
  // without a full reload. Falls back gracefully on auth failure (server
  // returns 401 → reload sends user back to /login).
  async function refresh() {
    try {
      const r = await fetch('/api/metrics', { credentials: 'same-origin' });
      if (r.status === 401) { location.reload(); return; }
      // No DOM patching yet — for now a full reload picks up everything.
      // (Kept as a stub for future card-level updates without a flash.)
    } catch (_) { /* network blip — try again next tick */ }
  }
  setInterval(() => location.reload(), 60_000);
</script>`);
}

module.exports = router;
