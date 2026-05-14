#!/usr/bin/env node
/**
 * Sequence Execution Worker
 *
 * Processes the `sequence_executions` queue for the aiwholesail follow-up
 * sequences system (migration 003_sequences.sql). Picks up pending executions
 * whose scheduled_date has arrived and whose parent lead_sequence is still
 * active, then dispatches them via the appropriate channel.
 *
 * Channels:
 *   email → Resend SDK (this worker)
 *   sms   → not yet implemented here; Twilio path lives in routes/communications.js
 *           and will be folded into the worker in Phase 2.
 *
 * Suppression / send-logging hooks the email_suppressions and email_send_log
 * tables from migration 008. Because that migration may not have been applied
 * yet (peer agent is concurrently authoring it), the worker probes for both
 * tables at startup and gracefully skips the suppression check / send-log
 * insert when they don't exist.
 *
 * Usage:
 *   node scripts/sequence-execution-worker.js           # process queue once
 *   node scripts/sequence-execution-worker.js --dry-run # preview without sending
 */

require('dotenv').config();
const { Pool } = require('pg');
const { Resend } = require('resend');
const { getSender } = require('../lib/senders');

const WORKER_VERSION = '0.1.0';
const BATCH_LIMIT = 500;
const SEND_THROTTLE_MS = 250;

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const resend = new Resend(process.env.RESEND_API_KEY);
const DRY_RUN = process.argv.includes('--dry-run');

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Substitute {key} tokens. Unmatched placeholders are left as-is so we can spot
// them in send logs rather than silently sending empty strings.
function renderTemplate(template, vars) {
  if (!template) return '';
  return String(template).replace(/\{([a-zA-Z0-9_]+)\}/g, (match, key) => {
    const v = vars[key];
    return v === undefined || v === null ? match : String(v);
  });
}

function buildVariables(row) {
  // Three sources, increasing precedence:
  //   1. auto-derived from the recipient row (lead_first_name, etc.)
  //   2. lead_sequences.variables — set when the sequence was assigned
  //      (legacy single-lead UI path)
  //   3. campaign_targets.target_variables — set by the campaign builder
  //      when fanning out to a buyers/agents/CSV audience. This is the
  //      most specific source and wins when both are present.
  const sequenceVars = row.sequence_variables && typeof row.sequence_variables === 'object' ? row.sequence_variables : {};
  const campaignVars = row.campaign_variables && typeof row.campaign_variables === 'object' ? row.campaign_variables : {};
  const firstName = row.lead_first_name || '';
  const lastName = row.lead_last_name || '';
  const fullName = [firstName, lastName].filter(Boolean).join(' ').trim();
  const auto = {
    seller_name: fullName || firstName || 'there',
    first_name: firstName || 'there',
    lead_name: fullName || firstName || '',
    property_address: row.property_address || '',
    your_name: sequenceVars.your_name || campaignVars.your_name || '',
  };
  return { ...auto, ...sequenceVars, ...campaignVars };
}

async function tableExists(tableName) {
  const r = await pool.query(`SELECT to_regclass($1) AS reg`, [tableName]);
  return r.rows[0].reg !== null;
}

