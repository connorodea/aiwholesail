#!/usr/bin/env node
/**
 * Trial Lifecycle Worker
 *
 * Runs hourly via systemd timer. Finds users at specific trial-day
 * milestones and sends them the right email at the right moment:
 *   day -1  →  "your trial ends tomorrow"
 *   day  0  →  "your trial just ended"
 *   day +1  →  "1 day past, restore now"
 *   day +7  →  "last call"
 *
 * Each (user_id, email_type) pair is sent at most once via the
 * trial_lifecycle_emails_sent UNIQUE constraint.
 *
 * The CTA in each email is a JWT-signed magic link to
 *   GET /api/auth/trial-upgrade?token=<jwt>
 * which redirects to a Stripe checkout pre-filled for that user.
 *
 * Usage:
 *   node scripts/trial-lifecycle-worker.js           # Run once
 *   node scripts/trial-lifecycle-worker.js --dry-run # Preview without sending
 */

require('dotenv').config();
const { Pool } = require('pg');
const jwt = require('jsonwebtoken');
const { Resend } = require('resend');

const {
  renderDayMinus1,
  renderDayZero,
  renderDayPlus1,
  renderDayPlus7,
} = require('./lib/lifecycle-emails');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const resend = new Resend(process.env.RESEND_API_KEY);
const DRY_RUN = process.argv.includes('--dry-run');
const FROM = 'AIWholesail <noreply@aiwholesail.com>';
const API_URL = process.env.API_URL || 'https://api.aiwholesail.com';
const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  console.error('FATAL: JWT_SECRET not set');
  process.exit(1);
}

// SQL window queries — each returns users matching exactly one milestone.
// Using LEFT JOIN to dedup table so we never re-send.
const MILESTONES = [
  {
    type: 'day_minus_1',
    description: 'Trial ends in ~24 hours',
    sql: `
      SELECT u.id AS user_id, u.email, u.full_name, s.trial_end
      FROM users u
      JOIN subscribers s ON s.user_id = u.id
      LEFT JOIN trial_lifecycle_emails_sent e
        ON e.user_id = u.id AND e.email_type = 'day_minus_1'
      WHERE s.is_trial = true
        AND s.trial_end BETWEEN NOW() + INTERVAL '23 hours' AND NOW() + INTERVAL '25 hours'
        AND e.id IS NULL
    `,
    render: renderDayMinus1,
  },
  {
    type: 'day_zero',
    description: 'Trial just ended (within last hour)',
    sql: `
      SELECT u.id AS user_id, u.email, u.full_name, s.trial_end
      FROM users u
      JOIN subscribers s ON s.user_id = u.id
      LEFT JOIN trial_lifecycle_emails_sent e
        ON e.user_id = u.id AND e.email_type = 'day_zero'
      WHERE s.trial_end BETWEEN NOW() - INTERVAL '1 hour' AND NOW() + INTERVAL '5 minutes'
        AND e.id IS NULL
    `,
    render: renderDayZero,
  },
  {
    type: 'day_plus_1',
    description: '1 day after trial ended',
    sql: `
      SELECT u.id AS user_id, u.email, u.full_name, s.trial_end
      FROM users u
      JOIN subscribers s ON s.user_id = u.id
      LEFT JOIN trial_lifecycle_emails_sent e
        ON e.user_id = u.id AND e.email_type = 'day_plus_1'
      WHERE s.trial_end BETWEEN NOW() - INTERVAL '25 hours' AND NOW() - INTERVAL '23 hours'
        AND e.id IS NULL
        AND s.subscribed = false
    `,
    render: renderDayPlus1,
  },
  {
    type: 'day_plus_7',
    description: '7 days after trial ended',
    sql: `
      SELECT u.id AS user_id, u.email, u.full_name, s.trial_end
      FROM users u
      JOIN subscribers s ON s.user_id = u.id
      LEFT JOIN trial_lifecycle_emails_sent e
        ON e.user_id = u.id AND e.email_type = 'day_plus_7'
      WHERE s.trial_end BETWEEN NOW() - INTERVAL '7 days 1 hour' AND NOW() - INTERVAL '6 days 23 hours'
        AND e.id IS NULL
        AND s.subscribed = false
    `,
    render: renderDayPlus7,
  },
];

