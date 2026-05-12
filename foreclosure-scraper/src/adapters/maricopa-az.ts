/**
 * Maricopa County, AZ — Recorder of Deeds public document search.
 *
 * Maricopa exposes a paginated HTML search at recorder.maricopa.gov. We hit it
 * once per (recordType × page) — the spec'd record types here are NOD (Notice
 * of Default) and NTS (Notice of Trustee Sale). Arizona is non-judicial so
 * these are the actionable signals; there's no LP equivalent.
 *
 * Selectors are kept in `configJson` (county_configs.config_json) so we can
 * tweak them in the DB without redeploying. The defaults below match Maricopa's
 * current search-results page layout (a table per result row with the
 * recording number, doc type, recorded date, grantor/grantee, and a "View"
 * link).
 *
 * If Maricopa changes their search-results markup, adjust the selector defaults
 * here or override per-row via the DB config:
 *   {
 *     "resultsRowSelector": "table.search-results tr.result-row",
 *     "fields": {
 *       "externalId":    "td.col-doc-num",
 *       "recordedDate":  "td.col-recorded",
 *       "ownerName":     "td.col-grantor",
 *       "lenderName":    "td.col-grantee",
 *       "documentType":  "td.col-doc-type"
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

interface MaricopaConfig {
  searchPath?: string;
  resultsRowSelector?: string;
  fields?: {
    externalId?: string;
    recordedDate?: string;
    ownerName?: string;
    lenderName?: string;
    documentType?: string;
    parcelNumber?: string;
    detailLink?: string;
  };
  docTypeCodes?: Partial<Record<'NOD' | 'NTS', string>>;
}

const DEFAULTS: Required<Omit<MaricopaConfig, 'fields' | 'docTypeCodes'>> & {
  fields: Required<NonNullable<MaricopaConfig['fields']>>;
  docTypeCodes: Required<NonNullable<MaricopaConfig['docTypeCodes']>>;
} = {
  searchPath: '/recdocdata/getDocsByDateAndType',
  resultsRowSelector: 'table.search-results tbody tr',
  fields: {
    externalId: 'td.col-doc-num',
    recordedDate: 'td.col-recorded',
    ownerName: 'td.col-grantor',
    lenderName: 'td.col-grantee',
    documentType: 'td.col-doc-type',
    parcelNumber: 'td.col-parcel',
    detailLink: 'a.detail-link',
  },
  docTypeCodes: {
    NOD: 'NOD',
    NTS: 'NTS',
  },
};

export class MaricopaAdapter extends BaseAdapter {
  readonly name = 'maricopa-az';
  private readonly baseUrl: string;
  private lastTotalPages: number | null = null;

  constructor(opts: { baseUrl: string; rateLimitMs: number }) {
    super(opts);
    this.baseUrl = opts.baseUrl.replace(/\/$/, '');
  }

  private mergeConfig(job: ScrapeJob): typeof DEFAULTS {
    const fromJob = (job.config ?? {}) as MaricopaConfig;
    return {
      searchPath: fromJob.searchPath ?? DEFAULTS.searchPath,
      resultsRowSelector: fromJob.resultsRowSelector ?? DEFAULTS.resultsRowSelector,
      fields: { ...DEFAULTS.fields, ...(fromJob.fields ?? {}) },
      docTypeCodes: { ...DEFAULTS.docTypeCodes, ...(fromJob.docTypeCodes ?? {}) },
    };
  }

  buildUrl(job: ScrapeJob): string {
    const cfg = this.mergeConfig(job);
    const docType = cfg.docTypeCodes[job.recordType as 'NOD' | 'NTS'] ?? job.recordType;
    const params = new URLSearchParams({
      docType,
      startDate: job.startDate,
      endDate: job.endDate,
      page: String(job.page),
    });
    return `${this.baseUrl}${cfg.searchPath}?${params.toString()}`;
  }

  async scrape(job: ScrapeJob): Promise<RawRecord[]> {
    const cfg = this.mergeConfig(job);
    const url = this.buildUrl(job);
    const log = this.log(job);
    log.info({ url }, 'fetching');

    const html = await this.fetch(url);
    const $ = this.load(html);

    const totalPagesAttr = $('[data-total-pages]').attr('data-total-pages');
    this.lastTotalPages = totalPagesAttr ? Number(totalPagesAttr) : null;

    const out: RawRecord[] = [];
    $(cfg.resultsRowSelector).each((_, row) => {
      const $row = $(row);
      const get = (sel?: string) =>
        sel ? cleanWhitespace($row.find(sel).text()) ?? '' : '';

      const externalId = get(cfg.fields.externalId);
      if (!externalId) return; // empty rows / headers
      const detailHref = $row.find(cfg.fields.detailLink).attr('href') ?? '';
      const absoluteDetail = detailHref.startsWith('http')
        ? detailHref
        : detailHref
          ? `${this.baseUrl}${detailHref}`
          : url;

      out.push({
        externalId,
        rawHtml: $.html($row),
        sourceUrl: absoluteDetail,
        parsedFields: {
          externalId,
          recordedDate: get(cfg.fields.recordedDate),
          ownerName: get(cfg.fields.ownerName),
          lenderName: get(cfg.fields.lenderName),
          documentType: get(cfg.fields.documentType),
          parcelNumber: get(cfg.fields.parcelNumber),
          detailUrl: absoluteDetail,
        },
      });
    });

    log.info({ count: out.length, totalPages: this.lastTotalPages }, 'parsed page');
    return out;
  }

  getNextPage(ctx: PageContext): string | null {
    if (this.lastTotalPages !== null && ctx.currentPage >= this.lastTotalPages) {
      return null;
    }
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
      propertyAddress: null, // Maricopa search-results page doesn't include this — enrichment runs separately.
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
