/**
 * Per-user monthly LLM budget gate.
 *
 * Runs AFTER `attachSubscription` so it can read the effective tier from
 * `req.subscription.tier`. Sums month-to-date cost from llm_token_ledger
 * and 429s if the user is already at or over their tier cap.
 *
 * Fails OPEN on DB error — a Postgres blip should not block paying users
 * from using the product. A loud structured log fires so an outage triggers
 * an alert, since sustained fail-open is what runs up the bill.
 *
 * Attaches `req.llmBudget = { used_cents, cap_cents, remaining_cents, tier }`
 * for the handler / response shape to surface.
 *
 * Usage:
 *
 *   router.post('/api/ai/property-analysis',
 *     authenticate,
 *     attachSubscription,
 *     checkLlmBudget(),     // ← new
 *     requireTierWithLimit({ eventType: 'ai_property_analysis', proMonthly: 10 }),
 *     handler,
 *   );
 */

const { getMonthlyUsageCents } = require('../lib/llm-usage');
const { capCentsForTier } = require('../lib/llm-cost');
const { logEvent, EVENTS } = require('../lib/events');
const { respondError } = require('../lib/responses');

function checkLlmBudget() {
  return async (req, res, next) => {
    try {
      if (!req.user?.id) {
        // Unauthenticated request reaching an LLM endpoint is a routing bug —
        // fail closed to make it visible.
        return res.status(401).json({ error: 'Authentication required' });
      }

      // Default to 'none' if attachSubscription hasn't run for some reason.
      // 'none' has a $0 cap so the request gets 429'd — preferred over
      // silently letting it through.
      const tier = req.subscription?.tier || 'none';
      const capCents = capCentsForTier(tier);

      // Elite is effectively uncapped (high cap, but tracked) — short-circuit
      // skip the SUM read for the hot path. Their usage is still logged in
      // the route handler so cost analytics work.
      if (tier === 'Elite' && capCents >= 3000) {
        req.llmBudget = { used_cents: 0, cap_cents: capCents, remaining_cents: capCents, tier };
        return next();
      }

      if (capCents === 0) {
        // No-access tier — return a clear upgrade nudge rather than a generic 429.
        return respondError(res, 403, 'AI features require a paid plan', {
          code: 'TIER_REQUIRED',
          details: {
            message: 'Upgrade to Pro or Elite to use AI tools.',
            currentTier: tier,
          },
        });
      }

      const usedCents = await getMonthlyUsageCents(req.user.id);
      const remaining = capCents - usedCents;

      if (remaining <= 0) {
        const now = new Date();
        const nextMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)).toISOString();
        logEvent(req.user.id, EVENTS.LLM_BUDGET_EXCEEDED, {
          tier,
          used_cents: usedCents,
          cap_cents: capCents,
        });
        return respondError(res, 429, 'Monthly AI budget reached', {
          code: 'LLM_BUDGET_EXCEEDED',
          details: {
            message: `You've used your monthly AI budget on ${tier}. ${
              tier === 'Pro' || tier === 'trial'
                ? 'Upgrade to Elite for higher limits, or wait until '
                : 'Resets at '
            }${nextMonth}.`,
            tier,
            used_cents: usedCents,
            cap_cents: capCents,
            resets_at: nextMonth,
          },
        });
      }

      req.llmBudget = { used_cents: usedCents, cap_cents: capCents, remaining_cents: remaining, tier };
      next();
    } catch (err) {
      // FAIL OPEN — paid-tier users should not be locked out by a transient
      // DB issue. But emit a STRUCTURED loud log line so APM/alerts catch
      // a sustained outage (which would otherwise quietly run up the bill).
      console.error(JSON.stringify({
        level: 'error',
        scope: 'middleware.llmBudget.checkLlmBudget',
        event: 'budget_check_failed_open',
        user_id: req.user?.id,
        tier: req.subscription?.tier,
        error: err.message,
      }));
      next();
    }
  };
}

module.exports = { checkLlmBudget };
