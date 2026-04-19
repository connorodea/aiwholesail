const express = require('express');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { body, validationResult } = require('express-validator');
const { query } = require('../config/database');
const { authenticate, generateAccessToken, generateRefreshToken, verifyRefreshToken } = require('../middleware/auth');
const { asyncHandler, AppError, logSecurityEvent } = require('../middleware/errorHandler');

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

  // TODO: Send password reset email via SendGrid
  // For now, just log the token (in production, send email)
  console.log(`[Auth] Password reset token for ${normalizedEmail}: ${resetToken}`);

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

module.exports = router;
