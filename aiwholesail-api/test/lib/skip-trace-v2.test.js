/**
 * Unit tests for skip-trace V2 fallback library.
 *
 * Covers the pure transformation functions (v1→v2 request building,
 * V2 response normalization). The actual axios call (callV2Fallback)
 * is not unit-tested here — that's integration territory, exercised
 * live in routes/skipTrace.js when the primary fails.
 *
 *   $ npm test    (from aiwholesail-api/)
 *   $ node --test test/lib/skip-trace-v2.test.js
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  SUPPORTED_FALLBACKS,
  v1ToV2Request,
  normalizeV2Response,
} = require('../../lib/skip-trace-v2');

test('SUPPORTED_FALLBACKS', async (t) => {
  await t.test('contains exactly byaddress + bynameaddress', () => {
    assert.deepEqual([...SUPPORTED_FALLBACKS].sort(), ['byaddress', 'bynameaddress']);
  });

  await t.test('byname is NOT a fallback (V2 has no equivalent)', () => {
    assert.equal(SUPPORTED_FALLBACKS.includes('byname'), false);
  });

  await t.test('byphone is NOT a fallback', () => {
    assert.equal(SUPPORTED_FALLBACKS.includes('byphone'), false);
  });

  await t.test('byemail is NOT a fallback', () => {
    assert.equal(SUPPORTED_FALLBACKS.includes('byemail'), false);
  });
});

test('v1ToV2Request — byaddress', async (t) => {
  await t.test('maps street + citystatezip to addressLine1 + addressLine2', () => {
    const req = v1ToV2Request('byaddress', {
      street: '3828 Double Oak Ln',
      citystatezip: 'Irving, TX 75061',
    });
    assert.deepEqual(req, {
      path: '/search/owners-by-address',
      body: {
        addressLine1: '3828 Double Oak Ln',
        addressLine2: 'Irving, TX 75061',
      },
    });
  });
});

test('v1ToV2Request — bynameaddress', async (t) => {
  await t.test('splits "First Last" into firstName + lastName', () => {
    const req = v1ToV2Request('bynameaddress', {
      name: 'John Smith',
      citystatezip: 'Los Angeles, CA',
    });
    assert.equal(req.path, '/search/by-name-and-address');
    assert.equal(req.body.firstName, 'John');
    assert.equal(req.body.lastName, 'Smith');
    assert.equal(req.body.addressLine2, 'Los Angeles, CA');
  });

  await t.test('bundles middle name into lastName for 3+ tokens', () => {
    const req = v1ToV2Request('bynameaddress', {
      name: 'John Q Smith',
      citystatezip: 'Los Angeles, CA',
    });
    assert.equal(req.body.firstName, 'John');
    assert.equal(req.body.lastName, 'Q Smith');
  });

  await t.test('bundles suffix into lastName', () => {
    const req = v1ToV2Request('bynameaddress', {
      name: 'John Smith Jr',
      citystatezip: 'Los Angeles, CA',
    });
    assert.equal(req.body.lastName, 'Smith Jr');
  });

  await t.test('single name → firstName only, empty lastName', () => {
    const req = v1ToV2Request('bynameaddress', {
      name: 'Madonna',
      citystatezip: 'Los Angeles, CA',
    });
    assert.equal(req.body.firstName, 'Madonna');
    assert.equal(req.body.lastName, '');
  });

  await t.test('empty name → empty fields, no throw', () => {
    const req = v1ToV2Request('bynameaddress', { name: '', citystatezip: 'X' });
    assert.equal(req.body.firstName, '');
    assert.equal(req.body.lastName, '');
  });

  await t.test('whitespace name → trimmed empty', () => {
    const req = v1ToV2Request('bynameaddress', { name: '   ', citystatezip: 'X' });
    assert.equal(req.body.firstName, '');
    assert.equal(req.body.lastName, '');
  });
});

test('v1ToV2Request — unsupported types', async (t) => {
  await t.test('byname returns null', () => {
    assert.equal(v1ToV2Request('byname', { name: 'x' }), null);
  });
  await t.test('byphone returns null', () => {
    assert.equal(v1ToV2Request('byphone', { phoneno: '555' }), null);
  });
  await t.test('byemail returns null', () => {
    assert.equal(v1ToV2Request('byemail', { email: 'x@y.z' }), null);
  });
});

test('normalizeV2Response — success shapes', async (t) => {
  await t.test('{success:true, data:{results:[...]}} → {results:[...]}', () => {
    const r = normalizeV2Response({
      success: true,
      data: { results: [{ name: 'John', tahoeId: 'G-1' }] },
    });
    assert.deepEqual(r.results, [{ name: 'John', tahoeId: 'G-1' }]);
  });

  await t.test('{success:true, data:[...]} → {results:[...]}', () => {
    const r = normalizeV2Response({
      success: true,
      data: [{ name: 'Jane' }],
    });
    assert.deepEqual(r.results, [{ name: 'Jane' }]);
  });

  await t.test('{success:true, results:[...]} → preserved', () => {
    const r = normalizeV2Response({
      success: true,
      results: [{ name: 'Sam' }],
    });
    assert.deepEqual(r.results, [{ name: 'Sam' }]);
  });

  await t.test('direct array → wrapped as {results:[...]}', () => {
    const r = normalizeV2Response([{ name: 'Alice' }, { name: 'Bob' }]);
    assert.deepEqual(r.results, [{ name: 'Alice' }, { name: 'Bob' }]);
  });

  await t.test('preserves extra fields from data envelope', () => {
    const r = normalizeV2Response({
      success: true,
      data: { results: [], totalCount: 0, page: 1 },
    });
    assert.equal(r.totalCount, 0);
    assert.equal(r.page, 1);
  });
});

test('normalizeV2Response — failure shapes', async (t) => {
  await t.test('null → null', () => {
    assert.equal(normalizeV2Response(null), null);
  });

  await t.test('undefined → null', () => {
    assert.equal(normalizeV2Response(undefined), null);
  });

  await t.test('non-object → null', () => {
    assert.equal(normalizeV2Response('string'), null);
    assert.equal(normalizeV2Response(42), null);
  });

  await t.test('{success:false, ...} → null (V2 upstream rejected)', () => {
    const r = normalizeV2Response({
      success: false,
      error: 'Request failed with status code 403',
      status: 403,
    });
    assert.equal(r, null);
  });

  await t.test('empty object → null (unrecognised shape)', () => {
    assert.equal(normalizeV2Response({}), null);
  });
});

// ─── callV2Fallback (was previously untested — 66% function gap) ──────────
//
// Substitute the cached axios module with a controllable fake BEFORE
// re-requiring the SUT so the network call goes through our recorder.

const Module = require('node:module');
const AXIOS_PATH = require.resolve('axios');

let axiosPostImpl = async () => ({ status: 200, data: { success: true, data: [] } });
const axiosCalls = [];
function resetAxios() { axiosCalls.length = 0; }
function setAxiosPost(fn) { axiosPostImpl = fn; }

const fakeAxios = {
  post: async (url, body, config) => {
    axiosCalls.push({ url, body, config });
    return axiosPostImpl(url, body, config);
  },
};
const fakeAxiosMod = new Module(AXIOS_PATH);
fakeAxiosMod.filename = AXIOS_PATH;
fakeAxiosMod.loaded = true;
fakeAxiosMod.exports = fakeAxios;
fakeAxiosMod.exports.default = fakeAxios;
require.cache[AXIOS_PATH] = fakeAxiosMod;

const SUT_PATH = require.resolve('../../lib/skip-trace-v2');
delete require.cache[SUT_PATH];
const { callV2Fallback } = require('../../lib/skip-trace-v2');

const BASE_PARAMS = {
  searchType: 'byaddress',
  params: { street: '123 Main', citystatezip: 'Austin TX 78701' },
  rapidApiKey: 'rk-test',
};

test('callV2Fallback: rejects unsupported searchType without hitting axios', async () => {
  resetAxios();
  const r = await callV2Fallback({ ...BASE_PARAMS, searchType: 'detailsbyid' });
  assert.equal(r.ok, false);
  assert.equal(r.status, 0);
  assert.match(r.error, /no fallback for detailsbyid/);
  assert.equal(axiosCalls.length, 0);
});

test('callV2Fallback: rejects when RAPIDAPI_KEY missing', async () => {
  resetAxios();
  const r = await callV2Fallback({ ...BASE_PARAMS, rapidApiKey: undefined });
  assert.equal(r.ok, false);
  assert.match(r.error, /RAPIDAPI_KEY not configured/);
  assert.equal(axiosCalls.length, 0);
});

test('callV2Fallback: byaddress success returns normalized {results: [...]}', async () => {
  setAxiosPost(async () => ({ status: 200, data: { success: true, data: { results: [{ peo_id: 'p1' }] } } }));
  const r = await callV2Fallback({ ...BASE_PARAMS });
  assert.equal(r.ok, true);
  assert.equal(r.status, 200);
  assert.deepEqual(r.data.results, [{ peo_id: 'p1' }]);
});

test('callV2Fallback: sends required RapidAPI headers + correct URL', async () => {
  resetAxios();
  setAxiosPost(async () => ({ status: 200, data: { success: true, data: [] } }));
  await callV2Fallback({ ...BASE_PARAMS });
  assert.equal(axiosCalls.length, 1);
  const { url, body, config } = axiosCalls[0];
  assert.match(url, /^https:\/\/skip-tracing-api\.p\.rapidapi\.com\/search\/owners-by-address$/);
  assert.equal(body.addressLine1, '123 Main');
  assert.equal(body.addressLine2, 'Austin TX 78701');
  assert.equal(config.headers['x-rapidapi-key'], 'rk-test');
  assert.equal(config.headers['x-rapidapi-host'], 'skip-tracing-api.p.rapidapi.com');
  assert.equal(config.timeout, 15000);
});

test('callV2Fallback: bynameaddress builds correct path + name split', async () => {
  resetAxios();
  setAxiosPost(async () => ({ status: 200, data: { success: true, data: [] } }));
  await callV2Fallback({
    searchType: 'bynameaddress',
    params: { name: 'Jane Smith', citystatezip: 'Austin TX 78701' },
    rapidApiKey: 'rk',
  });
  const { url, body } = axiosCalls[0];
  assert.match(url, /\/search\/by-name-and-address$/);
  assert.equal(body.firstName, 'Jane');
  assert.equal(body.lastName, 'Smith');
});

test('callV2Fallback: respects custom timeoutMs', async () => {
  resetAxios();
  setAxiosPost(async () => ({ status: 200, data: { success: true, data: [] } }));
  await callV2Fallback({ ...BASE_PARAMS, timeoutMs: 5000 });
  assert.equal(axiosCalls[0].config.timeout, 5000);
});

test('callV2Fallback: HTTP 4xx/5xx → {ok:false} with passthrough status', async () => {
  setAxiosPost(async () => ({ status: 503, data: 'gateway down' }));
  const r = await callV2Fallback({ ...BASE_PARAMS });
  assert.equal(r.ok, false);
  assert.equal(r.status, 503);
  assert.match(r.error, /HTTP 503/);
});

test('callV2Fallback: HTTP 200 + {success:false} body → {ok:false} (Cloudflare-blocked upstream)', async () => {
  setAxiosPost(async () => ({
    status: 200,
    data: { success: false, error: 'Request failed with status code 403', status: 403 },
  }));
  const r = await callV2Fallback({ ...BASE_PARAMS });
  assert.equal(r.ok, false);
  assert.equal(r.status, 403);
  assert.match(r.error, /403/);
});

test('callV2Fallback: HTTP 200 + unrecognised body → {ok:false, status:502}', async () => {
  setAxiosPost(async () => ({ status: 200, data: { foo: 'bar' } }));
  const r = await callV2Fallback({ ...BASE_PARAMS });
  assert.equal(r.ok, false);
  assert.equal(r.status, 502);
  assert.match(r.error, /shape unrecognised/);
});

test('callV2Fallback: axios throws (network) → {ok:false, status:0, error}', async () => {
  setAxiosPost(async () => { throw new Error('ECONNRESET'); });
  const r = await callV2Fallback({ ...BASE_PARAMS });
  assert.equal(r.ok, false);
  assert.equal(r.status, 0);
  assert.match(r.error, /ECONNRESET/);
});

test('callV2Fallback: thrown non-Error without message → fallback error string', async () => {
  setAxiosPost(async () => { throw {}; });
  const r = await callV2Fallback({ ...BASE_PARAMS });
  assert.equal(r.ok, false);
  assert.equal(r.status, 0);
  assert.match(r.error, /V2 network error/);
});
