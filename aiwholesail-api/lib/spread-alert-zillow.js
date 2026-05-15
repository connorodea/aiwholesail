// Zillow-facing wrappers for the spread-alert worker. Routes through
// `proxyZillow` (lib/agent/zillowProxy) — the canonical scrape.do entry
// point — so the worker uses the same backend-selection + RapidAPI
// safety-net chain as every other Zillow consumer in the API.
//
// Dependency-injected for unit testing (test/scripts/spread-alert-zillow.test.js
// passes a stub `proxyZillow` and asserts the action names + return shapes).
// The script consumer constructs once at startup with the real proxyZillow.

const { mapSummaryToListing } = require('./spread-alert-listing-map');

function makeSpreadAlertZillow({ proxyZillow }) {
  async function searchZillow(location, page = 1) {
    // Throws propagate — the worker's main loop already wraps each
    // location in its own try/catch and pushes the error into stats.errors.
    // Catching here would mask per-location backend failures behind an
    // empty-listings response and silently log "0 properties" instead.
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
    // Swallow per-zpid errors. enrichWithZestimates uses Promise.allSettled
    // and treats null as "skip this property's zestimate"; throwing here
    // would change error semantics — the worker isn't equipped to
    // differentiate per-zpid failures from a backend outage.
    try {
      const result = await proxyZillow('zestimate', { zpid });
      return result?.zestimate ?? null;
    } catch {
      return null;
    }
  }

  return { searchZillow, getZestimate };
}

module.exports = { makeSpreadAlertZillow };
