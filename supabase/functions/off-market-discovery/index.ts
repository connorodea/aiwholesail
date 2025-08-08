import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface OffMarketSearchParams {
  location: string;
  propertyType: string;
  priceMin?: string;
  priceMax?: string;
  filters: {
    taxDelinquent: boolean;
    foreclosureNotices: boolean;
    codeViolations: boolean;
    buildingPermits: boolean;
    ownerOccupied: boolean;
    highEquity: boolean;
  };
  keywords?: string;
}

interface PropertyLead {
  id: string;
  address: string;
  city: string;
  state: string;
  estimatedValue: number;
  propertyType: string;
  taxDelinquent: boolean;
  foreclosureNotice: boolean;
  codeViolations: boolean;
  buildingPermitsRecent: boolean;
  ownerOccupied: boolean;
  freeDataScore: number;
  validationScore?: number;
  stage: string;
  processingCost: number;
  ownerName?: string;
  phones?: string[];
  emails?: string[];
  aiPriorityRank?: number;
  aiContactStrategy?: string;
  aiOfferRange?: string;
  aiTalkingPoints?: string[];
  createdAt: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { searchParams }: { searchParams: OffMarketSearchParams } = await req.json();
    
    console.log(`[OFF-MARKET] Starting ultra-lean discovery for: ${searchParams.location}`);
    const startTime = Date.now();
    let totalCost = 0;

    // Phase 1: Free Data Collection (Cost: $0)
    console.log('[PHASE 1] Collecting free public data...');
    const freeDataProperties = await collectFreePublicData(searchParams);
    console.log(`[PHASE 1] Collected ${freeDataProperties.length} properties from free sources`);

    // Phase 2: Algorithmic Filtering (Cost: $0) 
    console.log('[PHASE 2] Applying algorithmic filtering...');
    const filteredProperties = algorithmicFiltering(freeDataProperties, searchParams);
    console.log(`[PHASE 2] Filtered to ${filteredProperties.length} high-potential properties`);

    // Phase 3: Cheap API Validation (Cost: $2-10)
    console.log('[PHASE 3] Validating with cheap APIs...');
    const validatedProperties = await cheapAPIValidation(filteredProperties.slice(0, 200));
    totalCost += validatedProperties.length * 0.01; // $0.01 per validation
    console.log(`[PHASE 3] Validated ${validatedProperties.length} properties - Cost: $${(validatedProperties.length * 0.01).toFixed(2)}`);

    // Phase 4: Ultra-Selective AI Analysis (Cost: $10-25)
    console.log('[PHASE 4] AI analyzing top properties...');
    const aiAnalyzedProperties = await ultraSelectiveAI(validatedProperties.slice(0, 25));
    const aiCost = Math.min(validatedProperties.length, 25) * 0.80;
    totalCost += aiCost;
    console.log(`[PHASE 4] AI analyzed ${aiAnalyzedProperties.length} properties - Cost: $${aiCost.toFixed(2)}`);

    const processingTime = Date.now() - startTime;
    
    const result = {
      properties: aiAnalyzedProperties,
      totalProcessed: freeDataProperties.length,
      totalCost: parseFloat(totalCost.toFixed(2)),
      processingTimeMs: processingTime,
      processingStages: {
        freeDataCollection: freeDataProperties.length,
        algorithmicFiltering: filteredProperties.length,
        apiValidation: validatedProperties.length,
        aiAnalysis: aiAnalyzedProperties.length
      },
      costBreakdown: {
        freeData: 0,
        rapidAPI: parseFloat((validatedProperties.length * 0.01).toFixed(2)),
        aiAnalysis: parseFloat(aiCost.toFixed(2)),
        total: parseFloat(totalCost.toFixed(2))
      },
      costPerLead: aiAnalyzedProperties.length > 0 ? parseFloat((totalCost / aiAnalyzedProperties.length).toFixed(2)) : 0,
      savings: {
        traditional: aiAnalyzedProperties.length * 75, // $75 per lead traditional
        ultraLean: totalCost,
        savedAmount: (aiAnalyzedProperties.length * 75) - totalCost,
        savingsPercentage: aiAnalyzedProperties.length > 0 ? 
          parseFloat((((aiAnalyzedProperties.length * 75) - totalCost) / (aiAnalyzedProperties.length * 75) * 100).toFixed(1)) : 0
      }
    };

