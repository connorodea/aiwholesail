# RapidAPI Gateway Runbook

Operations guide for the `/rapidapi/zillow/*` mount added in PR for
`feat/rapidapi-zillow-gateway-v2`. Companion repo with the OpenAPI spec and
publisher: <https://github.com/connorodea/aiwholesail-rapidapi>.

## Architecture

```
RapidAPI consumer
      │  X-RapidAPI-Key: <consumer key>
      ▼
aiwholesail-zillow.p.rapidapi.com  (RapidAPI gateway)
      │  X-RapidAPI-Proxy-Secret: <dashboard-issued>
      │  x-rapidapi-user: <consumer id>
      │  x-rapidapi-subscription: <plan>
      ▼
api.aiwholesail.com/rapidapi/zillow/*       ← this repo
      │  rapidapiProxySecret middleware
      │  (timing-safe check, synth req.user)
      ▼
routes/rapidapiZillow.js (proxy + batch-zestimates)
      │
      ▼
lib/agent/zillowProxy.js
      ├─ scrape.do (primary)
      └─ RapidAPI consumer-side (fallback)
```

The frontend's `/api/zillow/*` mount is **unchanged** — separate file,
separate middleware, same upstream proxy.

## Roll-out steps

### 1. Verify the code is on production

```bash
ssh hetznerCO 'cd /var/www/aiwholesail-api && git log --oneline -5'
```

Look for `feat(rapidapi): add /rapidapi/zillow gateway mount`. If absent,
deploy is pending — wait for the green CI/CD pipeline.

### 2. Configure the dashboard

While logged into rapidapi.com as `connor@upscaledinc.com`:

1. **Studio → My APIs → Add API Project →** Import OpenAPI →
   upload `openapi/zillow.yaml` from the companion repo.
2. **Hub Listing → Gateway → Target URL** →
   `https://api.aiwholesail.com/rapidapi/zillow`
3. **Hub Listing → Gateway → Firewall Settings** → **Copy** the
   auto-generated `X-RapidAPI-Proxy-Secret`.
4. **Hub Listing → Monetization** → enter the 4 tiers from
   `docs/pricing-strategy.md` (BASIC free / PRO $15 / ULTRA $49 / MEGA $199).

### 3. Provision the secret on the backend

```bash
ssh hetznerCO
cd /var/www/aiwholesail-api
# Append (don't replace) the two new env vars:
echo 'RAPIDAPI_GATEWAY_ENABLED=true' >> .env
echo 'RAPIDAPI_PROXY_SECRET=<paste-from-dashboard>' >> .env
pm2 reload aiwholesail-api
pm2 logs aiwholesail-api --lines 20 --nostream
```

Look for: `[Server] RapidAPI gateway mount enabled at /rapidapi/zillow`.

### 4. Smoke test from a workstation

```bash
BASE=https://api.aiwholesail.com \
RAPIDAPI_PROXY_SECRET=<same-value> \
./scripts/smoke-test-rapidapi-zillow.sh
```

Expected:
- Request 1 (no header) → **HTTP 401**
- Request 2 (wrong secret) → **HTTP 401**
- Request 3 (right secret) → **HTTP 200** with `{success: true, data: ...}`

### 5. Publish the listing

In `connorodea/aiwholesail-rapidapi`:
```bash
make publish
```
This calls the RapidAPI CI/CD API and creates the listing. The first run
writes the `apiid` to `publish/.api-ids.json` so subsequent updates are
in-place.

## Disable / rollback

```bash
ssh hetznerCO
cd /var/www/aiwholesail-api
# Either flip the flag:
sed -i 's/^RAPIDAPI_GATEWAY_ENABLED=true/RAPIDAPI_GATEWAY_ENABLED=false/' .env
# OR rotate the secret to instantly break gateway traffic:
sed -i 's/^RAPIDAPI_PROXY_SECRET=.*$/RAPIDAPI_PROXY_SECRET=ROTATED_/' .env
pm2 reload aiwholesail-api
```

Then in the RapidAPI dashboard either:
- Archive the listing (preserves data, prevents new subscriptions)
- Rotate the secret to match the new backend value

## Observability

`/rapidapi/zillow/*` requests share the same `morgan` access log as the
rest of the API. To slice by source:

```bash
ssh hetznerCO 'pm2 logs aiwholesail-api --lines 0' | grep '/rapidapi/zillow'
```

The synthesised `req.user.id` is prefixed with `rapidapi:` so any
log/audit query can distinguish RapidAPI consumers from frontend users.

## Failure modes

| Symptom | Likely cause | Fix |
|---|---|---|
| 503 "Gateway not configured" | `RAPIDAPI_PROXY_SECRET` unset | Set the env var, reload |
| 401 on every request | Secret mismatch with dashboard | Re-copy from dashboard and replace `.env` value |
| 404 on `/rapidapi/zillow/proxy` | `RAPIDAPI_GATEWAY_ENABLED` not `true` | Flip flag, reload |
| 500 "both backends failed" | scrape.do AND RapidAPI fallback failing | Check scrape.do status; the route logs the underlying error |
| Rate-limited (429) immediately | Same `rapidapi:<user>` bucket hammered | Per-consumer; verify `x-rapidapi-user` is varying |
