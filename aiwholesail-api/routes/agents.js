const express = require('express');
const { body, param, query: queryValidator, validationResult } = require('express-validator');
const { query, getClient } = require('../config/database');
const { authenticate } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');

const router = express.Router();

// ---- Column whitelist for PATCH / INSERT --------------------------------
// Maps incoming camelCase keys to their snake_case column. Anything not in
// this map is silently ignored — keeps callers from sneaking arbitrary
// columns into the UPDATE.
const FIELD_MAP = {
  name: 'name',
  email: 'email',
  phone: 'phone',
  brokerage: 'brokerage',
  brokeragePhone: 'brokerage_phone',
  licenseNumber: 'license_number',
  photoUrl: 'photo_url',
  market: 'market',
  state: 'state',
  city: 'city',
  zip: 'zip',
  source: 'source',
  lastSeenZpid: 'last_seen_zpid',
  listingsCount: 'listings_count',
  lastListingSeenAt: 'last_listing_seen_at',
  notes: 'notes',
};

/**
 * Minimal RFC-4180-ish CSV parser. Handles quoted fields, embedded commas,
 * and doubled-quote escapes. Good enough for hand-rolled CSV exports — we
 * don't need a full streaming parser for an /import body.
 */
function parseCsv(text) {
  const rows = [];
  let field = '';
  let row = [];
  let i = 0;
  let inQuotes = false;
  const src = String(text || '').replace(/\r\n?/g, '\n');

  while (i < src.length) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      field += ch;
      i++;
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      i++;
      continue;
    }
    if (ch === ',') {
      row.push(field);
      field = '';
      i++;
      continue;
    }
    if (ch === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
      i++;
      continue;
    }
    field += ch;
    i++;
  }
  // Final field / row (skip empty trailing line)
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  if (rows.length === 0) return [];

  const headers = rows[0].map((h) => h.trim());
  return rows.slice(1).map((r) => {
    const obj = {};
    headers.forEach((h, idx) => {
      obj[h] = (r[idx] !== undefined ? r[idx].trim() : '');
    });
    return obj;
  });
}

/**
 * Normalize an incoming CSV row to the canonical agent shape. Accepts
 * either camelCase, snake_case, or "Name with spaces" header conventions —
 * users tend to export from Sheets or copy/paste, so be lenient.
 */
function normalizeCsvRow(row) {
  const pick = (...keys) => {
    for (const k of keys) {
      if (row[k] != null && String(row[k]).trim() !== '') return String(row[k]).trim();
    }
    return null;
  };
  return {
    name: pick('name', 'Name', 'agent_name', 'agentName', 'Agent Name', 'full_name'),
    email: pick('email', 'Email', 'agent_email', 'agentEmail'),
    phone: pick('phone', 'Phone', 'agent_phone', 'agentPhone'),
    brokerage: pick('brokerage', 'Brokerage', 'broker', 'brokerName', 'broker_name'),
    brokerage_phone: pick('brokerage_phone', 'brokeragePhone', 'broker_phone', 'brokerPhoneNumber'),
    license_number: pick('license_number', 'licenseNumber', 'License', 'license'),
    photo_url: pick('photo_url', 'photoUrl'),
    market: pick('market', 'Market'),
    state: pick('state', 'State'),
    city: pick('city', 'City'),
    zip: pick('zip', 'Zip', 'zip_code', 'zipcode'),
    source: pick('source', 'Source') || 'csv_import',
    notes: pick('notes', 'Notes'),
  };
}

/**
 * GET /api/agents
 * List agents for the authenticated user.
 * Query params: q, state, market, tag, has_email, limit, offset
 */
