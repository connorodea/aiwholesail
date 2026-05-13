-- Migration: feature flag for the organic SVG loader set (PR #342).
--
-- Default OFF for all 125+ paying customers — the app keeps showing the
-- existing Loader2 / bespoke house-icon spinners while we dogfood. cpodea5
-- gets a per-user override so connor sees the new loaders on prod
-- immediately for evaluation.
--
-- Rollout plan:
--   1. This migration ships with flag default OFF. UI is unchanged for all
--      users except the cpodea5 dogfood account.
--   2. cpodea5 validates animations + perceived performance on prod for
--      a few days.
--   3. To release: UPDATE feature_flag_globals SET enabled=TRUE,
--      rollout_pct=100 WHERE slug='organic_loaders'.
--      Rollback in <60s by flipping back to FALSE (matches the
--      useFeatureFlag cache TTL on the client).
--
-- Tables feature_flag_globals + feature_flag_users come from migration 011.
-- Same pattern as 017_scrape_do_flags.sql.

INSERT INTO feature_flag_globals (slug, enabled, rollout_pct, description)
VALUES
  ('organic_loaders',
   FALSE,
   0,
   'Render the 32-loader organic SVG set (PR #342) in Suspense, auth, and property-search loading states. When OFF, the app falls back to the existing Loader2 / bespoke house-icon spinners — visually identical to pre-PR behavior.')
ON CONFLICT (slug) DO NOTHING;

-- Per-user dogfood override. Sub-select resolves to zero rows in environments
-- without the user (local dev), so this stays portable. On prod it flips the
-- flag ON for cpodea5 only; everyone else keeps the legacy spinners.
INSERT INTO feature_flag_users (user_id, slug, enabled, reason)
SELECT u.id, 'organic_loaders', TRUE, 'staff-dogfood'
FROM users u
WHERE u.email = 'cpodea5@gmail.com'
ON CONFLICT (user_id, slug) DO UPDATE
  SET enabled = EXCLUDED.enabled,
      reason  = EXCLUDED.reason;
