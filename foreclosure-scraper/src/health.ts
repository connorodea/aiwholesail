import express, { Request, Response } from 'express';
import { pool } from './db';
import { getQueue } from './queue';
import { logger } from './logger';
import { config } from './config';

/**
 * Minimal HTTP surface for monitoring. Exposes:
 *   GET /health       — liveness: returns 200 if Postgres + Redis both reachable.
 *   GET /health/deep  — readiness: queue counts + recent job stats.
 */
export function startHealthServer(): void {
  const app = express();

  app.get('/health', async (_req: Request, res: Response) => {
    try {
      await pool.query('SELECT 1');
      const q = getQueue();
      const isReady = await q.isReady();
      if (!isReady) throw new Error('queue not ready');
      res.json({ status: 'ok' });
    } catch (err) {
      logger.error({ err }, 'health check failed');
      res.status(503).json({ status: 'degraded', error: (err as Error).message });
    }
  });

  app.get('/health/deep', async (_req: Request, res: Response) => {
    try {
      const q = getQueue();
      const [waiting, active, completed, failed, delayed] = await Promise.all([
        q.getWaitingCount(),
        q.getActiveCount(),
        q.getCompletedCount(),
        q.getFailedCount(),
        q.getDelayedCount(),
      ]);

      const { rows: recent } = await pool.query<{
        status: string;
        count: string;
      }>(
        `SELECT status, COUNT(*)::text AS count
           FROM scrape_jobs
          WHERE created_at > NOW() - INTERVAL '24 hours'
          GROUP BY status`,
      );

      res.json({
        status: 'ok',
        queue: { waiting, active, completed, failed, delayed },
        recentJobs: Object.fromEntries(recent.map((r) => [r.status, Number(r.count)])),
      });
    } catch (err) {
      logger.error({ err }, 'deep health check failed');
      res.status(503).json({ status: 'degraded', error: (err as Error).message });
    }
  });

  app.listen(config.port, () => {
    logger.info({ port: config.port }, 'health server listening');
  });
}
