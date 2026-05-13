/**
 * Unit tests for the route-layer Zillow fallback wrapper.
 *
 *   $ node --test test/lib/zillowFallback.test.js
 *
 * Mocks scrape.do by monkey-patching the `zillowScrapeDo` module's exports
 * inside each test and restoring afterwards — keeps the test simple and
 * dependency-free (no proxyquire).
 */

const test = require('node:test');
const assert = require('node:assert/strict');

const zillowScrapeDo = require('../../lib/scrapers/zillowScrapeDo');
const { withZillowFallback } = require('../../lib/zillowFallback');

/**
 * Temporarily install `fn` as the handler for `action` on the scrape.do
 * module and return a restore function. Allows each test to define exactly
 * the behaviour it wants without leaking state into sibling tests.
 */
function patchHandler(action, fn) {
  const original = zillowScrapeDo[action];
  const had = Object.prototype.hasOwnProperty.call(zillowScrapeDo, action);
  zillowScrapeDo[action] = fn;
  return () => {
    if (had) {
      zillowScrapeDo[action] = original;
    } else {
      delete zillowScrapeDo[action];
    }
  };
}

test('withZillowFallback', async (t) => {
  await t.test('happy path: returns RapidAPI data, scrape.do never invoked', async () => {
    let scrapeCalled = false;
    const restore = patchHandler('search', async () => {
      scrapeCalled = true;
      return { results: ['from-scrape'] };
    });
    try {
      const rapidPayload = { results: ['from-rapid'] };
      const out = await withZillowFallback(
        async () => rapidPayload,
        'search',
        { location: 'Austin, TX' }
      );
      assert.deepEqual(out, rapidPayload);
      assert.equal(scrapeCalled, false, 'scrape.do handler must not be called on RapidAPI success');
    } finally {
      restore();
    }
  });

  await t.test('RapidAPI throws → scrape.do handler invoked, returns its data', async () => {
    let scrapeArgs = null;
    const restore = patchHandler('propertyDetails', async (args) => {
      scrapeArgs = args;
      return { zpid: '12345', address: '1 Main St' };
    });
    try {
      const out = await withZillowFallback(
        async () => { throw new Error('RapidAPI HTTP 503'); },
        'propertyDetails',
        { zpid: '12345' }
      );
      assert.deepEqual(out, { zpid: '12345', address: '1 Main St' });
      assert.deepEqual(scrapeArgs, { zpid: '12345' }, 'scrape.do handler receives the scrapeArgs');
    } finally {
      restore();
    }
  });

  await t.test('both fail → throws the ORIGINAL RapidAPI error (not the scrape.do error)', async () => {
    const restore = patchHandler('comps', async () => {
      throw new Error('scrape.do blocked by captcha');
    });
    try {
      const rapidErr = new Error('RapidAPI HTTP 500');
      await assert.rejects(
        withZillowFallback(
          async () => { throw rapidErr; },
          'comps',
          { zpid: '999' }
        ),
        (err) => {
          assert.equal(err, rapidErr, 'must rethrow the exact RapidAPI error object');
          assert.equal(err.message, 'RapidAPI HTTP 500');
          return true;
        }
      );
    } finally {
      restore();
    }
  });

  await t.test('unknown action (handler missing) → throws RapidAPI error immediately', async () => {
    const action = '__nonexistent_action_for_test__';
    assert.equal(zillowScrapeDo[action], undefined, 'precondition: action is not defined');
    const rapidErr = new Error('RapidAPI HTTP 502');
    await assert.rejects(
      withZillowFallback(
        async () => { throw rapidErr; },
        action,
        {}
      ),
      (err) => {
        assert.equal(err, rapidErr, 'must rethrow the exact RapidAPI error object');
        return true;
      }
    );
  });
});
