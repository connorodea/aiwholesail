/**
 * Resend webhook handler — POST /api/webhooks/resend
 *
 * Processes Resend webhook events (delivered / opened / clicked / bounced /
 * complained / failed) and updates the per-send delivery log + global
 * per-user suppression list accordingly.
 *
 * Event types are documented at
 *   https://resend.com/docs/dashboard/webhooks/event-types
 *
 * SECURITY:
 *   Resend signs webhooks with Svix. Signature lives in three headers:
 *     - svix-id           message id
 *     - svix-timestamp    unix seconds
 *     - svix-signature    space-separated list of `v1,<base64>` entries
 *
 *   The signed payload is the concatenation `svix-id.svix-timestamp.body`
 *   HMAC-SHA256'd with the webhook signing secret. The secret is stored as
 *   `whsec_<base64>` — we strip the prefix and decode before HMAC'ing.
 *
 *   We fail closed: missing RESEND_WEBHOOK_SECRET, missing headers, or any
 *   signature mismatch returns 401 and the event is rejected.
 *
 *   `svix` is not in package.json so we verify manually. If it gets added
 *   later, swap the verifySvixSignature() body for `new Webhook(secret).verify(...)`.
 *
 * IDEMPOTENCY / RETRIES:
 *   Resend retries on any non-2xx. To avoid retry storms we ALWAYS return
 *   200 once the signature has been verified, even if the inner handler
 *   throws or the email_send_log row doesn't exist (yet). Errors are logged.
 *
 *   Per-event first-touch fields (opened_at, clicked_at) use COALESCE so a
 *   second open/click webhook never overwrites the first timestamp.
 */

const express = require('express');
const crypto = require('crypto');
const { Pool } = require('pg');
const { classifyReplyIntent } = require('../lib/reply-intent');

const router = express.Router();

// Reuse the same connection string + SSL posture as config/database.js.
// Local Pool here (rather than importing config/database.js) keeps this
// route self-contained — useful for the security-sensitive raw-body path.
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

/**
 * Verify a Svix webhook signature.
 *
 * Returns true if at least one of the signatures in the `svix-signature`
 * header matches the HMAC-SHA256 of `id.timestamp.body` under the
 * webhook secret.
 *
 * @param {Buffer} rawBody - the unparsed request body
 * @param {object} headers - request headers (lowercase keys)
 * @param {string} secret - the `whsec_<base64>` signing secret
 */
function verifySvixSignature(rawBody, headers, secret) {
  const svixId = headers['svix-id'];
  const svixTimestamp = headers['svix-timestamp'];
  const svixSignature = headers['svix-signature'];

  if (!svixId || !svixTimestamp || !svixSignature) return false;

  // Reject replays older than 5 minutes (Svix default tolerance window).
  const tsSec = parseInt(svixTimestamp, 10);
  if (!Number.isFinite(tsSec)) return false;
  const nowSec = Math.floor(Date.now() / 1000);
  if (Math.abs(nowSec - tsSec) > 60 * 5) return false;

  // Svix secrets are stored as `whsec_<base64>` — strip prefix before decode.
  const secretBytes = secret.startsWith('whsec_')
    ? Buffer.from(secret.slice('whsec_'.length), 'base64')
    : Buffer.from(secret, 'utf8');

  const signedPayload = `${svixId}.${svixTimestamp}.${rawBody.toString('utf8')}`;
  const expected = crypto
    .createHmac('sha256', secretBytes)
    .update(signedPayload)
    .digest('base64');

  // Header is space-separated `v1,<base64> v1,<base64>` — any match is OK.
  const presented = svixSignature.split(' ');
  for (const entry of presented) {
    const [version, sig] = entry.split(',');
    if (version !== 'v1' || !sig) continue;
    // timingSafeEqual requires equal length buffers
    const a = Buffer.from(sig, 'utf8');
    const b = Buffer.from(expected, 'utf8');
    if (a.length === b.length && crypto.timingSafeEqual(a, b)) return true;
  }
  return false;
}

// --- Per-event handlers --------------------------------------------------

async function handleDelivered(data) {
  const id = data.email_id || data.id;
  if (!id) return;
  const result = await pool.query(
    `UPDATE email_send_log
        SET delivered_at = COALESCE(delivered_at, NOW())
      WHERE provider_message_id = $1`,
    [id]
  );
  if (result.rowCount === 0) {
    console.warn('[Resend webhook] delivered: no email_send_log row for', id);
  }
}

async function handleOpened(data) {
  const id = data.email_id || data.id;
  if (!id) return;
  // First open wins — COALESCE keeps the earliest opened_at.
  const result = await pool.query(
    `UPDATE email_send_log
        SET opened_at = COALESCE(opened_at, NOW())
      WHERE provider_message_id = $1`,
    [id]
  );
  if (result.rowCount === 0) {
    console.warn('[Resend webhook] opened: no email_send_log row for', id);
  }
}

