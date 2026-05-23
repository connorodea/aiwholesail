# SLO Query Catalog — P2 implementation

**Status:** Draft (P2 phase per `SLO_SPEC.md` §Implementation roadmap)
**Owner:** Connor / on-call
**Last updated:** 2026-05-10
**Pairs with:** `docs/observability/SLO_SPEC.md`

This document holds the concrete PostgreSQL queries that turn the eight SLOs
in `SLO_SPEC.md` into numbers we can put on a Grafana dashboard. Each
section is structured so the SLO cron can lift the SQL directly into a
job; the cron writes one row per (slo_id, window) tuple into
`slo_burn_history` (schema in §3).

### Quick legend
- **Numerator / denominator** are returned as integers so the
  `slo_burn_history.ratio` generated column can divide them safely.
- `NOW()` is `clock_timestamp()` semantics — fine for cron-driven jobs.
- Where data is missing, queries are wrapped in `[BLOCKED-ON: …]` and the
  gap is itemised in §5.
- Targets, error-budget formulae, and 30-day windows come straight from
  `SLO_SPEC.md` lines 65-120; don't re-derive them here, just cite.

---

## 1. Per-SLO query catalog

### SLO 1 — Sign-in availability

- **Target:** 99.5% over 30-day rolling window (`SLO_SPEC.md` §SLO 1).
- **Data source:** `user_events` table (migration 008) with new event
  types `sign_in_attempt` / `sign_in_success` / `sign_in_failed`.
- **Status:** **[BLOCKED-ON: sign-in events in `user_events`]** — see §5.
  The vocabulary lives in `aiwholesail-api/lib/events.js` but no
  `SIGN_IN_*` constants exist there yet, and `routes/auth.js` only
  updates `users.last_sign_in` (line 646) without writing to
  `user_events`. Once those events land, the queries below run.

**SLI calculation (5-min window, fast burn):**
```sql
-- SLO 1 — Sign-in availability — 5-min window
-- [BLOCKED-ON: sign_in_attempt / sign_in_success events in user_events]
SELECT
  COUNT(*) FILTER (WHERE event_type = 'sign_in_success')::int AS numerator,
  COUNT(*) FILTER (WHERE event_type IN ('sign_in_success', 'sign_in_failed'))::int AS denominator
FROM user_events
WHERE created_at >= NOW() - INTERVAL '5 minutes'
  AND event_type IN ('sign_in_success', 'sign_in_failed');
```

**Window function (30-day slow burn):**
```sql
-- SLO 1 — Sign-in availability — 30-day rolling
SELECT
  COUNT(*) FILTER (WHERE event_type = 'sign_in_success')::int AS numerator,
  COUNT(*) FILTER (WHERE event_type IN ('sign_in_success', 'sign_in_failed'))::int AS denominator
FROM user_events
WHERE created_at >= NOW() - INTERVAL '30 days'
  AND event_type IN ('sign_in_success', 'sign_in_failed');
```

**Error budget remaining:**
```
budget_remaining_ratio
  = 1 - ( (1 - ratio_30d) / (1 - 0.995) )
  = 1 - ((1 - ratio_30d) / 0.005)
```
A value of `1.0` = full budget; `0.0` = budget exhausted; negative =
breach.

**Caveats:**
- Synthetic e2e traffic must be excluded — re-use `isSyntheticEmail()`
  from `aiwholesail-api/lib/events.js` at write time so the table is
  already clean.
- Treat captcha-blocked attempts (if/when added) as `sign_in_failed`
  with a property — they still count against availability because the
  user couldn't get in.

---

### SLO 2 — Authenticated request success (zombie watch)

- **Target:** 99.9% over 7-day rolling window (`SLO_SPEC.md` §SLO 2).
- **Data source:** `auth_zombie_events` (migration 022, parallel agent
  P1.2) **plus** `users` and `sessions` to size the denominator.
- **Status:** **Partially blocked.** Numerator is computable today —
  every zombie 401 lands in `auth_zombie_events`. Denominator
  (total authenticated requests) requires per-request logging that
  doesn't exist yet (`[BLOCKED-ON: per-request access log persistence]`).
  Until that lands we use **active-sessions** as a proxy denominator:
  any session whose `expires_at > NOW() AND revoked = false` is
  presumed to be making requests in the window.

