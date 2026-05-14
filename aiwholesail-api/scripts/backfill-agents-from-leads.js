#!/usr/bin/env node
/**
 * Backfill Agents From Leads
 *
 * Scans the user's leads table and extracts listing-agent contact info from
 * each lead's property_data JSON. Upserts each unique (email|phone) agent
 * into the `agents` directory, incrementing listings_count and tracking
 * the most-recent zpid we saw them on.
 *
 * Usage:
 *   node scripts/backfill-agents-from-leads.js --user-id=<uuid>
 *   node scripts/backfill-agents-from-leads.js --user-id=<uuid> --dry-run
 *
 * Behavior:
 *   - Iterates leads WHERE user_id = $user-id
 *   - Reads agent fields from property_data JSON (multiple shapes supported,
 *     see EXTRACT_PATHS below — Zillow scrape, manual entry, etc.)
 *   - Skips rows that don't contain at least name + (email OR phone)
 *   - Reports a summary at end (scanned / extracted / inserted / updated / skipped)
 */

require('dotenv').config();
const { Pool } = require('pg');

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const userIdArg = args.find((a) => a.startsWith('--user-id='));
const USER_ID = userIdArg ? userIdArg.split('=')[1] : null;

if (!USER_ID) {
  console.error('FATAL: --user-id=<uuid> is required');
  process.exit(1);
}

