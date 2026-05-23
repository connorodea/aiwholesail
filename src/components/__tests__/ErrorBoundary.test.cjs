#!/usr/bin/env node
/**
 * Source-level tests for the ErrorBoundary recovery CTAs.
 *
 * Why this exists: 2026-05-15 incident — user got stuck in a "Something went
 * wrong on this page" loop because the only recovery was "Try again", which
 * re-rendered the same crashing tree. The render kept throwing because
 * localStorage held a corrupt auth state (refresh token present, access token
 * stale, every API call returning 401 in a render loop). No console access
 * for the user, no in-app recovery path. Manual fix was DevTools localStorage
 * clear — unacceptable for production.
 *
 * Fix: ErrorBoundary now exposes a "Sign out & reset" CTA that clears the
 * auth-related localStorage keys and hard-reloads to `/auth?mode=signin`.
 * Hard reload (not router navigate) is intentional — soft navigate would
 * re-mount the same crashing component tree with the same stale state.
 *
 * Source-level test pins (no jsdom — matches in-repo convention):
 *   1. resetSessionAndSignIn function is defined in the module
 *   2. It targets ALL three auth-related localStorage keys
 *   3. It uses window.location.href = '/auth?mode=signin' (hard reload)
 *   4. The fallback UI exposes both "Try again" and "Sign out & reset" CTAs
 *   5. The reset CTA wires to resetSessionAndSignIn
 *
 * Run:
 *   node src/components/__tests__/ErrorBoundary.test.cjs
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const COMPONENT_PATH = path.join(__dirname, '..', 'ErrorBoundary.tsx');

function readSource() {
  return fs.readFileSync(COMPONENT_PATH, 'utf8');
}

function readSourceNoComments() {
  return readSource()
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');
}

test('resetSessionAndSignIn function is defined', () => {
  const src = readSource();
  assert.match(
    src,
    /function\s+resetSessionAndSignIn\s*\(/,
    'resetSessionAndSignIn must be defined as a function',
  );
});

test('resetSessionAndSignIn purges all three auth localStorage keys (via shared module)', () => {
  const src = readSource();
  // The function iterates AUTH_STORAGE_KEYS. After refactor we import that
  // constant from @/lib/auth-storage-keys (single source of truth) — verify
  // the import is in place AND verify the source module exports all three.
  assert.match(
    src,
    /import\s*\{[^}]*AUTH_STORAGE_KEYS[^}]*\}\s*from\s*['"]@\/lib\/auth-storage-keys['"]/,
    'must import AUTH_STORAGE_KEYS from @/lib/auth-storage-keys (no literal duplication)',
  );
  // Verify the source module itself has all three keys.
  const sharedPath = path.join(__dirname, '..', '..', 'lib', 'auth-storage-keys.ts');
  const sharedSrc = fs.readFileSync(sharedPath, 'utf8');
  assert.match(sharedSrc, /aiwholesail_access_token/, 'access token key missing from shared module');
  assert.match(sharedSrc, /aiwholesail_refresh_token/, 'refresh token key missing from shared module');
  assert.match(sharedSrc, /aiwholesail_user/, 'user key missing from shared module');
  // And confirm api-client.ts imports from the same shared module — the
  // whole point of the extraction is one source of truth.
  const apiClientPath = path.join(__dirname, '..', '..', 'lib', 'api-client.ts');
  const apiClientSrc = fs.readFileSync(apiClientPath, 'utf8');
  assert.match(
    apiClientSrc,
    /from\s*['"]\.\/auth-storage-keys['"]/,
    'api-client.ts must also import the auth-storage-keys module (single source of truth)',
  );
});

test('resetSessionAndSignIn does a hard reload, not a router navigate', () => {
  // Critical: a soft navigate would re-mount the same crashing component
  // tree with the same stale state. Hard reload resets ALL module singletons.
  const src = readSourceNoComments();
  assert.match(
    src,
    /window\.location\.href\s*=\s*['"]\/auth\?mode=signin['"]/,
    'must use window.location.href to force a hard reload',
  );
});

test('hard-reload assignment lives INSIDE resetSessionAndSignIn (review followup)', () => {
  // Reviewer's tightening pin (PR #462 review): the bare regex above would
  // also pass if a future refactor moved the assignment to module init or
  // some other function. Scope it to the function body so drift is caught.
  const src = readSourceNoComments();
  // Match from `function resetSessionAndSignIn(` to the matching closing
  // brace at the same indentation. Cheapest reliable extraction.
  const fnMatch = src.match(/function\s+resetSessionAndSignIn\s*\([^)]*\)\s*\{[\s\S]*?\n\}/);
  assert.ok(fnMatch, 'resetSessionAndSignIn function body not isolatable from source');
  assert.match(
    fnMatch[0],
    /window\.location\.href\s*=\s*['"]\/auth\?mode=signin['"]/,
    'hard-reload assignment must live INSIDE resetSessionAndSignIn (not in module init or another function)',
  );
});

test('fallback UI exposes both "Try again" AND "Sign out & reset" CTAs', () => {
  const src = readSource();
  assert.match(src, /Try again/, '"Try again" button text must be present');
  assert.match(src, /Sign out\s*(?:&|&amp;)\s*reset/i, '"Sign out & reset" CTA text must be present');
});

test('Sign out CTA wires to resetSessionAndSignIn', () => {
  const src = readSourceNoComments();
  // The button's onClick must directly reference resetSessionAndSignIn —
  // not an inline arrow that re-implements the logic (which would silently
  // diverge from the unit-tested function).
  assert.match(
    src,
    /onClick=\{resetSessionAndSignIn\}/,
    'Sign out & reset button must wire to resetSessionAndSignIn directly',
  );
});

test('localStorage.removeItem is wrapped in try/catch (iOS ITP / quota safety)', () => {
  const src = readSource();
  // iOS Safari can throw on localStorage access in private mode / after ITP
  // eviction. The CTA must survive that — failure here means an already-
  // stuck user gets stuck WORSE (recovery button silently does nothing).
  assert.match(
    src,
    /try\s*\{[^}]*localStorage\.removeItem[^}]*\}\s*catch/,
    'localStorage.removeItem call must be try/catch wrapped',
  );
});
