/**
 * Regression guard for the Zillow proxy's no-data error translation.
 *
 * Why this exists (production UX bug surfaced during systematic-debugging
 * session, May 2026):
 *
 *   The scrape.do-backed Zillow actions throw ZillowScrapeError with
 *   `reason: 'no_data_in_payload'` when Zillow simply does NOT surface a
 *   widget on a given listing — walkScore on a suburban listing, climate
 *   on a 2019-era detail page, comparableRentals on a non-rentable
 *   property, etc. This is a normal absence-of-data condition, NOT a
 *   backend failure.
 *
 *   `routes/zillow.js`'s catch handler treats EVERY ZillowScrapeError as a
 *   500. Result: a wholesaler asking for walkScore on a property without
 *   walkScore receives HTTP 500 with a raw error string. The UI treats
 *   500s as "API broken" and pages on-call, instead of showing the user
 *   "Walk Score not available for this listing."
 *
 *   Also affects `'no_property_in_payload'` (Zillow stripped the listing
 *   off the page — old/removed/regional-block), which is similarly an
 *   absence-of-data signal, not a backend failure.
 *
 * The fix: the route must translate `err.reason in {'no_data_in_payload',
 * 'no_property_in_payload'}` to HTTP 200 with `{success: true, data: null,
 * reason: <reason>}`. All OTHER errors continue to be 500s.
 *
 * Approach: file-source introspection, matching the pattern in
 * api-client-refresh.test.js and stripe-checkout-config.test.js. Cheap,
 * fragile, catches the exact revert we care about. Upgrade to behavior-
 * level supertest tests when the route handlers are refactored into
 * mockable units.
 *
 *   $ npm test    (from aiwholesail-api/)
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.join(__dirname, '..', '..', '..');
const ZILLOW_ROUTE = path.join(REPO_ROOT, 'aiwholesail-api', 'routes', 'zillow.js');

const read = (file) => fs.readFileSync(file, 'utf8');

test('zillow proxy route — no-data translation regression guard', async (t) => {

  await t.test('routes/zillow.js exists', () => {
    assert.ok(fs.existsSync(ZILLOW_ROUTE), `${ZILLOW_ROUTE} must exist`);
  });

  await t.test('catch block inspects err.reason for known no-data signals', () => {
    const source = read(ZILLOW_ROUTE);

    // Must reference both no-data reasons literally. If either is missing,
    // that branch falls through to the 500 and the production UX bug
    // returns.
    assert.match(
      source,
      /no_data_in_payload/,
      'routes/zillow.js must check err.reason === "no_data_in_payload" so ' +
      'listings without walkScore/climate/comparableRentals return 200+null ' +
      'instead of 500. Removing this check restores the May-2026 UX bug ' +
      'where every absent-widget request paged on-call.'
    );

    assert.match(
      source,
      /no_property_in_payload/,
      'routes/zillow.js must also handle "no_property_in_payload" — the ' +
      'signal that Zillow stripped the listing off the page (old/removed/' +
      'regional-block). Same absence-of-data semantics as no_data_in_payload.'
    );
  });

  await t.test('no-data branch responds 200 with success:true and data:null', () => {
    const source = read(ZILLOW_ROUTE);

    // Locate the catch block. It must contain a branch that returns 200
    // (not 500) when the reason is one of the no-data signals.
    //
    // Pattern matches across whitespace + arbitrary intervening tokens but
    // requires all four pieces in order within one catch block region.
    const noDataBranch =
      /no_(?:data|property)_in_payload[\s\S]{0,400}?res\.(?:status\(\s*200\s*\)\.)?json\(\s*\{[\s\S]*?success\s*:\s*true[\s\S]*?data\s*:\s*null/;

    assert.match(
      source,
      noDataBranch,
      'The no-data catch branch must respond with HTTP 200 and ' +
      '`{success: true, data: null, reason: <reason>}` so the frontend ' +
      'can render "Not available for this listing" instead of an error ' +
      'toast. A 500 here pages on-call for a legitimate empty result.'
    );

    // Must echo the reason field so the UI / observability can distinguish
    // missing-widget from broken-backend.
    assert.match(
      source,
      /no_(?:data|property)_in_payload[\s\S]{0,400}?reason\s*:/,
      'The 200-with-null response must include a `reason` field so the ' +
      'UI can render an appropriate "not available" message and so ' +
      'observability can distinguish absent-data from upstream errors.'
    );
  });

  await t.test('other errors still return 500 (preserves loud failure for real bugs)', () => {
    const source = read(ZILLOW_ROUTE);

    // The catch block must still have a 500 path. We do NOT want
    // every error swallowed as 200 — actual scrape.do outages, captchas,
    // unknown errors must still surface loudly.
    assert.match(
      source,
      /res\.status\(\s*500\s*\)\.json\s*\(\s*\{\s*success\s*:\s*false/,
      'routes/zillow.js must still return 500 for non-no-data errors. ' +
      'Swallowing every error as 200 would mask real scrape.do outages ' +
      'and captchas (the very failure modes we built the fallback chain ' +
      'to surface). Keep the 500 path; only no_data_* gets the 200.'
    );
  });
});
