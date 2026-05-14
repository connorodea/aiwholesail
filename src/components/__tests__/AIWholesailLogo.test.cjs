#!/usr/bin/env node
/**
 * Source-level TDD for the AIWholesailLogo brand wordmark.
 *
 * Asserts the component's *contract* — what callers depend on — without
 * spinning up a renderer. Matches the in-repo convention (see
 * src/pages/__tests__/Pricing.seo.test.cjs).
 *
 * Contract:
 *   1. Component file exists at src/components/AIWholesailLogo.tsx
 *   2. Exports `AIWholesailLogo` as a named export (so call sites can do
 *      `import { AIWholesailLogo } from '@/components/AIWholesailLogo'`)
 *   3. Renders the wordmark in three pieces — "AIWHOLES" + inline sail SVG
 *      + "IL" — so the sail glyph substitutes for the A in SAIL
 *   4. Uses the canonical sail path from the brand source of truth
 *      (marketing/creatives/branding/aiwholesail-logo-main.html)
 *   5. Defines three variants: dark, light, onCyan, with the brand-spec
 *      text + sail colors for each
 *   6. Applies the `aiwholesail-wordmark` class (so the Onest font scope
 *      in src/index.css binds)
 *   7. Exposes an accessible label (aria-label or role="img" + label)
 *
 * Run with:
 *   node src/components/__tests__/AIWholesailLogo.test.cjs
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const COMPONENT_PATH = path.join(
  __dirname,
  '..',
  'AIWholesailLogo.tsx',
);

// Canonical sail path from marketing/creatives/branding/aiwholesail-logo-main.html
const CANONICAL_SAIL_PATH =
  'M28,4 C33,6 42,30 47,62 Q48,68 42,68 L8,68 Q2,68 3,62 C8,30 23,2 28,4 Z';

function readSource() {
  return fs.readFileSync(COMPONENT_PATH, 'utf8');
}

// Strip block + line comments so we assert on real source, not docstrings
// that happen to mention the wordmark.
function readSourceNoComments() {
  return readSource()
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');
}

test('component file exists', () => {
  assert.ok(
    fs.existsSync(COMPONENT_PATH),
    `expected component at ${COMPONENT_PATH}`,
  );
});

test('exports AIWholesailLogo as a named export', () => {
  const src = readSource();
  assert.match(
    src,
    /export\s+(function|const)\s+AIWholesailLogo\b/,
    'AIWholesailLogo must be a named export (call sites import it that way)',
  );
});

test('renders wordmark as AIWHOLES + sail SVG + IL (sail substitutes for A)', () => {
  const src = readSourceNoComments();
  // Order matters: AIWHOLES must appear before IL in the JSX, with a sail svg
  // between them. Comments are stripped so docstrings can't satisfy this.
  const idxStart = src.indexOf('AIWHOLES');
  const idxEnd = src.indexOf('IL', idxStart);
  assert.ok(idxStart >= 0, 'AIWHOLES text not found');
  assert.ok(idxEnd > idxStart, '"IL" must appear after "AIWHOLES"');
  const between = src.slice(idxStart, idxEnd);
  assert.match(between, /<svg/, 'sail <svg> must sit between AIWHOLES and IL');
});

test('uses the canonical sail SVG path from the brand source of truth', () => {
  const src = readSource();
  assert.ok(
    src.includes(CANONICAL_SAIL_PATH),
    `sail path must match brand source of truth: ${CANONICAL_SAIL_PATH}`,
  );
});

test('defines dark variant — white wordmark + cyan sail', () => {
  const src = readSource();
  // dark variant must produce white text + #00c4c8 sail somewhere in the file
  assert.match(src, /dark\b[\s\S]*?#ffffff[\s\S]*?#00c4c8|#ffffff[\s\S]*?#00c4c8[\s\S]*?dark/i,
    'dark variant must map to text #ffffff and sail #00c4c8');
});

test('defines light variant — ink wordmark + cyan sail', () => {
  const src = readSource();
  assert.match(src, /light\b[\s\S]*?#0a0a0a[\s\S]*?#00c4c8|#0a0a0a[\s\S]*?#00c4c8[\s\S]*?light/i,
    'light variant must map to text #0a0a0a and sail #00c4c8');
});

test('defines onCyan variant — ink wordmark + white sail', () => {
  const src = readSource();
  assert.match(src, /onCyan\b[\s\S]*?#0a0a0a[\s\S]*?#ffffff|#0a0a0a[\s\S]*?#ffffff[\s\S]*?onCyan/i,
    'onCyan variant must map to text #0a0a0a and sail #ffffff');
});

test('applies the aiwholesail-wordmark class so the Onest font scope binds', () => {
  const src = readSource();
  assert.match(
    src,
    /aiwholesail-wordmark/,
    'must apply class aiwholesail-wordmark (binds Onest font via src/index.css @layer components)',
  );
});

test('exposes an accessible label (role=img + aria-label)', () => {
  const src = readSource();
  assert.match(src, /role=["']img["']/, 'must have role="img"');
  assert.match(src, /aria-label=/, 'must have an aria-label prop bound');
});

test('the inner <svg> is aria-hidden (decorative; outer span carries the label)', () => {
  const src = readSource();
  assert.match(
    src,
    /<svg[^>]*aria-hidden=["']true["']/,
    'inner sail <svg> must be aria-hidden="true" so screen readers do not double-announce',
  );
});
