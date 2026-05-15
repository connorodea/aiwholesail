#!/usr/bin/env node
/**
 * Source-level guard: the /app page hero (RealEstateWholesaler.tsx)
 * must match the canonical centered-hero typography pattern used on
 * Pricing, HowItWorks, UseCases, Personas, etc.
 *
 * Pre-fix (2026-05-14 user report): the /app hero rendered at
 * `text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-medium` — visibly
 * smaller and lighter than every other public hero. Founder noticed
 * and asked for parity.
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

// Pull the h1 element that wraps "Find profitable real estate deals".
// Match the className attribute on the h1 immediately before that text.
function extractHeroH1ClassName() {
  const m = APP_PAGE_SRC.match(
    /<h1\s+className="([^"]+)"[^>]*>\s*Find profitable real estate deals/,
  );
  return m ? m[1] : null;
}

// Pull the <p> subtitle that wraps the mode-specific copy ("Discover
// undervalued..." for on-market, "Search off-market..." for off-market).
// We match by the ternary expression that immediately follows the <p>'s
// opening tag — it's the unique signature of the subtitle slot.
function extractHeroSubtitleClassName() {
  const m = APP_PAGE_SRC.match(
    /<p\s+className="([^"]+)"[^>]*>\s*\{[^}]*effectiveSearchMode\s*===\s*['"]on-market['"]/,
  );
  return m ? m[1] : null;
}

test('app hero h1 uses canonical centered-hero sizing (matches Pricing/HowItWorks)', () => {
  const cls = extractHeroH1ClassName();
  assert.ok(cls, 'Could not find <h1> for "Find profitable real estate deals" — was it renamed?');

  // Required tokens. We allow either Pricing\'s `text-3xl sm:text-5xl
  // md:text-7xl lg:text-8xl` OR the simpler `text-5xl md:text-7xl
  // lg:text-8xl` — both appear on canonical pages.
  const required = ['md:text-7xl', 'lg:text-8xl', 'font-bold', 'tracking-tight'];
  for (const token of required) {
    assert.ok(
      cls.split(/\s+/).includes(token),
      `app hero h1 className must include "${token}" to match canonical hero pattern.\n  Got: ${cls}`,
    );
  }

  // leading must be tight — leading-[0.95] is the canonical choice; the
  // earlier `leading-tight` was 1.25 which felt cramped at large sizes.
  assert.match(
    cls,
    /leading-\[0\.95\]/,
    `app hero h1 must use leading-[0.95] (the canonical hero line-height).\n  Got: ${cls}`,
  );

  // Anti-regression: pre-fix sizes must NOT be present.
  for (const bad of ['text-2xl', 'lg:text-5xl', 'font-medium']) {
    assert.ok(
      !cls.split(/\s+/).includes(bad),
      `app hero h1 className still has pre-fix token "${bad}" — typography hasn\'t been updated.\n  Got: ${cls}`,
    );
  }
});

test('app hero subtitle uses canonical sizing (matches Pricing/HowItWorks subtitles)', () => {
  const cls = extractHeroSubtitleClassName();
  assert.ok(cls, 'Could not find <p> subtitle next to the mode-conditional copy — was it renamed?');

  // Canonical subtitle is `text-lg md:text-xl ... leading-relaxed font-light`.
  const required = ['md:text-xl', 'leading-relaxed', 'font-light'];
  for (const token of required) {
    assert.ok(
      cls.split(/\s+/).includes(token),
      `app hero subtitle className must include "${token}" to match canonical pattern.\n  Got: ${cls}`,
    );
  }

  // Must NOT have the smaller pre-fix base size.
  assert.ok(
    !cls.split(/\s+/).includes('text-base'),
    `app hero subtitle still has pre-fix "text-base" — typography hasn\'t been updated.\n  Got: ${cls}`,
  );
});
