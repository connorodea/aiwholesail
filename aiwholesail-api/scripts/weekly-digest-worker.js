#!/usr/bin/env node
/**
 * Weekly Market Digest Worker
 *
 * Sends a weekly email summary for each user's watched locations.
 * Includes: total deals, avg spread, top deals, price drops, new listings.
 *
 * Designed to run every Monday morning via cron.
 *
 * Usage:
 *   node scripts/weekly-digest-worker.js           # Run once
 *   node scripts/weekly-digest-worker.js --dry-run # Preview without sending
 */

require('dotenv').config();
const { Pool } = require('pg');
const { Resend } = require('resend');
const resend = new Resend(process.env.RESEND_API_KEY);

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const DRY_RUN = process.argv.includes('--dry-run');

async function sendDigestEmail(userEmail, locations) {
  const locationSections = locations.map(loc => {
    const topDealsHtml = loc.topDeals.map(d => `
      <tr><td style="padding: 10px 14px; border-bottom: 1px solid #1a1a1a;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td style="color: #e5e5e5; font-size: 13px;">${d.address || 'Unknown'}</td>
            <td align="right" style="white-space: nowrap;">
              <span style="background-color: rgba(34,197,94,0.1); border: 1px solid rgba(34,197,94,0.2); border-radius: 12px; padding: 2px 10px; color: #22c55e; font-weight: 700; font-size: 12px;">+$${Math.round(d.spread / 1000)}K</span>
            </td>
          </tr>
        </table>
      </td></tr>
    `).join('');

    return `
      <!-- Location Section -->
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 20px; border: 1px solid #1a1a1a; border-radius: 10px; overflow: hidden; background-color: #111113;">
        <tr><td style="padding: 16px 20px; border-bottom: 1px solid #1a1a1a;">
          <span style="color: #ffffff; font-size: 16px; font-weight: 700;">${loc.name}</span>
        </td></tr>

        <!-- Stats row -->
        <tr><td style="padding: 16px 20px;">
          <table width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td width="25%" align="center" style="padding: 8px 0;">
                <div style="color: #22c55e; font-size: 22px; font-weight: 800;">${loc.stats.totalDeals}</div>
                <div style="color: #525252; font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em;">Deals</div>
              </td>
              <td width="25%" align="center" style="padding: 8px 0;">
                <div style="color: #06b6d4; font-size: 22px; font-weight: 800;">$${Math.round(loc.stats.avgSpread / 1000)}K</div>
                <div style="color: #525252; font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em;">Avg Spread</div>
              </td>
              <td width="25%" align="center" style="padding: 8px 0;">
                <div style="color: #f97316; font-size: 22px; font-weight: 800;">${loc.stats.priceDrops}</div>
                <div style="color: #525252; font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em;">Price Drops</div>
              </td>
              <td width="25%" align="center" style="padding: 8px 0;">
                <div style="color: #a78bfa; font-size: 22px; font-weight: 800;">${loc.stats.totalListings}</div>
                <div style="color: #525252; font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em;">Listings</div>
              </td>
            </tr>
          </table>
        </td></tr>

        ${loc.topDeals.length > 0 ? `
        <!-- Top deals -->
        <tr><td style="padding: 0 20px 4px;">
          <div style="color: #737373; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 8px;">Top Deals This Week</div>
          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border: 1px solid #1a1a1a; border-radius: 6px; overflow: hidden;">
            ${topDealsHtml}
          </table>
        </td></tr>
        ` : ''}

        <tr><td style="height: 12px;"></td></tr>
      </table>
    `;
  }).join('');

  const totalDeals = locations.reduce((sum, l) => sum + l.stats.totalDeals, 0);
  const subject = `Weekly Market Digest — ${totalDeals} Deal${totalDeals !== 1 ? 's' : ''} Across ${locations.length} Market${locations.length !== 1 ? 's' : ''}`;

  const html = `
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #000000; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
      <tr><td align="center" style="padding: 40px 20px;">
        <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width: 600px; width: 100%; background-color: #0a0a0b; border-radius: 12px; overflow: hidden; border: 1px solid #1a1a1a;">
          <tr><td style="padding: 28px 32px 20px; border-bottom: 1px solid #1a1a1a;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td><img src="https://aiwholesail.com/logo-white.png" alt="AIWholesail" height="32" style="height: 32px; width: auto;" /></td>
                <td align="right" style="color: #525252; font-size: 12px;">Weekly Digest</td>
              </tr>
            </table>
          </td></tr>
          <tr><td style="height: 3px; background: linear-gradient(90deg, #8b5cf6, #06b6d4, #8b5cf6); font-size: 0;">&nbsp;</td></tr>
          <tr><td style="padding: 28px 32px;">
            <h1 style="color: #ffffff; font-size: 22px; font-weight: 700; margin: 0 0 8px;">Your Weekly Market Digest</h1>
            <p style="color: #a3a3a3; font-size: 14px; margin: 0 0 28px;">Here's what happened in your watched markets this week.</p>
            ${locationSections}
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top: 8px;">
              <tr><td align="center">
                <a href="https://aiwholesail.com/app" style="background-color: #06b6d4; border-radius: 8px; padding: 14px 40px; color: #000; font-weight: 700; font-size: 15px; text-decoration: none; display: inline-block;">Search All Markets</a>
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

  if (DRY_RUN) {
    console.log(`  [DRY RUN] Would send digest to ${userEmail}: ${subject}`);
    return { id: 'dry-run' };
  }

  return resend.emails.send({
    from: 'AIWholesail <alerts@aiwholesail.com>',
    to: userEmail,
    subject,
    html,
  });
}

async function run() {
  console.log(`\n=== Weekly Market Digest started at ${new Date().toISOString()} ===`);
  if (DRY_RUN) console.log('*** DRY RUN MODE ***\n');

  try {
    // Get users who have active alerts AND weekly digest enabled
    const usersResult = await pool.query(`
      SELECT DISTINCT u.id, u.email
      FROM users u
      JOIN property_alerts pa ON pa.user_id = u.id
      LEFT JOIN notification_preferences np ON np.user_id = u.id
      WHERE pa.is_active = true
        AND COALESCE(np.weekly_digest_enabled, true) = true
    `);

    console.log(`Found ${usersResult.rows.length} users for weekly digest\n`);

    for (const user of usersResult.rows) {
      try {
        // Get user's active alert locations
        const alertsResult = await pool.query(
          'SELECT DISTINCT location FROM property_alerts WHERE user_id = $1 AND is_active = true',
          [user.id]
        );

        const locationData = [];

        for (const alertRow of alertsResult.rows) {
          const loc = alertRow.location.toLowerCase().trim();

          // Get stats from cache for this location (last 7 days)
          const statsResult = await pool.query(`
            SELECT
              COUNT(*) FILTER (WHERE spread >= 30000) AS total_deals,
              COALESCE(AVG(spread) FILTER (WHERE spread >= 30000), 0)::int AS avg_spread,
              COUNT(*) AS total_listings
            FROM property_search_cache
            WHERE LOWER(TRIM(location)) = $1
              AND last_seen_at > NOW() - INTERVAL '7 days'
          `, [loc]);

          // Count price drops in this location this week
          const dropsResult = await pool.query(`
            SELECT COUNT(*) AS drop_count
            FROM price_drop_log
            WHERE LOWER(TRIM(location)) = $1
              AND detected_at > NOW() - INTERVAL '7 days'
          `, [loc]);

          // Top 3 deals by spread
          const topDealsResult = await pool.query(`
            SELECT address, price, zestimate, spread
            FROM property_search_cache
            WHERE LOWER(TRIM(location)) = $1
              AND spread >= 30000
              AND last_seen_at > NOW() - INTERVAL '7 days'
            ORDER BY spread DESC
            LIMIT 3
          `, [loc]);

          const stats = statsResult.rows[0];
          locationData.push({
            name: alertRow.location,
            stats: {
              totalDeals: parseInt(stats.total_deals) || 0,
              avgSpread: parseInt(stats.avg_spread) || 0,
              priceDrops: parseInt(dropsResult.rows[0].drop_count) || 0,
              totalListings: parseInt(stats.total_listings) || 0,
            },
            topDeals: topDealsResult.rows,
          });
        }

        // Only send if there's data
        const hasData = locationData.some(l => l.stats.totalListings > 0);
        if (!hasData) {
          console.log(`  ${user.email}: no data for digest (skipped)`);
          continue;
        }

        console.log(`  ${user.email}: ${locationData.length} locations, ${locationData.reduce((s, l) => s + l.stats.totalDeals, 0)} total deals`);
        await sendDigestEmail(user.email, locationData);
        console.log(`    Digest sent`);

      } catch (err) {
        console.error(`  ERROR for ${user.email}: ${err.message}`);
      }
    }

  } catch (err) {
    console.error('FATAL:', err);
  }

  console.log('\n=== Weekly Market Digest complete ===');
  await pool.end();
}

run().catch(err => {
  console.error('Worker crashed:', err);
  process.exit(1);
});
