/**
 * Service entrypoint. Boots one of three roles based on PROCESS_ROLE:
 *
 *   - all       — scheduler + queue worker + /health (single-box default)
 *   - worker    — queue worker + /health
 *   - scheduler — cron only (use when scaling scheduler/worker independently)
 *
 * Graceful shutdown: SIGTERM/SIGINT drain the queue, stop cron, close pool.
 */

import { config } from './config';
import { logger } from './logger';
import { startWorker, shutdownQueue } from './queue';
import { startScheduler, stopScheduler } from './scheduler';
import { startHealthServer } from './health';
import { shutdownDb } from './db';

async function main(): Promise<void> {
  const role = config.processRole;
  logger.info({ role }, 'foreclosure-scraper booting');

  if (role === 'all' || role === 'worker') {
    startWorker();
    startHealthServer();
  }

  if (role === 'all' || role === 'scheduler') {
    await startScheduler();
  }
}

async function shutdown(signal: string): Promise<void> {
  logger.info({ signal }, 'shutdown signal received, draining');
  stopScheduler();
  await shutdownQueue();
  await shutdownDb();
  process.exit(0);
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('unhandledRejection', (err) => {
  logger.error({ err }, 'unhandledRejection');
});
process.on('uncaughtException', (err) => {
  logger.error({ err }, 'uncaughtException');
});

main().catch((err) => {
  logger.error({ err }, 'fatal boot error');
  process.exit(1);
});
