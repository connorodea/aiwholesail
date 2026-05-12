import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pool } from '../src/db';
import { logger } from '../src/logger';

const MIGRATIONS_DIR = join(__dirname, '..', 'src', 'db', 'migrations');

async function ensureMigrationsTable(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS foreclosure_scraper_migrations (
      filename TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

async function appliedSet(): Promise<Set<string>> {
  const { rows } = await pool.query<{ filename: string }>(
    `SELECT filename FROM foreclosure_scraper_migrations`,
  );
  return new Set(rows.map((r) => r.filename));
}

async function main(): Promise<void> {
  await ensureMigrationsTable();
  const applied = await appliedSet();

  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  for (const file of files) {
    if (applied.has(file)) {
      logger.info({ file }, 'migration already applied — skipping');
      continue;
    }
    const sql = readFileSync(join(MIGRATIONS_DIR, file), 'utf8');
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query(
        `INSERT INTO foreclosure_scraper_migrations (filename) VALUES ($1)`,
        [file],
      );
      await client.query('COMMIT');
      logger.info({ file }, 'migration applied');
    } catch (err) {
      await client.query('ROLLBACK').catch(() => undefined);
      logger.error({ file, err }, 'migration failed');
      throw err;
    } finally {
      client.release();
    }
  }

  await pool.end();
  logger.info('migrations complete');
}

main().catch((err) => {
  logger.error({ err }, 'migrate.ts failed');
  process.exit(1);
});
