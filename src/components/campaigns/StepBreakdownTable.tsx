/**
 * StepBreakdownTable — sortable per-step analytics table for CampaignDetail.
 *
 * One row per sequence step with delivery/open/reply/bounce rates and a
 * recommendation badge. Click a row to open the recipient drill-down sheet
 * filtered to that step.
 */

import { useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { ArrowUpDown } from 'lucide-react';

export interface StepRow {
  step_order: number;
  day_offset: number;
  channel: string;
  subject: string | null;
  sent: number;
  delivered: number;
  opened: number;
  clicked: number;
  replied: number;
  bounced: number;
  open_rate: number;
  click_rate: number;
  reply_rate: number;
  delivery_rate: number;
  bounce_rate: number;
  recommendation: string;
}

interface Props {
  steps: StepRow[];
  onRowClick?: (step: StepRow) => void;
}

type SortKey =
  | 'step_order'
  | 'sent'
  | 'open_rate'
  | 'reply_rate'
  | 'bounce_rate';

const RECOMMENDATION_TONE: Record<string, string> = {
  good: 'bg-cyan-500/15 text-cyan-300 border-cyan-400/30',
  monitoring: 'bg-neutral-700/40 text-neutral-300 border-neutral-600/40',
  'rewrite subject': 'bg-amber-500/15 text-amber-300 border-amber-400/30',
  'deliverability issue': 'bg-amber-500/15 text-amber-300 border-amber-400/30',
  'audience quality issue': 'bg-amber-500/15 text-amber-300 border-amber-400/30',
};

function fmtPct(n: number): string {
  if (!Number.isFinite(n)) return '—';
  return `${(n * 100).toFixed(1)}%`;
}

function truncate(s: string | null, n: number): string {
  if (!s) return '—';
  return s.length > n ? `${s.slice(0, n)}…` : s;
}

export function StepBreakdownTable({ steps, onRowClick }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>('step_order');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const sorted = useMemo(() => {
    const arr = [...steps];
    arr.sort((a, b) => {
      const av = Number(a[sortKey] ?? 0);
      const bv = Number(b[sortKey] ?? 0);
      return sortDir === 'asc' ? av - bv : bv - av;
    });
    return arr;
  }, [steps, sortKey, sortDir]);

  function toggleSort(k: SortKey) {
    if (k === sortKey) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(k);
      setSortDir(k === 'step_order' ? 'asc' : 'desc');
    }
  }

  function SortHeader({ k, label, className }: { k: SortKey; label: string; className?: string }) {
    return (
      <button
        type="button"
        onClick={() => toggleSort(k)}
        className={`group inline-flex items-center gap-1 text-left text-xs font-medium text-neutral-400 hover:text-white transition ${className ?? ''}`}
      >
        {label}
        <ArrowUpDown className="h-3 w-3 opacity-60 group-hover:opacity-100" />
      </button>
    );
  }

  if (steps.length === 0) {
    return (
      <div className="text-sm text-neutral-500 text-center py-8">
        No step data yet — once the sequence starts firing, breakdowns appear here.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-white/[0.06]">
      <table className="w-full text-sm">
        <thead className="bg-neutral-950/60 border-b border-white/[0.06]">
          <tr>
            <th className="px-3 py-2 text-left">
              <SortHeader k="step_order" label="Step" />
            </th>
            <th className="px-3 py-2 text-left">
              <span className="text-xs font-medium text-neutral-400">Day</span>
            </th>
            <th className="px-3 py-2 text-left">
              <span className="text-xs font-medium text-neutral-400">Subject</span>
            </th>
            <th className="px-3 py-2 text-right">
              <SortHeader k="sent" label="Sent" />
            </th>
            <th className="px-3 py-2 text-right">
              <SortHeader k="open_rate" label="Open" />
            </th>
            <th className="px-3 py-2 text-right">
              <SortHeader k="reply_rate" label="Reply" />
            </th>
            <th className="px-3 py-2 text-right">
              <SortHeader k="bounce_rate" label="Bounce" />
            </th>
            <th className="px-3 py-2 text-left">
              <span className="text-xs font-medium text-neutral-400">Recommendation</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((row) => {
            const tone = RECOMMENDATION_TONE[row.recommendation] || RECOMMENDATION_TONE.monitoring;
            return (
              <tr
                key={row.step_order}
                className="border-t border-white/[0.04] hover:bg-white/[0.02] cursor-pointer transition-colors"
                onClick={() => onRowClick?.(row)}
              >
                <td className="px-3 py-3 text-white font-medium">{row.step_order}</td>
                <td className="px-3 py-3 text-neutral-300">+{row.day_offset}d</td>
                <td className="px-3 py-3 text-neutral-300 max-w-[280px]">
                  <span className="text-xs uppercase tracking-wider text-neutral-500 mr-2">
                    {row.channel}
                  </span>
                  {truncate(row.subject, 60)}
                </td>
                <td className="px-3 py-3 text-right text-white">{row.sent}</td>
                <td className="px-3 py-3 text-right text-white">{fmtPct(row.open_rate)}</td>
                <td className="px-3 py-3 text-right text-white">{fmtPct(row.reply_rate)}</td>
                <td className="px-3 py-3 text-right text-white">{fmtPct(row.bounce_rate)}</td>
                <td className="px-3 py-3">
                  <Badge variant="outline" className={`text-[10px] ${tone}`}>
                    {row.recommendation}
                  </Badge>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default StepBreakdownTable;
