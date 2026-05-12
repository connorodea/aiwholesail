const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { body, validationResult } = require('express-validator');
const { query } = require('../config/database');
const { authenticate, generateAccessToken, generateRefreshToken, verifyRefreshToken } = require('../middleware/auth');
const { asyncHandler, AppError, logSecurityEvent } = require('../middleware/errorHandler');
const { checkDatabaseRateLimit } = require('../middleware/rateLimit');
const { getClient } = require('../config/database');
const { clientIp } = require('../lib/clientIp');
const { apiUrl, appUrl, frontendUrl } = require('../lib/env-urls');
const { respondError } = require('../lib/responses');

const { Resend } = require('resend');
const resend = new Resend(process.env.RESEND_API_KEY);
const Stripe = require('stripe');
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const router = express.Router();

// Password validation - requires uppercase, lowercase, digit, and special character
const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,}$/;

// Email validation
const validateEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/**
 * POST /api/auth/signup
 * Register a new user
 */
router.post('/signup', [
  body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  body('fullName').optional().trim().isLength({ max: 255 })
    .custom(value => {
      if (value && /<[^>]*>/g.test(value)) {
        throw new Error('Name contains invalid characters');
      }
      return true;
    })
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    await logSecurityEvent('signup_validation_failed', { errors: errors.array() }, null, req);
    return res.status(400).json({ error: 'Validation failed', errors: errors.array() });
  }

  const { email, password, fullName, phoneNumber, attribution } = req.body;
  const normalizedEmail = email.toLowerCase().trim();

  // Marketing attribution. Always an object (possibly empty). Defensive
  // pick — the frontend should only send known fields, but never trust
  // a client. Truncate long strings to fit DB column lengths.
  const attr = (attribution && typeof attribution === 'object') ? attribution : {};
  const clean = (v, max) => (typeof v === 'string' && v.length > 0) ? v.slice(0, max) : null;
  const marketingFields = {
    utm_source:   clean(attr.utm_source,   128),
    utm_medium:   clean(attr.utm_medium,   128),
    utm_campaign: clean(attr.utm_campaign, 255),
    utm_content:  clean(attr.utm_content,  255),
    utm_term:     clean(attr.utm_term,     255),
    fbclid:       clean(attr.fbclid,       512),
    gclid:        clean(attr.gclid,        512),
    landing_url:  clean(attr.landing_url,  2000),
    referrer:     clean(attr.referrer,     2000),
    first_visit_at: (typeof attr.first_visit_at === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(attr.first_visit_at))
      ? attr.first_visit_at : null,
    // fbp / fbc are NOT persisted to the DB (they're cookies meant to be
    // re-read at CAPI-send time, not stored long-term). They round-trip
    // via the user's browser cookies for the Layer-2 Meta CAPI call.
  };

  // Validate password strength
  if (!PASSWORD_REGEX.test(password)) {
    await logSecurityEvent('signup_weak_password', { email: normalizedEmail.substring(0, 3) + '***' }, null, req);
    return res.status(400).json({
      error: 'Password must contain at least 8 characters, including uppercase, lowercase, number, and special character'
    });
  }

  // Check if user already exists
  const existingUser = await query('SELECT id FROM users WHERE email = $1', [normalizedEmail]);
  if (existingUser.rows.length > 0) {
    await logSecurityEvent('signup_email_exists', { email: normalizedEmail.substring(0, 3) + '***' }, null, req);
    return res.status(409).json({ error: 'Email already registered' });
  }

  // Hash password
  const saltRounds = 12;
  const passwordHash = await bcrypt.hash(password, saltRounds);

  // Create user.
  // email_verified defaults to TRUE at signup. Verification was previously
  // a separate click-to-verify step, but it never gated any feature — the
  // app gave full Pro-trial access regardless of verification status. Audit
  // (PR #200 era): 63/77 trial users were unverified but 32 of them were
  // actively using the app, proving the gate was decorative and the 19.5%
  // verified-rate was a measurement of "willingness to click homework",
  // not an engagement signal.
  //
  // The verification token is still generated and stored so that legacy
  // welcome emails already in users' inboxes (with the old verify CTA)
  // continue to work as no-ops if clicked. The /verify-email/:token route
  // is preserved for the same reason. No behavior change for downstream
  // middleware — it only reads email_verified for display in the user
  // payload.
  const userId = uuidv4();
  const verificationToken = uuidv4();

  await query(
    `INSERT INTO users (
       id, email, password_hash, full_name, email_verification_token, email_verified,
       utm_source, utm_medium, utm_campaign, utm_content, utm_term,
       fbclid, gclid, landing_url, referrer, first_visit_at
     )
     VALUES ($1, $2, $3, $4, $5, true,
             $6, $7, $8, $9, $10,
             $11, $12, $13, $14, $15)`,
    [
      userId, normalizedEmail, passwordHash, fullName || null, verificationToken,
      marketingFields.utm_source, marketingFields.utm_medium,
      marketingFields.utm_campaign, marketingFields.utm_content, marketingFields.utm_term,
      marketingFields.fbclid, marketingFields.gclid,
      marketingFields.landing_url, marketingFields.referrer, marketingFields.first_visit_at,
    ]
  );

  // Generate tokens
  const accessToken = generateAccessToken(userId, normalizedEmail);
  const refreshToken = generateRefreshToken(userId);

  // Store refresh token
  const refreshExpiry = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days
  await query(
    'INSERT INTO sessions (user_id, refresh_token, expires_at) VALUES ($1, $2, $3)',
    [userId, refreshToken, refreshExpiry]
  );

  // Auto-start 7-day free trial
  const trialEnd = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  await query(
    `INSERT INTO subscribers (email, user_id, subscribed, subscription_tier, is_trial, trial_start, trial_end, subscription_end, updated_at)
     VALUES ($1, $2, true, 'Pro', true, NOW(), $3, $3, NOW())
     ON CONFLICT (email) DO UPDATE SET
       user_id = EXCLUDED.user_id,
       subscribed = true,
       subscription_tier = 'Pro',
       is_trial = true,
       trial_start = NOW(),
       trial_end = EXCLUDED.trial_end,
       subscription_end = EXCLUDED.subscription_end,
       updated_at = NOW()`,
    [normalizedEmail, userId, trialEnd]
  );

  // Create a Stripe customer up-front so the user appears in the Stripe
  // dashboard during their trial, the Customer Portal works before they
  // ever check out, and any future checkout reuses this customer id
  // (avoids the duplicate-customer race when two requests fire in parallel).
  //
  // Best-effort — Stripe outages must NOT break signup. The backfill script
  // (scripts/backfill-stripe-customers.js) picks up any rows we miss here.
  try {
    // Reuse an existing Stripe customer if one already exists for this email
    // (e.g. the user previously did a guest checkout before signing up).
    // Marketing-attribution metadata for Stripe — only include keys that
    // have values, since Stripe truncates and we want a clean dashboard.
    // Also includes fbp/fbc (Meta first-party cookies) which we do NOT
    // persist to the users table (they rotate) but DO need at Layer-2
    // CAPI-send time — and the webhook only sees what's on the Stripe
    // customer.
    const attrMetadata = {};
    if (marketingFields.utm_source)   attrMetadata.utm_source   = marketingFields.utm_source;
    if (marketingFields.utm_medium)   attrMetadata.utm_medium   = marketingFields.utm_medium;
    if (marketingFields.utm_campaign) attrMetadata.utm_campaign = marketingFields.utm_campaign;
    if (marketingFields.utm_content)  attrMetadata.utm_content  = marketingFields.utm_content;
    if (marketingFields.utm_term)     attrMetadata.utm_term     = marketingFields.utm_term;
    if (marketingFields.fbclid)       attrMetadata.fbclid       = marketingFields.fbclid;
    if (marketingFields.gclid)        attrMetadata.gclid        = marketingFields.gclid;
    if (marketingFields.landing_url)  attrMetadata.landing_url  = marketingFields.landing_url.slice(0, 500);
    // fbp / fbc — not DB-backed (they rotate), but Meta wants them at
    // CAPI send time. Stripe metadata is the durable side-channel.
    if (typeof attr.fbp === 'string' && attr.fbp) attrMetadata.fbp = attr.fbp.slice(0, 200);
    if (typeof attr.fbc === 'string' && attr.fbc) attrMetadata.fbc = attr.fbc.slice(0, 200);

    const existing = await stripe.customers.list({ email: normalizedEmail, limit: 1 });
    let stripeCustomerId;
    if (existing.data.length > 0) {
      stripeCustomerId = existing.data[0].id;
      // Update the existing Stripe customer with our metadata so the dashboard
      // shows the link back to our internal user_id.
      await stripe.customers.update(stripeCustomerId, {
        name: fullName || existing.data[0].name || undefined,
        phone: phoneNumber || existing.data[0].phone || undefined,
        metadata: {
          ...(existing.data[0].metadata || {}),
          user_id: userId,
          source: 'trial_signup',
          trial_started_at: new Date().toISOString(),
          trial_ends_at: trialEnd.toISOString(),
          ...attrMetadata,
        },
      });
    } else {
      const stripeCustomer = await stripe.customers.create({
        email: normalizedEmail,
        name: fullName || undefined,
        phone: phoneNumber || undefined,
        metadata: {
          user_id: userId,
          source: 'trial_signup',
          trial_started_at: new Date().toISOString(),
          trial_ends_at: trialEnd.toISOString(),
          ...attrMetadata,
        },
      });
      stripeCustomerId = stripeCustomer.id;
    }
    await query(
      'UPDATE subscribers SET stripe_customer_id = $1, updated_at = NOW() WHERE user_id = $2',
      [stripeCustomerId, userId]
    );
  } catch (err) {
    // Don't block signup. Log and let the backfill script reconcile later.
    console.error(`[auth/signup] Stripe customer creation failed for ${normalizedEmail.substring(0, 3)}***: ${err.message}`);
    await logSecurityEvent('stripe_customer_create_failed_at_signup', {
      user_id: userId,
      error: err.message?.substring(0, 200),
    }, userId, req);
  }

  // Store phone number in profile (profile auto-created by DB trigger)
  if (phoneNumber) {
    await query(
      'UPDATE profiles SET phone_number = $1 WHERE user_id = $2',
      [phoneNumber.trim(), userId]
    );
  }

  // Send notification to Quinton about new signup
  try {
    const signupTime = new Date().toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });
    const notifResult = await resend.emails.send({
      from: 'AIWholesail <noreply@aiwholesail.com>',
      to: ['quintonw500@gmail.com', 'cpodea5@gmail.com'],
      replyTo: normalizedEmail,
      subject: `New Signup: ${fullName || normalizedEmail}${phoneNumber ? ' — ' + phoneNumber : ''}`,
      html: `
        <style>@import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700;800&display=swap');</style>
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #000000; font-family: 'Montserrat', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
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

                <!-- Status badge -->
                <table cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 20px;">
                  <tr>
                    <td style="width: 10px; height: 10px; background-color: #22c55e; border-radius: 50%; font-size: 0; line-height: 0;">&nbsp;</td>
                    <td style="padding-left: 10px; color: #22c55e; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.1em;">New Signup</td>
                  </tr>
                </table>

                <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 28px;">
                  <tr>
                    <td style="color: #ffffff; font-size: 26px; font-weight: 700; letter-spacing: -0.5px; line-height: 1.2; padding-bottom: 8px;">${fullName || normalizedEmail}</td>
                  </tr>
                  <tr>
                    <td style="color: #737373; font-size: 14px; line-height: 1.5;">A new user just signed up and started a 7-day Pro trial. Reply to this email to reach them directly.</td>
                  </tr>
                </table>

                <!-- User details table -->
                <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 28px;">
                  <tr>
                    <td style="padding: 14px 0; border-bottom: 1px solid #1a1a1a;">
                      <table width="100%" cellpadding="0" cellspacing="0" border="0">
                        <tr>
                          <td width="110" style="color: #525252; font-size: 13px; font-weight: 500;">Name</td>
                          <td style="color: #e5e5e5; font-size: 15px; font-weight: 500;">${fullName || 'Not provided'}</td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 14px 0; border-bottom: 1px solid #1a1a1a;">
                      <table width="100%" cellpadding="0" cellspacing="0" border="0">
                        <tr>
                          <td width="110" style="color: #525252; font-size: 13px; font-weight: 500;">Email</td>
                          <td style="color: #e5e5e5; font-size: 15px; font-weight: 500;"><a href="mailto:${normalizedEmail}" style="color: #06b6d4; text-decoration: none;">${normalizedEmail}</a></td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 14px 0; border-bottom: 1px solid #1a1a1a;">
                      <table width="100%" cellpadding="0" cellspacing="0" border="0">
                        <tr>
                          <td width="110" style="color: #525252; font-size: 13px; font-weight: 500;">Phone</td>
                          <td style="color: #e5e5e5; font-size: 15px; font-weight: 500;">${phoneNumber ? '<a href="tel:' + phoneNumber.trim() + '" style="color: #06b6d4; text-decoration: none;">' + phoneNumber.trim() + '</a>' : '<span style="color: #525252;">Not provided</span>'}</td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 14px 0; border-bottom: 1px solid #1a1a1a;">
                      <table width="100%" cellpadding="0" cellspacing="0" border="0">
                        <tr>
                          <td width="110" style="color: #525252; font-size: 13px; font-weight: 500;">Plan</td>
                          <td style="font-size: 15px; font-weight: 500;">
                            <span style="color: #06b6d4;">Pro</span>
                            <span style="color: #525252;"> &middot; </span>
                            <span style="color: #737373; font-size: 13px;">7-day free trial</span>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 14px 0;">
                      <table width="100%" cellpadding="0" cellspacing="0" border="0">
                        <tr>
                          <td width="110" style="color: #525252; font-size: 13px; font-weight: 500;">Signed up</td>
                          <td style="color: #737373; font-size: 14px;">${signupTime}</td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                </table>

                <!-- Action buttons -->
                <table cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 8px;">
                  <tr>
                    ${phoneNumber ? '<td style="padding-right: 12px;"><table cellpadding="0" cellspacing="0" border="0"><tr><td style="background-color: #06b6d4; border-radius: 8px; padding: 12px 24px;"><a href="tel:' + phoneNumber.trim() + '" style="color: #000000; font-weight: 600; font-size: 14px; text-decoration: none; display: inline-block;">Call Now</a></td></tr></table></td>' : ''}
                    <td><table cellpadding="0" cellspacing="0" border="0"><tr><td style="background-color: #171717; border: 1px solid #262626; border-radius: 8px; padding: 12px 24px;"><a href="mailto:${normalizedEmail}" style="color: #e5e5e5; font-weight: 600; font-size: 14px; text-decoration: none; display: inline-block;">Send Email</a></td></tr></table></td>
                  </tr>
                </table>

              </td></tr>

              <!-- Footer -->
              <tr><td style="padding: 20px 32px 24px; border-top: 1px solid #1a1a1a;">
                <table width="100%" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td style="color: #404040; font-size: 11px; line-height: 1.5;">
                      &copy; 2026 AIWholesail &middot; <a href="https://aiwholesail.com" style="color: #06b6d4; text-decoration: none;">aiwholesail.com</a>
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
    if (notifResult?.error) {
      console.error('[Auth] Resend rejected signup notification:', JSON.stringify(notifResult.error));
    } else {
      console.log('[Auth] Signup notification sent', { id: notifResult?.data?.id, email: normalizedEmail });
    }
  } catch (notifyErr) {
    console.error('[Auth] Failed to send signup notification:', notifyErr.message);
  }

  // Send welcome + verification email via Resend
  const verifyUrl = `${apiUrl()}/api/auth/verify-email/${verificationToken}`;
  const appUrlValue = appUrl();
  const firstName = fullName ? fullName.split(' ')[0] : '';
  const trialEndDisplay = trialEnd.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  try {
    const verifyResult = await resend.emails.send({
      from: 'AIWholesail <noreply@aiwholesail.com>',
      to: normalizedEmail,
      subject: `Welcome to AIWholesail${firstName ? ', ' + firstName : ''} — your 7-day Pro trial is live`,
      html: `
        <style>@import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700;800&display=swap');</style>
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #000000; font-family: 'Montserrat', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
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
              <tr><td style="padding: 40px 32px 12px;">

                <!-- Welcome heading -->
                <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 16px;">
                  <tr><td style="color: #ffffff; font-size: 28px; font-weight: 700; letter-spacing: -0.5px; line-height: 1.2;">
                    Welcome to AIWholesail${firstName ? ', ' + firstName : ''}!
                  </td></tr>
                </table>

                <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 28px;">
                  <tr><td style="color: #a3a3a3; font-size: 16px; line-height: 1.7;">
                    Your 7-day Pro trial is live — no credit card required. Jump in and start finding deals.
                  </td></tr>
                </table>

                <!-- Open app CTA -->
                <table cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 28px;">
                  <tr><td style="background-color: #06b6d4; border-radius: 8px; padding: 16px 36px; box-shadow: 0 2px 8px rgba(6,182,212,0.25);">
                    <a href="${appUrlValue}/app" style="color: #000000; font-weight: 600; font-size: 16px; text-decoration: none; display: inline-block;">Open AIWholesail</a>
                  </td></tr>
                </table>

                <!-- Trial-end callout -->
                <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 32px; background-color: rgba(6,182,212,0.06); border: 1px solid rgba(6,182,212,0.20); border-radius: 10px;">
                  <tr><td style="padding: 16px 20px;">
                    <table width="100%" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td style="color: #06b6d4; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.1em; padding-bottom: 4px;">
                          Trial ends
                        </td>
                      </tr>
                      <tr>
                        <td style="color: #ffffff; font-size: 18px; font-weight: 600; letter-spacing: -0.2px;">
                          ${trialEndDisplay}
                        </td>
                      </tr>
                      <tr>
                        <td style="color: #a3a3a3; font-size: 13px; line-height: 1.5; padding-top: 6px;">
                          You'll get a heads-up before it ends. Keep Pro for $49/mo — cancel anytime.
                        </td>
                      </tr>
                    </table>
                  </td></tr>
                </table>

                <!-- What's included -->
                <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 14px;">
                  <tr><td style="color: #525252; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.1em;">
                    What's included in your Pro trial
                  </td></tr>
                </table>

                <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 32px;">
                  <tr><td style="padding-bottom: 12px;">
                    <table cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td valign="top" style="color: #06b6d4; font-size: 14px; padding-right: 10px; padding-top: 1px;">&#9679;</td>
                        <td style="color: #e5e5e5; font-size: 14px; line-height: 1.5;">
                          <strong style="color: #ffffff;">AI deal scoring</strong> — every listing scored against its Zestimate, top spreads sorted to the top
                        </td>
                      </tr>
                    </table>
                  </td></tr>
                  <tr><td style="padding-bottom: 12px;">
                    <table cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td valign="top" style="color: #06b6d4; font-size: 14px; padding-right: 10px; padding-top: 1px;">&#9679;</td>
                        <td style="color: #e5e5e5; font-size: 14px; line-height: 1.5;">
                          <strong style="color: #ffffff;">Real-time alerts</strong> — get pinged the moment a +$30K spread hits your markets
                        </td>
                      </tr>
                    </table>
                  </td></tr>
                  <tr><td>
                    <table cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td valign="top" style="color: #06b6d4; font-size: 14px; padding-right: 10px; padding-top: 1px;">&#9679;</td>
                        <td style="color: #e5e5e5; font-size: 14px; line-height: 1.5;">
                          <strong style="color: #ffffff;">Deal pipeline + buyer matching</strong> — track properties end-to-end and match them to your buyer list
                        </td>
                      </tr>
                    </table>
                  </td></tr>
                </table>

                <!-- Divider -->
                <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 22px;">
                  <tr><td style="border-top: 1px solid #1a1a1a; font-size: 0; line-height: 0;">&nbsp;</td></tr>
                </table>

                <!-- Quick-start actions -->
                <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 14px;">
                  <tr><td style="color: #525252; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.1em;">
                    Three things to try first
                  </td></tr>
                </table>

                <table width="100%" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td width="33%" valign="top" style="padding-right: 8px;">
                      <table cellpadding="0" cellspacing="0" border="0" width="100%">
                        <tr><td style="background-color: rgba(255,255,255,0.02); border: 1px solid #1a1a1a; border-radius: 8px; padding: 14px;">
                          <table cellpadding="0" cellspacing="0" border="0">
                            <tr><td style="color: #ffffff; font-size: 13px; font-weight: 600; padding-bottom: 4px;">1. Run your first search</td></tr>
                            <tr><td style="color: #a3a3a3; font-size: 12px; line-height: 1.5; padding-bottom: 10px;">Pick a market and we'll surface listings priced under Zestimate.</td></tr>
                            <tr><td><a href="${appUrlValue}/app" style="color: #06b6d4; font-size: 12px; font-weight: 600; text-decoration: none;">Search properties &rarr;</a></td></tr>
                          </table>
                        </td></tr>
                      </table>
                    </td>
                    <td width="33%" valign="top" style="padding: 0 4px;">
                      <table cellpadding="0" cellspacing="0" border="0" width="100%">
                        <tr><td style="background-color: rgba(255,255,255,0.02); border: 1px solid #1a1a1a; border-radius: 8px; padding: 14px;">
                          <table cellpadding="0" cellspacing="0" border="0">
                            <tr><td style="color: #ffffff; font-size: 13px; font-weight: 600; padding-bottom: 4px;">2. Set up alerts</td></tr>
                            <tr><td style="color: #a3a3a3; font-size: 12px; line-height: 1.5; padding-bottom: 10px;">Save a search as an alert — we'll email you the moment new deals hit.</td></tr>
                            <tr><td><a href="${appUrlValue}/app/alerts" style="color: #06b6d4; font-size: 12px; font-weight: 600; text-decoration: none;">Create alert &rarr;</a></td></tr>
                          </table>
                        </td></tr>
                      </table>
                    </td>
                    <td width="33%" valign="top" style="padding-left: 8px;">
                      <table cellpadding="0" cellspacing="0" border="0" width="100%">
                        <tr><td style="background-color: rgba(255,255,255,0.02); border: 1px solid #1a1a1a; border-radius: 8px; padding: 14px;">
                          <table cellpadding="0" cellspacing="0" border="0">
                            <tr><td style="color: #ffffff; font-size: 13px; font-weight: 600; padding-bottom: 4px;">3. Browse top deals</td></tr>
                            <tr><td style="color: #a3a3a3; font-size: 12px; line-height: 1.5; padding-bottom: 10px;">See the highest-spread listings across our 264 covered markets.</td></tr>
                            <tr><td><a href="${appUrlValue}/app/deals" style="color: #06b6d4; font-size: 12px; font-weight: 600; text-decoration: none;">View deals &rarr;</a></td></tr>
                          </table>
                        </td></tr>
                      </table>
                    </td>
                  </tr>
                </table>

              </td></tr>

              <!-- Footer -->
              <tr><td style="padding: 24px 32px; border-top: 1px solid #1a1a1a;">
                <table width="100%" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td style="color: #404040; font-size: 11px; line-height: 1.5;">
                      Questions? Just reply — a real person reads every email.<br/>
                      &copy; 2026 AIWholesail &middot; <a href="https://aiwholesail.com" style="color: #06b6d4; text-decoration: none;">aiwholesail.com</a>
                    </td>
                    <td align="right" valign="top" style="color: #404040; font-size: 11px;">
                      <a href="https://aiwholesail.com/app/account" style="color: #404040; text-decoration: none;">Manage preferences</a>
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
    if (verifyResult?.error) {
      console.error('[Auth] Resend rejected welcome email:', JSON.stringify(verifyResult.error));
    } else {
      console.log(`[Auth] Welcome email sent to ${normalizedEmail.substring(0, 3)}***`, { id: verifyResult?.data?.id });
    }
  } catch (emailErr) {
    console.error('[Auth] Failed to send welcome email:', emailErr.message);
  }

  await logSecurityEvent('signup_success', { email: normalizedEmail.substring(0, 3) + '***' }, userId, req);

  res.status(201).json({
    user: {
      id: userId,
      email: normalizedEmail,
      fullName: fullName || null,
      emailVerified: true
    },
    accessToken,
    refreshToken,
    expiresIn: process.env.JWT_EXPIRES_IN || '1h'
  });
}));

