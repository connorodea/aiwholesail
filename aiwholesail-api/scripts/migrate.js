#!/usr/bin/env node
/**
 * Schema migration runner.
 *
 * Reads every `*.sql` file under `migrations/`, sorts alphabetically, and
 * applies any that haven't been recorded in the `_migrations` table.
 * Each migration runs inside its own transaction — a failure rolls
 * back the migration AND aborts the deploy (we exit 1).
 *
 * --- Bootstrap mode ---
 * Existing databases have all 14+ migrations applied manually via psql
 * but no `_migrations` tracking table. If we detect that case (no
 * `_migrations` table BUT the `users` table exists), we create the
 * tracking table and mark every existing migration file as already
 * applied — WITHOUT running them. This is the only way to land this
 * runner on an existing prod DB without breaking the world.
 *
 * Heuristic for fresh-vs-existing DB: if `users` table is absent, we
 * assume a fresh DB and run every migration from 001 onward. This is
 * the dev/staging/CI fresh-DB path.
 *
 * --- Concurrency ---
 * PostgreSQL advisory lock keyed to a fixed 64-bit int. Two parallel
 * deploys can't race the same migration. Lock is released in a finally
 * block so an SQL error doesn't leave it hanging.
 *
 * --- Operational notes ---
 *   npm run migrate              # apply pending
 *   node scripts/migrate.js      # same thing
 *   node scripts/migrate.js --status   # list applied / pending, no writes
 *
 * Env: DATABASE_URL (required)
 */

require('dotenv').config();

const fs = require('node:fs/promises');
const path = require('node:path');
const { Pool } = require('pg');

const MIGRATIONS_DIR = path.join(__dirname, '..', 'migrations');
// Arbitrary 64-bit int. Distinct enough that nothing else in the codebase
// could collide if it ever uses pg_advisory_lock.
const ADVISORY_LOCK_KEY = 4242424242;

async function tableExists(client, name) {
  const { rows } = await client.query(
    `SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = $1 LIMIT 1`,
    [name]
  );
  return rows.length > 0;
}

async function listMigrationFiles() {
  const entries = await fs.readdir(MIGRATIONS_DIR);
  return entries.filter((f) => f.endsWith('.sql')).sort();
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('[migrate] DATABASE_URL not set');
    process.exit(1);
  }

  const statusOnly = process.argv.includes('--status');

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();
  let lockAcquired = false;

  try {
    // Snapshot existence BEFORE any writes. We need to know whether to
    // take the bootstrap path before we create / read the tracking table.
    const migrationsTableExisted = await tableExists(client, '_migrations');
    const usersTableExists       = await tableExists(client, 'users');

    // Bootstrap heuristic: the schema already has rows we care about
    // (users table) BUT no migrations have been recorded — either because
    // _migrations doesn't exist OR because it exists with zero rows
    // (latter happens if someone created the table manually or a prior
    // test left it empty). Either way we mark everything applied and stop.
    let recordedCount = 0;
    if (migrationsTableExisted) {
      const r = await client.query('SELECT COUNT(*)::int AS n FROM _migrations');
      recordedCount = r.rows[0]?.n || 0;
    }
    const needsBootstrap = usersTableExists && recordedCount === 0;

    // Acquire the advisory lock for any code path that writes. Status mode
    // is strictly read-only — no lock, no CREATE TABLE.
    if (!statusOnly) {
      await client.query('SELECT pg_advisory_lock($1)', [ADVISORY_LOCK_KEY]);
      lockAcquired = true;

      // Create the tracking table. Idempotent. Skipped in status mode so a
      // diagnostic run on a fresh DB can never write.
      await client.query(`
        CREATE TABLE IF NOT EXISTS _migrations (
          filename    TEXT        PRIMARY KEY,
          applied_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `);
    }

    const files = await listMigrationFiles();

    // Bootstrap branch: schema already exists, but no migrations are
    // recorded. Mark everything applied and stop. Safe because EVERY
    // migration file in this repo was already manually applied to prod
    // before this runner shipped.
    if (needsBootstrap) {
      if (statusOnly) {
        console.log(`[migrate] STATUS (bootstrap pending): ${files.length} migration(s) would be marked applied`);
      } else {
        for (const f of files) {
          await client.query(
            'INSERT INTO _migrations (filename) VALUES ($1) ON CONFLICT DO NOTHING',
            [f]
          );
        }
        console.log(`[migrate] bootstrap: marked ${files.length} existing migration(s) as applied (existing schema)`);
      }
      return;
    }

    // Normal branch: compute pending = files not yet recorded.
    const { rows } = await client.query('SELECT filename FROM _migrations');
    const applied = new Set(rows.map((r) => r.filename));
    const pending = files.filter((f) => !applied.has(f));

    if (statusOnly) {
      console.log(`[migrate] STATUS`);
      console.log(`  applied:  ${applied.size}`);
      console.log(`  pending:  ${pending.length}`);
      if (pending.length > 0) {
        for (const f of pending) console.log(`    - ${f}`);
      }
      return;
    }

    if (pending.length === 0) {
      console.log(`[migrate] no pending migrations (${applied.size} already applied)`);
      return;
    }

    console.log(`[migrate] applying ${pending.length} migration(s):`);

    for (const file of pending) {
      const sql = await fs.readFile(path.join(MIGRATIONS_DIR, file), 'utf8');
      console.log(`[migrate] -> ${file}`);
      try {
        await client.query('BEGIN');
        await client.query(sql);
        await client.query('INSERT INTO _migrations (filename) VALUES ($1)', [file]);
        await client.query('COMMIT');
        console.log(`[migrate]    ok`);
      } catch (err) {
        await client.query('ROLLBACK').catch(() => {});
        console.error(`[migrate]    FAILED: ${err.message}`);
        // Exit 1 — the deploy script will halt before restarting the
        // service, so the running process keeps serving the old code
        // against the old schema until the operator intervenes.
        throw err;
      }
    }

    console.log(`[migrate] applied ${pending.length} migration(s)`);
  } finally {
    if (lockAcquired) {
      await client.query('SELECT pg_advisory_unlock($1)', [ADVISORY_LOCK_KEY]).catch(() => {});
    }
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error('[migrate] FATAL:', err.message);
  process.exit(1);
});
