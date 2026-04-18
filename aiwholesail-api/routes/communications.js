const express = require('express');
const axios = require('axios');
const { Resend } = require('resend');
const { body, validationResult } = require('express-validator');
const { query } = require('../config/database');
const { authenticate } = require('../middleware/auth');
const { asyncHandler, logSecurityEvent } = require('../middleware/errorHandler');
const { checkDatabaseRateLimit } = require('../middleware/rateLimit');

const router = express.Router();

/**
 * POST /api/communications/email/send
 * Send email via Resend
 */
router.post('/email/send', authenticate, [
  body('to').isEmail().withMessage('Valid recipient email required'),
  body('subject').notEmpty().withMessage('Subject required'),
  body('html').notEmpty().withMessage('Email content required')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: 'Validation failed', errors: errors.array() });
  }

  const rateLimit = await checkDatabaseRateLimit(req.user.id, 'send-email', 20, 1);
  if (!rateLimit.allowed) {
    return res.status(429).json({ error: 'Rate limit exceeded' });
  }

  const { to, subject, html, from } = req.body;
  const resendApiKey = process.env.RESEND_API_KEY;

  if (!resendApiKey) {
    return res.status(500).json({ error: 'Email service not configured' });
  }

  const resend = new Resend(resendApiKey);

  try {
    const { data, error } = await resend.emails.send({
      from: from || 'AI Wholesail <noreply@aiwholesail.com>',
      to: [to],
      subject: subject,
      html: html
    });

    if (error) {
      console.error('[Communications] Resend error:', error);
      return res.status(500).json({ success: false, error: 'Failed to send email' });
    }

    await logSecurityEvent('email_sent', {
      to: to.substring(0, 3) + '***',
      subject: subject.substring(0, 20),
      messageId: data.id
    }, req.user.id, req);

    res.json({
      success: true,
      messageId: data.id,
      message: 'Email sent successfully via Resend'
    });
  } catch (error) {
    console.error('[Communications] Resend error:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to send email'
    });
  }
}));

/**
 * POST /api/communications/sms/send
 * Send SMS via Plivo
 */
router.post('/sms/send', authenticate, [
  body('to').notEmpty().withMessage('Recipient phone number required'),
  body('message').notEmpty().withMessage('Message required')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: 'Validation failed', errors: errors.array() });
  }

  const rateLimit = await checkDatabaseRateLimit(req.user.id, 'send-sms', 20, 1);
  if (!rateLimit.allowed) {
    return res.status(429).json({ error: 'Rate limit exceeded' });
  }

  const { to, message, from } = req.body;
  const plivoAuthId = process.env.PLIVO_AUTH_ID;
  const plivoAuthToken = process.env.PLIVO_AUTH_TOKEN;
  const plivoPhoneNumber = process.env.PLIVO_PHONE_NUMBER;

  if (!plivoAuthId || !plivoAuthToken) {
    return res.status(500).json({ error: 'SMS service not configured' });
  }

  const requestBody = {
    src: from || plivoPhoneNumber,
    dst: to.replace(/\D/g, ''), // Remove non-digits
    text: message,
    type: 'sms'
  };

  try {
    const response = await axios.post(
      `https://api.plivo.com/v1/Account/${plivoAuthId}/Message/`,
      requestBody,
      {
        headers: {
          'Authorization': `Basic ${Buffer.from(`${plivoAuthId}:${plivoAuthToken}`).toString('base64')}`,
          'Content-Type': 'application/json'
        }
      }
    );

    await logSecurityEvent('sms_sent', {
      to: to.substring(0, 3) + '***',
      messageLength: message.length
    }, req.user.id, req);

    res.json({
      success: true,
      messageId: response.data.message_uuid,
      cost: 0.0045,
      data: response.data
    });
  } catch (error) {
    console.error('[Communications] Plivo error:', error.response?.data || error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to send SMS'
    });
  }
}));

/**
 * POST /api/communications/call/make
 * Make a phone call via Plivo
 */
