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

// Zillow Scraper API config
const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY || process.env.ZILLOW_RAPIDAPI_KEY;
const RAPIDAPI_HOST = 'zillow-scraper-api.p.rapidapi.com';

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

// ---------- Zillow API helpers ----------

async function searchZillow(location, page = 1) {
  const response = await axios.get(`https://${RAPIDAPI_HOST}/zillow/search`, {
    params: {
      location,
      listing_type: 'for_sale',
      home_type: 'house',
      sort: 'newest',
      page: String(page),
    },
    headers: {
      'x-rapidapi-key': RAPIDAPI_KEY,
      'x-rapidapi-host': RAPIDAPI_HOST,
    },
    timeout: 30000,
  });
  return response.data;
}

async function getZestimate(zpid) {
  try {
    const response = await axios.get(`https://${RAPIDAPI_HOST}/zillow/valuation/${zpid}`, {
      headers: {
        'x-rapidapi-key': RAPIDAPI_KEY,
        'x-rapidapi-host': RAPIDAPI_HOST,
      },
      timeout: 15000,
    });
    return response.data?.data?.zestimate || null;
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

async function sendAlertEmail(userEmail, location, deals) {
  const dealRows = deals.map(d => {
    const addr = d.address || 'Unknown';
    const listPrice = d.price ? `$${Number(d.price).toLocaleString()}` : 'N/A';
    const zestimate = d.zestimate ? `$${Number(d.zestimate).toLocaleString()}` : 'N/A';
    const spread = (d.zestimate && d.price) ? `+$${Number(d.zestimate - d.price).toLocaleString()}` : 'N/A';
    return `
      <tr>
        <td style="padding: 12px 10px; border-bottom: 1px solid rgba(255,255,255,0.06); color: #e5e5e5; font-size: 14px;">${addr}</td>
        <td style="padding: 12px 10px; border-bottom: 1px solid rgba(255,255,255,0.06); color: #a3a3a3; text-align: right; font-size: 14px;">${listPrice}</td>
        <td style="padding: 12px 10px; border-bottom: 1px solid rgba(255,255,255,0.06); color: #a3a3a3; text-align: right; font-size: 14px;">${zestimate}</td>
        <td style="padding: 12px 10px; border-bottom: 1px solid rgba(255,255,255,0.06); color: #22c55e; font-weight: 600; text-align: right; font-size: 14px;">${spread}</td>
      </tr>
    `;
  }).join('');

  const subject = `${deals.length} New Deal${deals.length > 1 ? 's' : ''} in ${location} — AIWholesail`;
  const html = `
    <div style="font-family: 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #08090a; border-radius: 16px; overflow: hidden; border: 1px solid rgba(255,255,255,0.06);">
      <!--[if mso]><table width="600" cellpadding="0" cellspacing="0" border="0"><tr><td><![endif]-->
      <div style="padding: 32px 32px 24px; border-bottom: 1px solid rgba(255,255,255,0.06);">
        <img src="https://aiwholesail.com/logo-white.png" alt="AIWholesail" style="height: 36px; width: auto;" />
      </div>
      <div style="padding: 32px;">
        <h1 style="color: #ffffff; font-size: 24px; font-weight: 600; margin: 0 0 8px; letter-spacing: -0.5px;">${deals.length} New Deal${deals.length > 1 ? 's' : ''} in ${location}</h1>
        <p style="color: #a3a3a3; font-size: 15px; line-height: 1.6; margin: 0 0 24px;">
          We found <strong style="color: #ffffff;">${deals.length}</strong> propert${deals.length > 1 ? 'ies' : 'y'} with +$30K spread in <strong style="color: #ffffff;">${location}</strong>. Here are the top deals:
        </p>
        <table style="width: 100%; border-collapse: collapse; margin: 0 0 24px;">
          <thead>
            <tr style="border-bottom: 2px solid #06b6d4;">
              <th style="padding: 10px 10px; text-align: left; color: #06b6d4; font-weight: 600; font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em;">Address</th>
              <th style="padding: 10px 10px; text-align: right; color: #06b6d4; font-weight: 600; font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em;">List Price</th>
              <th style="padding: 10px 10px; text-align: right; color: #06b6d4; font-weight: 600; font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em;">Zestimate</th>
              <th style="padding: 10px 10px; text-align: right; color: #06b6d4; font-weight: 600; font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em;">Spread</th>
            </tr>
          </thead>
          <tbody>
            ${dealRows}
          </tbody>
        </table>
        <a href="https://aiwholesail.com/app" style="display: inline-block; background-color: #06b6d4; color: #000000; font-weight: 600; font-size: 15px; padding: 12px 28px; border-radius: 8px; text-decoration: none;">
          View All Deals
        </a>
        <p style="color: #737373; font-size: 13px; margin: 20px 0 0; line-height: 1.5;">
          You're receiving this because you have an alert set for ${location}.
        </p>
      </div>
      <div style="padding: 24px 32px; border-top: 1px solid rgba(255,255,255,0.06); background-color: rgba(255,255,255,0.02);">
        <p style="color: #525252; font-size: 12px; margin: 0; line-height: 1.5;">
          AIWholesail &mdash; Find profitable real estate deals with AI<br/>
          <a href="https://aiwholesail.com" style="color: #06b6d4; text-decoration: none;">aiwholesail.com</a>
        </p>
      </div>
      <!--[if mso]></td></tr></table><![endif]-->
    </div>
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
          OR (alert_frequency = 'instant' AND last_alert_sent < NOW() - INTERVAL '6 hours')
          OR (alert_frequency = 'immediate' AND last_alert_sent < NOW() - INTERVAL '6 hours')
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

        // Log match
        for (const deal of deals.rows) {
          await pool.query(`
            INSERT INTO property_alert_matches (alert_id, property_data, matched_at, sms_sent, email_sent)
            VALUES ($1, $2, NOW(), $3, $4)
            ON CONFLICT DO NOTHING
          `, [alert.id, JSON.stringify(deal), smsSent, emailSent]);
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
