# Runbook: Auth 401 storm

## Alert
- **Alert ID:** C3
- **Severity:** Critical
- **Source:** SLO 2 burn-rate — `>5%` of authenticated requests return 401 with valid-format JWT in a 5-min window
- **SLA to acknowledge:** 5 min

## What this alert means
A wide slice of signed-in users are getting kicked out (401 → `NOT_AUTHENTICATED` toast → forced re-login) at the same time. Either token refresh is broken, signing keys diverged, or the API can't look users up. Distinct from C4 (zombie session) — C3 = many users affected at once; C4 = one user stuck.

## Decision tree
- Sign-in itself failing too → JWT signing key issue or `users` table unreachable
- Sign-in works but refresh fails → `/api/auth/refresh` broken (most common cause)
- Only certain domains (e.g. `www` vs apex) affected → cookie-domain misconfig (PR #348 pattern)
- Started right after a deploy → suspect auth-touching PR, revert

## Likely causes (ranked by recent frequency)
1. **Domain misconfig (`www` ↔ apex)** — cookies issued for one host, requests come from the other. Caused PR #348 incident. ETR: 5-15 min (DNS or middleware fix).
2. **`/api/auth/refresh` broken** — frontend silently logs out users when refresh starts 401-ing. ETR: depends on cause; restart + check for code regression first.
3. **JWT signing-key drift** — `JWT_SECRET` env on hetznerCO no longer matches what existing tokens were signed with. Common after env-file edits or PM2/systemd reload. ETR: 5 min (restore correct secret).
4. **`users` table unhealthy** — Postgres replica lag or a bad migration that breaks the lookup query.

## Triage steps (do these in order)

### 1. Confirm the scope — is it ALL users, or a subset?
```bash
ssh hetznerCO 'sudo journalctl -u aiwholesail-api --since "10 minutes ago" --no-pager | grep -E " 401 " | head -30'
```
Look at the `Origin` / `Referer` headers in 401 lines:
- If all from one host (`www.aiwholesail.com` vs `aiwholesail.com`) → domain/cookie issue → resolution A
- If mixed → either refresh broken or JWT secret drift → step 2

[verify] — exact log line format depends on the access logger; tune the `grep` if needed.

### 2. Test `/api/auth/refresh` directly
From a browser with a logged-in session, open DevTools → Network and trigger any authed request. Observe the refresh call. From CLI, simulate by grabbing your own refresh cookie:
```bash
curl -sS -i https://api.aiwholesail.com/api/auth/refresh \
  -H "Cookie: <your-refresh-cookie>" \
  -X POST
```
- Expected: `200` with `Set-Cookie` rotating the access token.
- If `401` / `500` → refresh route is the problem. Step 3.
- If `200` → refresh works; problem is downstream. Step 4.

### 3. Check the API for recent auth-related changes
```bash
git log origin/main --oneline --since="6 hours ago" -- aiwholesail-api/routes/auth.js aiwholesail-api/lib/auth
ssh hetznerCO 'sudo journalctl -u aiwholesail-api --since "30 minutes ago" --no-pager | grep -iE "refresh|jwt|sign"'
```
Look for stack traces around JWT verification or refresh flow.

### 4. Check signing-key integrity
On the server, confirm the JWT secret is set and hasn't been rotated by accident:
```bash
ssh hetznerCO 'sudo systemctl show aiwholesail-api --property=Environment --no-pager | tr " " "\n" | grep -iE "JWT|SECRET" | sed "s/=.*/=<redacted>/"'
```
- If the env shows `JWT_SECRET=` with no value, or a different value than expected → resolution C.
- Never echo the secret itself to terminal / chat.

[verify] — the exact env var name. Check `aiwholesail-api/lib/auth/` for the loader; this runbook assumes `JWT_SECRET`.

### 5. Verify `users` table is healthy
```bash
ssh hetznerCO 'sudo -u postgres psql aiwholesail -c "SELECT count(*) FROM users; SELECT count(*) FROM users WHERE created_at > now() - interval '"'"'1 day'"'"';"'
```
- Expected: a number that matches your known user count, plus non-zero recent signups during normal traffic.
- Error or 0 rows → DB or migration issue → resolution D.

## Resolution paths

### A. Cookie/domain misconfig (PR #348 pattern)
Symptom: 401s only on requests with `Origin: https://www.aiwholesail.com` (or only apex). Cookie was set for one, request comes from other.

Short-term: ensure the apex serves the canonical app and `www` 301-redirects to apex (or vice versa, whichever PR #348 chose). Verify Cloudflare / nginx redirect:
```bash
curl -sI https://www.aiwholesail.com | head -10
curl -sI https://aiwholesail.com | head -10
```
If misconfigured, fix via Cloudflare DNS / Page Rule. If recent deploy changed cookie domain in code, revert.

### B. `/api/auth/refresh` regression
If step 3 surfaced a recent auth-touching merge:
```bash
git revert --no-edit <bad-sha>
git push origin main
```
~5 min redeploy. While waiting, restart the API as a partial mitigation (clears any in-process state issues):
```bash
ssh hetznerCO 'sudo systemctl restart aiwholesail-api'
```

### C. JWT secret drift
If the env value is wrong, restore it from the known-good source (1Password / secrets manager / the env file under version control). Edit the systemd unit or env file, then:
```bash
ssh hetznerCO 'sudo systemctl daemon-reload && sudo systemctl restart aiwholesail-api'
```
Users with existing access tokens will need to refresh — refresh tokens issued with the correct secret should still validate. If both were rotated, all users must re-login (acceptable trade-off if the alternative is silent breakage).

### D. `users` table issue
If a migration broke the table, revert the migration (`migrations/<NNN>_*.sql`) and redeploy. If it's pure replication / DB issue, see `api-down.md` resolution C.

## Post-incident
- **Capture for postmortem:**
  - First 401 timestamp and a sample request (headers, route, host)
  - Whether one host or both
  - Sign-in success rate during the window (was the gate also broken?)
  - Root cause category (refresh / secret / cookie / DB)
- **Follow-up tasks:**
  - Add a synthetic check that signs in, makes an authed call, refreshes, makes another. Fails on this storm before users notice.
  - If cookie-domain caused it: add a canary test that hits both `www` and apex on every deploy
- **Log the incident:** Todoist `aiwholesail` / `BUGS`: `INCIDENT YYYY-MM-DD: auth-401-storm — <root cause>`.

## Reference
- PR #348 — `www`→apex cookie-domain bug that caused mass `NOT_AUTHENTICATED`
- PR #319 — single-flight token refresh (reduces race-class 401s)
