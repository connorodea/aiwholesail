/**
 * Tests for the spread-alert-worker's URL builders.
 *
 * Why this exists (retrospective review of #380/#374/#378, May 2026):
 *
 *   `aiwholesail-api/scripts/spread-alert-worker.js` previously built the
 *   primary card link inline as `zUrl || appUrl`, where `appUrl` came
 *   from `appPropUrl(d.zpid || '')`. When BOTH `d.zpid` AND `d.listing_url`
 *   were missing (a corrupt cache row, or future cache shapes that drop
 *   those fields), the user got an alert email with broken links:
 *
 *     <a href="https://aiwholesail.com/app?zpid=&utm_source=alert-email">
 *
 *   Clicking did nothing useful — landed the user on a generic /app page
 *   with no property context. The reviewer flagged it as Minor #3 (no
 *   prod incidents yet because all 22.8K current cache rows have both
 *   fields), but it's a latent bug as the cache grows.
 *
 *   Fix: extract URL building to a pure helper that returns null when
 *   no valid URL can be built. Worker conditionally renders the anchor
 *   wrapper instead of emitting a broken href.
 *
 * Test pattern: pure JS, `node --test`, no mocks.
 */

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  zillowUrl,
  appPropUrl,
  buildPrimaryUrl,
} = require('../../lib/spread-alert-urls');

test('zillowUrl — absolute listing_url returned as-is', () => {
  const r = zillowUrl({ listing_url: 'https://www.zillow.com/homedetails/12345_zpid/' });
  assert.equal(r, 'https://www.zillow.com/homedetails/12345_zpid/');
});

test('zillowUrl — http (non-https) absolute also returned as-is', () => {
  const r = zillowUrl({ listing_url: 'http://www.zillow.com/homedetails/12345_zpid/' });
  assert.equal(r, 'http://www.zillow.com/homedetails/12345_zpid/');
});

test('zillowUrl — relative path gets zillow.com prefix', () => {
  const r = zillowUrl({ listing_url: '/homedetails/12345_zpid/' });
  assert.equal(r, 'https://www.zillow.com/homedetails/12345_zpid/');
});

test('zillowUrl — falls back to zpid when listing_url absent', () => {
  const r = zillowUrl({ zpid: '12345' });
  assert.equal(r, 'https://www.zillow.com/homedetails/12345_zpid/');
});

test('zillowUrl — encodes special chars in zpid', () => {
  // Belt-and-suspenders: zpid is supposed to be all-digits, but
  // encodeURIComponent guards against unexpected input.
  const r = zillowUrl({ zpid: '123&45' });
  assert.equal(r, 'https://www.zillow.com/homedetails/123%2645_zpid/');
});

test('zillowUrl — returns null when neither listing_url nor zpid is present', () => {
  assert.equal(zillowUrl({}), null);
  assert.equal(zillowUrl({ listing_url: null, zpid: null }), null);
  assert.equal(zillowUrl({ listing_url: '', zpid: '' }), null);
});

test('zillowUrl — non-http(s) listing_url is treated as invalid', () => {
  // A javascript: or file: URL must not be propagated into an email
  // link — XSS surface. Falls through to zpid (if any) or null.
  const r = zillowUrl({ listing_url: 'javascript:alert(1)', zpid: '12345' });
  assert.equal(r, 'https://www.zillow.com/homedetails/12345_zpid/');
});

test('zillowUrl — defensive on null/undefined input', () => {
  assert.equal(zillowUrl(null), null);
  assert.equal(zillowUrl(undefined), null);
  assert.equal(zillowUrl('not an object'), null);
});

test('appPropUrl — encodes the zpid into the in-app URL', () => {
  const r = appPropUrl('12345');
  assert.equal(r, 'https://aiwholesail.com/app?zpid=12345&utm_source=alert-email');
});

test('buildPrimaryUrl — prefers zillowUrl when available', () => {
  const r = buildPrimaryUrl({ listing_url: 'https://www.zillow.com/homedetails/12345_zpid/', zpid: '12345' });
  assert.equal(r, 'https://www.zillow.com/homedetails/12345_zpid/');
});

test('buildPrimaryUrl — falls back to appPropUrl when no zillowUrl but zpid exists', () => {
  // Edge case: no listing_url, has zpid. zillowUrl builds the homedetails
  // URL from zpid, so buildPrimaryUrl returns that — NOT the in-app URL.
  // The in-app fallback only triggers when zillowUrl can't produce anything.
  // This test documents the layering.
  const r = buildPrimaryUrl({ zpid: '12345' });
  assert.equal(r, 'https://www.zillow.com/homedetails/12345_zpid/');
});

test('buildPrimaryUrl — returns null when no URL can be built (THE BUG FIX)', () => {
  // The pre-fix worker would have built:
  //   primaryUrl = "https://aiwholesail.com/app?zpid=&utm_source=alert-email"
  // …a broken URL that opens the in-app page with no property context.
  //
  // Post-fix: buildPrimaryUrl returns null and the worker renders the
  // image / address cells without a clickable wrapper.
  assert.equal(buildPrimaryUrl({}), null);
  assert.equal(buildPrimaryUrl({ listing_url: '', zpid: '' }), null);
  assert.equal(buildPrimaryUrl({ listing_url: null, zpid: null }), null);
  assert.equal(buildPrimaryUrl(null), null);
  assert.equal(buildPrimaryUrl(undefined), null);
});

test('buildPrimaryUrl — javascript: URL is not propagated (no XSS)', () => {
  // The reviewer didn't flag this but it's worth a defensive guard.
  // If somehow a malicious listing_url makes it into the cache, we
  // must not embed it in an email <a href> verbatim.
  const r = buildPrimaryUrl({ listing_url: 'javascript:alert(1)' });
  assert.equal(r, null);
});

test('zillowUrl — trims leading/trailing whitespace from listing_url', () => {
  // Defensive: shell quoting or copy-paste sometimes brings whitespace
  // around URLs. Trim before the protocol check so we don't fall through
  // to the zpid path or null.
  const r = zillowUrl({ listing_url: '  https://www.zillow.com/homedetails/12345_zpid/  ' });
  assert.equal(r, 'https://www.zillow.com/homedetails/12345_zpid/');
});

test('zillowUrl — trims whitespace from relative-path listing_url too', () => {
  // The trim happens before BOTH the protocol check and the startsWith('/')
  // check, so the relative-path branch correctly inherits the trim.
  const r = zillowUrl({ listing_url: '  /homedetails/12345_zpid/  ' });
  assert.equal(r, 'https://www.zillow.com/homedetails/12345_zpid/');
});
