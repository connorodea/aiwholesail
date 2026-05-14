/**
 * PostHog server-side wrapper.
 *
 * Singleton client used by signup, Stripe webhooks, and any other backend
 * path that needs to emit identified or alias'd events. When POSTHOG_KEY
 * isn't set the module exports stubs so the rest of the codebase never
 * has to check for an env var before capturing.
 *
 * Spec ref: phase 5 of posthog-analytics-spec.json
 *
 * Mirrors every capture into the local analytics_events audit table so we
 * have a queryable record without hitting PostHog's API — useful for
 * incident triage if PostHog is unreachable, and for cross-referencing
 * against DB state in the funnel-metrics digest cron.
 */

const { query } = require('../config/database');

const KEY = process.env.POSTHOG_KEY;
const HOST = process.env.POSTHOG_HOST || 'https://us.i.posthog.com';

let client = null;

function getClient() {
  if (!KEY) return null;
  if (client) return client;
  try {
    const { PostHog } = require('posthog-node');
    client = new PostHog(KEY, {
      host: HOST,
      flushAt: 20,
      flushInterval: 10000,
    });
  } catch (err) {
    console.warn('[PostHog] failed to init:', err.message);
    client = null;
  }
  return client;
}

/**
 * Emit one event. distinctId should be either the authenticated user.id
 * (post-signup) or the anonymous posthog_distinct_id captured at signup
 * time (pre-identification flows like guest checkout webhooks where the
 * Stripe customer ties back to a user_id).
 */
async function captureServer(distinctId, event, properties = {}, opts = {}) {
  // Local audit log first — survives PostHog outages
  try {
    await query(
      `INSERT INTO analytics_events (user_id, distinct_id, event_name, properties, source)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        opts.userId || null,
        distinctId || null,
        event,
        properties ? JSON.stringify(properties) : null,
        opts.source || 'backend',
      ]
    );
  } catch (err) {
    // Don't let an audit-log write failure block PostHog send
    console.warn('[PostHog] analytics_events insert failed:', err.message);
  }

  const c = getClient();
  if (!c) return; // no key configured — local audit is enough
  if (!distinctId) {
    console.warn(`[PostHog] capture('${event}') skipped — no distinctId`);
    return;
  }
  try {
    c.capture({ distinctId, event, properties });
  } catch (err) {
    console.warn(`[PostHog] capture('${event}') failed:`, err.message);
  }
}

/**
 * Link an anonymous PostHog session (distinct_id from the browser before
 * signup) to the now-identified user.id. Critical so pre-signup session
 * recordings + autocapture pageviews tie to the user we just created.
 */
async function aliasServer(userId, distinctId) {
  const c = getClient();
  if (!c || !userId || !distinctId) return;
  try {
    c.alias({ distinctId, alias: userId });
  } catch (err) {
    console.warn('[PostHog] alias failed:', err.message);
  }
}

/**
 * Set or update person properties (used on identified user state changes,
 * e.g. trial → paid, plan upgrades).
 */
async function identifyServer(userId, properties = {}) {
  const c = getClient();
  if (!c || !userId) return;
  try {
    c.identify({ distinctId: userId, properties });
  } catch (err) {
    console.warn('[PostHog] identify failed:', err.message);
  }
}

/**
 * Flush pending events. Called on Express SIGTERM / SIGINT so we don't
 * drop the last few captures on graceful shutdown.
 */
async function shutdownAnalytics() {
  const c = getClient();
  if (!c) return;
  try { await c.shutdown(); } catch { /* swallow */ }
}

module.exports = { captureServer, aliasServer, identifyServer, shutdownAnalytics };
