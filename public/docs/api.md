# AIWholesail API & Integrations

> Last updated: 2026-05-12
> Status: Webhooks (production). REST API (private beta, on request).

## What's available today

| Capability | Plan | Notes |
|---|---|---|
| Outbound webhooks | Pro (3 endpoints) / Elite (unlimited) | Fire on deal events: new match, score change, skip-trace complete, contract sent |
| Native iOS / Android apps | All plans | Full feature parity with web for the core deal-finding workflow |
| Stripe Customer Portal | All paid plans | Self-serve billing, invoice history, plan changes |
| REST API access | On request | Currently in private beta — email connor@aiwholesail.com with your use case |

## Webhook events

When a deal event fires, AIWholesail POSTs a JSON payload to your registered endpoint. Common events:

- `deal.matched` — A new property hit your alert criteria
- `deal.scored` — AI score updated for a tracked deal
- `skip_trace.completed` — Owner contact info ready
- `contract.generated` — A contract PDF was generated and saved
- `pipeline.stage_changed` — A deal moved between pipeline stages

Configure endpoints under Settings → Integrations → Webhooks. Each endpoint can subscribe to a subset of events. Failed deliveries retry with exponential backoff up to 24 hours.

## REST API (private beta)

A REST API exists for high-volume customers, partners, and integration platforms. Endpoints cover:

- Property search (filtered by market, distress signal, spread)
- Deal score retrieval
- Skip-trace lookup (counts against monthly cap)
- Contract generation
- Pipeline CRUD

**Access:** Email connor@aiwholesail.com with:
1. Your use case (what you're building)
2. Expected request volume
3. Your AIWholesail plan (Pro or Elite)

There is no public OpenAPI spec yet. Approved partners get a Postman collection and direct support from the founder.

## Auth

- Webhooks: HMAC-SHA256 signature in the `X-AIWholesail-Signature` header. Verify with your webhook secret (shown once on endpoint creation).
- REST API: Bearer tokens, scoped per integration. Tokens managed in Settings → Integrations.

## Rate limits

- Webhooks: No outbound rate limit on AIWholesail side; receive at your own pace.
- REST API: Per-token quotas set during private-beta onboarding. Typical limit: 60 requests/minute, 10,000 requests/day.

## Data residency

All data is processed and stored in U.S. regions on Supabase / AWS infrastructure. We do not currently offer EU or other regional residency.

## Common integration patterns

| Pattern | Webhooks or API | Use case |
|---|---|---|
| Pipe new matched deals into a CRM (HubSpot, Pipedrive, GoHighLevel) | Webhooks | Wholesalers running outreach in their CRM |
| Send Slack / Discord alerts on $30K+ spread matches | Webhooks | Solo wholesalers wanting real-time deal pings |
| Auto-add skip-traced numbers to a dialer (CallTools, Mojo) | Webhooks | High-volume cold-callers |
| Pull AIWholesail deal scores into a custom underwriting spreadsheet | REST API | Funds and family offices |
| Bulk pre-screen a buyer's existing pipeline | REST API | Coaches / consultants |

## Sandbox / testing

No dedicated sandbox today. Test in your live account with low-stake endpoints (e.g., a webhook receiver you control, then delete test deals afterward). Reach out if you need scoped test credentials.

## SLA & uptime

AIWholesail does not publish a contractual SLA at this stage. Historical uptime tracks above 99.5%. Status updates during incidents come directly from the founder via email and (for Elite) text.

## Roadmap

- Public REST API documentation site
- OpenAPI spec
- Native Zapier / Make integration
- HubSpot / Pipedrive direct sync (no Zap required)

Email connor@aiwholesail.com with what would unblock you fastest.
