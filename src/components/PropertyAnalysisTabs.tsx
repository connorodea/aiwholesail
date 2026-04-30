import { Property } from '@/types/zillow';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { TrendingDown, TrendingUp, Calculator, Building, AlertTriangle, MapPin, DollarSign, Calendar, Users, GraduationCap, Brain } from 'lucide-react';
import { useState, useEffect } from 'react';
import { ZillowAPI } from '@/lib/zillow-api';
import { useToast } from '@/hooks/use-toast';
import { WholesaleCalculator } from './WholesaleCalculator';
import { MotivatedSellerDetector } from './MotivatedSellerDetector';
import { MarketIntelligenceDashboard } from './MarketIntelligenceDashboard';
import { DeepDueDiligencePanel } from './DeepDueDiligencePanel';
import AdvancedDamageDetection from './AdvancedDamageDetection';
import AdvancedAIDealCalculator from './AdvancedAIDealCalculator';

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

  // Log when component mounts to verify it's being used
  useEffect(() => {
    console.log('PropertyAnalysisTabs: Component mounted with property:', property);
  }, []);

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
    const zpid = property.zpid || property.id;
    console.log('PropertyAnalysisTabs: Fetching price history for zpid:', zpid, 'property:', property);
    
    if (!zpid) {
      console.warn('PropertyAnalysisTabs: No ZPID found for property');
      return;
    }
    
    setLoading(true);
    try {
      const history = await zillowAPI.getPriceHistory(zpid);
      console.log('PropertyAnalysisTabs: Price history response:', history);
      
      if (history && Array.isArray(history) && history.length > 0) {
        const formattedHistory = history.map((item: any) => ({
          date: item.date || item.time,
          price: item.price || 0,
          event: item.event || 'Price Change'
        })).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        setPriceHistory(formattedHistory);
      } else {
        // Set empty array for graceful fallback
        setPriceHistory([]);
      }
    } catch (error) {
      console.error('PropertyAnalysisTabs: Error fetching price history:', error);
      // Set empty array instead of showing error toast for better UX
      setPriceHistory([]);
      // Only show toast for unexpected errors, not 404s
      if (error instanceof Error && !error.message.includes('404')) {
        toast({
          title: "Price History",
          description: "Unable to fetch price history at this time",
          variant: "destructive"
        });
      }
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchPriceHistory();
  }, [property.zpid, property.id]);

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

  // Get property photos for damage detection
  const getPropertyPhotos = () => {
    const photos = [];
    
    // Main property photo
    if (property.imgSrc) {
      photos.push({
        url: property.imgSrc,
        room_type: 'exterior'
      });
    }
    
    // Additional photos if available
    if (property.property_photos_mixedSources) {
      property.property_photos_mixedSources.forEach((photo: any, index: number) => {
        if (photo.url) {
          photos.push({
            url: photo.url,
            room_type: photo.caption || `room_${index + 1}`
          });
        }
      });
    }
    
    return photos;
  };

  const propertyPhotos = getPropertyPhotos();

  return (
    <Tabs defaultValue="analysis" className="w-full">
      <TabsList className="grid w-full grid-cols-4 bg-muted/50">
        <TabsTrigger value="analysis" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
          <Calculator className="h-4 w-4 mr-2" />
          Analysis
        </TabsTrigger>
        <TabsTrigger value="market" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
          <TrendingUp className="h-4 w-4 mr-2" />
          Market
        </TabsTrigger>
        <TabsTrigger value="diligence" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
          <GraduationCap className="h-4 w-4 mr-2" />
          Due Diligence
        </TabsTrigger>
        <TabsTrigger value="ai-insights" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
          <Brain className="h-4 w-4 mr-2" />
          AI Insights
        </TabsTrigger>
      </TabsList>

      <TabsContent value="analysis" className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calculator className="h-5 w-5 text-primary" />
                Deal Calculator
              </CardTitle>
            </CardHeader>
            <CardContent>
              <WholesaleCalculator property={property} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Brain className="h-5 w-5 text-primary" />
                AI Deal Analysis
              </CardTitle>
            </CardHeader>
            <CardContent>
              <AdvancedAIDealCalculator property={property} />
            </CardContent>
          </Card>
        </div>
      </TabsContent>

      <TabsContent value="market" className="space-y-6">
        <div className="space-y-6">
          <MarketIntelligenceDashboard property={property} />
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Price History */}
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
                  <div className="space-y-3 max-h-60 overflow-y-auto">
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
                  <div className="text-center py-6 text-muted-foreground space-y-3">
                    <Calendar className="h-8 w-8 mx-auto opacity-50" />
                    {loading ? (
                      <p>Loading price history...</p>
                    ) : (
                      <div>
                        <p className="font-medium">No price history available</p>
                        <Button 
                          onClick={fetchPriceHistory} 
                          variant="outline" 
                          size="sm"
                          className="mt-2"
                        >
                          Try Again
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Area Data */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="h-5 w-5" />
                  Area Data
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 gap-4">
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

                {property.price && property.zestimate && (
                  <div className="p-4 bg-muted/10 rounded-lg">
                    <h4 className="font-semibold mb-2 flex items-center gap-2">
                      <Building className="h-4 w-4" />
                      Market Position
                    </h4>
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
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </TabsContent>

      <TabsContent value="diligence" className="space-y-4">
        <DeepDueDiligencePanel property={property} />
      </TabsContent>

      <TabsContent value="ai-insights" className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Hot Leads */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                Hot Leads Detection
              </CardTitle>
            </CardHeader>
            <CardContent>
              <MotivatedSellerDetector property={property} />
            </CardContent>
          </Card>

          {/* AI Damage Analysis */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Brain className="h-5 w-5 text-primary" />
                AI Damage Analysis
              </CardTitle>
            </CardHeader>
            <CardContent>
              {propertyPhotos.length > 0 ? (
                <div className="space-y-4 max-h-80 overflow-y-auto">
                  {propertyPhotos.slice(0, 2).map((photo, index) => (
                    <AdvancedDamageDetection
                      key={index}
                      photoUrl={photo.url}
                      roomType={photo.room_type}
                      zpid={property.zpid || property.id}
                    />
                  ))}
                  {propertyPhotos.length > 2 && (
                    <p className="text-sm text-muted-foreground text-center">
                      +{propertyPhotos.length - 2} more photos available for analysis
                    </p>
                  )}
                </div>
              ) : (
                <div className="text-center py-6 text-muted-foreground">
                  <AlertTriangle className="h-8 w-8 mx-auto mb-4 opacity-50" />
                  <p>No property photos available</p>
                  <p className="text-sm">Photos are required for AI damage analysis</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </TabsContent>
    </Tabs>
  );
}