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
const resend = new Resend(process.env.RESEND_API_KEY);

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const DRY_RUN = process.argv.includes('--dry-run');

// Use the same Zillow API proxy that the frontend uses (localhost:3200)
// This gives us: same search params, batch zestimates, 24h in-memory cache
const ZILLOW_PROXY_URL = process.env.ZILLOW_PROXY_URL || 'http://localhost:3201';
const ZILLOW_API_KEY = process.env.ZILLOW_PROXY_API_KEY || 'aiwholesail_zillow_2026';

// Twilio config
const TWILIO_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_FROM = process.env.TWILIO_PHONE_NUMBER;

const MAX_PAGES_PER_LOCATION = 5;
const ZESTIMATE_BATCH_SIZE = 25; // Match frontend batch size for Hetzner
const MIN_SPREAD_DEFAULT = 30000;

// Map user-facing property type names → all Zillow property_type values that could appear in cache.
// Zillow API returns types like SINGLE_FAMILY, TOWNHOUSE, MULTI_FAMILY, CONDO, etc.
// We match case-insensitively against the cache's property_type column.
const PROPERTY_TYPE_MAP = {
  'houses': ['house', 'single_family', 'singlefamily'],
  'house': ['house', 'single_family', 'singlefamily'],
  'townhomes': ['townhouse', 'townhome'],
  'townhouse': ['townhouse', 'townhome'],
  'multi-family': ['multi-family', 'multi_family', 'multifamily'],
  'condos/co-ops': ['condo', 'condominium', 'co-op', 'coop'],
  'condos': ['condo', 'condominium'],
  'condo': ['condo', 'condominium'],
  'apartments': ['apartment'],
  'apartment': ['apartment'],
  'lots/land': ['lot-land', 'lot', 'land', 'vacant_land'],
  'manufactured': ['manufactured', 'mobile'],
};

// ---------- Zillow API helpers (via proxy — same as frontend) ----------

/**
 * Search Zillow via the proxy, matching the exact same API call the frontend makes.
 * Passes all user filters: homeType, price range, bedrooms, bathrooms.
 */
async function searchZillow(location, page = 1, filters = {}) {
  const searchParams = {
    location,
    page: String(page),
  };

  // Pass user filters — same keys the proxy expects
  if (filters.homeType) searchParams.homeType = filters.homeType;
  if (filters.price_min) searchParams.price_min = String(filters.price_min);
  if (filters.price_max) searchParams.price_max = String(filters.price_max);
  if (filters.bed_min) searchParams.bed_min = String(filters.bed_min);
  if (filters.bathrooms) searchParams.bathrooms = String(filters.bathrooms);

  const response = await axios.post(`${ZILLOW_PROXY_URL}/zillow`, {
    action: 'search',
    searchParams,
  }, {
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ZILLOW_API_KEY,
    },
    timeout: 30000,
  });
  return response.data;
}

/**
 * Batch zestimate endpoint — same as the frontend uses.
 * Leverages the proxy's 24h in-memory cache for already-fetched zpids.
 */
async function batchZestimates(zpids) {
  const response = await axios.post(`${ZILLOW_PROXY_URL}/batch-zestimates`, {
    zpids,
  }, {
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ZILLOW_API_KEY,
    },
    timeout: 120000, // batch can take a while
  });
  return response.data;
}

/**
 * Enrich properties with zestimates using the batch endpoint.
 * Chunks in groups of ZESTIMATE_BATCH_SIZE, same as frontend.
 */
