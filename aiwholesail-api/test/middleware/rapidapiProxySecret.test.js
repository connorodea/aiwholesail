/**
 * RapidAPI proxy-secret middleware regression guard.
 *
 * Validates the auth gate for the /rapidapi/* route family: only requests
 * forwarded by RapidAPI's gateway (which carry an X-RapidAPI-Proxy-Secret
 * header matching our env-configured value) should pass.
 *
 * Runs under built-in node:test. Zero external deps beyond node:test/assert.
 *   $ node --test test/middleware/rapidapiProxySecret.test.js
 */

const test = require('node:test');
const assert = require('node:assert/strict');

const { rapidapiProxySecret } =
  require('../../middleware/rapidapiProxySecret');

// ── tiny req/res/next test doubles ─────────────────────────────────────────
function makeReq(headers = {}) {
  const lower = Object.fromEntries(
    Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v])
  );
  return {
    get(name) {
      return lower[name.toLowerCase()];
    },
  };
}

function makeRes() {
  const res = {};
  res.statusCode = 200;
  res.payload = null;
  res.status = (n) => {
    res.statusCode = n;
    return res;
  };
  res.json = (b) => {
    res.payload = b;
    return res;
  };
  return res;
}

function makeNext() {
  const calls = [];
  const fn = () => calls.push(true);
  fn.called = () => calls.length > 0;
  return fn;
}

// ── tests ─────────────────────────────────────────────────────────────────

test('rejects with 401 when no proxy-secret header is present', (t) => {
  t.before = process.env.RAPIDAPI_PROXY_SECRET;
  process.env.RAPIDAPI_PROXY_SECRET = 'expected-secret-value';

  const req = makeReq({});
  const res = makeRes();
  const next = makeNext();

  rapidapiProxySecret(req, res, next);

  assert.equal(res.statusCode, 401);
  assert.equal(next.called(), false, 'next() must not be called');
  assert.equal(res.payload.success, false);
  assert.match(res.payload.error, /proxy secret/i);

  process.env.RAPIDAPI_PROXY_SECRET = t.before || '';
});

test('rejects with 401 when the proxy-secret header is wrong', (t) => {
  t.before = process.env.RAPIDAPI_PROXY_SECRET;
  process.env.RAPIDAPI_PROXY_SECRET = 'expected-secret-value';

  const req = makeReq({ 'X-RapidAPI-Proxy-Secret': 'wrong-attacker-value' });
  const res = makeRes();
  const next = makeNext();

  rapidapiProxySecret(req, res, next);

  assert.equal(res.statusCode, 401);
  assert.equal(next.called(), false);

  process.env.RAPIDAPI_PROXY_SECRET = t.before || '';
});

test('returns 503 when RAPIDAPI_PROXY_SECRET is not configured', (t) => {
  t.before = process.env.RAPIDAPI_PROXY_SECRET;
  delete process.env.RAPIDAPI_PROXY_SECRET;

  const req = makeReq({ 'X-RapidAPI-Proxy-Secret': 'anything' });
  const res = makeRes();
  const next = makeNext();

  rapidapiProxySecret(req, res, next);

  // Fail-closed: 503 distinguishes "we're broken" from "you sent the
  // wrong credential" (401). Wrong status here would let bare-internet
  // traffic through on first deploy if the secret env var is missing.
  assert.equal(res.statusCode, 503);
  assert.equal(next.called(), false);
  assert.match(res.payload.error, /not configured/i);

  if (t.before) process.env.RAPIDAPI_PROXY_SECRET = t.before;
});

test('calls next() when the proxy-secret header matches', (t) => {
  t.before = process.env.RAPIDAPI_PROXY_SECRET;
  process.env.RAPIDAPI_PROXY_SECRET = 'the-correct-secret-value';

  const req = makeReq({ 'X-RapidAPI-Proxy-Secret': 'the-correct-secret-value' });
  const res = makeRes();
  const next = makeNext();

  rapidapiProxySecret(req, res, next);

  assert.equal(next.called(), true, 'next() must be called on success');
  assert.equal(res.statusCode, 200, 'no error response sent');

  process.env.RAPIDAPI_PROXY_SECRET = t.before || '';
});
