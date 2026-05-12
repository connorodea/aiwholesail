import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { zillowAPI } from '@/lib/zillow-api';
import type { Property } from '@/types/zillow';
import { GraduationCap, RefreshCw, ExternalLink, Star } from 'lucide-react';

/**
 * Schools tab for the PropertyModal.
 *
 * Calls the Zillow Scraper's /v1/schools endpoint (proxied via
 * zillowAPI.getPropertySchools). The response shape varies — some
 * records expose `assignedSchools[]`, others `schools[]`, others a
 * `nearbySchools[]` collection. We try the common keys and surface
 * whatever we find.
 *
 * Each school card shows: name, type (Elementary/Middle/High), grade
 * range, distance, rating (GreatSchools 1-10), and a "view profile"
 * link to the Zillow page when available.
 */

interface SchoolRecord {
  name?: string;
  type?: string;            // 'Elementary' | 'Middle' | 'High' | 'Other'
  grades?: string;          // 'K-5'
  rating?: number | string; // GreatSchools rating
  distance?: number;        // miles
  totalCount?: number;
  studentsPerTeacher?: number;
  isAssigned?: boolean;
  level?: string;
  link?: string;
}

function normalize(data: unknown): SchoolRecord[] {
  if (!data || typeof data !== 'object') return [];
  const d = data as Record<string, unknown>;
  const candidates = [
    d.schools,
    d.assignedSchools,
    d.nearbySchools,
    (d.data as Record<string, unknown> | undefined)?.schools,
    (d.schoolsAssigned as { schools?: unknown[] } | undefined)?.schools,
  ];
  for (const c of candidates) {
    if (Array.isArray(c) && c.length > 0) return c as SchoolRecord[];
  }
  return [];
}

function ratingColor(rating: number | string | undefined): string {
  const r = typeof rating === 'string' ? parseFloat(rating) : rating;
  if (typeof r !== 'number' || isNaN(r)) return 'bg-muted text-muted-foreground';
  if (r >= 8) return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';
  if (r >= 6) return 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30';
  if (r >= 4) return 'bg-amber-500/20 text-amber-300 border-amber-500/30';
  return 'bg-red-500/20 text-red-300 border-red-500/30';
}

export function PropertySchoolsTab({ property }: { property: Property }) {
  const [loading, setLoading] = useState(true);
  const [schools, setSchools] = useState<SchoolRecord[]>([]);
  const [error, setError] = useState<string | null>(null);
  const zpid = property.zpid || property.id;

  useEffect(() => {
    if (!zpid) {
      setError('No Zillow property ID available for this listing.');
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const data = await zillowAPI.getPropertySchools(String(zpid));
        if (cancelled) return;
        const list = normalize(data);
        setSchools(list);
        if (list.length === 0) setError('No school data returned for this property.');
      } catch (err) {
        if (cancelled) return;
        console.error('[PropertySchoolsTab]', err);
        setError('Could not load school data from Zillow.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [zpid]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        <RefreshCw className="h-4 w-4 animate-spin mr-2" /> Loading schools…
      </div>
    );
  }

  if (error && schools.length === 0) {
    return (
      <Card className="border-border/60">
        <CardContent className="p-6 text-center space-y-2">
          <GraduationCap className="h-8 w-8 mx-auto text-muted-foreground/60" />
          <p className="text-sm text-muted-foreground">{error}</p>
        </CardContent>
      </Card>
    );
  }

  // Group by level for cleaner display
  const byLevel: Record<string, SchoolRecord[]> = {};
  for (const s of schools) {
    const lvl = s.type || s.level || 'Other';
    if (!byLevel[lvl]) byLevel[lvl] = [];
    byLevel[lvl].push(s);
  }
  const order = ['Elementary', 'Middle', 'High', 'Other'];
  const levels = Object.keys(byLevel).sort((a, b) => {
    const ai = order.indexOf(a);
    const bi = order.indexOf(b);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });

  return (
    <div className="space-y-4">
      <Card className="border-border/60">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <GraduationCap className="h-5 w-5 text-primary" />
            Schools ({schools.length})
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Ratings from GreatSchools (1–10). 8+ = strong, 6–7 = average, &lt;6 = below average.
            Assigned schools are highlighted.
          </p>
        </CardHeader>
      </Card>

      {levels.map((lvl) => (
        <div key={lvl} className="space-y-2">
          <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wider px-1">
            {lvl}
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {byLevel[lvl].map((s, i) => (
              <Card
                key={`${s.name}-${i}`}
                className={`border-border/60 ${s.isAssigned ? 'ring-1 ring-cyan-500/30' : ''}`}
              >
                <CardContent className="pt-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-medium text-sm truncate">{s.name || 'Unknown school'}</div>
                      <div className="text-xs text-muted-foreground">
                        {[s.grades, s.distance != null ? `${s.distance.toFixed(1)} mi away` : null]
                          .filter(Boolean)
                          .join(' • ')}
                      </div>
                    </div>
                    {s.rating != null && (
                      <Badge variant="outline" className={`flex-shrink-0 ${ratingColor(s.rating)}`}>
                        <Star className="h-3 w-3 mr-1" />
                        {s.rating}/10
                      </Badge>
                    )}
                  </div>
                  {(s.studentsPerTeacher || s.totalCount) && (
                    <div className="flex gap-3 text-xs text-muted-foreground pt-1 border-t border-border/40">
                      {s.studentsPerTeacher && (
                        <span>{s.studentsPerTeacher}:1 student/teacher</span>
                      )}
                      {s.totalCount && <span>{s.totalCount} students</span>}
                    </div>
                  )}
                  {s.isAssigned && (
                    <Badge variant="outline" className="text-[10px] border-cyan-500/40 text-cyan-300">
                      Assigned
                    </Badge>
                  )}
                  {s.link && (
                    <a
                      href={s.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-cyan-400 hover:underline"
                    >
                      <ExternalLink className="h-3 w-3" />
                      View profile
                    </a>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
