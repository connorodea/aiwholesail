#!/usr/bin/env node
// Run with: node scripts/seo/check-blog-meta.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { lintArticle, lintDir, formatReport, LIMITS } = require('./check-blog-meta.js');

function tmpDir(files) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'blog-lint-'));
  for (const [name, content] of Object.entries(files)) {
    fs.writeFileSync(path.join(dir, name), JSON.stringify(content));
  }
  return dir;
}

const VALID = {
  slug: 'good-article',
  title: 'A Sensible 45-Char Title About BRRRR Investing',
  metaDescription:
    'BRRRR investing guide for beginners: buy, rehab, rent, refinance, repeat. With a worked example, common pitfalls, and a free calculator.',
  excerpt: 'Beginner BRRRR guide.',
};

test('lintArticle accepts a well-formed article', () => {
  const issues = lintArticle(VALID);
  assert.equal(issues.length, 0, `expected no issues, got: ${JSON.stringify(issues)}`);
});

test('lintArticle flags title > 60 chars', () => {
  const a = { ...VALID, title: 'x'.repeat(LIMITS.TITLE_MAX + 1) };
  const issues = lintArticle(a);
  assert.ok(issues.some((i) => i.code === 'TITLE_TOO_LONG'), JSON.stringify(issues));
});

test('lintArticle flags title < 30 chars', () => {
  const a = { ...VALID, title: 'Short title' };
  const issues = lintArticle(a);
  assert.ok(issues.some((i) => i.code === 'TITLE_TOO_SHORT'));
});

test('lintArticle flags description > 160 chars', () => {
  const a = { ...VALID, metaDescription: 'x'.repeat(LIMITS.DESC_MAX + 1) };
  const issues = lintArticle(a);
  assert.ok(issues.some((i) => i.code === 'DESC_TOO_LONG'));
});

test('lintArticle flags description < 80 chars', () => {
  const a = { ...VALID, metaDescription: 'short' };
  const issues = lintArticle(a);
  assert.ok(issues.some((i) => i.code === 'DESC_TOO_SHORT'));
});

test('lintArticle uses excerpt fallback when metaDescription is missing', () => {
  const a = { ...VALID, metaDescription: undefined, excerpt: VALID.metaDescription };
  const issues = lintArticle(a);
  assert.equal(issues.length, 0);
});

test('lintArticle flags missing description AND excerpt', () => {
  const a = { ...VALID, metaDescription: undefined, excerpt: undefined };
  const issues = lintArticle(a);
  assert.ok(issues.some((i) => i.code === 'DESC_MISSING'));
});

test('lintArticle flags missing title', () => {
  const a = { ...VALID, title: '' };
  const issues = lintArticle(a);
  assert.ok(issues.some((i) => i.code === 'TITLE_MISSING'));
});

test('lintDir aggregates issues across all JSON files', () => {
  const dir = tmpDir({
    'good.json': VALID,
    'bad-title.json': { ...VALID, slug: 'bad-title', title: 'x'.repeat(80) },
    'bad-desc.json': { ...VALID, slug: 'bad-desc', metaDescription: 'x'.repeat(200) },
  });
  const report = lintDir(dir);
  assert.equal(report.totalFiles, 3);
  assert.equal(report.errorFiles, 0); // soft limits => warnings, not errors
  assert.ok(report.warnings.length >= 2);
  // cleanup
  fs.rmSync(dir, { recursive: true, force: true });
});

test('lintDir returns empty warnings when all articles pass', () => {
  const dir = tmpDir({ 'one.json': VALID, 'two.json': { ...VALID, slug: 'two' } });
  const report = lintDir(dir);
  assert.equal(report.warnings.length, 0);
  assert.equal(report.totalFiles, 2);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('lintDir skips index/manifest files that have an articles[] field', () => {
  const dir = tmpDir({
    'index.json': { articles: [{ slug: 'a' }, { slug: 'b' }] },
    'real-article.json': VALID,
  });
  const report = lintDir(dir);
  // Should only lint the real article, not the index.
  assert.equal(report.warnings.length, 0, `index.json should be skipped, got: ${JSON.stringify(report.warnings)}`);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('formatReport produces a readable summary', () => {
  const dir = tmpDir({
    'good.json': VALID,
    'bad-title.json': { ...VALID, slug: 'bad-title', title: 'x'.repeat(80) },
  });
  const report = lintDir(dir);
  const md = formatReport(report);
  assert.match(md, /Blog meta lint/i);
  assert.match(md, /TITLE_TOO_LONG/);
  assert.match(md, /bad-title/);
  fs.rmSync(dir, { recursive: true, force: true });
});
