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
// Branded HTML email template. Colors + fonts sourced from the actual
// website theme (src/index.css, tailwind.config.ts) rather than guessed:
//
//   --background  220 10% 3.5%   → #08090a   outer canvas
//   --primary     181 100% 39%   → #00c4c8   brand seafoam (cyan-500)
//   --foreground  0 0% 100%      → #ffffff   white text
//   card gradient                → linear-gradient(145deg, #141414, #0f0f0f)
//   border (cards)               → #2e2e2e   (hsl 0 0% 18%)
//   font-family                  → Onest, Montserrat fallback (matches site)
//
// Logo: https://aiwholesail.com/logo-aiw-email.png (already deployed,
// purpose-built for email — referenced in PublicLayout for the site
// header is logo-white.png, but the email variant is the canonical
// brand-aligned image for off-site contexts).
//
// Table-based layout because email clients (Gmail iOS, Outlook desktop)
// still ignore flexbox/grid. Inline styles because Gmail strips <style>.
// Mso conditional opens the 640px frame in Outlook 2016+.

const BRAND = {
  bg: '#08090a',
  cardTop: '#141414',
  cardBottom: '#0f0f0f',
  border: '#2e2e2e',
  textPrimary: '#ffffff',
  textBody: '#d1d5db',
  textMuted: '#9ca3af',
  textDim: '#6b7280',
  accent: '#00c4c8',           // brand seafoam (cyan-500 in the AIW palette)
  accentGlow: 'rgba(0, 196, 200, 0.18)',
  onAccent: '#000000',         // black text on cyan buttons per --primary-foreground
  logoUrl: 'https://aiwholesail.com/logo-aiw-email.png',
  font: "'Onest', 'Montserrat', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
};

