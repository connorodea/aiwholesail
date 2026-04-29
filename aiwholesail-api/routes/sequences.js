const express = require('express');
const { body, param, validationResult } = require('express-validator');
const { query } = require('../config/database');
const { authenticate } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');

const router = express.Router();

/**
 * GET /api/sequences/templates
 * List all templates (user's custom + prebuilt)
 */
router.get('/templates', authenticate, asyncHandler(async (req, res) => {
  const result = await query(
    `SELECT st.*,
       (SELECT json_agg(ss ORDER BY ss.step_order)
        FROM sequence_steps ss WHERE ss.sequence_template_id = st.id) AS steps
     FROM sequence_templates st
     WHERE st.user_id = $1 OR st.is_prebuilt = TRUE
     ORDER BY st.is_prebuilt DESC, st.created_at DESC`,
    [req.user.id]
  );

  res.json({ templates: result.rows.map(t => ({ ...t, steps: t.steps || [] })) });
}));

/**
 * GET /api/sequences/templates/:id
 * Get a specific template with steps
 */
router.get('/templates/:id', authenticate, [
  param('id').isUUID(),
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: 'Invalid template ID' });
  }

  const result = await query(
    `SELECT st.*,
       (SELECT json_agg(ss ORDER BY ss.step_order)
        FROM sequence_steps ss WHERE ss.sequence_template_id = st.id) AS steps
     FROM sequence_templates st
     WHERE st.id = $1 AND (st.user_id = $2 OR st.is_prebuilt = TRUE)`,
    [req.params.id, req.user.id]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Template not found' });
  }

  res.json({ ...result.rows[0], steps: result.rows[0].steps || [] });
}));

/**
 * POST /api/sequences/templates
 * Create a custom template with steps
 */
