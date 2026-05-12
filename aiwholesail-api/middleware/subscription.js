const { query } = require('../config/database');
const { normalizeTier } = require('../lib/subscriptionTier');

/**
 * Subscription tier constants
 */
const TIERS = {
  ELITE: 'Elite',
  PRO: 'Pro',
  TRIAL: 'trial',
  NONE: 'none',
};

/**
 * Daily search limits by tier
 */
const DAILY_SEARCH_LIMITS = {
  [TIERS.ELITE]: Infinity,
  [TIERS.PRO]: 10,
  [TIERS.TRIAL]: 10,
  [TIERS.NONE]: 0,
};

/**
 * Middleware: Attach subscription info to req.subscription
 *
 * Must be used AFTER authenticate middleware (requires req.user).
 * On any error, defaults to allowing access (fail-open) to avoid
 * locking users out due to bugs.
 */
const attachSubscription = async (req, res, next) => {
  try {
    if (!req.user?.id) {
      // No authenticated user — default to 'none' but don't block
      req.subscription = { tier: TIERS.NONE, searchesUsed: 0 };
      return next();
    }

    const result = await query(
      `SELECT subscription_tier, subscribed, is_trial, trial_end, subscription_end
       FROM subscribers
       WHERE user_id = $1
       LIMIT 1`,
      [req.user.id]
    );

    if (result.rows.length === 0 || !result.rows[0].subscribed) {
      req.subscription = { tier: TIERS.NONE, searchesUsed: 0 };
      return next();
    }

    const sub = result.rows[0];

    // Check if subscription has expired
    if (sub.subscription_end && new Date(sub.subscription_end) < new Date()) {
      // CRITICAL: do NOT wipe subscription_tier here.
      //
      // At signup auth.js sets subscription_end = trial_end (same 7-day
      // timestamp). So when a trial expires, this branch fires for every
      // trialer. If we wipe tier=NULL we lose the "last plan was Pro"
      // breadcrumb the UI uses for upgrade nudges, AND we nuke manually
      // granted Elite overrides whose subscription_end happens to be in
      // the past.
      //
      // Setting subscribed=false + is_trial=false is enough to gate
      // access downstream (req.subscription = TIERS.NONE below).
      //
      // Real incident behind this fix: 20 users had subscription_tier
      // wiped via this path after their 7-day trial expired, contributing
      // to the 69 signups / 0 paying funnel collapse.
      query(
        `UPDATE subscribers SET subscribed = false, is_trial = false, updated_at = NOW() WHERE user_id = $1 AND subscribed = true`,
        [req.user.id]
      ).catch(err => console.error('[Subscription] Failed to downgrade expired subscription:', err));
      req.subscription = { tier: TIERS.NONE, searchesUsed: 0 };
      return next();
    }

    // Determine effective tier.
    //
    // For trial users: respect the tier they're trialing on. An Elite trial
    // gets Elite features; a Pro trial gets Pro features. Previously this
    // collapsed every trial to TIERS.TRIAL, which silently locked Elite-trial
    // users out of the very features they were upgraded to test (the front-
    // end useSubscription hook correctly distinguishes — this middleware did
    // not, causing 403s on /api/ai/property-analysis and /api/ai/photo-analysis
    // for any Elite-trial user).
    let tier = TIERS.NONE;
    if (sub.is_trial) {
      // Expired trial → downgrade
      if (sub.trial_end && new Date(sub.trial_end) < new Date()) {
        query(
          `UPDATE subscribers SET subscribed = false, is_trial = false, updated_at = NOW() WHERE user_id = $1 AND is_trial = true`,
          [req.user.id]
        ).catch(err => console.error('[Subscription] Failed to downgrade expired trial:', err));
        req.subscription = { tier: TIERS.NONE, searchesUsed: 0 };
        return next();
      }
      // Active trial — resolve to the tier the user is trialing.
      // normalizeTier handles case-insensitivity and the legacy 'Premium'
      // alias for Elite. See aiwholesail-api/lib/subscriptionTier.js.
      const normalized = normalizeTier(sub.subscription_tier);
      tier = normalized === 'none' ? TIERS.TRIAL : normalized; // unset trial tier → TRIAL
    } else {
      // Non-trial active subscription. Same normalization. 'none' here means
      // the row had an unknown tier string; leave as TIERS.NONE.
      const normalized = normalizeTier(sub.subscription_tier);
      if (normalized !== 'none') tier = normalized;
    }

    // Count today's searches for rate-limited tiers
    let searchesUsed = 0;
    if (tier !== TIERS.ELITE) {
      try {
        const countResult = await query(
          `SELECT COALESCE(SUM(request_count), 0) AS total
           FROM rate_limits
           WHERE identifier = $1
             AND function_name = 'daily-search'
             AND window_start >= CURRENT_DATE`,
          [req.user.id]
        );
        searchesUsed = parseInt(countResult.rows[0]?.total || '0', 10);
      } catch {
        // If rate_limits table doesn't exist or query fails, don't block
        searchesUsed = 0;
      }
    }

    req.subscription = { tier, searchesUsed };
    next();
  } catch (error) {
    // Fail open — don't lock users out because of a subscription check error
    console.error('[Subscription] Error checking subscription:', error);
    req.subscription = { tier: TIERS.NONE, searchesUsed: 0 };
    next();
  }
};

