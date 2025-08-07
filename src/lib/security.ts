import DOMPurify from 'dompurify';

// Input validation and sanitization utilities for security

/**
 * Sanitizes HTML content to prevent XSS attacks
 */
export function sanitizeHtml(content: string): string {
  return DOMPurify.sanitize(content, {
    ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'u', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li'],
    ALLOWED_ATTR: []
  });
}

/**
 * Validates and sanitizes numeric input
 */
export function validateNumericInput(value: string | number, min?: number, max?: number): number | null {
  const num = typeof value === 'string' ? parseInt(value.replace(/[^\d.-]/g, ''), 10) : value;
  
  if (isNaN(num) || !isFinite(num)) {
    return null;
  }
  
  if (min !== undefined && num < min) {
    return min;
  }
  
  if (max !== undefined && num > max) {
    return max;
  }
  
  return num;
}

/**
 * Sanitizes search keywords to prevent injection attacks
 */
export function sanitizeSearchKeywords(keywords: string): string {
  if (!keywords || typeof keywords !== 'string') {
    return '';
  }
  
  // Remove potentially dangerous characters and limit length
  return keywords
    .replace(/[<>'"&]/g, '') // Remove HTML/script injection chars
    .replace(/[;|&$`]/g, '') // Remove command injection chars
    .trim()
    .substring(0, 200); // Limit length
}

/**
 * Validates location input to ensure it's safe
 */
export function validateLocationInput(location: string): string {
  if (!location || typeof location !== 'string') {
    return '';
  }
  
  // Allow letters, numbers, spaces, commas, periods, and common location chars
  return location
    .replace(/[^a-zA-Z0-9\s,.-]/g, '')
    .trim()
    .substring(0, 100);
}

/**
 * Validates price input ranges
 */
export function validatePriceRange(minPrice?: string, maxPrice?: string): { min?: number; max?: number; error?: string } {
  const min = minPrice ? validateNumericInput(minPrice, 0, 50000000) : undefined;
  const max = maxPrice ? validateNumericInput(maxPrice, 0, 50000000) : undefined;
  
  if (min !== null && max !== null && min > max) {
    return { error: 'Minimum price cannot be greater than maximum price' };
  }
  
  return { min: min || undefined, max: max || undefined };
}

/**
 * Rate limiting check for client-side operations
 */
const rateLimitStore = new Map<string, number[]>();

export function checkRateLimit(key: string, maxRequests: number = 10, windowMs: number = 60000): boolean {
  const now = Date.now();
  
  if (!rateLimitStore.has(key)) {
    rateLimitStore.set(key, []);
  }
  
  const requests = rateLimitStore.get(key)!;
  const recentRequests = requests.filter(time => now - time < windowMs);
  
  if (recentRequests.length >= maxRequests) {
    return false;
  }
  
  recentRequests.push(now);
  rateLimitStore.set(key, recentRequests);
  return true;
}