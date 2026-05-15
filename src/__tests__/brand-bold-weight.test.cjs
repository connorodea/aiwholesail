#!/usr/bin/env node
/**
 * Source-level TDD for the global-bold weight bump.
 *
 * The brand wordmark renders in Onest 700 (uppercase + tight tracking).
 * To match that "confident" feel across the site, the global body weight
 * is bumped to 700 (Tailwind `font-bold`) and headings to 800
 * (`font-extrabold`) so the typographic hierarchy stays inverted-correct
 * (headings still visually heavier than body, even with body at bold).
 *
 * Asserts:
 *   1. src/index.css body @apply block includes `font-bold` (weight 700)
 *   2. src/index.css h1-h6 @apply block includes `font-extrabold` (weight 800)
 *      and NOT the legacy `font-semibold`
 *   3. .aiwholesail-wordmark stays at font-weight 700 (unchanged — its
 *      distinction comes from uppercase + -0.045em tracking, not weight)
 *
 * Run with:
 *   node src/__tests__/brand-bold-weight.test.cjs
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..', '..');

function read(rel) {
  return fs.readFileSync(path.join(REPO_ROOT, rel), 'utf8');
}

test('body @apply includes font-bold (700) so default text weight matches the brand', () => {
  const css = read('src/index.css');
  // Match the `body { @apply ...; }` block.
  const m = css.match(/\bbody\s*\{[\s\S]*?@apply\s+([^;]+);/);
  assert.ok(m, 'body @apply declaration not found in src/index.css');
  assert.match(
    m[1],
    /\bfont-bold\b/,
    `body @apply must include 'font-bold' (weight 700). Got: ${m[1].trim()}`,
  );
});

test('h1-h6 @apply uses font-extrabold (800) so headings stay heavier than the new bold body', () => {
  const css = read('src/index.css');
  const m = css.match(/h1,\s*h2,\s*h3,\s*h4,\s*h5,\s*h6\s*\{[\s\S]*?@apply\s+([^;]+);/);
  assert.ok(m, 'h1-h6 @apply declaration not found in src/index.css');
  assert.match(
    m[1],
    /\bfont-extrabold\b/,
    `h1-h6 @apply must include 'font-extrabold' (800). Got: ${m[1].trim()}`,
  );
  assert.doesNotMatch(
    m[1],
    /\bfont-semibold\b/,
    `h1-h6 @apply must no longer use the legacy 'font-semibold' (600 — now lighter than body)`,
  );
});

test('.aiwholesail-wordmark stays at font-weight: 700 (distinction is uppercase + tracking, not weight)', () => {
  const css = read('src/index.css');
  // Match the rule body for .aiwholesail-wordmark and verify weight: 700.
  const m = css.match(/\.aiwholesail-wordmark\s*\{[\s\S]*?\}/);
  assert.ok(m, '.aiwholesail-wordmark rule not found');
  assert.match(
    m[0],
    /font-weight:\s*700/,
    'wordmark must remain at font-weight: 700',
  );
});
