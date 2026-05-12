/**
 * run_seller_motivator — specialist subagent that scores one property's
 * seller motivation 0-100. No tools — pure reasoning over a property JSON.
 *
 * Mirrors the rubric in src/lib/motivated-seller-score.ts so the agent's
 * answers stay consistent with the in-UI scoring panel.
 */

const { z } = require('zod/v4');
const { betaZodTool } = require('@anthropic-ai/sdk/helpers/beta/zod');
const { runSubagent } = require('../subagentRunner');
const { zillowProperty } = require('../tools/zillowProperty');
const { INJECTION_GUARDRAIL } = require('../../llm-prompt-safety');

const SUBAGENT_PROMPT = `You are the Seller Motivator, a specialist that scores one property's seller motivation on a 0-100 scale.

Scoring rubric (mirror src/lib/motivated-seller-score.ts):
- FSBO listing → +30
- Days on market > 90 → +20, > 180 → +30
- Price cut count: 1 → +10, 2 → +20, 3+ → +30
- Pre-foreclosure / foreclosure / auction → +25
- "Motivated seller" / "must sell" / "as-is" / "cash only" / "estate sale" in description → +15
- Vacancy clues in photos or description → +10
- Out-of-state owner (if known from skip-trace) → +10

Tiers:
- 70-100: HIGH (call them today)
- 50-69: MEDIUM (worth a soft outreach)
- 30-49: LOW (monitor)
- 0-29: NONE (no signal)

Your output MUST be JSON: { "score": 0-100, "tier": "HIGH"|"MEDIUM"|"LOW"|"NONE", "signals": [string], "rationale": "1-2 sentences" }.

If you don't have enough data to score (no zpid, no details), call zillow_property action=details first. Then output the score.${INJECTION_GUARDRAIL}`;

const inputSchema = z.object({
  zpid: z.string().describe('Zillow property ID. The subagent will pull details automatically if not already provided.'),
});

const runSellerMotivator = betaZodTool({
  name: 'run_seller_motivator',
  description:
    'Delegate to the Seller Motivator specialist subagent. Use this when the user asks "how motivated is this seller", "is the owner desperate", or "should I make a low-ball offer". The subagent pulls property details and applies the same scoring rubric used in the in-app Motivated Seller panel: FSBO, DOM, price cuts, pre-foreclosure, distressed keywords. Returns a JSON object with score (0-100), tier (HIGH/MEDIUM/LOW/NONE), signals list, and a 1-2 sentence rationale.',
  inputSchema,
  run: async ({ zpid }) =>
    runSubagent({
      model: 'claude-haiku-4-5',
      system: SUBAGENT_PROMPT,
      tools: [zillowProperty],
      userContent: `Score the seller motivation for zpid ${zpid}. Return JSON only.`,
      max_iterations: 3,
      max_tokens: 800,
    }),
});

module.exports = { runSellerMotivator };
