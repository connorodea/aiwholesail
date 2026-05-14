# P1 Vendor Setup Checklist

**Status:** Draft — operator runbook for standing up the P1 observability vendor stack defined in [`SLO_SPEC.md`](./SLO_SPEC.md).
**Owner:** Connor (operator) / Claude (assist)
**Last updated:** 2026-05-10
**Companion PRs:**
- **P1.1** — frontend `not_authenticated_toast_shown` PostHog event (in flight)
- **P1.2** — server-side `auth_zombie_events` Postgres table (in flight)
- **P1.3** — this doc

## Scope

This document is the concrete, step-by-step checklist for configuring the four vendors selected on 2026-05-14 by the C-level-advisor board, plus the exact PostHog alert rule for the C4 zombie-session detection.

Vendors (all free tier, total monthly cost: **$0**):

| Vendor | Purpose | Free-tier limit |
|---|---|---|
| **PostHog Cloud** | Frontend events + C4 alert | 1M events/mo |
| **Better Stack** | Uptime monitoring + on-call paging | 5 users, phone push |
| **Grafana Cloud** | Golden-signals dashboards | 10k metrics, 14d retention |
| **Sentry** | Frontend JS error tracking | 5k events/mo |

## Legend

- **`[Connor: do this]`** — requires real credentials, payment info, or phone number; only Connor can perform.
- **`[Claude-doable]`** — Claude can do this via existing repo access / CLI tools.
- **`[Together]`** — Connor pastes a value back; Claude wires it into the repo.

> **UI flow caveat.** Vendor dashboards change. Where the exact button names in the 2026 UI may have shifted since this doc was written, this is flagged inline and the official docs are linked. If a click path does not match what you see in the UI, prefer the official docs over this checklist.

---

## Section 1: PostHog `[Connor: do this]`

PostHog Cloud was wired up in PR #222. The C4 alert is the highest-value piece of this whole rollout — it's the alert that would have caught the cpodea5 incident on 2026-05-14 in minutes instead of hours.

### 1.1 Verify the existing project `[Connor: do this]`

1. Sign in at <https://us.posthog.com/> (or `eu.posthog.com` — confirm region; PR #222 picked one).
2. Confirm the project is named something like `aiwholesail` and that you are an admin on it.
3. Open **Activity → Live events** (sidebar). You should see at least pageviews flowing from `aiwholesail.com`.
4. If you see zero events in the last 24h, ingest is broken — stop and triage before continuing. Likely culprits: API key rotated, ad-blocker blocking the snippet, frontend bundle missing the init call. The init lives near `src/lib/analytics/posthog.ts` (or similar — verify in the repo).
5. Note the **Project API key** (`phc_...`) shown under **Project Settings → Project API Key**. Confirm it matches the `VITE_POSTHOG_KEY` env var that the frontend ships with. **Do not paste the key into this doc or any PR.**

Official docs: <https://posthog.com/docs/getting-started/install>

### 1.2 Create the C4 zombie-session alert `[Connor: do this]`

