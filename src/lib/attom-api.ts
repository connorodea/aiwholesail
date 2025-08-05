import { supabase } from '@/integrations/supabase/client';

export interface AttomPropertyData {
  // Property Details
  propertyType?: string;
  yearBuilt?: number;
  lotSizeAcres?: number;
  totalRooms?: number;
  totalBaths?: number;
  totalBedrooms?: number;
  livingAreaSqFt?: number;
  
  // Valuations
  avm?: {
    amount?: number;
    confidence?: string;
    date?: string;
  };
  marketValue?: number;
  taxAssessedValue?: number;
  
  // Market Analytics
  comparables?: Array<{
    address?: string;
    distance?: number;
    salePrice?: number;
    saleDate?: string;
    livingAreaSqFt?: number;
  }>;
  
  // Property History
  saleHistory?: Array<{
    saleDate?: string;
    salePrice?: number;
    saleType?: string;
    deed?: string;
  }>;
  
  // Ownership
  owner?: {
    name?: string;
    mailingAddress?: string;
    ownerOccupied?: boolean;
  };
  
  // Tax Information
  taxInfo?: {
    taxAmount?: number;
    taxYear?: number;
    exemptions?: string[];
    millRate?: number;
  };
  
  // Mortgage Information
  mortgageInfo?: {
    lenderName?: string;
    loanAmount?: number;
    loanType?: string;
    interestRate?: number;
    loanDate?: string;
  };
  
  // Neighborhood Demographics
  demographics?: {
    medianHouseholdIncome?: number;
    medianAge?: number;
    populationDensity?: number;
    crimeIndex?: number;
    schoolRating?: number;
  };
  
  // Foreclosure/Distress indicators
  foreclosureStatus?: string;
  preForeclosure?: boolean;
  distressIndicators?: string[];
  
  // Wholesale-specific metrics
  equityPosition?: number;
  daysOnMarket?: number;
  priceReductions?: number;
  motivatedSeller?: boolean;
}

export class AttomAPI {

