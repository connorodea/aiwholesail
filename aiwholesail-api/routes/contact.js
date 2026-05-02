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
        <div style="font-family: 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #08090a; border-radius: 16px; overflow: hidden; border: 1px solid rgba(255,255,255,0.06);">
          <!--[if mso]><table width="600" cellpadding="0" cellspacing="0" border="0"><tr><td><![endif]-->
          <div style="padding: 32px 32px 24px; border-bottom: 1px solid rgba(255,255,255,0.06);">
            <img src="https://aiwholesail.com/logo-white.png" alt="AIWholesail" style="height: 36px; width: auto;" />
          </div>
          <div style="padding: 32px;">
            <h1 style="color: #ffffff; font-size: 24px; font-weight: 600; margin: 0 0 8px; letter-spacing: -0.5px;">New Contact Form Submission</h1>
            <p style="color: #a3a3a3; font-size: 15px; line-height: 1.6; margin: 0 0 24px;">
              Someone submitted the contact form on AIWholesail.com. Details below:
            </p>
            <div style="border-left: 3px solid #06b6d4; background-color: rgba(6,182,212,0.05); border-radius: 0 8px 8px 0; padding: 20px 24px; margin: 0 0 24px;">
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="color: #737373; font-size: 13px; padding: 6px 16px 6px 0; vertical-align: top; white-space: nowrap;">Name</td>
                  <td style="color: #ffffff; font-size: 15px; padding: 6px 0; font-weight: 500;">${escapeHtml(name)}</td>
                </tr>
                <tr>
                  <td style="color: #737373; font-size: 13px; padding: 6px 16px 6px 0; vertical-align: top; white-space: nowrap;">Email</td>
                  <td style="color: #ffffff; font-size: 15px; padding: 6px 0; font-weight: 500;"><a href="mailto:${escapeHtml(email)}" style="color: #06b6d4; text-decoration: none;">${escapeHtml(email)}</a></td>
                </tr>
                <tr>
                  <td style="color: #737373; font-size: 13px; padding: 6px 16px 6px 0; vertical-align: top; white-space: nowrap;">Subject</td>
                  <td style="color: #ffffff; font-size: 15px; padding: 6px 0; font-weight: 500;">${escapeHtml(subject)}</td>
                </tr>
              </table>
            </div>
            <div style="background-color: #111111; border: 1px solid rgba(255,255,255,0.06); border-radius: 8px; padding: 20px 24px; margin: 0 0 24px;">
              <p style="color: #737373; font-size: 11px; text-transform: uppercase; letter-spacing: 0.1em; margin: 0 0 10px; font-weight: 600;">Message</p>
              <p style="color: #d4d4d4; font-size: 15px; line-height: 1.7; margin: 0; white-space: pre-wrap;">${escapeHtml(message)}</p>
            </div>
          </div>
          <div style="padding: 24px 32px; border-top: 1px solid rgba(255,255,255,0.06); background-color: rgba(255,255,255,0.02);">
            <p style="color: #525252; font-size: 12px; margin: 0; line-height: 1.5;">
              Submitted from AIWholesail.com contact form &middot; IP: ${escapeHtml(ip)}<br/>
              AIWholesail &mdash; Find profitable real estate deals with AI<br/>
              <a href="https://aiwholesail.com" style="color: #06b6d4; text-decoration: none;">aiwholesail.com</a>
            </p>
          </div>
          <!--[if mso]></td></tr></table><![endif]-->
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
