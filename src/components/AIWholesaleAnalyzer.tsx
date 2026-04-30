import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { useToast } from '@/hooks/use-toast';
import { ai } from '@/lib/api-client';
import { Property } from '@/types/zillow';
import { 
  Brain, 
  TrendingUp, 
  DollarSign, 
  Home, 
  Calculator, 
  Phone, 
  Mail, 
  AlertTriangle,
  CheckCircle,
  ExternalLink,
  Download
} from 'lucide-react';

interface AnalysisParams {
  target_fee: number;
  repair_cost_psf_low: number;
  repair_cost_psf_high: number;
  min_spread_pct: number;
  max_candidates: number;
  exit_preferences: string;
}

interface WholesaleOpportunity {
  rank: number;
  zpid: string;
  address: string;
  list_price: number;
  zestimate: number;
  spread_abs: number;
  spread_pct: number;
  arv_final: number;
  repairs: {
    low: number;
    mid: number;
    high: number;
    notes: string[];
  };
  closing_costs_est: number;
  mao: number;
  flip_margin: number;
  rental: {
    est_rent: number;
    taxes: number;
    insurance: number;
    hoa: number;
    cap_rate_pct: number;
    dscr: number;
  };
  risk_flags: string[];
  score: number;
  exit: string;
  agent: {
    name: string;
    phone: string;
    brokerage: string;
  };
  sources: Array<{
    type: string;
    urls: string[];
  }>;
  next_actions: {
    call_script: string;
    email_copy: string;
    offer_price_first: number;
    offer_price_ceiling_MAO: number;
  };
}

interface AnalysisResult {
  market: string;
  generated_at_utc: string;
  assumptions: {
    target_fee: number;
    repair_cost_psf_range: { low: number; high: number };
    closing_costs_pct: number;
    mao_rule_pct_of_arv: number;
    min_spread_pct: number;
  };
  ranked_opportunities: WholesaleOpportunity[];
}

interface AIWholesaleAnalyzerProps {
  properties: Property[];
  market: string;
}

