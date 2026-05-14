/**
 * Outreach Campaign Builder routes.
 *
 * Surface for /api/campaigns/* — list / create / preview / launch / pause /
 * resume / cancel / test-send. Flag-gated globally at mount time via
 * `requireFlag('email-campaigns-v2')` so unflagged users 404 here.
 *
 * Fanout model (POST /:id/launch):
 *   1. Resolve audience (buyers | agents | csv) to a contact list.
 *   2. Drop contacts on the per-user `email_suppressions` list.
 *   3. For each remaining contact, INSERT a `lead_sequences` row with
 *      lead_id=NULL (relaxed in migration 024) and the contact's merge vars.
 *   4. For each sequence_steps row of the template, INSERT a
 *      `sequence_executions` row with scheduled_date snapped to the
 *      campaign's send window (via lib/campaign-scheduling.js).
 *   5. INSERT a `campaign_targets` row linking the contact to the
 *      lead_sequences row created in step 3.
 *   6. UPDATE campaigns SET status='scheduled', audience_count=N,
 *      launched_at=NOW(). All in a single transaction; on any error,
 *      ROLLBACK.
 *
 * Daily-cap pacing: we snake the per-contact execution windows across days
 * (cap N per day) before snapping each one into the send window. The send
 * window snap can still push an execution to a later day if the candidate
 * timestamp falls outside the allowed hours/days — caps are best-effort,
 * not a hard upper bound.
 */

const express = require('express');
const { body, param, validationResult } = require('express-validator');
const { Pool } = require('pg');
const { authenticate } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');
const { getSender, getReplyTo } = require('../lib/senders');
const { Resend } = require('resend');
const { nextAllowedSendTime } = require('../lib/campaign-scheduling');

const router = express.Router();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const resend = new Resend(process.env.RESEND_API_KEY);

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

// ----- helpers ------------------------------------------------------------

function renderTemplate(template, vars) {
  if (!template) return '';
  return String(template).replace(/\{([a-zA-Z0-9_]+)\}/g, (m, key) => {
    const v = vars && vars[key];
    return v === undefined || v === null ? m : String(v);
  });
}

function buildSendWindow(row) {
  // row may be either the DB row (snake_case) or the request body (camelCase).
  const startHour =
    row.send_window_start_hour != null ? Number(row.send_window_start_hour)
    : row.sendWindowStartHour != null ? Number(row.sendWindowStartHour)
    : null;
  const endHour =
    row.send_window_end_hour != null ? Number(row.send_window_end_hour)
    : row.sendWindowEndHour != null ? Number(row.sendWindowEndHour)
    : null;
  const days =
    Array.isArray(row.send_window_days) ? row.send_window_days.map(Number)
    : Array.isArray(row.sendWindowDays) ? row.sendWindowDays.map(Number)
    : null;
  return { startHour, endHour, days };
}

async function tableExists(client, tableName) {
  const r = await client.query('SELECT to_regclass($1) AS reg', [tableName]);
  return r.rows[0].reg !== null;
}

function pickFirstFive(arr) {
  if (!Array.isArray(arr)) return [];
  return arr.slice(0, 5);
}

// Apply the audience_filter shape that AudienceStep produces to a buyers /
// agents SELECT. Returns { whereClause, params } where whereClause is the
// ` AND ...` fragment appended to the base WHERE.
function buildAudienceWhere(filter, paramIndexStart) {
  const conds = [];
  const params = [];
  let p = paramIndexStart;
  if (!filter || typeof filter !== 'object') {
    return { whereClause: '', params, nextIndex: p };
  }
  if (filter.has_email === true || filter.hasEmail === true) {
    conds.push('email IS NOT NULL AND email <> \'\'');
  }
  if (filter.tag) {
    conds.push(`tags && $${p}`);
    params.push([String(filter.tag)]);
    p++;
  }
  if (filter.location) {
    // buyers store location inside criteria->'locations' jsonb array, agents
    // store market/city/state plain columns. The caller already knows the
    // table, but to keep this generic we OR the two shapes — bad rows just
    // miss the filter, never crash.
    conds.push(
      `((criteria IS NOT NULL AND criteria->'locations' @> $${p}::jsonb)`
        + ` OR market ILIKE $${p + 1} OR city ILIKE $${p + 1})`
    );
    params.push(JSON.stringify([String(filter.location)]));
    params.push(`%${filter.location}%`);
    p += 2;
  }
  if (filter.state) {
    conds.push(`state = $${p}`);
    params.push(String(filter.state));
    p++;
  }
  const whereClause = conds.length ? ' AND ' + conds.join(' AND ') : '';
  return { whereClause, params, nextIndex: p };
}

// ----- GET / list ---------------------------------------------------------

