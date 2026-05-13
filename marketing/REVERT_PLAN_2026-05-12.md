# Revert Plan — SEO Sprint 2026-05-12

> Generated: 2026-05-12
> Purpose: clear, low-risk options for rolling back today's 21-PR sprint if any of the changes prove unwanted.

## Anchor

**Tag:** `pre-seo-sprint-2026-05-12`
**Commit:** `50cc12c` — `feat(off-market): property detail modal — Phase 6 (flag-gated, dogfood) (#251)`

This is the last commit on `main` BEFORE the SEO sprint started. Everything after this commit is either:
- A sprint PR (revertable from this list), OR
- A non-sprint PR from another agent (do NOT revert)

Verify the tag locally:
```bash
git fetch --tags
git show pre-seo-sprint-2026-05-12
```

## Three revert strategies — pick one

### Strategy 1 — Full sprint revert (nuclear option)

Rolls back everything from today's sprint to the pre-sprint state in one shot. Use only if you want to discard the whole effort.

```bash
git fetch origin main
git checkout main
git pull --ff-only
git revert --no-commit pre-seo-sprint-2026-05-12..HEAD
# Review the staged changes
git status
git diff --staged | less
# If happy:
git commit -m "Revert: roll back SEO sprint 2026-05-12"
git push
# If you change your mind:
git reset --hard HEAD
```

⚠️ **Caveat:** this will ALSO revert non-sprint PRs from other agents that landed during the same window. Use Strategy 2 if you want surgical reverts.

### Strategy 2 — Surgical PR reverts (recommended)

Revert specific PRs only. Use the table below to identify which.

```bash
gh pr revert 255    # AI SEO foundations
gh pr revert 256    # /markets schema
gh pr revert 260    # /vs/[competitor] enrichment
gh pr revert 262    # OAuth + GSC pipeline scripts
gh pr revert 263    # /reviews/[slug] enrichment
gh pr revert 264    # Indexing pipeline + canonical fix
gh pr revert 265    # Motivated-sellers pillar
gh pr revert 267    # Remaining 17 guides
gh pr revert 268    # /deals/[type]/[city] schema
gh pr revert 270    # /tools/[calc] schemas
gh pr revert 272    # /invest/[strategy]/[city] schema
gh pr revert 274    # /laws/[state] + /blog/[slug]
gh pr revert 275    # PropertyType + DealExample
gh pr revert 276    # Index pages + RehabCost
gh pr revert 277    # /reviews E-E-A-T sweep
gh pr revert 279    # Marketing ops sprint + /pricing FAQ
gh pr revert 284    # Trial-lifecycle email templates
gh pr revert 286    # Pending tasks doc
```

`gh pr revert` opens a new PR with the reversed diff. You can review it before merging.

### Strategy 3 — File-by-file revert (most surgical)

If only specific files are problematic, revert just those paths:

```bash
# Restore a single file to the pre-sprint state
git checkout pre-seo-sprint-2026-05-12 -- src/components/SEOHead.tsx
# or for a directory:
git checkout pre-seo-sprint-2026-05-12 -- public/docs/
# Then commit:
git commit -m "Revert SEOHead canonical fix from PR #264"
git push
```

## What's in each PR (for surgical decision-making)

