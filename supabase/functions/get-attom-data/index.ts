import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import "https://deno.land/x/xhr@0.1.0/mod.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
}

// Rate limiting map to track requests per IP
const rateLimitMap = new Map()
const RATE_LIMIT_WINDOW = 60000 // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 15

serve(async (req) => {
  const startTime = Date.now()
  const clientIP = req.headers.get('x-forwarded-for') || req.headers.get('cf-connecting-ip') || 'unknown'
  
  console.log(`[${new Date().toISOString()}] ${req.method} AttomData request from ${clientIP}`)

  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  // Rate limiting check
  const now = Date.now()
  if (!rateLimitMap.has(clientIP)) {
    rateLimitMap.set(clientIP, [])
  }
  
  const requests = rateLimitMap.get(clientIP)
  const recentRequests = requests.filter((time: number) => now - time < RATE_LIMIT_WINDOW)
  
  if (recentRequests.length >= RATE_LIMIT_MAX_REQUESTS) {
    console.warn(`[${new Date().toISOString()}] Rate limit exceeded for IP: ${clientIP}`)
    return new Response(
      JSON.stringify({ success: false, error: 'Rate limit exceeded. Please try again later.' }),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json',
          'Retry-After': '60'
        }, 
        status: 429 
      }
    )
  }
  
  recentRequests.push(now)
  rateLimitMap.set(clientIP, recentRequests)

  try {
    const { endpoint, params, action = 'request' } = await req.json()

    const apiKey = Deno.env.get('ATTOM_API_KEY')
    console.log(`[${new Date().toISOString()}] API Key available: ${!!apiKey}, first 10 chars: ${apiKey?.substring(0, 10)}...`)
    
    if (!apiKey) {
      console.error(`[${new Date().toISOString()}] AttomData API key not configured`)
      return new Response(
        JSON.stringify({ success: false, error: 'AttomData API key not configured' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      )
    }

    const baseUrl = 'https://api.gateway.attomdata.com/propertyapi/v1.0.0'
    
    let url: URL
    let requestHeaders: Record<string, string>

    if (action === 'test') {
      // Test connection with a basic property search
      url = new URL(`${baseUrl}/property/snapshot`)
      url.searchParams.append('cityname', 'Los Angeles')
      
      requestHeaders = {
        'Accept': 'application/json',
        'apikey': apiKey,
      }
    } else {
      // Regular API request
      url = new URL(`${baseUrl}${endpoint}`)
      
      // Add parameters to URL
      Object.entries(params || {}).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          url.searchParams.append(key, value.toString())
        }
      })
      
      // Use header-based authentication
      requestHeaders = {
        'Accept': 'application/json',
        'apikey': apiKey,
      }
    }

    console.log(`[${new Date().toISOString()}] Making AttomData API request for ${clientIP}:`, { 
      action, 
      endpoint, 
      url: url.toString(),
      hasApiKey: !!apiKey,
      headers: Object.keys(requestHeaders)
    })

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: requestHeaders,
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`[${new Date().toISOString()}] AttomData API error for ${clientIP}: ${response.status} ${response.statusText}`)
      console.error(`[${new Date().toISOString()}] Error response body:`, errorText)
      throw new Error(`AttomData API error: ${response.status} ${response.statusText}`)
    }

    const data = await response.json()
    const duration = Date.now() - startTime
    console.log(`[${new Date().toISOString()}] AttomData API response received for ${clientIP} in ${duration}ms`)

    return new Response(
      JSON.stringify({ success: true, data }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    const duration = Date.now() - startTime
    console.error(`[${new Date().toISOString()}] Error in get-attom-data for ${clientIP} after ${duration}ms:`, error)
    
    // Sanitize error message to avoid information leakage
    const sanitizedError = error instanceof Error && error.message.includes('API') 
      ? 'External service error' 
      : error.message || 'Failed to fetch AttomData'
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: sanitizedError
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})