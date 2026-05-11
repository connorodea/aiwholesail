import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import { propDataAPI, type PropDataPropertyListResponse, type PropDataPropertyRecord } from '@/lib/propdata-api';
import { mapPropDataListToUnified } from '@/lib/unifiedPropertyAdapters';
import { Search, MapPin, User, Mail, Building, RefreshCw, Download, TrendingUp, Flame, ShieldCheck, Sparkles } from 'lucide-react';

/**
 * sessionStorage key for handing off off-market UnifiedProperty[] records
 * from this component to the AI Deal Analyzer on /app/analyzer. The
 * analyzer reads + clears this key on mount.
 */
export const OFFMARKET_ANALYZER_HANDOFF_KEY = 'aiw_offmarket_for_analyzer';
export const OFFMARKET_ANALYZER_HANDOFF_ZIP_KEY = 'aiw_offmarket_for_analyzer_zip';

/**
 * Absentee Owner Search
 *
 * The killer wholesaler feature: paste a ZIP, get a ranked list of properties
 * where the owner's mailing address is different from the property address —
 * i.e. landlords who own out-of-state, the highest-converting outreach segment
 * for direct mail.
 *
 * Powered by /v1/property?absentee_only=true under the new authenticated
 * backend proxy. Equity %, opportunity zone, and flood flags surface as
 * badges. Export to CSV for direct-mail tools.
 */

interface AbsenteeOwnerSearchProps {
  defaultZip?: string;
}

type EquityFilter = 'any' | 'gte_40' | 'gte_60' | 'gte_80';

const LIMIT_OPTIONS = [25, 50, 100];

const fmtCurrency = (val?: number | null) =>
  val != null
    ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(val)
    : '—';

const fmtPct = (val?: number | null) => (val != null ? `${Math.round(val)}%` : '—');

function equityThreshold(filter: EquityFilter): number {
  if (filter === 'gte_40') return 40;
  if (filter === 'gte_60') return 60;
  if (filter === 'gte_80') return 80;
  return 0;
}

function joinAddr(rec: PropDataPropertyRecord): string {
  const a = rec.address;
  if (!a) return rec.parcel_id || 'Unknown';
  return [a.street, a.city, a.zip].filter(Boolean).join(', ');
}

function mailingAddr(rec: PropDataPropertyRecord): string {
  const o = rec.owner;
  if (!o) return '';
  return [o.mailing_address, o.mailing_city, o.mailing_state, o.mailing_zip].filter(Boolean).join(', ');
}

function toCsv(records: PropDataPropertyRecord[]): string {
  const header = [
    'owner_name', 'property_address', 'property_city', 'property_zip',
    'mailing_address', 'mailing_city', 'mailing_state', 'mailing_zip',
    'market_value', 'last_sale_price', 'last_sale_date',
    'estimated_equity', 'equity_pct', 'years_held',
    'is_absentee', 'parcel_id', 'county',
  ];
  const rows = records.map((r) => [
    r.owner?.name || '',
    r.address?.street || '',
    r.address?.city || '',
    r.address?.zip || '',
    r.owner?.mailing_address || '',
    r.owner?.mailing_city || '',
    r.owner?.mailing_state || '',
    r.owner?.mailing_zip || '',
    r.valuation?.market_value ?? '',
    r.sale?.last_sale_price ?? '',
    r.sale?.last_sale_date || '',
    r.equity?.estimated_equity ?? '',
    r.equity?.equity_pct ?? '',
    r.equity?.years_held ?? '',
    r.flags?.is_absentee_owner ? 'true' : 'false',
    r.parcel_id || '',
    r.county_name || '',
  ]);
  return [header, ...rows]
    .map((cols) => cols.map((c) => {
      const s = String(c ?? '');
      // RFC 4180: quote when comma/quote/newline; double internal quotes.
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    }).join(','))
    .join('\n');
}

