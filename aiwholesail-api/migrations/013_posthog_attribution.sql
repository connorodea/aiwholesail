-- Migration: PostHog attribution columns + analytics audit table
--
-- Spec ref: phase 2 of /Users/connorodea/Downloads/posthog-analytics-spec.json
--
-- The bulk of UTM capture already shipped in migration 012:
--   utm_source, utm_medium, utm_campaign, utm_content, utm_term,
--   fbclid, gclid, landing_url, referrer, first_visit_at
--
-- This migration adds the missing fields PostHog wants for full first-touch
-- attribution + ties anonymous PostHog distinct_ids to identified users:
--   - fbp / fbc  : Meta Pixel first-party IDs (read from _fbp / _fbc cookies)
--   - posthog_distinct_id : anonymous PostHog session id captured at signup,
--                           used for posthog.alias() so pre-signup session
--                           recordings link to the identified user
--   - attribution_captured_at : audit timestamp for the first-touch write

ALTER TABLE users ADD COLUMN IF NOT EXISTS fbp VARCHAR(512);
ALTER TABLE users ADD COLUMN IF NOT EXISTS fbc VARCHAR(512);
ALTER TABLE users ADD COLUMN IF NOT EXISTS posthog_distinct_id VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS attribution_captured_at TIMESTAMPTZ;

-- analytics_events — local audit log of every server-emitted analytics event.
-- Mirrors what we send to PostHog so we have a queryable record without
-- depending on PostHog's API. Kept lean; PostHog is the analysis surface.
CREATE TABLE IF NOT EXISTS analytics_events (
    id           BIGSERIAL PRIMARY KEY,
    user_id      UUID REFERENCES users(id) ON DELETE SET NULL,
    distinct_id  VARCHAR(255),
    event_name   VARCHAR(255) NOT NULL,
    properties   JSONB,
    source       VARCHAR(32) NOT NULL DEFAULT 'backend', -- backend | webhook | cron
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_analytics_events_user_id ON analytics_events (user_id);
CREATE INDEX IF NOT EXISTS idx_analytics_events_event_name ON analytics_events (event_name);
CREATE INDEX IF NOT EXISTS idx_analytics_events_created_at ON analytics_events (created_at DESC);

-- Per the GRANT rule from PR #131 — without these grants the live API
-- 500s with "permission denied" on writes.
GRANT SELECT, INSERT, UPDATE, DELETE ON analytics_events TO aiwholesail;
GRANT USAGE, SELECT ON SEQUENCE analytics_events_id_seq TO aiwholesail;
