# Creatives

Branding and ad creative source files for AIWholesail. These are the canonical brand-team artifacts — the running app should match what's defined here.

## Branding (`branding/`)

- **`aiwholesail-logo-main.html`** — Main wordmark (canonical). The inline `<AIWholesailLogo>` React component at `src/components/AIWholesailLogo.tsx` mirrors this file's wordmark layout, sail SVG path, and brand-token colors. When the canonical wordmark changes, update both this file and the component, then re-run `node src/components/__tests__/AIWholesailLogo.test.cjs`.
- `aiwholesail-logo-v1.html` — Earlier wordmark variant, kept for reference.

Production logo assets actually served by the app live in `public/logos/`.

## Facebook ads (`facebook-ads/`)

- `aiwholesail-facebook-ads.html` — Facebook ad creative templates.

Ad-build pipeline lives in `ads/` at the repo root.
