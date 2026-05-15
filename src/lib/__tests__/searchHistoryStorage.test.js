// Unit tests for the pure search-history storage module. Uses node:test +
// a minimal in-memory Storage stub so we don't need jsdom — matches the
// repo's existing test pattern (auth-coherence, auction-detection,
// comps-similarity, comps-location-parser, brand-flags).
//
// Run:
//   node --test src/lib/__tests__/searchHistoryStorage.test.js

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SEARCH_HISTORY_MAX,
  clearHistory,
  hashParams,
  pushEntry,
  readHistory,
  removeEntry,
  storageKey,
  writeHistory,
} from '../searchHistoryStorage.js';

function makeStorage() {
  const map = new Map();
  return {
    _map: map,
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => { map.set(k, String(v)); },
    removeItem: (k) => { map.delete(k); },
    clear: () => { map.clear(); },
    get length() { return map.size; },
    key: (i) => Array.from(map.keys())[i] ?? null,
  };
}

function entry({ id = 'a', label = 'Test', params = {}, timestamp = 1, resultCount } = {}) {
  return { id, label, params, timestamp, ...(resultCount !== undefined ? { resultCount } : {}) };
}

test('storageKey isolates on-market and off-market', () => {
  assert.notEqual(storageKey('on-market'), storageKey('off-market'));
  assert.match(storageKey('on-market'), /on-market/);
  assert.match(storageKey('off-market'), /off-market/);
});

test('readHistory returns [] when key is missing', () => {
  const s = makeStorage();
  assert.deepEqual(readHistory(s, 'on-market'), []);
});

test('readHistory returns [] when stored value is malformed JSON', () => {
  const s = makeStorage();
  s.setItem(storageKey('on-market'), 'not-json{');
  assert.deepEqual(readHistory(s, 'on-market'), []);
});

test('readHistory filters out malformed entries', () => {
  const s = makeStorage();
  const good = entry({ id: 'g', label: 'L', timestamp: 1 });
  const garbage = [good, null, 'string', { id: 'x' /* no label, no ts */ }, { id: 1, label: 2, timestamp: 'no' }];
  s.setItem(storageKey('on-market'), JSON.stringify(garbage));
  const out = readHistory(s, 'on-market');
  assert.equal(out.length, 1);
  assert.equal(out[0].id, 'g');
});

test('writeHistory + readHistory round-trip', () => {
  const s = makeStorage();
  const entries = [entry({ id: '1' }), entry({ id: '2' })];
  writeHistory(s, 'on-market', entries);
  assert.deepEqual(readHistory(s, 'on-market'), entries);
});

test('writeHistory swallows quota errors', () => {
  const broken = {
    getItem: () => null,
    setItem: () => { throw new Error('quota'); },
    removeItem: () => {},
    get length() { return 0; },
    key: () => null,
  };
  // Must not throw.
  writeHistory(broken, 'on-market', [entry()]);
});

test('pushEntry prepends new entries and caps to SEARCH_HISTORY_MAX (4)', () => {
  let arr = [];
  for (let i = 0; i < 10; i += 1) {
    arr = pushEntry(arr, entry({ id: `e${i}`, timestamp: i }));
  }
  assert.equal(arr.length, SEARCH_HISTORY_MAX);
  // Most recent first.
  assert.equal(arr[0].id, 'e9');
  assert.equal(arr[1].id, 'e8');
  assert.equal(arr[2].id, 'e7');
  assert.equal(arr[3].id, 'e6');
});

test('pushEntry dedupes by id — repeated push moves entry to head, no growth', () => {
  let arr = [entry({ id: 'a', timestamp: 1 }), entry({ id: 'b', timestamp: 2 })];
  arr = pushEntry(arr, entry({ id: 'a', timestamp: 3 }));
  assert.equal(arr.length, 2);
  assert.equal(arr[0].id, 'a');
  assert.equal(arr[0].timestamp, 3);
  assert.equal(arr[1].id, 'b');
});

test('pushEntry respects custom max override', () => {
  let arr = [];
  for (let i = 0; i < 5; i += 1) arr = pushEntry(arr, entry({ id: `e${i}`, timestamp: i }), 2);
  assert.equal(arr.length, 2);
  assert.equal(arr[0].id, 'e4');
  assert.equal(arr[1].id, 'e3');
});

test('pushEntry clamps max to at least 1', () => {
  const arr = pushEntry([], entry({ id: 'a' }), 0);
  assert.equal(arr.length, 1);
});

test('removeEntry strips matching id, leaves rest', () => {
  const arr = [entry({ id: 'a' }), entry({ id: 'b' }), entry({ id: 'c' })];
  const out = removeEntry(arr, 'b');
  assert.equal(out.length, 2);
  assert.deepEqual(out.map((e) => e.id), ['a', 'c']);
});

test('removeEntry is a no-op for unknown id', () => {
  const arr = [entry({ id: 'a' })];
  const out = removeEntry(arr, 'zzz');
  assert.deepEqual(out.map((e) => e.id), ['a']);
});

test('clearHistory removes the mode-scoped key only', () => {
  const s = makeStorage();
  writeHistory(s, 'on-market', [entry()]);
  writeHistory(s, 'off-market', [entry({ id: 'om' })]);
  clearHistory(s, 'on-market');
  assert.deepEqual(readHistory(s, 'on-market'), []);
  assert.equal(readHistory(s, 'off-market').length, 1);
});

test('hashParams is deterministic for the same input', () => {
  const a = hashParams({ location: 'Detroit, MI', price_min: '100000' });
  const b = hashParams({ location: 'Detroit, MI', price_min: '100000' });
  assert.equal(a, b);
});

test('hashParams treats reordered keys as equal', () => {
  const a = hashParams({ a: 1, b: 2, c: 3 });
  const b = hashParams({ c: 3, a: 1, b: 2 });
  assert.equal(a, b);
});

test('hashParams differs when values differ', () => {
  const a = hashParams({ location: 'Detroit' });
  const b = hashParams({ location: 'Chicago' });
  assert.notEqual(a, b);
});

test('hashParams ignores undefined values for dedupe stability', () => {
  const a = hashParams({ location: 'X', price_min: undefined });
  const b = hashParams({ location: 'X' });
  assert.equal(a, b);
});

test('hashParams handles arrays of primitives', () => {
  const a = hashParams({ leadTypes: ['absentee', 'preforeclosure'] });
  const b = hashParams({ leadTypes: ['absentee', 'preforeclosure'] });
  const c = hashParams({ leadTypes: ['preforeclosure', 'absentee'] });
  assert.equal(a, b);
  // Arrays preserve order — different order, different hash.
  assert.notEqual(a, c);
});

test('on-market and off-market histories are isolated end-to-end', () => {
  const s = makeStorage();
  writeHistory(s, 'on-market', [entry({ id: 'on1', label: 'On' })]);
  writeHistory(s, 'off-market', [entry({ id: 'off1', label: 'Off' })]);
  const on = readHistory(s, 'on-market');
  const off = readHistory(s, 'off-market');
  assert.equal(on.length, 1);
  assert.equal(off.length, 1);
  assert.equal(on[0].label, 'On');
  assert.equal(off[0].label, 'Off');
});
