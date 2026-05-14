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

test('proxyHandler returns 429 when rate limit is exceeded', async () => {
  installMocks({ rateAllowed: false });
  const { proxyHandler } = clearAndReloadHandler();

  const res = makeRes();
  await proxyHandler(makeReq({ action: 'zestimate' }), res);

  assert.equal(res.statusCode, 429);
  assert.match(res.payload.error, /rate limit/i);
});

test('proxyHandler returns 200 with proxyZillow result on happy path', async () => {
  installMocks({ proxyResult: { zestimate: 425000, currency: 'USD' } });
  const { proxyHandler } = clearAndReloadHandler();

  const res = makeRes();
  await proxyHandler(
    makeReq({ action: 'zestimate', searchParams: { zpid: '9999' } }),
    res
  );

  assert.equal(res.statusCode, 200);
  assert.equal(res.payload.success, true);
  assert.deepEqual(res.payload.data, { zestimate: 425000, currency: 'USD' });
});

test('proxyHandler soft-200s when upstream signals no_data_in_payload', async () => {
  // ZillowScrapeError with reason='no_data_in_payload' means the listing is
  // valid but lacks the requested widget (walkScore, climate, etc.). Returning
  // 500 here would page on-call for a legitimate empty result; consumers
  // already handle data=null + reason.
  installMocks({
    proxyThrows: new FakeZillowScrapeError('no walkScore widget', 'no_data_in_payload'),
  });
  const { proxyHandler } = clearAndReloadHandler();

  const res = makeRes();
  await proxyHandler(makeReq({ action: 'walkScore' }), res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.payload.success, true);
  assert.equal(res.payload.data, null);
  assert.equal(res.payload.reason, 'no_data_in_payload');
});

test('proxyHandler soft-200s when upstream signals no_property_in_payload', async () => {
  installMocks({
    proxyThrows: new FakeZillowScrapeError('removed listing', 'no_property_in_payload'),
  });
  const { proxyHandler } = clearAndReloadHandler();

  const res = makeRes();
  await proxyHandler(makeReq({ action: 'propertyDetails' }), res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.payload.data, null);
  assert.equal(res.payload.reason, 'no_property_in_payload');
});

test('proxyHandler returns 500 on other upstream errors', async () => {
  installMocks({ proxyThrows: new Error('scrape.do upstream timeout') });
  const { proxyHandler } = clearAndReloadHandler();

  const res = makeRes();
  await proxyHandler(makeReq({ action: 'zestimate' }), res);

  assert.equal(res.statusCode, 500);
  assert.equal(res.payload.success, false);
  assert.match(res.payload.error, /scrape\.do upstream/);
});

// ── batchHandler ──────────────────────────────────────────────────────────

test('batchHandler returns 400 when zpids array is missing', async () => {
  installMocks();
  const { batchHandler } = clearAndReloadHandler();

  const res = makeRes();
  await batchHandler(makeReq({}), res);

  assert.equal(res.statusCode, 400);
  assert.match(res.payload.error, /zpids array required/i);
});

test('batchHandler returns 400 when zpids array is empty', async () => {
  installMocks();
  const { batchHandler } = clearAndReloadHandler();

  const res = makeRes();
  await batchHandler(makeReq({ zpids: [] }), res);

  assert.equal(res.statusCode, 400);
});

test('batchHandler returns 400 when zpids contains more than 100 entries', async () => {
  installMocks();
  const { batchHandler } = clearAndReloadHandler();

  const tooMany = Array.from({ length: 101 }, (_, i) => String(i));
  const res = makeRes();
  await batchHandler(makeReq({ zpids: tooMany }), res);

  assert.equal(res.statusCode, 400);
  assert.match(res.payload.error, /max 100/i);
});
