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
  ZillowScrapeError,
} = require('../../lib/scrapers/zillowScrapeDo');

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

test('searchUrlForLocation', () => {
  assert.equal(
    searchUrlForLocation('Austin, TX'),
    'https://www.zillow.com/homes/austin-tx_rb/'
  );
  assert.equal(
    searchUrlForLocation('78737'),
    'https://www.zillow.com/homes/78737_rb/'
  );
  assert.equal(
    searchUrlForLocation('  Oxford, MI 48371  '),
    'https://www.zillow.com/homes/oxford-mi-48371_rb/'
  );
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
