// Composes the Property.address string from a flattened Zillow listing
// (output of zillow-api.ts:flattenProperty's inline flatten()). Extracted
// from zillow-api.ts so the fallback chain is unit-testable and a future
// field-rename can't silently drop the citystatezip half (PR #457).
//
// Three sources feed this:
//   1. property_address_* — RapidAPI / new-Zillow-Scraper-API detail shape
//   2. addressCity / addressState / addressZipcode — scrape.do search shape
//      (from lib/scrapers/zillowScrapeDo:mapListingToSummary)
//   3. plain city / state / zipcode — legacy
//
// Ordering matters: detail-endpoint keys win when both are present, since
// the detail page is the authoritative source.

export function composeFullAddress(flattened) {
  const address = flattened.property_address_streetAddress ||
                  flattened.rental_metrics_streetAddress ||
                  flattened.addressStreet ||
                  flattened.address ||
                  'Unknown Address';

  const city = flattened.property_address_city || flattened.addressCity || flattened.city || '';
  const state = flattened.property_address_state || flattened.addressState || flattened.state || '';
  const zipcode = flattened.property_address_zipcode || flattened.addressZipcode || flattened.zipcode || '';

  return city && state
    ? `${address}, ${city}, ${state}${zipcode ? ' ' + zipcode : ''}`
    : address;
}