/**
 * POST /api/auth/signin
 * Sign in an existing user
 */
router.post('/signin', [
  body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
  body('password').notEmpty().withMessage('Password required')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: 'Validation failed', errors: errors.array() });
  }

  const { email, password } = req.body;
  const normalizedEmail = email.toLowerCase().trim();

  // Throttle BEFORE the user lookup so we don't expose a timing oracle (lookup
  // latency varies with row hit/miss). Two complementary windows:
  //  - per-IP   (20 / 15min): protects against a single attacker spraying many emails
  //  - per-email (10 / 15min): protects against credential stuffing across many IPs
  // If either trips we 429 and surface Retry-After so well-behaved clients back off.
  const ip = clientIp(req);
  const ipLimit = await checkDatabaseRateLimit(ip, 'signin-ip', 20, 15);
  const emailLimit = await checkDatabaseRateLimit(normalizedEmail, 'signin-email', 10, 15);
  if (!ipLimit.allowed || !emailLimit.allowed) {
    await logSecurityEvent('signin_rate_limit_exceeded', {
      email: normalizedEmail.substring(0, 3) + '***',
      ip_throttled: !ipLimit.allowed,
      email_throttled: !emailLimit.allowed,
    }, null, req);
    return respondError(res, 429, 'Too many sign-in attempts. Try again in 15 minutes.', {
      code: 'RATE_LIMITED',
      headers: { 'Retry-After': '900' },
    });
  }

  // Find user
  const result = await query(
    'SELECT id, email, password_hash, full_name, email_verified FROM users WHERE email = $1',
    [normalizedEmail]
  );

  if (result.rows.length === 0) {
    await logSecurityEvent('signin_user_not_found', { email: normalizedEmail.substring(0, 3) + '***' }, null, req);
    return respondError(res, 401, 'Invalid email or password', { code: 'INVALID_CREDENTIALS' });
  }

  const user = result.rows[0];

  // Verify password
  const isValidPassword = await bcrypt.compare(password, user.password_hash);
  if (!isValidPassword) {
    await logSecurityEvent('signin_invalid_password', { email: normalizedEmail.substring(0, 3) + '***' }, user.id, req);
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  // Update last sign in
  await query('UPDATE users SET last_sign_in = NOW() WHERE id = $1', [user.id]);

  // Generate tokens
  const accessToken = generateAccessToken(user.id, user.email);
  const refreshToken = generateRefreshToken(user.id);

  // Store refresh token
  const refreshExpiry = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  await query(
    'INSERT INTO sessions (user_id, refresh_token, expires_at) VALUES ($1, $2, $3)',
    [user.id, refreshToken, refreshExpiry]
  );

  await logSecurityEvent('signin_success', { email: normalizedEmail.substring(0, 3) + '***' }, user.id, req);

  res.json({
    user: {
      id: user.id,
      email: user.email,
      fullName: user.full_name,
      emailVerified: user.email_verified
    },
    accessToken,
    refreshToken,
    expiresIn: process.env.JWT_EXPIRES_IN || '1h'
  });
}));

