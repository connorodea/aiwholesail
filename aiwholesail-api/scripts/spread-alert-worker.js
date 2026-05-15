#!/usr/bin/env node
/**
 * Spread Alert Worker
 *
 * Runs on a cron schedule. Efficiently finds +$30K spread deals and sends
 * email alerts (via Resend) and optional SMS (via Twilio) to subscribed users.
 *
 * KEY OPTIMIZATION: Deduplicates by location. 1000 users watching "Detroit, MI"
 * = 1 Zillow API call, not 1000. Results are cached in property_search_cache
 * and shared across all users.
 *
 * Flow:
 * 1. Get all unique locations from active alerts
 * 2. For each location: search Zillow (1 call) → enrich with zestimates
 * 3. Upsert results into property_search_cache
 * 4. For each alert: find new deals matching criteria that haven't been sent
 * 5. Send email via Resend (always) + SMS via Twilio (if phone exists), log to alert_sent_deals
 *
 * Usage:
 *   node scripts/spread-alert-worker.js           # Run once
 *   node scripts/spread-alert-worker.js --dry-run # Preview without sending
 */

require('dotenv').config();
const axios = require('axios');
const { Pool } = require('pg');
const { Resend } = require('resend');
const { zillowUrl, appPropUrl, buildPrimaryUrl } = require('../lib/spread-alert-urls');
const zillowScrapeDo = require('../lib/scrapers/zillowScrapeDo');
const resend = new Resend(process.env.RESEND_API_KEY);

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const DRY_RUN = process.argv.includes('--dry-run');

// Twilio config
const TWILIO_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_FROM = process.env.TWILIO_PHONE_NUMBER;

const MAX_PAGES_PER_LOCATION = 5;
const ZESTIMATE_BATCH_SIZE = 20;
const MIN_SPREAD_DEFAULT = 30000;

// State abbreviation → full name mapping for Zillow search
const STATE_NAMES = {
  AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California',
  CO: 'Colorado', CT: 'Connecticut', DE: 'Delaware', FL: 'Florida', GA: 'Georgia',
  HI: 'Hawaii', ID: 'Idaho', IL: 'Illinois', IN: 'Indiana', IA: 'Iowa',
  KS: 'Kansas', KY: 'Kentucky', LA: 'Louisiana', ME: 'Maine', MD: 'Maryland',
  MA: 'Massachusetts', MI: 'Michigan', MN: 'Minnesota', MS: 'Mississippi', MO: 'Missouri',
  MT: 'Montana', NE: 'Nebraska', NV: 'Nevada', NH: 'New Hampshire', NJ: 'New Jersey',
  NM: 'New Mexico', NY: 'New York', NC: 'North Carolina', ND: 'North Dakota', OH: 'Ohio',
  OK: 'Oklahoma', OR: 'Oregon', PA: 'Pennsylvania', RI: 'Rhode Island', SC: 'South Carolina',
  SD: 'South Dakota', TN: 'Tennessee', TX: 'Texas', UT: 'Utah', VT: 'Vermont',
  VA: 'Virginia', WA: 'Washington', WV: 'West Virginia', WI: 'Wisconsin', WY: 'Wyoming',
  DC: 'District of Columbia',
};

/**
 * Resolve a location string for Zillow search.
 * If the location is a 2-letter state abbreviation, expand to full state name.
 */
function resolveSearchLocation(location) {
  const trimmed = location.trim();
  const upper = trimmed.toUpperCase();
  if (upper.length === 2 && STATE_NAMES[upper]) {
    return STATE_NAMES[upper];
  }
  return trimmed;
}

// ---------- Zillow scrape.do helpers ----------
//
// Replaces the previous RapidAPI `zillow-scraper-api` integration. RapidAPI
// quota was exhausted (every request returned 429), so the worker ran on
// schedule but found zero new properties for ~48h. We now route through the
// in-repo scrape.do scraper (lib/scrapers/zillowScrapeDo) — the same path the
// live API + agent tools already use for Zillow data.
//
// The two helpers below preserve the exact return shape the worker's main
// loop already consumes (a `{data: {total_pages, listings: [...]}}` envelope
// for search; a scalar zestimate for the per-zpid fetch) so the swap is
// surface-only — no behavioral changes to the cache write, dedup query, or
// email template.

