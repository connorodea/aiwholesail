/**
 * Run a single adapter in isolation and dump output to stdout. No queue, no
 * DB writes, no R2. Useful for quickly verifying selectors against the live
 * source.
 *
 * Usage:
 *   pnpm test-adapter -- --adapter=maricopa-az --type=NOD --start=2026-04-01 --end=2026-04-30 [--page=1]
 *
 * The adapter pulls its baseUrl + rateLimitMs from the matching county_configs
 * row, so you must have run `pnpm migrate` first.
 */

import { getAdapter } from '../src/adapters';
import { findConfig } from '../src/db/county-configs';
import { normalizeBatch } from '../src/normalizer';
import { logger } from '../src/logger';
import { pool } from '../src/db';
import { RecordType, ScrapeJob } from '../src/types';

function arg(name: string, fallback?: string): string {
  const pair = process.argv.slice(2).find((a) => a.startsWith(`--${name}=`));
  if (pair) return pair.split('=')[1] ?? fallback ?? '';
  if (fallback !== undefined) return fallback;
  throw new Error(`Missing required arg --${name}`);
}

async function main(): Promise<void> {
  const adapterName = arg('adapter');
  const recordType = arg('type') as RecordType;
  const startDate = arg('start');
  const endDate = arg('end');
  const page = Number(arg('page', '1'));

  const cfg = await findConfig(adapterName);
  if (!cfg) {
    throw new Error(`No county_configs row for adapter ${adapterName}. Run migrations first.`);
  }
  const adapter = getAdapter(cfg.adapterName, {
    baseUrl: cfg.baseUrl,
    rateLimitMs: cfg.rateLimitMs,
  });

  const job: ScrapeJob = {
    county: cfg.county,
    state: cfg.state,
    recordType,
    startDate,
    endDate,
    page,
    config: cfg.configJson,
  };

  logger.info({ job, adapter: adapter.name }, 'running adapter in isolation');
  const raws = await adapter.scrape(job);
  const { records, failures } = normalizeBatch(adapter, raws, job);

  process.stdout.write(
    JSON.stringify(
      {
        adapter: adapter.name,
        job,
        rawCount: raws.length,
        normalizedCount: records.length,
        normalizeFailures: failures,
        sampleRaw: raws[0] ? { ...raws[0], rawHtml: raws[0].rawHtml.slice(0, 400) + '...' } : null,
        sampleNormalized: records[0] ?? null,
      },
      null,
      2,
    ),
  );
  process.stdout.write('\n');

  await pool.end();
}

main().catch((err) => {
  logger.error({ err: err instanceof Error ? err.stack : err }, 'test-adapter failed');
  process.exit(1);
});
