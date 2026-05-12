/**
 * Bug-reproduction tests for subscription tier resolution.
 *
 * Each test names the exact bug it would catch if regressed. Run with:
 *   npm test
 *   # or: node --test aiwholesail-api/tests/
 *
 * All tests are pure-function, no DB / Stripe / Express. They MUST fail on
 * the pre-fix code (commit pre-pr-181 = 6b94c14) for cases that exercise the
 * bug, and pass on this branch.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const { resolveTierFromPrice, normalizeTier } = require('../lib/subscriptionTier');

// ---------------------------------------------------------------------------
// Bug #5 — Stripe unit_amount >= 9900 cliff
// ---------------------------------------------------------------------------
test('resolveTierFromPrice: $99 monthly Elite price (canonical path)', () => {
  assert.equal(
    resolveTierFromPrice({ unit_amount: 9900, recurring: { interval: 'month' } }),
    'Elite',
    'A standard $99/mo Elite price must resolve to Elite via the unit_amount fallback.',
  );
});

test('resolveTierFromPrice: $49 monthly Pro price (canonical path)', () => {
  assert.equal(
    resolveTierFromPrice({ unit_amount: 4900, recurring: { interval: 'month' } }),
    'Pro',
  );
});

test('BUG #5: discounted Elite price ($49) with metadata.tier=elite resolves to Elite', () => {
  // PRE-FIX BEHAVIOR: silently wrote 'Pro' because unit_amount < 9900.
  // POST-FIX: metadata.tier wins outright, defending founder/comped/annual pricing.
  const price = {
    unit_amount: 4900,
    recurring: { interval: 'month' },
    metadata: { tier: 'elite' },
  };
  assert.equal(resolveTierFromPrice(price), 'Elite');
});

test('BUG #5: $0 comped Elite price with metadata.tier=Elite resolves to Elite', () => {
  // Real-world case: founder comp, 100% off coupon.
  const price = {
    unit_amount: 0,
    metadata: { tier: 'Elite' },
  };
  assert.equal(resolveTierFromPrice(price), 'Elite');
});

test('BUG #5: annual Elite at $79/mo equivalent ($948 annual) resolves via metadata', () => {
  // unit_amount on an annual price is the whole-year charge in cents.
  // Without metadata, $948 (94800) would correctly hit the Elite path
  // (>=9900); but a $588 annual ($49/mo equivalent) below the cliff fails.
  // Either way, metadata.tier guarantees correctness.
  const price = {
    unit_amount: 58800,
    recurring: { interval: 'year' },
    metadata: { tier: 'elite' },
  };
  assert.equal(resolveTierFromPrice(price), 'Elite');
});

test('resolveTierFromPrice: lookup_key prefix wins over unit_amount fallback', () => {
  const price = {
    unit_amount: 4900,
    lookup_key: 'elite-monthly-founder',
  };
  assert.equal(resolveTierFromPrice(price), 'Elite');
});

test('resolveTierFromPrice: lookup_key="pro-monthly" with high amount resolves to Pro', () => {
  // Defensive: if a price is mislabeled in Stripe (amount $99 but lookup_key
  // says pro), trust the explicit key over the cliff inference.
  const price = {
    unit_amount: 9900,
    lookup_key: 'pro-monthly',
  };
  assert.equal(resolveTierFromPrice(price), 'Pro');
});

test('resolveTierFromPrice: priority order — metadata > lookup_key > amount', () => {
  const conflicting = {
    unit_amount: 9900,        // would say Elite
    lookup_key: 'pro-foo',    // would say Pro
    metadata: { tier: 'Elite' },
  };
  assert.equal(resolveTierFromPrice(conflicting), 'Elite', 'metadata must win');
});

test('resolveTierFromPrice: null/undefined price defaults to Pro', () => {
  assert.equal(resolveTierFromPrice(null), 'Pro');
  assert.equal(resolveTierFromPrice(undefined), 'Pro');
});

test('resolveTierFromPrice: empty price object defaults to Pro', () => {
  assert.equal(resolveTierFromPrice({}), 'Pro');
});

test('resolveTierFromPrice: Premium metadata is treated as Elite (legacy alias)', () => {
  // The DB had legacy 'Premium' rows. They should still gate as Elite.
  assert.equal(resolveTierFromPrice({ metadata: { tier: 'Premium' } }), 'Elite');
  assert.equal(resolveTierFromPrice({ metadata: { tier: 'premium' } }), 'Elite');
});

// ---------------------------------------------------------------------------
// Bug #4 — Case-sensitive tier comparison silently demoted users
// ---------------------------------------------------------------------------
test('BUG #4: lowercase "elite" normalizes to canonical "Elite"', () => {
  // PRE-FIX: middleware used `subscription_tier === 'Elite'`, so 'elite'
  // failed and the user was treated as tier='none'.
  assert.equal(normalizeTier('elite'), 'Elite');
});

test('BUG #4: uppercase "ELITE" normalizes to canonical "Elite"', () => {
  assert.equal(normalizeTier('ELITE'), 'Elite');
});

test('BUG #4: mixed case "eLiTe" normalizes to canonical "Elite"', () => {
  assert.equal(normalizeTier('eLiTe'), 'Elite');
});

test('BUG #4: lowercase "pro" normalizes to "Pro"', () => {
  assert.equal(normalizeTier('pro'), 'Pro');
});

test('BUG #4: trailing whitespace doesn\'t demote', () => {
  // Real-world: pasted from a spreadsheet, copy-paste with trailing space.
  assert.equal(normalizeTier('Elite '), 'Elite');
  assert.equal(normalizeTier(' Pro\n'), 'Pro');
});

test('normalizeTier: "Premium" legacy alias resolves to Elite', () => {
  assert.equal(normalizeTier('Premium'), 'Elite');
  assert.equal(normalizeTier('premium'), 'Elite');
});

test('normalizeTier: canonical "Elite" passes through unchanged', () => {
  assert.equal(normalizeTier('Elite'), 'Elite');
  assert.equal(normalizeTier('Pro'), 'Pro');
});

test('normalizeTier: unknown string returns "none"', () => {
  assert.equal(normalizeTier('Free'), 'none');
  assert.equal(normalizeTier('platinum'), 'none');
  assert.equal(normalizeTier(''), 'none');
});

test('normalizeTier: non-string inputs return "none"', () => {
  assert.equal(normalizeTier(null), 'none');
  assert.equal(normalizeTier(undefined), 'none');
  assert.equal(normalizeTier(42), 'none');
  assert.equal(normalizeTier({}), 'none');
});
