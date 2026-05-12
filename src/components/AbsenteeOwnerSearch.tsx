import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import { propDataAPI, type PropDataPropertyListResponse, type PropDataPropertyRecord } from '@/lib/propdata-api';
import { mapPropDataListToUnified, type PropDataEnrichment } from '@/lib/unifiedPropertyAdapters';
import { resolveLocation } from '@/lib/locationResolver';
import { topZipsInState } from '@/lib/topZipsByState';
import { fanOutZipSearch, MAX_ZIPS_PER_SEARCH } from '@/lib/zip-search';
import { OwnerSkipTraceButton } from '@/components/OwnerSkipTraceButton';
import { Switch } from '@/components/ui/switch';
import { Search, MapPin, User, Mail, Building, RefreshCw, Download, Flame, ShieldCheck, Sparkles, TrendingUp, AlertTriangle, CalendarClock, X } from 'lucide-react';

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
  // Free-form input: single ZIP, multi-ZIP list, "City, ST", "County, ST", or "ST".
  // Resolved into a deduped ZIP fan-out list at search time.
  const [locationInput, setLocationInput] = useState(defaultZip);
  const [limit, setLimit] = useState<number>(25);
  const [equityFilter, setEquityFilter] = useState<EquityFilter>('any');
  // Motivation filters (client-side, applied to whatever the server returns).
  // - taxDelinquentOnly: tax_status === 'delinquent' — strongest "must sell" signal
  // - minYearsHeld: 0 / 5 / 10 / 20 — proxy for "tired landlord"
  // - excludeRecentSales: skip parcels sold in the last 12 months (not real motivation)
  const [taxDelinquentOnly, setTaxDelinquentOnly] = useState(false);
  const [minYearsHeld, setMinYearsHeld] = useState<0 | 5 | 10 | 20>(0);
  const [excludeRecentSales, setExcludeRecentSales] = useState(false);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [data, setData] = useState<PropDataPropertyListResponse | null>(null);
  // The resolved label (e.g. "Detroit, MI (12 ZIPs)") shown above results.
  const [resolvedLabel, setResolvedLabel] = useState<string>('');
  // Sticky for handoff to the analyzer + CSV filename.
  const [searchedZips, setSearchedZips] = useState<string[]>([]);
  const { toast } = useToast();
  const navigate = useNavigate();

  const filtered = useMemo(() => {
    const props = data?.properties || [];
    const threshold = equityThreshold(equityFilter);
    const recentCutoff = excludeRecentSales
      ? new Date(Date.now() - 365 * 24 * 60 * 60 * 1000)
      : null;
    return props.filter((p) => {
      if (threshold > 0 && (p.equity?.equity_pct ?? 0) < threshold) return false;
      if (taxDelinquentOnly) {
        const status = String(p.tax_status || '').toLowerCase();
        if (!status.includes('delinquent') && !status.includes('past_due') && !status.includes('past due')) return false;
      }
      if (minYearsHeld > 0 && (p.equity?.years_held ?? 0) < minYearsHeld) return false;
      if (recentCutoff && p.sale?.last_sale_date) {
        const sold = new Date(p.sale.last_sale_date);
        if (isFinite(sold.getTime()) && sold > recentCutoff) return false;
      }
      return true;
    });
  }, [data, equityFilter, taxDelinquentOnly, minYearsHeld, excludeRecentSales]);

  const activeFilterCount =
    (equityFilter !== 'any' ? 1 : 0) +
    (taxDelinquentOnly ? 1 : 0) +
    (minYearsHeld > 0 ? 1 : 0) +
    (excludeRecentSales ? 1 : 0);

  const clearFilters = () => {
    setEquityFilter('any');
    setTaxDelinquentOnly(false);
    setMinYearsHeld(0);
    setExcludeRecentSales(false);
  };

  const enrichment = data?.enrichment;

  const handleSearch = async () => {
    const input = locationInput.trim();
    if (!input) {
      toast({ title: 'Enter a location', description: 'ZIP, "City, ST", "County, ST", or just "ST".', variant: 'destructive' });
      return;
    }
    setLoading(true);
    setProgress(null);
    try {
      const resolved = await resolveLocation(input, { topZipsInState });
      if (!resolved || resolved.zips.length === 0) {
        toast({ title: 'Could not resolve location', description: `"${input}" — try a 5-digit ZIP or "City, ST".`, variant: 'destructive' });
        setData({ properties: [], count: 0 });
        setResolvedLabel('');
        setSearchedZips([]);
        return;
      }
      setSearchedZips(resolved.zips);
      setResolvedLabel(resolved.label);

      // Per-ZIP call cap so a state-wide fan-out doesn't return thousands.
      // For single-zip, honor the full user-selected limit. For fan-outs,
      // divide by ZIP count, floor at 5/ZIP so each ZIP still gets meaningful
      // coverage but the aggregate stays sane.
      const perZipLimit = resolved.zips.length === 1
        ? limit
        : Math.max(5, Math.ceil(limit / Math.max(1, resolved.zips.length)));

      setProgress({ done: 0, total: resolved.zips.length });
      let completed = 0;
      // Track per-ZIP outcomes so we can give the user an actionable failure
      // message instead of a generic "coverage may be thin" toast.
      const outcomes = { ok: 0, noCoverage: 0, rateLimited: 0, other: 0 };
      const batched = await fanOutZipSearch(resolved.zips, async (z) => {
        try {
          const res = await propDataAPI.listAbsenteeOwners({ zip: z, limit: perZipLimit });
          completed += 1;
          setProgress({ done: completed, total: resolved.zips.length });
          // PropData returns { error, status } with HTTP 200 when a ZIP is
          // outside their coverage. The client unwrap() throws on res.error
          // so we shouldn't see this path here — but defensive.
          if ((res as { error?: string; status?: number }).error) {
            outcomes.noCoverage += 1;
            return null;
          }
          outcomes.ok += 1;
          return res;
        } catch (err) {
          completed += 1;
          setProgress({ done: completed, total: resolved.zips.length });
          const msg = err instanceof Error ? err.message.toLowerCase() : '';
          if (msg.includes('rate limit')) outcomes.rateLimited += 1;
          else if (msg.includes('coverage') || msg.includes('no property records')) outcomes.noCoverage += 1;
          else outcomes.other += 1;
          return null;
        }
      });

      // Merge results across ZIPs. Dedupe by parcel_id (defensive — PropData
      // shouldn't return the same parcel from two ZIPs, but safer to assume
      // it could).
      const merged: PropDataPropertyRecord[] = [];
      const seenParcels = new Set<string>();
      let mergedEnrichment: PropDataEnrichment | undefined;
      for (const batch of batched) {
        const list = batch.result;
        if (!list?.properties) continue;
        if (!mergedEnrichment) mergedEnrichment = list.enrichment;
        for (const rec of list.properties) {
          const key = rec.parcel_id || `${rec.address?.street}|${rec.address?.zip}`;
          if (seenParcels.has(key)) continue;
          seenParcels.add(key);
          merged.push(rec);
        }
      }

      setData({
        properties: merged.slice(0, limit),
        count: merged.length,
        enrichment: mergedEnrichment,
      });
      setProgress(null);

      if (merged.length === 0) {
        // Pick the most informative explanation. Rate limited > coverage gap > generic.
        let description: string;
        if (outcomes.rateLimited > 0) {
          description = `${outcomes.rateLimited} of ${resolved.zips.length} ZIPs hit rate-limit. Wait a minute and try again, or narrow the search.`;
        } else if (outcomes.noCoverage === resolved.zips.length) {
          description = `PropData has no parcel coverage in ${resolved.label} yet. Try a different state — Minnesota and Florida have rich data.`;
        } else if (outcomes.noCoverage > 0) {
          description = `${outcomes.noCoverage} of ${resolved.zips.length} ZIPs returned no coverage. Try a different state — Minnesota and Florida have rich data.`;
        } else {
          description = `Searched ${resolved.zips.length} ZIP${resolved.zips.length === 1 ? '' : 's'} — no absentee owners matched.`;
        }
        toast({ title: 'No absentee owners found', description, variant: 'destructive' });
      } else {
        const okMsg = `${Math.min(merged.length, limit)} absentee owner${merged.length === 1 ? '' : 's'}`
          + ` from ${outcomes.ok}/${resolved.zips.length} ZIP${resolved.zips.length === 1 ? '' : 's'}`;
        const skipped = outcomes.noCoverage + outcomes.rateLimited;
        toast({
          title: okMsg,
          description: skipped > 0
            ? `${skipped} ZIP${skipped === 1 ? '' : 's'} skipped (no coverage / rate-limited). Filter by equity, export, or send to AI.`
            : 'Filter by equity, export to CSV, or send to the AI analyzer.',
        });
      }
    } catch (err) {
      console.error('[AbsenteeOwnerSearch]', err);
      toast({ title: 'Search failed', description: 'Could not fetch absentee owners.', variant: 'destructive' });
    } finally {
      setLoading(false);
      setProgress(null);
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
      sessionStorage.setItem(OFFMARKET_ANALYZER_HANDOFF_ZIP_KEY, resolvedLabel || searchedZips.join(','));
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
    const slug = (resolvedLabel || searchedZips[0] || 'export').replace(/[^a-z0-9-]+/gi, '-').slice(0, 40);
    a.download = `absentee-owners-${slug}-${new Date().toISOString().slice(0, 10)}.csv`;
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
          <div className="flex flex-col gap-3">
            <div className="space-y-2">
              <Label htmlFor="abs-location">Location</Label>
              <Input
                id="abs-location"
                value={locationInput}
                onChange={(e) => setLocationInput(e.target.value)}
                placeholder='ZIP (55101), multi-ZIP (55101, 55102, 55103), "Detroit, MI", "Oakland County, MI", or just "MI"'
                className="bg-background/50"
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              />
              <p className="text-xs text-muted-foreground">
                Multi-ZIP / city / county / state all fan out across up to {MAX_ZIPS_PER_SEARCH} ZIPs.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="abs-limit" className="flex items-center gap-2">
                  <Building className="h-4 w-4 text-primary" />
                  Max results
                </Label>
                <select
                  id="abs-limit"
                  value={limit}
                  onChange={(e) => setLimit(Number(e.target.value))}
                  className="w-full h-10 px-3 rounded-md bg-background/50 border border-input text-sm"
                >
                  {LIMIT_OPTIONS.map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="abs-equity" className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-primary" />
                  Min equity
                </Label>
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
            </div>
          </div>

          {/* Motivation filters — uniform toggle rows matching PR #214 design
              language. Each filter is client-side (server already absentee_only),
              applied to whatever PropData returns. */}
          <div className="border-t border-border/60 pt-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-[11px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
                Motivation Filters
              </h3>
              {activeFilterCount > 0 && (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="text-[10px] text-cyan-400 hover:text-cyan-300 inline-flex items-center gap-1"
                >
                  <X className="h-3 w-3" /> Clear {activeFilterCount}
                </button>
              )}
            </div>

            <div className="space-y-2">
              <ToggleRow
                id="absentee-tax-delinquent"
                icon={AlertTriangle}
                iconClass="text-amber-400"
                label="Tax delinquent only"
                description="Owners with past-due property taxes — strongest must-sell signal"
                checked={taxDelinquentOnly}
                onCheckedChange={setTaxDelinquentOnly}
              />
              <ToggleRow
                id="absentee-exclude-recent"
                icon={CalendarClock}
                label="Exclude recently sold (< 12 months)"
                description="Skip parcels with a sale date in the last year"
                checked={excludeRecentSales}
                onCheckedChange={setExcludeRecentSales}
              />
              <div className="rounded-lg border border-border/60 px-3 py-2.5">
                <div className="flex items-center gap-3">
                  <CalendarClock className="h-4 w-4 text-primary shrink-0" />
                  <div className="flex flex-col min-w-0 flex-1">
                    <Label htmlFor="abs-years-held" className="text-sm font-medium leading-tight">
                      Min years held
                    </Label>
                    <span className="text-xs text-muted-foreground mt-0.5 leading-snug">
                      Filter for tired landlords — longer hold periods skew toward sellable
                    </span>
                  </div>
                  <select
                    id="abs-years-held"
                    value={minYearsHeld}
                    onChange={(e) => setMinYearsHeld(Number(e.target.value) as 0 | 5 | 10 | 20)}
                    className="h-8 px-2 rounded-md bg-background/50 border border-input text-xs shrink-0"
                  >
                    <option value="0">Any</option>
                    <option value="5">≥ 5 yr</option>
                    <option value="10">≥ 10 yr</option>
                    <option value="20">≥ 20 yr</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          <Button
            onClick={handleSearch}
            disabled={loading}
            size="lg"
            className="group w-full h-12 text-base font-semibold bg-gradient-to-r from-cyan-500 to-cyan-400 text-cyan-950 hover:from-cyan-400 hover:to-cyan-300 shadow-[0_0_0_1px_rgba(6,182,212,0.4),0_8px_24px_-8px_rgba(6,182,212,0.5)] hover:shadow-[0_0_0_1px_rgba(6,182,212,0.5),0_12px_32px_-8px_rgba(6,182,212,0.7)] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
          >
            {loading ? (
              <>
                <RefreshCw className="h-5 w-5 animate-spin mr-2" />
                {progress ? `Searching ${progress.done}/${progress.total} ZIPs…` : 'Searching…'}
              </>
            ) : (
              <>
                <Search className="h-5 w-5 mr-2 transition-transform group-hover:scale-110" />
                Search absentee owners
              </>
            )}
          </Button>

          {resolvedLabel && !loading && (data?.properties?.length ?? 0) >= 0 && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <MapPin className="h-3 w-3" />
              <span>Searched: {resolvedLabel} · {searchedZips.length} ZIP{searchedZips.length === 1 ? '' : 's'}</span>
            </div>
          )}

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
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-lg font-medium">
                {filtered.length} absentee owner{filtered.length === 1 ? '' : 's'}
              </h3>
              {/* Active-filter chips — show every applied filter so the count
                  above is always explainable at a glance. */}
              {equityFilter !== 'any' && (
                <Badge variant="outline" className="text-[10px] gap-1 border-cyan-500/40 text-cyan-300">
                  <TrendingUp className="h-3 w-3" /> equity ≥ {equityThreshold(equityFilter)}%
                </Badge>
              )}
              {taxDelinquentOnly && (
                <Badge variant="outline" className="text-[10px] gap-1 border-amber-500/40 text-amber-300">
                  <AlertTriangle className="h-3 w-3" /> tax delinquent
                </Badge>
              )}
              {minYearsHeld > 0 && (
                <Badge variant="outline" className="text-[10px] gap-1 border-cyan-500/40 text-cyan-300">
                  <CalendarClock className="h-3 w-3" /> held ≥ {minYearsHeld} yr
                </Badge>
              )}
              {excludeRecentSales && (
                <Badge variant="outline" className="text-[10px] gap-1 border-cyan-500/40 text-cyan-300">
                  <CalendarClock className="h-3 w-3" /> not sold &lt; 12 mo
                </Badge>
              )}
            </div>
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
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <User className="h-4 w-4 text-primary flex-shrink-0" />
                          <span className="font-medium text-sm break-all">{rec.owner?.name || 'Unknown owner'}</span>
                        </div>
                        <div className="flex-shrink-0">
                          <OwnerSkipTraceButton owner={rec.owner} />
                        </div>
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

/**
 * Uniform toggle row — same component shape as PropertySearch's filters
 * section (PR #214). Locally redefined here so the absentee search owns
 * its own copy without coupling the two files. If we add more filter
 * surfaces, factor into `@/components/ui/toggle-row`.
 */
function ToggleRow({
  id,
  icon: Icon,
  iconClass = 'text-primary',
  label,
  description,
  checked,
  onCheckedChange,
}: {
  id: string;
  icon: React.ComponentType<{ className?: string }>;
  iconClass?: string;
  label: React.ReactNode;
  description: React.ReactNode;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-border/60 px-3 py-2.5 transition-all duration-150 hover:border-border hover:bg-background/40">
      <div className="flex items-start sm:items-center gap-3 min-w-0 flex-1">
        <Icon className={`h-4 w-4 shrink-0 mt-0.5 sm:mt-0 ${iconClass}`} />
        <div className="flex flex-col min-w-0">
          <Label htmlFor={id} className="text-sm font-medium leading-tight cursor-pointer">
            {label}
          </Label>
          <span className="text-xs text-muted-foreground mt-0.5 leading-snug">
            {description}
          </span>
        </div>
      </div>
      <Switch
        id={id}
        checked={checked}
        onCheckedChange={onCheckedChange}
        className="shrink-0"
      />
    </div>
  );
}
