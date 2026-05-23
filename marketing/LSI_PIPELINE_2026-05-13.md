# LSI Keyword Pipeline (2026-05-13)

Programmatic keyword research pipeline that expands a hand-curated seed list
of real-estate-investing topics into a deduped, scored, low-competition queue
the blog automation can pull from. Built on top of the existing RapidAPI
`seo-keyword-research` wrapper at `scripts/google-ads-setup/seo-kw-research.js`.

## TL;DR

```bash
# 1. (Optional) refresh seed list — edit when expanding topical coverage
vim scripts/google-ads-setup/lsi-seeds.txt

# 2. Run the batch against RapidAPI (~3 min for 115 seeds, paced 1.5s/seed)
node scripts/google-ads-setup/seo-kw-research.js \
  --batch scripts/google-ads-setup/lsi-seeds.txt

# 3. Aggregate, dedupe, filter, classify, rank
node scripts/google-ads-setup/aggregate-lsi.js

# Outputs:
#   scripts/google-ads-setup/lsi-low-comp-queue.csv   (ranked queue)
#   scripts/google-ads-setup/lsi-aggregate-summary.md (totals + top 25)
```

## Files

| Path | Role |
|------|------|
| `scripts/google-ads-setup/lsi-seeds.txt` | Hand-curated ~115 seed keywords across 11 topical buckets |
| `scripts/google-ads-setup/seo-kw-research.js` | Existing RapidAPI wrapper (supports `--batch`) |
| `scripts/google-ads-setup/seo-kw-rolling.csv` | Append-only raw results — gitignored, regenerable |
| `scripts/google-ads-setup/seo-kw-results/*.json` | Per-seed JSON dumps — gitignored, regenerable |
| `scripts/google-ads-setup/aggregate-lsi.js` | Aggregator: parse → dedupe → filter → classify → rank |
| `scripts/google-ads-setup/aggregate-lsi.test.js` | `node:test` suite covering the pure functions |
| `scripts/google-ads-setup/lsi-low-comp-queue.csv` | **The queue the blog automation consumes** — gitignored |
| `scripts/google-ads-setup/lsi-aggregate-summary.md` | Human-readable run summary — gitignored |

## How it works

### 1. Seed list (`lsi-seeds.txt`)
~115 seeds, one per line, comments via `#`. Covers every real-estate-investing
subtopic from `marketing-context.md`'s persona table:

- Wholesaling
- Fix & flip
- BRRRR / rentals
- Distress signals (pre-foreclosure, tax-delinquent, probate, vacant,
  absentee, code-violations, high equity)
- Skip tracing / outreach (direct mail, yellow letters, cold calling, D4D)
- Financing (hard money, DSCR, owner-financing, subject-to)
- Calculators / tools (cap rate, MAO, BRRRR, rehab, ARV)
- State laws & compliance
- Best markets
- Beginner / education
- Software comparisons (PropStream alt, DealMachine alt, BatchLeads alt, etc.)

### 2. Batch runner
`seo-kw-research.js --batch <file>` iterates seeds, calls the `keynew`
endpoint, writes a JSON file per seed to `seo-kw-results/`, and appends every
expanded keyword to `seo-kw-rolling.csv`. Built-in 1.5s pacing keeps us well
within the RapidAPI free-tier rate limit.

### 3. Aggregator (`aggregate-lsi.js`)
Pure-function pipeline (tested):

1. **Parse** the rolling CSV + every `.json` in `seo-kw-results/`.
2. **Dedupe** case-insensitively, keeping the row with the highest score.
3. **Filter** into two tiers:
   - **Low-comp**: `competition == 'low'` AND `volume >= 100` AND `score >= 0.3`
   - **Very-low-comp**: `competition == 'low'` AND `volume >= 50` AND `cpc <= $5`
4. **Classify** suggested page type per keyword:
   - Contains `calculator`/`formula`/`tool`/`estimator` → **tool**
   - Contains `vs`/`versus`/`alternative`/`review`/`comparison` → **blog-comparison**
   - Contains a US state name/code OR a major investor city → **location**
   - Default → **blog**
5. **Sort** by score descending.
6. **Write** `lsi-low-comp-queue.csv` (the consumable queue) +
   `lsi-aggregate-summary.md` (human-readable totals + top 25).

