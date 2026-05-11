/**
 * Server-side wrapper around the standalone /zillow proxy (port 3201).
 *
 * The proxy lives at /root/zillow-api on hetznerCO and exposes 27 actions
 * (search, property/*, valuation/*, agent/*, market, mortgage). All agent
 * tools route through this single function so we have one place to add
 * timeouts, retries, rate-limiting, and observability.
 *
 * Env required on the API process:
 *   ZILLOW_PROXY_URL     default: http://127.0.0.1:3201/zillow
 *   ZILLOW_PROXY_SECRET  must match the proxy's API_SECRET env var
 */

const axios = require('axios');

const PROXY_URL = process.env.ZILLOW_PROXY_URL || 'http://127.0.0.1:3201/zillow';
const PROXY_SECRET = process.env.ZILLOW_PROXY_SECRET || '';
const TIMEOUT_MS = 20000;

async function proxyZillow(action, searchParams = {}) {
  if (!PROXY_SECRET) {
    throw new Error('ZILLOW_PROXY_SECRET not configured');
  }
  const resp = await axios.post(
    PROXY_URL,
    { action, searchParams },
    {
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': PROXY_SECRET,
      },
      timeout: TIMEOUT_MS,
      validateStatus: () => true,
    }
  );
  if (resp.status === 429) {
    throw new Error('Zillow proxy rate limit exceeded');
  }
  if (resp.status >= 400) {
    const msg = resp.data?.error || `HTTP ${resp.status}`;
    throw new Error(`Zillow proxy error: ${msg}`);
  }
  if (resp.data?.success === false) {
    throw new Error(`Zillow proxy returned error: ${resp.data?.error || 'unknown'}`);
  }
  return resp.data?.data ?? resp.data;
}

module.exports = { proxyZillow };
