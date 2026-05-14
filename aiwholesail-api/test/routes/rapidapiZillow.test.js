/**
 * /rapidapi/zillow handler regression guard.
 *
 * Tests the pure handler functions from handlers/rapidapiZillow.js — no
 * express, no router. The auth gate is tested separately in
 * test/middleware/rapidapiProxySecret.test.js.
 *
 * Upstream proxyZillow + rate-limit + scrape-do error class are mocked via
 * node:module._load so each test stays hermetic (no DB, no network).
 *
 * Runs under built-in node:test.
 *   $ node --test test/routes/rapidapiZillow.test.js
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const Module = require('node:module');

// ── Mock injection ────────────────────────────────────────────────────────
const mocks = {};
const proxyModule = path.resolve(__dirname, '../../lib/agent/zillowProxy.js');
const rateLimitModule = path.resolve(
  __dirname,
  '../../middleware/rateLimit.js'
);
const scrapeDoModule = path.resolve(
  __dirname,
  '../../lib/scrapers/zillowScrapeDo.js'
);
const originalLoad = Module._load;
Module._load = function (request, parent, ...rest) {
  let resolved = null;
  try { resolved = Module._resolveFilename(request, parent); } catch {}
  if (resolved === proxyModule && mocks.zillowProxy) return mocks.zillowProxy;
  if (resolved === rateLimitModule && mocks.rateLimit) return mocks.rateLimit;
  if (resolved === scrapeDoModule && mocks.scrapeDo) return mocks.scrapeDo;
  return originalLoad.call(this, request, parent, ...rest);
};

class FakeZillowScrapeError extends Error {
  constructor(message, reason) {
    super(message);
    this.reason = reason;
    this.name = 'ZillowScrapeError';
  }
}

function installMocks({
  proxyResult = null,
  proxyThrows = null,
  rateAllowed = true,
} = {}) {
  mocks.zillowProxy = {
    proxyZillow: async () => {
      if (proxyThrows) throw proxyThrows;
      return proxyResult;
    },
  };
  mocks.rateLimit = {
    checkDatabaseRateLimit: async () => ({ allowed: rateAllowed }),
  };
  mocks.scrapeDo = { ZillowScrapeError: FakeZillowScrapeError };
}

function clearAndReloadHandler() {
  // Clear cached handler so it picks up freshly-installed mocks each test.
  const handlerPath = path.resolve(
    __dirname,
    '../../handlers/rapidapiZillow.js'
  );
  delete require.cache[handlerPath];
  return require('../../handlers/rapidapiZillow');
}

// ── res double ────────────────────────────────────────────────────────────
function makeRes() {
  return {
    statusCode: 200,
    payload: null,
    status(n) { this.statusCode = n; return this; },
    json(b) { this.payload = b; return this; },
  };
}
function makeReq(body, user = { id: 'rapidapi:t', plan: 'BASIC', source: 'rapidapi' }) {
  return { body, user };
}

// ── tests ─────────────────────────────────────────────────────────────────

test('proxyHandler returns 400 when body has no action field', async () => {
  installMocks();
  const { proxyHandler } = clearAndReloadHandler();

  const res = makeRes();
  await proxyHandler(makeReq({ searchParams: { zpid: '123' } }), res);

  assert.equal(res.statusCode, 400);
  assert.match(res.payload.error, /action required/i);
});