async function handleClicked(data) {
  const id = data.email_id || data.id;
  if (!id) return;
  const result = await pool.query(
    `UPDATE email_send_log
        SET clicked_at = COALESCE(clicked_at, NOW())
      WHERE provider_message_id = $1`,
    [id]
  );
  if (result.rowCount === 0) {
    console.warn('[Resend webhook] clicked: no email_send_log row for', id);
  }
}

async function handleBounced(data) {
  const id = data.email_id || data.id;
  if (!id) return;
  // Resend reports bounce.type as 'hard' | 'soft' (lower case in practice).
  const bounceType = (data.bounce?.type || data.bounce_type || '').toLowerCase();

  const result = await pool.query(
    `UPDATE email_send_log
        SET bounced_at = COALESCE(bounced_at, NOW()),
            bounce_type = COALESCE(bounce_type, $2)
      WHERE provider_message_id = $1
      RETURNING user_id, to_address`,
    [id, bounceType || null]
  );

  if (result.rowCount === 0) {
    console.warn('[Resend webhook] bounced: no email_send_log row for', id);
    return;
  }

  // Only HARD bounces add the address to the per-user suppression list.
  // Soft bounces (mailbox full, temporary failure) are retriable.
  if (bounceType === 'hard') {
    const { user_id, to_address } = result.rows[0];
    await pool.query(
      `INSERT INTO email_suppressions (user_id, email, reason, source_message_id)
       VALUES ($1, $2, 'bounced', $3)
       ON CONFLICT (user_id, email) DO NOTHING`,
      [user_id, to_address, id]
    );
  }
}

async function handleComplained(data) {
  const id = data.email_id || data.id;
  if (!id) return;
  const result = await pool.query(
    `UPDATE email_send_log
        SET complained_at = COALESCE(complained_at, NOW())
      WHERE provider_message_id = $1
      RETURNING user_id, to_address`,
    [id]
  );
  if (result.rowCount === 0) {
    console.warn('[Resend webhook] complained: no email_send_log row for', id);
    return;
  }
  // Spam complaint = always suppress.
  const { user_id, to_address } = result.rows[0];
  await pool.query(
    `INSERT INTO email_suppressions (user_id, email, reason, source_message_id)
     VALUES ($1, $2, 'complained', $3)
     ON CONFLICT (user_id, email) DO NOTHING`,
    [user_id, to_address, id]
  );
}

async function handleFailed(data) {
  const id = data.email_id || data.id;
  if (!id) return;
  const errorMessage = data.failed?.reason || data.error || data.reason || null;
  const result = await pool.query(
    `UPDATE email_send_log
        SET failed_at = COALESCE(failed_at, NOW()),
            error_message = COALESCE(error_message, $2)
      WHERE provider_message_id = $1`,
    [id, errorMessage]
  );
  if (result.rowCount === 0) {
    console.warn('[Resend webhook] failed: no email_send_log row for', id);
  }
}

// --- Inbound reply parsing ------------------------------------------------
//
// Resend's inbound parsing webhook fires `email.received` events when mail
// arrives at our configured receiving domain (reply.aiwholesail.com). The
// payload shape:
//   {
//     type: 'email.received',
//     data: {
//       email_id: '<resend id of THIS inbound>',
//       from: 'seller@example.com',
//       to: ['reply+thread@reply.aiwholesail.com'],
//       subject: 'Re: your message',
//       headers: [{name: 'In-Reply-To', value: '<original-id@resend.dev>'}, ...],
//       text: '...',
//       html: '...',
//     }
//   }
//
// We thread inbound to the original send by matching the `In-Reply-To`
// header against `email_send_log.provider_message_id`. Failing that, we
// fall back to a 24-hour to_address ↔ from_address match.

// Intent classification regexes + classifyReplyIntent() live in
// lib/reply-intent.js so they're unit-testable without standing up the
// full webhook stack. See lib/reply-intent.js for the category contract.

// Pluck a header value by case-insensitive name. Resend gives us an
// array of { name, value } objects; some providers give us an object map.
function getHeader(headers, name) {
  if (!headers) return null;
  const lower = name.toLowerCase();
  if (Array.isArray(headers)) {
    for (const h of headers) {
      if (h && typeof h.name === 'string' && h.name.toLowerCase() === lower) {
        return h.value || null;
      }
    }
    return null;
  }
  if (typeof headers === 'object') {
    for (const [k, v] of Object.entries(headers)) {
      if (k.toLowerCase() === lower) return v;
    }
  }
  return null;
}

