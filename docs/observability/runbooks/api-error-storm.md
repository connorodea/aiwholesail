# Runbook: API error storm (5xx burn-rate critical)

## Alert
- **Alert ID:** C2
- **Severity:** Critical
- **Source:** SLO 8 burn-rate calculation against access logs + `scrape_provider_metrics`
- **SLA to acknowledge:** 5 min

## What this alert means
The overall API is returning 5xx fast enough to burn 14.4% of the 30-day error budget in one hour. Users will see broken searches, blank dashboards, and failed analyses — not a full outage, but a noticeable degradation. If left alone, full error-budget exhaustion in ~7 hours.

## Decision tree
- All endpoints 5xx → upstream (DB, Redis, or whole process). Treat as near-C1, see `api-down.md`.
- One endpoint dominating → endpoint-specific bug or upstream dependency for that route.
- `/api/zillow/proxy` dominating → scrape.do down, see "scrape.do cascade" below.
- Errors only on writes → DB pool exhaustion or replica lag.
- Spike correlates with a deploy in last 30 min → revert.

## Likely causes (ranked by recent frequency)
1. **scrape.do upstream degraded** — PR #322 made scrape.do the unconditional primary for Zillow proxy. When scrape.do 500s, `/api/zillow/proxy/*` routes cascade. ETR: 5-10 min (toggle feature flag to RapidAPI).
2. **DB connection pool exhausted** — slow query holds connections, new requests time out. ETR: 5 min restart, 30 min root-cause.
3. **Bad merge** — endpoint started throwing post-deploy. ETR: 5 min revert.
4. **Memory pressure / OOM kills** — process restarting in a loop. ETR: 5 min restart, may need vertical scale.

## Triage steps (do these in order)

### 1. Per-endpoint 5xx breakdown — find the worst offender
```bash
ssh hetznerCO 'sudo journalctl -u aiwholesail-api --since "15 minutes ago" --no-pager | grep -E " 5[0-9]{2} " | awk "{print \$NF}" | sort | uniq -c | sort -rn | head -10'
```
- Expected when healthy: empty or single-digit counts.
- During storm: one route should dominate. If `/api/zillow/proxy` is top → step 4.
- If many routes evenly affected → step 2 (treat closer to C1).

[verify] — the exact log format depends on how the Express access logger writes 5xx lines; adjust the `grep`/`awk` to the actual field layout if needed.

### 2. Process and resource health
```bash
ssh hetznerCO 'systemctl status aiwholesail-api --no-pager; free -h; uptime'
```
- Service flapping (`Active: activating` or recent restart timestamp) → OOM. Check:
  ```bash
  ssh hetznerCO 'sudo journalctl -u aiwholesail-api --since "1 hour ago" | grep -iE "out of memory|oom-killer|killed"'
  ```
  Resolution: restart + investigate memory leak. If urgent, bump Hetzner instance.

### 3. Database health
```bash
ssh hetznerCO 'sudo -u postgres psql -c "SELECT state, count(*) FROM pg_stat_activity GROUP BY state;"'
ssh hetznerCO 'sudo -u postgres psql -c "SELECT pid, now() - query_start AS duration, state, query FROM pg_stat_activity WHERE state = '"'"'active'"'"' ORDER BY duration DESC LIMIT 5;"'
```
- Expected: most rows `idle`, few `active`, `idle in transaction` near zero.
- If many `idle in transaction` or `active` queries running >30s → pool exhausted. See resolution B.

### 4. scrape.do cascade check
```bash
ssh hetznerCO 'sudo -u postgres psql aiwholesail -c "SELECT provider, success, count(*) FROM scrape_provider_metrics WHERE created_at > now() - interval '"'"'15 minutes'"'"' GROUP BY provider, success ORDER BY provider, success;"'
```
- Expected when healthy: `scrape-do-zillow` rows with `success=true` heavily outweigh `false`.
- If `success=false` is >30% of `scrape-do-zillow` rows → scrape.do is degraded and cascading. Go to resolution C.

### 5. Recent deploys
```bash
git log origin/main --oneline --since="2 hours ago"
gh run list --workflow=deploy --limit 5
```
If the storm started within 30 min of a deploy → that PR is the suspect. Resolution D.

## Resolution paths

### A. Restart the API process
Same as `api-down.md` resolution A. Clears stuck connections, OOM-loop, in-process leaks.
```bash
ssh hetznerCO 'sudo systemctl restart aiwholesail-api'
```
Watch error rate for 5 min after.

### B. DB pool exhausted — terminate runaway queries
Identify the runaway from step 3 output. Then:
```bash
ssh hetznerCO 'sudo -u postgres psql -c "SELECT pg_cancel_backend(<pid>);"'
```
If `pg_cancel_backend` doesn't release after 30s, use `pg_terminate_backend`. After clearing, restart the API.

### C. scrape.do failover — flip feature flag
The `zillow_scrape_do` flag controls scrape.do primary routing. To disable (RapidAPI takes everything):
```bash
ssh hetznerCO 'sudo -u postgres psql aiwholesail -c "UPDATE feature_flag_globals SET enabled=false WHERE slug='"'"'zillow_scrape_do'"'"';"'
```
Propagates in <60s (featureFlags.js cache TTL). Verify by re-running step 4 — `rapidapi-zillow` should now dominate. To re-enable when scrape.do recovers: `enabled=true`.

[verify] — confirm `zillow_scrape_do` is still the active flag controlling this path. PR #322 may have deprecated it (see migration `021_deprecate_zillow_scrape_do_flag.sql`); if so, the actual lever is in the code path itself and may require a hotfix PR.

### D. Revert a bad merge
```bash
git revert --no-edit <bad-sha>
git push origin main
```
~5 min to redeploy.

## Post-incident
- **Capture for postmortem:**
  - First minute the alert tripped + first minute back under burn-rate
  - Worst-offender endpoint from step 1
  - Root cause (cascade vs. bug vs. resource)
  - Whether feature flag failover was used and how fast
- **Follow-up tasks:**
  - If scrape.do cascade: file a P2 to add automatic failover (don't rely on manual flag flip)
  - If DB pool: add `pg_stat_activity` connection-count to health-monitor signals
  - If OOM: profile heap, file capacity-planning task
- **Log the incident:** Todoist `aiwholesail` / `BUGS`: `INCIDENT YYYY-MM-DD: api-error-storm — <root cause>`.

## Reference
- PR #322 — scrape.do made unconditional primary (raised cascade risk)
- Migration `020_scrape_provider_metrics.sql` — schema for the metrics queries above
