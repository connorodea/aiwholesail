/**
 * Regression guard for the skip-trace primary/fallback ORDER.
 *
 * PR #321 (2026-05-13) flipped the order:
 *   - OLD: RapidAPI V1 primary → V2 fallback → TPS final-fallback (flag-gated TPS-primary)
 *   - NEW: TPS primary (unconditional) → RapidAPI V1 fallback → RapidAPI V2 fallback
 *
 * RapidAPI's skip-tracing-working-api has been returning 5xx on every call for
 * weeks; making TPS the unconditional primary saves ~2.5s per request.
 *
 * Approach: source-file introspection (same pattern as
 * stripe-checkout-config.test.js). The route handler is express + transitive
 * globals (db pool, jwt, etc.) and isn't trivially mockable without a larger
 * refactor. We assert the literal code structure that ENFORCES the new order
 * so any future revert fails loudly.
 *
 *   $ node --test test/routes/skip-trace-order.test.js
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const SOURCE_PATH = path.resolve(__dirname, '../../routes/skipTrace.js');
const src = fs.readFileSync(SOURCE_PATH, 'utf8');

test('routes/skipTrace.js — does NOT import featureFlags', () => {
  // The TPS_FLAG_SLUG / isEnabled gate is gone. If anyone re-adds the
  // flag import the order is presumed regressed.
  assert.equal(
    /require\(['"]\.\.\/lib\/featureFlags['"]\)/.test(src),
    false,
    'featureFlags must not be re-imported — TPS is now unconditional primary'
  );
});

test('routes/skipTrace.js — does NOT reference TPS_FLAG_SLUG or skip_trace_tps in code', () => {
  // String literal can still appear in a comment for historical context; the
  // failure mode we care about is a *code* re-introduction. We look for the
  // assignment / read patterns specifically.
  assert.equal(
    /isEnabled\([^)]*TPS_FLAG_SLUG/.test(src),
    false,
    'isEnabled(TPS_FLAG_SLUG) must not appear — flag is deprecated'
  );
  assert.equal(
    /const\s+TPS_FLAG_SLUG\s*=/.test(src),
    false,
    'TPS_FLAG_SLUG const must not be declared'
  );
});

test('routes/skipTrace.js — TPS primary block runs BEFORE the V1 RapidAPI call', () => {
  // Locate the TPS-primary block and the V1 upstream call. The TPS block
  // must appear earlier in the file than the callUpstream invocation.
  const tpsPrimaryIdx = src.indexOf('PRIMARY: TPS via scrape.do');
  const v1FallbackIdx = src.indexOf('callUpstream(config.path');

  assert.ok(tpsPrimaryIdx > 0, 'TPS primary block comment must exist');
  assert.ok(v1FallbackIdx > 0, 'V1 RapidAPI callUpstream invocation must exist');
  assert.ok(
    tpsPrimaryIdx < v1FallbackIdx,
    `TPS primary block must precede V1 RapidAPI call (tps@${tpsPrimaryIdx} v1@${v1FallbackIdx})`
  );
});

test('routes/skipTrace.js — TPS call is gated only by TPS_SUPPORTED, not a flag', () => {
  // The TPS primary should run for any TPS_SUPPORTED.has(searchType) — no
  // additional isEnabled(...) check inside that branch.
  // Approximate check: between the TPS primary marker and the V1 fallback
  // marker, there must be no `isEnabled(` call.
  const tpsStart = src.indexOf('PRIMARY: TPS via scrape.do');
  const v1Start = src.indexOf('FALLBACK 1: RapidAPI V1');
  assert.ok(v1Start > tpsStart, 'expected fallback 1 marker after TPS primary');
  const tpsBlock = src.slice(tpsStart, v1Start);
  assert.equal(
    /isEnabled\(/.test(tpsBlock),
    false,
    'TPS primary block must not contain any isEnabled() call'
  );
});

test('routes/skipTrace.js — preserves V2 RapidAPI fallback path', () => {
  // The V2 path stays as a fallback (now fallback #2). Make sure it's still
  // present so the code change didn't accidentally drop it.
  assert.ok(
    /callV2Fallback\(/.test(src),
    'callV2Fallback invocation must remain in the file'
  );
  assert.ok(
    /FALLBACK 2: RapidAPI V2/.test(src),
    'V2 fallback block comment must exist'
  );
});
