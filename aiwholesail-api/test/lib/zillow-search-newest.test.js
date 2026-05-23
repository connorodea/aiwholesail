// Tests for the slug-URL builder used by scrape.do's search() path.
//
// HISTORY
// -------
// 2026-05-15 (PR #432-ish range): introduced searchQueryState injection
//   to force newest-first sort. Reported by user as a UX win — fresh
//   listings on page 1.
//
// 2026-05-15 (P0 incident — this PR):
//   Live reproduction proved the searchQueryState injection BROKE region
//   scoping in every search. Without `mapBounds` / `regionSelection`,
//   Zillow's frontend resolved the queryState to a default region
//   (IP-geo or "trending US"), returning random-state listings under the
//   user's correctly-typed search:
//
//     /homes/idaho-county-id_rb/                    → Idaho ✓
//     /homes/idaho-county-id_rb/?searchQueryState=… → Michigan ✗
//
//   Adding `usersSearchTerm` to the queryState did NOT rescue scoping
//   (returned New Jersey). The only safe behaviour is to never inject
//   `searchQueryState` on a slug URL.
//
//   Fix in scrapers/zillowScrapeDo.js: buildSearchUrlWithSort is now a
//   no-op. Newest-first sort is a tracked follow-up — needs a path-based
//   sort segment or a queryState with the resolved regionId (which
//   requires a per-region lookup).
//
// These tests pin the post-fix contract.
//
// Run:
//   node --test aiwholesail-api/test/lib/zillow-search-newest.test.js

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  buildSearchUrlWithSort,
  parseSearchQueryStateFromUrl,
} = require('../../lib/scrapers/zillowScrapeDo');

test('buildSearchUrlWithSort: returns the slug URL unchanged (no searchQueryState injection)', () => {
  // The injection broke region scoping in production — see file header.
  // Test asserts the post-fix behaviour: identity function on the input.
  const slug = 'https://www.zillow.com/oakland-county-mi/_rb/';
  const url = buildSearchUrlWithSort(slug, { sort: 'newest' });
  assert.equal(url, slug, 'must return slug URL unchanged regardless of sort option');
});

test('buildSearchUrlWithSort: does not append ?searchQueryState= (region-scoping safeguard)', () => {
  // Any addition of `searchQueryState` without mapBounds/regionSelection
  // reproduces the P0 bug. This test pins that no caller, no option, no
  // future refactor sneaks the param back in.
  const slug = 'https://www.zillow.com/idaho-county-id_rb/';
  for (const opts of [undefined, {}, { sort: 'newest' }, { sort: 'popular' }, { sort: 'days' }]) {
    const url = buildSearchUrlWithSort(slug, opts);
    assert.doesNotMatch(
      url,
      /searchQueryState=/,
      `buildSearchUrlWithSort must never emit searchQueryState (broke region scoping in prod). Got: ${url}`,
    );
  }
});

test('buildSearchUrlWithSort: preserves paginated slug (/<N>_p/)', () => {
  const slug = 'https://www.zillow.com/oakland-county-mi/_rb/2_p/';
  const url = buildSearchUrlWithSort(slug, { sort: 'newest' });
  assert.equal(url, slug, 'paginated slug must round-trip identical');
});

test('buildSearchUrlWithSort: preserves status sub-paths (sold/, rentals/)', () => {
  const sold = 'https://www.zillow.com/oakland-county-mi/_rb/sold/';
  assert.equal(buildSearchUrlWithSort(sold, { sort: 'newest' }), sold);

  const rentals = 'https://www.zillow.com/oakland-county-mi/_rb/rentals/';
  assert.equal(buildSearchUrlWithSort(rentals, { sort: 'newest' }), rentals);
});

test('buildSearchUrlWithSort: sort="popular" returns slug unchanged (matches no-op contract)', () => {
  const slug = 'https://www.zillow.com/oakland-county-mi/_rb/';
  const url = buildSearchUrlWithSort(slug, { sort: 'popular' });
  assert.equal(url, slug);
});

test('parseSearchQueryStateFromUrl: returns null when no searchQueryState param', () => {
  assert.equal(
    parseSearchQueryStateFromUrl('https://www.zillow.com/oakland-county-mi/_rb/'),
    null,
  );
});

test('parseSearchQueryStateFromUrl: decodes URL-encoded JSON correctly (still exported for tests)', () => {
  // parseSearchQueryStateFromUrl is still exported because future
  // newest-first work may legitimately want to read a region-scoped
  // queryState back out. Behavior must still parse correctly when
  // someone DOES construct such a URL manually.
  const json = JSON.stringify({ sort: { value: 'days' }, pagination: {}, mapBounds: { north: 46, south: 45, east: -114, west: -116 } });
  const url = `https://www.zillow.com/idaho-county-id_rb/?searchQueryState=${encodeURIComponent(json)}`;
  const parsed = parseSearchQueryStateFromUrl(url);
  assert.deepEqual(parsed.sort, { value: 'days' });
  assert.ok(parsed.mapBounds, 'mapBounds must round-trip — it is the region anchor');
});
