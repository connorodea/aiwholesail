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

test('resetSessionAndSignIn purges all three auth localStorage keys', () => {
  const src = readSource();
  // The function operates on AUTH_STORAGE_KEYS; verify the array contains
  // all three canonical keys from tokenStorage in api-client.ts.
  const m = src.match(/AUTH_STORAGE_KEYS\s*=\s*\[([^\]]+)\]/);
  assert.ok(m, 'AUTH_STORAGE_KEYS array not found');
  const keys = m[1];
  assert.match(keys, /aiwholesail_access_token/, 'access token key missing');
  assert.match(keys, /aiwholesail_refresh_token/, 'refresh token key missing');
  assert.match(keys, /aiwholesail_user/, 'user key missing');
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
