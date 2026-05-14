// Tests for the comps-fallback location parser used by
// ZillowAPI.getPropertyComps when the direct `comps` endpoint returns nothing
// and we fall back to a recently-sold search. The parser pulls out a ZIP
// and a "City STATE" query string from arbitrary location strings.
//
// Why this exists (rework of stale PR #92, May 2026):
//   On main today, multi-word cities in 3-part comma-separated input
//   ("Saint Augustine, FL, 32092") are parsed as cityState="FL", which
//   makes the search expand to the entire state of Florida instead of
//   the actual city. The 2-part format ("City, ST ZIP") works correctly.
//   This parser fixes the 3-part case while preserving every other format.
//
// Plain JS / ESM so node:test can run without a transpiler — matches
// the comps-similarity.js pattern from PR #371.
//
// Run:
//   node --test src/lib/__tests__/comps-location-parser.test.js

import test from 'node:test';
import assert from 'node:assert/strict';
import { parseCompsLocation } from '../comps-location-parser.js';

test('2-part "City, ST ZIP" — current main behavior preserved', () => {
  const r = parseCompsLocation('Charlotte, NC 28083');
  assert.equal(r.zip, '28083');
  assert.equal(r.cityState, 'Charlotte NC');
});

test('3-part "City, State, ZIP" — multi-word city, the #92 bug', () => {
  // PRE-FIX: cityState was "FL" (just the state) because the parser took
  // parts[length-1] as state-with-digits and parts[length-2] as city.
  // POST-FIX: cityState must be "Saint Augustine FL" so the fallback
  // search hits the actual city, not the whole state.
  const r = parseCompsLocation('Saint Augustine, FL, 32092');
  assert.equal(r.zip, '32092');
  assert.equal(r.cityState, 'Saint Augustine FL');
});

test('3-part "City, State, ZIP" — single-word city', () => {
  const r = parseCompsLocation('Charlotte, NC, 28083');
  assert.equal(r.zip, '28083');
  assert.equal(r.cityState, 'Charlotte NC');
});

test('3-part with ZIP+4', () => {
  const r = parseCompsLocation('Saint Augustine, FL, 32092-1234');
  assert.equal(r.zip, '32092');
  assert.equal(r.cityState, 'Saint Augustine FL');
});

test('2-part "City, State" — no ZIP', () => {
  const r = parseCompsLocation('Asheville, NC');
  assert.equal(r.zip, null);
  assert.equal(r.cityState, 'Asheville NC');
});

test('bare ZIP only', () => {
  const r = parseCompsLocation('28083');
  assert.equal(r.zip, '28083');
  assert.equal(r.cityState, null);
});

test('single-segment "City State ZIP" (no commas)', () => {
  // Real-world: users sometimes type without commas. Parser should still
  // extract the ZIP. cityState may be null (we can't reliably split city
  // from state without the comma) — that's acceptable; ZIP is the
  // strongest signal anyway per the existing comment.
  const r = parseCompsLocation('Charlotte NC 28083');
  assert.equal(r.zip, '28083');
});

test('whitespace + trailing comma robustness', () => {
  const r = parseCompsLocation('  Saint Augustine ,  FL ,  32092 , ');
  assert.equal(r.zip, '32092');
  assert.equal(r.cityState, 'Saint Augustine FL');
});

test('null / empty / non-string input returns empty result, does not throw', () => {
  for (const input of [null, undefined, '', '   ', 42, {}]) {
    const r = parseCompsLocation(input);
    assert.equal(r.zip, null, `zip should be null for ${JSON.stringify(input)}`);
    assert.equal(r.cityState, null, `cityState should be null for ${JSON.stringify(input)}`);
  }
});

test('queries array prefers ZIP, then cityState, then raw — none falsy, deduped', () => {
  // The queries field captures the same priority logic used in
  // getPropertyComps' fallback. ZIP first (tightest), then cityState
  // (city scope), then raw location (last resort). Falsy entries
  // (null, "") are filtered out so the search loop doesn't waste a
  // round-trip on an empty query.
  //
  // Deduping prevents wasted scrape.do round-trips when two priority
  // tiers resolve to the same string (e.g. bare ZIP input where
  // queries[0]=zip and queries[2]=raw are both "28083"). Pre-fix this
  // emitted ["28083", "28083"] and the fallback loop hit scrape.do
  // twice; post-fix it's a single query.
  const r = parseCompsLocation('Saint Augustine, FL, 32092');
  assert.deepEqual(r.queries, ['32092', 'Saint Augustine FL', 'Saint Augustine, FL, 32092']);

  const r2 = parseCompsLocation('28083');
  assert.deepEqual(r2.queries, ['28083'], 'bare ZIP must not duplicate when raw == zip');

  const r3 = parseCompsLocation('Asheville, NC');
  assert.deepEqual(r3.queries, ['Asheville NC', 'Asheville, NC']);
});

test('4-part address-style "Street, City, ST, ZIP" — preserved (city scoping)', () => {
  // Real-world: users paste a full address. Current parser correctly
  // takes parts[length-3] as city, parts[length-2] as state, ignoring
  // the leading street segment. cityState scopes the fallback search
  // to the actual city, not the street.
  const r = parseCompsLocation('123 Main St, Saint Augustine, FL, 32092');
  assert.equal(r.zip, '32092');
  assert.equal(r.cityState, 'Saint Augustine FL');
});

test('4-part with unit prefix "Unit 4B, City, ST, ZIP" — preserved', () => {
  const r = parseCompsLocation('Unit 4B, Saint Augustine, FL, 32092');
  assert.equal(r.zip, '32092');
  assert.equal(r.cityState, 'Saint Augustine FL');
});

test('4-part verbose-state "City, FullStateName, ST, ZIP" — known limitation, documents current behavior', () => {
  // KNOWN LIMITATION: when a user types both the spelled-out state AND
  // the abbreviation, our parser takes the spelled-out state as the
  // "city" because it sits at parts[length-3]. Example:
  //   "Saint Augustine, Florida, FL, 32092" → cityState="Florida FL"
  //
  // Fixing this requires distinguishing "Florida" (full state name) from
  // "Saint Augustine" (multi-word city) — which needs a US state-name
  // lookup table that's bigger than this parser's scope.
  //
  // The narrower "cityIdx = 0" fix suggested in code review of #380 was
  // rejected because it would REGRESS the 4-part address-style case
  // (123 Main St, City, ST, ZIP would scope by "123 Main St" instead of
  // the actual city). We accept the verbose-state misparse as a known
  // limitation; the failure mode is "search scopes to whole state"
  // which is still better than "search returns no results."
  //
  // If someone implements the state-name lookup, this test asserts
  // the desired new behavior — flip it from documenting-current to
  // asserting-fixed at that time.
  const r = parseCompsLocation('Saint Augustine, Florida, FL, 32092');
  assert.equal(r.zip, '32092');
  assert.equal(
    r.cityState,
    'Florida FL',
    'KNOWN LIMITATION: verbose-state 4-part scopes by state name, not city. ' +
    'Fix requires US-state-name lookup. See PR #380 review thread.'
  );
});

test('function is pure: same input always returns same output', () => {
  const a = parseCompsLocation('Saint Augustine, FL, 32092');
  const b = parseCompsLocation('Saint Augustine, FL, 32092');
  assert.deepEqual(a, b);
});
