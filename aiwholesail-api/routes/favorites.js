const express = require('express');
const { body, param, validationResult } = require('express-validator');
const { query } = require('../config/database');
const { authenticate } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');

const router = express.Router();

/**
 * GET /api/favorites
 * Get all favorites for the authenticated user
 */
router.get('/', authenticate, asyncHandler(async (req, res) => {
  const { sort, order, limit, offset } = req.query;

  let sql = 'SELECT * FROM favorites WHERE user_id = $1';
  const params = [req.user.id];
  let paramIndex = 2;

  // Sorting
  const sortField = ['created_at', 'updated_at'].includes(sort) ? sort : 'created_at';
  const sortOrder = order === 'asc' ? 'ASC' : 'DESC';
  sql += ` ORDER BY ${sortField} ${sortOrder}`;

  // Pagination
  const limitNum = Math.min(parseInt(limit) || 50, 100);
  const offsetNum = parseInt(offset) || 0;
  sql += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
  params.push(limitNum, offsetNum);

  const result = await query(sql, params);

  // Get total count
  const countResult = await query('SELECT COUNT(*) FROM favorites WHERE user_id = $1', [req.user.id]);

  res.json({
    favorites: result.rows,
    pagination: {
      total: parseInt(countResult.rows[0].count),
      limit: limitNum,
      offset: offsetNum
    }
  });
}));

/**
 * GET /api/favorites/check/:propertyId
 * Check if a property is favorited
 */
router.get('/check/:propertyId', authenticate, asyncHandler(async (req, res) => {
  const result = await query(
    'SELECT id FROM favorites WHERE user_id = $1 AND property_id = $2',
    [req.user.id, req.params.propertyId]
  );

  res.json({
    isFavorited: result.rows.length > 0,
    favoriteId: result.rows[0]?.id || null
  });
}));

/**
 * GET /api/favorites/:id
 * Get a specific favorite by ID
 */
router.get('/:id', authenticate, [
  param('id').isUUID()
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: 'Invalid favorite ID' });
  }

  const result = await query(
    'SELECT * FROM favorites WHERE id = $1 AND user_id = $2',
    [req.params.id, req.user.id]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Favorite not found' });
  }

  res.json(result.rows[0]);
}));

/**
 * POST /api/favorites
 * Add a property to favorites
 */
router.post('/', authenticate, [
  body('propertyId').notEmpty().withMessage('Property ID required'),
  body('propertyData').isObject().withMessage('Property data required')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: 'Validation failed', errors: errors.array() });
  }

  const { propertyId, propertyData } = req.body;

  // Check for duplicate
  const existing = await query(
    'SELECT id FROM favorites WHERE user_id = $1 AND property_id = $2',
    [req.user.id, propertyId]
  );

  if (existing.rows.length > 0) {
    return res.status(409).json({
      error: 'Property already favorited',
      existingId: existing.rows[0].id
    });
  }

  const result = await query(
    `INSERT INTO favorites (user_id, property_id, property_data)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [req.user.id, propertyId, JSON.stringify(propertyData)]
  );

  res.status(201).json(result.rows[0]);
}));

/**
 * DELETE /api/favorites/:id
 * Remove a property from favorites by favorite ID
 */
router.delete('/:id', authenticate, [
  param('id').isUUID()
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: 'Invalid favorite ID' });
  }

  const result = await query(
    'DELETE FROM favorites WHERE id = $1 AND user_id = $2 RETURNING id',
    [req.params.id, req.user.id]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Favorite not found' });
  }

  res.json({ message: 'Favorite removed successfully', id: result.rows[0].id });
}));

/**
 * DELETE /api/favorites/property/:propertyId
 * Remove a property from favorites by property ID
 */
router.delete('/property/:propertyId', authenticate, asyncHandler(async (req, res) => {
  const result = await query(
    'DELETE FROM favorites WHERE property_id = $1 AND user_id = $2 RETURNING id',
    [req.params.propertyId, req.user.id]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Favorite not found' });
  }

  res.json({ message: 'Favorite removed successfully', id: result.rows[0].id });
}));

/**
 * POST /api/favorites/bulk
 * Add multiple properties to favorites
 */
router.post('/bulk', authenticate, [
  body('properties').isArray().withMessage('Properties array required')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: 'Validation failed', errors: errors.array() });
  }

  const { properties } = req.body;
  const added = [];
  const skipped = [];

  for (const property of properties) {
    const { propertyId, propertyData } = property;

    if (!propertyId || !propertyData) {
      skipped.push({ propertyId, reason: 'Missing data' });
      continue;
    }

    // Check for duplicate
    const existing = await query(
      'SELECT id FROM favorites WHERE user_id = $1 AND property_id = $2',
      [req.user.id, propertyId]
    );

    if (existing.rows.length > 0) {
      skipped.push({ propertyId, reason: 'Already favorited' });
      continue;
    }

    const result = await query(
      `INSERT INTO favorites (user_id, property_id, property_data)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [req.user.id, propertyId, JSON.stringify(propertyData)]
    );

    added.push(result.rows[0]);
  }

  res.status(201).json({
    added,
    skipped,
    summary: {
      addedCount: added.length,
      skippedCount: skipped.length
    }
  });
}));

module.exports = router;
