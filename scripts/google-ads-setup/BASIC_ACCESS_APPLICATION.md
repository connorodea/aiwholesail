# Google Ads API — Basic Access Application

> Submit this content at: https://support.google.com/google-ads/contact/dev_token_basic
> Turnaround: typically 1–3 business days
> After approval, the existing developer token `kRCDpeAatWU0jkitEB5Ycg` will work against production Google Ads accounts (currently test-only).

---

## Pre-flight

Before submitting:
- [ ] Sign in to the Google Ads account that owns the developer token (Customer ID 175-472-7937)
- [ ] Have a public-facing URL describing the tool (https://aiwholesail.com)
- [ ] Be ready to attest to acceptable-use policies

---

## Form answers (copy-paste)

### Company name
Upscaled Inc. (operating AIWholesail.com)

### Company website
https://aiwholesail.com

### Contact email
connor@upscaledinc.com (also connor@aiwholesail.com)

### Application name
AIWholesail Internal SEO & Keyword Research

### Type of API integration
**Internal tool** — keyword research and reporting for our own marketing function.

### How will the developer token be used?

We use the Google Ads API solely for internal keyword research and reporting at AIWholesail.com (https://aiwholesail.com), a real estate investing SaaS we own and operate.

Specifically, our integration calls:
- `KeywordPlanIdeaService.GenerateKeywordIdeas` — to validate keyword volume, competition, and CPC for content planning.
- `KeywordPlanIdeaService.GenerateKeywordHistoricalMetrics` — for trend analysis on a small set of seed terms.

We do **not** plan to use the API to manage ads for external clients, build a third-party agency tool, or aggregate data into a public-facing product.

### Will the integration be used to manage Google Ads accounts other than your own?
**No.** Only the AIWholesail-owned manager account (CID 175-472-7937).

### How many accounts will be managed?
**1** (our own).

### What data will be requested and how often?
- Keyword volume / CPC / competition for ~60 seed terms — refreshed monthly.
- Historical metrics for ~20 priority keywords — refreshed quarterly.

Total API calls: under 200/month.

### Will the integration retrieve data on behalf of users who are not part of your organization?
**No.**

### How will you ensure compliance with the Google Ads API Terms of Service and Required Minimum Functionality (RMF) for Basic access?
- The integration is internal — no external user surface, no UI, no third-party data resale.
- Output is consumed only by our internal content and product team.
- We comply with the RMF for Basic access: we do not modify campaigns, do not run automated bidding, and do not exceed read-only Keyword Planner usage.
- All API responses are stored locally in CSV/JSON files for analysis; nothing is exposed to non-employees.

### Where is the OAuth refresh token stored, and how is it secured?
- Stored at `~/.config/gcloud/aiw-oauth-tokens.json` on a single developer workstation with file mode 0600.
- Not committed to source control (path is in our gitignore).
- Used only by command-line scripts invoked manually for monthly research runs.

### Acknowledgements
- [x] I have read and agree to the Google Ads API Terms of Service.
- [x] I have read and agree to the Required Minimum Functionality for Basic Access.
- [x] I understand that misuse may result in token revocation.

---

## After approval

Once the token is upgraded from Test to Basic, no code changes are needed.
Just re-run `node scripts/google-ads-setup/keyword-research-gaps.js` and it will hit the production endpoint with real volume data.

---

## Reference: token + customer IDs

Documented for your reference (do not paste into the form):

- Developer token: `kRCDpeAatWU0jkitEB5Ycg`
- Manager / login customer ID: `175-472-7937` (no hyphens: `1754727937`)
- OAuth client ID: `94870419954-2fmrbu433f8kuq1hqsi2j23idvsps0jr.apps.googleusercontent.com`
- GCP project: `sapient-cycling-494919-r5`
