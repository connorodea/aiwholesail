// Source-level pin: api-client.ts MUST wire the storm detector.
//
// The pure detector tests (auth-storm-detector.test.js) prove the detector
// works in isolation. This file pins that api-client.ts actually CALLS it
// in the right places — a future refactor that strips the wiring will fail
// this test instead of silently re-introducing the 2026-05-15 PLEASE-FIX
// render-loop bug.
//
// Matches the in-repo source-level test convention
// (src/components/__tests__/AIWholesailLogo.test.cjs).
//
// Run:
//   node --test src/lib/__tests__/api-client-storm-wiring.test.js

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC = fs.readFileSync(join(__dirname, '..', 'api-client.ts'), 'utf8');

test('api-client imports the storm detector + AUTH_FAILURE_CODES set', () => {
  assert.match(
    SRC,
    /import\s*\{[^}]*getDetector[^}]*AUTH_FAILURE_CODES[^}]*\}\s*from\s*['"]\.\/auth-storm-detector(\.js)?['"]/,
    'must import getDetector (aliased as getStormDetector ok) + AUTH_FAILURE_CODES from auth-storm-detector',
  );
});

test('api-client calls recordAuthFailure on auth-coded 401 responses', () => {
  // The 401 branch must guard on AUTH_FAILURE_CODES.has(data.code) and then
  // pass Date.now() into recordAuthFailure. This pins the integration point.
  assert.match(
    SRC,
    /AUTH_FAILURE_CODES\.has\(data\.code\)[\s\S]{0,400}recordAuthFailure\(Date\.now\(\)\)/,
    'recordAuthFailure must be invoked inside an AUTH_FAILURE_CODES guard, with Date.now() as the clock',
  );
});

test('api-client clears auth state on shouldTrip === true', () => {
  // The trip branch must call both tokenStorage.clear() AND notifyAuthChange(null).
  // Either one alone leaves the auth state inconsistent.
  const tripBlock = SRC.match(/if\s*\(\s*shouldTrip\s*\)[\s\S]{0,800}?\}/);
  assert.ok(tripBlock, 'must have an `if (shouldTrip) { ... }` block');
  assert.match(tripBlock[0], /tokenStorage\.clear\(\)/, 'must clear localStorage');
  assert.match(tripBlock[0], /notifyAuthChange\(null\)/, 'must notify auth listeners');
});

test('api-client calls recordSuccess on 2xx responses', () => {
  // After the 401 branch + ok check, on the success path, the detector
  // must be told. Otherwise stale failure counts persist across genuine
  // recoveries.
  assert.match(
    SRC,
    /getStormDetector\(\)\.recordSuccess\(\)/,
    'must call recordSuccess() on the 2xx success path',
  );
});

test('storm trip fires PostHog telemetry (observability for prod monitoring)', () => {
  // The trip branch must emit `auth_storm_tripped` so we can dashboard
  // storm frequency in the observability stack (SLO_SPEC.md).
  assert.match(
    SRC,
    /capture\(\s*['"]auth_storm_tripped['"]/,
    'must emit auth_storm_tripped PostHog event when the storm trips',
  );
});

test('PostHog telemetry call is try/catch wrapped (PostHog optional, never blocks recovery)', () => {
  // The recovery clear MUST run even if window.posthog is undefined.
  // Wrap defensively so the storm response always proceeds.
  const captureBlock = SRC.match(/try\s*\{[\s\S]{0,400}auth_storm_tripped[\s\S]{0,400}\}\s*catch/);
  assert.ok(
    captureBlock,
    'PostHog capture for auth_storm_tripped must be try/catch wrapped — failure must not block the storm response',
  );
});
