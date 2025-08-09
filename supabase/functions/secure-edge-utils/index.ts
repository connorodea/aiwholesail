// Shared security utilities for edge functions
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Access-Control-Max-Age': '86400',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Content-Security-Policy': "default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'"
};

interface SecurityContext {
  user: any;
  isAuthenticated: boolean;
  rateLimitKey: string;
  clientIP: string;
  userAgent: string;
}

/**
 * Enhanced authentication with security logging
 */
export async function authenticateRequest(req: Request): Promise<SecurityContext> {
  const authHeader = req.headers.get('Authorization');
  const clientIP = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';
  const userAgent = req.headers.get('user-agent') || 'unknown';
  
  if (!authHeader) {
    logSecurityEvent('auth_missing_header', { clientIP, userAgent });
    throw new Error('Authorization header required');
  }

  try {
    const token = authHeader.replace('Bearer ', '');
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    );

    const { data: { user }, error } = await supabase.auth.getUser(token);
    
    if (error || !user) {
      logSecurityEvent('auth_invalid_token', { clientIP, userAgent, error: error?.message });
      throw new Error('Invalid authentication token');
    }

    logSecurityEvent('auth_success', { userId: user.id, clientIP, userAgent });

    return {
      user,
      isAuthenticated: true,
      rateLimitKey: `${user.id}:${clientIP}`,
      clientIP,
      userAgent
    };
  } catch (error) {
    logSecurityEvent('auth_error', { error: error.message, clientIP, userAgent });
    throw error;
  }
}

/**
 * Rate limiting with enhanced security
 */
const rateLimitStore = new Map<string, { count: number; resetTime: number; suspiciousActivity: number }>();

export function checkRateLimit(
  key: string, 
  maxRequests: number = 10, 
  windowMs: number = 60000
): { allowed: boolean; remaining: number; resetTime: number; suspicious: boolean } {
  const now = Date.now();
  const record = rateLimitStore.get(key);
  
  if (!record || now > record.resetTime) {
    const newRecord = { count: 1, resetTime: now + windowMs, suspiciousActivity: 0 };
    rateLimitStore.set(key, newRecord);
    return { allowed: true, remaining: maxRequests - 1, resetTime: newRecord.resetTime, suspicious: false };
  }
  
  if (record.count >= maxRequests) {
    record.suspiciousActivity++;
    const suspicious = record.suspiciousActivity >= 3;
    
    if (suspicious) {
      logSecurityEvent('rate_limit_suspicious', { 
        key, 
        count: record.count, 
        suspiciousActivity: record.suspiciousActivity 
      });
    }
    
    return { allowed: false, remaining: 0, resetTime: record.resetTime, suspicious };
  }
  
  record.count++;
  rateLimitStore.set(key, record);
  return { allowed: true, remaining: maxRequests - record.count, resetTime: record.resetTime, suspicious: false };
}

/**
 * Input sanitization for edge functions
 */
export function sanitizeInput(input: any): any {
  if (typeof input === 'string') {
    return input
      .replace(/[<>]/g, '')
      .replace(/javascript:/gi, '')
      .replace(/on\w+=/gi, '')
      .trim()
      .substring(0, 1000);
  }
  
  if (Array.isArray(input)) {
    return input.map(sanitizeInput).slice(0, 100);
  }
  
  if (input && typeof input === 'object') {
    const sanitized: any = {};
    let fieldCount = 0;
    
    for (const [key, value] of Object.entries(input)) {
      if (fieldCount >= 20) break;
      const sanitizedKey = sanitizeInput(key);
      if (typeof sanitizedKey === 'string' && sanitizedKey.length > 0) {
        sanitized[sanitizedKey] = sanitizeInput(value);
        fieldCount++;
      }
    }
    return sanitized;
  }
  
  return input;
}

/**
 * Enhanced security event logging
 */
export function logSecurityEvent(event: string, details: Record<string, any> = {}): void {
  const timestamp = new Date().toISOString();
  const sanitizedDetails = sanitizeInput(details);
  
  // Remove sensitive information
  if (sanitizedDetails.password) delete sanitizedDetails.password;
  if (sanitizedDetails.token) delete sanitizedDetails.token;
  if (sanitizedDetails.apiKey) delete sanitizedDetails.apiKey;
  
  console.log(`[SECURITY-${event.toUpperCase()}] ${timestamp}`, JSON.stringify(sanitizedDetails));
}

/**
 * Validate request origin
 */
export function validateOrigin(req: Request): boolean {
  const origin = req.headers.get('origin');
  if (!origin) return false;
  
  const allowedOrigins = [
    'https://5517ce0d-fb4d-4d20-b50b-87cd9b6b6e36.lovableproject.com',
    'http://localhost:8080',
    'http://127.0.0.1:8080'
  ];
  
  // Add custom domain if configured
  const customDomain = Deno.env.get('CUSTOM_DOMAIN');
  if (customDomain) {
    allowedOrigins.push(`https://${customDomain}`);
  }
  
  return allowedOrigins.includes(origin);
}

/**
 * Create secure response with headers
 */
export function createSecureResponse(
  body: any, 
  status: number = 200, 
  additionalHeaders: Record<string, string> = {}
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
      ...additionalHeaders
    }
  });
}

/**
 * Handle CORS preflight
 */
export function handleCORS(): Response {
  return new Response(null, { headers: corsHeaders });
}