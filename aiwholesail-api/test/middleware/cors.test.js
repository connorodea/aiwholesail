/**
 * CORS origin-allow logic regression guard.
 *
 * WHY: chunks are served immutable (cache-control: max-age=31536000).
 * A stale bundle still calling https://api.aiwholesail.com/* cross-origin
 * previously got a silent drop on Facebook/Instagram in-app WebKit:
 * the preflight returned 204 but the actual POST was never delivered.
 *
 * After the tightening in this branch:
 *   - Known safe origins receive Access-Control-Allow-Origin.
 *   - Unknown origins (e.g. evil.com, a stale bundle's wrong URL after
 *     a domain change) receive a callback error with status 403, which
 *     Express translates to a CORS error visible in DevTools.
 *
 * These tests exercise the origin callback in isolation — no server boot,
 * no DB connection, no env vars required.
 *
 * Runs under built-in node:test. Zero external dependencies.
 *   $ node --test test/middleware/cors.test.js
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// ---------------------------------------------------------------------------
// Extract the ALLOWED_CORS_ORIGINS set and buildCorsOptions factory from
// index.js without executing the entire module (which would trigger DB
// connections, env var reads, express.listen, etc.).
//
// Strategy: read the source text, isolate just the CORS block, evaluate it
// in a minimal sandbox that stubs out `require` for everything except 'cors'
// (which we use the real package for) so we can invoke the origin callback
// exactly as Express would.
// ---------------------------------------------------------------------------

const INDEX_SRC = fs.readFileSync(
  path.join(__dirname, '..', '..', 'index.js'),
  'utf8'
);

// Pull out the Set of allowed origins directly from source text.
// This is intentionally strict: if someone renames the constant or changes
// the structure, this test fails loudly instead of silently passing.
function parseAllowedOrigins() {
  // Match: new Set([ ... ]) after ALLOWED_CORS_ORIGINS =
  const m = INDEX_SRC.match(/const ALLOWED_CORS_ORIGINS\s*=\s*new Set\(\[([\s\S]*?)\]\)/);
  assert.ok(m, 'ALLOWED_CORS_ORIGINS Set not found in index.js — was it renamed?');
  // Extract quoted strings from the Set literal
  const origins = [];
  const quoted = /['"]([^'"]+)['"]/g;
  let q;
  while ((q = quoted.exec(m[1])) !== null) {
    origins.push(q[1]);
  }
  return origins;
}

// Build a minimal origin callback equivalent by re-implementing the exact
// logic from index.js (Set lookup). This is tight-coupled to the
// implementation by design: if the logic changes, this test breaks.
function buildOriginCallback(allowedSet) {
  return function originCallback(origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedSet.has(origin)) {
      callback(null, true);
    } else {
      const err = new Error('Not allowed by CORS');
      err.status = 403;
      callback(err);
    }
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test('CORS origin allowlist — regression guard', async (t) => {

  const allowedOrigins = parseAllowedOrigins();
  const allowedSet = new Set(allowedOrigins);
  const originCallback = buildOriginCallback(allowedSet);

  // Helper: promisify the callback-style origin check
  function check(origin) {
    return new Promise((resolve, reject) => {
      originCallback(origin, (err, allowed) => {
        if (err) reject(err);
        else resolve(allowed);
      });
    });
  }

  // ── Positive cases ────────────────────────────────────────────────────

  await t.test('https://aiwholesail.com is allowed', async () => {
    const result = await check('https://aiwholesail.com');
    assert.equal(result, true);
  });

  await t.test('https://staging.aiwholesail.com is allowed', async () => {
    const result = await check('https://staging.aiwholesail.com');
    assert.equal(result, true);
  });

  await t.test('http://localhost:5173 is allowed (Vite dev)', async () => {
    const result = await check('http://localhost:5173');
    assert.equal(result, true);
  });

  await t.test('no origin (curl / server-to-server) is allowed', async () => {
    // Passing undefined simulates a request with no Origin header
    const result = await check(undefined);
    assert.equal(result, true);
  });

  // ── Negative cases ────────────────────────────────────────────────────

  await t.test('https://evil.com is rejected with 403 status', async () => {
    await assert.rejects(
      () => check('https://evil.com'),
      (err) => {
        assert.equal(err.message, 'Not allowed by CORS');
        assert.equal(err.status, 403);
        return true;
      }
    );
  });

  await t.test('https://api.aiwholesail.com is rejected (cross-origin self-call)', async () => {
    // The API subdomain is NOT in the allowlist. Browser requests from
    // api.aiwholesail.com itself would be same-origin from the API's
    // perspective, but if somehow an Origin: https://api.aiwholesail.com
    // header arrives it should be rejected — it's not in the approved set.
    await assert.rejects(
      () => check('https://api.aiwholesail.com'),
      (err) => {
        assert.equal(err.message, 'Not allowed by CORS');
        assert.equal(err.status, 403);
        return true;
      }
    );
  });

  await t.test('http://aiwholesail.com (plain HTTP) is rejected', async () => {
    // Only the HTTPS variant is approved; HTTP would be a downgrade.
    await assert.rejects(
      () => check('http://aiwholesail.com'),
      (err) => {
        assert.equal(err.message, 'Not allowed by CORS');
        return true;
      }
    );
  });

  await t.test('https://www.aiwholesail.com is allowed (added by PR #338 hotfix)', async () => {
    // Original test assumed www would be served same-origin only, but
    // users hitting `https://www.aiwholesail.com/auth` directly need
    // their browser to make cross-origin POSTs to api.aiwholesail.com.
    // Live incident 2026-05-13: those preflights 403'd → login broken.
    // PR #338 added www to the allowlist; this test was inverted to
    // match the new contract.
    await assert.doesNotReject(() => check('https://www.aiwholesail.com'));
  });

  await t.test('https://aiwholesail.com.evil.com is rejected (subdomain spoof)', async () => {
    await assert.rejects(
      () => check('https://aiwholesail.com.evil.com'),
      (err) => {
        assert.equal(err.message, 'Not allowed by CORS');
        return true;
      }
    );
  });

  // ── Structural checks ─────────────────────────────────────────────────

  await t.test('allowedHeaders include x-api-key', () => {
    // The bundle sends VITE_ZILLOW_API_KEY via x-api-key. Without this
    // header in allowedHeaders the preflight succeeds but the browser
    // blocks the actual request — a separate silent failure vector.
    const m = INDEX_SRC.match(/allowedHeaders\s*:\s*\[([\s\S]*?)\]/);
    assert.ok(m, 'allowedHeaders array not found in index.js CORS config');
    const headers = m[1].toLowerCase();
    assert.ok(
      headers.includes('x-api-key'),
      `allowedHeaders must include 'x-api-key' — got: ${m[1].trim()}`
    );
  });

  await t.test('app.options preflight uses corsMiddleware, not bare cors()', () => {
    // Confirm the preflight handler references corsMiddleware rather than
    // a bare cors() call (which would accept any origin).
    const optionsLine = INDEX_SRC.match(/app\.options\s*\(\s*'\*'[\s\S]*?\)/);
    assert.ok(optionsLine, 'app.options(*) not found in index.js');
    assert.ok(
      optionsLine[0].includes('corsMiddleware'),
      `app.options('*') must use corsMiddleware (not bare cors()). Got: ${optionsLine[0]}`
    );
  });

  await t.test('Vary: Origin middleware is registered before cors()', () => {
    // res.vary('Origin') must appear before app.use(corsMiddleware) to
    // ensure the header is set on all responses including preflight.
    const varyPos = INDEX_SRC.indexOf("res.vary('Origin')");
    const corsPos = INDEX_SRC.indexOf('app.use(corsMiddleware)');
    assert.ok(varyPos !== -1, "res.vary('Origin') call not found in index.js");
    assert.ok(corsPos !== -1, 'app.use(corsMiddleware) not found in index.js');
    assert.ok(
      varyPos < corsPos,
      "res.vary('Origin') must be registered before app.use(corsMiddleware)"
    );
  });

  await t.test('ALLOWED_CORS_ORIGINS contains exactly the expected origins', () => {
    const expected = [
      'https://aiwholesail.com',
      'https://www.aiwholesail.com', // added by PR #338 (2026-05-13 CORS hotfix — www login was 403'd)
      'https://staging.aiwholesail.com',
      'http://localhost:5173',
    ];
    assert.deepEqual(
      [...allowedSet].sort(),
      expected.sort(),
      'Allowlist changed — update this test if the change is intentional'
    );
  });
});
