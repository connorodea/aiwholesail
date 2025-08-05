import { PropertySearchParams, Property, ZillowAPIResponse } from '@/types/zillow';
import { supabase } from '@/integrations/supabase/client';

export class ZillowAPI {

  async searchProperties(params: PropertySearchParams, maxPages: number = 3): Promise<Property[]> {
    try {
      console.log('Searching with params:', params, `Max pages: ${maxPages}`);
      
      let allProperties: Property[] = [];
      let currentPage = 1;
      let totalPages = 1;

      // Fetch first page to get pagination info
      const firstPageData = await this.fetchPage(params, currentPage);
      if (!firstPageData.success) {
        throw new Error(firstPageData.error || 'Failed to fetch Zillow data');
      }

      console.log('First page response:', firstPageData.data);
      
      // Get pagination info from first response
      const pagesInfo = firstPageData.data.pagesInfo;
      if (pagesInfo) {
        totalPages = Math.min(pagesInfo.totalPages || 1, maxPages);
        console.log(`Found ${pagesInfo.totalMatchingCount} total properties across ${pagesInfo.totalPages} pages. Fetching ${totalPages} pages.`);
      }

      // Process first page
      const firstPageProperties = this.processPropertyData(firstPageData.data);
      allProperties.push(...firstPageProperties);

      // Fetch remaining pages in parallel for better performance
      if (totalPages > 1) {
        const remainingPagePromises = [];
        for (let page = 2; page <= totalPages; page++) {
          remainingPagePromises.push(this.fetchPage(params, page));
        }

        const remainingPagesData = await Promise.allSettled(remainingPagePromises);
        
        for (const result of remainingPagesData) {
          if (result.status === 'fulfilled' && result.value.success) {
            const pageProperties = this.processPropertyData(result.value.data);
            allProperties.push(...pageProperties);
          } else {
            console.warn('Failed to fetch page:', result.status === 'rejected' ? result.reason : result.value.error);
          }
        }
      }

      console.log(`Total properties fetched across ${totalPages} pages: ${allProperties.length}`);
      return allProperties;
    } catch (error) {
      console.error('Error fetching properties:', error);
      throw error;
    }
  }

  private async fetchPage(params: PropertySearchParams, page: number) {
    const { data, error } = await supabase.functions.invoke('get-zillow-data', {
      body: { 
        searchParams: { ...params, page },
        action: 'search'
      }
    });

    if (error) {
      throw new Error(`Zillow API request failed: ${error.message}`);
    }

    return data;
  }

  private processPropertyData(data: ZillowAPIResponse): Property[] {
    console.log('Processing property data:', data);
    
    // Check if the response indicates no results
    if (data.message === "404: No results" || data.resultsCount?.totalMatchingCount === 0) {
      console.log('API returned no results');
      return [];
    }

    // Try different possible keys for property listings
    const potentialKeys = [
      'searchResults', 'props', 'results', 'listings', 'properties', 'data', 'homes', 
      'mapResults', 'listResults', 'items', 'records'
    ];

    let properties: any[] = [];

    for (const key of potentialKeys) {
      if (data[key] && Array.isArray(data[key])) {
        properties = data[key];
        console.log(`Found properties in key: ${key}, count: ${properties.length}`);
        break;
      } else if (data[key] && typeof data[key] === 'object') {
        // Check nested structures
        for (const nestedKey of potentialKeys) {
          if (data[key][nestedKey] && Array.isArray(data[key][nestedKey])) {
            properties = data[key][nestedKey];
            console.log(`Found properties in nested key: ${key}.${nestedKey}, count: ${properties.length}`);
            break;
          }
        }
        if (properties.length > 0) break;
      }
    }

    console.log(`Total properties found: ${properties.length}`);
    const processedProperties = properties.map(prop => this.flattenProperty(prop)).filter(prop => prop.address);
    console.log(`Properties after processing and filtering: ${processedProperties.length}`);
    
    return processedProperties;
  }

