/**
 * Unit tests for the Zillow autocomplete normalizer.
 * Fixture-based — no network. Pairs with lib/scrapers/zillowAutocompleteScrapeDo.js.
 *
 *   $ node --test test/lib/zillowAutocomplete.test.js
 *
 * The fixtures below are real responses observed by hitting
 *   https://www.zillowstatic.com/autocomplete/v3/suggestions?q=<query>
 * through scrape.do during the discovery probe — see the parent commit's
 * commit message for the curl-equivalent and raw shape.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  autocompleteUrl,
  parseAutocompletePayload,
  normalizeSuggestion,
  normalizeAutocompletePayload,
} = require('../../lib/scrapers/zillowAutocompleteScrapeDo');

// ── Fixtures ───────────────────────────────────────────────────────────────
//
// Three real shapes observed during the discovery probe (q=austin,
// q=1600+pennsylvania, q=350+bush+st+san+francisco). The normalizer must
// collapse all three into the flat `suggestions` array the frontend renders.

// Fixture 1: Region-only response (q=austin) — city + city-named-by-state
// suburbs. The frontend should never see the deep metaData object.
const fixtureRegionsOnly = JSON.stringify({
  results: [
    {
      display: 'Austin, TX',
      resultType: 'Region',
      metaData: {
        regionId: 10221,
        regionType: 'city',
        city: 'Austin',
        county: 'Travis County',
        state: 'TX',
        country: 'United States',
        lat: 30.28244966294375,
        lng: -97.79675774321845,
      },
    },
    {
      display: 'Austin, MN',
      resultType: 'Region',
      metaData: {
        regionId: 23555,
        regionType: 'city',
        city: 'Austin',
        county: 'Mower County',
        state: 'MN',
        country: 'United States',
        lat: 43.64884677333361,
        lng: -93.01725558601386,
      },
    },
  ],
});

// Fixture 2: Mixed regions + addresses (q=1600 Pennsylvania) — the case
// where the upstream returns ZIPs that fuzzy-match the leading digits
// PLUS full street addresses with zpid. Normalizer must keep both, tag
// each with the right `type`, and surface zpid for Address rows so the
// UI can deep-link to the listing.
const fixtureMixed = JSON.stringify({
  results: [
    {
      display: '16001',
      resultType: 'Region',
      metaData: {
        regionId: 64399,
        regionType: 'zipcode',
        city: 'Butler',
        county: 'Butler County',
        state: 'PA',
        country: 'United States',
        zipCode: '16001',
        lat: 40.909,
        lng: -79.943,
      },
    },
    {
      display: '1600 Pennsylvania Ave #6 Miami Beach, FL 33139',
      resultType: 'Address',
      metaData: {
        addressType: 'rental_address',
        streetNumber: '1600',
        streetName: 'Pennsylvania Ave',
        unitNumber: '6',
        city: 'Miami Beach',
        state: 'FL',
        country: 'US',
        zipCode: '33139',
        zpid: 162032128,
        lat: 25.789236,
        lng: -80.13459,
        maloneId: 2172536841,
      },
    },
    {
      display: '1600 Leishman Ave Arnold, PA 15068',
      resultType: 'Address',
      metaData: {
        addressType: 'forsale_address',
        streetNumber: '1600',
        streetName: 'Leishman Ave',
        city: 'Arnold',
        state: 'PA',
        country: 'US',
        zipCode: '15068',
        zpid: 11507734,
        lat: 40.580,
        lng: -79.768,
      },
    },
  ],
});

// Fixture 3: Empty (q="350 Bush St San Francisco" — too specific for
// Zillow's typeahead). Normalizer must treat this as a clean no-match,
// not an error.
const fixtureEmpty = JSON.stringify({ results: [] });

// ── autocompleteUrl ────────────────────────────────────────────────────────

test('autocompleteUrl', async (t) => {
  await t.test('encodes spaces and special chars', () => {
    const url = autocompleteUrl('Detroit, MI');
    assert.ok(url.startsWith('https://www.zillowstatic.com/autocomplete/v3/suggestions?'));
    assert.match(url, /q=Detroit%2C\+MI/);
    assert.match(url, /clientId=hdp-autocomplete-wrapper/);
  });

  await t.test('trims whitespace before encoding', () => {
    const url = autocompleteUrl('   austin   ');
    assert.match(url, /q=austin/);
  });
});

// ── parseAutocompletePayload ───────────────────────────────────────────────

test('parseAutocompletePayload', async (t) => {
  await t.test('parses a valid JSON string', () => {
    const out = parseAutocompletePayload(fixtureRegionsOnly);
    assert.ok(Array.isArray(out.results));
    assert.equal(out.results.length, 2);
  });

  await t.test('passes objects through untouched', () => {
    const obj = { results: [{ display: 'x', resultType: 'Region', metaData: {} }] };
    const out = parseAutocompletePayload(obj);
    assert.equal(out, obj);
  });

  await t.test('returns empty results on malformed JSON (likely a captcha HTML page)', () => {
    const out = parseAutocompletePayload('<html><body>captcha</body></html>');
    assert.deepEqual(out, { results: [] });
  });

  await t.test('returns empty results on empty/null input', () => {
    assert.deepEqual(parseAutocompletePayload(''), { results: [] });
    assert.deepEqual(parseAutocompletePayload(null), { results: [] });
    assert.deepEqual(parseAutocompletePayload(undefined), { results: [] });
  });
});

// ── normalizeSuggestion ────────────────────────────────────────────────────

test('normalizeSuggestion', async (t) => {
  await t.test('flattens a Region entry into city/state/type fields', () => {
    const entry = JSON.parse(fixtureRegionsOnly).results[0];
    const s = normalizeSuggestion(entry);
    assert.equal(s.display, 'Austin, TX');
    assert.equal(s.city, 'Austin');
    assert.equal(s.state, 'TX');
    assert.equal(s.type, 'region');
    assert.equal(s.regionType, 'city');
    assert.equal(s.zpid, undefined);
    // Region rows don't synthesize a street address.
    assert.equal(s.address, '');
  });

  await t.test('flattens an Address entry with zpid + composed street', () => {
    const entry = JSON.parse(fixtureMixed).results[1];
    const s = normalizeSuggestion(entry);
    assert.equal(s.display, '1600 Pennsylvania Ave #6 Miami Beach, FL 33139');
    assert.equal(s.address, '1600 Pennsylvania Ave #6');
    assert.equal(s.city, 'Miami Beach');
    assert.equal(s.state, 'FL');
    assert.equal(s.zip, '33139');
    assert.equal(s.zpid, '162032128');
    assert.equal(s.type, 'address');
    assert.equal(s.regionType, undefined);
  });

  await t.test('handles Address entries without a unit number', () => {
    const entry = JSON.parse(fixtureMixed).results[2];
    const s = normalizeSuggestion(entry);
    assert.equal(s.address, '1600 Leishman Ave');
    assert.equal(s.zpid, '11507734');
  });

  await t.test('returns null when display is missing or blank', () => {
    assert.equal(normalizeSuggestion({ display: '', resultType: 'Region', metaData: {} }), null);
    assert.equal(normalizeSuggestion({ display: '   ', resultType: 'Region', metaData: {} }), null);
    assert.equal(normalizeSuggestion(null), null);
    assert.equal(normalizeSuggestion('not an object'), null);
  });

  await t.test('handles entries with no metaData defensively', () => {
    const s = normalizeSuggestion({ display: 'Mystery Place', resultType: 'Region' });
    assert.equal(s.display, 'Mystery Place');
    assert.equal(s.city, '');
    assert.equal(s.type, 'region');
  });
});

// ── normalizeAutocompletePayload ───────────────────────────────────────────

test('normalizeAutocompletePayload', async (t) => {
  await t.test('returns an empty array for empty upstream', () => {
    assert.deepEqual(normalizeAutocompletePayload(fixtureEmpty), []);
  });

  await t.test('returns an empty array for malformed upstream (treated as captcha)', () => {
    assert.deepEqual(normalizeAutocompletePayload('<html>captcha</html>'), []);
  });

  await t.test('normalizes a regions-only response', () => {
    const out = normalizeAutocompletePayload(fixtureRegionsOnly);
    assert.equal(out.length, 2);
    assert.equal(out[0].display, 'Austin, TX');
    assert.equal(out[0].type, 'region');
    assert.equal(out[1].display, 'Austin, MN');
  });

  await t.test('normalizes a mixed regions + addresses response', () => {
    const out = normalizeAutocompletePayload(fixtureMixed);
    assert.equal(out.length, 3);
    assert.equal(out[0].type, 'region');
    assert.equal(out[1].type, 'address');
    assert.equal(out[1].zpid, '162032128');
    assert.equal(out[2].type, 'address');
  });

  await t.test('respects the limit cap', () => {
    const out = normalizeAutocompletePayload(fixtureMixed, { limit: 2 });
    assert.equal(out.length, 2);
  });

  await t.test('drops entries with empty display strings', () => {
    const payload = JSON.stringify({
      results: [
        { display: '', resultType: 'Region', metaData: {} },
        { display: 'Detroit, MI', resultType: 'Region', metaData: { city: 'Detroit', state: 'MI', regionType: 'city' } },
        { display: null, resultType: 'Address', metaData: {} },
      ],
    });
    const out = normalizeAutocompletePayload(payload);
    assert.equal(out.length, 1);
    assert.equal(out[0].display, 'Detroit, MI');
  });
});
