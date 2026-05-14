#!/usr/bin/env node
/**
 * AIWholesail Site Health Monitor
 *
 * Runs hourly. Checks a panel of health signals and emails an operator
 * digest IF anything is anomalous. At 09:00 UTC, sends a "still alive"
 * green ping even when everything is fine — so silence after 24h means
 * something killed the monitor itself, not just "nothing to report".
 *
 * Signals checked (each returns { name, status: 'ok'|'warn'|'fail', detail }):
 *   1. API health endpoint (https://api.aiwholesail.com/health)
 *   2. Frontend reachable (https://aiwholesail.com)
 *   3. Database connectivity (SELECT 1)
 *   4. Last user signup count (last 24h, sanity check on signup pipeline)
 *   5. Blog freshness (last bot commit on origin/main within 12h)
 *   6. systemd timer states (all aiwholesail-*.timer should be active)
 *   7. systemd service failures in last hour
 *   8. Disk usage (/, /var)
 *   9. Memory usage
 *  10. Load average (1-min)
 *  11. SCRAPE_DO_API_TOKEN env var present (fallback dies silently if missing)
 *  12. scrape.do success rate over the last 60 min (warn <90%, fail <70%)
 *  13. Feature flags zillow_scrape_do + skip_trace_tps still ON @ 100% rollout
 *
 * Email is sent only when:
 *   - any signal is 'fail'
 *   - >= 2 signals are 'warn'
 *   - it is the daily green-ping window (09:00 UTC ± 30 min)
 *
 * Usage:
 *   node scripts/health-monitor.js                # Run normal check
 *   node scripts/health-monitor.js --dry-run      # Don't send email
 *   node scripts/health-monitor.js --force-email  # Send email regardless
 */

require('dotenv').config();
const axios = require('axios');
const { Pool } = require('pg');
const { Resend } = require('resend');
const { execSync } = require('child_process');
const fs = require('fs');

const DRY_RUN = process.argv.includes('--dry-run');
const FORCE_EMAIL = process.argv.includes('--force-email');

const resend = new Resend(process.env.RESEND_API_KEY);
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const OPERATOR_EMAIL = process.env.OPERATOR_EMAIL || 'cpodea5@gmail.com';
const FRONTEND_URL = 'https://aiwholesail.com';
const API_URL = 'https://api.aiwholesail.com';
const REPO_DIR = process.env.FRONTEND_REPO_DIR || '/var/www/aiwholesail-repo';

// Thresholds
const DISK_WARN_PCT = 80;
const DISK_FAIL_PCT = 92;
const MEM_WARN_PCT = 85;
const MEM_FAIL_PCT = 95;
const LOAD_WARN = 4.0;   // 4x cores roughly
const LOAD_FAIL = 8.0;
const BLOG_STALE_HOURS = 14; // 3x/day = 8h gap; 14h tolerates one missed run

// ============ HEALTH CHECKS ============

async function checkApi() {
  try {
    const r = await axios.get(`${API_URL}/health`, { timeout: 10000 });
    if (r.status === 200) return { name: 'API health', status: 'ok', detail: `${API_URL}/health → 200` };
    return { name: 'API health', status: 'fail', detail: `${API_URL}/health → ${r.status}` };
  } catch (e) {
    return { name: 'API health', status: 'fail', detail: e.code || e.message };
  }
}

async function checkFrontend() {
  try {
    const r = await axios.get(FRONTEND_URL, { timeout: 10000, maxRedirects: 3 });
    if (r.status === 200) return { name: 'Frontend reachable', status: 'ok', detail: `${FRONTEND_URL} → 200` };
    return { name: 'Frontend reachable', status: 'fail', detail: `${FRONTEND_URL} → ${r.status}` };
  } catch (e) {
    return { name: 'Frontend reachable', status: 'fail', detail: e.code || e.message };
  }
}

