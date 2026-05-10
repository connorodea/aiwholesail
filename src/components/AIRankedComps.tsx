import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Loader2, Sparkles, TrendingUp, TrendingDown, AlertCircle, Award,
  MapPin, Bed, Bath, Square, Calendar, Building2, ArrowUp, ArrowDown,
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
        const r = await ai.rankComps({
          zpid: property.zpid || property.id,
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
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
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
                    {entry.comp.daysOnZillow != null && (
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