router.get('/', authenticate, asyncHandler(async (req, res) => {
  const sql = `
    SELECT
      c.*,
      COALESCE(stats.sent_count, 0) AS sent_count,
      COALESCE(stats.replied_count, 0) AS replied_count,
      COALESCE(stats.bounced_count, 0) AS bounced_count
    FROM campaigns c
    LEFT JOIN LATERAL (
      SELECT
        COUNT(esl.id) FILTER (WHERE esl.sent_at IS NOT NULL) AS sent_count,
        COUNT(esl.id) FILTER (WHERE esl.replied_at IS NOT NULL) AS replied_count,
        COUNT(esl.id) FILTER (WHERE esl.bounced_at IS NOT NULL) AS bounced_count
      FROM campaign_targets ct
      LEFT JOIN sequence_executions se ON se.lead_sequence_id = ct.lead_sequence_id
      LEFT JOIN email_send_log esl ON esl.sequence_execution_id = se.id
      WHERE ct.campaign_id = c.id
    ) stats ON TRUE
    WHERE c.user_id = $1
    ORDER BY c.created_at DESC
    LIMIT 200
  `;
  const result = await pool.query(sql, [req.user.id]);
  res.json({ campaigns: result.rows });
}));

// ----- GET /:id -----------------------------------------------------------

router.get('/:id', authenticate, [param('id').isUUID()], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ error: 'Invalid campaign ID' });

  const result = await pool.query(
    'SELECT * FROM campaigns WHERE id = $1 AND user_id = $2',
    [req.params.id, req.user.id]
  );
  if (result.rows.length === 0) return res.status(404).json({ error: 'Campaign not found' });

  const breakdown = await pool.query(
    `SELECT status, COUNT(*)::int AS count
     FROM campaign_targets
     WHERE campaign_id = $1
     GROUP BY status`,
    [req.params.id]
  );

  res.json({
    campaign: result.rows[0],
    status_breakdown: breakdown.rows,
  });
}));

// ----- GET /:id/analytics -------------------------------------------------
//
// Phase 5 — Campaign Analytics. Three slice modes:
//   - overall      : single aggregate row with totals + computed rates
//   - by-step      : per-step counts + rates + heuristic recommendation
//   - by-recipient : paginated per-recipient last_stage + stage timestamps
//
// All queries are scoped to req.user.id and hit the indexes shipped in
// migration 022 (idx_email_send_log_sequence_execution,
// idx_email_send_log_user_sent) + migration 024
// (idx_campaign_targets_campaign_status).

function computeRates(totals) {
  const sent = Number(totals.sent || 0);
  const delivered = Number(totals.delivered || 0);
  const denom = delivered > 0 ? delivered : sent;
  const safe = (n) => (denom > 0 ? Number(n || 0) / denom : 0);
  return {
    delivery_rate: sent > 0 ? delivered / sent : 0,
    open_rate: safe(totals.opened),
    click_rate: safe(totals.clicked),
    reply_rate: safe(totals.replied),
    interested_rate: safe(totals.interested),
    bounce_rate: sent > 0 ? Number(totals.bounced || 0) / sent : 0,
  };
}

function recommendForStep(step) {
  const sent = Number(step.sent || 0);
  const delivered = Number(step.delivered || 0);
  const opened = Number(step.opened || 0);
  const replied = Number(step.replied || 0);
  const bounced = Number(step.bounced || 0);
  if (sent === 0) return 'monitoring';
  const denom = delivered > 0 ? delivered : sent;
  const openRate = denom > 0 ? opened / denom : 0;
  const replyRate = denom > 0 ? replied / denom : 0;
  const deliveryRate = sent > 0 ? delivered / sent : 0;
  const bounceRate = sent > 0 ? bounced / sent : 0;
  if (replyRate > 0.05) return 'good';
  if (replyRate > 0.01 && openRate > 0.20) return 'good';
  if (deliveryRate < 0.85) return 'deliverability issue';
  if (bounceRate > 0.05) return 'audience quality issue';
  if (openRate < 0.10 && Number(step.step_order) > 1) return 'rewrite subject';
  return 'monitoring';
}

