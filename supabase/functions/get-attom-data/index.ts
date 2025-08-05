import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import "https://deno.land/x/xhr@0.1.0/mod.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { endpoint, params, action = 'request' } = await req.json()

    const apiKey = Deno.env.get('ATTOM_API_KEY')
    if (!apiKey) {
      return new Response(
        JSON.stringify({ success: false, error: 'AttomData API key not configured' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      )
    }

    const baseUrl = 'https://api.gateway.attomdata.com/propertyapi/v1.0.0'
    
    let url: URL
    let requestHeaders: Record<string, string>

    if (action === 'test') {
      // Test connection
      url = new URL(`${baseUrl}/property/basicprofile`)
      url.searchParams.append('address1', '123 Main St')
      url.searchParams.append('locality', 'Los Angeles')
      url.searchParams.append('postalcode', 'CA')
      url.searchParams.append('apikey', apiKey)
      
      requestHeaders = {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
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
      
      // Try header-based authentication first
      requestHeaders = {
        'Accept': 'application/json',
        'apikey': apiKey,
      }
    }

    console.log('Making AttomData API request:', { action, endpoint, url: url.toString() })

    let response = await fetch(url.toString(), {
      method: 'GET',
      headers: requestHeaders,
    })

    // If header auth fails, try query parameter auth
    if (!response.ok && action !== 'test') {
      console.log('Header auth failed, trying query parameter auth')
      url.searchParams.append('apikey', apiKey)
      
      response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
      })
    }

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`AttomData API error: ${response.status} ${response.statusText}. Response: ${errorText}`)
    }

    const data = await response.json()
    console.log('AttomData API response received')

    return new Response(
      JSON.stringify({ success: true, data }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error in get-attom-data function:', error)
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message || 'Failed to fetch AttomData' 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})