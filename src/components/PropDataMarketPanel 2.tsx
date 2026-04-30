import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { propDataAPI, PropDataMarketResponse, PropDataSafetyResponse, PropDataEstimateResponse } from '@/lib/propdata-api';
import {
  BarChart3, TrendingUp, Home, DollarSign, Shield, GraduationCap,
  AlertTriangle, Thermometer, MapPin, RefreshCw, Building, Users,
  Percent, Activity
} from 'lucide-react';

interface PropDataMarketPanelProps {
  zip?: string;
  state?: string;
  onDataLoaded?: (data: PropDataMarketResponse) => void;
}

export function PropDataMarketPanel({ zip: initialZip, state: initialState, onDataLoaded }: PropDataMarketPanelProps) {
  const [zip, setZip] = useState(initialZip || '');
  const [marketData, setMarketData] = useState<PropDataMarketResponse | null>(null);
  const [safetyData, setSafetyData] = useState<PropDataSafetyResponse | null>(null);
  const [rentData, setRentData] = useState<PropDataEstimateResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const formatCurrency = (val?: number) =>
    val != null ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(val) : 'N/A';

  const formatPercent = (val?: number) =>
    val != null ? `${val >= 0 ? '+' : ''}${val.toFixed(1)}%` : 'N/A';

  const fetchData = async () => {
    if (!zip.trim()) {
      toast({ title: 'Enter a ZIP code', description: 'A ZIP code is required for market data.', variant: 'destructive' });
      return;
    }
    setLoading(true);
    try {
      const [market, safety, rent] = await Promise.all([
        propDataAPI.getMarketProfile({ zip: zip.trim(), months: '12' }).catch(() => null),
        propDataAPI.getSafetyScore({ zip: zip.trim() }).catch(() => null),
        propDataAPI.getRentEstimate({ zip: zip.trim(), beds: '3' }).catch(() => null),
      ]);
      setMarketData(market);
      setSafetyData(safety);
      setRentData(rent);
      if (market) onDataLoaded?.(market);
      toast({ title: 'Market data loaded', description: `Data for ZIP ${zip.trim()} from 14 sources.` });
    } catch (error) {
      console.error('[PropDataMarketPanel] Fetch failed:', error);
      toast({ title: 'Error', description: 'Failed to load market intelligence data.', variant: 'destructive' });
    }
    setLoading(false);
  };

  const getSafetyColor = (grade?: string) => {
    switch (grade?.toUpperCase()) {
      case 'A': return 'bg-green-500/20 text-green-600 border-green-500/30';
      case 'B': return 'bg-blue-500/20 text-blue-600 border-blue-500/30';
      case 'C': return 'bg-yellow-500/20 text-yellow-600 border-yellow-500/30';
      case 'D': return 'bg-orange-500/20 text-orange-600 border-orange-500/30';
      case 'F': return 'bg-red-500/20 text-red-600 border-red-500/30';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  return (
    <Card className="simple-card">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xl">
            <BarChart3 className="h-5 w-5 text-primary" />
            PropData Market Intelligence
          </div>
          <Badge variant="outline" className="text-xs">14 sources</Badge>
        </CardTitle>
        <p className="text-sm text-muted-foreground">82M+ parcels across 28+ states</p>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Search */}
        <div className="flex gap-2">
          <div className="flex-1">
            <Label htmlFor="propdata-zip" className="sr-only">ZIP Code</Label>
            <Input
              id="propdata-zip"
              value={zip}
              onChange={(e) => setZip(e.target.value)}
              placeholder="Enter ZIP code (e.g. 33101)"
              className="bg-background/50"
              onKeyDown={(e) => e.key === 'Enter' && fetchData()}
            />
          </div>
          <Button onClick={fetchData} disabled={loading}>
            {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <BarChart3 className="h-4 w-4" />}
            <span className="ml-2">{loading ? 'Loading...' : 'Analyze'}</span>
          </Button>
        </div>

        {marketData && (
          <div className="space-y-6 animate-fade-in">
            {/* Safety Score */}
            {safetyData?.grade && (
              <div className={`p-4 rounded-lg border ${getSafetyColor(safetyData.grade)}`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Shield className="h-5 w-5" />
                    <span className="font-semibold">Community Safety</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-3xl font-bold">{safetyData.grade}</span>
                    <span className="text-lg font-medium">{safetyData.score}/100</span>
                  </div>
                </div>
                {safetyData.narrative && (
                  <p className="text-sm opacity-80 mt-2">{safetyData.narrative}</p>
                )}
              </div>
            )}

            {/* Rent Estimates */}
            <div className="space-y-3">
              <h4 className="font-semibold flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-primary" />
                Rent Estimates (3BR)
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {rentData?.rent_low != null && (
                  <div className="p-3 bg-muted/30 rounded-lg">
                    <div className="text-xs text-muted-foreground">Low</div>
                    <div className="text-lg font-bold">{formatCurrency(rentData.rent_low)}</div>
                  </div>
                )}
                {rentData?.rent_mid != null && (
                  <div className="p-3 bg-primary/10 rounded-lg border border-primary/20">
                    <div className="text-xs text-muted-foreground">Mid (Weighted)</div>
                    <div className="text-lg font-bold text-primary">{formatCurrency(rentData.rent_mid)}</div>
                  </div>
                )}
                {rentData?.rent_high != null && (
                  <div className="p-3 bg-muted/30 rounded-lg">
                    <div className="text-xs text-muted-foreground">High</div>
                    <div className="text-lg font-bold">{formatCurrency(rentData.rent_high)}</div>
                  </div>
                )}
                {rentData?.confidence != null && (
                  <div className="p-3 bg-muted/30 rounded-lg">
                    <div className="text-xs text-muted-foreground">Confidence</div>
                    <div className="text-lg font-bold">{rentData.confidence}%</div>
                  </div>
                )}
              </div>
              {/* HUD Fair Market Rents */}
              {marketData.hud_fmr && (
                <div className="grid grid-cols-5 gap-2 mt-2">
                  {[
                    { label: 'Studio', val: marketData.hud_fmr.studio },
                    { label: '1BR', val: marketData.hud_fmr.one_br },
                    { label: '2BR', val: marketData.hud_fmr.two_br },
                    { label: '3BR', val: marketData.hud_fmr.three_br },
                    { label: '4BR', val: marketData.hud_fmr.four_br },
                  ].map((item) => (
                    <div key={item.label} className="text-center p-2 bg-muted/20 rounded-lg">
                      <div className="text-xs text-muted-foreground">{item.label}</div>
                      <div className="text-sm font-medium">{formatCurrency(item.val)}</div>
                    </div>
                  ))}
                  <div className="col-span-5 text-xs text-muted-foreground text-center">HUD Fair Market Rents</div>
                </div>
              )}
            </div>

            {/* Market Metrics */}
            <div className="space-y-3">
              <h4 className="font-semibold flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-primary" />
                Market Metrics
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {marketData.realtor?.median_list_price != null && (
                  <div className="p-3 bg-muted/30 rounded-lg">
                    <div className="text-xs text-muted-foreground flex items-center gap-1"><Home className="h-3 w-3" /> Median List Price</div>
                    <div className="text-lg font-bold">{formatCurrency(marketData.realtor.median_list_price)}</div>
                  </div>
                )}
                {marketData.realtor?.days_on_market != null && (
                  <div className="p-3 bg-muted/30 rounded-lg">
                    <div className="text-xs text-muted-foreground flex items-center gap-1"><Activity className="h-3 w-3" /> Days on Market</div>
                    <div className="text-lg font-bold">{marketData.realtor.days_on_market}</div>
                  </div>
                )}
                {marketData.realtor?.active_inventory != null && (
                  <div className="p-3 bg-muted/30 rounded-lg">
                    <div className="text-xs text-muted-foreground flex items-center gap-1"><Building className="h-3 w-3" /> Active Inventory</div>
                    <div className="text-lg font-bold">{marketData.realtor.active_inventory.toLocaleString()}</div>
                  </div>
                )}
                {marketData.realtor?.price_per_sqft != null && (
                  <div className="p-3 bg-muted/30 rounded-lg">
                    <div className="text-xs text-muted-foreground">Price / sqft</div>
                    <div className="text-lg font-bold">{formatCurrency(marketData.realtor.price_per_sqft)}</div>
                  </div>
                )}
                {marketData.redfin?.sale_to_list_ratio != null && (
                  <div className="p-3 bg-muted/30 rounded-lg">
                    <div className="text-xs text-muted-foreground flex items-center gap-1"><Percent className="h-3 w-3" /> Sale-to-List</div>
                    <div className="text-lg font-bold">{(marketData.redfin.sale_to_list_ratio * 100).toFixed(1)}%</div>
                  </div>
                )}
                {marketData.redfin?.months_of_supply != null && (
                  <div className="p-3 bg-muted/30 rounded-lg">
                    <div className="text-xs text-muted-foreground">Months of Supply</div>
                    <div className="text-lg font-bold">{marketData.redfin.months_of_supply.toFixed(1)}</div>
                  </div>
                )}
              </div>
            </div>

            {/* Economic Indicators */}
            <div className="space-y-3">
              <h4 className="font-semibold flex items-center gap-2">
                <Thermometer className="h-4 w-4 text-primary" />
                Economic Indicators
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {marketData.fred?.mortgage_rate_30yr != null && (
                  <div className="p-3 bg-muted/30 rounded-lg">
                    <div className="text-xs text-muted-foreground">30yr Mortgage Rate</div>
                    <div className="text-lg font-bold">{marketData.fred.mortgage_rate_30yr.toFixed(2)}%</div>
                  </div>
                )}
                {marketData.fhfa?.hpi_1yr != null && (
                  <div className="p-3 bg-muted/30 rounded-lg">
                    <div className="text-xs text-muted-foreground">1yr Price Appreciation</div>
                    <div className={`text-lg font-bold ${(marketData.fhfa.hpi_1yr ?? 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {formatPercent(marketData.fhfa.hpi_1yr)}
                    </div>
                  </div>
                )}
                {marketData.fhfa?.hpi_5yr != null && (
                  <div className="p-3 bg-muted/30 rounded-lg">
                    <div className="text-xs text-muted-foreground">5yr Price Appreciation</div>
                    <div className={`text-lg font-bold ${(marketData.fhfa.hpi_5yr ?? 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {formatPercent(marketData.fhfa.hpi_5yr)}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Demographics */}
            {marketData.census_zip && (
              <div className="space-y-3">
                <h4 className="font-semibold flex items-center gap-2">
                  <Users className="h-4 w-4 text-primary" />
                  Demographics (ZIP)
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {marketData.census_zip.median_household_income != null && (
                    <div className="p-3 bg-muted/30 rounded-lg">
                      <div className="text-xs text-muted-foreground">Median Income</div>
                      <div className="text-lg font-bold">{formatCurrency(marketData.census_zip.median_household_income)}</div>
                    </div>
                  )}
                  {marketData.census_zip.vacancy_rate != null && (
                    <div className="p-3 bg-muted/30 rounded-lg">
                      <div className="text-xs text-muted-foreground">Vacancy Rate</div>
                      <div className="text-lg font-bold">{marketData.census_zip.vacancy_rate.toFixed(1)}%</div>
                    </div>
                  )}
                  {marketData.census_zip.renter_pct != null && (
                    <div className="p-3 bg-muted/30 rounded-lg">
                      <div className="text-xs text-muted-foreground">Renter %</div>
                      <div className="text-lg font-bold">{marketData.census_zip.renter_pct.toFixed(1)}%</div>
                    </div>
                  )}
                  {marketData.census_zip.poverty_rate != null && (
                    <div className="p-3 bg-muted/30 rounded-lg">
                      <div className="text-xs text-muted-foreground">Poverty Rate</div>
                      <div className="text-lg font-bold">{marketData.census_zip.poverty_rate.toFixed(1)}%</div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Natural Hazard Risk */}
            {marketData.fema_nri && (
              <div className="space-y-3">
                <h4 className="font-semibold flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-primary" />
                  Natural Hazard Risk (FEMA)
                </h4>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {[
                    { label: 'Overall', val: marketData.fema_nri.overall_risk },
                    { label: 'Flood', val: marketData.fema_nri.flood },
                    { label: 'Wind', val: marketData.fema_nri.wind },
                    { label: 'Earthquake', val: marketData.fema_nri.earthquake },
                    { label: 'Wildfire', val: marketData.fema_nri.wildfire },
                    { label: 'Tornado', val: marketData.fema_nri.tornado },
                    { label: 'Hail', val: marketData.fema_nri.hail },
                    { label: 'Hurricane', val: marketData.fema_nri.hurricane },
                  ].filter(h => h.val != null).map((hazard) => (
                    <div key={hazard.label} className="p-2 bg-muted/20 rounded-lg text-center">
                      <div className="text-xs text-muted-foreground">{hazard.label}</div>
                      <div className="text-sm font-bold">{typeof hazard.val === 'number' ? hazard.val.toFixed(1) : hazard.val}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Schools */}
            {marketData.schools && (
              <div className="space-y-3">
                <h4 className="font-semibold flex items-center gap-2">
                  <GraduationCap className="h-4 w-4 text-primary" />
                  School Quality
                </h4>
                <div className="grid grid-cols-2 gap-3">
                  {marketData.schools.district_quality && (
                    <div className="p-3 bg-muted/30 rounded-lg">
                      <div className="text-xs text-muted-foreground">District Quality</div>
                      <div className="text-lg font-bold">{marketData.schools.district_quality}</div>
                    </div>
                  )}
                  {marketData.schools.title_i_concentration != null && (
                    <div className="p-3 bg-muted/30 rounded-lg">
                      <div className="text-xs text-muted-foreground">Title I Concentration</div>
                      <div className="text-lg font-bold">{marketData.schools.title_i_concentration}%</div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Data Source Footer */}
            <div className="pt-4 border-t text-xs text-muted-foreground flex items-center justify-between">
              <span className="flex items-center gap-1">
                <MapPin className="h-3 w-3" /> ZIP {zip}
              </span>
              <span>Sources: Zillow ZORI, Realtor.com, Redfin, HUD, Census, FHFA, FRED, FEMA, NCES</span>
            </div>
          </div>
        )}

        {!marketData && !loading && (
          <div className="text-center py-8 text-muted-foreground">
            <BarChart3 className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p>Enter a ZIP code to load market intelligence from 14 data sources.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
