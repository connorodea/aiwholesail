import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import "https://deno.land/x/xhr@0.1.0/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AnalysisRequest {
  property: any;
  userMessage?: string;
  conversationHistory?: Array<{role: string, content: string}>;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { property, userMessage, conversationHistory = [] }: AnalysisRequest = await req.json();
    
    if (!property) {
      return new Response(
        JSON.stringify({ error: "Property data is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const RAPIDAPI_KEY = Deno.env.get('RAPIDAPI_KEY');
    const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
    
    if (!RAPIDAPI_KEY || !ANTHROPIC_API_KEY) {
      throw new Error('Required API keys not configured');
    }

    // Define tools for AI to gather additional property data
    const tools = [
      {
        name: "get_detailed_property_info",
        description: "Get comprehensive property details including ownership, tax history, and detailed specifications",
        input_schema: {
          type: "object",
          properties: {
            address: { type: "string", description: "Full property address" }
          },
          required: ["address"]
        }
      },
      {
        name: "get_price_history",
        description: "Get historical price and Zestimate data to analyze price trends",
        input_schema: {
          type: "object",
          properties: {
            zpid: { type: "string", description: "Zillow property ID" },
            address: { type: "string", description: "Property address" }
          },
          required: ["address"]
        }
      },
      {
        name: "get_comparable_sales",
        description: "Get recent comparable home sales in the area for market analysis",
        input_schema: {
          type: "object",
          properties: {
            zpid: { type: "string", description: "Zillow property ID" },
            address: { type: "string", description: "Property address" }
          },
          required: ["address"]
        }
      },
      {
        name: "calculate_wholesale_metrics",
        description: "Calculate key wholesale investment metrics and deal analysis",
        input_schema: {
          type: "object",
          properties: {
            listPrice: { type: "number", description: "Current listing price" },
            zestimate: { type: "number", description: "Zillow estimate" },
            sqft: { type: "number", description: "Square footage" },
            yearBuilt: { type: "number", description: "Year built" },
            repairEstimate: { type: "number", description: "Estimated repair costs" },
            comparables: { type: "array", description: "Comparable sales data" }
          },
          required: ["listPrice"]
        }
      }
    ];

    // Build conversation context
    const messages = [
      {
        role: "system",
        content: `You are an expert real estate wholesale analyst with deep knowledge of property investment, market analysis, and deal evaluation. Your role is to analyze properties for wholesale opportunities and provide detailed, actionable insights.

ANALYSIS FRAMEWORK:
1. Market Value Assessment - Compare list price vs market value using comps and Zestimate
2. Wholesale Potential - Calculate spread, equity position, and profit margins  
3. Property Condition - Analyze photos and descriptions for repair needs
4. Market Trends - Review price history and neighborhood dynamics
5. Investment Metrics - ARV, MAO, required repairs, holding costs
6. Risk Assessment - Market conditions, days on market, price reductions

WHOLESALE CRITERIA:
- Minimum 20% spread between purchase and ARV
- Properties with motivated sellers (high DOM, price reductions)
- Below market value opportunities
- Properties needing cosmetic/light rehab
- Strong rental potential or resale market

Use the provided tools to gather comprehensive data before making your analysis. Be specific with numbers, percentages, and actionable recommendations.

Current property overview: ${JSON.stringify(property, null, 2)}`
      }
    ];

    // Add conversation history
    conversationHistory.forEach(msg => {
      messages.push({ role: msg.role, content: msg.content });
    });

    // Add current user message or default analysis request
    if (userMessage) {
      messages.push({ role: "user", content: userMessage });
    } else {
      messages.push({ 
        role: "user", 
        content: "Please provide a comprehensive wholesale analysis of this property. Use all available tools to gather detailed data and give me your expert assessment of the wholesale opportunity." 
      });
    }

    // Call Claude Sonnet 4 with tool use
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 4000,
        tools: tools,
        messages: messages
      })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Claude API error: ${error}`);
    }

    const aiResponse = await response.json();
    console.log('AI Response:', JSON.stringify(aiResponse, null, 2));

    // Handle tool calls
    if (aiResponse.content?.some((content: any) => content.type === 'tool_use')) {
      const toolResults = [];
      
      for (const content of aiResponse.content) {
        if (content.type === 'tool_use') {
          const toolResult = await executeToolCall(content.name, content.input, RAPIDAPI_KEY);
          toolResults.push({
            type: 'tool_result',
            tool_use_id: content.id,
            content: JSON.stringify(toolResult)
          });
        }
      }

      // Send tool results back to Claude for final analysis
      messages.push({ role: 'assistant', content: aiResponse.content });
      messages.push({ role: 'user', content: toolResults });

      const finalResponse = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: 'claude-3-5-sonnet-20241022',
          max_tokens: 4000,
          messages: messages
        })
      });

      const finalAiResponse = await finalResponse.json();
      return new Response(
        JSON.stringify({ 
          response: finalAiResponse.content[0]?.text || 'Analysis complete',
          usage: finalAiResponse.usage 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ 
        response: aiResponse.content[0]?.text || 'Analysis complete',
        usage: aiResponse.usage 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('AI Analysis Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
};

async function executeToolCall(toolName: string, input: any, rapidApiKey: string) {
  console.log(`Executing tool: ${toolName} with input:`, input);
  
  try {
    switch (toolName) {
      case 'get_detailed_property_info':
        return await getDetailedPropertyInfo(input.address, rapidApiKey);
      
      case 'get_price_history':
        return await getPriceHistory(input.zpid, input.address, rapidApiKey);
      
      case 'get_comparable_sales':
        return await getComparableSales(input.zpid, input.address, rapidApiKey);
      
      case 'calculate_wholesale_metrics':
        return calculateWholesaleMetrics(input);
      
      default:
        return { error: `Unknown tool: ${toolName}` };
    }
  } catch (error: any) {
    console.error(`Error in ${toolName}:`, error);
    return { error: error.message };
  }
}

async function getDetailedPropertyInfo(address: string, rapidApiKey: string) {
  const response = await fetch(`https://zillow-working-api.p.rapidapi.com/pro/byaddress?propertyaddress=${encodeURIComponent(address)}`, {
    headers: {
      'x-rapidapi-key': rapidApiKey,
      'x-rapidapi-host': 'zillow-working-api.p.rapidapi.com'
    }
  });

  if (!response.ok) {
    throw new Error(`API request failed: ${response.status}`);
  }

  return await response.json();
}