/**
 * POST /api/auth/signout
 * Sign out the current user
 */
router.post('/signout', authenticate, asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;

  // Revoke the specific refresh token if provided
  if (refreshToken) {
    await query(
      'UPDATE sessions SET revoked = true WHERE user_id = $1 AND refresh_token = $2',
      [req.user.id, refreshToken]
    );
  } else {
    // Revoke all sessions for this user
    await query('UPDATE sessions SET revoked = true WHERE user_id = $1', [req.user.id]);
  }

  await logSecurityEvent('signout_success', {}, req.user.id, req);

  res.json({ message: 'Signed out successfully' });
}));

/**
 * POST /api/auth/refresh
 * Refresh access token using refresh token
 */
router.post('/refresh', asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    return res.status(400).json({ error: 'Refresh token required' });
  }

  try {
    const decoded = await verifyRefreshToken(refreshToken);

    // Get user
    const result = await query(
      'SELECT id, email, full_name FROM users WHERE id = $1',
      [decoded.userId]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'User not found' });
    }

    const user = result.rows[0];

    // Generate new access token
    const newAccessToken = generateAccessToken(user.id, user.email);

    // Optionally rotate refresh token
    const newRefreshToken = generateRefreshToken(user.id);

    // Revoke old refresh token and create new one
    await query('UPDATE sessions SET revoked = true WHERE refresh_token = $1', [refreshToken]);

    const refreshExpiry = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    await query(
      'INSERT INTO sessions (user_id, refresh_token, expires_at) VALUES ($1, $2, $3)',
      [user.id, newRefreshToken, refreshExpiry]
    );

    res.json({
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
      expiresIn: process.env.JWT_EXPIRES_IN || '7d'
    });
  } catch (error) {
    await logSecurityEvent('refresh_token_invalid', { error: error.message }, null, req);
    return res.status(401).json({ error: 'Invalid or expired refresh token' });
  }
}));