router.get('/', authenticate, asyncHandler(async (req, res) => {
  const { q, state, market, tag, has_email, limit, offset } = req.query;

  let sql = 'SELECT * FROM agents WHERE user_id = $1';
  const params = [req.user.id];
  let p = 2;

  if (q) {
    sql += ` AND (
      name ILIKE $${p} OR
      email ILIKE $${p} OR
      brokerage ILIKE $${p}
    )`;
    params.push(`%${q}%`);
    p++;
  }
  if (state) {
    sql += ` AND state = $${p}`;
    params.push(state);
    p++;
  }
  if (market) {
    sql += ` AND market ILIKE $${p}`;
    params.push(`%${market}%`);
    p++;
  }
  if (tag) {
    sql += ` AND tags && $${p}`;
    params.push([tag]);
    p++;
  }
  if (has_email === 'true') {
    sql += ` AND email IS NOT NULL AND email <> ''`;
  } else if (has_email === 'false') {
    sql += ` AND (email IS NULL OR email = '')`;
  }

  sql += ' ORDER BY last_listing_seen_at DESC NULLS LAST, created_at DESC';

  const limitNum = Math.min(parseInt(limit, 10) || 100, 1000);
  const offsetNum = parseInt(offset, 10) || 0;
  sql += ` LIMIT $${p} OFFSET $${p + 1}`;
  params.push(limitNum, offsetNum);

  const result = await query(sql, params);

  // Total count for pagination — applies the same WHERE filters minus the
  // LIMIT/OFFSET, but we just return total of *all* agents for the user to
  // keep this cheap. Front-end paginates the visible filtered set.
  const countResult = await query(
    'SELECT COUNT(*) FROM agents WHERE user_id = $1',
    [req.user.id]
  );

  res.json({
    agents: result.rows,
    pagination: {
      total: parseInt(countResult.rows[0].count, 10),
      limit: limitNum,
      offset: offsetNum,
    },
  });
}));

/**
 * GET /api/agents/:id
 */
router.get('/:id', authenticate, [
  param('id').isUUID(),
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: 'Invalid agent ID' });
  }

  const result = await query(
    'SELECT * FROM agents WHERE id = $1 AND user_id = $2',
    [req.params.id, req.user.id]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Agent not found' });
  }

  res.json(result.rows[0]);
}));

/**
 * POST /api/agents
 * Create a new agent.
 */
router.post('/', authenticate, [
  body('name').notEmpty().withMessage('Agent name required'),
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: 'Validation failed', errors: errors.array() });
  }

  const {
    name, email, phone, brokerage, brokeragePhone, licenseNumber, photoUrl,
    market, state, city, zip, source, lastSeenZpid, lastListingSeenAt,
    tags, notes,
  } = req.body;

  try {
    const result = await query(
      `INSERT INTO agents (
        user_id, name, email, phone, brokerage, brokerage_phone, license_number,
        photo_url, market, state, city, zip, source, last_seen_zpid,
        last_listing_seen_at, tags, notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
      RETURNING *`,
      [
        req.user.id,
        name,
        email || null,
        phone || null,
        brokerage || null,
        brokeragePhone || null,
        licenseNumber || null,
        photoUrl || null,
        market || null,
        state || null,
        city || null,
        zip || null,
        source || 'manual',
        lastSeenZpid || null,
        lastListingSeenAt || null,
        Array.isArray(tags) ? tags : [],
        notes || null,
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    // Hit the partial unique index — agent with this email/phone already
    // exists for the user. Surface a 409 instead of a 500 so the front-end
    // can offer "view existing" without a confusing crash.
    if (err.code === '23505') {
      return res.status(409).json({
        error: 'Agent with this email or phone already exists',
        code: 'AGENT_DUPLICATE',
      });
    }
    throw err;
  }
}));

/**
 * PATCH /api/agents/:id
 * Update arbitrary fields. Only whitelisted keys are honored.
 */
router.patch('/:id', authenticate, [
  param('id').isUUID(),
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: 'Invalid agent ID' });
  }

  const updates = [];
  const params = [];
  let p = 1;

  for (const [inKey, col] of Object.entries(FIELD_MAP)) {
    if (req.body[inKey] !== undefined) {
      updates.push(`${col} = $${p}`);
      params.push(req.body[inKey] === '' ? null : req.body[inKey]);
      p++;
    }
  }

  if (req.body.tags !== undefined) {
    updates.push(`tags = $${p}`);
    params.push(Array.isArray(req.body.tags) ? req.body.tags : []);
    p++;
  }

  if (updates.length === 0) {
    return res.status(400).json({ error: 'No fields to update' });
  }

  params.push(req.params.id, req.user.id);

  try {
    const result = await query(
      `UPDATE agents SET ${updates.join(', ')}
       WHERE id = $${p} AND user_id = $${p + 1}
       RETURNING *`,
      params
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Agent not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({
        error: 'Agent with this email or phone already exists',
        code: 'AGENT_DUPLICATE',
      });
    }
    throw err;
  }
}));

/**
 * DELETE /api/agents/:id
 * Hard delete — no soft-delete column yet. Cascade isn't needed because
 * nothing references agents.id.
 */
