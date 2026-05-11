# Runbook: MCP Server Export

**Owner:** connor@upscaledinc.com
**Service:** `aiwholesail-api.service` (systemd, port 3202) on `hetznerCO`
**Endpoint:** `POST/GET/DELETE https://api.aiwholesail.com/mcp` (Streamable HTTP)
**Source:** `aiwholesail-api/routes/mcp.js`, `aiwholesail-api/lib/mcp/server.js`
**Shipped:** PR #157 (`2574059`)

---

## Overview

Public Model Context Protocol endpoint that exposes the same four Zillow primitives the in-product Cmd+K agent uses (`zillow_search`, `zillow_property`, `zillow_market`, `wholesale_deal_math`) to external MCP clients — Claude Desktop, Cursor, Continue. Runs in **stateless mode**: a fresh `McpServer` + `StreamableHTTPServerTransport` is built per request. Auth is a single shared API key in `MCP_API_KEY`, stored on disk at `/root/mcp-api-key.txt` (mode 600).

---

## Health check

One command, returns 200 + a `tools` array of length 4 or surfaces the failure:

```bash
MCP_KEY=$(ssh hetznerCO 'sudo cat /root/mcp-api-key.txt')
curl -sS -X POST https://api.aiwholesail.com/mcp \
  -H "x-api-key: $MCP_KEY" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}' | jq '.result.tools | length'
# Expect: 4
```

If the response is `Unauthorized`, the key on disk doesn't match the env. If it's `MCP server not configured`, `MCP_API_KEY` is missing from the systemd unit.

---

## Common operations

### Invoke a tool end-to-end (smoke test)

```bash
MCP_KEY=$(ssh hetznerCO 'sudo cat /root/mcp-api-key.txt')
curl -sS -X POST https://api.aiwholesail.com/mcp \
  -H "x-api-key: $MCP_KEY" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"zillow_search","arguments":{"action":"by_zipcode","zipcode":"78704"}}}' \
  | jq '.result.content[0].text | fromjson | .showing'
# Expect: integer 0..40
```

### List loaded tools

```bash
MCP_KEY=$(ssh hetznerCO 'sudo cat /root/mcp-api-key.txt')
curl -sS -X POST https://api.aiwholesail.com/mcp \
  -H "x-api-key: $MCP_KEY" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":3,"method":"tools/list","params":{}}' | jq -r '.result.tools[].name'
# Expect: zillow_search, zillow_property, zillow_market, wholesale_deal_math
```

### View live MCP logs

```bash
ssh hetznerCO 'sudo journalctl -u aiwholesail-api -f --no-pager | grep -E "\[mcp\]|POST /mcp"'
```

### Restart

```bash
ssh hetznerCO 'sudo systemctl restart aiwholesail-api && sudo systemctl is-active aiwholesail-api'
```

### Inspect the on-disk key (do not echo to shared chat)

```bash
ssh hetznerCO 'sudo ls -l /root/mcp-api-key.txt'
# Expect: -rw------- 1 root root <length> ... /root/mcp-api-key.txt
```

### Confirm the env var matches the file

```bash
ssh hetznerCO 'A=$(sudo cat /root/mcp-api-key.txt); \
  B=$(sudo cat /proc/$(pgrep -f "node.*aiwholesail-api")/environ | tr "\0" "\n" | grep ^MCP_API_KEY= | cut -d= -f2); \
  [ "$A" = "$B" ] && echo MATCH || echo MISMATCH'
# Expect: MATCH
```

### Rotate the key (see Kill switch section for full procedure)

```bash
NEW=$(openssl rand -hex 32)
ssh hetznerCO "echo '$NEW' | sudo tee /root/mcp-api-key.txt > /dev/null && \
  sudo chmod 600 /root/mcp-api-key.txt && \
  sudo systemctl edit --force --full aiwholesail-api"  # update Environment=MCP_API_KEY=...
ssh hetznerCO 'sudo systemctl daemon-reload && sudo systemctl restart aiwholesail-api'
```

---

## Failure modes

| Symptom | Likely cause | Fix command |
|---|---|---|
| `503 MCP server not configured (MCP_API_KEY missing)` | Env var absent from systemd unit | `ssh hetznerCO 'sudo systemctl edit aiwholesail-api'` → add `Environment=MCP_API_KEY=<value>` → `daemon-reload && restart` |
| `401 Unauthorized: missing or invalid MCP key` from a known-good client | Key rotated but client config not updated, OR key file on disk diverged from env | Verify with the MATCH command above; redistribute new key |
| `tools/call` returns `Zillow proxy rate limit exceeded` | Upstream RapidAPI 429 on the `/zillow-api` proxy (port 3201, pm2) | `ssh hetznerCO 'pm2 logs zillow-api --lines 100 --nostream | grep 429'` — back off or rotate RapidAPI key |
| `tools/call` returns `Zillow proxy error: HTTP 500` | Zillow proxy crashed | `ssh hetznerCO 'pm2 restart zillow-api && pm2 status zillow-api'` |
| `[mcp] request error: ...` in journalctl + 500 to client | `buildMcpServer()` threw or transport closed early | Tail `journalctl -u aiwholesail-api -n 100 \| grep "\[mcp\]"`; usually a tool-handler exception — check the offending tool in `lib/mcp/server.js` |
| Claude Desktop / Cursor connects then immediately disconnects | Missing `Accept: application/json, text/event-stream` header (MCP spec) | Confirm client is on a recent `mcp-remote`; older versions only send `Accept: */*` and the SDK rejects them |
| Calls succeed but `content[0].text` is `[]` | Zillow proxy returned `{listings:[]}` (legitimate empty result) | Not a bug — query had no matches |
| High p95 latency on MCP calls | Heavy upstream Zillow calls in `zillow_search` / `zillow_property` | Each request spins up a fresh `McpServer`; the bottleneck is always the proxy. Check `pm2 monit zillow-api` |
| 429 from our own API to the client | Hit the global `rateLimiter` middleware before reaching `mcpAuth` | Whitelist `/mcp` in `middleware/rateLimit.js` if MCP traffic legitimately bursts |