async function fetchPending() {
  // Campaigns target buyers/agents/CSV rows that do NOT have a leads row,
  // so lead_sequences.lead_id is nullable since migration 024. Use LEFT
  // JOINs and COALESCE the recipient fields out of (in order): the leads
  // table (legacy single-lead assignment), the campaign_targets row that
  // dispatched this lead_sequence (bulk-campaign launch), or — fallback —
  // the lead_sequences.variables JSONB. The COALESCE order means a real
  // leads row wins if present, otherwise the campaign target, otherwise
  // whatever the campaign UI stored as merge vars.
  const { rows } = await pool.query(`
    SELECT
      e.id AS execution_id,
      e.lead_sequence_id,
      e.step_order,
      e.channel,
      e.scheduled_date,
      s.subject AS step_subject,
      s.message_template,
      ls.user_id,
      ls.variables AS sequence_variables,
      ls.status AS sequence_status,
      l.id AS lead_id,
      COALESCE(l.email,      ct.target_email,                       ls.variables->>'email')      AS lead_email,
      COALESCE(l.phone,      ct.target_phone,                       ls.variables->>'phone')      AS lead_phone,
      COALESCE(l.first_name,
               split_part(ct.target_name, ' ', 1),
               ls.variables->>'first_name')                                                       AS lead_first_name,
      COALESCE(l.last_name,
               NULLIF(substring(ct.target_name from position(' ' in ct.target_name) + 1), ''),
               ls.variables->>'last_name')                                                        AS lead_last_name,
      ct.target_variables                                                                          AS campaign_variables
    FROM sequence_executions e
    JOIN lead_sequences ls ON ls.id = e.lead_sequence_id
    JOIN sequence_steps s
      ON s.sequence_template_id = ls.sequence_template_id
     AND s.step_order = e.step_order
    LEFT JOIN leads l           ON l.id = ls.lead_id
    LEFT JOIN campaign_targets ct ON ct.lead_sequence_id = ls.id
    WHERE e.status = 'pending'
      AND e.scheduled_date <= NOW()
      AND ls.status = 'active'
    ORDER BY e.scheduled_date ASC
    LIMIT $1
  `, [BATCH_LIMIT]);
  return rows;
}

async function markExecution(executionId, status, errorMessage = null, sentAt = false) {
  if (DRY_RUN) return;
  if (sentAt) {
    await pool.query(
      `UPDATE sequence_executions
         SET status = $2, error_message = $3, sent_at = NOW()
       WHERE id = $1`,
      [executionId, status, errorMessage]
    );
  } else {
    await pool.query(
      `UPDATE sequence_executions
         SET status = $2, error_message = $3
       WHERE id = $1`,
      [executionId, status, errorMessage]
    );
  }
}

async function insertSendLog({ userId, leadId, executionId, providerMessageId, fromAddress, toAddress, subject }) {
  if (DRY_RUN) return;
  try {
    await pool.query(
      `INSERT INTO email_send_log
         (user_id, sequence_execution_id, lead_id, provider, provider_message_id,
          from_address, to_address, subject, sender_category)
       VALUES ($1, $2, $3, 'resend', $4, $5, $6, $7, 'outreach')
       ON CONFLICT (provider_message_id) DO NOTHING`,
      [userId, executionId, leadId, providerMessageId, fromAddress, toAddress, subject]
    );
  } catch (err) {
    // Don't let a logging failure surface as a send failure — the email
    // actually went out. Log it loudly so we notice.
    console.error(`  WARN: email_send_log insert failed for exec ${executionId}: ${err.message}`);
  }
}

async function isSuppressed(userId, email) {
  const { rows } = await pool.query(
    `SELECT 1 FROM email_suppressions WHERE user_id = $1 AND email = lower($2) LIMIT 1`,
    [userId, email]
  );
  return rows.length > 0;
}