**SLI calculation (5-min window):**
```sql
-- SLO 2 — Authenticated request success — 5-min window
-- Proxy denominator: active sessions × 5 (assume ≥1 req/min/active session)
WITH window_bounds AS (
  SELECT NOW() - INTERVAL '5 minutes' AS w_start, NOW() AS w_end
),
zombies AS (
  SELECT COUNT(*)::int AS n
  FROM auth_zombie_events, window_bounds
  WHERE created_at >= w_start AND created_at < w_end
),
active_sessions AS (
  -- Proxy: every non-revoked, non-expired session is a candidate caller.
  -- Multiply by 5 = window length in minutes as a rough lower-bound on
  -- expected authenticated requests during the window.
  SELECT GREATEST(COUNT(DISTINCT user_id) * 5, 1)::int AS n
  FROM sessions
  WHERE revoked = false
    AND expires_at > NOW()
)
SELECT
  (active_sessions.n - zombies.n)::int AS numerator,
  active_sessions.n::int               AS denominator
FROM zombies, active_sessions;
```

**Window function (7-day slow burn):**
```sql
-- SLO 2 — Authenticated request success — 7-day rolling
-- Same proxy: active-session-minutes over 7 days as a denominator estimate.
WITH zombies AS (
  SELECT COUNT(*)::int AS n FROM auth_zombie_events
  WHERE created_at >= NOW() - INTERVAL '7 days'
),
active_session_minutes AS (
  SELECT GREATEST(
    SUM(
      EXTRACT(EPOCH FROM (LEAST(expires_at, NOW()) - GREATEST(created_at, NOW() - INTERVAL '7 days'))) / 60
    )::int,
    1
  ) AS n
  FROM sessions
  WHERE NOT revoked
    AND expires_at > NOW() - INTERVAL '7 days'
    AND created_at  < NOW()
)
SELECT
  (active_session_minutes.n - zombies.n)::int AS numerator,
  active_session_minutes.n::int               AS denominator
FROM zombies, active_session_minutes;
```

**Error budget remaining:**
```
budget_remaining_ratio = 1 - ((1 - ratio_7d) / (1 - 0.999))
                       = 1 - ((1 - ratio_7d) / 0.001)
```

**Caveats:**
- The active-session denominator is a **proxy, not truth**. Treat absolute
  ratios with skepticism; trust deltas. Once §5's access-log persistence
  lands, swap denominator for actual authenticated 2xx+4xx counts.
- `auth_zombie_events.jwt_user_id` is `TEXT` (intentional — see migration
  022 lines 35-37). Don't `::uuid` cast or you'll lose malformed rows.
- C4 alert in §2 uses the same table but counts **distinct users**,
  not events.

---

### SLO 3 — Property search latency P95

- **Target:** P95 < 4s over 30-day window (`SLO_SPEC.md` §SLO 3).
- **Data source:** `scrape_provider_metrics` filtered to
  `action = 'search'` (matches `aiwholesail-api/lib/scrapers/zillowScrapeDo.js`
  lines 1121, 1132, 1225, 1235). `duration_ms` is the wire time.

**SLI calculation (5-min window):**
```sql
-- SLO 3 — Property search latency P95 — 5-min window
-- Numerator = window passed (P95 under 4000ms); denominator = 1 (window vote).
SELECT
  CASE
    WHEN PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY duration_ms) < 4000 THEN 1
    ELSE 0
  END::int AS numerator,
  1::int   AS denominator,
  PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY duration_ms) AS p95_ms_observed
FROM scrape_provider_metrics
WHERE created_at >= NOW() - INTERVAL '5 minutes'
  AND action = 'search'
  AND duration_ms IS NOT NULL;
```

**Window function (30-day slow burn — % of 5-min windows that passed):**
```sql
-- SLO 3 — Property search latency P95 — 30-day window-vote roll-up
-- Reads slo_burn_history for slo_3 (5-min cadence) over the last 30 days
-- and computes the % of windows that came in under 4s.
SELECT
  SUM(numerator)::int                                AS numerator,
  COUNT(*) FILTER (WHERE denominator > 0)::int       AS denominator
FROM slo_burn_history
WHERE slo_id = 'slo_3'
  AND window_end >= NOW() - INTERVAL '30 days';
```

**Error budget remaining:**
```
target_pass_rate = 0.90        -- "90% of windows" per SLO_SPEC line 83
budget_remaining_ratio = 1 - ((1 - ratio_30d_window_pass) / (1 - 0.90))
                       = 1 - ((1 - ratio_30d_window_pass) / 0.10)
```

**Caveats:**
- Captures upstream scraper time only, not the end-to-end HTTP latency
  the user sees. For full end-to-end we need access-log latency
  (`[BLOCKED-ON: per-request access log persistence]`). This proxy is
  acceptable because scrape.do dominates the request budget — the
  Express layer rarely adds >100ms.
- Windows with `denominator = 0` (no traffic) are skipped, not counted as
  passes — see `slo_burn_history.ratio` generated column behaviour.

