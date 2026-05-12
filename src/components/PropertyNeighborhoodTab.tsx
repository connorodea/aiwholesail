import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { zillowAPI } from '@/lib/zillow-api';
import { propDataAPI } from '@/lib/propdata-api';
import type { Property } from '@/types/zillow';
import { MapPin, RefreshCw, TrendingUp, AlertTriangle, Bike, Bus, Footprints } from 'lucide-react';

/**
 * Neighborhood tab for PropertyModal.
 *
 * Fuses two data sources:
 *   1. Zillow Scraper /v1/walk-score — walkability, transit, bike
 *   2. PropData /v1/neighborhood — ZIP-level demographics + crime score
 *
 * Each section is independently best-effort: if one source fails the
 * other still renders. Tab opens lazily so the API spend is per-click.
 */

interface WalkScoreData {
  walkScore?: number;
  transitScore?: number;
  bikeScore?: number;
  description?: string;
}

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

function normalizeWalkScore(raw: unknown): WalkScoreData {
  if (!raw || typeof raw !== 'object') return {};
  const d = raw as Record<string, unknown>;
  const ws = (d.walkScore ?? d.walk_score ?? d.data ?? d) as Record<string, unknown>;
  return {
    walkScore: typeof ws.walkScore === 'number' ? ws.walkScore : (typeof ws.walk === 'number' ? ws.walk : undefined),
    transitScore: typeof ws.transitScore === 'number' ? ws.transitScore : (typeof ws.transit === 'number' ? ws.transit : undefined),
    bikeScore: typeof ws.bikeScore === 'number' ? ws.bikeScore : (typeof ws.bike === 'number' ? ws.bike : undefined),
    description: typeof ws.description === 'string' ? ws.description : undefined,
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
  const zpid = property.zpid || property.id;
  const zip = (property as { zipcode?: string; zip?: string }).zipcode || (property as { zip?: string }).zip;

  const [loading, setLoading] = useState(true);
  const [walk, setWalk] = useState<WalkScoreData>({});
  const [neighborhood, setNeighborhood] = useState<NeighborhoodData | null>(null);
  const [walkErr, setWalkErr] = useState<string | null>(null);
  const [nbErr, setNbErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const tasks: Promise<unknown>[] = [];

      if (zpid) {
        tasks.push(
          zillowAPI.getWalkScore(String(zpid))
            .then((d) => {
              if (!cancelled) setWalk(normalizeWalkScore(d));
            })
            .catch(() => {
              if (!cancelled) setWalkErr('Could not load walk score.');
            })
        );
      }

      if (zip) {
        tasks.push(
          propDataAPI.getNeighborhood(String(zip))
            .then((d) => {
              if (!cancelled) setNeighborhood(d as NeighborhoodData);
            })
            .catch(() => {
              if (!cancelled) setNbErr('Could not load neighborhood demographics.');
            })
        );
      }

      await Promise.all(tasks);
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [zpid, zip]);

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
          Walkability & Transit
        </h3>
        {walkErr ? (
          <Card className="border-border/60">
            <CardContent className="p-4 text-sm text-muted-foreground flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" /> {walkErr}
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <ScoreCard
              label="Walk Score"
              score={walk.walkScore}
              icon={Footprints}
              helperHigh="Most errands can be accomplished on foot"
              helperLow="Most errands require a car"
            />
            <ScoreCard
              label="Transit Score"
              score={walk.transitScore}
              icon={Bus}
              helperHigh="Excellent public transit access"
              helperLow="Few or no public transit options"
            />
            <ScoreCard
              label="Bike Score"
              score={walk.bikeScore}
              icon={Bike}
              helperHigh="Bikeable infrastructure"
              helperLow="Limited bike infrastructure"
            />
          </div>
        )}
      </section>

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