async function enrichWithZestimates(properties) {
  const zpids = properties
    .map(p => String(p.zpid))
    .filter(zpid => zpid && zpid.length >= 5);

  if (zpids.length === 0) return properties;

  const allZestimates = {};

  for (let i = 0; i < zpids.length; i += ZESTIMATE_BATCH_SIZE) {
    const chunk = zpids.slice(i, i + ZESTIMATE_BATCH_SIZE);
    try {
      const result = await batchZestimates(chunk);
      if (result.success && result.data) {
        Object.assign(allZestimates, result.data);
      }
      const hits = Object.values(result.data || {}).filter(v => v !== null && v > 0).length;
      console.log(`  Zestimates: ${Math.min(i + chunk.length, zpids.length)}/${zpids.length} (${hits} found in batch, ${result.stats?.cached || 0} cached)`);
    } catch (err) {
      console.warn(`  Zestimate batch failed: ${err.message}`);
      // Mark all in chunk as null
      for (const zpid of chunk) allZestimates[zpid] = null;
    }
  }

  // Merge zestimates back into properties
  return properties.map(p => {
    const zpid = String(p.zpid);
    const zest = allZestimates[zpid];
    if (zest !== undefined && zest !== null && zest > 0) {
      return { ...p, zestimate: zest };
    }
    return p;
  });
}

/**
 * Extract listings from Zillow API response, handling various response formats.
 * Same logic as the frontend's processPropertyData().
 */
