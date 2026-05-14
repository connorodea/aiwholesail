# Email Outreach — Session Status (2026-05-13)

Single-source-of-truth for the email outreach work shipped this Claude Code session, what remains, and how to resume. Sister file to the Todoist tasks under project `AIWholesail.com`.

---

## What shipped (PRs open, awaiting review/merge)

| # | Branch | Type | Stack | Summary |
|---|---|---|---|---|
| **340** | `feat/tools-calc-first-modal-only` | feat | independent | All 13 calculator pages render the calculator first on `/tools/<slug>`; modal-only inside property modal. tsc clean. |
| **341** | `feat/email-infra-split-phase-1` | feat | base | Sender domain split — `notifications.aiwholesail.com` (transactional), `send.aiwholesail.com` (outreach), apex reserved. `lib/senders.js` `getSender()`. Migration 022 (email_suppressions, email_send_log, email_inbound_replies). `scripts/sequence-execution-worker.js`. `routes/resend-webhooks.js` with Svix HMAC verify. Resend domains verified live. |
| **346** | `feat/campaign-builder-v2` | feat | atop #341 | Campaign Builder 4-step wizard at `/app/campaigns`. Migration 023 (agents). Migration 024 (campaigns + campaign_targets, nullable lead_sequences.lead_id). Migration 025 (`email-campaigns-v2` flag + per-user override for cpodea5@gmail.com). `lib/campaign-scheduling.js`. `routes/{campaigns,agents}.js`. `scripts/backfill-agents-from-leads.js`. 4 wizard steps + main page. Flag-gated everywhere. |
| **352** | `feat/sequence-worker-campaign-targets` | fix | atop #346 | Worker INNER JOIN leads → LEFT JOIN leads + LEFT JOIN campaign_targets. Without this, campaign-launched sequences never fire. |
| **355** | `feat/phase-3-reply-detection` | feat | atop #352 | Resend inbound webhook (`email.received`) → intent parsing → auto-pause sequence → auto-suppress on STOP. Migration 026 (read_at). `routes/inbox.js`. `pages/Inbox.tsx` + ReplyCard/ReplyDetail. `getReplyTo()` exporting reply@reply.aiwholesail.com. Reply-To wired on outreach sends. |
| **357** | `docs/email-outreach-runbook` | docs | off main | End-to-end 8-section deploy runbook + systemd .service/.timer templates. |
| **361** | `docs/email-outreach-phase-4-5-design` | docs | off main | Phase 4 (Custom Sender add-on) + Phase 5 (analytics) design docs + outreach roadmap. |
| **365** | `feat/phase-5-campaign-analytics` | feat | atop #355 | Campaign analytics — funnel chart + per-step breakdown + per-recipient drill-down + activity feed. `routes/campaigns.js` adds GET `/:id/analytics` + `/:id/activity`. `pages/CampaignDetail.tsx`. Updates campaign list with rate columns. |
| **366** | `test/email-outreach-unit-coverage` | test | atop #355 | 118 passing unit tests. Extracts `lib/{reply-intent,template-render,build-variables}.js` from inline code. Covers campaign-scheduling, senders, intent parsing, template render, buildVariables. |

**LOC**: ~7,800 code + ~700 tests + ~700 docs across 9 PRs.

---

## Production-side already live (no merge needed)

These took effect when I ran them — independent of code merges:
- Resend domain `notifications.aiwholesail.com` — verified
- Resend domain `send.aiwholesail.com` — verified
- Resend apex `aiwholesail.com` — `tracking_subdomain = track` set; CNAME `track.aiwholesail.com → links1.resend-dns.com` added to Namecheap and verified by Resend
- 26 existing Namecheap DNS records preserved verbatim; 7 new added (DKIM/SPF/MX for both subdomains + tracking CNAME)

---

## What's still TODO (in dependency order)

