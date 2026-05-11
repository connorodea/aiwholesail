/**
 * zillow_search — consolidated property-search tool.
 *
 * Routes to one of six upstream search endpoints based on the `action` enum:
 *   by_zipcode        — bare 5-digit ZIP. Most common.
 *   by_city_state     — "City, ST" or "City, ST ZIP".
 *   by_coordinates    — lat/lng + radius in miles.
 *   by_bounds         — map viewport box (sw + ne corners).
 *   by_address        — exact street address + radius.
 *   by_url            — paste a Zillow saved-search URL.
 *
 * Returns search_result content blocks (one per listing) so the model can
 * cite each property naturally. citations: { enabled: true } emits
 * search_result_location events in the response stream.
 */

const { z } = require('zod/v4');
const { betaZodTool } = require('@anthropic-ai/sdk/helpers/beta/zod');
const { proxyZillow } = require('../zillowProxy');

const inputSchema = z.object({
  action: z.enum([
    'by_zipcode',
    'by_city_state',
    'by_coordinates',
    'by_bounds',
    'by_address',
    'by_url',
  ]).describe('Which search endpoint to call. Pick by_zipcode for bare 5-digit ZIPs.'),

  // by_zipcode
  zipcode: z.string().regex(/^\d{5}$/).optional()
    .describe('Required when action=by_zipcode. Exactly 5 digits.'),

  // by_city_state
  location: z.string().optional()
    .describe('Required when action=by_city_state. e.g. "Austin, TX" or "Oxford, MI 48371".'),

  // by_coordinates
  lat: z.number().optional(),
  lng: z.number().optional(),
  radius_mi: z.number().min(1).max(50).optional(),

  // by_bounds
  sw_lat: z.number().optional(),
  sw_lng: z.number().optional(),
  ne_lat: z.number().optional(),
  ne_lng: z.number().optional(),

  // by_address
  address: z.string().optional()
    .describe('Required when action=by_address. e.g. "145 Cistern Way Austin TX 78737".'),

  // by_url
  url: z.string().url().optional()
    .describe('Required when action=by_url. Full Zillow URL.'),

  // common filters
  homeType: z.enum(['house', 'condo', 'townhouse', 'multi_family', 'apartment', 'manufactured', 'lot']).optional()
    .describe('Property type filter. Default: house.'),
  listing_type: z.enum(['for_sale', 'sold', 'for_rent', 'pre_foreclosure', 'foreclosure', 'new_construction']).optional()
    .describe('Listing status. Default: for_sale.'),
  bed_min: z.number().int().min(0).optional(),
  bed_max: z.number().int().min(0).optional(),
  bathrooms: z.number().min(0).optional(),
  price_min: z.number().int().min(0).optional(),
  price_max: z.number().int().min(0).optional(),
  page: z.string().optional().describe('Page number as string. Default "1".'),
});

function formatListingAsSearchResult(listing) {
  const zpid = listing.zpid || listing.id || '';
  const addr = listing.address || listing.streetAddress || 'Unknown address';
  const city = listing.city || '';
  const state = listing.state || '';
  const zip = listing.zipcode || '';
  const price = typeof listing.price === 'number' ? listing.price : null;
  const beds = listing.bedrooms ?? listing.beds ?? null;
  const baths = listing.bathrooms ?? listing.baths ?? null;
  const sqft = listing.living_area_sqft ?? listing.livingArea ?? null;
  const dom = listing.days_on_zillow ?? listing.daysOnZillow ?? null;
  const status = listing.listing_status ?? listing.listingStatus ?? '';

  const denseText =
    `${addr}, ${city} ${state} ${zip} | ` +
    `${price ? `$${price.toLocaleString()}` : 'price n/a'} | ` +
    `${beds ?? '?'}bd/${baths ?? '?'}ba${sqft ? ` | ${sqft.toLocaleString()} sqft` : ''}` +
    `${dom != null ? ` | ${dom} days on market` : ''}` +
    `${status ? ` | ${status}` : ''}` +
    `${zpid ? ` | zpid ${zpid}` : ''}`;

  return {
    type: 'search_result',
    source: zpid
      ? `https://www.zillow.com/homedetails/${zpid}_zpid/`
      : (listing.detail_url || listing.detailUrl || 'https://www.zillow.com/'),
    title: `${addr}${price ? ` — $${price.toLocaleString()}` : ''}`,
    content: [{ type: 'text', text: denseText }],
    citations: { enabled: true },
  };
}

