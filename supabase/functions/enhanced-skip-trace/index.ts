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
    const { address, name } = await req.json();

    const rapidApiKey = Deno.env.get('RAPIDAPI_KEY');
    if (!rapidApiKey) {
      console.error('RapidAPI key not configured');
      return new Response(
        JSON.stringify({ success: false, error: 'RapidAPI key not configured' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    console.log('Performing enhanced skip trace:', { address, name });

    // Skip Tracing Working API endpoint
    const url = `https://skip-tracing-working-api.p.rapidapi.com/search`;
    const searchParams = new URLSearchParams({
      address: address,
      ...(name && { name: name }),
      format: 'detailed'
    });

    const response = await fetch(`${url}?${searchParams}`, {
      method: 'GET',
      headers: {
        'X-RapidAPI-Key': rapidApiKey,
        'X-RapidAPI-Host': 'skip-tracing-working-api.p.rapidapi.com',
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Skip Tracing API request failed: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    console.log('Enhanced skip trace response received');

    // Process and structure the skip trace data
    const processedData = {
      address: address,
      name: name,
      phones: data.phones || data.phoneNumbers || [],
      names: data.names || data.residents || [],
      emails: data.emails || data.emailAddresses || [],
      currentAddress: data.currentAddress || data.mailingAddress,
      age: data.age || data.estimatedAge,
      relatives: data.relatives || [],
      previousAddresses: data.previousAddresses || data.addressHistory || [],
      associates: data.associates || [],
      socialMedia: data.socialMedia || [],
      source: 'Skip Tracing Working API',
      timestamp: new Date().toISOString(),
      costPerQuery: 0.05, // Estimated cost per query ($0.05)
      confidence: data.confidence || 'medium',
      features: [
        'Real-time skip tracing',
        'Customizable search parameters', 
        'Contact information',
        'Address history',
        'Relative information'
      ]
    };

    return new Response(
      JSON.stringify({ success: true, data: processedData }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in enhanced-skip-trace function:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message || 'Failed to perform enhanced skip trace'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});