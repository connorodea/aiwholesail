# AIWholesail Observability Spec — SLOs / Alerts / Runbooks

**Status:** Draft — informed by 2026-05-14 cpodea5 incident + prior PROD-DOWN events (PR #321 CORS, #348 www→apex, #356 SecurityMonitor loop).
**Owner:** Connor / on-call
**Last updated:** 2026-05-14

## Why this exists

aiwholesail.com is a production SaaS with paying customers. The session shipped 8 PRs in ~12 hours including a P1 production fix (cpodea5 zombie session). That fix happened because **a real user reported the broken state** — not because instrumentation caught it.

Current observability covers infrastructure (CPU, memory, disk, scrape.do success rate) but has zero coverage of:

1. Frontend auth state divergence (zombie-session class of bugs)
2. API endpoint error rates per route
3. Real-time SLO burn-rate alerting
4. Per-user incident detection (one user broken → silent fail)

This spec defines the SLI/SLO catalog, alert rules, and runbook stubs needed to catch the next cpodea5-class incident in <5 minutes rather than waiting for a customer email.

---

## Current state — what's already in place

### Metrics infrastructure
- **`scrape_provider_metrics` table** (migration 020) — every Zillow/TPS call logged with provider, action, callKind, success, duration_ms, error_excerpt. Fire-and-forget insert via `setImmediate` so writes never block user requests.
- **`/health` endpoint** at `api.aiwholesail.com/health` — checks DB + Redis liveness. Returns 200/503.
- **PostHog Cloud** (PR #222) — frontend event analytics. Tracks pageviews, sign-ups, conversions.
- **Meta CAPI** — server-side conversion events.

### Reactive monitoring
- **`scripts/health-monitor.js`** — runs hourly via systemd timer. 13 signals checked:
  1. API `/health` endpoint
  2. Frontend reachability
  3. Database `SELECT 1`
  4. Recent-signup count (24h)
  5. Blog-bot freshness (12h gap tolerance)
  6. systemd timer states
  7. systemd service failures (last hour)
  8. Disk usage (warn 80%, fail 92%)
  9. Memory usage (warn 85%, fail 95%)
  10. Load average (warn 4.0, fail 8.0)
  11. `SCRAPE_DO_API_TOKEN` env var presence
  12. scrape.do 60-min success rate (warn <90%, fail <70%)
  13. Feature flag rollouts at 100%
- Emails operator if any signal fails OR ≥2 warn. Daily green-ping at 09:00 UTC.

### What's MISSING
- Sub-hourly detection of incidents
- Per-endpoint error-rate tracking on `aiwholesail-api`
- Frontend error tracking (no Sentry/Datadog FE SDK)
- Auth-state divergence detection (zombie session)
- SLO error budget / burn-rate alerts
- Dashboards (just hourly digest emails)
- Distributed tracing across frontend → API → scrape.do → upstream

---

## SLI / SLO Catalog

Eight SLOs spanning the four user journeys that matter: **authenticate, search, analyze, dispo**.

### Auth journey

#### SLO 1 — Sign-in availability
- **SLI:** `count(success_sign_in_attempts) / count(all_sign_in_attempts)` over 5-min windows
- **Target:** 99.5% over 30-day rolling window
- **Error budget:** 0.5% = ~3.6 hours/month of degraded sign-in
- **Why this number:** signing in is the gate to every paying-feature use. Lower than 99.5% is "users routinely can't get in"; higher than 99.5% blocks improvements with marginal risk.

#### SLO 2 — Authenticated request success (NOT 401 zombie state)
- **SLI:** `count(authenticated_2xx_or_4xx_business) / count(authenticated_requests_with_session_cookie)` over 5-min windows
  Excludes 401s that fired because token was expired AND user signed back in (legit auth expiry).
  Includes 401s that fired while the frontend still rendered the user as signed in (zombie state).
- **Target:** 99.9% over 7-day rolling window
- **Error budget:** ~10 min/week of unauthorized-when-should-be-authorized requests
- **Why this number:** zombie session is the cpodea5 class of bug. The slack-of-error-budget triggers an alert BEFORE customer reports come in.

### Search / scraper journey

#### SLO 3 — Property search latency (p95)
- **SLI:** P95 wall-clock time for `/api/zillow/proxy?action=search` from request to response
- **Target:** P95 < 4s over 30-day rolling window (90% of windows)
- **Error budget:** 10% of 5-min windows can exceed 4s
- **Why this number:** users tolerate 4s for a property search; >8s is "broken." Scrape.do + Zillow path is realistically 2-6s.

#### SLO 4 — Property search success rate
- **SLI:** `count(search_returned_results | search_returned_empty_legitimately) / count(search_requests)` over 5-min windows
  "Legitimate empty" = Zillow returned 0 listings for the location, NOT scraper error.
- **Target:** 99% over 7-day window
- **Error budget:** ~100 min/week of broken searches
- **Why this number:** scrape.do can hit transient captcha; even with retry-on-render, a small slice fails. 99% is realistic, 99.9% would over-tune.

#### SLO 5 — Scrape.do provider availability
- **SLI:** `count(scrape_provider_metrics WHERE success=true AND provider='scrape-do-zillow') / count(scrape_provider_metrics WHERE provider='scrape-do-zillow')` over 60-min windows
- **Target:** 95% over 7-day window
- **Error budget:** 5% = ~9 hours/week of degraded scrape.do (RapidAPI fallback handles)
- **Why this number:** scrape.do is third-party; we cannot guarantee their uptime. The existing health-monitor uses 90%/70% — this SLO ratchets to 95% baseline since RapidAPI fallback should absorb the difference invisibly.

### Analyze journey

#### SLO 6 — AI deal analyzer response time
- **SLI:** P95 wall-clock time for `/api/ai/analyze` endpoint
- **Target:** P95 < 12s
- **Error budget:** 10% of windows can exceed 12s
- **Why this number:** Claude/GPT call takes 8-15s for a comprehensive analysis. Users tolerate this *if* they see a loading state. >15s = abandon.

### Dispo / outreach journey

#### SLO 7 — Email outreach delivery rate
- **SLI:** `count(sent_emails WHERE delivered=true) / count(send_attempts)` over 24h windows
- **Target:** 98% over 30-day window
- **Error budget:** 2% bounces/failures
- **Why this number:** outreach Phase 1-5 just shipped. Below 98% suggests sender reputation problems (SPF/DKIM drift, IP blocklisting).

### Cross-cutting

#### SLO 8 — Overall API availability
- **SLI:** `count(api_responses_2xx_or_4xx) / count(api_requests)` excluding `/api/auth/refresh` and `/api/auth/me` (those have their own SLOs)
- **Target:** 99.5% over 30-day rolling window
- **Error budget:** ~3.6 hours/month of any-endpoint 5xx storm

### RapidAPI gateway (`/rapidapi/zillow/*`) — external paying consumers

This mount was added 2026-05-14 (PR #389, env-gated default off; companion repo:
[connorodea/aiwholesail-rapidapi](https://github.com/connorodea/aiwholesail-rapidapi)).
Distinct SLO bands from the frontend `/api/*` paths because the audience is
**paying RapidAPI consumers** with SLA-style expectations — a flaky listing
gets one-star reviews on the marketplace and we never recover the reputation.

#### SLO 9 — RapidAPI gateway availability
- **SLI:** `count(rapidapi_responses_2xx_or_4xx_excl_401_403) / count(rapidapi_requests)` on `/rapidapi/zillow/*` only
- **Target:** **99.0%** over 30-day rolling window
- **Error budget:** ~7.2 hours/month of 5xx storms. Tighter than SLO 8 because consumers can see our error rate on the RapidAPI provider dashboard.
- **Why 4xx (excluding 401/403) counts as success:** consumer sent bad request (400) or hit a real "no data" upstream — that's their problem, not our reliability. 401/403 mean OUR gateway gate is wrong; those count against us.

#### SLO 10 — RapidAPI gateway latency
- **SLI:** p95 of `/rapidapi/zillow/proxy` end-to-end response time
- **Target:** **≤ 3 seconds** over 7-day rolling window. p99 ≤ 8s.
- **Why 3s:** Zillow's underlying scrape can take 1–2s on a cold cache; the scrape.do→RapidAPI fallback chain adds a tail. 3s gives headroom while staying competitive — the apimaker/datascraper listings at $8–$9 entry advertise sub-1s but reality is ~2s.

---

## Golden Signals — Dashboard Spec

One Grafana / PostHog dashboard per service surface. Each follows the **RED method** (Rate, Errors, Duration) + saturation.

### Dashboard 1 — `aiwholesail-api` (Express on port 3202)

**Layout (4 rows × 3 panels each = 12 panels):**

**Row 1 — Headline (always-visible at top)**
- Panel 1: Request rate, last 1h (line chart, RPM per endpoint top 5)
- Panel 2: Error rate, last 1h (line chart, 4xx + 5xx % stacked)
- Panel 3: P50/P95/P99 latency, last 1h (line chart)

**Row 2 — SLO burn-down**
- Panel 4: SLO 1 (Sign-in) — remaining error budget gauge (30-day window)
- Panel 5: SLO 2 (Authenticated requests) — remaining error budget gauge (7-day)
- Panel 6: SLO 8 (Overall API) — remaining error budget gauge (30-day)

**Row 3 — Auth subsystem (cpodea5 watchpoint)**
- Panel 7: 401-rate on authenticated routes (line chart, last 24h)
- Panel 8: Token-refresh failure rate (line chart, last 24h)
- Panel 9: `NOT_AUTHENTICATED`-toast events from frontend (PostHog event count, last 24h) — proxy for zombie-session

**Row 4 — Scrape.do health**
- Panel 10: Scrape.do success rate by action (heatmap, last 24h, x=hour, y=action)
- Panel 11: Captcha-retry frequency (5x cost) (line chart, last 7d)
- Panel 12: P95 scrape duration by action (line chart, last 24h)

### Dashboard 3 — RapidAPI gateway (paying-consumer view)

Distinct dashboard because the audience and stop-the-world threshold are
different from internal API monitoring. SREs glance at Dashboard 1; this
one we open during a RapidAPI revenue spike or a one-star review.

**Layout (3 rows × 3 panels = 9 panels):**

**Row 1 — Consumer-facing headline**
- Panel R1: Request rate by `x-rapidapi-user` top 10 (last 24h, line) — who's hammering us
- Panel R2: 2xx / 4xx / 5xx breakdown stacked (last 24h)
- Panel R3: SLO 9 remaining error budget gauge (30-day)

**Row 2 — Latency**
- Panel R4: p50 / p95 / p99 latency on `/rapidapi/zillow/proxy` (last 24h, line)
- Panel R5: SLO 10 error budget burn (7-day, gauge)
- Panel R6: p95 broken out by action (heatmap, last 24h, x=hour, y=action) — propertyDetails vs zestimate vs search etc.

**Row 3 — Per-consumer breakdown**
- Panel R7: Top 10 consumers by 5xx rate (table, last 24h) — who's seeing problems
- Panel R8: Top 10 consumers by 403 rate (table) — quota-capped, upsell candidates
- Panel R9: Revenue proxy — successful calls × pricing-tier-blended-cost (line, last 30d)

### Dashboard 2 — Frontend (PostHog-derived)

- Sign-in success rate (events: `sign_in_attempt`, `sign_in_success`, `sign_in_failed`)
- Property-search abandonment funnel (search → result-load → modal-open → contact-click)
- `NOT_AUTHENTICATED` toast frequency by user (count + unique users) — **alerts on >1 unique user/hour**
- Trial-conversion funnel
- Feature-flag rollout impact (Tier B2 endpoint usage)

---

## Alert Rules

Three severity levels per the skill's framework. Every alert has a runbook link.

### Critical — page on-call immediately

#### C1 — `api.aiwholesail.com` unreachable
- **Condition:** `/health` returns non-200 for 3 consecutive 30-second probes
- **Source:** External uptime monitor (currently health-monitor.js, future: UptimeRobot or BetterStack)
- **Action:** Page Connor. Runbook: `runbooks/api-down.md`

#### C2 — SLO 8 burn-rate critical (overall API)
- **Condition:** 14.4% of 30-day error budget consumed in last 1 hour (= 2-hour-to-full-burn rate)
- **Source:** scrape_provider_metrics + access logs aggregate
- **Action:** Page Connor. Runbook: `runbooks/api-error-storm.md`

#### C3 — Auth subsystem failure (SLO 2 burn-rate)
- **Condition:** >5% of authenticated requests return 401 with valid-format JWT in last 5-min window
- **Action:** Page Connor. Runbook: `runbooks/auth-401-storm.md`. Likely causes: rotated signing key, expired access tokens en masse, /api/auth/refresh broken.

#### C4 — Frontend zombie-session incident
- **Condition:** >1 unique user fires `NOT_AUTHENTICATED` toast in a 60-min window while their PostHog session has `user_id` set
- **Action:** Page Connor. Runbook: `runbooks/zombie-session.md` — the exact cpodea5 pattern. PR #376's self-heal should make this self-recovering, but a spike means the ingress path is firing.

#### C5 — RapidAPI gateway 503 (proxy-secret unset)
- **Condition:** any `/rapidapi/zillow/*` request returns 503 with body containing `"Gateway not configured"`
- **Source:** access log + body parse (the middleware logs `[rapidapi-proxy-secret] RAPIDAPI_PROXY_SECRET not set` to stderr)
- **Action:** Page Connor. **Means `RAPIDAPI_PROXY_SECRET` got unset in prod `.env`** — usually after a deploy that overwrote the file, or someone manually edited and dropped the line. Fix: `ssh hetznerCO`, restore `RAPIDAPI_PROXY_SECRET=…` from the RapidAPI dashboard's Firewall Settings, `pm2 reload`. Runbook: `runbooks/rapidapi-gateway.md`.
- **Why critical:** every consumer call returns 503 until fixed → consumers leave one-star reviews. Time-to-resolve directly hits revenue.

#### C6 — RapidAPI SLO 9 burn-rate critical
- **Condition:** 14.4% of 30-day error budget consumed in last 1 hour (2-hour burn rate)
- **Source:** access logs aggregate on `/rapidapi/zillow/*` 5xx
- **Action:** Page Connor. Runbook: `runbooks/rapidapi-gateway.md` § failure-modes. Common cause: scrape.do + RapidAPI fallback both unhealthy (correlate with SLO 4 / W1).

### Warning — operator-aware, not paging

#### W1 — Scrape.do success rate dropping
- **Condition:** scrape.do 60-min success rate <90% for `scrape-do-zillow` provider
- **Action:** Email Connor. RapidAPI fallback should be absorbing this — confirm.

#### W2 — Captcha-retry frequency >10% of calls
- **Condition:** `scrape_provider_metrics` shows `render_retry=true` on >10% of calls in last 60 min
- **Action:** Email Connor. 5x cost multiplier — operationally expensive. Worth investigating if Zillow tightened anti-bot.

#### W3 — Field-presence rate dropping (Tier A regression)
- **Condition:** Smoke-test weekly run reports <80% of Tier A fields populated on the canonical ZPID basket
- **Action:** Email Connor. Zillow may have changed `__NEXT_DATA__` shape.

#### W4 — Disk/memory/load over threshold
- **Existing health-monitor signals 8-10.** Keep as-is.

#### W5 — Blog/SEO bot stalled
- **Existing signal 5.** Keep as-is.

#### W6 — RapidAPI 401 storm (proxy-secret mismatch)
- **Condition:** >20% of `/rapidapi/zillow/*` requests in last 15 min return 401 from our middleware (NOT from RapidAPI's gateway — distinguish via response body shape: ours = `{"success":false,"error":"Invalid or missing proxy secret"}`, theirs = `{"message":"…"}`)
- **Action:** Email Connor. **Means the proxy secret in our prod `.env` doesn't match what RapidAPI's gateway is sending** — happens when one side rotated and the other didn't. Investigate within 1h. Runbook: `runbooks/rapidapi-gateway.md` § rollback.

#### W7 — RapidAPI gateway p95 latency degraded
- **Condition:** p95 of `/rapidapi/zillow/proxy` > 5s for 15 min sustained (SLO 10's threshold + 67% headroom for noise)
- **Action:** Email Connor. Usually correlates with scrape.do degradation (W1). If scrape.do is healthy, look at the RapidAPI fallback path — it's the slow leg of the chain.

#### W8 — RapidAPI consumer drained their quota (informational alert)
- **Condition:** RapidAPI 403 rate >10% of total `/rapidapi/zillow/*` in last hour
- **Action:** Email Connor — **not** an outage. Means consumers are hitting their plan quotas; consider pricing-tier adjustment if a single consumer is repeatedly capped (revenue signal — upsell opportunity).

### Info — log only, no notification

#### I1 — Deployment events
- Emit on each `main` push that triggers deploy. Useful for correlating spikes to deploys.

#### I2 — Feature-flag rollout changes
- Existing signal 13.

#### I3 — New error class observed
- First time a new `error_excerpt` string appears in `scrape_provider_metrics` in 7 days. Helps catch upstream API changes early.

---

## Runbook Stubs (high-priority — to be filled in next pass)

#### `runbooks/rapidapi-gateway.md`
**Already exists** as of PR #389 — see `docs/runbooks/rapidapi-gateway.md`.
Covers roll-out, smoke-test, observability, and rollback for the
`/rapidapi/zillow/*` mount. Failure-modes table maps each new alert
(C5, C6, W6, W7, W8) to its response action.

Save under `docs/observability/runbooks/`. One file per alert.

### `runbooks/zombie-session.md`
**Alert:** C4 — frontend zombie-session incident.
**Pattern:** User session has `user_id` set in PostHog but their API calls 401.
**Likely causes:**
1. Token rotation race (single-flight in PR #319 should prevent — verify)
2. Browser quota-eviction of localStorage key
3. Stale service-worker bundle reading wrong key layout
4. Cross-tab signout partial-propagation
**Triage steps:**
1. Confirm in PostHog whether multiple users are affected (broad) or just one (narrow)
2. If multiple: roll back the most recent auth-touching PR (`pre-auth-fix-<date>` tag)
3. If one: check user's `user_agent` for extension or browser-quirk pattern
4. Verify PR #376's self-heal is firing — check `tokenStorage.clear()` invocation rate
**Recovery:** PR #376 self-heal should already be repairing the state on next page load. Tell the user to refresh.

### `runbooks/api-down.md`
**Alert:** C1 — `/health` non-200.
**Triage:**
1. `ssh hetznerCO; systemctl status aiwholesail-api` — service crashed?
2. `journalctl -u aiwholesail-api -n 100` — last 100 log lines
3. Check Hetzner status page
4. Recent merges? `git log origin/main --oneline -5` — likely culprit at the top
**Recovery:** `systemctl restart aiwholesail-api`. If that fails, `git revert` the most recent merge to main and force-redeploy.

### `runbooks/api-error-storm.md`
**Alert:** C2 — API 5xx rate spike.
**Triage:**
1. `journalctl -u aiwholesail-api --since '15 minutes ago' | grep -i error` — error patterns
2. Most affected endpoint? Group by route in access log
3. Database? `aiwholesail-api logs SELECT failures` — pool exhaustion
4. Upstream? scrape.do down → cascading 500s

### `runbooks/auth-401-storm.md`
**Alert:** C3 — auth 401 spike.
**Triage:**
1. Check `/api/auth/refresh` success rate — broken refresh = users get logged out en masse
2. JWT signing key rotated? Check env on hetznerCO matches what tokens were signed with
3. Database `users` table healthy? Failed lookups would 401

### `runbooks/scrape-do-degraded.md`
**Alert:** W1 — scrape.do success <90%.
**Triage:**
1. Confirm via `scrape_provider_metrics` last 60 min
2. Is RapidAPI fallback succeeding? `WHERE call_kind='fallback' AND success=true`
3. Captcha pattern? Filter on `error_excerpt LIKE '%captcha%'`
4. If sustained: switch primary to RapidAPI temporarily via feature flag

---

## Implementation roadmap

Phased rollout. P1 items address the cpodea5-class gap; P2-P3 are full SLO buildout.

### P1 — Detect zombie-session class incidents in real time (this week)

1. **Wire PostHog client-side event:** `NOT_AUTHENTICATED_toast_shown` fired from `RealEstateWholesaler.tsx:508`. Properties: `user_id`, `session_id`, `route`. Cost: ~5 LOC.
2. **PostHog alert:** "≥1 unique user fires `NOT_AUTHENTICATED_toast_shown` in 60-min window" → email Connor.
3. **API instrumentation:** middleware on `authenticate` that increments a counter when JWT is well-formed but doesn't match a `users` row (= zombie state at API level).

### P1.5 — RapidAPI gateway alerts (before first paying consumer)

**Blocks: activation step 4 of the RapidAPI release plan.** These alerts need
to fire from request #1, not after the first one-star review.

1. **Access-log SLI counter:** new cron in `aiwholesail-api/scripts/` that tallies `/rapidapi/zillow/*` 2xx / 4xx / 5xx counts from nginx logs into `rapidapi_request_metrics` table (mirrors `scrape_provider_metrics` shape). Cost: ~50 LOC + 1 migration.
2. **C5 alert (503 storm):** trivial — any 503 with body `"Gateway not configured"` for >0 in last 5 min → page. Implement via a tail of the API process log + grep; or via the new metrics table if step 1 done first.
3. **C6 alert (burn-rate):** 14.4% of SLO 9 budget in 1h → page. Calc'd from `rapidapi_request_metrics` rolling window.
4. **W6 alert (401 storm from our middleware, not RapidAPI's):** distinguished by response body shape — ours has `{"success":false,...}`, theirs has `{"message":"..."}`.
5. **W7, W8:** lower priority, can land with P2.

Estimated implementation: 1 day. Should land before `RAPIDAPI_GATEWAY_ENABLED=true` flips in prod.

### P2 — SLO error-budget tracking (next 2 weeks)

4. **Add Prometheus exporter** to `aiwholesail-api` (or push metrics to a hosted service — Datadog/Grafana Cloud trial). Track per-endpoint RPS / latency / error rate.
5. **Build the 8 SLO calculations** as cron'd Postgres queries against access logs + `scrape_provider_metrics`. Store in a `slo_burn_history` table.
6. **Stand up Grafana** (or use Grafana Cloud free tier — 10k metrics) for Dashboard 1.

### P3 — Frontend tracing + distributed traces (next month)

7. Add **Sentry FE SDK** for JS errors, slow renders, and trace propagation to the API.
8. Add **trace IDs** to API responses; PostHog can correlate frontend session → API trace.
9. Build Dashboard 2 (frontend-funnel views).

### P4 — Capacity / Predictive (later)

10. Capacity-trend dashboard (CPU/memory/disk projections — when do we need to upgrade Hetzner box?)
11. ZHVI forecast for the SEO/marketing dashboards using Tier B5 endpoints once live.

---

## Vendor decisions (decided 2026-05-14 — board approved defaults)

These were originally open questions; resolved via the C-level-advisor board on 2026-05-14. Total monthly P1 cost: **$0**.

1. **Metrics host:** ✅ **Grafana Cloud free tier** (10k metrics, 14d retention). One-click setup beats self-host ops overhead for a single-operator team. Revisit at P2 if metric volume forces upgrade.
2. **On-call paging:** ✅ **Better Stack free tier** (5 users, phone push). Better UX than PagerDuty free (1-user cap) and more headroom for adding a second on-call later.
3. **PostHog tier:** ✅ **Stay on free** (1M events/mo). The new `NOT_AUTHENTICATED_toast_shown` event is high-signal and low-volume (fires only on actual incidents). If pageview tracking pushes over 1M, audit at P2.
4. **Sentry FE SDK budget:** ✅ **Free tier first** (5k events/mo). Upgrade to $26/mo Team plan only if FE error volume overflows. Most aiwholesail FE errors are user-input issues, not exceptions — should fit.

---

## Appendix — incident retrospectives (for context)

| Date | PR | Incident | What better observability would have caught |
|---|---|---|---|
| 2026-05-13 | #321 | PROD DOWN — CORS misconfig | API 5xx-rate spike alert (C2) |
| 2026-05-13 | #348 | NOT_AUTHENTICATED after login (www→apex) | Auth 401 spike alert (C3) |
| 2026-05-13 | #356 | SecurityMonitor signOut() infinite loop | Frontend zombie-session alert (C4) |
| 2026-05-14 | #375/#376 | cpodea5 zombie session — silently broken | Frontend zombie-session alert (C4) — would have caught in minutes vs hours |

All four could have been caught by alerts C2/C3/C4 in this spec. None require new infrastructure beyond Sentry/Better Stack + PostHog event wiring.
