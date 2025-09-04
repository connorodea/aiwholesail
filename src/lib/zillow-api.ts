import { PropertySearchParams, Property, ZillowAPIResponse } from '@/types/zillow';
import { supabase } from '@/integrations/supabase/client';

export class ZillowAPI {

  async searchProperties(params: PropertySearchParams, maxPages: number = 3): Promise<Property[]> {
    try {
      console.log('Searching with params:', params, `Max pages: ${maxPages}`);
      console.log('FSBO toggle status:', params.fsboOnly);
      
      // Two-pass filtering strategy for FSBO
      if (params.fsboOnly) {
        console.log('Starting two-pass FSBO filtering strategy');
        
        // Pass 1: Try API-level FSBO filtering
        console.log('Pass 1: Attempting API-level FSBO filtering');
        const fsboResults = await this.performSearch({ ...params, fsboOnly: true }, maxPages);
        console.log(`Pass 1 results: ${fsboResults.length} properties found`);
        
        // Pass 2: Fallback to regular search with client-side FSBO detection
        let fallbackResults: Property[] = [];
        if (fsboResults.length === 0) {
          console.log('Pass 2: API filtering returned no results, trying regular search with enhanced detection');
          fallbackResults = await this.performSearch({ ...params, fsboOnly: false }, maxPages);
          console.log(`Pass 2 raw results: ${fallbackResults.length} properties found`);
          
          // Apply client-side FSBO filtering
          fallbackResults = fallbackResults.filter(property => property.isFSBO);
          console.log(`Pass 2 FSBO filtered results: ${fallbackResults.length} properties found`);
        }
        
        // Combine and deduplicate results
        const combinedResults = this.combineAndDeduplicateResults(fsboResults, fallbackResults);
        console.log(`Final combined FSBO results: ${combinedResults.length} properties`);
        
        // Sort by FSBO confidence if available
        return this.sortByFSBOConfidence(combinedResults);
      } else {
        // Regular search for non-FSBO requests
        return await this.performSearch(params, maxPages);
      }
    } catch (error) {
      console.error('Error fetching properties:', error);
      throw error;
    }
  }

  private async performSearch(params: PropertySearchParams, maxPages: number): Promise<Property[]> {
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
    console.log(`FSBO properties found: ${processedProperties.filter(p => p.isFSBO).length}`);
    
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
      zpid: flattened.property_zpid || flattened.zpid, // Add zpid field for API calls
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
      description: flattened.description || flattened.summary || '',
      // Extract listing date from comprehensive field search - no mock data
      datePostedString: flattened.property_datePriceChanged || 
                       flattened.property_listing_listingDate || 
                       flattened.property_listing_datePosted ||
                       flattened.property_datePosted ||
                       flattened.property_listingDate ||
                       flattened.property_hdpView_listingDatePosted ||
                       flattened.property_hdpView_datePosted ||
                       flattened.property_daysOnZillow_datePosted ||
                       flattened.property_marketData_listingDate ||
                       flattened.property_marketData_datePosted ||
                       flattened.property_timeOnZillow_datePosted ||
                       flattened.datePriceChanged ||
                       flattened.listingDate ||
                       flattened.datePosted ||
                       flattened.listing_listingDate ||
                       flattened.listing_datePosted ||
                       flattened.hdpView_datePosted ||
                       flattened.daysOnZillow_datePosted,
      listDate: flattened.property_listing_listDate ||
                flattened.property_listDate ||
                flattened.property_onMarketDate ||
                flattened.property_hdpView_listDate ||
                flattened.listDate ||
                flattened.onMarketDate ||
                flattened.listing_listDate ||
                flattened.hdpView_listDate,
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
    
    // Determine confidence tier
    let confidenceTier: 'high' | 'medium' | 'low' | 'none';
    if (confidencePercentage >= 70) confidenceTier = 'high';
    else if (confidencePercentage >= 45) confidenceTier = 'medium';
    else if (confidencePercentage >= 25) confidenceTier = 'low';
    else confidenceTier = 'none';
    
    const isFSBO = confidencePercentage >= 30; // Threshold for FSBO classification
    
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

  async getSkipTrace(address: string, location: string, format: string = 'full'): Promise<any> {
    try {
      const { data, error } = await supabase.functions.invoke('get-zillow-data', {
        body: { 
          action: 'skipTrace',
          searchParams: {
            street: address,
            citystatezip: location,
            page: '1'
          }
        }
      });
      
      if (error) throw error;
      return data?.data;
    } catch (error) {
      console.error('Skip trace fetch failed:', error);
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