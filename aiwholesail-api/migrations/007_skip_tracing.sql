-- Migration: Skip tracing
-- Adds:
--   * skip_trace_lookups   — per-user query history (dedup + monthly quota source)
--   * skip_trace_details   — peo_id-keyed person details cache (shared across users)
--
-- Skip tracing hits a paid RapidAPI endpoint (skip-tracing-working-api). Caching
-- on the search side is opportunistic (we de-dup an identical query within a
-- short window per user); caching on the details side is shared because peo_id
-- → person record is stable for weeks.
--
-- Quota model: count rows in skip_trace_lookups for the calling user across the
-- current calendar month. Pro = 25/mo, Elite = 200/mo. Trial / no-sub blocked
-- in middleware. See routes/skipTrace.js for enforcement.

-- ───────────── Lookups (per-user history + quota source) ─────────────
CREATE TABLE IF NOT EXISTS skip_trace_lookups (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    -- One of: byname, byaddress, bynameaddress, byphone, byemail, detailsbyID
    search_type VARCHAR(32) NOT NULL,
    -- Stable hash of (search_type + normalized params) for dedup
    query_hash VARCHAR(64) NOT NULL,
    -- The original params we sent to the upstream API (for debugging + replay)
    query_params JSONB NOT NULL DEFAULT '{}'::jsonb,
    -- Result count surfaced to the user (people / records returned)
    result_count INTEGER DEFAULT 0,
    -- The full upstream response, trimmed of unused fields
    result JSONB,
    -- All peo_ids we surfaced — useful for "view details" without re-paying
    peo_ids TEXT[] DEFAULT '{}',
    -- Cost accounting
    upstream_status INTEGER,        -- HTTP status from RapidAPI
    upstream_error TEXT,            -- truncated error if status != 2xx
    served_from_cache BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_skip_trace_lookups_user_created
    ON skip_trace_lookups(user_id, created_at DESC);

-- For monthly-quota count: a partial index keeps it tight
CREATE INDEX IF NOT EXISTS idx_skip_trace_lookups_user_month
    ON skip_trace_lookups(user_id, created_at)
    WHERE served_from_cache = false;

-- For dedup: same user, same query, recent
CREATE INDEX IF NOT EXISTS idx_skip_trace_lookups_user_query_hash
    ON skip_trace_lookups(user_id, query_hash, created_at DESC);

-- ───────────── Person details cache (shared across users) ─────────────
CREATE TABLE IF NOT EXISTS skip_trace_details (
    peo_id VARCHAR(64) PRIMARY KEY,
    data JSONB NOT NULL,
    fetched_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    -- Hits counter — informs whether we should refresh stale entries
    hit_count INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_skip_trace_details_fetched_at
    ON skip_trace_details(fetched_at DESC);
