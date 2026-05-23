# scrape.do operations runbook

> Self-hosted Zillow + TruePeopleSearch scraping, layered as a fallback under the paid RapidAPI providers. Reduces recurring API cost and adds resilience when upstream providers are degraded.

**Owner:** connor@upscaledinc.com
**Service:** `aiwholesail-api.service` (systemd, port 3202) on `hetznerCO`
**Shipped:** PR #288 (base + agent fallback), PR #291 (route-layer fallback for all users), PR #292 (Zillow autocomplete)
**Source:** `aiwholesail-api/lib/scrapers/`, `aiwholesail-api/lib/zillowFallback.js`, `aiwholesail-api/lib/agent/zillowProxy.js`, `aiwholesail-api/routes/property.js`, `aiwholesail-api/routes/skipTrace.js`

Last updated: 2026-05-13 (initial).

---

## Architecture

```
                                  ┌──────────────────────────────────────┐
                                  │  feature_flag_globals (60s TTL cache)│
                                  │  zillow_scrape_do, skip_trace_tps    │
                                  └──────────────┬───────────────────────┘
                                                 │  isEnabled(userId, slug)
                                                 ▼
   client ──HTTPS──▶ aiwholesail-api (3202)
                       │
                       ├── routes/property.js                     ┌──────── RapidAPI primary ────────┐
                       │   • /zillow/search                       │ zillow-working-api.p.rapidapi.com│
                       │   • /zillow/details                      │  (paid, per-call)                │
                       │   • /intelligence  ────┐                 └──────┬───────────────────────────┘
                       │   • /off-market        │                        │ on 4xx/5xx/throw
                       │   • /comps             │ withZillowFallback()   ▼
                       │   • /photos            └─────────────────▶  lib/scrapers/zillowScrapeDo.js
                       │   • /autocomplete  ───────────────────────▶ lib/scrapers/zillowAutocompleteScrapeDo.js
                       │
                       ├── routes/skipTrace.js
                       │   • /search           ─── TPS primary (flag) ──▶ truePeopleSearch.js
                       │                       │                          │
                       │                       └─── V1 RapidAPI ──┐       │
                       │                                          │       │
                       │                       ─── V2 RapidAPI ───┤       │ TPS final fallback
                       │                                          │       │ (no flag, all users)
                       │                       on both 4xx/5xx ───┴───────┘
                       │
                       └── lib/agent/zillowProxy.js  (Cmd+K AI Agent path)
                           • PRIMARY swap when zillow_scrape_do=ON for the user
                           • silent FALLBACK to scrape.do when the RapidAPI proxy errors
                                                                    │
                                                                    ▼
                                            lib/scrapers/scrapeDoClient.js
                                                  │  GET https://api.scrape.do/?token=…&url=…
                                                  ▼
                                            scrape.do (residential proxy + optional headless)
                                                  │
                                                  ▼
                                          www.zillow.com  ·  www.truepeoplesearch.com
                                          www.zillowstatic.com/autocomplete/v3/suggestions
```

scrape.do is wired in **two places** that share the same underlying scrapers:

1. **Agent-tool layer** (`lib/agent/zillowProxy.js`) — used by the Cmd+K AI Agent. Flag-gated PRIMARY (dogfood users hit scrape.do first) plus silent FALLBACK for all users.
2. **REST route layer** (`lib/zillowFallback.js`, wired into `routes/property.js` and `routes/skipTrace.js`) — used by every UI page. RapidAPI is always tried first; scrape.do is the silent fallback. **No flag check on the route-layer fallback** — it fires for every user when RapidAPI errors.

Both backends normalize to the same logical shape (`mapPropertyToRapidApiShape`), so callers don't branch on which provider answered.

---

## Feature flags

Two flags drive the **PRIMARY-swap** behavior. The fallback paths fire for every user regardless of flag state. Tables live in migration `011_feature_flags.sql`; seed rows live in `017_scrape_do_flags.sql`.

