#!/usr/bin/env node
/**
 * Founder Hot List Worker
 *
 * Runs daily via systemd timer (08:00 ET / 13:00 UTC). Identifies trial users
 * who have shown high activation signals in the past 24h but haven't upgraded
 * yet, and emails Connor a curated outreach list.
 *
 * Why this exists: at ~15 paid users, the founder texting 3-5 hot trials
 * personally from 248-881-4147 is the highest-ROI sales motion. A daily
 * curated list beats automated lifecycle emails for these high-signal users.
 *
 * Activation scoring (out of 6):
 *   +2  ran 5+ property searches today
 *   +2  ran any skip-trace lookup ever (paid feature → highest intent)
 *   +1  saved any property to favorites
 *   +1  created any property_alert
 *   +1  generated any contract
 *
 * Hot list inclusion criteria:
 *   - is_trial = true (active trial, not yet upgraded)
 *   - users.created_at between 24h and 7d ago (past welcome email window,
 *     before day-7 final-call lifecycle email)
 *   - score >= 2
 *
 * Usage:
 *   node scripts/founder-hot-list.js              # Run + email
 *   node scripts/founder-hot-list.js --dry-run    # Preview, no email sent
 */

require('dotenv').config();
const { Pool } = require('pg');
const { Resend } = require('resend');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const resend = new Resend(process.env.RESEND_API_KEY);
const DRY_RUN = process.argv.includes('--dry-run');

const FROM = 'AIWholesail <noreply@aiwholesail.com>';
const TO = process.env.FOUNDER_HOT_LIST_TO || 'connor@aiwholesail.com';
const MIN_SCORE = 2;

const HOT_LIST_SQL = `
WITH today AS (
  SELECT date_trunc('day', NOW()) AS start_of_day
),
candidates AS (
  SELECT u.id AS user_id, u.email, u.full_name, u.created_at,
         s.subscription_tier, s.is_trial, s.trial_end
  FROM users u
  JOIN subscribers s ON s.user_id = u.id
  WHERE s.is_trial = true
    AND u.created_at BETWEEN NOW() - INTERVAL '7 days' AND NOW() - INTERVAL '24 hours'
    AND u.email NOT LIKE '%@aiwholesail.test%'
    AND u.email NOT LIKE 'e2e-%'
    AND u.email NOT LIKE 'signup-%'
    AND u.email NOT LIKE '%pr113-%'
    AND u.email NOT LIKE '%newkey-%'
    AND u.email NOT LIKE 'cpodea5%'
),
search_counts AS (
  SELECT identifier::uuid AS user_id,
         COALESCE(SUM(request_count), 0)::int AS searches_today
  FROM rate_limits
  WHERE function_name = 'daily-search'
    AND window_start >= (SELECT start_of_day FROM today)
    AND identifier ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  GROUP BY identifier
),
fav_counts AS (
  SELECT user_id, COUNT(*)::int AS fav_count
  FROM favorites
  WHERE created_at >= NOW() - INTERVAL '7 days'
  GROUP BY user_id
),
alert_counts AS (
  SELECT user_id, COUNT(*)::int AS alert_count
  FROM property_alerts
  WHERE created_at >= NOW() - INTERVAL '7 days'
  GROUP BY user_id
),
skip_counts AS (
  SELECT user_id, COUNT(*)::int AS skip_count
  FROM skip_trace_lookups
  WHERE created_at >= NOW() - INTERVAL '7 days'
    AND served_from_cache = false
  GROUP BY user_id
),
contract_counts AS (
  SELECT user_id, COUNT(*)::int AS contract_count
  FROM contracts
  WHERE created_at >= NOW() - INTERVAL '7 days'
  GROUP BY user_id
)
SELECT
  c.user_id,
  c.email,
  c.full_name,
  c.subscription_tier,
  c.created_at,
  c.trial_end,
  COALESCE(s.searches_today, 0)  AS searches_today,
  COALESCE(f.fav_count, 0)       AS fav_count,
  COALESCE(a.alert_count, 0)     AS alert_count,
  COALESCE(sk.skip_count, 0)     AS skip_count,
  COALESCE(co.contract_count, 0) AS contract_count,
  (
    CASE WHEN COALESCE(s.searches_today, 0) >= 5 THEN 2 ELSE 0 END
    + CASE WHEN COALESCE(sk.skip_count, 0)  > 0 THEN 2 ELSE 0 END
    + CASE WHEN COALESCE(f.fav_count, 0)    > 0 THEN 1 ELSE 0 END
    + CASE WHEN COALESCE(a.alert_count, 0)  > 0 THEN 1 ELSE 0 END
    + CASE WHEN COALESCE(co.contract_count, 0) > 0 THEN 1 ELSE 0 END
  ) AS score
FROM candidates c
LEFT JOIN search_counts   s  ON s.user_id  = c.user_id
LEFT JOIN fav_counts      f  ON f.user_id  = c.user_id
LEFT JOIN alert_counts    a  ON a.user_id  = c.user_id
LEFT JOIN skip_counts     sk ON sk.user_id = c.user_id
LEFT JOIN contract_counts co ON co.user_id = c.user_id
WHERE
  (
    CASE WHEN COALESCE(s.searches_today, 0) >= 5 THEN 2 ELSE 0 END
    + CASE WHEN COALESCE(sk.skip_count, 0)  > 0 THEN 2 ELSE 0 END
    + CASE WHEN COALESCE(f.fav_count, 0)    > 0 THEN 1 ELSE 0 END
    + CASE WHEN COALESCE(a.alert_count, 0)  > 0 THEN 1 ELSE 0 END
    + CASE WHEN COALESCE(co.contract_count, 0) > 0 THEN 1 ELSE 0 END
  ) >= $1
ORDER BY score DESC, c.created_at DESC
LIMIT 10;
`;

