import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Rate limiting store
const rateLimitStore = new Map<string, number[]>();

function checkRateLimit(userId: string, maxRequests: number = 10, windowMs: number = 60000): boolean {
  const now = Date.now();
  
  if (!rateLimitStore.has(userId)) {
    rateLimitStore.set(userId, []);
  }
  
  const requests = rateLimitStore.get(userId)!;
  const recentRequests = requests.filter(time => now - time < windowMs);
  
  if (recentRequests.length >= maxRequests) {
    return false;
  }
  
  recentRequests.push(now);
  rateLimitStore.set(userId, recentRequests);
  return true;
}

function sanitizeInput(input: any): any {
  if (typeof input === 'string') {
    return input.replace(/[<>'"&]/g, '').trim().substring(0, 200);
  }
  return input;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Authentication check
    const authorization = req.headers.get('Authorization');
    if (!authorization) {
      return new Response(
        JSON.stringify({ success: false, error: 'Authorization required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      );
    }

    const requestData = await req.json();
    const address = sanitizeInput(requestData.address);
    const city = sanitizeInput(requestData.city);
    const state = sanitizeInput(requestData.state);

    const rapidApiKey = Deno.env.get('RAPIDAPI_KEY');
    if (!rapidApiKey) {
      console.error('RapidAPI key not configured');
      return new Response(
        JSON.stringify({ success: false, error: 'RapidAPI key not configured' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    console.log('Fetching enhanced property data:', { address, city, state });

    // US Real Estate API endpoint
    const url = `https://us-real-estate.p.rapidapi.com/property/search`;
    const searchParams = new URLSearchParams({
      location: `${address}, ${city}, ${state}`,
      limit: '20',
      sort: 'relevance'
    });

    const response = await fetch(`${url}?${searchParams}`, {
      method: 'GET',
      headers: {
        'X-RapidAPI-Key': rapidApiKey,
        'X-RapidAPI-Host': 'us-real-estate.p.rapidapi.com',
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`US Real Estate API request failed: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    console.log('Enhanced property data response received');

    // Process and enhance the data
    const enhancedData = {
      ...data,
      source: 'US Real Estate API',
      timestamp: new Date().toISOString(),
      costPerQuery: 0.005, // Estimated cost per query
      features: [
        'Comprehensive property data',
        'Multiple MLS sources',
        'Recent sales history',
        'Property details',
        'Market analysis'
      ]
    };

    return new Response(
      JSON.stringify({ success: true, data: enhancedData }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in enhanced-property-data function:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message || 'Failed to fetch enhanced property data'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});