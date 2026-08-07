#!/usr/bin/env node
/**
 * Tests for google-suggest.js — node:test, no external deps.
 * Run: node scripts/google-ads-setup/google-suggest.test.js
 */
const test = require('node:test');
const assert = require('node:assert/strict');

const {
  parseSuggestResponse,
  buildAlphabetQueries,
  buildModifierQueries,
  dedupeSuggestions,
  isExpansion,
  toCsv,
} = require('./google-suggest.js');

test('parseSuggestResponse extracts suggestions array from Google Suggest JSON', () => {
  const raw = JSON.stringify([
    'wholesale real estate',
    [
      'wholesale real estate investing',
      'wholesale real estate near me',
      'wholesale real estate for beginners',
    ],
  ]);
  assert.deepEqual(parseSuggestResponse(raw), [
    'wholesale real estate investing',
    'wholesale real estate near me',
    'wholesale real estate for beginners',
  ]);
});

test('parseSuggestResponse returns [] for malformed payloads', () => {
  assert.deepEqual(parseSuggestResponse(''), []);
  assert.deepEqual(parseSuggestResponse('not json'), []);
  assert.deepEqual(parseSuggestResponse('{}'), []);
  assert.deepEqual(parseSuggestResponse('[]'), []);
  assert.deepEqual(parseSuggestResponse('["seed"]'), []);
});

test('buildAlphabetQueries appends each letter after the seed', () => {
  const out = buildAlphabetQueries('subject to');
  assert.equal(out.length, 26);
  assert.equal(out[0], 'subject to a');
  assert.equal(out[25], 'subject to z');
});

test('buildModifierQueries returns question + prep + comparison variants', () => {
  const out = buildModifierQueries('brrrr');
  assert.ok(out.includes('how to brrrr'));
  assert.ok(out.includes('what is brrrr'));
  assert.ok(out.includes('brrrr vs'));
  assert.ok(out.includes('brrrr for'));
  assert.ok(out.includes('brrrr without'));
  // No duplicates
  assert.equal(out.length, new Set(out).size);
});

test('dedupeSuggestions lowercases, trims, and removes duplicates', () => {
  const out = dedupeSuggestions([
    ['Wholesale Real Estate', 'wholesale real estate'],
    [' wholesale real estate ', 'BRRRR Method', 'brrrr method'],
  ]);
  assert.deepEqual(out.sort(), ['brrrr method', 'wholesale real estate']);
});

test('isExpansion rejects suggestions that are just the seed', () => {
  assert.equal(isExpansion('wholesale real estate', 'wholesale real estate'), false);
  assert.equal(isExpansion('Wholesale Real Estate', 'wholesale real estate'), false);
  assert.equal(isExpansion('wholesale real estate near me', 'wholesale real estate'), true);
});

test('toCsv produces RFC-4180 quoted output with seed + suggestion + modifier', () => {
  const rows = [
    { seed: 'brrrr', suggestion: 'brrrr method', modifier: '' },
    { seed: 'brrrr', suggestion: 'brrrr, explained', modifier: 'how to' },
  ];
  const csv = toCsv(rows);
  const lines = csv.trim().split('\n');
  assert.equal(lines[0], 'seed,suggestion,modifier');
  assert.equal(lines[1], 'brrrr,brrrr method,');
  // commas inside fields must be quoted
  assert.equal(lines[2], 'brrrr,"brrrr, explained",how to');
});
