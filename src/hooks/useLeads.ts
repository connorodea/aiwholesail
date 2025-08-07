import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Property } from '@/types/zillow';
import { toast } from 'sonner';

export function useLeads() {
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();

  const exportLead = async (property: Property, notes?: string) => {
    if (!user) {
      toast.error('Please sign in to export leads');
      return false;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from('leads')
        .insert({
          user_id: user.id,
          property_id: property.id,
          property_data: property,
          notes: notes || '',
          status: 'new'
        });

      if (error) throw error;

      // Generate CSV content
      const csvContent = generateLeadCSV(property, notes);
      
      // Download CSV file
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `lead_${property.address.replace(/[^a-z0-9]/gi, '_')}_${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast.success('Lead exported successfully');
      return true;
    } catch (error) {
      console.error('Error exporting lead:', error);
      toast.error('Failed to export lead');
      return false;
    } finally {
      setLoading(false);
    }
  };

  const generateLeadCSV = (property: Property, notes?: string) => {
    const headers = [
      'Property Address',
      'Price',
      'Bedrooms',
      'Bathrooms',
      'Square Feet',
      'Property Type',
      'Year Built',
      'Days on Market',
      'Zestimate',
      'Price per Sq Ft',
      'Status',
      'FSBO',
      'Listing Agent',
      'Agent Phone',
      'Brokerage',
      'MLS ID',
      'Notes',
      'Export Date'
    ];

    const agentName = property.property_propertyDisplayRules_agent_agentName || 
                    property.property_listing_agentName || 'N/A';
    const agentPhone = property.property_listing_agentPhone || 
                     property.property_contact_phone || 
                     property.agent_phone || 'N/A';
    const brokerage = property.property_propertyDisplayRules_mls_brokerName || 
                     property.property_listing_brokerage || 'N/A';
    const mlsId = property.property_listing_palsId || 'N/A';

    const row = [
      `"${property.address}"`,
      property.price || 'N/A',
      property.bedrooms || 'N/A',
      property.bathrooms || 'N/A',
      property.sqft || 'N/A',
      property.propertyType || 'N/A',
      property.yearBuilt || 'N/A',
      property.daysOnMarket || 'N/A',
      property.zestimate || 'N/A',
      property.pricePerSqft || 'N/A',
      property.status || 'N/A',
      property.isFSBO ? 'Yes' : 'No',
      `"${agentName}"`,
      `"${agentPhone}"`,
      `"${brokerage}"`,
      `"${mlsId}"`,
      `"${notes || ''}"`,
      new Date().toISOString().split('T')[0]
    ];

    return [headers.join(','), row.join(',')].join('\n');
  };

  const exportAllLeads = async (properties: Property[], searchLocation?: string) => {
    if (!user) {
      toast.error('Please sign in to export leads');
      return false;
    }

    if (properties.length === 0) {
      toast.error('No properties to export');
      return false;
    }

    setLoading(true);
    try {
      // Save all leads to database
      const leadsData = properties.map(property => ({
        user_id: user.id,
        property_id: property.id,
        property_data: property,
        notes: '',
        status: 'new'
      }));

      const { error } = await supabase
        .from('leads')
        .insert(leadsData);

      if (error) throw error;

      // Generate CSV content for all properties
      const csvContent = generateAllLeadsCSV(properties);
      
      // Download CSV file
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      const filename = `leads_${searchLocation?.replace(/[^a-z0-9]/gi, '_') || 'search'}_${new Date().toISOString().split('T')[0]}.csv`;
      link.setAttribute('download', filename);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast.success(`Successfully exported ${properties.length} leads`);
      return true;
    } catch (error) {
      console.error('Error exporting leads:', error);
      toast.error('Failed to export leads');
      return false;
    } finally {
      setLoading(false);
    }
  };

  const generateAllLeadsCSV = (properties: Property[]) => {
    const headers = [
      'Property Address',
      'Price',
      'Bedrooms',
      'Bathrooms',
      'Square Feet',
      'Property Type',
      'Year Built',
      'Days on Market',
      'Zestimate',
      'Price per Sq Ft',
      'Status',
      'FSBO',
      'Listing Agent',
      'Agent Phone',
      'Brokerage',
      'MLS ID',
      'Export Date'
    ];

    const rows = properties.map(property => {
      const agentName = property.property_propertyDisplayRules_agent_agentName || 
                      property.property_listing_agentName || 'N/A';
      const agentPhone = property.property_listing_agentPhone || 
                       property.property_contact_phone || 
                       property.agent_phone || 'N/A';
      const brokerage = property.property_propertyDisplayRules_mls_brokerName || 
                       property.property_listing_brokerage || 'N/A';
      const mlsId = property.property_listing_palsId || 'N/A';

      return [
        `"${property.address}"`,
        property.price || 'N/A',
        property.bedrooms || 'N/A',
        property.bathrooms || 'N/A',
        property.sqft || 'N/A',
        property.propertyType || 'N/A',
        property.yearBuilt || 'N/A',
        property.daysOnMarket || 'N/A',
        property.zestimate || 'N/A',
        property.pricePerSqft || 'N/A',
        property.status || 'N/A',
        property.isFSBO ? 'Yes' : 'No',
        `"${agentName}"`,
        `"${agentPhone}"`,
        `"${brokerage}"`,
        `"${mlsId}"`,
        new Date().toISOString().split('T')[0]
      ].join(',');
    });

    return [headers.join(','), ...rows].join('\n');
  };

  return {
    exportLead,
    exportAllLeads,
    loading
  };
}