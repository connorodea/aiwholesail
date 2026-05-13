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
const { getSender } = require('../lib/senders');
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
    const send = await resend.emails.send({
      from: fromAddress,
      to,
      subject: renderedSubject,
      text: renderedBody,
    });
    if (send.error) {
      return res.status(502).json({ ok: false, error: send.error.message || 'Resend error' });
    }
    res.json({ ok: true, message_id: send.data?.id || null });
  } catch (err) {
    return res.status(502).json({ ok: false, error: err.message || 'Send failed' });
  }
}));

module.exports = router;