router.get('/:id/analytics', authenticate, [param('id').isUUID()], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ error: 'Invalid campaign ID' });

  const slice = String(req.query.slice || 'overall');
  if (!['overall', 'by-step', 'by-recipient'].includes(slice)) {
    return res.status(400).json({ error: 'Invalid slice. Use overall|by-step|by-recipient' });
  }

  // Ownership check first — every slice must be scoped to req.user.id.
  let campaignRow;
  try {
    const owner = await pool.query(
      `SELECT id, name, status, audience_count, launched_at, completed_at,
              sender_category, created_at, user_id
         FROM campaigns
        WHERE id = $1 AND user_id = $2`,
      [req.params.id, req.user.id]
    );
    if (owner.rows.length === 0) return res.status(404).json({ error: 'Campaign not found' });
    campaignRow = owner.rows[0];
  } catch (err) {
    console.error('[campaigns.analytics] ownership lookup failed:', err);
    return res.status(500).json({ error: 'Analytics lookup failed' });
  }

  if (slice === 'overall') {
    try {
      const sql = `
        WITH targets AS (
          SELECT ct.id, ct.lead_sequence_id, LOWER(ct.target_email) AS target_email
            FROM campaign_targets ct
           WHERE ct.campaign_id = $1
        ),
        sends AS (
          SELECT esl.id, esl.to_address, esl.delivered_at, esl.opened_at,
                 esl.clicked_at, esl.replied_at, esl.bounced_at,
                 esl.complained_at, esl.unsubscribed_at,
                 t.lead_sequence_id
            FROM email_send_log esl
            JOIN sequence_executions se ON se.id = esl.sequence_execution_id
            JOIN targets t ON t.lead_sequence_id = se.lead_sequence_id
           WHERE esl.user_id = $2
        ),
        intents AS (
          SELECT r.lead_sequence_id, r.parsed_intent
            FROM email_inbound_replies r
            JOIN targets t ON t.lead_sequence_id = r.lead_sequence_id
           WHERE r.user_id = $2
        )
        SELECT
          (SELECT COUNT(*) FROM targets) AS audience_count,
          (SELECT COUNT(*) FROM sends) AS sent,
          (SELECT COUNT(*) FROM sends WHERE delivered_at IS NOT NULL) AS delivered,
          (SELECT COUNT(DISTINCT to_address) FROM sends WHERE opened_at IS NOT NULL) AS opened,
          (SELECT COUNT(DISTINCT to_address) FROM sends WHERE clicked_at IS NOT NULL) AS clicked,
          (SELECT COUNT(DISTINCT to_address) FROM sends WHERE replied_at IS NOT NULL) AS replied,
          (SELECT COUNT(DISTINCT lead_sequence_id) FROM intents WHERE parsed_intent = 'interested') AS interested,
          (SELECT COUNT(DISTINCT lead_sequence_id) FROM intents WHERE parsed_intent = 'not_interested') AS not_interested,
          (SELECT COUNT(*) FROM sends WHERE bounced_at IS NOT NULL) AS bounced,
          (SELECT COUNT(*) FROM sends WHERE complained_at IS NOT NULL) AS complained,
          (SELECT COUNT(*) FROM sends WHERE unsubscribed_at IS NOT NULL) AS unsubscribed
      `;
      const r = await pool.query(sql, [req.params.id, req.user.id]);
      const row = r.rows[0] || {};
      const totals = {
        sent: Number(row.sent || 0),
        delivered: Number(row.delivered || 0),
        opened: Number(row.opened || 0),
        clicked: Number(row.clicked || 0),
        replied: Number(row.replied || 0),
        interested: Number(row.interested || 0),
        not_interested: Number(row.not_interested || 0),
        unsubscribed: Number(row.unsubscribed || 0),
        bounced: Number(row.bounced || 0),
        complained: Number(row.complained || 0),
        audience_count: Number(row.audience_count || 0),
      };
      return res.json({
        campaign: {
          id: campaignRow.id,
          name: campaignRow.name,
          status: campaignRow.status,
          audience_count: campaignRow.audience_count,
          launched_at: campaignRow.launched_at,
          completed_at: campaignRow.completed_at,
          sender_category: campaignRow.sender_category,
        },
        totals,
        rates: computeRates(totals),
      });
    } catch (err) {
      console.error('[campaigns.analytics] overall slice failed:', err);
      return res.status(500).json({ error: 'Overall analytics query failed' });
    }
  }

  if (slice === 'by-step') {
    try {
      const sql = `
        WITH targets AS (
          SELECT ct.lead_sequence_id
            FROM campaign_targets ct
           WHERE ct.campaign_id = $1
        ),
        sends AS (
          SELECT se.step_order, esl.id, esl.to_address,
                 esl.delivered_at, esl.opened_at, esl.clicked_at,
                 esl.replied_at, esl.bounced_at
            FROM email_send_log esl
            JOIN sequence_executions se ON se.id = esl.sequence_execution_id
            JOIN targets t ON t.lead_sequence_id = se.lead_sequence_id
           WHERE esl.user_id = $2
        ),
        steps AS (
          SELECT ss.step_order, ss.day_offset, ss.channel, ss.subject
            FROM sequence_steps ss
            JOIN campaigns c ON c.sequence_template_id = ss.sequence_template_id
           WHERE c.id = $1
        ),
        agg AS (
          SELECT
            step_order,
            COUNT(*) AS sent,
            COUNT(*) FILTER (WHERE delivered_at IS NOT NULL) AS delivered,
            COUNT(DISTINCT to_address) FILTER (WHERE opened_at IS NOT NULL) AS opened,
            COUNT(DISTINCT to_address) FILTER (WHERE clicked_at IS NOT NULL) AS clicked,
            COUNT(DISTINCT to_address) FILTER (WHERE replied_at IS NOT NULL) AS replied,
            COUNT(*) FILTER (WHERE bounced_at IS NOT NULL) AS bounced
          FROM sends
          GROUP BY step_order
        )
        SELECT
          s.step_order, s.day_offset, s.channel, s.subject,
          COALESCE(a.sent, 0) AS sent,
          COALESCE(a.delivered, 0) AS delivered,
          COALESCE(a.opened, 0) AS opened,
          COALESCE(a.clicked, 0) AS clicked,
          COALESCE(a.replied, 0) AS replied,
          COALESCE(a.bounced, 0) AS bounced
        FROM steps s
        LEFT JOIN agg a ON a.step_order = s.step_order
        ORDER BY s.step_order ASC
      `;
      const r = await pool.query(sql, [req.params.id, req.user.id]);
      const steps = r.rows.map((row) => {
        const sent = Number(row.sent || 0);
        const delivered = Number(row.delivered || 0);
        const opened = Number(row.opened || 0);
        const clicked = Number(row.clicked || 0);
        const replied = Number(row.replied || 0);
        const bounced = Number(row.bounced || 0);
        const denom = delivered > 0 ? delivered : sent;
        return {
          step_order: Number(row.step_order),
          day_offset: Number(row.day_offset || 0),
          channel: row.channel,
          subject: row.subject,
          sent,
          delivered,
          opened,
          clicked,
          replied,
          bounced,
          open_rate: denom > 0 ? opened / denom : 0,
          click_rate: denom > 0 ? clicked / denom : 0,
          reply_rate: denom > 0 ? replied / denom : 0,
          delivery_rate: sent > 0 ? delivered / sent : 0,
          bounce_rate: sent > 0 ? bounced / sent : 0,
          recommendation: recommendForStep({
            sent, delivered, opened, replied, bounced,
            step_order: Number(row.step_order),
          }),
        };
      });
      return res.json({ steps });
    } catch (err) {
      console.error('[campaigns.analytics] by-step slice failed:', err);
      return res.status(500).json({ error: 'By-step analytics query failed' });
    }
  }

  // by-recipient
  try {
    const limit = Math.min(Number(req.query.limit) || 50, 200);
    const offset = Math.max(Number(req.query.offset) || 0, 0);
    const stepFilter = req.query.step_order ? Number(req.query.step_order) : null;

    // Total count for pagination
    const countSql = `
      SELECT COUNT(*)::int AS total
        FROM campaign_targets ct
       WHERE ct.campaign_id = $1
    `;
    const countRes = await pool.query(countSql, [req.params.id]);
    const total = countRes.rows[0]?.total ?? 0;

    const params = [req.params.id, req.user.id, limit, offset];
    let stepFilterClause = '';
    if (stepFilter !== null && !Number.isNaN(stepFilter)) {
      params.push(stepFilter);
      stepFilterClause = ` AND last_send.step_order = $${params.length}`;
    }

    const sql = `
      WITH targets AS (
        SELECT ct.id, ct.target_email, ct.target_name, ct.lead_sequence_id,
               ct.status AS target_status, ls.status AS lead_sequence_status
          FROM campaign_targets ct
          LEFT JOIN lead_sequences ls ON ls.id = ct.lead_sequence_id
         WHERE ct.campaign_id = $1
      ),
      last_send AS (
        SELECT DISTINCT ON (se.lead_sequence_id)
               se.lead_sequence_id, se.step_order,
               esl.sent_at, esl.delivered_at, esl.opened_at,
               esl.clicked_at, esl.replied_at, esl.bounced_at
          FROM email_send_log esl
          JOIN sequence_executions se ON se.id = esl.sequence_execution_id
         WHERE esl.user_id = $2
           AND se.lead_sequence_id IN (SELECT lead_sequence_id FROM targets WHERE lead_sequence_id IS NOT NULL)
         ORDER BY se.lead_sequence_id, esl.sent_at DESC
      ),
      reply_intent AS (
        SELECT DISTINCT ON (r.lead_sequence_id)
               r.lead_sequence_id, r.parsed_intent, r.received_at
          FROM email_inbound_replies r
         WHERE r.user_id = $2
         ORDER BY r.lead_sequence_id, r.received_at DESC
      )
      SELECT t.id AS target_id, t.target_email, t.target_name, t.target_status,
             t.lead_sequence_id, t.lead_sequence_status,
             last_send.step_order, last_send.sent_at, last_send.delivered_at,
             last_send.opened_at, last_send.clicked_at, last_send.replied_at,
             last_send.bounced_at,
             reply_intent.parsed_intent, reply_intent.received_at AS reply_received_at,
             CASE
               WHEN last_send.bounced_at IS NOT NULL THEN 'bounced'
               WHEN last_send.replied_at IS NOT NULL THEN 'replied'
               WHEN last_send.clicked_at IS NOT NULL THEN 'clicked'
               WHEN last_send.opened_at  IS NOT NULL THEN 'opened'
               WHEN last_send.delivered_at IS NOT NULL THEN 'delivered'
               WHEN last_send.sent_at IS NOT NULL THEN 'sent'
               ELSE 'queued'
             END AS last_stage
        FROM targets t
        LEFT JOIN last_send ON last_send.lead_sequence_id = t.lead_sequence_id
        LEFT JOIN reply_intent ON reply_intent.lead_sequence_id = t.lead_sequence_id
       WHERE 1 = 1${stepFilterClause}
       ORDER BY last_send.sent_at DESC NULLS LAST, t.target_email ASC
       LIMIT $3 OFFSET $4
    `;
    const r = await pool.query(sql, params);
    const recipients = r.rows.map((row) => ({
      target_id: row.target_id,
      target_email: row.target_email,
      target_name: row.target_name,
      lead_sequence_id: row.lead_sequence_id,
      lead_sequence_status: row.lead_sequence_status,
      last_stage: row.last_stage,
      step_order: row.step_order != null ? Number(row.step_order) : null,
      stages: {
        sent_at: row.sent_at,
        delivered_at: row.delivered_at,
        opened_at: row.opened_at,
        clicked_at: row.clicked_at,
        replied_at: row.replied_at,
        bounced_at: row.bounced_at,
        parsed_intent: row.parsed_intent,
        reply_received_at: row.reply_received_at,
      },
    }));
    return res.json({
      recipients,
      total,
      limit,
      offset,
    });
  } catch (err) {
    console.error('[campaigns.analytics] by-recipient slice failed:', err);
    return res.status(500).json({ error: 'By-recipient analytics query failed' });
  }
});

