/**
 * AIWholesail MCP server.
 *
 * Exposes the same Zillow primitives that power the in-product Cmd+K agent
 * (lib/agent/tools/*) but via the Model Context Protocol, so external clients
 * like Claude Desktop, Cursor, Continue, etc. can use them.
 *
 * Tools mirror the Cmd+K agent's raw primitives (4 consolidated tools, action
 * enums). We deliberately don't expose the higher-level subagent wrappers —
 * MCP clients typically have their own orchestrator (the user's local LLM),
 * so primitives compose better.
 *
 * Output format is plain text content blocks (MCP spec) rather than
 * Anthropic-API-specific search_result blocks. We dense-format the JSON so
 * the consuming LLM can extract zpids, prices, addresses, etc.
 */

const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js');
const { z } = require('zod/v4');
const { proxyZillow } = require('../agent/zillowProxy');

function jsonText(obj) {
  return {
    content: [{ type: 'text', text: typeof obj === 'string' ? obj : JSON.stringify(obj, null, 2) }],
  };
}

function buildMcpServer() {
  const server = new McpServer({
    name: 'aiwholesail-zillow',
    version: '1.0.0',
  });

  // -----------------------------------------------------------------------
  // zillow_search
  // -----------------------------------------------------------------------
  server.registerTool(
    'zillow_search',
    {
      title: 'Search Zillow property listings',
      description:
        'Search for-sale property listings on Zillow. Use action=by_zipcode for a bare 5-digit US ZIP (most common — produces clean results filtered to that ZIP). Use action=by_city_state for "City, ST" or "City, ST ZIP" strings. action=by_coordinates with lat/lng/radius_mi for point-radius searches. action=by_bounds for map-viewport. action=by_address near a specific street. action=by_url to import a Zillow saved-search URL. Returns up to ~40 listings per page as JSON with zpid, address, price, beds, baths, sqft, days_on_zillow, zestimate, lat/lng, and the Zillow detail URL for each.',
      inputSchema: {
        action: z.enum(['by_zipcode', 'by_city_state', 'by_coordinates', 'by_bounds', 'by_address', 'by_url']),
        zipcode: z.string().regex(/^\d{5}$/).optional(),
        location: z.string().optional(),
        lat: z.number().optional(),
        lng: z.number().optional(),
        radius_mi: z.number().min(1).max(50).optional(),
        sw_lat: z.number().optional(),
        sw_lng: z.number().optional(),
        ne_lat: z.number().optional(),
        ne_lng: z.number().optional(),
        address: z.string().optional(),
        url: z.string().url().optional(),
        homeType: z.enum(['house', 'condo', 'townhouse', 'multi_family', 'apartment', 'manufactured', 'lot']).optional(),
        listing_type: z.enum(['for_sale', 'sold', 'for_rent', 'pre_foreclosure', 'foreclosure', 'new_construction']).optional(),
        bed_min: z.number().int().min(0).optional(),
        bed_max: z.number().int().min(0).optional(),
        bathrooms: z.number().min(0).optional(),
        price_min: z.number().int().min(0).optional(),
        price_max: z.number().int().min(0).optional(),
        page: z.string().optional(),
      },
    },
    async (input) => {
      const proxyAction = {
        by_zipcode: 'search',
        by_city_state: 'search',
        by_coordinates: 'searchByCoordinates',
        by_bounds: 'searchByBounds',
        by_address: 'searchByAddress',
        by_url: 'searchByUrl',
      }[input.action];

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
      const listings = (data?.listings || data?.results || data?.searchResults || []).slice(0, 40);
      const summary = {
        total_results: data?.total_results,
        total_pages: data?.total_pages,
        showing: listings.length,
        action: input.action,
        listings: listings.map((l) => ({
          zpid: l.zpid,
          address: l.address || l.streetAddress,
          city: l.city,
          state: l.state,
          zipcode: l.zipcode,
          price: l.price,
          bedrooms: l.bedrooms ?? l.beds,
          bathrooms: l.bathrooms ?? l.baths,
          sqft: l.living_area_sqft ?? l.livingArea,
          days_on_zillow: l.days_on_zillow ?? l.daysOnZillow,
          status: l.listing_status ?? l.listingStatus,
          latitude: l.latitude,
          longitude: l.longitude,
          zillow_url: l.zpid ? `https://www.zillow.com/homedetails/${l.zpid}_zpid/` : (l.detail_url || l.detailUrl),
        })),
      };
      return jsonText(summary);
    }
  );

  // -----------------------------------------------------------------------
  // zillow_property
  // -----------------------------------------------------------------------
  server.registerTool(
    'zillow_property',
    {
      title: 'Get info about one Zillow property by zpid',
      description:
        'Get information about ONE specific Zillow property by its zpid. Pick the action that matches: details for the full record, photos for image URLs, comps for Zillow\'s built-in comparable-properties, zestimate for the current AI value estimate, zestimate_history for the trend over time, mortgage / mortgage_rates for financing, taxes for tax history, schools for school district info, price_history for list/sold/price-change events. Always pass a zpid from a prior zillow_search result — do not invent zpids.',
      inputSchema: {
        action: z.enum([
          'details',
          'photos',
          'comps',
          'zestimate',
          'zestimate_history',
          'mortgage',
          'mortgage_rates',
          'taxes',
          'schools',
          'price_history',
        ]),
        zpid: z.string(),
      },
    },
    async ({ action, zpid }) => {
      const map = {
        details: 'propertyDetails',
        photos: 'photos',
        comps: 'comps',
        zestimate: 'zestimate',
        zestimate_history: 'zestimateHistory',
        mortgage: 'mortgage',
        mortgage_rates: 'mortgageRates',
        taxes: 'taxes',
        schools: 'schools',
        price_history: 'priceHistory',
      };
      const data = await proxyZillow(map[action], { zpid });
      return jsonText({
        zpid,
        action,
        zillow_url: `https://www.zillow.com/homedetails/${zpid}_zpid/`,
        data,
      });
    }
  );

  // -----------------------------------------------------------------------
  // zillow_market
  // -----------------------------------------------------------------------
  server.registerTool(
    'zillow_market',
    {
      title: 'Zillow market overview & agent intel',
      description:
        'Look up market or agent intel. action=market_overview returns aggregate stats (median price, inventory, days-to-pending, year-over-year trends) for a city given a slug like "austin-tx". action=search_agents finds active agents in a location. action=agent_* returns details / current listings / sold history / reviews for one named agent. Use market_overview first when answering "is this a buyer\'s or seller\'s market?".',
      inputSchema: {
        action: z.enum([
          'market_overview',
          'search_agents',
          'agent_details',
          'agent_listings',
          'agent_sold',
          'agent_reviews',
        ]),
        slug: z.string().optional(),
        location: z.string().optional(),
        username: z.string().optional(),
        page: z.string().optional(),
      },
    },
    async (input) => {
      const map = {
        market_overview: 'market',
        search_agents: 'agentSearch',
        agent_details: 'agentDetails',
        agent_listings: 'agentListings',
        agent_sold: 'agentSold',
        agent_reviews: 'agentReviews',
      };
      const sp = {};
      if (input.action === 'market_overview') sp.slug = input.slug;
      if (input.action === 'search_agents') {
        sp.location = input.location;
        if (input.page) sp.page = input.page;
      }
      if (['agent_details', 'agent_listings', 'agent_sold', 'agent_reviews'].includes(input.action)) {
        sp.username = input.username;
      }
      const data = await proxyZillow(map[input.action], sp);
      return jsonText({ action: input.action, data });
    }
  );

  // -----------------------------------------------------------------------
  // wholesale_deal_math
  // -----------------------------------------------------------------------
  server.registerTool(
    'wholesale_deal_math',
    {
      title: 'Compute wholesale-deal numbers',
      description:
        'Compute wholesale-deal numbers for one property. Returns ARV, spread (ARV − list_price), MAO using the 70% rule (ARV × 0.70 − repairs − fee), and a deal_grade (excellent / good / fair / poor) keyed to spread thresholds. Use this after zillow_search or zillow_property to rank deals by profit potential. Pure math — no API call, instant.',
      inputSchema: {
        list_price: z.number().positive(),
        zestimate: z.number().positive(),
        repair_estimate: z.number().min(0).default(0),
        target_fee: z.number().min(0).default(10000),
      },
    },
    async ({ list_price, zestimate, repair_estimate = 0, target_fee = 10000 }) => {
      const arv = zestimate;
      const spread = arv - list_price;
      const mao = arv * 0.7 - repair_estimate - target_fee;
      const pct = list_price > 0 ? spread / list_price : 0;
      const grade =
        spread >= 50000 || pct >= 0.2 ? 'excellent' :
        spread >= 30000 || pct >= 0.12 ? 'good' :
        spread >= 15000 || pct >= 0.06 ? 'fair' : 'poor';
      return jsonText({
        list_price,
        arv,
        repair_estimate,
        target_fee,
        spread,
        spread_pct: Number(pct.toFixed(4)),
        mao,
        mao_vs_list: mao - list_price,
        deal_grade: grade,
      });
    }
  );

  return server;
}

module.exports = { buildMcpServer };
