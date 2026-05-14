import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  IconMail,
  IconCalendar,
  IconCode,
  IconFileText,
  IconExternalLink,
  IconMailOpened,
  IconBan,
  IconUser,
} from '@tabler/icons-react';
import {
  type InboxReplyDetail,
  INTENT_LABEL,
  INTENT_BADGE_CLASS,
} from './types';

interface ReplyDetailProps {
  reply: InboxReplyDetail;
  onToggleRead: () => void;
  onSuppress: () => void;
  suppressing: boolean;
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const date = new Date(iso);
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function ReplyDetail({
  reply,
  onToggleRead,
  onSuppress,
  suppressing,
}: ReplyDetailProps) {
  const [view, setView] = useState<'text' | 'html'>('text');
  const isUnread = !reply.read_at;
  const hasHtml = Boolean(reply.body_html && reply.body_html.length > 0);
  const canSuppress = reply.parsed_intent !== 'unsubscribe';

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-b border-white/[0.06] p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-medium tracking-tight text-white">
              {reply.subject || '(no subject)'}
            </h2>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-[12px] text-neutral-400">
              <span className="inline-flex items-center gap-1.5">
                <IconUser className="size-3.5 text-neutral-500" />
                <span className="text-neutral-200">{reply.from_address}</span>
              </span>
              {reply.to_address && (
                <span className="inline-flex items-center gap-1.5">
                  <IconMail className="size-3.5 text-neutral-500" />
                  to {reply.to_address}
                </span>
              )}
              <span className="inline-flex items-center gap-1.5">
                <IconCalendar className="size-3.5 text-neutral-500" />
                {formatDate(reply.received_at)}
              </span>
            </div>
          </div>
          <span
            className={`shrink-0 inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${
              INTENT_BADGE_CLASS[reply.parsed_intent]
            }`}
          >
            {INTENT_LABEL[reply.parsed_intent]}
          </span>
        </div>

        {/* Action buttons */}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {reply.lead_sequence_id && (
            <Link
              to={`/app/campaigns/${reply.lead_sequence_id}`}
              className="inline-flex items-center gap-1.5 rounded-md border border-white/[0.06] bg-white/[0.02] px-2.5 py-1.5 text-[12px] text-neutral-300 transition-colors hover:border-cyan-500/40 hover:text-white"
            >
              <IconExternalLink className="size-3.5" />
              View campaign
              {reply.campaign_name && (
                <span className="text-neutral-500">
                  — {reply.campaign_name}
                </span>
              )}
            </Link>
          )}
          <button
            type="button"
            onClick={onToggleRead}
            className="inline-flex items-center gap-1.5 rounded-md border border-white/[0.06] bg-white/[0.02] px-2.5 py-1.5 text-[12px] text-neutral-300 transition-colors hover:border-white/[0.12] hover:text-white"
          >
            <IconMailOpened className="size-3.5" />
            {isUnread ? 'Mark read' : 'Mark unread'}
          </button>
          {canSuppress && (
            <button
              type="button"
              onClick={onSuppress}
              disabled={suppressing}
              className="inline-flex items-center gap-1.5 rounded-md border border-white/[0.06] bg-white/[0.02] px-2.5 py-1.5 text-[12px] text-neutral-300 transition-colors hover:border-rose-500/30 hover:text-rose-300 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <IconBan className="size-3.5" />
              {suppressing ? 'Adding...' : 'Add to suppression'}
            </button>
          )}
        </div>
      </div>

      {/* Original message context */}
      {(reply.original_subject || reply.original_sent_at) && (
        <div className="border-b border-white/[0.06] bg-white/[0.01] px-5 py-3">
          <div className="text-[11px] uppercase tracking-wide text-neutral-500">
            In reply to
          </div>
          <div className="mt-1 flex items-center justify-between gap-3">
            <span className="truncate text-[13px] text-neutral-300">
              {reply.original_subject || '(no subject)'}
            </span>
            <span className="shrink-0 text-[11px] text-neutral-500">
              sent {formatDate(reply.original_sent_at)}
            </span>
          </div>
        </div>
      )}

      {/* Body */}
      <div className="flex-1 overflow-auto">
        {hasHtml && (
          <div className="flex items-center gap-1 border-b border-white/[0.06] px-5 py-2">
            <button
              type="button"
              onClick={() => setView('text')}
              className={`inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] transition-colors ${
                view === 'text'
                  ? 'bg-white/[0.06] text-white'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              <IconFileText className="size-3.5" />
              Text
            </button>
            <button
              type="button"
              onClick={() => setView('html')}
              className={`inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] transition-colors ${
                view === 'html'
                  ? 'bg-white/[0.06] text-white'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              <IconCode className="size-3.5" />
              HTML
            </button>
          </div>
        )}
        <div className="p-5">
          {view === 'text' || !hasHtml ? (
            <pre className="whitespace-pre-wrap break-words font-mono text-[13px] leading-relaxed text-neutral-200">
              {reply.body_text || '(empty)'}
            </pre>
          ) : (
            // Sandboxed iframe — never render raw HTML straight into the DOM
            // (XSS risk). srcDoc + sandbox isolates the message body.
            <iframe
              title="Reply body (HTML)"
              srcDoc={reply.body_html ?? ''}
              sandbox=""
              className="h-[60vh] w-full rounded-md border border-white/[0.06] bg-white"
            />
          )}
        </div>
      </div>
    </div>
  );
}
