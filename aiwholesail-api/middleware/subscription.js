const { query } = require('../config/database');

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
      req.subscription = { tier: TIERS.NONE, searchesUsed: 0 };
      return next();
    }

    // Determine effective tier
    let tier = TIERS.NONE;
    if (sub.is_trial) {
      // Check if trial has expired
      if (sub.trial_end && new Date(sub.trial_end) < new Date()) {
        req.subscription = { tier: TIERS.NONE, searchesUsed: 0 };
        return next();
      }
      tier = TIERS.TRIAL;
    } else if (sub.subscription_tier === 'Elite' || sub.subscription_tier === 'Premium') {
      tier = TIERS.ELITE;
    } else if (sub.subscription_tier === 'Pro') {
      tier = TIERS.PRO;
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
  checkSearchLimit,
  TIERS,
  DAILY_SEARCH_LIMITS,
};
