/**
 * Unit tests for the ScrapingBee transport inside scrapeDoClient.
 *
 *   $ node --test test/lib/scrapeDoClient-scrapingbee.test.js
 *
 * scrape.do's account went inactive (HTTP 401 on every call), which took
 * down property search. ScrapingBee is the replacement transport; the
 * client picks it whenever SCRAPINGBEE_API_KEY is set so every caller
 * (Zillow search/detail/autocomplete, skip trace) switches without edits.
 */

const test = require('node:test');
const assert = require('node:assert/strict');

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

function withEnv(vars, fn) {
  const saved = {};
  for (const k of Object.keys(vars)) {
    saved[k] = process.env[k];
    if (vars[k] === undefined) delete process.env[k];
    else process.env[k] = vars[k];
  }
  return Promise.resolve()
    .then(fn)
    .finally(() => {
      for (const k of Object.keys(saved)) {
        if (saved[k] === undefined) delete process.env[k];
        else process.env[k] = saved[k];
      }
    });
}

test('scrapeDoClient — ScrapingBee transport', async (t) => {
  await t.test('uses ScrapingBee when SCRAPINGBEE_API_KEY is set', () =>
    withEnv({ SCRAPINGBEE_API_KEY: 'bee-key', SCRAPE_DO_API_TOKEN: 'do-token', SCRAPER_PROVIDER: undefined }, async () => {
      let seen;
      const { mod, restore } = loadClientWithMockAxios(async (cfg) => {
        seen = cfg;
        return { status: 200, data: '<html>ok</html>', headers: {} };
      });
      try {
        assert.equal(mod.getProvider(), 'scrapingbee');
        await mod.scrape('https://www.zillow.com/beverly-hills-ca-90210/', {
          headers: { 'User-Agent': 'UA', Accept: 'text/html' },
          geoCode: 'us',
          render: false,
        });
        const u = new URL(seen.url);
        assert.equal(u.origin + u.pathname, 'https://app.scrapingbee.com/api/v1/');
        assert.equal(u.searchParams.get('api_key'), 'bee-key');
        assert.equal(u.searchParams.get('url'), 'https://www.zillow.com/beverly-hills-ca-90210/');
        // ScrapingBee renders JS by default (5 credits) — must be explicit.
        assert.equal(u.searchParams.get('render_js'), 'false');
        assert.equal(u.searchParams.get('premium_proxy'), 'true');
        assert.equal(u.searchParams.get('country_code'), 'us');
        assert.equal(u.searchParams.get('forward_headers'), 'true');
        assert.equal(u.searchParams.get('token'), null);
        // Forwarded headers need the Spb- prefix.
        assert.equal(seen.headers['Spb-User-Agent'], 'UA');
        assert.equal(seen.headers['Spb-Accept'], 'text/html');
        assert.equal(seen.headers['User-Agent'], undefined);
      } finally {
        restore();
      }
    }));

  await t.test('super=true maps to stealth_proxy, render=true to render_js', () =>
    withEnv({ SCRAPINGBEE_API_KEY: 'bee-key', SCRAPER_PROVIDER: undefined }, async () => {
      const { mod, restore } = loadClientWithMockAxios(async () => ({ status: 200, data: '', headers: {} }));
      try {
        const u = new URL(mod.buildQuery('https://x.test/', { super: true, render: true, geoCode: 'us', waitFor: 2000 }));
        assert.equal(u.searchParams.get('stealth_proxy'), 'true');
        assert.equal(u.searchParams.get('premium_proxy'), null);
        assert.equal(u.searchParams.get('render_js'), 'true');
        assert.equal(u.searchParams.get('wait'), '2000');
      } finally {
        restore();
      }
    }));

  await t.test('SCRAPER_PROVIDER=scrapedo forces the old transport', () =>
    withEnv({ SCRAPINGBEE_API_KEY: 'bee-key', SCRAPE_DO_API_TOKEN: 'do-token', SCRAPER_PROVIDER: 'scrapedo' }, async () => {
      const { mod, restore } = loadClientWithMockAxios(async () => ({ status: 200, data: '', headers: {} }));
      try {
        assert.equal(mod.getProvider(), 'scrapedo');
        const u = new URL(mod.buildQuery('https://x.test/', {}));
        assert.equal(u.hostname, 'api.scrape.do');
        assert.equal(u.searchParams.get('token'), 'do-token');
      } finally {
        restore();
      }
    }));

  await t.test('falls back to scrape.do when no ScrapingBee key', () =>
    withEnv({ SCRAPINGBEE_API_KEY: undefined, SCRAPE_DO_API_TOKEN: 'do-token', SCRAPER_PROVIDER: undefined }, async () => {
      const { mod, restore } = loadClientWithMockAxios(async () => ({ status: 200, data: '', headers: {} }));
      try {
        assert.equal(mod.getProvider(), 'scrapedo');
        assert.equal(mod.isConfigured(), true);
      } finally {
        restore();
      }
    }));

  await t.test('isConfigured is false when neither key is set', () =>
    withEnv({ SCRAPINGBEE_API_KEY: undefined, SCRAPE_DO_API_TOKEN: undefined, SCRAPER_PROVIDER: undefined }, async () => {
      const { mod, restore } = loadClientWithMockAxios(async () => ({ status: 200, data: '', headers: {} }));
      try {
        assert.equal(mod.isConfigured(), false);
      } finally {
        restore();
      }
    }));

  await t.test('ScrapingBee HTTP 500 is retried (not billed, documented as transient)', () =>
    withEnv({ SCRAPINGBEE_API_KEY: 'bee-key', SCRAPER_PROVIDER: undefined }, async () => {
      let calls = 0;
      const { mod, restore } = loadClientWithMockAxios(async () => {
        calls += 1;
        if (calls === 1) return { status: 500, data: '{"error":"retry"}', headers: {} };
        return { status: 200, data: '<html>ok</html>', headers: {} };
      });
      try {
        const res = await mod.scrape('https://x.test/', { maxRetries: 1 });
        assert.equal(res.status, 200);
        assert.equal(calls, 2);
      } finally {
        restore();
      }
    }));

  await t.test('ScrapingBee 401 surfaces immediately with provider name', () =>
    withEnv({ SCRAPINGBEE_API_KEY: 'bee-key', SCRAPER_PROVIDER: undefined }, async () => {
      let calls = 0;
      const { mod, restore } = loadClientWithMockAxios(async () => {
        calls += 1;
        return { status: 401, data: '{"message":"Invalid api key"}', headers: {} };
      });
      try {
        await assert.rejects(mod.scrape('https://x.test/', { maxRetries: 2 }), (err) => {
          assert.equal(err.status, 401);
          assert.match(err.message, /scrapingbee HTTP 401/);
          return true;
        });
        assert.equal(calls, 1);
      } finally {
        restore();
      }
    }));
});
