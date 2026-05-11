/**
 * Cook County, IL — Clerk of the Circuit Court docket search.
 *
 * Illinois is judicial → LP (Lis Pendens) is the primary signal; foreclosure
 * is a court case, not a recorded notice. The Cook County clerk runs a
 * JS-heavy single-page docket search, so this adapter uses Playwright.
 *
 * Phase-4 stub. Selectors below are placeholders; override via county_configs.config_json:
 *
 *   {
 *     "searchPath":         "/CaseSearch",
 *     "caseTypeSelectValue": "CH",        // Chancery — foreclosure division
 *     "rowSelector":         "table.case-results tbody tr",
 *     "fields": {
 *       "caseNumber":  "td.col-case",
 *       "filedDate":   "td.col-filed",
 *       "plaintiff":   "td.col-plaintiff",
 *       "defendant":   "td.col-defendant",
 *       "address":     "td.col-address"
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
import { withPage } from '../lib/browser';
import { sleep, jitter } from '../lib/delay';

interface CookConfig {
  searchPath?: string;
  caseTypeSelectValue?: string;
  rowSelector?: string;
  fields?: {
    caseNumber?: string;
    filedDate?: string;
    plaintiff?: string;
    defendant?: string;
    address?: string;
  };
}

const DEFAULTS = {
  searchPath: '/CaseSearch',
  caseTypeSelectValue: 'CH',
  rowSelector: 'table.case-results tbody tr',
  fields: {
    caseNumber: 'td.col-case',
    filedDate: 'td.col-filed',
    plaintiff: 'td.col-plaintiff',
    defendant: 'td.col-defendant',
    address: 'td.col-address',
  },
};

export class CookIlAdapter extends BaseAdapter {
  readonly name = 'cook-il';
  private readonly baseUrl: string;
  private hasNextPage = false;

  constructor(opts: { baseUrl: string; rateLimitMs: number }) {
    super(opts);
    this.baseUrl = opts.baseUrl.replace(/\/$/, '');
  }

  private cfg(job: ScrapeJob): typeof DEFAULTS {
    const j = (job.config ?? {}) as CookConfig;
    return {
      searchPath: j.searchPath ?? DEFAULTS.searchPath,
      caseTypeSelectValue: j.caseTypeSelectValue ?? DEFAULTS.caseTypeSelectValue,
      rowSelector: j.rowSelector ?? DEFAULTS.rowSelector,
      fields: { ...DEFAULTS.fields, ...(j.fields ?? {}) },
    };
  }

  async scrape(job: ScrapeJob): Promise<RawRecord[]> {
    const cfg = this.cfg(job);
    const url = `${this.baseUrl}${cfg.searchPath}`;
    const log = this.log(job);

    await sleep(jitter(this.rateLimitMs));

    return withPage(async (page) => {
      log.info({ url }, 'navigating');
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60_000 });

      // Fill the search form. Selectors are best-effort; concrete site markup
      // determines the actual interactions. Failures are caught and re-thrown
      // with context so the worker error trail is readable.
      try {
        await page.selectOption('select[name="caseType"]', cfg.caseTypeSelectValue);
        await page.fill('input[name="filedFrom"]', job.startDate);
        await page.fill('input[name="filedTo"]', job.endDate);
        if (job.page > 1) {
          await page.fill('input[name="page"]', String(job.page));
        }
        await page.click('button[type="submit"]');
        await page.waitForSelector(cfg.rowSelector, { timeout: 30_000 });
      } catch (err) {
        throw new Error(
          `cook-il form interaction failed (selectors likely outdated): ${(err as Error).message}`,
        );
      }

      const raws = await page.$$eval(
        cfg.rowSelector,
        (rows, fields) => {
          const get = (row: Element, sel?: string) => {
            if (!sel) return '';
            const el = row.querySelector(sel);
            return el ? (el.textContent ?? '').trim() : '';
          };
          return rows
            .map((row) => ({
              caseNumber: get(row, fields.caseNumber),
              filedDate: get(row, fields.filedDate),
              plaintiff: get(row, fields.plaintiff),
              defendant: get(row, fields.defendant),
              address: get(row, fields.address),
              outerHtml: (row as HTMLElement).outerHTML,
            }))
            .filter((r) => r.caseNumber.length > 0);
        },
        cfg.fields,
      );

      // Detect next-page button to inform getNextPage()
      this.hasNextPage = await page
        .$('a.next-page, button.next-page')
        .then((el) => !!el)
        .catch(() => false);

      const out: RawRecord[] = raws.map((r) => ({
        externalId: r.caseNumber,
        rawHtml: r.outerHtml,
        sourceUrl: url,
        parsedFields: {
          caseNumber: r.caseNumber,
          filedDate: r.filedDate,
          plaintiff: r.plaintiff,
          defendant: r.defendant,
          address: r.address,
        },
      }));

      log.info({ count: out.length, hasNextPage: this.hasNextPage }, 'cook-il parsed');
      return out;
    });
  }

  getNextPage(_ctx: PageContext): string | null {
    // Playwright drives form submission, so the "URL" the queue tracks is the
    // search-page URL; pagination state lives in the page input. We just
    // signal yes/no to the worker loop.
    return this.hasNextPage ? `${this.baseUrl}${DEFAULTS.searchPath}` : null;
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
      recordType: job.recordType, // expected to be 'LP'
      parcelNumber: null,
      propertyAddress: cleanWhitespace(f.address),
      ownerName: cleanWhitespace(f.defendant),
      lenderName: cleanWhitespace(f.plaintiff),
      defaultAmount: null,
      recordedDate: parseDate(f.filedDate),
      saleDate: null,
      caseNumber: cleanWhitespace(f.caseNumber),
      trusteeInfo: null,
      rawData: f,
      sourceUrl: raw.sourceUrl,
    };
  }
}
