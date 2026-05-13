-- Feature flag: dogfood the new Outreach Campaigns surface for staff only
-- until product gives the green light. Anyone without the flag gets a 404
-- on /api/campaigns and the /app/campaigns route + nav link are hidden.
--
-- Toggle ON for a user later via:
--   INSERT INTO feature_flag_users (user_id, slug, enabled, reason)
--   VALUES ((SELECT id FROM users WHERE email = '<addr>'), 'email-campaigns-v2', TRUE, 'beta')
--   ON CONFLICT (user_id, slug) DO UPDATE SET enabled = TRUE;
-- Toggle ON for everyone later:
--   UPDATE feature_flag_globals SET rollout_pct = 100 WHERE slug = 'email-campaigns-v2';

INSERT INTO feature_flag_globals (slug, enabled, rollout_pct, description)
VALUES (
  'email-campaigns-v2',
  TRUE,
  0,
  'Outreach Campaign Builder (4-step wizard) + bulk fanout API + sequence-execution-worker. Dogfood-only until user approval.'
)
ON CONFLICT (slug) DO NOTHING;

-- Per-user override: enable for cpodea5@gmail.com (Connor's primary Google
-- identity per memory entry). Idempotent — re-running won't duplicate.
INSERT INTO feature_flag_users (user_id, slug, enabled, reason)
SELECT id, 'email-campaigns-v2', TRUE, 'staff dogfood — pre-approval'
FROM users
WHERE LOWER(email) = 'cpodea5@gmail.com'
ON CONFLICT (user_id, slug) DO UPDATE SET enabled = TRUE, reason = EXCLUDED.reason;
