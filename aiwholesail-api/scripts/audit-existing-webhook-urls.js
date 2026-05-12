#!/usr/bin/env node
/**
 * Read-only audit: which existing webhook_endpoints rows would be rejected
 * by the new SSRF guard (lib/url-safety.validateWebhookUrl)?
 *
 * Use after lib/url-safety lands but BEFORE relying on operator confidence
 * that all existing webhooks are still safe. Surfaces:
 *   - endpoints that point at private/loopback/link-local IPs
 *   - endpoints whose hostnames now resolve to private IPs (DNS rebind /
 *     stale records / config drift)
 *   - endpoints whose hostnames no longer resolve at all
 *
 * Does NOT modify any rows. The operator decides whether to disable.
 *
 * Usage:
 *   node aiwholesail-api/scripts/audit-existing-webhook-urls.js
 *   node aiwholesail-api/scripts/audit-existing-webhook-urls.js --json
 *
 * Env: DATABASE_URL (required)
 */
require('dotenv').config();

const { Pool } = require('pg');
const { validateWebhookUrl } = require('../lib/url-safety');

async function main() {
  const jsonOut = process.argv.includes('--json');
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  let rows;
  try {
    const r = await pool.query(
      `SELECT id, user_id, url, active, created_at
         FROM webhook_endpoints
        ORDER BY created_at`
    );
    rows = r.rows;
  } finally {
    // pool.end() is awaited at the bottom; explicit so the script exits cleanly
  }

  if (rows.length === 0) {
    if (jsonOut) console.log(JSON.stringify({ total: 0, blocked: [] }));
    else console.log('No webhook_endpoints rows to audit.');
    await pool.end();
    return;
  }

  const blocked = [];
  for (const row of rows) {
    const err = await validateWebhookUrl(row.url, {
      allowHttp: process.env.NODE_ENV !== 'production',
    });
    if (err) {
      blocked.push({
        id: row.id,
        user_id: row.user_id,
        url: row.url,
        active: row.active,
        created_at: row.created_at,
        reason: err,
      });
    }
  }

  if (jsonOut) {
    console.log(JSON.stringify({ total: rows.length, blocked }, null, 2));
  } else {
    console.log(`Audited ${rows.length} webhook endpoint(s).`);
    if (blocked.length === 0) {
      console.log('All endpoints pass the new SSRF guard.');
    } else {
      console.log(`\n${blocked.length} endpoint(s) would now be REJECTED:\n`);
      for (const b of blocked) {
        console.log(`  ${b.id}  active=${b.active}  user=${b.user_id}`);
        console.log(`    url:    ${b.url}`);
        console.log(`    reason: ${b.reason}`);
        console.log(`    since:  ${b.created_at}`);
        console.log('');
      }
      console.log('Operator action: review with the affected users; manually disable rows that should not have access (UPDATE webhook_endpoints SET active=false WHERE id=...). This script does not modify data.');
    }
  }

  await pool.end();
}

main().catch((err) => {
  console.error('[audit] failed:', err.message);
  process.exit(1);
});
