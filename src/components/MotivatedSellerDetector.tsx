import { Property } from '@/types/zillow';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { AlertTriangle, TrendingDown, Calendar, DollarSign, Target, Phone, Download } from 'lucide-react';
import { useState, useEffect } from 'react';
import { ZillowAPI } from '@/lib/zillow-api';
import { useToast } from '@/hooks/use-toast';

interface MotivatedSellerDetectorProps {
  property: Property;
}

interface MotivationIndicators {
  priceDrops: {
    totalReduction: number;
    numberOfDrops: number;
    largestDrop: number;
    score: number;
  };
  marketTime: {
    daysOnMarket: number;
    score: number;
  };
  taxStatus: {
    delinquent: boolean;
    overdue: number;
    score: number;
  };
  distressSignals: {
    keywords: string[];
    score: number;
  };
  overallScore: number;
  motivationLevel: 'Very High' | 'High' | 'Moderate' | 'Low';
  actionPlan: string[];
}

export function MotivatedSellerDetector({ property }: MotivatedSellerDetectorProps) {
  const [indicators, setIndicators] = useState<MotivationIndicators | null>(null);
  const [loading, setLoading] = useState(false);
  const [priceHistory, setPriceHistory] = useState<any[]>([]);
  const [taxData, setTaxData] = useState<any>(null);
  const { toast } = useToast();
  const zillowAPI = new ZillowAPI();

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0
    }).format(price);
  };

  const analyzeMotivation = async () => {
    setLoading(true);
    try {
      // Fetch price history and tax data
      const [historyData, taxes] = await Promise.allSettled([
        property.zpid ? zillowAPI.getPriceHistory(property.zpid) : Promise.resolve([]),
        property.zpid ? zillowAPI.getPropertyTaxes(property.zpid) : Promise.resolve(null)
      ]);

      const history = historyData.status === 'fulfilled' ? historyData.value || [] : [];
      const taxInfo = taxes.status === 'fulfilled' ? taxes.value : null;

      setPriceHistory(history);
      setTaxData(taxInfo);

      // Analyze price drops
      const priceDropAnalysis = analyzePriceDrops(history, property.price || 0);
      
      // Analyze market time
      const marketTimeAnalysis = analyzeMarketTime(property.daysOnMarket || 0);
      
      // Analyze tax status
      const taxAnalysis = analyzeTaxStatus(taxInfo);
      
      // Analyze distress signals
      const distressAnalysis = analyzeDistressSignals(property);
      
      // Calculate overall score
      const totalScore = priceDropAnalysis.score + marketTimeAnalysis.score + taxAnalysis.score + distressAnalysis.score;
      
      let motivationLevel: MotivationIndicators['motivationLevel'] = 'Low';
      if (totalScore >= 80) motivationLevel = 'Very High';
      else if (totalScore >= 60) motivationLevel = 'High';
      else if (totalScore >= 40) motivationLevel = 'Moderate';

      // Generate action plan
      const actionPlan = generateActionPlan({
        priceDrops: priceDropAnalysis,
        marketTime: marketTimeAnalysis,
        taxStatus: taxAnalysis,
        distressSignals: distressAnalysis,
        overallScore: totalScore
      });

      setIndicators({
        priceDrops: priceDropAnalysis,
        marketTime: marketTimeAnalysis,
        taxStatus: taxAnalysis,
        distressSignals: distressAnalysis,
        overallScore: totalScore,
        motivationLevel,
        actionPlan
      });

    } catch (error) {
      console.error('Error analyzing motivation:', error);
      toast({
        title: "Analysis Error",
        description: "Could not complete motivation analysis",
        variant: "destructive"
      });
    }
    setLoading(false);
  };

  const analyzePriceDrops = (history: any[], currentPrice: number) => {
    if (!history.length) {
      return { totalReduction: 0, numberOfDrops: 0, largestDrop: 0, score: 0 };
    }

    const sortedHistory = history.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    const originalPrice = sortedHistory[0]?.price || currentPrice;
    
    let numberOfDrops = 0;
    let largestDrop = 0;
    
    for (let i = 1; i < sortedHistory.length; i++) {
      const priceDiff = sortedHistory[i-1].price - sortedHistory[i].price;
      if (priceDiff > 0) {
        numberOfDrops++;
        largestDrop = Math.max(largestDrop, priceDiff);
      }
    }
    
    const totalReduction = ((originalPrice - currentPrice) / originalPrice) * 100;
    
    let score = 0;
    if (totalReduction >= 20) score += 30;
    else if (totalReduction >= 15) score += 25;
    else if (totalReduction >= 10) score += 20;
    else if (totalReduction >= 5) score += 10;
    
    if (numberOfDrops >= 3) score += 15;
    else if (numberOfDrops >= 2) score += 10;
    else if (numberOfDrops >= 1) score += 5;
    
    return { totalReduction, numberOfDrops, largestDrop, score };
  };

  const analyzeMarketTime = (daysOnMarket: number) => {
    let score = 0;
    if (daysOnMarket >= 120) score = 25;
    else if (daysOnMarket >= 90) score = 20;
    else if (daysOnMarket >= 60) score = 15;
    else if (daysOnMarket >= 30) score = 10;
    else if (daysOnMarket >= 14) score = 5;
    
    return { daysOnMarket, score };
  };

  const analyzeTaxStatus = (taxData: any) => {
    let delinquent = false;
    let overdue = 0;
    let score = 0;

    if (taxData?.delinquent) {
      delinquent = true;
      score += 20;
    }
    
    if (taxData?.overdueAmount) {
      overdue = taxData.overdueAmount;
      if (overdue > 10000) score += 15;
      else if (overdue > 5000) score += 10;
      else if (overdue > 0) score += 5;
    }

    return { delinquent, overdue, score };
  };

  const analyzeDistressSignals = (property: Property) => {
    const description = (property.description || '').toLowerCase();
    const distressKeywords = [
      'needs work', 'fixer upper', 'handyman special', 'as is',
      'motivated seller', 'must sell', 'quick sale', 'cash only',
      'below market', 'investment opportunity', 'needs tlc',
      'repairs needed', 'estate sale', 'divorce', 'foreclosure'
    ];
    
    const foundKeywords = distressKeywords.filter(keyword => description.includes(keyword));
    let score = foundKeywords.length * 3;
    
    // Additional signals
    if (property.isFSBO) score += 5;
    if (property.property_isPreforeclosureAuction) score += 15;
    
    return { keywords: foundKeywords, score: Math.min(score, 20) };
  };

  const generateActionPlan = (analysis: any): string[] => {
    const plan: string[] = [];
    
    if (analysis.overallScore >= 60) {
      plan.push('🎯 HIGH PRIORITY: Contact seller immediately');
      plan.push('💰 Make aggressive offer - seller likely motivated');
    }
    
    if (analysis.priceDrops.numberOfDrops >= 2) {
      plan.push('📉 Leverage price reduction history in negotiations');
    }
    
    if (analysis.marketTime.daysOnMarket >= 60) {
      plan.push('⏰ Emphasize quick closing to stressed seller');
    }
    
    if (analysis.taxStatus.delinquent) {
      plan.push('💸 Offer to help with tax situation');
    }
    
    if (analysis.distressSignals.keywords.length > 0) {
      plan.push('🔧 Address property condition concerns in offer');
    }
    
    if (property.isFSBO) {
      plan.push('👨‍👩‍👧‍👦 Direct owner contact - no agent commission to factor');
    }
    
    if (plan.length === 0) {
      plan.push('📞 Standard approach - seller may not be highly motivated');
      plan.push('🔍 Look for additional motivation indicators');
    }
    
    return plan;
  };

  const exportMotivationReport = () => {
    if (!indicators) return;
    
    const csvContent = [
      ['Motivated Seller Analysis Report'],
      ['Property Address', property.address || 'N/A'],
      ['Analysis Date', new Date().toLocaleDateString()],
      [''],
      ['Overall Motivation Score', `${indicators.overallScore}/100`],
      ['Motivation Level', indicators.motivationLevel],
      [''],
      ['Price Drop Analysis'],
      ['Total Price Reduction', `${indicators.priceDrops.totalReduction.toFixed(1)}%`],
      ['Number of Price Drops', indicators.priceDrops.numberOfDrops.toString()],
      ['Largest Single Drop', formatPrice(indicators.priceDrops.largestDrop)],
      [''],
      ['Market Time Analysis'],
      ['Days on Market', indicators.marketTime.daysOnMarket.toString()],
      [''],
      ['Tax Status'],
      ['Tax Delinquent', indicators.taxStatus.delinquent ? 'Yes' : 'No'],
      ['Overdue Amount', formatPrice(indicators.taxStatus.overdue)],
      [''],
      ['Distress Signals'],
      ['Keywords Found', indicators.distressSignals.keywords.join(', ')],
      [''],
      ['Action Plan'],
      ...indicators.actionPlan.map(item => ['', item])
    ];
    
    const csv = csvContent.map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `motivation-analysis-${property.address?.replace(/\s+/g, '-')}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  useEffect(() => {
    analyzeMotivation();
  }, [property]);

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-destructive';
    if (score >= 60) return 'text-warning';
    if (score >= 40) return 'text-primary';
    return 'text-muted-foreground';
  };

  const getMotivationColor = (level: string) => {
    switch (level) {
      case 'Very High': return 'bg-destructive text-destructive-foreground';
      case 'High': return 'bg-warning text-warning-foreground';
      case 'Moderate': return 'bg-primary text-primary-foreground';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Motivated Seller Detection
          </div>
          <div className="flex gap-2">
            <Button 
              onClick={analyzeMotivation} 
              variant="outline" 
              size="sm" 
              disabled={loading}
            >
              {loading ? 'Analyzing...' : 'Refresh'}
            </Button>
            {indicators && (
              <Button 
                onClick={exportMotivationReport} 
                variant="outline" 
                size="sm"
              >
                <Download className="h-4 w-4 mr-1" />
                Export
              </Button>
            )}
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {loading ? (
          <div className="text-center py-8">
            <div className="text-muted-foreground">Analyzing seller motivation...</div>
          </div>
        ) : indicators ? (
          <>
            {/* Overall Score */}
            <div className="text-center space-y-3">
              <div className={`text-4xl font-bold ${getScoreColor(indicators.overallScore)}`}>
                {indicators.overallScore}/100
              </div>
              <Badge className={getMotivationColor(indicators.motivationLevel)} variant="default">
                {indicators.motivationLevel} Motivation
              </Badge>
              <Progress 
                value={indicators.overallScore} 
                className="w-full h-3"
              />
            </div>

            {/* Detailed Analysis */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Price Drops */}
              <div className="p-4 bg-muted/30 rounded-lg">
                <div className="flex items-center gap-2 mb-3">
                  <TrendingDown className="h-4 w-4 text-destructive" />
                  <span className="font-semibold">Price Drop Analysis</span>
                  <Badge variant="outline">{indicators.priceDrops.score}/40</Badge>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>Total Reduction:</span>
                    <span className="font-medium">{indicators.priceDrops.totalReduction.toFixed(1)}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Number of Drops:</span>
                    <span className="font-medium">{indicators.priceDrops.numberOfDrops}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Largest Drop:</span>
                    <span className="font-medium">{formatPrice(indicators.priceDrops.largestDrop)}</span>
                  </div>
                </div>
              </div>

              {/* Market Time */}
              <div className="p-4 bg-muted/30 rounded-lg">
                <div className="flex items-center gap-2 mb-3">
                  <Calendar className="h-4 w-4 text-warning" />
                  <span className="font-semibold">Market Time</span>
                  <Badge variant="outline">{indicators.marketTime.score}/25</Badge>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>Days on Market:</span>
                    <span className="font-medium">{indicators.marketTime.daysOnMarket}</span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {indicators.marketTime.daysOnMarket > 90 ? 
                      'Long time suggests motivated seller' : 
                      indicators.marketTime.daysOnMarket > 30 ? 
                      'Above average market time' : 
                      'Recent listing'}
                  </div>
                </div>
              </div>

              {/* Tax Status */}
              <div className="p-4 bg-muted/30 rounded-lg">
                <div className="flex items-center gap-2 mb-3">
                  <DollarSign className="h-4 w-4 text-success" />
                  <span className="font-semibold">Tax Status</span>
                  <Badge variant="outline">{indicators.taxStatus.score}/20</Badge>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>Tax Delinquent:</span>
                    <span className={`font-medium ${indicators.taxStatus.delinquent ? 'text-destructive' : 'text-success'}`}>
                      {indicators.taxStatus.delinquent ? 'Yes' : 'No'}
                    </span>
                  </div>
                  {indicators.taxStatus.overdue > 0 && (
                    <div className="flex justify-between">
                      <span>Overdue Amount:</span>
                      <span className="font-medium text-destructive">{formatPrice(indicators.taxStatus.overdue)}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Distress Signals */}
              <div className="p-4 bg-muted/30 rounded-lg">
                <div className="flex items-center gap-2 mb-3">
                  <AlertTriangle className="h-4 w-4 text-primary" />
                  <span className="font-semibold">Distress Signals</span>
                  <Badge variant="outline">{indicators.distressSignals.score}/20</Badge>
                </div>
                <div className="space-y-2 text-sm">
                  {indicators.distressSignals.keywords.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {indicators.distressSignals.keywords.map((keyword, index) => (
                        <Badge key={index} variant="secondary" className="text-xs">
                          {keyword}
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <div className="text-muted-foreground">No distress keywords found</div>
                  )}
                </div>
              </div>
            </div>

            {/* Action Plan */}
            <div className="space-y-3">
              <h4 className="font-semibold flex items-center gap-2">
                <Phone className="h-4 w-4" />
                Recommended Action Plan
              </h4>
              <div className="space-y-2">
                {indicators.actionPlan.map((action, index) => (
                  <div key={index} className="flex items-start gap-2 p-3 bg-accent/10 rounded-lg border border-accent/20">
                    <div className="w-2 h-2 rounded-full bg-accent mt-2 flex-shrink-0" />
                    <span className="text-sm">{action}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Hot Lead Alert */}
            {indicators.overallScore >= 70 && (
              <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="h-5 w-5 text-destructive" />
                  <span className="font-bold text-destructive">🔥 HOT LEAD ALERT!</span>
                </div>
                <p className="text-sm text-destructive">
                  This property shows very strong motivation indicators. Contact the seller immediately 
                  and consider making an aggressive offer with quick closing terms.
                </p>
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            Click "Refresh" to analyze seller motivation
          </div>
        )}
      </CardContent>
    </Card>
  );
}