async function checkDatabase() {
  try {
    const r = await pool.query('SELECT 1 AS ok');
    if (r.rows[0]?.ok === 1) return { name: 'Database', status: 'ok', detail: 'SELECT 1 succeeded' };
    return { name: 'Database', status: 'fail', detail: 'unexpected response' };
  } catch (e) {
    return { name: 'Database', status: 'fail', detail: e.message };
  }
}

async function checkRecentSignups() {
  try {
    const r = await pool.query(
      `SELECT COUNT(*)::int AS n FROM users WHERE created_at >= NOW() - INTERVAL '24 hours'`
    );
    const n = r.rows[0].n;
    return { name: 'Signups (24h)', status: 'ok', detail: `${n} new user${n === 1 ? '' : 's'}` };
  } catch (e) {
    return { name: 'Signups (24h)', status: 'warn', detail: `query failed: ${e.message}` };
  }
}

function checkBlogFreshness() {
  try {
    const lastCommitTs = execSync(
      `git -C "${REPO_DIR}" log -1 --format=%ct --author="AIWholesail Bot" -- src/data/blog/`,
      { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }
    ).trim();
    if (!lastCommitTs) {
      return { name: 'Blog freshness', status: 'warn', detail: 'no bot commits found in repo' };
    }
    const ageHours = (Date.now() / 1000 - parseInt(lastCommitTs, 10)) / 3600;
    if (ageHours <= BLOG_STALE_HOURS) {
      return { name: 'Blog freshness', status: 'ok', detail: `last bot commit ${ageHours.toFixed(1)}h ago` };
    }
    return {
      name: 'Blog freshness',
      status: ageHours > 26 ? 'fail' : 'warn',
      detail: `last bot commit ${ageHours.toFixed(1)}h ago (expected ≤${BLOG_STALE_HOURS}h)`,
    };
  } catch (e) {
    return { name: 'Blog freshness', status: 'warn', detail: e.message.slice(0, 200) };
  }
}

function checkTimers() {
  try {
    const out = execSync(
      `systemctl list-timers --all --no-pager --no-legend 'aiwholesail-*.timer'`,
      { encoding: 'utf8' }
    );
    const lines = out.trim().split('\n').filter(Boolean);
    if (lines.length === 0) {
      return { name: 'systemd timers', status: 'fail', detail: 'no aiwholesail-*.timer found' };
    }
    // Check each one is active. `systemctl list-timers --all` doesn't show
    // ActiveState directly — query each unit.
    const inactive = [];
    for (const line of lines) {
      const m = line.match(/(aiwholesail-\S+\.timer)/);
      if (!m) continue;
      const unit = m[1];
      const state = execSync(`systemctl show ${unit} --property=ActiveState --value`, { encoding: 'utf8' }).trim();
      if (state !== 'active') inactive.push(`${unit}=${state}`);
    }
    if (inactive.length === 0) {
      return { name: 'systemd timers', status: 'ok', detail: `${lines.length} timers active` };
    }
    return { name: 'systemd timers', status: 'fail', detail: `inactive: ${inactive.join(', ')}` };
  } catch (e) {
    return { name: 'systemd timers', status: 'warn', detail: e.message.slice(0, 200) };
  }
}

function checkServiceFailures() {
  try {
    const out = execSync(
      `systemctl list-units --failed --no-pager --no-legend 'aiwholesail-*' 2>/dev/null || true`,
      { encoding: 'utf8' }
    );
    const failed = out.trim().split('\n').filter(Boolean);
    if (failed.length === 0) {
      return { name: 'Failed services', status: 'ok', detail: 'no failed aiwholesail-* units' };
    }
    const names = failed.map((l) => l.trim().split(/\s+/)[0]).join(', ');
    return { name: 'Failed services', status: 'fail', detail: names };
  } catch (e) {
    return { name: 'Failed services', status: 'warn', detail: e.message.slice(0, 200) };
  }
}

