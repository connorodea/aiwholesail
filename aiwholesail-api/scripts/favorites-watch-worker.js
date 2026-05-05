#!/usr/bin/env node
/**
 * Favorites Watch Worker
 *
 * Checks favorited properties for price and status changes.
 * Sends email notifications to users who have favorites_updates_enabled.
 *
 * Flow:
 * 1. Get all users with favorites who have notifications enabled
 * 2. For each user's favorites, fetch current property data
 * 3. Compare with snapshot (last known price/status)
 * 4. If changes detected, send email and update snapshot
 *
 * Usage:
 *   node scripts/favorites-watch-worker.js           # Run once
 *   node scripts/favorites-watch-worker.js --dry-run # Preview without sending
 */

require('dotenv').config();
const axios = require('axios');
const { Pool } = require('pg');
const { Resend } = require('resend');
const resend = new Resend(process.env.RESEND_API_KEY);

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const DRY_RUN = process.argv.includes('--dry-run');

const ZILLOW_PROXY_URL = process.env.ZILLOW_PROXY_URL || 'http://localhost:3201';
const ZILLOW_API_KEY = process.env.ZILLOW_PROXY_API_KEY || 'aiwholesail_zillow_2026';

async function fetchPropertyDetails(zpid) {
  try {
    const response = await axios.post(`${ZILLOW_PROXY_URL}/zillow`, {
      action: 'propertyDetails',
      searchParams: { zpid },
    }, {
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ZILLOW_API_KEY,
      },
      timeout: 15000,
    });
    return response.data?.data || null;
  } catch {
    return null;
  }
}

