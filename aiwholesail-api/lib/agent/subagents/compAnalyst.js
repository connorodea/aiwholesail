/**
 * run_comp_analyst — specialist subagent for fair-value comp analysis.
 *
 * Tools: zillow_property (details / comps / zestimate / zestimate_history / price_history).
 * Returns 3-6 comp listings as search_result blocks + a fair-value range.
 */

const { z } = require('zod/v4');
const { betaZodTool } = require('@anthropic-ai/sdk/helpers/beta/zod');
const { runSubagent } = require('../subagentRunner');
const { zillowProperty } = require('../tools/zillowProperty');
const { INJECTION_GUARDRAIL } = require('../../llm-prompt-safety');

const SUBAGENT_PROMPT = `You are the Comp Analyst, a specialist that produces defensible fair-value estimates for one property.

Your mission: given a zpid (or after resolving one), use zillow_property to pull details + comps + zestimate, then synthesize a defensible fair-value range with 3-6 comparable sales.

Rules:
- If the user gave a zpid, use it directly. If they gave only an address, ask the parent agent to resolve via zillow_search first — don't try to guess zpids.
- Always pull: details (subject), comps (Zillow's recommendations), zestimate, optionally zestimate_history.
- Surface 3-6 comps as search_result blocks. Each comp should include: address, sale price (or list if pending), sqft, $/sqft, distance from subject (if available), age.
- Reject comps that are >10 miles away or were sold/listed >12 months ago — say "filtered N comps for distance/age".
- Compute a fair-value range: low = 10th percentile of $/sqft × subject sqft, high = 90th percentile.
- End with 2-3 sentence summary: "Fair value $X-$Y based on N comps. Subject is currently listed at $Z, which is [under / over / at] market."
- Hard cap at 6 tool calls.${INJECTION_GUARDRAIL}`;

const inputSchema = z.object({
  zpid: z.string().describe('Zillow property ID for the subject property.'),
  context: z.string().optional().describe('Optional extra context from the user (e.g. "exclude rural comps", "focus on last 6 months").'),
});

const runCompAnalyst = betaZodTool({
  name: 'run_comp_analyst',
  description:
    'Delegate to the Comp Analyst specialist subagent. Use this when the user asks "what is X worth", "run comps on zpid X", "is this property a good price", or "give me a fair-value estimate". The subagent pulls the subject\'s details + zestimate + Zillow-recommended comps in an isolated context, filters comps by distance/recency, and returns a defensible fair-value range with 3-6 citable comps. Always pass a zpid — resolve addresses via zillow_search first if needed.',
  inputSchema,
  run: async ({ zpid, context }) => {
    const userMsg = context
      ? `Run comp analysis for zpid ${zpid}. Extra context: ${context}`
      : `Run comp analysis for zpid ${zpid}.`;
    return runSubagent({
      model: 'claude-haiku-4-5',
      system: SUBAGENT_PROMPT,
      tools: [zillowProperty],
      userContent: userMsg,
      max_iterations: 6,
    });
  },
});

module.exports = { runCompAnalyst };