// ----- GET /:id/activity --------------------------------------------------
//
// Recent activity feed — UNION of replies, bounces, unsubscribes, and
// send-batches scoped to this campaign. Used by the right rail on
// CampaignDetail.tsx.

router.get('/:id/activity', authenticate, [param('id').isUUID()], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ error: 'Invalid campaign ID' });

  const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100);

  try {
    const owner = await pool.query(
      'SELECT id FROM campaigns WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );
    if (owner.rows.length === 0) return res.status(404).json({ error: 'Campaign not found' });

    const sql = `
      WITH targets AS (
        SELECT ct.lead_sequence_id, ct.target_email, ct.target_name
          FROM campaign_targets ct
         WHERE ct.campaign_id = $1
      ),
      replies AS (
        SELECT 'reply'::text AS type,
               r.received_at AS ts,
               r.from_address AS recipient,
               COALESCE(r.parsed_intent, 'reply') AS summary,
               r.id::text AS link
          FROM email_inbound_replies r
          JOIN targets t ON t.lead_sequence_id = r.lead_sequence_id
         WHERE r.user_id = $2
      ),
      bounces AS (
        SELECT 'bounce'::text AS type,
               esl.bounced_at AS ts,
               esl.to_address AS recipient,
               COALESCE(esl.bounce_type, 'bounced') AS summary,
               esl.id::text AS link
          FROM email_send_log esl
          JOIN sequence_executions se ON se.id = esl.sequence_execution_id
          JOIN targets t ON t.lead_sequence_id = se.lead_sequence_id
         WHERE esl.user_id = $2 AND esl.bounced_at IS NOT NULL
      ),
      unsubs AS (
        SELECT 'unsubscribe'::text AS type,
               esl.unsubscribed_at AS ts,
               esl.to_address AS recipient,
               'unsubscribed'::text AS summary,
               esl.id::text AS link
          FROM email_send_log esl
          JOIN sequence_executions se ON se.id = esl.sequence_execution_id
          JOIN targets t ON t.lead_sequence_id = se.lead_sequence_id
         WHERE esl.user_id = $2 AND esl.unsubscribed_at IS NOT NULL
      ),
      batches AS (
        SELECT 'send_batch'::text AS type,
               date_trunc('hour', esl.sent_at) AS ts,
               NULL::text AS recipient,
               'sent ' || COUNT(*)::text || ' to step ' || se.step_order::text AS summary,
               se.step_order::text AS link
          FROM email_send_log esl
          JOIN sequence_executions se ON se.id = esl.sequence_execution_id
          JOIN targets t ON t.lead_sequence_id = se.lead_sequence_id
         WHERE esl.user_id = $2 AND esl.sent_at IS NOT NULL
         GROUP BY date_trunc('hour', esl.sent_at), se.step_order
      )
      SELECT type, ts AS timestamp, recipient, summary, link
        FROM (
          SELECT * FROM replies
          UNION ALL SELECT * FROM bounces
          UNION ALL SELECT * FROM unsubs
          UNION ALL SELECT * FROM batches
        ) merged
       WHERE ts IS NOT NULL
       ORDER BY ts DESC
       LIMIT $3
    `;
    const r = await pool.query(sql, [req.params.id, req.user.id, limit]);
    res.json({ activity: r.rows });
  } catch (err) {
    console.error('[campaigns.activity] query failed:', err);
    res.status(500).json({ error: 'Activity feed query failed' });
  }
});

