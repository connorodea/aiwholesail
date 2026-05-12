/**
 * Side-by-side regression demonstration.
 *
 * Reproduces the EXACT logic from each pre-fix code path (copied verbatim from
 * the commit `pre-pr-181` / 6b94c14) and runs the same bug-reproducing inputs
 * against both the broken pre-fix logic AND the fixed helper. Tests assert
 * that the pre-fix logic gives the wrong answer (`Pro`/`none`) where the
 * fixed logic gives the right one (`Elite`).
 *
 * If the pre-fix logic ever passes one of these, our regression-detection is
 * also broken. If the new helper ever fails one, the original bug regressed.
 *
 *   node --test aiwholesail-api/tests/regression-demo.test.js
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const { resolveTierFromPrice, normalizeTier } = require('../lib/subscriptionTier');

// ---------------------------------------------------------------------------
// PRE-FIX logic, copied verbatim from routes/stripe.js @ 6b94c14
// (Lines 277-287 of the original file. Reproduced here so it can be exercised
//  even though the fix removed it.)
// ---------------------------------------------------------------------------
function preFix_resolveTierFromAmount(price) {
  const amount = price?.unit_amount || 0;
  if (amount >= 9900) return 'Elite';
  if (amount >= 2900) return 'Pro';
  return 'Pro';
}

// PRE-FIX middleware tier resolution from middleware/subscription.js @ 6b94c14
// (Lines 85-97 of the original. Strict ===, case-sensitive.)
function preFix_resolveTierFromString(rawTier) {
  if (rawTier === 'Elite' || rawTier === 'Premium') return 'Elite';
  if (rawTier === 'Pro') return 'Pro';
  return 'none';
}

// ---------------------------------------------------------------------------
// Bug #5 — Stripe cliff. Demonstrate pre-fix is wrong, fixed is right.
// ---------------------------------------------------------------------------
test('REGRESSION DEMO #5: $49 Elite (metadata=elite) — pre-fix says Pro, fix says Elite', () => {
  const founderPrice = {
    unit_amount: 4900,
    recurring: { interval: 'month' },
    metadata: { tier: 'elite' },
  };
  // Pre-fix: silently demotes.
  assert.equal(
    preFix_resolveTierFromAmount(founderPrice),
    'Pro',
    'Pre-fix logic SHOULD demote — if this fails, the demo is broken.',
  );
  // Fixed: respects metadata.
  assert.equal(resolveTierFromPrice(founderPrice), 'Elite');
});

test('REGRESSION DEMO #5: $0 comped Elite — pre-fix says Pro, fix says Elite', () => {
  const comped = { unit_amount: 0, metadata: { tier: 'Elite' } };
  assert.equal(preFix_resolveTierFromAmount(comped), 'Pro');
  assert.equal(resolveTierFromPrice(comped), 'Elite');
});

test('REGRESSION DEMO #5: lookup_key=elite-monthly at $79 — pre-fix says Pro, fix says Elite', () => {
  const lookupKeyed = { unit_amount: 7900, lookup_key: 'elite-monthly' };
  assert.equal(preFix_resolveTierFromAmount(lookupKeyed), 'Pro');
  assert.equal(resolveTierFromPrice(lookupKeyed), 'Elite');
});

// ---------------------------------------------------------------------------
// Bug #4 — Case-sensitive tier compare. Pre-fix demotes lowercase to none.
// ---------------------------------------------------------------------------
test('REGRESSION DEMO #4: lowercase "elite" — pre-fix says none, fix says Elite', () => {
  assert.equal(preFix_resolveTierFromString('elite'), 'none');
  assert.equal(normalizeTier('elite'), 'Elite');
});

test('REGRESSION DEMO #4: uppercase "ELITE" — pre-fix says none, fix says Elite', () => {
  assert.equal(preFix_resolveTierFromString('ELITE'), 'none');
  assert.equal(normalizeTier('ELITE'), 'Elite');
});

test('REGRESSION DEMO #4: " Elite " with whitespace — pre-fix says none, fix says Elite', () => {
  assert.equal(preFix_resolveTierFromString(' Elite '), 'none');
  assert.equal(normalizeTier(' Elite '), 'Elite');
});

test('REGRESSION DEMO #4: canonical "Elite" — both agree (control case)', () => {
  // Control — canonical input must work for both. If pre-fix fails here, the
  // bug was worse than reported.
  assert.equal(preFix_resolveTierFromString('Elite'), 'Elite');
  assert.equal(normalizeTier('Elite'), 'Elite');
});

// ---------------------------------------------------------------------------
// Symmetry: cases where pre-fix happened to be RIGHT shouldn't regress.
// ---------------------------------------------------------------------------
test('CONTROL: $99 monthly Elite — both pre-fix and fix say Elite', () => {
  const canonical = { unit_amount: 9900, recurring: { interval: 'month' } };
  assert.equal(preFix_resolveTierFromAmount(canonical), 'Elite');
  assert.equal(resolveTierFromPrice(canonical), 'Elite');
});

test('CONTROL: $49 Pro (no metadata) — both pre-fix and fix say Pro', () => {
  const proPrice = { unit_amount: 4900, recurring: { interval: 'month' } };
  assert.equal(preFix_resolveTierFromAmount(proPrice), 'Pro');
  assert.equal(resolveTierFromPrice(proPrice), 'Pro');
});
