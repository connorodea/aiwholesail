export interface BuyerCriteria {
  propertyTypes: string[];
  minPrice: number | null;
  maxPrice: number | null;
  locations: string[];
  minBedrooms: number | null;
  maxBedrooms: number | null;
  minSqft: number | null;
  maxSqft: number | null;
  rehabTolerance: 'none' | 'light' | 'moderate' | 'heavy' | 'full-gut';
  preferredReturnRate: number | null;
}

export interface Buyer {
  id: string;
  userId: string;
  firstName: string;
  lastName: string;
  company: string | null;
  email: string | null;
  phone: string | null;
  criteria: BuyerCriteria;
  tags: string[];
  notes: string | null;
  dealCount: number;
  lastContactedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface BuyerMatch {
  buyer: Buyer;
  matchScore: number;
  matchReasons: string[];
}

export const DEFAULT_BUYER_CRITERIA: BuyerCriteria = {
  propertyTypes: [],
  minPrice: null,
  maxPrice: null,
  locations: [],
  minBedrooms: null,
  maxBedrooms: null,
  minSqft: null,
  maxSqft: null,
  rehabTolerance: 'moderate',
  preferredReturnRate: null,
};

export const REHAB_TOLERANCE_OPTIONS = [
  { value: 'none', label: 'None (Turnkey only)' },
  { value: 'light', label: 'Light (Cosmetic)' },
  { value: 'moderate', label: 'Moderate' },
  { value: 'heavy', label: 'Heavy' },
  { value: 'full-gut', label: 'Full Gut Rehab' },
] as const;

export const COMMON_TAGS = [
  'Cash Buyer',
  'Fix & Flip',
  'Buy & Hold',
  'Landlord',
  'Developer',
  'Wholesaler',
  'First-Time Buyer',
  'Repeat Buyer',
  'Out of State',
  'Local',
] as const;

export const PROPERTY_TYPE_OPTIONS = [
  'Single Family',
  'Multi-Family',
  'Townhome',
  'Condo',
  'Duplex',
  'Triplex',
  'Fourplex',
  'Land',
  'Commercial',
] as const;