const zillowSearch = betaZodTool({
  name: 'zillow_search',
  description:
    'Search for-sale property listings on Zillow. Use action=by_zipcode for a bare 5-digit US ZIP (most common case — produces clean results filtered to that ZIP). Use action=by_city_state for a "City, ST" or "City, ST ZIP" string. Use action=by_coordinates with lat/lng/radius_mi for searches around a point. Use action=by_bounds for map-viewport searches. Use action=by_address to find listings near a specific street address. Use action=by_url to import a Zillow saved-search URL. Returns up to ~40 listings per page as search_result blocks (one per property) so each citation links back to its Zillow detail page. Always include filters (bed_min, price_max, etc.) when the user gives them.',
  inputSchema,
  run: async (input) => {
    // Map our normalized action to the upstream proxy action name
    const proxyAction = {
      by_zipcode: 'search',           // proxy routes bare zips automatically when location is 5 digits
      by_city_state: 'search',
      by_coordinates: 'searchByCoordinates',
      by_bounds: 'searchByBounds',
      by_address: 'searchByAddress',
      by_url: 'searchByUrl',
    }[input.action];

    // Build searchParams the proxy expects
    const sp = {};
    if (input.action === 'by_zipcode') sp.location = input.zipcode;
    if (input.action === 'by_city_state') sp.location = input.location;
    if (input.action === 'by_coordinates') {
      sp.lat = input.lat; sp.lng = input.lng;
      if (input.radius_mi != null) sp.radius_mi = input.radius_mi;
    }
    if (input.action === 'by_bounds') {
      sp.sw_lat = input.sw_lat; sp.sw_lng = input.sw_lng;
      sp.ne_lat = input.ne_lat; sp.ne_lng = input.ne_lng;
    }
    if (input.action === 'by_address') {
      sp.address = input.address;
      if (input.radius_mi != null) sp.radius_mi = input.radius_mi;
    }
    if (input.action === 'by_url') sp.url = input.url;
    if (input.homeType) sp.homeType = input.homeType;
    if (input.listing_type) sp.listing_type = input.listing_type;
    if (input.bed_min != null) sp.bed_min = input.bed_min;
    if (input.bed_max != null) sp.bed_max = input.bed_max;
    if (input.bathrooms != null) sp.bathrooms = input.bathrooms;
    if (input.price_min != null) sp.price_min = input.price_min;
    if (input.price_max != null) sp.price_max = input.price_max;
    if (input.page) sp.page = input.page;

    const data = await proxyZillow(proxyAction, sp);
    const listings = data?.listings || data?.results || data?.searchResults || [];
    const totalResults = data?.total_results ?? listings.length;

    // Anthropic API requires uniform block types within one tool_result: if any
    // search_result blocks are present, ALL blocks must be search_result. So we
    // either return all-search_result OR all-text. When we have listings, embed
    // the total-count summary into the first block's content as a leading line.
    const trimmed = listings.slice(0, 40);
    if (trimmed.length === 0) {
      // No results — return a plain text block (uniform type, no search_results)
      return [{
        type: 'text',
        text: `No matching listings. Total upstream: ${totalResults}. Action: ${input.action}.`,
      }];
    }
    const blocks = trimmed.map(formatListingAsSearchResult);
    // Prepend a summary line to the first block's content (search_result.content
    // is itself an array of text blocks, so we can add metadata there).
    blocks[0].content.unshift({
      type: 'text',
      text: `[search summary — total matching upstream: ${totalResults}, showing ${blocks.length}; action: ${input.action}]`,
    });
    return blocks;
  },
});

module.exports = { zillowSearch };
