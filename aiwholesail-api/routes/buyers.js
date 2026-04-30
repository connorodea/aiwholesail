const express = require('express');
const { body, param, validationResult } = require('express-validator');
const { query, getClient } = require('../config/database');
const { authenticate } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');

const router = express.Router();

/**
 * GET /api/buyers
 * List all buyers for the authenticated user
 */
router.get('/', authenticate, asyncHandler(async (req, res) => {
  const { search, tags, location, limit, offset } = req.query;

  let sql = 'SELECT * FROM buyers WHERE user_id = $1';
  const params = [req.user.id];
  let paramIndex = 2;

  if (search) {
    sql += ` AND (
      first_name ILIKE $${paramIndex} OR
      last_name ILIKE $${paramIndex} OR
      company ILIKE $${paramIndex} OR
      email ILIKE $${paramIndex} OR
      phone ILIKE $${paramIndex}
    )`;
    params.push(`%${search}%`);
    paramIndex++;
  }

  if (tags) {
    const tagList = tags.split(',').map(t => t.trim());
    sql += ` AND tags && $${paramIndex}`;
    params.push(tagList);
    paramIndex++;
  }

  if (location) {
    sql += ` AND criteria->'locations' @> $${paramIndex}::jsonb`;
    params.push(JSON.stringify([location]));
    paramIndex++;
  }

  sql += ' ORDER BY created_at DESC';

  const limitNum = Math.min(parseInt(limit) || 100, 500);
  const offsetNum = parseInt(offset) || 0;
  sql += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
  params.push(limitNum, offsetNum);

  const result = await query(sql, params);

  const countResult = await query(
    'SELECT COUNT(*) FROM buyers WHERE user_id = $1',
    [req.user.id]
  );

  res.json({
    buyers: result.rows,
    pagination: {
      total: parseInt(countResult.rows[0].count),
      limit: limitNum,
      offset: offsetNum,
    },
  });
}));

/**
 * GET /api/buyers/:id
 * Get a single buyer
 */
router.get('/:id', authenticate, [
  param('id').isUUID(),
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: 'Invalid buyer ID' });
  }

  const result = await query(
    'SELECT * FROM buyers WHERE id = $1 AND user_id = $2',
    [req.params.id, req.user.id]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Buyer not found' });
  }

  res.json(result.rows[0]);
}));

/**
 * POST /api/buyers
 * Create a new buyer
 */
router.post('/', authenticate, [
  body('firstName').notEmpty().withMessage('First name required'),
  body('lastName').notEmpty().withMessage('Last name required'),
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: 'Validation failed', errors: errors.array() });
  }

  const { firstName, lastName, company, email, phone, criteria, tags, notes } = req.body;

  const result = await query(
    `INSERT INTO buyers (user_id, first_name, last_name, company, email, phone, criteria, tags, notes)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING *`,
    [
      req.user.id,
      firstName,
      lastName,
      company || null,
      email || null,
      phone || null,
      JSON.stringify(criteria || {}),
      tags || [],
      notes || null,
    ]
  );

  res.status(201).json(result.rows[0]);
}));

/**
 * PUT /api/buyers/:id
 * Update a buyer
 */
router.put('/:id', authenticate, [
  param('id').isUUID(),
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: 'Invalid buyer ID' });
  }

  const { firstName, lastName, company, email, phone, criteria, tags, notes } = req.body;

  const updates = [];
  const params = [];
  let paramIndex = 1;

  const addField = (field, value) => {
    if (value !== undefined) {
      updates.push(`${field} = $${paramIndex}`);
      params.push(value);
      paramIndex++;
    }
  };

  addField('first_name', firstName);
  addField('last_name', lastName);
  addField('company', company);
  addField('email', email);
  addField('phone', phone);
  if (criteria !== undefined) {
    updates.push(`criteria = $${paramIndex}`);
    params.push(JSON.stringify(criteria));
    paramIndex++;
  }
  if (tags !== undefined) {
    updates.push(`tags = $${paramIndex}`);
    params.push(tags);
    paramIndex++;
  }
  addField('notes', notes);

  if (updates.length === 0) {
    return res.status(400).json({ error: 'No fields to update' });
  }

  params.push(req.params.id, req.user.id);

  const result = await query(
    `UPDATE buyers SET ${updates.join(', ')}
     WHERE id = $${paramIndex} AND user_id = $${paramIndex + 1}
     RETURNING *`,
    params
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Buyer not found' });
  }

  res.json(result.rows[0]);
}));

/**
 * DELETE /api/buyers/:id
 * Delete a buyer
 */
router.delete('/:id', authenticate, [
  param('id').isUUID(),
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: 'Invalid buyer ID' });
  }

  const result = await query(
    'DELETE FROM buyers WHERE id = $1 AND user_id = $2 RETURNING id',
    [req.params.id, req.user.id]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Buyer not found' });
  }

  res.json({ message: 'Buyer deleted', id: result.rows[0].id });
}));

/**
 * POST /api/buyers/match
 * Match buyers to a property based on criteria
 */
