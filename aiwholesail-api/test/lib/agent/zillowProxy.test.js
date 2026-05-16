/**
 * Unit tests for lib/agent/zillowProxy.js.
 *
 * Post-refactor contract (2026-05-16): RapidAPI is GONE from the Zillow
 * stack. Every action is served by scrape.do (lib/scrapers/zillowScrapeDo).
 * Unmapped actions throw "Unsupported Zillow action" instead of silently
 * falling back to a dead proxy. There is no `callRapidApiProxy` export.
 *
 * The prior "scrape.do primary + RapidAPI fallback" tests have been
 * removed — those documented behavior that no longer exists. The
 * regression guard at the bottom asserts the module surface stays
 * RapidAPI-free.
 *
 * Mock strategy: substitute `../../lib/scrapers/zillowScrapeDo` in
 * require.cache before loading the SUT. No axios mock needed — proxyZillow
 * no longer makes HTTP calls of its own.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');

// ─── Fake zillowScrapeDo ──────────────────────────────────────────────────

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

const SUT_PATH = require.resolve('../../../lib/agent/zillowProxy');
delete require.cache[SUT_PATH];
const SUT = require('../../../lib/agent/zillowProxy');
const { proxyZillow, SCRAPE_DO_ACTIONS } = SUT;

function silence(fn) {
  const o1 = console.log, o2 = console.warn, o3 = console.error;
  console.log = () => {}; console.warn = () => {}; console.error = () => {};
  return Promise.resolve(fn()).finally(() => { console.log = o1; console.warn = o2; console.error = o3; });
}

// ─── proxyZillow: happy path ──────────────────────────────────────────────

test('proxyZillow: action with scrape.do handler → serves from scrape.do', async () => {
  setPropertyDetails(async () => ({ zpid: 1, from: 'scrape.do' }));
  await silence(async () => {
    const d = await proxyZillow('propertyDetails', { zpid: 1 });
    assert.deepEqual(d, { zpid: 1, from: 'scrape.do' });
  });
});

// ─── proxyZillow: scrape.do error → propagates (no fallback) ──────────────

test('proxyZillow: scrape.do throws ZillowScrapeError (no-data) → re-throws, no fallback', async () => {
  setWalkScore(async () => {
    throw new FakeZillowScrapeError('no walk score widget on this listing', { reason: 'no_data_in_payload' });
  });
  await silence(async () => {
    await assert.rejects(() => proxyZillow('walkScore', { zpid: 1 }), /no walk score widget/);
  });
});

test('proxyZillow: scrape.do throws ZillowScrapeError (no_property_in_payload) → re-throws, no fallback', async () => {
  setWalkScore(async () => {
    throw new FakeZillowScrapeError('property stripped from page', { reason: 'no_property_in_payload' });
  });
  await silence(async () => {
    await assert.rejects(() => proxyZillow('walkScore', { zpid: 1 }), /property stripped/);
  });
});

test('proxyZillow: scrape.do throws generic Error (network/captcha) → re-throws scrape.do error, no fallback attempt', async () => {
  // Used to fall back to RapidAPI. Now: scrape.do is the single source of
  // truth, so any error from it is the error the caller sees.
  setPropertyDetails(async () => { throw new Error('ECONNRESET'); });
  await silence(async () => {
    await assert.rejects(() => proxyZillow('propertyDetails', { zpid: 1 }), /ECONNRESET/);
  });
});

// ─── proxyZillow: unmapped action → throws (no silent RapidAPI passthrough) ─

test('proxyZillow: action with no scrape.do handler → throws "Unsupported Zillow action"', async () => {
  await silence(async () => {
    await assert.rejects(
      () => proxyZillow('not-a-real-action', {}),
      /Unsupported Zillow action: not-a-real-action/,
    );
  });
});

// ─── Module surface: RapidAPI removal regression guard ────────────────────

test('proxyZillow module surface: no callRapidApiProxy export (RapidAPI removed)', () => {
  assert.equal(SUT.callRapidApiProxy, undefined, 'callRapidApiProxy must not be exported');
});

test('proxyZillow module surface: no axios import (no RapidAPI HTTP calls)', () => {
  const fs = require('node:fs');
  const src = fs.readFileSync(require.resolve('../../../lib/agent/zillowProxy'), 'utf8');
  assert.equal(/require\s*\(\s*['"]axios['"]\s*\)/.test(src), false, 'axios import must be removed');
  assert.equal(/rapidapi/i.test(src), false, 'no rapidapi references should remain in zillowProxy.js source');
});

// ─── SCRAPE_DO_ACTIONS map shape (unchanged) ──────────────────────────────

test('SCRAPE_DO_ACTIONS exports a non-empty map of action → handler function', () => {
  assert.ok(typeof SCRAPE_DO_ACTIONS === 'object');
  const keys = Object.keys(SCRAPE_DO_ACTIONS);
  assert.ok(keys.length >= 20, 'expected 20+ supported actions');
  for (const k of ['propertyDetails', 'comps', 'walkScore', 'search', 'mortgageRates']) {
    assert.equal(typeof SCRAPE_DO_ACTIONS[k], 'function', `${k} should be a handler`);
  }
});