// Normalize the `from` field — Resend may give us "Name <addr@example.com>"
// or a bare address. We want just the addr for downstream lookups + suppression.
function extractAddress(input) {
  if (!input || typeof input !== 'string') return null;
  const m = input.match(/<([^>]+)>/);
  return (m ? m[1] : input).trim().toLowerCase();
}

function extractToAddress(to) {
  if (!to) return null;
  if (Array.isArray(to)) return extractAddress(to[0]);
  return extractAddress(to);
}

// Strip angle brackets some clients add around message-ids in headers.
function normalizeMessageId(id) {
  if (!id || typeof id !== 'string') return null;
  return id.trim().replace(/^<|>$/g, '');
}

async function handleInboundReceived(data) {
  // 1. Extract fields.
  const fromAddress = extractAddress(data.from);
  const toAddress = extractToAddress(data.to);
  const subject = data.subject || null;
  const bodyText = data.text || null;
  const bodyHtml = data.html || null;
  const messageId = normalizeMessageId(getHeader(data.headers, 'Message-ID') || data.email_id);
  const inReplyTo = normalizeMessageId(getHeader(data.headers, 'In-Reply-To'));

  if (!fromAddress) {
    console.warn('[Resend webhook] inbound: no from address; skipping');
    return;
  }

  // 2. Try to thread the inbound reply to an outbound send.
  let userId = null;
  let leadSequenceId = null;
  let emailSendLogId = null;

  if (inReplyTo) {
    const r = await pool.query(
      `SELECT esl.id, esl.user_id, ls.id AS lead_sequence_id
         FROM email_send_log esl
         LEFT JOIN sequence_executions se ON se.id = esl.sequence_execution_id
         LEFT JOIN lead_sequences ls ON ls.id = se.lead_sequence_id
        WHERE esl.provider_message_id = $1
        LIMIT 1`,
      [inReplyTo]
    );
    if (r.rowCount > 0) {
      emailSendLogId = r.rows[0].id;
      userId = r.rows[0].user_id;
      leadSequenceId = r.rows[0].lead_sequence_id;
    }
  }

  // 3. Best-effort fallback — find any send in the last 24h to this
  //    from_address. This catches replies whose In-Reply-To header was
  //    stripped or rewritten by intermediate MTAs.
  if (!emailSendLogId) {
    const r = await pool.query(
      `SELECT esl.id, esl.user_id, ls.id AS lead_sequence_id
         FROM email_send_log esl
         LEFT JOIN sequence_executions se ON se.id = esl.sequence_execution_id
         LEFT JOIN lead_sequences ls ON ls.id = se.lead_sequence_id
        WHERE LOWER(esl.to_address) = $1
          AND esl.sent_at >= NOW() - INTERVAL '24 hours'
        ORDER BY esl.sent_at DESC
        LIMIT 1`,
      [fromAddress]
    );
    if (r.rowCount > 0) {
      emailSendLogId = r.rows[0].id;
      userId = r.rows[0].user_id;
      leadSequenceId = r.rows[0].lead_sequence_id;
    }
  }

  // 4. Classify intent on the lowercased body text.
  const parsedIntent = classifyReplyIntent(bodyText, fromAddress, data.headers);

  // 5. Insert the inbound reply row. ON CONFLICT (message_id) DO NOTHING
  //    guards against duplicate webhook deliveries from Resend.
  try {
    await pool.query(
      `INSERT INTO email_inbound_replies (
         user_id, email_send_log_id, lead_sequence_id,
         from_address, to_address, subject, message_id, in_reply_to,
         body_text, body_html, parsed_intent
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       ON CONFLICT (message_id) DO NOTHING`,
      [
        userId,
        emailSendLogId,
        leadSequenceId,
        fromAddress,
        toAddress,
        subject,
        messageId,
        inReplyTo,
        bodyText,
        bodyHtml,
        parsedIntent,
      ]
    );
  } catch (err) {
    console.error('[Resend webhook] inbound: insert failed:', err.message);
    // Continue — we'd still like to suppress / pause if possible.
  }

  // 6. Stamp the originating send row with replied_at so analytics + the
  //    inbox UI can show "replied" without an extra JOIN.
  if (emailSendLogId) {
    try {
      await pool.query(
        `UPDATE email_send_log
            SET replied_at = COALESCE(replied_at, NOW())
          WHERE id = $1`,
        [emailSendLogId]
      );
    } catch (err) {
      console.error('[Resend webhook] inbound: replied_at update failed:', err.message);
    }
  }

  // 7. Auto-pause the lead_sequence on any actionable intent — interested,
  //    not_interested, or unsubscribe. We don't pause on 'bounce_message'
  //    (the bounce webhook already handles hard-bounce suppression) or
  //    'unknown' (could be a benign follow-up). Skip if the sequence is
  //    already in a terminal state.
  if (userId && leadSequenceId &&
      ['interested', 'not_interested', 'unsubscribe'].includes(parsedIntent)) {
    try {
      await pool.query(
        `UPDATE lead_sequences
            SET status = 'paused'
          WHERE id = $1
            AND status NOT IN ('paused', 'completed', 'cancelled')`,
        [leadSequenceId]
      );
    } catch (err) {
      console.error('[Resend webhook] inbound: pause sequence failed:', err.message);
    }
  }

  // 8. Add the address to the per-user suppression list on unsubscribe.
  //    We require a resolved user_id — without it the suppression has no
  //    owner and would be unenforceable at send time.
  if (userId && parsedIntent === 'unsubscribe') {
    try {
      await pool.query(
        `INSERT INTO email_suppressions (user_id, email, reason, source_message_id)
         VALUES ($1, $2, 'unsubscribed', $3)
         ON CONFLICT (user_id, email) DO NOTHING`,
        [userId, fromAddress, messageId]
      );
    } catch (err) {
      console.error('[Resend webhook] inbound: suppression insert failed:', err.message);
    }
  }

  console.log('[Resend webhook] inbound processed', {
    from: fromAddress,
    intent: parsedIntent,
    matched: !!emailSendLogId,
    user_id: userId,
    lead_sequence_id: leadSequenceId,
  });
}