export function AbsenteeOwnerSearch({ defaultZip = '' }: AbsenteeOwnerSearchProps) {
  const [zip, setZip] = useState(defaultZip);
  const [limit, setLimit] = useState<number>(25);
  const [equityFilter, setEquityFilter] = useState<EquityFilter>('any');
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<PropDataPropertyListResponse | null>(null);
  const { toast } = useToast();
  const navigate = useNavigate();

  const filtered = useMemo(() => {
    const props = data?.properties || [];
    const threshold = equityThreshold(equityFilter);
    if (threshold === 0) return props;
    return props.filter((p) => (p.equity?.equity_pct ?? 0) >= threshold);
  }, [data, equityFilter]);

  const enrichment = data?.enrichment;

  const handleSearch = async () => {
    const z = zip.trim();
    if (!/^\d{5}$/.test(z)) {
      toast({ title: 'Enter a 5-digit ZIP', description: `Got "${z || '(empty)'}".`, variant: 'destructive' });
      return;
    }
    setLoading(true);
    try {
      const res = await propDataAPI.listAbsenteeOwners({ zip: z, limit });
      if (res.error) {
        toast({ title: 'No absentee owners returned', description: res.error, variant: 'destructive' });
        setData({ properties: [], count: 0 });
        return;
      }
      setData(res);
      const n = res.properties?.length ?? 0;
      toast({
        title: n === 0 ? 'No absentee owners in this ZIP' : `${n} absentee owner${n === 1 ? '' : 's'}`,
        description: n === 0 ? 'Coverage may be thin — try a nearby major-metro ZIP.' : 'Filter by equity and export to CSV for direct mail.',
      });
    } catch (err) {
      console.error('[AbsenteeOwnerSearch]', err);
      toast({ title: 'Search failed', description: 'Could not fetch absentee owners.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  /**
   * Hand off the currently-filtered absentee owners to the AI Deal Analyzer.
   * Maps PropData records → UnifiedProperty[] (the analyzer's expected shape
   * since PR #179), stashes in sessionStorage, then navigates. The analyzer
   * picks the stash up on mount and clears it.
   */
  const handleAnalyzeWithAI = () => {
    if (filtered.length === 0) return;
    const unified = mapPropDataListToUnified({
      properties: filtered,
      enrichment: data?.enrichment,
    });
    try {
      sessionStorage.setItem(OFFMARKET_ANALYZER_HANDOFF_KEY, JSON.stringify(unified));
      sessionStorage.setItem(OFFMARKET_ANALYZER_HANDOFF_ZIP_KEY, zip.trim());
    } catch (err) {
      console.error('[AbsenteeOwnerSearch] sessionStorage write failed', err);
      toast({ title: 'Could not hand off to analyzer', description: 'Storage quota?', variant: 'destructive' });
      return;
    }
    toast({
      title: `Sending ${filtered.length} owner${filtered.length === 1 ? '' : 's'} to AI Analyzer`,
      description: 'Running ARV, repair, MAO, and motivation analysis…',
    });
    navigate('/app/analyzer?source=off-market');
  };

  const handleExport = () => {
    if (filtered.length === 0) return;
    const csv = toCsv(filtered);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `absentee-owners-${zip.trim()}-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast({ title: 'CSV exported', description: `${filtered.length} record${filtered.length === 1 ? '' : 's'} downloaded.` });
  };

  return (
    <div className="space-y-6">
      <Card className="simple-card">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-xl">
            <Flame className="h-5 w-5 text-amber-400" />
            Absentee Owner Search
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Find landlords whose mailing address is different from the property — the highest-converting direct-mail segment.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 space-y-2">
              <Label htmlFor="abs-zip">ZIP Code</Label>
              <Input
                id="abs-zip"
                value={zip}
                onChange={(e) => setZip(e.target.value)}
                placeholder="55101"
                inputMode="numeric"
                maxLength={5}
                className="bg-background/50 font-mono"
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              />
            </div>
            <div className="w-full sm:w-36 space-y-2">
              <Label htmlFor="abs-limit">Max results</Label>
              <select
                id="abs-limit"
                value={limit}
                onChange={(e) => setLimit(Number(e.target.value))}
                className="w-full h-10 px-3 rounded-md bg-background/50 border border-input text-sm"
              >
                {LIMIT_OPTIONS.map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
            <div className="w-full sm:w-44 space-y-2">
              <Label htmlFor="abs-equity">Min equity</Label>
              <select
                id="abs-equity"
                value={equityFilter}
                onChange={(e) => setEquityFilter(e.target.value as EquityFilter)}
                className="w-full h-10 px-3 rounded-md bg-background/50 border border-input text-sm"
              >
                <option value="any">Any</option>
                <option value="gte_40">≥ 40%</option>
                <option value="gte_60">≥ 60%</option>
                <option value="gte_80">≥ 80%</option>
              </select>
            </div>
            <div className="flex items-end">
              <Button onClick={handleSearch} disabled={loading} className="w-full sm:w-auto h-10">
                {loading ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : <Search className="h-4 w-4 mr-2" />}
                {loading ? 'Searching…' : 'Search ZIP'}
              </Button>
            </div>
          </div>

          {enrichment && (data?.properties?.length ?? 0) > 0 && (
            <div className="flex flex-wrap gap-2 pt-1">
              {enrichment.is_opportunity_zone && (
                <Badge variant="outline" className="text-xs gap-1 border-amber-500/40 text-amber-300">
                  <TrendingUp className="h-3 w-3" /> Opportunity Zone
                </Badge>
              )}
              {enrichment.usda_rural_eligible && (
                <Badge variant="outline" className="text-xs gap-1 border-emerald-500/40 text-emerald-300">
                  <ShieldCheck className="h-3 w-3" /> USDA Rural
                </Badge>
              )}
              {enrichment.fema_flood_zone && (
                <Badge variant="outline" className="text-xs border-sky-500/40 text-sky-300">
                  Flood Zone {enrichment.fema_flood_zone}
                </Badge>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {filtered.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium">
              {filtered.length} absentee owner{filtered.length === 1 ? '' : 's'}
              {equityFilter !== 'any' && (
                <span className="text-sm text-muted-foreground ml-2">
                  · equity ≥ {equityThreshold(equityFilter)}%
                </span>
              )}
            </h3>
            <div className="flex items-center gap-2">
              <Button
                onClick={handleAnalyzeWithAI}
                size="sm"
                className="h-9 bg-amber-400 text-neutral-950 hover:bg-amber-300"
              >
                <Sparkles className="h-4 w-4 mr-2" />
                Analyze {filtered.length} with AI
              </Button>
              <Button onClick={handleExport} variant="outline" size="sm" className="h-9">
                <Download className="h-4 w-4 mr-2" />
                Export CSV
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {filtered.map((rec, idx) => {
              const equityPct = rec.equity?.equity_pct;
              const highEquity = (equityPct ?? 0) >= 60;
              return (
                <Card key={rec.parcel_id || idx} className="simple-card">
                  <CardContent className="pt-6 space-y-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold flex items-start gap-2">
                          <MapPin className="h-4 w-4 mt-0.5 text-primary flex-shrink-0" />
                          <span className="break-words">{joinAddr(rec)}</span>
                        </h4>
                        <p className="text-xs text-muted-foreground ml-6 mt-0.5">
                          {[rec.county_name, rec.state].filter(Boolean).join(', ')}
                        </p>
                      </div>
                      {highEquity && (
                        <Badge variant="outline" className="text-xs border-amber-500/40 text-amber-300 flex-shrink-0">
                          <Flame className="h-3 w-3 mr-1" /> {fmtPct(equityPct)} equity
                        </Badge>
                      )}
                    </div>

                    <div className="p-3 bg-primary/5 rounded-lg border border-primary/10 space-y-2">
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-primary" />
                        <span className="font-medium text-sm break-all">{rec.owner?.name || 'Unknown owner'}</span>
                      </div>
                      {mailingAddr(rec) && (
                        <div className="flex items-start gap-2 text-sm">
                          <Mail className="h-3.5 w-3.5 mt-0.5 text-muted-foreground flex-shrink-0" />
                          <span className="break-words">{mailingAddr(rec)}</span>
                        </div>
                      )}
                      {rec.flags?.is_absentee_owner && (
                        <Badge variant="outline" className="text-xs">Absentee</Badge>
                      )}
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div className="p-2 bg-muted/30 rounded-lg">
                        <div className="text-muted-foreground">Market</div>
                        <div className="text-sm font-bold">{fmtCurrency(rec.valuation?.market_value)}</div>
                      </div>
                      <div className="p-2 bg-muted/30 rounded-lg">
                        <div className="text-muted-foreground">Last sale</div>
                        <div className="text-sm font-bold">{fmtCurrency(rec.sale?.last_sale_price)}</div>
                        {rec.sale?.last_sale_date && (
                          <div className="text-[10px] text-muted-foreground">{rec.sale.last_sale_date.slice(0, 7)}</div>
                        )}
                      </div>
                      <div className="p-2 bg-muted/30 rounded-lg">
                        <div className="text-muted-foreground">Equity</div>
                        <div className="text-sm font-bold">{fmtCurrency(rec.equity?.estimated_equity)}</div>
                        {equityPct != null && (
                          <div className="text-[10px] text-muted-foreground">{fmtPct(equityPct)} · held {rec.equity?.years_held ?? '?'}y</div>
                        )}
                      </div>
                    </div>

                    {(rec.characteristics?.year_built || rec.characteristics?.property_type) && (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground pt-2 border-t">
                        <Building className="h-3 w-3" />
                        {[
                          rec.characteristics?.property_type,
                          rec.characteristics?.year_built ? `Built ${rec.characteristics.year_built}` : null,
                          rec.parcel_id ? `APN ${rec.parcel_id}` : null,
                        ].filter(Boolean).join(' · ')}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {data && filtered.length === 0 && (data.properties?.length ?? 0) > 0 && (
        <Card className="simple-card">
          <CardContent className="pt-6 text-center text-sm text-muted-foreground">
            {data.properties?.length} owner{data.properties?.length === 1 ? '' : 's'} returned but none match your equity filter.
            Loosen the filter or try a different ZIP.
          </CardContent>
        </Card>
      )}
    </div>
  );
}
