/**
 * scrape.do client — thin wrapper around the proxy/anti-bot API.
 *
 * Replaces the RapidAPI middlemen (zillow-working-api, skip-tracing-working-api)
 * with our own scraping path: we hit the source URL through scrape.do's
 * residential-proxy + (optional) headless-browser layer and parse the response
 * ourselves. Pricing is per-successful-request, so we keep the call surface
 * narrow and the retries bounded.
 *
 * scrape.do API contract: GET https://api.scrape.do/?token=<key>&url=<encoded>
 * Optional knobs we use:
 *   render=true         — execute JS in a real headless browser (5x cost)
 *   geoCode=us          — pin proxy egress to the US (matches Zillow's GEO walls)
 *   super=true          — premium residential pool (slower, fewer blocks)
 *   customHeaders=true  — forward our Headers verbatim (needed for POSTs)
 *
 * Failure modes we treat as retryable: HTTP 429, 502, 503, 504, network errors.
 * Anything else (400, 401, 403, 404, 410) is surfaced as a hard error.
 */

const axios = require('axios');

const SCRAPE_DO_BASE = 'https://api.scrape.do';
const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_MAX_RETRIES = 2;
const RETRY_BACKOFF_MS = 1500;

class ScrapeDoError extends Error {
  constructor(message, { status = 0, attempts = 1, upstream } = {}) {
    super(message);
    this.name = 'ScrapeDoError';
    this.status = status;
    this.attempts = attempts;
    this.upstream = upstream;
  }
}

function getToken() {
  const t = process.env.SCRAPE_DO_API_TOKEN;
  if (!t) {
    throw new ScrapeDoError('SCRAPE_DO_API_TOKEN not configured');
  }
  return t;
}

function isRetryableStatus(status) {
  return status === 429 || status === 502 || status === 503 || status === 504;
}

function buildQuery(targetUrl, opts) {
  const params = new URLSearchParams();
  params.set('token', getToken());
  params.set('url', targetUrl);
  if (opts.render) params.set('render', 'true');
  if (opts.geoCode) params.set('geoCode', opts.geoCode);
  if (opts.super) params.set('super', 'true');
  if (opts.customHeaders) params.set('customHeaders', 'true');
  if (opts.waitFor) params.set('waitFor', String(opts.waitFor));
  return `${SCRAPE_DO_BASE}/?${params.toString()}`;
}

/**
 * Fetch a URL through scrape.do.
 *
 * @param {string} targetUrl  Full URL to scrape (we URL-encode internally).
 * @param {object} [opts]
 * @param {'GET'|'POST'} [opts.method='GET']
 * @param {string|object} [opts.body]            POST body (object → JSON)
 * @param {object} [opts.headers]                Forwarded if customHeaders=true
 * @param {boolean} [opts.render=false]          Run a headless browser (5x cost)
 * @param {string} [opts.geoCode='us']           Proxy egress country
 * @param {boolean} [opts.super=false]           Premium residential pool
 * @param {number} [opts.timeoutMs]
 * @param {number} [opts.maxRetries]
 * @returns {Promise<{status: number, data: string, headers: object, attempts: number}>}
 */
async function scrape(targetUrl, opts = {}) {
  const method = opts.method || 'GET';
  const timeoutMs = opts.timeoutMs || DEFAULT_TIMEOUT_MS;
  const maxRetries = opts.maxRetries ?? DEFAULT_MAX_RETRIES;
  const geoCode = opts.geoCode === undefined ? 'us' : opts.geoCode;
  const wantsHeaders = method === 'POST' || !!opts.headers;
  const reqUrl = buildQuery(targetUrl, { ...opts, geoCode, customHeaders: wantsHeaders });

  const axiosConfig = {
    method,
    url: reqUrl,
    timeout: timeoutMs,
    validateStatus: () => true,
    responseType: 'text',
    transformResponse: [(d) => d], // keep raw — Zillow JSON-in-HTML needs string parsing
  };

  if (opts.headers && wantsHeaders) {
    axiosConfig.headers = opts.headers;
  }
  if (method === 'POST' && opts.body !== undefined) {
    axiosConfig.data =
      typeof opts.body === 'string' ? opts.body : JSON.stringify(opts.body);
    axiosConfig.headers = {
      'Content-Type': 'application/json',
      ...(axiosConfig.headers || {}),
    };
  }

  let lastErr = null;
  for (let attempt = 1; attempt <= maxRetries + 1; attempt += 1) {
    let res;
    try {
      res = await axios(axiosConfig);
    } catch (err) {
      lastErr = new ScrapeDoError(`scrape.do network error: ${err.message}`, {
        status: 0,
        attempts: attempt,
      });
      if (attempt <= maxRetries) {
        await sleep(RETRY_BACKOFF_MS * attempt);
        continue;
      }
      throw lastErr;
    }

    if (res.status >= 200 && res.status < 300) {
      return {
        status: res.status,
        data: res.data,
        headers: res.headers,
        attempts: attempt,
      };
    }

    if (isRetryableStatus(res.status) && attempt <= maxRetries) {
      lastErr = new ScrapeDoError(`scrape.do HTTP ${res.status}`, {
        status: res.status,
        attempts: attempt,
        upstream: typeof res.data === 'string' ? res.data.slice(0, 200) : undefined,
      });
      await sleep(RETRY_BACKOFF_MS * attempt);
      continue;
    }

    throw new ScrapeDoError(`scrape.do HTTP ${res.status}`, {
      status: res.status,
      attempts: attempt,
      upstream: typeof res.data === 'string' ? res.data.slice(0, 500) : undefined,
    });
  }

  throw lastErr || new ScrapeDoError('scrape.do retries exhausted');
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

module.exports = {
  scrape,
  ScrapeDoError,
  buildQuery,
  isRetryableStatus,
};
