import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import { config } from '../config';
import { logger } from '../logger';
import { jitter, sleep } from './delay';

const USER_AGENTS = [
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0 Safari/537.36',
];

function pickUserAgent(): string {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)]!;
}

export function createHttpClient(baseURL?: string): AxiosInstance {
  const client = axios.create({
    baseURL,
    timeout: 30_000,
    headers: { 'User-Agent': pickUserAgent() },
    proxy: false,
  });

  if (config.proxyUrl) {
    try {
      const parsed = new URL(config.proxyUrl);
      client.defaults.proxy = {
        protocol: parsed.protocol.replace(':', ''),
        host: parsed.hostname,
        port: Number(parsed.port) || (parsed.protocol === 'https:' ? 443 : 80),
        auth: parsed.username
          ? { username: decodeURIComponent(parsed.username), password: decodeURIComponent(parsed.password) }
          : undefined,
      };
    } catch (err) {
      logger.warn({ err }, 'Invalid PROXY_URL — proceeding without proxy');
    }
  }

  return client;
}

interface FetchOptions extends AxiosRequestConfig {
  /** Per-request rate-limit floor in ms (with jitter). */
  rateLimitMs?: number;
  /** Retry attempts on 5xx / network errors. Default 2. */
  retries?: number;
}

/**
 * GET with built-in rate limiting, UA rotation, and retry-on-5xx.
 * Use this for static-site scraping. For dynamic sites use playwright directly.
 */
export async function politeGet(
  client: AxiosInstance,
  url: string,
  options: FetchOptions = {},
): Promise<string> {
  const { rateLimitMs = config.defaultRateLimitMs, retries = 2, ...axiosOpts } = options;
  const rl = jitter(rateLimitMs);
  if (rl > 0) await sleep(rl);

  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const resp = await client.get<string>(url, {
        responseType: 'text',
        validateStatus: (s) => s >= 200 && s < 300,
        headers: { 'User-Agent': pickUserAgent(), ...(axiosOpts.headers ?? {}) },
        ...axiosOpts,
      });
      return resp.data;
    } catch (err) {
      lastErr = err;
      if (attempt < retries) {
        const backoff = 1000 * 2 ** attempt + jitter(500);
        logger.warn({ url, attempt, backoff }, 'fetch failed, retrying');
        await sleep(backoff);
      }
    }
  }
  throw lastErr;
}
