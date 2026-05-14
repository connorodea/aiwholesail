import { type InboxReplySummary, INTENT_LABEL, INTENT_BADGE_CLASS } from './types';

interface ReplyCardProps {
  reply: InboxReplySummary;
  selected: boolean;
  onClick: () => void;
}

function relativeTime(iso: string): string {
  const date = new Date(iso);
  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.round(diffMs / 60000);
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h`;
  const diffDay = Math.round(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d`;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function snippet(text: string, max = 110): string {
  const clean = (text || '').replace(/\s+/g, ' ').trim();
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max).trim()}...`;
}

export function ReplyCard({ reply, selected, onClick }: ReplyCardProps) {
  const isUnread = !reply.read_at;
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group w-full text-left rounded-lg border px-3 py-3 transition-all duration-150 ${
        selected
          ? 'border-cyan-500/40 bg-cyan-500/[0.04]'
          : 'border-white/[0.06] hover:border-white/[0.12] hover:bg-white/[0.02]'
      }`}
    >
      <div className="flex items-start gap-2">
        {isUnread && (
          <span
            className="mt-1.5 size-2 shrink-0 rounded-full bg-cyan-400"
            aria-label="Unread"
          />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <span
              className={`truncate text-[13px] ${
                isUnread ? 'font-semibold text-white' : 'font-normal text-neutral-300'
              }`}
            >
              {reply.from_address}
            </span>
            <span className="shrink-0 text-[11px] text-neutral-500">
              {relativeTime(reply.received_at)}
            </span>
          </div>
          <div
            className={`mt-0.5 truncate text-[13px] ${
              isUnread ? 'font-medium text-white' : 'text-neutral-400'
            }`}
          >
            {reply.subject || '(no subject)'}
          </div>
          <div className="mt-1 line-clamp-2 text-[12px] leading-snug text-neutral-500">
            {snippet(reply.body_text)}
          </div>
          <div className="mt-2 flex items-center gap-1.5">
            <span
              className={`inline-flex items-center rounded-full border px-1.5 py-0.5 text-[10px] font-medium ${
                INTENT_BADGE_CLASS[reply.parsed_intent]
              }`}
            >
              {INTENT_LABEL[reply.parsed_intent]}
            </span>
            {reply.campaign_name && (
              <span className="truncate rounded-full border border-white/[0.06] bg-white/[0.02] px-1.5 py-0.5 text-[10px] text-neutral-400">
                {reply.campaign_name}
              </span>
            )}
            {reply.thread_count > 1 && (
              <span className="rounded-full bg-white/[0.04] px-1.5 py-0.5 text-[10px] text-neutral-400">
                {reply.thread_count} in thread
              </span>
            )}
          </div>
        </div>
      </div>
    </button>
  );
}