export function AIWholesaleAnalyzer({ properties, market }: AIWholesaleAnalyzerProps) {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [analysisParams, setAnalysisParams] = useState<AnalysisParams>({
    target_fee: 10000,
    repair_cost_psf_low: 25,
    repair_cost_psf_high: 60,
    min_spread_pct: 0.20,
    max_candidates: 25,
    exit_preferences: 'any'
  });
  
  const { toast } = useToast();

  const handleAnalyze = async () => {
    if (properties.length === 0) {
      toast({
        title: "No Properties",
        description: "Please search for properties first before running analysis.",
        variant: "destructive"
      });
      return;
    }

    setIsAnalyzing(true);
    
    try {
      // Filter properties to only include those with high spreads (positive difference between zestimate and list price)
      const highSpreadProperties = properties.filter(property => {
        if (!property.zestimate || !property.price) return false;
        const spread = property.zestimate - property.price;
        const spreadPct = spread / property.zestimate;
        // Only include properties with at least 10% positive spread
        return spreadPct >= 0.10 && spread > 5000;
      });

      if (highSpreadProperties.length === 0) {
        toast({
          title: "No High Spread Properties",
          description: "No properties found with significant positive spread between Zestimate and list price.",
          variant: "destructive"
        });
        return;
      }

      // Convert high spread properties to CSV format for analysis
      const csvData = highSpreadProperties.map(property => ({
        zpid: property.zpid,
        address: property.address,
        city: property.city,
        state: property.state,
        zip: property.zipcode,
        list_price: property.price,
        zestimate: property.zestimate,
        beds: property.bedrooms,
        baths: property.bathrooms,
        sqft: property.livingArea,
        lot_sqft: property.lotAreaValue,
        property_type: property.homeType,
        days_on_zillow: property.daysOnZillow,
        url: property.detailUrl
      }));

      const response = await ai.wholesaleAnalyzer({
        market,
        csv_data: csvData,
        analysis_params: analysisParams
      });

      if (response.error) {
        console.error('Analysis error:', response.error);
        toast({
          title: "Analysis Failed",
          description: response.error || "Failed to analyze wholesale opportunities.",
          variant: "destructive"
        });
        return;
      }

      setAnalysisResult(response.data as any);
      toast({
        title: "Analysis Complete",
        description: `Found ${(response.data as any).ranked_opportunities.length} actionable investment opportunities.`,
      });

    } catch (error) {
      console.error('Analysis error:', error);
      toast({
        title: "Analysis Failed",
        description: "An error occurred during analysis. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const downloadCSV = () => {
    if (!analysisResult) return;

    const csvHeaders = [
      'Rank', 'Address', 'List Price', 'Zestimate', 'Spread $', 'Spread %', 
      'ARV', 'Repair Est.', 'MAO', 'Flip Margin', 'Score', 'Exit Strategy',
      'Agent Name', 'Agent Phone', 'Risk Flags'
    ];

    const csvData = analysisResult.ranked_opportunities.map(opp => [
      opp.rank,
      opp.address,
      opp.list_price,
      opp.zestimate,
      opp.spread_abs,
      (opp.spread_pct * 100).toFixed(1) + '%',
      opp.arv_final,
      opp.repairs.mid,
      opp.mao,
      opp.flip_margin,
      opp.score.toFixed(2),
      opp.exit,
      opp.agent.name,
      opp.agent.phone,
      opp.risk_flags.join('; ')
    ]);

    const csvContent = [csvHeaders, ...csvData]
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `deal-opportunities-${market}-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <Card className="simple-card">
      <CardHeader className="pb-4 sm:pb-6">
        <CardTitle className="flex items-center gap-2 sm:gap-3 text-xl sm:text-2xl text-foreground">
          <Brain className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
          AI Deal Analyzer
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Advanced AI analysis to identify the best investment opportunities with defensible numbers, ARV calculations, and contact strategies.
        </p>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Analysis Parameters */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label>Target Wholesale Fee</Label>
            <Input
              type="number"
              value={analysisParams.target_fee}
              onChange={(e) => setAnalysisParams(prev => ({ 
                ...prev, 
                target_fee: Number(e.target.value) 
              }))}
              className="bg-background/50"
            />
          </div>
          
          <div className="space-y-2">
            <Label>Repair Cost ($/sqft) Low</Label>
            <Input
              type="number"
              value={analysisParams.repair_cost_psf_low}
              onChange={(e) => setAnalysisParams(prev => ({ 
                ...prev, 
                repair_cost_psf_low: Number(e.target.value) 
              }))}
              className="bg-background/50"
            />
          </div>
          
          <div className="space-y-2">
            <Label>Repair Cost ($/sqft) High</Label>
            <Input
              type="number"
              value={analysisParams.repair_cost_psf_high}
              onChange={(e) => setAnalysisParams(prev => ({ 
                ...prev, 
                repair_cost_psf_high: Number(e.target.value) 
              }))}
              className="bg-background/50"
            />
          </div>
          
          <div className="space-y-2">
            <Label>Min Spread % (0.20 = 20%)</Label>
            <Input
              type="number"
              step="0.01"
              value={analysisParams.min_spread_pct}
              onChange={(e) => setAnalysisParams(prev => ({ 
                ...prev, 
                min_spread_pct: Number(e.target.value) 
              }))}
              className="bg-background/50"
            />
          </div>
          
          <div className="space-y-2">
            <Label>Max Candidates</Label>
            <Input
              type="number"
              value={analysisParams.max_candidates}
              onChange={(e) => setAnalysisParams(prev => ({ 
                ...prev, 
                max_candidates: Number(e.target.value) 
              }))}
              className="bg-background/50"
            />
          </div>
        </div>

        {/* Analyze Button */}
        <Button
          onClick={handleAnalyze}
          disabled={isAnalyzing || properties.length === 0}
          size="lg"
          className="w-full h-12"
        >
          {isAnalyzing ? (
            <>
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary-foreground mr-3" />
              Analyzing {properties.length} Properties...
            </>
          ) : (
            <>
              <Brain className="h-5 w-5 mr-3" />
              Analyze {properties.length} Properties
            </>
          )}
        </Button>

        {/* Analysis Results */}
        {analysisResult && (
          <div className="space-y-6">
            <Separator />
            
            {/* Header with Export */}
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-foreground">
                  Analysis Results for {analysisResult.market}
                </h3>
                <p className="text-sm text-muted-foreground">
                  Generated: {new Date(analysisResult.generated_at_utc).toLocaleString()}
                </p>
              </div>
              <Button onClick={downloadCSV} variant="outline" size="sm">
                <Download className="h-4 w-4 mr-2" />
                Export CSV
              </Button>
            </div>

            {/* Summary Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <Card className="simple-card p-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-primary">
                    {analysisResult.ranked_opportunities.length}
                  </div>
                  <div className="text-sm text-muted-foreground">Opportunities</div>
                </div>
              </Card>
              
              <Card className="simple-card p-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-primary">
                    {formatCurrency(analysisResult.assumptions.target_fee)}
                  </div>
                  <div className="text-sm text-muted-foreground">Target Fee</div>
                </div>
              </Card>
              
              <Card className="simple-card p-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-primary">
                    {(analysisResult.assumptions.min_spread_pct * 100).toFixed(0)}%
                  </div>
                  <div className="text-sm text-muted-foreground">Min Spread</div>
                </div>
              </Card>
              
              <Card className="simple-card p-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-primary">
                    {(analysisResult.assumptions.mao_rule_pct_of_arv * 100).toFixed(0)}%
                  </div>
                  <div className="text-sm text-muted-foreground">MAO Rule</div>
                </div>
              </Card>
            </div>

            {/* Opportunities List */}
            <Accordion type="single" collapsible className="space-y-4">
              {analysisResult.ranked_opportunities.map((opportunity) => (
                <AccordionItem 
                  key={opportunity.zpid} 
                  value={opportunity.zpid}
                  className="border simple-border rounded-lg"
                >
                  <AccordionTrigger className="hover:no-underline px-4 py-3">
                    <div className="flex items-center justify-between w-full text-left">
                      <div className="flex items-center gap-3">
                        <Badge variant="default" className="text-xs">
                          #{opportunity.rank}
                        </Badge>
                        <div>
                          <div className="font-semibold text-foreground">
                            {opportunity.address}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {formatCurrency(opportunity.list_price)} • 
                            Spread: {formatCurrency(opportunity.spread_abs)} ({(opportunity.spread_pct * 100).toFixed(1)}%)
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold text-primary">
                          MAO: {formatCurrency(opportunity.mao)}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          Score: {opportunity.score.toFixed(2)}
                        </div>
                      </div>
                    </div>
                  </AccordionTrigger>
                  
                  <AccordionContent className="px-4 pb-4">
                    <div className="space-y-4">
                      {/* Key Metrics */}
                      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                        <div className="space-y-1">
                          <div className="text-sm text-muted-foreground">ARV</div>
                          <div className="font-semibold text-foreground">
                            {formatCurrency(opportunity.arv_final)}
                          </div>
                        </div>
                        <div className="space-y-1">
                          <div className="text-sm text-muted-foreground">Repair Est.</div>
                          <div className="font-semibold text-foreground">
                            {formatCurrency(opportunity.repairs.mid)}
                          </div>
                        </div>
                        <div className="space-y-1">
                          <div className="text-sm text-muted-foreground">Flip Margin</div>
                          <div className="font-semibold text-foreground">
                            {formatCurrency(opportunity.flip_margin)}
                          </div>
                        </div>
                        <div className="space-y-1">
                          <div className="text-sm text-muted-foreground">Exit Strategy</div>
                          <Badge variant="secondary" className="text-xs">
                            {opportunity.exit}
                          </Badge>
                        </div>
                      </div>

                      {/* Risk Flags */}
                      {opportunity.risk_flags.length > 0 && (
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                            <AlertTriangle className="h-4 w-4" />
                            Risk Flags
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {opportunity.risk_flags.map((flag, idx) => (
                              <Badge key={idx} variant="destructive" className="text-xs">
                                {flag}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Agent Contact */}
                      <div className="space-y-2">
                        <div className="text-sm font-medium text-muted-foreground">
                          Agent Contact
                        </div>
                        <div className="bg-muted/50 rounded-lg p-3 space-y-2">
                          <div className="flex items-center gap-2">
                            <Home className="h-4 w-4 text-primary" />
                            <span className="text-sm text-foreground">
                              {opportunity.agent.name} - {opportunity.agent.brokerage}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Phone className="h-4 w-4 text-primary" />
                            <span className="text-sm text-foreground">
                              {opportunity.agent.phone}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Next Actions */}
                      <div className="space-y-3">
                        <div className="text-sm font-medium text-muted-foreground">
                          Recommended Actions
                        </div>
                        
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <div className="text-xs font-medium text-muted-foreground">
                              Initial Offer: {formatCurrency(opportunity.next_actions.offer_price_first)}
                            </div>
                            <div className="text-xs font-medium text-muted-foreground">
                              Max Offer: {formatCurrency(opportunity.next_actions.offer_price_ceiling_MAO)}
                            </div>
                          </div>
                        </div>

                        <div className="bg-muted/50 rounded-lg p-3 space-y-2">
                          <div className="text-xs font-medium text-muted-foreground">Call Script</div>
                          <div className="text-sm text-foreground">
                            {opportunity.next_actions.call_script}
                          </div>
                        </div>

                        <div className="bg-muted/50 rounded-lg p-3 space-y-2">
                          <div className="text-xs font-medium text-muted-foreground">Email Template</div>
                          <div className="text-sm text-foreground">
                            {opportunity.next_actions.email_copy}
                          </div>
                        </div>
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        )}
      </CardContent>
    </Card>
  );
}