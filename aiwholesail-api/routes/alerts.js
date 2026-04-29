const express = require('express');
const { body, param, validationResult } = require('express-validator');
const { query } = require('../config/database');
const { authenticate } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');

const router = express.Router();

/**
 * GET /api/alerts
 * Get all property alerts for the authenticated user
 */
router.get('/', authenticate, asyncHandler(async (req, res) => {
  const { active, limit, offset } = req.query;

  let sql = 'SELECT * FROM property_alerts WHERE user_id = $1';
  const params = [req.user.id];
  let paramIndex = 2;

  if (active !== undefined) {
    sql += ` AND is_active = $${paramIndex}`;
    params.push(active === 'true');
    paramIndex++;
  }

  sql += ' ORDER BY created_at DESC';

  // Pagination
  const limitNum = Math.min(parseInt(limit) || 50, 100);
  const offsetNum = parseInt(offset) || 0;
  sql += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
  params.push(limitNum, offsetNum);

  const result = await query(sql, params);

  // Get total count
  let countSql = 'SELECT COUNT(*) FROM property_alerts WHERE user_id = $1';
  const countParams = [req.user.id];
  if (active !== undefined) {
    countSql += ' AND is_active = $2';
    countParams.push(active === 'true');
  }
  const countResult = await query(countSql, countParams);

  res.json({
    alerts: result.rows,
    pagination: {
      total: parseInt(countResult.rows[0].count),
      limit: limitNum,
      offset: offsetNum
    }
  });
}));

/**
 * GET /api/alerts/:id
 * Get a specific alert by ID
 */
router.get('/:id', authenticate, [
  param('id').isUUID()
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: 'Invalid alert ID' });
  }

  const result = await query(
    'SELECT * FROM property_alerts WHERE id = $1 AND user_id = $2',
    [req.params.id, req.user.id]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Alert not found' });
  }

  res.json(result.rows[0]);
}));

/**
 * GET /api/alerts/:id/matches
 * Get matches for a specific alert
 */
router.get('/:id/matches', authenticate, [
  param('id').isUUID()
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: 'Invalid alert ID' });
  }

  const { limit, offset } = req.query;

  // Verify alert ownership
  const alert = await query(
    'SELECT id FROM property_alerts WHERE id = $1 AND user_id = $2',
    [req.params.id, req.user.id]
  );

  if (alert.rows.length === 0) {
    return res.status(404).json({ error: 'Alert not found' });
  }

  const limitNum = Math.min(parseInt(limit) || 50, 100);
  const offsetNum = parseInt(offset) || 0;

  const result = await query(
    `SELECT * FROM property_alert_matches
     WHERE alert_id = $1
     ORDER BY matched_at DESC
     LIMIT $2 OFFSET $3`,
    [req.params.id, limitNum, offsetNum]
  );

  const countResult = await query(
    'SELECT COUNT(*) FROM property_alert_matches WHERE alert_id = $1',
    [req.params.id]
  );

  res.json({
    matches: result.rows,
    pagination: {
      total: parseInt(countResult.rows[0].count),
      limit: limitNum,
      offset: offsetNum
    }
  });
}));

/**
 * POST /api/alerts
 * Create a new property alert
 */
router.post('/', authenticate, [
  body('location').notEmpty().withMessage('Location required'),
  body('alertFrequency').optional().isIn(['instant', 'immediate', 'daily', 'weekly'])
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: 'Validation failed', errors: errors.array() });
  }

  const {
    location,
    propertyTypes,
    minBedrooms,
    maxBedrooms,
    minBathrooms,
    maxBathrooms,
    maxPrice,
    minSqft,
    maxSqft,
    alertFrequency,
    phoneNumber,
    minSpread
  } = req.body;

  const result = await query(
    `INSERT INTO property_alerts (
      user_id, location, property_types, min_bedrooms, max_bedrooms,
      min_bathrooms, max_bathrooms, max_price, min_sqft, max_sqft,
      alert_frequency, phone_number, min_spread
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
    RETURNING *`,
    [
      req.user.id,
      location,
      propertyTypes || null,
      minBedrooms || null,
      maxBedrooms || null,
      minBathrooms || null,
      maxBathrooms || null,
      maxPrice || null,
      minSqft || null,
      maxSqft || null,
      alertFrequency || 'daily',
      phoneNumber || null,
      minSpread || 30000
    ]
  );

  res.status(201).json(result.rows[0]);
}));

