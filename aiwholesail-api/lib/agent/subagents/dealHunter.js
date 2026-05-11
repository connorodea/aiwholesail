/**
 * run_deal_hunter — specialist subagent for finding wholesale deals.
 *
 * Spins up an isolated Haiku Tool Runner with only zillow_search +
 * wholesale_deal_math. Returns the subagent's final content blocks
 * (search_result[] for citations + summary text) to the parent router.
 *
 * Parent context stays small — router never sees the raw 30-listing
 * search response, only the curated top-N deals.
 */

const { z } = require('zod/v4');
const { betaZodTool } = require('@anthropic-ai/sdk/helpers/beta/zod');
const { runSubagent } = require('../subagentRunner');
const { zillowSearch } = require('../tools/zillowSearch');
const { wholesaleDealMath } = require('../tools/wholesaleDealMath');

const SUBAGENT_PROMPT = `You are the Deal Hunter, a specialist that finds the best wholesale real-estate deals in a given market.

Your mission: given a location (ZIP, city, coordinates), return the top 3-5 properties with the largest spread between list price and zestimate. Use zillow_search to fetch listings, then call wholesale_deal_math on the best candidates to compute MAO and deal grade.

Rules:
- Always call zillow_search first. Default homeType to "house" unless the user said otherwise.
- Filter out listings with no zestimate (you can't compute spread without one).
- Sort by spread descending. Surface only the top 3-5.
- For each surfaced deal, return a search_result block (Zillow URL) + a one-line summary that includes: address, list price, zestimate, spread $/% , bedrooms/baths/sqft, days on market.
- End with a 1-2 sentence overall summary ("Best deal is X with $40K spread...").
- Never fabricate listings, prices, or zpids. If zillow_search returns 0, say so plainly.
- Hard cap at 6 tool calls. If you can't answer in 6, give what you have.`;

const inputSchema = z.object({
  query: z.string().describe('User\'s natural-language deal-finding request. Pass through unmodified — e.g. "find me 3+ bed deals in 48371 under $400k".'),
});

const runDealHunter = betaZodTool({
  name: 'run_deal_hunter',
  description:
    'Delegate to the Deal Hunter specialist subagent. Use this whenever the user wants to FIND wholesale-quality deals in a market (e.g. "find deals in 48371", "show me undervalued houses in Austin", "what\'s the best deal under $300k in Detroit"). The subagent runs zillow_search + wholesale_deal_math in an isolated context and returns the top 3-5 deals with citations linking to Zillow. Faster and cheaper than running these tools yourself.',
  inputSchema,
  run: async ({ query }) =>
    runSubagent({
      model: 'claude-haiku-4-5',
      system: SUBAGENT_PROMPT,
      tools: [zillowSearch, wholesaleDealMath],
      userContent: query,
      max_iterations: 6,
    }),
});

module.exports = { runDealHunter };
