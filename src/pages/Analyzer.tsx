import { useState, useEffect, useCallback, useMemo } from 'react';
import { DashboardNav } from '@/components/DashboardNav';
import { AIWholesaleAnalyzer } from '@/components/AIWholesaleAnalyzer';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { ChatAssistant } from '@/components/ChatAssistant';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  AlertTriangle, TrendingUp, Sparkles, ArrowRight, RefreshCw,
} from 'lucide-react';
import { Property } from '@/types/zillow';
import { mapZillowListToUnified } from '@/lib/unifiedPropertyAdapters';
import type { UnifiedProperty } from '@/types/unifiedProperty';
import {
  OFFMARKET_ANALYZER_HANDOFF_KEY,
  OFFMARKET_ANALYZER_HANDOFF_ZIP_KEY,
} from '@/components/AbsenteeOwnerSearch';
import { useNavigate } from 'react-router-dom';

// Shared cache key — the main search page writes to this
const SEARCH_CACHE_KEY = 'aiw_search_results';
const SEARCH_LOCATION_KEY = 'aiw_search_location';
const SEARCH_TIMESTAMP_KEY = 'aiw_search_timestamp';

const DEFAULT_THRESHOLD = 30000;

/**
 * Read cached results from localStorage with a sessionStorage fallback so we
 * pick up data written by older builds (or other tabs that haven't reloaded
 * yet). Returns nothing if both storages are empty.
 */
function readCache(): { properties: Property[]; location: string; updatedAt: number | null } {
  try {
    let raw = localStorage.getItem(SEARCH_CACHE_KEY);
    let loc = localStorage.getItem(SEARCH_LOCATION_KEY);
    let ts = localStorage.getItem(SEARCH_TIMESTAMP_KEY);
    if (!raw) {
      // Backwards-compat with older sessionStorage cache
      raw = sessionStorage.getItem(SEARCH_CACHE_KEY);
      loc = loc || sessionStorage.getItem(SEARCH_LOCATION_KEY);
      ts = ts || sessionStorage.getItem(SEARCH_TIMESTAMP_KEY);
    }
    if (!raw) return { properties: [], location: '', updatedAt: null };
    const parsed = JSON.parse(raw);
    return {
      properties: Array.isArray(parsed) ? (parsed as Property[]) : [],
      location: loc || '',
      updatedAt: ts ? Number(ts) : null,
    };
  } catch (e) {
    console.error('Failed to read analyzer cache:', e);
    return { properties: [], location: '', updatedAt: null };
  }
}

