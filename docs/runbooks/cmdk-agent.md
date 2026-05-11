# Runbook: Cmd+K AI Agent

**Owner:** connor@upscaledinc.com
**Service:** `aiwholesail-api.service` (systemd, port 3202) on `hetznerCO`
**Endpoint:** `POST https://api.aiwholesail.com/api/ai/agent/chat` (SSE)
**Source:** `aiwholesail-api/routes/aiAgent.js`, `aiwholesail-api/lib/agent/*`
**Shipped:** PR #152 (`cf5e6fb`), citations PR #154 (`1e66a43`)

---

## Overview

Cmd+K AI Agent is an in-product research assistant for wholesalers. A Sonnet 4.6 router decides between four Haiku 4.5 specialist subagents (`dealHunter`, `compAnalyst`, `marketWatcher`, `sellerMotivator`) and four raw Zillow primitives, and streams the synthesized answer back over SSE. All Zillow data flows through the standalone `/zillow-api` proxy on port 3201.

---

## Health check

One command, returns `OK` or `FAIL <reason>`:

```bash
ssh hetznerCO 'curl -sS -o /dev/null -w "%{http_code}\n" https://api.aiwholesail.com/health && \
  systemctl is-active aiwholesail-api && \
  pm2 jlist | jq -r ".[] | select(.name==\"zillow-api\") | .pm2_env.status"'
# Expect: 200, active, online
```

Deeper smoke test (uses a real JWT — pull a recent one from the frontend localStorage or `/api/auth/login`):

```bash
TOKEN="<paste-jwt>"
curl -N -sS -X POST https://api.aiwholesail.com/api/ai/agent/chat \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"What is the median price in 78704?"}]}' | head -30
# Expect: SSE stream with {"type":"ready"}, {"type":"session",...}, text_delta events, then {"type":"done"}
```

---

## Common operations

### Deploy

```bash
# From a feature branch merged to main — CI handles the rsync + restart.
# Manual deploy (only if CI is wedged):
ssh hetznerCO 'cd /var/www/aiwholesail-api && git fetch && git reset --hard origin/main && \
  npm ci --omit=dev && sudo systemctl restart aiwholesail-api && \
  systemctl status aiwholesail-api --no-pager | head -15'
```

### Restart

```bash
ssh hetznerCO 'sudo systemctl restart aiwholesail-api && sudo systemctl is-active aiwholesail-api'
```

### View live logs

```bash
ssh hetznerCO 'sudo journalctl -u aiwholesail-api -f --no-pager'
```

### Tail recent agent activity

```bash
ssh hetznerCO 'sudo journalctl -u aiwholesail-api -n 200 --no-pager | grep -E "aiAgent|router|subagent"'
```

### Tail errors only

```bash
ssh hetznerCO 'sudo journalctl -u aiwholesail-api --since "1 hour ago" --no-pager | \
  grep -iE "error|failed|abort" | grep -v -E "DeprecationWarning"'
```

### Inspect env (no values, just keys)

```bash
ssh hetznerCO 'sudo systemctl show aiwholesail-api -p Environment | tr " " "\n" | sed "s/=.*//"'
# Confirm ANTHROPIC_API_KEY, ZILLOW_PROXY_SECRET, AI_AGENT_ENABLED present
```

### Count chats in last hour (from the user_events table)

```bash
ssh hetznerCO 'sudo -u postgres psql -d aiwholesail -c \
  "SELECT COUNT(*) FROM user_events WHERE event_type=\"ai_agent_chat\" AND created_at > NOW() - INTERVAL \"1 hour\";"'
```

---

## Failure modes

| Symptom | Likely cause | Fix command |
|---|---|---|
| `503 AI Agent temporarily disabled` | Kill switch on | `ssh hetznerCO 'sudo systemctl edit aiwholesail-api'` → remove `AI_AGENT_ENABLED=false` → `sudo systemctl restart aiwholesail-api` |
| SSE stream emits `{"type":"error","message":"ANTHROPIC_API_KEY not configured"}` | Env var missing/blank after deploy | `ssh hetznerCO 'sudo grep -c ANTHROPIC_API_KEY /etc/systemd/system/aiwholesail-api.service.d/*.conf'` then re-add via drop-in and `daemon-reload` |
| SSE error `Zillow proxy rate limit exceeded` | Upstream RapidAPI 429 on `/zillow-api` proxy | `ssh hetznerCO 'pm2 logs zillow-api --lines 100 --nostream | grep 429'` — back off or rotate RapidAPI key in `/root/zillow-api/.env` |
| SSE error `Zillow proxy error: HTTP 500` | Zillow proxy crashed | `ssh hetznerCO 'pm2 restart zillow-api && pm2 status zillow-api'` |
| SSE error `ZILLOW_PROXY_SECRET not configured` | API process missing the shared secret | Restore from `/root/.env.aiwholesail-api` and `sudo systemctl restart aiwholesail-api` |
| Router runs but no citations appear | Subagents not returning `search_result` blocks | Check `aiwholesail-api/lib/agent/subagents/*.js` — regression of PR #154. Roll back to `1e66a43` (see Rollback). |
| `429 Pro monthly cap reached (100/mo)` | User hit `proMonthly:100` limit | Expected — direct user to upgrade. To raise cap, edit `routes/aiAgent.js` `requireTierWithLimit({proMonthly:N})` and redeploy. |
| First `data:` chunk takes >10s | Router cold-start + Sonnet TTFB | Check Anthropic status page; check `journalctl -u aiwholesail-api -n 50 | grep router` for slow `tool_start` events |
| Stream cuts off mid-response | `req.on('close')` fired (client disconnect) or 60s nginx proxy timeout | Confirm nginx `proxy_read_timeout 600s;` in `/etc/nginx/sites-enabled/api.aiwholesail.com` |
| 500 `Cannot read properties of undefined` in agent logs | Tool result shape regression | Check recent commit on `lib/agent/tools/*.js`; revert offending commit |

