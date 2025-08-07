import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Content-Security-Policy': "default-src 'self'; script-src 'none'; object-src 'none';",
};

// Rate limiting
const rateLimitMap = new Map<string, number[]>();
const RATE_LIMIT_WINDOW = 60000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 20;

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Rate limiting
    const clientIP = req.headers.get('x-forwarded-for') || 'unknown';
    const now = Date.now();
    
    if (!rateLimitMap.has(clientIP)) {
      rateLimitMap.set(clientIP, []);
    }
    
    const timestamps = rateLimitMap.get(clientIP)!;
    const recentRequests = timestamps.filter(timestamp => now - timestamp < RATE_LIMIT_WINDOW);
    
    if (recentRequests.length >= RATE_LIMIT_MAX_REQUESTS) {
      return new Response(
        JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }, 
          status: 429 
        }
      );
    }
    
    recentRequests.push(now);
    rateLimitMap.set(clientIP, recentRequests);

    // Authorization check
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authorization header required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      );
    }

    // Parse request body with validation
    let requestData;
    try {
      requestData = await req.json();
    } catch (error) {
      console.error('Invalid JSON in request body:', error);
      return new Response(
        JSON.stringify({ error: 'Invalid request format' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }
    
    const { message, searchQuery } = requestData;
    
    // Validate message input
    if (!message || typeof message !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Valid message is required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }
    
    // Sanitize and validate message length
    if (message.length > 2000) {
      return new Response(
        JSON.stringify({ error: 'Message too long. Please limit to 2000 characters.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }
    
    // Validate searchQuery if provided
    if (searchQuery && (typeof searchQuery !== 'string' || searchQuery.length > 500)) {
      return new Response(
        JSON.stringify({ error: 'Invalid search query format' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Get OpenAI API key
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiApiKey) {
      return new Response(
        JSON.stringify({ error: 'OpenAI API key not configured' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    let contextFromSearch = '';
    
    // Perform web search if searchQuery is provided
    if (searchQuery) {
      try {
        const searchResponse = await fetch(`https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(searchQuery)}`, {
          headers: {
            'X-Subscription-Token': Deno.env.get('BRAVE_API_KEY') || '',
            'Accept': 'application/json'
          }
        });
        
        if (searchResponse.ok) {
          const searchData = await searchResponse.json();
          const topResults = searchData.web?.results?.slice(0, 3) || [];
          contextFromSearch = topResults.map((result: any) => 
            `${result.title}: ${result.description}`
          ).join('\n');
        }
      } catch (error) {
        console.log('Search failed, continuing without search results:', error);
      }
    }

    // Prepare OpenAI prompt
    const systemPrompt = `You are RealEstateGPT, an AI assistant specialized in real estate wholesale and investment analysis. You help users understand:

1. Market data and trends
2. Property analysis and valuation
3. Wholesale opportunities
4. Platform features and navigation
5. Investment strategies

You have access to current web search results when analyzing specific properties or market conditions.

Key capabilities:
- Analyze property listings and market data
- Explain wholesale strategies and techniques
- Help interpret Zestimate values, price history, and comparable sales
- Provide market insights and investment advice
- Guide users through platform features

Always provide practical, actionable advice for real estate investors and wholesalers.

${contextFromSearch ? `\nCurrent search context:\n${contextFromSearch}` : ''}`;

    // Call OpenAI API
    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: message }
        ],
        temperature: 0.7,
        max_tokens: 1000,
      }),
    });

    if (!openaiResponse.ok) {
      const errorText = await openaiResponse.text();
      console.error('OpenAI API error:', openaiResponse.status, errorText);
      
      if (openaiResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: 'AI service is temporarily unavailable due to high demand. Please try again later.' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 429 }
        );
      }
      
      throw new Error(`OpenAI API error: ${openaiResponse.status}`);
    }

    const openaiData = await openaiResponse.json();
    
    if (!openaiData.choices || !openaiData.choices[0] || !openaiData.choices[0].message) {
      throw new Error('Invalid response from AI service');
    }
    
    const assistantMessage = openaiData.choices[0].message.content;

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: assistantMessage,
        searchPerformed: !!searchQuery
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in ai-chat function:', error);
    
    // Determine appropriate error response based on error type
    let errorMessage = 'An unexpected error occurred. Please try again.';
    let statusCode = 500;
    
    if (error instanceof Error) {
      if (error.message.includes('OpenAI API error: 429')) {
        errorMessage = 'AI service is temporarily unavailable. Please try again in a few minutes.';
        statusCode = 429;
      } else if (error.message.includes('fetch')) {
        errorMessage = 'Network error occurred. Please check your connection and try again.';
        statusCode = 503;
      }
    }
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: errorMessage,
        timestamp: new Date().toISOString()
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, 
        status: statusCode
      }
    );
  }
});