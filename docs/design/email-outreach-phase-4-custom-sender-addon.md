# Phase 4 — $10/mo "Custom Sender" Add-on

> Status: design — not yet built. Lives downstream of PRs #340/341/346/352/355/357.

## Why

The Phase 3 outreach stack ships everyone on a shared sending domain (`send.aiwholesail.com`). Reputation on that domain is collectively held by every paid user — one bad actor blasting spammy lists tanks deliverability for everyone else.

Custom Sender is the standard remedy: serious users bring their own domain (BYO), set up DKIM/SPF/DMARC, and own their reputation in exchange for $10/mo. Three benefits compound:

1. **Reputation isolation** — their sends don't affect the shared pool and vice versa
2. **Personal sender identity** — emails come from `<user>@theirdomain.com`, which feels human, not from a SaaS subdomain
3. **Protect the shared domain** — discouraging high-volume users from the shared pool keeps `send.aiwholesail.com` deliverability healthy for everyone who doesn't pay

The pitch in the UI (already wired in `ContentStep.tsx` as a disabled card): _"Use your own domain for outreach. Better deliverability, branded sender identity, dedicated reputation."_

## Product surface

Two pieces:

### Settings page
- New section under `/app/account` (or a new `/app/account/email-sender` page) titled **Custom Sender**
- Three states:
  1. **Not subscribed** — feature card with $10/mo upgrade CTA. Click → Stripe Checkout for the add-on Price.
  2. **Subscribed, no domain configured** — domain setup wizard (next section)
  3. **Subscribed, domain verified** — domain status card showing FROM address, verified DKIM/SPF/DMARC, "Send test email" button, "Disconnect domain" link

### Domain setup wizard
- Step 1: **What email do you want to send from?** Input: `<user>@<theirdomain.com>`. We extract the apex.
- Step 2: **Add these DNS records to your registrar** — pull DKIM/SPF/return-path records from Resend, render them in a copy-paste-friendly table. Same UX as Resend's own dashboard does. Optional: detect-by-NS-record and link to provider docs (Cloudflare/Namecheap/GoDaddy each).
- Step 3: **Verification poll** — every 10s, hit `POST /api/custom-sender/:domain_id/verify` which calls Resend's verify endpoint. Show per-record status. When all green, advance to step 4.
- Step 4: **Set a Reply-To** — single input. Default = the email they entered in step 1. We use this on every outreach send.
- Step 5: **Done** — confirmation + "Send test email" button.

## Data model

Two new tables, one Stripe Price.

```sql
CREATE TABLE user_email_domains (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  domain VARCHAR(255) NOT NULL,
  resend_domain_id VARCHAR(64) NOT NULL UNIQUE,
  status VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending | verified | failed | disabled
  from_address VARCHAR(320) NOT NULL,
  reply_to VARCHAR(320),
  verified_at TIMESTAMPTZ,
  last_verify_check_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, domain)
);

CREATE INDEX idx_user_email_domains_user_status ON user_email_domains(user_id, status);

-- One Stripe entitlement row per active add-on subscription
CREATE TABLE user_addons (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  addon_slug VARCHAR(40) NOT NULL,           -- 'custom-sender'
  stripe_subscription_item_id VARCHAR(80) UNIQUE,
  status VARCHAR(20) NOT NULL,                -- active | canceled | past_due
  current_period_end TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, addon_slug)
);
```

## Stripe wiring

- New Stripe **Price** under the existing `AIWholesail` Product: `custom_sender_monthly` at $10/mo. Treat as a recurring subscription item rather than a separate subscription so it joins the user's existing line items.
- `routes/stripe.js` webhook handler:
  - `customer.subscription.updated` — if `items.data` contains the custom_sender price, upsert `user_addons` (status='active')
  - `customer.subscription.deleted` / item removed — set `user_addons.status='canceled'`
- New endpoint `POST /api/account/upgrade/custom-sender` → creates a Stripe Checkout Session with the add-on Price prefilled, success_url back to the domain setup wizard

## API