---

### SLO 4 — Property search success rate

- **Target:** 99% over 7-day window (`SLO_SPEC.md` §SLO 4).
- **Data source:** `scrape_provider_metrics` where `action = 'search'`.
  The `success` boolean already encodes "returned usable data" per the
  helper's contract (migration 020 line 36).

**SLI calculation (5-min window):**
```sql
-- SLO 4 — Property search success rate — 5-min window
SELECT
  COUNT(*) FILTER (WHERE success = true)::int  AS numerator,
  COUNT(*)::int                                AS denominator
FROM scrape_provider_metrics
WHERE created_at >= NOW() - INTERVAL '5 minutes'
  AND action = 'search';
```

**Window function (7-day slow burn):**
```sql
-- SLO 4 — Property search success rate — 7-day rolling
SELECT
  COUNT(*) FILTER (WHERE success = true)::int  AS numerator,
  COUNT(*)::int                                AS denominator
FROM scrape_provider_metrics
WHERE created_at >= NOW() - INTERVAL '7 days'
  AND action = 'search';
```

**Error budget remaining:**
```
budget_remaining_ratio = 1 - ((1 - ratio_7d) / (1 - 0.99))
                       = 1 - ((1 - ratio_7d) / 0.01)
```

**Caveats:**
- Includes both primary and fallback `call_kind` rows because the user
  cares about end-state success, not which provider answered. If you
  want primary-only health, filter `call_kind = 'primary'`.
- "Legitimately empty" (per `SLO_SPEC.md` line 87) is NOT distinguished
  in `scrape_provider_metrics` today — the helper writes `success=true`
  whenever the call returned data, including zero-result pages. That's
  the correct semantic.

---

### SLO 5 — Scrape.do provider availability

- **Target:** 95% over 7-day window (`SLO_SPEC.md` §SLO 5).
- **Data source:** `scrape_provider_metrics` filtered to
  `provider = 'scrape-do-zillow'`. **This SLO is the cleanest because
  the data is exactly the table's reason for existing.**

**SLI calculation (60-min window per `SLO_SPEC.md` line 94):**
```sql
-- SLO 5 — Scrape.do provider availability — 60-min window
SELECT
  COUNT(*) FILTER (WHERE success = true)::int  AS numerator,
  COUNT(*)::int                                AS denominator
FROM scrape_provider_metrics
WHERE created_at >= NOW() - INTERVAL '60 minutes'
  AND provider = 'scrape-do-zillow';
```

**Window function (7-day slow burn):**
```sql
-- SLO 5 — Scrape.do provider availability — 7-day rolling
SELECT
  COUNT(*) FILTER (WHERE success = true)::int  AS numerator,
  COUNT(*)::int                                AS denominator
FROM scrape_provider_metrics
WHERE created_at >= NOW() - INTERVAL '7 days'
  AND provider = 'scrape-do-zillow';
```

**Error budget remaining:**
```
budget_remaining_ratio = 1 - ((1 - ratio_7d) / (1 - 0.95))
                       = 1 - ((1 - ratio_7d) / 0.05)
```

**Caveats:**
- Includes ALL actions on `scrape-do-zillow` (search, propertyDetails,
  photos, etc.). For per-action breakdowns, add `GROUP BY action`.
- Aligns with the existing hourly `health-monitor.js` signal (12)
  thresholds at 90%/70% — this SLO ratchets to 95% baseline (see
  `SLO_SPEC.md` line 97 for the rationale).

---

### SLO 6 — AI analyzer P95

- **Target:** P95 < 12s over an unspecified window in `SLO_SPEC.md`
  §SLO 6 — using 30-day rolling to match SLO 3.
- **Data source:** **[BLOCKED-ON: per-route latency logging for
  `/api/ai/analyze`]**. `routes/ai.js` currently fires
  `logEvent(req.user.id, EVENTS.AI_ANALYZER_RUN, …)` at line 450 but
  doesn't capture wall-clock duration. The `user_events.properties`
  JSONB is the obvious home for `duration_ms`.

**SLI calculation (5-min window — after instrumentation lands):**
```sql
-- SLO 6 — AI analyzer P95 — 5-min window
-- [BLOCKED-ON: routes/ai.js must record duration_ms in user_events.properties]
SELECT
  CASE
    WHEN PERCENTILE_CONT(0.95) WITHIN GROUP (
      ORDER BY (properties->>'duration_ms')::int
    ) < 12000 THEN 1
    ELSE 0
  END::int AS numerator,
  1::int   AS denominator,
  PERCENTILE_CONT(0.95) WITHIN GROUP (
    ORDER BY (properties->>'duration_ms')::int
  ) AS p95_ms_observed
FROM user_events
WHERE created_at >= NOW() - INTERVAL '5 minutes'
  AND event_type = 'ai_analyzer_run'
  AND properties ? 'duration_ms';
```

