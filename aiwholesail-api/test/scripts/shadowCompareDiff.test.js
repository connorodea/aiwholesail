/**
 * Unit tests for the shadow-compare-zillow pure helpers.
 *
 * Driver script is at scripts/shadow-compare-zillow.js. Helpers are extracted
 * to scripts/lib/shadowCompareDiff.js so they can be tested without pulling
 * in axios or the (not-yet-merged) scrape.do scraper module.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  CANONICAL_FIELDS,
  diffFields,
  valuesMatch,
  percentile,
  aggregate,
  rowOutcomeSentence,
} = require('../../scripts/lib/shadowCompareDiff');

test('diffFields — identical payloads produce empty diff', () => {
  const data = { zpid: '123', price: 450000, bedrooms: 3, bathrooms: 2 };
  assert.deepEqual(diffFields(data, data), []);
});

test('diffFields — value mismatch is flagged with reason', () => {
  const a = { zpid: '123', price: 450000, bedrooms: 3 };
  const b = { zpid: '123', price: 300000, bedrooms: 3 };
  const diff = diffFields(a, b);
  assert.equal(diff.length, 1);
  assert.equal(diff[0].field, 'price');
  assert.equal(diff[0].rapidapiValue, 450000);
  assert.equal(diff[0].scrapeDoValue, 300000);
  assert.equal(diff[0].reason, 'value_mismatch');
});

test('diffFields — numeric strings normalize to numbers and match', () => {
  // Same logical price, different stringification; should be treated as parity.
  const diff = diffFields({ price: '450000' }, { price: 450000 });
  assert.deepEqual(diff, []);
});

test('diffFields — numbers within 1% are considered parity (drift tolerance)', () => {
  // zestimate often drifts between scrape times — small drift should not
  // count as a real divergence.
  const diff = diffFields({ zestimate: 500000 }, { zestimate: 504000 });
  assert.deepEqual(diff, []);
  // But >1% drift IS flagged.
  const big = diffFields({ zestimate: 500000 }, { zestimate: 600000 });
  assert.equal(big.length, 1);
  assert.equal(big[0].field, 'zestimate');
});

test('diffFields — missing on one side is flagged with the correct reason', () => {
  const diff = diffFields({ zpid: '1', price: 100 }, { zpid: '1' });
  assert.equal(diff.length, 1);
  assert.equal(diff[0].field, 'price');
  assert.equal(diff[0].reason, 'missing_in_scrapedo');

  const diff2 = diffFields({ zpid: '1' }, { zpid: '1', livingArea: 1800 });
  assert.equal(diff2.length, 1);
  assert.equal(diff2[0].field, 'livingArea');
  assert.equal(diff2[0].reason, 'missing_in_rapidapi');
});

test('diffFields — both sides missing the field is NOT a discrepancy', () => {
  // Neither backend returned `lotSize`; we shouldn't count that as a diff.
  const diff = diffFields({ zpid: '1' }, { zpid: '1' });
  assert.deepEqual(diff, []);
});

test('diffFields — pulls fields from common nested shapes', () => {
  // RapidAPI nests under `property`; scrape.do returns flat.
  const a = { property: { zpid: '999', price: 250000 } };
  const b = { zpid: '999', price: 250000 };
  assert.deepEqual(diffFields(a, b), []);
});

test('valuesMatch — case-insensitive string comparison', () => {
  assert.equal(valuesMatch('SINGLE_FAMILY', 'single_family'), true);
  assert.equal(valuesMatch('FOR_SALE', 'SOLD'), false);
});

test('percentile — handles empty arrays and single values', () => {
  assert.equal(percentile([], 50), null);
  assert.equal(percentile([42], 50), 42);
  assert.equal(percentile([1, 2, 3, 4, 5], 50), 3);
});

test('aggregate — counts successes, failures, latency, per-field parity', () => {
  const rows = [
    {
      input: { address: 'A' },
      rapidapi: { ok: true, ms: 100 },
      scrapeDo: { ok: true, ms: 200 },
      diff: [],
    },
    {
      input: { address: 'B' },
      rapidapi: { ok: true, ms: 300 },
      scrapeDo: { ok: true, ms: 400 },
      diff: [{ field: 'price', reason: 'value_mismatch' }],
    },
    {
      input: { address: 'C' },
      rapidapi: { ok: false, ms: 50 },
      scrapeDo: { ok: false, ms: 60 },
      diff: [],
    },
  ];
  const s = aggregate(rows, CANONICAL_FIELDS);
  assert.equal(s.totalRows, 3);
  assert.equal(s.rapidapiSuccessCount, 2);
  assert.equal(s.scrapeDoSuccessCount, 2);
  assert.equal(s.bothSucceededCount, 2);
  assert.equal(s.bothFailedCount, 1);
  // price diverged on 1 of 2 eligible rows → 0.5
  assert.equal(s.perFieldParityRate.price, 0.5);
  // zpid never diverged → 1.0
  assert.equal(s.perFieldParityRate.zpid, 1);
  // latency percentiles populated
  assert.ok(typeof s.p50Ms.rapidapi === 'number');
  assert.ok(typeof s.p95Ms.scrapeDo === 'number');
});

test('rowOutcomeSentence — formats each outcome variant', () => {
  const both = rowOutcomeSentence({
    input: { address: '1 Main' },
    rapidapi: { ok: true }, scrapeDo: { ok: true }, diff: [],
  });
  assert.ok(both.startsWith('✓ 1 Main'));
  assert.ok(both.includes('all fields match'));

  const partial = rowOutcomeSentence({
    input: { address: '2 Oak' },
    rapidapi: { ok: true }, scrapeDo: { ok: true },
    diff: [{ field: 'schools', reason: 'missing_in_scrapedo' }],
  });
  assert.ok(partial.startsWith('△ 2 Oak'));
  assert.ok(partial.includes('scrape.do missing schools'));

  const fail = rowOutcomeSentence({
    input: { address: '3 Pine' },
    rapidapi: { ok: false, status: 502 }, scrapeDo: { ok: true }, diff: [],
  });
  assert.ok(fail.startsWith('✗ 3 Pine'));
  assert.ok(fail.includes('rapidapi 502'));
  assert.ok(fail.includes('scrape.do succeeded'));
});
