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
    const { to, message, from } = await req.json();

    const plivoAuthId = Deno.env.get('PLIVO_AUTH_ID');
    const plivoAuthToken = Deno.env.get('PLIVO_AUTH_TOKEN');
    
    if (!plivoAuthId || !plivoAuthToken) {
      console.error('Plivo credentials not configured');
      return new Response(
        JSON.stringify({ success: false, error: 'Plivo credentials not configured' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    console.log('Sending SMS via Plivo:', { to, from, messageLength: message.length });

    // Plivo SMS API endpoint
    const url = `https://api.plivo.com/v1/Account/${plivoAuthId}/Message/`;
    
    const requestBody = {
      src: from || Deno.env.get('PLIVO_PHONE_NUMBER'),
      dst: to,
      text: message,
      type: 'sms'
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${btoa(`${plivoAuthId}:${plivoAuthToken}`)}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Plivo SMS failed: ${errorData.error || response.statusText}`);
    }

    const data = await response.json();
    console.log('Plivo SMS sent successfully:', data.message_uuid);

    return new Response(
      JSON.stringify({ 
        success: true, 
        messageId: data.message_uuid,
        cost: 0.0045, // Plivo SMS cost per message
        savings: 0.0034, // Savings vs Twilio ($0.0079 - $0.0045)
        data: data
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in send-plivo-sms function:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message || 'Failed to send SMS via Plivo'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});