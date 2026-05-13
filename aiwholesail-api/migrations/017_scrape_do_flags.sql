-- Migration: seed feature flags for the self-hosted scrape.do path.
--
-- Two flags, both default OFF (enabled=false, rollout_pct=0). The code in
-- lib/agent/zillowProxy.js and routes/skipTrace.js only activates when these
-- evaluate true for the calling user. With both rows at enabled=false the
-- system behaves identically to before this PR — RapidAPI continues to serve
-- every Zillow + skip-trace request.
--
-- Dogfooding plan:
--   1. This migration also inserts a feature_flag_users override for
--      cpodea5@gmail.com so connor can use both backends on prod immediately.
--   2. Run shadow comparisons (same address, both backends) on cpodea5's
--      account for ~24h. Track block rate + payload diff.
--   3. If clean, flip enabled=true + rollout_pct=100 in this table to
--      promote globally. Rollback = set enabled=false; takes < 60s
--      (featureFlags.js cache TTL) for every server to pick up.
--
-- This is the flag-first deployment workflow from the standing memory record.
-- Tables: feature_flag_globals / feature_flag_users already exist (migration 011).

INSERT INTO feature_flag_globals (slug, enabled, rollout_pct, description)
VALUES
  ('zillow_scrape_do',
   FALSE,
   0,
   'Route supported Zillow proxy actions (propertyDetails, photos) through scrape.do instead of the paid RapidAPI zillow-working-api. Falls back to RapidAPI on any scrape.do error.'),
  ('skip_trace_tps',
   FALSE,
   0,
   'Route skip-trace byaddress + bynameaddress searches through TruePeopleSearch via scrape.do, before falling back to the paid RapidAPI skip-tracing-working-api.')
ON CONFLICT (slug) DO NOTHING;

-- Per-user dogfood override for cpodea5@gmail.com. The sub-select resolves
-- to zero rows in environments that don't have that user (local dev), so
-- the migration stays portable. If the user exists, both flags flip ON
-- for that account only — the global rows stay default-OFF so all other
-- users (the 125 paying customers) keep hitting the existing RapidAPI path.
INSERT INTO feature_flag_users (user_id, slug, enabled, reason)
SELECT u.id, f.slug, TRUE, 'staff-dogfood'
FROM users u
CROSS JOIN (VALUES
  ('zillow_scrape_do'),
  ('skip_trace_tps')
) AS f(slug)
WHERE u.email = 'cpodea5@gmail.com'
ON CONFLICT (user_id, slug) DO UPDATE
  SET enabled = EXCLUDED.enabled,
      reason  = EXCLUDED.reason;
