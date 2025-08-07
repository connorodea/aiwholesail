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
    const { addresses } = await req.json();

    const rapidApiKey = Deno.env.get('RAPIDAPI_KEY');
    if (!rapidApiKey) {
      console.error('RapidAPI key not configured');
      return new Response(
        JSON.stringify({ success: false, error: 'RapidAPI key not configured' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    console.log(`Processing batch skip trace for ${addresses.length} addresses`);

    // Process addresses in batches to avoid rate limits
    const BATCH_SIZE = 5;
    const results = [];
    
    for (let i = 0; i < addresses.length; i += BATCH_SIZE) {
      const batch = addresses.slice(i, i + BATCH_SIZE);
      
      const batchPromises = batch.map(async (address: string) => {
        try {
          const url = `https://skip-tracing-working-api.p.rapidapi.com/search`;
          const searchParams = new URLSearchParams({
            address: address,
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
            throw new Error(`API request failed for ${address}: ${response.status}`);
          }

          const data = await response.json();
          
          return {
            success: true,
            data: {
              address: address,
              phones: data.phones || data.phoneNumbers || [],
              names: data.names || data.residents || [],
              emails: data.emails || data.emailAddresses || [],
              currentAddress: data.currentAddress || data.mailingAddress,
              age: data.age || data.estimatedAge,
              relatives: data.relatives || [],
              previousAddresses: data.previousAddresses || data.addressHistory || [],
              associates: data.associates || [],
              source: 'Skip Tracing Working API (Batch)',
              timestamp: new Date().toISOString(),
              costPerQuery: 0.05
            }
          };
        } catch (error) {
          console.error(`Batch skip trace failed for ${address}:`, error);
          return {
            success: false,
            error: error.message,
            address: address
          };
        }
      });

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
      
      // Add delay between batches to respect rate limits
      if (i + BATCH_SIZE < addresses.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    const successCount = results.filter(r => r.success).length;
    const totalCost = results.length * 0.05; // $0.05 per query
    const totalSavings = results.length * 0.10; // Estimated savings vs premium providers

    console.log(`Batch skip trace completed: ${successCount}/${addresses.length} successful, Cost: $${totalCost.toFixed(2)}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        results: results,
        summary: {
          total: addresses.length,
          successful: successCount,
          failed: addresses.length - successCount,
          totalCost: totalCost,
          estimatedSavings: totalSavings,
          avgCostPerQuery: 0.05
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in batch-skip-trace function:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message || 'Failed to process batch skip trace'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});