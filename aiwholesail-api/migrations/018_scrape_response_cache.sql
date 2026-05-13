-- Migration: 018 — scrape_response_cache table
--
-- We're migrating off RapidAPI's `zillow-working-api` to a self-hosted
-- scrape.do based scraper (see aiwholesail-api/lib/scrapers/). scrape.do
-- bills per request — at 10K+ daily lookups a per-request response cache
-- can roughly halve the spend.
--
-- This table is a generic response cache for any scrape.do (or other
-- per-request paid) endpoint. The wrapper in
-- aiwholesail-api/lib/scrapers/scrapeDoCache.js is provider-agnostic;
-- the `scope` column is what disambiguates one upstream from another.
--
-- Key design choices:
--  - `cache_key` is sha256(scope || ':' || canonical-json(args)) where
--    args are sorted recursively and string values lowercased. Stable
--    across argument order, casing, etc.
--  - `scope` is a coarse namespace ('zillow:propertyDetails',
--    'zillow:search', 'tps:byaddress', etc.). Lets cron sweeps and
--    parity audits filter by upstream.
--  - `body` is JSONB so we can later run parity queries inside the
--    cached payload (counts, schema drift checks, etc.) without
--    deserializing in JS first.
--  - `expires_at` is the source of truth for staleness; the cron
--    sweep (scripts/sweep-scrape-cache.js) trims rows past it.
--  - `hit_count` + `last_hit_at` are bumped fire-and-forget on every
--    hit so we have data to compute hit rate and tune TTLs later.
--  - NO foreign key — this is a standalone cache that wraps arbitrary
--    upstream fns. The cache is a cost optimization, never a hard
--    dependency: callers must tolerate a missing/stale row by
--    falling through to the live fn.

CREATE TABLE IF NOT EXISTS scrape_response_cache (
    -- sha256(scope || ':' || canonical-json(sorted, lowercased args))
    cache_key      VARCHAR(64) PRIMARY KEY,
    -- coarse namespace: 'zillow:propertyDetails', 'zillow:search',
    -- 'tps:byaddress', etc.
    scope          VARCHAR(80) NOT NULL,
    -- the cached response body. JSONB so we can query inside for
    -- parity / schema-drift checks later.
    body           JSONB NOT NULL,
    -- when this row becomes stale and should be re-fetched.
    expires_at     TIMESTAMPTZ NOT NULL,
    hit_count      INTEGER NOT NULL DEFAULT 0,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_hit_at    TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_scrape_cache_scope_expires
    ON scrape_response_cache (scope, expires_at);

CREATE INDEX IF NOT EXISTS idx_scrape_cache_expires
    ON scrape_response_cache (expires_at);

GRANT SELECT, INSERT, UPDATE, DELETE ON scrape_response_cache TO aiwholesail;
