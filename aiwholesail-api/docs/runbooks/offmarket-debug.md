# Off-market search broken — debug runbook

> Referenced by `scripts/offmarket-routing-monitor.js` alert emails. When the
> monitor fires (or a user reports off-market not working), start here.

## Triage in 60 seconds — identify the failure tier

Run these in parallel. The first answer points you to the right section below.

- **Frontend regression (bundle missing latest code)?**
  ```bash
  ssh hetznerCO 'grep -c getSearchPlanForLeads /var/www/aiwholesail.com/assets/index-*.js'
  ```
  `0` ⇒ frontend regression — the dual-feed planner from PR #311 didn't make
  it into the deployed bundle. Jump to **Tier-2 mitigation** (revert + redeploy).

- **Backend regression (proxy 5xx-ing)?**
  ```bash
  ssh hetznerCO 'curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3202/api/propdata/health'
  ```
  Anything other than `200` ⇒ aiwholesail-api is down or unhealthy. Restart
  the service: `ssh hetznerCO 'sudo systemctl restart aiwholesail-api'`.
  Then jump to step 3 below.

- **Upstream regression (PropData throttled or down)?**
  ```bash
  ssh hetznerCO 'source /var/www/aiwholesail-api/.env && \
    curl -s -o /dev/null -w "%{http_code}\n" \
    -H "X-RapidAPI-Key: $PROPDATA_RAPIDAPI_KEY" \
    "https://us-real-estate.p.rapidapi.com/v1/property?postal_code=55408&absentee_only=true&limit=1"'
  ```
  `429` or `5xx` ⇒ PropData itself is the problem. No code fix; communicate
  to user, wait it out.

- **User-side filter mistake (legitimately zero matches)?**
  Ask user for their lead-type selection + state. All 12 selected + a
  small-coverage state (anywhere outside FL / MN / TX) often returns
  legit zero. Document the gap and tell the user to try FL or MN.

## Step-by-step diagnosis

1. **Confirm reproduction.** Replay the user's exact selection on a known-good
   state (FL all-12). If broken there too → real regression. If FL works but
   user's region doesn't → coverage gap, not a code issue.

