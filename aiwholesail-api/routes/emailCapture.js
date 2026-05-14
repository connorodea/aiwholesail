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
// Branded HTML email template. Matches the AIWholesail visual identity:
//   - Dark canvas (#08090a) outer + card (#0a0a0b) with subtle border (#1a1a1a)
//   - Cyan brand accent (#22d3ee) for step badges + primary CTA
//   - Serif logotype 'AIW.' at the top
//   - Each step rendered as a numbered-badge row, not a bare <ol>
//
// Table-based layout because email clients (Gmail iOS, Outlook desktop)
// still ignore flexbox/grid. Inline styles because Gmail strips <style>.
// Mso conditional tag opens the 620px frame in Outlook 2016+.
function renderStep(num, title, body) {
  return `
        <tr><td style="padding: 10px 0;">
          <table cellpadding="0" cellspacing="0" border="0" width="100%">
            <tr>
              <td width="36" valign="top" style="width:36px;">
                <div style="width:28px;height:28px;line-height:28px;border-radius:14px;background:#22d3ee;color:#08090a;text-align:center;font-weight:700;font-size:14px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">${num}</div>
              </td>
              <td valign="top" style="padding-left:12px;color:#d1d5db;font-size:15px;line-height:1.55;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
                <strong style="color:#f9fafb;">${title}</strong> ${body}
              </td>
            </tr>
          </table>
        </td></tr>`;
}

const CHECKLIST_STEPS = [
  ['Pull the absentee-owners list', '— for your target ZIPs. Out-of-state landlords are the highest-converting direct-mail segment.'],
  ['Filter for high equity', '— 50%+ equity OR $100k+ estimated equity gives you room to negotiate.'],
  ['Cross-reference tax-delinquent records', '— owners behind on property taxes are the strongest motivation signal.'],
  ['Skip-trace to get phone numbers', '— direct mail alone converts 1-3%; mail + call doubles that.'],
  ['Send 3 mailings spaced 2-3 weeks apart', '— single-touch campaigns underperform; 3-touch sequences hit 8-12% reply rates.'],
  ['Personalize the property reference', '— "your property at 1234 Main St" pulls 4x the response of generic copy.'],
  ['Use a P.O. box reply address', '— handwritten outer envelope + business reply card converts best.'],
  ['Call back within 5 minutes', '— of any response. Speed-to-lead is the #1 lever after targeting.'],
  ['Pre-qualify on the call', '— timeline, condition, prior offers, motivation. 4 questions in 90 seconds.'],
  ['Lock the appointment same-week', '— every day after week 1 cuts close-rate in half.'],
];

