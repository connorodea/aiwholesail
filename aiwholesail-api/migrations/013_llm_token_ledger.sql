-- LLM token + cost ledger — per-user, per-call line items.
--
-- One row per LLM call (Claude / OpenAI). Stores both the raw tokens
-- and the precomputed USD cost in cents. Cents lets us SUM in pure SQL
-- without floating-point drift across thousands of rows.
--
-- Used by middleware/llmBudget.js to gate user requests when their
-- month-to-date spend exceeds the tier cap defined in lib/llm-cost.js.
--
-- We log AFTER the upstream call, not before, so failed/aborted requests
-- don't burn the user's budget. The trade-off: a determined user firing
-- many parallel requests could briefly exceed the cap by (concurrency × avg
-- cost-per-call), since each request checks the budget BEFORE writing.
-- Acceptable — concurrency is implicitly capped by node + per-route
-- rate limits.

CREATE TABLE IF NOT EXISTS llm_token_ledger (
  id              BIGSERIAL PRIMARY KEY,
  user_id         UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  endpoint        TEXT        NOT NULL,        -- '/api/ai/property-analysis', '/api/ai/agent/chat', etc.
  model           TEXT        NOT NULL,        -- 'claude-sonnet-4-6', 'gpt-5.4-mini', etc.
  input_tokens    INTEGER     NOT NULL CHECK (input_tokens  >= 0),
  output_tokens   INTEGER     NOT NULL CHECK (output_tokens >= 0),
  cost_usd_cents  INTEGER     NOT NULL CHECK (cost_usd_cents >= 0),
  request_id      TEXT        NULL,            -- optional correlation id (X-PropData-RequestId style)
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Hot path: "month-to-date cost for user X".
-- This index supports the SUM query in middleware/llmBudget.js and
-- the /api/auth/me budget block.
CREATE INDEX IF NOT EXISTS idx_llm_ledger_user_created
  ON llm_token_ledger (user_id, created_at DESC);

-- Secondary: model + endpoint analytics ("what's costing us most this month").
CREATE INDEX IF NOT EXISTS idx_llm_ledger_endpoint_model_created
  ON llm_token_ledger (endpoint, model, created_at DESC);

COMMENT ON TABLE  llm_token_ledger IS 'Per-call LLM token + cost ledger. One row per Claude/OpenAI call. See lib/llm-cost.js for cap config and lib/llm-usage.js for the logger.';
COMMENT ON COLUMN llm_token_ledger.cost_usd_cents IS 'Precomputed at write time using lib/llm-cost.js prices. Stored as cents to avoid float drift in SUM aggregations.';
COMMENT ON COLUMN llm_token_ledger.endpoint IS 'Route path or logical name. Free-form text; group by this for per-feature spend reporting.';