function fmtSignals(row) {
  const bits = [];
  if (row.searches_today >= 5) bits.push(`${row.searches_today} searches today`);
  else if (row.searches_today > 0) bits.push(`${row.searches_today} searches today`);
  if (row.skip_count > 0) bits.push(`${row.skip_count} skip-trace lookup${row.skip_count > 1 ? 's' : ''} 💎`);
  if (row.fav_count > 0) bits.push(`${row.fav_count} saved`);
  if (row.alert_count > 0) bits.push(`${row.alert_count} alert${row.alert_count > 1 ? 's' : ''}`);
  if (row.contract_count > 0) bits.push(`${row.contract_count} contract${row.contract_count > 1 ? 's' : ''}`);
  return bits.join(' · ');
}

function fmtTrialEnd(iso) {
  if (!iso) return '—';
  const days = Math.ceil((new Date(iso) - Date.now()) / 86400000);
  if (days < 0) return `expired ${-days}d ago`;
  if (days === 0) return 'ends today';
  if (days === 1) return 'ends tomorrow';
  return `ends in ${days}d`;
}

function buildEmail(rows) {
  const date = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  const headline = rows.length === 0
    ? 'No hot trials today'
    : `${rows.length} hot trial${rows.length === 1 ? '' : 's'} for you to text today`;

  const intro = rows.length === 0
    ? 'No trial users hit the activation threshold (score ≥ 2) in the past 24h. The trial-lifecycle emails will catch them at day -1, 0, +1, +7. Quiet day — focus elsewhere.'
    : 'These trial users took real action in the last 24h. Texting them from your personal phone (248-881-4147) right now is the highest-ROI move you can make today. Mention what they did — show you noticed.';

  const rowsHtml = rows.map(r => {
    const name = r.full_name || r.email.split('@')[0];
    return `
      <tr>
        <td style="padding:14px 0;border-bottom:1px solid #1a1a1a;vertical-align:top">
          <div style="color:#06b6d4;font-size:11px;font-weight:600;letter-spacing:0.05em">SCORE ${r.score}/6</div>
          <div style="color:#fff;font-size:16px;font-weight:600;margin-top:4px">${name}</div>
          <div style="color:#a3a3a3;font-size:13px;margin-top:2px">${r.email}</div>
          <div style="color:#525252;font-size:12px;margin-top:6px">
            ${r.subscription_tier || 'Trial'} · ${fmtTrialEnd(r.trial_end)}
          </div>
          <div style="color:#e5e5e5;font-size:13px;margin-top:8px;padding:8px 10px;background:#0a0a0b;border-left:2px solid #06b6d4;border-radius:0 4px 4px 0">
            ${fmtSignals(r) || '(no signals captured)'}
          </div>
        </td>
      </tr>
    `;
  }).join('');

  return `<!DOCTYPE html>
<html><body style="margin:0;padding:0;background:#000">
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#000;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif">
  <tr><td align="center" style="padding:40px 20px">
    <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background:#0a0a0b;border-radius:12px;overflow:hidden;border:1px solid #1a1a1a">
      <tr><td style="padding:28px 32px 20px;border-bottom:1px solid #1a1a1a">
        <div style="color:#06b6d4;font-size:11px;font-weight:700;letter-spacing:0.18em;text-transform:uppercase">Founder Hot List · ${date}</div>
        <div style="color:#fff;font-size:22px;font-weight:700;margin-top:8px">${headline}</div>
      </td></tr>
      <tr><td style="height:3px;background:linear-gradient(90deg,#06b6d4,#0891b2,#06b6d4);font-size:0;line-height:0">&nbsp;</td></tr>
      <tr><td style="padding:24px 32px">
        <p style="color:#a3a3a3;font-size:14px;line-height:1.6;margin:0 0 18px">${intro}</p>
        ${rows.length > 0 ? `<table width="100%" cellpadding="0" cellspacing="0" border="0">${rowsHtml}</table>` : ''}
      </td></tr>
      <tr><td style="padding:18px 32px 24px;border-top:1px solid #1a1a1a;color:#525252;font-size:11px;line-height:1.5">
        Score: searches ≥5 (+2) · skip-trace use (+2) · favorites/alerts/contracts (+1 each).
        Min score for inclusion: ${MIN_SCORE}. Sourced from Postgres (rate_limits + skip_trace_lookups + favorites + property_alerts + contracts).
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;
}

async function run() {
  console.log(`=== Founder Hot List started at ${new Date().toISOString()} ===`);
  if (DRY_RUN) console.log('*** DRY RUN — no email will be sent ***\n');

  const result = await pool.query(HOT_LIST_SQL, [MIN_SCORE]);
  const rows = result.rows;

  console.log(`Hot list candidates: ${rows.length}`);
  for (const r of rows) {
    console.log(`  ${r.score}/6 — ${r.full_name || '(no name)'} <${r.email}> — ${fmtSignals(r)}`);
  }

  if (DRY_RUN) {
    await pool.end();
    return;
  }

  // Always send the email (even when 0 candidates — lets Connor know the system ran)
  const subject = rows.length === 0
    ? `Hot list: nothing today (${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })})`
    : `🔥 ${rows.length} hot trial${rows.length === 1 ? '' : 's'} to text today`;

  const send = await resend.emails.send({
    from: FROM,
    to: TO,
    replyTo: 'connor@aiwholesail.com',
    subject,
    html: buildEmail(rows),
  });

  if (send?.error) {
    console.error('Resend rejected hot-list email:', JSON.stringify(send.error));
    process.exit(1);
  }

  console.log(`✓ sent to ${TO} (id ${send?.data?.id || '?'})`);
  await pool.end();
}

run().catch(err => {
  console.error('Hot list worker crashed:', err);
  process.exit(1);
});
