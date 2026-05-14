#!/usr/bin/env node
/**
 * Systemd OnFailure Notifier
 *
 * Invoked automatically by `OnFailure=aiwholesail-onfailure-notify.service`
 * directives on other units. systemd sets MONITOR_UNIT to the name of the
 * unit that failed; we read its last 50 journal lines and email the operator.
 *
 * Why this exists: the hourly health-monitor catches sustained problems, but
 * a one-off worker crash (e.g., blog generator API timeout, spread-alert DB
 * lock) needs immediate visibility — not "noticed within an hour". This
 * fires within seconds of the failure.
 *
 * Usage (manual): MONITOR_UNIT=foo.service node scripts/onfailure-notify.js
 */

require('dotenv').config();
const { execSync } = require('child_process');
const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);
const OPERATOR_EMAIL = process.env.OPERATOR_EMAIL || 'cpodea5@gmail.com';

const failedUnit = process.env.MONITOR_UNIT || process.argv[2];
const invocationId = process.env.MONITOR_INVOCATION_ID || '';
const exitCode = process.env.MONITOR_EXIT_CODE || '';

if (!failedUnit) {
  console.error('[OnFailure] No unit name provided (MONITOR_UNIT not set)');
  process.exit(1);
}

// Avoid an alert-loop if THIS handler itself is the one that failed.
if (failedUnit === 'aiwholesail-onfailure-notify.service') {
  console.error('[OnFailure] Self-trigger detected — refusing to alert');
  process.exit(0);
}

let journal = '';
try {
  journal = execSync(
    `journalctl -u "${failedUnit}" -n 50 --no-pager --output=cat 2>&1 || true`,
    { encoding: 'utf8', maxBuffer: 1024 * 1024 }
  );
} catch (e) {
  journal = `(failed to read journal: ${e.message})`;
}

const ts = new Date().toISOString().replace('T', ' ').slice(0, 19) + ' UTC';
const subject = `[CRITICAL] ${failedUnit} failed`;

// Strip ANSI control codes that journal sometimes emits
const cleanJournal = journal
  .replace(/\[[0-9;]*m/g, '')
  .slice(-3000); // last ~3KB of log

const html = `
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#000;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif">
    <tr><td align="center" style="padding:32px 16px">
      <table width="640" cellpadding="0" cellspacing="0" border="0" style="max-width:640px;width:100%;background:#0a0a0b;border-radius:12px;overflow:hidden;border:1px solid #ef444440">
        <tr><td style="padding:24px 28px 18px;border-bottom:1px solid #1a1a1a">
          <img src="https://aiwholesail.com/logo-white.png" alt="AIWholesail" height="28" style="height:28px;display:block">
        </td></tr>
        <tr><td style="height:3px;background:#ef4444;font-size:0;line-height:0">&nbsp;</td></tr>
        <tr><td style="padding:24px 28px 8px">
          <div style="display:inline-block;padding:6px 12px;border-radius:999px;background:rgba(239,68,68,0.1);border:1px solid #ef444440;color:#ef4444;font-size:11px;font-weight:600;letter-spacing:0.1em;text-transform:uppercase">
            Service Failure
          </div>
          <h1 style="color:#fff;font-size:22px;font-weight:700;letter-spacing:-0.3px;margin:14px 0 4px;font-family:monospace">${failedUnit}</h1>
          <p style="color:#a3a3a3;font-size:13px;margin:0">${ts} ${exitCode ? `· exit ${exitCode}` : ''}${invocationId ? ` · ${invocationId.slice(0, 8)}` : ''}</p>
        </td></tr>
        <tr><td style="padding:16px 28px 8px">
          <p style="color:#525252;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.1em;margin:0 0 8px">Last 50 journal lines</p>
          <pre style="background:#000;border:1px solid #1a1a1a;border-radius:6px;padding:14px;color:#d4d4d4;font-size:11px;line-height:1.45;white-space:pre-wrap;word-break:break-word;margin:0;max-height:520px;overflow:auto">${escapeHtml(cleanJournal)}</pre>
        </td></tr>
        <tr><td style="padding:16px 28px 24px;border-top:1px solid #1a1a1a;color:#525252;font-size:11px;line-height:1.6">
          <p style="margin:0 0 4px">Quick triage on hetznerCO:</p>
          <code style="background:#1a1a1a;padding:2px 5px;border-radius:3px;display:block;margin:4px 0">sudo systemctl status ${failedUnit}</code>
          <code style="background:#1a1a1a;padding:2px 5px;border-radius:3px;display:block;margin:4px 0">sudo journalctl -xeu ${failedUnit} -n 200</code>
          <code style="background:#1a1a1a;padding:2px 5px;border-radius:3px;display:block;margin:4px 0">sudo systemctl reset-failed ${failedUnit}</code>
        </td></tr>
      </table>
    </td></tr></table>
`;

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

(async () => {
  try {
    const result = await resend.emails.send({
      from: 'AIWholesail Monitor <noreply@notifications.aiwholesail.com>',
      to: OPERATOR_EMAIL,
      subject,
      html,
    });
    if (result?.error) {
      console.error('[OnFailure] Resend rejected:', JSON.stringify(result.error));
      process.exit(1);
    }
    console.log(`[OnFailure] Email sent for ${failedUnit}: ${result?.data?.id}`);
  } catch (err) {
    console.error('[OnFailure] Send failed:', err.message);
    process.exit(1);
  }
})();
