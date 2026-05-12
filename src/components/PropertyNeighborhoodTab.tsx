import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { propDataAPI } from '@/lib/propdata-api';
import type { Property } from '@/types/zillow';
import { MapPin, RefreshCw, TrendingUp, AlertTriangle, Footprints } from 'lucide-react';

/**
 * Neighborhood tab for PropertyModal.
 *
 * Sourced entirely from PropData /v1/neighborhood — ZIP-level
 * demographics + crime / school / walkability scores.
 *
 * The PR #203 version also tried Zillow Scraper's walk-score endpoint,
 * but our proxy explicitly rejects that action because the upstream
 * Zillow Scraper API doesn't expose it. The "walkability" score in the
 * card grid below is PropData's own (composite of street network
 * density + amenity density), which is the same conceptual signal.
 */

interface NeighborhoodData {
  demographics?: {
    total_population?: number | null;
    median_age?: number | null;
    median_household_income?: number | null;
    owner_occupied_pct?: number | null;
  };
  housing?: {
    median_value?: number | null;
    avg_year_built?: number | null;
  };
  scores?: {
    walkability?: number;
    crime_index?: number;
    school_score?: number;
  };
}

function ScoreCard({
  label,
  score,
  icon: Icon,
  helperHigh,
  helperLow,
}: {
  label: string;
  score?: number;
  icon: React.ComponentType<{ className?: string }>;
  helperHigh: string;
  helperLow: string;
}) {
  if (score == null) {
    return (
      <Card className="border-border/60">
        <CardContent className="pt-4 space-y-2">
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <Icon className="h-4 w-4" /> {label}
          </div>
          <div className="text-xs text-muted-foreground">No data</div>
        </CardContent>
      </Card>
    );
  }
  const color = score >= 70 ? 'text-emerald-300' : score >= 40 ? 'text-cyan-300' : 'text-amber-300';
  return (
    <Card className="border-border/60">
      <CardContent className="pt-4 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <Icon className="h-4 w-4" /> {label}
          </div>
          <span className={`text-2xl font-bold ${color}`}>{Math.round(score)}</span>
        </div>
        <Progress value={score} className="h-1.5" />
        <p className="text-xs text-muted-foreground">
          {score >= 70 ? helperHigh : helperLow}
        </p>
      </CardContent>
    </Card>
  );
}

const fmt = (val?: number | null) =>
  val != null ? new Intl.NumberFormat('en-US').format(val) : '—';
const fmtCurrency = (val?: number | null) =>
  val != null
    ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(val)
    : '—';
const fmtPct = (val?: number | null) =>
  val != null ? `${Math.round(val * 100)}%` : '—';

export function PropertyNeighborhoodTab({ property }: { property: Property }) {
  const zip = (property as { zipcode?: string; zip?: string }).zipcode || (property as { zip?: string }).zip;

  const [loading, setLoading] = useState(true);
  const [neighborhood, setNeighborhood] = useState<NeighborhoodData | null>(null);
  const [nbErr, setNbErr] = useState<string | null>(null);

  useEffect(() => {
    if (!zip) {
      setNbErr('No ZIP code on this property — neighborhood data requires a ZIP.');
      setLoading(false);
      return;
    }
    let cancelled = false;
    propDataAPI
      .getNeighborhood(String(zip))
      .then((d) => {
        if (!cancelled) setNeighborhood(d as NeighborhoodData);
      })
      .catch(() => {
        if (!cancelled) setNbErr('Could not load neighborhood demographics.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [zip]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        <RefreshCw className="h-4 w-4 animate-spin mr-2" /> Loading neighborhood data…
      </div>
    );
  }

  const scores = neighborhood?.scores;
  const demo = neighborhood?.demographics;
  const housing = neighborhood?.housing;

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider px-1">
          Neighborhood Quality Scores
          {zip && <span className="ml-2 text-xs text-muted-foreground/60">ZIP {zip}</span>}
        </h3>
        {nbErr ? (
          <Card className="border-border/60">
            <CardContent className="p-4 text-sm text-muted-foreground flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" /> {nbErr}
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <ScoreCard
              label="Crime Index"
              score={scores?.crime_index}
              icon={MapPin}
              helperHigh="Low reported crime"
              helperLow="Above-average reported crime"
            />
            <ScoreCard
              label="School Score"
              score={scores?.school_score}
              icon={TrendingUp}
              helperHigh="High-performing district"
              helperLow="Below-average district"
            />
            <ScoreCard
              label="Walkability (PropData)"
              score={scores?.walkability}
              icon={Footprints}
              helperHigh="Walkable layout"
              helperLow="Car-dependent"
            />
          </div>
        )}
      </section>

      {neighborhood && (
        <section className="space-y-3">
          <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider px-1">
            Demographics
          </h3>
          <Card className="border-border/60">
            <CardContent className="p-4 grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <Stat label="Population" value={fmt(demo?.total_population)} />
              <Stat label="Median age" value={demo?.median_age != null ? `${Math.round(demo.median_age)}` : '—'} />
              <Stat label="Median income" value={fmtCurrency(demo?.median_household_income)} />
              <Stat label="Owner-occupied" value={fmtPct(demo?.owner_occupied_pct)} />
              <Stat label="Median home value" value={fmtCurrency(housing?.median_value)} />
              <Stat label="Avg year built" value={housing?.avg_year_built != null ? `${housing.avg_year_built}` : '—'} />
            </CardContent>
          </Card>
        </section>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-0.5">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="font-medium">{value}</div>
    </div>
  );
}
