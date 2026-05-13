# Lighthouse / Core Web Vitals — How to Run

> Generated: 2026-05-12
> Why: Real GSC data shows all pages indexed but ranking poorly. Authority is one constraint; page speed is another. Lighthouse measures it directly.

## Quick run

```bash
cd /Users/connorodea/developer/aiwholesail
npm run dev      # start the Vite dev server (typically localhost:5173)

# In another terminal:
npx -y lighthouse http://localhost:5173 \
  --output=html \
  --output-path=./marketing/lighthouse-home.html \
  --chrome-flags="--headless" \
  --preset=desktop
```

Repeat for `/pricing`, `/markets/phoenix-az`, `/reviews/propstream-review`, `/vs/propstream`, `/tools/cap-rate-calculator`, and a blog post. Each takes 30-60 seconds.

## Better — full audit script

```bash
#!/bin/bash
# scripts/lighthouse-audit.sh
PAGES=(
  "/"
  "/pricing"
  "/markets"
  "/markets/phoenix-az"
  "/reviews/propstream-review"
  "/vs/propstream"
  "/tools/cap-rate-calculator"
  "/guides/finding-motivated-sellers"
  "/laws/texas"
  "/deals/tax-delinquent/chesapeake-va"
)
mkdir -p marketing/lighthouse
for path in "${PAGES[@]}"; do
  slug=$(echo "$path" | sed 's|/|_|g; s|^_||; s|_$||; s|^$|home|')
  echo "Auditing $path..."
  npx -y lighthouse "http://localhost:5173$path" \
    --output=html --output=json \
    --output-path="./marketing/lighthouse/$slug" \
    --chrome-flags="--headless" \
    --preset=desktop \
    --quiet
done
```

## Production audit (against deployed site)

The dev-server version measures unminified code. The deployed version is what Google sees. Run against production:

```bash
npx -y lighthouse https://aiwholesail.com \
  --output=html --output=json \
  --output-path=./marketing/lighthouse-prod-home \
  --chrome-flags="--headless"
```

Production scores are what matter for SEO. Dev scores are for development feedback.

## What to look at

**Performance score breakdown:**
- LCP (Largest Contentful Paint) — target < 2.5s. Heroes with no preloaded fonts or hero images blow this.
- FID (First Input Delay) / INP — target < 100ms. Heavy React mount blocks the main thread.
- CLS (Cumulative Layout Shift) — target < 0.1. Loading-induced layout jumps.
- Speed Index — overall visual completeness.

**Likely AIWholesail issues (without running it):**
- React SPA cold-mount cost on long-tail pages — the 6,000+ pSEO pages load the same React bundle. Worth profiling.
- Hero font swap (FOUT) — Montserrat is preloaded in index.html which is good.
- Helmet-injected JSON-LD scripts add up. Per-route schemas are correct but heavy.
- Lazy-loaded routes via React.lazy — good for initial load, bad if it shows fallback unnecessarily.

**Accessibility:**
- Color contrast on white-on-cyan elements (the brand cyan can fail WCAG AA at smaller sizes)
- Focus indicators on interactive elements
- Image alt text on logos / OG images

**Best Practices:**
- `<link rel="canonical">` — fixed in PR #264 (SEOHead always emits one now)
- `meta name="viewport"` — present
- HTTPS — yes
- Console errors — would surface here

**SEO (Lighthouse SEO score):**
- Meta description present — yes
- Crawlable links — yes
- Title length within 60 chars — varies; PR #263 improved review titles but may have over-extended some

## Fixing common issues

### LCP too slow

Most common cause for SPAs: the hero image / hero text doesn't render until React hydrates. Options:

1. **Server-side rendering** for the top 100 highest-traffic pages (Vite + Vite SSR or Astro)
2. **Pre-rendering at build time** — `vite-plugin-ssg` generates static HTML for specific routes
3. **Reduce JS bundle size** — `npm run build` → `npx vite-bundle-visualizer` to find large deps. lodash, moment, big icon libraries are common culprits.

For the GSC data showing already-indexed pages, the gain from SSR/SSG is rank-position, not crawlability. Worth doing for the top 20 high-impression pages first.

### CLS issues

Look for:
- Images without explicit `width`/`height` — they cause shift when they load
- Banners/popups that appear above the fold late
- Web fonts swapping in (FOUT)

The repo uses Montserrat with `display=swap` preloaded — that's mostly fine. Audit will catch the rest.

### Bundle size

```bash
cd /Users/connorodea/developer/aiwholesail
npm run build
ls -lah dist/assets/*.js | sort -k5 -h
```

Anything over 200KB gzipped warrants investigation. The deferred-import pattern in `App.tsx` (`React.lazy`) is already in place for route-level splitting.

## Why I can't run this autonomously here

The Lighthouse audit needs:
1. A running local web server (`npm run dev`) which I can't keep alive in the background reliably across tool calls
2. A headless Chrome instance — possible, but may collide with the user's running Chrome

Best path: user runs `npm run dev` in one terminal, then `bash scripts/lighthouse-audit.sh` in another. Total time: ~5 minutes for all 10 priority pages. Output lands in `marketing/lighthouse/`.

## After the audit

For each page scoring under 90 in any category:
1. Open the HTML report — the actionable suggestions are at the bottom under "Opportunities" and "Diagnostics"
2. Cluster fixes by file (e.g., "5 pages all have the same hero image issue" = fix once)
3. Re-run after fixes to confirm score lift

Typical first-pass wins (low effort, big score lift):
- Add `loading="lazy"` to below-fold images
- Add `width`/`height` to all `<img>` tags
- Replace any remaining `<img src="...">` with proper React `<img>` components that pass these attributes
- Audit `dist/assets/*.js` — split any chunks over 200KB
