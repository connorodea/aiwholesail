const express = require('express');
const { body, validationResult } = require('express-validator');
const { asyncHandler, logSecurityEvent } = require('../middleware/errorHandler');
const { checkDatabaseRateLimit } = require('../middleware/rateLimit');

const { Resend } = require('resend');
const resend = new Resend(process.env.RESEND_API_KEY);

const router = express.Router();

/**
 * POST /api/contact
 * Public endpoint — accept a contact form submission, send via Resend email
 */
router.post('/', [
  body('name')
    .trim()
    .notEmpty().withMessage('Name is required')
    .isLength({ max: 200 }).withMessage('Name must be under 200 characters')
    .custom(value => {
      if (/<[^>]*>/g.test(value)) {
        throw new Error('Name contains invalid characters');
      }
      return true;
    }),
  body('email')
    .isEmail().withMessage('Valid email is required')
    .normalizeEmail(),
  body('subject')
    .trim()
    .notEmpty().withMessage('Subject is required')
    .isLength({ max: 300 }).withMessage('Subject must be under 300 characters')
    .custom(value => {
      if (/<[^>]*>/g.test(value)) {
        throw new Error('Subject contains invalid characters');
      }
      return true;
    }),
  body('message')
    .trim()
    .notEmpty().withMessage('Message is required')
    .isLength({ max: 5000 }).withMessage('Message must be under 5000 characters'),
], asyncHandler(async (req, res) => {
  // Validate inputs
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: 'Validation failed', errors: errors.array() });
  }

  // Rate limit: 3 per hour per IP
  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim()
    || req.headers['x-real-ip']
    || req.ip
    || 'unknown';

  const rateCheck = await checkDatabaseRateLimit(ip, 'contact_form', 3, 60);
  if (!rateCheck.allowed) {
    await logSecurityEvent('contact_rate_limited', { ip }, null, req);
    return res.status(429).json({
      error: 'Too many contact submissions. Please try again later.',
      retryAfter: 3600,
    });
  }

  const { name, email, subject, message } = req.body;

  // Send email via Resend
  try {
    await resend.emails.send({
      from: 'AIWholesail Contact <noreply@aiwholesail.com>',
      to: 'connor@upscaledinc.com',
      replyTo: email,
      subject: `[Contact Form] ${subject}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 640px; margin: 0 auto; background: #08090a; color: #ffffff; padding: 40px 30px; border-radius: 12px;">
          <img src="https://aiwholesail.com/logo-white.png" alt="AIWholesail" style="height: 48px; margin-bottom: 24px;" />
          <h2 style="color: #06b6d4; margin-bottom: 16px;">New Contact Form Submission</h2>
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
            <tr>
              <td style="color: #737373; padding: 8px 12px 8px 0; vertical-align: top; white-space: nowrap;">Name:</td>
              <td style="color: #e5e5e5; padding: 8px 0;">${escapeHtml(name)}</td>
            </tr>
            <tr>
              <td style="color: #737373; padding: 8px 12px 8px 0; vertical-align: top; white-space: nowrap;">Email:</td>
              <td style="color: #e5e5e5; padding: 8px 0;"><a href="mailto:${escapeHtml(email)}" style="color: #06b6d4;">${escapeHtml(email)}</a></td>
            </tr>
            <tr>
              <td style="color: #737373; padding: 8px 12px 8px 0; vertical-align: top; white-space: nowrap;">Subject:</td>
              <td style="color: #e5e5e5; padding: 8px 0;">${escapeHtml(subject)}</td>
            </tr>
          </table>
          <div style="background: #111; border: 1px solid #262626; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
            <p style="color: #737373; font-size: 12px; text-transform: uppercase; letter-spacing: 0.1em; margin: 0 0 8px;">Message</p>
            <p style="color: #d4d4d4; line-height: 1.7; margin: 0; white-space: pre-wrap;">${escapeHtml(message)}</p>
          </div>
          <hr style="border: none; border-top: 1px solid #262626; margin: 24px 0;" />
          <p style="color: #525252; font-size: 12px;">
            Submitted from AIWholesail.com contact form &middot; IP: ${escapeHtml(ip)}
          </p>
        </div>
      `,
    });

    console.log(`[Contact] Email sent — from: ${email.substring(0, 3)}***, subject: "${subject.substring(0, 30)}"`);
  } catch (emailErr) {
    console.error('[Contact] Failed to send email:', emailErr.message);
    await logSecurityEvent('contact_email_failed', { error: emailErr.message }, null, req);
    return res.status(500).json({ error: 'Failed to send message. Please try again or email us directly at connor@upscaledinc.com.' });
  }

  await logSecurityEvent('contact_form_submitted', {
    name: name.substring(0, 3) + '***',
    email: email.substring(0, 3) + '***',
    subject: subject.substring(0, 50),
  }, null, req);

  res.json({ message: 'Message sent successfully! We\'ll get back to you within 24 hours.' });
}));

/**
 * Escape HTML to prevent XSS in email body
 */
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

module.exports = router;
