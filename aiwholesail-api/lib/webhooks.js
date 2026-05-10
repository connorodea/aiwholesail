/**
 * Webhook dispatcher.
 *
 * Signs payloads with HMAC-SHA256 and POSTs to subscribed endpoints.
 * Records every delivery attempt to webhook_deliveries. Auto-disables
 * endpoints after WEBHOOK_AUTODISABLE_THRESHOLD consecutive failures.
 *
 * Verification on the subscriber side:
 *   const expected = crypto
 *     .createHmac('sha256', secret)
 *     .update(rawRequestBody)
 *     .digest('hex');
 *   crypto.timingSafeEqual(
 *     Buffer.from(req.headers['x-aiwholesail-signature']),
 *     Buffer.from(`sha256=${expected}`)
 *   );
 *
 * Phase-1 scope: single-shot delivery (no retry worker yet — failures land
 * in webhook_deliveries with status='failed' and next_retry_at; a future
 * worker will pick them up). Auto-disable still works without a retry
 * worker because every dispatch attempt bumps consecutive_failures.
 */

const crypto = require('crypto');
const { query } = require('../config/database');

// Canonical event-type vocabulary. Routes use these constants so we don't
// have stringly-typed event names scattered around the codebase.
const WEBHOOK_EVENTS = Object.freeze({
  PROPERTY_ALERT_MATCH: 'property_alert_match',
  // Phase 2 placeholders — reserved so consumers can subscribe ahead
  PRICE_CHANGE:         'price_change',
  STATUS_CHANGE:        'status_change',
  OWNER_UPDATE:         'owner_update',
});

const TIMEOUT_MS = 10_000;
const AUTODISABLE_THRESHOLD = 20;
// Exponential backoff for the (future) retry worker
const RETRY_DELAYS_MS = [60_000, 300_000, 1_800_000]; // 1m, 5m, 30m

function newSecret() {
  return crypto.randomBytes(32).toString('hex');
}

function sign(body, secret) {
  const hmac = crypto.createHmac('sha256', secret).update(body).digest('hex');
  return `sha256=${hmac}`;
}

/**
 * Build the canonical payload envelope wrapped around every event.
 */
function envelope(eventType, data) {
  return {
    event: eventType,
    delivered_at: new Date().toISOString(),
    data,
  };
}

/**
 * POST to a single endpoint and record the delivery.
 * Returns { ok, status, durationMs } for the caller (rarely needed).
 */
async function deliver(endpoint, eventType, payload, attempt = 1) {
  const body = JSON.stringify(envelope(eventType, payload));
  const signature = sign(body, endpoint.secret);
  const started = Date.now();

  let status = 0;
  let responseBody = '';
  let ok = false;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    const res = await fetch(endpoint.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'AIWholesail-Webhooks/1.0',
        'X-AIWholesail-Event': eventType,
        'X-AIWholesail-Delivery': crypto.randomUUID(),
        'X-AIWholesail-Signature': signature,
      },
      body,
      signal: controller.signal,
    });
    clearTimeout(timer);
    status = res.status;
    // Truncate large response bodies so we don't blow up the deliveries table
    try {
      responseBody = (await res.text()).slice(0, 500);
    } catch {
      responseBody = '';
    }
    ok = res.status >= 200 && res.status < 300;
  } catch (err) {
    status = 0;
    responseBody = (err.message || 'fetch_failed').slice(0, 500);
    ok = false;
  }
  const durationMs = Date.now() - started;

  // Decide retry / give-up state
  const giveUp = attempt >= RETRY_DELAYS_MS.length + 1;
  const deliveryStatus = ok ? 'success' : (giveUp ? 'abandoned' : 'failed');
  const nextRetryAt = (!ok && !giveUp)
    ? new Date(Date.now() + RETRY_DELAYS_MS[attempt - 1])
    : null;

  // Record delivery
  await query(
    `INSERT INTO webhook_deliveries
       (endpoint_id, event_type, payload, attempt, response_status,
        response_body_truncated, duration_ms, status, next_retry_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [endpoint.id, eventType, payload, attempt, status, responseBody, durationMs,
     deliveryStatus, nextRetryAt]
  ).catch((dbErr) => {
    console.error(`[webhooks] failed to record delivery: ${dbErr.message}`);
  });

  // Update endpoint health
  if (ok) {
    await query(
      `UPDATE webhook_endpoints
         SET last_success_at = NOW(),
             consecutive_failures = 0,
             updated_at = NOW()
       WHERE id = $1`,
      [endpoint.id]
    ).catch(() => {});
  } else {
    await query(
      `UPDATE webhook_endpoints
         SET last_failure_at = NOW(),
             consecutive_failures = consecutive_failures + 1,
             active = CASE
               WHEN consecutive_failures + 1 >= $2 THEN false
               ELSE active
             END,
             updated_at = NOW()
       WHERE id = $1`,
      [endpoint.id, AUTODISABLE_THRESHOLD]
    ).catch(() => {});
  }

  return { ok, status, durationMs };
}

/**
 * Fan out a single event to every active endpoint subscribed to it
 * for a given user. Fire-and-forget — the caller (e.g. the spread-alert
 * worker) doesn't await this, so a slow subscriber doesn't slow down
 * the worker's main loop.
 */
function dispatchEvent(userId, eventType, payload) {
  if (!userId || !eventType) return;
  query(
    `SELECT id, url, secret, events
       FROM webhook_endpoints
      WHERE user_id = $1
        AND active = true
        AND $2 = ANY(events)`,
    [userId, eventType]
  )
    .then((r) => Promise.all(r.rows.map((ep) => deliver(ep, eventType, payload))))
    .catch((err) => {
      console.error(`[webhooks] dispatch ${eventType} failed: ${err.message}`);
    });
}

module.exports = {
  WEBHOOK_EVENTS,
  newSecret,
  sign,
  deliver,
  dispatchEvent,
  AUTODISABLE_THRESHOLD,
};