**Window function (30-day slow burn — % of windows passed):**
```sql
-- SLO 6 — AI analyzer P95 — 30-day window-vote roll-up
SELECT
  SUM(numerator)::int                            AS numerator,
  COUNT(*) FILTER (WHERE denominator > 0)::int   AS denominator
FROM slo_burn_history
WHERE slo_id = 'slo_6'
  AND window_end >= NOW() - INTERVAL '30 days';
```

**Error budget remaining:**
```
target_pass_rate = 0.90       -- "10% of windows can exceed 12s" per SLO_SPEC line 104
budget_remaining_ratio = 1 - ((1 - ratio_30d_window_pass) / 0.10)
```

**Caveats:**
- LLM upstreams (Claude / GPT) dominate latency. Network blip ≠ our bug;
  consider tagging `properties.upstream_5xx = true` so future versions
  can exclude vendor-side failures from the SLO.
- See §5 for the minimum instrumentation to unblock.

---

### SLO 7 — Email outreach delivery

- **Target:** 98% over 30-day window (`SLO_SPEC.md` §SLO 7).
- **Data source:** **[BLOCKED-ON: Resend webhook ingestion table]**.
  Today `aiwholesail-api/lib/funnel-stats.js` line 115 fetches
  `https://api.resend.com/emails` on demand for the digest, but we
  don't persist Resend's `email.delivered` / `email.bounced` /
  `email.complained` webhook events to our DB. Without persistence,
  this SLO cannot be a periodic cron job — it'd hit Resend's API every
  5 min, costly and rate-limited.

**SLI calculation (24-hour window per `SLO_SPEC.md` line 110, once
ingestion exists):**
```sql
-- SLO 7 — Email outreach delivery — 24h window
-- [BLOCKED-ON: resend_email_events table — see §5]
SELECT
  COUNT(*) FILTER (WHERE event_type = 'email.delivered')::int  AS numerator,
  COUNT(*) FILTER (WHERE event_type IN (
    'email.delivered', 'email.bounced', 'email.complained', 'email.failed'
  ))::int                                                       AS denominator
FROM resend_email_events
WHERE created_at >= NOW() - INTERVAL '24 hours';
```

**Window function (30-day slow burn):**
```sql
-- SLO 7 — Email outreach delivery — 30-day rolling
SELECT
  COUNT(*) FILTER (WHERE event_type = 'email.delivered')::int  AS numerator,
  COUNT(*) FILTER (WHERE event_type IN (
    'email.delivered', 'email.bounced', 'email.complained', 'email.failed'
  ))::int                                                       AS denominator
FROM resend_email_events
WHERE created_at >= NOW() - INTERVAL '30 days';
```

**Error budget remaining:**
```
budget_remaining_ratio = 1 - ((1 - ratio_30d) / (1 - 0.98))
                       = 1 - ((1 - ratio_30d) / 0.02)
```

**Caveats:**
- Only count outreach emails (`Buyer Outreach`, `Sequence Step N`), not
  transactional (`email_verify`, `password_reset`). Add an
  `email_kind = 'outreach'` filter once we tag events with that field.
- A `bounced` is a delivery failure; a `complained` (spam) is a
  reputation problem, but for SLO 7 both count against the SLI.

---

### SLO 8 — Overall API availability

- **Target:** 99.5% over 30-day window (`SLO_SPEC.md` §SLO 8).
- **Data source:** **[BLOCKED-ON: per-request access log persistence]**.
  `aiwholesail-api/index.js:140` runs `morgan('combined')` which writes
  to stdout, captured by `journalctl -u aiwholesail-api`. Not queryable
  from Postgres. We need an `api_request_log` table populated by a thin
  Express middleware (similar pattern to `scrape_provider_metrics`'s
  fire-and-forget insert).

**SLI calculation (5-min window — after middleware lands):**
```sql
-- SLO 8 — Overall API availability — 5-min window
-- [BLOCKED-ON: api_request_log table populated by middleware]
SELECT
  COUNT(*) FILTER (WHERE status_code BETWEEN 200 AND 499)::int  AS numerator,
  COUNT(*)::int                                                  AS denominator
FROM api_request_log
WHERE created_at >= NOW() - INTERVAL '5 minutes'
  AND request_path NOT IN ('/api/auth/refresh', '/api/auth/me');
```

