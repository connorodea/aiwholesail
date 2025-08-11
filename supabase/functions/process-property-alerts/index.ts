import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface PropertyAlertRequest {
  location: string;
  properties: Array<{
    zpid: string;
    address: string;
    price: number;
    bedrooms?: number;
    bathrooms?: number;
    livingArea?: number;
    propertyType?: string;
    [key: string]: any;
  }>;
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

    const { location, properties }: PropertyAlertRequest = await req.json();

    if (!location || !properties || !Array.isArray(properties)) {
      return new Response(
        JSON.stringify({ error: "Invalid request. Location and properties array required." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Processing ${properties.length} properties for location: ${location}`);

    // Get all active alerts for this location
    const { data: alerts, error: alertsError } = await supabaseClient
      .from('property_alerts')
      .select(`
        *,
        profiles!inner(email, full_name)
      `)
      .eq('location', location)
      .eq('is_active', true);

    if (alertsError) {
      console.error('Error fetching alerts:', alertsError);
      return new Response(
        JSON.stringify({ error: "Failed to fetch alerts" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!alerts || alerts.length === 0) {
      console.log(`No active alerts found for location: ${location}`);
      return new Response(
        JSON.stringify({ message: "No active alerts for this location", processed: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let totalMatches = 0;
    let totalEmailsSent = 0;

    // Process each property against each alert
    for (const property of properties) {
      for (const alert of alerts) {
        // Check if property matches alert criteria
        const matches = checkPropertyMatch(property, alert);
        
        if (matches) {
          // Check if we've already alerted on this property for this alert
          const { data: existingMatch } = await supabaseClient
            .from('property_alert_matches')
            .select('id')
            .eq('alert_id', alert.id)
            .eq('property_id', property.zpid)
            .single();

          if (!existingMatch) {
            // Record the match
            const { error: matchError } = await supabaseClient
              .from('property_alert_matches')
              .insert({
                alert_id: alert.id,
                property_id: property.zpid,
                zpid: property.zpid,
                property_data: property,
              });

            if (matchError) {
              console.error('Error recording match:', matchError);
              continue;
            }

            totalMatches++;

            // Send email alert if frequency is immediate
            if (alert.alert_frequency === 'immediate') {
              const emailSent = await sendPropertyAlert(alert, property);
              if (emailSent) {
                totalEmailsSent++;
                
                // Update last alert sent timestamp
                await supabaseClient
                  .from('property_alerts')
                  .update({ last_alert_sent: new Date().toISOString() })
                  .eq('id', alert.id);

                // Mark email as sent in the match record
                await supabaseClient
                  .from('property_alert_matches')
                  .update({ 
                    email_sent: true, 
                    email_sent_at: new Date().toISOString() 
                  })
                  .eq('alert_id', alert.id)
                  .eq('property_id', property.zpid);
              }
            }
          }
        }
      }
    }

    console.log(`Processed ${properties.length} properties, found ${totalMatches} new matches, sent ${totalEmailsSent} emails`);

    return new Response(
      JSON.stringify({ 
        message: "Property alerts processed successfully",
        processed: properties.length,
        matches: totalMatches,
        emailsSent: totalEmailsSent
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error('Error in property alerts processing:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
};

function checkPropertyMatch(property: any, alert: any): boolean {
  // Price check
  if (alert.max_price && property.price > alert.max_price) {
    return false;
  }

  // Bedrooms check
  if (alert.min_bedrooms && property.bedrooms < alert.min_bedrooms) {
    return false;
  }
  if (alert.max_bedrooms && property.bedrooms > alert.max_bedrooms) {
    return false;
  }

  // Bathrooms check
  if (alert.min_bathrooms && property.bathrooms < alert.min_bathrooms) {
    return false;
  }
  if (alert.max_bathrooms && property.bathrooms > alert.max_bathrooms) {
    return false;
  }

  // Square footage check
  if (alert.min_sqft && property.livingArea < alert.min_sqft) {
    return false;
  }
  if (alert.max_sqft && property.livingArea > alert.max_sqft) {
    return false;
  }

  // Property type check
  if (alert.property_types && alert.property_types.length > 0) {
    if (!alert.property_types.includes(property.propertyType)) {
      return false;
    }
  }

  // Enhanced wholesale profit potential checks
  if (property.price) {
    // Check for potential wholesale indicators
    const wholesaleIndicators = [
      property.motivated_seller,
      property.fsbo,
      property.price_reduced,
      property.days_on_market > 90,
      property.is_foreclosure,
      property.is_short_sale,
      property.needs_repair || property.property_condition === 'Poor',
      property.price < (property.zestimate * 0.85) // Priced significantly below Zestimate
    ];

    // Property must have at least 2 wholesale indicators
    const validIndicators = wholesaleIndicators.filter(Boolean).length;
    if (validIndicators < 2) {
      return false;
    }

    // Calculate potential profit margin (basic estimation)
    const estimatedARV = property.zestimate || property.price * 1.15;
    const estimatedRepairCost = property.needs_repair ? property.price * 0.15 : property.price * 0.05;
    const wholesaleFee = 10000; // Standard wholesale fee
    const potentialProfit = estimatedARV - property.price - estimatedRepairCost - wholesaleFee;
    
    // Must have potential profit of at least $15,000
    if (potentialProfit < 15000) {
      return false;
    }
  }

  return true;
}

async function sendPropertyAlert(alert: any, property: any): Promise<boolean> {
  try {
    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 24px;">🏠 New Wholesale Opportunity!</h1>
          <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0;">AI Wholesail Property Alert</p>
        </div>
        
        <div style="background: white; padding: 30px; border-radius: 0 0 12px 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
          <div style="background: #f8fafc; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
            <h2 style="margin-top: 0; color: #1e40af; font-size: 20px;">${property.address}</h2>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-top: 15px;">
              <div>
                <p style="margin: 5px 0;"><strong>💰 Price:</strong> $${property.price?.toLocaleString() || 'Contact for price'}</p>
                <p style="margin: 5px 0;"><strong>🛏️ Bedrooms:</strong> ${property.bedrooms || 'N/A'}</p>
              </div>
              <div>
                <p style="margin: 5px 0;"><strong>🚿 Bathrooms:</strong> ${property.bathrooms || 'N/A'}</p>
                <p style="margin: 5px 0;"><strong>📐 Sq Ft:</strong> ${property.livingArea?.toLocaleString() || 'N/A'}</p>
              </div>
            </div>
          </div>
          
          <div style="background: #ecfdf5; padding: 20px; border-radius: 8px; border-left: 4px solid #10b981; margin-bottom: 25px;">
            <h3 style="margin-top: 0; color: #065f46; font-size: 16px;">📊 Wholesale Profit Analysis:</h3>
            <div style="margin: 0; color: #065f46;">
              <p style="margin: 5px 0;"><strong>Estimated ARV:</strong> $${((property.zestimate || property.price * 1.15)).toLocaleString()}</p>
              <p style="margin: 5px 0;"><strong>Purchase Price:</strong> $${property.price?.toLocaleString()}</p>
              <p style="margin: 5px 0;"><strong>Estimated Profit:</strong> $${Math.max(0, ((property.zestimate || property.price * 1.15) - property.price - (property.needs_repair ? property.price * 0.15 : property.price * 0.05) - 10000)).toLocaleString()}</p>
              <p style="margin: 5px 0; font-weight: bold;">This property meets your wholesale criteria for <strong>${alert.location}</strong></p>
            </div>
          </div>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="https://aiwholesail.com" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; display: inline-block; font-weight: bold; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
              🔍 Analyze This Property
            </a>
          </div>
          
          <div style="border-top: 1px solid #e5e7eb; padding-top: 20px; margin-top: 30px;">
            <p style="margin: 0; font-size: 12px; color: #6b7280; text-align: center;">
              You're receiving this because you have property alerts enabled for <strong>${alert.location}</strong> in AI Wholesail.
              <br>
              <a href="https://aiwholesail.com/alerts" style="color: #2563eb; text-decoration: none;">Manage your alert preferences</a>
            </p>
          </div>
        </div>
      </div>
    `;

    // Call the SendGrid email function
    const response = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/send-sendgrid-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
      },
      body: JSON.stringify({
        to: alert.profiles.email,
        subject: `🏠 New Wholesale Opportunity in ${alert.location}`,
        html: emailHtml,
      }),
    });

    if (response.ok) {
      console.log(`✅ Email sent to ${alert.profiles.email} for property ${property.address}`);
      return true;
    } else {
      console.error(`❌ Failed to send email to ${alert.profiles.email}:`, await response.text());
      return false;
    }

  } catch (error) {
    console.error(`❌ Email error:`, error);
    return false;
  }
}

serve(handler);