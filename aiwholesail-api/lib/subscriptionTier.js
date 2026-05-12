/**
 * Subscription tier resolution — pure helpers.
 *
 * Extracted from routes/stripe.js + middleware/subscription.js so they can be
 * unit-tested without spinning up Stripe / Express / a database. Each helper
 * documents the exact bug it defends against.
 */

/**
 * Resolve a canonical tier ('Elite' | 'Pro') from a Stripe Price object.
 *
 * Priority order — first match wins:
 *   1. price.metadata.tier            — explicit admin signal in Stripe.
 *                                       Wins outright. Supports founder /
 *                                       annual / comped Elite pricing below
 *                                       the $99 cliff.
 *   2. price.lookup_key prefix        — convention: 'elite-*' / 'pro-*'.
 *   3. price.unit_amount fallback     — legacy. >= 9900 → Elite, else → Pro.
 *
 * @param {object|null|undefined} price - Stripe Price object
 * @returns {'Elite'|'Pro'}
 *
 * Bug guarded:
 *   #5 — The legacy `unit_amount >= 9900` hardcode silently wrote 'Pro' for
 *        any Elite subscription below $99 (founder pricing, annual prorated,
 *        comped). Metadata + lookup_key now override the cliff.
 */
function resolveTierFromPrice(price) {
  if (!price) return 'Pro';

  const metaTier = typeof price.metadata?.tier === 'string'
    ? price.metadata.tier.trim().toLowerCase()
    : '';
  if (metaTier === 'elite' || metaTier === 'premium') return 'Elite';
  if (metaTier === 'pro') return 'Pro';

  const lookupKey = typeof price.lookup_key === 'string'
    ? price.lookup_key.trim().toLowerCase()
    : '';
  if (lookupKey.startsWith('elite')) return 'Elite';
  if (lookupKey.startsWith('pro')) return 'Pro';

  const amount = Number(price.unit_amount) || 0;
  if (amount >= 9900) return 'Elite';
  return 'Pro';
}

/**
 * Normalize a raw `subscription_tier` DB value into the canonical capitalized
 * form. A manual SQL update or legacy ETL writing 'elite' / 'ELITE' / 'pro'
 * with non-canonical case used to silently demote users to 'none' because
 * every gate compared with strict `===` against the capitalized form.
 *
 * @param {unknown} raw - whatever was read from subscribers.subscription_tier
 * @returns {'Elite'|'Pro'|'none'}
 *
 * Bug guarded:
 *   #4 — Case-sensitive tier comparison silently demoted users.
 */
function normalizeTier(raw) {
  if (typeof raw !== 'string') return 'none';
  const t = raw.trim().toLowerCase();
  if (t === 'elite' || t === 'premium') return 'Elite';
  if (t === 'pro') return 'Pro';
  return 'none';
}

/**
 * Should this subscribers row be preserved against a Stripe-driven wipe?
 *
 * Returns true when the local row encodes state that Stripe doesn't know
 * about — an active in-app DB trial, OR a future subscription_end (manual
 * Elite grant, custom comp, lifetime, etc). The three Stripe-facing code
 * paths — webhook reconciler, GET /subscription, attachSubscription
 * middleware — must skip the "wipe to NULL" branch when this returns true.
 *
 * @param {object|null|undefined} row - subscribers row (as read from DB)
 * @param {Date|number} [now=Date.now()] - clock injection point for tests
 * @returns {boolean}
 *
 * Bug guarded:
 *   The "20 wiped trials" incident (PRs #192, #193, #194, #196). Three
 *   independent code paths each had their own inline version of this check.
 *   This shared predicate prevents drift if any of them is rewritten.
 */
function isLocallyManaged(row, now = new Date()) {
  if (!row) return false;
  const nowMs = now instanceof Date ? now.getTime() : Number(now);
  if (!Number.isFinite(nowMs)) return false;

  const trialStillActive = !!(
    row.is_trial &&
    row.trial_end &&
    new Date(row.trial_end).getTime() > nowMs
  );
  const subStillActive = !!(
    row.subscription_end &&
    new Date(row.subscription_end).getTime() > nowMs
  );
  return trialStillActive || subStillActive;
}

module.exports = { resolveTierFromPrice, normalizeTier, isLocallyManaged };
