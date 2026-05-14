/**
 * Reply intent classifier — turns an inbound email body into one of a small
 * set of intent labels used by the campaign engine.
 *
 * Extracted from routes/resend-webhooks.js so the regexes are unit-testable
 * without standing up Express + Postgres.
 *
 * Categories:
 *   'bounce_message'  — MTA delivery failure report (takes precedence over
 *                       all other categories so an "address not found" body
 *                       quoting an unsubscribe line doesn't mis-route).
 *   'unsubscribe'     — explicit opt-out request (stop / unsubscribe / remove me / opt-out / do not contact me).
 *   'not_interested'  — soft no (not interested / no thanks / wrong number / wrong person).
 *   'interested'      — affirmative signal (yes / let's talk / call me / cash offer / tell me more / I'm in).
 *   'unknown'         — anything we can't classify (including empty body).
 *
 * The fromAddress / headers arguments are reserved for future heuristics
 * (e.g. recognizing mailer-daemon@ in the From: line) — currently the
 * function classifies based on bodyText alone, matching pre-extraction
 * behavior.
 */

const UNSUBSCRIBE_RE = /\b(stop|unsubscribe|remove me|opt[- ]?out|do not contact)\b/i;
const NOT_INTERESTED_RE = /\b(no thanks|not interested|wrong number|wrong person)\b/i;
const INTERESTED_RE = /\b(yes|interested|let'?s talk|call me|how much|cash offer|tell me more|i'?m in)\b/i;
const BOUNCE_RE = /(mailer-daemon|delivery status notification|address not found|undeliverable|delivery has failed|message could not be delivered|550 5\.|recipient address rejected)/i;

function classifyReplyIntent(bodyText, _fromAddress, _headers) {
  if (!bodyText) return 'unknown';
  // Bounce indicators take precedence — they're often "Re:" replies but the
  // body is an MTA report, not a human response. Check bounce first.
  if (BOUNCE_RE.test(bodyText)) return 'bounce_message';
  if (UNSUBSCRIBE_RE.test(bodyText)) return 'unsubscribe';
  if (NOT_INTERESTED_RE.test(bodyText)) return 'not_interested';
  if (INTERESTED_RE.test(bodyText)) return 'interested';
  return 'unknown';
}

module.exports = { classifyReplyIntent };
