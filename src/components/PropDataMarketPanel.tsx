import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { useToast } from '@/hooks/use-toast';
import { propDataAPI, PropDataMarketResponse, PropDataSafetyResponse, PropDataEstimateResponse } from '@/lib/propdata-api';
import {
  fanOutZipSearch,
  MAX_RADIUS_MI,
  MAX_ZIPS_PER_SEARCH,
  parseZipList,
  resolveOrigin,
  zipsWithinRadius,
} from '@/lib/zip-search';
import {
  BarChart3, TrendingUp, Home, DollarSign, Shield, GraduationCap,
  AlertTriangle, Thermometer, MapPin, RefreshCw, Building, Users,
  Percent, Activity
} from 'lucide-react';

interface PropDataMarketPanelProps {
  zip?: string;
  onDataLoaded?: (data: PropDataMarketResponse) => void;
}

type MarketMode = 'single' | 'multi' | 'radius';

interface ZipMarketRow {
  zip: string;
  market: PropDataMarketResponse | null;
  safety: PropDataSafetyResponse | null;
  rent: PropDataEstimateResponse | null;
}

export function PropDataMarketPanel({ zip: initialZip, onDataLoaded }: PropDataMarketPanelProps) {
  const [mode, setMode] = useState<MarketMode>('single');
  const [zip, setZip] = useState(initialZip || '');
  const [zipList, setZipList] = useState('');
  const [origin, setOrigin] = useState('');
  const [radius, setRadius] = useState('10');
  const [marketData, setMarketData] = useState<PropDataMarketResponse | null>(null);
  const [safetyData, setSafetyData] = useState<PropDataSafetyResponse | null>(null);
  const [rentData, setRentData] = useState<PropDataEstimateResponse | null>(null);
  const [comparison, setComparison] = useState<ZipMarketRow[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const fmt = (val?: number) =>
    val != null ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(val) : 'N/A';

  const fmtPct = (val?: number) =>
    val != null ? `${val >= 0 ? '+' : ''}${val.toFixed(1)}%` : 'N/A';

  const loadOne = async (z: string): Promise<ZipMarketRow | null> => {
    const [market, safety, rent] = await Promise.all([
      propDataAPI.getMarketProfile({ zip: z, months: '12' }).catch(() => null),
      propDataAPI.getSafetyScore({ zip: z }).catch(() => null),
      propDataAPI.getRentEstimate({ zip: z, beds: '3' }).catch(() => null),
    ]);
    if (!market && !safety && !rent) return null;
    return { zip: z, market, safety, rent };
  };

  const runSingle = async () => {
    const z = zip.trim();
    if (!z) {
      toast({ title: 'Enter a ZIP code', variant: 'destructive' });
      return;
    }
    const row = await loadOne(z);
    setComparison([]);
    setMarketData(row?.market ?? null);
    setSafetyData(row?.safety ?? null);
    setRentData(row?.rent ?? null);
    if (row?.market) {
      onDataLoaded?.(row.market);
      toast({ title: 'Market data loaded', description: `14 sources for ZIP ${z}` });
    } else {
      toast({ title: 'No market data', description: `Nothing returned for ${z}.`, variant: 'destructive' });
    }
  };

  const runMulti = async () => {
    const { valid, invalid } = parseZipList(zipList);
    if (valid.length === 0) {
      toast({ title: 'Enter ZIP codes', description: 'Add one or more 5-digit ZIPs.', variant: 'destructive' });
      return;
    }
    if (invalid.length) toast({ title: 'Skipped invalid entries', description: invalid.slice(0, 5).join(', ') });
    const zips = valid.slice(0, MAX_ZIPS_PER_SEARCH);
    if (valid.length > MAX_ZIPS_PER_SEARCH) {
      toast({ title: `Capped at ${MAX_ZIPS_PER_SEARCH} ZIPs`, description: `Got ${valid.length}; using the first ${MAX_ZIPS_PER_SEARCH}.` });
    }
    const batched = await fanOutZipSearch(zips, (z) => loadOne(z));
    const rows = batched.map((b) => b.result);
    setComparison(rows);
    const first = rows[0];
    setMarketData(first?.market ?? null);
    setSafetyData(first?.safety ?? null);
    setRentData(first?.rent ?? null);
    if (first?.market) onDataLoaded?.(first.market);
    toast({ title: `Loaded ${rows.length} ZIP${rows.length === 1 ? '' : 's'}`, description: rows.map((r) => r.zip).join(', ') });
  };

  const runRadius = async () => {
    if (!origin.trim()) {
      toast({ title: 'Enter an origin', description: 'Provide a ZIP code or address.', variant: 'destructive' });
      return;
    }
    const r = Number(radius);
    if (!Number.isFinite(r) || r <= 0) {
      toast({ title: 'Invalid radius', description: `Enter miles between 1 and ${MAX_RADIUS_MI}.`, variant: 'destructive' });
      return;
    }
    const o = await resolveOrigin(origin.trim());
    if (!o) {
      toast({ title: 'Could not resolve origin', description: `Couldn't find coordinates for "${origin.trim()}".`, variant: 'destructive' });
      return;
    }
    const nearby = await zipsWithinRadius({ lat: o.lat, lng: o.lng }, r, MAX_ZIPS_PER_SEARCH);
    if (nearby.length === 0) {
      toast({ title: 'No ZIPs in range', description: `No US ZIPs within ${r} mi of ${o.label}.`, variant: 'destructive' });
      return;
    }
    toast({ title: `${nearby.length} ZIP${nearby.length === 1 ? '' : 's'} within ${r} mi`, description: o.label });
    const zips = nearby.map((n) => n.zip);
    const batched = await fanOutZipSearch(zips, (z) => loadOne(z));
    const rows = batched.map((b) => b.result);
    setComparison(rows);
    const first = rows[0];
    setMarketData(first?.market ?? null);
    setSafetyData(first?.safety ?? null);
    setRentData(first?.rent ?? null);
    if (first?.market) onDataLoaded?.(first.market);
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      if (mode === 'single') await runSingle();
      else if (mode === 'multi') await runMulti();
      else await runRadius();
    } catch (err) {
      console.error('[PropDataMarketPanel]', err);
      toast({ title: 'Error', description: 'Failed to load market data.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const safetyColor = (grade?: string) => {
    const map: Record<string, string> = {
      A: 'bg-green-500/20 text-green-600 border-green-500/30',
      B: 'bg-blue-500/20 text-blue-600 border-blue-500/30',
      C: 'bg-yellow-500/20 text-yellow-600 border-yellow-500/30',
      D: 'bg-orange-500/20 text-orange-600 border-orange-500/30',
      F: 'bg-red-500/20 text-red-600 border-red-500/30',
    };
    return map[grade?.toUpperCase() || ''] || 'bg-muted text-muted-foreground';
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
        <div className="space-y-3">
          <ToggleGroup
            type="single"
            value={mode}
            onValueChange={(v) => v && setMode(v as MarketMode)}
            className="justify-start"
          >
            <ToggleGroupItem value="single" aria-label="Single ZIP">Single</ToggleGroupItem>
            <ToggleGroupItem value="multi" aria-label="Multiple ZIPs">Multiple ZIPs</ToggleGroupItem>
            <ToggleGroupItem value="radius" aria-label="ZIP + radius">ZIP + radius</ToggleGroupItem>
          </ToggleGroup>

          {mode === 'single' && (
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
          )}

          {mode === 'multi' && (
            <div className="space-y-2">
              <Label htmlFor="propdata-zip-list">ZIP Codes</Label>
              <Textarea
                id="propdata-zip-list"
                value={zipList}
                onChange={(e) => setZipList(e.target.value)}
                placeholder="33101, 33102, 33125&#10;30318  30310  30314"
                className="bg-background/50 font-mono text-sm min-h-[72px]"
              />
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">Comma, space, or newline separated · up to {MAX_ZIPS_PER_SEARCH}.</p>
                <Button onClick={fetchData} disabled={loading}>
                  {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <BarChart3 className="h-4 w-4" />}
                  <span className="ml-2">{loading ? 'Loading...' : 'Compare all'}</span>
                </Button>
              </div>
            </div>
          )}

          {mode === 'radius' && (
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="flex-1 space-y-2">
                <Label htmlFor="propdata-origin">Origin (ZIP or address)</Label>
                <Input
                  id="propdata-origin"
                  value={origin}
                  onChange={(e) => setOrigin(e.target.value)}
                  placeholder="33101 — or — 123 Main St, Miami FL"
                  className="bg-background/50"
                  onKeyDown={(e) => e.key === 'Enter' && fetchData()}
                />
              </div>
              <div className="w-full sm:w-28 space-y-2">
                <Label htmlFor="propdata-radius">Radius (mi)</Label>
                <Input
                  id="propdata-radius"
                  type="number"
                  min={1}
                  max={MAX_RADIUS_MI}
                  value={radius}
                  onChange={(e) => setRadius(e.target.value)}
                  className="bg-background/50"
                  onKeyDown={(e) => e.key === 'Enter' && fetchData()}
                />
              </div>
              <div className="flex items-end">
                <Button onClick={fetchData} disabled={loading} className="h-10">
                  {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <BarChart3 className="h-4 w-4" />}
                  <span className="ml-2">{loading ? 'Loading...' : 'Analyze'}</span>
                </Button>
              </div>
            </div>
          )}
        </div>

        {comparison.length > 1 && (
          <div className="space-y-2 animate-fade-in">
            <h4 className="font-semibold flex items-center gap-2"><TrendingUp className="h-4 w-4 text-primary" /> ZIP Comparison ({comparison.length})</h4>
            <div className="overflow-x-auto rounded-lg border border-border/40">
              <table className="w-full text-sm">
                <thead className="bg-muted/30">
                  <tr className="text-left">
                    <th className="px-3 py-2 font-medium">ZIP</th>
                    <th className="px-3 py-2 font-medium">Median List</th>
                    <th className="px-3 py-2 font-medium">Rent (3BR)</th>
                    <th className="px-3 py-2 font-medium">DOM</th>
                    <th className="px-3 py-2 font-medium">Safety</th>
                  </tr>
                </thead>
                <tbody>
                  {comparison.map((row) => (
                    <tr key={row.zip} className="border-t border-border/40 hover:bg-muted/20">
                      <td className="px-3 py-2 font-mono">{row.zip}</td>
                      <td className="px-3 py-2">{fmt(row.market?.realtor?.median_list_price)}</td>
                      <td className="px-3 py-2">{fmt(row.rent?.rent_mid)}</td>
                      <td className="px-3 py-2">{row.market?.realtor?.days_on_market ?? 'N/A'}</td>
                      <td className="px-3 py-2">{row.safety?.grade ? `${row.safety.grade} (${row.safety.score ?? '?'})` : 'N/A'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-muted-foreground">Detail view below reflects the first ZIP in the batch.</p>
          </div>
        )}

        {marketData && (
          <div className="space-y-6 animate-fade-in">
            {safetyData?.grade && (
              <div className={`p-4 rounded-lg border ${safetyColor(safetyData.grade)}`}>
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
                {safetyData.narrative && <p className="text-sm opacity-80 mt-2">{safetyData.narrative}</p>}
              </div>
            )}

            {/* Rent Estimates */}
            <div className="space-y-3">
              <h4 className="font-semibold flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-primary" /> Rent Estimates (3BR)
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {rentData?.rent_low != null && <div className="p-3 bg-muted/30 rounded-lg"><div className="text-xs text-muted-foreground">Low</div><div className="text-lg font-bold">{fmt(rentData.rent_low)}</div></div>}
                {rentData?.rent_mid != null && <div className="p-3 bg-primary/10 rounded-lg border border-primary/20"><div className="text-xs text-muted-foreground">Mid</div><div className="text-lg font-bold text-primary">{fmt(rentData.rent_mid)}</div></div>}
                {rentData?.rent_high != null && <div className="p-3 bg-muted/30 rounded-lg"><div className="text-xs text-muted-foreground">High</div><div className="text-lg font-bold">{fmt(rentData.rent_high)}</div></div>}
                {rentData?.confidence != null && <div className="p-3 bg-muted/30 rounded-lg"><div className="text-xs text-muted-foreground">Confidence</div><div className="text-lg font-bold">{rentData.confidence}%</div></div>}
              </div>
              {marketData.hud_fmr && (
                <div className="grid grid-cols-5 gap-2 mt-2">
                  {[{ l: 'Studio', v: marketData.hud_fmr.studio }, { l: '1BR', v: marketData.hud_fmr.one_br }, { l: '2BR', v: marketData.hud_fmr.two_br }, { l: '3BR', v: marketData.hud_fmr.three_br }, { l: '4BR', v: marketData.hud_fmr.four_br }].map(i => (
                    <div key={i.l} className="text-center p-2 bg-muted/20 rounded-lg"><div className="text-xs text-muted-foreground">{i.l}</div><div className="text-sm font-medium">{fmt(i.v)}</div></div>
                  ))}
                  <div className="col-span-5 text-xs text-muted-foreground text-center">HUD Fair Market Rents</div>
                </div>
              )}
            </div>

            {/* Market Metrics */}
            <div className="space-y-3">
              <h4 className="font-semibold flex items-center gap-2"><TrendingUp className="h-4 w-4 text-primary" /> Market Metrics</h4>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {marketData.realtor?.median_list_price != null && <div className="p-3 bg-muted/30 rounded-lg"><div className="text-xs text-muted-foreground flex items-center gap-1"><Home className="h-3 w-3" /> Median List</div><div className="text-lg font-bold">{fmt(marketData.realtor.median_list_price)}</div></div>}
                {marketData.realtor?.days_on_market != null && <div className="p-3 bg-muted/30 rounded-lg"><div className="text-xs text-muted-foreground flex items-center gap-1"><Activity className="h-3 w-3" /> DOM</div><div className="text-lg font-bold">{marketData.realtor.days_on_market}</div></div>}
                {marketData.realtor?.active_inventory != null && <div className="p-3 bg-muted/30 rounded-lg"><div className="text-xs text-muted-foreground flex items-center gap-1"><Building className="h-3 w-3" /> Inventory</div><div className="text-lg font-bold">{marketData.realtor.active_inventory.toLocaleString()}</div></div>}
                {marketData.realtor?.price_per_sqft != null && <div className="p-3 bg-muted/30 rounded-lg"><div className="text-xs text-muted-foreground">$/sqft</div><div className="text-lg font-bold">{fmt(marketData.realtor.price_per_sqft)}</div></div>}
                {marketData.redfin?.sale_to_list_ratio != null && <div className="p-3 bg-muted/30 rounded-lg"><div className="text-xs text-muted-foreground flex items-center gap-1"><Percent className="h-3 w-3" /> Sale/List</div><div className="text-lg font-bold">{(marketData.redfin.sale_to_list_ratio * 100).toFixed(1)}%</div></div>}
                {marketData.redfin?.months_of_supply != null && <div className="p-3 bg-muted/30 rounded-lg"><div className="text-xs text-muted-foreground">Supply (mo)</div><div className="text-lg font-bold">{marketData.redfin.months_of_supply.toFixed(1)}</div></div>}
              </div>
            </div>

            {/* Economic */}
            <div className="space-y-3">
              <h4 className="font-semibold flex items-center gap-2"><Thermometer className="h-4 w-4 text-primary" /> Economic Indicators</h4>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {marketData.fred?.mortgage_rate_30yr != null && <div className="p-3 bg-muted/30 rounded-lg"><div className="text-xs text-muted-foreground">30yr Rate</div><div className="text-lg font-bold">{marketData.fred.mortgage_rate_30yr.toFixed(2)}%</div></div>}
                {marketData.fhfa?.hpi_1yr != null && <div className="p-3 bg-muted/30 rounded-lg"><div className="text-xs text-muted-foreground">1yr Appreciation</div><div className={`text-lg font-bold ${(marketData.fhfa.hpi_1yr ?? 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>{fmtPct(marketData.fhfa.hpi_1yr)}</div></div>}
                {marketData.fhfa?.hpi_5yr != null && <div className="p-3 bg-muted/30 rounded-lg"><div className="text-xs text-muted-foreground">5yr Appreciation</div><div className={`text-lg font-bold ${(marketData.fhfa.hpi_5yr ?? 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>{fmtPct(marketData.fhfa.hpi_5yr)}</div></div>}
              </div>
            </div>

            {/* Demographics */}
            {marketData.census_zip && (
              <div className="space-y-3">
                <h4 className="font-semibold flex items-center gap-2"><Users className="h-4 w-4 text-primary" /> Demographics</h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {marketData.census_zip.median_household_income != null && <div className="p-3 bg-muted/30 rounded-lg"><div className="text-xs text-muted-foreground">Income</div><div className="text-lg font-bold">{fmt(marketData.census_zip.median_household_income)}</div></div>}
                  {marketData.census_zip.vacancy_rate != null && <div className="p-3 bg-muted/30 rounded-lg"><div className="text-xs text-muted-foreground">Vacancy</div><div className="text-lg font-bold">{marketData.census_zip.vacancy_rate.toFixed(1)}%</div></div>}
                  {marketData.census_zip.renter_pct != null && <div className="p-3 bg-muted/30 rounded-lg"><div className="text-xs text-muted-foreground">Renter %</div><div className="text-lg font-bold">{marketData.census_zip.renter_pct.toFixed(1)}%</div></div>}
                  {marketData.census_zip.poverty_rate != null && <div className="p-3 bg-muted/30 rounded-lg"><div className="text-xs text-muted-foreground">Poverty</div><div className="text-lg font-bold">{marketData.census_zip.poverty_rate.toFixed(1)}%</div></div>}
                </div>
              </div>
            )}

            {/* Hazards */}
            {marketData.fema_nri && (
              <div className="space-y-3">
                <h4 className="font-semibold flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-primary" /> Hazard Risk (FEMA)</h4>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {[{ l: 'Overall', v: marketData.fema_nri.overall_risk }, { l: 'Flood', v: marketData.fema_nri.flood }, { l: 'Wind', v: marketData.fema_nri.wind }, { l: 'Earthquake', v: marketData.fema_nri.earthquake }, { l: 'Wildfire', v: marketData.fema_nri.wildfire }, { l: 'Tornado', v: marketData.fema_nri.tornado }, { l: 'Hurricane', v: marketData.fema_nri.hurricane }].filter(h => h.v != null).map(h => (
                    <div key={h.l} className="p-2 bg-muted/20 rounded-lg text-center"><div className="text-xs text-muted-foreground">{h.l}</div><div className="text-sm font-bold">{typeof h.v === 'number' ? h.v.toFixed(1) : h.v}</div></div>
                  ))}
                </div>
              </div>
            )}

            {/* Schools */}
            {marketData.schools?.district_quality && (
              <div className="space-y-3">
                <h4 className="font-semibold flex items-center gap-2"><GraduationCap className="h-4 w-4 text-primary" /> Schools</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 bg-muted/30 rounded-lg"><div className="text-xs text-muted-foreground">District Quality</div><div className="text-lg font-bold">{marketData.schools.district_quality}</div></div>
                  {marketData.schools.title_i_concentration != null && <div className="p-3 bg-muted/30 rounded-lg"><div className="text-xs text-muted-foreground">Title I</div><div className="text-lg font-bold">{marketData.schools.title_i_concentration}%</div></div>}
                </div>
              </div>
            )}

            <div className="pt-4 border-t text-xs text-muted-foreground flex items-center justify-between">
              <span className="flex items-center gap-1"><MapPin className="h-3 w-3" /> ZIP {marketData?.zip || comparison[0]?.zip || zip}</span>
              <span>Zillow ZORI, Realtor.com, Redfin, HUD, Census, FHFA, FRED, FEMA, NCES</span>
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
