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