/**
 * GET /api/auth/me
 * Get current user information
 */
router.get('/me', authenticate, asyncHandler(async (req, res) => {
  const result = await query(
    `SELECT u.id, u.email, u.full_name, u.email_verified, u.created_at,
            s.subscribed, s.subscription_tier, s.subscription_end, s.is_trial, s.trial_end
     FROM users u
     LEFT JOIN subscribers s ON u.id = s.user_id
     WHERE u.id = $1`,
    [req.user.id]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'User not found' });
  }

  const user = result.rows[0];

  // Compute effective tier for the LLM budget block. Mirrors the logic in
  // middleware/subscription.js attachSubscription so /me and the runtime
  // gate agree on what bucket the user is in.
  const trialActive = !!(user.is_trial && user.trial_end && new Date(user.trial_end) > new Date());
  let effectiveTier = 'none';
  if (user.subscribed) effectiveTier = trialActive ? 'trial' : (user.subscription_tier || 'Pro');

  const { getMonthlyUsageCents } = require('../lib/llm-usage');
  const { capCentsForTier } = require('../lib/llm-cost');
  const capCents = capCentsForTier(effectiveTier);
  const usedCents = capCents > 0 ? await getMonthlyUsageCents(req.user.id) : 0;
  const now = new Date();
  const resetsAt = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)).toISOString();

  res.json({
    id: user.id,
    email: user.email,
    fullName: user.full_name,
    emailVerified: user.email_verified,
    createdAt: user.created_at,
    subscription: {
      subscribed: user.subscribed || false,
      tier: user.subscription_tier,
      endDate: user.subscription_end,
      isTrial: user.is_trial || false,
      trialEnd: user.trial_end,
      // Monthly LLM cost cap + month-to-date usage. Trial users get a smaller
      // budget than full Pro even though tier gating treats trial as Pro-like;
      // see lib/llm-cost.js for the math.
      llm_budget: {
        effective_tier: effectiveTier,
        used_cents: usedCents,
        cap_cents: capCents,
        remaining_cents: Math.max(0, capCents - usedCents),
        resets_at: resetsAt,
      },
    }
  });
}));

