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
    const TWILIO_ACCOUNT_SID = Deno.env.get('TWILIO_ACCOUNT_SID');
    const TWILIO_AUTH_TOKEN = Deno.env.get('TWILIO_AUTH_TOKEN');
    const TWILIO_PHONE_NUMBER = Deno.env.get('TWILIO_PHONE_NUMBER');

    if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_PHONE_NUMBER) {
      throw new Error('Twilio credentials not configured');
    }

    const { userPhone, agentPhone, propertyAddress } = await req.json();

    if (!userPhone || !agentPhone) {
      throw new Error('Both user phone and agent phone are required');
    }

    // Create Twilio basic auth
    const auth = btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`);

    // Create TwiML for the call
    const twimlMessage = `Hello, this is regarding the property listing at ${propertyAddress}. You are being connected to a potential buyer.`;
    
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
    <Response>
      <Say voice="alice">${twimlMessage}</Say>
      <Dial timeout="30" record="record-from-answer">${agentPhone}</Dial>
    </Response>`;

    // Initiate the call
    const callResponse = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Calls.json`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        From: TWILIO_PHONE_NUMBER,
        To: userPhone,
        Twiml: twiml,
      }),
    });

    if (!callResponse.ok) {
      const error = await callResponse.text();
      console.error('Twilio API error:', error);
      throw new Error('Failed to initiate call');
    }

    const callData = await callResponse.json();
    console.log('Call initiated:', callData);

    return new Response(
      JSON.stringify({
        success: true,
        callSid: callData.sid,
        status: callData.status,
        message: 'Call initiated successfully'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Error making call:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});