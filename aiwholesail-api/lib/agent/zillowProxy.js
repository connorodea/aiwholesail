/**
 * Server-side wrapper around the Zillow scrape stack.
 *
 * The legacy RapidAPI proxy lives at /root/zillow-api on hetznerCO (port 3201)
 * and exposes 27 actions (search, property/*, valuation/*, agent/*, market,
 * mortgage). All agent tools route through this single function so we have
 * one place to add timeouts, retries, rate-limiting, and observability.
 *
 * Env required on the API process (still used in the fallback path):
 *   ZILLOW_PROXY_URL     default: http://127.0.0.1:3201/zillow
 *   ZILLOW_PROXY_SECRET  must match the proxy's API_SECRET env var
 *
 * Backend order (changed 2026-05-13 — PR #321):
 *
 *   1. PRIMARY: scrape.do
 *      For any action with a handler in SCRAPE_DO_ACTIONS we try the self-
 *      hosted scrape.do scraper FIRST, unconditionally. No flag check, no
 *      cohort gating. RapidAPI's zillow-working-api has been returning 500
 *      on every call for weeks and scrape.do was already serving 100% of
 *      traffic via the fallback path — flipping the order cuts ~2.5s of
 *      latency off every search.
 *
 *   2. FALLBACK: RapidAPI proxy (callRapidApiProxy → :3201)
 *      Only fires when scrape.do throws. Kept as a safety net so that if
 *      scrape.do ever has an outage AND RapidAPI is back up we have a path
 *      to serve the user. Will be removed entirely once RapidAPI is
 *      decommissioned.
 *
 *   3. On both failure → throw the scrape.do error (since scrape.do is the
 *      new primary, its error is what the caller should see).
 *
 * Actions NOT in SCRAPE_DO_ACTIONS skip step 1 and go straight to RapidAPI.
 */

const axios = require('axios');
const zillowScrapeDo = require('../scrapers/zillowScrapeDo');

const PROXY_URL = process.env.ZILLOW_PROXY_URL || 'http://127.0.0.1:3201/zillow';
const PROXY_SECRET = process.env.ZILLOW_PROXY_SECRET || '';
const TIMEOUT_MS = 20000;

// Action → scrape.do handler. Maps the upstream proxy's action names to
// our self-hosted scraper. Anything not in this map skips scrape.do and
// goes straight to the RapidAPI fallback. Naming covers both the old
// proxy's camelCase and a few legacy spellings used by the per-property
// tool so the agent tools keep working without edits.
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

// `options` is kept in the signature for caller compatibility (was used for
// per-user flag gating before PR #321). Now unused — leave the param so we
// don't churn the 30+ caller sites; future args (timeout, retries) will reuse
// the slot.
async function proxyZillow(action, searchParams = {}, options = {}) {
  const handler = SCRAPE_DO_ACTIONS[action];

  // ─── 1. PRIMARY: scrape.do (unconditional for actions in SCRAPE_DO_ACTIONS) ───
  // No flag check, no cohort gating — scrape.do is the unconditional primary
  // for every supported action. RapidAPI has been returning 500 on every
  // call for weeks; this just stops us from waiting on a known-dead service.
  if (handler) {
    let scrapeErr = null;
    try {
      const data = await handler(searchParams);
      console.log(`[zillowProxy] ${action} served from scrape.do (primary)`);
      return data;
    } catch (err) {
      scrapeErr = err;
      console.warn(
        `[zillowProxy] scrape.do PRIMARY ${action} failed, falling back to RapidAPI: ${err.message}`
      );
    }

    // ─── 2. FALLBACK: RapidAPI proxy ────────────────────────────────────
    // Last-resort safety net in case scrape.do has a transient outage. If
    // this also fails we throw the ORIGINAL scrape.do error (since scrape.do
    // is the new primary, that's the error the caller should reason about).
    try {
      const data = await callRapidApiProxy(action, searchParams);
      console.warn(
        `[zillowProxy] scrape.do ${action} failed (${scrapeErr.message}); served from RapidAPI fallback`
      );
      return data;
    } catch (rapidErr) {
      console.warn(
        `[zillowProxy] both backends failed for ${action}: scrape=${scrapeErr.message}; rapid=${rapidErr.message}`
      );
      throw scrapeErr;
    }
  }

  // ─── Action not in SCRAPE_DO_ACTIONS → straight to RapidAPI ──────────
  // No scrape.do handler exists for this action, so there's nothing to
  // primary on. Hit RapidAPI directly and let its error bubble.
  return callRapidApiProxy(action, searchParams);
}

module.exports = { proxyZillow, SCRAPE_DO_ACTIONS, callRapidApiProxy };
