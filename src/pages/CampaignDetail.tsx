/**
 * CampaignDetail — Phase 5 campaign analytics dashboard.
 *
 * Layout:
 *   Header (name, status, audience, launched_at, sender, actions)
 *   ┌──────────────────────────────────┬─────────────────────┐
 *   │ Funnel chart                      │ Recent activity     │
 *   │ Step breakdown table              │                     │
 *   └──────────────────────────────────┴─────────────────────┘
 *
 * Flag-gated behind `email-campaigns-v2`. Clicking a step row opens the
 * RecipientDrilldown sheet filtered to that step.
 */

import { useEffect, useState } from 'react';
import { Navigate, useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { DashboardNav } from '@/components/DashboardNav';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  ArrowLeft,
  Calendar,
  Loader2,
  PauseCircle,
  PlayCircle,
  XCircle,
  Send,
  Users,
} from 'lucide-react';
import { useFeatureFlag } from '@/hooks/useFeatureFlag';
import { apiFetch } from '@/lib/api-client';
import { FunnelChart, type FunnelStage } from '@/components/campaigns/FunnelChart';
import {
  StepBreakdownTable,
  type StepRow,
} from '@/components/campaigns/StepBreakdownTable';
import { RecipientDrilldown } from '@/components/campaigns/RecipientDrilldown';
import { toast } from 'sonner';

interface OverallAnalytics {
  campaign: {
    id: string;
    name: string;
    status: string;
    audience_count: number;
    launched_at: string | null;
    completed_at: string | null;
    sender_category: string | null;
  };
  totals: {
    sent: number;
    delivered: number;
    opened: number;
    clicked: number;
    replied: number;
    interested: number;
    not_interested: number;
    unsubscribed: number;
    bounced: number;
    complained: number;
    audience_count: number;
  };
  rates: {
    delivery_rate: number;
    open_rate: number;
    click_rate: number;
    reply_rate: number;
    interested_rate: number;
    bounce_rate: number;
  };
}

interface ActivityRow {
  type: string;
  timestamp: string;
  recipient: string | null;
  summary: string;
  link: string | null;
}

const STATUS_BADGE: Record<string, { label: string; tone: string }> = {
  draft: { label: 'Draft', tone: 'bg-neutral-700/40 text-neutral-300 border-neutral-600/40' },
  scheduled: { label: 'Scheduled', tone: 'bg-blue-500/15 text-blue-300 border-blue-400/30' },
  running: { label: 'Running', tone: 'bg-emerald-500/15 text-emerald-300 border-emerald-400/30' },
  sending: { label: 'Sending', tone: 'bg-emerald-500/15 text-emerald-300 border-emerald-400/30' },
  paused: { label: 'Paused', tone: 'bg-amber-500/15 text-amber-300 border-amber-400/30' },
  completed: { label: 'Completed', tone: 'bg-violet-500/15 text-violet-300 border-violet-400/30' },
  cancelled: { label: 'Cancelled', tone: 'bg-red-500/15 text-red-300 border-red-400/30' },
};

function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return iso;
  }
}

function fmtPct(n: number): string {
  if (!Number.isFinite(n)) return '—';
  return `${(n * 100).toFixed(1)}%`;
}

function relativeTime(iso: string): string {
  try {
    const ms = Date.now() - new Date(iso).getTime();
    const min = Math.floor(ms / 60_000);
    if (min < 1) return 'just now';
    if (min < 60) return `${min}m ago`;
    const hr = Math.floor(min / 60);
    if (hr < 24) return `${hr}h ago`;
    const d = Math.floor(hr / 24);
    return `${d}d ago`;
  } catch {
    return iso;
  }
}

