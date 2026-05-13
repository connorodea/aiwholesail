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
 * Two scrape.do entry points layered on top of the RapidAPI proxy:
 *
 *   1. PRIMARY swap (flag-gated, dogfood / cost-cutover)
 *      When `feature_flag_globals.zillow_scrape_do` is enabled for the
 *      caller AND the action has a scrape.do handler, we go to scrape.do
 *      FIRST. On any failure we fall through to RapidAPI.
 *
 *   2. FALLBACK (for ALL users, no flag check)
 *      When RapidAPI returns an error (5xx, network, success=false) AND
 *      the action has a scrape.do handler, we try scrape.do as a last
 *      resort. This keeps the product up when RapidAPI is degraded.
 *
 * Net effect:
 *   - Cpodea5 dogfood account → scrape.do primary, RapidAPI fallback
 *   - All other 124 customers → RapidAPI primary, scrape.do fallback
 *   - Both modes preserve the same return shape; callers don't need to
 *     branch on which backend answered.
 */

const axios = require('axios');
const { isEnabled } = require('../featureFlags');
const zillowScrapeDo = require('../scrapers/zillowScrapeDo');

const PROXY_URL = process.env.ZILLOW_PROXY_URL || 'http://127.0.0.1:3201/zillow';
const PROXY_SECRET = process.env.ZILLOW_PROXY_SECRET || '';
const TIMEOUT_MS = 20000;
const FLAG_SLUG = 'zillow_scrape_do';

// Action → scrape.do handler. Maps the upstream proxy's action names to
// our self-hosted scraper. Anything not in this map skips scrape.do (both
// primary AND fallback). Naming covers both the old proxy's camelCase and
// a few legacy spellings used by the per-property tool so the agent tools
// keep working without edits.
const SCRAPE_DO_ACTIONS = {
  // Detail-class:
  propertyDetails: zillowScrapeDo.propertyDetails,
  propertyByAddress: zillowScrapeDo.propertyDetails,
  photos: zillowScrapeDo.photos,
  taxes: zillowScrapeDo.taxes,
  priceHistory: zillowScrapeDo.priceHistory,
  zestimate: zillowScrapeDo.zestimate,
  // `rentalEstimate` action is what the frontend's enrichWithZestimates
  // sends for batch rent lookups. Maps to propertyDetails on the scraper
  // side (Zillow's detail page exposes both sale + rent Zestimates from
  // the same __NEXT_DATA__ blob).
  rentalEstimate: zillowScrapeDo.rentalEstimate,
  zestimateHistory: zillowScrapeDo.zestimateHistory,
  schools: zillowScrapeDo.schools,
  comps: zillowScrapeDo.comps,
  // Wholesale-specific detail slices added 2026-05:
  walkScore: zillowScrapeDo.walkScore,
  climateRisk: zillowScrapeDo.climateRisk,
  openHouses: zillowScrapeDo.openHouses,
  rentalComps: zillowScrapeDo.rentalComps,
  recentlySoldNearby: zillowScrapeDo.recentlySoldNearby,
  // Search-class:
  search: zillowScrapeDo.search,
  searchByAddress: zillowScrapeDo.searchByAddress,
  searchByCoordinates: zillowScrapeDo.searchByCoordinates,
  searchByBounds: zillowScrapeDo.searchByBounds,
  searchByUrl: zillowScrapeDo.searchByUrl,
  forSale: zillowScrapeDo.forSale,
  forRent: zillowScrapeDo.forRent,
  recentlySold: zillowScrapeDo.recentlySold,
  foreclosures: zillowScrapeDo.foreclosures,
  fsbo: zillowScrapeDo.fsbo,
  comingSoon: zillowScrapeDo.comingSoon,
  auctionListings: zillowScrapeDo.auctionListings,
  // Value / agent / market / mortgage:
  mortgageRates: zillowScrapeDo.mortgageRates,
  // mortgageCalculator is pure math — exposed for symmetry but the proxy
  // can also short-circuit and call it directly without falling through
  // to RapidAPI (no upstream call is needed).
  mortgageCalculator: zillowScrapeDo.mortgageCalculator,
  agentProfile: zillowScrapeDo.agentProfile,
  marketStats: zillowScrapeDo.marketStats,
};

/**
 * Hit the legacy RapidAPI proxy. Returns the unwrapped data on success,
 * throws on any non-2xx or `success: false` envelope. Pure wrapper, no
 * flag logic — kept separate so the caller can decide what to do on error.
 */
async function callRapidApiProxy(action, searchParams) {
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

async function proxyZillow(action, searchParams = {}, options = {}) {
  const handler = SCRAPE_DO_ACTIONS[action];

  // ─── 1. PRIMARY swap (flag-gated dogfood) ───────────────────────────
  // Only fires for users whose feature_flag_users row says enabled=true,
  // or once we flip the global rollout. Default behaviour for all 124
  // non-dogfood users: skip this block entirely.
  if (handler) {
    let useScrapeDoPrimary = false;
    try {
      useScrapeDoPrimary = await isEnabled(options.userId || null, FLAG_SLUG);
    } catch (err) {
      console.warn(`[zillowProxy] flag lookup failed: ${err.message}`);
    }
    if (useScrapeDoPrimary) {
      try {
        return await handler(searchParams);
      } catch (err) {
        console.warn(
          `[zillowProxy] scrape.do PRIMARY ${action} failed, falling back to RapidAPI: ${err.message}`
        );
        // Fall through to the RapidAPI path below.
      }
    }
  }

  // ─── 2. RapidAPI primary path ───────────────────────────────────────
  let rapidErr = null;
  try {
    return await callRapidApiProxy(action, searchParams);
  } catch (err) {
    rapidErr = err;
  }

  // ─── 3. FALLBACK to scrape.do (for ALL users, no flag check) ────────
  // RapidAPI is down or returned an error envelope. If we have a scrape.do
  // handler for this action, try it as a last resort so the product stays
  // up. No per-user gating — this is a resilience layer.
  if (handler) {
    try {
      const data = await handler(searchParams);
      console.warn(
        `[zillowProxy] RapidAPI ${action} failed (${rapidErr.message}); served from scrape.do fallback`
      );
      return data;
    } catch (scrapeErr) {
      console.warn(
        `[zillowProxy] both backends failed for ${action}: rapid=${rapidErr.message}; scrape=${scrapeErr.message}`
      );
      // fall through to throw the original RapidAPI error so callers see
      // the same shape they always have when both providers are down.
    }
  }

  throw rapidErr;
}

module.exports = { proxyZillow, SCRAPE_DO_ACTIONS, callRapidApiProxy };
