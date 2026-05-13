# Email Lifecycle Audit — AIWholesail

> Generated: 2026-05-12
> Scope: `email-templates/` directory + the trial-lifecycle gaps named in `marketing-context.md`.

## Current state

| Template | Trigger | Purpose | Status |
|---|---|---|---|
| `welcome-template.html` | Account signup | Onboarding — 3-step quick start | ✅ Exists |
| `analysis-complete-template.html` | AI analysis finishes | Result notification | ✅ Exists |
| `property-alert-template.html` | New deal matches alerts | Engagement | ✅ Exists |

**Conclusion: transactional emails exist. Lifecycle emails do NOT.**

The marketing-context calls for Day −1, Day 0, Day +1, and Day +7 nudges. None of those templates exist in `email-templates/`. This is the biggest revenue-adjacent gap in the email stack.

## Gap analysis

### Trial lifecycle (missing — high priority)

| Day | Trigger | Purpose | Status | Estimated lift |
|---|---|---|---|---|
| Day −2 | 2 days before trial expires | Soft warning + value reinforcement (deals scored, calculators used) | ❌ Missing | +5–10% trial-to-paid |
| Day −1 | 24 hours before trial expires | Urgency + price reminder | ❌ Missing | +3–6% trial-to-paid |
| Day 0 | Trial expired, no conversion | "Restore your account" + saved-data reminder | ❌ Missing | +2–5% trial-to-paid |
| Day +3 | 3 days after expiration | Win-back: discounted first month or annual offer | ❌ Missing | +1–3% recovery |
| Day +14 | 14 days after expiration | Last-touch: "we'll close your data in 30 days" | ❌ Missing | Modest |

A complete lifecycle sequence at industry averages should add **8–18 percentage points** to trial-to-paid. On a 30% baseline that's ~26-50% relative lift.

### Onboarding (partial — medium priority)

| Day | Trigger | Purpose | Status |
|---|---|---|---|
| Day 0 | Signup | Welcome + 3-step start | ✅ Exists |
| Day +1 | No activity in 24h | "Need help finding your first deal?" | ❌ Missing |
| Day +3 | First saved property | Founder-direct check-in (text from 248-881-4147) | ❌ Missing |
| Day +5 | Plan-tier mismatch | "Hit your search limit? Here's Elite" upsell | ❌ Missing |

### Engagement (partial — low-medium priority)

| Trigger | Purpose | Status |
|---|---|---|
| New deal in alerts | Property notification | ✅ Exists |
| Analysis complete | AI score ready | ✅ Exists |
| Weekly digest | Top-scored deals this week | ❌ Missing |
| Skip-trace credit low | "5 credits left, top up or upgrade" | ❌ Missing |
| Buyer-pitch PDF generated | Disposition follow-up | ❌ Missing |

### Win-back / churn (missing entirely)

| Trigger | Purpose | Status |
|---|---|---|
| Paid cancellation | Save offer (50% off 2 months) | ❌ Missing |
| 30 days post-cancel | Re-engagement | ❌ Missing |
| 90 days post-cancel | "We've added X new features" | ❌ Missing |

## Subject-line patterns to use

The existing welcome template uses 🎉 emoji and a long subject. Patterns that test well for AIWholesail's voice (founder-direct, sharp, no guru):

| Pattern | Example |
|---|---|
| Direct value | "{{first_name}}, your AIWholesail trial ends tomorrow" |
| Specific number | "23 deals scored 80+ in {{user_city}} this week" |
| Question | "Did the platform find you a deal yet?" |
| Founder voice | "Quick note from Connor (founder)" |
| Time-bound | "12 hours to keep your saved deals" |
| Curiosity | "Why your trial is about to be worth $5,000" |

Avoid: "Don't miss out", "Last chance" (overused), excessive emoji, all-caps anything.

## What to build next (prioritized)

### Sprint 1 — trial lifecycle (highest revenue impact)

Create these 5 templates in `email-templates/`:

1. `trial-day-minus-2-template.html` — soft warning + activity recap
2. `trial-day-minus-1-template.html` — urgency + price + founder-direct line
3. `trial-day-0-template.html` — "your data is saved, restore in 1 click"
4. `trial-day-plus-3-template.html` — discounted reactivation
5. `trial-day-plus-14-template.html` — final retention nudge

Plus a triggering mechanism. Three options:
- **Resend + cron** (simplest, given `QUICKLOTZ_RESEND_API_KEY` is in env — though that key was for QL; AIW likely has its own; verify before using)
- **Stripe webhook → trigger function** (cleaner, tied to subscription events)
- **Supabase cron + edge function** (matches existing stack)

Match the existing `aiwholesail-api/` patterns — the engineering team likely has Resend or Postmark wired up already.

### Sprint 2 — onboarding fillers

1. `onboarding-day-1-no-activity.html`
2. `onboarding-day-3-founder-checkin.html`
3. `upgrade-elite-prompt.html`

### Sprint 3 — engagement loops

1. `weekly-digest.html` (top deals in user's markets)
2. `skip-trace-credits-low.html`
3. `buyer-pitch-pdf-generated.html`

### Sprint 4 — win-back

1. `cancel-save-offer.html` (50% off 2 months)
2. `winback-day-30.html`
3. `winback-day-90.html`

## Template guidelines

Match the existing `welcome-template.html` patterns:
- 600px max width, table-based layout (Outlook compatibility)
- Single primary CTA, dark-mode-friendly color palette matching the brand cyan
- Founder name + phone (248-881-4147) in the signature for trust signals
- One-line plain-text version for filter avoidance
- {{first_name}} merge tag where natural, never required

For lifecycle emails specifically:
- Lead with the user's actual usage data (deals scored, calculators run, comps pulled) — concrete > generic
- 1-click CTA that takes them to the "Restore" or upgrade flow
- Mention specific saved deals if any (data ties identity to value)

## Measurement

Once shipped, track per template:
- Open rate (target: 35-50% for trial lifecycle, lower for routine onboarding)
- Click rate (target: 8-15% for trial lifecycle)
- Conversion rate (trial-to-paid or paid-retention)
- Unsubscribe rate (target: <0.3% per send)

Resend dashboards expose all of these. If you're on Supabase, the `email_events` table pattern works for warehousing.

## What's NOT in this audit

- Cold outbound email sequences — that's a separate motion entirely (would use `/cold-email` skill)
- SMS lifecycle — same trial-flow logic but a different channel
- In-app messaging (banner inside the app) — adjacent to email but different infra