// ----- POST / create draft -----------------------------------------------

router.post('/', authenticate, [
  body('name').isString().trim().notEmpty().withMessage('name required'),
  body('audience_type').isIn(['buyers', 'agents', 'csv']).withMessage('audience_type invalid'),
  body('sequence_template_id').optional({ nullable: true }).isUUID().withMessage('sequence_template_id must be UUID'),
  body('sender_category').optional().isString(),
  body('send_window_start_hour').optional({ nullable: true }).isInt({ min: 0, max: 23 }),
  body('send_window_end_hour').optional({ nullable: true }).isInt({ min: 0, max: 23 }),
  body('send_window_days').optional({ nullable: true }).isArray(),
  body('daily_cap').optional({ nullable: true }).isInt({ min: 1, max: 10000 }),
  body('start_at').optional({ nullable: true }).isISO8601(),
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: 'Validation failed', errors: errors.array() });
  }

  const {
    name,
    audience_type,
    audience_filter,
    sequence_template_id,
    sender_category,
    send_window_start_hour,
    send_window_end_hour,
    send_window_days,
    daily_cap,
    start_at,
  } = req.body;

  const result = await pool.query(
    `INSERT INTO campaigns (
       user_id, name, status, audience_type, audience_filter,
       sequence_template_id, sender_category,
       send_window_start_hour, send_window_end_hour, send_window_days,
       daily_cap, start_at
     ) VALUES (
       $1, $2, 'draft', $3, $4,
       $5, $6,
       $7, $8, $9,
       $10, $11
     )
     RETURNING *`,
    [
      req.user.id,
      name,
      audience_type,
      audience_filter ? JSON.stringify(audience_filter) : '{}',
      sequence_template_id || null,
      sender_category || 'outreach',
      send_window_start_hour ?? null,
      send_window_end_hour ?? null,
      Array.isArray(send_window_days) ? send_window_days : null,
      daily_cap ?? null,
      start_at || null,
    ]
  );
  res.status(201).json({ campaign: result.rows[0] });
}));

