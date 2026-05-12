# AIWholesail Observability Plan

> **Status:** Living doc. Started 2026-05-12 after a session that uncovered 3 wipe-vector bugs, a worker INSERT bug, and 14 rows of data corruption — all only via manual audit. The fix is instrumentation, not more manual audits.

This doc defines the SLIs, SLOs, monitors, and runbooks for AIWholesail. The goal is simple: **regressions that affect conversion should page someone within an hour, not be discovered weeks later via a customer report.**

---

## SLI / SLO Catalog

Each row is one **Service Level Indicator** (a measurable signal) and its **Service Level Objective** (the target). When the SLO is breached, the alert column tells you which monitor catches it.

### Signup → Activation Funnel

| SLI | What it measures | Current | SLO target | Monitor |
|---|---|---|---|---|
| **Signup success rate** | `POST /api/auth/signup` 2xx / total | unmeasured | ≥ 99% over 24h | API access log |
| **Welcome email delivered** | Resend `delivered` events / signups | ~100% (audited 2026-05-12) | ≥ 99% over 24h | funnel-metrics cron |
| **Welcome email opened** | Resend `opened` / `delivered` over 7d | unmeasured (tracking just enabled) | ≥ 30% over 7d | funnel-metrics cron |
| **Welcome email clicked** | Resend `clicked` / `opened` over 7d | unmeasured | ≥ 25% of opens | funnel-metrics cron |
| **First in-app action** | Users with ≥1 lead/favorite/search within 7d of signup / signups | ~36% (audited 2026-05-12) | ≥ 50% over 30d | funnel-metrics cron |

### Trial → Paid Conversion

| SLI | What it measures | Current | SLO target | Monitor |
|---|---|---|---|---|
| **Trial-end push email coverage** | `day_minus_1` sent / trials approaching day-7 | varies | ≥ 95% of due cohort | lifecycle worker log |
| **Stripe Checkout session creation rate** | sessions started / trials past day-7 | unmeasured | ≥ 30% over 30d | funnel-metrics cron |
| **Checkout → paid conversion** | `checkout.session.completed` / sessions started | ~38% historically (4/13) | ≥ 50% over 30d | funnel-metrics cron |
| **Currently paying** | Stripe `active` subs (non-trial) | 0 (post-fix baseline) | ≥ 10 by 2026-05-26 | funnel-metrics cron |
| **Trial-end charge success** | first-cycle invoices paid / first-cycle invoices billed | ~64% historically (7/11) | ≥ 90% over 30d | funnel-metrics cron |

### Alerts System

| SLI | What it measures | Current | SLO target | Monitor |
|---|---|---|---|---|
| **Worker success rate** | `alert_job_runs.status='completed'` / total runs in 24h | ~67% pre-fix; targeting 95%+ post-#210 | ≥ 95% over 24h | funnel-metrics cron |
| **Alert email delivery rate** | Resend `delivered` / alerts triggered | ~100% | ≥ 99% over 24h | funnel-metrics cron |
| **Alert email open rate** | Resend `opened` / `delivered` | unmeasured (tracking just enabled) | ≥ 25% over 7d | funnel-metrics cron |
| **Match → email latency P95** | minutes from cache `last_seen_at` to send | unmeasured | ≤ 70 min | (deferred — needs trace data) |
| **Audit-trail integrity** | `property_alert_matches` rows inserted / alerts sent | 0% pre-#210; should be ~100% post | ≥ 99% | funnel-metrics cron |

### Subscription Data Integrity (Wipe Canary)

Built in PR #198 — runs daily at 09:15 UTC.

| SLI | What it measures | Current | SLO target | Monitor |
|---|---|---|---|---|
| **DB-Stripe drift (Class B "already wiped")** | DB unsubscribed AND Stripe has active sub | 0 | **must equal 0** | subscriber-health audit |
| **At-risk rows (Class A "wipe imminent")** | DB subscribed AND Stripe 0 live AND local trial/sub expired | 4 (these are legit expired trials, OK) | ≤ 10 with explanation | subscriber-health audit |
| **Legit DB-only grants** | DB subscribed AND Stripe 0 live AND local trial/sub active | ~70 (in-app trials, expected) | n/a — informational | subscriber-health audit |

