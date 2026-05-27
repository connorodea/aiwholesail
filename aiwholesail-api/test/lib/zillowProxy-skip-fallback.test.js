/**
 * Regression guard for the Zillow proxy's "skip RapidAPI fallback on no-data
 * errors" optimization (TD-027).
 *
 * Why this exists (production cost + UX issue surfaced during PR #358 smoke
 * test, May 2026):
 *
 *   `proxyZillow()` runs scrape.do as the primary backend and RapidAPI as the
 *   fallback (PR #321). When scrape.do throws a ZillowScrapeError with
 *   `reason in {'no_data_in_payload', 'no_property_in_payload'}`, that's an
 *   absence-of-data signal — Zillow simply doesn't surface walkScore on this
 *   listing, or stripped the property off the page. NOT a backend failure.
 *
 *   RapidAPI cannot satisfy these requests either — it has no walkScore /
 *   climateRisk / comparableRentals endpoints. The fallback round-trip wastes
 *   ~2 seconds per call and re-throws an unrelated "Action not supported"
 *   error. PR #358's smoke test caught this in the wild:
 *
 *     [zillowProxy] scrape.do PRIMARY walkScore failed, falling back to
 *       RapidAPI: No walk/transit/bike score on this listing
 *     [zillowProxy] both backends failed for walkScore: scrape=No walk/...
 *       rapid=Zillow proxy error: Action 'walkScore' is not supported
 *
 *   Fix: when the scrape.do error is a ZillowScrapeError with a no-data
 *   reason, rethrow immediately and skip the RapidAPI try block. For every
 *   OTHER scrape.do error (network, captcha, parser failure, etc.) the
 *   RapidAPI fallback must still run — those are real backend failures where
 *   RapidAPI might serve data.
 *
 * Approach: file-source introspection, matching the pattern in
 * test/routes/zillow-no-data.test.js. Cheap, catches the exact revert we
 * care about. Behavior-level supertest would require module-mocking the
 * scrape.do handlers, which this repo doesn't currently set up.
 *
 *   $ npm test    (from aiwholesail-api/)
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.join(__dirname, '..', '..', '..');
const ZILLOW_PROXY = path.join(REPO_ROOT, 'aiwholesail-api', 'lib', 'agent', 'zillowProxy.js');

const read = (file) => fs.readFileSync(file, 'utf8');

test('zillowProxy — skip RapidAPI fallback on no-data ZillowScrapeError (TD-027)', async (t) => {

  await t.test('lib/agent/zillowProxy.js exists', () => {
    assert.ok(fs.existsSync(ZILLOW_PROXY), `${ZILLOW_PROXY} must exist`);
  });

  await t.test('imports ZillowScrapeError from ../scrapers/zillowScrapeDo', () => {
    const source = read(ZILLOW_PROXY);

    // The guard needs `instanceof ZillowScrapeError` to safely distinguish a
    // structured scraper error (which carries `reason`) from a generic Error
    // (network, axios, etc. — those don't have a `reason` and SHOULD fall
    // through to RapidAPI). Without the import the symbol is undefined and
    // either the guard is unreachable or it short-circuits unrelated errors.
    assert.match(
      source,
      /(?:const|let)\s*\{[^}]*\bZillowScrapeError\b[^}]*\}\s*=\s*require\(\s*['"]\.\.\/scrapers\/zillowScrapeDo['"]\s*\)/,
      'lib/agent/zillowProxy.js must import { ZillowScrapeError } from ' +
      '"../scrapers/zillowScrapeDo". Without the type the no-data guard ' +
      'cannot safely narrow the error class and either fails open ' +
      '(everything skips fallback — masks real outages) or no-ops ' +
      '(nothing skips — wasted RapidAPI round-trips return).'
    );
  });

  await t.test('catch block short-circuits no-data reasons BEFORE the RapidAPI try', () => {
    const source = read(ZILLOW_PROXY);

    // The guard must:
    //   (a) test `err instanceof ZillowScrapeError` (so non-ZillowScrapeError
    //       errors like axios network failures still fall through to RapidAPI),
    //   (b) test BOTH no-data reasons (no_data_in_payload AND
    //       no_property_in_payload — distinct conditions, both unrecoverable
    //       via RapidAPI), and
    //   (c) re-throw before the `// FALLBACK: RapidAPI` block runs.
    //
    // The 600-char window is sized to fit the guard's condition + a short
    // observability log + the rethrow + a blank line + the FALLBACK comment.
    // If a future refactor inserts more code between the rethrow and the
    // RapidAPI block, restructure rather than widen — the point of the bound
    // is that the guard stays coupled to the block it's guarding.
    const guardPattern =
      /err\s+instanceof\s+ZillowScrapeError[\s\S]{0,200}?no_data_in_payload[\s\S]{0,200}?no_property_in_payload[\s\S]{0,300}?throw[\s\S]{0,600}?(?:FALLBACK|callRapidApiProxy)/;
    const guardPatternReversed =
      /err\s+instanceof\s+ZillowScrapeError[\s\S]{0,200}?no_property_in_payload[\s\S]{0,200}?no_data_in_payload[\s\S]{0,300}?throw[\s\S]{0,600}?(?:FALLBACK|callRapidApiProxy)/;

    const matches = guardPattern.test(source) || guardPatternReversed.test(source);

    assert.ok(
      matches,
      'lib/agent/zillowProxy.js must short-circuit the RapidAPI fallback ' +
      'when scrape.do throws a ZillowScrapeError with reason ' +
      '"no_data_in_payload" or "no_property_in_payload". The guard ' +
      '(condition + rethrow) must appear BEFORE the RapidAPI try-block. ' +
      'Without it every absent-widget request wastes ~2s on a RapidAPI ' +
      'round-trip that cannot satisfy the request — caught in PR #358 ' +
      'smoke-test logs (walkScore double-fail). Non-ZillowScrapeError ' +
      'failures (network, captcha) must still fall through.'
    );
  });

  await t.test('RapidAPI fallback try/catch IS still present (preserved for real failures)', () => {
    const source = read(ZILLOW_PROXY);

    // Don't let the optimization drift into "skip the fallback entirely".
    // The fallback exists for real scrape.do failures (network blip, captcha,
    // parser regression) where RapidAPI MIGHT still serve data. If a refactor
    // deletes the callRapidApiProxy try block, every transient scrape.do
    // hiccup turns into a hard 500.
    assert.match(
      source,
      /callRapidApiProxy\s*\(\s*action\s*,\s*searchParams\s*\)/,
      'The RapidAPI fallback call (callRapidApiProxy(action, searchParams)) ' +
      'must remain in proxyZillow. The TD-027 guard only short-circuits ' +
      'no-data reasons; real scrape.do failures (network, captcha, parser) ' +
      'must still attempt the RapidAPI fallback. Deleting the fallback ' +
      'collapses every transient scrape.do hiccup into a hard 500.'
    );

    // The fallback must still be wrapped in a try/catch — naked it would
    // throw rapidErr instead of the more useful scrapeErr the caller wants
    // to see.
    assert.match(
      source,
      /try\s*\{\s*const\s+data\s*=\s*await\s+callRapidApiProxy[\s\S]{0,400}?catch\s*\(\s*\w+\s*\)/,
      'The RapidAPI fallback must remain wrapped in try/catch so that on ' +
      'a both-backends-failed condition we re-throw the ORIGINAL scrape.do ' +
      'error (the primary), not the less-informative RapidAPI error.'
    );
  });
});
