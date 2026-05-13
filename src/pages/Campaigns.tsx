import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { DashboardNav } from '@/components/DashboardNav';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Megaphone, Plus, Send, MessageSquare, Calendar, Loader2 } from 'lucide-react';
import { useFeatureFlag } from '@/hooks/useFeatureFlag';
import { apiFetch } from '@/lib/api-client';
import { CampaignBuilder } from '@/components/campaigns/CampaignBuilder';
import type { CampaignSummary } from '@/components/campaigns/types';
import { toast } from 'sonner';

interface CampaignRow {
  id: string;
  name: string;
  status: CampaignSummary['status'] | 'running' | 'cancelled';
  audience_count: number;
  sent_count: number;
  replied_count: number;
  bounced_count: number;
  created_at: string;
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

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return iso;
  }
}

export default function Campaigns() {
  const { enabled, loading: flagLoading } = useFeatureFlag('email-campaigns-v2');
  const [campaigns, setCampaigns] = useState<CampaignRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showBuilder, setShowBuilder] = useState(false);

  const loadCampaigns = async () => {
    setLoading(true);
    const res = await apiFetch<{ campaigns: CampaignRow[] }>('/api/campaigns');
    if (res.data?.campaigns) {
      setCampaigns(res.data.campaigns);
    } else if (res.error) {
      // Flag-off path returns 404 — silently leave list empty rather than toast.
      // Anything else is worth surfacing.
      if (res.error !== 'Not found') {
        toast.error(res.error);
      }
    }
    setLoading(false);
  };

  useEffect(() => {
    if (enabled) {
      void loadCampaigns();
    }
  }, [enabled]);

  if (flagLoading) return null;
  if (!enabled) return <Navigate to="/app" replace />;

  return (
    <div className="min-h-screen bg-[#08090a] text-white font-sans">
      <DashboardNav />
      <main className="container mx-auto mobile-padding pt-24 pb-16 space-y-10">
        <section className="text-center space-y-4 max-w-2xl mx-auto animate-fade-in">
          <h1 className="text-3xl md:text-4xl font-medium tracking-tight text-white">Outreach Campaigns</h1>
          <p className="text-lg text-neutral-400 font-light leading-relaxed">
            Bulk send sequences to buyers, agents, or imported lists — flag-gated dogfood.
          </p>
        </section>

        <section className="max-w-6xl mx-auto animate-fade-in">
          <div className="flex items-center justify-between mb-6">
            <div className="text-sm text-neutral-400">
              {loading ? 'Loading…' : `${campaigns.length} campaign${campaigns.length === 1 ? '' : 's'}`}
            </div>
            <Button onClick={() => setShowBuilder(true)} className="gap-2">
              <Plus className="h-4 w-4" />
              New Campaign
            </Button>
          </div>

          {loading && (
            <div className="flex items-center justify-center py-12 text-neutral-500">
              <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading campaigns…
            </div>
          )}

          {!loading && campaigns.length === 0 && (
            <Card className="border-border/40 bg-neutral-950/40">
              <CardContent className="p-10 text-center space-y-4">
                <div className="mx-auto h-12 w-12 rounded-full bg-neutral-800/50 flex items-center justify-center">
                  <Megaphone className="h-6 w-6 text-neutral-500" />
                </div>
                <div>
                  <p className="text-base font-medium">No campaigns yet</p>
                  <p className="text-sm text-neutral-500 mt-1">
                    Spin up your first outreach campaign — buyers, agents, or a CSV.
                  </p>
                </div>
                <Button onClick={() => setShowBuilder(true)} className="gap-2">
                  <Plus className="h-4 w-4" />
                  New Campaign
                </Button>
              </CardContent>
            </Card>
          )}

          {!loading && campaigns.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {campaigns.map((c) => {
                const badge = STATUS_BADGE[c.status] || STATUS_BADGE.draft;
                return (
                  <Card key={c.id} className="border-border/40 bg-neutral-950/40 hover:border-primary/30 transition-colors">
                    <CardContent className="p-5 space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="text-sm font-medium text-white line-clamp-2">{c.name}</h3>
                        <Badge variant="outline" className={`text-[10px] ${badge.tone}`}>
                          {badge.label}
                        </Badge>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-xs">
                        <div>
                          <div className="text-neutral-500">Audience</div>
                          <div className="text-white font-medium">{c.audience_count ?? 0}</div>
                        </div>
                        <div>
                          <div className="text-neutral-500 flex items-center gap-1">
                            <Send className="h-3 w-3" /> Sent
                          </div>
                          <div className="text-white font-medium">{c.sent_count ?? 0}</div>
                        </div>
                        <div>
                          <div className="text-neutral-500 flex items-center gap-1">
                            <MessageSquare className="h-3 w-3" /> Replies
                          </div>
                          <div className="text-white font-medium">{c.replied_count ?? 0}</div>
                        </div>
                      </div>
                      <div className="flex items-center justify-between text-xs text-neutral-500 pt-2 border-t border-white/[0.04]">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {formatDate(c.created_at)}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </section>
      </main>

      <CampaignBuilder
        open={showBuilder}
        onOpenChange={setShowBuilder}
        onLaunched={() => {
          setShowBuilder(false);
          void loadCampaigns();
        }}
      />
    </div>
  );
}
