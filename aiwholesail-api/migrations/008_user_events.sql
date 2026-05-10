-- Migration: User events table
--
-- Purpose: lightweight activation-tracking event stream. Today, activity
-- signals are scattered across rate_limits (rate-limiting buckets),
-- favorites, property_alerts, contracts, and skip_trace_lookups. That
-- works for retroactive analysis but doesn't give us a clean,
-- purpose-built feed of "what did this user do" for activation scoring,
-- the founder-hot-list worker, or future product-led-growth metrics.
--
-- This is NOT a replacement for analytics-tool events (GA4 / Meta).
-- Those are for marketing attribution. user_events is for operator-side
-- activation, scoring, and onboarding decisions — server-side, in our DB,
-- queryable joined with users / subscribers / lifecycle emails.

CREATE TABLE IF NOT EXISTS user_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    -- Event vocabulary lives in lib/events.js (single source of truth)
    event_type VARCHAR(64) NOT NULL,
    -- Free-form props (location, property_id, tier, score, etc.) — keep
    -- this lean, don't dump full request bodies here
    properties JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Hot-path: "what did this user do recently" — most common query for
-- the founder-hot-list and per-user activation timeline.
CREATE INDEX IF NOT EXISTS idx_user_events_user_time
    ON user_events(user_id, created_at DESC);

-- Cross-cohort: "how many users did event X in the last 24h" — for
-- daily activation analyses.
CREATE INDEX IF NOT EXISTS idx_user_events_type_time
    ON user_events(event_type, created_at DESC);

-- Lessons-learned from PR #131: migrations are run as the postgres
-- superuser, but the API connects as `aiwholesail`. Without an
-- explicit GRANT, every read/write fails with "permission denied".
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'aiwholesail') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON user_events TO aiwholesail;
  END IF;
END$$;