export default function CampaignDetail() {
  const { id } = useParams<{ id: string }>();
  const { enabled, loading: flagLoading } = useFeatureFlag('email-campaigns-v2');

  const [drilldownOpen, setDrilldownOpen] = useState(false);
  const [drilldownStep, setDrilldownStep] = useState<number | null>(null);

  const overallQuery = useQuery({
    queryKey: ['campaign-analytics', id, 'overall'],
    queryFn: async () => {
      const res = await apiFetch<OverallAnalytics>(
        `/api/campaigns/${id}/analytics?slice=overall`,
      );
      if (res.error) throw new Error(res.error);
      return res.data as OverallAnalytics;
    },
    enabled: Boolean(enabled && id),
    refetchInterval: 30_000,
  });

  const stepsQuery = useQuery({
    queryKey: ['campaign-analytics', id, 'by-step'],
    queryFn: async () => {
      const res = await apiFetch<{ steps: StepRow[] }>(
        `/api/campaigns/${id}/analytics?slice=by-step`,
      );
      if (res.error) throw new Error(res.error);
      return res.data?.steps ?? [];
    },
    enabled: Boolean(enabled && id),
    refetchInterval: 60_000,
  });

  const activityQuery = useQuery({
    queryKey: ['campaign-activity', id],
    queryFn: async () => {
      const res = await apiFetch<{ activity: ActivityRow[] }>(
        `/api/campaigns/${id}/activity?limit=20`,
      );
      if (res.error) throw new Error(res.error);
      return res.data?.activity ?? [];
    },
    enabled: Boolean(enabled && id),
    refetchInterval: 30_000,
  });

  // Surface fetch errors once per error change without spamming the toaster
  // on every refetchInterval tick.
  useEffect(() => {
    if (overallQuery.isError) toast.error(String(overallQuery.error));
  }, [overallQuery.isError, overallQuery.error]);

  if (flagLoading) return null;
  if (!enabled) return <Navigate to="/app" replace />;
  if (!id) return <Navigate to="/app/campaigns" replace />;

  const overall = overallQuery.data;
  const steps = stepsQuery.data ?? [];
  const activity = activityQuery.data ?? [];

  const funnelStages: FunnelStage[] = overall
    ? [
        { key: 'sent', label: 'Sent', count: overall.totals.sent, color: '#1e3a8a' },
        { key: 'delivered', label: 'Delivered', count: overall.totals.delivered, color: '#2563eb' },
        { key: 'opened', label: 'Opened', count: overall.totals.opened, color: '#0891b2' },
        { key: 'clicked', label: 'Clicked', count: overall.totals.clicked, color: '#0d9488' },
        { key: 'replied', label: 'Replied', count: overall.totals.replied, color: '#16a34a' },
        { key: 'interested', label: 'Interested', count: overall.totals.interested, color: '#22c55e' },
      ]
    : [];

  async function doAction(path: string, label: string) {
    if (!id) return;
    const res = await apiFetch(`/api/campaigns/${id}/${path}`, { method: 'POST' });
    if (res.error) {
      toast.error(res.error);
    } else {
      toast.success(`Campaign ${label}`);
      void overallQuery.refetch();
    }
  }

  const status = overall?.campaign.status ?? 'draft';
  const badge = STATUS_BADGE[status] ?? STATUS_BADGE.draft;
  const canPause = ['scheduled', 'running', 'sending'].includes(status);
  const canResume = status === 'paused';
  const canCancel = !['completed', 'cancelled'].includes(status);

  return (
    <div className="min-h-screen bg-[#08090a] text-white font-sans">
      <DashboardNav />
      <main className="container mx-auto mobile-padding pt-24 pb-16 space-y-6">
        <div className="flex items-center gap-2 text-sm text-neutral-400">
          <Link to="/app/campaigns" className="inline-flex items-center gap-1 hover:text-white transition">
            <ArrowLeft className="h-4 w-4" /> Campaigns
          </Link>
        </div>

        {/* Header */}
        <section className="space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1">
              <h1 className="text-2xl md:text-3xl font-medium tracking-tight text-white">
                {overall?.campaign.name ?? 'Campaign'}
              </h1>
              <div className="flex flex-wrap items-center gap-3 text-sm text-neutral-400">
                <Badge variant="outline" className={`text-[10px] ${badge.tone}`}>
                  {badge.label}
                </Badge>
                <span className="inline-flex items-center gap-1">
                  <Users className="h-3 w-3" /> {overall?.campaign.audience_count ?? 0} audience
                </span>
                <span className="inline-flex items-center gap-1">
                  <Calendar className="h-3 w-3" /> Launched {fmtDate(overall?.campaign.launched_at ?? null)}
                </span>
                {overall?.campaign.sender_category && (
                  <span className="inline-flex items-center gap-1">
                    <Send className="h-3 w-3" /> {overall.campaign.sender_category}
                  </span>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {canPause && (
                <Button variant="outline" size="sm" className="gap-1" onClick={() => doAction('pause', 'paused')}>
                  <PauseCircle className="h-4 w-4" /> Pause
                </Button>
              )}
              {canResume && (
                <Button variant="outline" size="sm" className="gap-1" onClick={() => doAction('resume', 'resumed')}>
                  <PlayCircle className="h-4 w-4" /> Resume
                </Button>
              )}
              {canCancel && (
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1 border-red-500/30 text-red-300 hover:text-red-200 hover:border-red-500/50"
                  onClick={() => doAction('cancel', 'cancelled')}
                >
                  <XCircle className="h-4 w-4" /> Cancel
                </Button>
              )}
            </div>
          </div>

          {/* Rate strip */}
          {overall && (
            <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
              <RateTile label="Delivery" value={fmtPct(overall.rates.delivery_rate)} subtle={`${overall.totals.delivered} / ${overall.totals.sent}`} />
              <RateTile label="Open" value={fmtPct(overall.rates.open_rate)} subtle={`${overall.totals.opened}`} />
              <RateTile label="Click" value={fmtPct(overall.rates.click_rate)} subtle={`${overall.totals.clicked}`} />
              <RateTile label="Reply" value={fmtPct(overall.rates.reply_rate)} subtle={`${overall.totals.replied}`} />
              <RateTile label="Interested" value={fmtPct(overall.rates.interested_rate)} subtle={`${overall.totals.interested}`} />
              <RateTile label="Bounce" value={fmtPct(overall.rates.bounce_rate)} subtle={`${overall.totals.bounced}`} />
            </div>
          )}
        </section>

        {/* Main grid: funnel + step table on the left, activity on the right */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Card className="border-border/40 bg-neutral-950/40">
              <CardContent className="p-5">
                <h2 className="text-sm font-medium text-white mb-4">Funnel</h2>
                {overallQuery.isLoading ? (
                  <div className="flex items-center justify-center py-12 text-neutral-500">
                    <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading…
                  </div>
                ) : (
                  <FunnelChart stages={funnelStages} />
                )}
              </CardContent>
            </Card>

            <Card className="border-border/40 bg-neutral-950/40">
              <CardContent className="p-5">
                <h2 className="text-sm font-medium text-white mb-4">Step breakdown</h2>
                {stepsQuery.isLoading ? (
                  <div className="flex items-center justify-center py-12 text-neutral-500">
                    <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading…
                  </div>
                ) : (
                  <StepBreakdownTable
                    steps={steps}
                    onRowClick={(step) => {
                      setDrilldownStep(step.step_order);
                      setDrilldownOpen(true);
                    }}
                  />
                )}
              </CardContent>
            </Card>
          </div>

          <div className="lg:col-span-1">
            <Card className="border-border/40 bg-neutral-950/40 lg:sticky lg:top-24">
              <CardContent className="p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-medium text-white">Recent activity</h2>
                  <button
                    type="button"
                    className="text-xs text-neutral-500 hover:text-neutral-300"
                    onClick={() => {
                      void activityQuery.refetch();
                    }}
                  >
                    Refresh
                  </button>
                </div>
                {activityQuery.isLoading && (
                  <div className="flex items-center justify-center py-6 text-neutral-500">
                    <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading…
                  </div>
                )}
                {!activityQuery.isLoading && activity.length === 0 && (
                  <p className="text-sm text-neutral-500 py-4 text-center">
                    No activity yet.
                  </p>
                )}
                {activity.length > 0 && (
                  <ul className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
                    {activity.map((row, i) => (
                      <li key={`${row.type}-${row.timestamp}-${i}`} className="text-xs space-y-0.5">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium uppercase tracking-wider text-neutral-400">
                            {row.type.replace('_', ' ')}
                          </span>
                          <span className="text-neutral-500">{relativeTime(row.timestamp)}</span>
                        </div>
                        <div className="text-white truncate">
                          {row.summary}
                          {row.recipient && <span className="text-neutral-400"> · {row.recipient}</span>}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>
        </section>

        <RecipientDrilldown
          campaignId={id}
          stepOrder={drilldownStep}
          open={drilldownOpen}
          onOpenChange={(o) => {
            setDrilldownOpen(o);
            if (!o) setDrilldownStep(null);
          }}
        />
      </main>
    </div>
  );
}

function RateTile({ label, value, subtle }: { label: string; value: string; subtle?: string }) {
  return (
    <div className="rounded-lg border border-white/[0.06] bg-neutral-950/40 px-3 py-2">
      <div className="text-[10px] uppercase tracking-wider text-neutral-500">{label}</div>
      <div className="text-lg font-medium text-white">{value}</div>
      {subtle && <div className="text-[10px] text-neutral-500">{subtle}</div>}
    </div>
  );
}
