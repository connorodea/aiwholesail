/**
 * Unit tests for lib/agent/zillowProxy.js — the dual-backend dispatch
 * between scrape.do (primary) and the legacy RapidAPI proxy (fallback).
 *
 * Prior coverage was 93.10% line / 65.22% branch / 66.67% function.
 * The uncovered branches were the failure modes of callRapidApiProxy
 * (no secret, 429, >=400, success:false envelope) and the no-data
 * short-circuit in proxyZillow that prevents wasteful fallback round-
 * trips for ZillowScrapeError reasons RapidAPI can't satisfy.
 *
 * Mock strategy: substitute both `axios` and `../../lib/scrapers/
 * zillowScrapeDo` in require.cache BEFORE loading the SUT. Same pattern
 * as the recent middleware + skip-trace test PRs (#449/#450/#452/#453/#454).
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');

// ─── Fake axios ───────────────────────────────────────────────────────────

const AXIOS_PATH = require.resolve('axios');
let axiosPostImpl = async () => ({ status: 200, data: { success: true, data: { from: 'rapidapi' } } });
const axiosCalls = [];
function setAxiosPost(fn) { axiosPostImpl = fn; }
function resetAxios() { axiosCalls.length = 0; }

const fakeAxios = {
  post: async (url, body, cfg) => {
    axiosCalls.push({ url, body, cfg });
    return axiosPostImpl(url, body, cfg);
  },
};
const fakeAxiosMod = new Module(AXIOS_PATH);
fakeAxiosMod.filename = AXIOS_PATH;
fakeAxiosMod.loaded = true;
fakeAxiosMod.exports = fakeAxios;
fakeAxiosMod.exports.default = fakeAxios;
require.cache[AXIOS_PATH] = fakeAxiosMod;

// ─── Fake zillowScrapeDo ──────────────────────────────────────────────────
//
// We need a ZillowScrapeError that's a real class (so `instanceof` checks
// work) and per-action handlers we can swap per test.

class FakeZillowScrapeError extends Error {
  constructor(message, opts = {}) {
    super(message);
    this.name = 'ZillowScrapeError';
    Object.assign(this, opts);
  }
}

const SCRAPER_PATH = require.resolve('../../../lib/scrapers/zillowScrapeDo');

let propertyDetailsImpl = async () => ({ from: 'scrape.do' });
let walkScoreImpl = async () => ({ from: 'scrape.do' });
function setPropertyDetails(fn) { propertyDetailsImpl = fn; }
function setWalkScore(fn) { walkScoreImpl = fn; }

const fakeScraper = {
  ZillowScrapeError: FakeZillowScrapeError,
  propertyDetails: (...args) => propertyDetailsImpl(...args),
  walkScore: (...args) => walkScoreImpl(...args),
  // Stubs for the rest of SCRAPE_DO_ACTIONS — any handler the SUT looks up
  // must be truthy. All resolve to a sentinel by default.
  photos: async () => ({ from: 'scrape.do' }),
  taxes: async () => ({ from: 'scrape.do' }),
  priceHistory: async () => ({ from: 'scrape.do' }),
  zestimate: async () => ({ from: 'scrape.do' }),
  rentalEstimate: async () => ({ from: 'scrape.do' }),
  zestimateHistory: async () => ({ from: 'scrape.do' }),
  schools: async () => ({ from: 'scrape.do' }),
  comps: async () => ({ from: 'scrape.do' }),
  climateRisk: async () => ({ from: 'scrape.do' }),
  openHouses: async () => ({ from: 'scrape.do' }),
  rentalComps: async () => ({ from: 'scrape.do' }),
  recentlySoldNearby: async () => ({ from: 'scrape.do' }),
  search: async () => ({ from: 'scrape.do' }),
  searchByAddress: async () => ({ from: 'scrape.do' }),
  searchByCoordinates: async () => ({ from: 'scrape.do' }),
  searchByBounds: async () => ({ from: 'scrape.do' }),
  searchByUrl: async () => ({ from: 'scrape.do' }),
  forSale: async () => ({ from: 'scrape.do' }),
  forRent: async () => ({ from: 'scrape.do' }),
  recentlySold: async () => ({ from: 'scrape.do' }),
  foreclosures: async () => ({ from: 'scrape.do' }),
  fsbo: async () => ({ from: 'scrape.do' }),
  comingSoon: async () => ({ from: 'scrape.do' }),
  auctionListings: async () => ({ from: 'scrape.do' }),
  mortgageRates: async () => ({ from: 'scrape.do' }),
  mortgageCalculator: async () => ({ from: 'scrape.do' }),
  agentProfile: async () => ({ from: 'scrape.do' }),
  marketStats: async () => ({ from: 'scrape.do' }),
};
const fakeScraperMod = new Module(SCRAPER_PATH);
fakeScraperMod.filename = SCRAPER_PATH;
fakeScraperMod.loaded = true;
fakeScraperMod.exports = fakeScraper;
require.cache[SCRAPER_PATH] = fakeScraperMod;

// Env required by the SUT for the RapidAPI fallback path.
process.env.ZILLOW_PROXY_SECRET = 'rk-test';
process.env.ZILLOW_PROXY_URL = 'http://127.0.0.1:3201/zillow';

const SUT_PATH = require.resolve('../../../lib/agent/zillowProxy');
delete require.cache[SUT_PATH];
const { proxyZillow, callRapidApiProxy, SCRAPE_DO_ACTIONS } = require('../../../lib/agent/zillowProxy');

function silence(fn) {
  const o1 = console.log, o2 = console.warn, o3 = console.error;
  console.log = () => {}; console.warn = () => {}; console.error = () => {};
  return Promise.resolve(fn()).finally(() => { console.log = o1; console.warn = o2; console.error = o3; });
}

// ─── proxyZillow happy path ───────────────────────────────────────────────

test('proxyZillow: action with scrape.do handler → serves from scrape.do (primary)', async () => {
  setPropertyDetails(async () => ({ zpid: 1, from: 'scrape.do' }));
  resetAxios();
  await silence(async () => {
    const d = await proxyZillow('propertyDetails', { zpid: 1 });
    assert.deepEqual(d, { zpid: 1, from: 'scrape.do' });
  });
  assert.equal(axiosCalls.length, 0, 'RapidAPI must NOT be called on scrape.do success');
});

// ─── proxyZillow: no-data short-circuit (TD-027 path) ─────────────────────

test('proxyZillow: scrape.do ZillowScrapeError reason=no_data_in_payload → short-circuit (no RapidAPI)', async () => {
  setWalkScore(async () => {
    throw new FakeZillowScrapeError('no walk score widget on this listing', { reason: 'no_data_in_payload' });
  });
  resetAxios();
  await silence(async () => {
    await assert.rejects(() => proxyZillow('walkScore', { zpid: 1 }), /no walk score widget/);
  });
  assert.equal(axiosCalls.length, 0, 'RapidAPI fallback must be skipped for no-data signal');
});

test('proxyZillow: scrape.do ZillowScrapeError reason=no_property_in_payload → also short-circuit', async () => {
  setWalkScore(async () => {
    throw new FakeZillowScrapeError('property stripped from page', { reason: 'no_property_in_payload' });
  });
  resetAxios();
  await silence(async () => {
    await assert.rejects(() => proxyZillow('walkScore', { zpid: 1 }), /property stripped/);
  });
  assert.equal(axiosCalls.length, 0);
});

// ─── proxyZillow: real failure → RapidAPI fallback ────────────────────────

test('proxyZillow: scrape.do network error → RapidAPI fallback succeeds', async () => {
  setPropertyDetails(async () => { throw new Error('ECONNRESET'); });
  setAxiosPost(async () => ({ status: 200, data: { success: true, data: { from: 'rapidapi-fallback' } } }));
  resetAxios();
  await silence(async () => {
    const d = await proxyZillow('propertyDetails', { zpid: 1 });
    assert.deepEqual(d, { from: 'rapidapi-fallback' });
  });
  assert.equal(axiosCalls.length, 1, 'RapidAPI fallback fired once');
});

test('proxyZillow: BOTH backends fail → throws the ORIGINAL scrape.do error', async () => {
  setPropertyDetails(async () => { throw new Error('scrape-do-down'); });
  setAxiosPost(async () => { throw new Error('rapidapi-down'); });
  await silence(async () => {
    await assert.rejects(() => proxyZillow('propertyDetails', { zpid: 1 }), /scrape-do-down/);
  });
});

// ─── proxyZillow: unmapped action → straight to RapidAPI ──────────────────

test('proxyZillow: action with no scrape.do handler → goes straight to RapidAPI', async () => {
  setAxiosPost(async () => ({ status: 200, data: { success: true, data: { from: 'rapidapi-only' } } }));
  resetAxios();
  await silence(async () => {
    const d = await proxyZillow('not-a-real-action', {});
    assert.deepEqual(d, { from: 'rapidapi-only' });
  });
  assert.equal(axiosCalls.length, 1, 'one RapidAPI call, no scrape.do attempt');
});

// ─── SCRAPE_DO_ACTIONS map shape ──────────────────────────────────────────

test('SCRAPE_DO_ACTIONS exports a non-empty map of action → handler function', () => {
  assert.ok(typeof SCRAPE_DO_ACTIONS === 'object');
  const keys = Object.keys(SCRAPE_DO_ACTIONS);
  assert.ok(keys.length >= 20, 'expected 20+ supported actions');
  // Anchor a few known actions per the source's documented set.
  for (const k of ['propertyDetails', 'comps', 'walkScore', 'search', 'mortgageRates']) {
    assert.equal(typeof SCRAPE_DO_ACTIONS[k], 'function', `${k} should be a handler`);
  }
});

// ─── callRapidApiProxy: failure modes ─────────────────────────────────────

test('callRapidApiProxy: throws when ZILLOW_PROXY_SECRET is not configured', async () => {
  const origSecret = process.env.ZILLOW_PROXY_SECRET;
  delete process.env.ZILLOW_PROXY_SECRET;
  // Re-require so the SUT picks up the cleared env. The PROXY_SECRET is
  // read at module load (const), so we need a fresh require.
  delete require.cache[SUT_PATH];
  const { callRapidApiProxy: freshCall } = require('../../../lib/agent/zillowProxy');
  try {
    await assert.rejects(() => freshCall('search', {}), /ZILLOW_PROXY_SECRET not configured/);
  } finally {
    process.env.ZILLOW_PROXY_SECRET = origSecret;
    delete require.cache[SUT_PATH];
    require('../../../lib/agent/zillowProxy');  // restore the cached module with secret set
  }
});

test('callRapidApiProxy: HTTP 429 → throws "rate limit exceeded"', async () => {
  setAxiosPost(async () => ({ status: 429, data: {} }));
  await assert.rejects(() => callRapidApiProxy('search', {}), /rate limit exceeded/);
});

test('callRapidApiProxy: HTTP 500 → throws "Zillow proxy error" with status', async () => {
  setAxiosPost(async () => ({ status: 500, data: {} }));
  await assert.rejects(() => callRapidApiProxy('search', {}), /HTTP 500/);
});

test('callRapidApiProxy: HTTP 400 with body.error → throws that error verbatim', async () => {
  setAxiosPost(async () => ({ status: 400, data: { error: 'bad zpid' } }));
  await assert.rejects(() => callRapidApiProxy('search', {}), /bad zpid/);
});

test('callRapidApiProxy: HTTP 200 + {success:false} → throws "Zillow proxy returned error"', async () => {
  setAxiosPost(async () => ({ status: 200, data: { success: false, error: 'upstream zeroed out' } }));
  await assert.rejects(() => callRapidApiProxy('search', {}), /upstream zeroed out/);
});

test('callRapidApiProxy: HTTP 200 + {success:false, no error field} → uses fallback "unknown"', async () => {
  setAxiosPost(async () => ({ status: 200, data: { success: false } }));
  await assert.rejects(() => callRapidApiProxy('search', {}), /unknown/);
});

test('callRapidApiProxy: unwraps response.data.data envelope', async () => {
  setAxiosPost(async () => ({ status: 200, data: { success: true, data: { zpid: 1 } } }));
  const d = await callRapidApiProxy('search', {});
  assert.deepEqual(d, { zpid: 1 });
});

test('callRapidApiProxy: falls through to response.data if no .data envelope present', async () => {
  setAxiosPost(async () => ({ status: 200, data: { zpid: 1 } }));
  const d = await callRapidApiProxy('search', {});
  assert.deepEqual(d, { zpid: 1 });
});

test('callRapidApiProxy: sends x-api-key header + correct URL/body', async () => {
  setAxiosPost(async () => ({ status: 200, data: { success: true, data: {} } }));
  resetAxios();
  await callRapidApiProxy('search', { location: 'Austin, TX' });
  assert.equal(axiosCalls.length, 1);
  const { url, body, cfg } = axiosCalls[0];
  assert.equal(url, 'http://127.0.0.1:3201/zillow');
  assert.deepEqual(body, { action: 'search', searchParams: { location: 'Austin, TX' } });
  assert.equal(cfg.headers['x-api-key'], 'rk-test');
  assert.equal(cfg.timeout, 20000);
});
