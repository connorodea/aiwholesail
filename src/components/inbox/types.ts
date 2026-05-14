/**
 * Inbox types — mirror of /api/inbox shape from the peer agent's backend.
 * Keep these synced with aiwholesail-api/routes/inbox.js.
 */

export type ParsedIntent =
  | 'interested'
  | 'not_interested'
  | 'unsubscribe'
  | 'bounce_message'
  | 'unknown';

export interface InboxReplySummary {
  id: string;
  from_address: string;
  subject: string;
  parsed_intent: ParsedIntent;
  received_at: string;
  body_text: string; // first 500 chars on the list endpoint
  original_subject: string | null;
  original_sent_at: string | null;
  lead_sequence_id: string | null;
  campaign_name: string | null;
  thread_count: number;
  read_at: string | null;
}

export interface InboxReplyDetail extends InboxReplySummary {
  body_text: string; // full body on the detail endpoint
  body_html: string | null;
  to_address?: string | null;
}

export type IntentFilter =
  | 'all'
  | 'interested'
  | 'not_interested'
  | 'unsubscribe'
  | 'bounce_message'
  | 'unread';

export const INTENT_LABEL: Record<ParsedIntent, string> = {
  interested: 'Interested',
  not_interested: 'Not Interested',
  unsubscribe: 'Unsubscribed',
  bounce_message: 'Bounce',
  unknown: 'Unknown',
};

export const INTENT_BADGE_CLASS: Record<ParsedIntent, string> = {
  interested: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  not_interested: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
  unsubscribe: 'bg-neutral-500/10 text-neutral-300 border-neutral-500/20',
  bounce_message: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  unknown: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
};
