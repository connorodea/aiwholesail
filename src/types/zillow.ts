export interface PropertySearchParams {
  location: string;
  /** Optional radius in miles around the single-ZIP/address location. Ignored
   *  if the location text contains multiple ZIP codes (multi-ZIP fan-out wins). */
  radiusMi?: number;
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
  hideForeclosures?: boolean;
  fsboOnly?: boolean;
  /** Elite-only: filter the result set to high-motivation sellers (score >= 30) */
  motivatedSellersOnly?: boolean;
  keywords?: string;
}

export interface Property {
  id: string;
  zpid?: string; // Zillow Property ID for API calls
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
  datePostedString?: string;
  listDate?: string;
  description?: string;
  isFSBO?: boolean;
  // Agent/Listing information
  agentName?: string;
  agentPhone?: string;
  agentEmail?: string;
  agentLicenseNumber?: string;
  agentPhotoUrl?: string;
  brokerName?: string;
  brokerPhone?: string;
  brokerageName?: string;
  mlsId?: string;
  mlsName?: string;
  listingSource?: string;
  listingUrl?: string;
  // ─── Extended propertyDetails fields (additive, backend PR ~50 new fields) ───
  // Construction & systems
  foundation?: string[];
  roofType?: string;
  constructionMaterials?: string[];
  exteriorFeatures?: string[];
  structureType?: string;
  architecturalStyle?: string;
  stories?: number;
  basement?: string;
  basementArea?: number;
  finishedAreaAboveGrade?: number;
  finishedAreaBelowGrade?: number;
  flooring?: string[];
  fireplaceCount?: number;
  appliances?: string[];
  // Utilities
  waterSource?: string[];
  sewer?: string[];
  electric?: string[];
  electricUtilityCompany?: string;
  gas?: string[];
  // Lot / parcel / location
  apn?: string;
  zoning?: string;
  zoningDescription?: string;
  countyFips?: string;
  subdivisionName?: string;
  schoolDistrict?: { elementary?: string; middleOrJunior?: string; high?: string };
  // Listing terms
  specialListingConditions?: string[];
  disclosures?: string[];
  listingTerms?: string[];
  buyerCommission?: { amount?: number; type?: string };
  possession?: string;
  contingencyType?: string;
  cumulativeDaysOnMarket?: number;
  lastStatusChange?: { date?: string; isRecent?: boolean };
  ownershipType?: string;
  mlsNumber?: string;
  // Lifestyle / amenities
  view?: string[];
  hasView?: boolean;
  waterfront?: { features?: string[]; isWaterfront?: boolean };
  pool?: { features?: string[]; hasPrivatePool?: boolean };
  spa?: { features?: string[]; hasSpa?: boolean };
  fencing?: string[];
  accessibilityFeatures?: string[];
  garageSpaces?: number;
  // HOA extended
  hoaName?: string;
  hoaFeeIncludes?: string[];
  hoaAmenities?: string[];
  hoaPhone?: string;
  // Computed
  isOwnerOccupied?: boolean;
  // Tax (additive)
  taxHistoryNormalized?: Array<{ year?: number; date?: string; taxPaid?: number; assessedValue?: number; valueIncrease?: number }>;
  propertyTaxRate?: number;
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
  /** Set when the property has been run through the motivated-seller scorer.
   *  See src/lib/motivated-seller-score.ts for shape; typed `unknown` here
   *  to avoid a circular dep — consumers should import MotivationResult. */
  motivation?: unknown;
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