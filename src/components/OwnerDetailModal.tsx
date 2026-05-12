import { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import {
  propDataAPI,
  PropDataError,
  type PropDataPropertyRecord,
  type PropDataPropertyListResponse,
} from '@/lib/propdata-api';
import { mapPropDataListToUnified } from '@/lib/unifiedPropertyAdapters';
import { OwnerSkipTraceButton } from '@/components/OwnerSkipTraceButton';
import {
  OFFMARKET_ANALYZER_HANDOFF_KEY,
  OFFMARKET_ANALYZER_HANDOFF_ZIP_KEY,
} from '@/components/AbsenteeOwnerSearch';
import {
  User, MapPin, Building, TrendingUp, AlertTriangle, RefreshCw,
  Sparkles, Flame, X, Home,
} from 'lucide-react';

/**
 * Owner Detail Modal — Phase 2 of the off-market roadmap.
 *
 * Surfaces an owner's full portfolio: every parcel PropData has under
 * `owner.name` within their mailing ZIP. Lets a wholesaler see at a
 * glance:
 *   - "Does this owner have 1 property or 47?"
 *   - "Total equity across the portfolio"
 *   - "Property-type mix (SFR vs multi-family vs land)"
 *   - "How many parcels are tax-delinquent?"
 *
 * Two CTAs:
 *   - Skip-trace the owner — pipes through to the existing
 *     OwnerSkipTraceButton flow (Pro/Elite quota-gated upstream).
 *   - Send portfolio to AI Analyzer — converts the parcel list to
 *     UnifiedProperty[] and reuses AbsenteeOwnerSearch's existing
 *     sessionStorage handoff, then navigates to /app/analyzer.
 *
 * Flag-gated by `off-market-owner-detail`. AbsenteeOwnerSearch checks
 * the flag and only renders the trigger button when enabled.
 *
 * Lazy: PropData fetch only fires when `isOpen` flips true.
 */

interface OwnerDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** The owner record that triggered this view — used to seed the query + skip-trace */
  owner: {
    name?: string;
    mailing_address?: string;
    mailing_city?: string;
    mailing_state?: string;
    mailing_zip?: string;
  };
  /** The originating property's ZIP — fallback for the owner query when mailing_zip is empty */
  fallbackZip?: string;
}

const fmtCurrency = (val?: number | null) =>
  val != null
    ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(val)
    : '—';

/** Best-effort group of property_type strings into UI buckets. */
function bucketPropertyType(t?: string | null): string {
  if (!t) return 'Other';
  const s = t.toLowerCase();
  if (s.includes('single') || s.includes('sfr')) return 'Single-family';
  if (s.includes('multi') || s.includes('duplex') || s.includes('triplex') || s.includes('fourplex')) return 'Multi-family';
  if (s.includes('condo') || s.includes('townhouse') || s.includes('town home')) return 'Condo/TH';
  if (s.includes('land') || s.includes('vacant')) return 'Land';
  if (s.includes('commercial') || s.includes('retail') || s.includes('office')) return 'Commercial';
  return 'Other';
}