// --- Route ---------------------------------------------------------------

/**
 * POST /api/webhooks/resend
 *
 * NOTE: `express.raw()` is applied locally on this route so the rest of
 * the app's JSON body parser is unaffected. Svix verification needs the
 * exact byte sequence Resend signed — once `express.json()` reads the
 * body, the original bytes are gone.
 *
 * This route is also exempted from the global JSON parser via the
 * `req.originalUrl === '/api/webhooks/resend'` skip in index.js (same
 * pattern as /api/stripe/webhook).
 */
router.post(
  '/',
  express.raw({ type: 'application/json' }),
  async (req, res) => {
    const secret = process.env.RESEND_WEBHOOK_SECRET;
    if (!secret) {
      console.error('[Resend webhook] RESEND_WEBHOOK_SECRET is not set — rejecting');
      return res.status(401).json({ error: 'webhook secret not configured' });
    }

    const rawBody = req.body; // Buffer, thanks to express.raw()
    if (!Buffer.isBuffer(rawBody)) {
      console.error('[Resend webhook] body was not a Buffer; raw-body middleware missing?');
      return res.status(401).json({ error: 'invalid body' });
    }

    // Normalize header keys to lowercase — Node already does this for
    // req.headers, but be defensive in case of upstream proxies.
    const headers = {};
    for (const [k, v] of Object.entries(req.headers || {})) {
      headers[k.toLowerCase()] = Array.isArray(v) ? v[0] : v;
    }

    if (!verifySvixSignature(rawBody, headers, secret)) {
      console.warn('[Resend webhook] signature verification failed', {
        svixId: headers['svix-id'],
        svixTimestamp: headers['svix-timestamp'],
      });
      return res.status(401).json({ error: 'invalid signature' });
    }

    // Signature is valid — parse the body. From here on, we ALWAYS return
    // 200 so Resend doesn't retry on app-side bugs. Handler errors are
    // swallowed + logged.
    let event;
    try {
      event = JSON.parse(rawBody.toString('utf8'));
    } catch (err) {
      console.error('[Resend webhook] JSON parse failed (signature was valid):', err.message);
      return res.status(200).json({ received: true, parsed: false });
    }

    const type = event.type;
    const data = event.data || {};
    console.log('[Resend webhook] received', { type, id: data.email_id || data.id });

    try {
      switch (type) {
        case 'email.delivered':
          await handleDelivered(data);
          break;
        case 'email.opened':
          await handleOpened(data);
          break;
        case 'email.clicked':
          await handleClicked(data);
          break;
        case 'email.bounced':
          await handleBounced(data);
          break;
        case 'email.complained':
          await handleComplained(data);
          break;
        case 'email.failed':
        case 'email.delivery_delayed':
          await handleFailed(data);
          break;
        case 'email.received':
          await handleInboundReceived(data);
          break;
        default:
          console.log('[Resend webhook] unhandled event type:', type);
      }
    } catch (err) {
      // Never throw past the route — log and 200 so Resend doesn't retry.
      console.error('[Resend webhook] handler error (returning 200 anyway):', {
        type,
        message: err.message,
        stack: err.stack,
      });
    }

    return res.status(200).json({ received: true });
  }
);

module.exports = router;
