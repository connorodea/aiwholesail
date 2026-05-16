#!/usr/bin/env node
/**
 * Source-level test for the /blog hero H1 word-spacing bug.
 *
 * Live prod (2026-05-16) renders:
 *
 *     Expert guides forsmarter investing.
 *
 * Visual rendering looks fine (`<br>` breaks the line) but screen
 * readers, Google's crawl text, and Playwright accessibility queries
 * all read the concatenated string with no space — JSX trims the pure
 * whitespace between sibling text and element nodes.
 *
 * The fix needs an EXPLICIT space token in the JSX source — pure
 * indentation whitespace gets stripped by the React compiler. Three
 * idiomatic options:
 *   - `Expert guides for{' '}` (JSX expression containing a space)
 *   - `Expert guides for&nbsp;` (HTML entity, surfaces as U+00A0)
 *   - move the space into the span's text content via a string-literal
 *     expression: `<span>{' smarter investing.'}</span>`
 *
 * Run:
 *   node src/pages/__tests__/Blog.h1-spacing.test.cjs
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const SRC = fs.readFileSync(
  path.join(__dirname, '..', 'Blog.tsx'),
  'utf8',
);

test('Blog.tsx H1: explicit JSX space token between "for" and "smarter"', () => {
  // Locate the H1's "for ... smarter" span.
  const h1Match = SRC.match(/<h1[^>]*>([\s\S]*?)<\/h1>/);
  assert.ok(h1Match, 'expected <h1> in Blog.tsx');
  const between = h1Match[1].match(/Expert guides for([\s\S]*?)smarter investing/);
  assert.ok(between, 'expected hero text pattern');
  const segment = between[1];

  // ONLY these preserve whitespace through JSX compile:
  //   {' '}, {" "}, &nbsp; (or its Unicode form), or an interpolated
  //   string that starts with a space character.
  // Pure indentation (spaces/newlines between tags + text) does NOT.
  const hasJsxStringSpace = /\{\s*['"][  ]['"]\s*\}/.test(segment);
  const hasNbspEntity = /&nbsp;/i.test(segment);
  const hasInterpolatedLeadingSpace = /\{\s*['"][  ]smarter[^'"]*['"]\s*\}/.test(SRC);

  assert.ok(
    hasJsxStringSpace || hasNbspEntity || hasInterpolatedLeadingSpace,
    `H1 must contain an explicit space token preserved through JSX compile.\n` +
    `Pure indentation is stripped — current source concatenates to "forsmarter" ` +
    `for screen readers + crawlers.\n` +
    `Source segment between "for" and "smarter": ${JSON.stringify(segment)}`,
  );
});
