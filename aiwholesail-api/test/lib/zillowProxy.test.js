/**
 * Unit tests for lib/agent/zillowProxy.
 *
 *   $ node --test test/lib/zillowProxy.test.js
 *
 * Strategy:
 *   - Patch handlers on the cached zillowScrapeDo module to control scrape.do
 *     behaviour per test (matches the pattern used in zillowFallback.test.js).
 *   - Inject a fake axios into require.cache before requiring zillowProxy so
 *     we can intercept the RapidAPI fallback call without doing real HTTP.
 *
 * Asserts the new order (changed 2026-05-13 — PR #321):
 *   1. scrape.do PRIMARY for actions in SCRAPE_DO_ACTIONS
 *   2. RapidAPI FALLBACK on scrape.do failure
 *   3. On both fail → throw scrape.do's original error
 *   4. Action NOT in SCRAPE_DO_ACTIONS → straight to RapidAPI, no scrape.do call
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');

// Set BEFORE requiring the SUT — zillowProxy reads ZILLOW_PROXY_SECRET into a
// const at module-load time, so post-require mutation has no effect.
process.env.ZILLOW_PROXY_SECRET = 'test-secret';

// ─── Fake axios so RapidAPI calls never go to the network ────────────────────
const AXIOS_PATH = require.resolve('axios');

// Mutable state — each test sets the next response or throw.
let nextAxiosResponse = null; // { status, data } | null
let nextAxiosThrow = null; // Error | null
const axiosCalls = [];

function resetAxios() {
  nextAxiosResponse = null;
  nextAxiosThrow = null;
  axiosCalls.length = 0;
}

const fakeAxios = {
  post: async (url, body, config) => {
    axiosCalls.push({ url, body, config });
    if (nextAxiosThrow) throw nextAxiosThrow;
    return nextAxiosResponse || { status: 200, data: { data: { ok: true } } };
  },
};

const fakeAxiosMod = new Module(AXIOS_PATH);
fakeAxiosMod.filename = AXIOS_PATH;
fakeAxiosMod.loaded = true;
fakeAxiosMod.exports = fakeAxios;
require.cache[AXIOS_PATH] = fakeAxiosMod;

// ─── Now safe to require the SUT ─────────────────────────────────────────────
const zillowScrapeDo = require('../../lib/scrapers/zillowScrapeDo');
const { proxyZillow, SCRAPE_DO_ACTIONS } = require('../../lib/agent/zillowProxy');

/**
 * Temporarily install `fn` as the handler for `action` on the scrape.do
 * module. Returns a restore function. Mirrors the helper in
 * zillowFallback.test.js so the test style is consistent.
 */
