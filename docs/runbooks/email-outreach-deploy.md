# Email Outreach Stack — Deploy Runbook

End-to-end deploy procedure for the outreach email pipeline shipped across PRs **#340**, **#341**, **#346**, **#352**, and **#355**. Follow in order. Each section ends with a verification step — do not move on until verification passes.

The whole user-facing surface (Campaigns + Inbox + agent directory + new API routes) is **flag-gated behind `email-campaigns-v2`**. Migration 025 auto-enables it for `cpodea5@gmail.com` only. Anyone else hits a 404 on the gated APIs and the nav items are hidden.

---

## 0. Pre-flight

Confirm you're on the right account before touching anything:

```bash
unset GITHUB_TOKEN
gh auth status                          # must show: Active account: connorodea
resend whoami                           # must show: authenticated, full_access
```

Sanity-check the Resend domain inventory:

```bash
resend domains list
```

Expected verified domains:
- `aiwholesail.com` (apex, with `tracking_subdomain = track`)
- `notifications.aiwholesail.com`
- `send.aiwholesail.com`

If any are missing or unverified, **stop** and run `scripts/verify-resend-domains.cjs` until they're green.

---

## 1. Merge PRs in dependency order

| Order | PR | Branch | Stack |
|---|---|---|---|
| 1 | **#340** | `feat/tools-calc-first-modal-only` | independent — merge any time |
| 2 | **#341** | `feat/email-infra-split-phase-1` | base of the outreach stack |
| 3 | **#346** | `feat/campaign-builder-v2` | atop #341 |
| 4 | **#352** | `feat/sequence-worker-campaign-targets` | atop #346 |
| 5 | **#355** | `feat/phase-3-reply-detection` | atop #352 |

After each merge, wait for the existing CI/CD to deploy successfully before merging the next. If CI fails, do not stack the next PR until the failure is resolved — the migrations and code rely on the previous PR's tables and helpers.

**Verification after each:** `gh run list --branch main --limit 1` shows the latest deploy as `success`, and a `curl https://api.aiwholesail.com/health` returns `200 healthy`.

---

## 2. Apply database migrations

Migrations are NOT auto-applied on deploy. Run them manually against the production Postgres:

```bash
ssh hetznerCO
cd /var/www/aiwholesail-api
psql "$DATABASE_URL" -f migrations/022_email_suppression_and_replies.sql
psql "$DATABASE_URL" -f migrations/023_agents.sql
psql "$DATABASE_URL" -f migrations/024_campaigns.sql
psql "$DATABASE_URL" -f migrations/025_email_campaigns_v2_flag.sql
psql "$DATABASE_URL" -f migrations/026_email_inbound_replies_read_at.sql
```

If any migration errors with **`relation already exists`** that's idempotent and fine. If any errors with **`permission denied for table <foo>`**, see memory entry `feedback_postgres_table_ownership_split.md` — switch to a role that owns the table.

**Verification:**

```sql
\dt email_*                              -- must list: email_inbound_replies, email_send_log, email_suppressions
\dt campaigns campaign_targets agents     -- must list all 3
\d+ email_inbound_replies                 -- must include read_at column

SELECT slug, enabled, rollout_pct FROM feature_flag_globals
 WHERE slug = 'email-campaigns-v2';
-- expect: ('email-campaigns-v2', t, 0)

SELECT u.email, f.enabled, f.reason
  FROM feature_flag_users f JOIN users u ON u.id = f.user_id
 WHERE f.slug = 'email-campaigns-v2';
-- expect at least: ('cpodea5@gmail.com', t, 'staff dogfood — pre-approval')
```

---

## 3. Set the Resend webhook secret

The webhook handler in `routes/resend-webhooks.js` fails-closed when `RESEND_WEBHOOK_SECRET` is unset. Set it BEFORE configuring the webhook in the Resend dashboard so Resend doesn't retry-storm against a 401-returning endpoint.

In Resend dashboard → **Webhooks** → **Create a webhook**:
- Endpoint: `https://api.aiwholesail.com/api/webhooks/resend`
- Events: `email.delivered`, `email.opened`, `email.clicked`, `email.bounced`, `email.complained`, `email.delivery_delayed`, `email.failed`, `email.received` (all of them)
- Copy the signing secret (format `whsec_<base64>`)

On the API host:

