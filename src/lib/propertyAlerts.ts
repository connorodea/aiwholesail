import { supabase } from "@/integrations/supabase/client";
import { sendPropertyAlert } from "./emailService";

export interface PropertyAlertCriteria {
  location: string;
  max_price?: number;
  min_bedrooms?: number;
  max_bedrooms?: number;
  min_bathrooms?: number;
  max_bathrooms?: number;
  min_sqft?: number;
  max_sqft?: number;
  property_types?: string[];
}

export interface Property {
  zpid?: string;
  id?: string;
  address: string;
  price: number;
  bedrooms?: number;
  bathrooms?: number;
  livingArea?: number;
  propertyType?: string;
  [key: string]: any;
}

/**
 * Process new properties through the alert system
 * @param location Location where properties were found
 * @param properties Array of properties to check against alerts
 */
export async function processPropertyAlerts(location: string, properties: Property[]): Promise<{
  success: boolean;
  matches: number;
  emailsSent: number;
  error?: string;
}> {
  try {
    const { data, error } = await supabase.functions.invoke('process-property-alerts', {
        body: {
          location,
          properties: properties.map(p => ({
            ...p,
            zpid: p.zpid || p.id || ''
          }))
        }
    });

    if (error) {
      console.error('Error processing property alerts:', error);
      return { success: false, matches: 0, emailsSent: 0, error: error.message };
    }

    return {
      success: true,
      matches: data?.matches || 0,
      emailsSent: data?.emailsSent || 0
    };
  } catch (error: any) {
    console.error('Error calling property alerts function:', error);
    return { success: false, matches: 0, emailsSent: 0, error: error.message };
  }
}

/**
 * Create a new property alert for the current user
 * @param criteria Alert criteria
 */
export async function createPropertyAlert(criteria: PropertyAlertCriteria & {
  alert_frequency?: 'immediate' | 'daily' | 'weekly';
  user_id: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('property_alerts')
      .insert({
        user_id: criteria.user_id,
        location: criteria.location,
        max_price: criteria.max_price,
        min_bedrooms: criteria.min_bedrooms,
        max_bedrooms: criteria.max_bedrooms,
        min_bathrooms: criteria.min_bathrooms,
        max_bathrooms: criteria.max_bathrooms,
        min_sqft: criteria.min_sqft,
        max_sqft: criteria.max_sqft,
        property_types: criteria.property_types || ['Houses', 'Townhomes', 'Multi-family', 'Condos/Co-ops'],
        alert_frequency: criteria.alert_frequency || 'immediate',
        is_active: true
      });

    if (error) {
      console.error('Error creating property alert:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error: any) {
    console.error('Error creating property alert:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Send a test alert for a property to verify email functionality
 * @param userEmail User's email address
 * @param property Sample property data
 */
export async function sendTestPropertyAlert(userEmail: string, property: Property): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const result = await sendPropertyAlert(userEmail, property);
    return result;
  } catch (error: any) {
    console.error('Error sending test alert:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get user's active property alerts
 * @param userId User ID
 */
export async function getUserPropertyAlerts(userId: string) {
  try {
    const { data, error } = await supabase
      .from('property_alerts')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching user alerts:', error);
      return { success: false, alerts: [], error: error.message };
    }

    return { success: true, alerts: data || [] };
  } catch (error: any) {
    console.error('Error fetching user alerts:', error);
    return { success: false, alerts: [], error: error.message };
  }
}

/**
 * Get alert matches for a user
 * @param userId User ID
 * @param limit Number of matches to return
 */
export async function getUserAlertMatches(userId: string, limit = 50) {
  try {
    const { data, error } = await supabase
      .from('property_alert_matches')
      .select(`
        *,
        property_alerts!inner(
          location,
          user_id
        )
      `)
      .eq('property_alerts.user_id', userId)
      .order('matched_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error fetching alert matches:', error);
      return { success: false, matches: [], error: error.message };
    }

    return { success: true, matches: data || [] };
  } catch (error: any) {
    console.error('Error fetching alert matches:', error);
    return { success: false, matches: [], error: error.message };
  }
}