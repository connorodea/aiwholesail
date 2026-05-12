import { useEffect, useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { zillowAPI } from '@/lib/zillow-api';
import type { Property } from '@/types/zillow';
import { TrendingUp, TrendingDown, Sparkles, RefreshCw, AlertTriangle } from 'lucide-react';

/**
 * Zestimate history chart — Zillow's AI-estimated value over time.
 *
 * Calls /v1/zestimate-history lazily. Renders alongside the listing
 * price history so the user can compare list-price trajectory against
 * the algorithm's AI value estimate (useful for spotting properties
 * that have been chasing a falling Zestimate or holding firm above it).
 */

interface ZestimatePoint {
  date: string;     // ISO date
  value: number;
  ts: number;       // for chart x-axis
}

function normalize(raw: unknown): ZestimatePoint[] {
  if (!raw) return [];
  const d = (raw as Record<string, unknown>) || {};
  const candidates = [
    d.zestimateHistory,
    d.history,
    (d.data as Record<string, unknown> | undefined)?.zestimateHistory,
    (d.data as Record<string, unknown> | undefined)?.history,
    Array.isArray(raw) ? raw : null,
  ];
  let arr: unknown[] | null = null;
  for (const c of candidates) {
    if (Array.isArray(c) && c.length > 0) {
      arr = c;
      break;
    }
  }
  if (!arr) return [];
  const out: ZestimatePoint[] = [];
  for (const entry of arr) {
    if (!entry || typeof entry !== 'object') continue;
    const e = entry as Record<string, unknown>;
    const date =
      (typeof e.date === 'string' && e.date) ||
      (typeof e.time === 'string' && e.time) ||
      (typeof e.t === 'string' && e.t);
    const valueRaw =
      e.value ?? e.zestimate ?? e.z ?? e.amount ?? e.estimate;
    const value = typeof valueRaw === 'number' ? valueRaw : parseFloat(String(valueRaw));
    if (!date || !isFinite(value) || value <= 0) continue;
    const ts = new Date(date).getTime();
    if (!isFinite(ts)) continue;
    out.push({ date, value, ts });
  }
  out.sort((a, b) => a.ts - b.ts);
  return out;
}

const fmtCurrency = (val?: number) =>
  val != null ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(val) : '—';

export function ZestimateHistoryChart({ property }: { property: Property }) {
  const zpid = property.zpid || property.id;
  const [loading, setLoading] = useState(true);
  const [points, setPoints] = useState<ZestimatePoint[]>([]);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!zpid) {
      setErr('No Zillow property ID — Zestimate history unavailable.');
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const data = await zillowAPI.getZestimateHistory(String(zpid));
        if (cancelled) return;
        const list = normalize(data);
        setPoints(list);
        if (list.length === 0) setErr('No Zestimate history available for this property.');
      } catch (e) {
        if (cancelled) return;
        console.error('[ZestimateHistoryChart]', e);
        setErr('Could not load Zestimate history.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [zpid]);

  const stats = useMemo(() => {
    if (points.length < 2) return null;
    const first = points[0];
    const last = points[points.length - 1];
    const delta = last.value - first.value;
    const pct = (delta / first.value) * 100;
    const trend = delta >= 0 ? 'up' : 'down';
    return { first, last, delta, pct, trend };
  }, [points]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-6 text-muted-foreground">
        <RefreshCw className="h-4 w-4 animate-spin mr-2" /> Loading Zestimate history…
      </div>
    );
  }

  if (err && points.length === 0) {
    return (
      <Card className="border-border/60">
        <CardContent className="p-4 text-sm text-muted-foreground flex items-center gap-2">
          <AlertTriangle className="h-4 w-4" /> {err}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border/60">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="h-4 w-4 text-cyan-400" />
            Zestimate Trend
          </CardTitle>
          {stats && (
            <Badge
              variant="outline"
              className={`text-xs gap-1 ${
                stats.trend === 'up'
                  ? 'border-emerald-500/40 text-emerald-300'
                  : 'border-amber-500/40 text-amber-300'
              }`}
            >
              {stats.trend === 'up' ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
              {fmtCurrency(Math.abs(stats.delta))} ({stats.pct >= 0 ? '+' : ''}{stats.pct.toFixed(1)}%)
            </Badge>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          Zillow's AI-estimated property value over time. Compare against the list-price trajectory to spot pricing pressure.
        </p>
      </CardHeader>
      <CardContent>
        {stats && (
          <div className="grid grid-cols-2 gap-3 text-sm pb-3 border-b border-border/40">
            <div>
              <div className="text-xs text-muted-foreground">First Zestimate</div>
              <div className="font-medium">{fmtCurrency(stats.first.value)}</div>
              <div className="text-[10px] text-muted-foreground">{stats.first.date.slice(0, 10)}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Current</div>
              <div className="font-medium">{fmtCurrency(stats.last.value)}</div>
              <div className="text-[10px] text-muted-foreground">{stats.last.date.slice(0, 10)}</div>
            </div>
          </div>
        )}
        <div className="h-48 mt-3">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={points} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="zestColor" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#06b6d4" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="#06b6d4" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="ts"
                tickFormatter={(ts) => new Date(ts).toLocaleDateString('en-US', { year: '2-digit', month: 'short' })}
                stroke="rgb(115 115 115)"
                fontSize={10}
                tickMargin={6}
              />
              <YAxis
                tickFormatter={(v) => `$${Math.round(v / 1000)}k`}
                stroke="rgb(115 115 115)"
                fontSize={10}
                width={50}
              />
              <Tooltip
                labelFormatter={(ts) => new Date(ts).toLocaleDateString('en-US', { year: 'numeric', month: 'long' })}
                formatter={(value: number) => [fmtCurrency(value), 'Zestimate']}
                contentStyle={{ background: 'rgb(20 20 22)', border: '1px solid rgb(64 64 64)', borderRadius: 6 }}
                labelStyle={{ color: 'rgb(212 212 212)', fontSize: 12 }}
              />
              <Area type="monotone" dataKey="value" stroke="#06b6d4" strokeWidth={2} fill="url(#zestColor)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
