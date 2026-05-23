# Runbook: scrape.do degraded

## Alert
- **Alert ID:** W1
- **Severity:** Warning
- **Source:** `aiwholesail-api/scripts/health-monitor.js` signal 12 — scrape.do 60-min success rate <90% for `scrape-do-zillow` provider (queried from `scrape_provider_metrics`)
- **SLA to acknowledge:** 30 min

## What this alert means
The third-party scrape.do provider is succeeding on less than 90% of `scrape-do-zillow` calls in the last 60 minutes. Users may see slower property searches (retries add latency) and a small slice of broken searches. RapidAPI fallback should be absorbing most of this. If it isn't, customers notice.

## Decision tree
- Success rate 70-90%, RapidAPI fallback absorbing → log + monitor, no action.
- Success rate <70% (would trip health-monitor `fail`) or fallback also struggling → flag failover.
- Errors are captcha-pattern → Zillow tightened anti-bot; rendering retries kicking in (5x cost) — escalate cost-wise.
- Errors are connection-level (timeouts, 5xx from scrape.do itself) → vendor issue, check scrape.do status page.

## Likely causes (ranked)
1. **Zillow anti-bot tightening** — captcha rate spikes; scrape.do's basic mode fails, render retries cost 5x. Recurring pattern. ETR: monitor; escalate if sustained >2 hours.
2. **scrape.do vendor incident** — their infrastructure has issues. Check their status. ETR: depends on vendor.
3. **API token rate-limit / billing** — `SCRAPE_DO_API_TOKEN` hit a quota cap. Existing health-monitor signal 11 checks presence; quota exhaustion is separate.
4. **New action type unsupported** — code shipped a `callKind` scrape.do doesn't handle.

## Triage steps (do these in order)

### 1. Query the actual metrics — confirm and characterize
```bash
ssh hetznerCO 'sudo -u postgres psql aiwholesail -c "SELECT action, call_kind, success, count(*) FROM scrape_provider_metrics WHERE provider='"'"'scrape-do-zillow'"'"' AND created_at > now() - interval '"'"'60 minutes'"'"' GROUP BY action, call_kind, success ORDER BY action, call_kind, success;"'
```
- Expected when healthy: `success=true` rows heavily outweigh `false` per action.
- Note which `action` is worst (e.g. `propertyDetails`, `search`, `photos`). One action failing while others succeed → action-specific issue.

[verify] — exact column names on `scrape_provider_metrics`. Schema is in `aiwholesail-api/migrations/020_scrape_provider_metrics.sql`; this runbook assumes `action`, `call_kind`, `success`, `created_at`, `error_excerpt`.

### 2. Look at error patterns
```bash
ssh hetznerCO 'sudo -u postgres psql aiwholesail -c "SELECT error_excerpt, count(*) FROM scrape_provider_metrics WHERE provider='"'"'scrape-do-zillow'"'"' AND success=false AND created_at > now() - interval '"'"'60 minutes'"'"' GROUP BY error_excerpt ORDER BY count(*) DESC LIMIT 10;"'
```
- Look for top error class:
  - `%captcha%` → anti-bot. Render retry already happening, expect 5x cost. Resolution A.
  - `%timeout%` / `ETIMEDOUT` / `ECONNRESET` → scrape.do infra issue. Resolution B.
  - `%403%` / `%401%` / `%token%` → auth/quota. Resolution C.
  - `%500%` / `%502%` / `%503%` → scrape.do upstream. Resolution B.

### 3. Check whether RapidAPI fallback is absorbing
```bash
ssh hetznerCO 'sudo -u postgres psql aiwholesail -c "SELECT provider, success, count(*) FROM scrape_provider_metrics WHERE created_at > now() - interval '"'"'60 minutes'"'"' AND call_kind='"'"'fallback'"'"' GROUP BY provider, success;"'
```
- Expected when fallback is healthy: `rapidapi-zillow` with `success=true` count roughly tracks scrape.do failure count.
- If RapidAPI also failing → much bigger problem; consider treating closer to C2 (`api-error-storm.md`).

