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
// Stripe sub statuses that should keep a customer's access intact.
// Mirrors the `live` filter in aiwholesail-api/routes/stripe.js:
// every status EXCEPT `canceled` and `incomplete_expired` counts as
// "still in play" — paying, retrying, or about to pay.
//
// Why this matters: a `past_due` user is mid-retry (Stripe will try the
// card again over the next several days); an `incomplete` user just hit
// "Upgrade" and the first charge hasn't confirmed yet; a `paused` user
// has billing paused but access may be granted. Downgrading any of them
// would yank access from people who are paying or about to pay. The
// production incident this guards against: pre-fix the helper only kept
// `active`/`trialing`, which would have flipped `past_due` subscribers
// to subscribed=false during the next sweep tick.
const DEAD_STATUSES = new Set(['canceled', 'incomplete_expired']);

function isPayingSub(s) {
  return !!s && typeof s.status === 'string' && !DEAD_STATUSES.has(s.status);
}

function decide({ row, now = new Date(), stripeSubs = [] } = {}) {
  if (!row || !row.is_trial) return { action: 'keep_not_trial' };
  if (!row.trial_end || new Date(row.trial_end) >= now) {
    return { action: 'keep_active' };
  }
  if (stripeSubs.some(isPayingSub)) return { action: 'keep_paying' };
  return { action: 'downgrade' };
}

module.exports = { decide, isPayingSub, DEAD_STATUSES };