async function processEmail(row, stats, flags) {
  const { execution_id, user_id, lead_id, lead_email, step_subject, message_template } = row;

  if (!lead_email || !String(lead_email).trim()) {
    await markExecution(execution_id, 'skipped', 'no_email');
    stats.skipped += 1;
    console.log(`  [skip] exec ${execution_id} — no_email`);
    return;
  }

  if (flags.hasSuppressions) {
    const suppressed = await isSuppressed(user_id, lead_email);
    if (suppressed) {
      await markExecution(execution_id, 'skipped', 'suppressed');
      stats.skipped += 1;
      console.log(`  [skip] exec ${execution_id} — suppressed (${lead_email})`);
      return;
    }
  }

  const vars = buildVariables(row);
  const subject = renderTemplate(step_subject || '(no subject)', vars);
  const body = renderTemplate(message_template, vars);
  const from = getSender('outreach');

  if (DRY_RUN) {
    console.log(`  [DRY] exec ${execution_id} → ${lead_email} : ${subject}`);
    stats.sent += 1;
    return;
  }

  try {
    const send = await resend.emails.send({
      from,
      to: lead_email,
      subject,
      text: body,
    });

    if (send?.error) {
      const msg = `resend_error: ${typeof send.error === 'string' ? send.error : JSON.stringify(send.error)}`;
      await markExecution(execution_id, 'failed', msg);
      stats.failed += 1;
      console.error(`  ERROR exec ${execution_id} → ${lead_email}: ${msg}`);
      return;
    }

    const providerMessageId = send?.data?.id || null;
    await markExecution(execution_id, 'sent', null, /* sentAt */ true);

    if (flags.hasSendLog && providerMessageId) {
      await insertSendLog({
        userId: user_id,
        leadId: lead_id,
        executionId: execution_id,
        providerMessageId,
        fromAddress: from,
        toAddress: lead_email,
        subject,
      });
    }

    stats.sent += 1;
    console.log(`  ✓ sent exec ${execution_id} → ${lead_email} (id ${providerMessageId || '?'})`);
  } catch (err) {
    const msg = err && err.message ? err.message : String(err);
    await markExecution(execution_id, 'failed', msg);
    stats.failed += 1;
    console.error(`  ERROR exec ${execution_id} → ${lead_email}: ${msg}`);
  }
}

async function processSms(row, stats) {
  await markExecution(row.execution_id, 'skipped', 'sms_not_yet_implemented_in_worker');
  stats.skipped += 1;
  console.log(`  [skip] exec ${row.execution_id} — sms_not_yet_implemented_in_worker`);
}

async function run() {
  console.log(`=== Sequence Execution Worker v${WORKER_VERSION} started at ${new Date().toISOString()} ===`);
  console.log(`Mode: ${DRY_RUN ? 'dry-run (no sends, no DB writes)' : 'live'}`);

  const stats = { scanned: 0, sent: 0, skipped: 0, failed: 0 };

  let flags;
  let rows;
  try {
    // Probe optional migration-008 tables so we can degrade gracefully when
    // they don't exist yet.
    flags = {
      hasSuppressions: await tableExists('email_suppressions'),
      hasSendLog: await tableExists('email_send_log'),
    };
    console.log(`Optional tables: email_suppressions=${flags.hasSuppressions} email_send_log=${flags.hasSendLog}`);

    rows = await fetchPending();
  } catch (err) {
    console.error('FATAL: DB error during startup/fetch:', err);
    try { await pool.end(); } catch (_) {}
    process.exit(1);
  }

  stats.scanned = rows.length;
  console.log(`Pending executions due now: ${rows.length}`);

  for (const row of rows) {
    try {
      if (row.channel === 'email') {
        await processEmail(row, stats, flags);
      } else if (row.channel === 'sms') {
        await processSms(row, stats);
      } else {
        await markExecution(row.execution_id, 'skipped', `unsupported_channel:${row.channel}`);
        stats.skipped += 1;
        console.log(`  [skip] exec ${row.execution_id} — unsupported channel "${row.channel}"`);
      }
    } catch (err) {
      // Per-row catch so one bad row doesn't kill the batch. The DB write
      // inside processEmail/processSms already records the failure; this
      // catches anything outside that path (e.g. an error thrown by the
      // markExecution itself, which we still want to count).
      stats.failed += 1;
      console.error(`  ERROR exec ${row.execution_id}: ${err.message}`);
    }

    if (!DRY_RUN) {
      await sleep(SEND_THROTTLE_MS);
    }
  }

  console.log(`\n=== Worker complete ===`);
  console.log(`Scanned: ${stats.scanned} | Sent: ${stats.sent} | Skipped: ${stats.skipped} | Failed: ${stats.failed}`);

  await pool.end();
}

run().catch(async err => {
  console.error('Worker crashed:', err);
  try { await pool.end(); } catch (_) {}
  process.exit(1);
});
