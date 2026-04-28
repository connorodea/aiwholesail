import { PropertySearchParams, Property, ZillowAPIResponse } from '@/types/zillow';
import { supabase } from '@/integrations/supabase/client';

// Supabase Edge Function for Zillow data
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://ztgsevhzbeywytoqlsbf.supabase.co';
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || '';

// Fallback to Hetzner API if Supabase is not configured
const ZILLOW_API_URL = import.meta.env.VITE_ZILLOW_API_URL || 'https://api.aiwholesail.com/zillow/zillow';
const ZILLOW_API_KEY = import.meta.env.VITE_ZILLOW_API_KEY || '';

const USE_SUPABASE = !!SUPABASE_URL && !!SUPABASE_KEY;

export class ZillowAPI {

  async searchProperties(params: PropertySearchParams, maxPages: number = 3): Promise<Property[]> {
    try {
      console.log('Searching with params:', params, `Max pages: ${maxPages}`);
      console.log('FSBO toggle status:', params.fsboOnly);
      
      if (params.fsboOnly) {
        console.log('FSBO search requested - using API filtering');
        const results = await this.performSearch(params, maxPages);
        console.log(`FSBO API results: ${results.length} properties found`);
        return results;
      } else {
        // Regular search for non-FSBO requests
        return await this.performSearch(params, maxPages);
      }
    } catch (error) {
      console.error('Error fetching properties:', error);
      throw error;
    }
  }

  private normalizeLocation(location: string): string {
    const stateMap: Record<string, string> = {
      'alabama': 'AL', 'alaska': 'AK', 'arizona': 'AZ', 'arkansas': 'AR',
      'california': 'CA', 'colorado': 'CO', 'connecticut': 'CT', 'delaware': 'DE',
      'florida': 'FL', 'georgia': 'GA', 'hawaii': 'HI', 'idaho': 'ID',
      'illinois': 'IL', 'indiana': 'IN', 'iowa': 'IA', 'kansas': 'KS',
      'kentucky': 'KY', 'louisiana': 'LA', 'maine': 'ME', 'maryland': 'MD',
      'massachusetts': 'MA', 'michigan': 'MI', 'minnesota': 'MN', 'mississippi': 'MS',
      'missouri': 'MO', 'montana': 'MT', 'nebraska': 'NE', 'nevada': 'NV',
      'new hampshire': 'NH', 'new jersey': 'NJ', 'new mexico': 'NM', 'new york': 'NY',
      'north carolina': 'NC', 'north dakota': 'ND', 'ohio': 'OH', 'oklahoma': 'OK',
      'oregon': 'OR', 'pennsylvania': 'PA', 'rhode island': 'RI', 'south carolina': 'SC',
      'south dakota': 'SD', 'tennessee': 'TN', 'texas': 'TX', 'utah': 'UT',
      'vermont': 'VT', 'virginia': 'VA', 'washington': 'WA', 'west virginia': 'WV',
      'wisconsin': 'WI', 'wyoming': 'WY'
    };
    const trimmed = location.trim();
    const abbr = stateMap[trimmed.toLowerCase()];
    // Only convert if input is a standalone state name (no comma, no zip)
    if (abbr && !trimmed.includes(',') && !/\d/.test(trimmed)) {
      console.log(`Converted state name "${trimmed}" to abbreviation "${abbr}"`);
      return abbr;
    }
    return trimmed;
  }