/**
 * POST /api/auth/forgot-password
 * Request password reset email
 */
router.post('/forgot-password', [
  body('email').isEmail().normalizeEmail()
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    await logSecurityEvent('password_reset_validation_failed', { errors: errors.array() }, null, req);
    return res.status(400).json({ error: 'Validation failed', errors: errors.array() });
  }

  const { email } = req.body;
  const normalizedEmail = email.toLowerCase().trim();

  // Find user
  const result = await query('SELECT id FROM users WHERE email = $1', [normalizedEmail]);

  // Always return success to prevent email enumeration
  if (result.rows.length === 0) {
    await logSecurityEvent('password_reset_user_not_found', { email: normalizedEmail.substring(0, 3) + '***' }, null, req);
    return res.json({ message: 'If an account exists, a password reset email has been sent' });
  }

  const user = result.rows[0];
  const resetToken = uuidv4();
  const resetExpiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

  await query(
    'UPDATE users SET password_reset_token = $1, password_reset_expires = $2 WHERE id = $3',
    [resetToken, resetExpiry, user.id]
  );

  // Send password reset email via Resend
  const resetUrl = `${frontendUrl()}/auth?mode=reset&token=${resetToken}`;
  try {
    const resetResult = await resend.emails.send({
      from: 'AIWholesail <noreply@aiwholesail.com>',
      to: normalizedEmail,
      subject: 'Reset Your Password — AIWholesail',
      html: `
        <style>@import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700;800&display=swap');</style>
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #000000; font-family: 'Montserrat', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
          <tr><td align="center" style="padding: 40px 20px;">
            <!--[if mso]><table width="600" cellpadding="0" cellspacing="0" border="0"><tr><td><![endif]-->
            <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width: 600px; width: 100%; background-color: #0a0a0b; border-radius: 12px; overflow: hidden; border: 1px solid #1a1a1a;">

              <!-- Logo header -->
              <tr><td style="padding: 28px 32px 20px; border-bottom: 1px solid #1a1a1a;">
                <img src="https://aiwholesail.com/logo-white.png" alt="AIWholesail" height="32" style="height: 32px; width: auto; display: block;" />
              </td></tr>

              <!-- Content -->
              <tr><td style="padding: 40px 32px 36px;">

                <!-- Lock icon -->
                <table cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 24px;">
                  <tr>
                    <td style="width: 48px; height: 48px; background-color: #171717; border: 1px solid #262626; border-radius: 12px; text-align: center; vertical-align: middle; font-size: 22px;">&#128274;</td>
                  </tr>
                </table>

                <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 12px;">
                  <tr><td style="color: #ffffff; font-size: 26px; font-weight: 700; letter-spacing: -0.5px; line-height: 1.2;">
                    Reset Your Password
                  </td></tr>
                </table>

                <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 32px;">
                  <tr><td style="color: #a3a3a3; font-size: 16px; line-height: 1.7;">
                    We received a request to reset the password for your AIWholesail account. Click below to choose a new one.
                  </td></tr>
                </table>

                <!-- CTA Button -->
                <table cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 32px;">
                  <tr><td style="background-color: #06b6d4; border-radius: 8px; padding: 16px 36px; box-shadow: 0 2px 8px rgba(6,182,212,0.25);">
                    <a href="${resetUrl}" style="color: #000000; font-weight: 600; font-size: 16px; text-decoration: none; display: inline-block;">Reset Password</a>
                  </td></tr>
                </table>

                <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 28px;">
                  <tr><td style="color: #525252; font-size: 13px; line-height: 1.5;">
                    This link expires in 1 hour. If the button doesn't work, copy and paste this URL:
                  </td></tr>
                  <tr><td style="padding-top: 8px;">
                    <a href="${resetUrl}" style="color: #06b6d4; font-size: 12px; text-decoration: none; word-break: break-all;">${resetUrl}</a>
                  </td></tr>
                </table>

                <!-- Security notice -->
                <table width="100%" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td style="background-color: #171717; border: 1px solid #1a1a1a; border-radius: 8px; padding: 16px 20px;">
                      <table cellpadding="0" cellspacing="0" border="0">
                        <tr>
                          <td valign="top" style="padding-right: 12px; font-size: 16px;">&#128737;</td>
                          <td style="color: #737373; font-size: 13px; line-height: 1.6;">
                            <strong style="color: #a3a3a3;">Didn't request this?</strong> Your account is still secure. You can safely ignore this email &mdash; no changes have been made to your account.
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                </table>

              </td></tr>

              <!-- Footer -->
              <tr><td style="padding: 20px 32px 24px; border-top: 1px solid #1a1a1a;">
                <table width="100%" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td style="color: #404040; font-size: 11px; line-height: 1.5;">
                      &copy; 2026 AIWholesail &middot; <a href="https://aiwholesail.com" style="color: #06b6d4; text-decoration: none;">aiwholesail.com</a>
                    </td>
                    <td align="right" style="color: #404040; font-size: 11px;">
                      <a href="https://aiwholesail.com/app/account" style="color: #404040; text-decoration: none;">Manage preferences</a>
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
    if (resetResult?.error) {
      console.error('[Auth] Resend rejected password reset email:', JSON.stringify(resetResult.error));
    } else {
      console.log(`[Auth] Password reset email sent to ${normalizedEmail.substring(0, 3)}***`, { id: resetResult?.data?.id });
    }
  } catch (emailErr) {
    console.error('[Auth] Failed to send password reset email:', emailErr.message);
    // Don't fail the request — token is saved, user can retry
  }

  await logSecurityEvent('password_reset_requested', { email: normalizedEmail.substring(0, 3) + '***' }, user.id, req);

  res.json({ message: 'If an account exists, a password reset email has been sent' });
}));

/**
 * POST /api/auth/reset-password
 * Reset password using token
 */
router.post('/reset-password', [
  body('token').notEmpty(),
  body('password').isLength({ min: 8 })
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    await logSecurityEvent('password_reset_confirm_validation_failed', { errors: errors.array() }, null, req);
    return res.status(400).json({ error: 'Validation failed', errors: errors.array() });
  }

  const { token, password } = req.body;

  // Validate password strength
  if (!PASSWORD_REGEX.test(password)) {
    return res.status(400).json({
      error: 'Password must contain at least 8 characters, including uppercase, lowercase, number, and special character'
    });
  }

  // Find user with valid reset token
  const result = await query(
    'SELECT id FROM users WHERE password_reset_token = $1 AND password_reset_expires > NOW()',
    [token]
  );

  if (result.rows.length === 0) {
    await logSecurityEvent('password_reset_invalid_token', { token: token.substring(0, 8) + '***' }, null, req);
    return res.status(400).json({ error: 'Invalid or expired reset token' });
  }

  const user = result.rows[0];

  // Hash new password
  const passwordHash = await bcrypt.hash(password, 12);

  // Update password and clear reset token
  await query(
    'UPDATE users SET password_hash = $1, password_reset_token = NULL, password_reset_expires = NULL WHERE id = $2',
    [passwordHash, user.id]
  );

  // Revoke all existing sessions
  await query('UPDATE sessions SET revoked = true WHERE user_id = $1', [user.id]);

  await logSecurityEvent('password_reset_success', {}, user.id, req);

  res.json({ message: 'Password reset successfully' });
}));

/**
 * GET /api/auth/verify-email/:token
 * Verify user's email address using the token sent via email
 */
router.get('/verify-email/:token', asyncHandler(async (req, res) => {
  const { token } = req.params;

  if (!token) {
    return res.status(400).json({ error: 'Verification token is required' });
  }

  // Find user with this verification token
  const result = await query(
    'SELECT id, email FROM users WHERE email_verification_token = $1',
    [token]
  );

  if (result.rows.length === 0) {
    await logSecurityEvent('email_verify_invalid_token', { token: token.substring(0, 8) + '***' }, null, req);
    // Redirect to auth page with error
    return res.redirect(`${frontendUrl()}/auth?verified=false&error=invalid_token`);
  }

  const user = result.rows[0];

  // Mark email as verified and clear the token
  await query(
    'UPDATE users SET email_verified = true, email_verification_token = NULL, updated_at = NOW() WHERE id = $1',
    [user.id]
  );

  await logSecurityEvent('email_verified', { email: user.email.substring(0, 3) + '***' }, user.id, req);

  // Redirect to frontend auth page with verified=true
  res.redirect(`${frontendUrl()}/auth?verified=true`);
}));

/**
 * PATCH /api/auth/profile
 * Update current user profile (name)
 */
router.patch('/profile', authenticate, [
  body('fullName').trim().isLength({ min: 1, max: 255 }).withMessage('Name is required (max 255 characters)')
    .custom(value => {
      if (/<[^>]*>/g.test(value)) {
        throw new Error('Name contains invalid characters');
      }
      return true;
    })
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: 'Validation failed', errors: errors.array() });
  }

  const { fullName } = req.body;

  await query(
    'UPDATE users SET full_name = $1, updated_at = NOW() WHERE id = $2',
    [fullName, req.user.id]
  );

  await logSecurityEvent('profile_updated', { field: 'fullName' }, req.user.id, req);

  res.json({
    message: 'Profile updated',
    user: {
      id: req.user.id,
      email: req.user.email,
      fullName
    }
  });
}));

/**
 * DELETE /api/auth/account
 * GDPR-compliant account deletion — permanently removes all user data
 */
router.delete('/account', authenticate, asyncHandler(async (req, res) => {
  const { confirmEmail } = req.body;
  const userId = req.user.id;

  if (!confirmEmail) {
    return res.status(400).json({ error: 'confirmEmail is required to confirm account deletion' });
  }

  // Fetch the user's email to verify confirmation
  const userResult = await query('SELECT email FROM users WHERE id = $1', [userId]);
  if (userResult.rows.length === 0) {
    return res.status(404).json({ error: 'User not found' });
  }

  const userEmail = userResult.rows[0].email;
  if (confirmEmail.toLowerCase().trim() !== userEmail.toLowerCase()) {
    await logSecurityEvent('account_delete_email_mismatch', {
      email: userEmail.substring(0, 3) + '***'
    }, userId, req);
    return res.status(400).json({ error: 'Email confirmation does not match account email' });
  }

  // Rate limit: 1 per day per user (1440 minutes = 24 hours)
  const rateLimit = await checkDatabaseRateLimit(userId, 'account-delete', 1, 1440);
  if (!rateLimit.allowed) {
    return res.status(429).json({ error: 'Account deletion can only be requested once per day. Please try again later.' });
  }

  // Log security event BEFORE deletion (so we have an audit trail)
  await logSecurityEvent('account_delete_initiated', {
    email: userEmail.substring(0, 3) + '***',
    userId
  }, userId, req);

  // Use a transaction to ensure all-or-nothing deletion
  const client = await getClient();
  try {
    await client.query('BEGIN');

    // 1. Delete sequence_executions for user's lead_sequences
    await client.query(
      `DELETE FROM sequence_executions
       WHERE lead_sequence_id IN (
         SELECT id FROM lead_sequences WHERE user_id = $1
       )`,
      [userId]
    );

    // 2. Delete lead_sequences
    await client.query('DELETE FROM lead_sequences WHERE user_id = $1', [userId]);

    // 3. Delete lead_contacts for user's leads
    await client.query(
      `DELETE FROM lead_contacts
       WHERE lead_id IN (
         SELECT id FROM leads WHERE user_id = $1
       )`,
      [userId]
    );

    // 4. Delete lead_scoring for user's leads
    await client.query(
      `DELETE FROM lead_scoring
       WHERE lead_id IN (
         SELECT id FROM leads WHERE user_id = $1
       )`,
      [userId]
    );

    // 5. Delete alert_sent_deals for user's alerts
    await client.query(
      `DELETE FROM alert_sent_deals
       WHERE alert_id IN (
         SELECT id FROM property_alerts WHERE user_id = $1
       )`,
      [userId]
    );

    // 6. Delete property_alert_matches for user's alerts
    await client.query(
      `DELETE FROM property_alert_matches
       WHERE alert_id IN (
         SELECT id FROM property_alerts WHERE user_id = $1
       )`,
      [userId]
    );

    // 7. Delete direct user-owned tables
    await client.query('DELETE FROM sessions WHERE user_id = $1', [userId]);
    await client.query('DELETE FROM favorites WHERE user_id = $1', [userId]);
    await client.query('DELETE FROM leads WHERE user_id = $1', [userId]);
    await client.query('DELETE FROM property_alerts WHERE user_id = $1', [userId]);
    await client.query('DELETE FROM subscribers WHERE user_id = $1', [userId]);
    await client.query('DELETE FROM profiles WHERE user_id = $1', [userId]);

    // 8. Delete the user record last (foreign key constraints)
    await client.query('DELETE FROM users WHERE id = $1', [userId]);

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[Auth] Account deletion transaction failed:', err.message);
    throw new AppError('Account deletion failed. Please try again or contact support.', 500);
  } finally {
    client.release();
  }

  await logSecurityEvent('account_delete_completed', {
    email: userEmail.substring(0, 3) + '***',
    deletedUserId: userId
  }, null, req);

  res.json({ message: 'Account deleted successfully' });
}));

/**
 * GET /api/auth/trial-upgrade?token=<jwt>
 *
 * One-click magic-link upgrade from a trial-lifecycle email. The worker signs a
 * short-lived JWT containing { userId, plan, type: 'trial-upgrade' } and embeds
 * the URL in the day -1 / day 0 / day +1 / day +7 emails. When the user clicks,
 * we verify the token, look them up, create a Stripe checkout session pre-filled
 * with their email, and 302 redirect them straight to Stripe — no login needed.
 *
 * Token is scoped (type === 'trial-upgrade') so it can't be replayed for normal
 * auth. Expires in 24h.
 */
router.get('/trial-upgrade', asyncHandler(async (req, res) => {
  const { token } = req.query;
  if (!token || typeof token !== 'string') {
    return res.status(400).send('Missing token');
  }

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    return res.status(401).send('Token invalid or expired. Please request a fresh upgrade link from your most recent AIWholesail email, or sign in directly at https://aiwholesail.com/auth.');
  }

  if (decoded.type !== 'trial-upgrade') {
    return res.status(401).send('Token scope invalid');
  }

  const userResult = await query(
    'SELECT id, email FROM users WHERE id = $1 LIMIT 1',
    [decoded.userId]
  );
  if (userResult.rows.length === 0) {
    return res.status(404).send('User not found');
  }
  const user = userResult.rows[0];
  const plan = decoded.plan === 'Elite' ? 'Elite' : 'Pro';
  const targetAmount = plan === 'Elite' ? 9900 : 4900;

  // Look up the active Stripe Price for the chosen plan by amount (matches the
  // pattern used in routes/stripe.js POST /checkout — price ID isn't hardcoded
  // so price changes don't require a code deploy).
  const prices = await stripe.prices.list({
    active: true,
    type: 'recurring',
    expand: ['data.product'],
  });
  const targetPrice = prices.data.find(
    (p) => p.unit_amount === targetAmount && p.recurring?.interval === 'month'
  );
  if (!targetPrice) {
    console.error(`[trial-upgrade] No active $${targetAmount/100}/mo price found for plan=${plan}`);
    return res.status(500).send('Plan unavailable. Please contact support.');
  }

  // Reuse existing Stripe customer if we already have one
  let customerId;
  const existingCustomers = await stripe.customers.list({ email: user.email, limit: 1 });
  if (existingCustomers.data.length > 0) {
    customerId = existingCustomers.data[0].id;
  }

  const frontendUrlValue = frontendUrl();
  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    customer_email: customerId ? undefined : user.email,
    line_items: [{ price: targetPrice.id, quantity: 1 }],
    mode: 'subscription',
    payment_method_collection: 'always',
    subscription_data: {
      trial_period_days: 0,    // already had a trial; no double-trial
      trial_settings: {
        end_behavior: { missing_payment_method: 'cancel' },
      },
    },
    success_url: `${frontendUrlValue}/success?session_id={CHECKOUT_SESSION_ID}&from=trial-upgrade`,
    cancel_url: `${frontendUrlValue}/pricing`,
    metadata: {
      company_name: 'AI Wholesail',
      user_id: user.id,
      flow: 'trial-upgrade-magic-link',
    },
  });

  await logSecurityEvent('trial_upgrade_link_used', {
    userId: user.id,
    plan,
    sessionId: session.id,
  }, user.id, req);

  return res.redirect(302, session.url);
}));

module.exports = router;