**Window function (30-day slow burn):**
```sql
-- SLO 8 — Overall API availability — 30-day rolling
SELECT
  COUNT(*) FILTER (WHERE status_code BETWEEN 200 AND 499)::int  AS numerator,
  COUNT(*)::int                                                  AS denominator
FROM api_request_log
WHERE created_at >= NOW() - INTERVAL '30 days'
  AND request_path NOT IN ('/api/auth/refresh', '/api/auth/me');
```

**Error budget remaining:**
```
budget_remaining_ratio = 1 - ((1 - ratio_30d) / (1 - 0.995))
                       = 1 - ((1 - ratio_30d) / 0.005)
```

**Caveats:**
- `/api/auth/refresh` and `/api/auth/me` are excluded per `SLO_SPEC.md`
  line 118 — they have their own SLOs (1, 2) and including them would
  double-count and skew the headline number.
- Treat anything `>= 500` as the failure class. `499` (client closed
  connection) is the user bailing, not our fault.
- Exclude health probes (`/health`) and Prometheus scrape paths if/when
  we add a metrics endpoint, or they'll lift the ratio artificially.

---

## 2. Burn-rate alert queries

Per `SLO_SPEC.md` §Alert Rules. Each query is the **truthy condition** —
the cron raises the alert when the predicate at the bottom holds.

### C1 — `api.aiwholesail.com` unreachable

Out of scope for Postgres — this is an external uptime probe
(`SLO_SPEC.md` line 170: "External uptime monitor / Better Stack").
No SQL applies. Listed here for completeness.

### C2 — SLO 8 burn-rate critical (overall API)

`SLO_SPEC.md` line 174: 14.4% of 30-day error budget consumed in last 1h
(= 2-hour-to-full-burn).

```sql
-- C2 — Overall API burn-rate critical
-- [BLOCKED-ON: api_request_log — same dependency as SLO 8]
WITH last_hour AS (
  SELECT
    COUNT(*) FILTER (WHERE status_code >= 500)::numeric AS errors,
    COUNT(*)::numeric                                    AS total
  FROM api_request_log
  WHERE created_at >= NOW() - INTERVAL '1 hour'
    AND request_path NOT IN ('/api/auth/refresh', '/api/auth/me')
)
SELECT
  (errors / NULLIF(total, 0))::numeric AS error_rate_1h,
  -- Threshold: 14.4 × the 30-day allowed error rate (1 - 0.995 = 0.005)
  CASE
    WHEN total > 0 AND (errors / total) > (14.4 * 0.005) THEN true
    ELSE false
  END AS fires
FROM last_hour;
-- Alert when fires = true.
```

### C3 — Auth subsystem failure (SLO 2 burn-rate)

`SLO_SPEC.md` line 179: >5% of authenticated requests return 401 with
valid-format JWT in last 5-min window.

```sql
-- C3 — Auth 401 storm
-- Uses auth_zombie_events as the well-formed-JWT-but-401 signal.
-- Denominator is the active-session proxy from SLO 2.
WITH zombies AS (
  SELECT COUNT(*)::numeric AS n FROM auth_zombie_events
  WHERE created_at >= NOW() - INTERVAL '5 minutes'
),
active_sessions AS (
  SELECT GREATEST(COUNT(DISTINCT user_id) * 5, 1)::numeric AS n
  FROM sessions WHERE NOT revoked AND expires_at > NOW()
)
SELECT
  (zombies.n / active_sessions.n) AS zombie_rate_5m,
  ((zombies.n / active_sessions.n) > 0.05) AS fires
FROM zombies, active_sessions;
-- Alert when fires = true.
```

### C4 — Zombie session

`SLO_SPEC.md` line 183: ≥1 unique user fires zombie within 60 min.
This is the canonical query and lifts the example from the task brief:

```sql
-- C4 — Zombie session
-- Alerts when >= 1 unique JWT-user-id appears in the last 60 minutes
SELECT COUNT(DISTINCT jwt_user_id)::int AS unique_users_with_zombies
FROM auth_zombie_events
WHERE created_at >= NOW() - INTERVAL '60 minutes';
-- Alert when result > 0.
```

### W1 — Scrape.do success rate dropping

`SLO_SPEC.md` line 189: scrape.do 60-min success rate <90% for
`scrape-do-zillow`.

```sql
-- W1 — Scrape.do success rate dropping
SELECT
  COUNT(*) FILTER (WHERE success = true)::numeric AS ok,
  COUNT(*)::numeric                                AS total,
  (
    COUNT(*) FILTER (WHERE success = true)::numeric
    / NULLIF(COUNT(*), 0)
  ) AS success_rate_60m,
  (
    COUNT(*) > 10  -- minimum sample size to avoid flapping on quiet hours
    AND (COUNT(*) FILTER (WHERE success = true)::numeric / COUNT(*)) < 0.90
  ) AS fires
FROM scrape_provider_metrics
WHERE created_at >= NOW() - INTERVAL '60 minutes'
  AND provider = 'scrape-do-zillow';
-- Alert when fires = true.
```

