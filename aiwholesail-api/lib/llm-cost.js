/**
 * LLM pricing + per-tier monthly budget caps.
 *
 * ⚠️ THIS IS THE FILE TO EDIT IF YOU WANT TO TUNE CAPS OR ADD MODELS. ⚠️
 *
 * Costs are tracked in USD cents at write time to avoid float drift across
 * the SUM aggregation that runs on every gated AI request.
 *
 * --- Pricing source (all per 1M tokens, USD) ---
 *   claude-sonnet-4-6 : $3 input / $15 output  (Anthropic public pricing)
 *   claude-haiku-4-5  : $1 input / $5  output  (subagents)
 *   gpt-4.1           : $2 input / $8  output  (photo / vision)
 *   gpt-5.4-mini      : $0.25 input / $2 output (rank-deals structured output)
 *
 * Update these alongside any model migration; the costs are tagged to the
 * exact `model` string returned by the upstream API so the ledger keeps
 * historical accuracy even if pricing changes later.
 *
 * --- Tier cap math ---
 * Revenue: Pro $49/mo, Elite $99/mo. Target LLM cost as a fraction of
 * revenue for unit economics:
 *
 *   None       — $0   (no access)
 *   Trial      — $2/mo  (sample the value; trial is 7 days but we cap monthly)
 *   Pro        — $9/mo   (~18% of revenue → leaves margin for infra/team)
 *   Elite      — $30/mo  (~30% of revenue → power users get headroom)
 *
 * These caps cover the worst-case mix (all Sonnet output). In practice,
 * most calls are short structured outputs so a Pro user can do ~3-4× the
 * raw token equivalent before hitting the cap.
 *
 * Tune the numbers below and redeploy — no schema change required.
 */

const TIER_MONTHLY_CAP_CENTS = Object.freeze({
  none:  0,
  trial: 200,    // $2 / month — sample budget for trial users
  Pro:   900,    // $9 / month
  Elite: 3000,   // $30 / month
});

// Per-model pricing in USD cents per 1M tokens. The numerator on each side
// is the wholesale list price; the divisor is hardcoded so multiplying
// `input_tokens / 1_000_000 * INPUT_CENTS_PER_MTOK` yields the cost.
const MODEL_PRICING_CENTS_PER_MTOK = Object.freeze({
  // --- Anthropic Claude ---
  'claude-sonnet-4-6':       { input:  300, output: 1500 },
  'claude-sonnet-4-7':       { input:  300, output: 1500 }, // hypothetical bump — same as 4.6 until Anthropic publishes
  'claude-haiku-4-5':        { input:  100, output:  500 },
  'claude-haiku-4-5-20251001': { input: 100, output:  500 }, // dated variant — same family

  // --- OpenAI ---
  'gpt-4.1':                 { input:  200, output:  800 },
  'gpt-4.1-mini':            { input:   15, output:   60 },
  'gpt-5.4-mini':            { input:   25, output:  200 },
  'gpt-5':                   { input:  200, output: 1000 },
});

// Fallback used when an unknown model surfaces. Set to a conservative-high
// price so unknown-model usage isn't free, but doesn't catastrophically
// drain the user's budget either.
const UNKNOWN_MODEL_PRICING = Object.freeze({ input: 300, output: 1500 });

/**
 * Convert tokens to USD cents for a given model.
 * Always rounds up to the nearest cent so users never get free fractional cents.
 */
function computeCostCents(model, inputTokens, outputTokens) {
  const price = MODEL_PRICING_CENTS_PER_MTOK[model] || UNKNOWN_MODEL_PRICING;
  const inCents  = (inputTokens  / 1_000_000) * price.input;
  const outCents = (outputTokens / 1_000_000) * price.output;
  return Math.ceil(inCents + outCents);
}

/**
 * Resolve the monthly budget cap for an effective tier value.
 * Mirrors middleware/subscription.js TIERS — Trial is treated as Pro-like
 * for tier gating BUT gets its own (lower) LLM budget here so we don't
 * subsidize trial abuse.
 */
function capCentsForTier(tier) {
  if (tier in TIER_MONTHLY_CAP_CENTS) return TIER_MONTHLY_CAP_CENTS[tier];
  // Fall through: unrecognized tier = no access (safer than overspending).
  return 0;
}

module.exports = {
  TIER_MONTHLY_CAP_CENTS,
  MODEL_PRICING_CENTS_PER_MTOK,
  computeCostCents,
  capCentsForTier,
};
