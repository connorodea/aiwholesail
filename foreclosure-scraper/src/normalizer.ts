import { ForeclosureRecord, RawRecord, ScrapeJob, ScraperAdapter } from './types';
import { logger } from './logger';

export type NormalizedForeclosure = Omit<
  ForeclosureRecord,
  'id' | 'createdAt' | 'updatedAt' | 'scrapedAt' | 'snapshotKey'
>;

/**
 * Run an adapter's `normalize` for every raw record. Failures are swallowed
 * (logged as warnings) so a single malformed row never tanks the whole batch.
 * The per-job error column on scrape_jobs gets the *aggregate* failure rate.
 */
export interface NormalizeOutcome {
  records: NormalizedForeclosure[];
  failures: number;
}

export function normalizeBatch(
  adapter: ScraperAdapter,
  raws: RawRecord[],
  job: ScrapeJob,
): NormalizeOutcome {
  const records: NormalizedForeclosure[] = [];
  let failures = 0;
  for (const raw of raws) {
    try {
      const out = adapter.normalize(raw, job);
      if (out === null) {
        failures += 1;
        continue;
      }
      records.push(out);
    } catch (err) {
      failures += 1;
      logger.warn(
        { err, adapter: adapter.name, externalId: raw.externalId },
        'normalize threw (should return null instead)',
      );
    }
  }
  return { records, failures };
}

// ---- helpers used by concrete adapters ----

export function parseMoney(input: string | null | undefined): number | null {
  if (!input) return null;
  const cleaned = input.replace(/[^0-9.\-]/g, '');
  if (!cleaned) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

/**
 * Parse a date string into ISO date (YYYY-MM-DD). Supports common county formats:
 *   - MM/DD/YYYY
 *   - YYYY-MM-DD
 *   - "Aug 15, 2024"
 * Returns null on anything unparseable — never throws.
 */
export function parseDate(input: string | null | undefined): string | null {
  if (!input) return null;
  const trimmed = input.trim();
  if (!trimmed) return null;
  const m1 = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(trimmed);
  if (m1) {
    const [, mo, d, y] = m1;
    return `${y}-${mo!.padStart(2, '0')}-${d!.padStart(2, '0')}`;
  }
  const m2 = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (m2) return `${m2[1]}-${m2[2]}-${m2[3]}`;
  const parsed = new Date(trimmed);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10);
  }
  return null;
}

export function cleanWhitespace(input: string | null | undefined): string | null {
  if (!input) return null;
  const out = input.replace(/\s+/g, ' ').trim();
  return out.length > 0 ? out : null;
}