This implements alert **C4** from [`SLO_SPEC.md`](./SLO_SPEC.md#c4--frontend-zombie-session-incident):

> ≥1 unique user fires `not_authenticated_toast_shown` in a 60-min window where their PostHog session has `user_id` set.

**Step-by-step (PostHog 2026 UI — verify against [PostHog alerts docs](https://posthog.com/docs/alerts) if buttons differ):**

1. Wait for **P1.1** to deploy. The alert is meaningless until the event is actually being fired by the frontend. Verify via **Activity → Live events** filtered to `event = not_authenticated_toast_shown` — you should see at least one row (you can trigger one yourself by signing in, clearing your access token from localStorage, and clicking something protected).
2. In the left sidebar, click **Insights → New insight → Trends**.
3. Configure the trend:
   - **Series 1 event:** `not_authenticated_toast_shown`
   - **Math aggregation:** **Unique users** (NOT total count — we want one user firing it five times to register as 1, not 5).
   - **Filters (AND):**
     - `has_stored_user` = `true`
     - `has_access_token` = `false`
     - `user_id` is set (i.e., `user_id` `is_not` `null`) — this is the "session is logged in but request was 401" signature.
   - **Date range:** Last 60 minutes
   - **Interval:** 60 minutes (single bucket)
4. Click **Save as insight**. Name it `C4 — Zombie session detector`.
5. Open the saved insight. Click the **`...`** menu (top right) → **Alerts** → **New alert** (button name may be **Subscribe** or **Add alert** in some PostHog builds — see [PostHog alerts docs](https://posthog.com/docs/alerts)).
6. Configure the alert:
   - **Name:** `C4 — Zombie session detected`
   - **Condition:** `Series 1 value` `is greater than` `0`
   - **Check frequency:** Every hour (this is what PostHog free tier supports; sub-hourly requires paid).
   - **Notification destination:** Email — `cpodea5@gmail.com`
   - **(Future)** Add a webhook destination pointing at the Better Stack incoming webhook URL captured in Section 2.5 — this is what gives us phone push.
7. Save. **Copy the alert URL** (e.g., `https://us.posthog.com/project/<id>/insights/<short_id>/alerts/<alert_id>`) and paste it below.

**Alert URL:** `<TBD — paste here after creation>`
**Alert ID:** `<TBD>`

### 1.3 Smoke-test the alert `[Connor: do this]`

1. In an incognito browser, sign in to aiwholesail.com.
2. Open DevTools → Application → Local Storage → `aiwholesail.com` → delete the `accessToken` key but leave `user` in place. (Exact key names depend on what P1.1 ships — read its PR description.)
3. Click any protected feature. The `not_authenticated_toast_shown` event should fire with `has_stored_user=true` and `has_access_token=false`.
4. Wait up to 1 hour (free-tier check frequency). You should receive an email at `cpodea5@gmail.com`.
5. If no email: check PostHog **Activity → Alerts** for delivery status; check spam folder; verify the email destination is the right address.

---

## Section 2: Better Stack `[Connor: do this]`

Better Stack handles uptime monitoring (C1 alert in the SLO spec) and on-call paging. Free tier: 5 users, phone push, unlimited monitors, 3-min check interval.

### 2.1 Sign up `[Connor: do this]`

1. Go to <https://betterstack.com/> and click **Sign up**.
2. Use `connor@upscaledinc.com`. Free tier — no credit card required.
3. After verifying email, create a team named `aiwholesail`.
4. Add your phone number under **Profile → Notifications → Phone** so push notifications can fire. (This is the piece that makes Better Stack functionally PagerDuty-equivalent.)

Official docs: <https://betterstack.com/docs/uptime/>

### 2.2 HTTP uptime monitor for `/health` `[Connor: do this]`

Implements alert **C1** from [`SLO_SPEC.md`](./SLO_SPEC.md#c1--apiaiwholesailcom-unreachable):

> `/health` returns non-200 for 3 consecutive 30-second probes.

1. In Better Stack, click **Monitors → Create monitor → HTTP / website**.
2. Configure:
   - **URL:** `https://api.aiwholesail.com/health`
   - **Check frequency:** **30 seconds**
   - **Request timeout:** 10 seconds
   - **Expected status code:** `200`
   - **Expected response body contains:** `"ok"` (or whatever the existing `/health` endpoint returns — read `aiwholesail-api/src/routes/health.ts` to confirm before saving)
   - **Confirm down after:** **3 failed checks** (matches SLO spec exactly — 3 × 30s = 90s detection lag, acceptable)
   - **Regions:** pick at least 2 (e.g., US-East + EU) so a single-region network blip doesn't page you.
3. Under **Incident escalation policy**, select **Notify me immediately** → email + phone push.
4. Save. The monitor should go green within a minute.

### 2.3 Heartbeat monitor for `health-monitor.js` `[Connor: do this]`

The existing hourly `scripts/health-monitor.js` runs on `hetznerCO`. A heartbeat monitor pages us if it **stops** running (silent failure).

1. In Better Stack, click **Heartbeats → Create heartbeat**.
2. Configure:
   - **Name:** `aiwholesail health-monitor.js hourly`
   - **Expected check-in frequency:** **Every 1 hour**
   - **Grace period:** 15 minutes (the script can take up to ~5 min on a slow run; 15 gives margin)
   - **On missing heartbeat:** notify Connor — email + phone push
3. **Copy the heartbeat URL** Better Stack issues (looks like `https://uptime.betterstack.com/api/v1/heartbeat/<token>`).
4. **`[Together]`** After Connor pastes the URL, Claude opens a follow-up PR to add a `curl -fsS --max-time 10 "$BETTER_STACK_HEARTBEAT_URL" >/dev/null || true` line at the end of `scripts/health-monitor.js`, gated on `BETTER_STACK_HEARTBEAT_URL` env var being set. Keep the URL in an env var on `hetznerCO`, not in the repo.

### 2.4 Add Connor to the on-call schedule `[Connor: do this]`

1. Click **On-call → Create on-call schedule**.
2. Name: `aiwholesail primary`.
3. Add Connor as the only on-call user (24/7 for now — adjust when a second on-call joins).
4. Link both monitors (2.2 and 2.3) to this schedule under the monitor's **Escalation policy → On-call schedule**.

### 2.5 Capture the incoming-webhook URL `[Connor: do this]`

Better Stack provides an incoming webhook so other systems (PostHog, GitHub Actions, etc.) can create incidents.

1. Go to **Integrations → Incoming webhook → Create**.
2. Name: `posthog-alerts`.
3. Copy the webhook URL it generates (format: `https://uptime.betterstack.com/api/v1/incoming-webhook/<token>`).

**Webhook URL:** `<TBD — Connor pastes here; do not commit publicly if regenerable, otherwise treat as a low-sensitivity secret>`

This URL is used in Section 1.2 step 6 as the second destination on the C4 PostHog alert so the alert fires both an email **and** a phone push.

---

## Section 3: Grafana Cloud `[Connor: do this]` then `[Together]`

Grafana Cloud hosts **Dashboard 1** (`aiwholesail-api` golden signals, 12-panel layout) defined in [`SLO_SPEC.md`](./SLO_SPEC.md#dashboard-1--aiwholesail-api-express-on-port-3202).

### 3.1 Sign up `[Connor: do this]`

1. Go to <https://grafana.com/auth/sign-up/create-user>.
2. Sign up with `connor@upscaledinc.com`. Pick **Free tier**.
3. Stack name: `aiwholesail`. URL becomes `aiwholesail.grafana.net`.

Free tier (2026): 10k Prometheus metrics, 50GB logs, 50GB traces, 14-day retention. Plenty for P1.

Official docs: <https://grafana.com/docs/grafana-cloud/>

### 3.2 Create a read-only Postgres role `[Together]`

The Grafana Postgres data source needs DB credentials. Use a dedicated read-only role — **never** give Grafana the `aiwholesail` superuser.

**`[Connor: do this]`** SSH to `hetznerCO` and create the role:

```sql
CREATE ROLE grafana_ro WITH LOGIN PASSWORD '<generate a strong random password>';
GRANT CONNECT ON DATABASE aiwholesail TO grafana_ro;
GRANT USAGE ON SCHEMA public TO grafana_ro;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO grafana_ro;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO grafana_ro;
```

Note: per the global CLAUDE.md migration-grants rule, future migrations must `GRANT SELECT` on new tables to `grafana_ro` as well as `aiwholesail`. Add this to the migrations checklist when wiring it up in a follow-up PR.

### 3.3 Connect the Postgres data source `[Connor: do this]`

1. In Grafana Cloud, click **Connections → Data sources → Add data source → PostgreSQL**.
2. Configure:
   - **Host:** `<hetznerCO public IP>:5432` (or via a Tailscale/private network if one is set up)
   - **Database:** `aiwholesail`
   - **User:** `grafana_ro`
   - **Password:** the password from 3.2
   - **TLS:** **Require** (do not allow plaintext over the public internet)
   - **SSL mode:** `require`
3. Click **Save & test**. Should turn green.
4. **Important:** the Postgres on `hetznerCO` must allow inbound connections from Grafana Cloud's egress IPs. Grafana publishes these at <https://grafana.com/docs/grafana-cloud/account-management/allow-list/>. Add them to `pg_hba.conf` and the Hetzner firewall, or use Grafana's **PostgreSQL secure socks proxy** (recommended) so the DB stays firewall-closed.

### 3.4 Build Dashboard 1 — 12 panels `[Together]`

Per the SLO spec layout. Each panel below has a starter SQL query. Treat these as v1 drafts — they assume the schema of `scrape_provider_metrics` (migration 020) plus the `auth_zombie_events` table from P1.2 and an `api_access_log` table that we may need to add in P2.

For P1, build the panels we have data for and leave the others as placeholder text panels with `TODO P2`. The panels that require `api_access_log` (which doesn't exist yet) are marked **`[P2 dependency]`**.

#### Row 1 — Headline

**Panel 1 — Request rate, last 1h `[P2 dependency]`**

```sql
-- Requires api_access_log (P2). Placeholder query:
SELECT
  date_trunc('minute', ts) AS time,
  route AS metric,
  count(*) AS value
FROM api_access_log
WHERE ts > now() - interval '1 hour'
GROUP BY 1, 2
ORDER BY 1;
```

**Panel 2 — Error rate, last 1h `[P2 dependency]`**

```sql
-- Requires api_access_log (P2). Placeholder query:
SELECT
  date_trunc('minute', ts) AS time,
  CASE
    WHEN status >= 500 THEN '5xx'
    WHEN status >= 400 THEN '4xx'
    ELSE '2xx-3xx'
  END AS metric,
  count(*) AS value
FROM api_access_log
WHERE ts > now() - interval '1 hour'
GROUP BY 1, 2
ORDER BY 1;
```

**Panel 3 — P50 / P95 / P99 latency, last 1h `[P2 dependency]`**

```sql
-- Requires api_access_log (P2). Placeholder query:
SELECT
  date_trunc('minute', ts) AS time,
  percentile_cont(0.50) WITHIN GROUP (ORDER BY duration_ms) AS p50,
  percentile_cont(0.95) WITHIN GROUP (ORDER BY duration_ms) AS p95,
  percentile_cont(0.99) WITHIN GROUP (ORDER BY duration_ms) AS p99
FROM api_access_log
WHERE ts > now() - interval '1 hour'
GROUP BY 1
ORDER BY 1;
```

#### Row 2 — SLO burn-down `[P2 dependency]`

Panels 4, 5, 6 all consume the `slo_burn_history` table planned in P2 step 5 of the SLO spec roadmap. Leave as `TODO P2` text panels for now.

#### Row 3 — Auth subsystem (cpodea5 watchpoint)

**Panel 7 — 401-rate on authenticated routes, last 24h `[P2 dependency]`**

Placeholder until `api_access_log` exists. For P1, replace temporarily with a count of `auth_zombie_events` rows per hour (the P1.2 table), which is a strict subset.

**Panel 8 — Token-refresh failure rate, last 24h `[P2 dependency]`**

Same — `TODO P2`.

**Panel 9 — `not_authenticated_toast_shown` events, last 24h** ← **buildable in P1**

This panel is the visual companion to alert C4. Build it from PostHog (separate data source), not Postgres.

1. Add a second data source: **Connections → Add data source → PostHog**.
   - Host: `https://us.posthog.com` (or `eu.posthog.com`)
   - API key: generate a **read-only personal API key** in PostHog (**Settings → Personal API keys**) scoped to project read.
2. Panel query (in Grafana's PostHog data source — query builder, not SQL):
   - Event: `not_authenticated_toast_shown`
   - Aggregation: Unique users
   - Interval: 1 hour
   - Time range: Last 24h

#### Row 4 — Scrape.do health

All three panels run against `scrape_provider_metrics` (migration 020) — **buildable in P1**.

**Panel 10 — Scrape.do success rate by action, heatmap, last 24h**

```sql
SELECT
  date_trunc('hour', created_at) AS time,
  action AS metric,
  100.0 * sum(CASE WHEN success THEN 1 ELSE 0 END) / NULLIF(count(*), 0) AS value
FROM scrape_provider_metrics
WHERE provider = 'scrape-do-zillow'
  AND created_at > now() - interval '24 hours'
GROUP BY 1, 2
ORDER BY 1;
```

**Panel 11 — Captcha-retry frequency, last 7d**

```sql
-- Assumes scrape_provider_metrics has a render_retry boolean column.
-- If not, adapt to call_kind LIKE '%retry%' or whatever the actual column is — verify with \d scrape_provider_metrics.
SELECT
  date_trunc('hour', created_at) AS time,
  100.0 * sum(CASE WHEN render_retry THEN 1 ELSE 0 END) / NULLIF(count(*), 0) AS value
FROM scrape_provider_metrics
WHERE provider = 'scrape-do-zillow'
  AND created_at > now() - interval '7 days'
GROUP BY 1
ORDER BY 1;
```

**Panel 12 — P95 scrape duration by action, last 24h**

```sql
SELECT
  date_trunc('hour', created_at) AS time,
  action AS metric,
  percentile_cont(0.95) WITHIN GROUP (ORDER BY duration_ms) AS value
FROM scrape_provider_metrics
WHERE provider = 'scrape-do-zillow'
  AND success = true
  AND created_at > now() - interval '24 hours'
GROUP BY 1, 2
ORDER BY 1;
```

### 3.5 Save and share the dashboard `[Connor: do this]`

1. Click **Save dashboard** → name `aiwholesail-api — golden signals`.
2. Set the default time range to **Last 1 hour** (matches Row 1's expectation).
3. Star it so it's pinned in your sidebar.
4. Paste the dashboard URL below.

**Dashboard URL:** `<TBD — paste here after creation>`

---

## Section 4: Sentry FE `[Connor: do this]` then `[Together]`

Sentry tracks frontend JS errors and (in P3) propagates trace IDs to the API for cross-stack correlation.

### 4.1 Sign up `[Connor: do this]`

1. Go to <https://sentry.io/signup/>. Free tier: 5k errors/mo, 10k performance units/mo, 1 user, 30-day retention.
2. Sign up with `connor@upscaledinc.com`.
3. Create an organization: `aiwholesail`.
4. Create a project:
   - **Platform:** React (the frontend is Vite + React per the repo)
   - **Project name:** `aiwholesail-frontend`
   - **Alert frequency:** Alert me on every new issue
5. **Copy the DSN** that Sentry generates (`https://<key>@o<org>.ingest.sentry.io/<project>`). Treat as low-sensitivity (DSNs are public-ish, they identify which project to ingest into).

Official docs: <https://docs.sentry.io/platforms/javascript/guides/react/>

### 4.2 Install the SDK `[Together]`

**`[Claude-doable]`** in a follow-up PR (not this docs-only PR):

```bash
cd frontend  # or wherever the Vite app lives — verify with `ls frontend/package.json`
npm install --save @sentry/react
```

### 4.3 Init snippet to add to `src/main.tsx` `[Together]`

In a follow-up code PR, add this near the top of `src/main.tsx` (or the frontend entry point — verify the path), **before** `ReactDOM.createRoot`:

```ts
import * as Sentry from "@sentry/react";

if (import.meta.env.PROD && import.meta.env.VITE_SENTRY_DSN) {
  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN,
    environment: import.meta.env.MODE,
    release: import.meta.env.VITE_RELEASE_SHA ?? "dev",

    // Performance + tracing — P3 will use these.
    integrations: [
      Sentry.browserTracingIntegration(),
    ],
    tracesSampleRate: 0.1, // 10% of transactions; bump if 5k/mo cap isn't hit
    tracePropagationTargets: [
      /^https:\/\/api\.aiwholesail\.com/,
    ],

    // P3: capture trace IDs so the API can correlate. browserTracingIntegration
    // adds `sentry-trace` and `baggage` headers to outbound fetch automatically;
    // the API just needs to read them.

    // PII scrubbing — never send raw auth headers.
    beforeSend(event) {
      if (event.request?.headers) {
        delete event.request.headers.Authorization;
        delete event.request.headers.Cookie;
      }
      return event;
    },
  });
}
```

Add `VITE_SENTRY_DSN` to the deploy env on Vercel (or wherever the frontend ships from) **`[Connor: do this]`**. Add `VITE_RELEASE_SHA` to be set from CI to `${{ github.sha }}` so Sentry can group errors by release.

### 4.4 Send a test error `[Connor: do this]`

After the SDK ships:

1. Open the deployed app in a browser, DevTools console.
2. Run: `throw new Error("Sentry P1 smoke test — ignore")`.
3. Within ~30 seconds, the error should appear in **Sentry → Issues**.

---

## Section 5: Verification checklist

Run through this top-to-bottom **after** P1.1 and P1.2 have both deployed and the four vendor sections above are configured. Tick boxes as you go.

- [ ] PostHog **Activity → Live events** shows at least one `not_authenticated_toast_shown` event from production (P1.1 deployed and firing).
- [ ] The C4 PostHog alert (Section 1.2) exists, has the email destination `cpodea5@gmail.com` configured, and the alert URL is pasted into this doc.
- [ ] `psql` on `hetznerCO` against the `aiwholesail` DB shows non-zero rows in `auth_zombie_events` (P1.2 deployed and the middleware is logging).
- [ ] Better Stack HTTP monitor on `https://api.aiwholesail.com/health` shows **green** for at least 5 minutes.
- [ ] Better Stack heartbeat monitor receives at least one check-in from `scripts/health-monitor.js` and shows green (requires the heartbeat-URL PR from Section 2.3 to be merged and deployed).
- [ ] Better Stack on-call schedule lists Connor with email + phone push enabled.
- [ ] Grafana Cloud Postgres data source test passes.
- [ ] Grafana Dashboard 1 renders with at least Panels 9, 10, 11, 12 showing non-empty data. Panels marked **`[P2 dependency]`** can stay as TODO text.
- [ ] Sentry receives a manually thrown test error and it appears under **Issues** within 30 seconds.
- [ ] A staged zombie session (incognito → sign in → delete `accessToken` from localStorage → click protected feature) results in: (a) PostHog event fired, (b) `auth_zombie_events` row inserted, (c) C4 alert email arrives at `cpodea5@gmail.com` within 1 hour.

When every box is ticked, P1 observability is live.

---

## Manual-action summary

| Section | Action type | Why |
|---|---|---|
| 1.1 Verify PostHog | `[Connor: do this]` | Requires PostHog login |
| 1.2 Create C4 alert | `[Connor: do this]` | Requires PostHog admin + creating the alert in their UI |
| 1.3 Smoke-test C4 | `[Connor: do this]` | Requires a real signed-in browser session |
| 2.1–2.5 Better Stack | `[Connor: do this]` | Account creation, phone number, monitor setup |
| 2.3 wire heartbeat into script | `[Together]` | Connor pastes URL, Claude PRs the curl line |
| 3.1 Grafana signup | `[Connor: do this]` | Account creation |
| 3.2 Create `grafana_ro` role | `[Together]` | Connor runs SQL on prod DB; Claude drafts the migration if we want it tracked |
| 3.3 Connect data source | `[Connor: do this]` | Requires Grafana UI + Postgres password |
| 3.4 Build dashboard panels | `[Together]` | Connor builds in UI; Claude provides SQL |
| 3.5 Save & share dashboard URL | `[Connor: do this]` | Requires login |
| 4.1 Sentry signup | `[Connor: do this]` | Account creation |
| 4.2 Install SDK | `[Together]` | Claude opens a follow-up code PR |
| 4.3 Init snippet | `[Together]` | Claude opens a follow-up code PR; Connor sets env vars |
| 4.4 Send test error | `[Connor: do this]` | Requires a deployed app + browser |

Anything not in the table above (filing this doc, structuring the checklist, drafting SQL/snippets) is `[Claude-doable]` and has already been done in this PR.