if (!process.env.DATABASE_URL) {
  console.error('FATAL: DATABASE_URL not set');
  process.exit(1);
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

/**
 * Inspect a lead's property_data JSON and try to pull out a listing agent.
 * The Zillow scraper writes a `listingAgent` sub-object (see
 * lib/scrapers/zillowScrapeDo.js around line 203), but older leads may
 * have flatter shapes — try a few paths and return the first match.
 *
 * Returns null if no usable agent info is present (must have name + at
 * least one of email/phone).
 */
function extractAgent(propertyData, lead) {
  if (!propertyData || typeof propertyData !== 'object') return null;

  // Try in priority order. Each path is a getter; the first non-null one
  // that yields a name wins.
  const tryPaths = [
    // 1. New shape from the Zillow scraper (post 2026-03-ish)
    () => propertyData.listingAgent,
    // 2. attributionInfo passthrough — some property responses retain it
    () => {
      const a = propertyData.attributionInfo;
      if (!a) return null;
      return {
        name: a.agentName,
        email: a.agentEmail,
        phone: a.agentPhoneNumber,
        licenseNumber: a.agentLicenseNumber,
        brokerage: a.brokerName || a.buyerBrokerName,
        brokeragePhone: a.brokerPhoneNumber,
      };
    },
    // 3. Flat agent_* keys on the lead's property_data
    () => {
      if (!propertyData.agent_name && !propertyData.agentName) return null;
      return {
        name: propertyData.agent_name || propertyData.agentName,
        email: propertyData.agent_email || propertyData.agentEmail,
        phone: propertyData.agent_phone || propertyData.agentPhone,
        licenseNumber: propertyData.agent_license || propertyData.agentLicenseNumber,
        brokerage: propertyData.brokerage || propertyData.brokerName,
        brokeragePhone: propertyData.brokerage_phone || propertyData.brokerPhoneNumber,
      };
    },
    // 4. A nested `contact` object (defensive — some PR cached this way)
    () => {
      const c = propertyData.contact;
      if (!c || !c.name) return null;
      return {
        name: c.name,
        email: c.email,
        phone: c.phone,
        brokerage: c.brokerage,
      };
    },
  ];

  let agent = null;
  for (const fn of tryPaths) {
    try {
      const candidate = fn();
      if (candidate && candidate.name) {
        agent = candidate;
        break;
      }
    } catch (_err) {
      // Path didn't resolve — try next.
    }
  }

  if (!agent || !agent.name) return null;
  if (!agent.email && !agent.phone) return null;

  // Pull location hints off the property itself
  const city = propertyData.city || propertyData.addressCity || null;
  const state = propertyData.state || propertyData.addressState || null;
  const zip = propertyData.zipcode || propertyData.zip || propertyData.addressZipcode || null;
  const market = city && state ? `${city}, ${state}` : (city || state || null);
  const zpid = propertyData.zpid || propertyData.zillowId || lead.property_id || null;

  return {
    name: String(agent.name).trim(),
    email: agent.email ? String(agent.email).trim().toLowerCase() : null,
    phone: agent.phone ? String(agent.phone).trim() : null,
    brokerage: agent.brokerage || null,
    brokerage_phone: agent.brokeragePhone || null,
    license_number: agent.licenseNumber || null,
    photo_url: agent.photoUrl || agent.profileImage || null,
    market,
    state,
    city,
    zip: zip ? String(zip) : null,
    last_seen_zpid: zpid ? String(zpid) : null,
    last_listing_seen_at: lead.updated_at || lead.created_at || null,
  };
}

async function inspectSchema(client) {
  // Sanity check that the expected columns exist — print a short report so
  // operators running this for the first time can confirm shape.
  const cols = await client.query(
    `SELECT column_name FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'leads'
     ORDER BY ordinal_position`
  );
  const colNames = cols.rows.map((r) => r.column_name);
  console.log('[schema] leads columns:', colNames.join(', '));
  if (!colNames.includes('property_data')) {
    console.error('FATAL: leads.property_data column not found — cannot extract agents');
    process.exit(1);
  }
  return colNames;
}

async function upsertAgent(client, userId, agent) {
  // Look for an existing row by lowercased-email or exact-phone. If found,
  // update only the fields where the new value is non-null (COALESCE old
  // first so we don't clobber better data), and bump listings_count.
  const existing = await client.query(
    `SELECT id FROM agents
     WHERE user_id = $1
       AND (
         (email IS NOT NULL AND LOWER(email) = LOWER($2))
         OR (phone IS NOT NULL AND phone = $3)
       )
     LIMIT 1`,
    [userId, agent.email, agent.phone]
  );

  if (existing.rows.length > 0) {
    if (DRY_RUN) return { action: 'update', id: existing.rows[0].id };
    await client.query(
      `UPDATE agents SET
         name = COALESCE(NULLIF($2, ''), name),
         email = COALESCE(email, $3),
         phone = COALESCE(phone, $4),
         brokerage = COALESCE($5, brokerage),
         brokerage_phone = COALESCE($6, brokerage_phone),
         license_number = COALESCE($7, license_number),
         photo_url = COALESCE($8, photo_url),
         market = COALESCE($9, market),
         state = COALESCE($10, state),
         city = COALESCE($11, city),
         zip = COALESCE($12, zip),
         last_seen_zpid = COALESCE($13, last_seen_zpid),
         last_listing_seen_at = GREATEST(
           COALESCE(last_listing_seen_at, '1970-01-01'::timestamptz),
           COALESCE($14::timestamptz, '1970-01-01'::timestamptz)
         ),
         listings_count = listings_count + 1
       WHERE id = $1`,
      [
        existing.rows[0].id,
        agent.name, agent.email, agent.phone, agent.brokerage,
        agent.brokerage_phone, agent.license_number, agent.photo_url,
        agent.market, agent.state, agent.city, agent.zip,
        agent.last_seen_zpid, agent.last_listing_seen_at,
      ]
    );
    return { action: 'update', id: existing.rows[0].id };
  }

  if (DRY_RUN) return { action: 'insert', id: null };

  const ins = await client.query(
    `INSERT INTO agents (
       user_id, name, email, phone, brokerage, brokerage_phone, license_number,
       photo_url, market, state, city, zip, source, last_seen_zpid,
       last_listing_seen_at
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12,
               'zillow_scrape', $13, $14)
     RETURNING id`,
    [
      userId, agent.name, agent.email, agent.phone, agent.brokerage,
      agent.brokerage_phone, agent.license_number, agent.photo_url,
      agent.market, agent.state, agent.city, agent.zip,
      agent.last_seen_zpid, agent.last_listing_seen_at,
    ]
  );
  return { action: 'insert', id: ins.rows[0].id };
}

async function main() {
  console.log(`[backfill] user=${USER_ID} dry_run=${DRY_RUN}`);
  const client = await pool.connect();
  try {
    await inspectSchema(client);

    const leadsRes = await client.query(
      `SELECT id, user_id, property_id, property_data, created_at, updated_at
       FROM leads
       WHERE user_id = $1
       ORDER BY updated_at DESC`,
      [USER_ID]
    );

    console.log(`[backfill] scanned ${leadsRes.rows.length} leads`);

    let extracted = 0;
    let inserted = 0;
    let updated = 0;
    let skipped = 0;

    for (const lead of leadsRes.rows) {
      const agent = extractAgent(lead.property_data, lead);
      if (!agent) {
        skipped++;
        continue;
      }
      extracted++;
      try {
        const { action } = await upsertAgent(client, USER_ID, agent);
        if (action === 'insert') inserted++;
        else updated++;
      } catch (err) {
        console.error(`[backfill] upsert failed for lead ${lead.id}: ${err.message}`);
        skipped++;
      }
    }

    console.log('[backfill] done', {
      scanned: leadsRes.rows.length,
      extracted,
      inserted,
      updated,
      skipped,
      dry_run: DRY_RUN,
    });
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error('[backfill] FATAL:', err);
  process.exit(1);
});
