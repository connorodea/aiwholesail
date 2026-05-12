import Bull, { Job, Queue } from 'bull';
import { config } from './config';
import { logger } from './logger';
import { ScrapeJob } from './types';
import { getAdapter } from './adapters';
import { findConfig } from './db/county-configs';
import {
  createScrapeJob,
  markJobComplete,
  markJobFailed,
  markJobRunning,
} from './db/jobs';
import { normalizeBatch } from './normalizer';
import { upsertRecords } from './db/records';
import { buildSnapshotKey, putSnapshot } from './storage/r2';

export const SCRAPE_QUEUE_NAME = 'scrape-queue';

let _queue: Queue<ScrapeJob> | null = null;

export function getQueue(): Queue<ScrapeJob> {
  if (_queue) return _queue;
  _queue = new Bull<ScrapeJob>(SCRAPE_QUEUE_NAME, config.redisUrl, {
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
      removeOnComplete: 100,
      removeOnFail: 500,
    },
  });
  return _queue;
}

/** Enqueue a scrape job. Writes a row to scrape_jobs for audit before enqueue. */
export async function enqueueScrape(job: ScrapeJob): Promise<string> {
  const q = getQueue();
  const bullJob = await q.add(job, {
    jobId: `${job.county}-${job.state}-${job.recordType}-${job.startDate}-${job.endDate}-${job.page}`,
  });
  const dbId = await createScrapeJob(job, String(bullJob.id));
  return dbId;
}

/**
 * Worker entrypoint. Pulls adapter from registry, calls scrape → upsert →
 * follow-up enqueue for next page if available + under MAX_PAGES_PER_RUN.
 */
async function processJob(bullJob: Job<ScrapeJob>): Promise<void> {
  const job = bullJob.data;
  const dbId = await createScrapeJob(job, String(bullJob.id)).catch(() => undefined);
  const log = logger.child({
    bullJobId: bullJob.id,
    dbId,
    adapter: `${job.county}-${job.state}`.toLowerCase(),
    recordType: job.recordType,
    page: job.page,
  });

  try {
    if (dbId) await markJobRunning(dbId);

    const cfg = await findConfig(
      job.config?.adapterName as string | undefined ??
        `${job.county.toLowerCase()}-${job.state.toLowerCase()}`,
    );
    if (!cfg) throw new Error(`No county_config row for adapter ${job.county}/${job.state}`);
    if (!cfg.enabled) throw new Error(`Adapter ${cfg.adapterName} is disabled in county_configs`);

    const adapter = getAdapter(cfg.adapterName, {
      baseUrl: cfg.baseUrl,
      rateLimitMs: cfg.rateLimitMs,
    });

    const raws = await adapter.scrape({ ...job, jobId: dbId, config: cfg.configJson });
    log.info({ count: raws.length }, 'adapter returned raw records');

    // Snapshot raw HTML (best-effort, never blocks the upsert).
    const snapshotMap = new Map<string, string | null>();
    for (const raw of raws) {
      const key = buildSnapshotKey({
        state: job.state,
        county: job.county,
        recordType: job.recordType,
        date: job.endDate,
        page: job.page,
        externalId: raw.externalId,
      });
      const stored = await putSnapshot(key, raw.rawHtml);
      snapshotMap.set(raw.externalId, stored);
    }

    const { records, failures } = normalizeBatch(adapter, raws, job);
    log.info({ normalized: records.length, failures }, 'normalize done');

    const withSnapshots = records.map((r) => ({
      ...r,
      snapshotKey: snapshotMap.get(r.externalId) ?? null,
    }));

    const upsertResult = await upsertRecords(withSnapshots);
    log.info({ ...upsertResult, failures }, 'upsert done');

    if (dbId) {
      await markJobComplete(dbId, {
        recordsFound: raws.length,
        recordsInserted: upsertResult.inserted,
        recordsUpdated: upsertResult.updated,
      });
    }

    // Follow-up paging: enqueue next page if adapter says there is one and
    // we haven't hit the safety cap.
    if (job.page < config.maxPagesPerRun) {
      const next = adapter.getNextPage({
        job,
        currentUrl: cfg.baseUrl,
        currentPage: job.page,
      });
      if (next) {
        await enqueueScrape({ ...job, page: job.page + 1 });
        log.info({ nextPage: job.page + 1 }, 'enqueued next page');
      }
    } else {
      log.warn({ cap: config.maxPagesPerRun }, 'hit max_pages_per_run, stopping pagination');
    }
  } catch (err) {
    const msg = err instanceof Error ? err.stack ?? err.message : String(err);
    log.error({ err: msg }, 'scrape job failed');
    if (dbId) await markJobFailed(dbId, msg);
    throw err;
  }
}

export function startWorker(): void {
  const q = getQueue();
  q.process(config.queueConcurrency, processJob);
  q.on('failed', (job, err) => {
    logger.error({ jobId: job.id, err: err.message }, 'queue job failed (post-attempts)');
  });
  q.on('stalled', (job) => {
    logger.warn({ jobId: job.id }, 'queue job stalled');
  });
  logger.info({ concurrency: config.queueConcurrency }, 'scrape worker started');
}

export async function shutdownQueue(): Promise<void> {
  if (_queue) {
    await _queue.close().catch((err) => logger.warn({ err }, 'queue close error'));
    _queue = null;
  }
}
