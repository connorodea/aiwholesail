#!/usr/bin/env node
/**
 * Tests for lsi-to-blog-keywords.js — node:test, no external deps.
 * Run with: node scripts/google-ads-setup/lsi-to-blog-keywords.test.js
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  mapRow,
  mapIntent,
  mergeQueues,
  toKeywordsCsv,
  parseKeywordsCsv,
} = require('./lsi-to-blog-keywords.js');

const LSI_FIXTURE_ROW = {
  keyword: 'how to wholesale real estate',
  volume: 1300,
  cpc: 8.2,
  competition: 'low',
  score: 2.1,
  source_seed: 'wholesale real estate',
  suggested_page_type: 'blog',
};

test('mapIntent maps page types to seo-blog intents', () => {
  assert.equal(mapIntent('tool'), 'transactional');
  assert.equal(mapIntent('blog'), 'informational');
  assert.equal(mapIntent('blog-comparison'), 'commercial');
  assert.equal(mapIntent('location'), 'local');
  assert.equal(mapIntent('unknown-type'), 'informational');
  assert.equal(mapIntent(''), 'informational');
});

test('mapRow translates LSI columns to keywords.csv schema', () => {
  const out = mapRow(LSI_FIXTURE_ROW);
  assert.equal(out.keyword, 'how to wholesale real estate');
  assert.equal(out.volume, 1300);
  assert.equal(out.difficulty, 'low');
  assert.equal(out.intent, 'informational');
  assert.equal(out.cluster, 'wholesale real estate');
  assert.equal(out.status, '');
  assert.equal(out.published_url, '');
  assert.equal(out.published_at, '');
});

test('mergeQueues preserves rows with non-empty status', () => {
  const existing = [
    { keyword: 'cap rate calculator', volume: 2900, difficulty: 'low', intent: 'transactional', cluster: 'cap rate calculator', status: 'published', published_url: '/blog/cap-rate-calculator', published_at: '2026-05-10T00:00:00Z' },
    { keyword: 'how to wholesale real estate', volume: 1300, difficulty: 'low', intent: 'informational', cluster: 'wholesale real estate', status: 'in_progress', published_url: '', published_at: '' },
  ];
  const incoming = [
    mapRow(LSI_FIXTURE_ROW),
    mapRow({ ...LSI_FIXTURE_ROW, keyword: 'cap rate calculator', suggested_page_type: 'tool', source_seed: 'cap rate calculator' }),
    mapRow({ ...LSI_FIXTURE_ROW, keyword: 'BRRRR method', source_seed: 'BRRRR method' }),
  ];
  const merged = mergeQueues(existing, incoming);
  // Published row preserved verbatim
  const published = merged.find((r) => r.keyword.toLowerCase() === 'cap rate calculator');
  assert.equal(published.status, 'published');
  assert.equal(published.published_url, '/blog/cap-rate-calculator');
  // in_progress row preserved verbatim (incoming row does NOT overwrite)
  const inProgress = merged.find((r) => r.keyword.toLowerCase() === 'how to wholesale real estate');
  assert.equal(inProgress.status, 'in_progress');
  // Brand-new row appended
  const brrr = merged.find((r) => r.keyword === 'BRRRR method');
  assert.ok(brrr);
  assert.equal(brrr.status, '');
});

test('mergeQueues is case-insensitive on keyword join', () => {
  const existing = [{ keyword: 'How To Wholesale Real Estate', volume: 1300, difficulty: 'low', intent: 'informational', cluster: 'wholesale real estate', status: 'published', published_url: '/x', published_at: '2026-05-10' }];
  const incoming = [mapRow({ ...LSI_FIXTURE_ROW, keyword: 'how to wholesale real estate' })];
  const merged = mergeQueues(existing, incoming);
  // Only one row (the existing published one wins)
  const matches = merged.filter((r) => r.keyword.toLowerCase() === 'how to wholesale real estate');
  assert.equal(matches.length, 1);
  assert.equal(matches[0].status, 'published');
});

test('toKeywordsCsv emits the seo-init keywords.csv header', () => {
  const rows = [mapRow(LSI_FIXTURE_ROW)];
  const csv = toKeywordsCsv(rows);
  const header = csv.split('\n')[0];
  assert.equal(header, 'keyword,volume,difficulty,intent,cluster,status,published_url,published_at');
});

test('toKeywordsCsv quotes fields containing commas', () => {
  const rows = [mapRow({ ...LSI_FIXTURE_ROW, keyword: 'wholesale, flipping, BRRRR' })];
  const csv = toKeywordsCsv(rows);
  const body = csv.split('\n')[1];
  assert.ok(body.startsWith('"wholesale, flipping, BRRRR"'));
});

test('parseKeywordsCsv round-trips toKeywordsCsv output', () => {
  const original = [
    mapRow(LSI_FIXTURE_ROW),
    { keyword: 'cap, rate', volume: 100, difficulty: 'low', intent: 'transactional', cluster: 'calc', status: 'published', published_url: '/x', published_at: '2026-05-10' },
  ];
  const csv = toKeywordsCsv(original);
  const tmp = path.join(os.tmpdir(), `kw-test-${Date.now()}.csv`);
  fs.writeFileSync(tmp, csv);
  const parsed = parseKeywordsCsv(tmp);
  fs.unlinkSync(tmp);
  assert.equal(parsed.length, 2);
  assert.equal(parsed[1].keyword, 'cap, rate');
  assert.equal(parsed[1].status, 'published');
  assert.equal(parsed[1].volume, 100);
});

test('parseKeywordsCsv returns empty array for missing file', () => {
  const out = parseKeywordsCsv('/nonexistent/path/keywords.csv');
  assert.deepEqual(out, []);
});

test('mergeQueues sorts new rows by volume desc within cluster', () => {
  const existing = [];
  const incoming = [
    mapRow({ ...LSI_FIXTURE_ROW, keyword: 'small term', volume: 100, source_seed: 'shared' }),
    mapRow({ ...LSI_FIXTURE_ROW, keyword: 'big term', volume: 5000, source_seed: 'shared' }),
    mapRow({ ...LSI_FIXTURE_ROW, keyword: 'mid term', volume: 1000, source_seed: 'shared' }),
  ];
  const merged = mergeQueues(existing, incoming);
  const cluster = merged.filter((r) => r.cluster === 'shared');
  assert.equal(cluster[0].keyword, 'big term');
  assert.equal(cluster[1].keyword, 'mid term');
  assert.equal(cluster[2].keyword, 'small term');
});
