// Tests for the region-scoped filter URL builder + comingSoon/auctionListings
// region resolution. Follow-up to PR #445 — same root cause, different fix
// shape because filterState can't just be dropped.
//
// What this pins:
//
//   1. buildRegionScopedSearchUrl emits BOTH regionSelection and the
//      filterState (no future refactor strips the region anchor)
//   2. comingSoon returns empty (not wrong-state) when region resolution
//      fails — better silent than serving NJ listings for an Idaho search
//   3. comingSoon does NOT fall back to the legacy bare-slug + queryState
//      pattern that broke region scoping for the whole backend
//
// Run:
//   node --test aiwholesail-api/test/lib/zillow-region-scoped-filters.test.js

const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');

// Mock scrape.do client BEFORE requiring the scraper so the test stays
// network-free. Returns whatever __NEXT_DATA__ blob the test queued up.
const _mockResponses = [];
const _scrapeCalls = [];
const originalResolve = Module._resolve_filename || Module._resolveFilename;
const originalLoad = Module._load;
Module._load = function patched(request, parent, ...rest) {
  if (request === './scrapeDoClient' || request.endsWith('/scrapeDoClient')) {
    return {
      scrape: async (url, opts) => {
        _scrapeCalls.push({ url, opts });
        const next = _mockResponses.shift();
        if (!next) throw new Error(`unexpected scrape() call for ${url}`);
        return { data: next };
      },
      ScrapeDoError: class ScrapeDoError extends Error {},
    };
  }
  return originalLoad.call(this, request, parent, ...rest);
};

const {
  resolveRegionForLocation,
  buildRegionScopedSearchUrl,
  comingSoon,
  auctionListings,
  _resetRegionCache,
} = require('../../lib/scrapers/zillowScrapeDo');

function nextDataWithRegion(regionId, regionType, bounds, listResults = []) {
  return `<html><body><script id="__NEXT_DATA__" type="application/json">${JSON.stringify({
    props: {
      pageProps: {
        searchPageState: {
          queryState: {
            regionSelection: [{ regionId, regionType }],
            mapBounds: bounds,
          },
          cat1: {
            searchResults: { listResults },
            searchList: { totalResultCount: listResults.length },
          },
        },
      },
    },
  })}</script></body></html>`;
}

function nextDataWithoutRegion() {
  // Pad past extractNextData's 200-char minimum-body threshold so the parser
  // takes the "no regionSelection" branch instead of throwing empty-body.
  const padding = '<!-- ' + 'x'.repeat(300) + ' -->';
  return `<html><body>${padding}<script id="__NEXT_DATA__" type="application/json">${JSON.stringify({
    props: { pageProps: { searchPageState: { queryState: {} } } },
  })}</script></body></html>`;
}

// ─── resolveRegionForLocation ─────────────────────────────────────────────────

test('resolveRegionForLocation: extracts regionSelection + mapBounds from __NEXT_DATA__', async () => {
  _resetRegionCache();
  _mockResponses.length = 0;
  _scrapeCalls.length = 0;
  _mockResponses.push(nextDataWithRegion(566, 4, { north: 46, south: 45, east: -114, west: -116 }));

  const region = await resolveRegionForLocation('Idaho County, ID');
  assert.ok(region, 'must resolve a region object');
  assert.deepEqual(region.regionSelection, [{ regionId: 566, regionType: 4 }]);
  assert.deepEqual(region.mapBounds, { north: 46, south: 45, east: -114, west: -116 });
  assert.equal(_scrapeCalls.length, 1, 'one scrape call');
  assert.match(_scrapeCalls[0].url, /idaho-county-id_rb/, 'must hit the plain slug URL');
  assert.doesNotMatch(_scrapeCalls[0].url, /searchQueryState=/, 'region lookup must use plain slug, no queryState');
});

test('resolveRegionForLocation: returns null when slug page has no regionSelection', async () => {
  _resetRegionCache();
  _mockResponses.length = 0;
  _scrapeCalls.length = 0;
  _mockResponses.push(nextDataWithoutRegion());

  const region = await resolveRegionForLocation('Notarealplace, XX');
  assert.equal(region, null, 'unknown location must resolve to null (NOT a default region)');
});

test('resolveRegionForLocation: caches successful resolutions (one scrape call across N requests)', async () => {
  _resetRegionCache();
  _mockResponses.length = 0;
  _scrapeCalls.length = 0;
  _mockResponses.push(nextDataWithRegion(12447, 6, { north: 34, south: 33, east: -118, west: -119 }));

  const a = await resolveRegionForLocation('Los Angeles, CA');
  const b = await resolveRegionForLocation('Los Angeles, CA');
  const c = await resolveRegionForLocation('los angeles, ca'); // case-insensitive cache hit
  assert.equal(_scrapeCalls.length, 1, 'cache hit must skip subsequent scrape calls');
  assert.deepEqual(a, b);
  assert.deepEqual(a, c);
});

test('resolveRegionForLocation: failures are NOT cached (transient errors must retry next call)', async () => {
  _resetRegionCache();
  _mockResponses.length = 0;
  _scrapeCalls.length = 0;
  _mockResponses.push(nextDataWithoutRegion()); // first call: no region
  _mockResponses.push(nextDataWithRegion(99, 4, { north: 1, south: 0, east: 1, west: 0 })); // second: success

  const first = await resolveRegionForLocation('Idaho County, ID');
  assert.equal(first, null);
  const second = await resolveRegionForLocation('Idaho County, ID');
  assert.ok(second, 'subsequent call must retry, not return cached null');
  assert.equal(_scrapeCalls.length, 2);
});