function mapSummaryToListing(r) {
  return {
    zpid: r.zpid,
    address: r.addressStreet || r.address,
    city: r.addressCity,
    state: r.addressState,
    zipcode: r.addressZipcode,
    price: r.price,
    zestimate: r.zestimate,
    bedrooms: r.beds,
    bathrooms: r.baths,
    living_area_sqft: r.area,
    home_type: r.homeType,
    days_on_zillow: r.daysOnZillow,
    detail_url: r.detailUrl,
    image_url: r.imgSrc,
  };
}

async function searchZillow(location, page = 1) {
  const result = await zillowScrapeDo.search({
    location,
    status: 'ForSale',
    page,
    sort: 'newest',
  });
  return {
    data: {
      total_pages: result.total_pages || 1,
      listings: (result.results || []).map(mapSummaryToListing),
    },
  };
}

async function getZestimate(zpid) {
  try {
    const result = await zillowScrapeDo.zestimate({ zpid });
    return result?.zestimate || null;
  } catch {
    return null;
  }
}

async function enrichWithZestimates(properties) {
  const results = [];
  for (let i = 0; i < properties.length; i += ZESTIMATE_BATCH_SIZE) {
    const batch = properties.slice(i, i + ZESTIMATE_BATCH_SIZE);
    const zestimates = await Promise.allSettled(
      batch.map(p => getZestimate(p.zpid))
    );
    batch.forEach((prop, idx) => {
      const result = zestimates[idx];
      const zest = result.status === 'fulfilled' ? result.value : null;
      results.push({ ...prop, zestimate: zest });
    });
    console.log(`  Zestimates: ${i + batch.length}/${properties.length}`);
  }
  return results;
}

// ---------- Twilio ----------

async function sendSMS(to, message) {
  if (DRY_RUN) {
    console.log(`  [DRY RUN] Would send SMS to ${to}: ${message.substring(0, 80)}...`);
    return { sid: 'dry-run' };
  }

  const response = await axios.post(
    `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`,
    new URLSearchParams({
      To: to,
      From: TWILIO_FROM,
      Body: message,
    }).toString(),
    {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      auth: { username: TWILIO_SID, password: TWILIO_TOKEN },
    }
  );
  return response.data;
}

// ---------- Resend Email ----------

/**
 * Build the user-facing alert email. Per-deal card layout (image + key
 * stats + clickable CTA) replaces the previous 4-column table — the
 * table format scanned poorly on mobile and gave users no way to act
 * on an individual property without first opening the app.
 *
 * userOptions.fullName personalizes the greeting; falls back to a
 * generic line when unavailable. All field accesses on the deal
 * object are nullish-safe.
 */
