#!/usr/bin/env node
/**
 * Source-level TDD for FAQ.tsx SEO meta.
 *
 * The page targets a high-value SERP entry: queries like "AIWholesail
 * FAQ", "AIWholesail pricing", "AI real estate platform questions".
 * Generic "Frequently Asked Questions" title leaks all that intent.
 *
 * Run: node src/pages/__tests__/FAQ.seo.test.cjs
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'FAQ.tsx'), 'utf8');

function getProp(name) {
  const m = SRC.match(/<SEOHead[\s\S]*?\/>/);
  if (!m) throw new Error('SEOHead not found');
  const re = new RegExp(`${name}=(?:"([^"]+)"|\\{(?:["'\`])([^"'\`]+)(?:["'\`])\\})`);
  const mm = m[0].match(re);
  return mm ? (mm[1] || mm[2]) : null;
}

function renderedTitleLen(t) {
  if (!t) return 0;
  return (/\bai\s?wholesail\b/i.test(t) ? t : `${t} | AIWholesail`).length;
}

test('FAQ.tsx title mentions FAQ or "questions"', () => {
  const t = getProp('title');
  assert.ok(t, 'no title');
  assert.match(t, /\b(FAQ|questions?)\b/i, `title must contain FAQ/questions: "${t}"`);
});

test('FAQ.tsx title is not the generic placeholder "Frequently Asked Questions"', () => {
  const t = getProp('title');
  assert.notEqual(
    t?.trim(),
    'Frequently Asked Questions',
    'Generic title wastes SERP real estate; embed brand + niche signals',
  );
});

test('FAQ.tsx title includes a niche signal (pricing/trial/AI/real estate)', () => {
  const t = getProp('title');
  assert.ok(t, 'no title');
  assert.match(
    t,
    /\b(pricing|trial|AI|real\s?estate|investing|wholesal\w*)\b/i,
    `title should hit a niche signal: "${t}"`,
  );
});

test('FAQ.tsx rendered title is <= 60 chars', () => {
  const t = getProp('title');
  assert.ok(t);
  const len = renderedTitleLen(t);
  assert.ok(len <= 60, `rendered title is ${len} chars: "${t}"`);
});

test('FAQ.tsx description is <= 160 chars', () => {
  const d = getProp('description');
  assert.ok(d);
  assert.ok(d.length <= 160, `description ${d.length} chars`);
});

test('FAQ.tsx has explicit canonicalUrl pointing to /faq', () => {
  const c = getProp('canonicalUrl');
  assert.ok(c, 'canonicalUrl missing');
  assert.match(c, /aiwholesail\.com\/faq/, `canonical mismatch: "${c}"`);
});
