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
});
