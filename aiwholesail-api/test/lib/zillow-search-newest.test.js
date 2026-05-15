// Tests for the newest-first search URL behaviour.
//
// Why this exists (user-reported regression 2026-05-15):
//
//   "Before, when you did a search it would pull properties that were
//    listed minutes ago on zillow. Now, it seems like most of the spreads
//    are 1 day old or so."
//
//   The scrape.do search function builds Zillow URLs of pattern
//   `<location>_rb/` with NO sort parameter. Zillow's default sort on
//   these URLs is "Homes for you" (popularity / engagement-weighted),
//   which buries minutes-old listings on later pages because they have
//   no engagement yet. Frontend `maxPages` defaults to 3, so most fresh
//   listings never reach the user.
//
//   Fix: pass `searchQueryState` with `sort: { value: 'days' }` so
//   Zillow returns newest-first. This guarantees freshly-listed
//   properties are on page 1, in the result set the frontend
//   receives.
//
// Source-level test (no network) — pins the URL composition.
//
// Run:
//   node --test aiwholesail-api/test/lib/zillow-search-newest.test.js

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  buildSearchUrlWithSort,
  parseSearchQueryStateFromUrl,
} = require('../../lib/scrapers/zillowScrapeDo');

test('buildSearchUrlWithSort: appends searchQueryState with sort=days to a slug URL', () => {
  // Slug URL — the standard search() path output before this change.
  const slug = 'https://www.zillow.com/oakland-county-mi/_rb/';
  const url = buildSearchUrlWithSort(slug, { sort: 'newest' });
  assert.match(url, /searchQueryState=/, 'URL must include searchQueryState param');

  const qs = parseSearchQueryStateFromUrl(url);
  assert.deepEqual(qs.sort, { value: 'days' }, 'sort key must be {value: days}');
});

test('buildSearchUrlWithSort: default sort is "newest" when sort arg omitted', () => {
  // The user wants newest-first as the default — that's the regression
  // they reported. Without a sort, Zillow's default ("Homes for you")
  // buries fresh listings. Make the default sort=newest so callers that
  // don't opt in still get fresh-first behaviour.
  const url = buildSearchUrlWithSort('https://www.zillow.com/oakland-county-mi/_rb/');
  const qs = parseSearchQueryStateFromUrl(url);
  assert.deepEqual(qs.sort, { value: 'days' });
});

test('buildSearchUrlWithSort: preserves paginated slug (/<N>_p/)', () => {
  // Mid-pagination URLs still get the sort param. Zillow respects
  // sortSelection across pages — the cursor is in the same query state.
  const slug = 'https://www.zillow.com/oakland-county-mi/_rb/2_p/';
  const url = buildSearchUrlWithSort(slug, { sort: 'newest' });
  assert.match(url, /\/2_p\//, 'pagination segment must be preserved');
  assert.match(url, /searchQueryState=/);
});

test('buildSearchUrlWithSort: preserves status sub-paths (sold/, rentals/)', () => {
  // The standard search() builder adds /sold/ or /rentals/ before
  // pagination. The sort URL must survive these too — otherwise
  // newest-sold or newest-rentals breaks.
  const sold = 'https://www.zillow.com/oakland-county-mi/_rb/sold/';
  const sortedSold = buildSearchUrlWithSort(sold, { sort: 'newest' });
  assert.match(sortedSold, /\/sold\//, 'sold sub-path must be preserved');
  assert.match(sortedSold, /searchQueryState=/);

  const rentals = 'https://www.zillow.com/oakland-county-mi/_rb/rentals/';
  const sortedRentals = buildSearchUrlWithSort(rentals, { sort: 'newest' });
  assert.match(sortedRentals, /\/rentals\//);
  assert.match(sortedRentals, /searchQueryState=/);
});

test('buildSearchUrlWithSort: sort="popular" omits the sort param (Zillow default)', () => {
  // Opt-out path for callers that explicitly want Zillow's default
  // popularity sort (e.g. a future "Show me popular deals" toggle).
  const slug = 'https://www.zillow.com/oakland-county-mi/_rb/';
  const url = buildSearchUrlWithSort(slug, { sort: 'popular' });
  assert.equal(url, slug, 'popular sort must not append searchQueryState');
});

test('parseSearchQueryStateFromUrl: returns null when no searchQueryState param', () => {
  assert.equal(
    parseSearchQueryStateFromUrl('https://www.zillow.com/oakland-county-mi/_rb/'),
    null,
  );
});

test('parseSearchQueryStateFromUrl: decodes URL-encoded JSON correctly', () => {
  const json = JSON.stringify({ sort: { value: 'days' }, pagination: {} });
  const url = `https://www.zillow.com/oakland-county-mi/_rb/?searchQueryState=${encodeURIComponent(json)}`;
  const parsed = parseSearchQueryStateFromUrl(url);
  assert.deepEqual(parsed.sort, { value: 'days' });
  assert.deepEqual(parsed.pagination, {});
});