function renderChecklistEmail(firstName) {
  const greeting = `Hi${firstName ? ' ' + firstName : ' there'},`;
  const stepsHtml = CHECKLIST_STEPS.map(([t, b], i) => renderStep(i + 1, t, b)).join('');
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="dark light">
  <meta name="supported-color-schemes" content="dark light">
  <title>Your 10-Step Motivated-Sellers Checklist</title>
</head>
<body style="margin:0;padding:0;background-color:#08090a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#d1d5db;">
  <!-- Preheader (hidden, appears in inbox preview) -->
  <div style="display:none;font-size:1px;color:#08090a;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">
    The 10 steps that turn cold lists into closed wholesale deals.
  </div>

  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#08090a;">
    <tr>
      <td align="center" style="padding:40px 16px;">
        <!--[if mso]><table width="620" cellpadding="0" cellspacing="0" border="0"><tr><td><![endif]-->
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="620" style="max-width:620px;width:100%;background-color:#0a0a0b;border:1px solid #1a1a1a;border-radius:16px;overflow:hidden;">

          <!-- Header / brand mark -->
          <tr>
            <td style="padding:32px 40px 24px 40px;border-bottom:1px solid #1a1a1a;">
              <table cellpadding="0" cellspacing="0" border="0" width="100%">
                <tr>
                  <td align="left" style="font-family:Georgia,'Times New Roman',serif;font-size:32px;font-weight:700;color:#ffffff;letter-spacing:-0.02em;line-height:1;">
                    AIW<span style="color:#22d3ee;">.</span>
                  </td>
                  <td align="right" style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:11px;color:#6b7280;letter-spacing:0.08em;text-transform:uppercase;">
                    Wholesaler Toolkit
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Headline -->
          <tr>
            <td style="padding:36px 40px 8px 40px;">
              <p style="margin:0 0 16px 0;font-size:14px;color:#9ca3af;letter-spacing:0.05em;text-transform:uppercase;">10-Step Playbook</p>
              <h1 style="margin:0;font-size:28px;line-height:1.2;color:#ffffff;font-weight:700;letter-spacing:-0.01em;">
                The motivated-sellers checklist
              </h1>
            </td>
          </tr>

          <!-- Greeting + intro -->
          <tr>
            <td style="padding:24px 40px 8px 40px;">
              <p style="margin:0 0 12px 0;font-size:16px;color:#d1d5db;line-height:1.55;">${greeting}</p>
              <p style="margin:0;font-size:16px;color:#d1d5db;line-height:1.6;">
                Thanks for grabbing the checklist. Here are the <strong style="color:#ffffff;">10 steps</strong> that turn cold property lists into closed wholesale deals — in order, with the why behind each one.
              </p>
            </td>
          </tr>

          <!-- Steps -->
          <tr>
            <td style="padding:16px 40px 8px 40px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                ${stepsHtml}
              </table>
            </td>
          </tr>

          <!-- Divider -->
          <tr>
            <td style="padding:24px 40px 0 40px;">
              <div style="height:1px;background:#1a1a1a;width:100%;"></div>
            </td>
          </tr>

          <!-- CTA -->
          <tr>
            <td style="padding:32px 40px 16px 40px;">
              <p style="margin:0 0 20px 0;font-size:17px;line-height:1.5;color:#ffffff;font-weight:600;">
                Want to skip the manual work?
              </p>
              <p style="margin:0 0 24px 0;font-size:15px;line-height:1.6;color:#9ca3af;">
                AIWholesail does all 10 steps automatically — absentee filtering, equity scoring, tax-delinquent cross-reference, skip-trace, and a campaign builder that lays out the 3-touch sequence for you.
              </p>
              <!-- Button (table-based for Outlook compat) -->
              <table cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td align="center" bgcolor="#22d3ee" style="border-radius:10px;background-color:#22d3ee;">
                    <a href="https://aiwholesail.com/auth?mode=signup&amp;utm_source=lead-magnet&amp;utm_campaign=motivated-sellers-checklist" style="display:inline-block;padding:14px 28px;font-size:15px;font-weight:700;color:#08090a;text-decoration:none;letter-spacing:0.01em;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
                      Start your free trial →
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin:14px 0 0 0;font-size:12px;color:#6b7280;">No credit card. 14-day trial.</p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:32px 40px 36px 40px;border-top:1px solid #1a1a1a;">
              <p style="margin:0 0 6px 0;font-size:15px;color:#d1d5db;line-height:1.5;">— Connor</p>
              <p style="margin:0;font-size:13px;color:#6b7280;line-height:1.5;">
                Founder, AIWholesail · <a href="mailto:connor@aiwholesail.com" style="color:#22d3ee;text-decoration:none;">connor@aiwholesail.com</a>
              </p>
            </td>
          </tr>
        </table>
        <!--[if mso]></td></tr></table><![endif]-->

        <!-- Outer footer (legal-ish, sits outside the card) -->
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="620" style="max-width:620px;width:100%;margin-top:20px;">
          <tr>
            <td align="center" style="padding:8px 16px;font-size:11px;color:#4b5563;line-height:1.5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
              You're receiving this because you requested the checklist on aiwholesail.com.<br/>
              AIWholesail · Reply to opt out of these one-time guides.
            </td>
          </tr>
        </table>

      </td>
    </tr>
  </table>
</body>
</html>`;
}

const LEAD_MAGNETS = {
  'finding-motivated-sellers': {
    subject: 'Your 10-Step Motivated-Sellers Checklist',
    htmlBody: renderChecklistEmail,
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
