import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import {
  Loader2, Sparkles, AlertCircle, Award,
  MapPin, Bed, Bath, Square, Calendar, Building2, ArrowUp, ArrowDown,
  Hammer, Wallet, Percent, Target, Calculator,
} from 'lucide-react';
import { ai, type RankCompsResponse } from '@/lib/api-client';
import type { Property } from '@/types/zillow';
import { useSubscription } from '@/hooks/useSubscription';
import { ComparableSalesTable } from './ComparableSalesTable';
import { Link } from 'react-router-dom';

interface AIRankedCompsProps {
  property: Property;
}

function fmtCurrency(n: number | null | undefined) {
  if (n == null || !Number.isFinite(n)) return '—';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
}

function fmtNumber(n: number | null | undefined) {
  if (n == null || !Number.isFinite(n)) return '—';
  return new Intl.NumberFormat('en-US').format(n);
}

function fmtDate(iso: string | undefined) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return iso;
  }
}

function scoreColor(score: number) {
  if (score >= 80) return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/40';
  if (score >= 60) return 'bg-cyan-500/15 text-cyan-400 border-cyan-500/40';
  if (score >= 40) return 'bg-amber-500/15 text-amber-400 border-amber-500/40';
  return 'bg-red-500/15 text-red-400 border-red-500/40';
}

function confidenceColor(c: 'high' | 'medium' | 'low') {
  if (c === 'high') return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/40';
  if (c === 'medium') return 'bg-cyan-500/15 text-cyan-400 border-cyan-500/40';
  return 'bg-amber-500/15 text-amber-400 border-amber-500/40';
}