router.post('/templates', authenticate, [
  body('name').notEmpty().withMessage('Template name required'),
  body('steps').isArray({ min: 1 }).withMessage('At least one step required'),
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: 'Validation failed', errors: errors.array() });
  }

  const { name, description, category, steps } = req.body;

  // Create template
  const templateResult = await query(
    `INSERT INTO sequence_templates (user_id, name, description, category, is_prebuilt)
     VALUES ($1, $2, $3, $4, FALSE)
     RETURNING *`,
    [req.user.id, name, description || null, category || 'custom']
  );

  const template = templateResult.rows[0];

  // Insert steps
  for (const step of steps) {
    await query(
      `INSERT INTO sequence_steps (sequence_template_id, step_order, day_offset, channel, subject, message_template)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        template.id,
        step.stepOrder || step.step_order,
        step.dayOffset || step.day_offset || 0,
        step.channel || 'sms',
        step.subject || null,
        step.messageTemplate || step.message_template,
      ]
    );
  }

  // Fetch complete template with steps
  const fullResult = await query(
    `SELECT st.*,
       (SELECT json_agg(ss ORDER BY ss.step_order)
        FROM sequence_steps ss WHERE ss.sequence_template_id = st.id) AS steps
     FROM sequence_templates st
     WHERE st.id = $1`,
    [template.id]
  );

  res.status(201).json({ ...fullResult.rows[0], steps: fullResult.rows[0].steps || [] });
}));

/**
 * DELETE /api/sequences/templates/:id
 * Delete a custom template (not prebuilt)
 */
router.delete('/templates/:id', authenticate, [
  param('id').isUUID(),
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: 'Invalid template ID' });
  }

  const result = await query(
    'DELETE FROM sequence_templates WHERE id = $1 AND user_id = $2 AND is_prebuilt = FALSE RETURNING id',
    [req.params.id, req.user.id]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Template not found or is prebuilt' });
  }

  res.json({ message: 'Template deleted', id: result.rows[0].id });
}));

/**
 * POST /api/sequences/assign
 * Assign a sequence to a lead
 */
router.post('/assign', authenticate, [
  body('leadId').isUUID().withMessage('Valid lead ID required'),
  body('templateId').isUUID().withMessage('Valid template ID required'),
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: 'Validation failed', errors: errors.array() });
  }

  const { leadId, templateId, variables } = req.body;

  // Verify lead ownership
  const lead = await query(
    'SELECT id, property_data FROM leads WHERE id = $1 AND user_id = $2',
    [leadId, req.user.id]
  );
  if (lead.rows.length === 0) {
    return res.status(404).json({ error: 'Lead not found' });
  }

  // Verify template access
  const template = await query(
    `SELECT st.*,
       (SELECT json_agg(ss ORDER BY ss.step_order)
        FROM sequence_steps ss WHERE ss.sequence_template_id = st.id) AS steps
     FROM sequence_templates st
     WHERE st.id = $1 AND (st.user_id = $2 OR st.is_prebuilt = TRUE)`,
    [templateId, req.user.id]
  );
  if (template.rows.length === 0) {
    return res.status(404).json({ error: 'Template not found' });
  }

  const steps = template.rows[0].steps || [];

  // Create lead_sequence
  const seqResult = await query(
    `INSERT INTO lead_sequences (lead_id, sequence_template_id, user_id, status, current_step, variables)
     VALUES ($1, $2, $3, 'active', 0, $4)
     RETURNING *`,
    [leadId, templateId, req.user.id, JSON.stringify(variables || {})]
  );

  const leadSequence = seqResult.rows[0];

  // Create execution records for all steps
  const startDate = new Date();
  for (const step of steps) {
    const scheduledDate = new Date(startDate);
    scheduledDate.setDate(scheduledDate.getDate() + (step.day_offset || 0));

    await query(
      `INSERT INTO sequence_executions (lead_sequence_id, step_order, channel, scheduled_date, status)
       VALUES ($1, $2, $3, $4, 'pending')`,
      [leadSequence.id, step.step_order, step.channel, scheduledDate]
    );
  }

  // Return enriched response
  const address = lead.rows[0].property_data?.address || '';
  res.status(201).json({
    ...leadSequence,
    sequence_template_name: template.rows[0].name,
    total_steps: steps.length,
    lead_address: address,
    next_send_date: startDate.toISOString(),
  });
}));

/**
 * GET /api/sequences/active
 * List all active/paused sequences for the user
 */
router.get('/active', authenticate, asyncHandler(async (req, res) => {
  const result = await query(
    `SELECT ls.*,
       st.name AS sequence_template_name,
       (SELECT COUNT(*) FROM sequence_steps ss WHERE ss.sequence_template_id = ls.sequence_template_id) AS total_steps,
       (SELECT MIN(se.scheduled_date)
        FROM sequence_executions se
        WHERE se.lead_sequence_id = ls.id AND se.status = 'pending') AS next_send_date,
       l.property_data->>'address' AS lead_address
     FROM lead_sequences ls
     JOIN sequence_templates st ON ls.sequence_template_id = st.id
     JOIN leads l ON ls.lead_id = l.id
     WHERE ls.user_id = $1
     ORDER BY ls.created_at DESC`,
    [req.user.id]
  );

  res.json({ sequences: result.rows });
}));

/**
 * GET /api/sequences/lead/:leadId
 * Get sequences for a specific lead
 */
router.get('/lead/:leadId', authenticate, [
  param('leadId').isUUID(),
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: 'Invalid lead ID' });
  }

  const result = await query(
    `SELECT ls.*,
       st.name AS sequence_template_name,
       (SELECT COUNT(*) FROM sequence_steps ss WHERE ss.sequence_template_id = ls.sequence_template_id) AS total_steps
     FROM lead_sequences ls
     JOIN sequence_templates st ON ls.sequence_template_id = st.id
     WHERE ls.lead_id = $1 AND ls.user_id = $2
     ORDER BY ls.created_at DESC`,
    [req.params.leadId, req.user.id]
  );

  res.json({ sequences: result.rows });
}));

/**
 * PATCH /api/sequences/:id/pause
 */
router.patch('/:id/pause', authenticate, [
  param('id').isUUID(),
], asyncHandler(async (req, res) => {
  const result = await query(
    `UPDATE lead_sequences SET status = 'paused'
     WHERE id = $1 AND user_id = $2 AND status = 'active'
     RETURNING *`,
    [req.params.id, req.user.id]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Active sequence not found' });
  }

  res.json(result.rows[0]);
}));

/**
 * PATCH /api/sequences/:id/resume
 */
router.patch('/:id/resume', authenticate, [
  param('id').isUUID(),
], asyncHandler(async (req, res) => {
  const result = await query(
    `UPDATE lead_sequences SET status = 'active'
     WHERE id = $1 AND user_id = $2 AND status = 'paused'
     RETURNING *`,
    [req.params.id, req.user.id]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Paused sequence not found' });
  }

  res.json(result.rows[0]);
}));

/**
 * PATCH /api/sequences/:id/cancel
 */
router.patch('/:id/cancel', authenticate, [
  param('id').isUUID(),
], asyncHandler(async (req, res) => {
  const result = await query(
    `UPDATE lead_sequences SET status = 'cancelled', completed_at = NOW()
     WHERE id = $1 AND user_id = $2 AND status IN ('active', 'paused')
     RETURNING *`,
    [req.params.id, req.user.id]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Sequence not found or already completed' });
  }

  // Cancel pending executions
  await query(
    `UPDATE sequence_executions SET status = 'skipped'
     WHERE lead_sequence_id = $1 AND status = 'pending'`,
    [req.params.id]
  );

  res.json(result.rows[0]);
}));

module.exports = router;
