/**
 * RecipientDrilldown — paginated recipient list shown in a side sheet.
 *
 * Triggered by clicking a step row in StepBreakdownTable, or any drill-into
 * action on the funnel. Fetches /api/campaigns/:id/analytics?slice=by-recipient
 * filtered to the chosen step (if any) and renders one row per recipient
 * with their last stage and stage timestamps.
 */

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, MessageSquare, ChevronLeft, ChevronRight } from 'lucide-react';
import { apiFetch } from '@/lib/api-client';

interface RecipientStages {
  sent_at: string | null;
  delivered_at: string | null;
  opened_at: string | null;
  clicked_at: string | null;
  replied_at: string | null;
  bounced_at: string | null;
  parsed_intent: string | null;
  reply_received_at: string | null;
}

interface RecipientRow {
  target_id: string;
  target_email: string | null;
  target_name: string | null;
  lead_sequence_id: string | null;
  lead_sequence_status: string | null;
  last_stage: string;
  step_order: number | null;
  stages: RecipientStages;
}

interface RecipientResponse {
  recipients: RecipientRow[];
  total: number;
  limit: number;
  offset: number;
}

interface Props {
  campaignId: string;
  stepOrder: number | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const PAGE_SIZE = 25;

const STAGE_TONE: Record<string, string> = {
  replied: 'bg-cyan-500/15 text-cyan-300 border-cyan-400/30',
  clicked: 'bg-violet-500/15 text-violet-300 border-violet-400/30',
  opened: 'bg-blue-500/15 text-blue-300 border-blue-400/30',
  delivered: 'bg-emerald-500/15 text-emerald-300 border-emerald-400/30',
  sent: 'bg-neutral-700/40 text-neutral-300 border-neutral-600/40',
  bounced: 'bg-red-500/15 text-red-300 border-red-400/30',
  queued: 'bg-neutral-800/60 text-neutral-400 border-neutral-700/40',
};

function fmtTime(iso: string | null): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

function stageTimestamp(row: RecipientRow): string {
  const s = row.stages;
  const last = row.last_stage;
  if (last === 'replied') return fmtTime(s.replied_at);
  if (last === 'clicked') return fmtTime(s.clicked_at);
  if (last === 'opened') return fmtTime(s.opened_at);
  if (last === 'bounced') return fmtTime(s.bounced_at);
  if (last === 'delivered') return fmtTime(s.delivered_at);
  if (last === 'sent') return fmtTime(s.sent_at);
  return '—';
}

export function RecipientDrilldown({ campaignId, stepOrder, open, onOpenChange }: Props) {
  const [rows, setRows] = useState<RecipientRow[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({
      slice: 'by-recipient',
      limit: String(PAGE_SIZE),
      offset: String(offset),
    });
    if (stepOrder != null) params.set('step_order', String(stepOrder));

    apiFetch<RecipientResponse>(`/api/campaigns/${campaignId}/analytics?${params.toString()}`)
      .then((res) => {
        if (cancelled) return;
        if (res.data) {
          setRows(res.data.recipients ?? []);
          setTotal(res.data.total ?? 0);
        } else {
          setError(res.error ?? 'Failed to load recipients');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, campaignId, stepOrder, offset]);

  // Reset pagination when the step filter changes.
  useEffect(() => {
    setOffset(0);
  }, [stepOrder, open]);

  const pageStart = total === 0 ? 0 : offset + 1;
  const pageEnd = Math.min(offset + PAGE_SIZE, total);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="sm:max-w-2xl w-full overflow-y-auto bg-neutral-950 border-white/[0.06]">
        <SheetHeader>
          <SheetTitle className="text-white">
            Recipients{stepOrder != null ? ` — Step ${stepOrder}` : ''}
          </SheetTitle>
          <SheetDescription className="text-neutral-400">
            {total > 0
              ? `Showing ${pageStart}–${pageEnd} of ${total}`
              : 'Per-recipient view — last stage reached and stage timestamps.'}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-3">
          {loading && (
            <div className="flex items-center justify-center py-12 text-neutral-500">
              <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading…
            </div>
          )}

          {error && !loading && (
            <div className="text-sm text-red-400 py-4">{error}</div>
          )}

          {!loading && !error && rows.length === 0 && (
            <div className="text-sm text-neutral-500 text-center py-8">
              No recipients in this bucket yet.
            </div>
          )}

          {!loading && rows.length > 0 && (
            <ul className="divide-y divide-white/[0.04]">
              {rows.map((row) => {
                const tone = STAGE_TONE[row.last_stage] || STAGE_TONE.queued;
                const hasReply = row.stages.replied_at != null
                  || row.stages.reply_received_at != null;
                return (
                  <li key={row.target_id} className="py-3 flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-white font-medium truncate">
                          {row.target_name || row.target_email || '—'}
                        </span>
                        <Badge variant="outline" className={`text-[10px] ${tone}`}>
                          {row.last_stage}
                        </Badge>
                      </div>
                      {row.target_name && row.target_email && (
                        <div className="text-xs text-neutral-500 truncate">{row.target_email}</div>
                      )}
                      <div className="text-xs text-neutral-500 mt-1">
                        {stageTimestamp(row)}
                        {row.stages.parsed_intent && (
                          <span className="ml-2 text-neutral-400">
                            · {row.stages.parsed_intent.replace('_', ' ')}
                          </span>
                        )}
                      </div>
                    </div>
                    {hasReply && (
                      <Link
                        to="/app/inbox"
                        className="shrink-0 text-xs text-cyan-300 hover:text-cyan-200 inline-flex items-center gap-1"
                      >
                        <MessageSquare className="h-3 w-3" /> Inbox
                      </Link>
                    )}
                  </li>
                );
              })}
            </ul>
          )}

          {total > PAGE_SIZE && (
            <div className="flex items-center justify-between pt-4 border-t border-white/[0.04]">
              <Button
                variant="ghost"
                size="sm"
                disabled={offset === 0 || loading}
                onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
                className="gap-1"
              >
                <ChevronLeft className="h-4 w-4" /> Prev
              </Button>
              <div className="text-xs text-neutral-500">
                {pageStart}–{pageEnd} of {total}
              </div>
              <Button
                variant="ghost"
                size="sm"
                disabled={offset + PAGE_SIZE >= total || loading}
                onClick={() => setOffset(offset + PAGE_SIZE)}
                className="gap-1"
              >
                Next <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

export default RecipientDrilldown;
