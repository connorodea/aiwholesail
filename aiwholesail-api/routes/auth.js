const express = require('express');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { body, validationResult } = require('express-validator');
const { query } = require('../config/database');
const { authenticate, generateAccessToken, generateRefreshToken, verifyRefreshToken } = require('../middleware/auth');
const { asyncHandler, AppError, logSecurityEvent } = require('../middleware/errorHandler');
const { checkDatabaseRateLimit } = require('../middleware/rateLimit');
const { getClient } = require('../config/database');

const { Resend } = require('resend');
const resend = new Resend(process.env.RESEND_API_KEY);

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

  const { email, password, fullName } = req.body;
  const normalizedEmail = email.toLowerCase().trim();

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

  // Create user
  const userId = uuidv4();
  const verificationToken = uuidv4();

  await query(
    `INSERT INTO users (id, email, password_hash, full_name, email_verification_token)
     VALUES ($1, $2, $3, $4, $5)`,
    [userId, normalizedEmail, passwordHash, fullName || null, verificationToken]
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

  // Send verification email via Resend
  const verifyUrl = `${process.env.API_URL || 'https://api.aiwholesail.com'}/api/auth/verify-email/${verificationToken}`;
  try {
    await resend.emails.send({
      from: 'AIWholesail <noreply@aiwholesail.com>',
      to: normalizedEmail,
      subject: 'Verify Your Email — AIWholesail',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #08090a; color: #ffffff; padding: 40px 30px; border-radius: 12px;">
          <img src="https://aiwholesail.com/logo-white.png" alt="AIWholesail" style="height: 48px; margin-bottom: 24px;" />
          <h2 style="color: #06b6d4; margin-bottom: 16px;">Verify Your Email</h2>
          <p style="color: #a3a3a3; line-height: 1.6; margin-bottom: 24px;">
            Thanks for signing up for AIWholesail! Please verify your email address by clicking the button below.
          </p>
          <a href="${verifyUrl}" style="display: inline-block; background: #06b6d4; color: #000; font-weight: 600; padding: 12px 32px; border-radius: 6px; text-decoration: none; font-size: 16px;">
            Verify Email
          </a>
          <p style="color: #737373; font-size: 13px; margin-top: 24px; line-height: 1.5;">
            If you didn't create an account, you can safely ignore this email.
          </p>
          <hr style="border: none; border-top: 1px solid #262626; margin: 24px 0;" />
          <p style="color: #525252; font-size: 12px;">AIWholesail — Find profitable real estate deals with AI</p>
        </div>
      `,
    });
    console.log(`[Auth] Verification email sent to ${normalizedEmail.substring(0, 3)}***`);
  } catch (emailErr) {
    console.error('[Auth] Failed to send verification email:', emailErr.message);
    // Don't fail signup — user can request resend later
  }

  await logSecurityEvent('signup_success', { email: normalizedEmail.substring(0, 3) + '***' }, userId, req);

  res.status(201).json({
    user: {
      id: userId,
      email: normalizedEmail,
      fullName: fullName || null,
      emailVerified: false
    },
    accessToken,
    refreshToken,
    expiresIn: process.env.JWT_EXPIRES_IN || '7d'
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

  // Find user
  const result = await query(
    'SELECT id, email, password_hash, full_name, email_verified FROM users WHERE email = $1',
    [normalizedEmail]
  );

  if (result.rows.length === 0) {
    await logSecurityEvent('signin_user_not_found', { email: normalizedEmail.substring(0, 3) + '***' }, null, req);
    return res.status(401).json({ error: 'Invalid email or password' });
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
    expiresIn: process.env.JWT_EXPIRES_IN || '7d'
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
      trialEnd: user.trial_end
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
  const resetUrl = `${process.env.FRONTEND_URL || 'https://aiwholesail.com'}/auth?mode=reset&token=${resetToken}`;
  try {
    await resend.emails.send({
      from: 'AIWholesail <noreply@aiwholesail.com>',
      to: normalizedEmail,
      subject: 'Reset Your Password — AIWholesail',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #08090a; color: #ffffff; padding: 40px 30px; border-radius: 12px;">
          <img src="https://aiwholesail.com/logo-white.png" alt="AIWholesail" style="height: 48px; margin-bottom: 24px;" />
          <h2 style="color: #06b6d4; margin-bottom: 16px;">Reset Your Password</h2>
          <p style="color: #a3a3a3; line-height: 1.6; margin-bottom: 24px;">
            We received a request to reset the password for your AIWholesail account. Click the button below to set a new password.
          </p>
          <a href="${resetUrl}" style="display: inline-block; background: #06b6d4; color: #000; font-weight: 600; padding: 12px 32px; border-radius: 6px; text-decoration: none; font-size: 16px;">
            Reset Password
          </a>
          <p style="color: #737373; font-size: 13px; margin-top: 24px; line-height: 1.5;">
            This link expires in 1 hour. If you didn't request a password reset, you can safely ignore this email.
          </p>
          <hr style="border: none; border-top: 1px solid #262626; margin: 24px 0;" />
          <p style="color: #525252; font-size: 12px;">AIWholesail — Find profitable real estate deals with AI</p>
        </div>
      `,
    });
    console.log(`[Auth] Password reset email sent to ${normalizedEmail.substring(0, 3)}***`);
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
    const frontendUrl = process.env.FRONTEND_URL || 'https://aiwholesail.com';
    return res.redirect(`${frontendUrl}/auth?verified=false&error=invalid_token`);
  }

  const user = result.rows[0];

  // Mark email as verified and clear the token
  await query(
    'UPDATE users SET email_verified = true, email_verification_token = NULL, updated_at = NOW() WHERE id = $1',
    [user.id]
  );

  await logSecurityEvent('email_verified', { email: user.email.substring(0, 3) + '***' }, user.id, req);

  // Redirect to frontend auth page with verified=true
  const frontendUrl = process.env.FRONTEND_URL || 'https://aiwholesail.com';
  res.redirect(`${frontendUrl}/auth?verified=true`);
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

module.exports = router;
