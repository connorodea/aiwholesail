# Runbook: API down (`/health` non-200)

## Alert
- **Alert ID:** C1
- **Severity:** Critical
- **Source:** Uptime probe — currently `aiwholesail-api/scripts/health-monitor.js` (hourly); future Better Stack (30s)
- **SLA to acknowledge:** 5 min

## What this alert means
`api.aiwholesail.com/health` returned non-200 for 3 consecutive probes. Every authenticated user is broken right now — sign-in, search, analyze, dispo all hit this host. Treat as full prod-down until proven otherwise.

## Decision tree
- Service crashed / inactive → restart, then root-cause from journal
- Service running but `/health` 5xx → DB or Redis down (see C2 runbook for DB pool)
- Host unreachable on SSH too → Hetzner host issue, check status page + Hetzner Cloud Console
- Just deployed → suspect the last merge, prep a revert

## Likely causes (ranked by recent frequency)
1. **Bad merge to `main`** — e.g. CORS misconfig in PR #321 took prod down for ~20 min. ETR: 5-10 min (revert + redeploy).
2. **Process crashed on uncaught exception** — most recent example: SecurityMonitor infinite loop, PR #356. ETR: 2 min restart, then root-cause.
3. **DB connection exhausted** — pool maxed, `/health` waits on `SELECT 1`. ETR: 5 min (restart clears pool; investigate query).
4. **Hetzner host down / network blip** — rare. ETR: depends on Hetzner.

## Triage steps (do these in order)

### 1. Confirm from a second vantage point
```bash
curl -sS -o /dev/null -w '%{http_code}\n' https://api.aiwholesail.com/health
```
- Expected when healthy: `200`
- If `000` / timeout → DNS or host-level issue, skip to step 4
- If 5xx → service is up but unhealthy, continue

### 2. SSH in and check the service
```bash
ssh hetznerCO
systemctl status aiwholesail-api --no-pager
```
- Expected when healthy: `Active: active (running)`
- If `failed` or `inactive` → step 3, then step 5
- If `active` but `/health` still 5xx → likely DB/Redis. Run:
  ```bash
  curl -sS http://127.0.0.1:3202/health
  systemctl status redis --no-pager
  sudo -u postgres psql -c 'SELECT 1;'
  ```

### 3. Read the last 200 log lines
```bash
journalctl -u aiwholesail-api -n 200 --no-pager
```
Look for the top stack trace. Common signatures:
- `EADDRINUSE` → stale process, see resolution A
- `ECONNREFUSED 127.0.0.1:5432` → Postgres down, see resolution C
- `ECONNREFUSED 127.0.0.1:6379` → Redis down, see resolution D
- `Cannot find module` → bad deploy, see resolution B

### 4. Verify host is reachable
```bash
ssh hetznerCO 'uptime && df -h /'
```
- If SSH itself hangs → Hetzner host issue. Check https://status.hetzner.com and the Hetzner Cloud Console.
- If `df` shows root at 100% → free space (logs, journald) before restarting.

### 5. Check for a recent merge
```bash
git log origin/main --oneline -10
gh run list --workflow=deploy --limit 5
```
If the most recent deploy finished within ~30 min of the alert, that PR is the prime suspect.

## Resolution paths

### A. Restart the service (covers crashes, port held, transient)
```bash
ssh hetznerCO 'sudo systemctl restart aiwholesail-api && sleep 3 && systemctl status aiwholesail-api --no-pager'
curl -sS -o /dev/null -w '%{http_code}\n' https://api.aiwholesail.com/health
```
Expect `Active: active (running)` and `200`. If `/health` still 5xx after restart → continue to C or D.

### B. Revert a bad merge
```bash
git revert --no-edit <bad-sha>
git push origin main
```
CI/CD on push to main will redeploy. Watch `gh run watch`. ETR: ~5 min for full deploy cycle.

### C. Postgres down
```bash
ssh hetznerCO 'sudo systemctl status postgresql --no-pager; sudo systemctl restart postgresql'
```
Then restart the API (A) so it re-establishes its pool.

### D. Redis down
```bash
ssh hetznerCO 'sudo systemctl status redis --no-pager; sudo systemctl restart redis'
```
Then restart the API.

### E. Host issue
No fix from our side. Subscribe to Hetzner status, message customers via status page if down >15 min.

## Post-incident
- **Capture for postmortem:**
  - Time of first 5xx (from `journalctl`)
  - Time of recovery (first 200)
  - Triggering merge SHA, if any
  - Top 5 lines of the stack trace
- **Follow-up tasks:**
  - If a merge caused it: add a regression test that would have failed in CI
  - If DB pool exhaustion: add an alert on `pg_stat_activity` connection count
  - If host issue: nothing to fix, just log
- **Log the incident:** Todoist project `aiwholesail`, section `BUGS`, title `INCIDENT YYYY-MM-DD: api-down — <one-line cause>`.

## Reference incidents
- PR #321 — CORS misconfig PROD DOWN (2026-05-13)
- PR #356 — SecurityMonitor `signOut()` infinite loop (2026-05-13)
