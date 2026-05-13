/**
 * Unit tests for the scrape.do client — focused on the bounded 400 retry
 * path added after production saw ~1-in-3 transient 400s for the same URL.
 *
 *   $ node --test test/lib/scrapeDoClient.test.js
 *
 * Mocks axios by replacing the module export inside `require.cache`. This
 * matches the pattern used by sibling tests (no proxyquire dep).
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');

const axiosPath = require.resolve('axios');
const clientPath = require.resolve('../../lib/scrapers/scrapeDoClient');

function loadClientWithMockAxios(axiosImpl) {
  delete require.cache[clientPath];
  const originalAxios = require.cache[axiosPath];
  require.cache[axiosPath] = { id: axiosPath, filename: axiosPath, loaded: true, exports: axiosImpl };
  const mod = require(clientPath);
  return {
    mod,
    restore: () => {
      delete require.cache[clientPath];
      if (originalAxios) require.cache[axiosPath] = originalAxios;
      else delete require.cache[axiosPath];
    },
  };
}

test('scrapeDoClient', async (t) => {
  process.env.SCRAPE_DO_API_TOKEN = process.env.SCRAPE_DO_API_TOKEN || 'test-token';

  await t.test('isTransient400 matches scrape.do concurrent-limit body', () => {
    const { mod, restore } = loadClientWithMockAxios(async () => ({ status: 200, data: '', headers: {} }));
    try {
      assert.equal(mod.isTransient400('Concurrent request limit reached'), true);
      assert.equal(mod.isTransient400('Failed to get response from target server'), true);
      assert.equal(mod.isTransient400('Invalid url'), false);
      assert.equal(mod.isTransient400(''), false);
      assert.equal(mod.isTransient400(null), false);
    } finally {
      restore();
    }
  });

  await t.test('400 with transient body retries once then succeeds', async () => {
    let calls = 0;
    const axiosMock = async () => {
      calls += 1;
      if (calls === 1) {
        return { status: 400, data: 'Concurrent request limit reached', headers: {} };
      }
      return { status: 200, data: '<html>ok</html>', headers: {} };
    };
    const { mod, restore } = loadClientWithMockAxios(axiosMock);
    try {
      const res = await mod.scrape('https://example.com', { maxRetries: 0 });
      assert.equal(res.status, 200);
      assert.equal(calls, 2);
      assert.equal(res.attempts, 2);
    } finally {
      restore();
    }
  });

  await t.test('400 with hard body does NOT retry', async () => {
    let calls = 0;
    const axiosMock = async () => {
      calls += 1;
      return { status: 400, data: 'Invalid url', headers: {} };
    };
    const { mod, restore } = loadClientWithMockAxios(axiosMock);
    try {
      await assert.rejects(
        mod.scrape('https://example.com', { maxRetries: 0 }),
        (err) => err.name === 'ScrapeDoError' && err.status === 400,
      );
      assert.equal(calls, 1);
    } finally {
      restore();
    }
  });

  await t.test('400 transient retry capped at 1', async () => {
    let calls = 0;
    const axiosMock = async () => {
      calls += 1;
      return { status: 400, data: 'Concurrent request limit reached', headers: {} };
    };
    const { mod, restore } = loadClientWithMockAxios(axiosMock);
    try {
      await assert.rejects(
        mod.scrape('https://example.com', { maxRetries: 0 }),
        (err) => err.name === 'ScrapeDoError' && err.status === 400,
      );
      // 1 original attempt + 1 retry = 2 calls. Should NOT keep retrying.
      assert.equal(calls, 2);
    } finally {
      restore();
    }
  });

  await t.test('5xx still retries on default budget independently', async () => {
    let calls = 0;
    const axiosMock = async () => {
      calls += 1;
      if (calls < 3) return { status: 503, data: 'unavailable', headers: {} };
      return { status: 200, data: 'ok', headers: {} };
    };
    const { mod, restore } = loadClientWithMockAxios(axiosMock);
    try {
      const res = await mod.scrape('https://example.com');
      assert.equal(res.status, 200);
      assert.equal(calls, 3);
    } finally {
      restore();
    }
  });
});
