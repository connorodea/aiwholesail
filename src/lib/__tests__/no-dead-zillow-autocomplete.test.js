// Regression guard: the dead Zillow autocomplete chain in the frontend
// must stay removed.
//
// 2026-05-16 cleanup: `ZillowAPI.autocomplete()` (src/lib/zillow-api.ts) and
// the `propdata.zillowAutocomplete` wrapper (src/lib/api-client.ts) were the
// only callers of the now-deleted `/api/propdata/zillow-autocomplete` route.
// The active autocomplete UI (src/components/LocationAutocomplete.tsx) uses
// `propertyApi.autocomplete()` → `/api/property/autocomplete` (scrape.do).
//
// This test pins the deletion. Source-introspection — matches the pattern
// of other src/lib/__tests__/*.test.js regression guards.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const API_CLIENT = fs.readFileSync(path.join(__dirname, '../api-client.ts'), 'utf8');
const ZILLOW_API = fs.readFileSync(path.join(__dirname, '../zillow-api.ts'), 'utf8');

test('src/lib/api-client.ts does NOT export propdata.zillowAutocomplete', () => {
  assert.equal(
    /zillowAutocomplete\s*:/.test(API_CLIENT),
    false,
    'propdata.zillowAutocomplete wrapper must stay removed — the route it called is deleted',
  );
});

test('src/lib/api-client.ts does NOT reference /api/propdata/zillow-autocomplete', () => {
  assert.equal(
    /\/api\/propdata\/zillow-autocomplete/.test(API_CLIENT),
    false,
    'no callers of the deleted route should remain in api-client.ts',
  );
});

test('src/lib/zillow-api.ts does NOT define an autocomplete() method on ZillowAPI', () => {
  // Anchor on the method signature to avoid false positives on the word
  // "autocomplete" appearing in a comment.
  assert.equal(
    /\basync\s+autocomplete\s*\(/.test(ZILLOW_API),
    false,
    'ZillowAPI.autocomplete() must stay removed — use propertyApi.autocomplete() from api-client.ts',
  );
});

test('src/lib/zillow-api.ts does NOT call propdata.zillowAutocomplete', () => {
  assert.equal(
    /propdata\.zillowAutocomplete/.test(ZILLOW_API),
    false,
    'no callers of propdata.zillowAutocomplete should remain in zillow-api.ts',
  );
});
