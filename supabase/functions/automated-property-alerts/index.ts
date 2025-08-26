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

    // Get all active property alerts with user info
    const { data: alerts, error: alertsError } = await supabase
      .from('property_alerts')
      .select(`
        *,
        profiles(email, full_name)
      `)
      .eq('is_active', true);

    if (alertsError) {
      console.error('Failed to fetch alerts:', alertsError);
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
        
        // Check if enough time has passed (default 1 hour for immediate alerts)
        const updateIntervalHours = alert.alert_frequency === 'immediate' ? 1 : 
                                   alert.alert_frequency === 'daily' ? 24 : 168; // weekly = 168 hours
        
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
          homeType: 'Houses, Townhomes, Multi-family, Condos/Co-ops', // Use standard format that maps to all property types
        };

        if (alert.max_price) searchParams.price_max = alert.max_price.toString();
        if (alert.min_bedrooms) searchParams.bed_min = alert.min_bedrooms.toString();
        if (alert.max_bedrooms) searchParams.bed_max = alert.max_bedrooms.toString();
        if (alert.min_bathrooms) searchParams.bathrooms = alert.min_bathrooms.toString();
        if (alert.min_sqft) searchParams.sqft_min = alert.min_sqft.toString();
        if (alert.max_sqft) searchParams.sqft_max = alert.max_sqft.toString();

        // Search for properties using the Zillow API with wholesale criteria
        const { data: searchResult, error: searchError } = await supabase.functions.invoke('get-zillow-data', {
          body: { 
            searchParams: {
              ...searchParams,
              wholesaleOnly: true, // Only find wholesale opportunities
              fsboOnly: false, // Don't limit to FSBO only - include all listings
              keywords: 'motivated seller, must sell, price reduced, below market, distressed, cash only, as is, investment opportunity',
              sortOrder: 'Days_On_Zillow', // Sort by days on market for motivated sellers
              page: searchParams.page || 1
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
            properties: recentProperties.map(p => {
              // Extract price from various fields
              const price = p.price || p.priceForHDP || p.unformattedPrice || p.listPrice || 0;
              // Extract zestimate or estimate it based on price
              const zestimate = p.zestimate || p.zestimateValue || p.estimatedValue || 
                              (price > 0 ? price * 1.25 : 200000); // Default to $200k if no price
              
              return {
                zpid: p.id || p.zpid || p.property_zpid || '',
                address: p.address || p.streetAddress || p.formattedChip || 'Unknown Address',
                price: price,
                zestimate: zestimate,
                bedrooms: p.bedrooms || p.beds || p.bedroomCount || 0,
                bathrooms: p.bathrooms || p.baths || p.bathroomCount || 0,
                livingArea: p.sqft || p.livingArea || p.area || p.floorSizeValue || 0,
                propertyType: p.propertyType || p.homeType || p.propertyTypeDimension || 'singleFamily',
                daysOnMarket: p.daysOnZillow || p.daysOnMarket || p.timeOnZillow || 0,
                description: p.description || p.detailUrl || '',
                priceChange: p.priceChange || p.priceReduction || 0,
                listingType: p.listingType || p.mlsid ? 'MLS' : 'FSBO',
                // Add more wholesale indicators
                isPreForeclosure: p.isPreForeclosure || false,
                isForeclosure: p.isForeclosure || false,
                isFSBO: p.isFSBO || false,
                homeStatus: p.homeStatus || 'FOR_SALE'
              };
            })
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

    // Log the execution for monitoring
    await supabase
      .from('alert_scan_logs')
      .insert({
        alerts_processed: alerts.length,
        emails_sent: totalEmailsSent,
        success: true
      });

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
    
    // Log the error for monitoring
    try {
      await supabase
        .from('alert_scan_logs')
        .insert({
          alerts_processed: 0,
          emails_sent: 0,
          success: false,
          error_message: error.message
        });
    } catch (logError) {
      console.error('Failed to log error:', logError);
    }
    
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