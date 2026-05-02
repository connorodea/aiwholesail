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
  const submittedAt = new Date().toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });
  try {
    await resend.emails.send({
      from: 'AIWholesail Contact <noreply@aiwholesail.com>',
      to: 'connor@upscaledinc.com',
      replyTo: email,
      subject: `[Contact Form] ${subject}`,
      html: `
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #000000; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
          <tr><td align="center" style="padding: 40px 20px;">
            <!--[if mso]><table width="600" cellpadding="0" cellspacing="0" border="0"><tr><td><![endif]-->
            <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width: 600px; width: 100%; background-color: #0a0a0b; border-radius: 12px; overflow: hidden; border: 1px solid #1a1a1a;">

              <!-- Logo header -->
              <tr><td style="padding: 28px 32px 20px; border-bottom: 1px solid #1a1a1a;">
                <img src="https://aiwholesail.com/logo-white.png" alt="AIWholesail" height="32" style="height: 32px; width: auto; display: block;" />
              </td></tr>

              <!-- Gradient accent bar -->
              <tr><td style="height: 3px; background: linear-gradient(90deg, #06b6d4, #0891b2, #06b6d4); font-size: 0; line-height: 0;">&nbsp;</td></tr>

              <!-- Content -->
              <tr><td style="padding: 36px 32px 32px;">

                <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 8px;">
                  <tr><td style="color: #ffffff; font-size: 26px; font-weight: 700; letter-spacing: -0.5px; line-height: 1.2;">
                    New Contact Form Message
                  </td></tr>
                </table>

                <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 28px;">
                  <tr><td style="color: #737373; font-size: 13px; line-height: 1.5;">
                    ${submittedAt} &middot; Reply directly to respond to <strong style="color: #a3a3a3;">${escapeHtml(name)}</strong>
                  </td></tr>
                </table>

                <!-- Sender details -->
                <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 24px;">
                  <tr>
                    <td style="padding: 14px 0; border-bottom: 1px solid #1a1a1a;">
                      <table width="100%" cellpadding="0" cellspacing="0" border="0">
                        <tr>
                          <td width="90" style="color: #525252; font-size: 13px; font-weight: 500;">From</td>
                          <td style="color: #e5e5e5; font-size: 15px; font-weight: 500;">${escapeHtml(name)}</td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 14px 0; border-bottom: 1px solid #1a1a1a;">
                      <table width="100%" cellpadding="0" cellspacing="0" border="0">
                        <tr>
                          <td width="90" style="color: #525252; font-size: 13px; font-weight: 500;">Email</td>
                          <td style="font-size: 15px; font-weight: 500;"><a href="mailto:${escapeHtml(email)}" style="color: #06b6d4; text-decoration: none;">${escapeHtml(email)}</a></td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 14px 0;">
                      <table width="100%" cellpadding="0" cellspacing="0" border="0">
                        <tr>
                          <td width="90" style="color: #525252; font-size: 13px; font-weight: 500;">Subject</td>
                          <td style="color: #e5e5e5; font-size: 15px; font-weight: 500;">${escapeHtml(subject)}</td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                </table>

                <!-- Message in quote-style block -->
                <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 28px;">
                  <tr>
                    <td width="3" style="background-color: #262626; border-radius: 2px;">&nbsp;</td>
                    <td style="padding: 20px 24px; background-color: #111111; border-radius: 0 8px 8px 0;">
                      <table width="100%" cellpadding="0" cellspacing="0" border="0">
                        <tr><td style="color: #525252; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.1em; padding-bottom: 12px;">Message</td></tr>
                        <tr><td style="color: #d4d4d4; font-size: 15px; line-height: 1.75; white-space: pre-wrap;">${escapeHtml(message)}</td></tr>
                      </table>
                    </td>
                  </tr>
                </table>

                <!-- Reply CTA -->
                <table cellpadding="0" cellspacing="0" border="0">
                  <tr><td style="background-color: #06b6d4; border-radius: 8px; padding: 14px 32px; box-shadow: 0 2px 8px rgba(6,182,212,0.25);">
                    <a href="mailto:${escapeHtml(email)}" style="color: #000000; font-weight: 600; font-size: 15px; text-decoration: none; display: inline-block;">Reply to ${escapeHtml(name.split(' ')[0])}</a>
                  </td></tr>
                </table>

              </td></tr>

              <!-- Footer -->
              <tr><td style="padding: 20px 32px 24px; border-top: 1px solid #1a1a1a;">
                <table width="100%" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td style="color: #404040; font-size: 11px; line-height: 1.5;">
                      &copy; 2026 AIWholesail &middot; <a href="https://aiwholesail.com" style="color: #06b6d4; text-decoration: none;">aiwholesail.com</a>
                      &middot; IP: ${escapeHtml(ip)}
                    </td>
                  </tr>
                </table>
              </td></tr>

            </table>
            <!--[if mso]></td></tr></table><![endif]-->
          </td></tr>
        </table>
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
