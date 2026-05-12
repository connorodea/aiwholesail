/**
 * Unit tests for mapCachedRowToProperty + validateZpid — the pure logic
 * behind GET /api/property/by-zpid (the email deep-link endpoint).
 *
 * Bugs here break the email→listing click-through, which is the
 * conversion-bottleneck per the 2026-05-12 funnel audit. Lives next to
 * tier-resolver.test.js and runs under built-in node:test (Node ≥ 18,
 * zero external deps).
 *
 *   $ npm test
 *   $ node --test test/lib/property-mapper.test.js
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const { mapCachedRowToProperty, validateZpid } = require('../../lib/property-mapper');

test('mapCachedRowToProperty', async (t) => {

  // ─── Null / empty inputs ──────────────────────────────────────────────
  await t.test('returns null for null', () => {
    assert.equal(mapCachedRowToProperty(null), null);
  });

  await t.test('returns null for undefined', () => {
    assert.equal(mapCachedRowToProperty(undefined), null);
  });

  await t.test('returns null for non-object', () => {
    assert.equal(mapCachedRowToProperty('123'), null);
    assert.equal(mapCachedRowToProperty(42), null);
  });

  // ─── Happy path ───────────────────────────────────────────────────────
  await t.test('maps a fully-populated row', () => {
    const row = {
      zpid: '12345678',
      address: '123 Main St, Atlanta, GA 30303',
      price: '350000',
      zestimate: '420000',
      bedrooms: 3,
      bathrooms: '2.5',
      sqft: 1540,
      property_type: 'SingleFamily',
      days_on_market: 12,
      listing_url: 'https://www.zillow.com/homedetails/12345678_zpid/',
      image_url: 'https://photos.zillowstatic.com/fp/sample.webp',
    };
    const p = mapCachedRowToProperty(row);
    assert.equal(p.id, '12345678');
    assert.equal(p.zpid, '12345678');
    assert.equal(p.address, '123 Main St, Atlanta, GA 30303');
    assert.equal(p.price, 350000);            // NUMERIC string → number
    assert.equal(p.zestimate, 420000);
    assert.equal(p.bedrooms, 3);
    assert.equal(p.bathrooms, 2.5);           // NUMERIC string → float
    assert.equal(p.sqft, 1540);
    assert.equal(p.propertyType, 'SingleFamily');
    assert.equal(p.daysOnMarket, 12);
    assert.equal(p.status, 'forSale');
    assert.deepEqual(p.images, ['https://photos.zillowstatic.com/fp/sample.webp']);
  });

  // ─── Nullable columns ─────────────────────────────────────────────────
  await t.test('NULL bedrooms maps to undefined, not 0', () => {
    // Critical: 0 bedrooms would render as "0 bd" in the UI; undefined hides.
    const p = mapCachedRowToProperty({ zpid: '1', address: 'x', price: 100, bedrooms: null });
    assert.equal(p.bedrooms, undefined);
  });

  await t.test('NULL bathrooms maps to undefined', () => {
    const p = mapCachedRowToProperty({ zpid: '1', address: 'x', price: 100, bathrooms: null });
    assert.equal(p.bathrooms, undefined);
  });

  await t.test('NULL sqft maps to undefined', () => {
    const p = mapCachedRowToProperty({ zpid: '1', address: 'x', price: 100, sqft: null });
    assert.equal(p.sqft, undefined);
  });

  await t.test('NULL zestimate maps to undefined', () => {
    const p = mapCachedRowToProperty({ zpid: '1', address: 'x', price: 100, zestimate: null });
    assert.equal(p.zestimate, undefined);
  });

  await t.test('NULL property_type maps to undefined', () => {
    const p = mapCachedRowToProperty({ zpid: '1', address: 'x', price: 100, property_type: null });
    assert.equal(p.propertyType, undefined);
  });

  await t.test('NULL days_on_market maps to undefined', () => {
    const p = mapCachedRowToProperty({ zpid: '1', address: 'x', price: 100, days_on_market: null });
    assert.equal(p.daysOnMarket, undefined);
  });

  await t.test('NULL address maps to empty string', () => {
    const p = mapCachedRowToProperty({ zpid: '1', address: null, price: 100 });
    assert.equal(p.address, '');
  });

  await t.test('NULL price maps to 0', () => {
    const p = mapCachedRowToProperty({ zpid: '1', address: 'x', price: null });
    assert.equal(p.price, 0);
  });

  // ─── image_url edge cases ─────────────────────────────────────────────
  await t.test('NULL image_url produces empty images array', () => {
    const p = mapCachedRowToProperty({ zpid: '1', address: 'x', price: 100, image_url: null });
    assert.deepEqual(p.images, []);
  });

  await t.test('empty string image_url produces empty images array', () => {
    const p = mapCachedRowToProperty({ zpid: '1', address: 'x', price: 100, image_url: '' });
    assert.deepEqual(p.images, []);
  });

  await t.test('single image_url becomes array of one', () => {
    const p = mapCachedRowToProperty({ zpid: '1', address: 'x', price: 100, image_url: 'https://x.com/a.jpg' });
    assert.deepEqual(p.images, ['https://x.com/a.jpg']);
  });

  // ─── Status defaulting ────────────────────────────────────────────────
  await t.test('status always defaults to forSale', () => {
    // Cache currently only holds active listings; if the row schema ever
    // adds a status column, this test will flag the day we need to plumb it.
    const p = mapCachedRowToProperty({ zpid: '1', address: 'x', price: 100 });
    assert.equal(p.status, 'forSale');
  });
});

test('validateZpid', async (t) => {

  await t.test('accepts a typical Zillow numeric zpid', () => {
    assert.equal(validateZpid('12345678'), '12345678');
  });

  await t.test('accepts a 20-digit zpid (upper bound)', () => {
    const long = '1'.repeat(20);
    assert.equal(validateZpid(long), long);
  });

  await t.test('trims surrounding whitespace', () => {
    assert.equal(validateZpid('  12345  '), '12345');
  });

  await t.test('rejects non-string input', () => {
    assert.equal(validateZpid(12345), null);   // number, not string
    assert.equal(validateZpid(null), null);
    assert.equal(validateZpid(undefined), null);
    assert.equal(validateZpid({}), null);
  });

  await t.test('rejects empty string', () => {
    assert.equal(validateZpid(''), null);
  });

  await t.test('rejects whitespace-only string', () => {
    assert.equal(validateZpid('   '), null);
  });

  await t.test('rejects non-digit characters', () => {
    assert.equal(validateZpid('12a34'), null);
    assert.equal(validateZpid('12.34'), null);  // no decimals
    assert.equal(validateZpid('-12345'), null); // no signs
    assert.equal(validateZpid('1 2 3'), null);  // no spaces inside
  });

  await t.test('rejects SQL-injection-shaped input', () => {
    // Even though the call site uses parameterized SQL, defense in depth.
    assert.equal(validateZpid("1' OR '1'='1"), null);
    assert.equal(validateZpid('1; DROP TABLE property_search_cache;'), null);
  });

  await t.test('rejects path-traversal-shaped input', () => {
    assert.equal(validateZpid('../../etc/passwd'), null);
  });

  await t.test('rejects over-long input (21+ digits)', () => {
    assert.equal(validateZpid('1'.repeat(21)), null);
  });
});
