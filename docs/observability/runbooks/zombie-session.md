# Runbook: Frontend zombie session

## Alert
- **Alert ID:** C4
- **Severity:** Critical
- **Source:** PostHog event `NOT_AUTHENTICATED_toast_shown` — fires from `src/pages/RealEstateWholesaler.tsx` (~line 487) when the frontend still renders the user as signed in but the API returns 401. Alert trips on ≥1 unique `user_id` per 60-min window.
- **SLA to acknowledge:** 5 min

## What this alert means
The user thinks they're signed in. The UI shows their name, their dashboard, their saved properties. But every API call returns 401 and they see a `NOT_AUTHENTICATED` toast on every action. This is the **cpodea5 2026-05-14 incident class** — one customer is silently broken. C4 is per-user-precise; if many users at once, you'll also see C3 (auth-401-storm) trip — handle that one first.

## Decision tree
- 1 unique user → narrow incident; PR #376 self-heal should already be repairing on refresh. Confirm + reach out.
- Multiple unique users in <60 min → broader auth regression. Skip to "broad" path in step 1.
- Spike correlates with a deploy → revert the auth-touching PR.

## Likely causes (ranked)
1. **Token rotation race** — PR #319 added single-flight refresh to prevent this. If still firing, the single-flight is missing a code path or another tab is racing. ETR: confirm + ship spot-fix.
2. **Browser localStorage quota eviction** — Chrome / Safari evicts the token key under storage pressure. PR #376 added self-heal (`tokenStorage.clear()` on bad-state detect). User just has to refresh.
3. **Stale service-worker bundle** — old JS reads an old key layout. ETR: bust SW cache or wait for SW update cycle.
4. **Cross-tab signout partial-propagation** — sign-out in tab A leaves tab B with a half-cleared store.
5. **Browser extension interference** — privacy extension wiping cookies on a timer.

## Triage steps (do these in order)

### 1. Confirm scope from PostHog
Open PostHog → Events → filter `event = NOT_AUTHENTICATED_toast_shown`, last 60 min, group by `user_id`.
- **1 unique user** → narrow. Continue to step 2.
- **2-3 unique users** → suspect a small-cohort regression (browser version, feature flag bucket). Continue to step 2 *and* check what they have in common.
- **>3 unique users** → broad. Treat as C3 (`auth-401-storm.md`). Likely a deploy regression — start there.

### 2. Pull the affected user's session
From PostHog, click into the user's most recent session recording (or session timeline if recordings aren't on). Look for:
- The route they were on when the toast fired
- `user_agent` (Chrome version, Safari, extension hints)
- Whether they had multiple tabs open
- Whether a sign-out happened recently in another tab

### 3. Check if PR #376 self-heal fired for them
The self-heal calls `tokenStorage.clear()` when it detects bad state. In PostHog, look for the user's events after the toast — they should see a forced re-auth screen, then sign back in successfully.

```bash
# Search frontend for the self-heal code path to confirm what it logs
grep -rn "tokenStorage.clear\|self-heal\|zombie" /Users/connorodea/Developer/aiwholesail/src --include="*.ts" --include="*.tsx"
```
If you don't see a follow-up successful sign-in event within ~2 min of the toast, the self-heal didn't fire — bug in PR #376, escalate.

### 4. Reach out to the user
For a single affected user, the fastest fix is human contact:
- Email or in-app DM: "We saw an auth-state issue on your account. Please refresh the page — if it persists, hard-reload (Cmd+Shift+R / Ctrl+Shift+R). We're investigating."
- The PR #376 self-heal makes refresh sufficient in nearly all cases.

### 5. Check whether their account is actually OK on the server
Confirm the user record itself is fine — the toast doesn't mean their account is broken, just that the client-side state is.
```bash
ssh hetznerCO 'sudo -u postgres psql aiwholesail -c "SELECT id, email, created_at, last_login_at FROM users WHERE email='"'"'<user-email>'"'"';"'
```
Expected: one row with sensible `last_login_at`. If row is missing → server-side deletion, separate problem.

[verify] — the exact column names on `users`. Check `aiwholesail-api/migrations/001_initial_schema.sql` if uncertain.

## Resolution paths

### A. Single user, refresh fixes it
PR #376 self-heal handles it. Reply to the user, log the event, close. No code action needed unless it recurs for the same user >1×.

### B. Single user, refresh does NOT fix it
The self-heal isn't firing for this case. Get the user's `user_agent` and route, then:
1. Try to reproduce locally with the same browser
2. If reproduced → spot-fix the self-heal condition. Branch `fix/zombie-session-<browser>-<date>`.
3. If not reproducible → ask the user to clear site data manually:
   - Chrome: DevTools → Application → Storage → Clear site data
   - Then sign back in
4. File a follow-up to add the missing self-heal condition.

### C. Multiple users, recent deploy
Identify auth-touching merges:
```bash
git log origin/main --oneline --since="6 hours ago" -- src/lib/api-client.ts src/lib/auth aiwholesail-api/routes/auth.js aiwholesail-api/lib/auth
```
Revert the suspect:
```bash
git revert --no-edit <bad-sha>
git push origin main
```
~5 min to redeploy.

### D. Multiple users, no recent deploy
Then this is either an upstream auth issue (treat as C3) or a slow-creep regression. Switch to `auth-401-storm.md` for the broader triage.

## Post-incident
- **Capture for postmortem:**
  - Affected `user_id`(s)
  - Browser + OS + extensions if reported
  - Whether PR #376 self-heal fired
  - Time from first toast → first successful authed request after recovery
  - Did the user have to be contacted manually, or did refresh fix it
- **Follow-up tasks:**
  - If self-heal didn't fire: add the case it missed to its condition
  - If user-contact was needed: improve the toast copy to tell the user to refresh
  - If the same `user_id` recurs >1×: this user is a canary — look closer at their setup
- **Log the incident:** Todoist `aiwholesail` / `BUGS`: `INCIDENT YYYY-MM-DD: zombie-session — user <id> — <root cause>`.

## Reference incidents
- **cpodea5 2026-05-14** — canonical case. PR #375 (detection) + PR #376 (self-heal) shipped in response.
- PR #319 — single-flight token refresh
- PR #375 — frontend zombie-state detector
- PR #376 — `tokenStorage.clear()` self-heal on bad-state detect