async function sendFavoritesChangeEmail(userEmail, changes) {
  const subject = `${changes.length} Update${changes.length > 1 ? 's' : ''} on Your Favorites — AIWholesail`;

  const changeRows = changes.map(c => {
    let changeDesc = '';
    if (c.type === 'price_drop') {
      changeDesc = `<span style="color: #22c55e; font-weight: 700;">Price dropped</span> from $${Number(c.oldPrice).toLocaleString()} to <strong style="color: #22c55e;">$${Number(c.newPrice).toLocaleString()}</strong> (-$${Number(c.oldPrice - c.newPrice).toLocaleString()})`;
    } else if (c.type === 'price_increase') {
      changeDesc = `<span style="color: #f97316;">Price increased</span> from $${Number(c.oldPrice).toLocaleString()} to $${Number(c.newPrice).toLocaleString()}`;
    } else if (c.type === 'status_change') {
      changeDesc = `Status changed: <span style="color: #737373;">${c.oldStatus}</span> → <strong style="color: #06b6d4;">${c.newStatus}</strong>`;
    }

    return `
      <tr><td style="padding: 14px 16px; border-bottom: 1px solid #1a1a1a;">
        <div style="color: #e5e5e5; font-size: 14px; font-weight: 500; margin-bottom: 4px;">${c.address || 'Unknown'}</div>
        <div style="font-size: 13px;">${changeDesc}</div>
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
          <tr><td style="height: 3px; background: linear-gradient(90deg, #ec4899, #8b5cf6, #ec4899); font-size: 0;">&nbsp;</td></tr>
          <tr><td style="padding: 28px 32px;">
            <table cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 6px;">
              <tr><td style="background-color: rgba(236,72,153,0.1); border: 1px solid rgba(236,72,153,0.2); border-radius: 20px; padding: 4px 12px; color: #ec4899; font-size: 12px; font-weight: 600;">FAVORITES UPDATE</td></tr>
            </table>
            <h1 style="color: #ffffff; font-size: 22px; font-weight: 700; margin: 12px 0 8px;">${changes.length} Update${changes.length > 1 ? 's' : ''} on Your Saved Properties</h1>
            <p style="color: #a3a3a3; font-size: 14px; margin: 0 0 24px;">Properties you favorited have changed.</p>
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border: 1px solid #1a1a1a; border-radius: 8px; overflow: hidden; background-color: #111113;">
              ${changeRows}
            </table>
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top: 24px;">
              <tr><td align="center">
                <a href="https://aiwholesail.com/app/favorites" style="background-color: #06b6d4; border-radius: 8px; padding: 14px 40px; color: #000; font-weight: 700; font-size: 15px; text-decoration: none; display: inline-block;">View Favorites</a>
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
    console.log(`  [DRY RUN] Would send favorites update email to ${userEmail}: ${subject}`);
    return { id: 'dry-run' };
  }

  return resend.emails.send({
    from: 'AIWholesail Alerts <alerts@aiwholesail.com>',
    to: userEmail,
    subject,
    html,
  });
}

async function run() {
  console.log(`\n=== Favorites Watch Worker started at ${new Date().toISOString()} ===`);
  if (DRY_RUN) console.log('*** DRY RUN MODE ***\n');

  try {
    // Get users who have favorites AND have favorites notifications enabled
    const usersResult = await pool.query(`
      SELECT DISTINCT u.id, u.email
      FROM users u
      JOIN favorites f ON f.user_id = u.id
      LEFT JOIN notification_preferences np ON np.user_id = u.id
      WHERE COALESCE(np.favorites_updates_enabled, true) = true
    `);

    console.log(`Found ${usersResult.rows.length} users with favorites to check\n`);

    for (const user of usersResult.rows) {
      try {
        // Get user's favorites with their property data
        const favResult = await pool.query(
          'SELECT id, property_id, property_data FROM favorites WHERE user_id = $1',
          [user.id]
        );

        if (favResult.rows.length === 0) continue;

        // Get existing snapshots
        const snapResult = await pool.query(
          'SELECT property_id, last_price, last_status FROM favorites_snapshots WHERE user_id = $1',
          [user.id]
        );
        const snapshots = new Map(snapResult.rows.map(r => [r.property_id, r]));

        const changes = [];

        for (const fav of favResult.rows) {
          const propData = fav.property_data || {};
          const zpid = propData.zpid || propData.id || fav.property_id;

          // Fetch current data from Zillow
          const current = await fetchPropertyDetails(zpid);
          if (!current) continue;

          const currentPrice = current.price || current.zestimate || null;
          const currentStatus = current.homeStatus || current.listing_status || current.status || null;
          const address = current.address || propData.address || 'Unknown';

          const snap = snapshots.get(fav.property_id);

          if (snap) {
            // Compare with snapshot
            if (snap.last_price && currentPrice && currentPrice !== snap.last_price) {
              changes.push({
                type: currentPrice < snap.last_price ? 'price_drop' : 'price_increase',
                address,
                oldPrice: snap.last_price,
                newPrice: currentPrice,
                zpid,
              });
            }

            if (snap.last_status && currentStatus && currentStatus !== snap.last_status) {
              changes.push({
                type: 'status_change',
                address,
                oldStatus: snap.last_status,
                newStatus: currentStatus,
                zpid,
              });
            }
          }

          // Upsert snapshot
          await pool.query(`
            INSERT INTO favorites_snapshots (user_id, property_id, zpid, last_price, last_status, last_checked_at)
            VALUES ($1, $2, $3, $4, $5, NOW())
            ON CONFLICT (user_id, property_id) DO UPDATE SET
              last_price = COALESCE($4, favorites_snapshots.last_price),
              last_status = COALESCE($5, favorites_snapshots.last_status),
              last_checked_at = NOW()
          `, [user.id, fav.property_id, zpid, currentPrice, currentStatus]);

          // Rate limit: small delay between API calls
          await new Promise(r => setTimeout(r, 500));
        }

        if (changes.length > 0) {
          console.log(`  ${user.email}: ${changes.length} changes detected`);
          try {
            await sendFavoritesChangeEmail(user.email, changes);
            console.log(`    Email sent`);
          } catch (err) {
            console.error(`    Email failed: ${err.message}`);
          }
        } else {
          console.log(`  ${user.email}: no changes (${favResult.rows.length} favorites checked)`);
        }

      } catch (err) {
        console.error(`  ERROR checking favorites for ${user.email}: ${err.message}`);
      }
    }

  } catch (err) {
    console.error('FATAL:', err);
  }

  console.log('\n=== Favorites Watch Worker complete ===');
  await pool.end();
}

run().catch(err => {
  console.error('Worker crashed:', err);
  process.exit(1);
});
