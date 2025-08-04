import { PropertySearchParams, Property, ZillowAPIResponse } from '@/types/zillow';

const API_KEY = "9990f8d025msh4a6e7dc2a6a79d8p1aeabejsn13949d9a34fd";
const BASE_URL = "https://zillow-working-api.p.rapidapi.com/custom_ae/searchbyaddress";

export class ZillowAPI {
  private headers = {
    "x-rapidapi-key": API_KEY,
    "x-rapidapi-host": "zillow-working-api.p.rapidapi.com"
  };

  async searchProperties(params: PropertySearchParams): Promise<Property[]> {
    try {
      const searchParams: Record<string, string> = {
        location: params.location,
        homeType: params.homeType,
        sortOrder: "Homes_for_you",
        listingStatus: "For_Sale",
        maxHOA: "Any",
        listingType: "By_Agent",
        listingTypeOptions: "Agent listed,New Construction,Fore-closures,Auctions",
        daysOnZillow: "Any",
        soldInLast: "Any",
        v_cmr: "4.5",
        v_dpr: "0.2",
        v_ptr: "0.012",
        v_ir: "0.015",
        v_mr: "0.1",
        v_pmr: "0.1",
        v_vr: "0.05",
        v_rc: "25000",
        v_ltm: "360",
        v_aa: "0.03"
      };

      // Add optional parameters if they exist
      if (params.bed_min) searchParams.bed_min = params.bed_min;
      if (params.bed_max) searchParams.bed_max = params.bed_max;
      if (params.bathrooms) searchParams.bathrooms = params.bathrooms;
      if (params.price_min) searchParams.price_min = params.price_min;
      if (params.price_max) searchParams.price_max = params.price_max;
      if (params.mustHaveBasement) searchParams.mustHaveBasement = params.mustHaveBasement;
      if (params.parkingSpots) searchParams.parkingSpots = params.parkingSpots;
      if (params.page) searchParams.page = params.page;

      console.log('Searching with params:', searchParams);

      const response = await fetch(`${BASE_URL}?${new URLSearchParams(searchParams)}`, {
        method: 'GET',
        headers: this.headers
      });

      if (!response.ok) {
        throw new Error(`API request failed: ${response.status} ${response.statusText}`);
      }

      const data: ZillowAPIResponse = await response.json();
      console.log('API Response:', data);
      return this.processPropertyData(data);
    } catch (error) {
      console.error('Error fetching properties:', error);
      throw error;
    }
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
      const testParams: Record<string, string> = {
        location: "New York, NY",
        homeType: "Houses",
        page: "1"
      };

      const response = await fetch(`${BASE_URL}?${new URLSearchParams(testParams)}`, {
        method: 'GET',
        headers: this.headers
      });

      return response.ok;
    } catch {
      return false;
    }
  }
}

export const zillowAPI = new ZillowAPI();