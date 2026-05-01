const { query } = require('../config/database');

// In-memory rate limit cache for performance
const rateLimitCache = new Map();

/**
 * Clean up expired entries from cache periodically
 */
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of rateLimitCache.entries()) {
    if (value.resetTime < now) {
      rateLimitCache.delete(key);
    }
  }
}, 60000); // Clean every minute

/**
 * Express middleware for rate limiting
 */
const rateLimiter = async (req, res, next) => {
  try {
    // Get identifier (user ID if authenticated, IP otherwise)
    const identifier = req.user?.id ||
      req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
      req.headers['x-real-ip'] ||
      req.ip ||
      'unknown';

    const endpoint = req.path;
    const key = `${identifier}:${endpoint}`;

    // Look up subscription tier for tier-aware rate limiting
    let subscriptionTier = null;
    if (req.user?.id) {
      try {
        const subResult = await query(
          'SELECT subscription_tier FROM subscribers WHERE user_id = $1 AND subscribed = true LIMIT 1',
          [req.user.id]
        );
        if (subResult.rows.length > 0) {
          subscriptionTier = subResult.rows[0].subscription_tier;
        }
      } catch {}
    }

    const limits = getEndpointLimits(endpoint, subscriptionTier);

    const now = Date.now();
    const windowMs = limits.windowMs;

    // Check cache first
    let record = rateLimitCache.get(key);

    if (!record || record.resetTime < now) {
      record = {
        count: 1,
        resetTime: now + windowMs
      };
      rateLimitCache.set(key, record);
    } else {
      record.count++;
    }

    // Set rate limit headers
    res.set({
      'X-RateLimit-Limit': limits.max,
      'X-RateLimit-Remaining': Math.max(0, limits.max - record.count),
      'X-RateLimit-Reset': Math.ceil(record.resetTime / 1000)
    });

    if (record.count > limits.max) {
      // Log rate limit exceeded
      await logRateLimitExceeded(identifier, endpoint, req);

      return res.status(429).json({
        error: 'Too many requests',
        message: `Rate limit exceeded. Please try again later.`,
        retryAfter: Math.ceil((record.resetTime - now) / 1000),
        timestamp: new Date().toISOString()
      });
    }

    next();
  } catch (error) {
    // Don't block requests on rate limit errors
    console.error('[RateLimit] Error:', error);
    next();
  }
};

/**
 * Get rate limits for specific endpoints
 * Tier-aware: Pro = throttled, Elite = unlimited
 */
function getEndpointLimits(endpoint, subscriptionTier) {
  const isElite = subscriptionTier === 'Elite' || subscriptionTier === 'Premium';

  // Strict limits for auth endpoints (same for all)
  if (endpoint.includes('/auth/signin') || endpoint.includes('/auth/signup')) {
    return { max: 10, windowMs: 60000 };
  }

  if (endpoint.includes('/auth/reset')) {
    return { max: 5, windowMs: 300000 };
  }

  // Contact form — 3 per hour (same for all, no auth required)
  if (endpoint.includes('/contact')) {
    return { max: 3, windowMs: 3600000 };
  }

  // AI endpoints — Pro: 10/min, Elite: 100/min
  if (endpoint.includes('/ai/')) {
    return isElite ? { max: 100, windowMs: 60000 } : { max: 10, windowMs: 60000 };
  }

  // Stripe endpoints (same for all)
  if (endpoint.includes('/stripe/')) {
    return { max: 30, windowMs: 60000 };
  }

  // Property search — Pro: 30/min, Elite: unlimited (300/min)
  if (endpoint.includes('/property/') || endpoint.includes('/zillow/')) {
    return isElite ? { max: 300, windowMs: 60000 } : { max: 30, windowMs: 60000 };
  }

  // Communication endpoints — Pro: 10/min, Elite: 50/min
  if (endpoint.includes('/email/') || endpoint.includes('/sms/') || endpoint.includes('/call/')) {
    return isElite ? { max: 50, windowMs: 60000 } : { max: 10, windowMs: 60000 };
  }

  // Default — Pro: 60/min, Elite: 300/min
  return isElite ? { max: 300, windowMs: 60000 } : { max: 60, windowMs: 60000 };
}

/**
 * Log rate limit exceeded event
 */
async function logRateLimitExceeded(identifier, endpoint, req) {
  try {
    await query(
      `INSERT INTO security_events (user_id, event_type, event_details, ip_address, user_agent)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        req.user?.id || null,
        'rate_limit_exceeded',
        JSON.stringify({
          endpoint,
          identifier,
          timestamp: new Date().toISOString()
        }),
        req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip,
        req.headers['user-agent']
      ]
    );
  } catch (error) {
    console.error('[RateLimit] Failed to log event:', error);
  }
}

/**
 * Database-backed rate limiting check (for more persistent tracking)
 */
async function checkDatabaseRateLimit(identifier, functionName, maxRequests = 30, windowMinutes = 15) {
  const windowStart = new Date(Date.now() - windowMinutes * 60 * 1000);

  try {
    // Get or create rate limit record
    const result = await query(
      `SELECT request_count, window_start FROM rate_limits
       WHERE identifier = $1 AND function_name = $2 AND window_start >= $3`,
      [identifier, functionName, windowStart.toISOString()]
    );

    if (result.rows.length === 0) {
      // Create new rate limit record
      await query(
        `INSERT INTO rate_limits (identifier, function_name, request_count, window_start)
         VALUES ($1, $2, 1, NOW())`,
        [identifier, functionName]
      );
      return { allowed: true, remaining: maxRequests - 1 };
    }

    if (result.rows[0].request_count >= maxRequests) {
      return { allowed: false, remaining: 0 };
    }

    // Increment request count
    await query(
      `UPDATE rate_limits SET request_count = request_count + 1
       WHERE identifier = $1 AND function_name = $2 AND window_start >= $3`,
      [identifier, functionName, windowStart.toISOString()]
    );

    return { allowed: true, remaining: maxRequests - result.rows[0].request_count - 1 };
  } catch (error) {
    console.error('[RateLimit] Database check error:', error);
    return { allowed: true, remaining: maxRequests }; // Allow on error
  }
}

module.exports = {
  rateLimiter,
  checkDatabaseRateLimit
};
