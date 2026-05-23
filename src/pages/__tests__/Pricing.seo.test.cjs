#!/usr/bin/env node
/**
 * Source-level TDD for Pricing.tsx SEO meta.
 *
 * Asserts:
 *   1. SEOHead title is not the generic placeholder "Pricing Plans"
 *   2. SEOHead title embeds price signals ($49, $99) for SERP CTR
 *   3. SEOHead title mentions the free trial (high-intent SERP signal)
 *   4. SEOHead has an explicit canonicalUrl
 *
 * Run with:
 *   node src/pages/__tests__/Pricing.seo.test.cjs
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const SRC = fs.readFileSync(
  path.join(__dirname, '..', 'Pricing.tsx'),
  'utf8',
);

// Extract the SEOHead JSX block to scope all assertions.
function seoHeadBlock() {
  const m = SRC.match(/<SEOHead[\s\S]*?\/>/);
  if (!m) throw new Error('SEOHead component not found in Pricing.tsx');
  return m[0];
}

function getProp(propName) {
  const block = seoHeadBlock();
  const re = new RegExp(`${propName}=(?:"([^"]+)"|\\{(?:["'\`])([^"'\`]+)(?:["'\`])\\})`);
  const m = block.match(re);
  return m ? (m[1] || m[2]) : null;
}

test('SEOHead title is not the generic placeholder "Pricing Plans"', () => {
  const title = getProp('title');
  assert.ok(title, 'SEOHead title prop must be set');
  assert.notEqual(
    title.trim(),
    'Pricing Plans',
    'Generic "Pricing Plans" wastes SERP real estate; embed price + trial signals',
  );
});

test('SEOHead title embeds Pro/Elite price signals ($49 and $99)', () => {
  const title = getProp('title');
  assert.ok(title, 'no title');
  assert.ok(
    title.includes('$49') || title.includes('49'),
    `title should include the $49 Pro price for SERP CTR: "${title}"`,
  );
  assert.ok(
    title.includes('$99') || title.includes('99'),
    `title should include the $99 Elite price for SERP CTR: "${title}"`,
  );
});

test('SEOHead title mentions the free trial (high-intent SERP signal)', () => {
  const title = getProp('title');
  assert.ok(title, 'no title');
  assert.match(
    title,
    /\btrial\b/i,
    `title should mention "trial" for high-intent SERP CTR: "${title}"`,
  );
});

test('SEOHead title is <= 60 chars after brand append', () => {
  const title = getProp('title');
  assert.ok(title, 'no title');
  // SEOHead appends " | AIWholesail" only if title doesn't already mention the brand.
  const brandRe = /\bai\s?wholesail\b/i;
  const full = brandRe.test(title) ? title : `${title} | AIWholesail`;
  assert.ok(
    full.length <= 60,
    `Rendered title is ${full.length} chars (>60): "${full}"`,
  );
});

test('SEOHead has an explicit canonicalUrl pointing to /pricing', () => {
  const canonical = getProp('canonicalUrl');
  assert.ok(
    canonical,
    'canonicalUrl should be set explicitly on high-traffic pages (relying on computed canonical is fragile)',
  );
  assert.ok(
    /aiwholesail\.com\/pricing/.test(canonical),
    `canonical should point to /pricing: "${canonical}"`,
  );
});
