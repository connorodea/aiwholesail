-- Migration: foreclosure scraper schema
-- Tables:
--   * foreclosure_records — canonical NOD / LP / NTS / REO entries
--   * scrape_jobs         — per-run audit log
--   * county_configs      — runtime config (URLs, selectors, cron, rate limits)
--
-- Dedup key on records is (external_id, county, state, record_type). On conflict
-- we update mutable fields and bump updated_at, but never touch created_at.
--
-- NOTE: this migration runs as the postgres superuser, but the live API connects
-- as the aiwholesail role. Without the GRANT block at the bottom, every query
-- from the API process 500s with "permission denied for table X". This is the
-- same footgun caught post-shipment of aiwholesail-api PR #131.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- ───────────── foreclosure_records ─────────────
CREATE TABLE IF NOT EXISTS foreclosure_records (
    id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    external_id       TEXT NOT NULL,
    county            TEXT NOT NULL,
    state             CHAR(2) NOT NULL,
    record_type       TEXT NOT NULL CHECK (record_type IN ('NOD', 'LP', 'NTS', 'REO')),
    parcel_number     TEXT,
    property_address  TEXT,
    owner_name        TEXT,
    lender_name       TEXT,
    default_amount    NUMERIC(14, 2),
    recorded_date     DATE,
    sale_date         DATE,
    case_number       TEXT,
    trustee_info      JSONB,
    raw_data          JSONB NOT NULL DEFAULT '{}'::jsonb,
    source_url        TEXT NOT NULL,
    snapshot_key      TEXT,
    scraped_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT foreclosure_records_dedup UNIQUE (external_id, county, state, record_type)
);

CREATE INDEX IF NOT EXISTS idx_foreclosure_records_county_state_type
    ON foreclosure_records (county, state, record_type);
CREATE INDEX IF NOT EXISTS idx_foreclosure_records_recorded_date
    ON foreclosure_records (recorded_date DESC);
CREATE INDEX IF NOT EXISTS idx_foreclosure_records_sale_date
    ON foreclosure_records (sale_date DESC);
CREATE INDEX IF NOT EXISTS idx_foreclosure_records_parcel
    ON foreclosure_records (parcel_number);
CREATE INDEX IF NOT EXISTS idx_foreclosure_records_owner_trgm
    ON foreclosure_records USING gin (owner_name gin_trgm_ops);

-- ───────────── scrape_jobs ─────────────
CREATE TABLE IF NOT EXISTS scrape_jobs (
    id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    county            TEXT NOT NULL,
    state             CHAR(2) NOT NULL,
    record_type       TEXT NOT NULL,
    status            TEXT NOT NULL DEFAULT 'pending'
                          CHECK (status IN ('pending', 'running', 'complete', 'failed')),
    start_date        DATE,
    end_date          DATE,
    page              INTEGER NOT NULL DEFAULT 1,
    records_found    INTEGER NOT NULL DEFAULT 0,
    records_inserted  INTEGER NOT NULL DEFAULT 0,
    records_updated   INTEGER NOT NULL DEFAULT 0,
    error             TEXT,
    bull_job_id       TEXT,
    started_at        TIMESTAMPTZ,
    completed_at      TIMESTAMPTZ,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_scrape_jobs_status_created
    ON scrape_jobs (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_scrape_jobs_county_state_type_created
    ON scrape_jobs (county, state, record_type, created_at DESC);

-- ───────────── county_configs ─────────────
CREATE TABLE IF NOT EXISTS county_configs (
    id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    county            TEXT NOT NULL,
    state             CHAR(2) NOT NULL,
    adapter_name      TEXT NOT NULL,
    base_url          TEXT NOT NULL,
    record_types      TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    cron_schedule     TEXT NOT NULL DEFAULT '0 6 * * *',
    rate_limit_ms     INTEGER NOT NULL DEFAULT 2000,
    enabled           BOOLEAN NOT NULL DEFAULT TRUE,
    config_json       JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT county_configs_dedup UNIQUE (county, state, adapter_name)
);

CREATE INDEX IF NOT EXISTS idx_county_configs_enabled
    ON county_configs (enabled);

-- Seed the three Phase-2/4 targets. Disabled by default — flip on after the
-- adapter is verified end-to-end via scripts/test-adapter.ts.
INSERT INTO county_configs (county, state, adapter_name, base_url, record_types, cron_schedule, rate_limit_ms, enabled, config_json)
VALUES
    ('Maricopa', 'AZ', 'maricopa-az',
     'https://recorder.maricopa.gov',
     ARRAY['NOD', 'NTS'],
     '0 6 * * *',
     2000,
     FALSE,
     '{}'::jsonb),
    ('Clark', 'NV', 'clark-nv',
     'https://www.clarkcountynv.gov/government/departments/recorder',
     ARRAY['NOD', 'NTS'],
     '15 6 * * *',
     2000,
     FALSE,
     '{}'::jsonb),
    ('Cook', 'IL', 'cook-il',
     'https://www.cookcountyclerkofcourt.org',
     ARRAY['LP'],
     '30 6 * * *',
     3000,
     FALSE,
     '{"rendering": "dynamic"}'::jsonb)
ON CONFLICT (county, state, adapter_name) DO NOTHING;

-- ───────────── Grants ─────────────
-- Prod connects as the `aiwholesail` role; staging connects as
-- `aiwholesail_staging`. Migration runs as postgres superuser. Grant to
-- whichever roles exist on this box — same SQL works in both environments.
DO $$
DECLARE
  role_name TEXT;
BEGIN
  FOREACH role_name IN ARRAY ARRAY['aiwholesail', 'aiwholesail_staging'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = role_name) THEN
      EXECUTE format(
        'GRANT SELECT, INSERT, UPDATE, DELETE ON foreclosure_records, scrape_jobs, county_configs TO %I',
        role_name
      );
    END IF;
  END LOOP;
END$$;
