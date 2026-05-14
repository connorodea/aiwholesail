# Phase 5 — Campaign Analytics Dashboard

> Status: design. Builds on the data already populated by PRs #341 (email_send_log) and #355 (email_inbound_replies + read_at).

## Why

Once campaigns start firing, users will immediately want to know:
- How many of my sends actually delivered?
- What's my open rate? Click rate?
- How many replies? How many bounced or unsubscribed?
- Which step in the sequence is doing the work?
- Should I cut step 4 (it's not pulling weight) or rewrite step 2?

We're already logging everything they need via the Resend webhooks. The data is in `email_send_log` (delivered_at, opened_at, clicked_at, replied_at, bounced_at, complained_at, unsubscribed_at) and `email_inbound_replies` (parsed_intent). Phase 5 is purely a presentation layer — no new ingestion.

## Surface

### Campaign list — at-a-glance metrics (already wired in stub form)

`pages/Campaigns.tsx` cards already show sent/replied counts. Extend the data fetch + display:

| Metric | Source |
|---|---|
| Sent | count of email_send_log rows for this campaign |
| Delivered | count where delivered_at IS NOT NULL |
| Opened | distinct recipients where opened_at IS NOT NULL |
| Replied | distinct recipients where replied_at IS NOT NULL |
| Interested | replied_at IS NOT NULL AND parsed_intent='interested' |
| Bounced | bounced_at IS NOT NULL |
| Unsubscribed | unsubscribed_at IS NOT NULL OR suppression added during campaign |

Rates derived: open rate = opened / delivered, reply rate = replied / delivered, interested rate = interested / delivered.

### Campaign detail page — new

New route `/app/campaigns/:id`. Three sections:

**1. Header**
- Campaign name, status badge, audience size, started date, sender FROM
- Action buttons: Pause / Resume / Cancel / Duplicate

**2. Funnel chart**
- Horizontal funnel: Sent → Delivered → Opened → Clicked → Replied → Interested
- Each stage shows count + percentage of prior stage
- Tailwind/Recharts. Pure SVG, no third-party chart lib install needed (we already have Recharts per package.json).

**3. Per-step breakdown table**
- One row per `sequence_steps.step_order`
- Columns: Day offset, Channel (sms/email), Subject (first 60 chars), Sent, Delivered, Open rate, Reply rate, Bounce rate, Recommended action ("good", "underperforming", "drop")
- "Recommended action" heuristic:
  - reply_rate > 5% → "good"
  - reply_rate > 1% AND open_rate > 20% → "good"
  - open_rate < 10% AND step_order > 1 → "rewrite subject"
  - delivered / sent < 0.85 → "deliverability issue — check spam reports"
  - bounce_rate > 5% → "audience quality issue"
  - else → "monitoring"

**4. Recent activity feed (right rail)**
- Last 20 events across the campaign: "Reply from <name> — interested", "Bounce from <addr>", "Unsubscribe from <addr>", "Sent step 2 to 45 contacts"
- Click → opens the relevant reply in /app/inbox or jumps to the campaign target row

### Per-recipient drill-down (modal)

Clicking a number in the funnel or step table opens a list of the recipients in that bucket, with: name, email, when they reached this stage, link to their inbox thread.

## API

One new endpoint, two query shapes:

```
GET /api/campaigns/:id/analytics?slice=overall|by-step|by-recipient
```

**overall** (default):
```json
{
  "campaign": { "id", "name", "status", "audience_count", "launched_at", "completed_at" },
  "totals": {
    "sent": 240, "delivered": 232, "opened": 87, "clicked": 14,
    "replied": 12, "interested": 7, "not_interested": 3, "unsubscribed": 2,
    "bounced": 8, "complained": 0, "in_suppression": 5
  },
  "rates": {
    "delivery_rate": 0.967, "open_rate": 0.375, "click_rate": 0.060,
    "reply_rate": 0.052, "interested_rate": 0.030, "bounce_rate": 0.033
  }
}
```

**by-step**:
```json
{
  "steps": [
    {
      "step_order": 1, "day_offset": 0, "channel": "email",
      "subject": "Quick question about {property_address}",
      "sent": 87, "delivered": 85, "opened": 38, "replied": 6,
      "open_rate": 0.447, "reply_rate": 0.071,
      "recommendation": "good"
    },
    { "step_order": 2, ... }
  ]
}
```

**by-recipient** (paginated):
```json
{
  "recipients": [
    {
      "target_id", "target_email", "target_name",
      "last_stage": "replied", "stages": {
        "sent_at": "...", "delivered_at": "...", "opened_at": "...",
        "replied_at": "...", "parsed_intent": "interested"
      },
      "lead_sequence_status": "paused"
    }
  ],
  "page": 1, "total": 240
}
```

SQL pattern for the overall slice (single query, indexed):

```sql
WITH targets AS (
  SELECT ct.id, ct.target_email, ct.lead_sequence_id
    FROM campaign_targets ct
   WHERE ct.campaign_id = $1
),
sends AS (
  SELECT esl.*
    FROM email_send_log esl
    JOIN targets t ON t.lead_sequence_id = esl.sequence_execution_id::uuid
                   OR LOWER(t.target_email) = LOWER(esl.to_address)
)
SELECT
  COUNT(*)                                                            AS sent,
  COUNT(*) FILTER (WHERE delivered_at IS NOT NULL)                    AS delivered,
  COUNT(DISTINCT to_address) FILTER (WHERE opened_at IS NOT NULL)     AS opened,
  COUNT(DISTINCT to_address) FILTER (WHERE clicked_at IS NOT NULL)    AS clicked,
  COUNT(DISTINCT to_address) FILTER (WHERE replied_at IS NOT NULL)    AS replied,
  COUNT(*) FILTER (WHERE bounced_at IS NOT NULL)                      AS bounced,
  COUNT(*) FILTER (WHERE unsubscribed_at IS NOT NULL)                 AS unsubscribed
  FROM sends;
```

(Join semantics: sequence_execution_id is the cleanest, but for safety we OR-match on lowered to_address against target_email for cases where sequence_execution_id wasn't recorded — should be never in practice but defends against historic gaps.)

## Frontend

Single new page + a chart sub-component:

- `src/pages/CampaignDetail.tsx` (~300 lines) — three-section layout, fetches overall + by-step on mount, by-recipient on table click
- `src/components/campaigns/FunnelChart.tsx` (~120 lines) — Recharts FunnelChart or a custom horizontal-bar variant
- `src/components/campaigns/StepBreakdownTable.tsx` (~150 lines) — sortable per-step table with the recommendation badges
- `src/components/campaigns/RecipientDrilldown.tsx` (~180 lines) — modal/sheet with the paginated recipient list

Route added in `App.tsx` after `/app/campaigns`. Nav stays the same — the detail page is reached by clicking a campaign card.

Flag-gated under the same `email-campaigns-v2` flag.

## Real-time updates (out of scope for v1, noted for v2)

For active campaigns, the dashboard should refresh every 30s. Use TanStack Query's `refetchInterval` — no new infra. WebSockets / push are overkill for the volumes we'll see in early dogfooding.

## Performance considerations

- All queries are indexed: `email_send_log(user_id, sent_at DESC)` + `(to_address, sent_at DESC)` + `(sequence_execution_id)` exist from migration 022
- The `by-step` join is naturally scoped to one campaign's worth of executions — bounded
- For 10k-recipient campaigns the overall slice should run in <100ms on the indexes we have. If it doesn't, add a materialized view `campaign_analytics_summary` refreshed by the worker after each tick

## Implementation sequence

1. Backend endpoint with the 3 slices, unit tests on the SQL
2. CampaignDetail page with funnel + step table (no drill-down yet)
3. Add the rate columns to the existing campaign list page
4. Recipient drill-down modal
5. Recent activity feed (separate endpoint `GET /api/campaigns/:id/activity?limit=20`)

Recommend single PR but commit boundaries match these 5 steps for easy review.

## Privacy / compliance

- The analytics page only shows the campaign owner their own campaign's data — scoped by `user_id` everywhere
- No PII surfaced beyond what's already in the inbox UI
- Per-recipient drill-down does not show open/click metadata (location, user-agent) — Resend exposes these but we don't surface them. Avoids ICO/GDPR scope creep.