### W2 — Captcha-retry frequency >10% of calls

`SLO_SPEC.md` line 193 references a `render_retry` flag. That column
does **not** exist on `scrape_provider_metrics` today (migration 020),
so we proxy via `error_excerpt LIKE '%captcha%'` for now.

```sql
-- W2 — Captcha-retry frequency (proxy via error_excerpt)
-- [BLOCKED-ON: render_retry boolean column on scrape_provider_metrics]
SELECT
  COUNT(*) FILTER (WHERE error_excerpt ILIKE '%captcha%')::numeric AS captchas,
  COUNT(*)::numeric                                                  AS total,
  (
    COUNT(*) > 20
    AND (COUNT(*) FILTER (WHERE error_excerpt ILIKE '%captcha%')::numeric / COUNT(*)) > 0.10
  ) AS fires
FROM scrape_provider_metrics
WHERE created_at >= NOW() - INTERVAL '60 minutes'
  AND provider = 'scrape-do-zillow';
-- Alert when fires = true.
```

### W3 — Field-presence rate dropping (Tier A regression)

`SLO_SPEC.md` line 197: smoke-test weekly run reports <80% of Tier A
fields populated. This is **outside Postgres** — it lives in the smoke
test harness output. No SQL applies.

---

## 3. Postgres helper table — `slo_burn_history`

Append-only history table that the SLO cron writes one row per
(slo_id, window) tuple into. Indexes match the dashboard's lookup
patterns ("most recent window per SLO" and "30-day window aggregation").

```sql
-- Migration: 0XX — slo_burn_history
--
-- Append-only history of SLO window evaluations. One row per
-- (slo_id, window_end) tuple. The cron at scripts/slo-evaluator.js
-- writes here; Grafana / the exec dashboard reads from here.
--
-- The `ratio` generated column gives consumers a safe pre-divided value
-- without re-deriving it in every dashboard panel. NULL when no traffic.

CREATE TABLE IF NOT EXISTS slo_burn_history (
  id BIGSERIAL PRIMARY KEY,
  -- 'slo_1' through 'slo_8' — keep the vocabulary tight, no free-form
  slo_id TEXT NOT NULL,
  window_start TIMESTAMPTZ NOT NULL,
  window_end   TIMESTAMPTZ NOT NULL,
  numerator   INTEGER NOT NULL,
  denominator INTEGER NOT NULL,
  ratio NUMERIC GENERATED ALWAYS AS (
    CASE
      WHEN denominator = 0 THEN NULL
      ELSE numerator::numeric / denominator
    END
  ) STORED,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT slo_burn_history_slo_id_check
    CHECK (slo_id IN ('slo_1','slo_2','slo_3','slo_4','slo_5','slo_6','slo_7','slo_8')),
  CONSTRAINT slo_burn_history_denom_nonneg CHECK (denominator >= 0),
  CONSTRAINT slo_burn_history_num_nonneg   CHECK (numerator   >= 0),
  CONSTRAINT slo_burn_history_window_order CHECK (window_end > window_start)
);

-- Hot path: "most recent N windows for this SLO" — dashboard tile.
CREATE INDEX IF NOT EXISTS idx_slo_burn_history_slo_window
  ON slo_burn_history (slo_id, window_end DESC);

-- Cross-cohort: "30-day aggregate roll-up across all SLOs" — exec view.
CREATE INDEX IF NOT EXISTS idx_slo_burn_history_window_end
  ON slo_burn_history (window_end DESC);

-- Idempotency guard: prevent double-writing the same (slo_id, window_end)
-- tuple if the cron retries.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_slo_burn_history_slo_window
  ON slo_burn_history (slo_id, window_end);

-- Lessons-learned from PR #131: migrations are run as the postgres
-- superuser, but the API connects as `aiwholesail`. Without an explicit
-- GRANT, every read/write fails with "permission denied". Both the
-- table AND its sequence need to be granted, otherwise INSERTs fail
-- on nextval().
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'aiwholesail') THEN
    GRANT SELECT, INSERT ON slo_burn_history TO aiwholesail;
    GRANT USAGE, SELECT ON SEQUENCE slo_burn_history_id_seq TO aiwholesail;
  END IF;
END$$;
```

### Helper view — current state per SLO

Optional convenience view for the Grafana panels in Row 2:

```sql
CREATE OR REPLACE VIEW slo_current_state AS
SELECT DISTINCT ON (slo_id)
  slo_id,
  window_start,
  window_end,
  numerator,
  denominator,
  ratio,
  computed_at
FROM slo_burn_history
ORDER BY slo_id, window_end DESC;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'aiwholesail') THEN
    GRANT SELECT ON slo_current_state TO aiwholesail;
  END IF;
END$$;
```

---

## 4. Cron schedule

Recommended cron expressions for `scripts/slo-evaluator.js` (to be
written in a follow-up PR). All times UTC; expressions assume a single
worker on hetznerCO via systemd timer.

| SLO | Window | Cron | Rationale |
|-----|--------|------|-----------|
| SLO 1 fast | 5-min | `*/5 * * * *` | Sub-5-min detection for sign-in outages. |
| SLO 1 slow | 30-day | `0 * * * *` | Hourly is plenty; 30d barely moves. |
| SLO 2 fast | 5-min | `*/5 * * * *` | Zombie-session is the cpodea5 watchpoint. |
| SLO 2 slow | 7-day | `0 * * * *` | Hourly. |
| SLO 3 fast | 5-min | `*/5 * * * *` | Latency degradations are sub-5-min. |
| SLO 3 slow | 30-day | `15 * * * *` | Hourly, offset so SLO crons don't pile up. |
| SLO 4 fast | 5-min | `*/5 * * * *` | Same cadence as the underlying scrape metrics. |
| SLO 4 slow | 7-day | `0 * * * *` | |
| SLO 5 fast | 60-min | `*/15 * * * *` | Aligns with hourly health-monitor; 15-min granularity. |
| SLO 5 slow | 7-day | `0 * * * *` | |
| SLO 6 fast | 5-min | `*/5 * * * *` | Same as other fast burns. |
| SLO 6 slow | 30-day | `30 * * * *` | Hourly, offset. |
| SLO 7 fast | 24-hour | `0 */4 * * *` | Email delivery only meaningful on 24h windows. |
| SLO 7 slow | 30-day | `0 6 * * *` | Once a day at 06:00 UTC, before the digest. |
| SLO 8 fast | 5-min | `*/5 * * * *` | Headline number; cheap. |
| SLO 8 slow | 30-day | `45 * * * *` | Hourly, offset. |

Notes:
- **Stagger the hourly jobs** (`:00`, `:15`, `:30`, `:45`) so we don't
  pile load onto Postgres in the same minute.
- The single 5-min cron should evaluate all fast SLOs in **one
  transaction** — bundling avoids 6 separate connections per tick.
- 30-day rolls are cheap because they read from `slo_burn_history`
  (already aggregated), not the raw event tables.

---

## 5. Data gaps

Honest inventory of what we **can** vs **can't** compute today against
the eight SLOs.

### Computable today (zero new instrumentation)
- **SLO 4** — Property search success rate. `scrape_provider_metrics`
  has it directly. ✅
- **SLO 5** — Scrape.do provider availability. Same source. ✅
- **C4** alert — Zombie session unique-user count.
  `auth_zombie_events` once migration 022 lands (parallel agent
  P1.2). ✅

### Computable with proxies (acceptable until §below lands)
- **SLO 2** — Authenticated request success. Uses
  `auth_zombie_events` numerator + `sessions` proxy denominator.
  Honest ratios will require the access-log persistence below.
- **SLO 3** — Search latency P95. Captures upstream scraper time, not
  the full HTTP round trip. Good enough because scrape.do dominates.

### Blocked

#### [BLOCKED-ON: sign-in events in `user_events`] — SLO 1
**What's missing:** `routes/auth.js` updates `users.last_sign_in` on
success but never writes to `user_events`, and `lib/events.js` doesn't
declare `SIGN_IN_ATTEMPT` / `SIGN_IN_SUCCESS` / `SIGN_IN_FAILED`
constants.
**Minimum addition:**
1. Add three constants to `EVENTS` in `aiwholesail-api/lib/events.js`.
2. In `routes/auth.js`'s `POST /signin` (and `POST /signin/verify` if
   2FA): call `logEvent(userId, EVENTS.SIGN_IN_ATTEMPT, …)` at request
   entry, then either `SIGN_IN_SUCCESS` or `SIGN_IN_FAILED` at exit
   (capture `reason: 'bad_password' | 'unverified_email' | …`).
3. Re-use `isSyntheticEmail()` to skip e2e test emails.
**Cost:** ~15 LOC. Unblocks SLO 1 entirely.

