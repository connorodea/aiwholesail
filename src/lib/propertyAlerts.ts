import { alerts } from "@/lib/api-client";
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
    // Process alerts through the API
    const API_URL = import.meta.env.VITE_API_URL || 'https://api.aiwholesail.com';
    const response = await fetch(`${API_URL}/api/alerts/process`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        location,
        properties: properties.map(p => ({
          ...p,
          zpid: p.zpid || p.id || ''
        }))
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Error processing property alerts:', errorData);
      return { success: false, matches: 0, emailsSent: 0, error: errorData.error || 'Failed to process alerts' };
    }

    const data = await response.json();
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
    const response = await alerts.create({
      location: criteria.location,
      maxPrice: criteria.max_price,
      minBedrooms: criteria.min_bedrooms,
      maxBedrooms: criteria.max_bedrooms,
      propertyTypes: criteria.property_types || ['Houses', 'Townhomes', 'Multi-family', 'Condos/Co-ops'],
      alertFrequency: criteria.alert_frequency || 'immediate'
    });

    if (response.error) {
      console.error('Error creating property alert:', response.error);
      return { success: false, error: response.error };
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
    const response = await alerts.list();

    if (response.error) {
      console.error('Error fetching user alerts:', response.error);
      return { success: false, alerts: [], error: response.error };
    }

    return { success: true, alerts: response.data || [] };
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
    const response = await alerts.getAllMatches();

    if (response.error) {
      console.error('Error fetching alert matches:', response.error);
      return { success: false, matches: [], error: response.error };
    }

    return { success: true, matches: response.data || [] };
  } catch (error: any) {
    console.error('Error fetching alert matches:', error);
    return { success: false, matches: [], error: error.message };
  }
}