/**
 * PUT /api/alerts/:id
 * Update an alert
 */
router.put('/:id', authenticate, [
  param('id').isUUID()
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: 'Invalid alert ID' });
  }

  const {
    location,
    propertyTypes,
    minBedrooms,
    maxBedrooms,
    minBathrooms,
    maxBathrooms,
    maxPrice,
    minSqft,
    maxSqft,
    alertFrequency,
    isActive,
    phoneNumber,
    minSpread
  } = req.body;

  // Build dynamic update query
  const updates = [];
  const params = [];
  let paramIndex = 1;

  const fields = {
    location, property_types: propertyTypes, min_bedrooms: minBedrooms,
    max_bedrooms: maxBedrooms, min_bathrooms: minBathrooms, max_bathrooms: maxBathrooms,
    max_price: maxPrice, min_sqft: minSqft, max_sqft: maxSqft,
    alert_frequency: alertFrequency, is_active: isActive,
    phone_number: phoneNumber, min_spread: minSpread
  };

  for (const [key, value] of Object.entries(fields)) {
    if (value !== undefined) {
      updates.push(`${key} = $${paramIndex}`);
      params.push(value);
      paramIndex++;
    }
  }

  if (updates.length === 0) {
    return res.status(400).json({ error: 'No fields to update' });
  }

  params.push(req.params.id, req.user.id);

  const result = await query(
    `UPDATE property_alerts SET ${updates.join(', ')}, updated_at = NOW()
     WHERE id = $${paramIndex} AND user_id = $${paramIndex + 1}
     RETURNING *`,
    params
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Alert not found' });
  }

  res.json(result.rows[0]);
}));

/**
 * PATCH /api/alerts/:id/toggle
 * Toggle alert active status
 */
router.patch('/:id/toggle', authenticate, [
  param('id').isUUID()
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: 'Invalid alert ID' });
  }

  const result = await query(
    `UPDATE property_alerts SET is_active = NOT is_active, updated_at = NOW()
     WHERE id = $1 AND user_id = $2
     RETURNING *`,
    [req.params.id, req.user.id]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Alert not found' });
  }

  res.json(result.rows[0]);
}));

/**
 * DELETE /api/alerts/:id
 * Delete an alert
 */
router.delete('/:id', authenticate, [
  param('id').isUUID()
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: 'Invalid alert ID' });
  }

  const result = await query(
    'DELETE FROM property_alerts WHERE id = $1 AND user_id = $2 RETURNING id',
    [req.params.id, req.user.id]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Alert not found' });
  }

  res.json({ message: 'Alert deleted successfully', id: result.rows[0].id });
}));

/**
 * GET /api/alert-matches
 * Get all alert matches for the user
 */
router.get('/matches/all', authenticate, asyncHandler(async (req, res) => {
  const { limit, offset, unreadOnly } = req.query;

  const limitNum = Math.min(parseInt(limit) || 50, 100);
  const offsetNum = parseInt(offset) || 0;

  let sql = `
    SELECT pam.*, pa.location, pa.alert_frequency
    FROM property_alert_matches pam
    JOIN property_alerts pa ON pam.alert_id = pa.id
    WHERE pa.user_id = $1
  `;
  const params = [req.user.id];
  let paramIndex = 2;

  if (unreadOnly === 'true') {
    sql += ` AND pam.email_sent = false`;
  }

  sql += ` ORDER BY pam.matched_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
  params.push(limitNum, offsetNum);

  const result = await query(sql, params);

  const countResult = await query(
    `SELECT COUNT(*) FROM property_alert_matches pam
     JOIN property_alerts pa ON pam.alert_id = pa.id
     WHERE pa.user_id = $1`,
    [req.user.id]
  );

  res.json({
    matches: result.rows,
    pagination: {
      total: parseInt(countResult.rows[0].count),
      limit: limitNum,
      offset: offsetNum
    }
  });
}));

module.exports = router;
