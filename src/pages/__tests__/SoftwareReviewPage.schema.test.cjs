#!/usr/bin/env node
/**
 * Source-level TDD for SoftwareReviewPage.tsx schema markup.
 *
 * Asserts SEO-relevant invariants in the JSX source:
 *   1. Exactly ONE Review schema is emitted (not two competing ones).
 *   2. No hardcoded dates that drift from the LAST_UPDATED constant.
 *   3. No `dangerouslySetInnerHTML` JSON-LD blocks (the codebase convention
 *      uses <Helmet><script type="application/ld+json">...).
 *
 * Run with:
 *   node src/pages/__tests__/SoftwareReviewPage.schema.test.js
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const SRC = fs.readFileSync(
  path.join(__dirname, '..', 'SoftwareReviewPage.tsx'),
  'utf8',
);

test('emits exactly one Review schema (no duplicate JSON-LD)', () => {
  // Match both quoted-key styles: '@type': 'Review' or "@type": "Review"
  const matches = SRC.match(/['"]@type['"]\s*:\s*['"]Review['"]/g) || [];
  assert.equal(
    matches.length,
    1,
    `Expected exactly one Review schema, found ${matches.length}. ` +
      'Duplicate JSON-LD blocks confuse Google about which dates/ratings to trust.',
  );
});

test('does not contain hardcoded ISO dates outside the LAST_UPDATED constant', () => {
  // Look for hardcoded YYYY-MM-DD strings that are NOT the LAST_UPDATED definition.
  const dateRe = /['"]20\d{2}-\d{2}-\d{2}['"]/g;
  const allDates = SRC.match(dateRe) || [];
  // Allowed: the LAST_UPDATED constant definition itself.
  const lastUpdatedDef = SRC.match(/LAST_UPDATED\s*=\s*['"](\d{4}-\d{2}-\d{2})['"]/);
  const allowed = lastUpdatedDef ? `'${lastUpdatedDef[1]}'` : null;
  const stale = allDates.filter((d) => {
    const stripped = d.replace(/"/g, "'");
    return stripped !== allowed;
  });
  assert.equal(
    stale.length,
    0,
    `Expected 0 hardcoded dates outside LAST_UPDATED; found ${stale.length}: ${stale.join(', ')}. ` +
      'These will drift from LAST_UPDATED and ship stale "Updated" timestamps to Google.',
  );
});

test('does not use dangerouslySetInnerHTML for JSON-LD (use <Helmet> instead)', () => {
  const danger = SRC.match(/dangerouslySetInnerHTML/g) || [];
  assert.equal(
    danger.length,
    0,
    'dangerouslySetInnerHTML for JSON-LD is brittle and bypasses react-helmet-async. ' +
      'Use <Helmet><script type="application/ld+json">...</script></Helmet> instead.',
  );
});
