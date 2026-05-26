# AIWholesail SEO Data Pipeline

Scripts that fetch real keyword + ranking data for SEO planning:

| Script | What it does | Cost | Auth |
|---|---|---|---|
| `oauth-refresh-multi.js` | One-time browser consent for **both** Google Ads + Google Search Console scopes. Writes unified token at `~/.config/gcloud/aiw-oauth-tokens.json`. | Free | OAuth |
| `keyword-research-gaps.js` | Pulls Google Ads Keyword Planner data for 59 gap-focused seed keywords (AI/PropTech, skip tracing, distress signals, calculators, comparisons). | Free | OAuth + Google Ads Basic Access |
| `gsc-opportunity-report.js` | Pulls 90 days of Google Search Console query + page data. Surfaces "striking distance" (pos 5–30), snippet-rewrite candidates, top pages. | Free | OAuth |
| `seo-kw-research.js` | **No-auth** keyword research via RapidAPI seo-keyword-research. Single-keyword lookups OR related-keyword expansion. Complements Google Ads when Basic Access isn't approved yet. | ~$5-50/mo paid tier | `RAPIDAPI_SEO_KW_KEY` env |
| `google-suggest.js` | **No-auth** Google Autocomplete scraper. Single seed → 8–10 expansions; `--deep` mode → 300+ expansions via 26 letters × 18 modifiers. Best for free cluster discovery. | Free | None |
| `reddit-discovery.js` | **No-auth** Reddit JSON search. Mines question titles + engagement from real estate–adjacent subs. Best for PAA-style content + intent mining. | Free | None |

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

3. **Run reports**:
   ```bash
   npm run ads    # Google Ads — keyword volume / CPC / competition (needs Basic Access)
   npm run gsc    # Search Console — what's actually ranking
   npm run kw -- "wholesale real estate"          # RapidAPI — keyword expansion, no auth
   npm run kw -- "wholesale real estate" --top 25 # top 25 by opportunity score
   npm run kw -- --batch keywords.txt              # batch over a seed list
   ```

   Or do everything in one shot:
   ```bash
   npm run all
   ```

## seo-kw-research.js — quick reference

```bash
# Single keyword lookup (fast, returns one object)
node scripts/google-ads-setup/seo-kw-research.js --single "BRRRR method"

# Related-keyword expansion (~50-150 keywords per seed)
node scripts/google-ads-setup/seo-kw-research.js "BRRRR method"

# Top N by opportunity score + CSV output
node scripts/google-ads-setup/seo-kw-research.js "BRRRR method" us --top 25 --csv

# Batch over a seed file (one keyword per line, # for comments)
node scripts/google-ads-setup/seo-kw-research.js --batch seeds.txt
```

Outputs:
- Per-run JSON + CSV → `seo-kw-results/` (gitignored)
- Rolling aggregate CSV → `seo-kw-rolling.csv` (gitignored — append-only across runs)

Pair the rolling CSV with the Google Ads dataset in `keyword-research-report.csv` — both share keyword/volume/cpc/competition columns. Use for cluster analysis when Google Ads Basic Access lands.

## google-suggest.js — quick reference

No-auth Google Autocomplete scraper. Generates candidate keywords for new topical clusters or page types without burning API budget.

```bash
# Single seed (8–10 base suggestions)
npm run suggest -- "subject to real estate"

# Alphabet expansion (26 letter variants → 50–150 expansions)
npm run suggest -- "subject to real estate" --alphabet --csv

# Deep mode (alphabet + 18 modifiers → 300–500 expansions per seed)
npm run suggest -- "wholesale real estate" --deep --csv

# Batch over a seed file
npm run suggest -- --batch seeds-pseo-expansion.txt --deep --csv
```

Outputs: per-run CSV → `seo-kw-results/suggest-<seed>-<date>.csv` (gitignored).

## reddit-discovery.js — quick reference

No-auth Reddit JSON search. Mines real-estate–adjacent subs for question titles + high-engagement posts. Pair with `google-suggest` outputs to validate that real users actually ask about a topic before committing to a content cluster.

```bash
# Single seed, default real-estate sub filter
npm run reddit -- "subject to real estate" --csv

# Questions only (PAA-style content mining)
npm run reddit -- "tax lien investing" --questions --csv

# Wider net (any subreddit)
npm run reddit -- "mobile home park investing" --no-subreddit-filter --csv

# Batch
npm run reddit -- --batch seeds-pseo-expansion.txt --questions --csv
```

Outputs: per-run CSV → `seo-kw-results/reddit-<seed>-<date>.csv` (gitignored).

## Tests

```bash
npm test
```

Runs all `node:test` suites — `google-suggest.test.js`, `reddit-discovery.test.js`, `aggregate-lsi.test.js`, `lsi-to-blog-keywords.test.js`. No external services hit.

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
