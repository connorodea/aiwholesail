#!/usr/bin/env node
/**
 * Daily Meta Ads performance report → email digest via Resend.
 *
 * Pulls last-24h insights for every ad set in the AIWholesail Sales campaign
 * (the conversion-optimized one) plus a few signup-funnel datapoints from
 * the local database, then emails a compact summary to the operator.
 *
 * Designed to be run by a systemd timer at 9am ET daily. Idempotent —
 * re-running just resends the same data.
 *
 * Required env (already in /var/www/aiwholesail-api/.env after deploy):
 *   META_ACCESS_TOKEN     long-lived Marketing API token (ads_read scope is enough)
 *   META_AD_ACCOUNT_ID    e.g. act_609162191032890
 *   META_SALES_CAMPAIGN_ID  e.g. 120244930716180021
 *   RESEND_API_KEY        Resend transactional email key
 *   REPORT_TO_EMAIL       recipient (defaults to connor@upscaledinc.com)
 *   REPORT_FROM_EMAIL     sender (defaults to alerts@aiwholesail.com)
 *   DATABASE_URL          for the signup-funnel tally (optional — script still
 *                         runs without it, just omits that section)
 */

const META_API = 'https://graph.facebook.com/v21.0';

function env(name, fallback) {
  const v = process.env[name];
  if (v != null && v !== '') return v;
  if (fallback !== undefined) return fallback;
  throw new Error(`Missing required env: ${name}`);
}

const TOKEN = env('META_ACCESS_TOKEN');
const ACCOUNT_ID = env('META_AD_ACCOUNT_ID', 'act_609162191032890');
const CAMPAIGN_ID = env('META_SALES_CAMPAIGN_ID', '120244930716180021');
const TO_EMAIL = env('REPORT_TO_EMAIL', 'connor@upscaledinc.com');
const FROM_EMAIL = env('REPORT_FROM_EMAIL', 'alerts@aiwholesail.com');
const RESEND_API_KEY = env('RESEND_API_KEY');

async function metaGet(path, params = {}) {
  const qs = new URLSearchParams({ ...params, access_token: TOKEN }).toString();
  const res = await fetch(`${META_API}${path}?${qs}`);
  const body = await res.json();
  if (body.error) throw new Error(`Meta API ${path}: ${body.error.message}`);
  return body;
}

function fmtUSD(n) {
  if (n == null || isNaN(n)) return '—';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  }).format(n);
}

function pickAction(actions, type) {
  if (!Array.isArray(actions)) return 0;
  const a = actions.find(x => x.action_type === type);
  return a ? Number(a.value) : 0;
}

function cpaFor(actions, costActions, eventType) {
  const c = costActions?.find(x => x.action_type === eventType);
  return c ? Number(c.value) : null;
}

async function fetchAdSetInsights() {
  const adsets = await metaGet(`/${CAMPAIGN_ID}/adsets`, {
    fields: 'id,name,effective_status,daily_budget',
    limit: 25,
  });

  const rows = [];
  for (const as of adsets.data) {
    const insights = await metaGet(`/${as.id}/insights`, {
      fields: 'spend,impressions,reach,clicks,ctr,cpm,actions,cost_per_action_type',
      date_preset: 'yesterday',
    });
    const d = insights.data?.[0] || {};
    const actions = d.actions || [];
    const cost = d.cost_per_action_type || [];

    rows.push({
      id: as.id,
      name: as.name,
      status: as.effective_status,
      budget: Number(as.daily_budget || 0) / 100,
      spend: Number(d.spend || 0),
      impressions: Number(d.impressions || 0),
      clicks: Number(d.clicks || 0),
      ctr: Number(d.ctr || 0),
      lpv: pickAction(actions, 'landing_page_view'),
      leads: pickAction(actions, 'lead'),
      starttrials:
        pickAction(actions, 'start_trial_total') ||
        pickAction(actions, 'offsite_conversion.fb_pixel_custom') ||
        pickAction(actions, 'onsite_conversion.lead_grouped'),
      cpa_lpv: cpaFor(actions, cost, 'landing_page_view'),
      cpa_lead: cpaFor(actions, cost, 'lead'),
      cpa_trial: cpaFor(actions, cost, 'start_trial_total'),
    });
  }
  return rows;
}

