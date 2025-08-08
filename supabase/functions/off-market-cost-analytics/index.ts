import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CostAnalytics {
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
  costPerAction: {
    freeDataCollection: number;
    algorithmicFiltering: number;
    apiValidation: number;
    aiAnalysis: number;
    skipTrace: number;
  };
  apiUsageStats: {
    rapidAPIFreeCallsUsed: number;
    rapidAPIFreeCallsRemaining: number;
    rapidAPIPaidCalls: number;
    aiTokensUsed: number;
    averageProcessingTime: string;
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { startDate, endDate } = await req.json();
    
    console.log(`[ANALYTICS] Generating cost analytics for ${startDate} to ${endDate}`);
    
    // Simulate analytics based on ultra-lean strategy
    const analytics: CostAnalytics = {
      dateRange: { startDate, endDate },
      totalQueries: 1420,
      totalCost: 89.50,
      avgCostPerLead: 1.21,
      
      costBreakdown: {
        freeDataSources: 0, // 100% free public data
        rapidAPIValidation: 18.50, // $0.01-0.03 per validation
        aiAnalysis: 59.00, // $0.80 per AI analysis
        skipTracing: 12.00, // $0.02-0.05 per skip trace
      },
      
      efficiency: {
        propertiesProcessed: 18500,
        qualityLeads: 74,
        conversionRate: '0.4%', // 74 leads from 18,500 properties
        roi: '31,200%', // Based on $2,000 avg deal profit
      },
      
      savings: {
        traditional: 5550, // $75 per lead traditional cost
        ultraLean: 89.50,
        savedAmount: 5460.50,
        savingsPercentage: 98.4
      },
      
      monthlyProjections: {
        expectedLeads: 95,
        expectedDeals: 4, // 4.2% close rate
        expectedRevenue: 48000, // $12,000 avg wholesale fee
        monthlyROI: '52,600%'
      },
      
      costPerAction: {
        freeDataCollection: 0,
        algorithmicFiltering: 0,
        apiValidation: 0.013, // $0.013 avg per validation
        aiAnalysis: 0.80, // $0.80 per AI analysis
        skipTrace: 0.024 // $0.024 avg per skip trace
      },
      
      apiUsageStats: {
        rapidAPIFreeCallsUsed: 225,
        rapidAPIFreeCallsRemaining: 25, // 250 total free calls
        rapidAPIPaidCalls: 1195,
        aiTokensUsed: 73750, // ~74k tokens used
        averageProcessingTime: '2.3 seconds'
      }
    };
    
    // Add weekly breakdown for more detail
    const weeklyBreakdown = [
      {
        week: 'Week 1',
        propertiesProcessed: 4200,
        cost: 18.75,
        qualityLeads: 16,
        costPerLead: 1.17
      },
      {
        week: 'Week 2', 
        propertiesProcessed: 4800,
        cost: 23.25,
        qualityLeads: 19,
        costPerLead: 1.22
      },
      {
        week: 'Week 3',
        propertiesProcessed: 4900,
        cost: 24.50,
        qualityLeads: 20,
        costPerLead: 1.23
      },
      {
        week: 'Week 4',
        propertiesProcessed: 4600,
        cost: 23.00,
        qualityLeads: 19,
        costPerLead: 1.21
      }
    ];
    
    const result = {
      ...analytics,
      weeklyBreakdown,
      insights: [
        'Free public data sources provide 91% of initial property leads',
        'AI analysis limited to top 25 properties keeps costs minimal',
        'RapidAPI rotation optimizes for free tier usage first',
        '98.4% cost savings vs traditional lead generation methods',
        'Current cost per lead: $1.21 vs industry average: $75+',
        'Processing 5,000+ properties per week under $25 budget'
      ],
      recommendations: [
        'Enable additional free data sources for 15% more leads',
        'Optimize AI prompts to reduce token usage by 10%',
        'Implement smart API caching to reduce duplicate calls',
        'Add automated lead scoring to prioritize follow-up',
        'Scale to 7,500 properties/week while staying under $40/week'
      ]
    };
    
    console.log(`[ANALYTICS] Generated comprehensive cost analytics - ROI: ${analytics.efficiency.roi}`);
    
    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
    
  } catch (error) {
    console.error('[ERROR] Cost analytics generation failed:', error);
    return new Response(JSON.stringify({ 
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});