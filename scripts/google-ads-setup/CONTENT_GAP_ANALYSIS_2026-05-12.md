# AIWholesail Content Authority Gap Analysis

> Generated: 2026-05-12
> Inputs: Google Ads Keyword Planner (70 validated kw, dated 2026-04-30) · 38 keyword silos (544 planned kw) · 89 live site routes · marketing-context.md
> Tooling: [scripts/google-ads-setup/keyword-research-gaps.js](./keyword-research-gaps.js), [/tmp/aiw_content_gap.py](/tmp/aiw_content_gap.py)

## Headline

**Content Score: 46/100** — solid foundation in 3 clusters, but 6 building / 4 weak / 3 missing clusters, and **12 of 38 silos have zero Google Ads-validated keywords**.

| Layer | Count |
|---|---|
| Strong clusters (3+ high-opp kw + dedicated page) | **3** |
| Building clusters (page exists, content depth lacking) | **6** |
| Weak clusters (page exists, low-opp coverage) | **4** |
| Missing clusters (validated kw, no dedicated page) | **3** |
| Silos with zero validation | **12** |

---

## Cluster map

### Strong — defend & deepen

| Cluster | Validated kw | Vol/mo | Avg opp | Covered by |
|---|---|---|---|---|
| `wholesaling` | 5 | 104,400 | **89.6** | `/strategy/wholesale`, `/laws/[state]`, blog |
| `education-beginner` | 3 | 66,000 | 84.3 | `/guides`, `/blog` |
| `market-analysis` | 4 | 33,180 | 80.2 | `/markets`, `/markets/[city]` (just shipped Dataset schema in #256) |

### Building — pages exist, deepen content

| Cluster | Vol/mo | Avg opp | Notes |
|---|---|---|---|
| `fix-and-flip` | 11,000 | **85.0** | `/strategy/flip`, `/rehab-costs` — top opp, low depth |
| `calculators-tools` | 6,700 | **90.5** | `/tools` — calculators rank but content thin |
| `brrrr` | 1,600 | 90.0 | `/strategy/brrrr` — high-opp single-page need |
| `rental-buyhold` | 18,500 | 74.0 | `/strategy/rental`, `/rentals` |
| `strategy-general` | 11,700 | 54.3 | `/strategies`, `/use-cases` |
| `investing-broad` | 27,100 | 55.0 | broad `/guides`, `/blog` |

### Weak — page but no rank, look for refresh angles

| Cluster | Vol/mo | Avg opp | Notes |
|---|---|---|---|
| `financing` | 18,000 | 43.5 | `/lenders` exists but underbuilt for "DSCR loan", "hard money", "fix-and-flip loan" |
| `investor-broad` | 16,000 | 52.7 | `/for`, `/personas` |
| `analysis` | (0 vol in dataset) | 32.0 | `/analyzer` underbuilt |
| `distress-signals` | (0 vol in dataset) | 27.5 | `/distress` exists but the validated keywords don't surface volume; silo has 20 planned kw — **validate this silo** |

### Missing — validated keywords with no dedicated page

| Cluster | Vol/mo | Avg opp | Brand fit | Recommendation |
|---|---|---|---|---|
| `passive-investing` | 14,200 (REIT, syndication, turnkey, crowdfunding) | 66.0 | **Low** — different audience (passive vs. active) | Skip unless expanding into adjacent audience |
| `commercial-re` | 14,400 | 50.0 | **Low** — different audience | Skip |
| `other` ("real estate investment trust" 302K/mo, "real estate investment companies" 6.3K/mo, etc.) | 369,290 | 51.2 | **Mixed** — REIT/turnkey out, "best places to invest" / "best city for RE investment" / "investing in multifamily" in | Targeted, see #4 below |

### Silos with zero Google Ads validation — research priority

These are real estate investing silos AIWholesail planned but **never validated with volume/CPC data**. Run a fresh Google Ads pull against these next.

1. Rental Property Investing (20 kw)
2. Deal Finding & Lead Generation (20 kw)
3. Calculator & Tool Keywords (12 kw long-tail)
4. Property Type Investing (15 kw — SFR, multifamily, condo, mobile, land)
5. Motivated Seller Triggers (12 kw)
6. Advanced Wholesale Strategies (12 kw)
7. Question & Featured Snippet Keywords (12 kw — *direct AI-citation play*)
8. Commercial Real Estate (11 kw)
9. Investor Pain Points (11 kw)
10. Tax Strategies Deep Dive (10 kw)
11. Landlord & Property Management (9 kw)
12. Exit Strategies & 1031 Exchange (8 kw)

---

## Top 5 content moves (brand-fit ranked)

The mechanical "opp × volume" ranking surfaced REIT and crowdfunding — bad fits for AIWholesail's active-investor audience. The list below applies brand fit + the AI SEO foundations we just shipped.

### 1. Competitor `/vs/` pages — `PropStream alternative`, `DealMachine alternative`, `BatchLeads alternative`

- **Why now:** We just shipped `public/docs/comparisons.md` in PR #255 — the content is *already written*. We just need to render it as on-site `/vs/[competitor]` pages.
- **Estimated volume:** 1.5K–5K/mo each across the three (validated via the silo "Comparisons (VS Keywords)" — 10 kw; needs fresh Google Ads pull to confirm).
- **Intent:** Commercial / transactional. Highest converting cluster in B2B SaaS SEO.
- **Schema:** Product + Review JSON-LD. Combined with the AI SEO docs surface, AI Overviews and Perplexity will cite these directly.
- **Effort:** ~2–4 hr (template + 3 pages). Use the `competitor-alternatives` skill.

### 2. "How to find motivated sellers" pillar (`/guides/find-motivated-sellers` or `/strategy/motivated-sellers`)

- **Why now:** Maps to the *Deal Finding & Lead Generation* silo (20 unvalidated keywords) + the *Motivated Seller Triggers* silo (12 kw). Highest-volume gap that's a core AIWholesail value prop.
- **Cluster cover:** distress signals (pre-foreclosure, tax delinquent, vacancy, code violations, absentee), direct mail, skip tracing — every one of these has a feature inside AIWholesail.
- **Schema:** `HowTo` + `FAQPage`.
- **Effort:** ~6–8 hr for the pillar; spawns 4–6 cluster articles (one per distress signal type, mostly already drafted in `public/docs/glossary.md`).

### 3. Calculator content depth (`/tools/cap-rate-calculator`, `/tools/wholesale-deal-calculator`)

- **Why now:** Opp scores 89–92 (highest in the dataset). Calculator pages already exist; surrounding content is thin.
- **What to add:** "What is a good cap rate?" / "How is MAO calculated?" answer blocks above the calculator, FAQPage schema, embedded worked examples, citation-worthy data (e.g. "average cap rates by market" pulling from `cities.json`).
- **Effort:** ~3–4 hr per calculator. Compound on the schema-markup skill for FAQPage + HowTo.

### 4. "Best places for real estate investment 2026" / `/markets/best-cities`

- **Why now:** "best cities to invest in real estate 2026" (2,400/mo, opp 78). Maps cleanly to the `/markets` bundle we just shipped (PR #256) — ItemList schema is already in place.
- **What to add:** A `/markets/best-2026` index page that's a ranked list (BRRRR-best, flip-best, wholesale-best) pointing into individual `/markets/[city]` pages. Refresh quarterly.
- **Effort:** ~3 hr. Reuses `cities.json` and state-laws data.

### 5. Multifamily property-type cluster (`/property-types/multifamily`)

- **Why now:** "investing in multifamily properties" (3,200/mo, low comp). Property Type Investing silo (15 unvalidated kw) — wholesalers/flippers ARE the audience.
- **Cluster cover:** SFR, multifamily, condo, mobile, land, commercial-adjacent.
- **Schema:** `Article` + `FAQPage`.
- **Effort:** ~4 hr per property type. Already have `/property-types` index route — just need depth.

---

## Next steps (operationally)

1. **(Optional) Refresh Google Ads OAuth** — the April 30 refresh token expired. To re-auth:
   ```bash
   cd /Users/connorodea/developer/aiwholesail/scripts/google-ads-setup
   node oauth-flow.js   # opens browser for consent, writes ~/.config/gcloud/google-ads-oauth.json
   ```
   Or if `gcloud` CLI is installed: `gcloud auth application-default login`.

2. **Run gap-focused expansion** — once re-authed, the new `keyword-research-gaps.js` (already written; 59 seeds covering AI/PropTech, skip-tracing, distress signals, comparisons, calculators long-tail, financing) will fill the 12 unvalidated silos in one pass. Output: `keyword-research-gaps.csv` + `keyword-research-gaps.json`.

3. **Build the top 5 content moves above.** The competitor-alternatives PR is the fastest because `/docs/comparisons.md` already has the content drafted. That's ~2–4 hr to put live.

4. **Consider Google Search Console next** for the *defensive* data — what's already ranking 11–30 and one position-jump away from page 1.
