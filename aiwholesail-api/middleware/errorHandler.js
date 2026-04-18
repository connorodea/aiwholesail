const { query } = require('../config/database');

/**
 * Sanitize error messages to prevent information leakage
 */
function sanitizeErrorMessage(message) {
  // Don't expose sensitive information
  const sensitivePatterns = [
    /password/gi,
    /token/gi,
    /secret/gi,
    /api[_-]?key/gi,
    /authorization/gi,
    /bearer/gi,
    /credential/gi
  ];

  for (const pattern of sensitivePatterns) {
    if (pattern.test(message)) {
      return 'An error occurred while processing your request';
    }
  }

  return message;
}

/**
 * Log security events to database
 */
async function logSecurityEvent(eventType, details, userId, req) {
  try {
    await query(
      `INSERT INTO security_events (user_id, event_type, event_details, ip_address, user_agent)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        userId || null,
        eventType,
        JSON.stringify({
          ...details,
          timestamp: new Date().toISOString()
        }),
        req?.headers?.['x-forwarded-for']?.split(',')[0]?.trim() || req?.ip || null,
        req?.headers?.['user-agent'] || null
      ]
    );
  } catch (error) {
    console.error('[Security] Failed to log event:', error);
  }
}

/**
 * Express error handling middleware
 */
const errorHandler = async (err, req, res, next) => {
  // Log error
  console.error('[Error]', {
    message: err.message,
    stack: process.env.NODE_ENV !== 'production' ? err.stack : undefined,
    path: req.path,
    method: req.method,
    userId: req.user?.id
  });

  // Log security event for server errors
  if (err.status >= 500 || !err.status) {
    await logSecurityEvent('server_error', {
      error: err.message,
      path: req.path,
      method: req.method
    }, req.user?.id, req);
  }

  // Determine status code
  const statusCode = err.status || err.statusCode || 500;

  // Build error response
  const errorResponse = {
    error: sanitizeErrorMessage(err.message) || 'Internal server error',
    timestamp: new Date().toISOString()
  };

  // Add validation errors if present
  if (err.errors && Array.isArray(err.errors)) {
    errorResponse.errors = err.errors.map(e => ({
      field: e.param || e.path,
      message: e.msg || e.message
    }));
  }

  // Add stack trace in development
  if (process.env.NODE_ENV !== 'production' && err.stack) {
    errorResponse.stack = err.stack;
  }

  res.status(statusCode).json(errorResponse);
};

/**
 * Async error wrapper for route handlers
 */
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

/**
 * Create custom error with status code
 */
class AppError extends Error {
  constructor(message, statusCode = 500) {
    super(message);
    this.status = statusCode;
    this.statusCode = statusCode;
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Validation error helper
 */
class ValidationError extends AppError {
  constructor(errors) {
    super('Validation failed');
    this.status = 400;
    this.errors = errors;
  }
}

module.exports = {
  errorHandler,
  asyncHandler,
  AppError,
  ValidationError,
  logSecurityEvent,
  sanitizeErrorMessage
};
