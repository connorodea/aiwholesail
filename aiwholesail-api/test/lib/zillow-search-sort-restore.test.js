// Tests for the newest-first sort restoration in scrape.do's search() flow.
//
// HISTORY (the full saga, since these test files keep accumulating context):
//
//   2026-05-15 (PR #432-ish):  newest-first sort introduced via
//     `?searchQueryState=…` injection. UX win — fresh listings on page 1.
//
//   2026-05-15 (P0 incident, PR #445):  injection broke region scoping for
//     EVERY search. `buildSearchUrlWithSort` made a no-op. Sort regressed
//     to Zillow's default (Homes for you), but at least results were
//     correctly state-scoped.
//
//   2026-05-15 (follow-up, PR #447):  added `resolveRegionForLocation` and
//     `buildRegionScopedSearchUrl`. Filtered-search bug class (comingSoon,
//     auctionListings) fixed by injecting `regionSelection` alongside the
//     filterState. Same machinery now usable for sort.
//
//   2026-05-15 (this PR):  restores newest-first sort SAFELY by extending
//     search() to use buildRegionScopedSearchUrl when sort is requested
//     (default). Region resolution caches; status-sub-path searches and
//     explicit `sort: 'popular'` skip the region lookup for speed.
//
// Run:
//   node --test aiwholesail-api/test/lib/zillow-search-sort-restore.test.js

const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');

// Mock scrape.do client (network-free). Same shim pattern as
// zillow-region-scoped-filters.test.js.
const _mockResponses = [];
const _scrapeCalls = [];
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

const { search, _resetRegionCache } = require('../../lib/scrapers/zillowScrapeDo');

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
  const padding = '<!-- ' + 'x'.repeat(300) + ' -->';
  return `<html><body>${padding}<script id="__NEXT_DATA__" type="application/json">${JSON.stringify({
    props: {
      pageProps: {
        searchPageState: {
          queryState: {},
          cat1: { searchResults: { listResults: [] }, searchList: { totalResultCount: 0 } },
        },
      },
    },
  })}</script></body></html>`;
}

function resetMocks() {
  _resetRegionCache();
  _mockResponses.length = 0;
  _scrapeCalls.length = 0;
}

// ─── Default sort = newest ────────────────────────────────────────────────

test('search() with default sort: resolves region, then issues a sortSelection=days request', async () => {
  resetMocks();
  // Two scrape calls expected: region lookup + sorted fetch.
  _mockResponses.push(nextDataWithRegion(566, 4, { north: 46, south: 45, east: -114, west: -116 }));
  _mockResponses.push(nextDataWithRegion(566, 4, { north: 46, south: 45, east: -114, west: -116 }, [
    { addressCity: 'Grangeville', addressState: 'ID', address: '100 Main St', zpid: '1' },
  ]));

  const r = await search({ location: 'Idaho County, ID' });
  assert.equal(_scrapeCalls.length, 2, 'two-call: region lookup + sort-applied fetch');
  // Step 1: plain slug (region lookup)
  assert.doesNotMatch(_scrapeCalls[0].url, /searchQueryState=/, 'region lookup uses plain slug');
  // Step 2: includes regionSelection AND sortSelection
  assert.match(_scrapeCalls[1].url, /searchQueryState=/, 'sort-applied URL carries queryState');
  const m = _scrapeCalls[1].url.match(/[?&]searchQueryState=([^&]+)/);
  const qs = JSON.parse(decodeURIComponent(m[1]));
  assert.deepEqual(qs.regionSelection, [{ regionId: 566, regionType: 4 }],
    'regionSelection MUST be present (else Zillow returns wrong-state results)');
  assert.deepEqual(qs.filterState?.sortSelection, { value: 'days' },
    'filterState.sortSelection must be {value: days} — Zillow\'s canonical newest-first key');

  assert.equal(r.results.length, 1);
  assert.equal(r.results[0].addressCity, 'Grangeville');
});

test('search() with explicit sort=popular: skips region lookup, uses plain slug (faster path)', async () => {
  resetMocks();
  // One scrape call expected: plain slug.
  _mockResponses.push(nextDataWithRegion(0, 0, null, [
    { addressCity: 'Anywhere', addressState: 'TX', address: '1 St', zpid: '2' },
  ]));

  const r = await search({ location: 'Idaho County, ID', sort: 'popular' });
  assert.equal(_scrapeCalls.length, 1, 'sort=popular must NOT trigger a region-lookup round-trip');
  assert.doesNotMatch(_scrapeCalls[0].url, /searchQueryState=/, 'sort=popular uses plain slug, no queryState');
  assert.equal(r.results.length, 1);
});

