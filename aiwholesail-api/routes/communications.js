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
 * Send SMS via Twilio
 */
async function sendTwilioSMS(to, message) {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromNumber = process.env.TWILIO_PHONE_NUMBER;

  if (!accountSid || !authToken || !fromNumber) {
    throw new Error('Twilio not configured');
  }

  const response = await axios.post(
    `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
    new URLSearchParams({
      To: to.replace(/[^\d+]/g, ''),
      From: fromNumber,
      Body: message
    }).toString(),
    {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      auth: {
        username: accountSid,
        password: authToken
      }
    }
  );

  return response.data;
}

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
 * Send SMS via Twilio
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

  const { to, message } = req.body;

  try {
    const result = await sendTwilioSMS(to, message);

    await logSecurityEvent('sms_sent', {
      to: to.substring(0, 3) + '***',
      messageLength: message.length
    }, req.user.id, req);

    res.json({
      success: true,
      messageId: result.sid,
      data: result
    });
  } catch (error) {
    console.error('[Communications] Twilio error:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to send SMS'
    });
  }
}));

/**
 * POST /api/communications/spread-alert
 * Send SMS alert for profitable spread properties found during search.
 * Called by the frontend after enrichment finds +$30K deals.
 */
router.post('/spread-alert', authenticate, [
  body('deals').isArray({ min: 1 }).withMessage('At least one deal required'),
  body('location').notEmpty().withMessage('Search location required'),
  body('phone').notEmpty().withMessage('Phone number required')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: 'Validation failed', errors: errors.array() });
  }

  const rateLimit = await checkDatabaseRateLimit(req.user.id, 'spread-alert-sms', 5, 60);
  if (!rateLimit.allowed) {
    return res.status(429).json({ error: 'Alert rate limit exceeded. Max 5 alerts per hour.' });
  }

  const { deals, location, phone } = req.body;

  // Build alert message with top deals
  const topDeals = deals.slice(0, 3);
  const dealLines = topDeals.map(d => {
    const spread = d.zestimate - d.price;
    return `${d.address}: $${(d.price / 1000).toFixed(0)}K list / $${(d.zestimate / 1000).toFixed(0)}K Zest = +$${(spread / 1000).toFixed(0)}K spread`;
  });

  const message = [
    `AIWholesail Deal Alert!`,
    `${deals.length} properties with +$30K spreads found in ${location}:`,
    '',
    ...dealLines,
    deals.length > 3 ? `...and ${deals.length - 3} more deals` : '',
    '',
    'View at aiwholesail.com/app'
  ].filter(Boolean).join('\n');

  try {
    const result = await sendTwilioSMS(phone, message);

    await logSecurityEvent('spread_alert_sent', {
      location,
      dealCount: deals.length,
      phone: phone.substring(0, 3) + '***'
    }, req.user.id, req);

    res.json({
      success: true,
      messageId: result.sid,
      dealCount: deals.length,
      message: 'Spread alert sent'
    });
  } catch (error) {
    console.error('[Communications] Spread alert error:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to send spread alert'
    });
  }
}));

/**
 * POST /api/communications/call/make
 * Make a phone call via Twilio
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

  const { to } = req.body;
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromNumber = process.env.TWILIO_PHONE_NUMBER;

  if (!accountSid || !authToken) {
    return res.status(500).json({ error: 'Call service not configured' });
  }

  try {
    const response = await axios.post(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Calls.json`,
      new URLSearchParams({
        To: to.replace(/[^\d+]/g, ''),
        From: fromNumber,
        Url: `${process.env.API_URL || 'https://api.aiwholesail.com'}/api/communications/call/answer`
      }).toString(),
      {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        auth: { username: accountSid, password: authToken }
      }
    );

    await logSecurityEvent('call_initiated', {
      to: to.substring(0, 3) + '***'
    }, req.user.id, req);

    res.json({
      success: true,
      callId: response.data.sid,
      data: response.data
    });
  } catch (error) {
    console.error('[Communications] Twilio call error:', error.response?.data || error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to initiate call'
    });
  }
}));

/**
 * GET /api/communications/call/answer
 * Twilio call answer webhook (TwiML)
 */
router.get('/call/answer', (req, res) => {
  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna">Hello, this is AI Wholesail calling about a property opportunity. Please hold for an agent.</Say>
  <Pause length="2"/>
  <Say voice="Polly.Joanna">Thank you for your time. Goodbye.</Say>
  <Hangup/>
</Response>`;

  res.set('Content-Type', 'text/xml');
  res.send(twiml);
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
