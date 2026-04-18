const express = require('express');
const { body, param, query: queryParam, validationResult } = require('express-validator');
const { query } = require('../config/database');
const { authenticate } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');

const router = express.Router();

/**
 * GET /api/leads
 * Get all leads for the authenticated user
 */
router.get('/', authenticate, asyncHandler(async (req, res) => {
  const { status, sort, order, limit, offset } = req.query;

  let sql = `
    SELECT l.*,
           ls.overall_score, ls.motivation_score, ls.profitability_score,
           ls.urgency_score, ls.contactability_score, ls.confidence_score
    FROM leads l
    LEFT JOIN lead_scoring ls ON l.id = ls.lead_id
    WHERE l.user_id = $1
  `;
  const params = [req.user.id];
  let paramIndex = 2;

  // Filter by status
  if (status) {
    sql += ` AND l.status = $${paramIndex}`;
    params.push(status);
    paramIndex++;
  }

  // Sorting
  const sortField = ['created_at', 'updated_at', 'status'].includes(sort) ? sort : 'created_at';
  const sortOrder = order === 'asc' ? 'ASC' : 'DESC';
  sql += ` ORDER BY l.${sortField} ${sortOrder}`;

  // Pagination
  const limitNum = Math.min(parseInt(limit) || 50, 100);
  const offsetNum = parseInt(offset) || 0;
  sql += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
  params.push(limitNum, offsetNum);

  const result = await query(sql, params);

  // Get total count
  let countSql = 'SELECT COUNT(*) FROM leads WHERE user_id = $1';
  const countParams = [req.user.id];
  if (status) {
    countSql += ' AND status = $2';
    countParams.push(status);
  }
  const countResult = await query(countSql, countParams);

  res.json({
    leads: result.rows,
    pagination: {
      total: parseInt(countResult.rows[0].count),
      limit: limitNum,
      offset: offsetNum
    }
  });
}));

/**
 * GET /api/leads/:id
 * Get a specific lead by ID
 */
router.get('/:id', authenticate, [
  param('id').isUUID()
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: 'Invalid lead ID' });
  }

  const result = await query(
    `SELECT l.*,
            ls.overall_score, ls.motivation_score, ls.profitability_score,
            ls.urgency_score, ls.contactability_score, ls.confidence_score, ls.scoring_factors,
            pi.owner_name, pi.owner_address, pi.estimated_equity, pi.foreclosure_risk
     FROM leads l
     LEFT JOIN lead_scoring ls ON l.id = ls.lead_id
     LEFT JOIN property_intelligence pi ON l.property_id = pi.property_id
     WHERE l.id = $1 AND l.user_id = $2`,
    [req.params.id, req.user.id]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Lead not found' });
  }

  // Get contacts for this lead
  const contacts = await query(
    'SELECT * FROM lead_contacts WHERE lead_id = $1',
    [req.params.id]
  );

  // Get campaign history
  const campaigns = await query(
    'SELECT * FROM campaign_history WHERE lead_id = $1 ORDER BY sent_date DESC LIMIT 10',
    [req.params.id]
  );

  res.json({
    ...result.rows[0],
    contacts: contacts.rows,
    campaigns: campaigns.rows
  });
}));

/**
 * POST /api/leads
 * Create a new lead
 */
