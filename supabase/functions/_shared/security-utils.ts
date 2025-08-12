/**
 * Shared security utilities for edge functions
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

export const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Rate limiting check using database
 */
export async function checkRateLimit(
  identifier: string,
  functionName: string,
  maxRequests: number = 30,
  windowMinutes: number = 15
): Promise<{ allowed: boolean; remaining: number }> {
  const windowStart = new Date(Date.now() - windowMinutes * 60 * 1000);
  
  try {
    // Get or create rate limit record
    const { data, error } = await supabaseAdmin
      .from('rate_limits')
      .select('request_count, window_start')
      .eq('identifier', identifier)
      .eq('function_name', functionName)
      .gte('window_start', windowStart.toISOString())
      .single();

    if (error && error.code !== 'PGRST116') { // Not found error
      console.error('Rate limit check error:', error);
      return { allowed: true, remaining: maxRequests }; // Allow on error
    }

    if (!data) {
      // Create new rate limit record
      await supabaseAdmin
        .from('rate_limits')
        .insert({
          identifier,
          function_name: functionName,
          request_count: 1,
          window_start: new Date().toISOString()
        });
      return { allowed: true, remaining: maxRequests - 1 };
    }

    if (data.request_count >= maxRequests) {
      return { allowed: false, remaining: 0 };
    }

    // Increment request count
    await supabaseAdmin
      .from('rate_limits')
      .update({ request_count: data.request_count + 1 })
      .eq('identifier', identifier)
      .eq('function_name', functionName);

    return { allowed: true, remaining: maxRequests - data.request_count - 1 };
  } catch (error) {
    console.error('Rate limit error:', error);
    return { allowed: true, remaining: maxRequests }; // Allow on error
  }
}

/**
 * Log security events
 */
export async function logSecurityEvent(
  eventType: string,
  details: Record<string, any> = {},
  userId?: string,
  req?: Request
) {
  try {
    const event = {
      user_id: userId || null,
      event_type: eventType,
      event_details: {
        ...details,
        timestamp: new Date().toISOString(),
        user_agent: req?.headers.get('user-agent') || null,
      },
      ip_address: req?.headers.get('x-forwarded-for') || 
                  req?.headers.get('x-real-ip') || null,
    };

    await supabaseAdmin
      .from('security_events')
      .insert(event);
  } catch (error) {
    console.error('Failed to log security event:', error);
  }
}

/**
 * Sanitize input to prevent XSS and injection attacks
 */
export function sanitizeInput(input: any): any {
  if (typeof input === 'string') {
    return input
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
      .replace(/\//g, '&#x2F;')
      .trim()
      .slice(0, 1000); // Limit length
  }
  
  if (Array.isArray(input)) {
    return input.slice(0, 100).map(sanitizeInput); // Limit array size
  }
  
  if (input && typeof input === 'object') {
    const sanitized: Record<string, any> = {};
    // Limit object properties
    Object.keys(input).slice(0, 50).forEach(key => {
      sanitized[sanitizeInput(key)] = sanitizeInput(input[key]);
    });
    return sanitized;
  }
  
  return input;
}

/**
 * Validate and authenticate user from request
 */
export async function authenticateUser(req: Request) {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    throw new Error('Authorization header missing');
  }

  const token = authHeader.replace('Bearer ', '');
  const supabase = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_ANON_KEY')!);
  
  const { data: { user }, error } = await supabase.auth.getUser(token);
  
  if (error || !user) {
    throw new Error('Authentication failed');
  }

  return user;
}

/**
 * Create safe error response that doesn't leak sensitive information
 */
export function createErrorResponse(
  message: string,
  status: number = 500,
  details?: Record<string, any>
): Response {
  const safeMessage = message.includes('password') || message.includes('token') || message.includes('key') 
    ? 'An error occurred'
    : message;

  return new Response(
    JSON.stringify({ 
      error: safeMessage,
      timestamp: new Date().toISOString(),
      ...(details && { details: sanitizeInput(details) })
    }),
    { 
      status,
      headers: { 
        'Content-Type': 'application/json',
        ...corsHeaders 
      }
    }
  );
}