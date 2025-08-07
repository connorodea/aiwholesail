import { Property } from '@/types/zillow';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { MapPin, TrendingUp, Users, GraduationCap, Car, Home, BarChart3, Download } from 'lucide-react';
import { useState, useEffect } from 'react';
import { ZillowAPI } from '@/lib/zillow-api';
import { useToast } from '@/hooks/use-toast';

interface MarketIntelligenceDashboardProps {
  property: Property;
}

interface MarketData {
  neighborhood: {
    name: string;
    walkScore: number;
    transitScore: number;
    demographics: any;
  };
  schools: any[];
  comparables: any[];
  priceHistory: any[];
  marketTrends: {
    averagePrice: number;
    priceGrowth: number;
    daysOnMarket: number;
    inventoryLevel: string;
  };
  investmentMetrics: {
    capRate: number;
    cashOnCash: number;
    appreciation: number;
    rentGrowth: number;
  };
}

export function MarketIntelligenceDashboard({ property }: MarketIntelligenceDashboardProps) {
  const [marketData, setMarketData] = useState<MarketData | null>(null);
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

  const fetchMarketData = async () => {
    if (!property.zpid) return;
    
    setLoading(true);
    try {
      const [walkScoreData, schoolsData, compsData, historyData] = await Promise.allSettled([
        zillowAPI.getWalkScore(property.zpid),
        zillowAPI.getPropertySchools(property.zpid),
        zillowAPI.getDeepComps(property.zpid),
        zillowAPI.getPriceHistory(property.zpid)
      ]);

      const walkScore = walkScoreData.status === 'fulfilled' ? walkScoreData.value : null;
      const schools = schoolsData.status === 'fulfilled' ? schoolsData.value || [] : [];
      const comps = compsData.status === 'fulfilled' ? compsData.value || [] : [];
      const history = historyData.status === 'fulfilled' ? historyData.value || [] : [];

      // Calculate market trends from comparables
      const averagePrice = comps.length > 0 ? 
        comps.reduce((sum: number, comp: any) => sum + (comp.price || 0), 0) / comps.length : 
        property.price || 0;

      const averageDaysOnMarket = comps.length > 0 ?
        comps.reduce((sum: number, comp: any) => sum + (comp.daysOnMarket || 0), 0) / comps.length :
        property.daysOnMarket || 0;

      // Calculate price growth from history
      const priceGrowth = history.length >= 2 ? 
        ((history[history.length - 1]?.price - history[0]?.price) / history[0]?.price) * 100 : 0;

      // Estimate investment metrics
      const rentEstimate = property.property_estimates_rentZestimate || averagePrice * 0.01;
      const monthlyExpenses = rentEstimate * 0.5; // 50% expense ratio
      const noi = (rentEstimate - monthlyExpenses) * 12;
      const capRate = property.price ? (noi / property.price) * 100 : 0;

      setMarketData({
        neighborhood: {
          name: extractNeighborhood(property.address || ''),
          walkScore: walkScore?.walkScore || 0,
          transitScore: walkScore?.transitScore || 0,
          demographics: walkScore?.demographics || {}
        },
        schools,
        comparables: comps,
        priceHistory: history,
        marketTrends: {
          averagePrice,
          priceGrowth,
          daysOnMarket: averageDaysOnMarket,
          inventoryLevel: getInventoryLevel(averageDaysOnMarket)
        },
        investmentMetrics: {
          capRate,
          cashOnCash: capRate * 0.8, // Estimate with leverage
          appreciation: priceGrowth,
          rentGrowth: Math.max(priceGrowth * 0.5, 3) // Estimate rent growth
        }
      });

    } catch (error) {
      console.error('Error fetching market data:', error);
      toast({
        title: "Error",
        description: "Could not load market intelligence data",
        variant: "destructive"
      });
    }
    setLoading(false);
  };

  const extractNeighborhood = (address: string): string => {
    const parts = address.split(',');
    return parts.length > 1 ? parts[1].trim() : 'Unknown';
  };

  const getInventoryLevel = (avgDays: number): string => {
    if (avgDays < 30) return 'Low - Seller\'s Market';
    if (avgDays < 60) return 'Balanced Market';
    if (avgDays < 90) return 'High - Buyer\'s Market';
    return 'Very High - Distressed Market';
  };

  const getScoreColor = (score: number, type: 'walk' | 'school' | 'metric') => {
    if (type === 'walk') {
      if (score >= 90) return 'text-success';
      if (score >= 70) return 'text-primary';
      if (score >= 50) return 'text-warning';
      return 'text-destructive';
    }
    if (type === 'school') {
      if (score >= 8) return 'text-success';
      if (score >= 6) return 'text-primary';
      if (score >= 4) return 'text-warning';
      return 'text-destructive';
    }
    return 'text-primary';
  };

  const exportMarketReport = () => {
    if (!marketData) return;
    
    const csvContent = [
      ['Market Intelligence Report'],
      ['Property Address', property.address || 'N/A'],
      ['Neighborhood', marketData.neighborhood.name],
      ['Report Date', new Date().toLocaleDateString()],
      [''],
      ['Market Trends'],
      ['Average Price', formatPrice(marketData.marketTrends.averagePrice)],
      ['Price Growth', `${marketData.marketTrends.priceGrowth.toFixed(1)}%`],
      ['Avg Days on Market', marketData.marketTrends.daysOnMarket.toString()],
      ['Market Condition', marketData.marketTrends.inventoryLevel],
      [''],
      ['Investment Metrics'],
      ['Estimated Cap Rate', `${marketData.investmentMetrics.capRate.toFixed(1)}%`],
      ['Cash-on-Cash Return', `${marketData.investmentMetrics.cashOnCash.toFixed(1)}%`],
      ['Appreciation Rate', `${marketData.investmentMetrics.appreciation.toFixed(1)}%`],
      ['Rent Growth', `${marketData.investmentMetrics.rentGrowth.toFixed(1)}%`],
      [''],
      ['Walkability'],
      ['Walk Score', marketData.neighborhood.walkScore.toString()],
      ['Transit Score', marketData.neighborhood.transitScore.toString()],
      [''],
      ['Schools'],
      ...marketData.schools.slice(0, 5).map((school: any) => [
        school.name || 'Unknown School',
        `${school.rating || 'N/A'}/10`,
        school.type || 'Unknown'
      ])
    ];
    
    const csv = csvContent.map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `market-intelligence-${property.address?.replace(/\s+/g, '-')}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  useEffect(() => {
    fetchMarketData();
  }, [property.zpid]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Market Intelligence Dashboard
          </div>
          <div className="flex gap-2">
            <Button 
              onClick={fetchMarketData} 
              variant="outline" 
              size="sm" 
              disabled={loading}
            >
              {loading ? 'Loading...' : 'Refresh'}
            </Button>
            {marketData && (
              <Button 
                onClick={exportMarketReport} 
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
            <div className="text-muted-foreground">Loading market intelligence...</div>
          </div>
        ) : marketData ? (
          <>
            {/* Neighborhood Overview */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 bg-accent/10 rounded-lg border border-accent/20">
                <div className="flex items-center gap-2 mb-2">
                  <MapPin className="h-4 w-4 text-accent" />
                  <span className="font-semibold">Neighborhood</span>
                </div>
                <div className="text-lg font-bold">{marketData.neighborhood.name}</div>
              </div>

              <div className="p-4 bg-muted/30 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Car className="h-4 w-4 text-primary" />
                  <span className="font-semibold">Walk Score</span>
                </div>
                <div className={`text-2xl font-bold ${getScoreColor(marketData.neighborhood.walkScore, 'walk')}`}>
                  {marketData.neighborhood.walkScore}/100
                </div>
                <div className="text-xs text-muted-foreground">
                  {marketData.neighborhood.walkScore >= 90 ? 'Walker\'s Paradise' :
                   marketData.neighborhood.walkScore >= 70 ? 'Very Walkable' :
                   marketData.neighborhood.walkScore >= 50 ? 'Somewhat Walkable' : 'Car-Dependent'}
                </div>
              </div>

              <div className="p-4 bg-muted/30 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Car className="h-4 w-4 text-primary" />
                  <span className="font-semibold">Transit Score</span>
                </div>
                <div className={`text-2xl font-bold ${getScoreColor(marketData.neighborhood.transitScore, 'walk')}`}>
                  {marketData.neighborhood.transitScore}/100
                </div>
                <div className="text-xs text-muted-foreground">Public transit access</div>
              </div>
            </div>

            {/* Market Trends */}
            <div className="space-y-3">
              <h4 className="font-semibold flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Market Trends
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 bg-muted/30 rounded-lg">
                  <div className="text-sm text-muted-foreground">Average Area Price</div>
                  <div className="text-xl font-bold">{formatPrice(marketData.marketTrends.averagePrice)}</div>
                  <div className={`text-sm ${marketData.marketTrends.priceGrowth >= 0 ? 'text-success' : 'text-destructive'}`}>
                    {marketData.marketTrends.priceGrowth >= 0 ? '+' : ''}{marketData.marketTrends.priceGrowth.toFixed(1)}% growth
                  </div>
                </div>

                <div className="p-4 bg-muted/30 rounded-lg">
                  <div className="text-sm text-muted-foreground">Average Days on Market</div>
                  <div className="text-xl font-bold">{Math.round(marketData.marketTrends.daysOnMarket)}</div>
                  <div className="text-sm text-muted-foreground">
                    {marketData.marketTrends.inventoryLevel}
                  </div>
                </div>
              </div>
            </div>

            {/* Investment Metrics */}
            <div className="space-y-3">
              <h4 className="font-semibold flex items-center gap-2">
                <Home className="h-4 w-4" />
                Investment Potential
              </h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-3 bg-success/10 rounded-lg border border-success/20">
                  <div className="text-sm text-muted-foreground">Cap Rate</div>
                  <div className="text-lg font-bold text-success">{marketData.investmentMetrics.capRate.toFixed(1)}%</div>
                </div>
                <div className="p-3 bg-primary/10 rounded-lg border border-primary/20">
                  <div className="text-sm text-muted-foreground">Cash-on-Cash</div>
                  <div className="text-lg font-bold text-primary">{marketData.investmentMetrics.cashOnCash.toFixed(1)}%</div>
                </div>
                <div className="p-3 bg-accent/10 rounded-lg border border-accent/20">
                  <div className="text-sm text-muted-foreground">Appreciation</div>
                  <div className="text-lg font-bold text-accent">{marketData.investmentMetrics.appreciation.toFixed(1)}%</div>
                </div>
                <div className="p-3 bg-warning/10 rounded-lg border border-warning/20">
                  <div className="text-sm text-muted-foreground">Rent Growth</div>
                  <div className="text-lg font-bold text-warning">{marketData.investmentMetrics.rentGrowth.toFixed(1)}%</div>
                </div>
              </div>
            </div>

            {/* Schools */}
            {marketData.schools.length > 0 && (
              <div className="space-y-3">
                <h4 className="font-semibold flex items-center gap-2">
                  <GraduationCap className="h-4 w-4" />
                  School Ratings
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {marketData.schools.slice(0, 4).map((school: any, index: number) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                      <div>
                        <div className="font-medium">{school.name || 'Unknown School'}</div>
                        <div className="text-sm text-muted-foreground">{school.type || 'School'}</div>
                      </div>
                      <div className="text-right">
                        <div className={`text-lg font-bold ${getScoreColor(school.rating || 0, 'school')}`}>
                          {school.rating || 'N/A'}/10
                        </div>
                        <div className="text-xs text-muted-foreground">Rating</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Market Opportunity Indicator */}
            <div className="p-4 bg-gradient-to-r from-primary/10 to-accent/10 rounded-lg border border-primary/20">
              <h4 className="font-semibold mb-2">Market Opportunity Score</h4>
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <div className="text-sm text-muted-foreground">
                    Based on appreciation, cap rate, and walkability
                  </div>
                  <div className="flex gap-2">
                    {marketData.investmentMetrics.capRate >= 8 && (
                      <Badge variant="secondary" className="bg-success/20 text-success">High Cash Flow</Badge>
                    )}
                    {marketData.investmentMetrics.appreciation >= 5 && (
                      <Badge variant="secondary" className="bg-primary/20 text-primary">Strong Appreciation</Badge>
                    )}
                    {marketData.neighborhood.walkScore >= 70 && (
                      <Badge variant="secondary" className="bg-accent/20 text-accent">Great Walkability</Badge>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-primary">
                    {((marketData.investmentMetrics.capRate + marketData.investmentMetrics.appreciation + marketData.neighborhood.walkScore / 10) / 3).toFixed(0)}%
                  </div>
                  <div className="text-xs text-muted-foreground">Overall Score</div>
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            Click "Refresh" to load market intelligence data
          </div>
        )}
      </CardContent>
    </Card>
  );
}