### API & Worker Reliability

| SLI | What it measures | Current | SLO target | Monitor |
|---|---|---|---|---|
| **API 5xx rate** | 5xx responses / total requests | unmeasured | < 1% over 24h | (deferred — needs proxy access log parse) |
| **API P95 latency** | 95th percentile response time on `/api/*` | unmeasured | ≤ 1000 ms | (deferred) |
| **Lifecycle worker run-success** | `trial_lifecycle_job_runs.status='completed'` / total | ~100% post-#200 | ≥ 99% over 24h | lifecycle worker log |
| **Cron-timer health** | All `aiwholesail-*.timer` units `active=enabled` | currently OK | 100% | health-monitor (hourly) |

---

## Active monitors today

| Monitor | Cadence | What it catches | Output |
|---|---|---|---|
| `aiwholesail-health-monitor.timer` | hourly :30 | API down, DB unreachable, disk/mem/load, timer states, blog freshness | Resend email on anomaly + daily green ping 09:00 UTC |
| `aiwholesail-subscriber-health.timer` | daily 09:15 UTC | DB ↔ Stripe drift (wipe regressions) | Resend email on anomaly + daily green ping |
| `aiwholesail-trial-lifecycle.timer` | hourly | Lifecycle email coverage (founder_welcome, day_minus_1, day_zero, day_plus_1, day_plus_7) | Per-run JSON log to journald |
| `aiwholesail-spread-alert.timer` | hourly :05 | Alert delivery + worker errors | Per-run row in `alert_job_runs` |
| **NEW:** `aiwholesail-funnel-metrics.timer` | daily 09:30 UTC | All SLI numbers above, rolled up into one digest | Resend email + JSON to journald |

---

## Alert routing

Tier definitions (matches Observability Designer skill conventions):

| Severity | Response time | Channel | Examples |
|---|---|---|---|
| **Critical** | < 15 min | Resend email + SMS if available | API 5xx > 5%, Class B wipe count > 0, all timers failed |
| **Warning** | < 1 hour | Resend email | SLO burn approaching, single-timer failure, low email-open rate |
| **Info** | next workday | Resend email digest | daily green-ping, weekly funnel report |

cpodea5@gmail.com is the operator address for all three tiers (set in `.env` as `OPERATOR_EMAIL`).

---

## Runbooks (one per likely alert)

### 1. Subscriber-health monitor reports `wipe_already > 0`

> A user's DB row says they're unsubscribed but Stripe shows them as active. They're locked out of features they paid for.

**Immediate (< 5 min):**
1. Open the alert email — note `email`, `db_tier`, `stripe_sub_id`, `stripe_status`
2. Manually correct the DB row:
   ```sql
   UPDATE subscribers
   SET subscribed = true,
       subscription_tier = '<tier from Stripe>',
       is_trial = '<status="trialing"?>',
       updated_at = NOW()
   WHERE email = '<email>';
   ```
3. Email the affected user: "We saw an issue with your account — fixed within minutes, no action needed on your end."

**Root-cause investigation:**
- Re-read the wipe-vector trio: PRs #192 (webhook reconciler), #193 (middleware), #194 (GET endpoint). If any new code touches `subscribers` SET `subscribed=false`, check whether it preserves local trial/manual-grant state per those PRs.
- Run a fresh ssh-side audit: `node scripts/subscriber-health-audit.js --force-email` to see if it's a one-off or a cluster.

### 2. Funnel-metrics: `paid_subs_active = 0` AND `signups_30d > 50`

> Lots of signups, no one converting. The conversion-funnel killer is back.

**Investigation order:**
1. Pull recent `checkout.session.completed` events from Stripe — are any firing?
2. If yes: look at `customer.subscription.created` — are subscriptions actually being created?
3. If yes: look at `invoice.payment_succeeded` — is the first-cycle charge succeeding?
4. If no anywhere in the chain: check the checkout config in `routes/stripe.js` — `payment_method_collection: 'always'`, no stacked trial. (That fix was the recent unblocker.)
5. Verify `TWILIO_*` and `RESEND_API_KEY` haven't been rotated without `.env` updates.

