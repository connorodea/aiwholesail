import { pool } from './index';
import { ScrapeJob, ScrapeStatus } from '../types';

export interface ScrapeJobRow {
  id: string;
  county: string;
  state: string;
  recordType: string;
  status: ScrapeStatus;
  recordsFound: number;
  recordsInserted: number;
  recordsUpdated: number;
  error: string | null;
}

export async function createScrapeJob(job: ScrapeJob, bullJobId?: string): Promise<string> {
  const { rows } = await pool.query<{ id: string }>(
    `INSERT INTO scrape_jobs (county, state, record_type, status, start_date, end_date, page, bull_job_id)
     VALUES ($1, $2, $3, 'pending', $4, $5, $6, $7)
     RETURNING id`,
    [job.county, job.state, job.recordType, job.startDate, job.endDate, job.page, bullJobId ?? null],
  );
  return rows[0]!.id;
}

export async function markJobRunning(jobId: string): Promise<void> {
  await pool.query(
    `UPDATE scrape_jobs SET status = 'running', started_at = NOW() WHERE id = $1`,
    [jobId],
  );
}

export async function markJobComplete(
  jobId: string,
  counts: { recordsFound: number; recordsInserted: number; recordsUpdated: number },
): Promise<void> {
  await pool.query(
    `UPDATE scrape_jobs
        SET status = 'complete',
            records_found = $2,
            records_inserted = $3,
            records_updated = $4,
            completed_at = NOW()
      WHERE id = $1`,
    [jobId, counts.recordsFound, counts.recordsInserted, counts.recordsUpdated],
  );
}

export async function markJobFailed(jobId: string, error: string): Promise<void> {
  await pool.query(
    `UPDATE scrape_jobs
        SET status = 'failed',
            error = LEFT($2, 4000),
            completed_at = NOW()
      WHERE id = $1`,
    [jobId, error],
  );
}