```
POST   /api/custom-sender/domain            create user_email_domains row, call Resend domains.create
GET    /api/custom-sender/domain            return current domain + Resend DNS records + status
POST   /api/custom-sender/domain/verify     call Resend domains.verify, update status
DELETE /api/custom-sender/domain            delete on Resend + soft-disable row
POST   /api/custom-sender/test-send         body: { to } → send a 1-line test email from the verified FROM
```

All gated behind a new flag `email-custom-sender` AND an entitlement check (user_addons.status='active' for slug='custom-sender'). Reject with 402 (Payment Required) if entitlement missing.

## getSender() integration

Extend `lib/senders.js` to look up the user's verified custom domain first:

```js
async function getSender(category, userId) {
  if (category === 'outreach' && userId) {
    const { rows } = await pool.query(
      `SELECT from_address FROM user_email_domains
        WHERE user_id = $1 AND status = 'verified' LIMIT 1`,
      [userId]
    );
    if (rows[0]) return rows[0].from_address;
  }
  return SENDERS[category];
}
```

This is async now — callers must `await`. Audit and migrate `routes/{buyers,communications,campaigns,auth,contact,exec}.js` plus 5 ops scripts. Most are already `async` functions so the await is a one-line change.

Same for `getReplyTo(category, userId)` — pull user's reply_to column when verified, else fall back to `reply@reply.aiwholesail.com`.

## Worker integration

`sequence-execution-worker.js` already pulls `user_id` from `lead_sequences.user_id`. Pass it into `getSender('outreach', user_id)` per row. The query gains one extra subselect per send but that's a tiny cost.

## DNS-provider hints

The wizard can detect the user's apex NS records and surface a provider-specific link:

| NS hostname suffix | Provider | Doc link |
|---|---|---|
| `cloudflare.com` | Cloudflare | https://developers.cloudflare.com/dns/manage-dns-records/how-to/create-dns-records/ |
| `registrar-servers.com` | Namecheap | https://www.namecheap.com/support/knowledgebase/article.aspx/319/2237/ |
| `domaincontrol.com` | GoDaddy | https://www.godaddy.com/help/add-a-cname-record-19236 |
| `googledomains.com` | Google Domains | https://support.google.com/domains/answer/3290309 |
| else | generic | "Add the records via your DNS provider's control panel." |

`dig +short NS <apex>` on the API server is enough. No need for a third-party detector.

## Edge cases

- **User cancels Stripe subscription** — disable the domain (status='disabled'), revert getSender() to shared, but DO NOT delete the Resend domain record (in case they re-subscribe within a grace period). Garbage-collect via a weekly cron after 30 days.
- **DNS verification fails after 24h** — keep the row, surface a "verification expired" state with a "Re-check" button. Don't auto-delete.
- **User changes their domain mid-campaign** — in-flight `sequence_executions` keep using the FROM that was current when queued. Worker reads the FROM live per send, so changes propagate to subsequent steps automatically. Document this in the wizard.
- **Multiple domains per user** — explicitly NOT supported in v1. One verified domain at a time. Document as a future expansion if asked.
- **Same domain on multiple users** — Resend allows it (each user gets their own DKIM key), but it's a footgun for shared-team accounts. Allow it; surface a warning in the wizard.

## Pricing math

Per-customer cost to us: ~$0/mo (Resend bills by send volume, not domain count). Margin on $10/mo: ~100%. Competitive: Apollo charges ~$50/mo for the same, BatchLeads bundles it into the $99 tier. $10 is aggressive enough to convert serious users and protect shared reputation.

## Implementation sequence

1. Migration 027 — `user_email_domains` + `user_addons` tables, Stripe webhook handler extension
2. Routes: `custom-sender.js` — 5 endpoints
3. `getSender()` + `getReplyTo()` made async + user-aware; cascade `await` through 8 send sites
4. Settings page — "Custom Sender" section + setup wizard component
5. Stripe Checkout Session creation endpoint + success_url plumbing
6. Worker `await getSender('outreach', row.user_id)`
7. Flag `email-custom-sender` seeded enabled=true rollout=0; per-user override for cpodea5@gmail.com
8. Test plan: Resend's test domain on a sandbox account, dogfood end-to-end before global launch

Recommend splitting this into 2 PRs: (1) DB + API + getSender plumbing, (2) UI + Stripe Checkout + smoke test.