async function fetchSignupFunnel() {
  if (!process.env.DATABASE_URL) return null;
  let pg;
  try {
    pg = require('pg');
  } catch {
    return null;
  }
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    const q = await client.query(
      `SELECT
         COUNT(*) FILTER (
           WHERE created_at >= (NOW() AT TIME ZONE 'America/New_York' - INTERVAL '1 day')::date
             AND created_at <  (NOW() AT TIME ZONE 'America/New_York')::date
         ) AS yesterday_count,
         COUNT(*) FILTER (
           WHERE created_at >= (NOW() AT TIME ZONE 'America/New_York' - INTERVAL '7 days')::date
         ) AS last_7d_count
       FROM users`
    );
    return q.rows[0];
  } finally {
    await client.end();
  }
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function renderHtml(adsets, funnel, dateLabel) {
  const totalSpend = adsets.reduce((a, b) => a + b.spend, 0);
  const totalImps = adsets.reduce((a, b) => a + b.impressions, 0);
  const totalLpv = adsets.reduce((a, b) => a + b.lpv, 0);
  const totalLeads = adsets.reduce((a, b) => a + b.leads, 0);
  const totalTrials = adsets.reduce((a, b) => a + b.starttrials, 0);

  const adsetRows = adsets
    .map(
      (r) => `
      <tr>
        <td style="padding:8px 10px;border-bottom:1px solid #eee;font-weight:600">${escapeHtml(r.name)}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #eee;color:${
          r.status === 'ACTIVE' ? '#0a7' : '#888'
        };font-size:11px;text-transform:uppercase;letter-spacing:.05em">${escapeHtml(r.status)}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #eee;text-align:right">${fmtUSD(r.spend)}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #eee;text-align:right">${r.impressions.toLocaleString()}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #eee;text-align:right">${r.clicks.toLocaleString()}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #eee;text-align:right">${r.lpv.toLocaleString()}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #eee;text-align:right">${r.leads.toLocaleString()}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #eee;text-align:right;font-weight:700;color:${
          r.starttrials > 0 ? '#0a7' : '#888'
        }">${r.starttrials.toLocaleString()}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #eee;text-align:right">${
          r.cpa_trial != null ? fmtUSD(r.cpa_trial) : r.cpa_lead != null ? fmtUSD(r.cpa_lead) + ' / lead' : '—'
        }</td>
      </tr>`
    )
    .join('');

  const funnelHtml = funnel
    ? `<p style="margin:24px 0 8px;color:#444;font-size:14px">
         <strong>Signups in DB:</strong> ${funnel.yesterday_count} yesterday · ${funnel.last_7d_count} last 7 days
       </p>`
    : '';

  return `<!doctype html><html><body style="font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Helvetica,Arial,sans-serif;color:#111;background:#f6f7f9;padding:24px">
  <div style="max-width:760px;margin:0 auto;background:#fff;border-radius:12px;border:1px solid #e6e8eb;overflow:hidden">
    <div style="padding:20px 24px;border-bottom:1px solid #e6e8eb">
      <p style="margin:0 0 4px;color:#888;font-size:11px;text-transform:uppercase;letter-spacing:.1em">AIWholesail · Daily ad report</p>
      <h1 style="margin:0;font-size:20px;font-weight:600">${escapeHtml(dateLabel)}</h1>
    </div>

    <div style="padding:20px 24px;border-bottom:1px solid #e6e8eb;background:#fafbfc">
      <table style="width:100%;border-collapse:collapse">
        <tr>
          <td style="padding:4px 0;font-size:13px;color:#555">Total spend</td>
          <td style="padding:4px 0;font-size:13px;text-align:right;font-weight:600">${fmtUSD(totalSpend)}</td>
        </tr>
        <tr>
          <td style="padding:4px 0;font-size:13px;color:#555">Impressions / LP views</td>
          <td style="padding:4px 0;font-size:13px;text-align:right">${totalImps.toLocaleString()} / ${totalLpv.toLocaleString()}</td>
        </tr>
        <tr>
          <td style="padding:4px 0;font-size:13px;color:#555">Leads / StartTrials</td>
          <td style="padding:4px 0;font-size:13px;text-align:right;font-weight:600;color:${
            totalTrials > 0 ? '#0a7' : '#c00'
          }">${totalLeads.toLocaleString()} / ${totalTrials.toLocaleString()}</td>
        </tr>
        <tr>
          <td style="padding:4px 0;font-size:13px;color:#555">Cost per StartTrial (blended)</td>
          <td style="padding:4px 0;font-size:13px;text-align:right;font-weight:600">${
            totalTrials > 0 ? fmtUSD(totalSpend / totalTrials) : '—'
          }</td>
        </tr>
      </table>
      ${funnelHtml}
    </div>

    <table style="width:100%;border-collapse:collapse;font-size:12px">
      <thead>
        <tr style="background:#fafbfc">
          <th style="padding:10px;text-align:left;font-weight:600;border-bottom:1px solid #e6e8eb">Ad set</th>
          <th style="padding:10px;text-align:left;font-weight:600;border-bottom:1px solid #e6e8eb">Status</th>
          <th style="padding:10px;text-align:right;font-weight:600;border-bottom:1px solid #e6e8eb">Spend</th>
          <th style="padding:10px;text-align:right;font-weight:600;border-bottom:1px solid #e6e8eb">Imps</th>
          <th style="padding:10px;text-align:right;font-weight:600;border-bottom:1px solid #e6e8eb">Clicks</th>
          <th style="padding:10px;text-align:right;font-weight:600;border-bottom:1px solid #e6e8eb">LPV</th>
          <th style="padding:10px;text-align:right;font-weight:600;border-bottom:1px solid #e6e8eb">Leads</th>
          <th style="padding:10px;text-align:right;font-weight:600;border-bottom:1px solid #e6e8eb">Trials</th>
          <th style="padding:10px;text-align:right;font-weight:600;border-bottom:1px solid #e6e8eb">CPA</th>
        </tr>
      </thead>
      <tbody>${adsetRows}</tbody>
    </table>

    <div style="padding:14px 24px;color:#888;font-size:11px;border-top:1px solid #e6e8eb">
      Data window: yesterday (Meta account TZ). Source: Marketing API v21.0 · Run by aiwholesail-daily-report systemd timer.
    </div>
  </div>
</body></html>`;
}