// ─── buildRegionScopedSearchUrl ───────────────────────────────────────────────

test('buildRegionScopedSearchUrl: queryState contains regionSelection (the safeguard pin)', () => {
  const region = {
    regionSelection: [{ regionId: 566, regionType: 4 }],
    mapBounds: { north: 46, south: 45, east: -114, west: -116 },
  };
  const url = buildRegionScopedSearchUrl('Idaho County, ID', region, {
    filterState: { isComingSoon: { value: true } },
  });
  assert.match(url, /idaho-county-id_rb/, 'URL must keep the slug');
  assert.match(url, /searchQueryState=/);

  // Decode the queryState and check the structure rigorously.
  const m = url.match(/[?&]searchQueryState=([^&]+)/);
  const qs = JSON.parse(decodeURIComponent(m[1]));
  assert.deepEqual(qs.regionSelection, region.regionSelection,
    'regionSelection MUST round-trip — the absence of this was the PR #445 bug');
  assert.deepEqual(qs.filterState, { isComingSoon: { value: true } });
  assert.deepEqual(qs.mapBounds, region.mapBounds);
});

test('buildRegionScopedSearchUrl: works without mapBounds (optional)', () => {
  const region = { regionSelection: [{ regionId: 99, regionType: 4 }] };
  const url = buildRegionScopedSearchUrl('Anywhere', region, { filterState: {} });
  const m = url.match(/[?&]searchQueryState=([^&]+)/);
  const qs = JSON.parse(decodeURIComponent(m[1]));
  assert.deepEqual(qs.regionSelection, region.regionSelection);
  assert.equal(qs.mapBounds, undefined, 'mapBounds is optional — omit when absent');
});

// ─── comingSoon ─────────────────────────────────────────────────────────────

test('comingSoon: when region resolution fails, returns empty (NOT wrong-state results)', async () => {
  _resetRegionCache();
  _mockResponses.length = 0;
  _scrapeCalls.length = 0;
  _mockResponses.push(nextDataWithoutRegion()); // resolveRegion call returns no region

  const result = await comingSoon({ location: 'Notarealplace, XX' });
  assert.equal(result.totalResultCount, 0);
  assert.deepEqual(result.results, []);
  assert.equal(result.status, 'ComingSoon');
  assert.equal(_scrapeCalls.length, 1, 'must NOT make the filtered call after region resolution failed');
});

test('comingSoon: two-call flow — region lookup THEN filtered query with regionSelection injected', async () => {
  _resetRegionCache();
  _mockResponses.length = 0;
  _scrapeCalls.length = 0;
  _mockResponses.push(nextDataWithRegion(566, 4, { north: 46, south: 45, east: -114, west: -116 })); // region resolve
  _mockResponses.push(nextDataWithRegion(566, 4, { north: 46, south: 45, east: -114, west: -116 }, [
    { addressCity: 'Grangeville', addressState: 'ID', address: '100 Main St', zpid: '1' },
  ])); // filtered fetch

  const result = await comingSoon({ location: 'Idaho County, ID' });
  assert.equal(_scrapeCalls.length, 2, 'two-call pattern: region lookup + filtered fetch');

  // First call is the plain slug.
  assert.doesNotMatch(_scrapeCalls[0].url, /searchQueryState=/, 'region-lookup URL must be plain slug');

  // Second call must include regionSelection in its queryState.
  assert.match(_scrapeCalls[1].url, /searchQueryState=/);
  const m = _scrapeCalls[1].url.match(/[?&]searchQueryState=([^&]+)/);
  const qs = JSON.parse(decodeURIComponent(m[1]));
  assert.deepEqual(qs.regionSelection, [{ regionId: 566, regionType: 4 }],
    'filtered URL MUST carry regionSelection — its absence was the bug');
  assert.equal(qs.filterState.isComingSoon.value, true, 'isComingSoon filter must be set');

  assert.equal(result.results.length, 1);
  assert.equal(result.results[0].addressCity, 'Grangeville');
});

// ─── auctionListings ────────────────────────────────────────────────────────

test('auctionListings: when region resolution fails, returns empty (NOT wrong-state results)', async () => {
  _resetRegionCache();
  _mockResponses.length = 0;
  _scrapeCalls.length = 0;
  _mockResponses.push(nextDataWithoutRegion());

  const result = await auctionListings({ location: 'Notarealplace, XX' });
  assert.equal(result.totalResultCount, 0);
  assert.deepEqual(result.results, []);
  assert.equal(result.status, 'Auction');
});

test('auctionListings: filtered URL carries regionSelection + isAuction filter', async () => {
  _resetRegionCache();
  _mockResponses.length = 0;
  _scrapeCalls.length = 0;
  _mockResponses.push(nextDataWithRegion(12447, 6, { north: 34, south: 33, east: -118, west: -119 }));
  _mockResponses.push(nextDataWithRegion(12447, 6, { north: 34, south: 33, east: -118, west: -119 }, []));

  await auctionListings({ location: 'Los Angeles, CA' });
  const m = _scrapeCalls[1].url.match(/[?&]searchQueryState=([^&]+)/);
  const qs = JSON.parse(decodeURIComponent(m[1]));
  assert.deepEqual(qs.regionSelection, [{ regionId: 12447, regionType: 6 }]);
  assert.equal(qs.filterState.isAuction.value, true);
});
