/**
 * zillow_property — single-property lookup tool.
 *
 * Wraps the proxy's per-zpid endpoints under one tool with an action enum:
 *   details            — full property record (price, sqft, beds, etc.)
 *   photos             — image URLs
 *   comps              — similar nearby properties (Zillow's own algorithm)
 *   zestimate          — current zestimate + low/high range
 *   zestimate_history  — historical zestimate trend
 *   mortgage_rates     — current mortgage rate quotes
 *   taxes              — tax history
 *   schools            — school district + ratings
 *   price_history      — list/relist/price-change/sold events
 *
 * Returns a single search_result block whose source is the Zillow detail URL,
 * plus a text block with the proxy's raw JSON for the model to reason over.
 */

const { z } = require('zod/v4');
const { betaZodTool } = require('@anthropic-ai/sdk/helpers/beta/zod');
const { proxyZillow } = require('../zillowProxy');
const { sanitizeRecord } = require('../sanitize');

const inputSchema = z.object({
  action: z.enum([
    'details',
    'photos',
    'comps',
    'zestimate',
    'zestimate_history',
    'mortgage_rates',
    'taxes',
    'schools',
    'price_history',
  ]).describe('Which per-property endpoint to call.'),
  zpid: z.string().describe('Zillow property ID (numeric string). Get this from a prior zillow_search result.'),
});

const ACTION_TO_PROXY = {
  details: 'propertyDetails',
  photos: 'photos',
  comps: 'comps',
  zestimate: 'zestimate',
  zestimate_history: 'zestimateHistory',
  mortgage_rates: 'mortgageRates',
  taxes: 'taxes',
  schools: 'schools',
  price_history: 'priceHistory',
};

const zillowProperty = betaZodTool({
  name: 'zillow_property',
  description:
    'Get information about ONE specific Zillow property by its zpid. Pick the action that matches what you need: details for the full record, photos for images, comps for Zillow\'s built-in comparable-properties recommendation, zestimate for the current AI-estimated value, zestimate_history for the trend over time, mortgage_rates for financing math, taxes for tax-history, schools for school district info, price_history for list/sold/price-change events. Always pass the zpid from a prior zillow_search result — do not invent zpids.',
  inputSchema,
  run: async ({ action, zpid }) => {
    const data = await proxyZillow(ACTION_TO_PROXY[action], { zpid });
    // Defense in depth: sanitize free-text fields (description, agent bio,
    // school reviews, etc.) before embedding in tool_result. Caps each field
    // and strips control / bidi-override chars that have no business in a
    // real listing record.
    const safeData = sanitizeRecord(data);
    const sourceUrl = `https://www.zillow.com/homedetails/${encodeURIComponent(zpid)}_zpid/`;
    const title = `Zillow ${action} — zpid ${zpid}`;

    return [
      {
        type: 'search_result',
        source: sourceUrl,
        title,
        content: [
          {
            type: 'text',
            text: typeof safeData === 'string' ? safeData : JSON.stringify(safeData, null, 2),
          },
        ],
        citations: { enabled: true },
      },
    ];
  },
});

module.exports = { zillowProperty };