| Slug | Default | cpodea5 override | What code reads it | What it does | How to flip globally |
| --- | --- | --- | --- | --- | --- |
| `zillow_scrape_do` | `enabled=false rollout_pct=0` | `enabled=true` (staff-dogfood) | `lib/agent/zillowProxy.js` (via `isEnabled(userId, slug)`) | When ON, the Cmd+K agent path goes to scrape.do FIRST for actions in `SCRAPE_DO_ACTIONS`, falls through to RapidAPI on any error. When OFF, RapidAPI is primary and scrape.do is only used as a fallback on RapidAPI errors. | `UPDATE feature_flag_globals SET enabled=true, rollout_pct=100 WHERE slug='zillow_scrape_do';` |
| `skip_trace_tps` | `enabled=false rollout_pct=0` | `enabled=true` (staff-dogfood) | `routes/skipTrace.js` (via `isEnabled(userId, slug)`) | When ON, `/api/skip-trace/search` tries TruePeopleSearch via scrape.do BEFORE the RapidAPI V1 + V2 providers (for `byaddress` + `bynameaddress` only). When OFF, TPS is only used as a final fallback after both V1 and V2 fail. | `UPDATE feature_flag_globals SET enabled=true, rollout_pct=100 WHERE slug='skip_trace_tps';` |

**Resolution order** (`aiwholesail-api/lib/featureFlags.js`):
1. Per-user `feature_flag_users` row wins (cpodea5 has these set to TRUE).
2. Global `feature_flag_globals` row — `enabled=true AND rollout_pct=100` ⇒ everyone, `0 < pct < 100` ⇒ deterministic hash bucket.
3. Default OFF.

**Cache:** 60-second in-memory TTL per process (`CACHE_TTL_MS` in `featureFlags.js`). Any UPDATE to the flag tables propagates in under 60s on every API process — no restart, no deploy.

**Always-on (no flag):**
- `routes/property.js` route-layer fallback via `withZillowFallback()` — fires for ALL 125 customers when RapidAPI errors.
- `routes/skipTrace.js` TPS final fallback — fires when both V1 and V2 RapidAPI providers fail.
- `lib/agent/zillowProxy.js` scrape.do fallback when RapidAPI proxy errors.
- `routes/property.js` `GET /api/property/autocomplete` — Zillow typeahead is scrape.do only; there is no RapidAPI counterpart.

---

## Promoting to 100% rollout

Run each promote in production against the aiwholesail DB. **Each statement is paired with its rollback right next to it.** The 60s flag cache means propagation is under a minute; no restart.

### Phase 1 — Zillow (PRIMARY swap to scrape.do for all 125 users)

```sql
-- Promote: everyone hits scrape.do first for the supported Zillow actions.
UPDATE feature_flag_globals
   SET enabled = TRUE, rollout_pct = 100, updated_at = NOW()
 WHERE slug = 'zillow_scrape_do';

-- Rollback (instant; 60s for the cache to expire on every process):
UPDATE feature_flag_globals
   SET enabled = FALSE, rollout_pct = 0, updated_at = NOW()
 WHERE slug = 'zillow_scrape_do';
```

Optional staged ramp before going full 100%:

```sql
-- 10% sample (deterministic hash bucket on user_id || slug):
UPDATE feature_flag_globals SET enabled = TRUE, rollout_pct = 10  WHERE slug = 'zillow_scrape_do';
-- 50%:
UPDATE feature_flag_globals SET enabled = TRUE, rollout_pct = 50  WHERE slug = 'zillow_scrape_do';
-- 100%:
UPDATE feature_flag_globals SET enabled = TRUE, rollout_pct = 100 WHERE slug = 'zillow_scrape_do';
```

### Phase 2 — Skip-trace (TPS primary for all users)

```sql
-- Promote: everyone hits TPS first for byaddress + bynameaddress.
UPDATE feature_flag_globals
   SET enabled = TRUE, rollout_pct = 100, updated_at = NOW()
 WHERE slug = 'skip_trace_tps';

-- Rollback:
UPDATE feature_flag_globals
   SET enabled = FALSE, rollout_pct = 0, updated_at = NOW()
 WHERE slug = 'skip_trace_tps';
```

### Verification after each promote

```bash
# 1. Confirm the row landed.
ssh hetznerCO 'psql "$DATABASE_URL" -c "SELECT slug, enabled, rollout_pct, updated_at FROM feature_flag_globals WHERE slug IN (\$\$zillow_scrape_do\$\$, \$\$skip_trace_tps\$\$);"'

# 2. Wait 60s for the cache to drain, then watch logs for the fallback warnings.
ssh hetznerCO 'journalctl -u aiwholesail-api -f | grep -E "scrape|zillow-fallback|RapidAPI"'

# 3. Hit a smoke endpoint from a non-staff account and confirm provider used.
#    For skip-trace, the response payload includes `provider_used` ('tps', 'v1', 'v2', or 'tps-fallback').
```

