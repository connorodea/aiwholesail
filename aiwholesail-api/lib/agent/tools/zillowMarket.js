/**
 * zillow_market — market intel + agent directory tool.
 *
 * Six actions:
 *   market_overview  — slug like "austin-tx", returns aggregate market stats
 *   search_agents    — find agents by city (e.g. "Austin TX")
 *   agent_details    — single agent by Zillow username
 *   agent_listings   — active listings of one agent
 *   agent_sold       — sold listings of one agent
 *   agent_reviews    — reviews of one agent
 */

const { z } = require('zod/v4');
const { betaZodTool } = require('@anthropic-ai/sdk/helpers/beta/zod');
const { proxyZillow } = require('../zillowProxy');
const { sanitizeRecord } = require('../sanitize');

const inputSchema = z.object({
  action: z.enum([
    'market_overview',
    'search_agents',
    'agent_details',
    'agent_listings',
    'agent_sold',
    'agent_reviews',
  ]).describe('Which market or agent endpoint to call.'),

  slug: z.string().optional()
    .describe('Required for market_overview. Format: "city-state" lowercase, e.g. "austin-tx", "oxford-mi".'),
  location: z.string().optional()
    .describe('Required for search_agents. e.g. "Austin TX".'),
  username: z.string().optional()
    .describe('Required for agent_* actions. The agent\'s Zillow username (URL slug).'),
  page: z.string().optional().describe('Pagination, default "1".'),
});

const ACTION_TO_PROXY = {
  market_overview: 'market',
  search_agents: 'agentSearch',
  agent_details: 'agentDetails',
  agent_listings: 'agentListings',
  agent_sold: 'agentSold',
  agent_reviews: 'agentReviews',
};

const zillowMarket = betaZodTool({
  name: 'zillow_market',
  description:
    'Look up market or agent intel on Zillow. action=market_overview returns aggregate stats (median price, inventory, days-to-pending, year-over-year trends) for a city given a slug like "austin-tx". action=search_agents finds active agents in a location. action=agent_* returns details / current listings / sold history / reviews for one named agent. Use market_overview first when answering "is this a buyer\'s or seller\'s market?". For agent research, search_agents first to find usernames, then agent_details / agent_sold to drill in.',
  inputSchema,
  run: async (input) => {
    const sp = {};
    if (input.action === 'market_overview') sp.slug = input.slug;
    if (input.action === 'search_agents') {
      sp.location = input.location;
      if (input.page) sp.page = input.page;
    }
    if (['agent_details', 'agent_listings', 'agent_sold', 'agent_reviews'].includes(input.action)) {
      sp.username = input.username;
    }

    const data = sanitizeRecord(await proxyZillow(ACTION_TO_PROXY[input.action], sp));
    const sourceUrl =
      input.action === 'market_overview'
        ? `https://www.zillow.com/${input.slug}/`
        : input.username
        ? `https://www.zillow.com/profile/${input.username}/`
        : 'https://www.zillow.com/';
    const title =
      input.action === 'market_overview'
        ? `Market overview — ${input.slug}`
        : `Zillow ${input.action} — ${input.username || input.location || ''}`;

    return [
      {
        type: 'search_result',
        source: sourceUrl,
        title,
        content: [
          { type: 'text', text: typeof data === 'string' ? data : JSON.stringify(data, null, 2) },
        ],
        citations: { enabled: true },
      },
    ];
  },
});

module.exports = { zillowMarket };
