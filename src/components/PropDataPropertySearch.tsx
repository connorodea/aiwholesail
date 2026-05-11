import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { useToast } from '@/hooks/use-toast';
import { propDataAPI, PropDataPropertyResponse } from '@/lib/propdata-api';
import {
  fanOutZipSearch,
  MAX_RADIUS_MI,
  MAX_ZIPS_PER_SEARCH,
  parseZipList,
  resolveOrigin,
  zipsWithinRadius,
} from '@/lib/zip-search';
import { Search, MapPin, User, Home, Calendar, Mail, Building, FileText, RefreshCw } from 'lucide-react';

interface PropDataPropertySearchProps {
  onPropertyFound?: (property: PropDataPropertyResponse) => void;
}

type SearchMode = 'single' | 'multi' | 'radius';

export function PropDataPropertySearch({ onPropertyFound }: PropDataPropertySearchProps) {
  const [mode, setMode] = useState<SearchMode>('single');
  const [address, setAddress] = useState('');
  const [zip, setZip] = useState('');
  const [zipList, setZipList] = useState('');
  const [origin, setOrigin] = useState('');
  const [radius, setRadius] = useState('10');
  const [results, setResults] = useState<PropDataPropertyResponse[]>([]);
  const [resolvedZips, setResolvedZips] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const fmt = (val?: number) =>
    val != null ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(val) : 'N/A';

  const fetchForZip = async (z: string, addr = ''): Promise<PropDataPropertyResponse[]> => {
    const params: Record<string, string> = {};
    if (addr) params.address = addr;
    if (z) params.zip = z;
    const result = await propDataAPI.getProperty(params);
    return Array.isArray(result) ? result : [result];
  };

  const runSingle = async () => {
    if (!address.trim() && !zip.trim()) {
      toast({ title: 'Enter search criteria', description: 'Provide an address or ZIP code.', variant: 'destructive' });
      return;
    }
    const list = await fetchForZip(zip.trim(), address.trim());
    setResolvedZips(zip.trim() ? [zip.trim()] : []);
    setResults(list);
    if (list.length > 0 && list[0].address) {
      toast({ title: 'Property found', description: `${list.length} record(s) from county assessor data.` });
      onPropertyFound?.(list[0]);
    } else {
      toast({ title: 'No results', description: 'No property records found.', variant: 'destructive' });
      setResults([]);
    }
  };

  const runMulti = async () => {
    const { valid, invalid } = parseZipList(zipList);
    if (valid.length === 0) {
      toast({ title: 'Enter ZIP codes', description: 'Add one or more 5-digit ZIPs (comma, space, or newline separated).', variant: 'destructive' });
      return;
    }
    if (invalid.length) {
      toast({ title: 'Skipped invalid entries', description: invalid.slice(0, 5).join(', ') });
    }
    const zips = valid.slice(0, MAX_ZIPS_PER_SEARCH);
    if (valid.length > MAX_ZIPS_PER_SEARCH) {
      toast({ title: `Capped at ${MAX_ZIPS_PER_SEARCH} ZIPs`, description: `Got ${valid.length}; using the first ${MAX_ZIPS_PER_SEARCH}.` });
    }
    const batched = await fanOutZipSearch(zips, async (z) => {
      const list = await fetchForZip(z);
      return list.length && list[0].address ? list : null;
    });
    const flat = batched.flatMap((b) => b.result);
    setResolvedZips(zips);
    setResults(flat);
    if (flat.length === 0) {
      toast({ title: 'No results', description: `Searched ${zips.length} ZIP${zips.length === 1 ? '' : 's'}, nothing returned.`, variant: 'destructive' });
    } else {
      toast({ title: `${flat.length} record${flat.length === 1 ? '' : 's'} across ${batched.length} ZIP${batched.length === 1 ? '' : 's'}` });
      onPropertyFound?.(flat[0]);
    }
  };

  const runRadius = async () => {
    if (!origin.trim()) {
      toast({ title: 'Enter an origin', description: 'Provide a ZIP code or address as the center point.', variant: 'destructive' });
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
      toast({ title: 'No ZIPs in range', description: `No US ZIPs found within ${r} mi of ${o.label}.`, variant: 'destructive' });
      return;
    }
    toast({ title: `Found ${nearby.length} ZIP${nearby.length === 1 ? '' : 's'} within ${r} mi`, description: o.label });
    const zips = nearby.map((n) => n.zip);
    const batched = await fanOutZipSearch(zips, async (z) => {
      const list = await fetchForZip(z);
      return list.length && list[0].address ? list : null;
    });
    const flat = batched.flatMap((b) => b.result);
    setResolvedZips(zips);
    setResults(flat);
    if (flat.length === 0) {
      toast({ title: 'No property records', description: 'Nearby ZIPs returned no county records.', variant: 'destructive' });
    } else {
      onPropertyFound?.(flat[0]);
    }
  };

  const handleSearch = async () => {
    setLoading(true);
    try {
      if (mode === 'single') await runSingle();
      else if (mode === 'multi') await runMulti();
      else await runRadius();
    } catch (err) {
      console.error('[PropDataPropertySearch]', err);
      toast({ title: 'Search failed', description: 'Could not fetch property data.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card className="simple-card">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-xl">
            <Search className="h-5 w-5 text-primary" />
            Off-Market Property Lookup
          </CardTitle>
          <p className="text-sm text-muted-foreground">Search 82M+ county assessor records for owner info, values, and sale history.</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <ToggleGroup
            type="single"
            value={mode}
            onValueChange={(v) => v && setMode(v as SearchMode)}
            className="justify-start"
          >
            <ToggleGroupItem value="single" aria-label="Single search">Single</ToggleGroupItem>
            <ToggleGroupItem value="multi" aria-label="Multi-ZIP search">Multiple ZIPs</ToggleGroupItem>
            <ToggleGroupItem value="radius" aria-label="ZIP + radius search">ZIP + radius</ToggleGroupItem>
          </ToggleGroup>

          {mode === 'single' && (
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1 space-y-2">
                <Label htmlFor="pd-address">Street Address</Label>
                <Input id="pd-address" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="e.g. 123 Main St, Miami FL" className="bg-background/50" onKeyDown={(e) => e.key === 'Enter' && handleSearch()} />
              </div>
              <div className="w-full sm:w-32 space-y-2">
                <Label htmlFor="pd-zip">ZIP Code</Label>
                <Input id="pd-zip" value={zip} onChange={(e) => setZip(e.target.value)} placeholder="33101" className="bg-background/50" onKeyDown={(e) => e.key === 'Enter' && handleSearch()} />
              </div>
              <div className="flex items-end">
                <Button onClick={handleSearch} disabled={loading} className="w-full sm:w-auto h-10">
                  {loading ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : <Search className="h-4 w-4 mr-2" />}
                  {loading ? 'Searching...' : 'Search'}
                </Button>
              </div>
            </div>
          )}

          {mode === 'multi' && (
            <div className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="pd-zip-list">ZIP Codes</Label>
                <Textarea
                  id="pd-zip-list"
                  value={zipList}
                  onChange={(e) => setZipList(e.target.value)}
                  placeholder="33101, 33102, 33125&#10;30318  30310  30314"
                  className="bg-background/50 font-mono text-sm min-h-[88px]"
                />
                <p className="text-xs text-muted-foreground">Comma, space, or newline separated · up to {MAX_ZIPS_PER_SEARCH} ZIPs per search.</p>
              </div>
              <Button onClick={handleSearch} disabled={loading} className="h-10">
                {loading ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : <Search className="h-4 w-4 mr-2" />}
                {loading ? 'Searching...' : 'Search all ZIPs'}
              </Button>
            </div>
          )}

          {mode === 'radius' && (
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1 space-y-2">
                <Label htmlFor="pd-origin">Origin (ZIP or address)</Label>
                <Input
                  id="pd-origin"
                  value={origin}
                  onChange={(e) => setOrigin(e.target.value)}
                  placeholder="33101 — or — 123 Main St, Miami FL"
                  className="bg-background/50"
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                />
              </div>
              <div className="w-full sm:w-32 space-y-2">
                <Label htmlFor="pd-radius">Radius (mi)</Label>
                <Input
                  id="pd-radius"
                  type="number"
                  min={1}
                  max={MAX_RADIUS_MI}
                  value={radius}
                  onChange={(e) => setRadius(e.target.value)}
                  className="bg-background/50"
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                />
              </div>
              <div className="flex items-end">
                <Button onClick={handleSearch} disabled={loading} className="w-full sm:w-auto h-10">
                  {loading ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : <Search className="h-4 w-4 mr-2" />}
                  {loading ? 'Searching...' : 'Search radius'}
                </Button>
              </div>
            </div>
          )}

          {resolvedZips.length > 1 && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              <span className="text-xs text-muted-foreground mr-1">Searched ZIPs:</span>
              {resolvedZips.map((z) => (
                <Badge key={z} variant="outline" className="text-xs font-mono">{z}</Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {results.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-medium">{results.length} {results.length === 1 ? 'Record' : 'Records'} Found</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {results.map((property, idx) => (
              <Card key={idx} className="simple-card hover:shadow-elegant smooth-transition">
                <CardContent className="pt-6 space-y-4">
                  <div className="space-y-1">
                    <h3 className="font-semibold text-lg flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-primary flex-shrink-0" />
                      {property.address || 'Unknown Address'}
                    </h3>
                    <p className="text-sm text-muted-foreground ml-6">{[property.county, property.state, property.zip].filter(Boolean).join(', ')}</p>
                  </div>

                  {property.owner_name && (
                    <div className="p-3 bg-primary/5 rounded-lg border border-primary/10">
                      <div className="flex items-center gap-2 mb-1"><User className="h-4 w-4 text-primary" /><span className="font-medium text-sm">Owner</span></div>
                      <div className="ml-6 space-y-1 text-sm">
                        <div><strong>{property.owner_name}</strong></div>
                        {property.mailing_address && (
                          <div className="flex items-start gap-1">
                            <Mail className="h-3 w-3 mt-1 text-muted-foreground flex-shrink-0" />
                            <span>{property.mailing_address}{property.mailing_city ? `, ${property.mailing_city}` : ''}{property.mailing_state ? ` ${property.mailing_state}` : ''} {property.mailing_zip || ''}</span>
                          </div>
                        )}
                        {property.owner_occupied != null && <Badge variant="outline" className="text-xs">{property.owner_occupied ? 'Owner Occupied' : 'Non-Owner Occupied'}</Badge>}
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-3">
                    {property.property_type && <div className="flex items-center gap-2 p-2 bg-muted/30 rounded-lg"><Home className="h-3.5 w-3.5 text-muted-foreground" /><span className="text-sm">{property.property_type}</span></div>}
                    {property.year_built && <div className="flex items-center gap-2 p-2 bg-muted/30 rounded-lg"><Calendar className="h-3.5 w-3.5 text-muted-foreground" /><span className="text-sm">Built {property.year_built}</span></div>}
                    {property.bedrooms != null && <div className="flex items-center gap-2 p-2 bg-muted/30 rounded-lg"><Building className="h-3.5 w-3.5 text-muted-foreground" /><span className="text-sm">{property.bedrooms} bed / {property.bathrooms ?? '?'} bath</span></div>}
                    {property.sqft != null && <div className="flex items-center gap-2 p-2 bg-muted/30 rounded-lg"><FileText className="h-3.5 w-3.5 text-muted-foreground" /><span className="text-sm">{property.sqft.toLocaleString()} sqft</span></div>}
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {property.assessed_value != null && <div className="p-3 bg-muted/30 rounded-lg"><div className="text-xs text-muted-foreground">Assessed</div><div className="text-base font-bold">{fmt(property.assessed_value)}</div></div>}
                    {property.market_value != null && <div className="p-3 bg-green-500/10 rounded-lg border border-green-500/20"><div className="text-xs text-muted-foreground">Market Value</div><div className="text-base font-bold text-green-600">{fmt(property.market_value)}</div></div>}
                    {property.last_sale_price != null && <div className="p-3 bg-muted/30 rounded-lg"><div className="text-xs text-muted-foreground">Last Sale</div><div className="text-base font-bold">{fmt(property.last_sale_price)}</div>{property.last_sale_date && <div className="text-xs text-muted-foreground">{property.last_sale_date}</div>}</div>}
                  </div>

                  <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t">
                    {property.tax_amount != null && <span>Tax: {fmt(property.tax_amount)}/yr</span>}
                    {property.tax_delinquent && <Badge variant="destructive" className="text-xs">Tax Delinquent</Badge>}
                    {property.apn && <span>APN: {property.apn}</span>}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