---

## Rollback procedure

**No code deploy required.** Flipping a flag global takes < 60s to propagate on every API process (the `CACHE_TTL_MS` window).

```sql
-- Zillow only:
UPDATE feature_flag_globals SET enabled = FALSE, rollout_pct = 0 WHERE slug = 'zillow_scrape_do';

-- Skip-trace only:
UPDATE feature_flag_globals SET enabled = FALSE, rollout_pct = 0 WHERE slug = 'skip_trace_tps';

-- Both (full kill switch on PRIMARY-swap behavior):
UPDATE feature_flag_globals
   SET enabled = FALSE, rollout_pct = 0
 WHERE slug IN ('zillow_scrape_do', 'skip_trace_tps');
```

**Note:** rolling these back disables the PRIMARY swap only. The route-layer fallback (`withZillowFallback`) and the TPS final-fallback in `routes/skipTrace.js` are **not** flag-gated and will continue to fire on RapidAPI errors. To kill the fallback path entirely you have two options:

1. **Unset the scrape.do token** so every scrape call throws immediately:
   ```bash
   ssh hetznerCO 'sudo systemctl edit aiwholesail-api'   # remove SCRAPE_DO_API_TOKEN from the unit
   ssh hetznerCO 'sudo systemctl restart aiwholesail-api'
   ```
   This is a hard kill — the fallback wrapper will catch the `ScrapeDoError` and rethrow the original RapidAPI error, so user-visible behavior matches pre-#288.

2. **Revert the wiring PR** (`PR #291`) and redeploy:
   ```bash
   git revert <merge-sha-of-291>
   git push origin main   # CI deploys
   ```

---

## Day-to-day monitoring

### Where to watch

- **scrape.do dashboard** — https://dashboard.scrape.do — request count, success rate, block rate, average latency, cost-this-month. Single source of truth for upstream health.
- **systemd logs** — `journalctl -u aiwholesail-api -f` filtered for `scrape`, `zillow-fallback`, `RapidAPI`. Every fallback fires a `console.warn` line tagged `[zillow-fallback]`, `[zillowProxy]`, or `[skip-trace]`.
- **Provider-metrics table** — `aiwholesail-api/routes/admin.js` exposes `GET /api/admin/scrape-metrics` once agent-E lands. Until then, grep logs.
- **Stripe / RapidAPI bills** — month-over-month delta after a 100% promote tells you whether the swap actually cut cost.

### What healthy looks like

| Signal | Healthy | Watch | Page |
| --- | --- | --- | --- |
| scrape.do success rate | ≥ 95% | 90-95% | < 90% |
| scrape.do block rate (HTTP 403 + `no_next_data` warnings) | < 5% | 5-15% | > 15% |
| Latency p95 (scrape.do dashboard) | < 3s detail / < 8s search | 3-6s / 8-15s | > 6s / > 15s |
| `[zillow-fallback] RapidAPI failed … served … from scrape.do` rate | < 2% of property-route traffic | 2-10% | > 10% (RapidAPI degrading) |
| `[zillow-fallback] both backends failed` | 0 | 1-5/hr | > 5/hr |
| Cmd+K agent tool errors per minute | < 1 | 1-5 | > 5 |

### What "scrape.do is degrading" looks like

- Sudden spike in `[zillow-fallback]` warnings paired with success — RapidAPI is unhealthy, fallback is doing its job. Don't roll back; check the RapidAPI status page first.
- Spike in `ZillowScrapeError reason=no_next_data` — Zillow is serving captchas. Mitigations in order: (a) wait 15min and retry, (b) enable `render=true` on detail-class actions (requires code change — currently hard-coded off), (c) enable `super=true` for premium residential pool.
- Spike in `TpsScrapeError reason=empty_html` or `jsdom_failed` — TruePeopleSearch is gating us behind a JS challenge. Flip `SCRAPE_DO_TPS_RENDER=true` in the systemd unit and restart (5x cost, but unblocks).
- Spike in `scrape.do HTTP 429` — over plan rate-limit. Client retries with backoff (`scrapeDoClient.js`), but if it bubbles up consistently, raise the scrape.do plan tier.
- Spike in `scrape.do HTTP 401` — token revoked or wrong. Check `SCRAPE_DO_API_TOKEN` on the prod box and the scrape.do dashboard.

