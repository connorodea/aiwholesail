import { useState, useEffect } from 'react';
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
    repair_cost_psf_range?: { low: number; high: number };
    closing_costs_pct?: number;
    mao_rule_pct_of_arv: number;
    min_spread_pct: number;
  };
  ranked_opportunities: WholesaleOpportunity[];
  // Optional fields populated only when Claude returned prose instead of
  // structured JSON. The render path surfaces a useful empty-state in this case.
  raw_analysis?: string;
  analysis_timestamp?: string;
  deals?: unknown[];
}

interface AIWholesaleAnalyzerProps {
  properties: Property[];
  market: string;
}

export function AIWholesaleAnalyzer({ properties, market }: AIWholesaleAnalyzerProps) {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);

  // Tick elapsed seconds while analysis is running so the loading button
  // shows real progress instead of an opaque spinner.
  useEffect(() => {
    if (!isAnalyzing) {
      setElapsed(0);
      return;
    }
    const start = Date.now();
    const id = setInterval(() => setElapsed(Math.floor((Date.now() - start) / 1000)), 1000);
    return () => clearInterval(id);
  }, [isAnalyzing]);
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

      // Parse the AI response — it returns { response: "JSON string", type: "batch" }
      const data = response.data as any;
      let parsed = data;
      if (data?.response && typeof data.response === 'string') {
        try {
          // Extract JSON from markdown code blocks if present
          let jsonStr = data.response;
          if (jsonStr.includes('```')) {
            jsonStr = jsonStr.replace(/```json\n?/g, '').replace(/```\n?/g, '');
          }
          parsed = JSON.parse(jsonStr.trim());
        } catch {
          // If can't parse as JSON, show the raw text
          parsed = { raw_analysis: data.response, deals: [], ranked_opportunities: [] };
        }
      }

      // Transform new Claude format (deals[]) to old format (ranked_opportunities[]) if needed.
      // CRITICAL: every field the Accordion render dereferences must be populated
      // here with a safe default — Claude can legitimately omit fields like
      // `repairs`, `agent`, `risk_flags`, `next_actions` from a deal entry, and
      // a naked dereference on the render side will throw, unmount the subtree,
      // and (without an ErrorBoundary above) take down the whole app.
      if (parsed.deals && !parsed.ranked_opportunities) {
        const targetFee = analysisParams.target_fee || 10000;
        parsed.ranked_opportunities = parsed.deals.map((deal: any, i: number) => {
          const listPrice = deal.property_details?.list_price || deal.list_price || 0;
          const zest = deal.property_details?.zestimate || deal.zestimate || 0;
          const repairMid = deal.repair_estimate?.total_repair_estimate || deal.estimated_repairs || 0;
          const arv = deal.arv_calculation?.estimated_arv || deal.estimated_arv || zest || 0;
          const mao = deal.mao_calculation?.mao_rounded || deal.mao_calculation?.mao || deal.mao || 0;
          const dealAddress = deal.address || deal.property_details?.address || '';

          // Match Claude's deal back to the original Zillow property so we
          // can populate agent contact info. Claude isn't sent the agent
          // fields and would hallucinate them if asked, so we merge from
          // source data instead.
          const originalProperty = properties.find(p =>
            (deal.zpid && p.zpid === deal.zpid) ||
            (dealAddress && p.address === dealAddress)
          );
          const agentName = originalProperty?.agentName || '';
          const agentPhone = originalProperty?.agentPhone || originalProperty?.brokerPhone || '';
          const brokerage = originalProperty?.brokerageName || originalProperty?.brokerName || '';

          // Wholesaler standard: first offer ≈ 85% of MAO, ceiling = MAO.
          // Falls back to 0 if MAO is 0 so the UI hides nonsense numbers.
          const offerFirst = mao > 0 ? Math.round(mao * 0.85) : 0;
          const offerCeiling = mao;

          // Flip margin = profit to the end flipper.
          //   ARV − (MAO + assignment fee) − repairs − ~9% all-in closing costs
          // Floors at 0 to avoid negative display.
          const flipMargin = mao > 0 && arv > 0
            ? Math.max(0, Math.round(arv - mao - repairMid - arv * 0.09 - targetFee))
            : 0;

          // Templated outreach copy. We don't ask Claude to write these:
          // (a) burns tokens, (b) Claude hallucinates seller motivation.
          // The user can edit before sending — this is a starting point.
          const shortAddr = dealAddress.split(',')[0] || dealAddress || 'the property';
          const greeting = agentName ? `Hi ${agentName.split(' ')[0]}` : 'Hi there';
          const callScript = mao > 0
            ? `${greeting}, I'm a local cash investor and came across your listing at ${shortAddr}. I run numbers on rehab projects in this area and I can offer $${offerFirst.toLocaleString()} as a starting point — cash, 14-day close, no inspection contingencies. Open to a quick call to discuss?`
            : '';
          const emailCopy = mao > 0
            ? `Subject: Cash offer — ${shortAddr}\n\n${greeting},\n\nI'm a local investor focused on rehab properties. I've reviewed ${shortAddr} and can move quickly with a cash offer starting at $${offerFirst.toLocaleString()}, 14-day close, as-is.\n\nMy ceiling is around $${offerCeiling.toLocaleString()} depending on inspection. Happy to send proof of funds and a clean contract today.\n\nIf the seller is open to a fast, clean exit, please let me know a good time to talk.\n\nThanks,\n[Your name]`
            : '';

          return {
            rank: deal.rank || i + 1,
            zpid: deal.zpid || dealAddress || `deal-${i}`,
            address: dealAddress || 'Unknown',
            list_price: listPrice,
            zestimate: zest,
            estimated_arv: arv,
            arv_final: arv,
            estimated_repairs: repairMid,
            mao,
            wholesale_fee: deal.profit_analysis?.if_purchased_at_mao?.recommended_assignment_fee || targetFee,
            deal_score: deal.deal_score || deal.summary?.deal_score || 50,
            recommendation: deal.recommendation || deal.summary?.recommendation || 'Review',
            notes: deal.summary?.one_liner || deal.one_liner || '',
            spread_abs: typeof deal.spread_abs === 'number' ? deal.spread_abs : (zest - listPrice),
            spread_pct: typeof deal.spread_pct === 'number'
              ? deal.spread_pct
              : (listPrice > 0 ? (zest - listPrice) / listPrice : 0),
            repairs: deal.repairs && typeof deal.repairs === 'object'
              ? {
                  low: typeof deal.repairs.low === 'number' ? deal.repairs.low : 0,
                  mid: typeof deal.repairs.mid === 'number' ? deal.repairs.mid : repairMid,
                  high: typeof deal.repairs.high === 'number' ? deal.repairs.high : 0,
                }
              : { low: 0, mid: repairMid, high: 0 },
            flip_margin: typeof deal.flip_margin === 'number' && deal.flip_margin > 0 ? deal.flip_margin : flipMargin,
            score: typeof deal.score === 'number'
              ? deal.score
              : (typeof deal.deal_score === 'number' ? deal.deal_score / 100 : 0.5),
            exit: deal.exit || deal.recommendation || 'wholesale',
            risk_flags: Array.isArray(deal.risk_flags) ? deal.risk_flags : [],
            agent: deal.agent && typeof deal.agent === 'object'
              ? {
                  name: deal.agent.name || agentName,
                  phone: deal.agent.phone || agentPhone,
                  brokerage: deal.agent.brokerage || brokerage,
                }
              : { name: agentName, phone: agentPhone, brokerage },
            next_actions: deal.next_actions && typeof deal.next_actions === 'object'
              ? {
                  offer_price_first: typeof deal.next_actions.offer_price_first === 'number' && deal.next_actions.offer_price_first > 0
                    ? deal.next_actions.offer_price_first
                    : offerFirst,
                  offer_price_ceiling_MAO: typeof deal.next_actions.offer_price_ceiling_MAO === 'number' && deal.next_actions.offer_price_ceiling_MAO > 0
                    ? deal.next_actions.offer_price_ceiling_MAO
                    : offerCeiling,
                  call_script: deal.next_actions.call_script || callScript,
                  email_copy: deal.next_actions.email_copy || emailCopy,
                }
              : { offer_price_first: offerFirst, offer_price_ceiling_MAO: offerCeiling, call_script: callScript, email_copy: emailCopy },
          };
        });
        parsed.market = parsed.market || market;
        parsed.generated_at_utc = parsed.analysis_timestamp || new Date().toISOString();
        parsed.assumptions = parsed.assumptions || {
          target_fee: analysisParams.target_fee || 10000,
          min_spread_pct: analysisParams.min_spread_pct || 0.2,
          mao_rule_pct_of_arv: 0.7,
        };
      }

      // Handle raw text response (no JSON parsed)
      if (parsed.raw_analysis && (!parsed.ranked_opportunities || parsed.ranked_opportunities.length === 0)) {
        parsed.ranked_opportunities = [];
        parsed.market = market;
        parsed.generated_at_utc = new Date().toISOString();
        parsed.assumptions = { target_fee: analysisParams.target_fee || 10000, min_spread_pct: analysisParams.min_spread_pct || 0.2, mao_rule_pct_of_arv: 0.7 };
      }

      // Defensive normalization — guarantees the result has the four fields
      // the render path dereferences directly (ranked_opportunities.length,
      // assumptions.target_fee, etc.). Without this, any Claude response that
      // returns valid JSON but is missing a key (e.g. just `{"error": "..."}` or
      // a truncated payload) crashes the render subtree and the user sees a
      // blank screen instead of either a result or an error toast.
      if (!Array.isArray(parsed.ranked_opportunities)) parsed.ranked_opportunities = [];
      if (typeof parsed.market !== 'string') parsed.market = market || 'Unknown market';
      if (typeof parsed.generated_at_utc !== 'string') {
        parsed.generated_at_utc = parsed.analysis_timestamp || new Date().toISOString();
      }
      if (!parsed.assumptions || typeof parsed.assumptions !== 'object') {
        parsed.assumptions = {};
      }
      const a = parsed.assumptions;
      if (typeof a.target_fee !== 'number') a.target_fee = analysisParams.target_fee || 10000;
      if (typeof a.min_spread_pct !== 'number') a.min_spread_pct = analysisParams.min_spread_pct || 0.2;
      if (typeof a.mao_rule_pct_of_arv !== 'number') a.mao_rule_pct_of_arv = 0.7;

      setAnalysisResult(parsed);
      const dealCount = parsed?.ranked_opportunities?.length || parsed?.deals?.length || data?.count || 0;
      toast({
        title: "Analysis Complete",
        description: `Analyzed ${dealCount} investment opportunities.`,
      });

    } catch (error) {
      console.error('Analysis error:', error);
      const msg = error instanceof Error ? error.message : 'An error occurred during analysis. Please try again.';
      toast({
        title: "Analysis Failed",
        description: msg,
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

    const csvData = (analysisResult.ranked_opportunities || []).map(opp => [
      opp.rank,
      opp.address,
      opp.list_price,
      opp.zestimate,
      opp.spread_abs,
      typeof opp.spread_pct === 'number' ? (opp.spread_pct * 100).toFixed(1) + '%' : '',
      opp.arv_final,
      opp.repairs?.mid,
      opp.mao,
      opp.flip_margin,
      typeof opp.score === 'number' ? opp.score.toFixed(2) : '',
      opp.exit,
      opp.agent?.name,
      opp.agent?.phone,
      Array.isArray(opp.risk_flags) ? opp.risk_flags.join('; ') : ''
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
        <div className="space-y-2">
          <Button
            onClick={handleAnalyze}
            disabled={isAnalyzing || properties.length === 0}
            size="lg"
            className="w-full h-12"
          >
            {isAnalyzing ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary-foreground mr-3" />
                Analyzing {properties.length} {properties.length === 1 ? 'Property' : 'Properties'}…
                <span className="ml-3 font-mono text-xs opacity-80 tabular-nums">
                  {Math.floor(elapsed / 60) > 0 ? `${Math.floor(elapsed / 60)}m ${(elapsed % 60).toString().padStart(2, '0')}s` : `${elapsed}s`}
                </span>
              </>
            ) : (
              <>
                <Brain className="h-5 w-5 mr-3" />
                Analyze {properties.length} Properties
              </>
            )}
          </Button>
          {isAnalyzing && (
            <p className="text-xs text-muted-foreground text-center leading-relaxed">
              Claude is working through each property — ARV, repair, MAO, and deal score. This usually takes <span className="text-cyan-400">60–120 seconds</span> for {properties.length} properties. Hang tight.
            </p>
          )}
        </div>

        {/* Analysis Results — every dereference below is optional-chained so a
            malformed analysisResult can never crash the render subtree. */}
        {analysisResult && (() => {
          const opps = analysisResult.ranked_opportunities || [];
          const a = analysisResult.assumptions || {} as Partial<AnalysisResult['assumptions']>;
          const generatedAt = analysisResult.generated_at_utc
            ? new Date(analysisResult.generated_at_utc)
            : null;
          return (
          <div className="space-y-6">
            <Separator />

            {/* Header with Export */}
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-foreground">
                  Analysis Results{analysisResult.market ? ` for ${analysisResult.market}` : ''}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {generatedAt && !isNaN(generatedAt.getTime())
                    ? `Generated: ${generatedAt.toLocaleString()}`
                    : 'Just now'}
                </p>
              </div>
              <Button onClick={downloadCSV} variant="outline" size="sm" disabled={opps.length === 0}>
                <Download className="h-4 w-4 mr-2" />
                Export CSV
              </Button>
            </div>

            {/* Empty-state callout when Claude returned a malformed or zero-deal
                response — replaces the silent blank screen that previously
                rendered when ranked_opportunities was undefined or [] */}
            {opps.length === 0 && (
              <Card className="simple-card p-6 text-center">
                <p className="text-sm text-muted-foreground">
                  No qualifying deals in this batch. {analysisResult.raw_analysis
                    ? 'Claude returned an explanation instead of structured deals — try with different properties or relax the spread / repair filters.'
                    : 'Try increasing your max candidates or relaxing the min-spread filter.'}
                </p>
              </Card>
            )}

            {/* Summary Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <Card className="simple-card p-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-primary">
                    {opps.length}
                  </div>
                  <div className="text-sm text-muted-foreground">Opportunities</div>
                </div>
              </Card>

              <Card className="simple-card p-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-primary">
                    {formatCurrency(a.target_fee ?? 10000)}
                  </div>
                  <div className="text-sm text-muted-foreground">Target Fee</div>
                </div>
              </Card>

              <Card className="simple-card p-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-primary">
                    {((a.min_spread_pct ?? 0.2) * 100).toFixed(0)}%
                  </div>
                  <div className="text-sm text-muted-foreground">Min Spread</div>
                </div>
              </Card>

              <Card className="simple-card p-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-primary">
                    {((a.mao_rule_pct_of_arv ?? 0.7) * 100).toFixed(0)}%
                  </div>
                  <div className="text-sm text-muted-foreground">MAO Rule</div>
                </div>
              </Card>
            </div>

            {/* Opportunities List */}
            <Accordion type="single" collapsible className="space-y-4">
              {opps.map((opportunity) => (
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
                            Spread: {formatCurrency(opportunity.spread_abs ?? 0)} ({((opportunity.spread_pct ?? 0) * 100).toFixed(1)}%)
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold text-primary">
                          MAO: {formatCurrency(opportunity.mao)}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          Score: {(typeof opportunity.score === 'number' ? opportunity.score : 0).toFixed(2)}
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
                            {formatCurrency(opportunity.repairs?.mid ?? 0)}
                          </div>
                        </div>
                        <div className="space-y-1">
                          <div className="text-sm text-muted-foreground">Flip Margin</div>
                          <div className="font-semibold text-foreground">
                            {formatCurrency(opportunity.flip_margin ?? 0)}
                          </div>
                        </div>
                        <div className="space-y-1">
                          <div className="text-sm text-muted-foreground">Exit Strategy</div>
                          <Badge variant="secondary" className="text-xs">
                            {opportunity.exit ?? 'wholesale'}
                          </Badge>
                        </div>
                      </div>

                      {/* Risk Flags */}
                      {(opportunity.risk_flags?.length ?? 0) > 0 && (
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                            <AlertTriangle className="h-4 w-4" />
                            Risk Flags
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {(opportunity.risk_flags ?? []).map((flag, idx) => (
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
                              {opportunity.agent?.name || '—'}{opportunity.agent?.brokerage ? ` - ${opportunity.agent.brokerage}` : ''}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Phone className="h-4 w-4 text-primary" />
                            <span className="text-sm text-foreground">
                              {opportunity.agent?.phone || '—'}
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
                              Initial Offer: {formatCurrency(opportunity.next_actions?.offer_price_first ?? 0)}
                            </div>
                            <div className="text-xs font-medium text-muted-foreground">
                              Max Offer: {formatCurrency(opportunity.next_actions?.offer_price_ceiling_MAO ?? 0)}
                            </div>
                          </div>
                        </div>

                        <div className="bg-muted/50 rounded-lg p-3 space-y-2">
                          <div className="text-xs font-medium text-muted-foreground">Call Script</div>
                          <div className="text-sm text-foreground">
                            {opportunity.next_actions?.call_script || '—'}
                          </div>
                        </div>

                        <div className="bg-muted/50 rounded-lg p-3 space-y-2">
                          <div className="text-xs font-medium text-muted-foreground">Email Template</div>
                          <div className="text-sm text-foreground">
                            {opportunity.next_actions?.email_copy || '—'}
                          </div>
                        </div>
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
          );
        })()}
      </CardContent>
    </Card>
  );
}