function extractListings(responseData) {
  const data = responseData?.data || responseData;
  if (!data) return [];

  // Check for no results
  if (data.message === '404: No results' || data.total_results === 0) return [];

  // Try different keys (same as frontend)
  const keys = ['searchResults', 'props', 'results', 'listings', 'properties', 'data', 'homes',
    'mapResults', 'listResults', 'items', 'records'];

  for (const key of keys) {
    if (data[key] && Array.isArray(data[key])) return data[key];
    if (data[key] && typeof data[key] === 'object') {
      for (const nested of keys) {
        if (data[key][nested] && Array.isArray(data[key][nested])) return data[key][nested];
      }
    }
  }
  return [];
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

async function sendAlertEmail(userEmail, location, deals) {
  // Calculate total spread across all deals
  const totalSpread = deals.reduce((sum, d) => {
    return sum + ((d.zestimate && d.price) ? (d.zestimate - d.price) : 0);
  }, 0);
  const totalSpreadFormatted = `$${Math.round(totalSpread / 1000)}K`;

  // Time since deals were found
  const minutesAgo = Math.max(1, Math.round((Date.now() - new Date(deals[0].last_seen_at || Date.now()).getTime()) / 60000));
  const timeAgoText = minutesAgo < 60 ? `${minutesAgo} minute${minutesAgo > 1 ? 's' : ''} ago` : `${Math.round(minutesAgo / 60)} hour${Math.round(minutesAgo / 60) > 1 ? 's' : ''} ago`;

  const dealCards = deals.map((d) => {
    const addr = d.address || 'Unknown';
    const listPrice = d.price ? `$${Number(d.price).toLocaleString()}` : 'N/A';
    const zestimate = d.zestimate ? `$${Number(d.zestimate).toLocaleString()}` : 'N/A';
    const spreadVal = (d.zestimate && d.price) ? (d.zestimate - d.price) : 0;
    const spreadText = spreadVal > 0 ? `+$${Number(spreadVal).toLocaleString()}` : 'N/A';
    const spreadPct = (d.price && d.zestimate) ? Math.round(((d.zestimate - d.price) / d.price) * 100) : 0;

    const specs = [];
    if (d.bedrooms) specs.push(`${d.bedrooms} Bed`);
    if (d.bathrooms) specs.push(`${d.bathrooms} Bath`);
    if (d.sqft) specs.push(`${Number(d.sqft).toLocaleString()} sqft`);
    const specsText = specs.length > 0 ? specs.join('&nbsp;&nbsp;&middot;&nbsp;&nbsp;') : '';

    const daysText = d.days_on_market ? `${d.days_on_market} days on market` : '';
    const propType = d.property_type || '';
    const listingUrl = d.listing_url || 'https://aiwholesail.com/app';
    const imageUrl = d.image_url || 'https://aiwholesail.com/placeholder-property.png';

    return `
      <!-- Property Card -->
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 16px; border: 1px solid #1f1f23; border-radius: 12px; overflow: hidden; background-color: #111113;">
        <!-- Property Image -->
        ${d.image_url ? `
        <tr><td style="padding: 0; position: relative;">
          <a href="${listingUrl}" style="text-decoration: none;">
            <img src="${imageUrl}" alt="${addr}" width="536" style="width: 100%; height: 180px; object-fit: cover; display: block;" />
          </a>
        </td></tr>
        ` : ''}
        <!-- Card Content -->
        <tr><td style="padding: 20px;">
          <!-- Spread badge -->
          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 12px;">
            <tr>
              <td>
                <table cellpadding="0" cellspacing="0" border="0">
                  <tr><td style="background-color: rgba(34,197,94,0.12); border: 1px solid rgba(34,197,94,0.25); border-radius: 20px; padding: 5px 14px;">
                    <span style="color: #22c55e; font-weight: 800; font-size: 16px; letter-spacing: -0.3px;">${spreadText}</span>
                    <span style="color: #4ade80; font-size: 12px; font-weight: 500; padding-left: 6px;">spread</span>
                  </td></tr>
                </table>
              </td>
              ${spreadPct > 0 ? `<td align="right"><span style="color: #737373; font-size: 12px;">${spreadPct}% upside</span></td>` : ''}
            </tr>
          </table>

          <!-- Address -->
          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 8px;">
            <tr><td>
              <a href="${listingUrl}" style="color: #f5f5f5; font-size: 15px; font-weight: 600; text-decoration: none; line-height: 1.3;">${addr}</a>
            </td></tr>
          </table>

          <!-- Specs row -->
          ${specsText ? `
          <table cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 14px;">
            <tr><td style="color: #737373; font-size: 12px; line-height: 1;">${specsText}${propType ? '&nbsp;&nbsp;&middot;&nbsp;&nbsp;' + propType : ''}</td></tr>
          </table>
          ` : ''}

          <!-- Price boxes -->
          <table width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td width="48%" style="background-color: #0a0a0b; border: 1px solid #1a1a1a; border-radius: 8px; padding: 12px 14px;">
                <table cellpadding="0" cellspacing="0" border="0">
                  <tr><td style="color: #525252; font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.08em; padding-bottom: 4px;">List Price</td></tr>
                  <tr><td style="color: #e5e5e5; font-size: 18px; font-weight: 700; letter-spacing: -0.5px;">${listPrice}</td></tr>
                </table>
              </td>
              <td width="4%">&nbsp;</td>
              <td width="48%" style="background-color: #0a0a0b; border: 1px solid #1a1a1a; border-radius: 8px; padding: 12px 14px;">
                <table cellpadding="0" cellspacing="0" border="0">
                  <tr><td style="color: #525252; font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.08em; padding-bottom: 4px;">Zestimate</td></tr>
                  <tr><td style="color: #06b6d4; font-size: 18px; font-weight: 700; letter-spacing: -0.5px;">${zestimate}</td></tr>
                </table>
              </td>
            </tr>
          </table>

          ${daysText ? `
          <!-- Days on market -->
          <table cellpadding="0" cellspacing="0" border="0" style="margin-top: 10px;">
            <tr><td style="color: #525252; font-size: 11px;">${daysText}</td></tr>
          </table>
          ` : ''}
        </td></tr>

        <!-- View Deal button -->
        <tr><td style="padding: 0 20px 18px;">
          <table width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr><td align="center" style="background-color: #171719; border: 1px solid #1f1f23; border-radius: 8px; padding: 10px 0;">
              <a href="${listingUrl}" style="color: #06b6d4; font-size: 13px; font-weight: 600; text-decoration: none; display: block;">View Deal &rarr;</a>
            </td></tr>
          </table>
        </td></tr>
      </table>
    `;
  }).join('');

  const subject = `${deals.length} New Deal${deals.length > 1 ? 's' : ''} in ${location} — AIWholesail`;
  const html = `
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #000000; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
      <tr><td align="center" style="padding: 40px 20px;">
        <!--[if mso]><table width="600" cellpadding="0" cellspacing="0" border="0"><tr><td><![endif]-->
        <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width: 600px; width: 100%; background-color: #0a0a0b; border-radius: 12px; overflow: hidden; border: 1px solid #1a1a1a;">

          <!-- Logo header -->
          <tr><td style="padding: 28px 32px 20px; border-bottom: 1px solid #1a1a1a;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td><img src="https://aiwholesail.com/logo-white.png" alt="AIWholesail" height="32" style="height: 32px; width: auto; display: block;" /></td>
                <td align="right" style="color: #525252; font-size: 12px;">Deals found ${timeAgoText}</td>
              </tr>
            </table>
          </td></tr>

          <!-- Gradient accent bar -->
          <tr><td style="height: 3px; background: linear-gradient(90deg, #22c55e, #06b6d4, #22c55e); font-size: 0; line-height: 0;">&nbsp;</td></tr>

          <!-- Hero stat -->
          <tr><td style="padding: 32px 32px 0;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #111111; border: 1px solid #1a1a1a; border-radius: 10px; overflow: hidden;">
              <tr><td style="padding: 24px 28px;">
                <table width="100%" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td>
                      <table cellpadding="0" cellspacing="0" border="0">
                        <tr><td style="color: #525252; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.1em; padding-bottom: 6px;">Total Potential Spread</td></tr>
                        <tr><td style="color: #22c55e; font-size: 32px; font-weight: 800; letter-spacing: -1px; line-height: 1;">${totalSpreadFormatted}</td></tr>
                      </table>
                    </td>
                    <td align="right" valign="bottom">
                      <table cellpadding="0" cellspacing="0" border="0">
                        <tr><td style="color: #737373; font-size: 13px; text-align: right;">across <strong style="color: #e5e5e5;">${deals.length} deal${deals.length > 1 ? 's' : ''}</strong></td></tr>
                        <tr><td style="color: #737373; font-size: 13px; text-align: right; padding-top: 2px;">in <strong style="color: #e5e5e5;">${location}</strong></td></tr>
                      </table>
                    </td>
                  </tr>
                </table>
              </td></tr>
            </table>
          </td></tr>

          <!-- Content -->
          <tr><td style="padding: 28px 32px 36px;">

            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 8px;">
              <tr><td style="color: #ffffff; font-size: 22px; font-weight: 700; letter-spacing: -0.5px; line-height: 1.2; padding-bottom: 8px;">
                ${deals.length} New Deal${deals.length > 1 ? 's' : ''} Found
              </td></tr>
              <tr><td style="color: #a3a3a3; font-size: 15px; line-height: 1.6; padding-bottom: 24px;">
                Properties with <strong style="color: #ffffff;">+$30K spread</strong> between list price and Zestimate in <strong style="color: #ffffff;">${location}</strong>.
              </td></tr>
            </table>

            <!-- Property Cards -->
            ${dealCards}

            <!-- CTA Button -->
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 28px;">
              <tr><td align="center">
                <table cellpadding="0" cellspacing="0" border="0">
                  <tr><td style="background-color: #06b6d4; border-radius: 8px; padding: 16px 44px; box-shadow: 0 2px 8px rgba(6,182,212,0.25);">
                    <a href="https://aiwholesail.com/app" style="color: #000000; font-weight: 700; font-size: 16px; text-decoration: none; display: inline-block;">View All Deals in ${location}</a>
                  </td></tr>
                </table>
              </td></tr>
            </table>

            <table width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr><td style="color: #525252; font-size: 13px; line-height: 1.5; text-align: center;">
                You're receiving this because you have an alert set for ${location}.<br/>
                <a href="https://aiwholesail.com/app/account" style="color: #525252; text-decoration: underline;">Manage alert preferences</a>
              </td></tr>
            </table>

          </td></tr>

          <!-- Footer -->
          <tr><td style="padding: 20px 32px 24px; border-top: 1px solid #1a1a1a;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="color: #404040; font-size: 11px; line-height: 1.5;">
                  &copy; 2026 AIWholesail &middot; <a href="https://aiwholesail.com" style="color: #06b6d4; text-decoration: none;">aiwholesail.com</a>
                </td>
                <td align="right" style="color: #404040; font-size: 11px;">
                  <a href="https://aiwholesail.com/app/account" style="color: #404040; text-decoration: none;">Unsubscribe</a>
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
  return result;
}

// ---------- Main worker ----------

// ---------- Price Drop Email ----------

async function sendPriceDropEmail(userEmail, location, drops) {
  const subject = `${drops.length} Price Drop${drops.length > 1 ? 's' : ''} in ${location} — AIWholesail`;

  const dropCards = drops.map(d => {
    const dropPct = d.drop_percent ? `${d.drop_percent}%` : '';
    return `
      <tr><td style="padding: 12px 16px; border-bottom: 1px solid #1a1a1a;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td style="color: #e5e5e5; font-size: 14px; font-weight: 500; padding-bottom: 6px;">${d.address || 'Unknown'}</td>
          </tr>
          <tr><td>
            <table cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="color: #737373; font-size: 13px; text-decoration: line-through; padding-right: 12px;">$${Number(d.old_price).toLocaleString()}</td>
                <td style="color: #22c55e; font-size: 15px; font-weight: 700; padding-right: 12px;">$${Number(d.new_price).toLocaleString()}</td>
                <td><span style="background-color: rgba(239,68,68,0.1); border: 1px solid rgba(239,68,68,0.2); border-radius: 12px; padding: 2px 10px; color: #ef4444; font-weight: 600; font-size: 12px;">-$${Number(d.drop_amount).toLocaleString()} ${dropPct ? `(${dropPct})` : ''}</span></td>
              </tr>
            </table>
          </td></tr>
        </table>
      </td></tr>
    `;
  }).join('');

  const html = `
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #000000; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
      <tr><td align="center" style="padding: 40px 20px;">
        <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width: 600px; width: 100%; background-color: #0a0a0b; border-radius: 12px; overflow: hidden; border: 1px solid #1a1a1a;">
          <tr><td style="padding: 28px 32px 20px; border-bottom: 1px solid #1a1a1a;">
            <img src="https://aiwholesail.com/logo-white.png" alt="AIWholesail" height="32" style="height: 32px; width: auto;" />
          </td></tr>
          <tr><td style="height: 3px; background: linear-gradient(90deg, #ef4444, #f97316, #ef4444); font-size: 0;">&nbsp;</td></tr>
          <tr><td style="padding: 28px 32px;">
            <table cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 6px;">
              <tr><td style="background-color: rgba(239,68,68,0.1); border: 1px solid rgba(239,68,68,0.2); border-radius: 20px; padding: 4px 12px; color: #ef4444; font-size: 12px; font-weight: 600;">PRICE DROP</td></tr>
            </table>
            <h1 style="color: #ffffff; font-size: 22px; font-weight: 700; margin: 12px 0 8px;">${drops.length} Price Drop${drops.length > 1 ? 's' : ''} in ${location}</h1>
            <p style="color: #a3a3a3; font-size: 14px; margin: 0 0 24px;">These properties just dropped in price — could be new deal opportunities.</p>
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border: 1px solid #1a1a1a; border-radius: 8px; overflow: hidden; background-color: #111113;">
              ${dropCards}
            </table>
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top: 24px;">
              <tr><td align="center">
                <a href="https://aiwholesail.com/app" style="background-color: #06b6d4; border-radius: 8px; padding: 14px 40px; color: #000; font-weight: 700; font-size: 15px; text-decoration: none; display: inline-block;">Search These Deals</a>
              </td></tr>
            </table>
          </td></tr>
          <tr><td style="padding: 16px 32px; border-top: 1px solid #1a1a1a; color: #404040; font-size: 11px;">
            &copy; 2026 AIWholesail &middot; <a href="https://aiwholesail.com/app/notifications" style="color: #404040;">Manage notifications</a>
          </td></tr>
        </table>
      </td></tr>
    </table>
  `;

  const result = await resend.emails.send({
    from: 'AIWholesail Alerts <alerts@aiwholesail.com>',
    to: userEmail,
    subject,
    html,
  });
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
    // 1. Get all due alerts with user preferences
    const dueAlerts = await pool.query(`
      SELECT pa.*, u.email
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

    if (dueAlerts.rows.length === 0) {
      console.log('No alerts due. Exiting.\n');
    }

    // Deduplicate by location: one Zillow search per unique location, filter per alert later.
    // This is efficient — 1000 users watching "Detroit, MI" = 1 API call.
    // User-specific filters (price, beds, types) are applied at the deal-query stage.
    const uniqueLocations = [...new Set(dueAlerts.rows.map(a => a.location.toLowerCase().trim()))];

    console.log(`Found ${dueAlerts.rows.length} alerts across ${uniqueLocations.length} unique locations\n`);
    stats.locations = uniqueLocations.length;

    // 2. For each unique location: search + enrich + cache (via proxy — same as app)
    for (const location of uniqueLocations) {
      try {
        console.log(`--- Searching: ${location} ---`);

        // Search via proxy (same endpoint the frontend uses)
        // No homeType filter — fetch ALL property types, filter per-alert later
        let allListings = [];
        const firstPage = await searchZillow(location, 1);
        const responseData = firstPage?.data || firstPage;
        const totalPages = Math.min(responseData?.total_pages || 1, MAX_PAGES_PER_LOCATION);

        const firstListings = extractListings(firstPage).filter(p => p.price > 0);
        allListings.push(...firstListings);

        // Fetch remaining pages in parallel (same as frontend)
        if (totalPages > 1) {
          const pagePromises = [];
          for (let page = 2; page <= totalPages; page++) {
            pagePromises.push(
              searchZillow(location, page)
                .then(data => extractListings(data).filter(p => p.price > 0))
                .catch(err => {
                  console.warn(`  Page ${page} failed: ${err.message}`);
                  return [];
                })
            );
          }
          const pageResults = await Promise.allSettled(pagePromises);
          for (const result of pageResults) {
            if (result.status === 'fulfilled') allListings.push(...result.value);
          }
        }

        // Deduplicate by zpid
        const seen = new Set();
        allListings = allListings.filter(p => {
          const zpid = String(p.zpid);
          if (!zpid || seen.has(zpid)) return false;
          seen.add(zpid);
          return true;
        });

        console.log(`  ${allListings.length} properties with price across ${totalPages} pages`);
        stats.properties += allListings.length;

        // Check DB cache for existing zestimates
        const cachedResult = await pool.query(
          'SELECT zpid, zestimate FROM property_search_cache WHERE location = $1 AND zestimate IS NOT NULL',
          [location]
        );
        const cachedZestimates = new Map(cachedResult.rows.map(r => [r.zpid, r.zestimate]));

        const needsZestimate = allListings.filter(p => !cachedZestimates.has(String(p.zpid)));
        const alreadyCached = allListings.filter(p => cachedZestimates.has(String(p.zpid)));

        console.log(`  ${alreadyCached.length} DB-cached zestimates, ${needsZestimate.length} need fetching`);

        // Enrich via batch endpoint (leverages proxy's 24h in-memory cache)
        let enriched = [];
        if (needsZestimate.length > 0) {
          enriched = await enrichWithZestimates(needsZestimate);
        }

        // Merge DB-cached + freshly enriched
        const allWithZestimates = [
          ...alreadyCached.map(p => ({
            ...p,
            zestimate: cachedZestimates.get(String(p.zpid)),
          })),
          ...enriched,
        ];

        // Detect price drops: compare new prices against cached prices
        let priceDropCount = 0;
        const cachedPrices = new Map();
        const priceResult = await pool.query(
          'SELECT zpid, price, address FROM property_search_cache WHERE location = $1 AND price > 0',
          [location]
        );
        for (const row of priceResult.rows) {
          cachedPrices.set(row.zpid, { price: row.price, address: row.address });
        }

        for (const p of allWithZestimates) {
          if (!p.zpid || !p.price) continue;
          const cached = cachedPrices.get(String(p.zpid));
          if (cached && cached.price > p.price) {
            const dropAmount = cached.price - p.price;
            const dropPercent = ((dropAmount / cached.price) * 100).toFixed(2);
            // Only log meaningful drops (>$1K and >1%)
            if (dropAmount >= 1000 && parseFloat(dropPercent) >= 1) {
              priceDropCount++;
              await pool.query(`
                INSERT INTO price_drop_log (zpid, location, address, old_price, new_price, drop_amount, drop_percent)
                VALUES ($1, $2, $3, $4, $5, $6, $7)
              `, [String(p.zpid), location, cached.address || p.address, cached.price, p.price, dropAmount, dropPercent]);
            }
          }
        }
        if (priceDropCount > 0) {
          console.log(`  ${priceDropCount} price drops detected`);
        }

        // Upsert into property_search_cache (spread is GENERATED ALWAYS — never insert it)
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
              bedrooms = COALESCE(EXCLUDED.bedrooms, property_search_cache.bedrooms),
              bathrooms = COALESCE(EXCLUDED.bathrooms, property_search_cache.bathrooms),
              sqft = COALESCE(EXCLUDED.sqft, property_search_cache.sqft),
              property_type = COALESCE(EXCLUDED.property_type, property_search_cache.property_type),
              days_on_market = EXCLUDED.days_on_market,
              image_url = COALESCE(EXCLUDED.image_url, property_search_cache.image_url),
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
        if (alert.min_bathrooms) {
          dealQuery += ` AND c.bathrooms >= $${paramIdx}`;
          dealParams.push(alert.min_bathrooms);
          paramIdx++;
        }

        // Filter by property type if the alert specifies types
        if (alert.property_types && Array.isArray(alert.property_types) && alert.property_types.length > 0) {
          // Map user-facing names to all possible Zillow property_type values stored in cache
          const typeValues = [];
          for (const t of alert.property_types) {
            const mapped = PROPERTY_TYPE_MAP[t.toLowerCase()];
            if (mapped) typeValues.push(...mapped);
          }
          if (typeValues.length > 0) {
            dealQuery += ` AND LOWER(c.property_type) = ANY($${paramIdx})`;
            dealParams.push(typeValues);
            paramIdx++;
          }
        }

        dealQuery += ' ORDER BY c.spread DESC LIMIT 10';

        const deals = await pool.query(dealQuery, dealParams);

        if (deals.rows.length === 0) {
          console.log(`  Alert ${alert.id} (${alert.location}): No new deals`);
          continue;
        }

        const userEmail = alert.email;
        console.log(`  Alert ${alert.id} (${alert.location}): ${deals.rows.length} new deals for ${userEmail}${alert.phone_number ? ` + SMS to ${alert.phone_number}` : ''}`);

        let emailSent = false;
        let smsSent = false;

        // Always send email alert
        try {
          await sendAlertEmail(userEmail, alert.location, deals.rows);
          emailSent = true;
          console.log(`    Email sent to ${userEmail}`);
        } catch (emailErr) {
          console.error(`    Failed to send email to ${userEmail}: ${emailErr.message}`);
          stats.errors.push(`email to ${userEmail}: ${emailErr.message}`);
        }

        // Send SMS if phone number exists (optional)
        if (alert.phone_number) {
          try {
            const topDeals = deals.rows.slice(0, 3);
            const dealLines = topDeals.map(d =>
              `${d.address || 'Unknown'}: $${(d.price / 1000).toFixed(0)}K list / $${(d.zestimate / 1000).toFixed(0)}K Zest = +$${(d.spread / 1000).toFixed(0)}K`
            );

            const smsBody = [
              `AIWholesail Alert!`,
              `${deals.rows.length} new +$${(minSpread / 1000).toFixed(0)}K spread deals in ${alert.location}:`,
              '',
              ...dealLines,
              deals.rows.length > 3 ? `...and ${deals.rows.length - 3} more` : '',
              '',
              'aiwholesail.com/app',
            ].filter(Boolean).join('\n');

            await sendSMS(alert.phone_number, smsBody);
            smsSent = true;
            console.log(`    SMS sent to ${alert.phone_number}`);
          } catch (smsErr) {
            console.error(`    Failed to send SMS to ${alert.phone_number}: ${smsErr.message}`);
            stats.errors.push(`sms to ${alert.phone_number}: ${smsErr.message}`);
          }
        }

        if (emailSent || smsSent) {
          stats.alerts++;
        }

        // Only persist to DB if NOT dry-run (dry-run should have no side effects)
        if (!DRY_RUN) {
          // Log sent deals (dedup — prevents re-sending on next run)
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

          // Log match
          for (const deal of deals.rows) {
            await pool.query(`
              INSERT INTO property_alert_matches (alert_id, property_id, zpid, property_data, matched_at, sms_sent, email_sent)
              VALUES ($1, $2, $2, $3, NOW(), $4, $5)
              ON CONFLICT DO NOTHING
            `, [alert.id, deal.zpid || 'unknown', JSON.stringify(deal), smsSent, emailSent]);
          }
        }

      } catch (err) {
        console.error(`  ERROR processing alert ${alert.id}: ${err.message}`);
        stats.errors.push(`alert ${alert.id}: ${err.message}`);
      }
    }

    // 4. Send price drop notifications to users who have price_drops_enabled
    const recentDrops = await pool.query(`
      SELECT pdl.* FROM price_drop_log pdl
      WHERE pdl.detected_at > NOW() - INTERVAL '24 hours'
      ORDER BY pdl.drop_amount DESC
      LIMIT 50
    `);

    if (recentDrops.rows.length > 0) {
      console.log(`\n=== ${recentDrops.rows.length} recent price drops to notify ===`);

      // Find users with price_drops_enabled who have alerts in these locations
      const dropLocations = [...new Set(recentDrops.rows.map(d => d.location))];
      for (const dropLoc of dropLocations) {
        const dropsInLoc = recentDrops.rows.filter(d => d.location === dropLoc);

        // Find users who: have active alerts in this location AND have price drops enabled
        const usersToNotify = await pool.query(`
          SELECT DISTINCT u.id, u.email
          FROM users u
          JOIN property_alerts pa ON pa.user_id = u.id
          LEFT JOIN notification_preferences np ON np.user_id = u.id
          WHERE LOWER(TRIM(pa.location)) = $1
            AND pa.is_active = true
            AND COALESCE(np.price_drops_enabled, true) = true
        `, [dropLoc]);

        for (const user of usersToNotify.rows) {
          // Filter out drops this user was already notified about
          const unnotified = dropsInLoc.filter(d =>
            !d.notified_user_ids || !d.notified_user_ids.includes(user.id)
          );
          if (unnotified.length === 0) continue;

          if (!DRY_RUN) {
            try {
              await sendPriceDropEmail(user.email, dropLoc, unnotified);
              console.log(`  Price drop email sent to ${user.email} (${unnotified.length} drops in ${dropLoc})`);

              // Mark as notified
              for (const drop of unnotified) {
                await pool.query(
                  'UPDATE price_drop_log SET notified_user_ids = array_append(notified_user_ids, $1) WHERE id = $2',
                  [user.id, drop.id]
                );
              }
            } catch (err) {
              console.error(`  Failed to send price drop email to ${user.email}: ${err.message}`);
            }
          } else {
            console.log(`  [DRY RUN] Would send price drop email to ${user.email} (${unnotified.length} drops in ${dropLoc})`);
          }
        }
      }
    }

    // 5. Cleanup: remove cache entries not seen in 7 days, old price drops > 30 days
    await pool.query("DELETE FROM property_search_cache WHERE last_seen_at < NOW() - INTERVAL '7 days'");
    await pool.query("DELETE FROM price_drop_log WHERE detected_at < NOW() - INTERVAL '30 days'");

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
