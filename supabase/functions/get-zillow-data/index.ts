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

    const baseUrls: Record<string, string> = {
      search: "https://zillow-working-api.p.rapidapi.com/custom_ae/searchbyaddress",
      propertyDetails: "https://zillow-working-api.p.rapidapi.com/property",
      priceHistory: "https://zillow-working-api.p.rapidapi.com/propertyPriceHistory",
      photos: "https://zillow-working-api.p.rapidapi.com/propertyImages",
      comps: "https://zillow-working-api.p.rapidapi.com/propertyComps",
      zestimate: "https://zillow-working-api.p.rapidapi.com/propertyZestimate",
      extendedSearch: "https://zillow-working-api.p.rapidapi.com/propertyExtendedSearch",
      reviews: "https://zillow-working-api.p.rapidapi.com/propertyReviews",
      taxes: "https://zillow-working-api.p.rapidapi.com/propertyTaxes",
      walkScore: "https://zillow-working-api.p.rapidapi.com/propertyWalkScore",
      schools: "https://zillow-working-api.p.rapidapi.com/propertySchools",
      neighborhood: "https://zillow-working-api.p.rapidapi.com/propertyNeighborhood",
      mapBoundaries: "https://zillow-working-api.p.rapidapi.com/propertyMapBoundaries",
      rentalManager: "https://zillow-working-api.p.rapidapi.com/propertyRentalManager",
      contactAgent: "https://zillow-working-api.p.rapidapi.com/propertyContactAgent",
      deepSearch: "https://zillow-working-api.p.rapidapi.com/propertyDeepSearch",
      deepComps: "https://zillow-working-api.p.rapidapi.com/propertyDeepComps",
      updatedDetails: "https://zillow-working-api.p.rapidapi.com/propertyUpdatedDetails",
      listingStatus: "https://zillow-working-api.p.rapidapi.com/propertyListingStatus",
      rentalEstimate: "https://zillow-working-api.p.rapidapi.com/propertyRentalEstimate",
      skipTrace: "https://zillow-working-api.p.rapidapi.com/skip/byaddress",
      comparableHomes: "https://zillow-working-api.p.rapidapi.com/comparable_homes"
    };

    let headers: Record<string, string> = {
      "x-rapidapi-key": apiKey,
      "x-rapidapi-host": "zillow-working-api.p.rapidapi.com"
    };

    // All endpoints use the same host now
    headers["x-rapidapi-host"] = "zillow-working-api.p.rapidapi.com";

    let url: string;
    let requestParams: Record<string, string> = {};

    if (action === 'test') {
      requestParams = {
        location: "New York, NY",
        homeType: "Houses",
        page: "1"
      };
      url = `${baseUrls.search}?${new URLSearchParams(requestParams)}`;
    } else if (action === 'search') {
      // Existing search logic
      let listingTypeOptions = "Agent listed,New Construction,Fore-closures,Auctions";
      let listingType = "By_Agent";
      
      // If FSBO only is enabled, change listing type to show only FSBO properties
      if (searchParams.fsboOnly) {
        listingType = "FSBO";
        listingTypeOptions = "FSBO";
      } else {
        // If wholesale opportunities only is enabled, exclude foreclosures
        if (searchParams.wholesaleOnly) {
          listingTypeOptions = "Agent listed,New Construction,Auctions";
        }
        
        // If hide foreclosures is enabled, exclude foreclosures
        if (searchParams.hideForeclosures) {
          listingTypeOptions = listingTypeOptions.replace(",Fore-closures", "").replace("Fore-closures,", "").replace("Fore-closures", "");
        }
      }
      
      requestParams = {
        location: searchParams.location,
        homeType: searchParams.homeType,
        sortOrder: "Homes_for_you",
        listingStatus: "For_Sale",
        maxHOA: "Any",
        listingType: listingType,
        listingTypeOptions: listingTypeOptions,
        daysOnZillow: "Any",
        soldInLast: "Any",
        v_cmr: "4.5",
        v_dpr: "0.2",
        v_ptr: "0.012",
        v_ir: "0.015",
        v_mr: "0.1",
        v_pmr: "0.1",
        v_vr: "0.05",
        v_rc: "25000",
        v_ltm: "360",
        v_aa: "0.03"
      };
      if (searchParams.bed_min) requestParams.bed_min = searchParams.bed_min;
      if (searchParams.bed_max) requestParams.bed_max = searchParams.bed_max;
      if (searchParams.bathrooms) requestParams.bathrooms = searchParams.bathrooms;
      if (searchParams.price_min) requestParams.price_min = searchParams.price_min;
      if (searchParams.price_max) requestParams.price_max = searchParams.price_max;
      if (searchParams.mustHaveBasement) requestParams.mustHaveBasement = searchParams.mustHaveBasement;
      if (searchParams.parkingSpots) requestParams.parkingSpots = searchParams.parkingSpots;
      if (searchParams.page) requestParams.page = searchParams.page;
      url = `${baseUrls.search}?${new URLSearchParams(requestParams)}`;
    } else if ([
      'propertyDetails', 'priceHistory', 'photos', 'comps', 'zestimate',
      'reviews', 'taxes', 'walkScore', 'schools', 'neighborhood', 'mapBoundaries',
      'rentalManager', 'contactAgent', 'listingStatus', 'rentalEstimate', 'updatedDetails'
    ].includes(action)) {
      // These actions require a zpid
      if (!searchParams.zpid) {
        return new Response(
          JSON.stringify({ success: false, error: 'Missing required parameter: zpid' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        );
      }
      requestParams = { zpid: searchParams.zpid };
      url = `${baseUrls[action]}?${new URLSearchParams(requestParams)}`;
    } else if ([
      'deepSearch'
    ].includes(action)) {
      // deepSearch requires address, citystatezip
      if (!searchParams.address || !searchParams.citystatezip) {
        return new Response(
          JSON.stringify({ success: false, error: 'Missing required parameters: address, citystatezip' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        );
      }
      requestParams = { address: searchParams.address, citystatezip: searchParams.citystatezip };
      url = `${baseUrls[action]}?${new URLSearchParams(requestParams)}`;
    } else if ([
      'extendedSearch'
    ].includes(action)) {
      // extendedSearch can take a variety of parameters
      requestParams = { ...searchParams };
      url = `${baseUrls[action]}?${new URLSearchParams(requestParams)}`;
    } else if ([
      'deepComps'
    ].includes(action)) {
      // deepComps requires zpid and count
      if (!searchParams.zpid || !searchParams.count) {
        return new Response(
          JSON.stringify({ success: false, error: 'Missing required parameters: zpid, count' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        );
      }
      requestParams = { zpid: searchParams.zpid, count: searchParams.count };
      url = `${baseUrls[action]}?${new URLSearchParams(requestParams)}`;
    } else if ([
      'skipTrace'
    ].includes(action)) {
      // skipTrace requires street and citystatezip
      if (!searchParams.street || !searchParams.citystatezip) {
        return new Response(
          JSON.stringify({ success: false, error: 'Missing required parameters: street, citystatezip' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        );
      }
      requestParams = { 
        street: searchParams.street, 
        citystatezip: searchParams.citystatezip,
        page: searchParams.page || '1'
      };
      url = `${baseUrls[action]}?${new URLSearchParams(requestParams)}`;
    } else if ([
      'comparableHomes'
    ].includes(action)) {
      // comparableHomes can take various property identifiers
      if (!searchParams.byzpid && !searchParams.byurl && !searchParams.byaddress && !searchParams.bylotid) {
        return new Response(
          JSON.stringify({ success: false, error: 'At least one property identifier required: byzpid, byurl, byaddress, or bylotid' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        );
      }
      
      requestParams = {};
      if (searchParams.byzpid) requestParams.byzpid = searchParams.byzpid;
      if (searchParams.byurl) requestParams.byurl = searchParams.byurl;
      if (searchParams.byaddress) requestParams.byaddress = searchParams.byaddress;
      if (searchParams.bylotid) requestParams.bylotid = searchParams.bylotid;
      
      url = `${baseUrls.comparableHomes}?${new URLSearchParams(requestParams)}`;
    } else {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid action specified' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    console.log(`[${new Date().toISOString()}] Making Zillow API request for ${clientIP}:`, { action, url })

    const response = await fetch(url, {
      method: 'GET',
      headers: headers
    })

    if (!response.ok) {
      console.warn(`[${new Date().toISOString()}] Zillow API request failed for ${clientIP}: ${response.status}`)
      throw new Error(`Zillow API request failed: ${response.status} ${response.statusText}`)
    }

    const data = await response.json()
    const duration = Date.now() - startTime
    console.log(`[${new Date().toISOString()}] Zillow API response received for ${clientIP} in ${duration}ms`)

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