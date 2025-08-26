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
        profiles(email, full_name)
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
  console.log(`🔍 Checking property match for ${property.address}`);
  
  // Price filter
  if (alert.max_price && property.price > alert.max_price) {
    console.log(`❌ Price too high: ${property.price} > ${alert.max_price}`);
    return false;
  }

  // Bedroom filter
  if (alert.min_bedrooms && property.bedrooms < alert.min_bedrooms) {
    console.log(`❌ Not enough bedrooms: ${property.bedrooms} < ${alert.min_bedrooms}`);
    return false;
  }
  
  if (alert.max_bedrooms && property.bedrooms > alert.max_bedrooms) {
    console.log(`❌ Too many bedrooms: ${property.bedrooms} > ${alert.max_bedrooms}`);
    return false;
  }

  // Bathroom filter
  if (alert.min_bathrooms && property.bathrooms < alert.min_bathrooms) {
    console.log(`❌ Not enough bathrooms: ${property.bathrooms} < ${alert.min_bathrooms}`);
    return false;
  }
  
  if (alert.max_bathrooms && property.bathrooms > alert.max_bathrooms) {
    console.log(`❌ Too many bathrooms: ${property.bathrooms} > ${alert.max_bathrooms}`);
    return false;
  }

  // Square footage filter
  if (alert.min_sqft && property.livingArea < alert.min_sqft) {
    console.log(`❌ Too small: ${property.livingArea} < ${alert.min_sqft}`);
    return false;
  }
  
  if (alert.max_sqft && property.livingArea > alert.max_sqft) {
    console.log(`❌ Too large: ${property.livingArea} > ${alert.max_sqft}`);
    return false;
  }

  // Property type filter - Map API types to alert types
  if (alert.property_types && alert.property_types.length > 0) {
    const propertyType = property.propertyType || '';
    console.log(`🏠 Property type from API: ${propertyType}`);
    
    // Map Zillow API property types to alert property types
    const typeMapping: Record<string, string[]> = {
      'Houses': ['singleFamily', 'townhouse', 'house'],
      'Townhomes': ['townhouse', 'townhome'],
      'Multi-family': ['multiFamily', 'duplex', 'triplex', 'quadruplex'],
      'Condos/Co-ops': ['condo', 'condoOrTownhouse', 'cooperative']
    };
    
    let matchesType = false;
    for (const alertType of alert.property_types) {
      const apiTypes = typeMapping[alertType] || [alertType.toLowerCase()];
      if (apiTypes.some(apiType => propertyType.toLowerCase().includes(apiType.toLowerCase()))) {
        matchesType = true;
        break;
      }
    }
    
    if (!matchesType) {
      console.log(`❌ Property type doesn't match: ${propertyType} not in ${alert.property_types.join(', ')}`);
      return false;
    }
    console.log(`✅ Property type matches: ${propertyType}`);
  }

  // Must have some price and zestimate data
  if (!property.price || property.price <= 0) {
    console.log(`❌ No valid price: ${property.price}`);
    return false;
  }

  if (!property.zestimate || property.zestimate <= 0) {
    console.log(`❌ No valid zestimate: ${property.zestimate}`);
    return false;
  }

  // Calculate wholesale potential - property must be priced below estimated value
  const spreadAmount = property.zestimate - property.price;
  const spreadPercentage = (spreadAmount / property.zestimate) * 100;
  
  // Must have at least 5% spread for wholesale potential (reduced from 15% to get more matches)
  if (spreadPercentage < 5) {
    console.log(`❌ Spread too low: ${spreadPercentage.toFixed(1)}% < 5%`);
    return false;
  }

  // High-value wholesale deal detection
  const wholesaleScore = calculateWholesaleScore(property);
  console.log(`🎯 Property ${property.address} wholesale score: ${wholesaleScore}, spread: ${spreadPercentage.toFixed(1)}%`);
  
  // Reduced threshold from 40 to 25 to get more matches
  if (wholesaleScore < 25) {
    console.log(`❌ Wholesale score too low: ${wholesaleScore} < 25`);
    return false;
  }

  console.log(`✅ Property matches alert criteria with ${spreadPercentage.toFixed(1)}% spread and wholesale score: ${wholesaleScore}`);
  return true;
}

