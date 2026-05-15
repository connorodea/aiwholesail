-- 030_rapidapi_request_metrics.sql
--
-- Per-minute rollup of /rapidapi/zillow/* request counts + latency,
-- broken out by status code and 401-source. Feeds the alert evaluator
-- in lib/observability/rapidapi-alerts.js (TD-002 in
-- aiwholesail-rapidapi/docs/tech-debt.md).
--
-- The cron worker (scripts/rapidapi-alert-worker.js) writes one row
-- per minute summarising the access-log window. The evaluator reads
-- aggregated windows (5min / 15min / 1h) computed via plain SQL.

CREATE TABLE IF NOT EXISTS rapidapi_request_metrics (
    id                            BIGSERIAL PRIMARY KEY,
    -- Minute boundary the rollup covers (truncated to :00 seconds).
    bucket_minute                 TIMESTAMPTZ NOT NULL,
    requests_total                INTEGER NOT NULL DEFAULT 0,
    requests_2xx                  INTEGER NOT NULL DEFAULT 0,
    requests_3xx                  INTEGER NOT NULL DEFAULT 0,
    -- 401 broken into the two distinct sources so W6 can distinguish:
    --   our middleware (proxy-secret mismatch) vs RapidAPI's gateway
    --   (consumer-side bad X-RapidAPI-Key)
    requests_401_our_middleware   INTEGER NOT NULL DEFAULT 0,
    requests_401_rapidapi_gateway INTEGER NOT NULL DEFAULT 0,
    requests_403                  INTEGER NOT NULL DEFAULT 0,
    requests_4xx_other            INTEGER NOT NULL DEFAULT 0,
    requests_5xx                  INTEGER NOT NULL DEFAULT 0,
    -- C5 carve-out: 503 with body containing "Gateway not configured".
    -- This means RAPIDAPI_PROXY_SECRET env is unset — different remediation
    -- from generic 5xx, must page immediately not just burn-budget alert.
    requests_503_gateway_unconfigured INTEGER NOT NULL DEFAULT 0,
    -- Latency percentiles in ms, computed from the bucket's request samples.
    p50_latency_ms                INTEGER,
    p95_latency_ms                INTEGER,
    p99_latency_ms                INTEGER,
    -- When the row was written (for lag detection in collector health).
    inserted_at                   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(bucket_minute)
);

-- Index for the hot path: alert evaluator queries the most recent window.
CREATE INDEX IF NOT EXISTS idx_rapidapi_metrics_bucket
    ON rapidapi_request_metrics (bucket_minute DESC);

-- GRANT to the aiwholesail role (per the global rule:
-- migrations must GRANT new tables to aiwholesail role, or the live API
-- silently 500s with "permission denied").
GRANT SELECT, INSERT, UPDATE, DELETE ON rapidapi_request_metrics TO aiwholesail;
GRANT USAGE, SELECT ON SEQUENCE rapidapi_request_metrics_id_seq TO aiwholesail;
