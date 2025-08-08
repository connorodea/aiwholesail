import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PropertySearchParams {
  location: string;
  status_type?: string;
  home_type?: string;
  minPrice?: string;
  maxPrice?: string;
  bedrooms?: string;
  bathrooms?: string;
  sqft_min?: string;
  sqft_max?: string;
  lot_min?: string;
  lot_max?: string;
  built_year_min?: string;
  built_year_max?: string;
  page?: number;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  try {
    console.log('🔄 Starting automated property alert search...');

    // Get all active property alerts with subscription info
    const { data: alerts, error: alertsError } = await supabase
      .from('property_alerts')
      .select(`
        *,
        profiles!inner(email, full_name),
        subscribers!inner(subscribed, subscription_tier, subscription_end)
      `)
      .eq('is_active', true)
      .eq('subscribers.subscribed', true);

    if (alertsError) {
      throw new Error(`Failed to fetch alerts: ${alertsError.message}`);
    }

    if (!alerts || alerts.length === 0) {
      console.log('📭 No active alerts found');
      return new Response(JSON.stringify({ 
        success: true, 
        message: 'No active alerts found',
        alertsProcessed: 0,
        emailsSent: 0
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    console.log(`📢 Found ${alerts.length} active alerts to process`);

    let totalMatches = 0;
    let totalEmailsSent = 0;

    // Process each alert
    for (const alert of alerts) {
      try {
        console.log(`🔍 Processing alert for location: ${alert.location}`);
        
        // Check if enough time has passed based on subscription tier
        const subscriptionTier = alert.subscribers.subscription_tier;
        const updateIntervalHours = subscriptionTier === 'Premium' ? 4 : 24;
        
        if (alert.last_alert_sent) {
          const lastSent = new Date(alert.last_alert_sent);
          const hoursAgo = (Date.now() - lastSent.getTime()) / (1000 * 60 * 60);
          if (hoursAgo < updateIntervalHours) {
            console.log(`⏰ Skipping alert ${alert.id} - last sent ${hoursAgo.toFixed(1)} hours ago, need ${updateIntervalHours} hours`);
            continue;
          }
        }

        // Build search parameters from alert criteria
        const searchParams: PropertySearchParams = {
          location: alert.location,
          status_type: 'ForSale',
          home_type: alert.property_types?.join(',') || 'Houses,Townhomes,Multi-family,Condos',
        };

        if (alert.max_price) searchParams.maxPrice = alert.max_price.toString();
        if (alert.min_bedrooms) searchParams.bedrooms = alert.min_bedrooms.toString();
        if (alert.min_bathrooms) searchParams.bathrooms = alert.min_bathrooms.toString();
        if (alert.min_sqft) searchParams.sqft_min = alert.min_sqft.toString();
        if (alert.max_sqft) searchParams.sqft_max = alert.max_sqft.toString();

        // Search for properties using the Zillow API with wholesale criteria
        const { data: searchResult, error: searchError } = await supabase.functions.invoke('get-zillow-data', {
          body: { 
            searchParams: {
              ...searchParams,
              wholesaleOnly: true, // Only find wholesale opportunities
              fsboOnly: false,
              keywords: ''
            },
            action: 'search'
          }
        });

        if (searchError) {
          console.error(`❌ Error searching properties for alert ${alert.id}:`, searchError);
          continue;
        }

        if (!searchResult?.success || !searchResult?.data) {
          console.log(`📭 No properties found for alert ${alert.id}`);
          continue;
        }

        // Extract properties from the search result
        const properties = extractPropertiesFromResponse(searchResult.data);
        
        if (properties.length === 0) {
          console.log(`📭 No valid properties extracted for alert ${alert.id}`);
          continue;
        }

        console.log(`🏠 Found ${properties.length} properties for alert ${alert.id}`);

        // Filter properties by listing date (only recent ones - last 4 hours)
        const fourHoursAgo = new Date();
        fourHoursAgo.setHours(fourHoursAgo.getHours() - 4);
        
        const recentProperties = properties.filter(property => {
          // Check if property has a recent listing date
          const listingDate = getPropertyListingDate(property);
          if (!listingDate) return true; // Include if no date available
          
          return new Date(listingDate) >= fourHoursAgo;
        });

        console.log(`📅 ${recentProperties.length} properties are recent (last 4 hours)`);

        if (recentProperties.length === 0) {
          continue;
        }

        // Process properties through the alert matching system
        const { data: processResult, error: processError } = await supabase.functions.invoke('process-property-alerts', {
          body: {
            location: alert.location,
            properties: recentProperties.map(p => ({
              zpid: p.id || p.zpid || '',
              address: p.address || 'Unknown Address',
              price: p.price || 0,
              bedrooms: p.bedrooms,
              bathrooms: p.bathrooms,
              livingArea: p.sqft || p.livingArea,
              propertyType: p.propertyType || 'Unknown'
            }))
          }
        });

        if (processError) {
          console.error(`❌ Error processing properties for alert ${alert.id}:`, processError);
          continue;
        }

        if (processResult) {
          totalMatches += processResult.matches || 0;
          totalEmailsSent += processResult.emailsSent || 0;
          console.log(`✅ Alert ${alert.id}: ${processResult.matches} matches, ${processResult.emailsSent} emails sent`);
        }

        // Update last alert sent timestamp
        await supabase
          .from('property_alerts')
          .update({ last_alert_sent: new Date().toISOString() })
          .eq('id', alert.id);

      } catch (error) {
        console.error(`❌ Error processing alert ${alert.id}:`, error);
        continue;
      }
    }

    console.log(`🎉 Automated search complete. Total matches: ${totalMatches}, Emails sent: ${totalEmailsSent}`);

    return new Response(JSON.stringify({
      success: true,
      alertsProcessed: alerts.length,
      totalMatches,
      emailsSent: totalEmailsSent,
      message: `Processed ${alerts.length} alerts, found ${totalMatches} matches, sent ${totalEmailsSent} emails`
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });

  } catch (error: any) {
    console.error('❌ Automated property alerts error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
};

// Helper function to extract properties from various response formats
function extractPropertiesFromResponse(data: any): any[] {
  const potentialKeys = [
    'searchResults', 'props', 'results', 'listings', 'properties', 'data', 'homes', 
    'mapResults', 'listResults', 'items', 'records'
  ];

  for (const key of potentialKeys) {
    if (data[key] && Array.isArray(data[key])) {
      return data[key];
    } else if (data[key] && typeof data[key] === 'object') {
      // Check nested structures
      for (const nestedKey of potentialKeys) {
        if (data[key][nestedKey] && Array.isArray(data[key][nestedKey])) {
          return data[key][nestedKey];
        }
      }
    }
  }

  return [];
}

// Helper function to extract listing date from property
function getPropertyListingDate(property: any): string | null {
  const dateFields = [
    'datePostedString', 'listDate', 'datePosted', 'listingDate',
    'property_datePriceChanged', 'property_listing_listingDate',
    'property_listing_datePosted', 'property_datePosted'
  ];

  for (const field of dateFields) {
    if (property[field]) {
      return property[field];
    }
  }

  return null;
}

serve(handler);