// ----- POST /:id/preview-audience ----------------------------------------

router.post('/:id/preview-audience', authenticate, [param('id').isUUID()], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ error: 'Invalid campaign ID' });

  const c = await pool.query(
    'SELECT * FROM campaigns WHERE id = $1 AND user_id = $2',
    [req.params.id, req.user.id]
  );
  if (c.rows.length === 0) return res.status(404).json({ error: 'Campaign not found' });

  const campaign = c.rows[0];
  const filter = req.body?.filter || campaign.audience_filter || {};

  if (campaign.audience_type === 'buyers') {
    const wh = buildAudienceWhere(filter, 2);
    const sql = `
      SELECT id, first_name, last_name, email, phone, company, criteria, tags
      FROM buyers
      WHERE user_id = $1 AND unsubscribed_at IS NULL${wh.whereClause}
      ORDER BY created_at DESC
      LIMIT 500
    `;
    const r = await pool.query(sql, [req.user.id, ...wh.params]);
    return res.json({
      count: r.rows.length,
      sample: pickFirstFive(r.rows),
    });
  }

  if (campaign.audience_type === 'agents') {
    const client = await pool.connect();
    try {
      const exists = await tableExists(client, 'agents');
      if (!exists) {
        return res.json({ count: 0, sample: [], message: 'agents table not ready' });
      }
      const wh = buildAudienceWhere(filter, 2);
      const sql = `
        SELECT id, name, email, phone, brokerage, market, state, city, tags
        FROM agents
        WHERE user_id = $1${wh.whereClause}
        ORDER BY COALESCE(last_listing_seen_at, created_at) DESC
        LIMIT 500
      `;
      const r = await client.query(sql, [req.user.id, ...wh.params]);
      return res.json({
        count: r.rows.length,
        sample: pickFirstFive(r.rows),
      });
    } finally {
      client.release();
    }
  }

  if (campaign.audience_type === 'csv') {
    const rows = Array.isArray(filter.csv_rows) ? filter.csv_rows : [];
    return res.json({
      count: rows.length,
      sample: pickFirstFive(rows),
    });
  }

  return res.json({ count: 0, sample: [] });
}));

// ----- POST /:id/launch ---------------------------------------------------

