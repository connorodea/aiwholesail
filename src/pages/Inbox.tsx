import { useCallback, useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import {
  IconInbox,
  IconRefresh,
  IconArrowLeft,
} from '@tabler/icons-react';
import { toast } from 'sonner';
import { DashboardNav } from '@/components/DashboardNav';
import { ChatAssistant } from '@/components/ChatAssistant';
import { ReplyCard } from '@/components/inbox/ReplyCard';
import { ReplyDetail } from '@/components/inbox/ReplyDetail';
import {
  type InboxReplySummary,
  type InboxReplyDetail,
  type IntentFilter,
  INTENT_LABEL,
} from '@/components/inbox/types';
import { useFeatureFlag } from '@/hooks/useFeatureFlag';
import { apiFetch } from '@/lib/api-client';

interface InboxListResponse {
  replies: InboxReplySummary[];
  total?: number;
}

const FILTER_OPTIONS: Array<{ value: IntentFilter; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'interested', label: INTENT_LABEL.interested },
  { value: 'not_interested', label: INTENT_LABEL.not_interested },
  { value: 'unsubscribe', label: INTENT_LABEL.unsubscribe },
  { value: 'bounce_message', label: 'Bounces' },
  { value: 'unread', label: 'Unread' },
];

export default function Inbox() {
  const { enabled, loading: flagLoading } = useFeatureFlag('email-campaigns-v2');

  const [replies, setReplies] = useState<InboxReplySummary[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [flagOff404, setFlagOff404] = useState(false);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<InboxReplyDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const [filter, setFilter] = useState<IntentFilter>('all');
  const [suppressing, setSuppressing] = useState(false);

  const fetchList = useCallback(async () => {
    setListLoading(true);
    setListError(null);
    const res = await apiFetch<InboxListResponse>('/api/inbox');
    if (res.error) {
      // 404 = endpoint missing (flag off server-side or API not deployed yet).
      // Surface as a friendly toast + bounce home rather than a stuck spinner.
      if (/not.found|404/i.test(res.error)) {
        setFlagOff404(true);
        toast.error('Inbox is not available yet');
      } else {
        setListError(res.error);
      }
      setListLoading(false);
      return;
    }
    const items = res.data?.replies ?? [];
    setReplies(items);
    setListLoading(false);
    // Auto-select the first reply if nothing selected yet
    if (!selectedId && items.length > 0) {
      setSelectedId(items[0].id);
    }
  }, [selectedId]);

  // Initial fetch — only once the flag is loaded and enabled.
  useEffect(() => {
    if (flagLoading || !enabled) return;
    fetchList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flagLoading, enabled]);

  // Fetch detail + mark read when the selection changes.
  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      return;
    }
    let cancelled = false;
    (async () => {
      setDetailLoading(true);
      const res = await apiFetch<InboxReplyDetail>(`/api/inbox/${selectedId}`);
      if (cancelled) return;
      if (res.error) {
        if (/not.found|404/i.test(res.error)) {
          setFlagOff404(true);
          toast.error('This reply is no longer available');
        } else {
          toast.error(res.error);
        }
        setDetailLoading(false);
        return;
      }
      if (res.data) {
        setDetail(res.data);
        // Fire-and-forget mark-read for unread items. UI flips immediately.
        if (!res.data.read_at) {
          const now = new Date().toISOString();
          setDetail((prev) => (prev ? { ...prev, read_at: now } : prev));
          setReplies((prev) =>
            prev.map((r) => (r.id === res.data!.id ? { ...r, read_at: now } : r)),
          );
          apiFetch(`/api/inbox/${selectedId}/mark-read`, { method: 'POST' }).catch(
            () => {
              // Non-fatal — the row will reconcile on next fetch.
            },
          );
        }
      }
      setDetailLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  const filtered = useMemo(() => {
    if (filter === 'all') return replies;
    if (filter === 'unread') return replies.filter((r) => !r.read_at);
    return replies.filter((r) => r.parsed_intent === filter);
  }, [replies, filter]);

  const unreadCount = useMemo(
    () => replies.filter((r) => !r.read_at).length,
    [replies],
  );

  const handleToggleRead = useCallback(async () => {
    if (!detail) return;
    const wasUnread = !detail.read_at;
    const now = new Date().toISOString();
    // Optimistic flip — backend currently only supports mark-read. Toggling
    // back to unread is a UI-only convenience until POST /unread ships.
    const nextReadAt = wasUnread ? now : null;
    setDetail((prev) => (prev ? { ...prev, read_at: nextReadAt } : prev));
    setReplies((prev) =>
      prev.map((r) => (r.id === detail.id ? { ...r, read_at: nextReadAt } : r)),
    );
    if (wasUnread) {
      const res = await apiFetch(`/api/inbox/${detail.id}/mark-read`, {
        method: 'POST',
      });
      if (res.error) {
        toast.error('Failed to mark as read');
      }
    }
  }, [detail]);

  const handleSuppress = useCallback(async () => {
    if (!detail) return;
    setSuppressing(true);
    const res = await apiFetch('/api/suppression', {
      method: 'POST',
      body: JSON.stringify({
        email: detail.from_address,
        reason: 'manual_inbox',
      }),
    });
    setSuppressing(false);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    toast.success(`Added ${detail.from_address} to suppression list`);
  }, [detail]);

  // Flag-off cases — render nothing while loading, redirect once we know.
  if (flagLoading) return null;
  if (!enabled || flagOff404) return <Navigate to="/app" replace />;

  return (
    <div className="min-h-screen bg-[#08090a] text-white font-sans">
      <DashboardNav />
      <main className="container mx-auto mobile-padding pt-24 pb-16">
        <section className="mb-6 flex items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-medium tracking-tight text-white md:text-4xl">
              Inbox
            </h1>
            <p className="mt-1 text-sm text-neutral-400">
              Inbound replies from your outreach campaigns
              {unreadCount > 0 && (
                <span className="ml-2 inline-flex items-center rounded-full bg-cyan-500/10 px-2 py-0.5 text-[11px] font-medium text-cyan-400">
                  {unreadCount} unread
                </span>
              )}
            </p>
          </div>
          <button
            type="button"
            onClick={fetchList}
            disabled={listLoading}
            className="inline-flex items-center gap-1.5 rounded-md border border-white/[0.06] bg-white/[0.02] px-2.5 py-1.5 text-[12px] text-neutral-300 transition-colors hover:border-white/[0.12] hover:text-white disabled:opacity-50"
          >
            <IconRefresh
              className={`size-3.5 ${listLoading ? 'animate-spin' : ''}`}
            />
            Refresh
          </button>
        </section>

        {/* Filter chips */}
        <div className="mb-4 flex flex-wrap items-center gap-1.5">
          {FILTER_OPTIONS.map((opt) => {
            const active = filter === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => setFilter(opt.value)}
                className={`rounded-full border px-3 py-1 text-[12px] transition-colors ${
                  active
                    ? 'border-cyan-500/40 bg-cyan-500/10 text-cyan-300'
                    : 'border-white/[0.06] bg-white/[0.02] text-neutral-400 hover:border-white/[0.12] hover:text-white'
                }`}
              >
                {opt.label}
                {opt.value === 'unread' && unreadCount > 0 && (
                  <span className="ml-1 text-cyan-400">({unreadCount})</span>
                )}
              </button>
            );
          })}
        </div>

        {/* Two-column layout */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-[minmax(280px,360px)_1fr]">
          {/* Left rail */}
          <aside
            className={`rounded-xl border border-white/[0.06] bg-neutral-950/40 ${
              selectedId ? 'hidden md:block' : 'block'
            }`}
          >
            <div className="max-h-[calc(100vh-280px)] overflow-auto p-2">
              {listLoading && replies.length === 0 ? (
                <div className="space-y-2 p-2">
                  {[0, 1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className="h-20 animate-pulse rounded-lg border border-white/[0.04] bg-white/[0.02]"
                    />
                  ))}
                </div>
              ) : listError ? (
                <div className="p-6 text-center text-sm text-rose-400">
                  {listError}
                </div>
              ) : filtered.length === 0 ? (
                <EmptyState filter={filter} totalReplies={replies.length} />
              ) : (
                <div className="space-y-1">
                  {filtered.map((reply) => (
                    <ReplyCard
                      key={reply.id}
                      reply={reply}
                      selected={selectedId === reply.id}
                      onClick={() => setSelectedId(reply.id)}
                    />
                  ))}
                </div>
              )}
            </div>
          </aside>

          {/* Right pane */}
          <section
            className={`rounded-xl border border-white/[0.06] bg-neutral-950/40 ${
              selectedId ? 'block' : 'hidden md:block'
            }`}
          >
            {/* Mobile back button when a reply is open */}
            {selectedId && (
              <button
                type="button"
                onClick={() => setSelectedId(null)}
                className="flex items-center gap-1.5 border-b border-white/[0.06] px-4 py-2 text-[12px] text-neutral-400 hover:text-white md:hidden"
              >
                <IconArrowLeft className="size-3.5" />
                Back to inbox
              </button>
            )}

            {detailLoading && !detail ? (
              <div className="flex h-full min-h-[400px] items-center justify-center text-sm text-neutral-500">
                Loading reply...
              </div>
            ) : detail ? (
              <ReplyDetail
                reply={detail}
                onToggleRead={handleToggleRead}
                onSuppress={handleSuppress}
                suppressing={suppressing}
              />
            ) : (
              <div className="flex h-full min-h-[400px] items-center justify-center p-8 text-center">
                <div className="max-w-sm text-neutral-500">
                  <IconInbox className="mx-auto mb-3 size-8 text-neutral-700" />
                  <p className="text-sm">
                    Select a reply on the left to view the full message.
                  </p>
                </div>
              </div>
            )}
          </section>
        </div>
      </main>
      <ChatAssistant />
    </div>
  );
}

function EmptyState({
  filter,
  totalReplies,
}: {
  filter: IntentFilter;
  totalReplies: number;
}) {
  // If we have replies but the filter hid them, hint that.
  if (totalReplies > 0) {
    return (
      <div className="p-8 text-center">
        <p className="text-sm text-neutral-400">
          No replies match the &ldquo;
          {FILTER_OPTIONS.find((o) => o.value === filter)?.label}&rdquo; filter.
        </p>
      </div>
    );
  }
  return (
    <div className="px-6 py-10 text-center">
      <IconInbox className="mx-auto mb-3 size-8 text-neutral-700" />
      <p className="text-sm font-medium text-neutral-300">No replies yet</p>
      <p className="mt-2 text-[12px] leading-relaxed text-neutral-500">
        Once your outreach sequences start sending email, inbound replies will
        land here so you can triage interested leads, suppress
        unsubscribes, and surface bounces — all without leaving the app.
      </p>
    </div>
  );
}