function renderSubject(adsets) {
  const trials = adsets.reduce((a, b) => a + b.starttrials, 0);
  const spend = adsets.reduce((a, b) => a + b.spend, 0);
  return `[AIW] Yesterday: ${trials} trials · ${fmtUSD(spend)} spend${
    trials > 0 ? ` · ${fmtUSD(spend / trials)}/trial` : ''
  }`;
}

async function sendEmail({ subject, html }) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: FROM_EMAIL,
      to: [TO_EMAIL],
      subject,
      html,
    }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(`Resend ${res.status}: ${JSON.stringify(body)}`);
  return body;
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'America/New_York',
  });

  console.log(`[daily-meta-report] Fetching insights for ${yesterday}…`);
  const adsets = await fetchAdSetInsights();
  const funnel = await fetchSignupFunnel().catch((e) => {
    console.warn('[daily-meta-report] funnel query skipped:', e.message);
    return null;
  });

  const html = renderHtml(adsets, funnel, yesterday);
  const subject = renderSubject(adsets);

  if (dryRun) {
    console.log('--- DRY RUN ---');
    console.log('Subject:', subject);
    console.log('Adsets:', JSON.stringify(adsets, null, 2));
    if (funnel) console.log('Funnel:', funnel);
    return;
  }

  console.log(`[daily-meta-report] Sending to ${TO_EMAIL}…`);
  await sendEmail({ subject, html });
  console.log('[daily-meta-report] Sent.');
}

main().catch((err) => {
  console.error('[daily-meta-report] FAILED:', err);
  process.exit(1);
});