function checkDisk() {
  try {
    const out = execSync(`df --output=pcent / /var | tail -n +2`, { encoding: 'utf8' });
    const pcts = out
      .trim()
      .split('\n')
      .map((l) => parseInt(l.replace('%', '').trim(), 10))
      .filter((n) => !isNaN(n));
    const max = Math.max(...pcts);
    const status = max >= DISK_FAIL_PCT ? 'fail' : max >= DISK_WARN_PCT ? 'warn' : 'ok';
    return { name: 'Disk usage', status, detail: `max ${max}% used` };
  } catch (e) {
    return { name: 'Disk usage', status: 'warn', detail: e.message.slice(0, 200) };
  }
}

function checkMemory() {
  try {
    const out = execSync(`free -m | awk '/^Mem:/ {printf "%.0f", $3/$2*100}'`, { encoding: 'utf8' });
    const pct = parseInt(out.trim(), 10);
    if (isNaN(pct)) return { name: 'Memory', status: 'warn', detail: 'parse failed' };
    const status = pct >= MEM_FAIL_PCT ? 'fail' : pct >= MEM_WARN_PCT ? 'warn' : 'ok';
    return { name: 'Memory', status, detail: `${pct}% used` };
  } catch (e) {
    return { name: 'Memory', status: 'warn', detail: e.message.slice(0, 200) };
  }
}

function checkLoad() {
  try {
    const load1 = parseFloat(fs.readFileSync('/proc/loadavg', 'utf8').split(/\s+/)[0]);
    if (isNaN(load1)) return { name: 'Load average', status: 'warn', detail: 'parse failed' };
    const status = load1 >= LOAD_FAIL ? 'fail' : load1 >= LOAD_WARN ? 'warn' : 'ok';
    return { name: 'Load average', status, detail: `1-min load ${load1.toFixed(2)}` };
  } catch (e) {
    return { name: 'Load average', status: 'warn', detail: e.message.slice(0, 200) };
  }
}

// scrape.do success rate thresholds (last 60 min)
const SCRAPE_DO_WARN_PCT = 90;
const SCRAPE_DO_FAIL_PCT = 70;

function checkScrapeDoToken() {
  // Without this token the scrape.do fallback is silently dead — every call
  // would fail auth and route back to RapidAPI. We want to know immediately.
  const token = process.env.SCRAPE_DO_API_TOKEN;
  if (!token || !token.trim()) {
    return {
      name: 'scrape.do token',
      status: 'fail',
      detail: 'SCRAPE_DO_API_TOKEN env var missing or empty',
    };
  }
  return { name: 'scrape.do token', status: 'ok', detail: 'env var present' };
}

async function checkScrapeDoSuccessRate() {
  try {
    const r = await pool.query(
      `SELECT
         COUNT(*)::int                                AS total,
         COUNT(*) FILTER (WHERE success)::int        AS ok
       FROM scrape_provider_metrics
       WHERE provider LIKE 'scrape-do%'
         AND created_at >= NOW() - INTERVAL '60 minutes'`
    );
    const { total, ok } = r.rows[0];
    if (total === 0) {
      // No calls at all in the last hour. With flags at 100% this could mean
      // zero user activity OR the call path is broken. Don't alarm hard — warn
      // so a sustained run of zeros gets noticed during the 2/warn email rule.
      return {
        name: 'scrape.do success (60m)',
        status: 'warn',
        detail: 'no scrape-do calls in last 60 min',
      };
    }
    const pct = (ok / total) * 100;
    const status =
      pct < SCRAPE_DO_FAIL_PCT ? 'fail' :
      pct < SCRAPE_DO_WARN_PCT ? 'warn' : 'ok';
    return {
      name: 'scrape.do success (60m)',
      status,
      detail: `${ok}/${total} ok (${pct.toFixed(1)}%)`,
    };
  } catch (e) {
    return {
      name: 'scrape.do success (60m)',
      status: 'warn',
      detail: `query failed: ${e.message.slice(0, 200)}`,
    };
  }
}

