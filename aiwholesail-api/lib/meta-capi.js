/**
 * Meta Conversions API (CAPI) client.
 *
 * Sends server-side Purchase events to Meta when a Stripe subscription
 * converts trial → paid. This is the signal that lets Meta optimise ad
 * delivery for ACTUAL paid conversions instead of just trial starts —
 * 15-20 paid events flowing back per week is the rough threshold for
 * the algorithm to find paying audiences.
 *
 * Setup notes for ops:
 *   - META_PIXEL_ID:           same ID the client Pixel uses (env var)
 *   - META_CAPI_ACCESS_TOKEN:  CAPI-scoped token from Events Manager →
 *                              Settings → Conversions API → Generate
 *                              Access Token. Separate from the
 *                              META_ACCESS_TOKEN used by
 *                              daily-meta-ads-report.js (which is a
 *                              long-lived Marketing-API ads_read token).
 *   - Optional META_CAPI_TEST_EVENT_CODE: send events with `test_event_code`
 *                              so they appear in Events Manager → Test
 *                              Events but don't count for ads delivery.
 *
 * Deduplication with the client-side Pixel:
 *   - We pass `event_id` = Stripe event.id (always unique per webhook
 *     delivery). If you ALSO fire `fbq('track', 'Purchase', {...},
 *     {eventID: <same>})` client-side on the success page, Meta dedupes.
 *
 * Failure handling:
 *   - Calls are best-effort. A CAPI failure must NEVER fail the Stripe
 *     webhook (Stripe would retry and create duplicate-event noise).
 *     All errors are caught, logged, and swallowed by the caller.
 */

const { createHash } = require('node:crypto');

const META_API = 'https://graph.facebook.com/v21.0';

/** SHA-256 hash lowercase-trimmed value. Returns null for empty input. */
function hashPii(value) {
  if (!value || typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase();
  if (!normalized) return null;
  return createHash('sha256').update(normalized).digest('hex');
}

/**
 * Send a Purchase event to Meta CAPI. Best-effort: returns {ok, ...}
 * but never throws — webhook callers can fire-and-log without try/catch.
 *
 * @param {object} args
 * @param {string} args.email           Plain email — will be hashed.
 * @param {number} args.value           Dollar amount (e.g. 49.00).
 * @param {string} args.currency        ISO currency code (e.g. 'USD').
 * @param {string} args.eventId         Idempotency key — pass Stripe event.id.
 * @param {number} [args.eventTime]     Unix seconds. Defaults to now.
 * @param {string} [args.fbp]           _fbp cookie value if known.
 * @param {string} [args.fbc]           _fbc cookie value if known.
 * @param {string} [args.fbclid]        fbclid URL param (used to synthesise fbc if no cookie).
 * @param {string} [args.externalId]    Stripe customer id — strong match signal.
 * @param {string} [args.eventSourceUrl] Landing URL or success URL.
 * @param {string} [args.fullName]      Optional name for fn/ln hashing.
 * @param {string} [args.phone]         Optional phone for ph hashing.
 *
 * @returns {Promise<{ok: boolean, status?: number, error?: string, response?: any}>}
 */
async function sendPurchaseEvent(args) {
  const pixelId = process.env.META_PIXEL_ID;
  const token = process.env.META_CAPI_ACCESS_TOKEN;
  if (!pixelId || !token) {
    return { ok: false, error: 'META_PIXEL_ID or META_CAPI_ACCESS_TOKEN not set — skipping CAPI' };
  }

  const eventTime = args.eventTime || Math.floor(Date.now() / 1000);
  const userData = {};
  const em = hashPii(args.email);
  if (em) userData.em = [em];
  if (args.phone) {
    const ph = hashPii(String(args.phone).replace(/[^\d]/g, ''));
    if (ph) userData.ph = [ph];
  }
  if (args.fullName) {
    const parts = String(args.fullName).trim().split(/\s+/);
    const fn = hashPii(parts[0]);
    const ln = hashPii(parts.slice(1).join(' '));
    if (fn) userData.fn = [fn];
    if (ln) userData.ln = [ln];
  }
  if (args.fbp) userData.fbp = args.fbp;
  // fbc format expected by Meta: 'fb.1.<event_time_ms>.<fbclid>'
  // If fbc cookie present, use it. Else synthesise from fbclid if we have one.
  if (args.fbc) {
    userData.fbc = args.fbc;
  } else if (args.fbclid) {
    userData.fbc = `fb.1.${eventTime * 1000}.${args.fbclid}`;
  }
  if (args.externalId) {
    userData.external_id = [hashPii(String(args.externalId)) || String(args.externalId)];
  }

  const payload = {
    data: [{
      event_name: 'Purchase',
      event_time: eventTime,
      event_id: args.eventId,
      action_source: 'website',
      event_source_url: args.eventSourceUrl || 'https://aiwholesail.com',
      user_data: userData,
      custom_data: {
        value: Number(args.value) || 0,
        currency: (args.currency || 'USD').toUpperCase(),
      },
    }],
  };
  if (process.env.META_CAPI_TEST_EVENT_CODE) {
    payload.test_event_code = process.env.META_CAPI_TEST_EVENT_CODE;
  }

  try {
    const url = `${META_API}/${pixelId}/events?access_token=${encodeURIComponent(token)}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { ok: false, status: res.status, error: body?.error?.message || `HTTP ${res.status}`, response: body };
    }
    return { ok: true, status: res.status, response: body };
  } catch (err) {
    return { ok: false, error: err?.message || String(err) };
  }
}

module.exports = { sendPurchaseEvent, hashPii };
