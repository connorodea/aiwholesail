# Email Outreach — Roadmap

A single source of truth for what's shipped, what's queued, and what's parked. Sister doc to the deploy runbook.

## Shipped (in PR review)

| Phase | PR | What |
|---|---|---|
| 1a | #341 | Sender domain split, `lib/senders.js`, suppression migration, Resend webhook handler, sequence-execution-worker |
| 1b | #340 | Calculator tool-first refactor (orthogonal, bundled in same effort) |
| 2 | #346 | Campaign Builder 4-step wizard + bulk fanout API + agents directory + flag `email-campaigns-v2` |
| 2.5 | #352 | Worker JOIN patch — campaign-launched sequences actually fire |
| 3 | #355 | Inbound reply detection + auto-pause + auto-suppress + Inbox UI |
| ops | #357 | Deploy runbook + systemd unit templates |

After deploy:
- Resend tracking subdomain `track.aiwholesail.com` — verified, custom click-tracking live
- Resend domains: `aiwholesail.com` (apex, transactional + personal), `notifications.aiwholesail.com` (transactional only), `send.aiwholesail.com` (outreach) — all DKIM/SPF/MX verified
- Reply pipeline: needs Namecheap MX + Resend dashboard config (Section 4 of runbook)

## Queued (designed, not built)

### Phase 4 — Custom Sender add-on ($10/mo)
See [`email-outreach-phase-4-custom-sender-addon.md`](./email-outreach-phase-4-custom-sender-addon.md).

BYO domain for outreach. Protects shared `send.aiwholesail.com` reputation, gives high-volume users dedicated reputation, branded sender identity. ~$0 marginal cost, ~100% margin.

**Why next:** the dollar-attached feature in the stack. Validates outreach as a paid lane independent of the trial funnel. Removes the deliverability cliff that shared sending creates as more users come online.

### Phase 5 — Campaign Analytics Dashboard
See [`email-outreach-phase-5-campaign-analytics.md`](./email-outreach-phase-5-campaign-analytics.md).

Funnel chart + per-step breakdown + per-recipient drill-down. Data is already logged by Phase 1/3; this is pure presentation.

**Why this order:** Phase 5 is leverage on the data we'll start collecting the moment Phase 1-3 deploy. Users can't iterate on their campaigns without it. Lower-effort than Phase 4 (no Stripe, no DKIM wizard).

**Counter-argument for going 5-before-4:** dogfooders only see the analytics value after they've launched a few campaigns and want to know what's working. So Phase 5 lands more impactfully a week or two into dogfooding. Phase 4 lands impactfully on day 1 if the user has high deliverability ambitions.

Pick based on user signal from the first cohort.

## Parked (idea-stage, no design doc yet)

### Phase 6 — Per-step A/B variants
The `ScheduleStep.tsx` UI already has a stub for A/B variants ("Add variant" button, disabled). To turn that on:
- Schema: add `variant_label` column to `sequence_steps` (NULL for default), and `chosen_variant` to `sequence_executions`
- Random-assign variant on lead_sequences insert
- Analytics dashboard groups by variant_label
- "Winner promotion" — once one variant has statistically significant lift, auto-pause the loser and convert remaining sends to the winner

### Phase 7 — SMS channel completion
The schema supports `channel='sms'` and the worker has a stub that marks SMS executions as `sms_not_yet_implemented_in_worker`. To finish:
- Wire Twilio (already configured for one-off SMS via `routes/communications.js`)
- Per-user SMS daily cap separate from email cap
- SMS reply parsing → same auto-pause logic but webhooks from Twilio inbound, not Resend
- Cost concern: SMS is ~$0.0075/segment; needs a per-user balance + Stripe metered billing item

### Phase 8 — Phone-channel as a step
Tap-to-dial step type. When a step's `channel='phone'`, the worker doesn't auto-dial — it creates a "call task" that surfaces on a `/app/tasks` page for the user to manually click-to-call via Twilio.

### Phase 9 — Inbound classification ML
The current intent classifier is regex-based. Replace with a small Claude/Anthropic call (1-line prompt → JSON) for the ambiguous cases (parsed_intent='unknown'). Probably not worth the latency until reply volume is non-trivial.

### Phase 10 — Outreach analytics rollup for the operator
Cross-campaign view: which markets are converting, which buyer segments respond fastest, week-over-week trend lines. Distinct from per-campaign analytics — this is the founder/sales-lead view, not the campaign owner's view.

## What we explicitly will NOT build

- **Cold dialer / power dialer** — out of scope, regulatory minefield (TCPA, state-specific rules), distracts from the core search-favorites-alerts value prop. Refer users to BatchDialer or CallTools if they need this.
- **Postal mail / direct mail** — out of scope, no margin, fulfillment headaches. Refer to BallpointMarketing or PostalMethods.
- **Lead scoring / AI prioritization** — out of scope until we have enough data to train on. Phase 9's per-reply classification is the maximum AI we should ship before dogfooding signal proves more is needed.
- **CRM features** — out of scope. We're an outreach surface. If the user needs a full CRM, integrate with HubSpot / Pipedrive / GoHighLevel via the existing webhooks system (PR #260 — `/api/webhooks`).

## Cross-cutting concerns to maintain throughout

- **Feature flag everything until dogfooded** — every new surface lands under `email-campaigns-v2` (or a new sister flag if scope diverges) with `enabled=true, rollout_pct=0` + per-user override for cpodea5@gmail.com
- **Suppression always wins** — every send path must `LEFT JOIN email_suppressions` filter. No exceptions. New code paths default to including the filter; review reflexively rejects PRs that skip it.
- **Don't break apex reputation** — never route automated sending through `aiwholesail.com` apex. All FROMs go through `notifications.` or `send.` or a Phase-4 user-custom domain.
- **Worktree isolation for parallel agents** — non-negotiable. See `feedback_use_worktree_isolation_for_parallel_agents.md`.
- **Documentation alongside code** — every shipped phase gets a section in this roadmap + a deploy runbook entry. Don't ship a feature and call it done without writing down how to operate it.
