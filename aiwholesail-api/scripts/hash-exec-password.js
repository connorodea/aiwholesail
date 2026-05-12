#!/usr/bin/env node
/**
 * One-time helper to generate a bcrypt hash for the exec-dashboard password.
 *
 * Usage:
 *   echo 'your-password' | node scripts/hash-exec-password.js
 *   # → prints the hash; paste into .env as EXEC_DASHBOARD_PASSWORD_HASH=...
 *
 * Also generates a random JWT secret you can paste as EXEC_DASHBOARD_JWT_SECRET.
 *
 * The password is read from stdin (not argv) so it never appears in shell
 * history or process listings.
 */

const bcrypt = require('bcryptjs');
const crypto = require('crypto');

async function main() {
  // Read password from stdin
  let data = '';
  process.stdin.setEncoding('utf8');
  for await (const chunk of process.stdin) data += chunk;
  const password = data.replace(/[\r\n]+$/, '');
  if (!password) {
    console.error('Empty password. Pipe it via stdin: echo "..." | node scripts/hash-exec-password.js');
    process.exit(1);
  }

  const hash = await bcrypt.hash(password, 12);
  const jwtSecret = crypto.randomBytes(48).toString('base64url');

  console.log('Add the following to /var/www/aiwholesail-api/.env');
  console.log('(or your deployment\'s equivalent), then restart aiwholesail-api:\n');
  console.log(`EXEC_DASHBOARD_EMAIL=cpodea5@gmail.com`);
  console.log(`EXEC_DASHBOARD_PASSWORD_HASH=${hash}`);
  console.log(`EXEC_DASHBOARD_JWT_SECRET=${jwtSecret}`);
}

main().catch(err => { console.error(err.message); process.exit(1); });