---

## Common errors and what they mean

| Log line / error | Source | What it means | Fix |
| --- | --- | --- | --- |
| `SCRAPE_DO_API_TOKEN not configured` | `scrapeDoClient.js` | Env var missing from the systemd unit. | Add `SCRAPE_DO_API_TOKEN=<token>` to `/etc/systemd/system/aiwholesail-api.service` env, `systemctl daemon-reload && systemctl restart aiwholesail-api`. |
| `Zillow page missing __NEXT_DATA__ (likely block)` / `reason=no_next_data` | `zillowScrapeDo.js extractNextData` | Zillow served a captcha / soft-block / 200-OK challenge page. | Short-term: nothing — the route-layer fallback catches it and surfaces the original RapidAPI response. Mid-term: enable `render=true` in `propertyDetails()` or raise scrape.do plan to use `super=true`. |
| `Could not JSON.parse __NEXT_DATA__` / `reason=json_parse` | `zillowScrapeDo.js extractNextData` | Zillow served a truncated or malformed page. | Same as `no_next_data` — retry will usually clear it; if persistent, escalate. |
| `TPS returned empty/short body` / `reason=empty_html` | `truePeopleSearch.js parseSearchResults` | TruePeopleSearch served a JS challenge or empty page. | Set `SCRAPE_DO_TPS_RENDER=true` in the systemd unit + restart. 5x cost; only flip it if block rate > 15%. |
| `jsdom parse failed` / `reason=jsdom_failed` | `truePeopleSearch.js parseSearchResults` | HTML was returned but jsdom choked on it. | Usually transient — TPS HTML reshape. Check Sentry / log a parser-update task. |
| `scrape.do HTTP 429` | `scrapeDoClient.js scrape()` | Over rate-limit on the scrape.do plan. Client retries 2x with backoff. | If it bubbles up persistently, raise the scrape.do plan tier on the dashboard. |
| `scrape.do HTTP 401` | `scrapeDoClient.js scrape()` | Token revoked, expired, or wrong. | Check `~/.zshrc` on dev box and the systemd unit on `hetznerCO`. Generate a new token in the scrape.do dashboard, update env, restart. |
| `scrape.do HTTP 403` | `scrapeDoClient.js scrape()` | Account suspended OR scrape.do is being blocked at the target. | Check scrape.do dashboard for account status. If account is fine, target site is hard-blocking the proxy pool — same mitigations as `no_next_data`. |
| `scrape.do network error: …` | `scrapeDoClient.js scrape()` | DNS / connection / timeout reaching `api.scrape.do`. | Verify outbound network on `hetznerCO`: `curl -I https://api.scrape.do`. Default timeout is 30s — increase if upstream pages are slow. |
| `RapidAPI HTTP 502/503/504` | `routes/property.js`, `routes/skipTrace.js` | RapidAPI upstream is degraded. | **scrape.do fallback should be catching these.** If users are seeing 500s anyway, check whether the action is in `SCRAPE_DO_ACTIONS` (`lib/agent/zillowProxy.js`) or whether `zillowScrapeDo[<action>]` exists. Missing handler ⇒ fallback rethrows original error. |
| `[zillow-fallback] both backends failed for <action>` | `lib/zillowFallback.js` | RapidAPI and scrape.do both errored. Original RapidAPI error is rethrown to the user. | Check the scrape.do dashboard for global blocks; check RapidAPI status. If both are down, file a ticket — the product is degraded but not down (cache hits + other routes still work). |
| `[zillowProxy] flag lookup failed: …` | `lib/agent/zillowProxy.js` | Postgres connection issue reading `feature_flag_globals`. Code defaults to OFF and proceeds with RapidAPI. | Check DB health: `psql "$DATABASE_URL" -c 'select now();'`. |

---

## Cost playbook

### Reading the scrape.do dashboard

