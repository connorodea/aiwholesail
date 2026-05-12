/**
 * LLM token + cost ledger writer + month-to-date reader.
 *
 * Write path (logLlmUsage) is fire-and-forget — a DB failure here MUST NOT
 * cause the upstream LLM call to fail in the caller's eyes. We log the
 * failure and move on.
 *
 * Read path (getMonthlyUsageCents) is hot — called by middleware/llmBudget.js
 * on every gated AI request. Index idx_llm_ledger_user_created supports it.
 */

const { query } = require('../config/database');
const { computeCostCents } = require('./llm-cost');

/**
 * Append one row to the ledger.
 *
 * @param {object} args
 * @param {string} args.userId       UUID of the requesting user. Pass req.user.id.
 * @param {string} args.endpoint     Logical name, e.g. '/api/ai/property-analysis'.
 * @param {string} args.model        Exact model id returned by the upstream response.
 * @param {object} args.usage        Raw upstream usage block. Anthropic: {input_tokens, output_tokens}. OpenAI: {prompt_tokens, completion_tokens}.
 * @param {string} [args.requestId]  Optional correlation id (X-PropData-RequestId style).
 */
async function logLlmUsage({ userId, endpoint, model, usage, requestId = null }) {
  if (!userId || !usage) return; // anonymous request or malformed usage — drop silently

  // Normalize across Anthropic vs OpenAI shapes.
  const inputTokens  = Number(usage.input_tokens  ?? usage.prompt_tokens     ?? 0);
  const outputTokens = Number(usage.output_tokens ?? usage.completion_tokens ?? 0);
  if (!Number.isFinite(inputTokens) || !Number.isFinite(outputTokens)) return;
  if (inputTokens === 0 && outputTokens === 0) return; // nothing to record

  const costCents = computeCostCents(model, inputTokens, outputTokens);

  try {
    await query(
      `INSERT INTO llm_token_ledger
         (user_id, endpoint, model, input_tokens, output_tokens, cost_usd_cents, request_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [userId, endpoint, model, inputTokens, outputTokens, costCents, requestId]
    );
  } catch (err) {
    // Fire-and-forget — emit a structured log line so an APM can alert
    // on sustained write failures (which means budgets would silently fail
    // OPEN if the middleware also goes through this path — see llmBudget.js
    // for the read-path behavior).
    console.error(JSON.stringify({
      level: 'error',
      scope: 'lib.llm-usage.logLlmUsage',
      event: 'ledger_insert_failed',
      user_id: userId,
      endpoint,
      model,
      error: err.message,
    }));
  }
}

/**
 * Month-to-date USD cost (cents) for a user.
 *
 * Returns 0 on DB error rather than throwing — the middleware that calls
 * this is allowed to fail open. See llmBudget.js for the rationale.
 */
async function getMonthlyUsageCents(userId) {
  if (!userId) return 0;
  try {
    const r = await query(
      `SELECT COALESCE(SUM(cost_usd_cents), 0)::int AS cents
         FROM llm_token_ledger
        WHERE user_id = $1
          AND created_at >= date_trunc('month', NOW())`,
      [userId]
    );
    return r.rows[0]?.cents || 0;
  } catch (err) {
    console.error(JSON.stringify({
      level: 'error',
      scope: 'lib.llm-usage.getMonthlyUsageCents',
      event: 'ledger_read_failed',
      user_id: userId,
      error: err.message,
    }));
    return 0;
  }
}

module.exports = { logLlmUsage, getMonthlyUsageCents };
