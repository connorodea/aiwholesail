/**
 * Clark County, NV — Recorder document search.
 *
 * Nevada is non-judicial → NOD (Notice of Default) and NTS (Notice of Trustee
 * Sale) are the headline signals; no LP. This is a static-HTML site so we
 * stay on cheerio for now.
 *
 * NOTE: this is a Phase-4 stub. The selectors below are placeholders. Before
 * enabling the adapter in county_configs, run `pnpm test-adapter -- --adapter=clark-nv`
 * and copy the actual row selectors from the live page into county_configs.config_json:
 *
 *   {
 *     "searchPath": "/recorder/search",
 *     "resultsRowSelector": "div.result-card",
 *     "fields": {
 *       "externalId":   ".doc-num",
 *       "recordedDate": ".rec-date",
 *       "ownerName":    ".grantor",
 *       "lenderName":   ".grantee",
 *       "parcelNumber": ".apn"
 *     }
 *   }
 */

import { BaseAdapter } from './_template';
import {
  ForeclosureRecord,
  PageContext,
  RawRecord,
  ScrapeJob,
} from '../types';
import { cleanWhitespace, parseDate } from '../normalizer';

interface ClarkConfig {
  searchPath?: string;
  resultsRowSelector?: string;
  fields?: {
    externalId?: string;
    recordedDate?: string;
    ownerName?: string;
    lenderName?: string;
    parcelNumber?: string;
    propertyAddress?: string;
  };
}

const DEFAULTS = {
  searchPath: '/recorder/search',
  resultsRowSelector: 'div.search-results .result',
  fields: {
    externalId: '.doc-num',
    recordedDate: '.rec-date',
    ownerName: '.grantor',
    lenderName: '.grantee',
    parcelNumber: '.apn',
    propertyAddress: '.address',
  },
};

export class ClarkNvAdapter extends BaseAdapter {
  readonly name = 'clark-nv';
  private readonly baseUrl: string;

  constructor(opts: { baseUrl: string; rateLimitMs: number }) {
    super(opts);
    this.baseUrl = opts.baseUrl.replace(/\/$/, '');
  }

  private cfg(job: ScrapeJob): typeof DEFAULTS {
    const j = (job.config ?? {}) as ClarkConfig;
    return {
      searchPath: j.searchPath ?? DEFAULTS.searchPath,
      resultsRowSelector: j.resultsRowSelector ?? DEFAULTS.resultsRowSelector,
      fields: { ...DEFAULTS.fields, ...(j.fields ?? {}) },
    };
  }

  private buildUrl(job: ScrapeJob): string {
    const cfg = this.cfg(job);
    const params = new URLSearchParams({
      docType: job.recordType,
      from: job.startDate,
      to: job.endDate,
      page: String(job.page),
    });
    return `${this.baseUrl}${cfg.searchPath}?${params.toString()}`;
  }

  async scrape(job: ScrapeJob): Promise<RawRecord[]> {
    const cfg = this.cfg(job);
    const url = this.buildUrl(job);
    const html = await this.fetch(url);
    const $ = this.load(html);

    const out: RawRecord[] = [];
    $(cfg.resultsRowSelector).each((_, row) => {
      const $row = $(row);
      const get = (sel?: string) =>
        sel ? cleanWhitespace($row.find(sel).text()) ?? '' : '';
      const externalId = get(cfg.fields.externalId);
      if (!externalId) return;

      out.push({
        externalId,
        rawHtml: $.html($row),
        sourceUrl: url,
        parsedFields: {
          externalId,
          recordedDate: get(cfg.fields.recordedDate),
          ownerName: get(cfg.fields.ownerName),
          lenderName: get(cfg.fields.lenderName),
          parcelNumber: get(cfg.fields.parcelNumber),
          propertyAddress: get(cfg.fields.propertyAddress),
        },
      });
    });

    this.log(job).info({ count: out.length }, 'clark-nv parsed');
    return out;
  }

  getNextPage(ctx: PageContext): string | null {
    // Conservative: rely on results count > 0 to keep paginating; the worker's
    // MAX_PAGES_PER_RUN cap is the safety net. Replace with a real total-pages
    // probe once we've validated the live response shape.
    return this.buildUrl({ ...ctx.job, page: ctx.currentPage + 1 });
  }

  normalize(
    raw: RawRecord,
    job: ScrapeJob,
  ): Omit<ForeclosureRecord, 'id' | 'createdAt' | 'updatedAt' | 'scrapedAt' | 'snapshotKey'> | null {
    const f = raw.parsedFields;
    if (!raw.externalId) return null;
    return {
      externalId: raw.externalId,
      county: job.county,
      state: job.state,
      recordType: job.recordType,
      parcelNumber: cleanWhitespace(f.parcelNumber),
      propertyAddress: cleanWhitespace(f.propertyAddress),
      ownerName: cleanWhitespace(f.ownerName),
      lenderName: cleanWhitespace(f.lenderName),
      defaultAmount: null,
      recordedDate: parseDate(f.recordedDate),
      saleDate: null,
      caseNumber: null,
      trusteeInfo: null,
      rawData: f,
      sourceUrl: raw.sourceUrl,
    };
  }
}