router.post('/:id/launch', authenticate, [param('id').isUUID()], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ error: 'Invalid campaign ID' });

  const client = await pool.connect();
  let stats = {
    audience_resolved: 0,
    targets_inserted: 0,
    targets_skipped_suppressed: 0,
    targets_skipped_duplicate: 0,
    targets_skipped_no_email: 0,
    executions_inserted: 0,
  };

  try {
    await client.query('BEGIN');

    const lockRes = await client.query(
      'SELECT * FROM campaigns WHERE id = $1 AND user_id = $2 FOR UPDATE',
      [req.params.id, req.user.id]
    );
    if (lockRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Campaign not found' });
    }
    const campaign = lockRes.rows[0];
    if (campaign.status !== 'draft') {
      await client.query('ROLLBACK');
      return res.status(409).json({
        error: `Cannot launch campaign in status '${campaign.status}'`,
        code: 'INVALID_STATE',
      });
    }
    if (!campaign.sequence_template_id) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Campaign has no sequence_template_id' });
    }

    // Load sequence steps once.
    const stepsRes = await client.query(
      `SELECT step_order, day_offset, channel, subject, message_template
       FROM sequence_steps
       WHERE sequence_template_id = $1
       ORDER BY step_order ASC`,
      [campaign.sequence_template_id]
    );
    const steps = stepsRes.rows;
    if (steps.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Sequence template has no steps' });
    }

    // Resolve audience.
    const filter = campaign.audience_filter || {};
    let contacts = [];

    if (campaign.audience_type === 'buyers') {
      const wh = buildAudienceWhere(filter, 2);
      const r = await client.query(
        `SELECT id, first_name, last_name, email, phone, company, criteria, tags
         FROM buyers
         WHERE user_id = $1 AND unsubscribed_at IS NULL${wh.whereClause}
         ORDER BY created_at DESC
         LIMIT 5000`,
        [req.user.id, ...wh.params]
      );
      contacts = r.rows.map((b) => ({
        target_type: 'buyer',
        target_id: b.id,
        target_email: b.email || null,
        target_phone: b.phone || null,
        target_name: [b.first_name, b.last_name].filter(Boolean).join(' ').trim(),
        target_variables: {
          first_name: b.first_name || '',
          last_name: b.last_name || '',
          seller_name: [b.first_name, b.last_name].filter(Boolean).join(' ').trim(),
          your_company: b.company || '',
        },
      }));
    } else if (campaign.audience_type === 'agents') {
      const exists = await tableExists(client, 'agents');
      if (!exists) {
        await client.query('ROLLBACK');
        return res.status(409).json({ error: 'agents table not ready', code: 'AGENTS_NOT_READY' });
      }
      const wh = buildAudienceWhere(filter, 2);
      const r = await client.query(
        `SELECT id, name, email, phone, brokerage, market, state, city, tags
         FROM agents
         WHERE user_id = $1${wh.whereClause}
         ORDER BY COALESCE(last_listing_seen_at, created_at) DESC
         LIMIT 5000`,
        [req.user.id, ...wh.params]
      );
      contacts = r.rows.map((a) => {
        const [firstName, ...rest] = (a.name || '').split(/\s+/);
        return {
          target_type: 'agent',
          target_id: a.id,
          target_email: a.email || null,
          target_phone: a.phone || null,
          target_name: a.name || '',
          target_variables: {
            first_name: firstName || '',
            last_name: rest.join(' '),
            seller_name: a.name || '',
            your_company: a.brokerage || '',
          },
        };
      });
    } else if (campaign.audience_type === 'csv') {
      const rows = Array.isArray(filter.csv_rows) ? filter.csv_rows : [];
      contacts = rows.map((r) => ({
        target_type: 'csv_row',
        target_id: null,
        target_email: r.email || null,
        target_phone: r.phone || null,
        target_name: [r.first_name, r.last_name].filter(Boolean).join(' ').trim() || r.name || '',
        target_variables: {
          first_name: r.first_name || '',
          last_name: r.last_name || '',
          seller_name: [r.first_name, r.last_name].filter(Boolean).join(' ').trim() || r.name || '',
          property_address: r.property_address || '',
        },
      }));
    }

    stats.audience_resolved = contacts.length;

    // Drop contacts with no email (the only channel this worker can dispatch).
    contacts = contacts.filter((c) => {
      if (!c.target_email) {
        stats.targets_skipped_no_email++;
        return false;
      }
      return true;
    });

    // Drop suppressed emails. Per-user suppression list, case-insensitive.
    if (contacts.length > 0) {
      const emails = contacts.map((c) => c.target_email.toLowerCase());
      const supRes = await client.query(
        `SELECT LOWER(email) AS email FROM email_suppressions
         WHERE user_id = $1 AND LOWER(email) = ANY($2::text[])`,
        [req.user.id, emails]
      );
      const suppressed = new Set(supRes.rows.map((r) => r.email));
      const before = contacts.length;
      contacts = contacts.filter((c) => !suppressed.has(c.target_email.toLowerCase()));
      stats.targets_skipped_suppressed = before - contacts.length;
    }

    // Daily-cap pacing — assign each contact to a "day bucket" so we don't
    // exceed daily_cap on day 0. Within a bucket each contact gets the same
    // base scheduled time, then nextAllowedSendTime() snaps it into the
    // allowed window. If daily_cap is null/0 we put everything on day 0.
    const cap = campaign.daily_cap && campaign.daily_cap > 0 ? campaign.daily_cap : null;
    const startBase = campaign.start_at ? new Date(campaign.start_at) : new Date();
    const sendWindow = buildSendWindow(campaign);

    // Insert targets + lead_sequences + sequence_executions per contact.
    for (let i = 0; i < contacts.length; i++) {
      const contact = contacts[i];
      const dayBucket = cap ? Math.floor(i / cap) : 0;
      const contactBase = new Date(startBase.getTime() + dayBucket * ONE_DAY_MS);

      try {
        // 1. lead_sequences (lead_id = NULL — relaxed in migration 024).
        const ls = await client.query(
          `INSERT INTO lead_sequences (
             lead_id, user_id, sequence_template_id, status, variables, current_step
           ) VALUES (NULL, $1, $2, 'active', $3, 0)
           RETURNING id`,
          [req.user.id, campaign.sequence_template_id, JSON.stringify(contact.target_variables)]
        );
        const leadSequenceId = ls.rows[0].id;

        // 2. sequence_executions for each step.
        for (const step of steps) {
          const candidate = new Date(contactBase.getTime() + Number(step.day_offset) * ONE_DAY_MS);
          const scheduled = nextAllowedSendTime(candidate, sendWindow);
          await client.query(
            `INSERT INTO sequence_executions (
               lead_sequence_id, step_order, channel, scheduled_date, status
             ) VALUES ($1, $2, $3, $4, 'pending')`,
            [leadSequenceId, step.step_order, step.channel, scheduled.toISOString()]
          );
          stats.executions_inserted++;
        }

        // 3. campaign_targets — partial unique index catches duplicates by
        //    (campaign_id, lower(email)). Catch 23505 and count, don't bomb
        //    the txn.
        try {
          await client.query(
            `INSERT INTO campaign_targets (
               campaign_id, target_type, target_id, target_email, target_phone,
               target_name, target_variables, lead_sequence_id, status
             ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'queued')`,
            [
              campaign.id,
              contact.target_type,
              contact.target_id,
              contact.target_email,
              contact.target_phone,
              contact.target_name,
              JSON.stringify(contact.target_variables),
              leadSequenceId,
            ]
          );
          stats.targets_inserted++;
        } catch (insErr) {
          if (insErr.code === '23505') {
            stats.targets_skipped_duplicate++;
            // Orphan the lead_sequence row we just inserted — it'd otherwise
            // send a duplicate sequence. Status=cancelled keeps the audit
            // trail intact without firing the executions.
            await client.query(
              `UPDATE lead_sequences SET status = 'cancelled' WHERE id = $1`,
              [leadSequenceId]
            );
            await client.query(
              `UPDATE sequence_executions SET status = 'cancelled'
               WHERE lead_sequence_id = $1 AND status = 'pending'`,
              [leadSequenceId]
            );
          } else {
            throw insErr;
          }
        }
      } catch (perRowErr) {
        // A per-row failure means the whole campaign is suspect — rollback.
        await client.query('ROLLBACK');
        throw perRowErr;
      }
    }

    // Update campaign metadata.
    await client.query(
      `UPDATE campaigns
       SET status = 'scheduled',
           audience_count = $1,
           launched_at = NOW(),
           start_at = COALESCE(start_at, NOW())
       WHERE id = $2`,
      [stats.targets_inserted, campaign.id]
    );

    await client.query('COMMIT');

    res.json({
      ok: true,
      campaign_id: campaign.id,
      status: 'scheduled',
      stats,
    });
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch (_) { /* swallow */ }
    throw err;
  } finally {
    client.release();
  }
}));

