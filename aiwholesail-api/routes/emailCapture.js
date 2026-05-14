/**
 * POST /api/email-capture — public lead-capture endpoint.
 *
 * Backs the exit-intent modal on /guides/finding-motivated-sellers (PR
 * #332) and any future lead-magnet form. Captures the email server-side
 * AND triggers delivery of the promised lead magnet via Resend.
 *
 * Why this exists: PR #332 shipped a frontend modal that promises
 * "The 10-step checklist is hitting your inbox in the next minute".
 * Without this route, that promise was a lie — the modal fell back to
 * window.dataLayer-only with no delivery handler. Per
 * `feedback_prod_ship_means_actually_works.md` we don't ship UIs that
 * promise behaviors the backend can't honor.
 *
 * Lead magnets are an allowlist (LEAD_MAGNETS below). Unknown slugs
 * return 400 — we never silently swallow a request we can't fulfill.
 *
 * Idempotency: (email, slug) is the natural unique key. Duplicate
 * submissions return 200 OK but do NOT re-send the lead magnet email
 * (no abuse vector for triggering repeat sends).
 */

const express = require('express');
const { body, validationResult } = require('express-validator');
const { Resend } = require('resend');
const { pool } = require('../config/database');
const { asyncHandler, logSecurityEvent } = require('../middleware/errorHandler');
const { checkDatabaseRateLimit } = require('../middleware/rateLimit');

const router = express.Router();
const resend = new Resend(process.env.RESEND_API_KEY);

// Allowlist of lead magnets. Each entry defines the subject + body
// template for the Resend delivery. Adding a new lead magnet:
//   1. Add a slug + entry here
//   2. Make sure the frontend form submits the matching `slug`
const LEAD_MAGNETS = {
  'finding-motivated-sellers': {
    subject: 'Your 10-step motivated-sellers checklist',
    htmlBody: (firstName) => `
<!doctype html>
<html><body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 16px; line-height: 1.55; color: #1a1a1a; max-width: 620px; margin: 0 auto; padding: 24px;">
  <p>Hi${firstName ? ' ' + firstName : ''},</p>
  <p>Thanks for grabbing the <strong>10-Step Motivated-Sellers Checklist</strong>. Here it is:</p>
  <ol>
    <li><strong>Pull the absentee-owners list</strong> for your target ZIPs — these are out-of-state landlords, the highest-converting direct-mail segment.</li>
    <li><strong>Filter for high equity</strong> — 50%+ equity OR $100k+ estimated equity gives you room to negotiate.</li>
    <li><strong>Cross-reference tax-delinquent records</strong> — owners behind on property taxes are the strongest motivation signal.</li>
    <li><strong>Skip-trace</strong> to get phone numbers — direct mail alone converts 1-3%; mail + call doubles that.</li>
    <li><strong>Send 3 mailings spaced 2-3 weeks apart</strong> — single-touch campaigns underperform; 3-touch sequences hit 8-12% reply rates.</li>
    <li><strong>Personalize the property reference</strong> — "your property at 1234 Main St" pulls 4x the response of generic.</li>
    <li><strong>Use a P.O. box reply address</strong> — handwritten outer envelope + business reply card converts best.</li>
    <li><strong>Call back within 5 minutes</strong> of any response — speed-to-lead is the #1 lever after targeting.</li>
    <li><strong>Pre-qualify on the call</strong>: timeline, condition, prior offers, motivation. 4 questions in 90 seconds.</li>
    <li><strong>Lock the appointment same-week</strong> — every day after week 1 cuts close-rate in half.</li>
  </ol>
  <p>Want to skip the manual work? AIWholesail does all 10 steps automatically — <a href="https://aiwholesail.com/auth?mode=signup&amp;utm_source=lead-magnet&amp;utm_campaign=motivated-sellers-checklist">start a free trial</a>.</p>
  <p>— Connor<br/>Founder, AIWholesail</p>
</body></html>`,
  },
};

// Crude first-name extraction from email local-part. Used only when
// the frontend doesn't supply a name. e.g., "connor.odea@x.com" →
// "Connor"; "investor42@x.com" → null (won't title-case digits).
function firstNameFromEmail(email) {
  if (typeof email !== 'string') return null;
  const local = email.split('@')[0] || '';
  const head = local.split(/[.\-_+]/)[0] || '';
  if (!/^[A-Za-z]{2,15}$/.test(head)) return null;
  return head.charAt(0).toUpperCase() + head.slice(1).toLowerCase();
}

router.post(
  '/',
  [
    body('email').isEmail().withMessage('Valid email required').normalizeEmail(),
    body('slug').isString().notEmpty().withMessage('slug is required'),
    body('firstName').optional().isString().isLength({ max: 60 }),
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'Validation failed', errors: errors.array() });
    }

    const { email, slug } = req.body;
    const magnet = LEAD_MAGNETS[slug];
    if (!magnet) {
      return res.status(400).json({ error: 'Unknown lead magnet slug' });
    }

    // Rate limit by IP — 5 captures/hour, prevents a basic mass-submit abuse.
    const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim()
      || req.headers['x-real-ip']
      || req.ip
      || 'unknown';
    const rateCheck = await checkDatabaseRateLimit(ip, 'email_capture', 5, 60);
    if (!rateCheck.allowed) {
      await logSecurityEvent('email_capture_rate_limited', { ip, slug }, null, req);
      return res.status(429).json({ error: 'Too many submissions. Try again later.' });
    }

    // Insert lead. ON CONFLICT (email, slug) DO NOTHING gives us
    // idempotency: re-submitting the same address won't trigger a
    // second delivery, but also won't error out (good UX — user
    // doesn't get a scary message just because they hit submit twice).
    const insertResult = await pool.query(
      `INSERT INTO email_captures (email, slug, source_ip, user_agent, referrer)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (email, slug) DO NOTHING
       RETURNING id`,
      [
        email,
        slug,
        ip,
        (req.headers['user-agent'] || '').slice(0, 500),
        (req.headers['referer'] || '').slice(0, 500),
      ],
    );

    const isNewCapture = insertResult.rowCount > 0;

    // Only send the magnet email on NEW captures. Duplicate submission =
    // capture already in DB = the user already got the email at least
    // once. Don't re-mail. (Prevents Resend cost blowups from a buggy
    // client that re-submits in a loop, AND prevents user-confusing
    // re-deliveries.)
    if (isNewCapture) {
      try {
        const firstName = firstNameFromEmail(email);
        const result = await resend.emails.send({
          from: 'Connor <connor@aiwholesail.com>',
          to: email,
          replyTo: 'connor@aiwholesail.com',
          subject: magnet.subject,
          html: magnet.htmlBody(firstName),
        });
        if (result.error) {
          // Lead is captured in DB. Email-send failure is non-fatal —
          // a retry job (TODO) can re-attempt. Log and continue.
          console.error('[email-capture] resend send error', {
            slug,
            email_domain: email.split('@')[1],
            error: result.error,
          });
        }
      } catch (err) {
        // Same as above — lead is captured, just couldn't email yet.
        console.error('[email-capture] resend send exception', {
          slug,
          email_domain: email.split('@')[1],
          message: err.message,
        });
      }
    }

    return res.json({ ok: true, captured: isNewCapture });
  }),
);

module.exports = router;
