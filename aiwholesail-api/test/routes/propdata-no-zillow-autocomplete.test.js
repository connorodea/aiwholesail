// Regression guard for the dead `/api/propdata/zillow-autocomplete` route.
//
// 2026-05-16: the route was the last RapidAPI-Zillow code path in the API
// (`zillow-scraper-api.p.rapidapi.com/zillow/search/autocomplete`). Its
// only frontend caller (`ZillowAPI.autocomplete()` in src/lib/zillow-api.ts)
// was already dead — tree-shaken out of the current production bundle
// (dist/assets/index-Bpvk1tQY.js, zero `propdata` references). The actual
// autocomplete UI uses `/api/property/autocomplete` (scrape.do-backed).
//
// 923 access-log hits in the prior 7 days were from cached old bundles in
// users' browsers; they degrade gracefully (catch → empty dropdown) when
// the route 404s.
//
// This test pins the deletion so a future refactor doesn't accidentally
// re-add a RapidAPI autocomplete route under propdata.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const PROPDATA_SRC = fs.readFileSync(
  path.join(__dirname, '../../routes/propdata.js'),
  'utf8',
);

test('routes/propdata.js does NOT register a /zillow-autocomplete handler', () => {
  // Anchor on the route literal — case-insensitive, allows quoting variants.
  assert.equal(
    /zillow-autocomplete/i.test(PROPDATA_SRC),
    false,
    '/zillow-autocomplete handler must be gone — use /api/property/autocomplete (scrape.do) instead',
  );
});

test('routes/propdata.js does NOT call zillow-scraper-api.p.rapidapi.com', () => {
  // The only zillow-scraper-api hit in this file was the autocomplete route.
  // Catching this separately keeps the failure message specific if someone
  // re-wires the autocomplete handler to a different URL but the same host.
  assert.equal(
    /zillow-scraper-api\.p\.rapidapi\.com/.test(PROPDATA_SRC),
    false,
    'propdata.js must not call zillow-scraper-api — Zillow routes go through scrape.do',
  );
});