/**
 * Middleware: Require Elite tier.
 * Returns 403 if user is not on Elite plan.
 * Must be used AFTER attachSubscription.
 */
const requireElite = (req, res, next) => {
  try {
    // If subscription wasn't attached (middleware ordering issue), allow access
    if (!req.subscription) {
      console.warn('[Subscription] requireElite called without attachSubscription — allowing access');
      return next();
    }

    if (req.subscription.tier === TIERS.ELITE) {
      return next();
    }

    return res.status(403).json({
      error: 'Elite subscription required',
      code: 'ELITE_REQUIRED',
      message: 'This feature requires an Elite subscription. Upgrade to access AI analysis, photo analysis, ARV/comps, skip tracing, and lead scoring.',
      currentTier: req.subscription.tier,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    // Fail open
    console.error('[Subscription] requireElite error:', error);
    next();
  }
};

/**
 * Middleware factory: tier gate with optional Pro monthly limit.
 *
 *   Trial / no-sub   → 403 (TIER_REQUIRED, upgrade nudge)
 *   Pro              → check user_events count for `eventType` this calendar
 *                       month vs `proMonthly`. 429 if over.
 *   Elite            → next() (unlimited)
 *
 * Use this for AI / premium features that should be Pro-accessible but
 * rate-limited (per our Pro $49 / Elite $99 model: Pro gets it with caps,
 * Elite gets it unlimited).
 *
 * The eventType passed here MUST match the EVENTS.* constant logged at the
 * route's success point, otherwise counting silently fails.
 *
 *   router.post('/ai/property-analysis',
 *     authenticate,
 *     attachSubscription,
 *     requireTierWithLimit({ eventType: 'ai_property_analysis', proMonthly: 10 }),
 *     handler,
 *   );
 *
 * Must be used AFTER attachSubscription.
 */
function requireTierWithLimit({ eventType, proMonthly, featureLabel } = {}) {
  // Factory-time assertion: catch silent bucket bugs (PR #131 / #143 class)
  // before they ship. If a route asks us to gate on an event_type that isn't
  // in the canonical vocabulary, no logEvent call will ever match → counting
  // silently fails → user gets unlimited usage. Throw at boot so this can
  // never reach production.
  if (eventType) {
    // Lazy-require to avoid a circular dependency if events.js ever imports
    // anything that itself imports this middleware.
    const { EVENTS } = require('../lib/events');
    const valid = Object.values(EVENTS);
    if (!valid.includes(eventType)) {
      throw new Error(
        `[requireTierWithLimit] eventType='${eventType}' is not registered in lib/events.js EVENTS. ` +
        `Add it there before using as a quota key, otherwise the Pro counter will silently fail. ` +
        `Known: ${valid.join(', ')}`
      );
    }
  }

  return async (req, res, next) => {
    try {
      if (!req.subscription) {
        console.warn('[Subscription] requireTierWithLimit called without attachSubscription — allowing access');
        return next();
      }
      const tier = req.subscription.tier;

      // Trial users get Pro-level access while their trial is active. The
      // attachSubscription middleware already kicked out expired trials.
      // Treating an active trial as Pro keeps the frontend ⇄ backend story
      // consistent (useSubscription.ts defaults trial → 'Pro'). Without
      // this, a paying-tier-during-trial user would see the feature unlocked
      // in the UI but get a 403 from the API.
      const proLike = tier === TIERS.PRO || tier === TIERS.TRIAL;

      // No sub at all → hard block
      if (tier !== TIERS.ELITE && !proLike) {
        return res.status(403).json({
          error: `Upgrade required for ${featureLabel || 'this feature'}`,
          code: 'TIER_REQUIRED',
          message: `${featureLabel || 'This feature'} is available on Pro and Elite plans.`,
          currentTier: tier || TIERS.NONE,
        });
      }

      // Elite → unlimited, skip counting
      if (tier === TIERS.ELITE) return next();

      // Pro/Trial → enforce monthly limit
      if (!eventType || !proMonthly) {
        // No limit configured — allow
        return next();
      }
      const r = await query(
        `SELECT COUNT(*)::int AS used
         FROM user_events
         WHERE user_id = $1
           AND event_type = $2
           AND created_at >= date_trunc('month', NOW())`,
        [req.user.id, eventType]
      );
      const used = r.rows[0]?.used || 0;
      if (used >= proMonthly) {
        const now = new Date();
        const nextMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)).toISOString();
        return res.status(429).json({
          error: `Monthly ${featureLabel || 'usage'} limit reached`,
          code: 'QUOTA_EXCEEDED',
          message: `You've used all ${proMonthly} of your monthly ${featureLabel || ''} on Pro. Upgrade to Elite for unlimited, or wait until ${nextMonth}.`,
          tier,
          used,
          limit: proMonthly,
          resetsAt: nextMonth,
        });
      }
      // Attach quota state for routes that want to surface it in the response
      req.featureQuota = { used, limit: proMonthly, remaining: proMonthly - used, tier };
      next();
    } catch (err) {
      // FAIL OPEN — don't lock paid users out over a transient DB blip.
      // But emit a structured log line so an APM / alert can catch a
      // SUSTAINED outage. During a long Postgres incident every Pro user
      // gets unlimited Claude calls on our bill, so this needs to be loud.
      console.error(JSON.stringify({
        level: 'error',
        scope: 'subscription.requireTierWithLimit',
        event: 'quota_check_failed_open',
        user_id: req.user?.id,
        feature: featureLabel,
        event_type: eventType,
        error: err.message,
      }));
      next();
    }
  };
}

