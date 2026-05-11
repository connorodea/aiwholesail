/**
 * run_market_watcher — specialist subagent for "is this a buyer's or seller's market" questions.
 *
 * Tools: zillow_market (market_overview, agent_*) + zillow_search for inventory checks.
 */

const { z } = require('zod/v4');
const { betaZodTool } = require('@anthropic-ai/sdk/helpers/beta/zod');
const Anthropic = require('@anthropic-ai/sdk');
const { zillowMarket } = require('../tools/zillowMarket');
const { zillowSearch } = require('../tools/zillowSearch');

const SUBAGENT_PROMPT = `You are the Market Watcher, a specialist that answers market-condition questions for one geography.

Your mission: given a city or ZIP, decide whether it's a buyer's market, seller's market, or balanced, and back it up with 2-3 concrete metrics.

Rules:
- Always start with zillow_market action=market_overview (slug format: "city-state" lowercase, e.g. "austin-tx").
- If the user wants ZIP-level intel, also call zillow_search action=by_zipcode to see active inventory + days on market.
- Keep your answer to 3 bullets + 1 verdict line: "Buyer's market" / "Seller's market" / "Balanced".
- Cite the market_overview source URL.
- Hard cap at 4 tool calls.`;

const inputSchema = z.object({
  location: z.string().describe('City, state, or ZIP. Examples: "Austin TX", "austin-tx", "48371", "Detroit MI".'),
});

function normalizeSlug(loc) {
  // Convert "Austin TX" / "Austin, TX" / etc to "austin-tx"
  const clean = String(loc).toLowerCase().replace(/,/g, '').trim();
  return clean.replace(/\s+/g, '-');
}

const runMarketWatcher = betaZodTool({
  name: 'run_market_watcher',
  description:
    'Delegate to the Market Watcher specialist subagent. Use this whenever the user asks about market conditions in a geography: "is Austin a buyer\'s or seller\'s market", "how\'s the Detroit market", "what\'s inventory like in 48371", etc. The subagent pulls market_overview + (optionally) ZIP-level inventory in an isolated context and returns a 3-bullet verdict with citations. Faster than calling zillow_market yourself.',
  inputSchema,
  run: async ({ location }) => {
    const slug = normalizeSlug(location);
    const userMsg = `Tell me the market condition for ${location} (slug: ${slug}). If looks like a ZIP, also check ZIP-level inventory.`;
    const client = new Anthropic.Anthropic();
    const result = await client.beta.messages.toolRunner({
      model: 'claude-haiku-4-5',
      max_tokens: 1000,
      system: SUBAGENT_PROMPT,
      tools: [zillowMarket, zillowSearch],
      messages: [{ role: 'user', content: userMsg }],
      max_iterations: 4,
    });
    return result.content || [];
  },
});

module.exports = { runMarketWatcher };
