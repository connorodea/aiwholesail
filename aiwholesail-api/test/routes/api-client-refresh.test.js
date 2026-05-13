/**
 * Regression guard for the frontend api-client refresh flow.
 *
 * Why this exists (session-lifetime regression, May 2026):
 *   A paying customer's session went 401-forever within ~3 minutes of a
 *   successful signin. Timeline:
 *     14:13:20  POST /api/auth/signin                → 200
 *     14:15:14  GET  /api/favorites                  → 200
 *     14:15:14  GET  /api/stripe/subscription        → 200
 *     14:15:56  POST /api/auth/signout               → 401  ← session dead
 *     14:22:55  POST /api/zillow/proxy               → 401  ← still dead
 *     14:28:19+ every authenticated call             → 401  ← unrecoverable
 *
 *   Root cause: parallel refresh race in src/lib/api-client.ts.
 *
 *   The backend rotates the refresh token on every /refresh call (revokes
 *   the old row, issues a new one — correct security hygiene). If two 401s
 *   race a refresh:
 *     T0  R1 + R2 both read RT1 from localStorage.
 *     T1  R1 POSTs /refresh — backend revokes RT1, returns AT2 + RT2 (200).
 *     T2  R1 writes AT2 + RT2 to localStorage.
 *     T3  R2 POSTs /refresh with the now-revoked RT1 — backend returns 401.
 *     T4  R2 receives 401 → apiFetch clears tokenStorage → wipes AT2 + RT2.
 *   Net effect: a user who was authenticated 2s ago is now permanently 401'd.
 *
 *   The fix is a per-tab single-flight mutex on the refresh promise so all
 *   concurrent callers share one /refresh call. The losers no longer exist.
 *
 *   Secondary fix: refuse to overwrite stored tokens with falsy values.
 *   If the server responds 200 but the body is malformed (empty / missing
 *   accessToken / network truncation), the old code wrote
 *   localStorage.setItem(KEY, undefined) which stores the string "undefined"
 *   — every subsequent request then sends `Authorization: Bearer undefined`
 *   and 401-loops with `Invalid token` (NOT TOKEN_EXPIRED, so no further
 *   refresh attempt fires, just permanent 401s).
 *
 * Approach: file-source introspection, matching the pattern in
 * stripe-checkout-config.test.js. Cheap, fragile, but catches the exact
 * revert we care about. Upgrade to behavior-level tests when the frontend
 * has a test runner (vitest/jest) wired up.
 *
 * Runs under built-in node:test. Zero external dependencies.
 *   $ npm test    (from aiwholesail-api/)
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.join(__dirname, '..', '..', '..');
const API_CLIENT = path.join(REPO_ROOT, 'src', 'lib', 'api-client.ts');
const AUTH_ROUTE = path.join(REPO_ROOT, 'aiwholesail-api', 'routes', 'auth.js');

const read = (file) => fs.readFileSync(file, 'utf8');

test('api-client refresh — regression guard', async (t) => {

  // ─── Single-flight refresh promise ───────────────────────────────────
  await t.test('api-client.ts coalesces concurrent /refresh calls into one in-flight promise', () => {
    const source = read(API_CLIENT);

    // Must declare a module-scoped variable that holds the in-flight promise.
    // This is the gate: if it's set, new callers piggy-back on it instead of
    // firing a parallel /refresh that would race the rotation.
    assert.match(
      source,
      /let\s+refreshPromise\s*:\s*Promise<\s*boolean\s*>\s*\|\s*null\s*=\s*null/,
      'refreshAccessToken() must coalesce concurrent calls via a module-scoped ' +
      '`let refreshPromise: Promise<boolean> | null = null` gate. ' +
      'Without it, two parallel 401s race the backend refresh-token rotation ' +
      'and the loser wipes the winner\'s freshly-issued tokens. This is the ' +
      'May-2026 session-lifetime regression — do not remove the gate without ' +
      'replacing it with an equivalent mechanism.'
    );

    // Must short-circuit on a non-null in-flight promise.
    assert.match(
      source,
      /if\s*\(\s*refreshPromise\s*\)\s*return\s+refreshPromise/,
      'refreshAccessToken() must short-circuit when a refresh is already in flight. ' +
      'Expected: `if (refreshPromise) return refreshPromise;`'
    );

    // Must clear the gate AFTER the promise settles, not synchronously.
    // Synchronous clear would let a second caller re-enter doRefresh() with
    // the same now-revoked refresh token. .finally() guarantees the gate
    // stays set for the full duration of the network round-trip.
    assert.match(
      source,
      /\.finally\s*\(\s*\(\s*\)\s*=>\s*\{[^}]*refreshPromise\s*=\s*null/,
      'refreshAccessToken() must clear the in-flight gate inside .finally() so ' +
      'the gate stays set for the full duration of the network round-trip. ' +
      'Clearing synchronously re-introduces the race.'
    );
  });

  // ─── Null/empty token guards ─────────────────────────────────────────
  await t.test('api-client.ts refuses to overwrite stored tokens with falsy values', () => {
    const source = read(API_CLIENT);

    // Must guard accessToken against non-string / empty values before write.
    // `localStorage.setItem(KEY, undefined)` would store the string
    // "undefined" — subsequent requests send `Authorization: Bearer undefined`
    // and 401-loop with "Invalid token" forever (no TOKEN_EXPIRED code → no
    // refresh attempt → no recovery path).
    assert.match(
      source,
      /typeof\s+data\?\.\s*accessToken\s*!==\s*['"]string['"]\s*\|\|\s*data\.accessToken\.length\s*===\s*0/,
      'doRefresh() must guard against falsy accessToken before writing to ' +
      'localStorage. A 200 response with a missing/empty accessToken would ' +
      'otherwise store the string "undefined" and permanently break the session.'
    );

    assert.match(
      source,
      /typeof\s+data\?\.\s*refreshToken\s*!==\s*['"]string['"]\s*\|\|\s*data\.refreshToken\.length\s*===\s*0/,
      'doRefresh() must guard against falsy refreshToken before writing to ' +
      'localStorage. Same failure mode as the accessToken guard.'
    );
  });

  // ─── Backend invariant the client relies on ──────────────────────────
  await t.test('routes/auth.js /refresh continues to rotate the refresh token', () => {
    // This test documents that the client-side single-flight is necessary
    // BECAUSE the server rotates the refresh token. If we ever switch to a
    // non-rotating refresh model (e.g., long-lived opaque refresh tokens
    // that don't get revoked on use), the client mutex becomes redundant
    // but harmless. Until then, the rotation + the mutex are paired.
    const source = read(AUTH_ROUTE);
    assert.match(
      source,
      /UPDATE\s+sessions\s+SET\s+revoked\s*=\s*true\s+WHERE\s+refresh_token\s*=\s*\$1/i,
      '/api/auth/refresh must continue to revoke the old refresh token on use ' +
      '(security: defends against token theft / replay). The client-side ' +
      'single-flight refresh in api-client.ts exists specifically because of ' +
      'this rotation. If you change rotation behavior, revisit the client mutex.'
    );

    // The /refresh handler must issue a NEW refresh token to replace the
    // revoked one (otherwise the user would be stuck after one refresh).
    assert.match(
      source,
      /const\s+newRefreshToken\s*=\s*generateRefreshToken/,
      '/api/auth/refresh must issue a new refresh token to replace the revoked one'
    );
  });
});