### 4. Check scrape.do vendor status
Hit https://status.scrape.do (or vendor's status URL). If they're reporting an incident, the cause is external — proceed with failover (resolution D) while you wait.

### 5. Check captcha-retry frequency (W2 signal)
```bash
ssh hetznerCO 'sudo -u postgres psql aiwholesail -c "SELECT count(*) FILTER (WHERE render_retry=true) * 100.0 / count(*) AS retry_pct FROM scrape_provider_metrics WHERE provider='"'"'scrape-do-zillow'"'"' AND created_at > now() - interval '"'"'60 minutes'"'"';"'
```
- Above 10% sustained → file cost-awareness follow-up (5x multiplier hurts).

[verify] — `render_retry` column name. Confirm in migration 020.

## Resolution paths

### A. Captcha pattern (most common)
No immediate action — render retries are doing the right thing. Monitor for 1-2 hours:
- If success rate recovers above 90% → close alert, log the event.
- If sustained >2 hours OR captcha-retry frequency >25% → consider resolution D (temporary failover) because cost is unacceptable.

### B. scrape.do vendor incident
If their status page confirms or step 1+2 suggest infra issues:
1. Apply resolution D (failover) immediately.
2. Watch the vendor status page; revert when they recover.

### C. Token / quota issue
Check the env on the server:
```bash
ssh hetznerCO 'sudo systemctl show aiwholesail-api --property=Environment --no-pager | tr " " "\n" | grep -i SCRAPE_DO | sed "s/=.*/=<redacted>/"'
```
- If missing → restore env, restart API.
- If present → log into scrape.do dashboard, check quota / billing.

### D. Feature-flag failover to RapidAPI
The `zillow_scrape_do` flag (migration 017) controls whether scrape.do is in the path at all. To force RapidAPI-only:
```bash
ssh hetznerCO 'sudo -u postgres psql aiwholesail -c "UPDATE feature_flag_globals SET enabled=false WHERE slug='"'"'zillow_scrape_do'"'"';"'
```
Propagates in <60s (featureFlags.js cache TTL). Verify by re-running step 1 — `scrape-do-zillow` call count should drop to ~0; `rapidapi-zillow` should rise.

When scrape.do recovers, re-enable:
```bash
ssh hetznerCO 'sudo -u postgres psql aiwholesail -c "UPDATE feature_flag_globals SET enabled=true, rollout_pct=100 WHERE slug='"'"'zillow_scrape_do'"'"';"'
```

[verify] — PR #322 / migration `021_deprecate_zillow_scrape_do_flag.sql` may have deprecated this flag and made scrape.do unconditional. If so, the flag flip won't work and a code hotfix is required. Confirm by reading migration 021 before relying on resolution D.

## Post-incident
- **Capture for postmortem:**
  - Lowest success rate observed
  - Dominant error pattern (captcha / timeout / vendor 5xx / auth)
  - Whether fallback absorbed it (and at what cost — count of RapidAPI calls during window)
  - Whether failover was applied, and total minutes of degraded service
- **Follow-up tasks:**
  - If captcha-driven: tune render-retry threshold or evaluate alternative anti-bot providers
  - If recurring (≥2× per week): file P2 to make failover automatic on sustained <70% rate
  - If vendor-driven: weigh switching primary
- **Log the incident:** Todoist `aiwholesail` / `BUGS`: `INCIDENT YYYY-MM-DD: scrape-do-degraded — <dominant error>`.

## Reference
- Migration `020_scrape_provider_metrics.sql` — metrics schema
- Migration `017_scrape_do_flags.sql` — feature flag for failover
- Migration `021_deprecate_zillow_scrape_do_flag.sql` — possible flag deprecation [verify]
- `aiwholesail-api/scripts/health-monitor.js` — signal 12 (the alert source)
- `aiwholesail-api/lib/observability/scrapeMetrics.js` — write path