router.post('/match', authenticate, [
  body('property').isObject().withMessage('Property data required'),
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: 'Validation failed', errors: errors.array() });
  }

  const { property } = req.body;
  const price = property.price || 0;
  const address = (property.address || '').toLowerCase();
  const propertyType = (property.propertyType || '').toLowerCase();
  const bedrooms = property.bedrooms || 0;
  const sqft = property.sqft || 0;

  // Fetch all buyers for this user
  const result = await query(
    'SELECT * FROM buyers WHERE user_id = $1',
    [req.user.id]
  );

  const matches = result.rows
    .map(buyer => {
      const criteria = buyer.criteria || {};
      let score = 0;
      const reasons = [];

      // Price match (+30)
      const minPrice = criteria.minPrice || 0;
      const maxPrice = criteria.maxPrice || Infinity;
      if (price > 0 && price >= minPrice && price <= maxPrice) {
        score += 30;
        reasons.push(`Price in range`);
      }

      // Location match (+30)
      const locations = (criteria.locations || []).map(l => l.toLowerCase());
      if (locations.length > 0 && address) {
        const matched = locations.some(loc => address.includes(loc));
        if (matched) {
          score += 30;
          reasons.push('Location match');
        }
      }

      // Property type match (+20)
      const types = (criteria.propertyTypes || []).map(t => t.toLowerCase());
      if (types.length > 0 && propertyType && types.some(t => propertyType.includes(t))) {
        score += 20;
        reasons.push('Property type match');
      }

      // Bedrooms match (+10)
      if (criteria.minBedrooms && bedrooms >= criteria.minBedrooms) {
        score += 10;
        reasons.push(`${bedrooms}+ bedrooms`);
      }

      // Sqft match (+10)
      if (criteria.minSqft && sqft >= criteria.minSqft) {
        score += 10;
        reasons.push(`${sqft}+ sqft`);
      }

      return { buyer, matchScore: score, matchReasons: reasons };
    })
    .filter(m => m.matchScore >= 20)
    .sort((a, b) => b.matchScore - a.matchScore);

  res.json({ matches });
}));

/**
 * POST /api/buyers/import
 * Bulk import buyers from parsed CSV data
 */
router.post('/import', authenticate, [
  body('buyers').isArray().withMessage('Buyers array required'),
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: 'Validation failed', errors: errors.array() });
  }

  const { buyers: buyerRows } = req.body;
  let imported = 0;
  let failed = 0;

  const client = await getClient();
  try {
    await client.query('BEGIN');

    for (const row of buyerRows) {
      try {
        if (!row.firstName || !row.lastName) {
          failed++;
          continue;
        }

        await client.query(
          `INSERT INTO buyers (user_id, first_name, last_name, company, email, phone, criteria, tags, notes)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [
            req.user.id,
            row.firstName,
            row.lastName,
            row.company || null,
            row.email || null,
            row.phone || null,
            JSON.stringify(row.criteria || {}),
            row.tags || [],
            row.notes || null,
          ]
        );
        imported++;
      } catch (err) {
        console.error('[Buyers] Import row failed:', err.message);
        failed++;
      }
    }

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  res.json({ imported, failed, total: buyerRows.length });
}));

/**
 * POST /api/buyers/:id/outreach
 * Send deal to a buyer via email/SMS
 */
router.post('/:id/outreach', authenticate, [
  param('id').isUUID(),
  body('deal').isObject().withMessage('Deal data required'),
  body('channels').isArray().withMessage('Channels array required'),
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: 'Validation failed', errors: errors.array() });
  }

  // Verify buyer ownership
  const buyerResult = await query(
    'SELECT * FROM buyers WHERE id = $1 AND user_id = $2',
    [req.params.id, req.user.id]
  );

  if (buyerResult.rows.length === 0) {
    return res.status(404).json({ error: 'Buyer not found' });
  }

  const buyer = buyerResult.rows[0];
  const { deal, channels } = req.body;
  const results = [];

  const address = deal.address || deal.propertyData?.address || 'a property';
  const price = deal.price || deal.propertyData?.price || '';
  const priceStr = price ? `$${Number(price).toLocaleString()}` : 'contact for price';

  const message = `Hi ${buyer.first_name}, I have a deal you might be interested in: ${address} listed at ${priceStr}. Let me know if you'd like details!`;

  if (channels.includes('sms') && buyer.phone) {
    try {
      // Use existing Twilio infrastructure
      const twilio = require('twilio')(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
      await twilio.messages.create({
        body: message,
        from: process.env.TWILIO_PHONE_NUMBER,
        to: buyer.phone,
      });
      results.push({ channel: 'sms', status: 'sent' });
    } catch (err) {
      console.error('[Buyers] SMS outreach failed:', err.message);
      results.push({ channel: 'sms', status: 'failed', error: err.message });
    }
  }

  if (channels.includes('email') && buyer.email) {
    try {
      const { Resend } = require('resend');
      const resend = new Resend(process.env.RESEND_API_KEY);
      await resend.emails.send({
        from: process.env.RESEND_FROM_EMAIL || 'deals@aiwholesail.com',
        to: buyer.email,
        subject: `New Wholesale Deal: ${address}`,
        html: `
          <h2>New Wholesale Deal Available</h2>
          <p>Hi ${buyer.first_name},</p>
          <p>I have a new deal that matches your criteria:</p>
          <ul>
            <li><strong>Address:</strong> ${address}</li>
            <li><strong>Price:</strong> ${priceStr}</li>
          </ul>
          <p>Let me know if you'd like more details or want to schedule a viewing.</p>
          <p>Best regards,<br/>${req.user.fullName || req.user.email}</p>
        `,
      });
      results.push({ channel: 'email', status: 'sent' });
    } catch (err) {
      console.error('[Buyers] Email outreach failed:', err.message);
      results.push({ channel: 'email', status: 'failed', error: err.message });
    }
  }

  // Update last_contacted_at
  await query(
    'UPDATE buyers SET last_contacted_at = NOW() WHERE id = $1',
    [req.params.id]
  );

  res.json({ results, buyerId: buyer.id });
}));

module.exports = router;