    console.log(`[COMPLETE] Ultra-lean discovery finished in ${processingTime}ms - Total cost: $${totalCost.toFixed(2)}`);
    console.log(`[SAVINGS] ${result.savings.savingsPercentage}% cost reduction vs traditional methods`);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[ERROR] Off-market discovery failed:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      properties: [],
      totalCost: 0
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function collectFreePublicData(params: OffMarketSearchParams): Promise<PropertyLead[]> {
  // Simulate scraping free public data sources
  // In production, this would integrate with:
  // - County tax assessor websites
  // - Public foreclosure notice databases  
  // - Municipal code enforcement systems
  // - Building permit databases
  
  const mockProperties: PropertyLead[] = [];
  const baseCount = 4500; // Simulate scraping 4500 properties from free sources
  
  const propertyTypes = ['SFR', 'duplex', 'townhome', 'multi-family'];
  const streets = ['Main St', 'Oak Ave', 'Pine Rd', 'Cedar Ln', 'Elm Dr', 'Maple St', 'Birch Ave'];
  
  for (let i = 0; i < baseCount; i++) {
    const property: PropertyLead = {
      id: `free-${i}`,
      address: `${Math.floor(Math.random() * 9999)} ${streets[Math.floor(Math.random() * streets.length)]}`,
      city: params.location.split(',')[0] || 'Denver',
      state: 'CO',
      estimatedValue: Math.floor(Math.random() * 350000) + 50000,
      propertyType: propertyTypes[Math.floor(Math.random() * propertyTypes.length)],
      
      // Realistic distress indicator probabilities
      taxDelinquent: Math.random() < 0.12, // 12% of properties
      foreclosureNotice: Math.random() < 0.04, // 4% of properties  
      codeViolations: Math.random() < 0.08, // 8% of properties
      buildingPermitsRecent: Math.random() < 0.15, // 15% of properties
      ownerOccupied: Math.random() < 0.72, // 72% owner occupied
      
      freeDataScore: 0,
      stage: 'collected',
      processingCost: 0,
      createdAt: new Date().toISOString()
    };
    
    // Calculate free data score
    property.freeDataScore = calculateFreeDataScore(property);
    
    mockProperties.push(property);
  }
  
  return mockProperties;
}

function algorithmicFiltering(properties: PropertyLead[], params: OffMarketSearchParams): PropertyLead[] {
  return properties.filter(property => {
    // Apply user-selected distress filters
    const hasRequiredDistress = (
      (params.filters.taxDelinquent ? property.taxDelinquent : true) &&
      (params.filters.foreclosureNotices ? property.foreclosureNotice : true) &&
      (params.filters.codeViolations ? property.codeViolations : true) &&
      (params.filters.buildingPermits ? property.buildingPermitsRecent : true) &&
      (params.filters.ownerOccupied ? !property.ownerOccupied : true)
    );
    
    // Must have at least one distress indicator
    const hasAnyDistress = property.taxDelinquent || 
                          property.foreclosureNotice || 
                          property.codeViolations || 
                          property.buildingPermitsRecent ||
                          !property.ownerOccupied;
    
    if (!hasAnyDistress) return false;
    
    // Price range filtering
    const minPrice = params.priceMin ? parseInt(params.priceMin) : 50000;
    const maxPrice = params.priceMax ? parseInt(params.priceMax) : 400000;
    if (property.estimatedValue < minPrice || property.estimatedValue > maxPrice) return false;
    
    // Property type filtering
    if (params.propertyType && params.propertyType !== 'all' && property.propertyType !== params.propertyType) {
      return false;
    }
    
    // Minimum distress score threshold
    if (property.freeDataScore < 2) return false;
    
    property.stage = 'filtered';
    return true;
  }).sort((a, b) => b.freeDataScore - a.freeDataScore);
}

async function cheapAPIValidation(properties: PropertyLead[]): Promise<PropertyLead[]> {
  // Simulate validation with RapidAPI sources
  // US Real Estate API, Property Data API, etc.
  
  const validatedProperties: PropertyLead[] = [];
  
  for (const property of properties) {
    // Simulate API call delay
    await new Promise(resolve => setTimeout(resolve, 25));
    
    // 75% validation pass rate (realistic)
    if (Math.random() < 0.75) {
      property.validationScore = Math.floor(Math.random() * 40) + 60; // Score 60-100
      property.stage = 'validated';
      property.processingCost += 0.01; // $0.01 per API call
      
      // Add mock owner data
      property.ownerName = `Owner ${Math.floor(Math.random() * 1000)}`;
      
      validatedProperties.push(property);
    }
  }
  
  return validatedProperties.sort((a, b) => (b.validationScore || 0) - (a.validationScore || 0));
}

async function ultraSelectiveAI(properties: PropertyLead[]): Promise<PropertyLead[]> {
  // Only analyze top 25 properties to minimize AI costs
  const topProperties = properties.slice(0, 25);
  
  const contactStrategies = ['call', 'text', 'mail', 'door-knock'];
  const talkingPointsList = [
    ['Property shows clear distress signals', 'Quick cash offer available', 'No realtor commissions'],
    ['Tax situation creating urgency', 'We can close in 7-14 days', 'All-cash purchase'],
    ['Maintenance issues adding up', 'As-is purchase - no repairs needed', 'Fast closing process'],
    ['Market timing is perfect to sell', 'Competitive cash offer', 'No showings or open houses']
  ];
  
  for (let i = 0; i < topProperties.length; i++) {
    const property = topProperties[i];
    
    // Simulate AI analysis processing time
    await new Promise(resolve => setTimeout(resolve, 50));
    
    property.aiPriorityRank = i + 1;
    property.aiContactStrategy = contactStrategies[Math.floor(Math.random() * contactStrategies.length)];
    property.aiOfferRange = `$${Math.floor(property.estimatedValue * 0.65).toLocaleString()} - $${Math.floor(property.estimatedValue * 0.80).toLocaleString()}`;
    property.aiTalkingPoints = talkingPointsList[Math.floor(Math.random() * talkingPointsList.length)];
    property.stage = 'ai_analyzed';
    property.processingCost += 0.80; // $0.80 per AI analysis
    
    // Add mock contact info (skip trace simulation)
    property.phones = [`(555) ${Math.floor(Math.random() * 900) + 100}-${Math.floor(Math.random() * 9000) + 1000}`];
    property.emails = [`owner${Math.floor(Math.random() * 1000)}@email.com`];
  }
  
  return topProperties;
}

function calculateFreeDataScore(property: PropertyLead): number {
  let score = 0;
  
  // Weighted scoring based on distress indicator importance
  if (property.taxDelinquent) score += 4; // Highest priority
  if (property.foreclosureNotice) score += 5; // Highest urgency
  if (property.codeViolations) score += 2; // Moderate priority
  if (property.buildingPermitsRecent) score += 1; // Lower priority
  if (!property.ownerOccupied) score += 3; // High priority for investors
  
  // Bonus points for multiple indicators
  const indicatorCount = [
    property.taxDelinquent,
    property.foreclosureNotice,
    property.codeViolations,
    property.buildingPermitsRecent,
    !property.ownerOccupied
  ].filter(Boolean).length;
  
  if (indicatorCount >= 2) score += 2;
  if (indicatorCount >= 3) score += 4;
  if (indicatorCount >= 4) score += 6;
  
  return score;
}