function timeAgo(ts: number | null): string {
  if (!ts) return '';
  const minutes = Math.floor((Date.now() - ts) / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

/**
 * One-shot read + clear of the off-market handoff stash. Returns the
 * UnifiedProperty[] queued by AbsenteeOwnerSearch + the source ZIP, or
 * empty values if nothing was queued. Clears the keys so a refresh on
 * /app/analyzer doesn't re-render the same off-market set forever.
 */
function consumeOffMarketHandoff(): { properties: UnifiedProperty[]; sourceZip: string } {
  try {
    const raw = sessionStorage.getItem(OFFMARKET_ANALYZER_HANDOFF_KEY);
    const zip = sessionStorage.getItem(OFFMARKET_ANALYZER_HANDOFF_ZIP_KEY) || '';
    if (!raw) return { properties: [], sourceZip: '' };
    sessionStorage.removeItem(OFFMARKET_ANALYZER_HANDOFF_KEY);
    sessionStorage.removeItem(OFFMARKET_ANALYZER_HANDOFF_ZIP_KEY);
    const parsed = JSON.parse(raw);
    return {
      properties: Array.isArray(parsed) ? (parsed as UnifiedProperty[]) : [],
      sourceZip: zip,
    };
  } catch (e) {
    console.error('[Analyzer] off-market handoff read failed', e);
    return { properties: [], sourceZip: '' };
  }
}

export default function Analyzer() {
  const [properties, setProperties] = useState<Property[]>([]);
  const [location, setLocation] = useState('');
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const [threshold, setThreshold] = useState<number>(DEFAULT_THRESHOLD);
  // When the user arrives via the "Analyze with AI" button on
  // AbsenteeOwnerSearch, the off-market UnifiedProperty[] is pre-stashed
  // and the analyzer renders that path instead of the Zillow-cache flow.
  const [offMarket, setOffMarket] = useState<{ properties: UnifiedProperty[]; sourceZip: string }>(() => consumeOffMarketHandoff());
  const navigate = useNavigate();

  const refresh = useCallback(() => {
    const { properties: p, location: loc, updatedAt: ts } = readCache();
    setProperties(p);
    setLocation(loc);
    setUpdatedAt(ts);
  }, []);

  // Initial load
  useEffect(() => {
    refresh();
  }, [refresh]);

  // Re-read when other tabs update the search cache (storage events fire
  // cross-tab) and when our own tab regains focus (covers the case where
  // user kicked off a search, then switched to this tab without reload).
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (
        e.key === SEARCH_CACHE_KEY ||
        e.key === SEARCH_LOCATION_KEY ||
        e.key === null /* clear() event */
      ) {
        refresh();
      }
    };
    const onFocus = () => refresh();
    window.addEventListener('storage', onStorage);
    window.addEventListener('focus', onFocus);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('focus', onFocus);
    };
  }, [refresh]);

  const totalProperties = properties.length;
  const withZestimates = useMemo(
    () => properties.filter((p) => p.zestimate && p.zestimate > 0).length,
    [properties]
  );

  const qualifiedDeals = useMemo(
    () =>
      properties.filter(
        (p) => p.price && p.zestimate && p.zestimate - p.price >= threshold
      ),
    [properties, threshold]
  );
  const dealCount = qualifiedDeals.length;
  const totalSpread = qualifiedDeals.reduce(
    (sum, p) => sum + ((p.zestimate || 0) - (p.price || 0)),
    0
  );

  // What gets fed to the AI analyzer:
  //   - If the user has qualifying deals, just those
  //   - Otherwise, fall back to all enriched properties so the analyzer is
  //     never silently empty when the user clearly has search results
  const propertiesToAnalyze = useMemo(() => {
    // Off-market handoff wins when present — the user explicitly clicked
    // "Analyze with AI" from AbsenteeOwnerSearch, which already mapped
    // the PropData records to UnifiedProperty[].
    if (offMarket.properties.length > 0) return offMarket.properties;
    const zillowSubset = dealCount > 0
      ? qualifiedDeals
      : properties.filter((p) => p.price && p.zestimate);
    // On-market: map Zillow Property[] → UnifiedProperty[] at the boundary.
    return mapZillowListToUnified(zillowSubset);
  }, [offMarket.properties, dealCount, qualifiedDeals, properties]);

  const analyzingOffMarket = offMarket.properties.length > 0;
  const analyzerMarket = analyzingOffMarket
    ? (offMarket.sourceZip ? `ZIP ${offMarket.sourceZip} (off-market)` : 'Off-market')
    : location;

  // hasAnyData drives the "you need to search first" empty state. When an
  // off-market handoff is in flight, treat that as "has data" so the page
  // skips the empty state and goes straight to the analyzer.
  const hasAnyData = totalProperties > 0 || analyzingOffMarket;
  const hasEnrichedData = withZestimates > 0;

  return (
    <div className="min-h-screen bg-background text-foreground font-sans">
      <DashboardNav />
      <main className="container mx-auto mobile-padding pt-24 pb-16 space-y-8">
        <section className="text-center space-y-4 max-w-2xl mx-auto animate-fade-in">
          <h1 className="text-3xl md:text-4xl font-medium tracking-tight">AI Deal Analyzer</h1>
          <p className="text-lg text-muted-foreground font-light leading-relaxed">
            AI-powered analysis on your best deals — adjustable spread threshold
          </p>
        </section>

        {/* Status Card */}
        <section className="max-w-3xl mx-auto animate-fade-in space-y-3">
          {!hasAnyData ? (
            <Card className="border-border/50">
              <CardContent className="p-8 text-center space-y-4">
                <div className="w-14 h-14 rounded-xl bg-muted/30 flex items-center justify-center mx-auto">
                  <AlertTriangle className="h-7 w-7 text-muted-foreground" />
                </div>
                <div>
                  <h3 className="font-semibold mb-1">No properties to analyze</h3>
                  <p className="text-sm text-muted-foreground max-w-md mx-auto">
                    Search for properties first, then come back here. The AI Analyzer
                    will automatically pull your search results.
                  </p>
                </div>
                <div className="flex gap-2 justify-center">
                  <Button
                    onClick={() => navigate('/app')}
                    className="gap-2 bg-cyan-500 hover:bg-cyan-400 text-black font-semibold"
                  >
                    <TrendingUp className="h-4 w-4" /> Search Properties First <ArrowRight className="h-4 w-4" />
                  </Button>
                  <Button onClick={refresh} variant="outline" className="gap-2">
                    <RefreshCw className="h-4 w-4" /> Refresh
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : analyzingOffMarket ? (
            <Card className="border-amber-500/30 bg-amber-500/5">
              <CardContent className="p-6">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center shrink-0">
                    <Sparkles className="h-5 w-5 text-amber-400" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-semibold mb-1">
                      Analyzing {offMarket.properties.length} off-market{' '}
                      {offMarket.properties.length === 1 ? 'property' : 'properties'}
                      {offMarket.sourceZip ? ` from ZIP ${offMarket.sourceZip}` : ''}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      These are absentee-owner records from PropData. The AI will compute
                      ARV (from comps + market value), repair estimate, MAO at 70% of ARV,
                      and a motivation score per property.
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setOffMarket({ properties: [], sourceZip: '' });
                      refresh();
                    }}
                    className="shrink-0"
                  >
                    Clear
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <>
              <Card className={dealCount > 0 ? 'border-cyan-500/20 bg-cyan-500/5' : 'border-border/50'}>
                <CardContent className="p-6">
                  <div className="flex items-start justify-between gap-3 mb-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center shrink-0">
                        <Sparkles className="h-5 w-5 text-cyan-400" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-semibold truncate">
                          {dealCount > 0
                            ? `${dealCount} Qualified Deal${dealCount !== 1 ? 's' : ''} ready for AI analysis`
                            : `${totalProperties} ${totalProperties === 1 ? 'property' : 'properties'} from your search`}
                        </h3>
                        <p className="text-xs text-muted-foreground truncate">
                          {location && (
                            <>
                              From <span className="text-cyan-400 font-medium">{location}</span>
                              {' · '}
                            </>
                          )}
                          {updatedAt ? `cached ${timeAgo(updatedAt)}` : 'cached'}
                        </p>
                      </div>
                    </div>
                    <Button onClick={refresh} variant="ghost" size="icon" className="shrink-0" title="Re-read latest search">
                      <RefreshCw className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="p-3 rounded-lg bg-foreground/[0.03] border border-foreground/[0.06] text-center">
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Total Searched</div>
                      <div className="text-lg font-bold mt-0.5">{totalProperties}</div>
                    </div>
                    <div className="p-3 rounded-lg bg-foreground/[0.03] border border-foreground/[0.06] text-center">
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">With Zestimates</div>
                      <div className="text-lg font-bold mt-0.5">{withZestimates}</div>
                    </div>
                    <div className="p-3 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-center">
                      <div className="text-[10px] uppercase tracking-wider text-cyan-400/70">
                        ${(threshold / 1000).toFixed(0)}K+ Deals
                      </div>
                      <div className="text-lg font-bold text-cyan-400 mt-0.5">{dealCount}</div>
                    </div>
                    <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20 text-center">
                      <div className="text-[10px] uppercase tracking-wider text-green-400/70">Total Spread</div>
                      <div className="text-lg font-bold text-green-400 mt-0.5">
                        ${totalSpread >= 1000000
                          ? `${(totalSpread / 1000000).toFixed(1)}M`
                          : `${(totalSpread / 1000).toFixed(0)}K`}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Threshold control + state-specific guidance */}
              <Card className="border-border/50">
                <CardContent className="p-4 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-end gap-3">
                    <div className="flex-1">
                      <Label className="text-xs text-muted-foreground">Minimum spread (Zestimate − Price)</Label>
                      <div className="flex items-center gap-2 mt-1">
                        <Input
                          type="number"
                          min={0}
                          step={5000}
                          value={threshold}
                          onChange={(e) => setThreshold(Math.max(0, Number(e.target.value) || 0))}
                          className="w-32"
                        />
                        <div className="flex gap-1">
                          {[0, 10000, 20000, 30000, 50000].map((v) => (
                            <button
                              key={v}
                              type="button"
                              onClick={() => setThreshold(v)}
                              className={`text-[11px] px-2 py-1 rounded border transition-colors ${
                                threshold === v
                                  ? 'border-cyan-500/40 bg-cyan-500/10 text-cyan-400'
                                  : 'border-border/50 text-muted-foreground hover:text-foreground'
                              }`}
                            >
                              ${v >= 1000 ? `${v / 1000}K` : v}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  {!hasEnrichedData && (
                    <div className="text-xs text-amber-400 flex items-start gap-2 bg-amber-500/5 border border-amber-500/20 rounded-md p-2.5">
                      <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                      <span>
                        None of these properties have Zestimate data yet. The AI Analyzer needs Zestimates
                        to calculate spreads — your search may still be enriching, or the properties are in
                        an area Zillow doesn&apos;t cover. Try the Refresh button or run a new search.
                      </span>
                    </div>
                  )}

                  {hasEnrichedData && dealCount === 0 && (
                    <div className="text-xs text-muted-foreground flex items-start gap-2 bg-foreground/[0.03] border border-foreground/[0.06] rounded-md p-2.5">
                      <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                      <span>
                        No properties hit the ${(threshold / 1000).toFixed(0)}K spread threshold.
                        Lower the threshold above to surface deals, or analyze the properties below for
                        non-spread signals (price-per-sqft, age, distress).
                      </span>
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </section>

        {/* Analyzer — falls back to all enriched properties when no qualifying deals exist */}
        {hasAnyData && propertiesToAnalyze.length > 0 && (
          <section className="max-w-6xl mx-auto animate-fade-in">
            <ErrorBoundary label="AIWholesaleAnalyzer">
              <AIWholesaleAnalyzer properties={propertiesToAnalyze} market={analyzerMarket} />
            </ErrorBoundary>
          </section>
        )}
      </main>
      <ChatAssistant />
    </div>
  );
}
