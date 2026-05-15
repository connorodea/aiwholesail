// Tests for the Zillow-facing wrappers used by spread-alert-worker.js.
//
// These wrappers MUST route through `proxyZillow` (lib/agent/zillowProxy),
// not call `zillowScrapeDo` directly — proxyZillow is the single chokepoint
// for backend selection (scrape.do primary, RapidAPI fallback) and error
// translation. The worker bypassing it loses the RapidAPI safety net when
// scrape.do has a transient outage.
//
// Run:
//   node --test aiwholesail-api/test/scripts/spread-alert-zillow.test.js

const test = require('node:test');
const assert = require('node:assert/strict');
const { makeSpreadAlertZillow } = require('../../lib/spread-alert-zillow');

test('searchZillow calls proxyZillow("search", ...) with sort=newest, ForSale, page', async () => {
  const calls = [];
  const fakeProxy = async (action, params) => {
    calls.push({ action, params });
    return { total_pages: 7, results: [{ zpid: '1', price: 100, beds: 3 }] };
  };

  const { searchZillow } = makeSpreadAlertZillow({ proxyZillow: fakeProxy });
  await searchZillow('Memphis, TN', 2);

  assert.equal(calls.length, 1);
  assert.equal(calls[0].action, 'search');
  assert.equal(calls[0].params.location, 'Memphis, TN');
  assert.equal(calls[0].params.page, 2);
  assert.equal(calls[0].params.status, 'ForSale');
  assert.equal(calls[0].params.sort, 'newest');
});

test('searchZillow returns {data: {total_pages, listings}} envelope the worker expects', async () => {
  const fakeProxy = async () => ({
    total_pages: 5,
    results: [
      { zpid: '1', addressStreet: '1 A St', addressCity: 'X', addressState: 'TN', price: 100, beds: 3, baths: 2, zestimate: 150 },
    ],
  });

  const { searchZillow } = makeSpreadAlertZillow({ proxyZillow: fakeProxy });
  const out = await searchZillow('X', 1);

  assert.equal(out.data.total_pages, 5);
  assert.equal(out.data.listings.length, 1);
  // zpid is the join key for property_search_cache upserts — must survive
  // the mapper or every cache write fails the NOT NULL constraint.
  assert.equal(out.data.listings[0].zpid, '1');
  // Mapper translated beds → bedrooms, baths → bathrooms (worker shape):
  assert.equal(out.data.listings[0].bedrooms, 3);
  assert.equal(out.data.listings[0].bathrooms, 2);
  assert.equal(out.data.listings[0].zestimate, 150);
  assert.equal(out.data.listings[0].city, 'X');
});

test('searchZillow defaults total_pages to 1 when proxyZillow omits it', async () => {
  const fakeProxy = async () => ({ results: [] });
  const { searchZillow } = makeSpreadAlertZillow({ proxyZillow: fakeProxy });
  const out = await searchZillow('X', 1);
  assert.equal(out.data.total_pages, 1);
  assert.deepEqual(out.data.listings, []);
});

test('getZestimate calls proxyZillow("zestimate", {zpid})', async () => {
  const calls = [];
  const fakeProxy = async (action, params) => {
    calls.push({ action, params });
    return { zpid: '42', zestimate: 250000, rentZestimate: 1800 };
  };

  const { getZestimate } = makeSpreadAlertZillow({ proxyZillow: fakeProxy });
  const out = await getZestimate('42');

  assert.equal(calls[0].action, 'zestimate');
  assert.equal(calls[0].params.zpid, '42');
  assert.equal(out, 250000);
});

test('getZestimate returns null on proxyZillow throw (preserves prior swallow-error contract)', async () => {
  // The worker's enrichWithZestimates uses Promise.allSettled and treats a
  // missing zestimate as "skip this property" rather than "fail the whole
  // location." Throwing here would change error semantics — the worker is
  // not equipped to differentiate per-zpid failures.
  const fakeProxy = async () => { throw new Error('scrape.do down'); };
  const { getZestimate } = makeSpreadAlertZillow({ proxyZillow: fakeProxy });
  assert.equal(await getZestimate('42'), null);
});

test('getZestimate returns null when proxyZillow returns null/undefined zestimate', async () => {
  const fakeProxy = async () => ({ zpid: '42', zestimate: null });
  const { getZestimate } = makeSpreadAlertZillow({ proxyZillow: fakeProxy });
  assert.equal(await getZestimate('42'), null);
});
