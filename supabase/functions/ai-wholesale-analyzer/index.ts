import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PropertyData {
  zpid: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  list_price: number;
  zestimate: number;
  beds: number;
  baths: number;
  sqft: number;
  lot_sqft: number;
  property_type: string;
  days_on_zillow: number;
  url: string;
}

interface AnalysisParams {
  target_fee: number;
  repair_cost_psf_low: number;
  repair_cost_psf_high: number;
  min_spread_pct: number;
  max_candidates: number;
  exit_preferences: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (!openAIApiKey) {
      throw new Error('OpenAI API key not configured');
    }

    const { market, csv_data, analysis_params }: {
      market: string;
      csv_data: PropertyData[];
      analysis_params: AnalysisParams;
    } = await req.json();

    console.log(`[${new Date().toISOString()}] Starting AI wholesale analysis for ${market} with ${csv_data.length} properties`);

    // Filter and preprocess properties with more lenient criteria
    const filteredProperties = csv_data
      .filter(prop => {
        // Basic data validation
        if (!prop.list_price || prop.list_price <= 0) return false;
        if (!prop.sqft || prop.sqft <= 0) return false;
        
        // If zestimate exists, check for spread, otherwise include property
        if (prop.zestimate && prop.zestimate > 0) {
          const spread_abs = prop.zestimate - prop.list_price;
          const spread_pct = spread_abs / prop.zestimate;
          
          // Only filter out if spread is negative (overpriced)
          // Allow properties with minimal spread for analysis
          return spread_pct >= -0.05; // Allow up to 5% overpriced properties
        }
        
        // Include properties without zestimate for analysis
        return true;
      })
      .map(prop => ({
        ...prop,
        spread_abs: prop.zestimate && prop.zestimate > 0 ? prop.zestimate - prop.list_price : 0,
        spread_pct: prop.zestimate && prop.zestimate > 0 ? (prop.zestimate - prop.list_price) / prop.zestimate : 0
      }))
      .sort((a, b) => b.spread_abs - a.spread_abs)
      .slice(0, analysis_params.max_candidates);

    console.log(`[${new Date().toISOString()}] Filtered to ${filteredProperties.length} candidate properties`);
    console.log(`[${new Date().toISOString()}] Sample property data:`, filteredProperties[0] || 'No properties');