function generateUpgradeUrl(userId, plan = 'Pro') {
  const token = jwt.sign(
    { userId, plan, type: 'trial-upgrade' },
    JWT_SECRET,
    { expiresIn: '24h' }
  );
  const utm = `utm_source=email&utm_medium=lifecycle&utm_campaign=trial`;
  return `${API_URL}/api/auth/trial-upgrade?token=${token}&${utm}`;
}

async function startJobRun() {
  if (DRY_RUN) return null;
  const r = await pool.query(
    `INSERT INTO trial_lifecycle_job_runs (status, started_at)
     VALUES ('running', NOW()) RETURNING id`
  );
  return r.rows[0].id;
}

async function finishJobRun(jobId, stats) {
  if (DRY_RUN || !jobId) return;
  const status = stats.errors.length > 0 ? 'completed_with_errors' : 'completed';
  await pool.query(
    `UPDATE trial_lifecycle_job_runs SET
       completed_at = NOW(),
       candidates_evaluated = $2,
       emails_sent = $3,
       errors = $4,
       status = $5
     WHERE id = $1`,
    [jobId, stats.candidatesEvaluated, stats.emailsSent, stats.errors, status]
  );
}

async function processMilestone(milestone, stats) {
  const result = await pool.query(milestone.sql);
  console.log(`[${milestone.type}] ${result.rows.length} candidate(s) — ${milestone.description}`);
  stats.candidatesEvaluated += result.rows.length;

  for (const row of result.rows) {
    try {
      const upgradeUrl = generateUpgradeUrl(row.user_id, 'Pro');
      const { subject, html } = milestone.render(row, upgradeUrl);

      if (DRY_RUN) {
        console.log(`  [DRY] would send to ${row.email} : ${subject}`);
        continue;
      }

      const send = await resend.emails.send({
        from: FROM,
        to: row.email,
        subject,
        html,
      });

      if (send?.error) {
        const msg = `Resend rejected ${milestone.type} for ${row.email}: ${JSON.stringify(send.error)}`;
        console.error(`  ERROR: ${msg}`);
        stats.errors.push(msg);
        // Do NOT insert into dedup table — let the worker retry next hour
        continue;
      }

      // Insert dedup row only on success
      await pool.query(
        `INSERT INTO trial_lifecycle_emails_sent (user_id, email_type, resend_id)
         VALUES ($1, $2, $3)
         ON CONFLICT (user_id, email_type) DO NOTHING`,
        [row.user_id, milestone.type, send?.data?.id || null]
      );
      stats.emailsSent += 1;
      console.log(`  ✓ sent ${milestone.type} to ${row.email} (id ${send?.data?.id || '?'})`);
    } catch (err) {
      const msg = `Failed ${milestone.type} for ${row.email}: ${err.message}`;
      console.error(`  ERROR: ${msg}`);
      stats.errors.push(msg);
    }
  }
}

async function run() {
  console.log(`=== Trial Lifecycle Worker started at ${new Date().toISOString()} ===`);
  if (DRY_RUN) console.log('*** DRY RUN MODE — no emails will be sent ***\n');

  const stats = { candidatesEvaluated: 0, emailsSent: 0, errors: [] };
  const jobId = await startJobRun();

  try {
    for (const milestone of MILESTONES) {
      await processMilestone(milestone, stats);
    }
  } catch (err) {
    console.error('FATAL:', err);
    stats.errors.push(`FATAL: ${err.message}`);
  }

  await finishJobRun(jobId, stats);

  console.log(`\n=== Worker complete ===`);
  console.log(`Candidates: ${stats.candidatesEvaluated} | Sent: ${stats.emailsSent} | Errors: ${stats.errors.length}`);

  await pool.end();
}

run().catch(err => {
  console.error('Worker crashed:', err);
  process.exit(1);
});
