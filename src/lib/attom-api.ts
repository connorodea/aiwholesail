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
  private apiKey: string;
  private baseUrl = 'https://api.gateway.attomdata.com/propertyapi/v1.0.0';

  constructor() {
    this.apiKey = '11465f2de3edc232490d8c2ccccacb83';
  }

  private async makeRequest(endpoint: string, params: Record<string, any> = {}): Promise<any> {
    const url = new URL(`${this.baseUrl}${endpoint}`);
    
    // Add API key and common parameters
    url.searchParams.append('apikey', this.apiKey);
    
    // Add other parameters
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        url.searchParams.append(key, value.toString());
      }
    });

    try {
      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`AttomData API error: ${response.status} ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('AttomData API request failed:', error);
      throw error;
    }
  }

  async getPropertyDetails(address: string, city?: string, state?: string): Promise<AttomPropertyData | null> {
    try {
      const params: Record<string, any> = {
        address1: address,
      };
      
      if (city) params.locality = city;
      if (state) params.postalcode = state;

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
      const params: Record<string, any> = {
        address1: address,
      };
      
      if (city) params.locality = city;
      if (state) params.postalcode = state;

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
      const params: Record<string, any> = {
        address1: address,
        radius: radius,
        minSaleDate: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 1 year ago
      };
      
      if (city) params.locality = city;
      if (state) params.postalcode = state;

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
      const params: Record<string, any> = {
        address1: address,
      };
      
      if (city) params.locality = city;
      if (state) params.postalcode = state;

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
      // Test with a simple property search
      await this.makeRequest('/property/basicprofile', {
        address1: '123 Main St',
        locality: 'Los Angeles',
        postalcode: 'CA',
      });
      return true;
    } catch (error) {
      console.error('AttomData connection test failed:', error);
      return false;
    }
  }
}