/**
 * Middleware: Check daily search limit.
 * Pro/trial: 10 searches per day. Elite: unlimited.
 * Must be used AFTER attachSubscription.
 *
 * Tracks searches in the rate_limits table with function_name 'daily-search'
 * and a window that resets daily.
 */
const checkSearchLimit = async (req, res, next) => {
  try {
    // If subscription wasn't attached, allow access
    if (!req.subscription) {
      console.warn('[Subscription] checkSearchLimit called without attachSubscription — allowing access');
      return next();
    }

    const { tier, searchesUsed } = req.subscription;

    // No subscription = redirect to pricing (but don't hard-block if something is off)
    if (tier === TIERS.NONE) {
      return res.status(403).json({
        error: 'Subscription required',
        code: 'SUBSCRIPTION_REQUIRED',
        message: 'A subscription is required to search properties. Start your free trial today.',
        timestamp: new Date().toISOString(),
      });
    }

    // Elite = unlimited
    if (tier === TIERS.ELITE) {
      return next();
    }

    // Pro/trial = check daily limit
    const limit = DAILY_SEARCH_LIMITS[tier] || 10;

    if (searchesUsed >= limit) {
      return res.status(403).json({
        error: 'Daily search limit reached',
        code: 'SEARCH_LIMIT_REACHED',
        message: `You have used all ${limit} daily searches. Upgrade to Elite for unlimited searches.`,
        searchesUsed,
        searchLimit: limit,
        currentTier: tier,
        timestamp: new Date().toISOString(),
      });
    }

    // Increment the daily search counter
    if (req.user?.id) {
      try {
        // Check for existing record today
        const existing = await query(
          `SELECT id, request_count FROM rate_limits
           WHERE identifier = $1
             AND function_name = 'daily-search'
             AND window_start >= CURRENT_DATE
           LIMIT 1`,
          [req.user.id]
        );

        if (existing.rows.length > 0) {
          await query(
            `UPDATE rate_limits SET request_count = request_count + 1
             WHERE id = $1`,
            [existing.rows[0].id]
          );
        } else {
          await query(
            `INSERT INTO rate_limits (identifier, function_name, request_count, window_start)
             VALUES ($1, 'daily-search', 1, NOW())`,
            [req.user.id]
          );
        }
      } catch (dbError) {
        // Don't block the search if tracking fails
        console.error('[Subscription] Failed to track search count:', dbError);
      }
    }

    next();
  } catch (error) {
    // Fail open
    console.error('[Subscription] checkSearchLimit error:', error);
    next();
  }
};

module.exports = {
  attachSubscription,
  requireElite,
  requireTierWithLimit,
  checkSearchLimit,
  TIERS,
  DAILY_SEARCH_LIMITS,
};
