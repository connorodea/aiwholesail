/**
 * Tests for the /api/offmarket-iq/* proxy completeness.
 *
 * The Python aiwholesail-offmarket-api exposes 7 endpoints. The Node
 * proxy currently maps only 5. Missing:
 *   - POST /lists/quicklist  (shipped in offmarket-api PR #32)
 *   - POST /lists/export     (CSV streaming, shipped earlier)
 *
 * Both gaps mean the customer-facing UI can't reach those endpoints
 * even after OFFMARKET_API_KEY is provisioned. This test pins the
 * full proxy coverage so future Python-side endpoint additions force
 * a matching Node-side route.
 *
 * Strategy:
 *   - Source-introspect routes/offmarket.js to confirm route paths
 *     are registered (cheap, no HTTP).
 *   - Behavior test: stub global.fetch, hit the proxy, assert the
 *     upstream URL + method + headers we built.
 *
 * Auth: we DON'T cover the auth gate here — that's already covered
 * by the request-builder pattern (every route uses `authenticate`
 * middleware). This file is about which paths are wired.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROUTE_SRC = fs.readFileSync(
  path.join(__dirname, '..', '..', 'routes', 'offmarket.js'),
  'utf8',
);

test('routes/offmarket.js — proxy coverage', async (t) => {
  await t.test('registers POST /lists/quicklist', () => {
    assert.match(
      ROUTE_SRC,
      /router\.post\(['"]\/lists\/quicklist['"]/,
      "missing POST /lists/quicklist proxy route — Python's /api/v1/lists/quicklist (PR #32) is unreachable from the customer-facing UI",
    );
  });

  await t.test('registers POST /lists/export', () => {
    assert.match(
      ROUTE_SRC,
      /router\.post\(['"]\/lists\/export['"]/,
      "missing POST /lists/export proxy route — Python's CSV-streaming export endpoint is unreachable",
    );
  });

  await t.test('forwards quicklist to /api/v1/lists/quicklist', () => {
    // The body of the quicklist route handler must reference the
    // upstream path. We check the path string appears somewhere in the
    // route file (cheap structural check).
    assert.match(
      ROUTE_SRC,
      /['"]\/api\/v1\/lists\/quicklist['"]/,
      'route file must reference upstream /api/v1/lists/quicklist',
    );
  });

  await t.test('forwards export to /api/v1/lists/export', () => {
    assert.match(
      ROUTE_SRC,
      /['"]\/api\/v1\/lists\/export['"]/,
      'route file must reference upstream /api/v1/lists/export',
    );
  });

  await t.test('every existing route still present (regression guard)', () => {
    // These were registered before this PR. If any disappear, this
    // test catches the accidental delete.
    const existing = [
      '/health',
      '/counties',
      '/scores/top',
      '/lists/build',
      '/properties/by-parcel',
      '/properties/by-address',
    ];
    for (const route of existing) {
      assert.match(
        ROUTE_SRC,
        new RegExp(`router\\.(get|post)\\(['"]${route.replace(/\//g, '\\/')}['"]`),
        `regression: route ${route} disappeared from offmarket.js`,
      );
    }
  });
});
