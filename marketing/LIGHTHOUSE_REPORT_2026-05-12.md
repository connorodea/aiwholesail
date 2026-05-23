# Lighthouse Audit — AIWholesail.com

> Generated: 2026-05-12
> Tool: Lighthouse 13.x · mobile · production
> Pages audited: 10

## Per-page scores

| Page | Performance | Accessibility | Best Practices | SEO | LCP | CLS | TBT |
|---|---|---|---|---|---|---|---|
| `deals_tax-delinquent_chesapeake-va` | 🟡 76 | 🟢 100 | 🟡 77 | 🟢 100 | 5.1 s | 0 | 80 ms |
| `guides_finding-motivated-sellers` | 🟡 73 | 🟢 100 | 🟡 77 | 🟢 100 | 6.0 s | 0 | 90 ms |
| `home` | 🟡 68 | 🟢 96 | 🟡 77 | 🟢 92 | 7.1 s | 0 | 120 ms |
| `laws_texas` | 🟡 76 | 🟢 100 | 🟡 77 | 🟢 100 | 5.0 s | 0 | 80 ms |
| `markets` | 🟡 71 | 🟢 98 | 🟡 77 | 🟢 100 | 6.3 s | 0 | 110 ms |
| `markets_phoenix-az` | 🟡 76 | 🟢 100 | 🟡 77 | 🟢 100 | 5.2 s | 0 | 60 ms |
| `pricing` | 🟡 68 | 🟢 94 | 🟡 77 | 🟢 100 | 6.5 s | 0.016 | 140 ms |
| `reviews_propstream-review` | 🟡 76 | 🟢 100 | 🟡 77 | 🟢 100 | 5.0 s | 0 | 60 ms |
| `tools_cap-rate-calculator` | 🟡 79 | 🟢 100 | 🟡 77 | 🟢 100 | 4.4 s | 0 | 70 ms |
| `vs_propstream` | 🟡 78 | 🟢 100 | 🟡 77 | 🟢 100 | 4.6 s | 0 | 70 ms |

## Site averages

| Metric | Average |
|---|---|
| Performance | 🟡 74 |
| Accessibility | 🟢 99 |
| Best Practices | 🟡 77 |
| SEO | 🟢 99 |

## Critical findings + fixes in this PR

### 🔴 GTM tracking broken site-wide
`src/components/GoogleAnalytics.tsx` was loading `/metrics/` (own domain) instead of `https://www.googletagmanager.com/gtm.js`. Every page view requested the SPA HTML as a JavaScript file → `SyntaxError: Unexpected token '<'` → GTM silently failed. All GA4 + GTM events lost since the bug was introduced.

**Fix in this PR:** restored the correct GTM CDN URL.

### 🟡 Best Practices uniformly 77 — invalid security meta tags
`SEOHead.tsx` emitted X-Frame-Options, X-Content-Type-Options, X-XSS-Protection as `<meta httpEquiv>`. Browsers IGNORE these as meta (HTTP-header-only) and log them as console errors. CSP and Referrer-Policy ARE valid as meta.

**Fix in this PR:** removed the 3 invalid meta tags. Set them via nginx/Cloudflare HTTP headers instead (follow-up — not in this PR).

### 🟡 LCP fails on every page (4.6–7.2s vs target 2.5s)

Top contributors on `/`:
- 63KB unused GA4 JS (will help once GTM loads correctly)
- 37KB unused JS in main bundle
- 34KB unused Radix vendor chunk
- 33KB unused Facebook Pixel
- 24KB unused Framer Motion

Follow-ups documented for future PRs.
