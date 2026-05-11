/**
 * One-off backfill — enqueue a wide-date scrape for a single adapter+record-type.
 * This is the "initial seed" path; the daily cron handles steady-state deltas.
 *
 * Usage:
 *   pnpm backfill -- --adapter=maricopa-az --type=NOD --start=2025-01-01 --end=2026-04-30
 *
 * The script splits the range into 1-day chunks so a single failing day
 * doesn't take down the whole run. Each chunk is its own queue job.
 */

import { enqueueScrape } from '../src/queue';
import { findConfig } from '../src/db/county-configs';
import { pool } from '../src/db';
import { logger } from '../src/logger';
import { RecordType } from '../src/types';

function arg(name: string, fallback?: string): string {
  const pair = process.argv.slice(2).find((a) => a.startsWith(`--${name}=`));
  if (pair) return pair.split('=')[1] ?? fallback ?? '';
  if (fallback !== undefined) return fallback;
  throw new Error(`Missing required arg --${name}`);
}

function* days(startIso: string, endIso: string): Generator<string> {
  const start = new Date(`${startIso}T00:00:00Z`);
  const end = new Date(`${endIso}T00:00:00Z`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    throw new Error('start/end must be YYYY-MM-DD');
  }
  for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
    yield d.toISOString().slice(0, 10);
  }
}

async function main(): Promise<void> {
  const adapterName = arg('adapter');
  const recordType = arg('type') as RecordType;
  const startDate = arg('start');
  const endDate = arg('end');

  const cfg = await findConfig(adapterName);
  if (!cfg) throw new Error(`No county_configs row for ${adapterName}`);
  if (!cfg.recordTypes.includes(recordType)) {
    throw new Error(
      `Adapter ${adapterName} does not declare record type ${recordType} (declared: ${cfg.recordTypes.join(', ')})`,
    );
  }

  let queued = 0;
  for (const day of days(startDate, endDate)) {
    await enqueueScrape({
      county: cfg.county,
      state: cfg.state,
      recordType,
      startDate: day,
      endDate: day,
      page: 1,
      config: { ...cfg.configJson, adapterName: cfg.adapterName },
    });
    queued += 1;
  }

  logger.info({ adapter: adapterName, recordType, queued, startDate, endDate }, 'backfill queued');
  await pool.end();
}

main().catch((err) => {
  logger.error({ err }, 'backfill failed');
  process.exit(1);
});
