// Tests for the scrape.do → spread-alert listing shape adapter.
//
// Pinned because the spread-alert worker writes its results into
// property_search_cache using the snake_case column names below — if a
// future refactor renames `beds` → `bedrooms` upstream (or drops a key),
// the worker would silently insert NULLs into the cache and every alert's
// dedup/match query would still pass min-spread but lose the metadata
// users see in the email (bed/bath counts, image, link).
//
// Run:
//   node --test aiwholesail-api/test/scripts/spread-alert-listing-map.test.js

const test = require('node:test');
const assert = require('node:assert/strict');
const { mapSummaryToListing } = require('../../lib/spread-alert-listing-map');

test('maps every field a scrape.do summary exposes onto the worker shape', () => {
  // Shape produced by lib/scrapers/zillowScrapeDo:mapListingToSummary.
  const summary = {
    zpid: '42188041',
    addressStreet: '4100 Poplar Ave',
    addressCity: 'Memphis',
    addressState: 'TN',
    addressZipcode: '38111',
    price: 579000,
    zestimate: 552400,
    beds: 4,
    baths: 3,
    area: 2400,
    homeType: 'SingleFamily',
    daysOnZillow: 12,
    detailUrl: 'https://www.zillow.com/homedetails/4100-Poplar-Ave/42188041_zpid/',
    imgSrc: 'https://photos.zillowstatic.com/abc.jpg',
  };

  assert.deepEqual(mapSummaryToListing(summary), {
    zpid: '42188041',
    address: '4100 Poplar Ave',
    city: 'Memphis',
    state: 'TN',
    zipcode: '38111',
    price: 579000,
    zestimate: 552400,
    bedrooms: 4,
    bathrooms: 3,
    living_area_sqft: 2400,
    home_type: 'SingleFamily',
    days_on_zillow: 12,
    detail_url: 'https://www.zillow.com/homedetails/4100-Poplar-Ave/42188041_zpid/',
    image_url: 'https://photos.zillowstatic.com/abc.jpg',
  });
});

test('preserves inline zestimate so the per-zpid fallback fetch is skipped', () => {
  // The whole reason this swap reduces scrape.do credit burn: search
  // results carry zestimate inline ~80% of the time, so enrichWithZestimates
  // only fires for the remainder. A bug that drops the inline zestimate
  // would silently double scrape.do costs and (worse) re-fetch every
  // listing on every hourly run because the cache zestimate column would
  // never get populated by the search path.
  const summary = { zpid: '1', price: 100000, zestimate: 145000, beds: 3 };
  assert.equal(mapSummaryToListing(summary).zestimate, 145000);
});

test('falls back to address when addressStreet is missing', () => {
  // Some search-result variants in zillowScrapeDo set `address` (the
  // top-level Zillow listing field) but not `addressStreet`. The worker
  // shape's `address` must be populated from either.
  const summary = { zpid: '1', address: '500 Fallback Way', price: 1 };
  assert.equal(mapSummaryToListing(summary).address, '500 Fallback Way');
});

test('missing optional fields stay undefined (do not coerce to null/0)', () => {
  // The worker passes these straight into the `INSERT ... VALUES ($n)`
  // for property_search_cache with `|| null` coalescing in the SQL layer.
  // The adapter itself must leave them undefined so the SQL coalesce is
  // the single source of "missing → NULL" truth.
  const summary = { zpid: '1', price: 100000 };
  const out = mapSummaryToListing(summary);
  assert.equal(out.zestimate, undefined);
  assert.equal(out.bedrooms, undefined);
  assert.equal(out.bathrooms, undefined);
  assert.equal(out.living_area_sqft, undefined);
  assert.equal(out.detail_url, undefined);
  assert.equal(out.image_url, undefined);
});