---

## Client setup quick reference

For a user adding the MCP server to **Claude Desktop** (`~/Library/Application Support/Claude/claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "aiwholesail": {
      "command": "npx",
      "args": [
        "-y", "mcp-remote",
        "https://api.aiwholesail.com/mcp",
        "--header", "x-api-key:${MCP_API_KEY}"
      ],
      "env": { "MCP_API_KEY": "<paste-key-here>" }
    }
  }
}
```

Cursor and Continue follow the same `mcp-remote` pattern. The shared key gates all clients — there is no per-user quota in V1.

---

## Rollback

```bash
# Full revert of the MCP feature. Cmd+K and chat history are unaffected
# (they don't import lib/mcp/* or routes/mcp.js).
git revert 2574059 --no-edit && git push origin main

# Tagged checkpoint just before MCP shipped:
git checkout bbf0766  # chat history landed, no MCP

# Or temporarily disable without a code rollback — unset the env var.
# routes/mcp.js will return 503 to every request:
ssh hetznerCO 'sudo systemctl edit aiwholesail-api'
# Add: Environment=MCP_API_KEY=
ssh hetznerCO 'sudo systemctl daemon-reload && sudo systemctl restart aiwholesail-api'
```

---

## Kill switch / key rotation

There is no `MCP_ENABLED=false` flag — disable by clearing the key. The auth middleware short-circuits to 503 when `MCP_API_KEY` is missing or empty.

```bash
# Emergency disable: clear the env var
ssh hetznerCO 'sudo mkdir -p /etc/systemd/system/aiwholesail-api.service.d && \
  echo -e "[Service]\nEnvironment=MCP_API_KEY=" | \
  sudo tee /etc/systemd/system/aiwholesail-api.service.d/mcp-killswitch.conf && \
  sudo systemctl daemon-reload && sudo systemctl restart aiwholesail-api'

# Re-enable with rotated key
NEW=$(openssl rand -hex 32)
ssh hetznerCO "echo '$NEW' | sudo tee /root/mcp-api-key.txt > /dev/null && sudo chmod 600 /root/mcp-api-key.txt"
ssh hetznerCO "echo -e \"[Service]\nEnvironment=MCP_API_KEY=$NEW\" | \
  sudo tee /etc/systemd/system/aiwholesail-api.service.d/mcp-killswitch.conf && \
  sudo systemctl daemon-reload && sudo systemctl restart aiwholesail-api"

# Confirm:
curl -sS -X POST https://api.aiwholesail.com/mcp \
  -H "x-api-key: $NEW" -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}' | jq '.result.tools | length'
# Expect: 4
```

Then notify all known MCP users to update their `MCP_API_KEY` env var in their client config.

---

## Cost / quota considerations

| Driver | Cost | Limit |
|---|---|---|
| Zillow proxy / RapidAPI | ~$0.001 per upstream call. MCP clients can fan out aggressively — a single Claude Desktop conversation can fire 30+ tool calls. | RapidAPI plan cap (also throttled to 429 by the `/zillow-api` proxy) |
| Compute on `aiwholesail-api` | Negligible — stateless build per request is microseconds vs. tool call latency | None |
| Per-user quota | **None.** V1 ships with one shared key. | A misbehaving client can burn the entire RapidAPI quota for the day. |

Monitor MCP traffic vs. Cmd+K traffic:

```bash
ssh hetznerCO 'sudo journalctl -u aiwholesail-api --since "1 hour ago" --no-pager | \
  awk "/POST \/mcp/{m++} /POST \/api\/ai\/agent\/chat/{c++} END{print \"mcp=\"m\" cmdk=\"c}"'
```

If MCP traffic exceeds Cmd+K by 5×, evaluate adding per-key rate limiting before V2 (per-user OAuth) ships.

---

## Escalation

- **Owner:** connor@upscaledinc.com
- **Shared-key compromise:** rotate immediately using the Kill switch flow above. Audit recent traffic with `journalctl -u aiwholesail-api --since "24h ago" | grep "POST /mcp"`.
- **Zillow proxy outage:** see Cmd+K runbook — same upstream dependency. The MCP endpoint will surface `Zillow proxy error: HTTP 5xx` to clients until the proxy is restored.
- **MCP SDK breaking change after npm update:** pin `@modelcontextprotocol/sdk` to a known-good version in `package.json` and redeploy.