  private async performSearch(params: PropertySearchParams, maxPages: number): Promise<Property[]> {
    let allProperties: Property[] = [];
    let currentPage = 1;
    let totalPages = 1;

    // Normalize location (convert full state names to abbreviations)
    const normalizedParams = { ...params, location: this.normalizeLocation(params.location) };

    // Fetch first page to get pagination info
    const firstPageData = await this.fetchPage(normalizedParams, currentPage);
    if (!firstPageData.success) {
      throw new Error(firstPageData.error || 'Failed to fetch Zillow data');
    }

    // Handle nested data structure from our API wrapper
    const responseData = firstPageData.data?.data || firstPageData.data;
    console.log('First page response keys:', Object.keys(responseData));

    if (params.fsboOnly) {
      console.log('FSBO Search Debug - First page data:', {
        total_results: responseData.total_results,
        total_pages: responseData.total_pages,
        listings: responseData.listings?.length || 0,
        location: params.location
      });
    }

    // Get pagination info - handle both old and new API formats
    const pagesInfo = responseData.pagesInfo;
    if (pagesInfo) {
      // Old API format
      totalPages = Math.min(pagesInfo.totalPages || 1, maxPages);
      console.log(`Found ${pagesInfo.totalMatchingCount} total properties across ${pagesInfo.totalPages} pages. Fetching ${totalPages} pages.`);
    } else if (responseData.total_pages) {
      // New API format
      totalPages = Math.min(responseData.total_pages || 1, maxPages);
      console.log(`Found ${responseData.total_results} total properties across ${responseData.total_pages} pages. Fetching ${totalPages} pages.`);
    }

    // Process first page
    const firstPageProperties = this.processPropertyData(responseData);
    allProperties.push(...firstPageProperties);

    // Fetch remaining pages in parallel for better performance
    if (totalPages > 1) {
      const remainingPagePromises = [];
      for (let page = 2; page <= totalPages; page++) {
        remainingPagePromises.push(this.fetchPage(normalizedParams, page));
      }

      const remainingPagesData = await Promise.allSettled(remainingPagePromises);

      for (const result of remainingPagesData) {
        if (result.status === 'fulfilled' && result.value.success) {
          const pageData = result.value.data?.data || result.value.data;
          const pageProperties = this.processPropertyData(pageData);
          allProperties.push(...pageProperties);
        } else {
          console.warn('Failed to fetch page:', result.status === 'rejected' ? result.reason : result.value.error);
        }
      }
    }

    console.log(`Total properties fetched across ${totalPages} pages: ${allProperties.length}`);
    return allProperties;
  }

  private combineAndDeduplicateResults(results1: Property[], results2: Property[]): Property[] {
    const seenIds = new Set<string>();
    const combined: Property[] = [];
    
    // Add results from first set
    for (const property of results1) {
      if (!seenIds.has(property.id)) {
        seenIds.add(property.id);
        combined.push(property);
      }
    }
    
    // Add unique results from second set
    for (const property of results2) {
      if (!seenIds.has(property.id)) {
        seenIds.add(property.id);
        combined.push(property);
      }
    }
    
    return combined;
  }

  private sortByFSBOConfidence(properties: Property[]): Property[] {
    return properties.sort((a, b) => {
      const aConfidence = (a as any).fsboDetection?.confidence || 0;
      const bConfidence = (b as any).fsboDetection?.confidence || 0;
      
      // Sort by confidence descending, then by price ascending
      if (aConfidence !== bConfidence) {
        return bConfidence - aConfidence;
      }
      
      const aPrice = a.price || 0;
      const bPrice = b.price || 0;
      return aPrice - bPrice;
    });
  }

  private async fetchPage(params: PropertySearchParams, page: number) {
    if (USE_SUPABASE) {
      try {
        const result = await this.fetchPageViaSupabase(params, page);
        if (result?.success) return result;
        console.warn('[ZillowAPI] Supabase returned error, falling back to Hetzner');
      } catch (err) {
        console.warn('[ZillowAPI] Supabase failed, falling back to Hetzner:', err);
      }
    }
    return this.fetchPageViaHetzner(params, page);
  }

  private async fetchPageViaSupabase(params: PropertySearchParams, page: number) {
    const { data, error } = await supabase.functions.invoke('get-zillow-data', {
      body: {
        searchParams: { ...params, page },
        action: 'search'
      }
    });

    if (error) {
      throw new Error(`Supabase Zillow search failed: ${error.message}`);
    }

    return data;
  }

