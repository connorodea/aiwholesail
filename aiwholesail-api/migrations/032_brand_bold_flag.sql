-- Migration: feature flag for the global brand-bold typography (PR #413 follow-up).
--
-- Default OFF for everyone — without the row, getFlagFromCache('brand-bold')
-- returns undefined, isBrandBoldEnabled() returns false, and
-- applyBrandBoldAttribute removes (or never adds) data-brand-bold on
-- document.documentElement. The CSS rules in src/index.css are scoped under
-- `html[data-brand-bold="true"]`, so when the attribute is absent the site
-- renders at the pre-#413 typography (default body weight, default heading
-- weight). cpodea5 gets a per-user override to dogfood the new bold weights
-- before global rollout.
--
-- Rollout plan:
--   1. This migration ships with the flag default OFF for all users. Visible
--      behavior is unchanged vs. pre-#413 — the bold weights revert until
--      cpodea5 (and then a percentage of users) get the override.
--   2. cpodea5 eyeballs /, /pricing, /app, /blog/[slug], /glossary under his
--      account. Long-form prose pages (BlogPost, glossary) are the
--      legibility-regression risk flagged in the #413 review.
--   3. To release: UPDATE feature_flag_globals SET enabled=TRUE,
--      rollout_pct=100 WHERE slug='brand-bold'. Ramp 10 → 50 → 100 over a
--      few hours. The change is purely cosmetic so blast radius is bounded
--      — a quick flip back to FALSE reverts everyone within the
--      useFeatureFlag cache TTL (<60s on the client).
--
-- Kill switch: UPDATE feature_flag_globals SET enabled=FALSE WHERE
--   slug='brand-bold' — instant, no deploy. Page reload reverts the user.
--
-- Tables feature_flag_globals + feature_flag_users come from migration 011.
-- Same pattern as 031_auth_storage_listener_flag.sql,
-- 027_batchdata_offmarket_flag.sql, 026_organic_loaders_flag.sql.

INSERT INTO feature_flag_globals (slug, enabled, rollout_pct, description)
VALUES
  ('brand-bold',
   FALSE,
   0,
   'Global brand-bold typography (PR #413). When ON, document.documentElement gets data-brand-bold="true" and the scoped CSS rules in src/index.css apply font-bold (700) to body and font-extrabold (800) to h1-h6. When OFF, the attribute is absent and the site renders at pre-#413 weights (default body, default heading).')
ON CONFLICT (slug) DO NOTHING;

-- Per-user dogfood override. Sub-select resolves to zero rows in environments
-- without the user (local dev), so this stays portable. On prod it flips the
-- flag ON for cpodea5 only; everyone else keeps the pre-#413 weights.
INSERT INTO feature_flag_users (user_id, slug, enabled, reason)
SELECT u.id, 'brand-bold', TRUE, 'staff-dogfood'
FROM users u
WHERE u.email = 'cpodea5@gmail.com'
ON CONFLICT (user_id, slug) DO UPDATE
  SET enabled = EXCLUDED.enabled,
      reason  = EXCLUDED.reason;
