# AIWholesail SEO Data Pipeline

Three scripts that fetch real keyword + ranking data for SEO planning:

| Script | What it does | Cost |
|---|---|---|
| `oauth-refresh-multi.js` | One-time browser consent for **both** Google Ads + Google Search Console scopes. Writes unified token at `~/.config/gcloud/aiw-oauth-tokens.json`. | Free |
| `keyword-research-gaps.js` | Pulls Google Ads Keyword Planner data for 59 gap-focused seed keywords (AI/PropTech, skip tracing, distress signals, calculators, comparisons). Outputs CSV + JSON. | Free |
| `gsc-opportunity-report.js` | Pulls 90 days of Google Search Console query + page data for aiwholesail.com. Surfaces "striking distance" (pos 5–30), snippet-rewrite candidates, top pages. | Free |

## Setup

1. **Install deps** (only first time):
   ```bash
   cd scripts/google-ads-setup
   npm install
   ```

2. **One-consent auth** — opens browser, you click "Allow":
   ```bash
   npm run auth
   ```
   Grants `adwords` + `webmasters.readonly` in one consent flow. Token is saved at `~/.config/gcloud/aiw-oauth-tokens.json` with mode 600.

3. **Run both reports**:
   ```bash
   npm run ads    # Google Ads — keyword volume / CPC / competition
   npm run gsc    # Search Console — what's actually ranking
   ```

   Or do everything in one shot:
   ```bash
   npm run all
   ```

## Outputs

- `keyword-research-gaps.csv` / `.json` — Google Ads results, clustered + ROI-scored
- `gsc-opportunity-report.csv` / `.json` / `.md` — GSC analysis bucketed into striking-distance, snippet-rewrite, top-clicks, top-impressions

## When the refresh token expires

Google OAuth refresh tokens for "external" consent-screen apps expire after **7 days** until the OAuth consent screen is in "Production" status. If `npm run ads` or `npm run gsc` fail with `invalid_grant`, just re-run `npm run auth` — a fresh consent takes ~10 seconds.

To eliminate the 7-day window, set the consent screen to "Production" at:
https://console.cloud.google.com/apis/credentials/consent?project=sapient-cycling-494919-r5

## Files reference

| Path | Purpose |
|---|---|
| `~/.config/gcloud/google-ads.yaml` | Client ID, secret, developer token, login customer ID |
| `~/.config/gcloud/aiw-oauth-tokens.json` | Unified refresh token (Ads + GSC scopes) |
| `~/.config/gcloud/application_default_credentials.json` | Mirrored copy so existing ADC-reading scripts keep working |