  private async fetchPageViaHetzner(params: PropertySearchParams, page: number) {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (ZILLOW_API_KEY) headers['x-api-key'] = ZILLOW_API_KEY;

    const response = await fetch(ZILLOW_API_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        searchParams: { ...params, page },
        action: 'search'
      })
    });

    if (!response.ok) {
      throw new Error(`Zillow API request failed: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
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
    console.log(`All properties returned for FSBO search: ${processedProperties.length}`);
    
    return processedProperties;
  }

  private flattenProperty(prop: any): Property {
    const flattened: any = {};
    
    // Log the raw property data to understand structure
    console.log('Raw property data keys:', Object.keys(prop));
    console.log('Raw property sample:', JSON.stringify(prop, null, 2).substring(0, 500));
    
    // Log date-related fields specifically - check all levels
    const logDateFields = (obj: any, prefix = '') => {
      const dateFields: any = {};
      for (const [key, value] of Object.entries(obj)) {
        const fullKey = prefix ? `${prefix}.${key}` : key;
        if (key.toLowerCase().includes('date') || 
            key.toLowerCase().includes('posted') || 
            key.toLowerCase().includes('list') ||
            key.toLowerCase().includes('time') ||
            key.toLowerCase().includes('zillow') ||
            key.toLowerCase().includes('market')) {
          dateFields[fullKey] = value;
        }
        if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
          Object.assign(dateFields, logDateFields(value, fullKey));
        }
      }
      return dateFields;
    };
    
    const allDateFields = logDateFields(prop);
    console.log('All date-related fields found:', allDateFields);
    
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
    // Handle both old API format and new Zillow Scraper API format
    const address = flattened.property_address_streetAddress ||
                   flattened.rental_metrics_streetAddress ||
                   flattened.address ||
                   'Unknown Address';

    const city = flattened.property_address_city || flattened.city || '';
    const state = flattened.property_address_state || flattened.state || '';
    const zipcode = flattened.zipcode || '';
    const fullAddress = city && state ? `${address}, ${city}, ${state}${zipcode ? ' ' + zipcode : ''}` : address;

    const isFSBO = this.detectFSBO(flattened);

    return {
      id: flattened.property_zpid || flattened.id || flattened.zpid || Math.random().toString(36),
      zpid: flattened.property_zpid || flattened.zpid,
      address: fullAddress,
      price: this.parseNumber(flattened.property_price_value || flattened.property_hdpView_price || flattened.price),
      bedrooms: this.parseNumber(flattened.property_bedrooms || flattened.bedrooms),
      bathrooms: this.parseNumber(flattened.property_bathrooms || flattened.bathrooms),
      sqft: this.parseNumber(flattened.property_livingArea || flattened.living_area_sqft || flattened.sqft),
      propertyType: flattened.property_propertyType || flattened.home_type || flattened.propertyType || 'Unknown',
      yearBuilt: this.parseNumber(flattened.property_yearBuilt || flattened.yearBuilt),
      lotSize: this.parseNumber(flattened.property_lotSizeWithUnit_lotSize || flattened.lot_size_sqft || flattened.lotSize),
      status: flattened.property_listing_listingStatus || flattened.listing_status || flattened.property_hdpView_listingStatus || flattened.status || 'For Sale',
      daysOnMarket: this.parseNumber(flattened.property_daysOnZillow || flattened.days_on_zillow || flattened.daysOnMarket),
      pricePerSqft: this.parseNumber(flattened.property_price_pricePerSquareFoot || flattened.pricePerSqft),
      zestimate: this.parseNumber(flattened.property_estimates_zestimate || flattened.zestimate),
      description: flattened.description || flattened.summary || '',
      imageUrl: flattened.image_url || flattened.imgSrc || flattened.property_imgSrc,
      detailUrl: flattened.detail_url || flattened.detailUrl,
      latitude: flattened.latitude || flattened.property_latitude,
      longitude: flattened.longitude || flattened.property_longitude,
      datePostedString: flattened.property_datePriceChanged ||
                       flattened.property_listing_listingDate ||
                       flattened.property_listing_datePosted ||
                       flattened.property_datePosted ||
                       flattened.property_listingDate ||
                       flattened.datePriceChanged ||
                       flattened.listingDate ||
                       flattened.datePosted,
      listDate: flattened.property_listing_listDate ||
                flattened.property_listDate ||
                flattened.property_onMarketDate ||
                flattened.listDate ||
                flattened.onMarketDate,
      isFSBO,
      // Agent/Listing information
      agentName: flattened.property_listing_agentName ||
                 flattened.property_attributionInfo_agentName ||
                 flattened.agentName ||
                 flattened.agent_name,
      agentPhone: flattened.property_listing_agentPhoneNumber ||
                  flattened.property_attributionInfo_agentPhoneNumber ||
                  flattened.agentPhone ||
                  flattened.agent_phone,
      agentEmail: flattened.property_listing_agentEmail ||
                  flattened.property_attributionInfo_agentEmail ||
                  flattened.agentEmail ||
                  flattened.agent_email,
      agentLicenseNumber: flattened.property_listing_agentLicenseNumber ||
                          flattened.property_attributionInfo_agentLicenseNumber ||
                          flattened.agentLicenseNumber,
      agentPhotoUrl: flattened.property_listing_agentPhotoUrl ||
                     flattened.property_attributionInfo_agentPhotoUrl ||
                     flattened.agentPhotoUrl,
      brokerName: flattened.property_listing_brokerName ||
                  flattened.property_attributionInfo_brokerName ||
                  flattened.brokerName ||
                  flattened.broker_name,
      brokerPhone: flattened.property_listing_brokerPhoneNumber ||
                   flattened.property_attributionInfo_brokerPhoneNumber ||
                   flattened.brokerPhone ||
                   flattened.broker_phone,
      brokerageName: flattened.property_listing_listingAgency ||
                     flattened.property_attributionInfo_brokerageName ||
                     flattened.listingAgency ||
                     flattened.brokerage_name ||
                     flattened.brokerageName,
      mlsId: flattened.property_listing_mlsId ||
             flattened.property_attributionInfo_mlsId ||
             flattened.mlsId ||
             flattened.mls_id,
      mlsName: flattened.property_listing_mlsName ||
               flattened.property_attributionInfo_mlsName ||
               flattened.mlsName ||
               flattened.mls_name,
      listingSource: flattened.property_listing_listingProvider ||
                     flattened.listingProvider ||
                     flattened.listing_source,
      listingUrl: flattened.property_hdpView_url ||
                  flattened.detail_url ||
                  flattened.detailUrl ||
                  flattened.url,
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

  private detectFSBO(data: any): boolean {
    if (!data) return false;
    
    console.log('Starting enhanced FSBO detection for property:', data.id || data.zpid);
    
    // Initialize confidence scoring
    let fsboScore = 0;
    const detectionResults: any = {};
    
    // Extract various data fields
    const listingType = (data.property_listing_listingType || data.listingType || '').toLowerCase();
    const agentName = (data.property_listing_agentName || data.agentName || '').toLowerCase();
    const listingAgency = (data.property_listing_listingAgency || data.listingAgency || '').toLowerCase();
    const description = (data.description || data.summary || '').toLowerCase();
    const listingSubType = (data.property_listingSubType_description || data.listingSubType || '').toLowerCase();
    const brokerName = (data.property_listing_brokerName || data.brokerName || '').toLowerCase();
    const listingProvider = (data.property_listing_listingProvider || data.listingProvider || '').toLowerCase();
    
    // Method 1: Enhanced Keyword Analysis
    const allText = `${description} ${listingType} ${listingSubType} ${agentName} ${brokerName} ${listingProvider}`;
    
    const fsboKeywords = [
      'for sale by owner', 'fsbo', 'by owner', 'owner selling',
      'no agent', 'no realtor', 'direct from owner', 'owner financed',
      'owner will carry', 'private seller', 'selling myself',
      'no commission', 'save commission', 'direct sale',
      'owner listing', 'self listed', 'no broker', 'owner direct'
    ];
    
    const motivatedSellerKeywords = [
      'motivated seller', 'owner motivated', 'must sell',
      'owner says sell', 'bring offers', 'make offer',
      'priced to sell', 'quick sale', 'owner relocating'
    ];
    
    let keywordMatches = 0;
    fsboKeywords.forEach(keyword => {
      if (allText.includes(keyword)) {
        keywordMatches++;
        fsboScore += 30; // High weight for direct FSBO keywords
      }
    });
    
    let motivatedMatches = 0;
    motivatedSellerKeywords.forEach(keyword => {
      if (allText.includes(keyword)) {
        motivatedMatches++;
        fsboScore += 10; // Medium weight for motivated seller keywords
      }
    });
    
    detectionResults.keywordAnalysis = {
      fsboKeywords: keywordMatches,
      motivatedKeywords: motivatedMatches,
      score: keywordMatches * 30 + motivatedMatches * 10
    };
    
    // Method 2: Agent/Broker Analysis
    const fsboAgentIndicators = [
      'owner', 'private', 'fsbo', 'by owner', 'self listed',
      'no agent', 'direct', 'individual', 'seller'
    ];
    
    // Missing or generic agent information
    const hasNoAgent = !agentName || agentName === 'n/a' || agentName === '' || agentName === 'unknown';
    const hasGenericBroker = brokerName.includes('zillow') || brokerName.includes('generic') || brokerName.includes('listing service');
    
    let agentScore = 0;
    if (hasNoAgent) agentScore += 25;
    if (hasGenericBroker) agentScore += 15;
    
    fsboAgentIndicators.forEach(indicator => {
      if (agentName.includes(indicator) || brokerName.includes(indicator) || listingAgency.includes(indicator)) {
        agentScore += 20;
      }
    });
    
    fsboScore += agentScore;
    detectionResults.agentAnalysis = {
      hasNoAgent,
      hasGenericBroker,
      agentIndicators: fsboAgentIndicators.filter(ind => 
        agentName.includes(ind) || brokerName.includes(ind) || listingAgency.includes(ind)
      ),
      score: agentScore
    };
    
    // Method 3: Listing Type Analysis
    const fsboListingTypes = ['fsbo', 'owner', 'private', 'by_owner', 'for_sale_by_owner'];
    
    let listingScore = 0;
    fsboListingTypes.forEach(type => {
      if (listingType.includes(type) || listingSubType.includes(type)) {
        listingScore += 25;
      }
    });
    
    // Check for explicit FSBO flags
    if (data.isFSBO === true || data.fsbo === true || data.forSaleByOwner === true || 
        data.property_listing_listingSubType_isFSBA === true) {
      listingScore += 50; // Very high weight for explicit flags
    }
    
    fsboScore += listingScore;
    detectionResults.listingAnalysis = {
      listingType,
      listingSubType,
      hasFSBOFlag: data.isFSBO === true || data.fsbo === true || data.forSaleByOwner === true ||
                   data.property_listing_listingSubType_isFSBA === true,
      score: listingScore
    };
    
    // Method 4: Pricing Pattern Analysis
    const price = this.parseNumber(data.price || data.property_price_value);
    const zestimate = this.parseNumber(data.zestimate || data.property_estimates_zestimate);
    
    let pricingScore = 0;
    if (price && zestimate && price > 0 && zestimate > 0) {
      const ratio = price / zestimate;
      // FSBO properties often have unusual pricing patterns
      if (ratio < 0.80 || ratio > 1.20) { // Significantly under or overpriced
        pricingScore += 10;
      }
      if (ratio < 0.90 || ratio > 1.10) { // Moderately unusual pricing
        pricingScore += 5;
      }
    }
    
    fsboScore += pricingScore;
    detectionResults.pricingAnalysis = {
      price,
      zestimate,
      ratio: zestimate && zestimate > 0 ? price! / zestimate : null,
      score: pricingScore
    };
    
    // Method 5: Source Analysis
    const fsboSources = ['zillow', 'fsbo', 'owner', 'private', 'direct'];
    
    let sourceScore = 0;
    fsboSources.forEach(source => {
      if (listingProvider.includes(source)) {
        sourceScore += 15;
      }
    });
    
    fsboScore += sourceScore;
    detectionResults.sourceAnalysis = {
      sources: fsboSources.filter(source => listingProvider.includes(source)),
      score: sourceScore
    };
    
    // Calculate final confidence level
    const maxPossibleScore = 200; // Theoretical maximum based on all methods
    const confidencePercentage = Math.min(100, (fsboScore / maxPossibleScore) * 100);
    
    // Determine confidence tier with more inclusive thresholds for FSBO detection
    let confidenceTier: 'high' | 'medium' | 'low' | 'none';
    if (confidencePercentage >= 70) confidenceTier = 'high';
    else if (confidencePercentage >= 50) confidenceTier = 'medium'; 
    else if (confidencePercentage >= 30) confidenceTier = 'low';
    else confidenceTier = 'none';
    
    // More inclusive FSBO classification threshold
    const isFSBO = confidencePercentage >= 25; // Lower threshold to catch more potential FSBO properties
    
    console.log(`FSBO Detection Results for property ${data.id || data.zpid}:`, {
      totalScore: fsboScore,
      confidencePercentage: Math.round(confidencePercentage),
      confidenceTier,
      isFSBO,
      detectionMethods: detectionResults
    });
    
    // Store detection results in the data object for potential UI display
    (data as any).fsboDetection = {
      score: fsboScore,
      confidence: Math.round(confidencePercentage),
      tier: confidenceTier,
      methods: detectionResults
    };
    
    return isFSBO;
  }

  private extractZpid(property: Property): string | null {
    // Try to extract ZPID from various property fields
    const zpidSources = [
      property.id,
      (property as any).zpid,
      (property as any).property_zpid,
      (property as any).listing_zpid
    ];
    
    for (const zpid of zpidSources) {
      if (zpid && typeof zpid === 'string' && zpid.length > 5) {
        return zpid;
      }
    }
    
    return null;
  }

  private async callApi(action: string, searchParams?: any): Promise<any> {
    if (USE_SUPABASE) {
      try {
        const result = await this.callApiViaSupabase(action, searchParams);
        if (result?.success) return result;
        console.warn(`[ZillowAPI] Supabase ${action} returned error, falling back to Hetzner`);
      } catch (err) {
        console.warn(`[ZillowAPI] Supabase ${action} failed, falling back to Hetzner:`, err);
      }
    }
    return this.callApiViaHetzner(action, searchParams);
  }

  private async callApiViaSupabase(action: string, searchParams?: any): Promise<any> {
    const { data, error } = await supabase.functions.invoke('get-zillow-data', {
      body: { action, searchParams }
    });

    if (error) {
      throw new Error(`Supabase API request failed: ${error.message}`);
    }

    if (!data?.success) {
      throw new Error(data?.error || 'API request failed');
    }
    return data;
  }

  private async callApiViaHetzner(action: string, searchParams?: any): Promise<any> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (ZILLOW_API_KEY) headers['x-api-key'] = ZILLOW_API_KEY;

    const response = await fetch(ZILLOW_API_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify({ action, searchParams })
    });

    if (!response.ok) {
      throw new Error(`Zillow API request failed: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    if (!data?.success) {
      throw new Error(data?.error || 'API request failed');
    }
    return data;
  }

  /**
   * Extract zpid from property using various fallbacks
   */
  private getPropertyZpid(p: Property): string | null {
    // Try zpid field first, then id, then any nested zpid fields
    const candidates = [
      p.zpid,
      (p as any).property_zpid,
      p.id,
      (p as any).listing_zpid
    ];

    for (const candidate of candidates) {
      if (!candidate) continue;
      const str = String(candidate);
      // Valid zpid is numeric and at least 5 digits
      if (/^\d{5,}$/.test(str)) {
        return str;
      }
    }
    return null;
  }

  /**
   * Enrich search results with zestimates.
   *
   * Uses Supabase edge function (get-zillow-data with action: 'zestimate') or
   * Hetzner batch endpoint as fallback. Fetches zestimates in parallel chunks.
   *
   * IMPORTANT: After enrichment completes, ALL properties that weren't enriched
   * (no zpid, beyond cap, or failed) are marked zestimateUnavailable so the UI
   * never shows an infinite "Calculating..." spinner.
   */
  async enrichWithZestimates(
    properties: Property[],
    onProgress?: (completed: number, total: number) => void,
    onChunkComplete?: (partiallyEnriched: Property[]) => void
  ): Promise<Property[]> {
    const MAX_ENRICH = 80;
    const CHUNK_SIZE = 10; // Smaller chunks for parallel individual calls

    const propertiesWithZpid = properties.map(p => ({
      property: p,
      zpid: this.getPropertyZpid(p)
    }));

    const toEnrich = propertiesWithZpid
      .filter(({ zpid, property }) => zpid && !property.zestimate)
      .slice(0, MAX_ENRICH);

    const totalWithZpid = propertiesWithZpid.filter(p => p.zpid).length;
    const alreadyHaveZest = properties.filter(p => p.zestimate).length;

    console.log(`[Zestimate Enrichment] Total: ${properties.length}, With ZPID: ${totalWithZpid}, Enriching: ${toEnrich.length} (capped from ${totalWithZpid}), Already have: ${alreadyHaveZest}`);

    if (toEnrich.length === 0) {
      // Mark all properties without zestimate as unavailable
      return this.markRemainingUnavailable(properties);
    }

    const allZpids = toEnrich.map(({ zpid }) => zpid!);
    onProgress?.(0, allZpids.length);

    const allZestimates: Record<string, number | null> = {};

    try {
      // Try Supabase edge function first for batch zestimates
      let useSupabaseForZest = USE_SUPABASE;

      for (let i = 0; i < allZpids.length; i += CHUNK_SIZE) {
        const chunk = allZpids.slice(i, i + CHUNK_SIZE);
        const chunkNum = Math.floor(i / CHUNK_SIZE) + 1;

        console.log(`[Zestimate Enrichment] Chunk ${chunkNum} (${chunk.length} zpids) via ${useSupabaseForZest ? 'Supabase' : 'Hetzner'}`);

        let chunkSuccess = false;

        // Try Supabase: parallel individual zestimate calls
        if (useSupabaseForZest) {
          try {
            const results = await Promise.allSettled(
              chunk.map(zpid =>
                supabase.functions.invoke('get-zillow-data', {
                  body: { action: 'zestimate', searchParams: { zpid } }
                }).then(({ data, error }) => {
                  if (error || !data?.success) return { zpid, zestimate: null };
                  // Extract zestimate from various possible response structures
                  const d = data?.data || {};
                  const zest = d.zestimate ?? d.value ?? d.amount ?? null;
                  return { zpid, zestimate: typeof zest === 'number' && zest > 0 ? zest : null };
                })
              )
            );

            let chunkHits = 0;
            let chunkErrors = 0;
            for (const result of results) {
              if (result.status === 'fulfilled') {
                allZestimates[result.value.zpid] = result.value.zestimate;
                if (result.value.zestimate !== null) chunkHits++;
              } else {
                chunkErrors++;
              }
            }

            // If ALL results failed, switch to Hetzner for remaining chunks
            if (chunkErrors === chunk.length) {
              console.warn(`[Zestimate Enrichment] Supabase chunk ${chunkNum} fully failed, switching to Hetzner`);
              useSupabaseForZest = false;
            } else {
              chunkSuccess = true;
              console.log(`[Zestimate Enrichment] Chunk ${chunkNum}: ${chunkHits}/${chunk.length} zestimates found via Supabase`);
            }
          } catch (err) {
            console.warn(`[Zestimate Enrichment] Supabase chunk ${chunkNum} error, switching to Hetzner:`, err);
            useSupabaseForZest = false;
          }
        }

        // Hetzner fallback: batch endpoint
        if (!chunkSuccess) {
          const ZILLOW_BASE = ZILLOW_API_URL.replace(/\/zillow$/, '');
          const batchHeaders: Record<string, string> = { 'Content-Type': 'application/json' };
          if (ZILLOW_API_KEY) batchHeaders['x-api-key'] = ZILLOW_API_KEY;

          try {
            const response = await fetch(`${ZILLOW_BASE}/batch-zestimates`, {
              method: 'POST',
              headers: batchHeaders,
              body: JSON.stringify({ zpids: chunk }),
            });

            if (response.ok) {
              const result = await response.json();
              if (result.success && result.data) {
                Object.assign(allZestimates, result.data);
                const chunkHits = Object.values(result.data).filter((v: any) => v !== null && v > 0).length;
                console.log(`[Zestimate Enrichment] Chunk ${chunkNum}: ${chunkHits}/${chunk.length} zestimates via Hetzner`);
              }
            } else {
              console.error(`[Zestimate Enrichment] Hetzner chunk ${chunkNum} failed: ${response.status}`);
              for (const zpid of chunk) {
                allZestimates[zpid] = null;
              }
            }
          } catch (err) {
            console.error(`[Zestimate Enrichment] Hetzner chunk ${chunkNum} error:`, err);
            for (const zpid of chunk) {
              allZestimates[zpid] = null;
            }
          }
        }

        onProgress?.(Math.min(i + chunk.length, allZpids.length), allZpids.length);

        // Progressive UI update
        if (onChunkComplete) {
          const partialMerge = this.mergeZestimates(properties, allZestimates);
          onChunkComplete(partialMerge);
        }
      }
    } catch (error) {
      console.error('[Zestimate Enrichment] Failed:', error);
    }

    onProgress?.(allZpids.length, allZpids.length);

    const withZest = Object.values(allZestimates).filter(v => v !== null && v > 0).length;
    console.log(`[Zestimate Enrichment] Complete: ${withZest}/${allZpids.length} have zestimates`);

    // Merge enriched data, then mark ALL remaining without zestimate as unavailable
    const enriched = this.mergeZestimates(properties, allZestimates);
    return this.markRemainingUnavailable(enriched);
  }

  private mergeZestimates(properties: Property[], zestimates: Record<string, number | null>): Property[] {
    return properties.map(p => {
      const zpid = this.getPropertyZpid(p);
      if (!zpid) return p;
      if (zestimates.hasOwnProperty(zpid)) {
        const zest = zestimates[zpid];
        if (zest !== null && zest > 0) {
          return { ...p, zestimate: zest };
        }
        return { ...p, zestimateUnavailable: true };
      }
      return p;
    });
  }

  /**
   * Mark any property that still has no zestimate as unavailable.
   * This prevents the UI from showing an infinite "Calculating..." spinner
   * for properties that were beyond the enrichment cap or had no zpid.
   */
  private markRemainingUnavailable(properties: Property[]): Property[] {
    return properties.map(p => {
      if (!p.zestimate && !(p as any).zestimateUnavailable) {
        return { ...p, zestimateUnavailable: true };
      }
      return p;
    });
  }

  async testConnection(): Promise<boolean> {
    try {
      const data = await this.callApi('test');
      return data?.success;
    } catch {
      return false;
    }
  }

  async getPropertyDetails(zpid: string): Promise<any> {
    try {
      const data = await this.callApi('propertyDetails', { zpid });
      return data?.data;
    } catch (error) {
      console.error('Property details fetch failed:', error);
      throw error;
    }
  }

  async getPriceHistory(zpid: string): Promise<any> {
    try {
      const data = await this.callApi('priceHistory', { zpid });
      return data?.data;
    } catch (error) {
      console.error('Price history fetch failed:', error);
      throw error;
    }
  }

  async getPropertyPhotos(zpid: string): Promise<any> {
    try {
      const data = await this.callApi('photos', { zpid });
      return data?.data;
    } catch (error) {
      console.error('Property photos fetch failed:', error);
      throw error;
    }
  }

  async getPropertyComps(zpid: string): Promise<any> {
    try {
      const data = await this.callApi('comps', { zpid });
      return data?.data;
    } catch (error) {
      console.error('Property comps fetch failed:', error);
      throw error;
    }
  }

  async getZestimate(zpid: string): Promise<any> {
    try {
      const data = await this.callApi('zestimate', { zpid });
      return data?.data;
    } catch (error) {
      console.error('Zestimate fetch failed:', error);
      throw error;
    }
  }

  async getPropertySchools(zpid: string): Promise<any> {
    try {
      const data = await this.callApi('schools', { zpid });
      return data?.data;
    } catch (error) {
      console.error('Property schools fetch failed:', error);
      throw error;
    }
  }

  async getWalkScore(zpid: string): Promise<any> {
    // Note: walkScore is not supported by the new API
    console.warn('Walk score is not supported by the current API');
    throw new Error('Walk score is not supported by the current API');
  }

  async getPropertyTaxes(zpid: string): Promise<any> {
    try {
      const data = await this.callApi('taxes', { zpid });
      return data?.data;
    } catch (error) {
      console.error('Property taxes fetch failed:', error);
      throw error;
    }
  }

  async getRentalEstimate(zpid: string): Promise<any> {
    try {
      const data = await this.callApi('rentalEstimate', { zpid });
      return data?.data;
    } catch (error) {
      console.error('Rental estimate fetch failed:', error);
      throw error;
    }
  }

  async getSkipTrace(address: string, location: string, format: string = 'full'): Promise<any> {
    // Note: skipTrace is not supported by the new API
    console.warn('Skip trace is not supported by the current API');
    throw new Error('Skip trace is not supported by the current API');
  }

  async getDeepComps(zpid: string, count: string = "5"): Promise<any> {
    // Note: deepComps is not supported - use comps instead
    console.warn('Deep comps is not supported - using regular comps instead');
    return this.getPropertyComps(zpid);
  }

  async deepSearch(address: string, citystatezip: string): Promise<any> {
    // Note: deepSearch is not supported by the new API
    console.warn('Deep search is not supported by the current API');
    throw new Error('Deep search is not supported by the current API');
  }
}

export const zillowAPI = new ZillowAPI();// Build: 1776461021
