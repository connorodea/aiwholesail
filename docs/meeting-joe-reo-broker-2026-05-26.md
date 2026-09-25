# Meeting Notes — Joe (REO Broker)

**Date:** 2026-05-26
**Attendees:** Connor, Joe (REO broker)
**Context:** Feature/integration brainstorm for aiwholesail.com — REO + auction + investor-network expansion

---

## 1. Auction & Listing-Source Integrations

External inventory pipes to pull into aiwholesail so investors search one place instead of ten.

| # | Source | Notes |
|---|---|---|
| 1 | **Hubzu** | REI auction — primary integration target |
| 2 | **HUDhomestore.gov** | Government REO listings |
| 3 | **auctions.com** | Major auction syndicator |
| 4 | **xome.com** | |
| 5 | **servicelink.com** | |
| 6 | **williamsandwilliams.com** | |

**Treatment in product:**
- New top-level **Auction** section, parallel to existing **On-Market** / **Off-Market**.
- **Reverse syndication** — let users *place bids* on these auction sites directly from inside aiwholesail (not just view).

---

## 2. Investor-Network / Distribution Channels

Where the deals go *out* to find buyers, and where we pull investor leads *in*.

- **Facebook Groups**
  - Scrape investor groups for leads.
  - Tool to **post listings** into those groups (outbound distribution).
- **ConnectedInvestor** + **BiggerPockets** — post listings here for investor reach.
- **X (Twitter)** — capture investor traffic; get them clicking on listings.

---

## 3. Core Feature Priorities

### 3a. ⭐ Driving For Dollars Workflow (KEY)
Joe flagged this as the highest-leverage feature.

- Upload property photos from the field.
- Create / attach notes per property.
- "Drive for the files" — capture properties while driving, attach docs/photos.
- **Inspection-photo memory:** re-uploads remember prior photos, **flag changes** between visits (vacancy signals, deterioration, new owner activity).

### 3b. Assign Properties to Agents
- Multi-agent assignment per property.
- Implies roles + permissions (agent vs. broker vs. investor).

### 3c. Agent Embed Widget
- Agents can take properties they've uploaded into aiwholesail and **embed them on their own website** via a widget.
- Goal: aiwholesail becomes the source-of-truth back-end; the agent's site is a branded front-end.

---

## 4. Investor-Side Features

- **Vacant Homes filter set** — dedicated filters for vacant property detection.
- **Repair Estimators / Calculators** — rehab cost tooling inside the app.
- **Real Estate Agents upload distressed properties** → buyer's network gets **first access** (early-access tier).

---

## 5. Monetization Streams

### 5a. Lender Advertisements
- $50–$100/month placement.
- Lenders self-serve ads to investors browsing deals.

### 5b. Service-Provider Referral Network (charge-per-lead)
Categories:
- Home inspectors
- Handymen
- Real estate agents
- General contractors
- Roofers
- Plumbers
- Electricians
- (extensible)

Monetization: pay-per-lead routing from investor → vetted provider.

### 5c. Affiliate / Custom-Offer System
- Affiliate framework inside the software.
- Supports custom offers (configurable per partner).

---

## 6. Builder & New-Construction Angle

- Find a way to **connect directly with builders**.
- Build a **"New Home"** piece inside the software (new-construction inventory distinct from REO/distressed).

---

## 7. Open / Incomplete from Meeting

- Original list item "4)" under Integrations was left blank — follow up with Joe on what was intended.
- Pricing model for the agent embed widget (free? paid tier? watermarked?).
- Reverse-syndication legal review — bidding on third-party auction sites from our UI likely needs partnership/ToS approval per site.

---

## Suggested Next Steps

1. Triage this list into the AIWholesail.com Todoist project (per dev-tracker workflow) — group by Integrations, Features, Monetization.
2. Score each item on the Features tab of the dev tracker.
3. Pick a **lighthouse** — likely **Driving For Dollars** + **Hubzu integration** + **Auction section** — to scope first.
4. Confirm priority/sequencing with Joe before committing engineering cycles.
