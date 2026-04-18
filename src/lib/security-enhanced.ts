// Enhanced security utilities for comprehensive protection
import DOMPurify from 'dompurify';

// Rate limiting store with session timeout tracking
const rateLimitStore = new Map<string, { count: number; resetTime: number; lastActivity: number }>();
const securityEventStore = new Map<string, Array<{ event: string; timestamp: number; details: any }>>();

/**
 * Enhanced rate limiting with session tracking
 */
export function checkAdvancedRateLimit(
  key: string, 
  maxRequests: number = 10, 
  windowMs: number = 60000,
  sessionTimeoutMs: number = 1800000 // 30 minutes
): { allowed: boolean; remaining: number; resetTime: number; sessionExpired: boolean } {
  const now = Date.now();
  const record = rateLimitStore.get(key);
  
  if (!record || now > record.resetTime) {
    // Create new rate limit window
    const newRecord = { count: 1, resetTime: now + windowMs, lastActivity: now };
    rateLimitStore.set(key, newRecord);
    return { allowed: true, remaining: maxRequests - 1, resetTime: newRecord.resetTime, sessionExpired: false };
  }
  
  // Check session timeout
  const sessionExpired = now - record.lastActivity > sessionTimeoutMs;
  if (sessionExpired) {
    // Reset due to session timeout
    const newRecord = { count: 1, resetTime: now + windowMs, lastActivity: now };
    rateLimitStore.set(key, newRecord);
    return { allowed: true, remaining: maxRequests - 1, resetTime: newRecord.resetTime, sessionExpired: true };
  }
  
  // Update last activity
  record.lastActivity = now;
  
  if (record.count >= maxRequests) {
    return { allowed: false, remaining: 0, resetTime: record.resetTime, sessionExpired: false };
  }
  
  record.count++;
  rateLimitStore.set(key, record);
  return { allowed: true, remaining: maxRequests - record.count, resetTime: record.resetTime, sessionExpired: false };
}

/**
 * Enhanced input sanitization with deep object cleaning
 */
export function sanitizeInputDeep(input: any): any {
  if (typeof input === 'string') {
    return DOMPurify.sanitize(input, { ALLOWED_TAGS: [], ALLOWED_ATTR: [] })
      .replace(/[<>]/g, '')
      .trim()
      .substring(0, 1000); // Limit length
  }
  
  if (Array.isArray(input)) {
    return input.map(item => sanitizeInputDeep(item)).slice(0, 100); // Limit array size
  }
  
  if (input && typeof input === 'object') {
    const sanitized: any = {};
    let fieldCount = 0;
    
    for (const [key, value] of Object.entries(input)) {
      if (fieldCount >= 50) break; // Limit object size
      
      const sanitizedKey = sanitizeInputDeep(key);
      if (sanitizedKey && typeof sanitizedKey === 'string' && sanitizedKey.length > 0) {
        sanitized[sanitizedKey] = sanitizeInputDeep(value);
        fieldCount++;
      }
    }
    return sanitized;
  }
  
  return input;
}

/**
 * Validate and sanitize edge function parameters
 */
export function validateEdgeFunctionInput(input: any, requiredFields: string[] = []): { isValid: boolean; sanitized: any; errors: string[] } {
  const errors: string[] = [];
  
  if (!input || typeof input !== 'object') {
    return { isValid: false, sanitized: null, errors: ['Invalid input format'] };
  }
  
  const sanitized = sanitizeInputDeep(input);
  
  // Check required fields
  for (const field of requiredFields) {
    if (!sanitized[field]) {
      errors.push(`Missing required field: ${field}`);
    }
  }
  
  // Validate specific field types
  if (sanitized.email && typeof sanitized.email === 'string') {
    const emailRegex = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/;
    if (!emailRegex.test(sanitized.email)) {
      errors.push('Invalid email format');
    }
  }
  
  if (sanitized.propertyId && typeof sanitized.propertyId === 'string') {
    if (!/^[a-zA-Z0-9_-]+$/.test(sanitized.propertyId)) {
      errors.push('Invalid property ID format');
    }
  }
  
  return {
    isValid: errors.length === 0,
    sanitized,
    errors
  };
}

/**
 * Enhanced security event logging with threat detection
 */
