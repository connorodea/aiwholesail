-- Migration: feature flag for the BatchData off-market vendor swap.
--
-- Default OFF for all users — the existing PropData path keeps serving
-- (which means off-market keeps returning empty, but no behavior change
-- vs today). cpodea5 gets a per-user override so connor can validate
-- BatchData responses on prod immediately.
--
-- Rollout plan:
--   1. Ship code OFF. UI still calls PropData (existing behavior).
--   2. cpodea5 dogfoods BatchData via the override; verifies quicklists
--      return non-empty results, data shape mapping is correct.
--   3. Promote: UPDATE feature_flag_globals SET enabled=TRUE, rollout_pct=100
--      WHERE slug='batchdata_offmarket'. ~60s for clients to pick up.
--   4. Rollback: flip back to FALSE; takes <60s.
--
-- BatchData billing note: each property record returned in a search response
-- counts as a billable API request. Skip-trace is per-record per-call. The
-- proxy's 15-min cache + 30/min search rate limit + 10/min skip-trace
-- rate limit are the cost-guard layers; flipping this flag ON without
-- those in place would expose the account to spending spikes.
--
-- Tables feature_flag_globals + feature_flag_users come from migration 011.
-- Same pattern as 017_scrape_do_flags.sql and 026_organic_loaders_flag.sql.

INSERT INTO feature_flag_globals (slug, enabled, rollout_pct, description)
VALUES
  ('batchdata_offmarket',
   FALSE,
   0,
   'Route off-market property searches (absentee owners, pre-foreclosure, high equity, tax delinquent, vacant, etc.) through BatchData instead of PropData. PropData''s absentee_only filter is broken at the vendor (0/46 records flagged across 5 ZIPs in live testing 2026-05-14). BatchData is purpose-built for wholesaler off-market data with proper quicklists. When OFF, the app keeps calling PropData (existing behavior).')
ON CONFLICT (slug) DO NOTHING;

-- Per-user dogfood override for cpodea5@gmail.com. Sub-select resolves to
-- zero rows in envs without that user (local dev), so the migration stays
-- portable. On prod it flips the flag ON for cpodea5 only.
INSERT INTO feature_flag_users (user_id, slug, enabled, reason)
SELECT u.id, 'batchdata_offmarket', TRUE, 'staff-dogfood'
FROM users u
WHERE u.email = 'cpodea5@gmail.com'
ON CONFLICT (user_id, slug) DO UPDATE
  SET enabled = EXCLUDED.enabled,
      reason  = EXCLUDED.reason;