### Immediate — deploy what's already built
1. **Merge PRs** in this order: #340 (independent) → #341 → #346 → #352 → #355 → #365 → #366. Docs PRs #357 + #361 can merge any time.
2. **Apply migrations** 022, 023, 024, 025, 026 in prod DB via `psql -f`. Idempotent — safe to re-run.
3. **Configure Resend webhook** in dashboard → `https://api.aiwholesail.com/api/webhooks/resend` (all event types including `email.received`). Set `RESEND_WEBHOOK_SECRET` env on API host. Set BEFORE saving in Resend dashboard to avoid retry storm.
4. **Create `reply.aiwholesail.com` receiving domain** in Resend dashboard. Push the MX record to Namecheap (script template in `/tmp/push_aiwholesail_dns.py` from this session — adapt the `NEW` list to add the MX record returned by Resend).
5. **Install systemd timer** for the sequence-execution-worker per runbook section 6 (PR #357 ships the .service + .timer files in `aiwholesail-api/systemd/`).
6. **Smoke test** the full loop as `cpodea5@gmail.com` per runbook section 6 (steps 1-8). Verify Inbox + Analytics dashboards populate.

### Near-term — Phase 4 ($10/mo Custom Sender add-on)
Designed in PR #361 (`docs/design/email-outreach-phase-4-custom-sender-addon.md`). Not built. Estimated 2 PRs:
- PR-A: migration 027 (`user_email_domains`, `user_addons`), Stripe webhook handler extension, `getSender()` made async + user-aware, cascading `await` through 8 send sites, `routes/custom-sender.js` (5 endpoints)
- PR-B: Settings page section + DNS setup wizard + Stripe Checkout Session integration + smoke test

Recommended ordering: Phase 4 OR Phase 5 first — Phase 5 already built (PR #365), so Phase 4 is the next code build. But pick based on dogfooding signal — if early users are happy on the shared domain, defer Phase 4.

### Future (parked, roadmap in PR #361)
- **Phase 6**: per-step A/B variants (UI stub already exists in ScheduleStep.tsx)
- **Phase 7**: SMS channel completion (Twilio + per-user daily cap + Stripe metered billing)
- **Phase 8**: phone channel as a step (tap-to-dial task list)
- **Phase 9**: ML intent classification for the "unknown" bucket (Claude API)
- **Phase 10**: founder/ops rollup dashboard across all campaigns

### Explicitly NOT building
Cold dialer / power dialer, postal mail, full CRM, lead scoring. Refer users to dedicated tools. See roadmap doc for rationale.

---

## Resume-in-next-session checklist

When picking this up cold, run these to recover context:

```bash
# 1. Check open PRs in the stack
unset GITHUB_TOKEN
gh pr list --search "is:open author:connorodea email"

# 2. Verify Resend domains still verified
resend domains list

# 3. Check Todoist for outstanding items
curl -s -H "Authorization: Bearer $TODOIST_API_TOKEN" \
  "https://todoist.com/api/v1/tasks?project_id=6gQVf28hj7frgXmQ" \
  | jq '.results[] | select(.content | contains("outreach") or contains("Email") or contains("campaign"))'

# 4. Re-read this file + the deploy runbook
cat docs/runbooks/email-outreach-deploy.md
cat docs/design/email-outreach-roadmap.md
```

Memory entries to lean on:
- `feedback_use_worktree_isolation_for_parallel_agents.md` — non-negotiable for parallel dispatches
- `feedback_cli_first_auth.md` — Resend CLI before API
- `feedback_todoist_aiwholesail_full.md` — Todoist limit watching
- `aiwholesail_dev_tracker.md` + `aiwholesail_swe_workflow.md` — tracker workflow

---

## Lessons surfaced this session (saved to memory)

1. **Worktree isolation** is mandatory for parallel write-agents — a non-isolated parallel-dispatch destroyed several Phase 2 files mid-flight and forced a full rebuild
2. **CLI-first** for auth — `resend whoami` resolved a previously-failed API-key path in seconds
3. **Concurrent agents trade git ops** — multiple commits this session landed on the wrong branch and had to be cherry-picked. Always verify `git branch --show-current` after any state-modifying op
4. **Always re-fetch Namecheap DNS before setHosts** — the API is destructive; my script always GETs current → MERGES new → POSTs full payload to avoid loss
