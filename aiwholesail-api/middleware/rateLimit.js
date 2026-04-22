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

    // Different limits for different endpoints
    const limits = getEndpointLimits(endpoint);

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
 */
function getEndpointLimits(endpoint) {
  // Strict limits for auth endpoints
  if (endpoint.includes('/auth/signin') || endpoint.includes('/auth/signup')) {
    return { max: 10, windowMs: 60000 }; // 10 per minute
  }

  // Strict limits for password reset
  if (endpoint.includes('/auth/reset')) {
    return { max: 5, windowMs: 300000 }; // 5 per 5 minutes
  }

  // AI endpoints (expensive)
  if (endpoint.includes('/ai/')) {
    return { max: 20, windowMs: 60000 }; // 20 per minute
  }

  // Stripe endpoints
  if (endpoint.includes('/stripe/')) {
    return { max: 30, windowMs: 60000 }; // 30 per minute
  }

  // Property data endpoints
  if (endpoint.includes('/property/') || endpoint.includes('/zillow/')) {
    return { max: 60, windowMs: 60000 }; // 60 per minute
  }

  // Communication endpoints
  if (endpoint.includes('/email/') || endpoint.includes('/sms/') || endpoint.includes('/call/')) {
    return { max: 20, windowMs: 60000 }; // 20 per minute
  }

  // Default limits
  return { max: 100, windowMs: 60000 }; // 100 per minute
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
