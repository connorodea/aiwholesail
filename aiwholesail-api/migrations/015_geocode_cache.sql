-- Migration: 015 — geocode_cache table
--
-- Off-market heatmap (Phase 7) needs lat/lng per absentee-owned property,
-- but PropData's /v1/property?absentee_only=true response does NOT include
-- coordinates. We must call /v1/geocode separately for each address, which
-- (a) costs an API call per record and (b) has rate limits.
--
-- This table caches geocode results indefinitely keyed by normalized
-- address. Addresses don't move — a hit avoids both the cost and latency.
--
-- Key design choices:
--  - `address_hash` is sha256(lower(trim(street + city + zip))) — stable
--    across casing/whitespace variation in the source data, prevents
--    duplicates when PropData returns the same parcel with minor formatting
--    differences (e.g. "Saint" vs "St").
--  - lat/lng stored as NUMERIC(9,6) — 6 decimal places = ~11cm precision,
--    plenty for a heatmap and human-scale geo.
--  - source TEXT lets us swap geocoders later (propdata, mapbox-geocoder,
--    nominatim, etc.) without losing existing cache.
--  - geocoded_at lets us re-fetch stale entries if we ever need to (we
--    don't today; addresses are immutable).
--  - NO foreign key to property_search_cache — the absentee path uses
--    parcel_id, not zpid, so the two tables don't align. Standalone cache
--    keyed by address only.

CREATE TABLE IF NOT EXISTS geocode_cache (
    address_hash    CHAR(64) PRIMARY KEY,
    formatted_address TEXT,
    latitude        NUMERIC(9, 6) NOT NULL,
    longitude       NUMERIC(9, 6) NOT NULL,
    source          VARCHAR(50) NOT NULL DEFAULT 'propdata',
    geocoded_at     TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_geocode_cache_geocoded_at
    ON geocode_cache(geocoded_at);

GRANT SELECT, INSERT, UPDATE, DELETE ON geocode_cache TO aiwholesail;