function renderStep(num, title, body) {
  return `
        <tr><td style="padding: 12px 0;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
            <tr>
              <td width="40" valign="top" style="width:40px;">
                <div style="width:32px;height:32px;line-height:32px;border-radius:16px;background:${BRAND.accent};color:${BRAND.onAccent};text-align:center;font-weight:700;font-size:14px;font-family:${BRAND.font};">${num}</div>
              </td>
              <td valign="top" style="padding-left:14px;color:${BRAND.textBody};font-size:15px;line-height:1.6;font-family:${BRAND.font};">
                <strong style="color:${BRAND.textPrimary};font-weight:600;">${title}</strong> ${body}
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
<body style="margin:0;padding:0;background-color:${BRAND.bg};font-family:${BRAND.font};color:${BRAND.textBody};">
  <!-- Preheader (hidden, appears in inbox preview) -->
  <div style="display:none;font-size:1px;color:${BRAND.bg};line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">
    The 10 steps that turn cold lists into closed wholesale deals.
  </div>

  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:${BRAND.bg};">
    <tr>
      <td align="center" style="padding:40px 16px;">
        <!--[if mso]><table width="640" cellpadding="0" cellspacing="0" border="0"><tr><td><![endif]-->
        <!--
          Card surface uses the site's --gradient-card token:
          linear-gradient(145deg, hsl(0 0% 8%), hsl(0 0% 6%)) = #141414 → #0f0f0f
          background-color fallback for clients that ignore gradients.
        -->
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="640" style="max-width:640px;width:100%;background-color:${BRAND.cardTop};background-image:linear-gradient(145deg, ${BRAND.cardTop}, ${BRAND.cardBottom});border:1px solid ${BRAND.border};border-radius:16px;overflow:hidden;">

          <!-- Header / brand logo from the website -->
          <tr>
            <td style="padding:36px 40px 28px 40px;border-bottom:1px solid ${BRAND.border};">
              <table cellpadding="0" cellspacing="0" border="0" width="100%">
                <tr>
                  <td align="left" valign="middle">
                    <a href="https://aiwholesail.com" style="text-decoration:none;line-height:0;">
                      <img src="${BRAND.logoUrl}" width="64" height="64" alt="AIWholesail" style="display:block;height:64px;width:auto;border:0;outline:none;text-decoration:none;">
                    </a>
                  </td>
                  <td align="right" valign="middle" style="font-family:${BRAND.font};font-size:11px;color:${BRAND.textDim};letter-spacing:0.1em;text-transform:uppercase;font-weight:600;">
                    Wholesaler Toolkit
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Headline -->
          <tr>
            <td style="padding:40px 40px 8px 40px;">
              <p style="margin:0 0 14px 0;font-family:${BRAND.font};font-size:12px;color:${BRAND.accent};letter-spacing:0.12em;text-transform:uppercase;font-weight:700;">10-Step Playbook</p>
              <h1 style="margin:0;font-family:${BRAND.font};font-size:30px;line-height:1.15;color:${BRAND.textPrimary};font-weight:700;letter-spacing:-0.015em;">
                The motivated-sellers checklist
              </h1>
            </td>
          </tr>

          <!-- Greeting + intro -->
          <tr>
            <td style="padding:24px 40px 8px 40px;">
              <p style="margin:0 0 12px 0;font-family:${BRAND.font};font-size:16px;color:${BRAND.textBody};line-height:1.55;">${greeting}</p>
              <p style="margin:0;font-family:${BRAND.font};font-size:16px;color:${BRAND.textBody};line-height:1.65;">
                Thanks for grabbing the checklist. Here are the <strong style="color:${BRAND.textPrimary};font-weight:600;">10 steps</strong> that turn cold property lists into closed wholesale deals — in order, with the why behind each one.
              </p>
            </td>
          </tr>

          <!-- Steps -->
          <tr>
            <td style="padding:20px 40px 8px 40px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                ${stepsHtml}
              </table>
            </td>
          </tr>

          <!-- Divider -->
          <tr>
            <td style="padding:28px 40px 0 40px;">
              <div style="height:1px;background:${BRAND.border};width:100%;line-height:1px;font-size:0;">&nbsp;</div>
            </td>
          </tr>

          <!-- CTA -->
          <tr>
            <td style="padding:32px 40px 16px 40px;">
              <p style="margin:0 0 14px 0;font-family:${BRAND.font};font-size:18px;line-height:1.4;color:${BRAND.textPrimary};font-weight:600;">
                Want to skip the manual work?
              </p>
              <p style="margin:0 0 28px 0;font-family:${BRAND.font};font-size:15px;line-height:1.65;color:${BRAND.textMuted};">
                AIWholesail does all 10 steps automatically — absentee filtering, equity scoring, tax-delinquent cross-reference, skip-trace, and a campaign builder that lays out the 3-touch sequence for you.
              </p>
              <!-- Button (table-based for Outlook compat) -->
              <table cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td align="center" bgcolor="${BRAND.accent}" style="border-radius:10px;background-color:${BRAND.accent};box-shadow:0 0 24px ${BRAND.accentGlow};">
                    <a href="https://aiwholesail.com/auth?mode=signup&amp;utm_source=lead-magnet&amp;utm_campaign=motivated-sellers-checklist" style="display:inline-block;padding:14px 28px;font-family:${BRAND.font};font-size:15px;font-weight:700;color:${BRAND.onAccent};text-decoration:none;letter-spacing:0.01em;">
                      Start your free trial →
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin:14px 0 0 0;font-family:${BRAND.font};font-size:12px;color:${BRAND.textDim};">No credit card. 14-day trial.</p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:36px 40px 40px 40px;border-top:1px solid ${BRAND.border};">
              <p style="margin:0 0 6px 0;font-family:${BRAND.font};font-size:15px;color:${BRAND.textBody};line-height:1.5;">— Connor</p>
              <p style="margin:0;font-family:${BRAND.font};font-size:13px;color:${BRAND.textDim};line-height:1.5;">
                Founder, AIWholesail · <a href="mailto:connor@aiwholesail.com" style="color:${BRAND.accent};text-decoration:none;">connor@aiwholesail.com</a>
              </p>
            </td>
          </tr>
        </table>
        <!--[if mso]></td></tr></table><![endif]-->

        <!-- Outer footer (legal-ish, sits outside the card) -->
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="640" style="max-width:640px;width:100%;margin-top:24px;">
          <tr>
            <td align="center" style="padding:8px 16px;font-family:${BRAND.font};font-size:11px;color:${BRAND.textDim};line-height:1.6;">
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