export function logSecurityEventEnhanced(
  event: string,
  details: Record<string, any> = {},
  userId?: string
): void {
  const timestamp = Date.now();
  const sanitizedDetails = sanitizeInputDeep(details);
  
  // Remove sensitive data
  if (sanitizedDetails.password) delete sanitizedDetails.password;
  if (sanitizedDetails.token) delete sanitizedDetails.token;
  
  const logEntry = {
    event,
    timestamp,
    details: sanitizedDetails,
    userId: userId || 'anonymous',
    userAgent: typeof window !== 'undefined' ? window.navigator.userAgent : 'server',
    ip: 'masked' // IP is handled server-side
  };
  
  console.log('[SECURITY]', JSON.stringify(logEntry));
  
  // Store for pattern analysis
  if (userId) {
    const userEvents = securityEventStore.get(userId) || [];
    userEvents.push({ event, timestamp, details: sanitizedDetails });
    
    // Keep only last 100 events
    if (userEvents.length > 100) {
      userEvents.splice(0, userEvents.length - 100);
    }
    
    securityEventStore.set(userId, userEvents);
    
    // Check for suspicious patterns
    detectSuspiciousActivity(userId, userEvents);
  }
}

/**
 * Detect suspicious activity patterns
 */
function detectSuspiciousActivity(userId: string, events: Array<{ event: string; timestamp: number; details: any }>): void {
  const recentEvents = events.filter(e => Date.now() - e.timestamp < 300000); // Last 5 minutes
  
  // Multiple failed attempts
  const failedAttempts = recentEvents.filter(e => e.event.includes('failed')).length;
  if (failedAttempts >= 5) {
    logSecurityEventEnhanced('suspicious_multiple_failures', { failedAttempts, userId });
  }
  
  // Rapid requests
  if (recentEvents.length >= 20) {
    logSecurityEventEnhanced('suspicious_rapid_requests', { requestCount: recentEvents.length, userId });
  }
  
  // Unusual access patterns
  const uniqueIPs = new Set(recentEvents.map(e => e.details.ip)).size;
  if (uniqueIPs >= 3) {
    logSecurityEventEnhanced('suspicious_multiple_ips', { ipCount: uniqueIPs, userId });
  }
}

/**
 * Session timeout checker
 */
export function checkSessionTimeout(lastActivity: number, timeoutMinutes: number = 30): boolean {
  return Date.now() - lastActivity > timeoutMinutes * 60 * 1000;
}

/**
 * Generate secure Content Security Policy
 */
export function generateCSPHeader(): string {
  return [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.googletagmanager.com https://www.google-analytics.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: https: blob:",
    "connect-src 'self' https://api.aiwholesail.com https://api.anthropic.com https://api.openai.com https://*.rapidapi.com https://api.stripe.com https://js.stripe.com https://www.google-analytics.com",
    "frame-src 'self' https://js.stripe.com https://hooks.stripe.com",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'"
  ].join('; ');
}

/**
 * Validate API request origin
 */
export function validateRequestOrigin(origin: string, allowedOrigins: string[]): boolean {
  if (!origin) return false;
  
  // Allow exact matches
  if (allowedOrigins.includes(origin)) return true;
  
  // Allow localhost in development
  if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
    return process.env.NODE_ENV === 'development';
  }
  
  // Allow Lovable preview domains
  if (origin.includes('.lovableproject.com')) return true;
  
  return false;
}

/**
 * Enhanced password validation with common password checks
 */
export function validatePasswordEnhanced(password: string): { isValid: boolean; score: number; errors: string[] } {
  const errors: string[] = [];
  let score = 0;
  
  if (!password) {
    return { isValid: false, score: 0, errors: ['Password is required'] };
  }
  
  if (password.length < 8) {
    errors.push('Password must be at least 8 characters long');
  } else {
    score += 20;
  }
  
  if (password.length >= 12) score += 10;
  
  if (/[a-z]/.test(password)) score += 15;
  else errors.push('Password must contain lowercase letters');
  
  if (/[A-Z]/.test(password)) score += 15;
  else errors.push('Password must contain uppercase letters');
  
  if (/[0-9]/.test(password)) score += 15;
  else errors.push('Password must contain numbers');
  
  if (/[^a-zA-Z0-9]/.test(password)) score += 25;
  else errors.push('Password must contain special characters');
  
  // Check for common patterns
  const commonPatterns = [
    /123456/, /password/i, /qwerty/i, /admin/i, /login/i,
    /(.)\1{2,}/, // Repeated characters
    /^[a-zA-Z]+$/, // Only letters
    /^[0-9]+$/ // Only numbers
  ];
  
  for (const pattern of commonPatterns) {
    if (pattern.test(password)) {
      errors.push('Password contains common patterns');
      score -= 20;
      break;
    }
  }
  
  return {
    isValid: errors.length === 0 && score >= 60,
    score: Math.max(0, Math.min(100, score)),
    errors
  };
}
