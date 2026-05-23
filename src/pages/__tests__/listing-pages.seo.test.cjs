#!/usr/bin/env node
/**
 * Source-level TDD for the two parent listing pages:
 *   - Blog.tsx (/blog)
 *   - SoftwareReviews.tsx (/reviews)
 *
 * These are high-value SERP entry points whose titles + descriptions
 * are easy to over-generic. The asserts here catch the specific failure
 * modes found in the 2026-05-13 audit pass.
 *
 * Run: node src/pages/__tests__/listing-pages.seo.test.cjs
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

function loadSeoHeadProps(pageFile) {
  const src = fs.readFileSync(path.join(__dirname, '..', pageFile), 'utf8');
  const m = src.match(/<SEOHead[\s\S]*?\/>/);
  if (!m) throw new Error(`SEOHead not found in ${pageFile}`);
  const block = m[0];
  function prop(name) {
    const re = new RegExp(`${name}=(?:"([^"]+)"|\\{(?:["'\`])([^"'\`]+)(?:["'\`])\\})`);
    const mm = block.match(re);
    return mm ? (mm[1] || mm[2]) : null;
  }
  return { title: prop('title'), description: prop('description'), canonicalUrl: prop('canonicalUrl') };
}

function renderedTitleLength(rawTitle) {
  if (!rawTitle) return 0;
  const brandRe = /\bai\s?wholesail\b/i;
  return (brandRe.test(rawTitle) ? rawTitle : `${rawTitle} | AIWholesail`).length;
}

// ===== Blog.tsx =====

test('Blog.tsx title mentions "blog" or "guides" (not just "Resources")', () => {
  const { title } = loadSeoHeadProps('Blog.tsx');
  assert.ok(title, 'no title');
  assert.match(
    title,
    /\b(blog|guides?|articles?)\b/i,
    `title should include a discoverable noun (blog/guide/articles): "${title}"`,
  );
});

test('Blog.tsx title mentions the niche (real estate / investing / wholesaling)', () => {
  const { title } = loadSeoHeadProps('Blog.tsx');
  assert.ok(title, 'no title');
  assert.match(
    title,
    /\b(real\s?estate|investing|wholesal\w*|flipping|brrrr)\b/i,
    `title should include a niche keyword: "${title}"`,
  );
});

test('Blog.tsx rendered title is <= 60 chars', () => {
  const { title } = loadSeoHeadProps('Blog.tsx');
  assert.ok(title, 'no title');
  const len = renderedTitleLength(title);
  assert.ok(len <= 60, `rendered title is ${len} chars: "${title}"`);
});

test('Blog.tsx has an explicit canonicalUrl', () => {
  const { canonicalUrl } = loadSeoHeadProps('Blog.tsx');
  assert.ok(canonicalUrl, 'canonicalUrl should be set explicitly on a high-traffic page');
  assert.match(canonicalUrl, /aiwholesail\.com\/blog/, `canonical should point to /blog: "${canonicalUrl}"`);
});

// ===== SoftwareReviews.tsx =====

test('SoftwareReviews.tsx title uses an em-dash, not double-hyphen', () => {
  const { title } = loadSeoHeadProps('SoftwareReviews.tsx');
  assert.ok(title, 'no title');
  assert.ok(!title.includes('--'), `title should not contain "--": "${title}"`);
});

test('SoftwareReviews.tsx description is <= 160 chars', () => {
  const { description } = loadSeoHeadProps('SoftwareReviews.tsx');
  assert.ok(description, 'no description');
  assert.ok(
    description.length <= 160,
    `description is ${description.length} chars (>160): "${description}"`,
  );
});

test('SoftwareReviews.tsx rendered title is <= 60 chars', () => {
  const { title } = loadSeoHeadProps('SoftwareReviews.tsx');
  assert.ok(title, 'no title');
  const len = renderedTitleLength(title);
  assert.ok(len <= 60, `rendered title is ${len} chars: "${title}"`);
});

test('SoftwareReviews.tsx canonicalUrl points to /reviews', () => {
  const { canonicalUrl } = loadSeoHeadProps('SoftwareReviews.tsx');
  assert.ok(canonicalUrl, 'canonicalUrl missing');
  assert.match(canonicalUrl, /aiwholesail\.com\/reviews/, `canonical mismatch: "${canonicalUrl}"`);
});
