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
 * Failure modes we treat as retryable: HTTP 429, 502, 503, 504, network errors,
 * and a bounded retry on HTTP 400 when the body looks like scrape.do's
 * concurrent-request-limit / transient-proxy response (NOT a malformed URL).
 * Anything else (401, 403, 404, 410, hard 400) is surfaced immediately.
 *
 * Why bounded 400 retry: production log analysis shows ~1 in 3 scrape.do
 * calls returning 400 with bodies like "Concurrent request limit reached"
 * or "Failed to get response from target" — both transient. Retrying these
 * once with backoff lifts our successful-fetch rate without burning tokens
 * on genuinely-bad URLs (those usually 400 with "Invalid url" / "Invalid
 * token" — those bodies are excluded from retry).
 */

const axios = require('axios');

const SCRAPE_DO_BASE = 'https://api.scrape.do';
const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_MAX_RETRIES = 2;
const RETRY_BACKOFF_MS = 1500;
// Cap on 400 retries — these are billed even when transient, so we don't
// want to fan them out as wide as the normal 5xx/429 budget.
const MAX_400_RETRIES = 1;

// scrape.do 400 bodies that look transient (worth retrying). Anything not
// matching these is treated as a permanent client-side error.
const TRANSIENT_400_PATTERNS = [
  /concurrent request limit/i,
  /failed to get response/i,
  /rate.?limit/i,
  /timeout/i,
  /try again/i,
];

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

function isTransient400(body) {
  if (typeof body !== 'string' || body.length === 0) return false;
  const snippet = body.slice(0, 500);
  return TRANSIENT_400_PATTERNS.some((re) => re.test(snippet));
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
  let retries400 = 0;
  // Loop bound includes the 400 retry budget so the bounded-400 path still
  // gets its retry when callers pass a tight maxRetries (e.g. autocomplete
  // uses maxRetries:0 to keep latency down — but should still survive a
  // single transient 400).
  const maxAttempts = maxRetries + 1 + MAX_400_RETRIES;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
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

    // Bounded 400 retry — only when the body matches a known-transient
    // pattern (concurrent-limit / proxy-timeout). Capped separately from
    // the 5xx budget to avoid spending tokens on genuinely-bad requests.
    if (
      res.status === 400 &&
      retries400 < MAX_400_RETRIES &&
      isTransient400(res.data)
    ) {
      retries400 += 1;
      lastErr = new ScrapeDoError(`scrape.do HTTP 400 (transient)`, {
        status: 400,
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
  isTransient400,
};