CLI flags let you override thresholds, input paths, and output paths:

```bash
node scripts/google-ads-setup/aggregate-lsi.js \
  --min-vol 200 --min-score 0.5 \
  --queue-out /tmp/queue.csv
```

### 4. Tests
```bash
node scripts/google-ads-setup/aggregate-lsi.test.js
```
Eight `node:test` cases cover CSV parsing, dedupe behavior, both filters,
page-type classification, sort/queue construction, CSV emission, and the
markdown summary. Run them before tweaking the aggregator.

## How to feed the queue into the blog automation

The project does not yet ship a `keywords.csv` for the `/seo-blog` skill (the
SEO scaffold has not been initialized). The queue produced here is the
authoritative source-of-truth list to seed it.

### Option A — bootstrap the SEO scaffold (recommended, one-time)
1. Run `/seo-init` once to scaffold `keywords.csv`, `published.csv`,
   `references/`, `templates/`, etc.
2. Then feed our queue into `keywords.csv` (preserve any pre-existing rows):
   ```bash
   # Headerless append, top-tier first
   tail -n +2 scripts/google-ads-setup/lsi-low-comp-queue.csv \
     >> keywords.csv
   ```
   The `/seo-blog` skill pulls "the next unused keyword" from this file.

### Option B — point `/seo-blog` directly at our queue
Pass the queue path as the argument when the skill supports it, or symlink
`keywords.csv -> scripts/google-ads-setup/lsi-low-comp-queue.csv`. Note: the
queue is gitignored, so the symlink will resolve locally but not in CI — for
shared use, prefer Option A.

### Three-articles-per-day cadence
With ~1,400 low-comp candidates and 3 articles/day, the queue covers **~15
months of content** before refresh is mandatory. Aggregator + rolling CSV are
both append-only with dedupe-on-aggregate, so re-running the pipeline never
duplicates work.

## Tracking which keywords have been consumed

The `/seo-blog` skill writes published posts to `published.csv` (per the
project SEO scaffold convention). To prevent re-publishing:

1. `/seo-blog` reads `keywords.csv`, picks the next row not in `published.csv`.
2. After a successful run, the keyword (and slug + URL + date) is appended to
   `published.csv`.

For our queue we additionally recommend a periodic reconciliation:

```bash
# Show queue rows not yet published
awk -F, 'NR==FNR{seen[tolower($1)]=1; next} !seen[tolower($1)]' \
  published.csv scripts/google-ads-setup/lsi-low-comp-queue.csv | head -50
```

## Refresh cadence

| Cadence | Action | Reason |
|---------|--------|--------|
| **Weekly** | Re-run `aggregate-lsi.js` only | Dedupe + re-rank any new rows that hit `seo-kw-rolling.csv` between runs |
| **Quarterly** | Refresh `lsi-seeds.txt`, then re-run the full batch + aggregator | Topical drift (new market keywords, new competitor brand names, new regulations); the RapidAPI scores also shift as Google's search-data corpus updates |
| **Ad-hoc** | Add a single seed and re-run only that seed: `node scripts/google-ads-setup/seo-kw-research.js "<seed>"`, then re-aggregate | Targeted expansion when a new content angle opens up |

## Constraints & guard-rails

- **API quota:** The first call in any session should be a `--single` probe
  to confirm headroom before a full batch. The wrapper exits non-zero on a
  non-200 response, so a failed probe stops you cheaply.
- **No frontend coupling:** The aggregator only writes to
  `scripts/google-ads-setup/`. It never touches `src/`, Stripe, trial emails,
  or any deployable artifact.
- **Brand voice:** Heuristic classification is a *suggestion*. Before
  generating content, gut-check the keyword against the persona table in
  `marketing-context.md` — drop anything that veers into get-rich-quick or
  guru-tone phrasing.
- **Source attribution:** Every queue row preserves the `source_seed` it came
  from, so we can trace back to the original topical bucket when curating.

## Run history

| Date | Seeds | Raw rows | Unique | Low-comp | Very-low-comp | Notes |
|------|-------|----------|--------|----------|---------------|-------|
| 2026-05-13 | 115 | 10,481 | 4,415 | 1,409 | 1,411 | Initial pipeline build |
