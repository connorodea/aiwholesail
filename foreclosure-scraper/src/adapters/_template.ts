/**
 * Adapter template — clone this file and rename to `{county}-{state}.ts`.
 *
 * Each adapter implements `ScraperAdapter` (see src/types/index.ts):
 *
 *   1. `name`      — must match `county_configs.adapter_name` in the DB.
 *   2. `scrape`    — fetch + parse a single page of a single record type.
 *   3. `getNextPage` — return next URL or null if the result set is exhausted.
 *   4. `normalize` — pure mapping from `RawRecord.parsedFields` → canonical fields.
 *
 * Adapters MUST be side-effect-free in `normalize` (no I/O) and MUST NOT throw
 * inside `normalize` — return `null` and the orchestrator will skip + log.
 *
 * For static sites: use politeGet + cheerio.
 * For dynamic sites: use the playwright pool in lib/browser.ts (see cook-il.ts).
 *
 * Rate limiting + UA rotation + proxy support are handled by the shared
 * `politeGet`. Each adapter just supplies URLs and selectors.
 */

import { AxiosInstance } from 'axios';
import * as cheerio from 'cheerio';
import {
  ForeclosureRecord,
  PageContext,
  RawRecord,
  ScrapeJob,
  ScraperAdapter,
} from '../types';
import { createHttpClient, politeGet } from '../lib/http';
import { logger } from '../logger';

export abstract class BaseAdapter implements ScraperAdapter {
  abstract readonly name: string;
  protected readonly http: AxiosInstance;
  protected readonly rateLimitMs: number;

  constructor(opts: { baseUrl?: string; rateLimitMs?: number } = {}) {
    this.http = createHttpClient(opts.baseUrl);
    this.rateLimitMs = opts.rateLimitMs ?? 2000;
  }

  /** Fetch a single URL with rate limiting + UA rotation + retry. */
  protected async fetch(url: string): Promise<string> {
    return politeGet(this.http, url, { rateLimitMs: this.rateLimitMs });
  }

  /** Load HTML into a cheerio context. Convenience helper. */
  protected load(html: string): cheerio.CheerioAPI {
    return cheerio.load(html);
  }

  /** Default log scope — concrete adapters can override. */
  protected log = (job: ScrapeJob) =>
    logger.child({ adapter: this.name, county: job.county, type: job.recordType, page: job.page });

  abstract scrape(job: ScrapeJob): Promise<RawRecord[]>;
  abstract getNextPage(context: PageContext): string | null;
  abstract normalize(
    raw: RawRecord,
    job: ScrapeJob,
  ): Omit<ForeclosureRecord, 'id' | 'createdAt' | 'updatedAt' | 'scrapedAt' | 'snapshotKey'> | null;
}
