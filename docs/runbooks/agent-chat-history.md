# Runbook: Agent Chat History

**Owner:** connor@upscaledinc.com
**Service:** `aiwholesail-api.service` (systemd, port 3202) on `hetznerCO`
**Endpoints:** `GET/DELETE /api/ai/agent/sessions[/:id]`
**Source:** `aiwholesail-api/routes/aiAgent.js`, `aiwholesail-api/lib/agent/chatHistory.js`
**Migration:** `aiwholesail-api/migrations/010_chat_history.sql`
**Shipped:** PR #156 (`bbf0766`)

---

## Overview

Per-user persistence for Cmd+K chats: two Postgres tables (`agent_chat_sessions`, `agent_chat_messages`) joined by `session_id`. Each Cmd+K conversation is one session; only user prompts and final assistant text (plus citations + tool names) are stored — no intermediate `tool_use`/`tool_result` blocks. The Cmd+K modal lists the user's 20 most-recent sessions and can resume any of them.

---

## Health check

One command, returns OK or surfaces the failure mode:

```bash
ssh hetznerCO 'sudo -u postgres psql -d aiwholesail -tAc \
  "SELECT \
     (SELECT COUNT(*) FROM agent_chat_sessions) AS sessions, \
     (SELECT COUNT(*) FROM agent_chat_messages) AS messages, \
     has_table_privilege(\"aiwholesail\",\"agent_chat_sessions\",\"SELECT\") AS sess_grant, \
     has_table_privilege(\"aiwholesail\",\"agent_chat_messages\",\"SELECT\") AS msg_grant;"'
# Expect: counts|t|t — if either grant returns f, see "missing GRANT" failure mode.
```

End-to-end smoke test (requires a real JWT):

```bash
TOKEN="<paste-jwt>"
curl -sS https://api.aiwholesail.com/api/ai/agent/sessions \
  -H "Authorization: Bearer $TOKEN" | jq '.sessions | length'
# Expect: integer 0..20, no error
```

---

## Common operations

### Run / re-run the migration

```bash
ssh hetznerCO 'sudo -u postgres psql -d aiwholesail \
  -f /var/www/aiwholesail-api/migrations/010_chat_history.sql'
# Idempotent: CREATE TABLE IF NOT EXISTS + GRANT in a DO block.
```

### Inspect schema

```bash
ssh hetznerCO 'sudo -u postgres psql -d aiwholesail -c "\\d+ agent_chat_sessions"'
ssh hetznerCO 'sudo -u postgres psql -d aiwholesail -c "\\d+ agent_chat_messages"'
```

### Counts and recent activity

```bash
ssh hetznerCO 'sudo -u postgres psql -d aiwholesail -c \
  "SELECT COUNT(*) FROM agent_chat_sessions;"'

ssh hetznerCO 'sudo -u postgres psql -d aiwholesail -c \
  "SELECT id, title, message_count, updated_at FROM ( \
     SELECT s.id, s.title, s.updated_at, \
       (SELECT COUNT(*) FROM agent_chat_messages m WHERE m.session_id = s.id) AS message_count \
     FROM agent_chat_sessions s ORDER BY updated_at DESC LIMIT 10) t;"'
```

### Top users by session count

```bash
ssh hetznerCO 'sudo -u postgres psql -d aiwholesail -c \
  "SELECT user_id, COUNT(*) FROM agent_chat_sessions GROUP BY user_id ORDER BY 2 DESC LIMIT 10;"'
```

### View live persistence logs

```bash
ssh hetznerCO 'sudo journalctl -u aiwholesail-api -f --no-pager | \
  grep -E "session persistence|assistant persist|chatHistory"'
```

### Restart the API after schema changes

```bash
ssh hetznerCO 'sudo systemctl restart aiwholesail-api && sudo systemctl is-active aiwholesail-api'
```

---

## Failure modes