---

## Rollback

The Cmd+K agent ships in three layered commits. Roll back the smallest layer first:

```bash
# 1. Disable via kill switch (zero-downtime, 30s) — preferred first step
ssh hetznerCO 'sudo systemctl set-environment AI_AGENT_ENABLED=false && \
  sudo systemctl restart aiwholesail-api'

# 2. Revert just the citations layer (PR #154)
git revert 1e66a43 --no-edit && git push origin main
# CI redeploys

# 3. Full feature revert (PR #152 — Cmd+K agent itself)
git revert cf5e6fb --no-edit && git push origin main

# Tagged checkpoint just before the agent shipped:
git checkout 943bf08  # last green main pre-Cmd+K
```

After any code rollback, confirm health check returns OK and SSE smoke test still streams.

---

## Kill switch

```bash
# Disable (returns 503 from POST /api/ai/agent/chat, leaves session list/load alone)
ssh hetznerCO 'sudo mkdir -p /etc/systemd/system/aiwholesail-api.service.d && \
  echo -e "[Service]\nEnvironment=AI_AGENT_ENABLED=false" | \
  sudo tee /etc/systemd/system/aiwholesail-api.service.d/killswitch.conf && \
  sudo systemctl daemon-reload && sudo systemctl restart aiwholesail-api'

# Re-enable
ssh hetznerCO 'sudo rm /etc/systemd/system/aiwholesail-api.service.d/killswitch.conf && \
  sudo systemctl daemon-reload && sudo systemctl restart aiwholesail-api'

# Verify state
ssh hetznerCO 'sudo systemctl show aiwholesail-api -p Environment | grep -o AI_AGENT_ENABLED=[a-z]*'
```

Source check: `routes/aiAgent.js` line 68 — `if (process.env.AI_AGENT_ENABLED === 'false') return 503`. Only the literal string `"false"` disables it; any other value (including unset) leaves it on.

---

## Cost / quota considerations

| Layer | Driver | Approx unit cost | Cap |
|---|---|---|---|
| Anthropic | Sonnet 4.6 router (1 turn) + 0–2 Haiku 4.5 subagents | $0.01–0.05 / chat | None server-side |
| Zillow proxy | RapidAPI calls via `/zillow-api` (port 3201) | ~$0.001 / call, up to ~20 calls per chat | RapidAPI plan cap |
| Postgres | One row in `agent_chat_sessions` + N rows in `agent_chat_messages` | Negligible | See chat-history runbook |
| Per-user | `requireTierWithLimit({eventType:'ai_agent_chat', proMonthly:100})` | — | Pro = 100/mo, Elite = unlimited |

Spend spike check:

```bash
# Anthropic console: usage per API key — visit console.anthropic.com/usage
# Our local count of router invocations today:
ssh hetznerCO 'sudo -u postgres psql -d aiwholesail -tAc \
  "SELECT COUNT(*) FROM user_events WHERE event_type=\"ai_agent_chat\" AND created_at::date = CURRENT_DATE;"'
```

Cost budget alarm threshold: >2000 chats/day org-wide (~$50–100/day) → investigate via:

```bash
ssh hetznerCO 'sudo -u postgres psql -d aiwholesail -c \
  "SELECT user_id, COUNT(*) FROM user_events WHERE event_type=\"ai_agent_chat\" AND created_at > NOW() - INTERVAL \"1 day\" GROUP BY user_id ORDER BY 2 DESC LIMIT 10;"'
```

---

## Escalation

- **Owner:** connor@upscaledinc.com
- **Anthropic outage:** status.anthropic.com — if router fails with 529/overloaded, flip the kill switch and post a banner.
- **Zillow proxy outage:** see `pm2 status zillow-api` on `hetznerCO`; restart with `pm2 restart zillow-api`. The agent will surface "Zillow proxy error" until healthy.
- **Cost runaway:** flip kill switch immediately, then audit `user_events` by `user_id`.