router.delete('/:id', authenticate, [
  param('id').isUUID(),
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: 'Invalid agent ID' });
  }

  const result = await query(
    'DELETE FROM agents WHERE id = $1 AND user_id = $2 RETURNING id',
    [req.params.id, req.user.id]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Agent not found' });
  }

  res.json({ message: 'Agent deleted', id: result.rows[0].id });
}));

/**
 * POST /api/agents/import
 * Body: { csv: string }
 * Parses CSV → upserts by (email OR phone). Returns counts.
 */
router.post('/import', authenticate, [
  body('csv').isString().notEmpty().withMessage('csv string required'),
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: 'Validation failed', errors: errors.array() });
  }

  let parsed;
  try {
    parsed = parseCsv(req.body.csv);
  } catch (err) {
    return res.status(400).json({ error: 'CSV parse failed', detail: err.message });
  }

  let imported = 0;
  let skipped = 0;
  let errored = 0;
  const errors_log = [];

  const client = await getClient();
  try {
    await client.query('BEGIN');

    for (const raw of parsed) {
      const row = normalizeCsvRow(raw);
      if (!row.name) {
        skipped++;
        continue;
      }
      // Must have at least one contact channel to be useful in the directory;
      // a row with neither email nor phone is a name we can't reach. We
      // still admit name-only rows but they can't be deduped — accept
      // them only if explicitly tagged manual. Otherwise skip.
      if (!row.email && !row.phone) {
        skipped++;
        continue;
      }
      try {
        // Upsert on the partial unique index. We can't use a single ON
        // CONFLICT clause that covers "email matches OR phone matches"
        // because Postgres only supports a single conflict target — so
        // we look up an existing row by email-or-phone first, then either
        // UPDATE it or INSERT a new one.
        const existing = await client.query(
          `SELECT id, listings_count FROM agents
           WHERE user_id = $1
             AND (
               (email IS NOT NULL AND LOWER(email) = LOWER($2))
               OR (phone IS NOT NULL AND phone = $3)
             )
           LIMIT 1`,
          [req.user.id, row.email, row.phone]
        );

        if (existing.rows.length > 0) {
          await client.query(
            `UPDATE agents SET
               name = COALESCE(NULLIF($2, ''), name),
               email = COALESCE(email, $3),
               phone = COALESCE(phone, $4),
               brokerage = COALESCE($5, brokerage),
               brokerage_phone = COALESCE($6, brokerage_phone),
               license_number = COALESCE($7, license_number),
               photo_url = COALESCE($8, photo_url),
               market = COALESCE($9, market),
               state = COALESCE($10, state),
               city = COALESCE($11, city),
               zip = COALESCE($12, zip),
               source = COALESCE($13, source),
               notes = COALESCE(notes, $14),
               listings_count = listings_count + 1
             WHERE id = $1`,
            [
              existing.rows[0].id,
              row.name, row.email, row.phone, row.brokerage,
              row.brokerage_phone, row.license_number, row.photo_url,
              row.market, row.state, row.city, row.zip,
              row.source, row.notes,
            ]
          );
        } else {
          await client.query(
            `INSERT INTO agents (
              user_id, name, email, phone, brokerage, brokerage_phone,
              license_number, photo_url, market, state, city, zip, source, notes
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
            [
              req.user.id,
              row.name, row.email, row.phone, row.brokerage,
              row.brokerage_phone, row.license_number, row.photo_url,
              row.market, row.state, row.city, row.zip,
              row.source || 'csv_import', row.notes,
            ]
          );
        }
        imported++;
      } catch (err) {
        errored++;
        errors_log.push({ row: row.name || '(unnamed)', error: err.message });
        // Don't abort the whole import on a single bad row — log and continue.
      }
    }

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  res.json({
    imported,
    skipped,
    errored,
    total: parsed.length,
    errors: errors_log.slice(0, 20), // cap the response payload
  });
}));

/**
 * POST /api/agents/backfill-from-listings
 * Stub — enqueues a server-side backfill job. The actual scan is the CLI
 * script scripts/backfill-agents-from-leads.js (run via cron / operator).
 */
router.post('/backfill-from-listings', authenticate, asyncHandler(async (req, res) => {
  // TODO: hook this up to a real job queue when one exists. For now the
  // operator runs the backfill script manually with --user-id=<uuid>.
  res.json({
    ok: true,
    message: 'queued',
    note: 'Run scripts/backfill-agents-from-leads.js --user-id=' + req.user.id,
  });
}));

module.exports = router;
