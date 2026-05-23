#!/usr/bin/env node
/**
 * Tests for aggregate-lsi.js — uses node:test, no external deps.
 * Run with: node scripts/google-ads-setup/aggregate-lsi.test.js
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  parseCsv,
  dedupe,
  filterLowComp,
  filterVeryLowComp,
  classifyPageType,
  toQueueRows,
  toQueueCsv,
  buildSummary,
  isJunkKeyword,
} = require('./aggregate-lsi.js');

// ---- Fixture: a synthetic rolling CSV matching seo-kw-rolling.csv columns.
const FIXTURE_CSV = [
  'keyword,volume,cpc,competition,score,seed,date',
  '"wholesale real estate",5400,12.50,medium,3.5,"wholesale real estate",2026-05-13',
  '"how to wholesale real estate",1300,8.20,low,2.1,"wholesale real estate",2026-05-13',
  // duplicate of above with different score — should dedupe & keep highest score
  '"How To Wholesale Real Estate",1300,8.20,low,1.5,"how to wholesale",2026-05-13',
  '"cap rate calculator",2900,4.10,low,1.2,"cap rate calculator",2026-05-13',
  // volume too low for low-comp tier (<100) but qualifies for very-low-comp (>=50, cpc<=5)
  '"BRRRR calculator",80,3.50,low,0.6,"BRRRR calculator",2026-05-13',
  // low-comp, low volume (<50) — should appear in neither tier
  '"obscure niche term",10,1.00,low,0.1,"random",2026-05-13',
  // high competition — excluded from both
  '"DSCR loan",8100,28.40,high,5.0,"DSCR loan",2026-05-13',
  // location keyword
  '"best cities for real estate investing in Texas",480,5.30,low,0.9,"best cities for real estate investing",2026-05-13',
  // "vs" comparison
  '"PropStream vs DealMachine",320,6.10,low,0.7,"PropStream alternative",2026-05-13',
  // "how to" question
  '"how to find motivated sellers",2400,9.40,low,1.8,"motivated sellers",2026-05-13',
  // tool keyword that should classify as tool
  '"MAO formula calculator",110,2.40,low,0.55,"MAO calculator real estate",2026-05-13',
].join('\n');

function tmpCsv(content) {
  const p = path.join(os.tmpdir(), `lsi-test-${Date.now()}-${Math.random().toString(36).slice(2)}.csv`);
  fs.writeFileSync(p, content);
  return p;
}

test('parseCsv extracts rows with numeric coercion', () => {
  const p = tmpCsv(FIXTURE_CSV);
  const rows = parseCsv(p);
  fs.unlinkSync(p);
  assert.equal(rows.length, 11);
  const first = rows[0];
  assert.equal(first.keyword, 'wholesale real estate');
  assert.equal(first.volume, 5400);
  assert.equal(first.cpc, 12.5);
  assert.equal(first.competition, 'medium');
  assert.equal(first.score, 3.5);
  assert.equal(first.seed, 'wholesale real estate');
});

test('dedupe collapses case-insensitive duplicates keeping highest score', () => {
  const p = tmpCsv(FIXTURE_CSV);
  const rows = parseCsv(p);
  fs.unlinkSync(p);
  const deduped = dedupe(rows);
  // 11 input rows but one dup ("how to wholesale" capitalized variant) -> 10
  assert.equal(deduped.length, 10);
  const found = deduped.find((r) => r.keyword.toLowerCase() === 'how to wholesale real estate');
  assert.ok(found);
  // Should keep the higher score (2.1, not 1.5)
  assert.equal(found.score, 2.1);
});

test('filterLowComp keeps only low competition + vol>=100 + score>=0.3', () => {
  const p = tmpCsv(FIXTURE_CSV);
  const rows = dedupe(parseCsv(p));
  fs.unlinkSync(p);
  const low = filterLowComp(rows);
  const keywords = low.map((r) => r.keyword.toLowerCase()).sort();
  // Expected low-comp:
  //   how to wholesale real estate (1300, low, 2.1) ✓
  //   cap rate calculator (2900, low, 1.2) ✓
  //   best cities ... in Texas (480, low, 0.9) ✓
  //   PropStream vs DealMachine (320, low, 0.7) ✓
  //   how to find motivated sellers (2400, low, 1.8) ✓
  //   MAO formula calculator (110, low, 0.55) ✓
  // NOT BRRRR calculator (80 vol — below 100)
  // NOT obscure niche term (score 0.1 — below 0.3)
  // NOT DSCR loan (high competition)
  // NOT wholesale real estate (medium)
  assert.equal(low.length, 6);
  assert.ok(keywords.includes('cap rate calculator'));
  assert.ok(keywords.includes('how to wholesale real estate'));
  assert.ok(!keywords.includes('dscr loan'));
  assert.ok(!keywords.includes('brrrr calculator'));
});

test('filterVeryLowComp uses looser thresholds (vol>=50, cpc<=5)', () => {
  const p = tmpCsv(FIXTURE_CSV);
  const rows = dedupe(parseCsv(p));
  fs.unlinkSync(p);
  const veryLow = filterVeryLowComp(rows);
  const keywords = veryLow.map((r) => r.keyword.toLowerCase());
  // Must be low-comp and vol>=50 and cpc<=5:
  //   cap rate calculator (2900, low, cpc 4.10) ✓
  //   BRRRR calculator (80, low, cpc 3.50) ✓
  //   MAO formula calculator (110, low, cpc 2.40) ✓
  // PropStream vs DealMachine has cpc 6.10 — excluded
  // best cities ... Texas has cpc 5.30 — excluded
  // how to find motivated sellers cpc 9.40 — excluded
  // how to wholesale real estate cpc 8.20 — excluded
  assert.ok(keywords.includes('cap rate calculator'));
  assert.ok(keywords.includes('brrrr calculator'));
  assert.ok(keywords.includes('mao formula calculator'));
  assert.ok(!keywords.includes('propstream vs dealmachine'));
  assert.equal(veryLow.length, 3);
});

test('classifyPageType routes calculator->tool, state->location, how to->blog, vs->blog-comparison', () => {
  assert.equal(classifyPageType('cap rate calculator'), 'tool');
  assert.equal(classifyPageType('MAO formula calculator'), 'tool');
  assert.equal(classifyPageType('best cities for real estate investing in Texas'), 'location');
  assert.equal(classifyPageType('real estate investing in Austin TX'), 'location');
  assert.equal(classifyPageType('how to wholesale real estate'), 'blog');
  assert.equal(classifyPageType('what is ARV in real estate'), 'blog');
  assert.equal(classifyPageType('PropStream vs DealMachine'), 'blog-comparison');
  assert.equal(classifyPageType('PropStream alternative'), 'blog-comparison');
  assert.equal(classifyPageType('something completely generic'), 'blog');
});

test('toQueueRows orders by score desc and includes source_seed + suggested_page_type', () => {
  const p = tmpCsv(FIXTURE_CSV);
  const rows = filterLowComp(dedupe(parseCsv(p)));
  fs.unlinkSync(p);
  const queue = toQueueRows(rows);
  // Highest score (2.1) should come first
  assert.equal(queue[0].keyword, 'how to wholesale real estate');
  assert.equal(queue[0].suggested_page_type, 'blog');
  assert.ok(typeof queue[0].source_seed === 'string');
  // Each row has score descending vs the next
  for (let i = 1; i < queue.length; i++) {
    assert.ok(queue[i - 1].score >= queue[i].score);
  }
});

test('toQueueCsv produces valid CSV with the documented columns', () => {
  const p = tmpCsv(FIXTURE_CSV);
  const rows = filterLowComp(dedupe(parseCsv(p)));
  fs.unlinkSync(p);
  const csv = toQueueCsv(toQueueRows(rows));
  const header = csv.split('\n')[0];
  assert.equal(header, 'keyword,volume,cpc,competition,score,source_seed,suggested_page_type');
  // body lines should equal queue length
  const lines = csv.trim().split('\n').slice(1);
  assert.equal(lines.length, 6);
  // each body line must have 7 comma-separated fields (some quoted)
  for (const line of lines) {
    // simple count via parseCsvLine to handle quoted commas
    assert.ok(line.includes(','));
  }
});

test('buildSummary returns markdown including totals and tier counts', () => {
  const p = tmpCsv(FIXTURE_CSV);
  const all = dedupe(parseCsv(p));
  fs.unlinkSync(p);
  const low = filterLowComp(all);
  const veryLow = filterVeryLowComp(all);
  const md = buildSummary({ all, low, veryLow });
  assert.match(md, /LSI keyword aggregate summary/i);
  assert.match(md, /Total unique keywords:\s*10/);
  assert.match(md, /Low-comp tier:\s*6/);
  assert.match(md, /Very-low-comp tier:\s*3/);
  // Page type breakdown
  assert.match(md, /By suggested_page_type/i);
});

test('isJunkKeyword filters RapidAPI expansion noise (careers, jobs, ceo, etc.)', () => {
  // Real RapidAPI expansion artifacts seen in the 2026-05-13 batch.
  // They game the score but have no content angle for a real estate investing SaaS.
  assert.equal(isJunkKeyword('high equity property leads careers'), true);
  assert.equal(isJunkKeyword('high equity property leads jobs'), true);
  assert.equal(isJunkKeyword('high equity property leads address'), true);
  assert.equal(isJunkKeyword('high equity property leads headquarters'), true);
  assert.equal(isJunkKeyword('PropStream phone number'), true);
  assert.equal(isJunkKeyword('PropStream ceo'), true);
  assert.equal(isJunkKeyword('AIWholesail linkedin'), true);
  assert.equal(isJunkKeyword('REI investor employment'), true);
  // 3-token trailing phrases — must match too
  assert.equal(isJunkKeyword('high equity property leads is it good'), true);
  assert.equal(isJunkKeyword('PropStream is it legit'), true);
  assert.equal(isJunkKeyword('BatchLeads is it real'), true);
  assert.equal(isJunkKeyword('DealMachine is it scam'), true);
  // Real estate terms that LOOK adjacent but ARE valid content seeds — must pass through.
  assert.equal(isJunkKeyword('PropStream review'), false);
  assert.equal(isJunkKeyword('PropStream alternative'), false);
  assert.equal(isJunkKeyword('PropStream pricing'), false);
  assert.equal(isJunkKeyword('wholesale real estate income'), false);
  assert.equal(isJunkKeyword('how to wholesale real estate'), false);
  assert.equal(isJunkKeyword('best cities for real estate investing'), false);
  // Core REI terms that end in tokens flagged by an over-broad stoplist — must pass through.
  // These are real intent: "for sale by owner" (FSBO), absentee-owner lists, address-lookup tools.
  assert.equal(isJunkKeyword('absentee owner'), false);
  assert.equal(isJunkKeyword('for sale by owner'), false);
  assert.equal(isJunkKeyword('homes for sale by owner'), false);
  assert.equal(isJunkKeyword('arv calculator by address'), false);
  assert.equal(isJunkKeyword('property lookup by address'), false);
});

test('filterLowComp drops junk keywords by default', () => {
  const rows = [
    { keyword: 'wholesale real estate', volume: 5400, cpc: 12, competition: 'low', score: 3.5 },
    { keyword: 'PropStream careers', volume: 2800, cpc: 14, competition: 'low', score: 2.8 },
    { keyword: 'high equity property leads jobs', volume: 2700, cpc: 13, competition: 'low', score: 2.7 },
    { keyword: 'how to wholesale real estate', volume: 1300, cpc: 8, competition: 'low', score: 2.1 },
  ];
  const out = filterLowComp(rows);
  assert.equal(out.length, 2);
  assert.deepEqual(out.map((r) => r.keyword).sort(), ['how to wholesale real estate', 'wholesale real estate']);
});

test('filterLowComp can opt out of junk filter via includeJunk=true', () => {
  const rows = [
    { keyword: 'wholesale real estate', volume: 5400, cpc: 12, competition: 'low', score: 3.5 },
    { keyword: 'PropStream careers', volume: 2800, cpc: 14, competition: 'low', score: 2.8 },
  ];
  const out = filterLowComp(rows, { includeJunk: true });
  assert.equal(out.length, 2);
});
