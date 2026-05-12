import cron, { ScheduledTask } from 'node-cron';
import { listEnabledConfigs } from './db/county-configs';
import { enqueueScrape } from './queue';
import { logger } from './logger';
import { RecordType } from './types';

/**
 * The scheduler reads every enabled county_configs row at boot and registers
 * a cron task per row. Each tick enqueues one scrape job per record type, for
 * yesterday's date range — the daily delta. Backfills run via scripts/backfill.ts
 * with a wider explicit range.
 *
 * Hot-reload of county_configs is not supported in this version; restart the
 * process after toggling rows. (cron handles are tracked so we COULD add a
 * refresh() — left out until there's a real need.)
 */

const tasks: ScheduledTask[] = [];

function yesterdayIso(): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

export async function startScheduler(): Promise<void> {
  const configs = await listEnabledConfigs();
  if (configs.length === 0) {
    logger.warn('scheduler: no enabled county_configs — nothing to schedule');
    return;
  }

  for (const cfg of configs) {
    if (!cron.validate(cfg.cronSchedule)) {
      logger.error({ adapter: cfg.adapterName, cron: cfg.cronSchedule }, 'invalid cron — skipping');
      continue;
    }

    const task = cron.schedule(cfg.cronSchedule, async () => {
      const day = yesterdayIso();
      for (const recordType of cfg.recordTypes as RecordType[]) {
        try {
          const dbId = await enqueueScrape({
            county: cfg.county,
            state: cfg.state,
            recordType,
            startDate: day,
            endDate: day,
            page: 1,
            config: { ...cfg.configJson, adapterName: cfg.adapterName },
          });
          logger.info(
            { adapter: cfg.adapterName, recordType, day, dbId },
            'scheduler: enqueued daily scrape',
          );
        } catch (err) {
          logger.error({ err, adapter: cfg.adapterName, recordType }, 'scheduler enqueue failed');
        }
      }
    });

    tasks.push(task);
    logger.info(
      { adapter: cfg.adapterName, cron: cfg.cronSchedule, types: cfg.recordTypes },
      'scheduler: cron registered',
    );
  }
}

export function stopScheduler(): void {
  for (const t of tasks) t.stop();
  tasks.length = 0;
}
