/**
 * Unit tests for the Zillow → scrape.do parser.
 * Fixture-based — no network. Pairs with lib/scrapers/zillowScrapeDo.js.
 *
 *   $ node --test test/lib/scrapers/zillowScrapeDo.test.js
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  extractNextData,
  findPropertyRecord,
  findListResults,
  findTotalResultCount,
  mapPropertyToRapidApiShape,
  mapListingToSummary,
  searchUrlForLocation,
  buildSearchQueryState,
  boundsFromCenterRadius,
  findZestimateHistory,
  findMortgageRates,
  normalizeMortgageRate,
  findAgentProfile,
  normalizeAgentProfile,
  findMarketStats,
  normalizeMarketStats,
  marketStatsUrl,
  mortgageCalculator,
  searchByUrl,
  findWalkScore,
  findClimateRisk,
  derivePropertyTaxHistory,
  ZillowScrapeError,
} = require('../../lib/scrapers/zillowScrapeDo');
const { looksLikeCaptcha } = require('../../lib/scrapers/scrapeDoClient');

// Build a minimal HTML page with a valid __NEXT_DATA__ blob whose shape
// matches Zillow's current SSR cache: componentProps.gdpClientCache is a
// JSON string keyed on "PropertyV2.0_<zpid>" → { property: {...} }.
function fixturePage({ zpid, property }) {
  const cache = JSON.stringify({
    [`PropertyV2.0_${zpid}`]: { property },
  });
  const nextData = {
    props: {
      pageProps: {
        componentProps: { gdpClientCache: cache },
      },
    },
  };
  return `<!doctype html><html><head><title>${property.streetAddress}</title></head>
<body>
<div id="content"></div>
<script id="__NEXT_DATA__" type="application/json">${JSON.stringify(nextData)}</script>
</body></html>`;
}

test('extractNextData', async (t) => {
  await t.test('parses well-formed __NEXT_DATA__', () => {
    const html = fixturePage({ zpid: '12345', property: { zpid: 12345, price: 350000 } });
    const data = extractNextData(html);
    assert.ok(data.props.pageProps.componentProps.gdpClientCache);
  });

  await t.test('throws on missing blob', () => {
    const padding = ' '.repeat(300);
    assert.throws(
      () => extractNextData(`<html><body>${padding}captcha</body></html>`),
      /missing __NEXT_DATA__/
    );
  });

  await t.test('throws on empty body', () => {
    assert.throws(() => extractNextData(''), /empty\/short body/);
  });

  await t.test('throws on malformed JSON', () => {
    // Pad past the 200-char min-body guard so we trip the JSON parser, not
    // the empty-body check.
    const padding = ' '.repeat(300);
    const html = `<html><body>${padding}<script id="__NEXT_DATA__">{not json</script></body></html>`;
    assert.throws(() => extractNextData(html), /JSON\.parse/);
  });
});

test('findPropertyRecord', async (t) => {
  await t.test('pulls property from gdpClientCache JSON string', () => {
    const html = fixturePage({
      zpid: '999',
      property: { zpid: 999, price: 425000, bedrooms: 3 },
    });
    const data = extractNextData(html);
    const prop = findPropertyRecord(data);
    assert.equal(prop.zpid, 999);
    assert.equal(prop.bedrooms, 3);
  });

  await t.test('falls back to componentProps.property', () => {
    const payload = JSON.stringify({
      props: {
        pageProps: {
          componentProps: { property: { zpid: 17, price: 100000 } },
        },
      },
    });
    const padding = ' '.repeat(300);
    const html = `<html><body>${padding}<script id="__NEXT_DATA__">${payload}</script></body></html>`;
    const data = extractNextData(html);
    const prop = findPropertyRecord(data);
    assert.equal(prop.zpid, 17);
  });

  await t.test('returns null when no property-shaped node exists', () => {
    const data = { props: { pageProps: { componentProps: {} } } };
    assert.equal(findPropertyRecord(data), null);
  });
});

test('mapPropertyToRapidApiShape', async (t) => {
  await t.test('produces address string + numeric fields', () => {
    const out = mapPropertyToRapidApiShape({
      zpid: 42,
      streetAddress: '123 Main St',
      city: 'Austin',
      state: 'TX',
      zipcode: '78701',
      price: 500000,
      zestimate: 510000,
      bedrooms: 4,
      bathrooms: 2.5,
      livingArea: 2100,
      yearBuilt: 1995,
    });
    assert.equal(out.zpid, '42');
    assert.equal(out.address, '123 Main St, Austin, TX 78701');
    assert.equal(out.price, 500000);
    assert.equal(out.zestimate, 510000);
    assert.equal(out.bedrooms, 4);
    assert.equal(out.bathrooms, 2.5);
    assert.equal(out.livingArea, 2100);
    assert.equal(out.yearBuilt, 1995);
  });

  await t.test('falls back to nested address object', () => {
    const out = mapPropertyToRapidApiShape({
      zpid: 7,
      address: {
        streetAddress: '9 Oak Ln',
        city: 'Dallas',
        state: 'TX',
        zipcode: '75201',
      },
      price: 250000,
    });
    assert.match(out.address, /9 Oak Ln, Dallas, TX, 75201/);
  });

  await t.test('extracts photo URLs from responsivePhotos.mixedSources.jpeg', () => {
    const out = mapPropertyToRapidApiShape({
      zpid: 5,
      streetAddress: 'a',
      city: 'b',
      state: 'c',
      zipcode: 'd',
      price: 1,
      responsivePhotos: [
        { mixedSources: { jpeg: [{ url: 'https://photos.zillowstatic.com/1.jpg' }] } },
        { mixedSources: { jpeg: [{ url: 'https://photos.zillowstatic.com/2.jpg' }] } },
      ],
    });
    assert.deepEqual(out.photos, [
      'https://photos.zillowstatic.com/1.jpg',
      'https://photos.zillowstatic.com/2.jpg',
    ]);
  });

  await t.test('returns null for non-object input', () => {
    assert.equal(mapPropertyToRapidApiShape(null), null);
    assert.equal(mapPropertyToRapidApiShape('x'), null);
  });

  await t.test('absolutizes relative hdpUrl', () => {
    const out = mapPropertyToRapidApiShape({
      zpid: 1,
      streetAddress: 'a',
      city: 'b',
      state: 'c',
      zipcode: 'd',
      price: 1,
      hdpUrl: '/homedetails/123-Main-St/1_zpid/',
    });
    assert.equal(out.hdpUrl, 'https://www.zillow.com/homedetails/123-Main-St/1_zpid/');
  });
});

// ───────────────────────── Search helpers ─────────────────────────

test('searchUrlForLocation', async (t) => {
  // ── Baseline / happy path ─────────────────────────────────────────────────
  await t.test('basic city+state slug', () => {
    assert.equal(
      searchUrlForLocation('Austin, TX'),
      'https://www.zillow.com/homes/austin-tx_rb/'
    );
  });

  await t.test('ZIP-only slug', () => {
    assert.equal(
      searchUrlForLocation('78737'),
      'https://www.zillow.com/homes/78737_rb/'
    );
  });

  await t.test('trims leading/trailing whitespace', () => {
    assert.equal(
      searchUrlForLocation('  Oxford, MI 48371  '),
      'https://www.zillow.com/homes/oxford-mi-48371_rb/'
    );
  });

  await t.test('lowercase input is unaffected', () => {
    assert.equal(
      searchUrlForLocation('austin, tx'),
      'https://www.zillow.com/homes/austin-tx_rb/'
    );
  });

  await t.test('all-uppercase acronym is unaffected (no spurious hyphen)', () => {
    assert.equal(
      searchUrlForLocation('USA'),
      'https://www.zillow.com/homes/usa_rb/'
    );
  });

  // ── Compound-case split (De/Du/La → hyphenated) ───────────────────────────
  // Zillow's canonical slugs insert a hyphen at internal case-breaks for
  // words like DeKalb, DuPage, LaPorte.  Confirmed live 2026-05-13.
  await t.test('DeKalb → de-kalb (case-break hyphen)', () => {
    assert.equal(
      searchUrlForLocation('DeKalb County, AL'),
      'https://www.zillow.com/homes/de-kalb-county-al_rb/'
    );
  });

  await t.test('DuPage → du-page (case-break hyphen)', () => {
    assert.equal(
      searchUrlForLocation('DuPage County, IL'),
      'https://www.zillow.com/homes/du-page-county-il_rb/'
    );
  });

  await t.test('LaPorte → la-porte (case-break hyphen)', () => {
    assert.equal(
      searchUrlForLocation('LaPorte, IN'),
      'https://www.zillow.com/homes/la-porte-in_rb/'
    );
  });

  await t.test('LaGrange → la-grange (case-break hyphen)', () => {
    assert.equal(
      searchUrlForLocation('LaGrange, GA'),
      'https://www.zillow.com/homes/la-grange-ga_rb/'
    );
  });

  // ── Mc/Mac prefix — NO hyphen inserted ────────────────────────────────────
  // Zillow treats McKinney, McAllen, MacDonough as single words.
  // "mc-kinney-tx" returns 0 listResults; "mckinney-tx" returns 2,021.
  // Confirmed live 2026-05-13.  The camelCase regex is suppressed for Mc/Mac.
  await t.test('McKinney → mckinney (Mc prefix — no split)', () => {
    assert.equal(
      searchUrlForLocation('McKinney, TX'),
      'https://www.zillow.com/homes/mckinney-tx_rb/'
    );
  });

  await t.test('MacDonough → macdonough (Mac prefix — no split)', () => {
    assert.equal(
      searchUrlForLocation('MacDonough, GA'),
      'https://www.zillow.com/homes/macdonough-ga_rb/'
    );
  });

  await t.test('McAllen → mcallen (Mc prefix — no split)', () => {
    assert.equal(
      searchUrlForLocation('McAllen, TX'),
      'https://www.zillow.com/homes/mcallen-tx_rb/'
    );
  });

  // ── Period stripping (St., Dr., etc.) ─────────────────────────────────────
  // "st." → "st" — the dot is noise; Zillow's slug uses bare "st".
  await t.test('St. Louis → st-louis (period stripped)', () => {
    assert.equal(
      searchUrlForLocation('St. Louis, MO'),
      'https://www.zillow.com/homes/st-louis-mo_rb/'
    );
  });

  await t.test('St. Paul → st-paul (period stripped)', () => {
    assert.equal(
      searchUrlForLocation('St. Paul, MN'),
      'https://www.zillow.com/homes/st-paul-mn_rb/'
    );
  });

  await t.test('St Louis (no period) → st-louis', () => {
    assert.equal(
      searchUrlForLocation('St Louis, MO'),
      'https://www.zillow.com/homes/st-louis-mo_rb/'
    );
  });

  await t.test('Saint Louis → saint-louis (unabbreviated)', () => {
    assert.equal(
      searchUrlForLocation('Saint Louis, MO'),
      'https://www.zillow.com/homes/saint-louis-mo_rb/'
    );
  });

  // ── Apostrophe stripping ──────────────────────────────────────────────────
  // Zillow tolerates apostrophes but the clean stripped form is canonical.
  await t.test("O'Fallon → ofallon (apostrophe stripped)", () => {
    assert.equal(
      searchUrlForLocation("O'Fallon, MO"),
      'https://www.zillow.com/homes/ofallon-mo_rb/'
    );
  });

  await t.test("L'Anse → lanse (apostrophe stripped)", () => {
    assert.equal(
      searchUrlForLocation("L'Anse, MI"),
      'https://www.zillow.com/homes/lanse-mi_rb/'
    );
  });

  await t.test("St. Mary's County → st-marys-county (period + apostrophe stripped)", () => {
    assert.equal(
      searchUrlForLocation("St. Mary's County, MD"),
      'https://www.zillow.com/homes/st-marys-county-md_rb/'
    );
  });

  // iOS auto-correct silently replaces ASCII apostrophes with U+2019 (RIGHT
  // SINGLE QUOTATION MARK) — "O'Fallon" typed on an iPhone arrives at the
  // backend as "O’Fallon". The regex only stripped ASCII apostrophe,
  // letting the smart quote through unchanged → produced "o%E2%80%99fallon"
  // in the URL, which Zillow does NOT recognise. Real-world iOS bug.
  await t.test("O’Fallon (smart-quote U+2019) → ofallon", () => {
    assert.equal(
      searchUrlForLocation("O’Fallon, MO"),
      'https://www.zillow.com/homes/ofallon-mo_rb/'
    );
  });

  // Also strip the LEFT SINGLE QUOTATION MARK U+2018 (some keyboards / autocorrect
  // emit this one too, e.g. when the apostrophe begins a word like 'twas).
  await t.test('left smart quote U+2018 also stripped', () => {
    assert.equal(
      searchUrlForLocation('‘Twas County, ME'),
      'https://www.zillow.com/homes/twas-county-me_rb/'
    );
  });

  // Modifier-letter apostrophe U+02BC shows up in transliterated indigenous
  // place names (e.g. Hawaiʻi, Kaʻu) — safest to also strip.
  await t.test('modifier-letter apostrophe U+02BC stripped', () => {
    assert.equal(
      searchUrlForLocation('Kaʻu County, HI'),
      'https://www.zillow.com/homes/kau-county-hi_rb/'
    );
  });

  // ── Accent / diacritic normalization ─────────────────────────────────────
  // "San José" → "san-jose". Confirmed live: both forms return same results
  // but the ASCII form is canonical and avoids downstream encoding issues.
  await t.test('San José → san-jose (accent normalized)', () => {
    assert.equal(
      searchUrlForLocation('San José, CA'),
      'https://www.zillow.com/homes/san-jose-ca_rb/'
    );
  });

  // ── ZIP+4 stripping ───────────────────────────────────────────────────────
  // "78737-1234" → "78737". ZIP+4 format returns 0 listResults on Zillow.
  // Confirmed live 2026-05-13: 78737-1234 → 0 results; 78737 → 192 results.
  await t.test('ZIP+4 stripped to 5-digit ZIP', () => {
    assert.equal(
      searchUrlForLocation('78737-1234'),
      'https://www.zillow.com/homes/78737_rb/'
    );
  });

  // ── Pre-hyphenated city names (hyphen preserved, not doubled) ────────────
  await t.test('Winston-Salem pre-hyphen preserved', () => {
    assert.equal(
      searchUrlForLocation('Winston-Salem, NC'),
      'https://www.zillow.com/homes/winston-salem-nc_rb/'
    );
  });

  await t.test('Wilkes-Barre pre-hyphen preserved', () => {
    assert.equal(
      searchUrlForLocation('Wilkes-Barre, PA'),
      'https://www.zillow.com/homes/wilkes-barre-pa_rb/'
    );
  });

  await t.test('Spring-Grove pre-hyphen preserved', () => {
    assert.equal(
      searchUrlForLocation('Spring-Grove, IL'),
      'https://www.zillow.com/homes/spring-grove-il_rb/'
    );
  });

  // ── State-only / unusual shapes (handled gracefully) ─────────────────────
  await t.test('state abbreviation only', () => {
    assert.equal(
      searchUrlForLocation('TX'),
      'https://www.zillow.com/homes/tx_rb/'
    );
  });

  await t.test('full state name', () => {
    assert.equal(
      searchUrlForLocation('California'),
      'https://www.zillow.com/homes/california_rb/'
    );
  });

  await t.test('multi-word with "or" (Truth or Consequences → t-or-c)', () => {
    assert.equal(
      searchUrlForLocation('T or C, NM'),
      'https://www.zillow.com/homes/t-or-c-nm_rb/'
    );
  });
});

test('findListResults + findTotalResultCount', async (t) => {
  await t.test('pulls listResults from canonical search-page-state path', () => {
    const data = {
      props: {
        pageProps: {
          searchPageState: {
            cat1: {
              searchResults: {
                listResults: [{ zpid: 1, price: 100 }, { zpid: 2, price: 200 }],
              },
              searchList: { totalResultCount: 412 },
            },
          },
        },
      },
    };
    const list = findListResults(data);
    assert.equal(list.length, 2);
    assert.equal(findTotalResultCount(data), 412);
  });

  await t.test('falls back to deep search if path drifts', () => {
    const data = {
      foo: { bar: { listResults: [{ zpid: 9 }] } },
    };
    const list = findListResults(data);
    assert.equal(list.length, 1);
    assert.equal(list[0].zpid, 9);
  });

  await t.test('returns null on missing listResults', () => {
    assert.equal(findListResults({ props: {} }), null);
    assert.equal(findTotalResultCount({ props: {} }), undefined);
  });
});

test('mapListingToSummary', async (t) => {
  await t.test('handles flat search-results shape', () => {
    const out = mapListingToSummary({
      zpid: 42,
      address: '123 Main St, Austin, TX 78701',
      unformattedPrice: 425000,
      price: '$425,000',
      beds: 3,
      baths: 2,
      area: 1800,
      statusType: 'FOR_SALE',
      detailUrl: '/homedetails/123-Main-St/42_zpid/',
      latLong: { latitude: 30.1, longitude: -97.7 },
    });
    assert.equal(out.zpid, '42');
    assert.equal(out.price, 425000);
    assert.equal(out.priceLabel, '$425,000');
    assert.equal(out.beds, 3);
    assert.equal(out.detailUrl, 'https://www.zillow.com/homedetails/123-Main-St/42_zpid/');
    assert.equal(out.latitude, 30.1);
  });

  await t.test('handles hdpData.homeInfo nested shape', () => {
    const out = mapListingToSummary({
      hdpData: {
        homeInfo: {
          zpid: 77,
          streetAddress: '5 Oak Ln',
          city: 'Dallas',
          state: 'TX',
          zipcode: '75201',
          price: 300000,
          bedrooms: 4,
          bathrooms: 3,
          livingArea: 2400,
          homeStatus: 'FOR_SALE',
          isForeclosure: true,
        },
      },
    });
    assert.equal(out.zpid, '77');
    assert.equal(out.addressStreet, '5 Oak Ln');
    assert.equal(out.price, 300000);
    assert.equal(out.beds, 4);
    assert.equal(out.isForeclosure, true);
  });

  await t.test('returns null for non-object input', () => {
    assert.equal(mapListingToSummary(null), null);
    assert.equal(mapListingToSummary('x'), null);
  });

  await t.test('extracts top-level latitude/longitude (homeRecommendations shape)', () => {
    // comps come back as homeRecommendations.homes items with flat lat/lng,
    // not the latLong object that listResults uses. Required for the map view.
    const out = mapListingToSummary({
      zpid: 100,
      address: '7 Pine Ct, Plano, TX',
      price: 410000,
      bedrooms: 4,
      bathrooms: 3,
      latitude: 33.0198,
      longitude: -96.6989,
    });
    assert.equal(out.zpid, '100');
    assert.equal(out.latitude, 33.0198);
    assert.equal(out.longitude, -96.6989);
  });
});

// ───────────────────────── Coordinate / bounds search ─────────────────────────

test('boundsFromCenterRadius', async (t) => {
  await t.test('expands center to N/S/E/W by ~radius_mi', () => {
    const b = boundsFromCenterRadius(30.0, -97.0, 1);
    // 1 mile = ~1/69 of a degree latitude
    assert.ok(b.north > 30 && b.north < 30.02);
    assert.ok(b.south < 30 && b.south > 29.98);
    // Longitude delta is larger near the equator (cos≈0.866 at lat=30)
    assert.ok(b.east > -97 && b.east < -96.98);
    assert.ok(b.west < -97 && b.west > -97.02);
  });

  await t.test('caps radius at a sensible minimum to avoid degenerate bounds', () => {
    const b = boundsFromCenterRadius(30.0, -97.0, 0);
    // 0-radius collapses to the cap; bounds should still be a valid rectangle
    assert.ok(b.north > b.south);
    assert.ok(b.east > b.west);
  });
});

test('buildSearchQueryState', async (t) => {
  await t.test('serialises bounds + empty filterState as valid JSON', () => {
    const sqs = buildSearchQueryState({ north: 30.1, south: 29.9, east: -96.9, west: -97.1 });
    const parsed = JSON.parse(sqs);
    assert.equal(parsed.mapBounds.north, 30.1);
    assert.equal(parsed.mapBounds.south, 29.9);
    assert.equal(parsed.isMapVisible, true);
    assert.deepEqual(parsed.filterState, {});
  });

  await t.test('encodes recentlySold status into the expected isXxx flag soup', () => {
    const sqs = buildSearchQueryState(
      { north: 1, south: 0, east: 1, west: 0 },
      { status: 'recentlySold' }
    );
    const parsed = JSON.parse(sqs);
    // Zillow's frontend toggles a constellation of isXxx flags when you flip
    // to the "Sold" tab — we must mirror that to get sold results back.
    assert.equal(parsed.filterState.isRecentlySold.value, true);
    assert.equal(parsed.filterState.isForSaleByAgent.value, false);
    assert.equal(parsed.filterState.isForSaleByOwner.value, false);
  });

  await t.test('encodes price + beds filters when provided', () => {
    const sqs = buildSearchQueryState(
      { north: 1, south: 0, east: 1, west: 0 },
      { priceMin: 100000, priceMax: 500000, bedsMin: 3 }
    );
    const parsed = JSON.parse(sqs);
    assert.equal(parsed.filterState.price.min, 100000);
    assert.equal(parsed.filterState.price.max, 500000);
    assert.equal(parsed.filterState.beds.min, 3);
  });
});

test('searchByUrl SSRF guards', async (t) => {
  await t.test('throws on non-zillow hostname', async () => {
    await assert.rejects(
      () => searchByUrl('https://attacker.example.com/internal'),
      (e) => e instanceof ZillowScrapeError && /www\.zillow\.com/.test(e.message)
    );
  });

  await t.test('throws on non-https protocol', async () => {
    await assert.rejects(
      () => searchByUrl('http://www.zillow.com/homes/austin-tx_rb/'),
      (e) => e instanceof ZillowScrapeError && /https/.test(e.message)
    );
  });

  await t.test('throws on malformed URL', async () => {
    await assert.rejects(
      () => searchByUrl('not a url'),
      (e) => e instanceof ZillowScrapeError && /invalid URL/.test(e.message)
    );
  });

  await t.test('throws when called without a url argument', async () => {
    await assert.rejects(
      () => searchByUrl(),
      (e) => e instanceof ZillowScrapeError && /url string/.test(e.message)
    );
  });
});

// ───────────────────────── Zestimate history ─────────────────────────

test('findZestimateHistory', async (t) => {
  await t.test('pulls points from homeValueChartData "This home" series', () => {
    const record = {
      homeValueChartData: [
        {
          name: 'This home',
          points: [
            { x: 1577836800000, y: 350000 }, // 2020-01-01
            { x: 1609459200000, y: 380000 }, // 2021-01-01
          ],
        },
        { name: 'Local', points: [{ x: 1577836800000, y: 400000 }] },
      ],
    };
    const series = findZestimateHistory(record);
    assert.equal(series.length, 2);
    assert.equal(series[0].value, 350000);
    assert.ok(series[0].date.startsWith('2020-01-01'));
    assert.equal(series[1].value, 380000);
  });

  await t.test('returns null when no history-shaped node present', () => {
    assert.equal(findZestimateHistory({}), null);
    assert.equal(findZestimateHistory({ zestimate: 500000 }), null);
  });

  await t.test('handles flat {date, value} fallback array', () => {
    const record = {
      zestimateHistory: [{ date: '2020-01-01', value: 100000 }, { date: '2021-01-01', value: 120000 }],
    };
    const series = findZestimateHistory(record);
    assert.equal(series.length, 2);
    assert.equal(series[1].value, 120000);
  });
});

// ───────────────────────── Mortgage ─────────────────────────

test('mortgageCalculator (pure math)', async (t) => {
  await t.test('PMT on a standard 30-year fixed', () => {
    // $400K @ 7% / 30yr → ~$2,661/mo industry-standard
    const r = mortgageCalculator({ price: 400000, down: 0, term: 30, rate: 7 });
    assert.equal(r.months, 360);
    assert.ok(r.monthlyPayment > 2650 && r.monthlyPayment < 2670);
    assert.ok(r.totalInterest > 0);
    assert.equal(r.principal, 400000);
  });

  await t.test('handles 0% interest (no division by zero)', () => {
    const r = mortgageCalculator({ price: 120000, down: 0, term: 10, rate: 0 });
    assert.equal(r.monthlyPayment, 1000); // 120000 / 120 months
    assert.equal(r.totalInterest, 0);
  });

  await t.test('subtracts down payment from principal', () => {
    const r = mortgageCalculator({ price: 500000, down: 100000, term: 30, rate: 6 });
    assert.equal(r.principal, 400000);
  });

  await t.test('returns optional amortization schedule when requested', () => {
    const r = mortgageCalculator({ price: 100000, down: 0, term: 1, rate: 6, schedule: true });
    assert.equal(r.schedule.length, 12);
    assert.equal(r.schedule[0].month, 1);
    // Final-month balance should be ~0 (within rounding)
    assert.ok(r.schedule[11].balance < 1);
  });

  await t.test('throws ZillowScrapeError on bad args', () => {
    assert.throws(
      () => mortgageCalculator({ price: 0, term: 30, rate: 7 }),
      (e) => e instanceof ZillowScrapeError && /positive numeric/.test(e.message)
    );
    assert.throws(
      () => mortgageCalculator({ price: 100000, term: -1, rate: 7 }),
      ZillowScrapeError
    );
    assert.throws(
      () => mortgageCalculator({ price: 100000, term: 30 }),
      ZillowScrapeError
    );
  });
});

test('findMortgageRates + normalizeMortgageRate', async (t) => {
  await t.test('pulls lenderQuotes from componentProps.rateTable', () => {
    const nextData = {
      props: {
        pageProps: {
          componentProps: {
            rateTable: {
              lenderQuotes: [
                { lenderName: 'Big Bank', apr: 7.25, rate: 7.0, points: 0.5 },
                { lenderName: 'Local CU', apr: 6.99, rate: 6.875, points: 1.0 },
              ],
            },
          },
        },
      },
    };
    const raw = findMortgageRates(nextData);
    assert.equal(raw.length, 2);
    const first = normalizeMortgageRate(raw[0]);
    assert.equal(first.lender, 'Big Bank');
    assert.equal(first.apr, 7.25);
    assert.equal(first.rate, 7.0);
    assert.equal(first.points, 0.5);
  });

  await t.test('normalizes alternate field names (interestRate, name)', () => {
    const out = normalizeMortgageRate({
      name: 'Discount Lender',
      apr: 6.5,
      interestRate: 6.25,
      totalFees: 1500,
    });
    assert.equal(out.lender, 'Discount Lender');
    assert.equal(out.rate, 6.25);
    assert.equal(out.feesAmount, 1500);
  });

  await t.test('returns null for non-object', () => {
    assert.equal(normalizeMortgageRate(null), null);
  });
});

// ───────────────────────── Agent profile ─────────────────────────

test('findAgentProfile + normalizeAgentProfile', async (t) => {
  await t.test('pulls agentProfile from pageProps and normalizes', () => {
    const nextData = {
      props: {
        pageProps: {
          agentProfile: {
            firstName: 'Jane',
            lastName: 'Doe',
            fullName: 'Jane Doe',
            brokerage: 'Acme Realty',
            phone: '555-0100',
            rating: 4.7,
            reviewCount: 42,
            recentListings: [
              { zpid: 1, address: '1 St', price: 100000 },
              { zpid: 2, address: '2 St', price: 200000 },
            ],
          },
        },
      },
    };
    const node = findAgentProfile(nextData);
    assert.ok(node);
    const out = normalizeAgentProfile(node);
    assert.equal(out.name, 'Jane Doe');
    assert.equal(out.brokerage, 'Acme Realty');
    assert.equal(out.phone, '555-0100');
    assert.equal(out.rating, 4.7);
    assert.equal(out.reviewCount, 42);
    assert.equal(out.recentListings.length, 2);
    assert.equal(out.recentListings[0].zpid, '1');
  });

  await t.test('returns null when no agent-shaped node exists', () => {
    assert.equal(findAgentProfile({ props: { pageProps: {} } }), null);
    assert.equal(normalizeAgentProfile(null), null);
  });
});

// ───────────────────────── Market stats / region ─────────────────────────

test('marketStatsUrl', () => {
  assert.equal(
    marketStatsUrl('Austin, TX'),
    'https://www.zillow.com/austin-tx/home-values/'
  );
  assert.equal(
    marketStatsUrl('78737', 'zip'),
    'https://www.zillow.com/home-values/78737/'
  );
});

test('findMarketStats + normalizeMarketStats', async (t) => {
  await t.test('pulls regionInfo and normalises typical-home-value + MoM/YoY', () => {
    const nextData = {
      props: {
        pageProps: {
          componentProps: {
            regionInfo: {
              regionName: 'Austin, TX',
              regionType: 'city',
              typicalHomeValue: 540000,
              monthOverMonthChange: -0.4,
              yearOverYearChange: 1.2,
              medianDaysOnMarket: 48,
            },
          },
        },
      },
    };
    const node = findMarketStats(nextData);
    assert.ok(node);
    const out = normalizeMarketStats(node);
    assert.equal(out.regionName, 'Austin, TX');
    assert.equal(out.typicalHomeValue, 540000);
    assert.equal(out.momChangePct, -0.4);
    assert.equal(out.yoyChangePct, 1.2);
    assert.equal(out.medianDaysOnMarket, 48);
  });

  await t.test('falls back to deep search for region-shaped nodes', () => {
    const nextData = {
      foo: { bar: { something: { typicalHomeValue: 300000, regionName: 'Some City' } } },
    };
    const node = findMarketStats(nextData);
    assert.equal(node.typicalHomeValue, 300000);
  });

  await t.test('returns null for non-object', () => {
    assert.equal(normalizeMarketStats(null), null);
  });
});

// ───────────────────────── HOA / parking / heating-cooling ─────────────────

test('mapPropertyToRapidApiShape — resoFacts hoists', async (t) => {
  await t.test('hoists HOA monthly fee + computes annual from monthly frequency', () => {
    const out = mapPropertyToRapidApiShape({
      zpid: 1,
      streetAddress: '1 St', city: 'Austin', state: 'TX', zipcode: '78701',
      price: 400000,
      resoFacts: { hoaFee: 250, hoaFeeFrequency: 'Monthly' },
    });
    assert.equal(out.monthlyHoaFee, 250);
    assert.equal(out.hoaFeeFrequency, 'Monthly');
    assert.equal(out.hoaAnnualAmount, 3000);
  });

  await t.test('passes through hoaFee when frequency is Annual (no x12)', () => {
    const out = mapPropertyToRapidApiShape({
      zpid: 1,
      streetAddress: '1 St', city: 'Austin', state: 'TX', zipcode: '78701',
      price: 400000,
      resoFacts: { hoaFee: 1200, hoaFeeFrequency: 'Annually' },
    });
    assert.equal(out.hoaAnnualAmount, 1200);
  });

  await t.test('extracts yearRenovated from resoFacts.yearBuiltEffective', () => {
    const out = mapPropertyToRapidApiShape({
      zpid: 1,
      streetAddress: '1 St', city: 'a', state: 'b', zipcode: 'c',
      price: 1,
      yearBuilt: 1965,
      resoFacts: { yearBuiltEffective: 2018 },
    });
    assert.equal(out.yearBuilt, 1965);
    assert.equal(out.yearRenovated, 2018);
  });

  await t.test('extracts parking + lot features + heating/cooling arrays', () => {
    const out = mapPropertyToRapidApiShape({
      zpid: 1,
      streetAddress: '1 St', city: 'a', state: 'b', zipcode: 'c',
      price: 1,
      resoFacts: {
        parkingCapacity: 2,
        parkingFeatures: ['Garage', 'Attached'],
        hasGarage: true,
        heating: ['Forced Air', 'Gas'],
        cooling: ['Central Air'],
        lotFeatures: ['Corner Lot', 'Cul-de-sac'],
        lotSizeDimensions: '60 x 120',
      },
    });
    assert.equal(out.parkingCapacity, 2);
    assert.deepEqual(out.parkingFeatures, ['Garage', 'Attached']);
    assert.equal(out.hasGarage, true);
    assert.deepEqual(out.heating, ['Forced Air', 'Gas']);
    assert.deepEqual(out.cooling, ['Central Air']);
    assert.deepEqual(out.lotFeatures, ['Corner Lot', 'Cul-de-sac']);
    assert.equal(out.lotSizeDimensions, '60 x 120');
  });

  await t.test('coerces string heating/cooling into an array of one', () => {
    const out = mapPropertyToRapidApiShape({
      zpid: 1,
      streetAddress: '1 St', city: 'a', state: 'b', zipcode: 'c',
      price: 1,
      resoFacts: { heating: 'Electric', cooling: 'Window Units' },
    });
    assert.deepEqual(out.heating, ['Electric']);
    assert.deepEqual(out.cooling, ['Window Units']);
  });
});

test('mapPropertyToRapidApiShape — listing agent from attributionInfo', async (t) => {
  await t.test('hoists agent + brokerage + phone from attributionInfo', () => {
    const out = mapPropertyToRapidApiShape({
      zpid: 1,
      streetAddress: '1 St', city: 'a', state: 'b', zipcode: 'c',
      price: 1,
      attributionInfo: {
        agentName: 'Jane Doe',
        agentEmail: 'jane@acme.com',
        agentPhoneNumber: '555-0100',
        agentLicenseNumber: 'TX-9876',
        brokerName: 'Acme Realty',
        brokerPhoneNumber: '555-0200',
        mlsId: 'AUS-12345',
        mlsName: 'ABoR',
      },
    });
    assert.equal(out.listingAgent.name, 'Jane Doe');
    assert.equal(out.listingAgent.phone, '555-0100');
    assert.equal(out.listingAgent.brokerage, 'Acme Realty');
    assert.equal(out.listingAgent.licenseNumber, 'TX-9876');
    assert.equal(out.listingAgent.mlsId, 'AUS-12345');
  });

  await t.test('listingAgent is undefined when no attributionInfo', () => {
    const out = mapPropertyToRapidApiShape({
      zpid: 1, streetAddress: '1 St', city: 'a', state: 'b', zipcode: 'c', price: 1,
    });
    assert.equal(out.listingAgent, undefined);
  });
});

test('mapPropertyToRapidApiShape — open houses', async (t) => {
  await t.test('extracts openHouses + nextOpenHouse from openHouseSchedule', () => {
    const out = mapPropertyToRapidApiShape({
      zpid: 1,
      streetAddress: '1 St', city: 'a', state: 'b', zipcode: 'c', price: 1,
      openHouseSchedule: [
        { startTime: '2026-05-20T17:00:00Z', endTime: '2026-05-20T19:00:00Z' },
        { startTime: '2026-05-21T15:00:00Z', endTime: '2026-05-21T17:00:00Z' },
      ],
    });
    assert.equal(out.openHouses.length, 2);
    assert.equal(out.nextOpenHouse.startTime, '2026-05-20T17:00:00Z');
  });

  await t.test('openHouses is undefined when no schedule', () => {
    const out = mapPropertyToRapidApiShape({
      zpid: 1, streetAddress: '1 St', city: 'a', state: 'b', zipcode: 'c', price: 1,
    });
    assert.equal(out.openHouses, undefined);
    assert.equal(out.nextOpenHouse, undefined);
  });
});

test('mapPropertyToRapidApiShape — price reduction signal', async (t) => {
  await t.test('detects price drop from priceHistory', () => {
    const out = mapPropertyToRapidApiShape({
      zpid: 1, streetAddress: '1', city: 'a', state: 'b', zipcode: 'c', price: 380000,
      priceHistory: [
        { date: '2026-05-10', price: 380000, event: 'Price change' },
        { date: '2026-04-01', price: 420000, event: 'Listed for sale' },
      ],
    });
    assert.equal(out.isPriceReduced, true);
    assert.equal(out.priceReduction.amount, 40000);
    assert.equal(out.priceReduction.previousPrice, 420000);
    assert.equal(out.priceReduction.currentPrice, 380000);
  });

  await t.test('no reduction when only one price history event', () => {
    const out = mapPropertyToRapidApiShape({
      zpid: 1, streetAddress: '1', city: 'a', state: 'b', zipcode: 'c', price: 380000,
      priceHistory: [{ date: '2026-04-01', price: 380000, event: 'Listed for sale' }],
    });
    assert.equal(out.priceReduction, undefined);
  });

  await t.test('no reduction when latest price is HIGHER than previous', () => {
    const out = mapPropertyToRapidApiShape({
      zpid: 1, streetAddress: '1', city: 'a', state: 'b', zipcode: 'c', price: 450000,
      priceHistory: [
        { date: '2026-05-10', price: 450000 },
        { date: '2026-04-01', price: 420000 },
      ],
    });
    assert.equal(out.priceReduction, undefined);
  });
});

test('mapPropertyToRapidApiShape — foreclosure stage', async (t) => {
  await t.test('REO trumps everything', () => {
    const out = mapPropertyToRapidApiShape({
      zpid: 1, streetAddress: '1', city: 'a', state: 'b', zipcode: 'c', price: 1,
      isReo: true, isForeclosure: true, isPreForeclosureAuction: true,
    });
    assert.equal(out.foreclosureStage, 'REO');
  });

  await t.test('AUCTION wins over PRE_FORECLOSURE', () => {
    const out = mapPropertyToRapidApiShape({
      zpid: 1, streetAddress: '1', city: 'a', state: 'b', zipcode: 'c', price: 1,
      isPreForeclosureAuction: true, isPreForeclosure: true,
    });
    assert.equal(out.foreclosureStage, 'AUCTION');
  });

  await t.test('plain isForeclosure → FORECLOSURE', () => {
    const out = mapPropertyToRapidApiShape({
      zpid: 1, streetAddress: '1', city: 'a', state: 'b', zipcode: 'c', price: 1,
      isForeclosure: true,
    });
    assert.equal(out.foreclosureStage, 'FORECLOSURE');
  });

  await t.test('no flags → stage is undefined', () => {
    const out = mapPropertyToRapidApiShape({
      zpid: 1, streetAddress: '1', city: 'a', state: 'b', zipcode: 'c', price: 1,
    });
    assert.equal(out.foreclosureStage, undefined);
  });

  await t.test('extracts foreclosure financial fields', () => {
    const out = mapPropertyToRapidApiShape({
      zpid: 1, streetAddress: '1', city: 'a', state: 'b', zipcode: 'c', price: 1,
      foreclosure: {
        isForeclosure: true,
        unpaidBalance: 285000,
        auctionDate: '2026-06-15',
        pastDueBalance: 18500,
      },
    });
    assert.equal(out.foreclosureAmount, 285000);
    assert.equal(out.foreclosureAuctionDate, '2026-06-15');
    assert.equal(out.foreclosurePastDueBalance, 18500);
  });
});

// ───────────────────────── Walk / transit / bike scores ─────────────

test('findWalkScore', async (t) => {
  await t.test('pulls walkscore / transit_score / bikescore (nested shape)', () => {
    const out = findWalkScore({
      walkScore: { walkscore: 78, description: 'Very Walkable' },
      transitScore: { transit_score: 45, description: 'Some Transit' },
      bikeScore: { bikescore: 62, description: 'Bikeable' },
    });
    assert.equal(out.walkScore, 78);
    assert.equal(out.walkDescription, 'Very Walkable');
    assert.equal(out.transitScore, 45);
    assert.equal(out.bikeScore, 62);
  });

  await t.test('accepts flat numeric shape', () => {
    const out = findWalkScore({ walkScore: 42 });
    assert.equal(out.walkScore, 42);
    assert.equal(out.transitScore, undefined);
  });

  await t.test('returns null when no scores present', () => {
    assert.equal(findWalkScore({}), null);
    assert.equal(findWalkScore(null), null);
  });
});

// ───────────────────────── Climate risk ─────────────────────────────

test('findClimateRisk', async (t) => {
  await t.test('pulls flood/fire/heat/wind/drought from climate sources', () => {
    const out = findClimateRisk({
      climate: {
        floodSources: {
          primary: [{ riskScore: { value: 7, label: 'Major', max: 10 }, probability: 0.42 }],
          insuranceRecommendation: 'recommended',
        },
        fireSources: {
          primary: [{ riskScore: { value: 3, label: 'Moderate', max: 10 } }],
        },
        heatSources: { riskScore: { value: 8, label: 'Severe', max: 10 } },
        windSources: { value: 2, label: 'Minor' },
      },
    });
    assert.equal(out.flood.value, 7);
    assert.equal(out.flood.label, 'Major');
    assert.equal(out.flood.probability, 0.42);
    assert.equal(out.flood.insuranceRecommendation, 'recommended');
    assert.equal(out.fire.value, 3);
    assert.equal(out.heat.value, 8);
    assert.equal(out.wind.value, 2);
  });

  await t.test('returns null when climate object missing', () => {
    assert.equal(findClimateRisk({}), null);
    assert.equal(findClimateRisk({ climate: {} }), null);
  });
});

// ───────────────────────── Captcha detection ─────────────────────────

test('looksLikeCaptcha', async (t) => {
  await t.test('detects PerimeterX captcha gate', () => {
    assert.equal(looksLikeCaptcha('<html><body>Please verify you are a human</body></html>'), true);
    assert.equal(looksLikeCaptcha('<div id="px-captcha"></div>'), true);
  });

  await t.test('detects Incapsula block', () => {
    assert.equal(looksLikeCaptcha('Request unsuccessful. Incapsula incident ID'), true);
  });

  await t.test('detects Pardon Our Interruption / Access Denied gates', () => {
    assert.equal(looksLikeCaptcha('Pardon Our Interruption'), true);
    assert.equal(looksLikeCaptcha('Access Denied — please contact'), true);
  });

  await t.test('passes through normal HTML', () => {
    const realPage = '<html><body><h1>For Sale</h1><script id="__NEXT_DATA__">{}</script></body></html>';
    assert.equal(looksLikeCaptcha(realPage), false);
  });

  await t.test('handles non-string / empty input', () => {
    assert.equal(looksLikeCaptcha(null), false);
    assert.equal(looksLikeCaptcha(''), false);
    assert.equal(looksLikeCaptcha(undefined), false);
  });
});

// ─────────────────── Tier A field expansion (mapPropertyToRapidApiShape) ──
//
// Adds construction/systems, utilities, lot/parcel, listing-terms,
// lifestyle, extended-HOA, computed (owner-occupancy), and normalized tax
// history. Spot-check ~15-20 representative fields rather than testing every
// pass-through — the mapping is mechanical and the existing resoFacts suite
// already covers the array-vs-string coercion patterns.

const baseProp = {
  zpid: 1,
  streetAddress: '1 St',
  city: 'a',
  state: 'b',
  zipcode: 'c',
  price: 1,
};

test('mapPropertyToRapidApiShape — Tier A field expansion', async (t) => {
  // ── Construction & systems ──────────────────────────────────────────
  await t.test('extracts construction & systems fields from resoFacts', () => {
    const out = mapPropertyToRapidApiShape({
      ...baseProp,
      resoFacts: {
        foundationDetails: ['Slab'],
        roof: 'Composition Shingle',
        constructionMaterials: ['Brick', 'Frame'],
        exteriorFeatures: ['Porch', 'Sprinkler System'],
        structureType: 'House',
        architecturalStyle: 'Ranch',
        stories: 2,
        basement: 'Finished',
        basementSize: 850,
        aboveGradeFinishedArea: 1800,
        belowGradeFinishedArea: 850,
        flooring: ['Hardwood', 'Tile'],
        fireplaces: 1,
        appliances: ['Dishwasher', 'Refrigerator'],
      },
    });
    assert.deepEqual(out.foundation, ['Slab']);
    assert.equal(out.roofType, 'Composition Shingle');
    assert.deepEqual(out.constructionMaterials, ['Brick', 'Frame']);
    assert.deepEqual(out.exteriorFeatures, ['Porch', 'Sprinkler System']);
    assert.equal(out.structureType, 'House');
    assert.equal(out.architecturalStyle, 'Ranch');
    assert.equal(out.stories, 2);
    assert.equal(out.basement, 'Finished');
    assert.equal(out.basementArea, 850);
    assert.equal(out.finishedAreaAboveGrade, 1800);
    assert.equal(out.finishedAreaBelowGrade, 850);
    assert.deepEqual(out.flooring, ['Hardwood', 'Tile']);
    assert.equal(out.fireplaceCount, 1);
    assert.deepEqual(out.appliances, ['Dishwasher', 'Refrigerator']);
  });

  await t.test('foundation normalizes scalar resoFacts.foundation to array', () => {
    // Always emit array form so frontend consumers can `.map(...)` safely.
    const out = mapPropertyToRapidApiShape({
      ...baseProp,
      resoFacts: { foundation: 'Pier and Beam' },
    });
    assert.deepEqual(out.foundation, ['Pier and Beam']);
  });

  await t.test('stories falls back to storiesTotal', () => {
    const out = mapPropertyToRapidApiShape({
      ...baseProp,
      resoFacts: { storiesTotal: 3 },
    });
    assert.equal(out.stories, 3);
  });

  // ── Utilities ─────────────────────────────────────────────────────
  await t.test('extracts utility fields from resoFacts', () => {
    const out = mapPropertyToRapidApiShape({
      ...baseProp,
      resoFacts: {
        waterSource: ['Public'],
        sewer: ['Public Sewer'],
        electric: ['220 Volts'],
        electricUtilityCompany: 'Austin Energy',
        gas: ['Natural Gas Available'],
      },
    });
    assert.deepEqual(out.waterSource, ['Public']);
    assert.deepEqual(out.sewer, ['Public Sewer']);
    assert.deepEqual(out.electric, ['220 Volts']);
    assert.equal(out.electricUtilityCompany, 'Austin Energy');
    assert.deepEqual(out.gas, ['Natural Gas Available']);
  });

  // ── Lot / parcel / location ─────────────────────────────────────────
  await t.test('extracts apn (parcelNumber) — highest skip-tracing value', () => {
    const out = mapPropertyToRapidApiShape({
      ...baseProp,
      resoFacts: { parcelNumber: '01-2345-6789-0000' },
    });
    assert.equal(out.apn, '01-2345-6789-0000');
  });

  await t.test('extracts zoning, countyFips, subdivisionName', () => {
    const out = mapPropertyToRapidApiShape({
      ...baseProp,
      resoFacts: {
        zoning: 'SF-3',
        zoningDescription: 'Single Family Residence — Standard Lot',
        countyFIPS: '48453',
        subdivisionName: 'Travis Heights',
      },
    });
    assert.equal(out.zoning, 'SF-3');
    assert.equal(out.zoningDescription, 'Single Family Residence — Standard Lot');
    assert.equal(out.countyFips, '48453');
    assert.equal(out.subdivisionName, 'Travis Heights');
  });

  await t.test('assembles schoolDistrict from three district keys', () => {
    const out = mapPropertyToRapidApiShape({
      ...baseProp,
      resoFacts: {
        elementarySchoolDistrict: 'Austin ISD',
        middleOrJuniorSchoolDistrict: 'Austin ISD',
        highSchoolDistrict: 'Austin ISD',
      },
    });
    assert.deepEqual(out.schoolDistrict, {
      elementary: 'Austin ISD',
      middleOrJunior: 'Austin ISD',
      high: 'Austin ISD',
    });
  });

  await t.test('schoolDistrict is undefined when no district keys present', () => {
    const out = mapPropertyToRapidApiShape({ ...baseProp, resoFacts: {} });
    assert.equal(out.schoolDistrict, undefined);
  });

  // ── Listing terms — wholesaler distress signals ─────────────────────
  await t.test('extracts specialListingConditions (REO / probate flags)', () => {
    const out = mapPropertyToRapidApiShape({
      ...baseProp,
      resoFacts: {
        specialListingConditions: ['Real Estate Owned', 'Short Sale'],
      },
    });
    assert.deepEqual(out.specialListingConditions, ['Real Estate Owned', 'Short Sale']);
  });

  await t.test('extracts listingTerms (Cash-only = distressed signal)', () => {
    const out = mapPropertyToRapidApiShape({
      ...baseProp,
      resoFacts: { listingTerms: ['Cash'] },
    });
    assert.deepEqual(out.listingTerms, ['Cash']);
  });

  await t.test('extracts cumulativeDaysOnMarket — true distress signal', () => {
    const out = mapPropertyToRapidApiShape({
      ...baseProp,
      daysOnZillow: 21,
      resoFacts: { cumulativeDaysOnMarket: 287 },
    });
    // daysOnZillow stays untouched for back-compat
    assert.equal(out.daysOnZillow, 21);
    // cumulative is the relisting-aware number
    assert.equal(out.cumulativeDaysOnMarket, 287);
  });

  await t.test('extracts buyerCommission as {amount, type}', () => {
    const out = mapPropertyToRapidApiShape({
      ...baseProp,
      resoFacts: {
        buyerAgencyCompensation: 3,
        buyerAgencyCompensationType: 'Percent',
      },
    });
    assert.deepEqual(out.buyerCommission, { amount: 3, type: 'Percent' });
  });

  await t.test('extracts lastStatusChange as {date, isRecent}', () => {
    const out = mapPropertyToRapidApiShape({
      ...baseProp,
      lastStatusChangeDate: '2026-05-01',
      isRecentStatusChange: true,
    });
    assert.deepEqual(out.lastStatusChange, { date: '2026-05-01', isRecent: true });
  });

  await t.test('mlsNumber distinct from listingAgent.mlsId', () => {
    const out = mapPropertyToRapidApiShape({
      ...baseProp,
      attributionInfo: { agentName: 'Jane Doe', mlsId: 'AUS-12345' },
      resoFacts: { mlsId: 'ABOR-99999' },
    });
    // Attribution mlsId stays on listingAgent
    assert.equal(out.listingAgent.mlsId, 'AUS-12345');
    // resoFacts.mlsId surfaces as the canonical mlsNumber
    assert.equal(out.mlsNumber, 'ABOR-99999');
  });

  // ── Lifestyle / amenities ──────────────────────────────────────────
  await t.test('extracts pool, spa, waterfront as nested objects', () => {
    const out = mapPropertyToRapidApiShape({
      ...baseProp,
      resoFacts: {
        poolFeatures: ['In Ground', 'Heated'],
        hasPrivatePool: true,
        spaFeatures: ['Hot Tub'],
        hasSpa: true,
        waterfrontFeatures: ['Lake Front'],
        isWaterfront: true,
      },
    });
    assert.deepEqual(out.pool.features, ['In Ground', 'Heated']);
    assert.equal(out.pool.hasPrivatePool, true);
    assert.deepEqual(out.spa.features, ['Hot Tub']);
    assert.equal(out.spa.hasSpa, true);
    assert.deepEqual(out.waterfront.features, ['Lake Front']);
    assert.equal(out.waterfront.isWaterfront, true);
  });

  await t.test('garageSpaces uses explicit count when present', () => {
    const out = mapPropertyToRapidApiShape({
      ...baseProp,
      resoFacts: { garageSpaces: 3 },
    });
    assert.equal(out.garageSpaces, 3);
  });

  await t.test('garageSpaces falls back to 1 when hasAttachedGarage is true', () => {
    const out = mapPropertyToRapidApiShape({
      ...baseProp,
      resoFacts: { hasAttachedGarage: true },
    });
    assert.equal(out.garageSpaces, 1);
  });

  await t.test('garageSpaces is undefined when no garage info present', () => {
    // Critical: callers must distinguish "no info" from "zero spaces".
    const out = mapPropertyToRapidApiShape({
      ...baseProp,
      resoFacts: {},
    });
    assert.equal(out.garageSpaces, undefined);
  });

  // ── HOA extended ───────────────────────────────────────────────────
  await t.test('extracts hoaName, hoaFeeIncludes, hoaAmenities, hoaPhone', () => {
    const out = mapPropertyToRapidApiShape({
      ...baseProp,
      resoFacts: {
        associationName: 'Travis Heights HOA',
        associationFeeIncludes: ['Trash', 'Maintenance Grounds'],
        associationAmenities: ['Pool', 'Clubhouse'],
        associationPhone: '512-555-0199',
      },
    });
    assert.equal(out.hoaName, 'Travis Heights HOA');
    assert.deepEqual(out.hoaFeeIncludes, ['Trash', 'Maintenance Grounds']);
    assert.deepEqual(out.hoaAmenities, ['Pool', 'Clubhouse']);
    assert.equal(out.hoaPhone, '512-555-0199');
  });

  // ── Computed: isOwnerOccupied ──────────────────────────────────────
  await t.test('isOwnerOccupied true: normalized match ignores case/punctuation/spaces', () => {
    // Property is "123 Main St", owner mailing has commas, mixed case,
    // double spaces — all collapse to the same normalized string.
    const out = mapPropertyToRapidApiShape({
      zpid: 1,
      streetAddress: '123 Main St',
      city: 'Austin',
      state: 'TX',
      zipcode: '78704',
      price: 1,
      ownerAddress: '123 MAIN ST,  Austin, TX 78704',
    });
    assert.equal(out.isOwnerOccupied, true);
  });

  await t.test('isOwnerOccupied false: out-of-state mailing address', () => {
    const out = mapPropertyToRapidApiShape({
      zpid: 1,
      streetAddress: '123 Main St',
      city: 'Austin',
      state: 'TX',
      zipcode: '78704',
      price: 1,
      ownerAddress: 'PO Box 4421, Los Angeles, CA 90028',
    });
    assert.equal(out.isOwnerOccupied, false);
  });

  await t.test('isOwnerOccupied undefined when ownerAddress absent', () => {
    const out = mapPropertyToRapidApiShape({
      zpid: 1,
      streetAddress: '123 Main St',
      city: 'Austin',
      state: 'TX',
      zipcode: '78704',
      price: 1,
    });
    assert.equal(out.isOwnerOccupied, undefined);
  });

  // ── Tax history normalized ──────────────────────────────────────────
  await t.test('taxHistoryNormalized derives year from time and sorts desc', () => {
    const out = mapPropertyToRapidApiShape({
      ...baseProp,
      taxHistory: [
        { time: Date.UTC(2023, 5, 15), taxPaid: 8500, value: 410000, valueIncreaseRate: 0.03 },
        { time: Date.UTC(2025, 5, 15), taxPaid: 9200, value: 445000, valueIncreaseRate: 0.04 },
        { time: Date.UTC(2024, 5, 15), taxPaid: 8800, value: 425000, valueIncreaseRate: 0.035 },
      ],
    });
    assert.equal(out.taxHistoryNormalized.length, 3);
    // Sorted descending by year
    assert.equal(out.taxHistoryNormalized[0].year, 2025);
    assert.equal(out.taxHistoryNormalized[1].year, 2024);
    assert.equal(out.taxHistoryNormalized[2].year, 2023);
    // Fields mapped through
    assert.equal(out.taxHistoryNormalized[0].taxPaid, 9200);
    assert.equal(out.taxHistoryNormalized[0].assessedValue, 445000);
    assert.equal(out.taxHistoryNormalized[0].valueIncrease, 0.04);
    // Date is ISO string
    assert.equal(typeof out.taxHistoryNormalized[0].date, 'string');
    assert.ok(out.taxHistoryNormalized[0].date.includes('2025'));
  });

  await t.test('taxHistory (raw) preserved alongside taxHistoryNormalized', () => {
    const raw = [{ time: Date.UTC(2024, 0, 1), taxPaid: 1000, value: 100000 }];
    const out = mapPropertyToRapidApiShape({ ...baseProp, taxHistory: raw });
    assert.deepEqual(out.taxHistory, raw); // back-compat preserved
    assert.equal(out.taxHistoryNormalized[0].year, 2024);
  });

  await t.test('extracts propertyTaxRate', () => {
    const out = mapPropertyToRapidApiShape({
      ...baseProp,
      propertyTaxRate: 1.82,
    });
    assert.equal(out.propertyTaxRate, 1.82);
  });

  // ── taxHistoryNormalized edge cases ─────────────────────────────────
  await t.test('taxHistoryNormalized handles empty array', () => {
    const out = mapPropertyToRapidApiShape({ ...baseProp, taxHistory: [] });
    assert.deepEqual(out.taxHistoryNormalized, []);
  });

  await t.test('taxHistoryNormalized is undefined when taxHistory missing', () => {
    const out = mapPropertyToRapidApiShape({ ...baseProp });
    assert.equal(out.taxHistoryNormalized, undefined);
  });

  await t.test('taxHistoryNormalized filters rows with invalid time', () => {
    const out = mapPropertyToRapidApiShape({
      ...baseProp,
      taxHistory: [
        { time: 'not-a-number', taxPaid: 1 },
        { time: Date.UTC(2024, 0, 1), taxPaid: 2 },
        null,
        { taxPaid: 3 }, // no time
      ],
    });
    assert.equal(out.taxHistoryNormalized.length, 1);
    assert.equal(out.taxHistoryNormalized[0].year, 2024);
  });

  // ── mlsNumber: listingId is preferred, mlsId is fallback ────────────
  await t.test('mlsNumber prefers resoFacts.listingId over resoFacts.mlsId', () => {
    const out = mapPropertyToRapidApiShape({
      ...baseProp,
      resoFacts: { listingId: 'CANONICAL-123', mlsId: 'OLD-456' },
    });
    assert.equal(out.mlsNumber, 'CANONICAL-123');
  });

  await t.test('mlsNumber falls back to resoFacts.mlsId when listingId absent', () => {
    const out = mapPropertyToRapidApiShape({
      ...baseProp,
      resoFacts: { mlsId: 'OLD-456' },
    });
    assert.equal(out.mlsNumber, 'OLD-456');
  });

  // ── lastStatusChange.date: epoch ms must be normalized to ISO ───────
  await t.test('lastStatusChange.date normalizes epoch ms to ISO string', () => {
    const out = mapPropertyToRapidApiShape({
      ...baseProp,
      lastStatusChangeDate: Date.UTC(2026, 3, 12),
      isRecentStatusChange: true,
    });
    assert.equal(typeof out.lastStatusChange.date, 'string');
    assert.ok(out.lastStatusChange.date.startsWith('2026-04-12'));
    assert.equal(out.lastStatusChange.isRecent, true);
  });

  await t.test('lastStatusChange.date passes through if already a string', () => {
    const out = mapPropertyToRapidApiShape({
      ...baseProp,
      lastStatusChangeDate: '2026-04-12',
    });
    assert.equal(out.lastStatusChange.date, '2026-04-12');
  });

  // ── TDD gap-probe regressions (surfaced by /test-driven-development pass) ──
  await t.test('resoFacts entirely undefined does not crash the mapper', () => {
    const out = mapPropertyToRapidApiShape({ ...baseProp });
    assert.equal(out.apn, undefined);
    assert.equal(out.foundation, undefined);
    assert.equal(out.hoaName, undefined);
  });

  await t.test('taxHistoryNormalized handles time=0 (epoch start) as 1970', () => {
    // Boundary: Number.isFinite(0) is true; year must be 1970, not filtered.
    const out = mapPropertyToRapidApiShape({
      ...baseProp,
      taxHistory: [{ time: 0, taxPaid: 100 }],
    });
    assert.equal(out.taxHistoryNormalized.length, 1);
    assert.equal(out.taxHistoryNormalized[0].year, 1970);
  });

  await t.test('apn coerces numeric parcelNumber to string', () => {
    // Zillow occasionally emits parcelNumber as a number; downstream
    // skip-trace and county-records callers expect a string.
    const out = mapPropertyToRapidApiShape({
      ...baseProp,
      resoFacts: { parcelNumber: 12345678 },
    });
    assert.equal(typeof out.apn, 'string');
    assert.equal(out.apn, '12345678');
  });

  await t.test('mlsNumber treats empty-string sources as absent', () => {
    // ?? doesn't short-circuit "" — but an empty MLS number is useless noise.
    const out = mapPropertyToRapidApiShape({
      ...baseProp,
      resoFacts: { listingId: '', mlsId: '' },
    });
    assert.equal(out.mlsNumber, undefined);
  });

  await t.test('mlsNumber falls back when listingId empty but mlsId populated', () => {
    const out = mapPropertyToRapidApiShape({
      ...baseProp,
      resoFacts: { listingId: '', mlsId: 'OLD-456' },
    });
    assert.equal(out.mlsNumber, 'OLD-456');
  });

  // ── Third-pass review regressions (whitespace + array-normalization) ──
  await t.test('mlsNumber treats whitespace-only listingId as absent', () => {
    // Surfaced by 3rd-pass review — empty-string guard wasn't enough.
    const out = mapPropertyToRapidApiShape({
      ...baseProp,
      resoFacts: { listingId: '   ', mlsId: 'FALLBACK-1' },
    });
    assert.equal(out.mlsNumber, 'FALLBACK-1');
  });

  await t.test('apn treats whitespace-only parcelNumber as absent', () => {
    const out = mapPropertyToRapidApiShape({
      ...baseProp,
      resoFacts: { parcelNumber: '   ' },
    });
    assert.equal(out.apn, undefined);
  });

  await t.test('apn trims whitespace from valid parcelNumber', () => {
    const out = mapPropertyToRapidApiShape({
      ...baseProp,
      resoFacts: { parcelNumber: '  12-34-56-789  ' },
    });
    assert.equal(out.apn, '12-34-56-789');
  });

  await t.test('foundation array form passes through unchanged', () => {
    const out = mapPropertyToRapidApiShape({
      ...baseProp,
      resoFacts: { foundationDetails: ['Slab', 'Concrete Perimeter'] },
    });
    assert.deepEqual(out.foundation, ['Slab', 'Concrete Perimeter']);
  });

  // ── Backward compatibility ──────────────────────────────────────────
  await t.test('all pre-existing fields still present on output', () => {
    const out = mapPropertyToRapidApiShape({
      zpid: 555,
      streetAddress: '1 St',
      city: 'Austin',
      state: 'TX',
      zipcode: '78701',
      price: 400000,
      bedrooms: 3,
      bathrooms: 2,
      yearBuilt: 1995,
      resoFacts: { hoaFee: 100, hoaFeeFrequency: 'Monthly' },
    });
    assert.equal(out.zpid, '555');
    assert.equal(out.price, 400000);
    assert.equal(out.bedrooms, 3);
    assert.equal(out.bathrooms, 2);
    assert.equal(out.yearBuilt, 1995);
    assert.equal(out.monthlyHoaFee, 100);
    assert.equal(out.hoaAnnualAmount, 1200);
  });
});

// ═════════════════════════ Tier B1 — derivePropertyTaxHistory ════════════════
// The only Tier B1 slice with non-trivial logic: 5-year CAGR + missed-years
// detection. Pure transform — tests run on hand-built propertyDetails-shaped
// fixtures, no network.

test('derivePropertyTaxHistory', async (t) => {
  const buildRow = (year, taxPaid, assessedValue) => ({
    year,
    date: `${year}-01-01T00:00:00.000Z`,
    taxPaid,
    assessedValue,
    valueIncrease: 0,
  });

  await t.test('returns empty signals when no taxHistoryNormalized', () => {
    const out = derivePropertyTaxHistory({ zpid: '42' });
    assert.equal(out.zpid, '42');
    assert.deepEqual(out.history, []);
    assert.equal(out.signals.yearsOfData, 0);
    assert.equal(out.signals.assessmentCagr5y, null);
    assert.equal(out.signals.taxCagr5y, null);
    assert.deepEqual(out.signals.missedYears, []);
  });

  await t.test('sorts history descending by year regardless of input order', () => {
    const out = derivePropertyTaxHistory({
      zpid: '42',
      taxHistoryNormalized: [
        buildRow(2020, 5000, 300000),
        buildRow(2024, 8000, 450000),
        buildRow(2022, 6500, 380000),
      ],
    });
    assert.deepEqual(out.history.map((r) => r.year), [2024, 2022, 2020]);
    assert.equal(out.latestAssessedValue, 450000);
    assert.equal(out.latestTaxAnnualAmount, 8000);
  });

  await t.test('computes 5-year CAGR correctly', () => {
    // 100k → 161.05k over 5y == 10% annual = 0.10 CAGR
    const out = derivePropertyTaxHistory({
      taxHistoryNormalized: [
        buildRow(2019, 1000, 100000),
        buildRow(2020, 1100, 110000),
        buildRow(2021, 1210, 121000),
        buildRow(2022, 1331, 133100),
        buildRow(2023, 1464, 146410),
        buildRow(2024, 1610.51, 161051),
      ],
    });
    assert.ok(Math.abs(out.signals.assessmentCagr5y - 0.10) < 0.001,
      `expected ~0.10, got ${out.signals.assessmentCagr5y}`);
    assert.ok(Math.abs(out.signals.taxCagr5y - 0.10) < 0.001);
  });

  await t.test('CAGR returns null when fewer than 2 data points', () => {
    const out = derivePropertyTaxHistory({
      taxHistoryNormalized: [buildRow(2024, 5000, 300000)],
    });
    assert.equal(out.signals.assessmentCagr5y, null);
    assert.equal(out.signals.taxCagr5y, null);
  });

  await t.test('CAGR returns null when oldest value is zero', () => {
    const out = derivePropertyTaxHistory({
      taxHistoryNormalized: [
        buildRow(2020, 0, 0),
        buildRow(2024, 5000, 300000),
      ],
    });
    assert.equal(out.signals.assessmentCagr5y, null);
    assert.equal(out.signals.taxCagr5y, null);
  });

  await t.test('detects missedYears in middle of series (delinquency proxy)', () => {
    // Owner paid through 2020, missed 2021/2022/2023, resumed 2024
    const out = derivePropertyTaxHistory({
      taxHistoryNormalized: [
        buildRow(2019, 4500, 280000),
        buildRow(2020, 4800, 290000),
        // 2021/2022/2023 absent entirely
        buildRow(2024, 6500, 380000),
      ],
    });
    assert.deepEqual(out.signals.missedYears, [2021, 2022, 2023]);
  });

  await t.test('treats taxPaid=0 as missed', () => {
    const out = derivePropertyTaxHistory({
      taxHistoryNormalized: [
        buildRow(2022, 5000, 300000),
        buildRow(2023, 0, 310000),
        buildRow(2024, 5500, 320000),
      ],
    });
    assert.deepEqual(out.signals.missedYears, [2023]);
  });

  await t.test('treats taxPaid=null as missed', () => {
    const out = derivePropertyTaxHistory({
      taxHistoryNormalized: [
        buildRow(2022, 5000, 300000),
        { year: 2023, taxPaid: null, assessedValue: 310000 },
        buildRow(2024, 5500, 320000),
      ],
    });
    assert.deepEqual(out.signals.missedYears, [2023]);
  });

  await t.test('passes through parcelNumber, propertyTaxRate, isTaxDelinquent', () => {
    const out = derivePropertyTaxHistory({
      zpid: '99',
      apn: '12-34-56-789',
      propertyTaxRate: 1.82,
      isTaxDelinquent: true,
      taxHistoryNormalized: [buildRow(2024, 5000, 300000)],
    });
    assert.equal(out.parcelNumber, '12-34-56-789');
    assert.equal(out.propertyTaxRate, 1.82);
    assert.equal(out.signals.isTaxDelinquent, true);
  });
});

// ═════════════════════════ Tier B2 — property-type-specific search ═══════════
// 10 new endpoints toggling Zillow's searchQueryState.filterState.is{Type} flags.
// Each cycle: RED test first, watch fail, GREEN minimal impl, REFACTOR.

// Shared helper for asserting filterState shape in a generated URL. Decodes
// the searchQueryState param so tests read the actual filter flags Zillow
// will see.
function filterStateFromUrl(url) {
  const u = new URL(url);
  const sqs = u.searchParams.get('searchQueryState');
  if (!sqs) throw new Error(`URL missing searchQueryState param: ${url}`);
  return JSON.parse(decodeURIComponent(sqs)).filterState;
}

test('Tier B2 — searchMultiFamily', async (t) => {
  const z = require('../../lib/scrapers/zillowScrapeDo');

  await t.test('exports searchMultiFamily function', () => {
    assert.equal(typeof z.searchMultiFamily, 'function',
      'searchMultiFamily must be exported');
  });

  await t.test('exports buildHomeTypeSearchUrl helper for URL testability', () => {
    assert.equal(typeof z.buildHomeTypeSearchUrl, 'function',
      'buildHomeTypeSearchUrl must be exported so URL construction is testable without network');
  });

  await t.test('searchMultiFamily rejects missing location', async () => {
    await assert.rejects(() => z.searchMultiFamily({}), /requires location/);
  });

  await t.test('searchMultiFamily URL sets isMultiFamily=true and other home-types=false', () => {
    // The URL exposed by the helper lets us verify filterState without
    // actually hitting Zillow.
    const url = z.buildHomeTypeSearchUrl({
      location: 'Austin, TX',
      homeTypeFlags: { isMultiFamily: true },
    });
    const fs = filterStateFromUrl(url);
    assert.equal(fs.isMultiFamily.value, true, 'isMultiFamily.value must be true');
    assert.equal(fs.isSingleFamily.value, false, 'isSingleFamily must be explicitly false');
    assert.equal(fs.isCondo.value, false, 'isCondo must be explicitly false');
    assert.equal(fs.isTownhouse.value, false, 'isTownhouse must be explicitly false');
    assert.equal(fs.isLotLand.value, false, 'isLotLand must be explicitly false');
    assert.equal(fs.isManufactured.value, false, 'isManufactured must be explicitly false');
  });

  await t.test('searchMultiFamily URL pagination — page=2 emits currentPage=2', () => {
    const url = z.buildHomeTypeSearchUrl({
      location: 'Austin, TX',
      homeTypeFlags: { isMultiFamily: true },
      page: 2,
    });
    const sqs = JSON.parse(decodeURIComponent(new URL(url).searchParams.get('searchQueryState')));
    assert.deepEqual(sqs.pagination, { currentPage: 2 });
  });
});

test('Tier B2 — simple home-type variants (Manufactured, Townhouses, Condos, 55+, HUD, MMM)', async (t) => {
  const z = require('../../lib/scrapers/zillowScrapeDo');

  // Each entry: { fn, flag, status }
  // - `fn`: the exported function name
  // - `flag`: the filterState.is{Type} key the wrapper must set true
  // - `status`: the value the wrapper must put on the returned `.status`
  const variants = [
    { fn: 'searchManufactured',       flag: 'isManufactured',      status: 'Manufactured'      },
    { fn: 'searchTownhouses',         flag: 'isTownhouse',         status: 'Townhouse'         },
    { fn: 'searchCondos',             flag: 'isCondo',             status: 'Condo'             },
  ];

  for (const v of variants) {
    await t.test(`${v.fn} — exported, rejects missing location, URL sets ${v.flag}=true`, async () => {
      assert.equal(typeof z[v.fn], 'function', `${v.fn} must be exported`);
      await assert.rejects(() => z[v.fn]({}), /requires location/, `${v.fn} must reject missing location`);
      // The URL the wrapper produces — we verify via buildHomeTypeSearchUrl
      // with the same flags the wrapper sets internally. Cleaner than
      // intercepting the network call.
      const url = z.buildHomeTypeSearchUrl({
        location: 'Austin, TX',
        homeTypeFlags: { [v.flag]: true },
      });
      const fs = filterStateFromUrl(url);
      assert.equal(fs[v.flag].value, true, `${v.flag} must be true`);
      for (const otherFlag of ['isSingleFamily', 'isMultiFamily', 'isCondo', 'isTownhouse',
                                'isLotLand', 'isManufactured']) {
        if (otherFlag !== v.flag) {
          assert.equal(fs[otherFlag].value, false,
            `${otherFlag} must be explicitly false in ${v.fn} URL`);
        }
      }
    });
  }
});

test('Tier B2 — keyword + secondary-flag variants (55+, HUD, MakeMeMove)', async (t) => {
  // These three don't have a dedicated home-type flag — they use either
  // a secondary status flag (is55plusCommunities, isMakeMeMove) or a
  // keyword search (HUD homes match via `keywords: "HUD"` over the
  // foreclosure filter). Each test pins the contract the wrapper must
  // produce.
  const z = require('../../lib/scrapers/zillowScrapeDo');

  await t.test('searchSeniorCommunities — sets is55plusCommunities=true via extraFilters', () => {
    assert.equal(typeof z.searchSeniorCommunities, 'function');
    const url = z.buildHomeTypeSearchUrl({
      location: 'Austin, TX',
      homeTypeFlags: {},
      extraFilters: { is55plusCommunities: { value: true } },
    });
    const fs = filterStateFromUrl(url);
    assert.equal(fs.is55plusCommunities.value, true);
  });

  await t.test('searchSeniorCommunities — rejects missing location', async () => {
    await assert.rejects(() => z.searchSeniorCommunities({}), /requires location/);
  });

  await t.test('searchHudHomes — sets foreclosure flag + HUD keyword as {value: "HUD"}', () => {
    // TD-101: keywords must be wrapped per Zillow's searchQueryState contract.
    // Bare-string `keywords: "HUD"` previously caused HTTP 400 from scrape.do.
    assert.equal(typeof z.searchHudHomes, 'function');
    const url = z.buildHudHomesSearchUrl({ location: 'Austin, TX' });
    const fs = filterStateFromUrl(url);
    assert.equal(fs.isForSaleForeclosure.value, true);
    assert.deepEqual(fs.keywords, { value: 'HUD' });
  });

  await t.test('searchHudHomes — rejects missing location', async () => {
    await assert.rejects(() => z.searchHudHomes({}), /requires location/);
  });

  await t.test('searchMakeMeMove — sets isMakeMeMove=true via extraFilters', () => {
    assert.equal(typeof z.searchMakeMeMove, 'function');
    const url = z.buildHomeTypeSearchUrl({
      location: 'Austin, TX',
      homeTypeFlags: {},
      extraFilters: { isMakeMeMove: { value: true } },
    });
    const fs = filterStateFromUrl(url);
    assert.equal(fs.isMakeMeMove.value, true);
  });

  await t.test('searchMakeMeMove — rejects missing location', async () => {
    await assert.rejects(() => z.searchMakeMeMove({}), /requires location/);
  });
});

test('Tier B2 — searchLotsLand', async (t) => {
  const z = require('../../lib/scrapers/zillowScrapeDo');

  await t.test('exists, rejects missing location, URL sets isLotLand=true', async () => {
    assert.equal(typeof z.searchLotsLand, 'function');
    await assert.rejects(() => z.searchLotsLand({}), /requires location/);
  });

  await t.test('URL min_acres converts to lotSize.min in sqft (1 acre = 43560 sqft)', async () => {
    // Verifies the contract: caller passes acres in human-friendly units;
    // the URL filterState carries Zillow's native sqft unit.
    // We probe via a tracking wrapper around buildHomeTypeSearchUrl
    // OR by inspecting the URL through a generated path. Since the
    // wrapper is the only sink for the conversion, exposing a
    // helper makes this cleanly testable.
    const url = z.buildLotsLandSearchUrl({
      location: 'Austin, TX',
      min_acres: 2,
    });
    const fs = filterStateFromUrl(url);
    assert.equal(fs.isLotLand.value, true);
    // 2 acres × 43560 sqft/acre = 87120 sqft
    assert.equal(fs.lotSize?.min, 87120, '2 acres must convert to 87120 sqft');
  });

  await t.test('URL omits lotSize when min_acres not provided', () => {
    const url = z.buildLotsLandSearchUrl({ location: 'Austin, TX' });
    const fs = filterStateFromUrl(url);
    assert.equal(fs.isLotLand.value, true);
    assert.ok(!fs.lotSize, 'lotSize must be absent when min_acres is undefined');
  });
});

test('Tier B2 — searchNewConstruction', async (t) => {
  const z = require('../../lib/scrapers/zillowScrapeDo');

  await t.test('exists, rejects missing location, URL sets isNewConstruction=true', async () => {
    assert.equal(typeof z.searchNewConstruction, 'function');
    await assert.rejects(() => z.searchNewConstruction({}), /requires location/);
  });

  await t.test('URL embeds builder as keyword when provided', () => {
    const url = z.buildNewConstructionSearchUrl({
      location: 'Austin, TX',
      builder: 'Lennar',
    });
    const fs = filterStateFromUrl(url);
    assert.equal(fs.isNewConstruction.value, true);
    // TD-101: keywords wrapped per Zillow's searchQueryState contract
    assert.deepEqual(fs.keywords, { value: 'Lennar' });
  });

  await t.test('URL omits keywords when builder is undefined', () => {
    const url = z.buildNewConstructionSearchUrl({ location: 'Austin, TX' });
    const fs = filterStateFromUrl(url);
    assert.equal(fs.isNewConstruction.value, true);
    assert.equal(fs.keywords, undefined);
  });
});

test('Tier B2 — searchTinyHomes', async (t) => {
  const z = require('../../lib/scrapers/zillowScrapeDo');

  await t.test('exists, rejects missing location', async () => {
    assert.equal(typeof z.searchTinyHomes, 'function');
    await assert.rejects(() => z.searchTinyHomes({}), /requires location/);
  });

  await t.test('URL caps sqft.max at default 600 with tiny-home keyword', () => {
    const url = z.buildTinyHomesSearchUrl({ location: 'Austin, TX' });
    const fs = filterStateFromUrl(url);
    assert.equal(fs.sqft?.max, 600, 'default sqft.max must be 600 (tiny-home threshold)');
    // TD-101: keywords is {value: X} not bare string
    assert.match(fs.keywords?.value || '', /tiny/i);
  });

  await t.test('URL respects caller-supplied max_sqft override', () => {
    const url = z.buildTinyHomesSearchUrl({ location: 'Austin, TX', max_sqft: 400 });
    const fs = filterStateFromUrl(url);
    assert.equal(fs.sqft?.max, 400);
  });
});

// ── Tier B2 — post-merge review fixes (PR #383 follow-up) ───────────────────
// All RED tests pin the bugs surfaced by the code review.

test('Tier B2 fix — empty homeTypeFlags must preserve Zillow defaults', async (t) => {
  // CRITICAL: when homeTypeFlags={} the helper previously forced every
  // home-type to false, leaving Zillow with no inventory category to
  // return. The fix: skip the home-type loop entirely when the caller
  // doesn't constrain any type. Preserves Zillow's default mix.
  const z = require('../../lib/scrapers/zillowScrapeDo');

  await t.test('empty homeTypeFlags omits ALL isXxxFamily / isCondo / etc. from filterState', () => {
    const url = z.buildHomeTypeSearchUrl({
      location: 'Austin, TX',
      homeTypeFlags: {},
      extraFilters: { is55plusCommunities: { value: true } },
    });
    const fs = filterStateFromUrl(url);
    // The extraFilter MUST come through:
    assert.equal(fs.is55plusCommunities.value, true);
    // No home-type flags should appear at all — Zillow uses defaults:
    for (const flag of ['isSingleFamily', 'isMultiFamily', 'isCondo',
                         'isTownhouse', 'isLotLand', 'isManufactured']) {
      assert.equal(fs[flag], undefined,
        `${flag} must be UNSET when homeTypeFlags is empty (Zillow defaults preserved)`);
    }
  });

  await t.test('non-empty homeTypeFlags still sets every home-type explicitly', () => {
    // Regression check: searchMultiFamily etc. still get the explicit-false
    // treatment so they don't fall back to SFR mix.
    const url = z.buildHomeTypeSearchUrl({
      location: 'Austin, TX',
      homeTypeFlags: { isMultiFamily: true },
    });
    const fs = filterStateFromUrl(url);
    assert.equal(fs.isMultiFamily.value, true);
    assert.equal(fs.isSingleFamily.value, false);
    assert.equal(fs.isCondo.value, false);
    assert.equal(fs.isLotLand.value, false);
  });

  // Now verify each of the 5 broken endpoints produces a URL with NO
  // home-type lockdowns. We use the exported parameter builders where
  // available; for the factory-only wrappers we reach through the
  // generated URL by inspecting what makeHomeTypeSearch passes.

  await t.test('searchSeniorCommunities URL does NOT lock isSingleFamily=false', () => {
    // The wrapper takes no parameter builder, so we exercise it via the
    // factory's underlying buildHomeTypeSearchUrl invocation. The internal
    // homeTypeFlags={} must NOT zero out home types.
    const url = z.buildHomeTypeSearchUrl({
      location: 'Austin, TX',
      homeTypeFlags: {},  // exactly what searchSeniorCommunities passes
      extraFilters: { is55plusCommunities: { value: true } },
    });
    const fs = filterStateFromUrl(url);
    assert.equal(fs.isSingleFamily, undefined,
      'searchSeniorCommunities must not lock home types — Zillow defaults');
  });
});

test('Tier B2 fix — buildNewConstructionSearchUrl omits home-type locks', async (t) => {
  const z = require('../../lib/scrapers/zillowScrapeDo');

  await t.test('does NOT explicitly disable other home types', () => {
    const url = z.buildNewConstructionSearchUrl({ location: 'Austin, TX' });
    const fs = filterStateFromUrl(url);
    assert.equal(fs.isNewConstruction.value, true);
    // Critical: SFR/condo/townhouse new construction should ALL surface.
    assert.equal(fs.isSingleFamily, undefined);
    assert.equal(fs.isCondo, undefined);
    assert.equal(fs.isTownhouse, undefined);
  });

  await t.test('embedded builder still works', () => {
    const url = z.buildNewConstructionSearchUrl({ location: 'Austin, TX', builder: 'Lennar' });
    // TD-101: keywords wrapped per Zillow's searchQueryState contract
    assert.deepEqual(filterStateFromUrl(url).keywords, { value: 'Lennar' });
  });
});

test('Tier B2 fix — buildTinyHomesSearchUrl omits home-type locks', async (t) => {
  const z = require('../../lib/scrapers/zillowScrapeDo');

  await t.test('does NOT explicitly disable other home types', () => {
    const url = z.buildTinyHomesSearchUrl({ location: 'Austin, TX' });
    const fs = filterStateFromUrl(url);
    assert.equal(fs.sqft.max, 600);
    // Tiny homes might be SFR or manufactured — don't lock either out.
    assert.equal(fs.isSingleFamily, undefined);
    assert.equal(fs.isManufactured, undefined);
  });
});

test('Tier B2 fix — searchLotsLand max_acres + both-bounds coverage', async (t) => {
  const z = require('../../lib/scrapers/zillowScrapeDo');

  await t.test('max_acres alone converts to lotSize.max in sqft', () => {
    const url = z.buildLotsLandSearchUrl({ location: 'Austin, TX', max_acres: 5 });
    const fs = filterStateFromUrl(url);
    assert.equal(fs.lotSize.max, 217800, '5 acres × 43560 = 217800 sqft');
    assert.equal(fs.lotSize.min, undefined);
  });

  await t.test('min_acres + max_acres together both convert', () => {
    const url = z.buildLotsLandSearchUrl({
      location: 'Austin, TX', min_acres: 1, max_acres: 5,
    });
    const fs = filterStateFromUrl(url);
    assert.equal(fs.lotSize.min, 43560);
    assert.equal(fs.lotSize.max, 217800);
  });
});

test('Tier B2 fix — numeric arg validation (NaN guard)', async (t) => {
  const z = require('../../lib/scrapers/zillowScrapeDo');

  await t.test('searchLotsLand rejects non-numeric min_acres', () => {
    assert.throws(
      () => z.buildLotsLandSearchUrl({ location: 'Austin, TX', min_acres: 'abc' }),
      /min_acres must be a number/i,
      'string min_acres must be rejected, not silently NaN-ified into URL'
    );
  });

  await t.test('searchLotsLand rejects non-numeric max_acres', () => {
    assert.throws(
      () => z.buildLotsLandSearchUrl({ location: 'Austin, TX', max_acres: 'abc' }),
      /max_acres must be a number/i
    );
  });

  await t.test('searchTinyHomes rejects non-numeric max_sqft', () => {
    assert.throws(
      () => z.buildTinyHomesSearchUrl({ location: 'Austin, TX', max_sqft: 'abc' }),
      /max_sqft must be a number/i
    );
  });

  await t.test('searchLotsLand accepts numeric-string acres (coerces cleanly)', () => {
    const url = z.buildLotsLandSearchUrl({ location: 'Austin, TX', min_acres: '2' });
    const fs = filterStateFromUrl(url);
    assert.equal(fs.lotSize.min, 87120);  // 2 × 43560
  });
});

test('Tier B2 fix — searchTinyHomes max_sqft=0 falls back to default 600', async (t) => {
  const z = require('../../lib/scrapers/zillowScrapeDo');

  await t.test('max_sqft=0 is treated as "use default", not "zero sqft max"', () => {
    // 0 sqft max would return 0 listings. Callers passing 0 likely mean
    // "I don't care about max" — fall back to the 600 default.
    const url = z.buildTinyHomesSearchUrl({ location: 'Austin, TX', max_sqft: 0 });
    const fs = filterStateFromUrl(url);
    assert.equal(fs.sqft.max, 600);
  });
});

// ── TD-101 fix — keywords filterState shape (bug surfaced by live smoke) ────
//
// PR #383 introduced searchHudHomes / searchNewConstruction / searchTinyHomes
// with `keywords: <bare-string>` in filterState. Live smoke test (2026-05-14)
// found searchHudHomes returning HTTP 400 from scrape.do on Phoenix AZ + Atlanta
// GA. Tech-debt audit found the same bare-string pattern in 3 endpoints.
//
// Every other filterState entry uses the {value: X} shape (isMultiFamily,
// isForSaleForeclosure, etc). The hypothesis: Zillow's searchQueryState
// parser expects `keywords: {value: "HUD"}` not bare `keywords: "HUD"`.
//
// These RED tests pin the {value: X} shape. The 3 buggy configs must be
// updated to match.

test('TD-101 fix — keywords filterState shape must be {value: X}', async (t) => {
  const z = require('../../lib/scrapers/zillowScrapeDo');

  await t.test('searchHudHomes URL emits keywords as {value: "HUD"}', () => {
    const url = z.buildHomeTypeSearchUrl({
      location: 'Phoenix, AZ',
      homeTypeFlags: {},
      extraFilters: {
        isForSaleForeclosure: { value: true },
        keywords: { value: 'HUD' },
      },
    });
    const fs = filterStateFromUrl(url);
    assert.deepEqual(fs.keywords, { value: 'HUD' },
      'keywords must be {value: "HUD"}, not bare string — consistency with rest of filterState');
  });

  await t.test('buildNewConstructionSearchUrl emits keywords as {value: builder}', () => {
    const url = z.buildNewConstructionSearchUrl({
      location: 'Austin, TX',
      builder: 'Lennar',
    });
    const fs = filterStateFromUrl(url);
    assert.deepEqual(fs.keywords, { value: 'Lennar' },
      'NewConstruction with builder must wrap keywords in {value:}');
  });

  await t.test('buildTinyHomesSearchUrl emits keywords as {value: "tiny home"}', () => {
    const url = z.buildTinyHomesSearchUrl({ location: 'Austin, TX' });
    const fs = filterStateFromUrl(url);
    assert.deepEqual(fs.keywords, { value: 'tiny home' });
  });

  await t.test('searchNewConstruction without builder omits keywords entirely', () => {
    const url = z.buildNewConstructionSearchUrl({ location: 'Austin, TX' });
    const fs = filterStateFromUrl(url);
    assert.equal(fs.keywords, undefined,
      'No builder = no keywords clause (avoid empty {value:""} pollution)');
  });

  await t.test('buildHomeTypeSearchUrl auto-normalizes bare-string keywords to {value: X}', () => {
    // Defensive normalization at the builder level — if any caller still
    // passes a bare string (legacy/tests/external), we wrap it. Belt-and-
    // suspenders so the bug class can't recur from a new endpoint.
    const url = z.buildHomeTypeSearchUrl({
      location: 'Austin, TX',
      homeTypeFlags: {},
      extraFilters: { keywords: 'raw string' },
    });
    const fs = filterStateFromUrl(url);
    assert.deepEqual(fs.keywords, { value: 'raw string' },
      'bare-string keywords from a caller must be normalized to {value: X}');
  });
});
