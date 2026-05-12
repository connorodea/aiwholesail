-- Migration: 014 — index on property_search_cache(zpid) for email deep-link path
--
-- The /api/property/by-zpid endpoint (added 2026-05-12) resolves email
-- spread-alert deep-links by querying property_search_cache WHERE zpid = $1.
-- The existing composite UNIQUE(location, zpid) only helps when location is
-- also in the predicate; for a bare zpid lookup the planner falls back to a
-- sequential scan. At today's scale (~14 alert subscribers, low-thousands of
-- rows) that's milliseconds, but the email click-through is on the funnel
-- hot path — index it now while the table is still small enough that
-- CREATE INDEX completes instantly.
--
-- Idempotent. No GRANT block — no new tables.

CREATE INDEX IF NOT EXISTS idx_property_search_cache_zpid
  ON property_search_cache(zpid);