| Symptom | Likely cause | Fix command |
|---|---|---|
| Logs spam `[aiAgent] session persistence failed: permission denied for table agent_chat_sessions` | Migration ran as `postgres` but GRANTs to `aiwholesail` role never applied (the 007 incident — see PR #131 history) | `ssh hetznerCO 'sudo -u postgres psql -d aiwholesail -c "GRANT SELECT,INSERT,UPDATE,DELETE ON agent_chat_sessions,agent_chat_messages TO aiwholesail;"'` |
| `GET /sessions` returns 500 | Same — GRANTs missing on read path | Same fix as above |
| Sessions listed but `loadSession` returns `null` for valid ID | Session belongs to a different user (correct behavior) — or row was deleted by FK cascade when user removed | Check `SELECT user_id FROM agent_chat_sessions WHERE id = '<uuid>';` |
| `agent_chat_messages` row count growing >1M | No retention policy yet — high-volume users | See "Retention / cleanup" below |
| `appendAssistantMessage` logs `[aiAgent] assistant persist failed: invalid input syntax for type json` | Citation payload contains non-JSON-serializable value | Inspect `aiwholesail-api/lib/agent/router.js` accumulation block — `citations` should be plain objects |
| DELETE /sessions/:id returns 404 for own session | Row already removed (FK cascade from `users` table) or wrong user | Verify with `SELECT id, user_id FROM agent_chat_sessions WHERE id='<uuid>';` |
| Sessions exist but messages array is empty on load | User message persisted but assistant `accumulated.text` empty (router crashed before any text_delta) | Look upstream at `journalctl -u aiwholesail-api | grep "router error"` — chat history is the symptom, not the bug |

---

## Verify GRANTs exactly

This is the single most common production failure mode for any new table on `aiwholesail`. Run after every migration that creates a table:

```bash
ssh hetznerCO 'sudo -u postgres psql -d aiwholesail -c \
  "SELECT grantee, table_name, string_agg(privilege_type, \",\" ORDER BY privilege_type) AS privs \
   FROM information_schema.role_table_grants \
   WHERE table_name IN (\"agent_chat_sessions\",\"agent_chat_messages\") AND grantee = \"aiwholesail\" \
   GROUP BY 1,2;"'
# Expect two rows, each with privs = DELETE,INSERT,SELECT,UPDATE
```

Manual fix if missing:

```bash
ssh hetznerCO 'sudo -u postgres psql -d aiwholesail -c \
  "GRANT SELECT, INSERT, UPDATE, DELETE ON agent_chat_sessions TO aiwholesail; \
   GRANT SELECT, INSERT, UPDATE, DELETE ON agent_chat_messages TO aiwholesail;"'
```

---

## FK cascade behavior — know before you delete

Both tables use `ON DELETE CASCADE`:

- Deleting a row from `users` → all that user's `agent_chat_sessions` rows vanish → all their `agent_chat_messages` rows vanish.
- Deleting a row from `agent_chat_sessions` → all child `agent_chat_messages` rows vanish.

There is **no soft-delete**. Any GDPR/account-deletion flow that touches `users` will silently wipe chat history. Confirm intent before any `DELETE FROM users`.

---

## Retention / cleanup

Currently unbounded. Manual cleanup of stale sessions:

```bash
# Dry run — count sessions older than 90 days
ssh hetznerCO 'sudo -u postgres psql -d aiwholesail -c \
  "SELECT COUNT(*) FROM agent_chat_sessions WHERE updated_at < NOW() - INTERVAL \"90 days\";"'

# Apply — cascades to messages
ssh hetznerCO 'sudo -u postgres psql -d aiwholesail -c \
  "DELETE FROM agent_chat_sessions WHERE updated_at < NOW() - INTERVAL \"90 days\";"'
```

Vacuum after a large delete:

```bash
ssh hetznerCO 'sudo -u postgres psql -d aiwholesail -c \
  "VACUUM (ANALYZE) agent_chat_sessions, agent_chat_messages;"'
```

---

## Rollback

```bash
# Code-level: revert PR #156. Cmd+K agent (PR #152) keeps working — chat history
# was added as a *layer* on top, and the endpoint already handles persistence
# failures gracefully (best-effort try/catch in routes/aiAgent.js).
git revert bbf0766 --no-edit && git push origin main

# Schema-level: drop both tables. ONLY do this if you also revert the code,
# or the API will keep INSERTing into nonexistent tables.
ssh hetznerCO 'sudo -u postgres psql -d aiwholesail -c \
  "DROP TABLE IF EXISTS agent_chat_messages; DROP TABLE IF EXISTS agent_chat_sessions;"'

# Tagged checkpoint just before chat history shipped:
git checkout 1e66a43  # citations layer, no history
```

If only persistence is broken (not the agent itself), prefer the kill-switch on writes by temporarily removing GRANTs — the route's `try/catch` will log and continue:

```bash
ssh hetznerCO 'sudo -u postgres psql -d aiwholesail -c \
  "REVOKE INSERT, UPDATE ON agent_chat_sessions, agent_chat_messages FROM aiwholesail;"'
# Agent still streams; sessions just won't save. Restore GRANTs to re-enable.
```

---

## Cost / quota considerations

- Row size: avg 1–3 KB per session (user msgs + assistant text + small citations JSONB). 1M sessions ≈ ~3 GB on disk.
- No per-user quota on session count. Same `requireTierWithLimit({proMonthly:100})` cap on `/chat` indirectly bounds session creation.
- Index on `(user_id, updated_at DESC)` keeps the `GET /sessions` list query fast at any table size.
- Watch row count weekly: spike >10× baseline usually means a misuse (loop creating empty sessions).

---

## Escalation

- **Owner:** connor@upscaledinc.com
- **Postgres outage:** if `sudo -u postgres psql` itself fails, see the API runbook — the entire app is down, not just chat history.
- **GRANT regression:** patch in-place with the GRANT command above, then file a follow-up to fix the migration that introduced the new table.
