export interface PropertySearchParams {
  location: string;
  homeType: string;
  bed_min?: string;
  bed_max?: string;
  bathrooms?: string;
  price_min?: string;
  price_max?: string;
  mustHaveBasement?: string;
  parkingSpots?: string;
  page?: string;
  sortOrder?: string;
  listingStatus?: string;
  wholesaleOnly?: boolean;
  auctionOnly?: boolean;
  fsboOnly?: boolean;
  keywords?: string;
}

export interface Property {
  id: string;
  address: string;
  price: number;
  bedrooms?: number;
  bathrooms?: number;
  sqft?: number;
  propertyType?: string;
  yearBuilt?: number;
  lotSize?: number;
  status: string;
  daysOnMarket?: number;
  pricePerSqft?: number;
  zestimate?: number;
  images?: string[];
  description?: string;
  isFSBO?: boolean;
  // AttomData enhanced fields
  attomData?: {
    propertyType?: string;
    yearBuilt?: number;
    lotSizeAcres?: number;
    totalRooms?: number;
    totalBaths?: number;
    totalBedrooms?: number;
    livingAreaSqFt?: number;
    avm?: {
      amount?: number;
      confidence?: string;
      date?: string;
    };
    marketValue?: number;
    taxAssessedValue?: number;
    comparables?: Array<{
      address?: string;
      distance?: number;
      salePrice?: number;
      saleDate?: string;
      livingAreaSqFt?: number;
    }>;
    saleHistory?: Array<{
      saleDate?: string;
      salePrice?: number;
      saleType?: string;
      deed?: string;
    }>;
    owner?: {
      name?: string;
      mailingAddress?: string;
      ownerOccupied?: boolean;
    };
    taxInfo?: {
      taxAmount?: number;
      taxYear?: number;
      exemptions?: string[];
      millRate?: number;
    };
    mortgageInfo?: {
      lenderName?: string;
      loanAmount?: number;
      loanType?: string;
      interestRate?: number;
      loanDate?: string;
    };
    demographics?: {
      medianHouseholdIncome?: number;
      medianAge?: number;
      populationDensity?: number;
      crimeIndex?: number;
      schoolRating?: number;
    };
    foreclosureStatus?: string;
    preForeclosure?: boolean;
    distressIndicators?: string[];
    equityPosition?: number;
    priceReductions?: number;
    motivatedSeller?: boolean;
  };
  [key: string]: any;
}

export interface MarketAnalysis {
  mean: number;
  median: number;
  min: number;
  max: number;
  q25: number;
  q75: number;
  std: number;
}

export interface AIAnalysis {
  summary: {
    total_properties: number;
    unique_locations: number;
    data_quality_score: number;
  };
  insights: string[];
  recommendations: string[];
  market_analysis: Record<string, MarketAnalysis>;
  outliers: Array<{
    column: string;
    count: number;
    percentage: number;
    description: string;
  }>;
  trends: Record<string, any>;
}

export interface ZillowAPIResponse {
  [key: string]: any;
}