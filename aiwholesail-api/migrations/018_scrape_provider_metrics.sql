-- Migration: 018 — scrape_provider_metrics
--
-- Append-only event log that records every outbound call to a Zillow / TPS
-- backend (RapidAPI or self-hosted scrape.do). Built ahead of the migration
-- away from RapidAPI so that the "cancel the RapidAPI subscription"
-- decision can be made on hard numbers instead of vibes:
--
--   * How often is each backend being called?
--   * What's the success rate of scrape.do vs RapidAPI?
--   * Latency p50 / p95 per backend?
--   * How often is the fallback actually catching a primary failure?
--
-- The helper that writes here (lib/observability/scrapeMetrics.js) does the
-- insert with setImmediate so metric writes NEVER block the user-facing
-- request. Metric loss on a DB blip is acceptable; user-facing latency or
-- 500s from a metric write are not.
--
-- This table is intentionally narrow — short string codes, no JSON blobs.
-- If we need richer payloads later we can join from another table; for now
-- the goal is "cheap enough to log every call".
--
-- Lessons-learned from PR #131: migrations run as the postgres superuser,
-- but the API connects as `aiwholesail`. Without an explicit GRANT, every
-- read/write fails with "permission denied". Both the table AND its
-- sequence need to be granted, otherwise INSERTs fail on nextval().

CREATE TABLE IF NOT EXISTS scrape_provider_metrics (
  id BIGSERIAL PRIMARY KEY,
  -- 'rapidapi-zillow' | 'scrape-do-zillow' | 'rapidapi-tps' | 'scrape-do-tps'
  provider VARCHAR(40) NOT NULL,
  -- the action name (propertyDetails, photos, search, etc) — keep it short
  action VARCHAR(60) NOT NULL,
  -- 'primary' | 'fallback' | 'dogfood-primary'
  call_kind VARCHAR(20) NOT NULL,
  -- did it succeed at returning usable data?
  success BOOLEAN NOT NULL,
  -- ms; null on hard timeouts the caller couldn't measure
  duration_ms INTEGER,
  -- short error message (truncate to 200) when success=false; null otherwise
  error_excerpt VARCHAR(200),
  -- HTTP status from upstream, when applicable
  http_status INTEGER,
  -- which user triggered (null for anonymous or background jobs)
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Hot-path: "last N minutes of activity" for the admin snapshot endpoint.
CREATE INDEX IF NOT EXISTS idx_scrape_metrics_created_at
  ON scrape_provider_metrics (created_at DESC);

-- Cross-cohort: "success rate / latency for provider X action Y over a window".
CREATE INDEX IF NOT EXISTS idx_scrape_metrics_provider_action
  ON scrape_provider_metrics (provider, action, created_at DESC);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'aiwholesail') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON scrape_provider_metrics TO aiwholesail;
    GRANT USAGE, SELECT ON SEQUENCE scrape_provider_metrics_id_seq TO aiwholesail;
  END IF;
END$$;
