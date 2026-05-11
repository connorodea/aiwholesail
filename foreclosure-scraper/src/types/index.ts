export type RecordType = 'NOD' | 'LP' | 'NTS' | 'REO';

export type ScrapeStatus = 'pending' | 'running' | 'complete' | 'failed';

export interface ScrapeJob {
  county: string;
  state: string;
  recordType: RecordType;
  startDate: string;
  endDate: string;
  page: number;
  /** DB row id from scrape_jobs — set by queue.ts before handing to adapter. */
  jobId?: string;
  /** Adapter-specific config from county_configs.config_json. */
  config?: Record<string, unknown>;
}

export interface RawRecord {
  externalId: string;
  rawHtml: string;
  parsedFields: Record<string, string>;
  sourceUrl: string;
}

export interface PageContext {
  job: ScrapeJob;
  currentUrl: string;
  currentPage: number;
  lastResponseHtml?: string;
}

export interface ForeclosureRecord {
  id: string;
  externalId: string;
  county: string;
  state: string;
  recordType: RecordType;
  parcelNumber: string | null;
  propertyAddress: string | null;
  ownerName: string | null;
  lenderName: string | null;
  defaultAmount: number | null;
  recordedDate: string | null;
  saleDate: string | null;
  caseNumber: string | null;
  trusteeInfo: Record<string, unknown> | null;
  rawData: Record<string, string>;
  sourceUrl: string;
  snapshotKey: string | null;
  scrapedAt: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface CountyConfigRow {
  id: string;
  county: string;
  state: string;
  adapterName: string;
  baseUrl: string;
  recordTypes: RecordType[];
  cronSchedule: string;
  rateLimitMs: number;
  enabled: boolean;
  configJson: Record<string, unknown>;
}

/** Every county adapter implements this. */
export interface ScraperAdapter {
  /** Stable identifier — matches county_configs.adapter_name. */
  readonly name: string;
  /** Main entry — fetch + parse one batch. */
  scrape(job: ScrapeJob): Promise<RawRecord[]>;
  /** Returns next page URL or null if exhausted. */
  getNextPage(context: PageContext): string | null;
  /**
   * Adapter-specific normalization. Maps RawRecord.parsedFields → ForeclosureRecord shape.
   * Implementers must never throw — return null on irrecoverable parse failures and the
   * orchestrator will log + skip the record.
   */
  normalize(
    raw: RawRecord,
    job: ScrapeJob,
  ): Omit<ForeclosureRecord, 'id' | 'createdAt' | 'updatedAt' | 'scrapedAt' | 'snapshotKey'> | null;
}
