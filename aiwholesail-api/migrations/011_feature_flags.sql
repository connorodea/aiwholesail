-- Migration: Feature flag system
--
-- Purpose: enable trunk-based development with dark launches. Code ships
-- to main behind a flag (default OFF) and gets toggled on per-user or
-- globally — no redeploy needed to enable, disable, or roll back a feature.
--
-- Resolution order (highest precedence first):
--   1. Per-user flag in feature_flag_users — if a row exists for (user, slug),
--      its `enabled` value wins. Use this for staff dogfooding ("turn this
--      on for connor first") and for individual bug-report A/B tracking.
--   2. Global flag in feature_flag_globals — if no per-user row but a row
--      exists for the slug with rollout_pct = 100, everyone gets it.
--      0 < rollout_pct < 100 means deterministic sample via hash(user_id, slug).
--   3. Default: OFF. Unknown slugs are always false.
--
-- A frontend hook (useFeatureFlag) and a backend middleware (requireFlag)
-- live in subsequent commits. This migration is just the schema.
--
-- The flags are deliberately small and table-driven, not a third-party
-- service. We can swap to LaunchDarkly later if scale demands it.

CREATE TABLE IF NOT EXISTS feature_flag_globals (
    slug VARCHAR(80) PRIMARY KEY,
    -- Master kill switch. Even if rollout_pct > 0, a flag with enabled=false
    -- evaluates as false for everyone except per-user overrides.
    enabled BOOLEAN NOT NULL DEFAULT FALSE,
    -- 0 to 100. Used when no per-user row exists. Bucket: hash(user_id || slug) % 100.
    rollout_pct INTEGER NOT NULL DEFAULT 0 CHECK (rollout_pct BETWEEN 0 AND 100),
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS feature_flag_users (
    user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    slug VARCHAR(80) NOT NULL,
    enabled BOOLEAN NOT NULL,
    -- Optional cohort tag — who/what set this override (e.g. 'staff', 'beta',
    -- 'bug-repro-#172'). Pure metadata; not used by resolution logic.
    reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (user_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_feature_flag_users_slug ON feature_flag_users (slug);

-- The aiwholesail role needs CRUD on these tables, otherwise the live API
-- 500s with "permission denied" (lesson from PR #131 migration bug). Grant
-- block lives at the bottom of every migration that creates new tables.
GRANT SELECT, INSERT, UPDATE, DELETE ON feature_flag_globals TO aiwholesail;
GRANT SELECT, INSERT, UPDATE, DELETE ON feature_flag_users TO aiwholesail;