router.post('/call/make', authenticate, [
  body('to').notEmpty().withMessage('Recipient phone number required')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: 'Validation failed', errors: errors.array() });
  }

  const rateLimit = await checkDatabaseRateLimit(req.user.id, 'make-call', 10, 1);
  if (!rateLimit.allowed) {
    return res.status(429).json({ error: 'Rate limit exceeded' });
  }

  const { to, from, answerUrl } = req.body;
  const plivoAuthId = process.env.PLIVO_AUTH_ID;
  const plivoAuthToken = process.env.PLIVO_AUTH_TOKEN;
  const plivoPhoneNumber = process.env.PLIVO_PHONE_NUMBER;

  if (!plivoAuthId || !plivoAuthToken) {
    return res.status(500).json({ error: 'Call service not configured' });
  }

  const requestBody = {
    from: from || plivoPhoneNumber,
    to: to.replace(/\D/g, ''),
    answer_url: answerUrl || `${process.env.API_URL}/api/communications/call/answer`,
    answer_method: 'GET'
  };

  try {
    const response = await axios.post(
      `https://api.plivo.com/v1/Account/${plivoAuthId}/Call/`,
      requestBody,
      {
        headers: {
          'Authorization': `Basic ${Buffer.from(`${plivoAuthId}:${plivoAuthToken}`).toString('base64')}`,
          'Content-Type': 'application/json'
        }
      }
    );

    await logSecurityEvent('call_initiated', {
      to: to.substring(0, 3) + '***'
    }, req.user.id, req);

    res.json({
      success: true,
      callId: response.data.request_uuid,
      data: response.data
    });
  } catch (error) {
    console.error('[Communications] Plivo call error:', error.response?.data || error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to initiate call'
    });
  }
}));

/**
 * GET /api/communications/call/answer
 * Plivo call answer webhook
 */
router.get('/call/answer', (req, res) => {
  // Return Plivo XML for call handling
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Speak voice="WOMAN">Hello, this is AI Wholesail calling about a property opportunity. Please hold for an agent.</Speak>
  <Wait length="2"/>
  <Speak voice="WOMAN">Thank you for your time. Goodbye.</Speak>
  <Hangup/>
</Response>`;

  res.set('Content-Type', 'text/xml');
  res.send(xml);
});

/**
 * POST /api/communications/campaign
 * Log a campaign action (SMS/Email/Call)
 */
router.post('/campaign', authenticate, [
  body('leadId').isUUID().withMessage('Valid lead ID required'),
  body('campaignType').isIn(['sms', 'email', 'call']).withMessage('Valid campaign type required')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: 'Validation failed', errors: errors.array() });
  }

  const { leadId, campaignType, campaignId, messageContent } = req.body;

  // Verify lead ownership
  const lead = await query(
    'SELECT id FROM leads WHERE id = $1 AND user_id = $2',
    [leadId, req.user.id]
  );

  if (lead.rows.length === 0) {
    return res.status(404).json({ error: 'Lead not found' });
  }

  const result = await query(
    `INSERT INTO campaign_history (lead_id, campaign_type, campaign_id, message_content, sent_date)
     VALUES ($1, $2, $3, $4, NOW())
     RETURNING *`,
    [leadId, campaignType, campaignId || null, messageContent || null]
  );

  res.status(201).json(result.rows[0]);
}));

/**
 * POST /api/communications/campaign/:id/response
 * Log a campaign response
 */
router.post('/campaign/:id/response', authenticate, [
  body('responseContent').notEmpty().withMessage('Response content required')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: 'Validation failed', errors: errors.array() });
  }

  const { responseContent } = req.body;

  const result = await query(
    `UPDATE campaign_history
     SET response_received = true,
         response_content = $1,
         response_date = NOW()
     WHERE id = $2
     RETURNING *`,
    [responseContent, req.params.id]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Campaign record not found' });
  }

  res.json(result.rows[0]);
}));

module.exports = router;
