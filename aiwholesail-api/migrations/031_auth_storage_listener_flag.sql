-- Migration: feature flag for the cross-tab auth-storage listener (PR #415 follow-up).
--
-- Default OFF for everyone — the listener registers at module load (HMR-safe,
-- idempotent) but its callback short-circuits via `isAuthStorageListenerEnabled`
-- until the flag is flipped on. cpodea5 gets a per-user override so connor can
-- validate cross-tab signout / ITP-eviction behavior on prod before ramping.
--
-- Rollout plan:
--   1. This migration ships with flag default OFF for all users. Visible
--      behavior is unchanged vs. pre-#415 — the previous mount-time
--      `getCoherentUser` self-heal continues to handle the common case.
--   2. cpodea5 dogfoods cross-tab signout + DevTools clear + iOS Safari ITP
--      eviction scenarios under his account.
--   3. To release: UPDATE feature_flag_globals SET enabled=TRUE,
--      rollout_pct=100 WHERE slug='auth-storage-listener'. Roll out
--      gradually (10 → 50 → 100) over a few hours, watching the auth-error
--      rate via the not_authenticated_toast_shown PostHog event (P1.1).
--      Rollback in <60s by flipping back to FALSE (matches the
--      useFeatureFlag cache TTL on the client).
--
-- Kill switch: UPDATE feature_flag_globals SET enabled=FALSE WHERE
--   slug='auth-storage-listener' — instant, no deploy.
--
-- Tables feature_flag_globals + feature_flag_users come from migration 011.
-- Same pattern as 026_organic_loaders_flag.sql, 027_batchdata_offmarket_flag.sql.

INSERT INTO feature_flag_globals (slug, enabled, rollout_pct, description)
VALUES
  ('auth-storage-listener',
   FALSE,
   0,
   'Cross-tab auth-coherence listener (PR #415). When ON, a window storage event listener clears local auth state + redirects to /auth when an auth-critical localStorage key is removed in another tab. When OFF, only the PR #376 mount-time self-heal runs — covering most cases but not parallel-tab signout, iOS ITP eviction, or mid-session DevTools clears.')
ON CONFLICT (slug) DO NOTHING;

-- Per-user dogfood override. Sub-select resolves to zero rows in environments
-- without the user (local dev), so this stays portable. On prod it flips the
-- flag ON for cpodea5 only; everyone else keeps the pre-#415 behavior.
INSERT INTO feature_flag_users (user_id, slug, enabled, reason)
SELECT u.id, 'auth-storage-listener', TRUE, 'staff-dogfood'
FROM users u
WHERE u.email = 'cpodea5@gmail.com'
ON CONFLICT (user_id, slug) DO UPDATE
  SET enabled = EXCLUDED.enabled,
      reason  = EXCLUDED.reason;