// ----- POST /:id/pause | /:id/resume | /:id/cancel ------------------------

function bulkLeadSeqStatusUpdate(targetStatus, dbStatus) {
  return asyncHandler(async (req, res) => {
    const c = await pool.query(
      'SELECT id FROM campaigns WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );
    if (c.rows.length === 0) return res.status(404).json({ error: 'Campaign not found' });

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      // Update the lead_sequences rows attached to the campaign's targets.
      const r = await client.query(
        `UPDATE lead_sequences
         SET status = $1
         WHERE id IN (
           SELECT lead_sequence_id FROM campaign_targets
           WHERE campaign_id = $2 AND lead_sequence_id IS NOT NULL
         )
         RETURNING id`,
        [targetStatus, req.params.id]
      );
      // Update the campaign status too.
      await client.query(
        'UPDATE campaigns SET status = $1 WHERE id = $2',
        [dbStatus, req.params.id]
      );
      await client.query('COMMIT');
      res.json({ ok: true, sequences_updated: r.rowCount });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  });
}

router.post('/:id/pause', authenticate, [param('id').isUUID()],
  bulkLeadSeqStatusUpdate('paused', 'paused'));

router.post('/:id/resume', authenticate, [param('id').isUUID()],
  bulkLeadSeqStatusUpdate('active', 'running'));

router.post('/:id/cancel', authenticate, [param('id').isUUID()],
  bulkLeadSeqStatusUpdate('cancelled', 'cancelled'));

// ----- POST /test-send ---------------------------------------------------

router.post('/test-send', authenticate, [
  body('to').isEmail().withMessage('to must be an email'),
  body('subject').isString().notEmpty(),
  body('message_template').isString().notEmpty(),
  body('variables').optional().isObject(),
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: 'Validation failed', errors: errors.array() });
  }
  const { to, subject, message_template, variables } = req.body;
  const vars = variables || {};
  const renderedSubject = renderTemplate(subject, vars);
  const renderedBody = renderTemplate(message_template, vars);

  try {
    const fromAddress = getSender('outreach');
    const replyTo = getReplyTo('outreach');
    const sendPayload = {
      from: fromAddress,
      to,
      subject: renderedSubject,
      text: renderedBody,
    };
    if (replyTo) sendPayload.reply_to = replyTo;
    const send = await resend.emails.send(sendPayload);
    if (send.error) {
      return res.status(502).json({ ok: false, error: send.error.message || 'Resend error' });
    }
    res.json({ ok: true, message_id: send.data?.id || null });
  } catch (err) {
    return res.status(502).json({ ok: false, error: err.message || 'Send failed' });
  }
}));

module.exports = router;