- **Successful requests** are billed; 4xx/5xx that scrape.do rejects upstream are not. Network errors and retries within the client are not double-charged.
- **`render=true` costs 5x.** Currently OFF for Zillow detail/search and OFF for TPS by default. The TPS one is gated on `SCRAPE_DO_TPS_RENDER`.
- **`super=true` (premium residential) costs ~2x.** Not currently enabled. Flip on per-call if block rate sustained > 15%.
- Filter by URL substring to attribute cost to each scraper:
  - `zillow.com/homedetails` → detail-class (propertyDetails, photos, taxes, priceHistory, zestimate, schools, comps — these all share one scrape per zpid)
  - `zillow.com/homes` → search-class (search, searchByAddress, forSale, forRent, recentlySold, foreclosures, fsbo)
  - `zillowstatic.com/autocomplete` → autocomplete (high volume, low cost — debounced 300ms on the client)
  - `truepeoplesearch.com/results` → skip-trace search
  - `truepeoplesearch.com/find/person` → skip-trace detail

### If the monthly bill spikes

1. **Pull the per-action breakdown.** Once the metrics table from agent-E lands:
   ```sql
   SELECT action, COUNT(*) AS calls, SUM(CASE WHEN ok THEN 1 ELSE 0 END) AS ok_calls
     FROM provider_scrape_metrics
    WHERE created_at > NOW() - INTERVAL '7 days'
    GROUP BY action
    ORDER BY calls DESC;
   ```
   Until it lands, grep `journalctl` for the action names.

2. **Look for hot actions.** Detail-class wrappers (taxes, photos, priceHistory) all hit the same scrape per zpid but bill separately if not deduped — the cache layer from agent-G fixes this. If agent-G isn't shipped yet, the agent-tool layer is the cheapest because it calls `propertyDetails` once and slices in-process.

3. **Look for autocomplete spam.** Each keystroke past the 300ms debounce on `LocationAutocomplete.tsx` is a billed scrape. If a bot is hammering `/api/property/autocomplete`, the route is already rate-limited at 60 req/min/ip — check whether that limiter is reaching its threshold.

4. **Look for render=true escapes.** If `SCRAPE_DO_TPS_RENDER=true` ever got flipped on and never flipped off, you're paying 5x on every skip-trace scrape.

5. **As a last resort:** flip the flags back to OFF and let RapidAPI absorb the load while you investigate.

---

## Adding a new Zillow endpoint

The pattern from `lib/scrapers/zillowScrapeDo.js`:

1. **Add the parser** to `lib/scrapers/zillowScrapeDo.js`. Follow the existing detail-class or search-class shape. For detail-class actions, the scrape is per-zpid; for search-class, it's per-location-URL.
   ```js
   async function myNewAction(args) {
     const url = `${ZILLOW_BASE}/...`;
     const resp = await scrape(url, { headers: DEFAULT_HEADERS, geoCode: 'us' });
     const nextData = extractNextData(resp.data);
     // ... slice the right record out of nextData ...
     return mapPropertyToRapidApiShape(property);   // or your own shape
   }
   module.exports = { ..., myNewAction };
   ```

2. **Register it in `SCRAPE_DO_ACTIONS`** in `lib/agent/zillowProxy.js` so the Cmd+K agent path can use it as PRIMARY or FALLBACK:
   ```js
   const SCRAPE_DO_ACTIONS = {
     ...
     myNewAction: zillowScrapeDo.myNewAction,
   };
   ```

3. **Wire it into the REST route** that needs it. Wrap the existing RapidAPI call with `withZillowFallback`:
   ```js
   const data = await withZillowFallback(
     async () => {
       const r = await axios.get('https://zillow-working-api.p.rapidapi.com/<path>', { params, headers: {...} });
       if (r.status >= 400) throw new Error(`RapidAPI HTTP ${r.status}`);
       return r.data;
     },
     'myNewAction',
     { /* args object the scraper takes */ }
   );
   ```

4. **Add a fixture test** in `test/lib/zillowScrapeDo.test.js`. Patterns:
   - Pure parser: drop a saved `__NEXT_DATA__` blob fixture, call your parser, assert the output shape.
   - Integration: mock `scrapeDoClient.scrape` to return the fixture string and assert end-to-end shape.

5. **Optional: wrap with `withCache`** from agent-G's Postgres cache wrapper if the action is high-volume + idempotent. Detail-class actions are the typical candidates; search-class usually changes too often to cache.

