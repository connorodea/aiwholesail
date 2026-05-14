/**
 * FunnelChart — horizontal SVG funnel for campaign analytics.
 *
 * Renders Sent → Delivered → Opened → Clicked → Replied → Interested with
 * counts + % of prior stage. Implementation is a plain SVG with absolutely
 * positioned bars — recharts FunnelChart's bundle weight is overkill for
 * six static rows that never animate and need no axis/tooltip plumbing.
 */

import { useMemo } from 'react';

export interface FunnelStage {
  key: string;
  label: string;
  count: number;
  /** color hint passed straight to fill — Tailwind palette friendly */
  color: string;
}

interface FunnelChartProps {
  stages: FunnelStage[];
}

interface RenderedStage extends FunnelStage {
  pctOfPrior: number;
  pctOfFirst: number;
}

const ROW_HEIGHT = 56;
const ROW_GAP = 8;
const MIN_BAR_WIDTH_PCT = 4; // floor so 0-count stages remain visible

export function FunnelChart({ stages }: FunnelChartProps) {
  const rows: RenderedStage[] = useMemo(() => {
    if (!stages.length) return [];
    const first = stages[0]?.count ?? 0;
    return stages.map((s, i) => {
      const prior = i === 0 ? s.count : stages[i - 1]?.count ?? 0;
      return {
        ...s,
        pctOfPrior: prior > 0 ? s.count / prior : 0,
        pctOfFirst: first > 0 ? s.count / first : 0,
      };
    });
  }, [stages]);

  if (rows.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-sm text-neutral-500">
        No data yet
      </div>
    );
  }

  return (
    <div className="space-y-2" role="img" aria-label="Campaign funnel">
      {rows.map((row, idx) => {
        const widthPct = Math.max(
          row.pctOfFirst * 100,
          MIN_BAR_WIDTH_PCT,
        );
        const pctLabel = idx === 0
          ? '100%'
          : `${(row.pctOfPrior * 100).toFixed(1)}%`;
        return (
          <div
            key={row.key}
            className="relative w-full"
            style={{ height: ROW_HEIGHT, marginBottom: ROW_GAP }}
          >
            <div
              className="absolute left-0 top-0 h-full rounded-md transition-all duration-300 ease-out"
              style={{
                width: `${widthPct}%`,
                background: row.color,
                opacity: 0.85,
              }}
              aria-hidden="true"
            />
            <div className="relative h-full flex items-center justify-between px-4 text-sm">
              <div className="flex items-center gap-3 text-white font-medium">
                <span className="text-xs uppercase tracking-wider text-white/70 min-w-[88px]">
                  {row.label}
                </span>
                <span className="text-base text-white">{formatCount(row.count)}</span>
              </div>
              <div className="text-xs text-white/80">
                {idx === 0 ? 'baseline' : `${pctLabel} of prior`}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function formatCount(n: number): string {
  if (!Number.isFinite(n)) return '0';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 10_000) return `${(n / 1_000).toFixed(1)}k`;
  return n.toLocaleString();
}

export default FunnelChart;
