/**
 * wholesale_deal_math — pure calculation, no API call.
 *
 * Given a property's list price + zestimate + (optional) repair estimate,
 * computes the classic wholesale-deal numbers:
 *
 *   ARV        = after-repair value (we use zestimate as the proxy)
 *   spread     = ARV - list_price
 *   MAO        = (ARV × 0.70) - repair_estimate - target_fee   ← "70% rule"
 *   deal_grade = excellent | good | fair | poor (by spread thresholds)
 *
 * This is the same math implemented in src/lib/motivated-seller-score.ts
 * and the DealMathPanel UI. Centralizing it as a tool means the agent
 * answers and the UI calculators stay consistent.
 */

const { z } = require('zod/v4');
const { betaZodTool } = require('@anthropic-ai/sdk/helpers/beta/zod');

const inputSchema = z.object({
  list_price: z.number().positive().describe('Current asking price in USD.'),
  zestimate: z.number().positive().describe('Zillow zestimate (used as ARV proxy).'),
  repair_estimate: z.number().min(0).default(0)
    .describe('Estimated rehab cost in USD. Default 0 for cosmetic-only.'),
  target_fee: z.number().min(0).default(10000)
    .describe('Wholesaler\'s target assignment fee in USD. Default $10,000.'),
});

function gradeFromSpread(spread, listPrice) {
  if (!listPrice || listPrice <= 0) return 'unknown';
  const pct = spread / listPrice;
  if (spread >= 50000 || pct >= 0.20) return 'excellent';
  if (spread >= 30000 || pct >= 0.12) return 'good';
  if (spread >= 15000 || pct >= 0.06) return 'fair';
  return 'poor';
}

const wholesaleDealMath = betaZodTool({
  name: 'wholesale_deal_math',
  description:
    'Compute wholesale-deal numbers for one property. Takes list_price + zestimate (required) and optionally repair_estimate + target_fee. Returns ARV, spread (ARV − list_price), MAO using the 70% rule (ARV × 0.70 − repairs − fee), and a deal_grade (excellent / good / fair / poor) keyed to spread thresholds. Use this after zillow_search or zillow_property returns to rank deals by profit potential. Pure math — no API call, instant.',
  inputSchema,
  run: async ({ list_price, zestimate, repair_estimate, target_fee }) => {
    const arv = zestimate;
    const spread = arv - list_price;
    const mao = arv * 0.7 - repair_estimate - target_fee;
    const grade = gradeFromSpread(spread, list_price);
    const out = {
      list_price,
      arv,
      repair_estimate,
      target_fee,
      spread,
      spread_pct: list_price > 0 ? Number((spread / list_price).toFixed(4)) : null,
      mao,
      mao_vs_list: mao - list_price,
      deal_grade: grade,
      summary: `Spread $${spread.toLocaleString()} (${list_price > 0 ? (spread / list_price * 100).toFixed(1) : '?'}%) · MAO $${Math.round(mao).toLocaleString()} · grade: ${grade}`,
    };
    return JSON.stringify(out);
  },
});

module.exports = { wholesaleDealMath };