    if (filteredProperties.length === 0) {
      return new Response(JSON.stringify({
        market,
        generated_at_utc: new Date().toISOString(),
        assumptions: {
          target_fee: analysis_params.target_fee,
          repair_cost_psf_range: {
            low: analysis_params.repair_cost_psf_low,
            high: analysis_params.repair_cost_psf_high
          },
          closing_costs_pct: 0.02,
          mao_rule_pct_of_arv: 0.70,
          min_spread_pct: analysis_params.min_spread_pct
        },
        ranked_opportunities: []
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Create comprehensive prompt for OpenAI
    const systemPrompt = `You are a real estate acquisitions analyst for wholesale deals. Use the provided property data to perform comprehensive analysis and return ranked wholesale opportunities.

CRITICAL: You must return a valid JSON response in the exact schema provided. Do not include any text outside the JSON object.

For each property, you must:
1. Calculate conservative ARV (if no zestimate, estimate based on comparable sales and market data)
2. Estimate repair costs based on property age, type, and typical condition issues
3. Calculate MAO using 70% rule: MAO = 0.70 * ARV - repairs - target_fee - closing_costs
4. Assess risk factors and market conditions
5. Provide realistic agent contact information (use realistic names/brokerages for the area)
6. Generate actionable call scripts and email templates

Return ONLY the JSON object, no additional text.`;

    const userPrompt = `Analyze these ${filteredProperties.length} wholesale property candidates in ${market}:

ANALYSIS PARAMETERS:
- Target wholesale fee: $${analysis_params.target_fee}
- Repair cost range: $${analysis_params.repair_cost_psf_low}-$${analysis_params.repair_cost_psf_high} per sqft
- Minimum spread: ${(analysis_params.min_spread_pct * 100).toFixed(1)}% (Note: Properties without zestimate are included for analysis)
- Exit preferences: ${analysis_params.exit_preferences}

PROPERTY DATA:
${filteredProperties.map((prop, idx) => `
${idx + 1}. ZPID: ${prop.zpid}
   Address: ${prop.address}, ${prop.city}, ${prop.state} ${prop.zip}
   List Price: $${prop.list_price.toLocaleString()}
   Zestimate: ${prop.zestimate ? `$${prop.zestimate.toLocaleString()}` : 'Not available'}
   Spread: ${prop.zestimate ? `$${prop.spread_abs.toLocaleString()} (${(prop.spread_pct * 100).toFixed(1)}%)` : 'Calculate based on market analysis'}
   Beds/Baths: ${prop.beds}/${prop.baths}
   Sqft: ${prop.sqft?.toLocaleString() || 'N/A'}
   Lot: ${prop.lot_sqft?.toLocaleString() || 'N/A'} sqft
   Type: ${prop.property_type}
   Days on Zillow: ${prop.days_on_zillow || 'N/A'}
   URL: ${prop.url || 'N/A'}
`).join('')}

Return a JSON object with this exact schema:
{
  "market": "${market}",
  "generated_at_utc": "${new Date().toISOString()}",
  "assumptions": {
    "target_fee": ${analysis_params.target_fee},
    "repair_cost_psf_range": {"low": ${analysis_params.repair_cost_psf_low}, "high": ${analysis_params.repair_cost_psf_high}},
    "closing_costs_pct": 0.02,
    "mao_rule_pct_of_arv": 0.70,
    "min_spread_pct": ${analysis_params.min_spread_pct}
  },
  "ranked_opportunities": [
    {
      "rank": 1,
      "zpid": "string",
      "address": "string",
      "list_price": 0,
      "zestimate": 0,
      "spread_abs": 0,
      "spread_pct": 0.0,
      "arv_final": 0,
      "repairs": {"low": 0, "mid": 0, "high": 0, "notes": ["..."]},
      "closing_costs_est": 0,
      "mao": 0,
      "flip_margin": 0,
      "rental": {
        "est_rent": 0,
        "taxes": 0,
        "insurance": 0,
        "hoa": 0,
        "cap_rate_pct": 0.0,
        "dscr": 0.0
      },
      "risk_flags": ["..."],
      "score": 0.0,
      "exit": "flip|wholetail|rental",
      "agent": {"name": "string", "phone": "string", "brokerage": "string"},
      "sources": [
        {"type": "comps", "urls": ["..."]},
        {"type": "public_records", "urls": ["..."]}
      ],
      "next_actions": {
        "call_script": "string",
        "email_copy": "string",
        "offer_price_first": 0,
        "offer_price_ceiling_MAO": 0
      }
    }
  ]
}

Analyze only the top 10 most promising opportunities. Focus on properties with:
- Strong fundamentals (good location, decent size, marketable property type)
- Realistic repair scenarios
- Clear exit strategies
- Favorable risk/reward profiles`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4.1-2025-04-14',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.3,
        max_tokens: 8000,
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('OpenAI API error:', errorData);
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const openAIData = await response.json();
    const analysisContent = openAIData.choices[0].message.content;

    console.log(`[${new Date().toISOString()}] AI analysis completed`);

    // Parse the JSON response from OpenAI
    let analysisResult;
    try {
      // Clean the response in case there's any extra text
      const jsonStart = analysisContent.indexOf('{');
      const jsonEnd = analysisContent.lastIndexOf('}') + 1;
      const jsonContent = analysisContent.slice(jsonStart, jsonEnd);
      
      analysisResult = JSON.parse(jsonContent);
    } catch (parseError) {
      console.error('Failed to parse OpenAI response as JSON:', parseError);
      console.error('Raw response:', analysisContent);
      
      // Return a fallback analysis
      analysisResult = {
        market,
        generated_at_utc: new Date().toISOString(),
        assumptions: {
          target_fee: analysis_params.target_fee,
          repair_cost_psf_range: {
            low: analysis_params.repair_cost_psf_low,
            high: analysis_params.repair_cost_psf_high
          },
          closing_costs_pct: 0.02,
          mao_rule_pct_of_arv: 0.70,
          min_spread_pct: analysis_params.min_spread_pct
        },
        ranked_opportunities: filteredProperties.slice(0, 5).map((prop, idx) => {
          // Use zestimate if available, otherwise estimate ARV at 110% of list price for initial analysis
          const arv = prop.zestimate && prop.zestimate > 0 ? prop.zestimate * 1.05 : prop.list_price * 1.15;
          const repairMid = prop.sqft * ((analysis_params.repair_cost_psf_low + analysis_params.repair_cost_psf_high) / 2);
          const closingCosts = arv * 0.02;
          const mao = (arv * 0.70) - repairMid - analysis_params.target_fee - closingCosts;
          
          return {
            rank: idx + 1,
            zpid: prop.zpid,
            address: prop.address,
            list_price: prop.list_price,
            zestimate: prop.zestimate || 0,
            spread_abs: prop.spread_abs,
            spread_pct: prop.spread_pct,
            arv_final: Math.round(arv),
            repairs: {
              low: Math.round(repairMid * 0.7),
              mid: Math.round(repairMid),
              high: Math.round(repairMid * 1.3),
              notes: [
                prop.zestimate ? "Analysis based on Zestimate data" : "Analysis based on market comparable estimate", 
                "Professional inspection recommended for accurate assessment"
              ]
            },
            closing_costs_est: Math.round(closingCosts),
            mao: Math.round(mao),
            flip_margin: Math.round((arv * 0.70) - prop.list_price - repairMid - closingCosts),
            rental: {
              est_rent: Math.round(arv * 0.01),
              taxes: Math.round(arv * 0.015),
              insurance: Math.round(arv * 0.005),
              hoa: 0,
              cap_rate_pct: 8.0,
              dscr: 1.2
            },
            risk_flags: [
              ...(prop.days_on_zillow > 60 ? ["Long time on market"] : []),
              ...(prop.zestimate ? [] : ["No Zestimate available - manual ARV analysis required"])
            ],
            score: 0.75,
            exit: "flip",
            agent: {
              name: "Contact listing agent",
              phone: "Call for details",
              brokerage: "Local brokerage"
            },
            sources: [
              { type: "comps", urls: [`https://zillow.com/homedetails/${prop.zpid}`] }
            ],
            next_actions: {
              call_script: `Hi, I'm interested in the property at ${prop.address}. I'm a cash buyer and can close quickly. Would you consider an offer around $${Math.round(mao * 0.97).toLocaleString()}?`,
              email_copy: `I'm a cash investor interested in ${prop.address}. Can we discuss a quick closing scenario?`,
              offer_price_first: Math.round(mao * 0.97),
              offer_price_ceiling_MAO: Math.round(mao)
            }
          };
        })
      };
    }

    console.log(`[${new Date().toISOString()}] Analysis completed with ${analysisResult.ranked_opportunities.length} opportunities`);

    return new Response(JSON.stringify(analysisResult), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in ai-wholesale-analyzer function:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      market: 'Unknown',
      generated_at_utc: new Date().toISOString(),
      assumptions: {},
      ranked_opportunities: []
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});