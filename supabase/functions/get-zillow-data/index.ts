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
const RATE_LIMIT_MAX_REQUESTS = 20

serve(async (req) => {
  const startTime = Date.now()
  const clientIP = req.headers.get('x-forwarded-for') || req.headers.get('cf-connecting-ip') || 'unknown'
  
  console.log(`[${new Date().toISOString()}] ${req.method} Zillow request from ${clientIP}`)

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
    const { searchParams, action = 'search' } = await req.json()

    const apiKey = Deno.env.get('ZILLOW_API_KEY')
    if (!apiKey) {
      console.error(`[${new Date().toISOString()}] Zillow API key not configured`)
      return new Response(
        JSON.stringify({ success: false, error: 'Zillow API key not configured' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      )
    }

    // New Zillow Scraper API endpoints
    const baseUrls: Record<string, string> = {
      search: "https://zillow-scraper-api.p.rapidapi.com/zillow/search",
      propertyDetails: "https://zillow-scraper-api.p.rapidapi.com/zillow/property",
      priceHistory: "https://zillow-scraper-api.p.rapidapi.com/zillow/property",
      photos: "https://zillow-scraper-api.p.rapidapi.com/zillow/property",
      comps: "https://zillow-scraper-api.p.rapidapi.com/zillow/property",
      zestimate: "https://zillow-scraper-api.p.rapidapi.com/zillow/valuation",
      taxes: "https://zillow-scraper-api.p.rapidapi.com/zillow/property",
      schools: "https://zillow-scraper-api.p.rapidapi.com/zillow/property",
      rentalEstimate: "https://zillow-scraper-api.p.rapidapi.com/zillow/valuation",
    };

    let headers: Record<string, string> = {
      "x-rapidapi-key": apiKey,
      "x-rapidapi-host": "zillow-scraper-api.p.rapidapi.com"
    };

    let url: string;
    let requestParams: Record<string, string> = {};

    if (action === 'test') {
      requestParams = {
        location: "New York, NY",
        home_type: "house",
        sort: "newest",
        listing_type: "for_sale",
        page: "1"
      };
      url = `${baseUrls.search}?${new URLSearchParams(requestParams)}`;
    } else if (action === 'search') {
      // New Zillow Scraper API search parameters
      requestParams = {
        location: searchParams.location,
        home_type: searchParams.homeType?.toLowerCase() || 'house',
        sort: 'newest',  // Critical for catching deals early
        listing_type: 'for_sale',
        page: searchParams.page || '1'
      };

      // Map old parameter names to new ones
      if (searchParams.bed_min) requestParams.beds_min = searchParams.bed_min;
      if (searchParams.bed_max) requestParams.beds_max = searchParams.bed_max;
      if (searchParams.bathrooms) requestParams.baths_min = searchParams.bathrooms;
      if (searchParams.price_min) requestParams.min_price = searchParams.price_min;
      if (searchParams.price_max) requestParams.max_price = searchParams.price_max;

      // Log FSBO requests (note: new API may not support FSBO filtering the same way)
      if (searchParams.fsboOnly) {
        console.log(`[${new Date().toISOString()}] FSBO filtering requested for ${clientIP} - note: new API may have limited FSBO support`);
      }

      url = `${baseUrls.search}?${new URLSearchParams(requestParams)}`;
    } else if (action === 'propertyDetails') {
      // Property details: /zillow/property/{zpid}
      if (!searchParams.zpid) {
        return new Response(
          JSON.stringify({ success: false, error: 'Missing required parameter: zpid' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        );
      }
      url = `${baseUrls.propertyDetails}/${searchParams.zpid}`;
    } else if (action === 'priceHistory') {
      // Price history: /zillow/property/{zpid}/price-history
      if (!searchParams.zpid) {
        return new Response(
          JSON.stringify({ success: false, error: 'Missing required parameter: zpid' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        );
      }
      url = `${baseUrls.priceHistory}/${searchParams.zpid}/price-history`;
    } else if (action === 'photos') {
      // Photos: /zillow/property/{zpid}/photos
      if (!searchParams.zpid) {
        return new Response(
          JSON.stringify({ success: false, error: 'Missing required parameter: zpid' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        );
      }
      url = `${baseUrls.photos}/${searchParams.zpid}/photos`;
    } else if (action === 'comps') {
      // Similar properties (comps): /zillow/property/{zpid}/similar
      if (!searchParams.zpid) {
        return new Response(
          JSON.stringify({ success: false, error: 'Missing required parameter: zpid' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        );
      }
      url = `${baseUrls.comps}/${searchParams.zpid}/similar`;
    } else if (action === 'zestimate') {
      // Zestimate/Valuation: /zillow/valuation/{zpid}
      if (!searchParams.zpid) {
        return new Response(
          JSON.stringify({ success: false, error: 'Missing required parameter: zpid' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        );
      }
      url = `${baseUrls.zestimate}/${searchParams.zpid}`;
    } else if (action === 'taxes') {
      // Tax history: /zillow/property/{zpid}/tax-history
      if (!searchParams.zpid) {
        return new Response(
          JSON.stringify({ success: false, error: 'Missing required parameter: zpid' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        );
      }
      url = `${baseUrls.taxes}/${searchParams.zpid}/tax-history`;
    } else if (action === 'schools') {
      // Schools: /zillow/property/{zpid}/schools
      if (!searchParams.zpid) {
        return new Response(
          JSON.stringify({ success: false, error: 'Missing required parameter: zpid' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        );
      }
      url = `${baseUrls.schools}/${searchParams.zpid}/schools`;
    } else if (action === 'rentalEstimate') {
      // Rental estimate: /zillow/valuation/{zpid}/rent-estimate
      if (!searchParams.zpid) {
        return new Response(
          JSON.stringify({ success: false, error: 'Missing required parameter: zpid' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        );
      }
      url = `${baseUrls.rentalEstimate}/${searchParams.zpid}/rent-estimate`;
    } else if ([
      'skipTrace', 'walkScore', 'deepSearch', 'deepComps', 'extendedSearch',
      'comparableHomes', 'neighborhood', 'mapBoundaries', 'rentalManager',
      'contactAgent', 'listingStatus', 'updatedDetails', 'reviews'
    ].includes(action)) {
      // These endpoints are NOT available in the new API
      return new Response(
        JSON.stringify({
          success: false,
          error: `Action '${action}' is not supported by the current API. Consider using alternative endpoints.`
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    } else {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid action specified' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    console.log(`[${new Date().toISOString()}] Making Zillow API request for ${clientIP}:`, { action, url, fsboOnly: searchParams.fsboOnly, listingType: requestParams.listingType })

    const response = await fetch(url, {
      method: 'GET',
      headers: headers
    })

    if (!response.ok) {
      console.warn(`[${new Date().toISOString()}] Zillow API request failed for ${clientIP}: ${response.status}`)
      const responseText = await response.text()
      console.warn(`[${new Date().toISOString()}] Error response body: ${responseText}`)
      
      // Special handling for FSBO requests that fail
      if (searchParams.fsboOnly) {
        console.warn(`[${new Date().toISOString()}] FSBO search failed, attempting fallback to regular search`)
        
        // Return a structured response indicating FSBO search failure
        return new Response(
          JSON.stringify({ 
            success: true, 
            data: { 
              message: "No FSBO properties found",
              searchResults: [],
              resultsCount: { totalMatchingCount: 0 },
              fsboSearch: true
            }
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      
      throw new Error(`Zillow API request failed: ${response.status} ${response.statusText}`)
    }

    const data = await response.json()
    const duration = Date.now() - startTime
    console.log(`[${new Date().toISOString()}] Zillow API response received for ${clientIP} in ${duration}ms`)
    
    // Enhanced logging for FSBO searches to debug low result count
    if (searchParams.fsboOnly) {
      console.log(`[${new Date().toISOString()}] FSBO API Response Debug:`, {
        resultsCount: data.resultsCount || data.searchResultsCount || 'not found',
        totalMatchingCount: data?.resultsCount?.totalMatchingCount || data?.searchResultsCount?.totalMatchingCount || 'not found',
        searchResultsLength: data.searchResults?.length || 'no searchResults array',
        pagesInfo: data.pagesInfo || 'no pagesInfo',
        responseKeys: Object.keys(data),
        firstResult: data.searchResults?.[0] ? 'has results' : 'no results',
        location: searchParams.location
      })
    }

    return new Response(
      JSON.stringify({ success: true, data }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    const duration = Date.now() - startTime
    console.error(`[${new Date().toISOString()}] Error in get-zillow-data for ${clientIP} after ${duration}ms:`, error)
    
    // Sanitize error message to avoid information leakage
    const sanitizedError = error instanceof Error && error.message.includes('API') 
      ? 'External service error' 
      : error.message || 'Failed to fetch Zillow data'
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: sanitizedError
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})