2. **Browser DevTools network tab.** Open `/app/off-market` as the affected
   user (with their cooperation), run the search, watch the network panel.
   Note: which path is hit?
   - Only `/api/propdata/preforeclosure` → **dual-feed routing collapse**
     (the PR #311 incident class). Jump to step 4.
   - Mix of `/api/propdata/property` AND `/api/propdata/preforeclosure` → planner is healthy; the empty result is real. Step 5.
   - Only `/api/propdata/property` with empty results → property feed coverage
     gap or absentee filter too tight. Step 5.

3. **Pull API logs for the affected user (last 5 min).**
   ```bash
   ssh hetznerCO "sudo journalctl -u aiwholesail-api --since '5 min ago' --no-pager \
     | grep -E '(component\":\"propdata|<user_id>|ERROR|stack)'"
   ```
   Look for: unexpected status codes, stack traces, `permission denied`
   (migration GRANT missing), `RATE_LIMITED` clusters.

4. **Identify feed dispatch ratio (the smoking gun for PR #311-class bugs).**
   ```bash
   ssh hetznerCO "sudo journalctl -u aiwholesail-api --since '10 min ago' -o cat \
     | grep '\"component\":\"propdata\"' \
     | jq -r '.endpoint' | sort | uniq -c"
   ```
   Healthy mix: property-feed dominates (>5:1 over preforeclosure). If
   ratio inverted → planner regression. Mitigate immediately (Tier 1).

5. **PropData direct curl** (rules out our stack, isolates upstream).
   ```bash
   ssh hetznerCO 'source /var/www/aiwholesail-api/.env && \
     curl -s -H "X-RapidAPI-Key: $PROPDATA_RAPIDAPI_KEY" \
     "https://us-real-estate.p.rapidapi.com/v1/property?postal_code=<user-zip>&absentee_only=true&limit=5" \
     | jq ".count, .properties | length"'
   ```
   - `0` returned → real coverage gap. Report to user, no fix.
   - `>0` but empty in our UI → frontend filter or absentee_only param wrong. Tier 2.
   - `429` → user is throttled. Wait, or upgrade their tier.

6. **Decide mitigation tier** based on findings:
   - 1 user, single ZIP, no errors in logs → reply to user, document, no action.
   - Multiple users + planner collapse signature → **Tier 1 immediately**.
   - Backend 5xx in logs → **Tier 2** (revert latest API change + redeploy).
   - Total outage → **Tier 3**.

## Mitigation — lowest blast radius first

### Tier 1 — kill the v2 flow via feature flag (≤60s)
```bash
ssh hetznerCO 'psql "$DATABASE_URL" -c "
  UPDATE feature_flag_globals
     SET enabled = false, rollout_pct = 0
   WHERE slug = ''off-market-search-v2'';
  DELETE FROM feature_flag_users WHERE slug = ''off-market-search-v2'';
"'
```
Frontend caches the flag for 60s — within a minute every user falls back to
v1 absentee-only behavior. No deploy needed. Confirm the SQL change took
effect by querying the table.

> Note: the flag slug above must match the value `useFeatureFlag(...)` reads
> in `src/components/AbsenteeOwnerSearch.tsx`. If the slug has changed,
> update this runbook.

### Tier 2 — revert + redeploy (~3-5 min)
```bash
# Identify the most recent merge to main that touched off-market
unset GITHUB_TOKEN
git log --oneline --since='24 hours ago' -- src/components/AbsenteeOwnerSearch.tsx src/lib/lead-types.ts aiwholesail-api/lib/lead-types.js
# Revert via PR (preferred — keeps audit trail) OR direct on main if truly urgent
gh pr revert <SHA>   # opens revert PR, --merge to land immediately
```
After deploy: verify via Triage check 1 that the rollback bundle is live.

### Tier 3 — full rollback to anchor SHA (~5 min)
Use the `ANCHOR_PRE_<PR>` SHA captured by the release manager at merge time
(noted in the PR's smoke-test message).
```bash
gh workflow run deploy.yml -f ref=<anchor-SHA>
```

## Common causes — symptom → cure cheat sheet

| Symptom | Likely cause | One-line cure |
|---|---|---|
| "0 results despite all 12 lead types selected" | Dual-feed routing collapse (PR #311) | Verify `getSearchPlanForLeads` is in bundle (triage check 1) — Tier 1 if missing. |
| "Worked 10 min ago, now empty" | Per-user PropData rate-limit exhaustion | Grep logs for `429` against user_id; tell user to wait 60s. Consider raising their plan tier. |
| "Empty for one specific ZIP, fine elsewhere" | PropData coverage gap (non-FL/MN/TX state) | Confirm with PropData direct curl (step 5). No fix — document. |
| "Empty + `permission denied` in API logs" | Migration missed a GRANT block | `psql -c "GRANT SELECT,INSERT,UPDATE,DELETE ON <table> TO aiwholesail; GRANT USAGE,SELECT ON SEQUENCE <table>_id_seq TO aiwholesail;"` |
| "Search hangs" | PropData upstream timeout | Check the `TIMEOUT` code in propdata logs; the proxy has a 15s axios timeout — if PropData itself is slow, no client fix. |

## Escalation

| Condition | Action |
|---|---|
| 1 user, single ZIP, no log errors | Reply with coverage caveat, sit overnight. |
| 2+ users in <30 min | Page connor@upscaledinc.com immediately. |
| Any 5xx pattern in `aiwholesail-api` logs | Page connor@upscaledinc.com. Tier 1 first, debug after. |
| Feed-ratio dispatch shows planner collapse | Tier 1 mitigation **before** debugging — restore service first. |
| Active Stripe checkout impact | All-hands page + Stripe webhook health check via `aiwholesail-api/scripts/health-monitor.js`. |

## Reference — related code paths

- `src/components/AbsenteeOwnerSearch.tsx` — search UI + per-ZIP fan-out
- `src/lib/lead-types.ts` + `aiwholesail-api/lib/lead-types.js` — planner (canonical impl in `.js`)
- `aiwholesail-api/routes/propdata.js` — backend proxy + structured log emission
- `aiwholesail-api/lib/offmarket-monitor-thresholds.js` — SLI evaluators behind this runbook's alerts
- `aiwholesail-api/scripts/offmarket-routing-monitor.js` — cron that fires the alert that pointed here

## Last-resort: ask the previous on-call

If the symptom doesn't match anything above and the user impact is widening,
ping connor@upscaledinc.com directly — they shipped the most recent
off-market changes and have the freshest context.
