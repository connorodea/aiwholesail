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

### Info — log only, no notification

#### I1 — Deployment events
- Emit on each `main` push that triggers deploy. Useful for correlating spikes to deploys.

#### I2 — Feature-flag rollout changes
- Existing signal 13.

#### I3 — New error class observed
- First time a new `error_excerpt` string appears in `scrape_provider_metrics` in 7 days. Helps catch upstream API changes early.

---

## Runbook Stubs (high-priority — to be filled in next pass)

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
