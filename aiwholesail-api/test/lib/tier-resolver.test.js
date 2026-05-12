/**
 * Unit tests for resolveTierFromPrice — the canonical writer for
 * `subscribers.subscription_tier`. Bugs here silently demote paying
 * customers (PR #181, 5-bug audit; cpodea5 incident 2026-05-12).
 *
 * Runs under built-in node:test (Node ≥ 18). Zero external dependencies.
 *   $ npm test    (from aiwholesail-api/)
 *   $ node --test test/lib/tier-resolver.test.js
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const { resolveTierFromPrice } = require('../../lib/tier-resolver');

test('resolveTierFromPrice', async (t) => {

  // ─── Null / empty inputs ──────────────────────────────────────────────
  await t.test('defaults to Pro when price is null', () => {
    assert.equal(resolveTierFromPrice(null), 'Pro');
  });

  await t.test('defaults to Pro when price is undefined', () => {
    assert.equal(resolveTierFromPrice(undefined), 'Pro');
  });

  await t.test('defaults to Pro on an empty price object', () => {
    assert.equal(resolveTierFromPrice({}), 'Pro');
  });

  // ─── Priority 1: metadata.tier wins outright ─────────────────────────
  await t.test('metadata.tier=elite returns Elite (lowercase)', () => {
    assert.equal(resolveTierFromPrice({ metadata: { tier: 'elite' } }), 'Elite');
  });

  await t.test('metadata.tier=Elite returns Elite (mixed case)', () => {
    assert.equal(resolveTierFromPrice({ metadata: { tier: 'Elite' } }), 'Elite');
  });

  await t.test('metadata.tier=ELITE returns Elite (uppercase)', () => {
    assert.equal(resolveTierFromPrice({ metadata: { tier: 'ELITE' } }), 'Elite');
  });

  await t.test('metadata.tier=premium returns Elite (legacy alias)', () => {
    // Pre-PR-181 some rows had 'Premium' as the tier name. Defensive
    // normalization keeps those resolving correctly so a manual SQL
    // patch with the old vocab doesn't silently demote anyone.
    assert.equal(resolveTierFromPrice({ metadata: { tier: 'premium' } }), 'Elite');
  });

  await t.test('metadata.tier=pro returns Pro', () => {
    assert.equal(resolveTierFromPrice({ metadata: { tier: 'pro' } }), 'Pro');
  });

  await t.test('metadata.tier=Pro returns Pro', () => {
    assert.equal(resolveTierFromPrice({ metadata: { tier: 'Pro' } }), 'Pro');
  });

  await t.test('metadata.tier with surrounding whitespace still matches', () => {
    assert.equal(resolveTierFromPrice({ metadata: { tier: '  Elite  ' } }), 'Elite');
  });

  await t.test('metadata.tier wins even when unit_amount would say otherwise', () => {
    // Elite at $1 (founder pricing). Without metadata, the $1 cliff would
    // demote to Pro. With metadata, we respect the operator's intent.
    assert.equal(
      resolveTierFromPrice({
        metadata: { tier: 'elite' },
        unit_amount: 100,            // $1
        lookup_key: 'pro_monthly_29' // even contradictory
      }),
      'Elite'
    );
  });

  await t.test('metadata.tier wins even when lookup_key would say otherwise', () => {
    assert.equal(
      resolveTierFromPrice({
        metadata: { tier: 'pro' },
        lookup_key: 'elite_monthly_99',
        unit_amount: 9900
      }),
      'Pro'
    );
  });

  // ─── Priority 2: lookup_key prefix ───────────────────────────────────
  await t.test('lookup_key=elite_monthly_99 returns Elite', () => {
    assert.equal(
      resolveTierFromPrice({ lookup_key: 'elite_monthly_99', unit_amount: 9900 }),
      'Elite'
    );
  });

  await t.test('lookup_key=Elite_… is case-insensitive', () => {
    assert.equal(
      resolveTierFromPrice({ lookup_key: 'Elite_annual_999', unit_amount: 99900 }),
      'Elite'
    );
  });

  await t.test('lookup_key=pro_monthly_49 returns Pro', () => {
    assert.equal(
      resolveTierFromPrice({ lookup_key: 'pro_monthly_49', unit_amount: 4900 }),
      'Pro'
    );
  });

  await t.test('lookup_key=pro_monthly_29 (legacy) returns Pro', () => {
    assert.equal(
      resolveTierFromPrice({ lookup_key: 'pro_monthly_29', unit_amount: 2900 }),
      'Pro'
    );
  });

  // ─── Priority 3: unit_amount cliff ───────────────────────────────────
  await t.test('unit_amount=9900 → Elite (exact threshold)', () => {
    assert.equal(resolveTierFromPrice({ unit_amount: 9900 }), 'Elite');
  });

  await t.test('unit_amount=9899 → Pro (one cent below threshold)', () => {
    // Defends the cliff: paying $98.99 is NOT Elite. Operators wanting
    // Elite-at-discount must set metadata.tier.
    assert.equal(resolveTierFromPrice({ unit_amount: 9899 }), 'Pro');
  });

  await t.test('unit_amount=4900 → Pro', () => {
    assert.equal(resolveTierFromPrice({ unit_amount: 4900 }), 'Pro');
  });

  await t.test('unit_amount=2900 (legacy Pro price) → Pro', () => {
    assert.equal(resolveTierFromPrice({ unit_amount: 2900 }), 'Pro');
  });

  await t.test('unit_amount=0 → Pro (free / trial price)', () => {
    assert.equal(resolveTierFromPrice({ unit_amount: 0 }), 'Pro');
  });

  await t.test('unit_amount=99900 → Elite (annual Elite price)', () => {
    assert.equal(resolveTierFromPrice({ unit_amount: 99900 }), 'Elite');
  });

  // ─── Defensive paths ─────────────────────────────────────────────────
  await t.test('non-string metadata.tier falls through to next signal', () => {
    // Operator typo: metadata.tier = 42 (number). Defensive code should
    // ignore it and check lookup_key + amount.
    assert.equal(
      resolveTierFromPrice({ metadata: { tier: 42 }, unit_amount: 9900 }),
      'Elite'
    );
  });

  await t.test('non-string lookup_key falls through to amount', () => {
    assert.equal(
      resolveTierFromPrice({ lookup_key: null, unit_amount: 9900 }),
      'Elite'
    );
  });

  await t.test('unknown metadata.tier value falls through, not silently Pro', () => {
    // A typo'd metadata.tier='entreprise' should still respect lookup_key.
    assert.equal(
      resolveTierFromPrice({
        metadata: { tier: 'entreprise' },
        lookup_key: 'elite_monthly_99'
      }),
      'Elite'
    );
  });

  await t.test('NaN unit_amount treated as 0 → Pro', () => {
    assert.equal(resolveTierFromPrice({ unit_amount: NaN }), 'Pro');
  });

  await t.test('string-number unit_amount is coerced', () => {
    // Some Stripe SDK shapes return unit_amount as string in raw events.
    assert.equal(resolveTierFromPrice({ unit_amount: '9900' }), 'Elite');
  });
});
