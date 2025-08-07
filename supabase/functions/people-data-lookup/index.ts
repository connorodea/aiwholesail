import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { phone, email, name, address } = await req.json();

    const rapidApiKey = Deno.env.get('RAPIDAPI_KEY');
    if (!rapidApiKey) {
      console.error('RapidAPI key not configured');
      return new Response(
        JSON.stringify({ success: false, error: 'RapidAPI key not configured' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    console.log('Performing people data lookup:', { phone: !!phone, email: !!email, name: !!name, address: !!address });

    // People Data Lookup API endpoint
    const url = `https://people-data-lookup.p.rapidapi.com/lookup`;
    const searchParams = new URLSearchParams();
    
    if (phone) searchParams.append('phone', phone);
    if (email) searchParams.append('email', email);
    if (name) searchParams.append('name', name);
    if (address) searchParams.append('address', address);

    const response = await fetch(`${url}?${searchParams}`, {
      method: 'GET',
      headers: {
        'X-RapidAPI-Key': rapidApiKey,
        'X-RapidAPI-Host': 'people-data-lookup.p.rapidapi.com',
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`People Data Lookup API request failed: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    console.log('People data lookup response received');

    // Process and structure the response
    const processedData = {
      query: { phone, email, name, address },
      results: data.results || data.data || data,
      totalFound: data.totalFound || data.count || (data.results ? data.results.length : 1),
      source: 'People Data Lookup API',
      timestamp: new Date().toISOString(),
      costPerQuery: 0.03, // Estimated cost per query
      features: [
        'Phone number lookup',
        'Email address search',
        'Name and address search',
        'Comprehensive person data',
        'Multiple data sources'
      ]
    };

    return new Response(
      JSON.stringify({ success: true, data: processedData }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in people-data-lookup function:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message || 'Failed to perform people data lookup'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});