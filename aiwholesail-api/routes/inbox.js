/**
 * Inbox routes — /api/inbox/*
 *
 * Reads from `email_inbound_replies`, which is populated by the Resend
 * inbound webhook (routes/resend-webhooks.js → handleInboundReceived).
 *
 * Endpoints:
 *   GET    /                 list replies for req.user.id (paginated, filterable)
 *   GET    /:id              single reply with full body_text + body_html
 *   POST   /:id/mark-read    stamp read_at
 *
 * Mounted in index.js behind authenticate + requireFlag('email-campaigns-v2').
 * The frontend Inbox UI is built in a separate worktree.
 */

const express = require('express');
const { param, query: q, validationResult } = require('express-validator');
const { Pool } = require('pg');
const { asyncHandler } = require('../middleware/errorHandler');

const router = express.Router();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

const VALID_INTENTS = new Set([
  'interested',
  'not_interested',
  'unsubscribe',
  'bounce_message',
  'unknown',
]);

// ----- GET / -------------------------------------------------------------
//
// Paginated list of inbound replies. Joins email_send_log for the original
// subject + sent_at, and campaign_targets → campaigns for the campaign name
// when the reply belongs to a campaign-launched lead_sequence. thread_count
// counts how many replies share the same lead_sequence_id (best-effort
// thread-size indicator for the UI).

router.get('/', [
  q('parsed_intent').optional().isString(),
  q('lead_sequence_id').optional().isUUID(),
  q('limit').optional().isInt({ min: 1, max: MAX_LIMIT }).toInt(),
  q('offset').optional().isInt({ min: 0 }).toInt(),
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: 'Validation failed', errors: errors.array() });
  }

  const limit = Math.min(parseInt(req.query.limit, 10) || DEFAULT_LIMIT, MAX_LIMIT);
  const offset = parseInt(req.query.offset, 10) || 0;

  const conds = ['r.user_id = $1'];
  const params = [req.user.id];
  let p = 2;

  if (req.query.parsed_intent) {
    if (!VALID_INTENTS.has(req.query.parsed_intent)) {
      return res.status(400).json({ error: 'Invalid parsed_intent' });
    }
    conds.push(`r.parsed_intent = $${p}`);
    params.push(req.query.parsed_intent);
    p++;
  }

  if (req.query.lead_sequence_id) {
    conds.push(`r.lead_sequence_id = $${p}`);
    params.push(req.query.lead_sequence_id);
    p++;
  }

  params.push(limit);
  params.push(offset);

  // Thread count: count siblings sharing the same lead_sequence_id. NULL
  // lead_sequence_id → 1 (the row itself). Using a correlated subquery
  // keeps the query simple — there are few enough rows per user that
  // the planner picks idx_email_inbound_replies_lead_sequence cleanly.
  const sql = `
    SELECT
      r.id,
      r.from_address,
      r.subject,
      r.parsed_intent,
      r.received_at,
      r.read_at,
      r.lead_sequence_id,
      LEFT(COALESCE(r.body_text, ''), 500) AS body_text,
      esl.subject AS original_subject,
      esl.sent_at AS original_sent_at,
      c.name AS campaign_name,
      CASE
        WHEN r.lead_sequence_id IS NULL THEN 1
        ELSE (
          SELECT COUNT(*) FROM email_inbound_replies r2
           WHERE r2.lead_sequence_id = r.lead_sequence_id
             AND r2.user_id = r.user_id
        )
      END AS thread_count
    FROM email_inbound_replies r
    LEFT JOIN email_send_log esl ON esl.id = r.email_send_log_id
    LEFT JOIN campaign_targets ct ON ct.lead_sequence_id = r.lead_sequence_id
    LEFT JOIN campaigns c ON c.id = ct.campaign_id
    WHERE ${conds.join(' AND ')}
    ORDER BY r.received_at DESC
    LIMIT $${p} OFFSET $${p + 1}
  `;

  const rows = (await pool.query(sql, params)).rows;

  // Count for pagination — fast because the (user_id, read_at, received_at)
  // composite from migration 026 covers user_id alone.
  const countSql = `SELECT COUNT(*)::int AS total FROM email_inbound_replies r WHERE ${conds.join(' AND ')}`;
  const total = (await pool.query(countSql, params.slice(0, p - 1))).rows[0].total;

  res.json({
    ok: true,
    replies: rows.map((row) => ({
      id: row.id,
      from_address: row.from_address,
      subject: row.subject,
      parsed_intent: row.parsed_intent,
      received_at: row.received_at,
      read_at: row.read_at,
      body_text: row.body_text,
      original_subject: row.original_subject,
      original_sent_at: row.original_sent_at,
      lead_sequence_id: row.lead_sequence_id,
      campaign_name: row.campaign_name,
      thread_count: Number(row.thread_count) || 1,
    })),
    pagination: {
      limit,
      offset,
      total,
      has_more: offset + rows.length < total,
    },
  });
}));

// ----- GET /:id ----------------------------------------------------------

router.get('/:id', [param('id').isUUID()], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: 'Invalid reply id' });
  }

  const r = await pool.query(
    `SELECT
       r.id, r.user_id, r.from_address, r.to_address, r.subject,
       r.message_id, r.in_reply_to, r.body_text, r.body_html,
       r.parsed_intent, r.received_at, r.read_at,
       r.lead_sequence_id, r.email_send_log_id,
       esl.subject AS original_subject,
       esl.sent_at AS original_sent_at,
       esl.to_address AS original_to_address,
       c.name AS campaign_name
     FROM email_inbound_replies r
     LEFT JOIN email_send_log esl ON esl.id = r.email_send_log_id
     LEFT JOIN campaign_targets ct ON ct.lead_sequence_id = r.lead_sequence_id
     LEFT JOIN campaigns c ON c.id = ct.campaign_id
    WHERE r.id = $1 AND r.user_id = $2
    LIMIT 1`,
    [req.params.id, req.user.id]
  );

  if (r.rowCount === 0) {
    return res.status(404).json({ error: 'Reply not found' });
  }

  res.json({ ok: true, reply: r.rows[0] });
}));

// ----- POST /:id/mark-read -----------------------------------------------
//
// Idempotent — re-marking a read reply leaves read_at unchanged via COALESCE.

router.post('/:id/mark-read', [param('id').isUUID()], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: 'Invalid reply id' });
  }

  const r = await pool.query(
    `UPDATE email_inbound_replies
        SET read_at = COALESCE(read_at, NOW())
      WHERE id = $1 AND user_id = $2
      RETURNING id, read_at`,
    [req.params.id, req.user.id]
  );

  if (r.rowCount === 0) {
    return res.status(404).json({ error: 'Reply not found' });
  }

  res.json({ ok: true, id: r.rows[0].id, read_at: r.rows[0].read_at });
}));

module.exports = router;