export function AIRankedComps({ property }: AIRankedCompsProps) {
  const { isElite, isPro } = useSubscription();
  const allowed = isElite || isPro;
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<RankCompsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showAllComps, setShowAllComps] = useState(false);

  useEffect(() => {
    if (!allowed) return;
    let cancelled = false;
    const run = async () => {
      setLoading(true);
      setError(null);
      try {
        const subject = {
          sqft: property.sqft,
          beds: property.bedrooms,
          baths: property.bathrooms,
          yearBuilt: property.yearBuilt,
          lotSize: property.lotSize,
          propertyType: property.propertyType,
          price: property.price,
        };
        // Only send zpid if it actually looks like a Zillow zpid (5+ digits).
        // property.id is an internal app identifier and will produce garbage
        // results if forwarded to Zillow's comp API. Fall back to address-only
        // lookup when no real zpid is available.
        const rawZpid = property.zpid;
        const zpid = rawZpid && /^\d{5,}$/.test(String(rawZpid)) ? String(rawZpid) : undefined;
        const r = await ai.rankComps({
          zpid,
          address: property.address,
          subject,
        });
        if (cancelled) return;
        if (r.error) {
          setError(r.error);
        } else if (r.data) {
          setResult(r.data);
        }
      } catch (e) {
        if (!cancelled) setError((e as Error).message || 'Failed to load AI-ranked comps');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    run();
    return () => { cancelled = true; };
    // Intentionally narrow deps: re-fetch only when the user opens a different
    // property. Re-running on every transient property-field change would
    // spam Claude unnecessarily.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [property.id, property.zpid, allowed]);

  if (!allowed) {
    return (
      <div className="space-y-4">
        <Card className="border-cyan-500/30">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-cyan-400" />
              AI-Ranked Comps — Pro / Elite
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-3">
            <p>
              Pro and Elite pick the top 6 comparable sales for you from Zillow's full pool — with reasoning, per-comp adjustments,
              and overall confidence on the comp set. Pro: 25 ranked-comps/month. Elite: unlimited. Below is the flat comp table that Trial users see.
            </p>
            <Button asChild><Link to="/pricing">View plans</Link></Button>
          </CardContent>
        </Card>
        <ComparableSalesTable property={property} />
      </div>
    );
  }

  if (loading) {
    return (
      <Card className="border-border/50">
        <CardContent className="py-12 text-center space-y-3">
          <Loader2 className="h-6 w-6 animate-spin text-cyan-400 mx-auto" />
          <p className="text-sm text-muted-foreground">
            AI is analyzing the comp pool and picking the best 6 matches…
          </p>
          <p className="text-[11px] text-muted-foreground">Usually takes 30-60 seconds.</p>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="border-amber-500/30">
        <CardContent className="py-8 text-center space-y-3">
          <AlertCircle className="h-6 w-6 text-amber-400 mx-auto" />
          <p className="text-sm">{error}</p>
          <Button onClick={() => setShowAllComps(true)} variant="outline">
            Show flat comp table instead
          </Button>
          {showAllComps && <ComparableSalesTable property={property} />}
        </CardContent>
      </Card>
    );
  }

  if (!result || result.ranked.length === 0) {
    return (
      <Card className="border-border/50">
        <CardContent className="py-8 text-center space-y-3">
          <AlertCircle className="h-6 w-6 text-muted-foreground mx-auto" />
          <p className="text-sm">No comparable sales available for this property.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Headline values */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <Card className="border-border/50">
          <CardContent className="p-4">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">As-Is Value</div>
            <div className="text-2xl font-bold mt-0.5">{fmtCurrency(result.implied_as_is_value)}</div>
            <div className="text-[11px] text-muted-foreground mt-1">Median of comps, no condition lift</div>
          </CardContent>
        </Card>
        <Card className="border-cyan-500/30 bg-cyan-500/[0.04]">
          <CardContent className="p-4">
            <div className="text-[10px] uppercase tracking-wider text-cyan-400/70">After Repair Value</div>
            <div className="text-2xl font-bold mt-0.5 text-cyan-400">{fmtCurrency(result.implied_arv)}</div>
            <div className="text-[11px] text-muted-foreground mt-1">Adjusted up for post-rehab condition</div>
          </CardContent>
        </Card>
        {/* Phase 1.2 extension: rehab headroom = ARV − As-Is, the spread the
            condition lift implies. Useful as a sanity check on the user's
            repair budget — if the headroom is $40K but their rehab estimate
            is $60K, the deal probably doesn't pencil. */}
        {result.implied_arv != null && result.implied_as_is_value != null && (
          <Card className="border-emerald-500/30 bg-emerald-500/[0.04]">
            <CardContent className="p-4">
              <div className="text-[10px] uppercase tracking-wider text-emerald-400/70">Rehab Headroom</div>
              <div className="text-2xl font-bold mt-0.5 text-emerald-400">
                {fmtCurrency(result.implied_arv - result.implied_as_is_value)}
              </div>
              <div className="text-[11px] text-muted-foreground mt-1">ARV − As-Is — your repair-budget ceiling</div>
            </CardContent>
          </Card>
        )}
        <Card className={`border ${confidenceColor(result.overall_confidence).split(' ')[2]}`}>
          <CardContent className="p-4">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Confidence</div>
            <Badge className={`${confidenceColor(result.overall_confidence)} text-xs mt-1 capitalize`}>
              {result.overall_confidence}
            </Badge>
            <div className="text-[11px] text-muted-foreground mt-2 leading-relaxed">{result.confidence_reasoning}</div>
          </CardContent>
        </Card>
      </div>

      {/* Phase 1.3 — Runtime-adjustable deal math sliders. ChatARV-parity move:
          let the user tune MAO% / repair cost / assignment fee in-context and
          see implied offer + spread recompute live. */}
      <DealMathPanel
        arv={result.implied_arv}
        listPrice={property.price}
        sqft={property.sqft}
      />

      {/* Ranked comp cards */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <Award className="h-4 w-4 text-cyan-400" />
          Top {result.ranked.length} comps · ranked by AI
        </h3>
        <span className="text-[11px] text-muted-foreground">
          {result.candidates_evaluated} candidates evaluated
        </span>
      </div>

      <div className="space-y-3">
        {result.ranked.map((entry, idx) => (
          <Card key={`${entry.comp.zpid || entry.comp_index}-${idx}`} className="border-border/50">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px]">#{idx + 1}</Badge>
                    <Badge className={`${scoreColor(entry.score)} text-xs`}>Score {entry.score}</Badge>
                    {entry.comp.saleDate && (
                      <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        Sold {fmtDate(entry.comp.saleDate)}
                      </span>
                    )}
                  </div>
                  <div className="font-medium text-sm mt-1.5 flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <span className="truncate">{entry.comp.address}{entry.comp.city ? `, ${entry.comp.city}` : ''}{entry.comp.zip ? ` ${entry.comp.zip}` : ''}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1.5 italic">{entry.reasoning}</p>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-lg font-bold">{fmtCurrency(entry.comp.price)}</div>
                  {entry.comp.pricePerSqft && (
                    <div className="text-[11px] text-muted-foreground">{fmtCurrency(entry.comp.pricePerSqft)}/sqft</div>
                  )}
                </div>
              </div>

              {/* Stats row */}
              <div className="flex flex-wrap gap-3 text-[11px] text-muted-foreground border-t border-border/30 pt-2">
                {entry.comp.sqft && (
                  <span className="flex items-center gap-1"><Square className="h-3 w-3" /> {fmtNumber(entry.comp.sqft)} sqft</span>
                )}
                {entry.comp.beds != null && (
                  <span className="flex items-center gap-1"><Bed className="h-3 w-3" /> {entry.comp.beds} bd</span>
                )}
                {entry.comp.baths != null && (
                  <span className="flex items-center gap-1"><Bath className="h-3 w-3" /> {entry.comp.baths} ba</span>
                )}
                {entry.comp.yearBuilt && (
                  <span className="flex items-center gap-1"><Building2 className="h-3 w-3" /> Built {entry.comp.yearBuilt}</span>
                )}
                {entry.comp.distance != null && (
                  <span className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {entry.comp.distance.toFixed(2)} mi</span>
                )}
              </div>

              {/* Adjustments */}
              {entry.adjustments?.length > 0 && (
                <div className="border-t border-border/30 pt-2">
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1.5">Adjustments for ARV</div>
                  <div className="space-y-1">
                    {entry.adjustments.map((adj, i) => (
                      <div key={i} className="flex items-start gap-2 text-xs">
                        {adj.direction === 'up' ? (
                          <ArrowUp className="h-3 w-3 text-emerald-400 shrink-0 mt-0.5" />
                        ) : (
                          <ArrowDown className="h-3 w-3 text-red-400 shrink-0 mt-0.5" />
                        )}
                        <span className="font-mono text-[11px] text-foreground shrink-0 w-20">
                          {adj.direction === 'up' ? '+' : ''}{fmtCurrency(adj.amount_estimate)}
                        </span>
                        <span className="text-muted-foreground">{adj.reason}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Fallback to flat table */}
      <div className="pt-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowAllComps((v) => !v)}
          className="text-xs text-muted-foreground"
        >
          {showAllComps ? 'Hide full comp table' : `Show all ${result.candidates_evaluated} comps in a flat table`}
        </Button>
        {showAllComps && (
          <div className="mt-3">
            <ComparableSalesTable property={property} />
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * In-context deal math: ARV → MAO → offer → expected profit.
 *
 * Live-recomputes as the user drags any slider. Defaults seed from the
 * property (price as listing-side reference, sqft × $25 as a rule-of-thumb
 * repair estimate) so the panel is immediately useful even before the user
 * touches anything.
 *
 * Math:
 *   MAO        = ARV × (mao_pct / 100) − repairs − fee
 *   offer      = MAO (the price you'd offer the seller)
 *   gross profit (wholesaler) = fee  (what you keep when you assign)
 *   buyer profit at sale     = ARV − offer − repairs − closing/sell-side
 *   spread vs list           = listPrice − offer  (negative = you'd be paying ABOVE list, bad)
 */
function DealMathPanel({
  arv,
  listPrice,
  sqft,
}: {
  arv: number | null;
  listPrice?: number;
  sqft?: number;
}) {
  // 70% rule baseline. ChatARV lets users adjust this between 60-80%.
  const [maoPct, setMaoPct] = useState(70);
  // Repair budget defaults to sqft × $25 (industry rule of thumb for cosmetic)
  const defaultRepair = sqft ? Math.round(sqft * 25) : 25000;
  const [repairs, setRepairs] = useState(defaultRepair);
  // Assignment fee — typical wholesale range $5K-$25K
  const [fee, setFee] = useState(10000);

  const math = useMemo(() => {
    if (!arv || arv <= 0) return null;
    const mao = Math.max(0, Math.round(arv * (maoPct / 100) - repairs - fee));
    const spreadVsList = listPrice ? listPrice - mao : null;
    const buyerCostBasis = mao + repairs;
    const sellingCosts = Math.round(arv * 0.06); // 6% closing on the sell side, industry standard
    const buyerNetProfit = arv - buyerCostBasis - sellingCosts;
    const buyerRoi = buyerCostBasis > 0 ? (buyerNetProfit / buyerCostBasis) * 100 : 0;
    return { mao, spreadVsList, buyerCostBasis, sellingCosts, buyerNetProfit, buyerRoi };
  }, [arv, maoPct, repairs, fee, listPrice]);

  if (!arv || arv <= 0) {
    return null;
  }

  const fmtUsd = (n: number | null | undefined) => {
    if (n == null || !Number.isFinite(n)) return '—';
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
  };

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Calculator className="h-4 w-4 text-cyan-400" />
          Deal Math
          <span className="text-[11px] text-muted-foreground font-normal ml-2">drag to tune offer + repair + fee</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Sliders */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label className="text-xs flex items-center justify-between">
              <span className="flex items-center gap-1.5"><Percent className="h-3 w-3 text-cyan-400" /> MAO Rule</span>
              <span className="font-mono text-cyan-400">{maoPct}%</span>
            </Label>
            <Slider
              value={[maoPct]}
              min={60}
              max={80}
              step={1}
              onValueChange={(v) => setMaoPct(v[0])}
            />
            <p className="text-[10px] text-muted-foreground">60% conservative · 70% standard · 80% aggressive</p>
          </div>
          <div className="space-y-2">
            <Label className="text-xs flex items-center justify-between">
              <span className="flex items-center gap-1.5"><Hammer className="h-3 w-3 text-cyan-400" /> Repair Budget</span>
              <span className="font-mono text-cyan-400">{fmtUsd(repairs)}</span>
            </Label>
            <Slider
              value={[repairs]}
              min={0}
              max={Math.max(100000, defaultRepair * 2)}
              step={1000}
              onValueChange={(v) => setRepairs(v[0])}
            />
            <p className="text-[10px] text-muted-foreground">
              Default: {sqft ? `${sqft} sqft × $25` : '$25K'} · drag to tune
            </p>
          </div>
          <div className="space-y-2">
            <Label className="text-xs flex items-center justify-between">
              <span className="flex items-center gap-1.5"><Wallet className="h-3 w-3 text-cyan-400" /> Assignment Fee</span>
              <span className="font-mono text-cyan-400">{fmtUsd(fee)}</span>
            </Label>
            <Slider
              value={[fee]}
              min={0}
              max={50000}
              step={500}
              onValueChange={(v) => setFee(v[0])}
            />
            <p className="text-[10px] text-muted-foreground">Your wholesale spread</p>
          </div>
        </div>

        {/* Live-recomputed deal math */}
        {math && (
          <div className="border-t border-border/50 pt-3 grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="rounded-lg bg-cyan-500/5 border border-cyan-500/20 p-3">
              <div className="text-[10px] uppercase tracking-wider text-cyan-400/70 flex items-center gap-1">
                <Target className="h-3 w-3" /> Offer to Seller (MAO)
              </div>
              <div className="text-lg font-bold text-cyan-400 mt-1">{fmtUsd(math.mao)}</div>
            </div>
            {math.spreadVsList != null && (
              <div className={`rounded-lg p-3 border ${
                math.spreadVsList > 0
                  ? 'bg-emerald-500/5 border-emerald-500/20'
                  : 'bg-red-500/5 border-red-500/20'
              }`}>
                <div className={`text-[10px] uppercase tracking-wider flex items-center gap-1 ${
                  math.spreadVsList > 0 ? 'text-emerald-400/70' : 'text-red-400/70'
                }`}>
                  {math.spreadVsList > 0 ? <ArrowDown className="h-3 w-3" /> : <ArrowUp className="h-3 w-3" />}
                  Below List Price
                </div>
                <div className={`text-lg font-bold mt-1 ${math.spreadVsList > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {math.spreadVsList > 0 ? fmtUsd(math.spreadVsList) : `−${fmtUsd(Math.abs(math.spreadVsList))}`}
                </div>
              </div>
            )}
            <div className="rounded-lg bg-foreground/[0.04] border border-border/50 p-3">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Buyer Cost Basis</div>
              <div className="text-lg font-bold mt-1">{fmtUsd(math.buyerCostBasis)}</div>
              <div className="text-[10px] text-muted-foreground mt-0.5">Offer + repairs</div>
            </div>
            <div className={`rounded-lg p-3 border ${
              math.buyerRoi >= 20
                ? 'bg-emerald-500/5 border-emerald-500/20'
                : math.buyerRoi >= 10
                  ? 'bg-amber-500/5 border-amber-500/20'
                  : 'bg-red-500/5 border-red-500/20'
            }`}>
              <div className={`text-[10px] uppercase tracking-wider ${
                math.buyerRoi >= 20 ? 'text-emerald-400/70'
                : math.buyerRoi >= 10 ? 'text-amber-400/70'
                : 'text-red-400/70'
              }`}>
                Buyer ROI
              </div>
              <div className={`text-lg font-bold mt-1 ${
                math.buyerRoi >= 20 ? 'text-emerald-400'
                : math.buyerRoi >= 10 ? 'text-amber-400'
                : 'text-red-400'
              }`}>
                {math.buyerRoi.toFixed(1)}%
              </div>
              <div className="text-[10px] text-muted-foreground mt-0.5">
                {fmtUsd(math.buyerNetProfit)} after 6% selling costs
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
