/**
 * User events — server-side activation tracking.
 *
 * One file is the canonical vocabulary for event types. Routes call
 * `logEvent(userId, EVENTS.X, props)` so we don't have stringly-typed
 * event names scattered across the codebase.
 *
 * Design notes:
 * - Fire-and-forget: the helper never throws or blocks the request.
 *   If the events table is unavailable, the user request still succeeds
 *   and we lose the event (preferred over 500-ing the user).
 * - No props leakage: callers should pass only structured, non-PII fields
 *   (city, zpid, tier, score). Don't dump full request bodies.
 * - Schema: see migrations/008_user_events.sql.
 */

const { query } = require('../config/database');

const EVENTS = Object.freeze({
  // Core search / discovery
  PROPERTY_SEARCH: 'property_search',           // user ran a market search
  PROPERTY_VIEWED: 'property_viewed',           // opened the modal / details page
  // Analysis
  AI_RANK_DEALS: 'ai_rank_deals',               // ranked search results with AI
  AI_RANK_COMPS: 'ai_rank_comps',               // top-6 ranked comps for ARV (Phase 1.1)
  AI_ANALYZER_RUN: 'ai_analyzer_run',           // wholesale analyzer ran
  AI_PROPERTY_ANALYSIS: 'ai_property_analysis', // single-property deep dive
  PHOTO_ANALYSIS: 'photo_analysis',             // AI photo / damage detection
  BUYER_PITCH_PDF: 'buyer_pitch_pdf',           // generated branded buyer pitch
  AI_LISTING_DESC: 'ai_listing_description',    // generated AI listing/marketing copy (Phase 1.5)
  // Premium feature touches (also tracked in their dedicated tables, but
  // mirroring here gives the hot-list ONE source to query)
  SKIP_TRACE_USED: 'skip_trace_used',
  CONTRACT_GENERATED: 'contract_generated',
  // Onboarding milestones — emit once per user the FIRST time it happens
  FIRST_SEARCH: 'first_search',
  FIRST_PROPERTY_VIEW: 'first_property_view',
  FIRST_FAVORITE: 'first_favorite',
});

/**
 * Log a user event. Fire-and-forget — never throws, never blocks the request.
 *
 * @param {string|null} userId  null/undefined = anonymous, skip
 * @param {string}      eventType  one of EVENTS.*
 * @param {object}      [properties={}]  small JSON-serializable bag
 */
function logEvent(userId, eventType, properties = {}) {
  if (!userId) return;
  // Detached promise — caller doesn't await
  query(
    'INSERT INTO user_events (user_id, event_type, properties) VALUES ($1, $2, $3)',
    [userId, eventType, properties]
  ).catch((err) => {
    // Swallow — don't 500 the request because event logging hiccupped.
    // Log just the message, not the full error (avoids spamming journals
    // with stack traces for transient issues).
    console.error(`[events] failed to log ${eventType}: ${err.message}`);
  });
}

module.exports = { logEvent, EVENTS };