export function OwnerDetailModal({ isOpen, onClose, owner, fallbackZip }: OwnerDetailModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<PropDataPropertyListResponse | null>(null);
  const { toast } = useToast();
  const navigate = useNavigate();

  const ownerName = owner.name?.trim();
  // PropData `owner=` lookup is best-scoped by the owner's mailing ZIP so we
  // don't pull cross-state records by coincidental name match. Falls back to
  // the originating property's ZIP only when mailing data is absent.
  const queryZip = owner.mailing_zip || fallbackZip;

  useEffect(() => {
    if (!isOpen || !ownerName || !queryZip) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setData(null);
    (async () => {
      try {
        const res = await propDataAPI.getProperty({ owner: ownerName, zip: queryZip });
        if (cancelled) return;
        // getProperty returns Single | List. Normalise to list shape for
        // uniform downstream code — single becomes a 1-item list.
        const list = (res as PropDataPropertyListResponse).properties
          ? (res as PropDataPropertyListResponse)
          : { properties: [res as unknown as PropDataPropertyRecord], count: 1 };
        setData(list);
      } catch (err) {
        if (cancelled) return;
        if (err instanceof PropDataError) {
          if (err.isCoverageGap) {
            setError('PropData doesn’t have a portfolio listing for this owner in this ZIP.');
          } else if (err.code === 'RATE_LIMITED') {
            setError('Rate limit hit — try again in a minute.');
          } else if (err.isTransient) {
            setError('PropData temporarily unavailable. Try again in a moment.');
          } else {
            setError(err.message);
          }
        } else {
          setError('Could not fetch owner portfolio.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isOpen, ownerName, queryZip]);

  const parcels = data?.properties || [];

  const stats = useMemo(() => {
    let totalMarket = 0;
    let totalEquity = 0;
    let taxDelinquent = 0;
    let withEquity = 0;
    const typeCounts: Record<string, number> = {};
    for (const p of parcels) {
      if (typeof p.valuation?.market_value === 'number') totalMarket += p.valuation.market_value;
      if (typeof p.equity?.estimated_equity === 'number') {
        totalEquity += p.equity.estimated_equity;
        withEquity += 1;
      }
      const status = String(p.tax_status || '').toLowerCase();
      if (status.includes('delinquent') || status.includes('past_due') || status.includes('past due')) {
        taxDelinquent += 1;
      }
      const bucket = bucketPropertyType(p.characteristics?.property_type);
      typeCounts[bucket] = (typeCounts[bucket] || 0) + 1;
    }
    return { totalMarket, totalEquity, taxDelinquent, withEquity, typeCounts };
  }, [parcels]);

  const handleSendToAnalyzer = () => {
    if (parcels.length === 0) return;
    const unified = mapPropDataListToUnified({
      properties: parcels,
      enrichment: data?.enrichment,
    });
    try {
      sessionStorage.setItem(OFFMARKET_ANALYZER_HANDOFF_KEY, JSON.stringify(unified));
      sessionStorage.setItem(
        OFFMARKET_ANALYZER_HANDOFF_ZIP_KEY,
        `Owner: ${ownerName} (${queryZip})`,
      );
    } catch (err) {
      console.error('[OwnerDetailModal] sessionStorage write failed', err);
      toast({
        title: 'Could not hand off to analyzer',
        description: 'Storage quota?',
        variant: 'destructive',
      });
      return;
    }
    toast({
      title: `Sending ${parcels.length} parcel${parcels.length === 1 ? '' : 's'} to AI Analyzer`,
      description: 'Running ARV, repair, MAO, and motivation analysis…',
    });
    onClose();
    navigate('/app/analyzer?source=owner-portfolio');
  };

  return (
    <Dialog open={isOpen} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-3xl w-full p-0 flex flex-col h-[90vh] max-h-[90vh] overflow-hidden">
        <DialogHeader className="shrink-0 p-5 pb-3 border-b border-border/40">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3 min-w-0">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <User className="h-5 w-5 text-primary" />
              </div>
              <div className="min-w-0">
                <DialogTitle className="text-lg truncate">
                  {ownerName || 'Owner'}
                </DialogTitle>
                <DialogDescription className="text-xs flex items-center gap-1 mt-0.5 truncate">
                  <MapPin className="h-3 w-3 shrink-0" />
                  {[owner.mailing_city, owner.mailing_state, owner.mailing_zip || queryZip].filter(Boolean).join(', ')}
                </DialogDescription>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-md hover:bg-muted/40 transition-colors shrink-0"
              aria-label="Close"
            >
              <X className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto p-5 space-y-4">
          {loading && (
            <div className="space-y-3">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
          )}

          {error && !loading && (
            <Card className="border-border/60">
              <CardContent className="p-4 text-sm text-muted-foreground flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>{error}</span>
              </CardContent>
            </Card>
          )}

          {!loading && !error && parcels.length > 0 && (
            <>
              {/* Portfolio summary stat row */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 rounded-lg bg-muted/30 border border-border/40">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Parcels</div>
                  <div className="text-lg font-bold mt-0.5">{parcels.length}</div>
                </div>
                <div className="p-3 rounded-lg bg-muted/30 border border-border/40">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Total market</div>
                  <div className="text-lg font-bold mt-0.5">{fmtCurrency(stats.totalMarket || null)}</div>
                </div>
                <div className="p-3 rounded-lg bg-amber-500/5 border border-amber-500/30">
                  <div className="text-[10px] uppercase tracking-wider text-amber-300">Total equity</div>
                  <div className="text-lg font-bold mt-0.5 text-amber-300">{fmtCurrency(stats.totalEquity || null)}</div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">
                    across {stats.withEquity} parcel{stats.withEquity === 1 ? '' : 's'}
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-muted/30 border border-border/40">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Tax delinquent</div>
                  <div className={`text-lg font-bold mt-0.5 ${stats.taxDelinquent > 0 ? 'text-amber-300' : ''}`}>
                    {stats.taxDelinquent}
                  </div>
                </div>
              </div>

              {/* Property type breakdown */}
              {Object.keys(stats.typeCounts).length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {Object.entries(stats.typeCounts)
                    .sort((a, b) => b[1] - a[1])
                    .map(([type, count]) => (
                      <Badge key={type} variant="outline" className="text-[10px] gap-1">
                        <Building className="h-2.5 w-2.5" />
                        {type} · {count}
                      </Badge>
                    ))}
                </div>
              )}

              {/* Parcel list */}
              <div className="space-y-2 pt-2">
                <h3 className="text-[11px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
                  Parcels
                </h3>
                {parcels.map((p, idx) => {
                  const equityPct = p.equity?.equity_pct;
                  return (
                    <Card key={p.parcel_id || idx} className="border-border/60">
                      <CardContent className="p-3 space-y-1.5">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-start gap-2 min-w-0 flex-1">
                            <Home className="h-3.5 w-3.5 mt-0.5 text-primary shrink-0" />
                            <div className="min-w-0">
                              <div className="text-sm font-medium truncate">
                                {[p.address?.street, p.address?.city, p.address?.zip].filter(Boolean).join(', ') || 'Unknown address'}
                              </div>
                              <div className="text-xs text-muted-foreground mt-0.5">
                                {[
                                  p.characteristics?.property_type,
                                  p.characteristics?.year_built ? `Built ${p.characteristics.year_built}` : null,
                                  p.parcel_id ? `APN ${p.parcel_id}` : null,
                                ].filter(Boolean).join(' · ')}
                              </div>
                            </div>
                          </div>
                          {(equityPct ?? 0) >= 60 && (
                            <Badge variant="outline" className="text-[10px] gap-1 border-amber-500/40 text-amber-300 shrink-0">
                              <Flame className="h-2.5 w-2.5" /> {Math.round(equityPct!)}%
                            </Badge>
                          )}
                        </div>
                        <div className="grid grid-cols-3 gap-2 text-[10px] pt-1">
                          <div>
                            <div className="text-muted-foreground">Market</div>
                            <div className="font-medium text-foreground">{fmtCurrency(p.valuation?.market_value)}</div>
                          </div>
                          <div>
                            <div className="text-muted-foreground">Last sale</div>
                            <div className="font-medium text-foreground">{fmtCurrency(p.sale?.last_sale_price)}</div>
                          </div>
                          <div>
                            <div className="text-muted-foreground">Equity</div>
                            <div className="font-medium text-foreground">{fmtCurrency(p.equity?.estimated_equity)}</div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </>
          )}

          {!loading && !error && parcels.length === 0 && (
            <Card className="border-border/60">
              <CardContent className="p-6 text-center text-sm text-muted-foreground">
                No additional parcels found for this owner in {queryZip}.
              </CardContent>
            </Card>
          )}
        </div>

        {/* CTA footer */}
        <div className="shrink-0 border-t border-border/40 p-4 flex flex-wrap items-center justify-between gap-3 bg-muted/10">
          <div className="text-xs text-muted-foreground flex items-center gap-1">
            {loading ? <RefreshCw className="h-3 w-3 animate-spin" /> : <TrendingUp className="h-3 w-3" />}
            <span>
              {loading
                ? 'Loading portfolio…'
                : parcels.length > 0
                  ? `${parcels.length} parcel${parcels.length === 1 ? '' : 's'} found`
                  : ''}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <OwnerSkipTraceButton owner={owner} />
            <Button
              onClick={handleSendToAnalyzer}
              size="sm"
              disabled={parcels.length === 0 || loading}
              className="h-9 bg-amber-400 text-neutral-950 hover:bg-amber-300 disabled:opacity-50"
            >
              <Sparkles className="h-4 w-4 mr-2" />
              Analyze {parcels.length || ''}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
