// Zillow-facing wrappers for the spread-alert worker. Routes through
// `proxyZillow` (lib/agent/zillowProxy) — the canonical scrape.do entry
// point — so the worker gets the same fallback chain, error translation,
// and provider-metrics logging as every other Zillow consumer in the API.
//
// Dependency-injected for unit testing (test/scripts/spread-alert-zillow.test.js
// passes a stub `proxyZillow` and asserts the action names + return shapes).
// The script consumer constructs once at startup with the real proxyZillow.

const { mapSummaryToListing } = require('./spread-alert-listing-map');

function makeSpreadAlertZillow({ proxyZillow }) {
  async function searchZillow(location, page = 1) {
    const result = await proxyZillow('search', {
      location,
      status: 'ForSale',
      page,
      sort: 'newest',
    });
    return {
      data: {
        total_pages: result?.total_pages || 1,
        listings: (result?.results || []).map(mapSummaryToListing),
      },
    };
  }

  async function getZestimate(zpid) {
    try {
      const result = await proxyZillow('zestimate', { zpid });
      return result?.zestimate || null;
    } catch {
      return null;
    }
  }

  return { searchZillow, getZestimate };
}

module.exports = { makeSpreadAlertZillow };
