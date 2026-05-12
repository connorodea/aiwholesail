/**
 * Meta Conversions API (CAPI) — server-side Purchase event firing.
 *
 * Spec ref: phase 6 of posthog-analytics-spec.json
 *
 * Why server-side: the in-browser Facebook Pixel is increasingly blocked
 * by ad blockers, ITP, and Brave/Safari privacy defaults. CAPI fires from
 * our server straight to Meta, so the Purchase event always reaches the
 * Events Manager regardless of the user's browser config. Required for
 * accurate ad-set ROAS calculation when comparing utm_content cohorts.
 *
 * Hard rule: errors must NOT throw — payment flow is higher priority than
 * analytics delivery. Any failure logs + returns silently.
 *
 * Env:
 *   META_PIXEL_ID      — numeric Pixel ID (read from Events Manager)
 *   META_CAPI_TOKEN    — access token from Events Manager > Settings > CAPI
 *   META_CAPI_TEST_CODE— optional; when set, events are tagged as test
 *                        events visible only in the Events Manager test
 *                        console (not in production analytics)
 */

const crypto = require('crypto');
const axios = require('axios');

const PIXEL_ID = process.env.META_PIXEL_ID || process.env.AIWHOLESAIL_FB_PIXEL_ID;
const CAPI_TOKEN = process.env.META_CAPI_TOKEN;
const TEST_CODE = process.env.META_CAPI_TEST_CODE;
const GRAPH_VERSION = 'v19.0';

function sha256(v) {
  if (!v) return undefined;
  return crypto.createHash('sha256').update(String(v).trim().toLowerCase()).digest('hex');
}

/**
 * Fire a Purchase event server-side.
 *
 * @param {object} args
 * @param {string} args.email           — recipient email (will be SHA256'd)
 * @param {string} [args.fbp]           — _fbp cookie value from signup attribution
 * @param {string} [args.fbc]           — _fbc cookie value from signup attribution
 * @param {number} args.value           — gross amount (e.g. 49 for $49)
 * @param {string} [args.currency=USD]
 * @param {string} [args.eventSourceUrl]
 * @param {string} [args.eventId]       — used for deduplication against the
 *                                        browser-side Pixel event of the
 *                                        same kind. Recommend Stripe's
 *                                        subscription.id when available.
 * @returns {Promise<{ok: boolean, error?: string}>}
 */
async function sendPurchaseEvent({ email, fbp, fbc, value, currency = 'USD', eventSourceUrl, eventId }) {
  if (!PIXEL_ID || !CAPI_TOKEN) {
    // No CAPI configured. Don't warn loudly — this is opt-in.
    return { ok: false, error: 'META_PIXEL_ID or META_CAPI_TOKEN not set' };
  }

  const payload = {
    data: [{
      event_name: 'Purchase',
      event_time: Math.floor(Date.now() / 1000),
      action_source: 'website',
      event_source_url: eventSourceUrl || 'https://aiwholesail.com',
      ...(eventId ? { event_id: eventId } : {}),
      user_data: {
        em: email ? [sha256(email)] : undefined,
        fbp,
        fbc,
      },
      custom_data: {
        value: Number(value) || 0,
        currency,
      },
    }],
    ...(TEST_CODE ? { test_event_code: TEST_CODE } : {}),
  };

  try {
    const r = await axios.post(
      `https://graph.facebook.com/${GRAPH_VERSION}/${PIXEL_ID}/events`,
      payload,
      { params: { access_token: CAPI_TOKEN }, timeout: 10000 }
    );
    console.log('[CAPI] Purchase sent', {
      events_received: r.data?.events_received,
      pixel: PIXEL_ID,
      value, currency, event_id: eventId,
    });
    return { ok: true, response: r.data };
  } catch (err) {
    const fbError = err.response?.data?.error;
    console.warn('[CAPI] Purchase failed (analytics, not blocking payment):', fbError?.message || err.message);
    return { ok: false, error: fbError?.message || err.message };
  }
}

module.exports = { sendPurchaseEvent };