async function getPriceHistory(zpid: string, address: string, rapidApiKey: string) {
  const params = new URLSearchParams({
    recent_first: 'True',
    which: 'zestimate_history'
  });

  if (zpid) params.append('byzpid', zpid);
  if (address) params.append('byaddress', address);

  const response = await fetch(`https://zillow-working-api.p.rapidapi.com/graph_charts?${params}`, {
    headers: {
      'x-rapidapi-key': rapidApiKey,
      'x-rapidapi-host': 'zillow-working-api.p.rapidapi.com'
    }
  });

  if (!response.ok) {
    throw new Error(`API request failed: ${response.status}`);
  }

  return await response.json();
}

async function getComparableSales(zpid: string, address: string, rapidApiKey: string) {
  const params = new URLSearchParams();
  
  if (zpid) params.append('byzpid', zpid);
  if (address) params.append('byaddress', address);

  const response = await fetch(`https://zillow-working-api.p.rapidapi.com/comparable_homes?${params}`, {
    headers: {
      'x-rapidapi-key': rapidApiKey,
      'x-rapidapi-host': 'zillow-working-api.p.rapidapi.com'
    }
  });

  if (!response.ok) {
    throw new Error(`API request failed: ${response.status}`);
  }

  return await response.json();
}

function calculateWholesaleMetrics(input: any) {
  const { listPrice, zestimate, sqft, yearBuilt, repairEstimate = 0, comparables = [] } = input;
  
  if (!listPrice) return { error: 'List price required for calculations' };

  // Calculate ARV (After Repair Value) using zestimate and comparables
  let arv = zestimate || listPrice;
  if (comparables.length > 0) {
    const compPrices = comparables
      .filter((comp: any) => comp.price && comp.sqft)
      .map((comp: any) => comp.price / comp.sqft * sqft);
    
    if (compPrices.length > 0) {
      arv = Math.max(arv, compPrices.reduce((a: number, b: number) => a + b, 0) / compPrices.length);
    }
  }

  // Wholesale calculations
  const spreadAmount = arv - listPrice;
  const spreadPercentage = (spreadAmount / arv) * 100;
  const maxAllowableOffer = arv * 0.70 - repairEstimate; // 70% rule minus repairs
  const potentialProfit = maxAllowableOffer - listPrice;
  const profitMargin = (potentialProfit / listPrice) * 100;

  // Property age factor
  const currentYear = new Date().getFullYear();
  const propertyAge = yearBuilt ? currentYear - yearBuilt : 0;
  
  // Investment score (0-100)
  let investmentScore = 0;
  if (spreadPercentage > 20) investmentScore += 30;
  else if (spreadPercentage > 10) investmentScore += 15;
  
  if (profitMargin > 15) investmentScore += 25;
  else if (profitMargin > 5) investmentScore += 10;
  
  if (propertyAge < 20) investmentScore += 20;
  else if (propertyAge < 40) investmentScore += 10;
  
  if (sqft && sqft > 1200) investmentScore += 15;
  else if (sqft && sqft > 800) investmentScore += 10;

  // Risk assessment
  const riskFactors = [];
  if (spreadPercentage < 15) riskFactors.push('Low profit margin');
  if (propertyAge > 50) riskFactors.push('Older property may need major repairs');
  if (!zestimate) riskFactors.push('No Zestimate available for validation');

  return {
    listPrice,
    arv,
    spreadAmount,
    spreadPercentage: Number(spreadPercentage.toFixed(2)),
    maxAllowableOffer,
    potentialProfit,
    profitMargin: Number(profitMargin.toFixed(2)),
    repairEstimate,
    investmentScore,
    propertyAge,
    riskFactors,
    recommendation: investmentScore >= 60 ? 'Strong wholesale opportunity' : 
                   investmentScore >= 40 ? 'Moderate opportunity - analyze carefully' : 
                   'Weak opportunity - consider passing'
  };
}

serve(handler);