```bash
ssh hetznerCO
sudo -u deploy bash -c "echo 'RESEND_WEBHOOK_SECRET=whsec_<paste>' >> /var/www/aiwholesail-api/.env"
sudo systemctl restart aiwholesail-api
sudo journalctl -u aiwholesail-api -n 50 --no-pager | grep -i resend
```

**Verification:** click "Send test event" in the Resend dashboard → the API logs should show `[resend-webhook] signature verified` (not 401, not 500).

---

## 4. Set up inbound mail for replies

The reply pipeline requires a separate receiving subdomain so the apex MX (currently ImprovMX) is untouched.

### 4a. Create the receiving domain in Resend

Currently the CLI doesn't expose receiving-only domain creation. Use the dashboard:

1. Resend dashboard → **Domains** → **Add Domain**
2. Name: `reply.aiwholesail.com`
3. Capabilities: **enable Receiving** (uncheck Sending if offered)
4. Region: `us-east-1` (match the other domains)
5. Copy the MX record Resend provides — typically `inbound-smtp.us-east-1.amazonaws.com` priority 10

### 4b. Push MX record to Namecheap

```bash
source ~/.zshrc
# IP must match the whitelist
[[ "$(curl -s https://api.ipify.org)" == "$NAMECHEAP_IP_CLIENT" ]] || echo "WARN: client IP changed"
```

Then merge the new record with the existing 33 records via the same pattern as `/tmp/push_aiwholesail_dns.py`:

```python
NEW = [
    {"Name": "reply", "Type": "MX",
     "Address": "inbound-smtp.us-east-1.amazonaws.com.",
     "MXPref": "10", "TTL": "1800"},
    # If Resend also requires an SPF TXT on reply.*, add it here.
]
```

**Always fetch the current host set first and re-send all records.** Namecheap's `setHosts` is destructive.

### 4c. Verify

```bash
dig +short MX reply.aiwholesail.com @1.1.1.1
# expect: 10 inbound-smtp.us-east-1.amazonaws.com.

resend domains list | jq '.data[] | select(.name == "reply.aiwholesail.com")'
# Trigger re-verify if status != verified:
#   resend domains verify <id>
```

---

## 5. Install the sequence-execution-worker systemd timer

The worker (`scripts/sequence-execution-worker.js`) polls `sequence_executions` for due rows and sends them via Resend. Without a timer, sequences never fire.

Create two unit files on the API host:

```bash
ssh hetznerCO
sudo tee /etc/systemd/system/sequence-execution-worker.service > /dev/null <<'EOF'
[Unit]
Description=AIWholesail sequence-execution-worker (one-shot run)
After=network.target postgresql.service

[Service]
Type=oneshot
User=deploy
WorkingDirectory=/var/www/aiwholesail-api
ExecStart=/usr/bin/node /var/www/aiwholesail-api/scripts/sequence-execution-worker.js
StandardOutput=append:/var/log/aiwholesail/sequence-worker.log
StandardError=append:/var/log/aiwholesail/sequence-worker.log
NoNewPrivileges=true
EOF

sudo tee /etc/systemd/system/sequence-execution-worker.timer > /dev/null <<'EOF'
[Unit]
Description=Run sequence-execution-worker every 5 minutes

[Timer]
OnBootSec=2min
OnUnitActiveSec=5min
RandomizedDelaySec=30s
Unit=sequence-execution-worker.service

[Install]
WantedBy=timers.target
EOF

sudo mkdir -p /var/log/aiwholesail
sudo chown deploy:deploy /var/log/aiwholesail
sudo systemctl daemon-reload
sudo systemctl enable --now sequence-execution-worker.timer
```

**Verification:**

```bash
sudo systemctl list-timers sequence-execution-worker.timer
# expect: NEXT shows a time within 5 min, ACTIVATES shows the .service

sudo -u deploy node /var/www/aiwholesail-api/scripts/sequence-execution-worker.js --dry-run
# expect: starts up, queries DB, prints "Scanned X | Sent 0 | Skipped 0 | Failed 0"
```

---

## 6. Smoke test the full loop

Sign in as `cpodea5@gmail.com` in the app:

