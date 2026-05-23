/**
 * Unit tests for the offmarket-api client — builds the URL + headers for
 * the Node service to call the new Python service.
 *
 * The client is intentionally THIN. Heavy lifting (rate limit, auth,
 * usage recording) all live in the Python service; this just forwards.
 *
 *   $ npm test
 *   $ node --test test/lib/offmarket-client.test.js
 */

const test = require('node:test');
const assert = require('node:assert/strict');

const { buildRequest, getOffmarketBaseUrl } = require('../../lib/offmarket-client');

test('getOffmarketBaseUrl', async (t) => {
  await t.test('returns OFFMARKET_API_URL env when set', () => {
    const orig = process.env.OFFMARKET_API_URL;
    process.env.OFFMARKET_API_URL = 'http://internal:8002';
    try {
      assert.equal(getOffmarketBaseUrl(), 'http://internal:8002');
    } finally {
      if (orig === undefined) delete process.env.OFFMARKET_API_URL;
      else process.env.OFFMARKET_API_URL = orig;
    }
  });

  await t.test('defaults to http://127.0.0.1:8002 when env unset', () => {
    const orig = process.env.OFFMARKET_API_URL;
    delete process.env.OFFMARKET_API_URL;
    try {
      assert.equal(getOffmarketBaseUrl(), 'http://127.0.0.1:8002');
    } finally {
      if (orig !== undefined) process.env.OFFMARKET_API_URL = orig;
    }
  });

  await t.test('trailing slash is stripped', () => {
    const orig = process.env.OFFMARKET_API_URL;
    process.env.OFFMARKET_API_URL = 'http://host:8002/';
    try {
      assert.equal(getOffmarketBaseUrl(), 'http://host:8002');
    } finally {
      if (orig === undefined) delete process.env.OFFMARKET_API_URL;
      else process.env.OFFMARKET_API_URL = orig;
    }
  });
});

test('buildRequest', async (t) => {
  await t.test('GET /counties/ — no body, bearer header', () => {
    const req = buildRequest({
      apiKey: 'ak_test123',
      baseUrl: 'http://host:8002',
      method: 'GET',
      path: '/api/v1/counties/',
    });
    assert.equal(req.url, 'http://host:8002/api/v1/counties/');
    assert.equal(req.method, 'GET');
    assert.equal(req.headers.Authorization, 'Bearer ak_test123');
    assert.equal(req.headers['Content-Type'], 'application/json');
    assert.equal(req.body, undefined);
  });

  await t.test('POST /lists/build — body JSON-stringified', () => {
    const req = buildRequest({
      apiKey: 'ak_xyz',
      baseUrl: 'http://host:8002',
      method: 'POST',
      path: '/api/v1/lists/build',
      body: { state: 'IL', limit: 50 },
    });
    assert.equal(req.url, 'http://host:8002/api/v1/lists/build');
    assert.equal(req.method, 'POST');
    assert.equal(req.body, '{"state":"IL","limit":50}');
  });

  await t.test('GET with query params — appended to URL', () => {
    const req = buildRequest({
      apiKey: 'ak_xyz',
      baseUrl: 'http://host:8002',
      method: 'GET',
      path: '/api/v1/properties/by-parcel',
      query: { parcel_id: '17031-001', county_fips: '17031' },
    });
    assert.match(req.url, /\?parcel_id=17031-001&county_fips=17031$/);
  });

  await t.test('throws if apiKey missing', () => {
    assert.throws(
      () => buildRequest({ baseUrl: 'http://host', method: 'GET', path: '/' }),
      /apiKey/
    );
  });

  await t.test('throws if baseUrl missing', () => {
    assert.throws(
      () => buildRequest({ apiKey: 'ak_x', method: 'GET', path: '/' }),
      /baseUrl/
    );
  });

  await t.test('throws if path does not start with /', () => {
    assert.throws(
      () => buildRequest({ apiKey: 'ak_x', baseUrl: 'http://h', method: 'GET', path: 'api/v1/x' }),
      /path must start with/
    );
  });

  await t.test('undefined query values are skipped', () => {
    const req = buildRequest({
      apiKey: 'ak_x',
      baseUrl: 'http://h',
      method: 'GET',
      path: '/x',
      query: { a: 'one', b: undefined, c: 'three' },
    });
    assert.match(req.url, /\?a=one&c=three$/);
    assert.doesNotMatch(req.url, /\bb=/);
  });
});
