import { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { propDataAPI, PropDataError, type PropDataPropertyRecord } from '@/lib/propdata-api';
import { mapPropDataListToUnified } from '@/lib/unifiedPropertyAdapters';
import { OwnerSkipTraceButton } from '@/components/OwnerSkipTraceButton';
import { useFeatureFlag } from '@/hooks/useFeatureFlag';
import { OwnerDetailModal } from '@/components/OwnerDetailModal';
import {
  OFFMARKET_ANALYZER_HANDOFF_KEY,
  OFFMARKET_ANALYZER_HANDOFF_ZIP_KEY,
} from '@/components/AbsenteeOwnerSearch';
import {
  Home, MapPin, User, Mail, Building, TrendingUp, AlertTriangle,
  Sparkles, Flame, X, Calendar, Receipt, BarChart3, ExternalLink, RefreshCw,
} from 'lucide-react';

/**
 * Off-Market Property Modal — Phase 6 of the off-market roadmap.
 *
 * Different from the existing PropertyModal which is Zillow-shaped
 * (zpid, listing photos, Zestimate, comps via Zillow Scraper). This
 * one is PropData-shaped: parcel-level facts, owner block, equity
 * roll-up, sale + tax history, neighborhood demographics.
 *
 * No Zillow surface — off-market parcels typically don't have a zpid
 * and we don't want to mislead the user with empty Zestimate cards.
 * If there's market overlap (rare), they can search for the property
 * on the on-market mode separately.
 *
 * Lazy-fetches /v1/neighborhood for the property's ZIP on mount when
 * the ZIP is known. Skip-trace + Send-to-Analyzer CTAs in the footer.
 * Owner row links to the OwnerDetailModal (portfolio view) if the
 * `off-market-owner-detail` flag is enabled.
 *
 * Gated by `off-market-property-modal`. Default OFF, dogfood for
 * cpodea5 — same pattern as Phase 2/3.
 */

interface OffMarketPropertyModalProps {
  isOpen: boolean;
  onClose: () => void;
  property: PropDataPropertyRecord | null;
}

const fmtCurrency = (val?: number | null) =>
  val != null
    ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(val)
    : '—';

const fmtPct = (val?: number | null) => (val != null ? `${Math.round(val)}%` : '—');

const fmtDate = (iso?: string | null) => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (!isFinite(d.getTime())) return iso;
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
};

interface NeighborhoodData {
  demographics?: {
    total_population?: number | null;
    median_household_income?: number | null;
    owner_occupied_pct?: number | null;
  };
  housing?: {
    median_value?: number | null;
    avg_year_built?: number | null;
  };
  scores?: {
    crime_index?: number;
    school_score?: number;
    walkability?: number;
  };
}