async function sendAlertEmail(userEmail, location, deals, userOptions = {}) {
  const firstName = (userOptions.fullName || '').trim().split(/\s+/)[0] || '';

  // Headline stat — total spread across all deals
  const totalSpread = deals.reduce((sum, d) => sum + ((d.zestimate && d.price) ? (d.zestimate - d.price) : 0), 0);
  const totalSpreadFormatted = totalSpread >= 1000 ? `$${Math.round(totalSpread / 1000)}K` : `$${totalSpread.toLocaleString()}`;

  // Time-since-found freshness
  const minutesAgo = Math.max(1, Math.round((Date.now() - new Date(deals[0]?.last_seen_at || Date.now()).getTime()) / 60000));
  const timeAgoText = minutesAgo < 60
    ? `${minutesAgo} minute${minutesAgo > 1 ? 's' : ''} ago`
    : `${Math.round(minutesAgo / 60)} hour${Math.round(minutesAgo / 60) > 1 ? 's' : ''} ago`;

  // Primary card link → Zillow (fastest path to see the property; works without
  // login and gives the user photos + listing details immediately).
  // URL builders extracted to aiwholesail-api/lib/spread-alert-urls.js so the
  // logic is unit-testable in isolation. `buildPrimaryUrl` returns null when
  // no valid URL can be built — caller renders cells without an anchor in
  // that case (no broken `?zpid=&...` URL in user emails).

  // One card per deal — image left, content right (stacks naturally on
  // narrow widths since each cell is its own table).
  const dealCards = deals.map((d) => {
    const addr = d.address || 'Unknown address';
    const listPrice = d.price ? `$${Number(d.price).toLocaleString()}` : 'N/A';
    const zestimate = d.zestimate ? `$${Number(d.zestimate).toLocaleString()}` : 'N/A';
    const spreadVal = (d.zestimate && d.price) ? (d.zestimate - d.price) : 0;
    const spreadPct = (d.zestimate && spreadVal > 0) ? Math.round((spreadVal / d.zestimate) * 100) : 0;
    const spreadText = spreadVal > 0 ? `+$${Number(spreadVal).toLocaleString()}` : '—';

    const specs = [];
    if (d.bedrooms) specs.push(`${d.bedrooms}bd`);
    if (d.bathrooms) specs.push(`${d.bathrooms}ba`);
    if (d.sqft) specs.push(`${Number(d.sqft).toLocaleString()} sqft`);
    const specsText = specs.join(' · ');

    const dom = Number(d.days_on_market);
    const domBadge = (dom > 0 && dom < 7)
      ? `<span style="display:inline-block;background:rgba(245,158,11,0.12);color:#f59e0b;font-size:10px;font-weight:700;padding:2px 8px;border-radius:4px;letter-spacing:0.05em;text-transform:uppercase;margin-left:8px;">New · ${dom}d</span>`
      : '';

    const zUrl = zillowUrl(d);
    const appUrl = d.zpid ? appPropUrl(d.zpid) : null;
    const primaryUrl = buildPrimaryUrl(d);  // null when no valid URL can be built

    // When primaryUrl is null, the image / address cells render without an
    // <a> wrapper — image is shown but not clickable, address is plain text.
    // Prevents the pre-fix broken `?zpid=&utm_source=alert-email` URLs.
    const openA = primaryUrl ? `<a href="${primaryUrl}" style="text-decoration:none;display:block;">` : '';
    const closeA = primaryUrl ? '</a>' : '';
    const openAddrA = primaryUrl ? `<a href="${primaryUrl}" style="color:#ffffff;font-size:15px;font-weight:600;line-height:1.3;text-decoration:none;">` : '<span style="color:#ffffff;font-size:15px;font-weight:600;line-height:1.3;">';
    const closeAddrA = primaryUrl ? '</a>' : '</span>';

    const imgCell = d.image_url
      ? `<td valign="top" width="120" style="padding-right:14px;width:120px;">
           ${openA}
             <img src="${d.image_url}" alt="" width="120" height="90" style="display:block;width:120px;height:90px;object-fit:cover;border-radius:8px;border:1px solid #1a1a1a;" />
           ${closeA}
         </td>`
      : `<td valign="top" width="120" style="padding-right:14px;width:120px;">
           ${openA}
             <table cellpadding="0" cellspacing="0" border="0" width="120" style="width:120px;height:90px;background:#111;border-radius:8px;border:1px solid #1a1a1a;">
               <tr><td align="center" style="color:#525252;font-size:11px;height:90px;">No photo</td></tr>
             </table>
           ${closeA}
         </td>`;

    return `
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:12px;background:#0f0f10;border:1px solid #1a1a1a;border-radius:10px;">
        <tr><td style="padding:14px;">
          <table width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr>
              ${imgCell}
              <td valign="top">
                <table width="100%" cellpadding="0" cellspacing="0" border="0">
                  <tr><td style="padding-bottom:6px;">
                    ${openAddrA}${addr}${closeAddrA}
                    ${domBadge}
                  </td></tr>
                  ${specsText ? `<tr><td style="color:#737373;font-size:12px;padding-bottom:8px;">${specsText}</td></tr>` : ''}
                  <tr><td style="padding-bottom:10px;">
                    <table cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td style="color:#737373;font-size:11px;text-transform:uppercase;letter-spacing:0.05em;padding-right:14px;">
                          List <span style="color:#e5e5e5;font-weight:600;font-size:13px;text-transform:none;letter-spacing:0;">${listPrice}</span>
                        </td>
                        <td style="color:#737373;font-size:11px;text-transform:uppercase;letter-spacing:0.05em;">
                          Zest <span style="color:#e5e5e5;font-weight:600;font-size:13px;text-transform:none;letter-spacing:0;">${zestimate}</span>
                        </td>
                      </tr>
                    </table>
                  </td></tr>
                  <tr><td>
                    <table cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td style="background:rgba(34,197,94,0.12);border:1px solid rgba(34,197,94,0.25);border-radius:6px;padding:6px 12px;">
                          <span style="color:#22c55e;font-weight:800;font-size:15px;letter-spacing:-0.3px;">${spreadText}</span>
                          ${spreadPct > 0 ? `<span style="color:#16a34a;font-weight:600;font-size:11px;margin-left:6px;">${spreadPct}% under</span>` : ''}
                        </td>
                        <td style="padding-left:10px;">
                          ${zUrl ? `<a href="${zUrl}" style="color:#06b6d4;font-weight:600;font-size:12px;text-decoration:none;">View on Zillow →</a>` : ''}
                          ${d.zpid ? `<span style="color:#262626;padding:0 6px;">·</span><a href="${appUrl}" style="color:#525252;font-weight:500;font-size:12px;text-decoration:none;">Analyze</a>` : ''}
                        </td>
                      </tr>
                    </table>
                  </td></tr>
                </table>
              </td>
            </tr>
          </table>
        </td></tr>
      </table>
    `;
  }).join('');

  const subject = `${deals.length} New Deal${deals.length > 1 ? 's' : ''} in ${location} — ${totalSpreadFormatted} total spread`;
  const html = `
    <style>@import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700;800&display=swap');</style>
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#000000;font-family:'Montserrat',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
      <tr><td align="center" style="padding:40px 20px;">
        <!--[if mso]><table width="600" cellpadding="0" cellspacing="0" border="0"><tr><td><![endif]-->
        <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background-color:#0a0a0b;border-radius:12px;overflow:hidden;border:1px solid #1a1a1a;">

          <!-- Logo header -->
          <tr><td style="padding:24px 28px 18px;border-bottom:1px solid #1a1a1a;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td><img src="https://aiwholesail.com/logo-white.png" alt="AIWholesail" height="40" style="height:40px;width:auto;display:block;" /></td>
                <td align="right" style="color:#525252;font-size:11px;">Deals found ${timeAgoText}</td>
              </tr>
            </table>
          </td></tr>

          <!-- Gradient accent bar -->
          <tr><td style="height:3px;background:linear-gradient(90deg,#22c55e,#06b6d4,#22c55e);font-size:0;line-height:0;">&nbsp;</td></tr>

          <!-- Hero stat -->
          <tr><td style="padding:28px 28px 0;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#111;border:1px solid #1a1a1a;border-radius:10px;overflow:hidden;">
              <tr><td style="padding:22px 24px;">
                <table width="100%" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td>
                      <table cellpadding="0" cellspacing="0" border="0">
                        <tr><td style="color:#525252;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.1em;padding-bottom:6px;">Total Potential Spread</td></tr>
                        <tr><td style="color:#22c55e;font-size:34px;font-weight:800;letter-spacing:-1px;line-height:1;">${totalSpreadFormatted}</td></tr>
                      </table>
                    </td>
                    <td align="right" valign="bottom">
                      <table cellpadding="0" cellspacing="0" border="0">
                        <tr><td style="color:#737373;font-size:13px;text-align:right;">across <strong style="color:#e5e5e5;">${deals.length} deal${deals.length > 1 ? 's' : ''}</strong></td></tr>
                        <tr><td style="color:#737373;font-size:13px;text-align:right;padding-top:2px;">in <strong style="color:#e5e5e5;">${location}</strong></td></tr>
                      </table>
                    </td>
                  </tr>
                </table>
              </td></tr>
            </table>
          </td></tr>

          <!-- Greeting + intro -->
          <tr><td style="padding:24px 28px 8px;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr><td style="color:#ffffff;font-size:20px;font-weight:700;letter-spacing:-0.4px;line-height:1.25;padding-bottom:8px;">
                ${firstName ? `Hey ${firstName} — ${deals.length} new ${deals.length > 1 ? 'deals' : 'deal'} for you` : `${deals.length} new ${deals.length > 1 ? 'deals' : 'deal'} just hit your alert`}
              </td></tr>
              <tr><td style="color:#a3a3a3;font-size:14px;line-height:1.6;padding-bottom:20px;">
                Listed at <strong style="color:#ffffff;">$30K+ under Zestimate</strong> in <strong style="color:#ffffff;">${location}</strong>. Tap any property to view it on Zillow, or hit <strong style="color:#ffffff;">Analyze</strong> for the full AI breakdown.
              </td></tr>
            </table>
          </td></tr>

          <!-- Deal cards -->
          <tr><td style="padding:0 28px;">
            ${dealCards}
          </td></tr>

          <!-- CTA + small print -->
          <tr><td style="padding:20px 28px 28px;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr><td align="center">
                <table cellpadding="0" cellspacing="0" border="0">
                  <tr><td style="background:#06b6d4;border-radius:8px;padding:15px 36px;box-shadow:0 2px 8px rgba(6,182,212,0.25);">
                    <a href="https://aiwholesail.com/app?utm_source=alert-email" style="color:#000;font-weight:700;font-size:15px;text-decoration:none;display:inline-block;">View all deals in ${location}</a>
                  </td></tr>
                </table>
              </td></tr>
            </table>

            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:20px;">
              <tr><td style="color:#525252;font-size:12px;line-height:1.6;text-align:center;">
                <strong style="color:#737373;">Spread</strong> = Zestimate − list price. Bigger = potentially under-priced.<br/>
                <a href="https://aiwholesail.com/app/alerts" style="color:#525252;text-decoration:underline;">Tune this alert</a>
                &nbsp;·&nbsp;
                <a href="https://aiwholesail.com/app/account" style="color:#525252;text-decoration:underline;">Manage preferences</a>
              </td></tr>
            </table>
          </td></tr>

          <!-- Footer -->
          <tr><td style="padding:18px 28px 22px;border-top:1px solid #1a1a1a;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="color:#404040;font-size:11px;line-height:1.5;">
                  &copy; 2026 AIWholesail &middot; <a href="https://aiwholesail.com" style="color:#06b6d4;text-decoration:none;">aiwholesail.com</a>
                </td>
                <td align="right" style="color:#404040;font-size:11px;">
                  <a href="https://aiwholesail.com/app/account" style="color:#404040;text-decoration:none;">Unsubscribe</a>
                </td>
              </tr>
            </table>
          </td></tr>

        </table>
        <!--[if mso]></td></tr></table><![endif]-->
      </td></tr>
    </table>
  `;

  if (DRY_RUN) {
    console.log(`  [DRY RUN] Would send email to ${userEmail}: ${subject}`);
    return { id: 'dry-run' };
  }

  const result = await resend.emails.send({
    from: 'AIWholesail Alerts <alerts@aiwholesail.com>',
    to: userEmail,
    subject,
    html,
  });
  if (result?.error) {
    // Resend SDK returns {error} instead of throwing on auth/validation failures.
    // Surface as a real error so callers don't mark the deal as sent in the dedup table.
    throw new Error(`Resend rejected alert email: ${JSON.stringify(result.error)}`);
  }
  return result;
}