test('search() falls back to plain slug when region resolution fails (graceful degradation)', async () => {
  resetMocks();
  _mockResponses.push(nextDataWithoutRegion()); // region lookup returns null
  _mockResponses.push(nextDataWithRegion(0, 0, null, [
    { addressCity: 'Grangeville', addressState: 'ID', address: '100 Main St', zpid: '3' },
  ]));

  const r = await search({ location: 'Idaho County, ID' });
  assert.equal(_scrapeCalls.length, 2, 'two calls: failed region lookup + fallback fetch');
  // BOTH calls should be plain slug (no queryState) — fallback path uses the
  // slug URL alone so we get correct-state default-sorted results.
  assert.doesNotMatch(_scrapeCalls[0].url, /searchQueryState=/, 'region lookup is plain slug');
  assert.doesNotMatch(_scrapeCalls[1].url, /searchQueryState=/,
    'fallback fetch MUST be plain slug (not the broken queryState-without-region pattern)');
  assert.equal(r.results.length, 1);
});

// ─── Status sub-paths preserve the safe pre-#447 behavior ──────────────────

test('search() with status=sold: keeps the /sold/ path, no region lookup, no queryState', async () => {
  resetMocks();
  _mockResponses.push(nextDataWithRegion(0, 0, null, []));

  // STATUS_TO_ZILLOW: 'sold' → 'RecentlySold' → /sold/ sub-path.
  await search({ location: 'Idaho County, ID', status: 'sold' });
  assert.equal(_scrapeCalls.length, 1, 'sold searches stay single-call');
  assert.match(_scrapeCalls[0].url, /_rb\/sold\//, 'sold sub-path preserved');
  assert.doesNotMatch(_scrapeCalls[0].url, /searchQueryState=/,
    'sold searches use plain slug (sort restoration scoped to default For Sale flow only)');
});

test('search() with status=for_rent: keeps the /rentals/ path, no region lookup', async () => {
  resetMocks();
  _mockResponses.push(nextDataWithRegion(0, 0, null, []));

  // STATUS_TO_ZILLOW: 'for_rent' / 'forRent' → 'ForRent' → /rentals/ sub-path.
  await search({ location: 'Idaho County, ID', status: 'for_rent' });
  assert.equal(_scrapeCalls.length, 1);
  assert.match(_scrapeCalls[0].url, /_rb\/rentals\//);
  assert.doesNotMatch(_scrapeCalls[0].url, /searchQueryState=/);
});

// ─── Pagination is preserved in the sorted URL ─────────────────────────────

test('search() page=2 (default sort): pagination carried through the region-scoped URL', async () => {
  resetMocks();
  _mockResponses.push(nextDataWithRegion(566, 4, { north: 46, south: 45, east: -114, west: -116 }));
  _mockResponses.push(nextDataWithRegion(566, 4, { north: 46, south: 45, east: -114, west: -116 }, []));

  await search({ location: 'Idaho County, ID', page: 2 });
  const m = _scrapeCalls[1].url.match(/[?&]searchQueryState=([^&]+)/);
  const qs = JSON.parse(decodeURIComponent(m[1]));
  assert.deepEqual(qs.pagination, { currentPage: 2 },
    'pagination must round-trip into queryState for page > 1');
});

// ─── Cache validation: second search same location is single-call ─────────

test('search() cached region: subsequent same-location calls are single-call (no extra RTT)', async () => {
  resetMocks();
  // First call: region lookup + sorted fetch
  _mockResponses.push(nextDataWithRegion(566, 4, { north: 46, south: 45, east: -114, west: -116 }));
  _mockResponses.push(nextDataWithRegion(566, 4, { north: 46, south: 45, east: -114, west: -116 }, []));
  await search({ location: 'Idaho County, ID' });
  assert.equal(_scrapeCalls.length, 2);

  // Second call: region already cached → only the sorted fetch
  _mockResponses.push(nextDataWithRegion(566, 4, { north: 46, south: 45, east: -114, west: -116 }, []));
  await search({ location: 'Idaho County, ID' });
  assert.equal(_scrapeCalls.length, 3, 'second call must hit cache, single scrape only');
});