export function OffMarketPropertyModal({ isOpen, onClose, property }: OffMarketPropertyModalProps) {
  const navigate = useNavigate();
  const { toast } = useToast();
  // Phase 2 flag re-used here — if enabled, the owner row becomes a
  // button that opens the portfolio view. Falls back to plain text
  // when off (no link, just the name).
  const { enabled: ownerDetailEnabled } = useFeatureFlag('off-market-owner-detail');
  const [openOwner, setOpenOwner] = useState<PropDataPropertyRecord | null>(null);

  const zip = property?.address?.zip;
  const [nb, setNb] = useState<NeighborhoodData | null>(null);
  const [nbLoading, setNbLoading] = useState(false);
  const [nbError, setNbError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !zip) {
      setNb(null);
      return;
    }
    let cancelled = false;
    setNbLoading(true);
    setNbError(null);
    propDataAPI
      .getNeighborhood(zip)
      .then((d) => {
        if (!cancelled) setNb(d as NeighborhoodData);
      })
      .catch((err) => {
        if (cancelled) return;
        if (err instanceof PropDataError && err.isCoverageGap) {
          setNbError('No neighborhood demographics for this ZIP yet.');
        } else {
          setNbError('Could not load neighborhood data.');
        }
      })
      .finally(() => {
        if (!cancelled) setNbLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen, zip]);

  const stats = useMemo(() => {
    if (!property) return null;
    const equityPct = property.equity?.equity_pct;
    return {
      equityHigh: (equityPct ?? 0) >= 60,
      yearsHeld: property.equity?.years_held,
      taxDelinquent: String(property.tax_status || '').toLowerCase().includes('delinquent'),
    };
  }, [property]);

  if (!property) return null;

  const ownerName = property.owner?.name?.trim();
  const propAddr = [property.address?.street, property.address?.city, property.address?.zip]
    .filter(Boolean)
    .join(', ');
  const mailingAddr = [
    property.owner?.mailing_address,
    property.owner?.mailing_city,
    property.owner?.mailing_state,
    property.owner?.mailing_zip,
  ]
    .filter(Boolean)
    .join(', ');

  const handleSendToAnalyzer = () => {
    const unified = mapPropDataListToUnified({
      properties: [property],
      enrichment: undefined,
    });
    try {
      sessionStorage.setItem(OFFMARKET_ANALYZER_HANDOFF_KEY, JSON.stringify(unified));
      sessionStorage.setItem(
        OFFMARKET_ANALYZER_HANDOFF_ZIP_KEY,
        zip ? `Property: ${propAddr}` : 'Off-market property',
      );
    } catch (err) {
      console.error('[OffMarketPropertyModal] sessionStorage write failed', err);
      toast({
        title: 'Could not hand off to analyzer',
        description: 'Storage quota?',
        variant: 'destructive',
      });
      return;
    }
    toast({
      title: 'Sending property to AI Analyzer',
      description: 'Running ARV, repair, MAO, and motivation analysis…',
    });
    onClose();
    navigate('/app/analyzer?source=off-market-property');
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={(o) => { if (!o) onClose(); }}>
        <DialogContent className="max-w-3xl w-full p-0 flex flex-col h-[90vh] max-h-[90vh] overflow-hidden">
          <DialogHeader className="shrink-0 p-5 pb-3 border-b border-border/40">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3 min-w-0 flex-1">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <Home className="h-5 w-5 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <DialogTitle className="text-lg truncate">{propAddr || 'Off-market property'}</DialogTitle>
                  <DialogDescription className="text-xs flex items-center gap-1 mt-0.5 truncate">
                    <MapPin className="h-3 w-3 shrink-0" />
                    {[property.county_name, property.state, property.parcel_id ? `APN ${property.parcel_id}` : null]
                      .filter(Boolean).join(' · ')}
                  </DialogDescription>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {stats?.equityHigh && (
                  <Badge variant="outline" className="border-amber-500/40 text-amber-300 gap-1">
                    <Flame className="h-3 w-3" />
                    {fmtPct(property.equity?.equity_pct)} equity
                  </Badge>
                )}
                {stats?.taxDelinquent && (
                  <Badge variant="outline" className="border-amber-500/40 text-amber-300 gap-1">
                    <AlertTriangle className="h-3 w-3" /> tax delinquent
                  </Badge>
                )}
                <button
                  type="button"
                  onClick={onClose}
                  className="p-1.5 rounded-md hover:bg-muted/40 transition-colors"
                  aria-label="Close"
                >
                  <X className="h-4 w-4 text-muted-foreground" />
                </button>
              </div>
            </div>
          </DialogHeader>

          <div className="flex-1 min-h-0 overflow-y-auto p-5 space-y-5">
            {/* Stat row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Stat label="Market value" value={fmtCurrency(property.valuation?.market_value)} />
              <Stat label="Last sale" value={fmtCurrency(property.sale?.last_sale_price)} sub={fmtDate(property.sale?.last_sale_date)} />
              <Stat
                label="Equity"
                value={fmtCurrency(property.equity?.estimated_equity)}
                sub={property.equity?.equity_pct != null ? `${fmtPct(property.equity.equity_pct)} of value` : undefined}
                accent={stats?.equityHigh}
              />
              <Stat label="Years held" value={stats?.yearsHeld != null ? `${stats.yearsHeld} yr` : '—'} />
            </div>

            {/* Owner block */}
            <Section title="Owner" icon={User}>
              <Card className="border-border/60">
                <CardContent className="p-3 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <User className="h-4 w-4 text-primary shrink-0" />
                      {ownerDetailEnabled && ownerName ? (
                        <button
                          type="button"
                          onClick={() => setOpenOwner(property)}
                          className="font-medium text-sm hover:text-cyan-300 hover:underline underline-offset-2 transition-colors truncate text-left flex items-center gap-1"
                          title="View this owner's full portfolio"
                        >
                          {ownerName}
                          <ExternalLink className="h-3 w-3 opacity-70" />
                        </button>
                      ) : (
                        <span className="font-medium text-sm truncate">{ownerName || 'Unknown owner'}</span>
                      )}
                    </div>
                    <OwnerSkipTraceButton owner={property.owner} />
                  </div>
                  {mailingAddr && (
                    <div className="flex items-start gap-2 text-sm">
                      <Mail className="h-3.5 w-3.5 mt-0.5 text-muted-foreground shrink-0" />
                      <span className="break-words text-muted-foreground">{mailingAddr}</span>
                    </div>
                  )}
                  {property.flags?.is_absentee_owner && (
                    <Badge variant="outline" className="text-[10px]">Absentee owner</Badge>
                  )}
                </CardContent>
              </Card>
            </Section>

            {/* Characteristics + tax */}
            <Section title="Characteristics & tax" icon={Receipt}>
              <Card className="border-border/60">
                <CardContent className="p-3 grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                  <KV label="Property type" value={property.characteristics?.property_type || '—'} />
                  <KV label="Year built" value={property.characteristics?.year_built ? String(property.characteristics.year_built) : '—'} />
                  <KV label="Beds / baths" value={
                    [property.characteristics?.bedrooms, property.characteristics?.bathrooms].some((x) => x != null)
                      ? `${property.characteristics?.bedrooms ?? '?'} / ${property.characteristics?.bathrooms ?? '?'}`
                      : '—'
                  } />
                  <KV label="Sq ft" value={property.characteristics?.sq_ft_living != null ? `${property.characteristics.sq_ft_living.toLocaleString()}` : '—'} />
                  <KV label="Lot sq ft" value={property.characteristics?.sq_ft_lot != null ? `${property.characteristics.sq_ft_lot.toLocaleString()}` : '—'} />
                  <KV label="Assessed value" value={fmtCurrency(property.valuation?.assessed_value)} />
                  <KV label="Tax year" value={property.valuation?.tax_year ? String(property.valuation.tax_year) : '—'} />
                  <KV label="Tax status" value={property.tax_status || '—'} accent={stats?.taxDelinquent} />
                </CardContent>
              </Card>
            </Section>

            {/* Neighborhood demographics — lazy from /v1/neighborhood */}
            <Section title="Neighborhood" icon={BarChart3}>
              {nbLoading && (
                <Card className="border-border/60">
                  <CardContent className="p-3 space-y-2">
                    <Skeleton className="h-4 w-1/3" />
                    <Skeleton className="h-4 w-2/3" />
                    <Skeleton className="h-4 w-1/2" />
                  </CardContent>
                </Card>
              )}
              {nbError && !nbLoading && (
                <Card className="border-border/60">
                  <CardContent className="p-3 text-sm text-muted-foreground flex items-center gap-2">
                    <AlertTriangle className="h-3 w-3" /> {nbError}
                  </CardContent>
                </Card>
              )}
              {!nbLoading && !nbError && nb && (
                <Card className="border-border/60">
                  <CardContent className="p-3 space-y-3">
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
                      <KV label="Population" value={nb.demographics?.total_population != null ? nb.demographics.total_population.toLocaleString() : '—'} />
                      <KV label="Median income" value={fmtCurrency(nb.demographics?.median_household_income)} />
                      <KV label="Owner-occupied" value={nb.demographics?.owner_occupied_pct != null ? `${Math.round(nb.demographics.owner_occupied_pct * 100)}%` : '—'} />
                      <KV label="Median home value" value={fmtCurrency(nb.housing?.median_value)} />
                      <KV label="Avg year built" value={nb.housing?.avg_year_built ? String(nb.housing.avg_year_built) : '—'} />
                    </div>
                    {(nb.scores?.crime_index != null || nb.scores?.school_score != null || nb.scores?.walkability != null) && (
                      <div className="pt-2 border-t border-border/40 space-y-1.5">
                        {nb.scores?.crime_index != null && <ScoreBar label="Safety" score={nb.scores.crime_index} />}
                        {nb.scores?.school_score != null && <ScoreBar label="Schools" score={nb.scores.school_score} />}
                        {nb.scores?.walkability != null && <ScoreBar label="Walkability" score={nb.scores.walkability} />}
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
            </Section>
          </div>

          {/* CTA footer */}
          <div className="shrink-0 border-t border-border/40 p-4 flex items-center justify-end gap-2 bg-muted/10">
            <OwnerSkipTraceButton owner={property.owner} />
            <Button
              onClick={handleSendToAnalyzer}
              size="sm"
              className="h-9 bg-amber-400 text-neutral-950 hover:bg-amber-300"
            >
              <Sparkles className="h-4 w-4 mr-2" />
              Send to AI Analyzer
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Owner portfolio modal — flag-gated. Lives as a sibling Dialog so
          it stacks above this one when triggered from inside. */}
      {openOwner && (
        <OwnerDetailModal
          isOpen={!!openOwner}
          onClose={() => setOpenOwner(null)}
          owner={openOwner.owner || {}}
          fallbackZip={openOwner.address?.zip}
        />
      )}
    </>
  );
}

function Stat({
  label, value, sub, accent,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: boolean;
}) {
  return (
    <div className={`p-3 rounded-lg border ${accent ? 'bg-amber-500/5 border-amber-500/30' : 'bg-muted/30 border-border/40'}`}>
      <div className={`text-[10px] uppercase tracking-wider ${accent ? 'text-amber-300' : 'text-muted-foreground'}`}>{label}</div>
      <div className={`text-base font-bold mt-0.5 ${accent ? 'text-amber-300' : ''}`}>{value}</div>
      {sub && <div className="text-[10px] text-muted-foreground mt-0.5">{sub}</div>}
    </div>
  );
}

function KV({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="min-w-0">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`text-sm font-medium mt-0.5 truncate ${accent ? 'text-amber-300' : ''}`}>{value}</div>
    </div>
  );
}

function ScoreBar({ label, score }: { label: string; score: number }) {
  const color =
    score >= 70 ? 'text-emerald-300' : score >= 40 ? 'text-cyan-300' : 'text-amber-300';
  return (
    <div className="flex items-center gap-3 text-xs">
      <span className="text-muted-foreground w-20">{label}</span>
      <Progress value={Math.max(0, Math.min(100, score))} className="h-1.5 flex-1" />
      <span className={`font-bold w-10 text-right ${color}`}>{Math.round(score)}</span>
    </div>
  );
}

function Section({ title, icon: Icon, children }: { title: string; icon: React.ComponentType<{ className?: string }>; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <h3 className="text-[11px] font-semibold tracking-[0.14em] text-muted-foreground uppercase flex items-center gap-1.5">
        <Icon className="h-3 w-3" />
        {title}
      </h3>
      {children}
    </div>
  );
}
