import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface TestAlertRequest {
  userEmail: string;
  location: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { userEmail, location }: TestAlertRequest = await req.json();

    if (!userEmail || !location) {
      return new Response(
        JSON.stringify({ error: "userEmail and location are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create a sample wholesale property for testing
    const testProperty = {
      zpid: "test_123456",
      address: `123 Test Street, ${location}`,
      price: 185000,
      bedrooms: 3,
      bathrooms: 2,
      livingArea: 1450,
      propertyType: "Houses",
      zestimate: 245000,
      daysOnMarket: 45,
      // Calculate wholesale potential
      spreadAmount: 60000,
      spreadPercentage: 24.5,
      wholesaleTier: "excellent"
    };

    // Send test email using SendGrid
    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 24px;">🏠 Test Property Alert!</h1>
          <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0;">AI Wholesail Test Alert</p>
        </div>
        
        <div style="background: white; padding: 30px; border-radius: 0 0 12px 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
          <div style="background: #f8fafc; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
            <h2 style="margin-top: 0; color: #1e40af; font-size: 20px;">${testProperty.address}</h2>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-top: 15px;">
              <div>
                <p style="margin: 5px 0;"><strong>💰 List Price:</strong> $${testProperty.price.toLocaleString()}</p>
                <p style="margin: 5px 0;"><strong>🛏️ Bedrooms:</strong> ${testProperty.bedrooms}</p>
                <p style="margin: 5px 0;"><strong>📐 Sq Ft:</strong> ${testProperty.livingArea.toLocaleString()}</p>
              </div>
              <div>
                <p style="margin: 5px 0;"><strong>🚿 Bathrooms:</strong> ${testProperty.bathrooms}</p>
                <p style="margin: 5px 0;"><strong>📅 Days on Market:</strong> ${testProperty.daysOnMarket}</p>
                <p style="margin: 5px 0;"><strong>🔍 Zestimate:</strong> $${testProperty.zestimate.toLocaleString()}</p>
              </div>
            </div>
          </div>
          
          <div style="background: linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%); padding: 20px; border-radius: 8px; border-left: 4px solid #10b981; margin-bottom: 25px;">
            <h3 style="margin-top: 0; color: #065f46; font-size: 16px;">📊 Wholesale Analysis:</h3>
            <p style="margin: 5px 0; color: #065f46;"><strong>Potential Spread:</strong> $${testProperty.spreadAmount.toLocaleString()}</p>
            <p style="margin: 5px 0; color: #065f46;"><strong>Spread Percentage:</strong> ${testProperty.spreadPercentage}%</p>
            <p style="margin: 5px 0; color: #065f46;"><strong>Wholesale Tier:</strong> ${testProperty.wholesaleTier.toUpperCase()}</p>
            <p style="margin: 10px 0 0 0; color: #065f46; font-size: 14px;">
              This property shows excellent wholesale potential with a significant spread between list price and market value.
            </p>
          </div>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="https://aiwholesail.com/app" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; display: inline-block; font-weight: bold; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
              🔍 Analyze This Property
            </a>
          </div>
          
          <div style="border-top: 1px solid #e5e7eb; padding-top: 20px; margin-top: 30px;">
            <p style="margin: 0; font-size: 12px; color: #6b7280; text-align: center;">
              This is a test alert for <strong>${location}</strong> from AI Wholesail. Your property alerts are working correctly!
              <br>
              <a href="https://aiwholesail.com/app" style="color: #2563eb; text-decoration: none;">Manage your alert preferences</a>
            </p>
          </div>
        </div>
      </div>
    `;

    const { data: emailResult, error: emailError } = await supabaseClient.functions.invoke('send-sendgrid-email', {
      body: {
        to: userEmail,
        subject: `🏠 Test Alert: Wholesale Opportunity in ${location}`,
        html: emailHtml,
      }
    });

    if (emailError) {
      console.error('Error sending test email:', emailError);
      return new Response(
        JSON.stringify({ error: `Failed to send test email: ${emailError.message}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`✅ Test alert sent to ${userEmail} for location: ${location}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Test property alert sent to ${userEmail}`,
        property: testProperty
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error('Error in test property alert:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
};

serve(handler);