| PR | Scope (what to know if reverting) |
|---|---|
| **#255** | New files only: `public/robots.txt` (modified), `public/llms.txt`, `public/llms-full.txt`, `public/pricing.md`, `public/AGENTS.md`, `public/docs/*.md`. JSON-LD scripts added to `index.html`. JSON-LD Helmet block added to `Pricing.tsx`. **Reverting:** loses AI bot allowlist + machine-readable docs + Org/SoftwareApp schemas. Low risk. |
| **#256** | `MarketPage.tsx` + `Markets.tsx` — added Dataset/Place/ItemList/CollectionPage JSON-LD + answer blocks + wholesaling legality block on city pages. **Reverting:** loses ~265 schema-enriched pages. |
| **#260** | `ComparisonPage.tsx` + `competitors.json` — Review schema, FAQs, balanced verdict on 21 /vs pages. **Reverting:** /vs pages return to bare comparison-table format. |
| **#262** | New scripts in `scripts/google-ads-setup/`: oauth-refresh-multi.js, gsc-opportunity-report.js, keyword-research-gaps.js. **Reverting:** loses the GSC + Ads CLI pipeline. Already-collected data files are independent. |
| **#263** | `SoftwareReviewPage.tsx` — Review + FAQPage schemas, click-worthy title rewrite. **Reverting:** loses biggest GSC opportunity fix. |
| **#264** | `SEOHead.tsx` (canonical fix — affects every page), `gsc-sitemap-submit.js`, `indexnow-submit.js`, cross-links /reviews ↔ /vs, `BASIC_ACCESS_APPLICATION.md`, IndexNow verification file `public/26e378b7...txt`. **Reverting:** breaks canonical declarations — DO NOT revert without follow-up fix. ⚠️ |
| **#265** | `guides.json` (motivated-sellers entry) + `GuidePage.tsx` rendering changes. **Reverting:** strips HowTo + cluster section from the pillar. |
| **#267** | `guides.json` only (17 entries enriched). **Reverting:** strips Article + FAQPage rendering data from 17 guides. |
| **#268** | `DistressPage.tsx` + `guides.json` link fix. **Reverting:** loses 2,376 /deals/[type]/[city] schema-enriched pages AND breaks the link from PR #265 cluster cards. ⚠️ |
| **#270** | `CalculatorSchema.tsx`, `calculator-metadata.ts`, 13 calculator files (1-line addition each). **Reverting:** loses 13 calculator schema pages. |
| **#272** | `CityStrategyPage.tsx` + `StrategyIndex.tsx` — 3,180 pages enriched. **Reverting:** large but isolated. |
| **#274** | `StateLawPage.tsx` + `BlogPost.tsx`. **Reverting:** loses 51 state-law schemas + all blog post BlogPosting schemas. |
| **#275** | `PropertyTypePage.tsx` + `DealExamplePage.tsx` — 38 pages. |
| **#276** | 4 index page files. Low-risk. |
| **#277** | `software-reviews.json` enriched + `SoftwareReviewPage.tsx` (E-E-A-T byline, methodology, disclosure). **Reverting:** loses author signal on all 15 reviews. |
| **#279** | `marketing/` directory (6 new docs) + `Pricing.tsx` (6 FAQs added). **Reverting:** marketing docs are non-code; Pricing FAQ is the only user-visible change. |
| **#284** | `email-templates/` (6 new HTML files) + README update. **Pure additions, no existing file changes.** Lowest-risk PR to leave in. Safe to keep even if reverting everything else. |
| **#286** | `marketing/PENDING_TASKS_2026-05-12.md` (new file only). Trivially safe. |

## Do NOT revert these (other agents' work)

These PRs landed during the same window but are unrelated to the SEO sprint:

- **#258** — On-market heatmap toggle (off-market team)
- **#261** — `respondError` API refactor (backend team)
- **#273** — Property Search aesthetic variants (frontend team)
- **#280** — PropertyMap mount fix
- **#282** — Lead-type badges on result cards
- **#283** — CSP fix for GA4 g/collect endpoint

Strategy 1 (full revert) would touch these — Strategy 2 (PR-by-PR) avoids them.

## High-leverage spot-fixes if you just want one thing back

| Concern | Surgical fix |
|---|---|
| Don't want self-canonicals on every page | `git checkout pre-seo-sprint-2026-05-12 -- src/components/SEOHead.tsx` (PR #264) |
| Don't want /docs surface | `git rm -r public/docs && git checkout pre-seo-sprint-2026-05-12 -- public/robots.txt index.html` |
| Don't want methodology / disclosure on reviews | Revert PR #277 only |
| Don't want trial-lifecycle email templates visible | `git rm email-templates/_trial-base.html email-templates/trial-day-*.html && git checkout pre-seo-sprint-2026-05-12 -- email-templates/README.md` |
| Don't want marketing docs | `git rm -r marketing/` |

## Sanity checks after any revert

```bash
# Verify build still passes
npx tsc --noEmit -p tsconfig.app.json
npx vite build --logLevel=error

# Verify no broken internal links
grep -rE 'href="/distress/' src/ public/ marketing/ 2>/dev/null  # should be empty after #268 reverts
grep -rE 'aiwholesail.com/docs/' public/ index.html 2>/dev/null  # check if /docs/ links survive

# Verify schema markup didn't break elsewhere
grep -rl 'application/ld\+json' src/pages/ | head -5  # should show any pages still emitting schema
```

## After-revert checklist

- [ ] `npm run typecheck && npm run build` clean
- [ ] Smoke test in browser: `/`, `/pricing`, `/markets`, `/reviews/propstream-review`
- [ ] If reverted #264, also unset the canonical default in SEOHead (the pre-sprint SEOHead won't emit one — this may regress GSC indexing)
- [ ] Re-deploy IndexNow if `public/26e378b7...txt` got removed (PR #264) — Bing will silently lose verification

## Contact

Questions about specific PRs: see the PR description on GitHub (every PR today has a detailed body). All commits include `Co-Authored-By: Claude Opus 4.7 (1M context)` so they're easy to filter:

```bash
git log --grep="Co-Authored-By: Claude Opus 4.7" --since="2026-05-12 14:00" --pretty=oneline
```