async function checkScrapeDoFlags() {
  // Both flags were promoted to enabled=true, rollout_pct=100 after the
  // dogfood window closed. If either has been rolled back, somebody pulled
  // the trigger and we want a signal — not a silent revert to RapidAPI.
  try {
    const r = await pool.query(
      `SELECT slug, enabled, rollout_pct
         FROM feature_flag_globals
        WHERE slug IN ('zillow_scrape_do', 'skip_trace_tps')`
    );
    const expected = ['zillow_scrape_do', 'skip_trace_tps'];
    const bySlug = new Map(r.rows.map((row) => [row.slug, row]));
    const issues = [];
    for (const slug of expected) {
      const row = bySlug.get(slug);
      if (!row) {
        issues.push(`${slug} missing`);
        continue;
      }
      if (!row.enabled) issues.push(`${slug} enabled=false`);
      else if (row.rollout_pct !== 100) issues.push(`${slug} rollout_pct=${row.rollout_pct}`);
    }
    if (issues.length === 0) {
      return {
        name: 'scrape.do feature flags',
        status: 'ok',
        detail: 'zillow_scrape_do + skip_trace_tps @ 100%',
      };
    }
    return {
      name: 'scrape.do feature flags',
      status: 'warn',
      detail: issues.join('; '),
    };
  } catch (e) {
    return {
      name: 'scrape.do feature flags',
      status: 'warn',
      detail: `query failed: ${e.message.slice(0, 200)}`,
    };
  }
}

// ============ EMAIL ============

function shouldEmail(results) {
  if (FORCE_EMAIL) return { send: true, reason: 'forced' };
  const fails = results.filter((r) => r.status === 'fail').length;
  const warns = results.filter((r) => r.status === 'warn').length;
  if (fails > 0) return { send: true, reason: `${fails} failure${fails > 1 ? 's' : ''}` };
  if (warns >= 2) return { send: true, reason: `${warns} warnings` };

  // Daily green ping at 09:00 UTC ± 30 min
  const now = new Date();
  const utcHour = now.getUTCHours();
  const utcMin = now.getUTCMinutes();
  if (utcHour === 9 && utcMin <= 35) return { send: true, reason: 'daily green ping' };
  return { send: false, reason: 'all healthy' };
}

