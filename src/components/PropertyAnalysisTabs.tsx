import { Property } from '@/types/zillow';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { TrendingDown, TrendingUp, Calculator, Building, AlertTriangle, MapPin, DollarSign, Calendar, Users, GraduationCap } from 'lucide-react';
import { useState, useEffect } from 'react';
import { ZillowAPI } from '@/lib/zillow-api';
import { useToast } from '@/hooks/use-toast';

interface PropertyAnalysisTabsProps {
  property: Property;
}

interface PriceHistoryData {
  date: string;
  price: number;
  event: string;
}

interface InvestmentMetrics {
  arv: number;
  repairCosts: number;
  wholesaleFee: number;
  maxOffer: number;
  currentSpread: number;
  cashFlow: number;
  capRate: number;
  roi: number;
}

export function PropertyAnalysisTabs({ property }: PropertyAnalysisTabsProps) {
  const [priceHistory, setPriceHistory] = useState<PriceHistoryData[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const zillowAPI = new ZillowAPI();

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0
    }).format(price);
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('en-US').format(num);
  };

  const fetchPriceHistory = async () => {
    if (!property.zpid) return;
    
    setLoading(true);
    try {
      const history = await zillowAPI.getPriceHistory(property.zpid);
      if (history && Array.isArray(history)) {
        const formattedHistory = history.map((item: any) => ({
          date: item.date || item.time,
          price: item.price || 0,
          event: item.event || 'Price Change'
        })).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        setPriceHistory(formattedHistory);
      }
    } catch (error) {
      console.error('Error fetching price history:', error);
      toast({
        title: "Error",
        description: "Could not load price history",
        variant: "destructive"
      });
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchPriceHistory();
  }, [property.zpid]);

  const calculateInvestmentMetrics = (): InvestmentMetrics => {
    const currentPrice = property.price || 0;
    const arv = property.zestimate || currentPrice * 1.1; // Use Zestimate or 10% above current price
    const repairCosts = arv * 0.15; // 15% of ARV for repairs
    const wholesaleFee = 10000; // Standard wholesale fee
    const maxOffer = arv * 0.7 - repairCosts - wholesaleFee; // 70% rule
    const currentSpread = maxOffer - currentPrice;
    
    const rentEstimate = property.property_estimates_rentZestimate || arv * 0.01; // 1% rule fallback
    const monthlyExpenses = rentEstimate * 0.5; // 50% of rent for expenses
    const cashFlow = rentEstimate - monthlyExpenses;
    const capRate = (cashFlow * 12) / currentPrice * 100;
    const roi = currentSpread / currentPrice * 100;

    return {
      arv,
      repairCosts,
      wholesaleFee,
      maxOffer,
      currentSpread,
      cashFlow,
      capRate,
      roi
    };
  };

  const getMotivatedSellerScore = (): { score: number; indicators: string[] } => {
    const indicators: string[] = [];
    let score = 0;

    // Days on market
    if (property.daysOnMarket) {
      if (property.daysOnMarket > 90) {
        score += 30;
        indicators.push(`${property.daysOnMarket} days on market (Long time)`);
      } else if (property.daysOnMarket > 60) {
        score += 20;
        indicators.push(`${property.daysOnMarket} days on market (Above average)`);
      } else if (property.daysOnMarket > 30) {
        score += 10;
        indicators.push(`${property.daysOnMarket} days on market`);
      }
    }

    // Price reductions
    if (property.property_price_priceChange && property.property_price_priceChange < 0) {
      score += 25;
      indicators.push(`Price reduced by ${formatPrice(Math.abs(property.property_price_priceChange))}`);
    }

    // Below market price
    if (property.price && property.zestimate && property.price < property.zestimate * 0.9) {
      score += 20;
      indicators.push('Priced below market estimate');
    }

    // Property condition indicators
    const description = (property.description || '').toLowerCase();
    const distressKeywords = ['needs work', 'fixer', 'as is', 'cash only', 'motivated', 'must sell'];
    const foundKeywords = distressKeywords.filter(keyword => description.includes(keyword));
    if (foundKeywords.length > 0) {
      score += foundKeywords.length * 5;
      indicators.push(`Property needs attention (${foundKeywords.join(', ')})`);
    }

    // FSBO
    if (property.isFSBO) {
      score += 15;
      indicators.push('For Sale By Owner');
    }

    // Pre-foreclosure
    if (property.property_isPreforeclosureAuction) {
      score += 35;
      indicators.push('Pre-foreclosure status');
    }

    return { score: Math.min(score, 100), indicators };
  };

  const metrics = calculateInvestmentMetrics();
  const motivatedSeller = getMotivatedSellerScore();

  return (
    <Tabs defaultValue="investment" className="w-full">
      <TabsList className="grid w-full grid-cols-4">
        <TabsTrigger value="investment">Investment</TabsTrigger>
        <TabsTrigger value="history">Price History</TabsTrigger>
        <TabsTrigger value="motivated">Motivation</TabsTrigger>
        <TabsTrigger value="neighborhood">Area Data</TabsTrigger>
      </TabsList>

      <TabsContent value="investment" className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calculator className="h-5 w-5" />
              Investment Analysis
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-3 bg-muted/30 rounded-lg">
                <div className="text-sm text-muted-foreground">ARV (After Repair Value)</div>
                <div className="text-lg font-bold">{formatPrice(metrics.arv)}</div>
              </div>
              <div className="p-3 bg-muted/30 rounded-lg">
                <div className="text-sm text-muted-foreground">Est. Repair Costs</div>
                <div className="text-lg font-bold text-destructive">{formatPrice(metrics.repairCosts)}</div>
              </div>
              <div className="p-3 bg-muted/30 rounded-lg">
                <div className="text-sm text-muted-foreground">Max Wholesale Offer</div>
                <div className="text-lg font-bold text-primary">{formatPrice(metrics.maxOffer)}</div>
              </div>
              <div className="p-3 bg-muted/30 rounded-lg">
                <div className="text-sm text-muted-foreground">Potential Spread</div>
                <div className={`text-lg font-bold ${metrics.currentSpread > 0 ? 'text-success' : 'text-destructive'}`}>
                  {formatPrice(metrics.currentSpread)}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 bg-accent/10 rounded-lg border border-accent/20">
                <div className="text-sm text-muted-foreground">Monthly Cash Flow</div>
                <div className="text-xl font-bold">{formatPrice(metrics.cashFlow)}</div>
                <div className="text-xs text-muted-foreground">If held as rental</div>
              </div>
              <div className="p-4 bg-accent/10 rounded-lg border border-accent/20">
                <div className="text-sm text-muted-foreground">Cap Rate</div>
                <div className="text-xl font-bold">{metrics.capRate.toFixed(1)}%</div>
                <div className="text-xs text-muted-foreground">Annual return</div>
              </div>
              <div className="p-4 bg-accent/10 rounded-lg border border-accent/20">
                <div className="text-sm text-muted-foreground">ROI Potential</div>
                <div className={`text-xl font-bold ${metrics.roi > 0 ? 'text-success' : 'text-destructive'}`}>
                  {metrics.roi.toFixed(1)}%
                </div>
                <div className="text-xs text-muted-foreground">On wholesale spread</div>
              </div>
            </div>

            {metrics.currentSpread > 0 && (
              <div className="p-4 bg-success/10 border border-success/20 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="h-5 w-5 text-success" />
                  <span className="font-semibold text-success">Great Wholesale Deal!</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  This property shows a positive spread of {formatPrice(metrics.currentSpread)} based on the 70% rule.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="history" className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingDown className="h-5 w-5" />
              Price History
              <Button 
                onClick={fetchPriceHistory} 
                variant="outline" 
                size="sm" 
                disabled={loading}
              >
                {loading ? 'Loading...' : 'Refresh'}
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {priceHistory.length > 0 ? (
              <div className="space-y-3">
                {priceHistory.map((entry, index) => (
                  <div key={index} className="flex justify-between items-center p-3 bg-muted/30 rounded-lg">
                    <div>
                      <div className="font-medium">{entry.event}</div>
                      <div className="text-sm text-muted-foreground">
                        {new Date(entry.date).toLocaleDateString()}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold">{formatPrice(entry.price)}</div>
                      {index < priceHistory.length - 1 && (
                        <div className={`text-sm ${entry.price < priceHistory[index + 1].price ? 'text-destructive' : 'text-success'}`}>
                          {entry.price < priceHistory[index + 1].price ? '↓' : '↑'} 
                          {formatPrice(Math.abs(entry.price - priceHistory[index + 1].price))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                {loading ? 'Loading price history...' : 'No price history available'}
              </div>
            )}
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="motivated" className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Motivated Seller Analysis
              <Badge variant={motivatedSeller.score > 60 ? 'destructive' : motivatedSeller.score > 30 ? 'default' : 'secondary'}>
                {motivatedSeller.score}/100
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              {motivatedSeller.indicators.length > 0 ? (
                motivatedSeller.indicators.map((indicator, index) => (
                  <div key={index} className="flex items-center gap-2 p-3 bg-muted/30 rounded-lg">
                    <AlertTriangle className="h-4 w-4 text-warning flex-shrink-0" />
                    <span className="text-sm">{indicator}</span>
                  </div>
                ))
              ) : (
                <div className="text-center py-4 text-muted-foreground">
                  No strong motivation indicators found
                </div>
              )}
            </div>

            <div className="p-4 bg-accent/10 rounded-lg border border-accent/20">
              <h4 className="font-semibold mb-2">Motivation Score Breakdown:</h4>
              <ul className="text-sm space-y-1 text-muted-foreground">
                <li>• 0-30: Low motivation indicators</li>
                <li>• 31-60: Moderate motivation potential</li>
                <li>• 61-100: High motivation likelihood</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="neighborhood" className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              Neighborhood Data
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {property.property_estimates_rentZestimate && (
                <div className="p-3 bg-muted/30 rounded-lg">
                  <div className="text-sm text-muted-foreground">Rental Market</div>
                  <div className="text-lg font-bold">{formatPrice(property.property_estimates_rentZestimate)}/mo</div>
                  <div className="text-xs text-muted-foreground">Estimated rent</div>
                </div>
              )}

              {property.property_taxAssessment_taxAssessedValue && (
                <div className="p-3 bg-muted/30 rounded-lg">
                  <div className="text-sm text-muted-foreground">Tax Assessment</div>
                  <div className="text-lg font-bold">{formatPrice(property.property_taxAssessment_taxAssessedValue)}</div>
                  <div className="text-xs text-muted-foreground">
                    {property.property_taxAssessment_taxAssessmentYear || 'Latest assessment'}
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 bg-muted/10 rounded-lg">
              <h4 className="font-semibold mb-2 flex items-center gap-2">
                <Building className="h-4 w-4" />
                Market Position
              </h4>
              {property.price && property.zestimate && (
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">vs. Market Estimate:</span>
                    <span className={property.price < property.zestimate ? 'text-success font-medium' : 'text-destructive font-medium'}>
                      {property.price < property.zestimate ? 'Below Market' : 'Above Market'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Price Difference:</span>
                    <span className="font-medium">
                      {formatPrice(Math.abs(property.price - property.zestimate))}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}