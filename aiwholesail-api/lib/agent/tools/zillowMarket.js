/**
 * zillow_market — market intel + agent profile tool.
 *
 * Two actions:
 *   market_overview  — slug like "austin-tx", returns aggregate market stats
 *   agent_details    — single agent by Zillow username
 *
 * Earlier scope (search_agents / agent_listings / agent_sold / agent_reviews)
 * has no scrape.do equivalent and was previously served only by the now-
 * removed RapidAPI proxy. Re-add when a scrape.do handler exists.
 */

const { z } = require('zod/v4');
const { betaZodTool } = require('@anthropic-ai/sdk/helpers/beta/zod');
const { proxyZillow } = require('../zillowProxy');
const { sanitizeRecord } = require('../sanitize');

const inputSchema = z.object({
  action: z.enum([
    'market_overview',
    'agent_details',
  ]).describe('Which market or agent endpoint to call.'),

  slug: z.string().optional()
    .describe('Required for market_overview. Format: "city-state" lowercase, e.g. "austin-tx", "oxford-mi".'),
  username: z.string().optional()
    .describe('Required for agent_details. The agent\'s Zillow username (URL slug).'),
});

const ACTION_TO_PROXY = {
  market_overview: 'marketStats',
  agent_details: 'agentProfile',
};

const zillowMarket = betaZodTool({
  name: 'zillow_market',
  description:
    'Look up market or agent intel on Zillow. action=market_overview returns aggregate stats (median price, inventory, days-to-pending, year-over-year trends) for a city given a slug like "austin-tx". action=agent_details returns the profile for one named agent given their Zillow username. Use market_overview first when answering "is this a buyer\'s or seller\'s market?".',
  inputSchema,
  run: async (input) => {
    const sp = {};
    if (input.action === 'market_overview') sp.slug = input.slug;
    if (input.action === 'agent_details') sp.username = input.username;

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
        : `Zillow ${input.action} — ${input.username || ''}`;

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
