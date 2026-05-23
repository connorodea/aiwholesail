#!/usr/bin/env node
/**
 * Source-level guard: the /app page hero (RealEstateWholesaler.tsx)
 * must match the canonical *in-app* heading pattern used on Analyzer,
 * Buyers, Sequences, Contracts, SkipTrace — NOT the larger marketing-
 * page hero (Pricing, HowItWorks, UseCases, Landing).
 *
 * History:
 *   - Pre-#443: hero rendered at `text-2xl sm:text-3xl md:text-4xl
 *     lg:text-5xl font-medium` — visibly smaller than the rest.
 *   - PR #443 (2026-05-12, my mistake): I read "match the other pages"
 *     as the marketing landing pages and shipped `md:text-7xl lg:text-8xl
 *     font-bold leading-[0.95]`. User reaction: "you made it massive.
 *     suppose to match the other pages that have smaller size."
 *   - This fix: revert to the in-app canonical — same size as Analyzer
 *     (`text-3xl md:text-4xl font-medium tracking-tight`).
 *
 * Reference: src/pages/Analyzer.tsx lines 188-191.
 *
 * The "Find profitable real estate deals" heading and its subtitle are
 * shared between on-market and off-market modes (single h1 + ternary
 * on subtitle text only), so one source-level fix covers both surfaces.
 *
 * Run:
 *   node src/__tests__/app-hero-typography.test.cjs
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const APP_PAGE_SRC = fs.readFileSync(
  path.join(REPO_ROOT, 'src', 'pages', 'RealEstateWholesaler.tsx'),
  'utf8',
);

function extractHeroH1ClassName() {
  const m = APP_PAGE_SRC.match(
    /<h1\s+className="([^"]+)"[^>]*>\s*Find profitable real estate deals/,
  );
  return m ? m[1] : null;
}

function extractHeroSubtitleClassName() {
  const m = APP_PAGE_SRC.match(
    /<p\s+className="([^"]+)"[^>]*>\s*\{[^}]*effectiveSearchMode\s*===\s*['"]on-market['"]/,
  );
  return m ? m[1] : null;
}

test('app hero h1 matches in-app canonical sizing (Analyzer/Buyers/Sequences)', () => {
  const cls = extractHeroH1ClassName();
  assert.ok(cls, 'Could not find <h1> for "Find profitable real estate deals" — was it renamed?');

  // Canonical in-app heading pattern, identical to Analyzer.tsx:
  //   text-3xl md:text-4xl font-medium tracking-tight
  const required = ['text-3xl', 'md:text-4xl', 'font-medium', 'tracking-tight'];
  for (const token of required) {
    assert.ok(
      cls.split(/\s+/).includes(token),
      `app hero h1 className must include "${token}" to match in-app canonical pattern.\n  Got: ${cls}`,
    );
  }

  // Anti-regression: the massive marketing-hero tokens from PR #443 must
  // NOT come back. These are appropriate for Pricing/HowItWorks marketing
  // pages but visually overwhelming on the in-app /app surface.
  const badTokens = ['md:text-7xl', 'lg:text-8xl', 'font-bold'];
  for (const bad of badTokens) {
    assert.ok(
      !cls.split(/\s+/).includes(bad),
      `app hero h1 className has marketing-hero token "${bad}" — must use in-app sizing.\n  Got: ${cls}`,
    );
  }
  assert.ok(
    !/leading-\[0\.95\]/.test(cls),
    `app hero h1 className has marketing-hero token "leading-[0.95]" — must use in-app sizing.\n  Got: ${cls}`,
  );
});

test('app hero subtitle matches in-app canonical sizing (matches Analyzer subtitle)', () => {
  const cls = extractHeroSubtitleClassName();
  assert.ok(cls, 'Could not find <p> subtitle next to the mode-conditional copy — was it renamed?');

  // Canonical in-app subtitle, identical to Analyzer.tsx:
  //   text-lg text-muted-foreground font-light leading-relaxed
  const required = ['text-lg', 'font-light', 'leading-relaxed'];
  for (const token of required) {
    assert.ok(
      cls.split(/\s+/).includes(token),
      `app hero subtitle className must include "${token}" to match in-app pattern.\n  Got: ${cls}`,
    );
  }

  // Anti-regression: marketing subtitle tokens from PR #443 must not return.
  assert.ok(
    !cls.split(/\s+/).includes('md:text-xl'),
    `app hero subtitle has marketing-hero token "md:text-xl" — must use in-app sizing.\n  Got: ${cls}`,
  );
});