// Calculate wholesale opportunity score
function calculateWholesaleScore(property: any): number {
  let score = 0;
  console.log(`📊 Calculating score for ${property.address || 'Unknown address'}`);
  
  // Check for wholesale indicators in description/listing details
  const description = (property.description || '').toLowerCase();
  const wholesaleKeywords = [
    'motivated seller', 'must sell', 'price reduced', 'below market',
    'distressed', 'cash only', 'as is', 'investor special',
    'fixer upper', 'handyman special', 'estate sale', 'inherited',
    'divorce', 'foreclosure', 'pre-foreclosure', 'short sale',
    'fsbo', 'for sale by owner', 'owner financing', 'quick close'
  ];
  
  const keywordMatches = wholesaleKeywords.filter(keyword => 
    description.includes(keyword)
  ).length;
  score += keywordMatches * 10; // Reduced from 15 to 10 points per keyword
  console.log(`🔤 Keyword matches: ${keywordMatches}, score: +${keywordMatches * 10}`);
  
  // Days on market (longer = more motivated)
  const daysOnMarket = property.daysOnZillow || property.daysOnMarket || 0;
  if (daysOnMarket > 90) score += 20; // Reduced from 25
  else if (daysOnMarket > 60) score += 15;
  else if (daysOnMarket > 30) score += 10;
  console.log(`📅 Days on market: ${daysOnMarket}, score boost: +${daysOnMarket > 90 ? 20 : daysOnMarket > 60 ? 15 : daysOnMarket > 30 ? 10 : 0}`);
  
  // Price reductions
  if (property.priceChange && property.priceChange < 0) {
    const reductionPercent = Math.abs(property.priceChange / property.price) * 100;
    if (reductionPercent > 10) score += 25; // Reduced from 30
    else if (reductionPercent > 5) score += 15; // Reduced from 20
    else score += 8; // Reduced from 10
    console.log(`💰 Price reduction: ${reductionPercent.toFixed(1)}%, score boost: +${reductionPercent > 10 ? 25 : reductionPercent > 5 ? 15 : 8}`);
  }
  
  // FSBO properties get bonus points
  if (property.listingType && property.listingType.toLowerCase().includes('fsbo')) {
    score += 20; // Reduced from 25
    console.log(`🏠 FSBO property, score boost: +20`);
  }
  
  // Low price per sqft compared to area average
  if (property.price && property.livingArea && property.livingArea > 0) {
    const pricePerSqft = property.price / property.livingArea;
    // Bonus for properties under $150/sqft (increased threshold for more matches)
    if (pricePerSqft < 75) score += 25; // Reduced from 30
    else if (pricePerSqft < 100) score += 15; // Reduced from 20
    else if (pricePerSqft < 150) score += 10; // Increased threshold, reduced points
    console.log(`📐 Price per sqft: $${pricePerSqft.toFixed(0)}, score boost: +${pricePerSqft < 75 ? 25 : pricePerSqft < 100 ? 15 : pricePerSqft < 150 ? 10 : 0}`);
  }
  
  // Base score for any property (ensures some matches)
  score += 15;
  console.log(`⭐ Base score: +15`);
  
  const finalScore = Math.min(score, 100);
  console.log(`🎯 Final wholesale score: ${finalScore}/100`);
  return finalScore;
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
        to: alert.profiles?.email || alert.email,
        subject: `🏠 New Wholesale Opportunity in ${alert.location}`,
        html: emailHtml,
      }),
    });

    if (response.ok) {
      console.log(`✅ Email sent to ${alert.profiles?.email || alert.email} for property ${property.address}`);
      return true;
    } else {
      console.error(`❌ Failed to send email to ${alert.profiles?.email || alert.email}:`, await response.text());
      return false;
    }

  } catch (error) {
    console.error(`❌ Email error:`, error);
    return false;
  }
}

serve(handler);