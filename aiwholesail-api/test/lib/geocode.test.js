/**
 * Unit tests for the geocode helpers — backs the off-market heatmap (Phase 7).
 *
 * Pure logic (normalizeAddress, addressHash) is tested directly.
 * geocodeMany is tested with stub DB + stub fetcher so we don't touch
 * Postgres or RapidAPI from a unit test.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeAddress, addressHash, geocodeMany } = require('../../lib/geocode');

test('normalizeAddress', async (t) => {
  await t.test('joins street + city + zip with single spaces', () => {
    assert.equal(
      normalizeAddress({ street: '123 Main St', city: 'Atlanta', zip: '30303' }),
      '123 main st atlanta 30303'
    );
  });

  await t.test('lowercases all parts', () => {
    assert.equal(
      normalizeAddress({ street: '17888 ARBOR GREENE DR', city: 'TAMPA', zip: '33647' }),
      '17888 arbor greene dr tampa 33647'
    );
  });

  await t.test('trims surrounding whitespace on each part', () => {
    assert.equal(
      normalizeAddress({ street: '  123 Main  ', city: '  Tampa  ', zip: '  33647  ' }),
      '123 main tampa 33647'
    );
  });

  await t.test('collapses internal whitespace', () => {
    assert.equal(
      normalizeAddress({ street: '123   Main   St', city: 'Tampa', zip: '33647' }),
      '123 main st tampa 33647'
    );
  });

  await t.test('strips +4 suffix on 9-digit ZIP', () => {
    assert.equal(
      normalizeAddress({ street: '123 Main', city: 'Tampa', zip: '33647-1234' }),
      '123 main tampa 33647'
    );
  });

  await t.test('accepts numeric zip', () => {
    assert.equal(
      normalizeAddress({ street: '123 Main', city: 'Tampa', zip: 33647 }),
      '123 main tampa 33647'
    );
  });

  await t.test('returns empty string for null/undefined input', () => {
    assert.equal(normalizeAddress(null), '');
    assert.equal(normalizeAddress(undefined), '');
    assert.equal(normalizeAddress({}), '');
  });

  await t.test('returns empty string when all parts missing', () => {
    assert.equal(normalizeAddress({ street: null, city: null, zip: null }), '');
  });

  await t.test('survives missing city (street + zip is enough)', () => {
    assert.equal(
      normalizeAddress({ street: '123 Main', zip: '33647' }),
      '123 main 33647'
    );
  });
});

test('addressHash', async (t) => {
  await t.test('produces a 64-char hex string', () => {
    const h = addressHash({ street: '123 Main', city: 'Tampa', zip: '33647' });
    assert.equal(h.length, 64);
    assert.match(h, /^[0-9a-f]{64}$/);
  });

  await t.test('is stable across casing variation', () => {
    const a = addressHash({ street: '123 Main St', city: 'Tampa', zip: '33647' });
    const b = addressHash({ street: '123 MAIN ST', city: 'TAMPA', zip: '33647' });
    assert.equal(a, b);
  });

  await t.test('is stable across whitespace variation', () => {
    const a = addressHash({ street: '123 Main St', city: 'Tampa', zip: '33647' });
    const b = addressHash({ street: '  123  Main  St  ', city: ' Tampa ', zip: ' 33647 ' });
    assert.equal(a, b);
  });

  await t.test('differs for different addresses', () => {
    const a = addressHash({ street: '123 Main', city: 'Tampa', zip: '33647' });
    const b = addressHash({ street: '124 Main', city: 'Tampa', zip: '33647' });
    assert.notEqual(a, b);
  });

  await t.test('returns empty string when no usable address', () => {
    assert.equal(addressHash(null), '');
    assert.equal(addressHash({}), '');
  });
});

test('geocodeMany', async (t) => {
  // Helper — build a stub DB whose query returns the rows we configure.
  function stubDb(rowsByQuery = {}) {
    const writes = [];
    return {
      writes,
      query: async (sql, params) => {
        if (sql.includes('SELECT') && sql.includes('geocode_cache')) {
          // First call — bulk cache lookup
          const wanted = new Set(params[0]);
          const rows = (rowsByQuery.cached || []).filter(r => wanted.has(r.address_hash));
          return { rows };
        }
        if (sql.includes('INSERT INTO geocode_cache')) {
          writes.push(params);
          return { rows: [] };
        }
        return { rows: [] };
      },
    };
  }

  await t.test('empty array returns zero counts', async () => {
    const db = stubDb();
    const result = await geocodeMany([], db, async () => null);
    assert.deepEqual(result, { hits: 0, misses: 0, failed: 0 });
  });

  await t.test('non-array input returns zero counts', async () => {
    const db = stubDb();
    const result = await geocodeMany(null, db, async () => null);
    assert.deepEqual(result, { hits: 0, misses: 0, failed: 0 });
  });

  await t.test('all-cache-hit path: no fetcher calls', async () => {
    const records = [
      { address: { street: '123 Main', city: 'Tampa', zip: '33647' } },
      { address: { street: '456 Oak', city: 'Tampa', zip: '33647' } },
    ];
    const hashes = records.map(r => addressHash(r.address));
    const db = stubDb({
      cached: [
        { address_hash: hashes[0], latitude: '28.0', longitude: '-82.5' },
        { address_hash: hashes[1], latitude: '28.1', longitude: '-82.6' },
      ],
    });
    let fetcherCalls = 0;
    const fetcher = async () => { fetcherCalls++; return null; };
    const result = await geocodeMany(records, db, fetcher);

    assert.equal(result.hits, 2);
    assert.equal(result.misses, 0);
    assert.equal(result.failed, 0);
    assert.equal(fetcherCalls, 0);   // No upstream calls when fully cached
    assert.equal(records[0].lat, 28.0);
    assert.equal(records[0].lng, -82.5);
    assert.equal(records[1].lat, 28.1);
    assert.equal(records[1].lng, -82.6);
  });

  await t.test('all-cache-miss path: fetcher called, results written', async () => {
    const records = [
      { address: { street: '123 Main', city: 'Tampa', zip: '33647' } },
    ];
    const db = stubDb({ cached: [] });
    const fetcher = async () => ({ lat: 28.0, lng: -82.5, formatted_address: 'normalized' });
    const result = await geocodeMany(records, db, fetcher);

    assert.equal(result.hits, 0);
    assert.equal(result.misses, 1);
    assert.equal(result.failed, 0);
    assert.equal(records[0].lat, 28.0);
    assert.equal(records[0].lng, -82.5);
    // Cache write fires (fire-and-forget; we don't await it but its
    // params should still hit the stub since the call was scheduled).
    await new Promise(r => setImmediate(r));
    assert.equal(db.writes.length, 1, 'should have queued a cache write');
  });

  await t.test('duplicate addresses share a single fetch', async () => {
    // Two records at the same address (e.g. multi-unit). The fetcher
    // should fire once; both records get the same coords.
    const sameAddr = { street: '500 Tower St', city: 'Tampa', zip: '33647' };
    const records = [
      { id: 'A', address: { ...sameAddr } },
      { id: 'B', address: { ...sameAddr } },
    ];
    const db = stubDb({ cached: [] });
    let fetcherCalls = 0;
    const fetcher = async () => { fetcherCalls++; return { lat: 28.0, lng: -82.5 }; };
    const result = await geocodeMany(records, db, fetcher);

    assert.equal(fetcherCalls, 1, 'one address → one upstream call');
    assert.equal(result.misses, 1);
    assert.equal(records[0].lat, 28.0);
    assert.equal(records[1].lat, 28.0);
  });

  await t.test('mixed hit/miss splits the counts correctly', async () => {
    const records = [
      { address: { street: '123 Main', city: 'Tampa', zip: '33647' } },  // cached
      { address: { street: '456 Oak', city: 'Tampa', zip: '33647' } },   // miss
    ];
    const hashes = records.map(r => addressHash(r.address));
    const db = stubDb({
      cached: [
        { address_hash: hashes[0], latitude: '28.0', longitude: '-82.5' },
      ],
    });
    const fetcher = async () => ({ lat: 28.1, lng: -82.6 });
    const result = await geocodeMany(records, db, fetcher);

    assert.equal(result.hits, 1);
    assert.equal(result.misses, 1);
    assert.equal(records[0].lat, 28.0);    // from cache
    assert.equal(records[1].lat, 28.1);    // from fetcher
  });

  await t.test('records without an address are counted as failed', async () => {
    const records = [
      { address: null },
      { /* no address at all */ },
    ];
    const db = stubDb();
    const fetcher = async () => null;
    const result = await geocodeMany(records, db, fetcher);
    assert.equal(result.hits, 0);
    assert.equal(result.misses, 0);
    assert.equal(result.failed, 2);
  });

  await t.test('fetcher returning null counts as failed', async () => {
    const records = [
      { address: { street: '123 Main', city: 'Tampa', zip: '33647' } },
    ];
    const db = stubDb({ cached: [] });
    const fetcher = async () => null;  // Geocoder couldn't resolve
    const result = await geocodeMany(records, db, fetcher);
    assert.equal(result.failed, 1);
    assert.equal(records[0].lat, undefined);
  });

  await t.test('fetcher throwing is caught and counted as failed', async () => {
    const records = [
      { address: { street: '123 Main', city: 'Tampa', zip: '33647' } },
    ];
    const db = stubDb({ cached: [] });
    const fetcher = async () => { throw new Error('upstream 500'); };
    const result = await geocodeMany(records, db, fetcher);
    assert.equal(result.failed, 1);
  });
});