1. **Nav check** — Campaigns + Inbox items visible. Other users should NOT see them.
2. **Build a tiny campaign** — `/app/campaigns` → New Campaign → pick Buyers audience, pick the "Initial Outreach" prebuilt template, write content, schedule "Send now", daily cap 5. Launch.
3. **Database check** —
   ```sql
   SELECT id, name, status, audience_count, launched_at FROM campaigns
    WHERE user_id = (SELECT id FROM users WHERE email = 'cpodea5@gmail.com')
    ORDER BY created_at DESC LIMIT 1;
   SELECT COUNT(*) FROM lead_sequences WHERE status = 'active' AND lead_id IS NULL;
   SELECT COUNT(*) FROM sequence_executions WHERE status = 'pending';
   ```
4. **Trigger worker manually** to skip the 5-min wait —
   ```bash
   sudo systemctl start sequence-execution-worker.service
   sudo journalctl -u sequence-execution-worker.service -n 50 --no-pager
   ```
5. **Mail delivery** — check the test recipient's inbox (use a personal address you control). FROM should be `outreach@send.aiwholesail.com`. Reply-To should be `reply@reply.aiwholesail.com`.
6. **Reply with "interested"** — within ~1 minute, an `email_inbound_replies` row should appear with `parsed_intent = 'interested'` and the corresponding `lead_sequences.status` should flip to `paused`. The reply also appears at `/app/inbox`.
7. **Reply with "stop"** — `email_suppressions` row inserted with `reason = 'unsubscribed'`. Future campaigns to that address are filtered before send.
8. **Tracking** — opens/clicks on the test email (if click tracking is enabled later) rewrite through `track.aiwholesail.com`, not the shared `resend-dns.com`.

---

## 7. Enable for more users (after smoke test passes)

**Per-user beta invite (recommended):**

```sql
INSERT INTO feature_flag_users (user_id, slug, enabled, reason)
SELECT id, 'email-campaigns-v2', TRUE, 'beta 2026-XX-XX'
  FROM users
 WHERE email IN ('user1@example.com', 'user2@example.com')
ON CONFLICT (user_id, slug) DO UPDATE SET enabled = TRUE;
```

**Gradual rollout to all paid users:**

```sql
UPDATE feature_flag_globals SET rollout_pct = 10 WHERE slug = 'email-campaigns-v2';
-- Wait a few days, watch logs/Sentry for errors and Inbox volume
UPDATE feature_flag_globals SET rollout_pct = 50 WHERE slug = 'email-campaigns-v2';
-- Wait again
UPDATE feature_flag_globals SET rollout_pct = 100 WHERE slug = 'email-campaigns-v2';
```

The rollout uses `hash(user_id || slug) % 100 < rollout_pct` so it's deterministic — same user is always either in or out, no flapping. Per-user overrides always win over the rollout bucket.

---

## 8. Rollback procedure

If something goes wrong post-merge:

1. **Kill the timer** — `sudo systemctl disable --now sequence-execution-worker.timer`
2. **Flip the flag globally OFF** — `UPDATE feature_flag_globals SET enabled = FALSE WHERE slug = 'email-campaigns-v2';` This hides all UI + 404s all gated endpoints for everyone, including overrides (per featureFlags.js resolution order).
3. **Pause every active campaign** — `UPDATE campaigns SET status = 'paused' WHERE status IN ('scheduled', 'running');` and `UPDATE lead_sequences SET status = 'paused' WHERE status = 'active';`
4. The Resend webhooks still fire, but they're idempotent — leave them on. They keep populating `email_send_log` engagement timestamps and `email_inbound_replies` rows that you can triage manually.
5. Revert the offending PR via `gh pr revert <num>` and redeploy.

Tables created by these migrations are **non-destructive** if rolled forward later — they just sit empty.

---

## Reference

- Resend tracking subdomain set: `aiwholesail.com.tracking_subdomain = track` → DNS: `CNAME track.aiwholesail.com → links1.resend-dns.com` (already pushed)
- Resend signing secret env var: `RESEND_WEBHOOK_SECRET`
- API host: `hetznerCO` (`ssh hetznerCO`)
- Code path: `/var/www/aiwholesail-api`
- Log path: `/var/log/aiwholesail/sequence-worker.log`
- DB connection string: `DATABASE_URL` in `/var/www/aiwholesail-api/.env`
- Worker invocation: `node scripts/sequence-execution-worker.js [--dry-run]`
- Verify-poll helper for Resend domains: `scripts/verify-resend-domains.cjs`
