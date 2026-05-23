/**
 * Server-side wrapper around the Zillow scrape stack.
 *
 * Single backend: scrape.do (lib/scrapers/zillowScrapeDo). Every action
 * must have a handler in SCRAPE_DO_ACTIONS — unmapped actions throw
 * immediately instead of silently routing to a removed legacy proxy.
 *
 * All agent tools route through this single function so we have one
 * place to add timeouts, retries, rate-limiting, and observability.
 */

const zillowScrapeDo = require('../scrapers/zillowScrapeDo');

// Action → scrape.do handler. Maps the legacy proxy's action names to
// our self-hosted scraper. Naming covers both the camelCase Zillow
// conventions and a few legacy spellings used by the per-property tool
// so agent tools keep working without edits.
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
  // Wholesale-specific detail slices:
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
  mortgageCalculator: zillowScrapeDo.mortgageCalculator,
  agentProfile: zillowScrapeDo.agentProfile,
  marketStats: zillowScrapeDo.marketStats,
};

// `options` is kept in the signature for caller compatibility (30+ call
// sites). Currently unused — future args (timeout, retries) will reuse
// the slot.
async function proxyZillow(action, searchParams = {}, _options = {}) {
  const handler = SCRAPE_DO_ACTIONS[action];
  if (!handler) {
    throw new Error(`Unsupported Zillow action: ${action}`);
  }
  const data = await handler(searchParams);
  console.log(`[zillowProxy] ${action} served from scrape.do`);
  return data;
}

module.exports = { proxyZillow, SCRAPE_DO_ACTIONS };
