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
    const { property_url } = await req.json()

    if (!property_url) {
      return new Response(
        JSON.stringify({ success: false, error: 'Property URL is required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    // Get OpenAI API key from environment
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY')
    if (!openaiApiKey) {
      return new Response(
        JSON.stringify({ success: false, error: 'OpenAI API key not configured' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      )
    }

    const dealAnalysisPrompt = `You are RealEstateGPT, an expert real-estate investment analyst.  
When I give you a Zillow (or similar) property URL, you will:

1. **Property Overview**  
   - Fetch address, list price, bed/bath, sq ft, lot size, year built  
   - Note condition ("as-is" issues, demolition orders, etc.)  
   - Extract annual taxes and estimate insurance  

2. **Comparable Sales & Rebuild Value**  
   - Find 2–3 nearby "fixer-upper" comps (address, beds/baths, sq ft, sale price)  
   - Estimate land-only value ($/sq ft × lot size)  
   - Estimate rebuild cost ($100–$125 per sq ft baseline)

3. **Rental Analysis (Hold & Rehab)**  
   - Estimate market rent for that type/area  
   - Assume a conservative rent (–10–15%) to stress-test  
   - Estimate rehab costs (major structural + systems)  
   - Calculate Operating Expenses (taxes, insurance, 30–35% of rent)  
   - Compute NOI and cap rate on (purchase + rehab) basis

4. **Demolition & Subdivision Opportunity**  
   - Estimate demolition cost ($/sq ft or flat fee)  
   - Show raw-land comps for subdivided parcels  
   - Sketch a "build & sell" P&L for two spec homes (cost vs. sale price)

5. **Risks & Considerations**  
   - List permitting timelines, environmental remediation, market timing, financing rates

6. **Recommendation**  
   - Summarize whether to (a) rehab & rent, (b) demo & subdivide, or (c) flip "as-is," based on upside, capital needs, and risk

**Output**: Markdown with clear headings, bullet points, and simple financial tables or inline calculations.

Please analyze this property: ${property_url}`

    // Call OpenAI API
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are RealEstateGPT, an expert real-estate investment analyst. Provide comprehensive analysis in markdown format.'
          },
          {
            role: 'user',
            content: dealAnalysisPrompt
          }
        ],
        temperature: 0.7,
        max_tokens: 2000,
      }),
    })

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.statusText}`)
    }

    const data = await response.json()
    const analysis = data.choices[0]?.message?.content

    if (!analysis) {
      throw new Error('No analysis generated')
    }

    return new Response(
      JSON.stringify({ success: true, analysis }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error analyzing deal:', error)
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message || 'Failed to analyze deal' 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})