function renderEmailHtml(results, reason) {
  const overall = results.some((r) => r.status === 'fail')
    ? { label: 'ATTENTION', color: '#ef4444', bg: 'rgba(239,68,68,0.1)' }
    : results.some((r) => r.status === 'warn')
    ? { label: 'WARNING', color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' }
    : { label: 'ALL HEALTHY', color: '#10b981', bg: 'rgba(16,185,129,0.1)' };

  const rows = results.map((r) => {
    const dot =
      r.status === 'ok' ? '<span style="color:#10b981">●</span>' :
      r.status === 'warn' ? '<span style="color:#f59e0b">●</span>' :
      '<span style="color:#ef4444">●</span>';
    return `
      <tr>
        <td style="padding:10px 16px;border-top:1px solid #1a1a1a;width:24px;font-size:18px;line-height:1">${dot}</td>
        <td style="padding:10px 0;border-top:1px solid #1a1a1a;color:#fff;font-size:13px;font-weight:600">${r.name}</td>
        <td style="padding:10px 16px;border-top:1px solid #1a1a1a;color:#a3a3a3;font-size:12px;text-align:right;font-family:monospace">${r.detail}</td>
      </tr>
    `;
  }).join('');

  const ts = new Date().toISOString().replace('T', ' ').slice(0, 19) + ' UTC';

  return `
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#000;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif">
      <tr><td align="center" style="padding:32px 16px">
        <table width="640" cellpadding="0" cellspacing="0" border="0" style="max-width:640px;width:100%;background:#0a0a0b;border-radius:12px;overflow:hidden;border:1px solid #1a1a1a">
          <tr><td style="padding:24px 28px 18px;border-bottom:1px solid #1a1a1a">
            <img src="https://aiwholesail.com/logo-white.png" alt="AIWholesail" height="28" style="height:28px;display:block">
          </td></tr>
          <tr><td style="height:3px;background:linear-gradient(90deg,${overall.color},${overall.color},${overall.color});font-size:0;line-height:0">&nbsp;</td></tr>
          <tr><td style="padding:24px 28px 8px">
            <div style="display:inline-block;padding:6px 12px;border-radius:999px;background:${overall.bg};border:1px solid ${overall.color}40;color:${overall.color};font-size:11px;font-weight:600;letter-spacing:0.1em;text-transform:uppercase">
              ${overall.label}
            </div>
            <h1 style="color:#fff;font-size:22px;font-weight:700;letter-spacing:-0.3px;margin:14px 0 4px">Health monitor — ${ts}</h1>
            <p style="color:#a3a3a3;font-size:13px;margin:0">Trigger: ${reason}</p>
          </td></tr>
          <tr><td style="padding:16px 12px 24px">
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse">
              ${rows}
            </table>
          </td></tr>
          <tr><td style="padding:16px 28px;border-top:1px solid #1a1a1a;color:#525252;font-size:11px;line-height:1.5">
            Hourly check via <code style="background:#1a1a1a;padding:2px 5px;border-radius:3px">aiwholesail-health-monitor.timer</code>.
            Disable: <code style="background:#1a1a1a;padding:2px 5px;border-radius:3px">sudo systemctl disable --now aiwholesail-health-monitor.timer</code>
          </td></tr>
        </table>
      </td></tr>
    </table>
  `;
}

async function sendEmail(results, reason) {
  const overall =
    results.some((r) => r.status === 'fail') ? 'ATTENTION'
    : results.some((r) => r.status === 'warn') ? 'WARNING'
    : 'OK';

  const subject = `[${overall}] AIWholesail health — ${reason}`;
  const html = renderEmailHtml(results, reason);

  const result = await resend.emails.send({
    from: 'AIWholesail Monitor <noreply@notifications.aiwholesail.com>',
    to: OPERATOR_EMAIL,
    subject,
    html,
  });
  if (result?.error) {
    console.error('[Health] Resend rejected email:', JSON.stringify(result.error));
    return false;
  }
  console.log(`[Health] Email sent: ${result?.data?.id}`);
  return true;
}

// ============ MAIN ============

async function main() {
  console.log(`[Health] Starting check at ${new Date().toISOString()}`);

  const results = [];
  // Run async + sync checks in parallel where independent
  const [api, frontend, db, signups, scrapeRate, scrapeFlags] = await Promise.all([
    checkApi(),
    checkFrontend(),
    checkDatabase(),
    checkRecentSignups(),
    checkScrapeDoSuccessRate(),
    checkScrapeDoFlags(),
  ]);
  results.push(api, frontend, db, signups);
  results.push(checkBlogFreshness());
  results.push(checkTimers());
  results.push(checkServiceFailures());
  results.push(checkDisk());
  results.push(checkMemory());
  results.push(checkLoad());
  results.push(checkScrapeDoToken());
  results.push(scrapeRate);
  results.push(scrapeFlags);

  // Print summary to journal
  for (const r of results) {
    const icon = r.status === 'ok' ? '✓' : r.status === 'warn' ? '!' : '✗';
    console.log(`  [${icon}] ${r.name}: ${r.detail}`);
  }

  const decision = shouldEmail(results);
  console.log(`[Health] Email decision: ${decision.send ? 'SEND' : 'SKIP'} (${decision.reason})`);

  if (decision.send && !DRY_RUN) {
    await sendEmail(results, decision.reason);
  } else if (DRY_RUN && decision.send) {
    console.log('[Health] (dry-run — would have sent email)');
  }

  await pool.end().catch(() => {});

  // Exit non-zero if any fail signal — systemd OnFailure handlers can pick it up
  const anyFail = results.some((r) => r.status === 'fail');
  process.exit(anyFail ? 1 : 0);
}

main().catch((err) => {
  console.error('[Health] Monitor crashed:', err);
  pool.end().catch(() => {});
  process.exit(1);
});