### 3. Alert worker run with `status='completed_with_errors'`

> The cron ran but at least one alert errored. Email may have gone out anyway, depending on the error.

**Triage by error type:**
- `null value in column "property_id"` → PR #210 regression; check `INSERT INTO property_alert_matches` has all required columns
- `Resend rejected alert email: ...` → Resend API issue; check `RESEND_API_KEY` validity at console.resend.com
- `<location>: Request failed with status code <5xx>` → Zillow RapidAPI flake; usually self-heals on next run

If errors persist for 3+ consecutive runs: open an incident ticket and `systemctl stop aiwholesail-spread-alert.timer` to prevent noise while debugging.

### 4. `welcome_email_open_rate_7d < 15%` (vs 30% target)

> Welcome emails are reaching inboxes (Resend says delivered) but recipients aren't opening.

**Likely causes (rule-out order):**
1. **Spam-folder placement** — check Resend's domain reputation (`https://resend.com/domains`)
2. **Subject line** — fatigue or unclear value
3. **Apple Mail Privacy Protection** is inflating "opens" already, so a low rate is even worse than it looks
4. Audit a sample of 5 affected users: do they exist? Did they verify? Are they on Gmail's promotions tab?

### 5. `day_minus_1_sent / day_minus_1_due < 80%`

> Trial-ending push emails are missing their cohort.

**Steps:**
1. Run `node scripts/trial-lifecycle-worker.js --dry-run` on prod and count `day_minus_1` candidates
2. Cross-reference against the DB cohort that *should* be due:
   ```sql
   SELECT s.user_id, s.email, s.trial_end
   FROM subscribers s
   WHERE s.is_trial = true
     AND s.trial_end BETWEEN NOW() + INTERVAL '23 hours' AND NOW() + INTERVAL '25 hours'
     AND NOT EXISTS (
       SELECT 1 FROM trial_lifecycle_emails_sent
        WHERE user_id = s.user_id AND email_type = 'day_minus_1'
     );
   ```
3. If dry-run candidate count = SQL count → worker is healthy; the cron timer just hasn't fired yet
4. If dry-run candidate count < SQL count → bug in the worker's WHERE clause; bisect against the SQL above

### 6. Funnel-metrics cron itself fails (no green ping at 09:30 UTC)

**Steps:**
1. `journalctl -u aiwholesail-funnel-metrics -n 100 --no-pager`
2. Most likely cause: Stripe API or Resend API rate limit / 5xx
3. Re-run manually: `systemctl start aiwholesail-funnel-metrics.service`
4. If it fails repeatedly, the script exits non-zero → `aiwholesail-onfailure-notify` fires anyway

---

## Implementation roadmap

- [x] PR #198: subscriber-health daily monitor + systemd timer
- [x] PR #...: Resend domain-level open/click tracking enabled (2026-05-12)
- [x] **This PR**: funnel-metrics daily cron + OBSERVABILITY.md
- [ ] Wire a structured-log aggregator (Loki / Better Stack / native journald → email) so we can grep across services
- [ ] API access log parsing for 5xx rate + latency P95 (likely Caddy/nginx log → tail + emit metric)
- [ ] Match-to-email latency tracing in the alert worker (timestamp at match-found, timestamp at email-sent)
- [ ] Weekly executive digest combining all SLI cards into one PDF (use existing `seo-report-pdf` skill patterns)

---

## Why this exists

Pre-2026-05-12 the funnel was at "69 signups, 0 paying" for an extended window and nobody knew because nothing was watching. Every regression in this session — webhook reconciler wipe, middleware wipe, GET endpoint wipe, worker INSERT bug, day_plus_1/7 broken by the wipe fix, the alerts page crashing for 14/15 users — was discovered by hand. With this plan, the next equivalent regression gets caught in ≤24h via a daily digest, or ≤1h via a paged alert if it's severe.
