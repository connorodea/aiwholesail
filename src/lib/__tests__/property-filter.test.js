// Tests for filterByMaxDaysOnMarket — the "Listed within N days" search filter.
//
// Run:
//   node --test src/lib/__tests__/property-filter.test.js

import test from 'node:test';
import assert from 'node:assert/strict';
import { filterByMaxDaysOnMarket } from '../property-filter.js';

const make = (id, daysOnMarket) => ({ id, price: 100000, daysOnMarket });
const fresh = make('a', 3);
const recent = make('b', 12);
const stale = make('c', 95);
const ancient = make('d', 400);
const unknown = make('e', undefined);

test('returns input unchanged when maxDaysOnMarket is undefined', () => {
  const input = [fresh, stale, ancient];
  assert.equal(filterByMaxDaysOnMarket(input, undefined), input);
});

test('returns input unchanged when maxDaysOnMarket is "any"', () => {
  const input = [fresh, stale];
  assert.equal(filterByMaxDaysOnMarket(input, 'any'), input);
});

test('returns input unchanged when maxDaysOnMarket is empty string', () => {
  const input = [fresh, stale];
  assert.equal(filterByMaxDaysOnMarket(input, ''), input);
});

test('keeps properties at or below the threshold', () => {
  const out = filterByMaxDaysOnMarket([fresh, recent, stale, ancient], '14');
  assert.deepEqual(
    out.map((p) => p.id),
    ['a', 'b'],
  );
});

test('boundary: threshold equal to daysOnMarket is INCLUDED', () => {
  const onDay = make('exact', 14);
  const out = filterByMaxDaysOnMarket([onDay, stale], '14');
  assert.deepEqual(
    out.map((p) => p.id),
    ['exact'],
  );
});

test('excludes properties without a daysOnMarket value when filter is active', () => {
  // Missing-age listings are excluded — a user filtering for "listed within
  // 14 days" should not see unknowns mixed in.
  const out = filterByMaxDaysOnMarket([fresh, unknown], '14');
  assert.deepEqual(
    out.map((p) => p.id),
    ['a'],
  );
});

test('includes unknown-age properties when filter is INACTIVE', () => {
  // Counterpart to the previous test: when no filter is set, unknown-age
  // listings stay in the result set just like everything else.
  const out = filterByMaxDaysOnMarket([fresh, unknown, stale], undefined);
  assert.equal(out.length, 3);
});

test('treats non-numeric maxDaysOnMarket as "no filter"', () => {
  // Defensive — the field is a string in the search params and a corrupt
  // URL fragment ("?maxDaysOnMarket=garbage") shouldn't wipe the result set.
  const input = [fresh, stale, ancient];
  assert.equal(filterByMaxDaysOnMarket(input, 'garbage'), input);
});

test('treats zero or negative maxDaysOnMarket as "no filter"', () => {
  const input = [fresh, stale];
  assert.equal(filterByMaxDaysOnMarket(input, '0'), input);
  assert.equal(filterByMaxDaysOnMarket(input, '-7'), input);
});

test('does not mutate the input array', () => {
  const input = [fresh, stale, ancient];
  const snapshot = [...input];
  filterByMaxDaysOnMarket(input, '14');
  assert.deepEqual(input, snapshot);
});

test('returns empty array when nothing matches', () => {
  const out = filterByMaxDaysOnMarket([stale, ancient], '7');
  assert.deepEqual(out, []);
});