  private async makeRequest(endpoint: string, params: Record<string, any> = {}): Promise<any> {
    try {
      const { data, error } = await supabase.functions.invoke('get-attom-data', {
        body: { 
          endpoint,
          params,
          action: 'request'
        }
      });

      if (error) {
        throw new Error(`AttomData API request failed: ${error.message}`);
      }

      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch AttomData');
      }

      return data.data;
    } catch (error) {
      console.error('AttomData API request failed:', error);
      throw error;
    }
  }

  async getPropertyDetails(address: string, city?: string, state?: string): Promise<AttomPropertyData | null> {
    try {
      // Parse the full address if city/state are not provided separately
      const parsedAddress = this.parseAddress(address, city, state);
      
      const params: Record<string, any> = {
        address1: parsedAddress.streetAddress,
        address2: parsedAddress.cityState,
      };

      const response = await this.makeRequest('/property/detail', params);
      
      if (response?.property && response.property.length > 0) {
        return this.processPropertyDetail(response.property[0]);
      }
      
      return null;
    } catch (error) {
      console.error('Failed to get property details from AttomData:', error);
      return null;
    }
  }

  async getPropertyValuation(address: string, city?: string, state?: string): Promise<AttomPropertyData | null> {
    try {
      // Parse the full address if city/state are not provided separately
      const parsedAddress = this.parseAddress(address, city, state);
      
      const params: Record<string, any> = {
        address1: parsedAddress.streetAddress,
        address2: parsedAddress.cityState,
      };

      const response = await this.makeRequest('/property/avm', params);
      
      if (response?.property && response.property.length > 0) {
        return this.processValuation(response.property[0]);
      }
      
      return null;
    } catch (error) {
      console.error('Failed to get property valuation from AttomData:', error);
      return null;
    }
  }

  async getComparables(address: string, city?: string, state?: string, radius: number = 0.5): Promise<AttomPropertyData | null> {
    try {
      // Parse the full address if city/state are not provided separately
      const parsedAddress = this.parseAddress(address, city, state);
      
      const params: Record<string, any> = {
        address1: parsedAddress.streetAddress,
        address2: parsedAddress.cityState,
        radius: radius,
        minSaleDate: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 1 year ago
      };

      const response = await this.makeRequest('/property/compsales', params);
      
      if (response?.property && response.property.length > 0) {
        return this.processComparables(response.property);
      }
      
      return null;
    } catch (error) {
      console.error('Failed to get comparables from AttomData:', error);
      return null;
    }
  }

  async getSalesHistory(address: string, city?: string, state?: string): Promise<AttomPropertyData | null> {
    try {
      // Parse the full address if city/state are not provided separately
      const parsedAddress = this.parseAddress(address, city, state);
      
      const params: Record<string, any> = {
        address1: parsedAddress.streetAddress,
        address2: parsedAddress.cityState,
      };

      const response = await this.makeRequest('/property/salehistory', params);
      
      if (response?.property && response.property.length > 0) {
        return this.processSalesHistory(response.property[0]);
      }
      
      return null;
    } catch (error) {
      console.error('Failed to get sales history from AttomData:', error);
      return null;
    }
  }

  async getEnhancedPropertyData(address: string, city?: string, state?: string): Promise<AttomPropertyData> {
    // Combine multiple AttomData endpoints for comprehensive property data
    const [details, valuation, comparables, salesHistory] = await Promise.allSettled([
      this.getPropertyDetails(address, city, state),
      this.getPropertyValuation(address, city, state),
      this.getComparables(address, city, state),
      this.getSalesHistory(address, city, state),
    ]);

    // Merge all successful results
    const combinedData: AttomPropertyData = {};

    if (details.status === 'fulfilled' && details.value) {
      Object.assign(combinedData, details.value);
    }

    if (valuation.status === 'fulfilled' && valuation.value) {
      Object.assign(combinedData, valuation.value);
    }

    if (comparables.status === 'fulfilled' && comparables.value) {
      Object.assign(combinedData, comparables.value);
    }

    if (salesHistory.status === 'fulfilled' && salesHistory.value) {
      Object.assign(combinedData, salesHistory.value);
    }

    // Calculate wholesale-specific metrics
    this.calculateWholesaleMetrics(combinedData);

    return combinedData;
  }

  private processPropertyDetail(property: any): AttomPropertyData {
    const building = property.building || {};
    const lot = property.lot || {};
    const summary = property.summary || {};

    return {
      propertyType: summary.propclass,
      yearBuilt: building.yearbuilt,
      lotSizeAcres: lot.lotsize1,
      totalRooms: building.rooms?.totalrooms,
      totalBaths: building.rooms?.bathstotal,
      totalBedrooms: building.rooms?.beds,
      livingAreaSqFt: building.size?.livingsize,
      owner: {
        name: property.owner?.name,
        mailingAddress: property.owner?.mailingAddress,
        ownerOccupied: property.owner?.owneroccupied === 'Y',
      },
      taxInfo: {
        taxAmount: property.assessment?.tax?.taxamt,
        taxYear: property.assessment?.tax?.taxyear,
        millRate: property.assessment?.tax?.millrate,
      },
    };
  }

  private processValuation(property: any): AttomPropertyData {
    const avm = property.avm || {};
    
    return {
      avm: {
        amount: avm.amount?.value,
        confidence: avm.confidence,
        date: avm.eventDate,
      },
      marketValue: avm.amount?.value,
    };
  }

  private processComparables(properties: any[]): AttomPropertyData {
    const comparables = properties.map(prop => ({
      address: prop.address?.oneLine,
      distance: prop.distance,
      salePrice: prop.sale?.amount?.value,
      saleDate: prop.sale?.transDate,
      livingAreaSqFt: prop.building?.size?.livingsize,
    })).filter(comp => comp.salePrice); // Only include properties with sale prices

    return { comparables };
  }

  private processSalesHistory(property: any): AttomPropertyData {
    const salesHistory = property.sale?.saleshistory || [];
    
    const history = salesHistory.map((sale: any) => ({
      saleDate: sale.transDate,
      salePrice: sale.amount?.value,
      saleType: sale.transType,
      deed: sale.deed,
    }));

    return { saleHistory: history };
  }

  private parseAddress(address: string, city?: string, state?: string): { streetAddress: string; cityState: string } {
    if (city && state) {
      // If city and state are provided separately, use them
      return {
        streetAddress: address,
        cityState: `${city}, ${state}`
      };
    }
    
    // Parse the full address string
    // Expected format: "123 Main St, City, ST" or "123 Main St, City, ST 12345"
    const parts = address.split(',').map(part => part.trim());
    
    if (parts.length >= 3) {
      // Full address with street, city, and state
      const streetAddress = parts[0];
      const city = parts[1];
      const stateZip = parts[2];
      
      return {
        streetAddress,
        cityState: `${city}, ${stateZip}`
      };
    } else if (parts.length === 2) {
      // Address with street and city/state combined
      const streetAddress = parts[0];
      const cityState = parts[1];
      
      return {
        streetAddress,
        cityState
      };
    } else {
      // Single part - treat as street address and try to extract city/state
      const addressMatch = address.match(/^(.+?),\s*([^,]+),\s*([A-Z]{2})\s*(\d{5})?$/);
      
      if (addressMatch) {
        const [, street, city, state, zip] = addressMatch;
        return {
          streetAddress: street,
          cityState: zip ? `${city}, ${state} ${zip}` : `${city}, ${state}`
        };
      }
      
      // Fallback - use entire address for both fields
      return {
        streetAddress: address,
        cityState: address
      };
    }
  }

  private calculateWholesaleMetrics(data: AttomPropertyData): void {
    // Calculate equity position if we have both market value and mortgage info
    if (data.marketValue && data.mortgageInfo?.loanAmount) {
      data.equityPosition = data.marketValue - data.mortgageInfo.loanAmount;
    }

    // Detect motivated seller indicators
    const motivatedIndicators: string[] = [];
    
    if (data.foreclosureStatus) {
      motivatedIndicators.push('Foreclosure');
    }
    
    if (data.preForeclosure) {
      motivatedIndicators.push('Pre-foreclosure');
    }
    
    if (data.owner && !data.owner.ownerOccupied) {
      motivatedIndicators.push('Non-owner occupied');
    }
    
    if (data.saleHistory && data.saleHistory.length > 2) {
      motivatedIndicators.push('Multiple recent sales');
    }

    data.distressIndicators = motivatedIndicators;
    data.motivatedSeller = motivatedIndicators.length > 0;
  }

  async testConnection(): Promise<boolean> {
    try {
      console.log('Testing AttomData API connection...');
      const { data, error } = await supabase.functions.invoke('get-attom-data', {
        body: { action: 'test' }
      });

      console.log('AttomData test response:', { data, error });
      
      if (error) {
        console.error('Supabase function error:', error);
        return false;
      }
      
      if (!data?.success) {
        console.error('AttomData API error:', data?.error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('AttomData connection test failed:', error);
      return false;
    }
  }
}

export const attomAPI = new AttomAPI();