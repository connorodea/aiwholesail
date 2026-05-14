/**
 * /rapidapi/zillow route regression guard.
 *
 * Auth gate (the proxy-secret middleware) is tested separately. This file
 * tests the route handlers themselves with req.user already synthesized,
 * mocking only the upstream proxyZillow call so the test stays hermetic.
 *
 * Runs under built-in node:test.
 *   $ node --test test/routes/rapidapiZillow.test.js
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const Module = require('node:module');

// ── Mock the upstream proxy + the rate-limit middleware ───────────────────
// Lightweight require interceptor — no jest, no proxyquire, just node:module
// hook. Returns the mock when our module under test asks for these deps.
const mocks = {};
const proxyModule = path.resolve(__dirname, '../../lib/agent/zillowProxy.js');
const rateLimitModule = path.resolve(__dirname, '../../middleware/rateLimit.js');
const scrapeDoModule = path.resolve(
  __dirname,
  '../../lib/scrapers/zillowScrapeDo.js'
);
const originalLoad = Module._load;
Module._load = function (request, parent, ...rest) {
  const resolved = (() => {
    try { return Module._resolveFilename(request, parent); }
    catch { return null; }
  })();
  if (resolved === proxyModule && mocks.zillowProxy) return mocks.zillowProxy;
  if (resolved === rateLimitModule && mocks.rateLimit) return mocks.rateLimit;
  if (resolved === scrapeDoModule && mocks.scrapeDo) return mocks.scrapeDo;
  return originalLoad.call(this, request, parent, ...rest);
};

function installMocks({ proxyResult, proxyThrows, rateAllowed = true } = {}) {
  mocks.zillowProxy = {
    proxyZillow: async () => {
      if (proxyThrows) throw proxyThrows;
      return proxyResult;
    },
  };
  mocks.rateLimit = {
    checkDatabaseRateLimit: async () => ({ allowed: rateAllowed }),
  };
  mocks.scrapeDo = {
    ZillowScrapeError: class ZillowScrapeError extends Error {
      constructor(message, reason) {
        super(message);
        this.reason = reason;
      }
    },
  };
}

function clearMocks() {
  delete mocks.zillowProxy;
  delete mocks.rateLimit;
  delete mocks.scrapeDo;
  // Bust the route's cache so each test loads fresh against the new mocks.
  const routePath = path.resolve(__dirname, '../../routes/rapidapiZillow.js');
  delete require.cache[routePath];
}

// ── Express request/response harness ──────────────────────────────────────
function callRoute(router, { method, url, body }) {
  return new Promise((resolve) => {
    const req = {
      method,
      url,
      originalUrl: url,
      headers: {},
      body,
      get(name) { return this.headers[name.toLowerCase()]; },
      user: { id: 'rapidapi:test-user', plan: 'BASIC', source: 'rapidapi' },
    };
    const res = {
      statusCode: 200,
      payload: null,
      headersSent: false,
      status(n) { this.statusCode = n; return this; },
      json(body) { this.payload = body; this.headersSent = true; resolve(this); return this; },
      setHeader() {},
      getHeader() {},
    };
    router.handle(req, res, (err) => {
      if (!res.headersSent) {
        res.statusCode = err ? 500 : 404;
        res.payload = err ? { error: err.message } : { error: 'not found' };
        resolve(res);
      }
    });
  });
}

// ── tests ─────────────────────────────────────────────────────────────────

test('POST /proxy 400s when body is missing the action field', async () => {
  installMocks({ proxyResult: { zestimate: 100 } });
  const router = require('../../routes/rapidapiZillow');

  const res = await callRoute(router, {
    method: 'POST',
    url: '/proxy',
    body: { searchParams: { zpid: '123' } },
  });

  assert.equal(res.statusCode, 400);
  assert.match(res.payload.error, /action required/i);
  clearMocks();
});