router.post('/', authenticate, [
  body('propertyId').notEmpty().withMessage('Property ID required'),
  body('propertyData').isObject().withMessage('Property data required')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: 'Validation failed', errors: errors.array() });
  }

  const { propertyId, propertyData, notes, status } = req.body;

  // Check for duplicate
  const existing = await query(
    'SELECT id FROM leads WHERE user_id = $1 AND property_id = $2',
    [req.user.id, propertyId]
  );

  if (existing.rows.length > 0) {
    return res.status(409).json({
      error: 'Lead already exists',
      existingId: existing.rows[0].id
    });
  }

  const result = await query(
    `INSERT INTO leads (user_id, property_id, property_data, notes, status)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [req.user.id, propertyId, JSON.stringify(propertyData), notes || null, status || 'new']
  );

  res.status(201).json(result.rows[0]);
}));

/**
 * PUT /api/leads/:id
 * Update a lead
 */
router.put('/:id', authenticate, [
  param('id').isUUID()
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: 'Invalid lead ID' });
  }

  const { notes, status, propertyData } = req.body;

  // Build dynamic update query
  const updates = [];
  const params = [];
  let paramIndex = 1;

  if (notes !== undefined) {
    updates.push(`notes = $${paramIndex}`);
    params.push(notes);
    paramIndex++;
  }

  if (status !== undefined) {
    updates.push(`status = $${paramIndex}`);
    params.push(status);
    paramIndex++;
  }

  if (propertyData !== undefined) {
    updates.push(`property_data = $${paramIndex}`);
    params.push(JSON.stringify(propertyData));
    paramIndex++;
  }

  if (updates.length === 0) {
    return res.status(400).json({ error: 'No fields to update' });
  }

  params.push(req.params.id, req.user.id);

  const result = await query(
    `UPDATE leads SET ${updates.join(', ')}, updated_at = NOW()
     WHERE id = $${paramIndex} AND user_id = $${paramIndex + 1}
     RETURNING *`,
    params
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Lead not found' });
  }

  res.json(result.rows[0]);
}));

/**
 * DELETE /api/leads/:id
 * Delete a lead
 */
router.delete('/:id', authenticate, [
  param('id').isUUID()
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: 'Invalid lead ID' });
  }

  const result = await query(
    'DELETE FROM leads WHERE id = $1 AND user_id = $2 RETURNING id',
    [req.params.id, req.user.id]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Lead not found' });
  }

  res.json({ message: 'Lead deleted successfully', id: result.rows[0].id });
}));

/**
 * POST /api/leads/:id/contacts
 * Add contact information to a lead
 */
router.post('/:id/contacts', authenticate, [
  param('id').isUUID(),
  body('contactType').notEmpty(),
  body('contactValue').notEmpty()
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: 'Validation failed', errors: errors.array() });
  }

  // Verify lead ownership
  const lead = await query(
    'SELECT id FROM leads WHERE id = $1 AND user_id = $2',
    [req.params.id, req.user.id]
  );

  if (lead.rows.length === 0) {
    return res.status(404).json({ error: 'Lead not found' });
  }

  const { contactType, contactValue, verified, skipTraced, skipTraceConfidence } = req.body;

  const result = await query(
    `INSERT INTO lead_contacts (lead_id, contact_type, contact_value, verified, skip_traced, skip_trace_confidence, skip_trace_date)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [
      req.params.id,
      contactType,
      contactValue,
      verified || false,
      skipTraced || false,
      skipTraceConfidence || null,
      skipTraced ? new Date() : null
    ]
  );

  res.status(201).json(result.rows[0]);
}));

/**
 * POST /api/leads/:id/scoring
 * Add or update lead scoring
 */
router.post('/:id/scoring', authenticate, [
  param('id').isUUID()
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: 'Invalid lead ID' });
  }

  // Verify lead ownership
  const lead = await query(
    'SELECT id FROM leads WHERE id = $1 AND user_id = $2',
    [req.params.id, req.user.id]
  );

  if (lead.rows.length === 0) {
    return res.status(404).json({ error: 'Lead not found' });
  }

  const {
    overallScore,
    motivationScore,
    urgencyScore,
    profitabilityScore,
    contactabilityScore,
    confidenceScore,
    scoringFactors
  } = req.body;

  const result = await query(
    `INSERT INTO lead_scoring (lead_id, overall_score, motivation_score, urgency_score,
     profitability_score, contactability_score, confidence_score, scoring_factors)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (lead_id)
     DO UPDATE SET
       overall_score = EXCLUDED.overall_score,
       motivation_score = EXCLUDED.motivation_score,
       urgency_score = EXCLUDED.urgency_score,
       profitability_score = EXCLUDED.profitability_score,
       contactability_score = EXCLUDED.contactability_score,
       confidence_score = EXCLUDED.confidence_score,
       scoring_factors = EXCLUDED.scoring_factors,
       last_updated = NOW()
     RETURNING *`,
    [
      req.params.id,
      overallScore || 0,
      motivationScore || 0,
      urgencyScore || 0,
      profitabilityScore || 0,
      contactabilityScore || 0,
      confidenceScore || 0,
      JSON.stringify(scoringFactors || [])
    ]
  );

  res.json(result.rows[0]);
}));

/**
 * POST /api/leads/export
 * Export leads to CSV format
 */
router.post('/export', authenticate, asyncHandler(async (req, res) => {
  const { leadIds, allLeads } = req.body;

  let sql = `
    SELECT l.*, ls.overall_score
    FROM leads l
    LEFT JOIN lead_scoring ls ON l.id = ls.lead_id
    WHERE l.user_id = $1
  `;
  const params = [req.user.id];

  if (!allLeads && leadIds && leadIds.length > 0) {
    sql += ` AND l.id = ANY($2)`;
    params.push(leadIds);
  }

  const result = await query(sql, params);

  // Convert to CSV format
  const leads = result.rows.map(lead => {
    const data = lead.property_data || {};
    return {
      id: lead.id,
      address: data.address || '',
      city: data.city || '',
      state: data.state || '',
      zipcode: data.zipcode || '',
      price: data.price || '',
      bedrooms: data.bedrooms || '',
      bathrooms: data.bathrooms || '',
      sqft: data.livingArea || '',
      yearBuilt: data.yearBuilt || '',
      propertyType: data.propertyType || '',
      status: lead.status,
      notes: lead.notes || '',
      score: lead.overall_score || '',
      createdAt: lead.created_at
    };
  });

  res.json({ leads, count: leads.length });
}));

module.exports = router;
