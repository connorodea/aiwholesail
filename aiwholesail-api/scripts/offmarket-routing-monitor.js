#!/usr/bin/env node
/**
 * Off-market routing monitor — runs every 5 min via systemd timer.
 *
 * Reads structured journald logs from `aiwholesail-api`, evaluates 4 SLIs
 * (defined in lib/offmarket-monitor-thresholds.js), inserts triggering
 * alerts into the monitor_alerts table, and emails the operator via
 * Resend with cooldown enforcement.
 *
 * Designed to catch the 2026-05-13 incident class — dual-feed routing
 * collapse where 100% of off-market searches hit /api/propdata/preforeclosure
 * and returned empty for paying users. SLI-2 (feed ratio) would have
 * fired within 5-10 min of the broken deploy.
 *
 * Usage:
 *   node scripts/offmarket-routing-monitor.js              # normal cron run
 *   node scripts/offmarket-routing-monitor.js --dry-run    # no DB writes, no email
 *   node scripts/offmarket-routing-monitor.js --force      # bypass cooldown for testing
 */

require('dotenv').config();
const { execSync } = require('child_process');
const { Pool } = require('pg');
const { Resend } = require('resend');
const {
  parsePropDataLog,
  evaluateFeedRatio,
  evaluateUser429Burst,
  evaluateEmptyResultRate,
  evaluateEndpointDiversity,
} = require('../lib/offmarket-monitor-thresholds');

const DRY_RUN = process.argv.includes('--dry-run');
const FORCE = process.argv.includes('--force');

const COOLDOWN_MINUTES = {
  'offmarket-feed-ratio': 30,
  'offmarket-endpoint-diversity': 30,
  'offmarket-empty-rate': 60,
  'offmarket-429-burst': 60,
};

const OPERATOR_EMAIL = process.env.OPERATOR_EMAIL || 'connor@upscaledinc.com';
const FROM_EMAIL = process.env.HEALTH_FROM_EMAIL || 'AIWholesail Health <ops@aiwholesail.com>';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

/**
 * Pull the last N minutes of aiwholesail-api logs from journald. The
 * `-o cat` strips syslog prefixes leaving just the structured JSON lines
 * the routes emit. We tolerate the occasional non-JSON line (express
 * morgan output, uncaught stack traces) — the parser drops them.
 */
function readLogsSince(minutes) {
  try {
    const raw = execSync(
      `sudo journalctl -u aiwholesail-api --since "${minutes} min ago" -o cat --no-pager`,
      { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 },
    );
    return raw.split('\n').filter(Boolean);
  } catch (err) {
    console.error(JSON.stringify({ ts: new Date().toISOString(), monitor_error: 'journalctl_failed', message: err.message }));
    return [];
  }
}

async function inCooldown(sli) {
  if (FORCE) return false;
  const minutes = COOLDOWN_MINUTES[sli] || 30;
  const { rows } = await pool.query(
    `SELECT 1 FROM monitor_alerts WHERE sli = $1 AND fired_at > NOW() - ($2 || ' minutes')::interval LIMIT 1`,
    [sli, String(minutes)],
  );
  return rows.length > 0;
}

async function fireAlert(alert) {
  if (await inCooldown(alert.sli)) {
    console.log(JSON.stringify({ ts: new Date().toISOString(), sli: alert.sli, suppressed: 'cooldown' }));
    return;
  }
  if (!DRY_RUN) {
    await pool.query(
      `INSERT INTO monitor_alerts (sli, value, severity, details_json, fired_at)
       VALUES ($1, $2, $3, $4::jsonb, NOW())`,
      [alert.sli, alert.value, alert.severity, JSON.stringify(alert.details || {})],
    );
  }
  console.log(JSON.stringify({ ts: new Date().toISOString(), alert_fired: alert }));
  if (!DRY_RUN && resend) {
    try {
      const subject = `[AIW][${alert.severity.toUpperCase()}] ${alert.sli} value=${alert.value}`;
      const body = JSON.stringify({ ...alert.details, sli: alert.sli, value: alert.value }, null, 2);
      await resend.emails.send({
        from: FROM_EMAIL,
        to: OPERATOR_EMAIL,
        subject,
        text: `Off-market routing monitor — SLI breach\n\n${body}\n\nRunbook: aiwholesail-api/docs/runbooks/offmarket-debug.md\nLogs:    ssh hetznerCO 'sudo journalctl -u aiwholesail-api --since "10 min ago" -o cat | grep propdata'`,
      });
    } catch (err) {
      console.error(JSON.stringify({ ts: new Date().toISOString(), sli: alert.sli, email_error: err.message }));
    }
  }
}

async function main() {
  // SLI-2 + SLI-4 read 15-min and 5-min windows of propdata route logs.
  const log15 = readLogsSince(15).map(parsePropDataLog).filter(Boolean);
  const log5 = readLogsSince(5).map(parsePropDataLog).filter(Boolean);

  // SLI-1 + SLI-3 read the offmarket-search aggregate log lines. Parsed
  // as plain JSON (different component name), reusing the same line split.
  const offmarketEvents15 = readLogsSince(15).map((line) => {
    const start = line.indexOf('{');
    if (start < 0) return null;
    try {
      const obj = JSON.parse(line.slice(start));
      return obj && obj.component === 'offmarket-search' ? obj : null;
    } catch {
      return null;
    }
  }).filter(Boolean);

  const alerts = [
    evaluateFeedRatio(log15),
    evaluateUser429Burst(log5),
    evaluateEmptyResultRate(offmarketEvents15),
    evaluateEndpointDiversity(offmarketEvents15),
  ].filter(Boolean);

  console.log(JSON.stringify({
    ts: new Date().toISOString(),
    monitor: 'offmarket-routing',
    propdata_samples_15m: log15.length,
    offmarket_search_samples_15m: offmarketEvents15.length,
    alerts_count: alerts.length,
    alerts: alerts.map((a) => ({ sli: a.sli, value: a.value, severity: a.severity })),
  }));

  for (const a of alerts) {
    await fireAlert(a);
  }

  await pool.end();
  process.exit(0);
}

main().catch((err) => {
  console.error(JSON.stringify({ ts: new Date().toISOString(), monitor_error: 'fatal', message: err.message, stack: err.stack }));
  process.exit(1);
});
