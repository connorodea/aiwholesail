// Adapter from scrape.do's search-summary shape
// (lib/scrapers/zillowScrapeDo:mapListingToSummary) to the snake_case
// shape spread-alert-worker.js inserts into property_search_cache.
//
// Pure function — no I/O — so it lives in its own module and is unit-
// testable in isolation (test/scripts/spread-alert-listing-map.test.js).

function mapSummaryToListing(r) {
  return {
    zpid: r.zpid,
    address: r.addressStreet || r.address,
    city: r.addressCity,
    state: r.addressState,
    zipcode: r.addressZipcode,
    price: r.price,
    zestimate: r.zestimate,
    bedrooms: r.beds,
    bathrooms: r.baths,
    living_area_sqft: r.area,
    home_type: r.homeType,
    days_on_zillow: r.daysOnZillow,
    detail_url: r.detailUrl,
    image_url: r.imgSrc,
  };
}

module.exports = { mapSummaryToListing };
