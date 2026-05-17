/**
 * Pure decision helper for the trial-expiry sweep.
 *
 * Given a subscriber row + (optionally) the list of Stripe subscriptions
 * for their customer, return one of:
 *   { action: 'downgrade' }      → flip subscribed=false, is_trial=false
 *   { action: 'keep_paying'  }   → Stripe shows active/trialing sub; leave alone
 *   { action: 'keep_active'  }   → trial still in its window; leave alone
 *   { action: 'keep_not_trial' } → row isn't a trial; leave alone
 *
 * Separated from the IO so it can be unit-tested without DB/Stripe.
 */
function decide({ row, now = new Date(), stripeSubs = [] } = {}) {
  if (!row || !row.is_trial) return { action: 'keep_not_trial' };
  if (!row.trial_end || new Date(row.trial_end) >= now) {
    return { action: 'keep_active' };
  }
  const paying = stripeSubs.some(
    (s) => s && (s.status === 'active' || s.status === 'trialing')
  );
  if (paying) return { action: 'keep_paying' };
  return { action: 'downgrade' };
}

module.exports = { decide };
