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
    const { searchParams, action = 'search' } = await req.json()

    const apiKey = Deno.env.get('ZILLOW_API_KEY')
    if (!apiKey) {
      return new Response(
        JSON.stringify({ success: false, error: 'Zillow API key not configured' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      )
    }

    const baseUrl = "https://zillow-working-api.p.rapidapi.com/custom_ae/searchbyaddress"
    const headers = {
      "x-rapidapi-key": apiKey,
      "x-rapidapi-host": "zillow-working-api.p.rapidapi.com"
    }

    let url: string
    let requestParams: Record<string, string>

    if (action === 'test') {
      // Test connection
      requestParams = {
        location: "New York, NY",
        homeType: "Houses",
        page: "1"
      }
    } else {
      // Regular search
      requestParams = {
        location: searchParams.location,
        homeType: searchParams.homeType,
        sortOrder: "Homes_for_you",
        listingStatus: "For_Sale",
        maxHOA: "Any",
        listingType: "By_Agent",
        listingTypeOptions: "Agent listed,New Construction,Fore-closures,Auctions",
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
      }

      // Add optional parameters
      if (searchParams.bed_min) requestParams.bed_min = searchParams.bed_min
      if (searchParams.bed_max) requestParams.bed_max = searchParams.bed_max
      if (searchParams.bathrooms) requestParams.bathrooms = searchParams.bathrooms
      if (searchParams.price_min) requestParams.price_min = searchParams.price_min
      if (searchParams.price_max) requestParams.price_max = searchParams.price_max
      if (searchParams.mustHaveBasement) requestParams.mustHaveBasement = searchParams.mustHaveBasement
      if (searchParams.parkingSpots) requestParams.parkingSpots = searchParams.parkingSpots
      if (searchParams.page) requestParams.page = searchParams.page
    }

    url = `${baseUrl}?${new URLSearchParams(requestParams)}`

    console.log('Making Zillow API request:', { action, url: baseUrl, params: requestParams })

    const response = await fetch(url, {
      method: 'GET',
      headers: headers
    })

    if (!response.ok) {
      throw new Error(`Zillow API request failed: ${response.status} ${response.statusText}`)
    }

    const data = await response.json()
    console.log('Zillow API response received')

    return new Response(
      JSON.stringify({ success: true, data }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error in get-zillow-data function:', error)
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message || 'Failed to fetch Zillow data' 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})