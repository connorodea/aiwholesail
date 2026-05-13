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
 *
 * scrape.do path (per-action opt-in, flag-gated):
 *   When `feature_flag_globals.zillow_scrape_do` is enabled and the action
 *   has a scrape.do implementation, we hit Zillow directly via scrape.do
 *   instead of the paid RapidAPI proxy. Falls back to RapidAPI on any
 *   ZillowScrapeError so users never see a hard failure during cutover.
 */

const axios = require('axios');
const { isEnabled } = require('../featureFlags');
const zillowScrapeDo = require('../scrapers/zillowScrapeDo');

const PROXY_URL = process.env.ZILLOW_PROXY_URL || 'http://127.0.0.1:3201/zillow';
const PROXY_SECRET = process.env.ZILLOW_PROXY_SECRET || '';
const TIMEOUT_MS = 20000;
const FLAG_SLUG = 'zillow_scrape_do';

// Action → scrape.do handler. Maps the upstream proxy's action names to
// our self-hosted scraper. Anything not in this map falls through to the
// legacy RapidAPI proxy on every call. Each entry trades one RapidAPI
// request for one scrape.do request (or none, for detail-class slices
// that the caller already fetched).
//
// Naming covers both the old proxy's camelCase and a few legacy spellings
// used by the per-property tool so the agent tools keep working without
// edits. Search-class entries match zillowSearch's `proxyAction` map.
const SCRAPE_DO_ACTIONS = {
  // Detail-class:
  propertyDetails: zillowScrapeDo.propertyDetails,
  propertyByAddress: zillowScrapeDo.propertyDetails,
  photos: zillowScrapeDo.photos,
  taxes: zillowScrapeDo.taxes,
  priceHistory: zillowScrapeDo.priceHistory,
  zestimate: zillowScrapeDo.zestimate,
  schools: zillowScrapeDo.schools,
  comps: zillowScrapeDo.comps,
  // Search-class:
  search: zillowScrapeDo.search,
  searchByAddress: zillowScrapeDo.searchByAddress,
  forSale: zillowScrapeDo.forSale,
  forRent: zillowScrapeDo.forRent,
  recentlySold: zillowScrapeDo.recentlySold,
  foreclosures: zillowScrapeDo.foreclosures,
  fsbo: zillowScrapeDo.fsbo,
};

async function proxyZillow(action, searchParams = {}, options = {}) {
  // ─── scrape.do path (flag-gated, per-action opt-in) ──────────────────
  const handler = SCRAPE_DO_ACTIONS[action];
  if (handler) {
    let useScrapeDo = false;
    try {
      useScrapeDo = await isEnabled(options.userId || null, FLAG_SLUG);
    } catch (err) {
      // Flag lookup failure shouldn't break property lookups. Stay on RapidAPI.
      console.warn(`[zillowProxy] flag lookup failed: ${err.message}`);
    }
    if (useScrapeDo) {
      try {
        const data = await handler(searchParams);
        return data;
      } catch (err) {
        // Fall through to the legacy proxy. Log so we can watch the block rate.
        console.warn(
          `[zillowProxy] scrape.do ${action} failed, falling back to RapidAPI: ${err.message}`
        );
      }
    }
  }

  // ─── Legacy RapidAPI proxy path ──────────────────────────────────────
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

module.exports = { proxyZillow, SCRAPE_DO_ACTIONS };
