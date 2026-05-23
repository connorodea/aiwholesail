-- Migration: feature flag for the recent-searches chip UI (PR #428 follow-up).
--
-- PR #428 shipped the chip UI un-flagged. Reviewer asked for the standard
-- flag-first rollout. This migration inserts the row so the kill switch
-- shipped in this same PR can be flipped at the DB level without a redeploy.
--
-- Without the row, getFlagFromCache('recent-searches-chips') returns undefined,
-- isRecentSearchesChipsEnabled() returns false, and the React layer in
-- PropertySearch.tsx / AbsenteeOwnerSearch.tsx skips rendering <SearchHistory>.
-- Storage still records searches (so toggling the flag on later reveals a
-- backlog of recent chips immediately — acceptable; not PII).
--
-- Rollout plan:
--   1. Migration ships with flag default OFF — visible behavior is unchanged
--      vs. pre-#428 (no chip strip).
--   2. cpodea5 dogfoods on /app/search + /app/absentee-owners.
--   3. UPDATE feature_flag_globals SET enabled=TRUE, rollout_pct=100
--      WHERE slug='recent-searches-chips'. Ramp 10 → 50 → 100.
--
-- Kill switch: UPDATE feature_flag_globals SET enabled=FALSE WHERE
--   slug='recent-searches-chips' — instant, no deploy.
--
-- Same pattern as 031_auth_storage_listener_flag.sql,
-- 032_brand_bold_flag.sql.

INSERT INTO feature_flag_globals (slug, enabled, rollout_pct, description)
VALUES
  ('recent-searches-chips',
   FALSE,
   0,
   'Recent-searches chip UI (PR #428). When ON, on-market and off-market search surfaces show a chip strip of the last 4 searches above the form; tapping a chip replays that search. When OFF, the chip strip is not rendered. Storage continues to record either way — so flipping ON reveals an immediate backlog.')
ON CONFLICT (slug) DO NOTHING;

INSERT INTO feature_flag_users (user_id, slug, enabled, reason)
SELECT u.id, 'recent-searches-chips', TRUE, 'staff-dogfood'
FROM users u
WHERE u.email = 'cpodea5@gmail.com'
ON CONFLICT (user_id, slug) DO UPDATE
  SET enabled = EXCLUDED.enabled,
      reason  = EXCLUDED.reason;