#### [BLOCKED-ON: per-request access log persistence] — SLO 8, SLO 2 (full), C2
**What's missing:** `morgan('combined')` writes to stdout; nothing
persists status/path/latency to Postgres.
**Minimum addition:** A new migration `029_api_request_log.sql`
defining:
```sql
CREATE TABLE api_request_log (
  id BIGSERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  method VARCHAR(8) NOT NULL,
  request_path TEXT NOT NULL,
  status_code SMALLINT NOT NULL,
  duration_ms INTEGER,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  client_ip INET
);
CREATE INDEX ON api_request_log (created_at DESC);
CREATE INDEX ON api_request_log (request_path, created_at DESC);
-- GRANT block.
```
Plus a thin Express middleware that fire-and-forgets the insert on
`res.on('finish')` (same pattern as `lib/observability/scrapeMetrics.js`).
Filter out `/health`, static assets, and the metrics endpoint.
**Cost:** ~40 LOC + 1 migration. **This is the highest-leverage
addition — it unblocks SLO 8, fully replaces the proxy denominator in
SLO 2, and enables C2.**

#### [BLOCKED-ON: AI analyzer duration logging] — SLO 6
**What's missing:** `routes/ai.js` line 450 calls
`logEvent(req.user.id, EVENTS.AI_ANALYZER_RUN, { … })` without a
`duration_ms` field.
**Minimum addition:** Wrap the LLM call in
`const t0 = Date.now(); …; properties.duration_ms = Date.now() - t0;`
before the `logEvent` call. Same pattern for `EVENTS.AI_PROPERTY_ANALYSIS`,
`AI_RANK_DEALS`, `AI_RANK_COMPS`, `AI_LISTING_DESC` for consistency.
**Cost:** ~3 LOC per call site (~6 call sites).

#### [BLOCKED-ON: Resend webhook ingestion] — SLO 7
**What's missing:** Resend's outbound webhooks (`email.delivered`,
`email.bounced`, `email.complained`, `email.opened`, `email.clicked`)
aren't ingested. `lib/funnel-stats.js` pulls on-demand from Resend's
API; not viable as a 5-min cron.
**Minimum addition:**
1. Migration `030_resend_email_events.sql`:
   ```sql
   CREATE TABLE resend_email_events (
     id BIGSERIAL PRIMARY KEY,
     created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
     resend_email_id TEXT NOT NULL,
     event_type TEXT NOT NULL,   -- 'email.delivered' | 'email.bounced' | …
     email_kind TEXT,            -- 'outreach' | 'transactional' | 'digest'
     to_email TEXT,
     payload JSONB
   );
   CREATE INDEX ON resend_email_events (resend_email_id);
   CREATE INDEX ON resend_email_events (event_type, created_at DESC);
   ```
2. New route `POST /api/webhooks/resend` that verifies Resend's
   signing secret and inserts the event. Tag `email_kind` at
   `resend.emails.send()` time via `headers['X-Email-Kind']` so the
   webhook handler knows which bucket to attribute.
**Cost:** ~80 LOC + 1 migration + Resend dashboard config. Unblocks
SLO 7 entirely.

#### [BLOCKED-ON: `render_retry` column] — W2
**What's missing:** `scrape_provider_metrics` lacks a `render_retry`
boolean. Today we proxy via `error_excerpt ILIKE '%captcha%'`.
**Minimum addition:** `ALTER TABLE scrape_provider_metrics ADD
COLUMN render_retry BOOLEAN NOT NULL DEFAULT FALSE;` and update the
zillowScrapeDo scraper to set it when the captcha-render path fires.
**Cost:** ~10 LOC. Low priority — the proxy is acceptable.

### Single highest-leverage missing data source

**`api_request_log` (per-request access log persistence)** is the
clear winner. It unblocks SLO 8, fully unblocks SLO 2, enables the C2
critical alert, and incidentally makes every future "what was happening
at 14:32 UTC?" triage question answerable from a SQL prompt instead of
`journalctl` grepping.

---

## Implementation notes for the cron

When `scripts/slo-evaluator.js` is written (next PR), it should:

1. Open one transaction per 5-min tick, run all fast-SLO queries inside
   it, and `INSERT … ON CONFLICT (slo_id, window_end) DO NOTHING` into
   `slo_burn_history`. The unique index in §3 makes this idempotent.
2. Skip the BLOCKED SLOs (1, 6, 7, 8) until their data sources land —
   either by hard-coding a feature flag or by checking
   `to_regclass('api_request_log') IS NOT NULL` before running.
3. Emit a single log line per tick:
   `slo_evaluator tick=2026-05-10T14:00 wrote=4 skipped=4 took_ms=312`.
4. On any per-SLO query failure, **log and continue** to the next SLO.
   One bad query must never block the rest of the rollup — same
   fire-and-forget ethos as `lib/observability/scrapeMetrics.js`.