  private flattenProperty(prop: any): Property {
    const flattened: any = {};
    
    const flatten = (obj: any, prefix = '') => {
      for (const [key, value] of Object.entries(obj)) {
        const newKey = prefix ? `${prefix}_${key}` : key;
        
        if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
          flatten(value, newKey);
        } else if (Array.isArray(value)) {
          if (value.length > 0 && typeof value[0] === 'object') {
            flatten(value[0], newKey);
          } else {
            flattened[newKey] = value;
          }
        } else {
          flattened[newKey] = value;
        }
      }
    };

    flatten(prop);

    // Map common fields to standardized property structure
    const address = flattened.property_address_streetAddress || 
                   flattened.rental_metrics_streetAddress ||
                   flattened.address || 
                   'Unknown Address';
    
    const city = flattened.property_address_city || '';
    const state = flattened.property_address_state || '';
    const fullAddress = city && state ? `${address}, ${city}, ${state}` : address;

    const isFSBO = this.detectFSBO(flattened);

    return {
      id: flattened.property_zpid || flattened.id || flattened.zpid || Math.random().toString(36),
      address: fullAddress,
      price: this.parseNumber(flattened.property_price_value || flattened.property_hdpView_price || flattened.price),
      bedrooms: this.parseNumber(flattened.property_bedrooms || flattened.bedrooms),
      bathrooms: this.parseNumber(flattened.property_bathrooms || flattened.bathrooms),
      sqft: this.parseNumber(flattened.property_livingArea || flattened.sqft),
      propertyType: flattened.property_propertyType || flattened.propertyType || 'Unknown',
      yearBuilt: this.parseNumber(flattened.property_yearBuilt || flattened.yearBuilt),
      lotSize: this.parseNumber(flattened.property_lotSizeWithUnit_lotSize || flattened.lotSize),
      status: flattened.property_listing_listingStatus || flattened.property_hdpView_listingStatus || flattened.status || 'For Sale',
      daysOnMarket: this.parseNumber(flattened.property_daysOnZillow || flattened.daysOnMarket),
      pricePerSqft: this.parseNumber(flattened.property_price_pricePerSquareFoot || flattened.pricePerSqft),
      zestimate: this.parseNumber(flattened.property_estimates_zestimate || flattened.zestimate),
      images: this.extractImages(flattened),
      description: flattened.description || flattened.summary || '',
      isFSBO,
      ...flattened // Include all original data
    };
  }

  private parseNumber(value: any): number | undefined {
    if (typeof value === 'number') return value;
    if (typeof value === 'string') {
      const cleaned = value.replace(/[$,]/g, '');
      const parsed = parseFloat(cleaned);
      return isNaN(parsed) ? undefined : parsed;
    }
    return undefined;
  }

  private extractImages(data: any): string[] {
    const images: string[] = [];
    
    // Look for image arrays in common locations
    const imageKeys = ['images', 'photos', 'pictures', 'photoUrls'];
    
    for (const key of imageKeys) {
      if (data[key] && Array.isArray(data[key])) {
        data[key].forEach((img: any) => {
          if (typeof img === 'string') {
            images.push(img);
          } else if (typeof img === 'object' && img.url) {
            images.push(img.url);
          }
        });
      }
    }

    return images;
  }

  private detectFSBO(data: any): boolean {
    // Check various fields that might indicate FSBO status
    const listingType = (data.property_listing_listingType || data.listingType || '').toLowerCase();
    const agentName = (data.property_listing_agentName || data.agentName || '').toLowerCase();
    const listingAgency = (data.property_listing_listingAgency || data.listingAgency || '').toLowerCase();
    const description = (data.description || data.summary || '').toLowerCase();
    const listingSubType = (data.property_listingSubType_description || data.listingSubType || '').toLowerCase();
    
    // FSBO indicators
    const fsboIndicators = [
      'for sale by owner',
      'fsbo',
      'owner listing',
      'no agent',
      'direct from owner',
      'private sale'
    ];
    
    // Check if any field contains FSBO indicators
    const fields = [listingType, agentName, listingAgency, description, listingSubType];
    
    return fsboIndicators.some(indicator => 
      fields.some(field => field.includes(indicator))
    ) || listingType === 'fsbo' || listingSubType.includes('owner');
  }

  async testConnection(): Promise<boolean> {
    try {
      const { data, error } = await supabase.functions.invoke('get-zillow-data', {
        body: { action: 'test' }
      });

      return !error && data?.success;
    } catch {
      return false;
    }
  }

  async getPropertyDetails(zpid: string): Promise<any> {
    try {
      const { data, error } = await supabase.functions.invoke('get-zillow-data', {
        body: { action: 'propertyDetails', searchParams: { zpid } }
      });
      
      if (error) throw error;
      return data?.data;
    } catch (error) {
      console.error('Property details fetch failed:', error);
      throw error;
    }
  }

  async getPriceHistory(zpid: string): Promise<any> {
    try {
      const { data, error } = await supabase.functions.invoke('get-zillow-data', {
        body: { action: 'priceHistory', searchParams: { zpid } }
      });
      
      if (error) throw error;
      return data?.data;
    } catch (error) {
      console.error('Price history fetch failed:', error);
      throw error;
    }
  }

  async getPropertyPhotos(zpid: string): Promise<any> {
    try {
      const { data, error } = await supabase.functions.invoke('get-zillow-data', {
        body: { action: 'photos', searchParams: { zpid } }
      });
      
      if (error) throw error;
      return data?.data;
    } catch (error) {
      console.error('Property photos fetch failed:', error);
      throw error;
    }
  }

  async getPropertyComps(zpid: string): Promise<any> {
    try {
      const { data, error } = await supabase.functions.invoke('get-zillow-data', {
        body: { action: 'comps', searchParams: { zpid } }
      });
      
      if (error) throw error;
      return data?.data;
    } catch (error) {
      console.error('Property comps fetch failed:', error);
      throw error;
    }
  }

  async getZestimate(zpid: string): Promise<any> {
    try {
      const { data, error } = await supabase.functions.invoke('get-zillow-data', {
        body: { action: 'zestimate', searchParams: { zpid } }
      });
      
      if (error) throw error;
      return data?.data;
    } catch (error) {
      console.error('Zestimate fetch failed:', error);
      throw error;
    }
  }

  async getPropertySchools(zpid: string): Promise<any> {
    try {
      const { data, error } = await supabase.functions.invoke('get-zillow-data', {
        body: { action: 'schools', searchParams: { zpid } }
      });
      
      if (error) throw error;
      return data?.data;
    } catch (error) {
      console.error('Property schools fetch failed:', error);
      throw error;
    }
  }

  async getWalkScore(zpid: string): Promise<any> {
    try {
      const { data, error } = await supabase.functions.invoke('get-zillow-data', {
        body: { action: 'walkScore', searchParams: { zpid } }
      });
      
      if (error) throw error;
      return data?.data;
    } catch (error) {
      console.error('Walk score fetch failed:', error);
      throw error;
    }
  }

  async getPropertyTaxes(zpid: string): Promise<any> {
    try {
      const { data, error } = await supabase.functions.invoke('get-zillow-data', {
        body: { action: 'taxes', searchParams: { zpid } }
      });
      
      if (error) throw error;
      return data?.data;
    } catch (error) {
      console.error('Property taxes fetch failed:', error);
      throw error;
    }
  }

  async getRentalEstimate(zpid: string): Promise<any> {
    try {
      const { data, error } = await supabase.functions.invoke('get-zillow-data', {
        body: { action: 'rentalEstimate', searchParams: { zpid } }
      });
      
      if (error) throw error;
      return data?.data;
    } catch (error) {
      console.error('Rental estimate fetch failed:', error);
      throw error;
    }
  }

  async getDeepComps(zpid: string, count: string = "5"): Promise<any> {
    try {
      const { data, error } = await supabase.functions.invoke('get-zillow-data', {
        body: { action: 'deepComps', searchParams: { zpid, count } }
      });
      
      if (error) throw error;
      return data?.data;
    } catch (error) {
      console.error('Deep comps fetch failed:', error);
      throw error;
    }
  }

  async deepSearch(address: string, citystatezip: string): Promise<any> {
    try {
      const { data, error } = await supabase.functions.invoke('get-zillow-data', {
        body: { action: 'deepSearch', searchParams: { address, citystatezip } }
      });
      
      if (error) throw error;
      return data?.data;
    } catch (error) {
      console.error('Deep search failed:', error);
      throw error;
    }
  }
}

export const zillowAPI = new ZillowAPI();