import { Browser, BrowserContext, chromium, Page } from 'playwright';
import { config } from '../config';
import { logger } from '../logger';

/**
 * Single shared chromium instance, lazily booted. One context per call so
 * cookies don't leak across counties. Stealth-ish defaults: realistic UA,
 * viewport, locale; disable automation banners via launch args.
 *
 * Adapters that need playwright import `withPage` and never deal with the
 * Browser lifecycle directly.
 */

let _browser: Browser | null = null;

async function getBrowser(): Promise<Browser> {
  if (_browser && _browser.isConnected()) return _browser;
  const launchArgs = [
    '--disable-blink-features=AutomationControlled',
    '--no-sandbox',
    '--disable-dev-shm-usage',
  ];
  _browser = await chromium.launch({
    headless: true,
    args: launchArgs,
    proxy: config.proxyUrl ? { server: config.proxyUrl } : undefined,
  });
  logger.info('chromium launched');
  return _browser;
}

export async function withPage<T>(fn: (page: Page, ctx: BrowserContext) => Promise<T>): Promise<T> {
  const browser = await getBrowser();
  const ctx = await browser.newContext({
    userAgent:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36',
    viewport: { width: 1366, height: 768 },
    locale: 'en-US',
  });
  const page = await ctx.newPage();
  try {
    return await fn(page, ctx);
  } finally {
    await ctx.close().catch(() => undefined);
  }
}

export async function shutdownBrowser(): Promise<void> {
  if (_browser) {
    await _browser.close().catch((err) => logger.warn({ err }, 'browser close error'));
    _browser = null;
  }
}