6. **Update the `SCRAPE_DO_ACTIONS` table** in this runbook's first section, and add a row to the cost-attribution list above.

---

## Cancellation criteria for RapidAPI subscriptions

Cancel a RapidAPI subscription only when **all** of the following hold:

- Both flags (`zillow_scrape_do` and `skip_trace_tps`) at `enabled=TRUE rollout_pct=100` for at least **7 consecutive days** with no rollback.
- scrape.do success rate ≥ 95% over the same 7 days (read from scrape.do dashboard).
- Route-layer fallback-catch rate (`[zillow-fallback] RapidAPI failed … served … from scrape.do`) < 2% of property-route traffic. A rate that high means RapidAPI is still doing meaningful work and is buying us resilience worth the bill.
- Zero `[zillow-fallback] both backends failed` events in the last 7 days.
- No customer-reported incidents tagged scrape.do, zillow, or skip-trace in that window.

When canceling:

1. Cancel the RapidAPI subscription on the dashboard.
2. **Leave the RapidAPI code paths in place for 30 days.** The fallback wrapper will treat 401-from-RapidAPI the same as a normal upstream error and fall through to scrape.do — but every call still pays the scrape.do bill twice (one failed RapidAPI attempt followed by the real scrape).
3. After 30 days clean: remove the RapidAPI call sites entirely in a separate PR. Until that PR ships, you can also unset `RAPIDAPI_KEY` in the systemd unit, which will make every RapidAPI call throw immediately and fall straight to scrape.do — fastest measurable cutover signal.

---

## Known caveats and tradeoffs

- **Parser brittleness.** Zillow reshapes their HTML / `__NEXT_DATA__` structure several times a year. RapidAPI absorbed those updates for us; now we own the fix. The recursive `deepFindProperty` guard in `zillowScrapeDo.js` is the safety net but it can produce subtly wrong field mappings on a major reshape. **If a field starts returning `undefined` for many zpids, check `deepFindProperty` first.**
- **TruePeopleSearch is even more brittle.** The CSS selectors in `truePeopleSearch.js parseSearchResults` (`div.card.card-block`, `a[href^="/find/person/"]`, etc.) are TPS DOM internals. They will break. Pin a snapshot of the live HTML in `test/fixtures/` and rerun on every parser change.
- **ToS violation.** Scraping Zillow and TruePeopleSearch violates both sites' terms of service. This is widespread and the practical risk is account-level rate limiting from scrape.do's IP pools, not legal action — but it is named here so future-you isn't surprised.
- **Block rate is non-zero on residential proxies.** Even with scrape.do's premium pools, Zillow and TPS will hard-block some fraction of requests (5-15% baseline; can spike during their cycles of anti-bot work). The fallback wrapper hides this from users but it shows up in cost (failed scrape requests are not billed but the latency tax is real).
- **`__NEXT_DATA__` extraction depends on Zillow's SSR.** If Zillow ever moves their listing pages to fully client-side rendering, every detail-class scrape would break and we would need `render=true` everywhere (5x cost) until we can wire up a different extraction path (graphql endpoint, or DOM-driven post-render parse).
- **Detail-class actions share one scrape per zpid but are billed independently if not cached.** Asking for `taxes` + `photos` + `priceHistory` for the same property is three scrape.do bills. The agent-tool layer already collapses these into one `propertyDetails` call and slices in-process. The route layer does not. Agent-G's Postgres cache wrapper closes this gap once it lands.
- **The Cmd+K agent path and the REST route path use DIFFERENT entry points.** The agent path goes through `lib/agent/zillowProxy.js` (flag-aware PRIMARY swap). The REST routes go through `lib/zillowFallback.js` (RapidAPI-first, scrape.do-fallback only). The flag flip controls the agent path; the routes flip whenever RapidAPI errors. Keep that in mind when reasoning about traffic split.
- **Autocomplete has no RapidAPI counterpart.** `GET /api/property/autocomplete` is scrape.do only. Killing the scrape.do token breaks autocomplete entirely (the input falls back to a plain text field — graceful degradation, no 500). There is no flag to disable it; remove the route to disable it.
- **Per-user override resolution is exact-match on `users.email`.** The dogfood override seed in `017_scrape_do_flags.sql` resolves `cpodea5@gmail.com` via a sub-select. If that account is renamed, the override silently does nothing — re-run the INSERT against the new email.
