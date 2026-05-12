/**
 * Resolve canonical tier ('Elite' | 'Pro') from a Stripe Price object.
 *
 * Pure function — no DB, no Stripe SDK, no I/O. Extracted from
 * routes/stripe.js so it's unit-testable without pulling in the rest
 * of the Stripe / Express stack.
 *
 * Priority order — first match wins:
 *  1. `price.metadata.tier`            — admin sets this in Stripe dashboard
 *                                         or via API. Wins outright. Supports
 *                                         founder / annual / comped Elite
 *                                         pricing under the $99 threshold.
 *  2. `price.lookup_key`               — convention: starts with 'elite' or
 *                                         'pro'. Case-insensitive.
 *  3. `price.unit_amount` thresholds   — legacy fallback. >= 9900 → Elite,
 *                                         else Pro. Falls back to Pro on null
 *                                         to avoid silently demoting paying
 *                                         customers when the price object is
 *                                         missing data.
 *
 * Returns 'Pro' when no signal indicates Elite. This is the canonical writer
 * for `subscribers.subscription_tier` and is shared by both the on-demand
 * GET /subscription path AND the webhook reconciler so the two never disagree.
 */
function resolveTierFromPrice(price) {
  if (!price) return 'Pro';

  // 1. Explicit metadata wins.
  const metaTier = typeof price.metadata?.tier === 'string'
    ? price.metadata.tier.trim().toLowerCase()
    : '';
  if (metaTier === 'elite' || metaTier === 'premium') return 'Elite';
  if (metaTier === 'pro') return 'Pro';

  // 2. Lookup key convention.
  const lookupKey = typeof price.lookup_key === 'string'
    ? price.lookup_key.trim().toLowerCase()
    : '';
  if (lookupKey.startsWith('elite')) return 'Elite';
  if (lookupKey.startsWith('pro')) return 'Pro';

  // 3. Legacy unit_amount fallback. Cents, monthly billing cycle.
  const amount = Number(price.unit_amount) || 0;
  if (amount >= 9900) return 'Elite';
  return 'Pro';
}

module.exports = { resolveTierFromPrice };
