import { supabase } from "@/integrations/supabase/client";

export interface OffMarketSearchParams {
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

export interface OffMarketProperty {
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
  createdAt: Date;
}

export interface OffMarketSearchResult {
  properties: OffMarketProperty[];
  totalProcessed: number;
  totalCost: number;
  processingTimeMs: number;
  processingStages: {
    freeDataCollection: number;
    algorithmicFiltering: number;
    apiValidation: number;
    aiAnalysis: number;
  };
  costBreakdown: {
    freeData: number;
    rapidAPI: number;
    aiAnalysis: number;
    total: number;
  };
  costPerLead: number;
  savings: {
    traditional: number;
    ultraLean: number;
    savedAmount: number;
    savingsPercentage: number;
  };
}

export interface CostAnalytics {
  dateRange: {
    startDate: string;
    endDate: string;
  };
  totalQueries: number;
  totalCost: number;
  avgCostPerLead: number;
  costBreakdown: {
    freeDataSources: number;
    rapidAPIValidation: number;
    aiAnalysis: number;
    skipTracing: number;
  };
  efficiency: {
    propertiesProcessed: number;
    qualityLeads: number;
    conversionRate: string;
    roi: string;
  };
  savings: {
    traditional: number;
    ultraLean: number;
    savedAmount: number;
    savingsPercentage: number;
  };
  monthlyProjections: {
    expectedLeads: number;
    expectedDeals: number;
    expectedRevenue: number;
    monthlyROI: string;
  };
  weeklyBreakdown: Array<{
    week: string;
    propertiesProcessed: number;
    cost: number;
    qualityLeads: number;
    costPerLead: number;
  }>;
  insights: string[];
  recommendations: string[];
}

class OffMarketAPI {
  async searchOffMarketProperties(params: OffMarketSearchParams): Promise<OffMarketSearchResult> {
    try {
      console.log('[OFF-MARKET API] Initiating ultra-lean discovery...', params);
      
      const response = await supabase.functions.invoke('off-market-discovery', {
        body: { searchParams: params }
      });

      if (response.error) {
        throw new Error(response.error.message || 'Failed to search off-market properties');
      }

      // Convert date strings back to Date objects
      const result = response.data;
      if (result.properties) {
        result.properties = result.properties.map((property: any) => ({
          ...property,
          createdAt: new Date(property.createdAt)
        }));
      }

      console.log('[OFF-MARKET API] Search completed successfully:', {
        properties: result.properties?.length || 0,
        totalCost: result.totalCost,
        savings: result.savings?.savingsPercentage || 0
      });

      return result;
    } catch (error) {
      console.error('[OFF-MARKET API] Search failed:', error);
      throw new Error(error instanceof Error ? error.message : 'Search failed');
    }
  }

  async getCostAnalytics(startDate: string, endDate: string): Promise<CostAnalytics> {
    try {
      console.log('[OFF-MARKET API] Fetching cost analytics...', { startDate, endDate });
      
      const response = await supabase.functions.invoke('off-market-cost-analytics', {
        body: { startDate, endDate }
      });

      if (response.error) {
        throw new Error(response.error.message || 'Failed to fetch cost analytics');
      }

      console.log('[OFF-MARKET API] Cost analytics fetched successfully');
      return response.data;
    } catch (error) {
      console.error('[OFF-MARKET API] Cost analytics failed:', error);
      throw new Error(error instanceof Error ? error.message : 'Analytics fetch failed');
    }
  }

  // Helper method to calculate ROI
  calculateROI(totalCost: number, expectedDeals: number, avgDealProfit: number = 12000): string {
    if (totalCost === 0) return '∞%';
    const revenue = expectedDeals * avgDealProfit;
    const roi = ((revenue - totalCost) / totalCost) * 100;
    return `${Math.round(roi).toLocaleString()}%`;
  }

  // Helper method to format cost
  formatCost(cost: number): string {
    return `$${cost.toFixed(2)}`;
  }

  // Helper method to calculate cost per lead efficiency
  getCostEfficiencyGrade(costPerLead: number): { grade: string; color: string } {
    if (costPerLead <= 1.00) return { grade: 'A+', color: 'text-green-600' };
    if (costPerLead <= 2.00) return { grade: 'A', color: 'text-green-500' };
    if (costPerLead <= 5.00) return { grade: 'B', color: 'text-blue-500' };
    if (costPerLead <= 10.00) return { grade: 'C', color: 'text-yellow-500' };
    return { grade: 'D', color: 'text-red-500' };
  }
}

export const offMarketAPI = new OffMarketAPI();