function patchHandler(action, fn) {
  const original = zillowScrapeDo[action];
  const had = Object.prototype.hasOwnProperty.call(zillowScrapeDo, action);
  zillowScrapeDo[action] = fn;
  // SCRAPE_DO_ACTIONS captured the original handler at module-load. Patch
  // it too so the lookup inside proxyZillow sees our fake.
  const originalMapEntry = SCRAPE_DO_ACTIONS[action];
  const mapHad = Object.prototype.hasOwnProperty.call(SCRAPE_DO_ACTIONS, action);
  SCRAPE_DO_ACTIONS[action] = fn;
  return () => {
    if (had) zillowScrapeDo[action] = original; else delete zillowScrapeDo[action];
    if (mapHad) SCRAPE_DO_ACTIONS[action] = originalMapEntry; else delete SCRAPE_DO_ACTIONS[action];
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

test('proxyZillow', async (t) => {
  await t.test('scrape.do is called FIRST when action is in SCRAPE_DO_ACTIONS', async () => {
    resetAxios();
    let scrapeCalled = false;
    let scrapeArgs = null;
    const restore = patchHandler('propertyDetails', async (args) => {
      scrapeCalled = true;
      scrapeArgs = args;
      return { zpid: '12345', address: '1 Main St' };
    });
    try {
      const out = await proxyZillow('propertyDetails', { zpid: '12345' });
      assert.equal(scrapeCalled, true, 'scrape.do handler MUST be called first');
      assert.deepEqual(scrapeArgs, { zpid: '12345' }, 'handler receives the searchParams');
      assert.deepEqual(out, { zpid: '12345', address: '1 Main St' });
      assert.equal(axiosCalls.length, 0, 'RapidAPI MUST NOT be called when scrape.do succeeds');
    } finally {
      restore();
    }
  });

  await t.test('on scrape.do failure, falls back to RapidAPI', async () => {
    resetAxios();
    nextAxiosResponse = {
      status: 200,
      data: { data: { results: ['from-rapid'] } },
    };
    const restore = patchHandler('search', async () => {
      throw new Error('scrape.do timeout');
    });
    try {
      const out = await proxyZillow('search', { location: 'Austin, TX' });
      assert.deepEqual(out, { results: ['from-rapid'] }, 'RapidAPI payload returned after scrape.do fails');
      assert.equal(axiosCalls.length, 1, 'exactly one RapidAPI fallback call');
      assert.deepEqual(axiosCalls[0].body, {
        action: 'search',
        searchParams: { location: 'Austin, TX' },
      });
    } finally {
      restore();
    }
  });

  await t.test('on BOTH failure, throws scrape.do error (not RapidAPI error)', async () => {
    resetAxios();
    nextAxiosThrow = new Error('RapidAPI HTTP 500');
    const scrapeErr = new Error('scrape.do blocked by captcha');
    const restore = patchHandler('comps', async () => {
      throw scrapeErr;
    });
    try {
      await assert.rejects(
        proxyZillow('comps', { zpid: '999' }),
        (err) => {
          assert.equal(err, scrapeErr, 'must rethrow the exact scrape.do error object');
          assert.equal(err.message, 'scrape.do blocked by captcha');
          return true;
        }
      );
      assert.equal(axiosCalls.length, 1, 'RapidAPI fallback was attempted');
    } finally {
      restore();
    }
  });

  await t.test('action NOT in SCRAPE_DO_ACTIONS goes straight to RapidAPI (no scrape.do call)', async () => {
    resetAxios();
    nextAxiosResponse = {
      status: 200,
      data: { data: { unsupported: 'still-works' } },
    };
    // Pre-condition: the action isn't in the map.
    const unknownAction = '__never_mapped_to_scrape_do__';
    assert.equal(SCRAPE_DO_ACTIONS[unknownAction], undefined);

    // Patch a sentinel onto zillowScrapeDo for an unrelated action so we can
    // assert NO scrape.do handler is invoked for the unknown action.
    let anyScrapeCalled = false;
    const restore = patchHandler('propertyDetails', async () => {
      anyScrapeCalled = true;
      return {};
    });
    try {
      const out = await proxyZillow(unknownAction, { foo: 'bar' });
      assert.deepEqual(out, { unsupported: 'still-works' });
      assert.equal(anyScrapeCalled, false, 'no scrape.do handler should be invoked');
      assert.equal(axiosCalls.length, 1, 'RapidAPI hit exactly once');
      assert.equal(axiosCalls[0].body.action, unknownAction);
    } finally {
      restore();
    }
  });

  await t.test('on scrape.do failure AND RapidAPI 5xx, still throws scrape.do error', async () => {
    // Extra coverage: RapidAPI returns a non-throw error envelope (status>=400)
    // — callRapidApiProxy throws internally, the outer catch picks it up, and
    // we surface the ORIGINAL scrape.do error.
    resetAxios();
    nextAxiosResponse = { status: 503, data: { error: 'upstream down' } };
    const scrapeErr = new Error('scrape.do network refused');
    const restore = patchHandler('photos', async () => { throw scrapeErr; });
    try {
      await assert.rejects(
        proxyZillow('photos', { zpid: '7' }),
        (err) => {
          assert.equal(err, scrapeErr);
          return true;
        }
      );
    } finally {
      restore();
    }
  });
});
