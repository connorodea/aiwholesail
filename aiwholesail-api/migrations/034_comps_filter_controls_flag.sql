-- Migration: feature flag for the comp-table filter controls (founder-requested).
--
-- Adds user-controlled filters above the property-comps table:
--   - Distance from subject (≤0.25, 0.5, 1, 2, 5 mi, or any)
--   - Beds (exact, ±1, any)
--   - Baths (exact, ±1, any)
--   - Sqft tolerance band (±10/20/30%, any)
--
-- Filters operate client-side on already-fetched comps so the UI feels
-- instant; the API fetch is unchanged. Default state = all "any", so
-- when the flag is OFF the table renders exactly as it did before.
--
-- Rollout:
--   1. Migration ships default OFF. No visible change for any user.
--   2. cpodea5 validates on a real property under his account
--      (every filter dropdown, reset button, the "X of Y comps" copy).
--   3. UPDATE feature_flag_globals SET enabled=TRUE, rollout_pct=100
--      WHERE slug='comps-filter-controls'.
--
-- Kill switch: UPDATE feature_flag_globals SET enabled=FALSE WHERE
--   slug='comps-filter-controls' — page reload reverts the user to the
--   pre-feature layout instantly.
--
-- Same shape as 031/032/033.

INSERT INTO feature_flag_globals (slug, enabled, rollout_pct, description)
VALUES
  ('comps-filter-controls',
   FALSE,
   0,
   'Comp-table filter UI: distance / beds / baths / sqft tolerance filters above the comparable-sales table on the property modal. When ON, users can narrow the comp set without re-fetching; when OFF, the full set returned by getPropertyComps is rendered as before.')
ON CONFLICT (slug) DO NOTHING;

INSERT INTO feature_flag_users (user_id, slug, enabled, reason)
SELECT u.id, 'comps-filter-controls', TRUE, 'staff-dogfood'
FROM users u
WHERE u.email = 'cpodea5@gmail.com'
ON CONFLICT (user_id, slug) DO UPDATE
  SET enabled = EXCLUDED.enabled,
      reason  = EXCLUDED.reason;