// ---------- Main worker ----------

async function run() {
  const jobStart = new Date();
  console.log(`\n=== Spread Alert Worker started at ${jobStart.toISOString()} ===`);
  if (DRY_RUN) console.log('*** DRY RUN MODE — no emails/SMS will be sent ***\n');

  // Track job
  const jobResult = await pool.query(
    "INSERT INTO alert_job_runs (status) VALUES ('running') RETURNING id"
  );
  const jobId = jobResult.rows[0].id;

  const stats = { locations: 0, properties: 0, deals: 0, alerts: 0, errors: [] };

  try {
    // 1. Get all unique locations from active alerts that are due
    const alertsResult = await pool.query(`
      SELECT DISTINCT LOWER(TRIM(location)) AS location
      FROM property_alerts
      WHERE is_active = true
        AND (
          last_alert_sent IS NULL
          OR (alert_frequency = 'daily' AND last_alert_sent < NOW() - INTERVAL '24 hours')
          OR (alert_frequency = 'instant' AND last_alert_sent < NOW() - INTERVAL '50 minutes')
          OR (alert_frequency = 'immediate' AND last_alert_sent < NOW() - INTERVAL '50 minutes')
          OR (alert_frequency = 'weekly' AND last_alert_sent < NOW() - INTERVAL '7 days')
        )
    `);

    const locations = alertsResult.rows.map(r => r.location);
    console.log(`Found ${locations.length} unique locations to search\n`);
    stats.locations = locations.length;

    // 2. For each unique location: search + enrich + cache
    for (const location of locations) {
      try {
        // Resolve state abbreviations to full names for Zillow search
        const searchLocation = resolveSearchLocation(location);
        console.log(`--- Searching: ${location}${searchLocation !== location ? ` (→ ${searchLocation})` : ''} ---`);

        // Search Zillow (multiple pages)
        let allListings = [];
        const firstPage = await searchZillow(searchLocation);
        const totalPages = Math.min(firstPage?.data?.total_pages || 1, MAX_PAGES_PER_LOCATION);
        const firstListings = (firstPage?.data?.listings || []).filter(p => p.price > 0);
        allListings.push(...firstListings);

        for (let page = 2; page <= totalPages; page++) {
          try {
            const pageData = await searchZillow(searchLocation, page);
            const listings = (pageData?.data?.listings || []).filter(p => p.price > 0);
            allListings.push(...listings);
          } catch (err) {
            console.warn(`  Page ${page} failed: ${err.message}`);
          }
        }

        console.log(`  ${allListings.length} properties with price across ${totalPages} pages`);
        stats.properties += allListings.length;

        // Enrich with zestimates (only those we don't already have cached)
        const cachedResult = await pool.query(
          'SELECT zpid, zestimate FROM property_search_cache WHERE location = $1 AND zestimate IS NOT NULL',
          [location]
        );
        const cachedZestimates = new Map(cachedResult.rows.map(r => [r.zpid, r.zestimate]));

        const needsZestimate = allListings.filter(p => !cachedZestimates.has(String(p.zpid)));
        const alreadyCached = allListings.filter(p => cachedZestimates.has(String(p.zpid)));

        console.log(`  ${alreadyCached.length} cached zestimates, ${needsZestimate.length} need fetching`);

        let enriched = [];
        if (needsZestimate.length > 0) {
          enriched = await enrichWithZestimates(needsZestimate);
        }

        // Merge cached + freshly enriched
        const allWithZestimates = [
          ...alreadyCached.map(p => ({
            ...p,
            zestimate: cachedZestimates.get(String(p.zpid)),
          })),
          ...enriched,
        ];

        // Upsert into property_search_cache
        for (const p of allWithZestimates) {
          if (!p.zpid) continue;
          await pool.query(`
            INSERT INTO property_search_cache
              (location, zpid, address, price, zestimate, bedrooms, bathrooms, sqft,
               property_type, days_on_market, listing_url, image_url, last_seen_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW())
            ON CONFLICT (location, zpid) DO UPDATE SET
              price = EXCLUDED.price,
              zestimate = COALESCE(EXCLUDED.zestimate, property_search_cache.zestimate),
              days_on_market = EXCLUDED.days_on_market,
              last_seen_at = NOW()
          `, [
            location,
            String(p.zpid),
            p.address ? `${p.address}, ${p.city || ''}, ${p.state || ''} ${p.zipcode || ''}`.trim() : null,
            p.price || null,
            p.zestimate || null,
            p.bedrooms || null,
            p.bathrooms || null,
            p.living_area_sqft || p.sqft || null,
            p.home_type || p.property_type || null,
            p.days_on_zillow || p.days_on_market || null,
            p.detail_url || null,
            p.image_url || null,
          ]);
        }

        const dealsInLocation = allWithZestimates.filter(
          p => p.price && p.zestimate && (p.zestimate - p.price) >= MIN_SPREAD_DEFAULT
        );
        console.log(`  ${dealsInLocation.length} deals with +$30K spread\n`);
        stats.deals += dealsInLocation.length;

      } catch (err) {
        console.error(`  ERROR searching ${location}: ${err.message}`);
        stats.errors.push(`${location}: ${err.message}`);
      }
    }

    // 3. For each alert: find new deals from cache and send email + optional SMS
    const dueAlerts = await pool.query(`
      SELECT pa.*, u.email, u.full_name
      FROM property_alerts pa
      JOIN users u ON pa.user_id = u.id
      WHERE pa.is_active = true
        AND (
          pa.last_alert_sent IS NULL
          OR (pa.alert_frequency = 'daily' AND pa.last_alert_sent < NOW() - INTERVAL '24 hours')
          OR (pa.alert_frequency = 'instant' AND pa.last_alert_sent < NOW() - INTERVAL '6 hours')
          OR (pa.alert_frequency = 'immediate' AND pa.last_alert_sent < NOW() - INTERVAL '6 hours')
          OR (pa.alert_frequency = 'weekly' AND pa.last_alert_sent < NOW() - INTERVAL '7 days')
        )
    `);

    console.log(`\n=== Processing ${dueAlerts.rows.length} alerts ===\n`);

    for (const alert of dueAlerts.rows) {
      try {
        const minSpread = alert.min_spread || MIN_SPREAD_DEFAULT;
        const loc = alert.location.toLowerCase().trim();

        // Find deals from cache that match this alert's criteria and haven't been sent
        let dealQuery = `
          SELECT c.*
          FROM property_search_cache c
          WHERE LOWER(TRIM(c.location)) = $1
            AND c.spread >= $2
            AND c.price > 0
            AND c.zestimate > 0
            AND c.zpid NOT IN (
              SELECT zpid FROM alert_sent_deals WHERE alert_id = $3
            )
        `;
        const dealParams = [loc, minSpread, alert.id];
        let paramIdx = 4;

        if (alert.max_price) {
          dealQuery += ` AND c.price <= $${paramIdx}`;
          dealParams.push(alert.max_price);
          paramIdx++;
        }
        if (alert.min_bedrooms) {
          dealQuery += ` AND c.bedrooms >= $${paramIdx}`;
          dealParams.push(alert.min_bedrooms);
          paramIdx++;
        }

        dealQuery += ' ORDER BY c.spread DESC LIMIT 10';

        const deals = await pool.query(dealQuery, dealParams);

        if (deals.rows.length === 0) {
          console.log(`  Alert ${alert.id} (${alert.location}): No new deals`);
          continue;
        }

        const userEmail = alert.email;
        console.log(`  Alert ${alert.id} (${alert.location}): ${deals.rows.length} new deals for ${userEmail}`);

        let emailSent = false;
        // SMS is intentionally disabled — Twilio credentials are not active and
        // the SMS UI was removed from the product. Keeping the phone_number
        // column + sendSMS() helper in place so we can re-enable later without
        // a schema migration. For now, alerts ship via email only.
        //
        // Contract: this `smsSent = false` hardcode is the single
        // reversible-disable layer for the email-only-alerts decision shipped
        // in #374 + #378. The per-request user-initiated SMS path (client
        // method + server route + rate-limit bucket) was removed in #378. Do
        // NOT remove this hardcode without first re-establishing one of those
        // paths AND validating Twilio credentials in env. The regression
        // guard at aiwholesail-api/test/routes/communications-no-spread-alert-sms.test.js
        // asserts both halves of this contract (the hardcode is present;
        // the per-request path is gone).
        const smsSent = false;

        // Always send email alert
        try {
          await sendAlertEmail(userEmail, alert.location, deals.rows, { fullName: alert.full_name });
          emailSent = true;
          console.log(`    Email sent to ${userEmail}`);
        } catch (emailErr) {
          console.error(`    Failed to send email to ${userEmail}: ${emailErr.message}`);
          stats.errors.push(`email to ${userEmail}: ${emailErr.message}`);
        }

        if (emailSent) {
          stats.alerts++;
        }

        // Log sent deals (dedup)
        for (const deal of deals.rows) {
          await pool.query(
            'INSERT INTO alert_sent_deals (alert_id, zpid, spread) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
            [alert.id, deal.zpid, deal.spread]
          );
        }

        // Update last_alert_sent
        await pool.query(
          'UPDATE property_alerts SET last_alert_sent = NOW() WHERE id = $1',
          [alert.id]
        );

        // Log match.
        // property_id is NOT NULL on the underlying table (migration 001) and
        // serves as the durable per-property key. We use the Zillow zpid as
        // the canonical id — same value the worker already stores in
        // alert_sent_deals. Prior insert omitted this column, causing every
        // match row to fail with a not-null constraint violation (the email
        // still went out, but the audit trail was silently dropped).
        for (const deal of deals.rows) {
          await pool.query(`
            INSERT INTO property_alert_matches (alert_id, property_id, zpid, property_data, matched_at, sms_sent, email_sent)
            VALUES ($1, $2, $3, $4, NOW(), $5, $6)
            ON CONFLICT DO NOTHING
          `, [alert.id, String(deal.zpid), deal.zpid, JSON.stringify(deal), smsSent, emailSent]);
        }

        // Webhook dispatch (Pro/Elite feature) — fire-and-forget.
        // Payload mirrors the alert email shape so subscribers can render
        // the same info in their CRM / workflow tool without a second API call.
        try {
          const { dispatchEvent, WEBHOOK_EVENTS } = require('../lib/webhooks');
          dispatchEvent(alert.user_id, WEBHOOK_EVENTS.PROPERTY_ALERT_MATCH, {
            alert: {
              id: alert.id,
              location: alert.location,
              min_spread: minSpread,
              frequency: alert.alert_frequency,
            },
            matches: deals.rows.map(d => ({
              zpid: d.zpid,
              address: d.address,
              price: d.price,
              zestimate: d.zestimate,
              spread: d.spread,
              url: d.zpid ? `https://www.zillow.com/homedetails/${d.zpid}_zpid/` : null,
            })),
            match_count: deals.rows.length,
          });
        } catch (whErr) {
          console.error(`  [webhooks] dispatch error for alert ${alert.id}: ${whErr.message}`);
        }

      } catch (err) {
        console.error(`  ERROR processing alert ${alert.id}: ${err.message}`);
        stats.errors.push(`alert ${alert.id}: ${err.message}`);
      }
    }

    // 4. Cleanup: remove cache entries not seen in 7 days
    await pool.query("DELETE FROM property_search_cache WHERE last_seen_at < NOW() - INTERVAL '7 days'");

  } catch (err) {
    console.error('FATAL:', err);
    stats.errors.push(`FATAL: ${err.message}`);
  }

  // Update job record
  await pool.query(`
    UPDATE alert_job_runs SET
      completed_at = NOW(),
      locations_searched = $2,
      properties_found = $3,
      deals_found = $4,
      alerts_sent = $5,
      errors = $6,
      status = $7
    WHERE id = $1
  `, [
    jobId,
    stats.locations,
    stats.properties,
    stats.deals,
    stats.alerts,
    stats.errors.length > 0 ? stats.errors : null,
    stats.errors.length > 0 ? 'completed_with_errors' : 'completed',
  ]);

  console.log(`\n=== Worker complete ===`);
  console.log(`Locations: ${stats.locations} | Properties: ${stats.properties} | Deals: ${stats.deals} | Alerts sent: ${stats.alerts}`);
  if (stats.errors.length > 0) console.log(`Errors: ${stats.errors.length}`);

  await pool.end();
}

run().catch(err => {
  console.error('Worker crashed:', err);
  process.exit(1);
});
