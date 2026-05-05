-- Migration 006: Notification preferences
-- Captures the prod DB schema for notification_preferences which was created
-- out-of-band (no migration file existed at deploy time). Reconciles git as
-- the source of truth as part of Phase 2 production-readiness work.
--
-- Schema captured from prod via `pg_dump --schema-only -t notification_preferences aiwholesail`
-- on 2026-05-04. Idempotent (uses IF NOT EXISTS) so re-running on prod is safe.

CREATE TABLE IF NOT EXISTS notification_preferences (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    deal_alerts_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    deal_alerts_frequency VARCHAR(20) NOT NULL DEFAULT 'daily',
    favorites_updates_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    favorites_updates_frequency VARCHAR(20) NOT NULL DEFAULT 'daily',
    favorites_update_types VARCHAR(50) NOT NULL DEFAULT 'all',
    price_drops_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    price_drops_frequency VARCHAR(20) NOT NULL DEFAULT 'instant',
    weekly_digest_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    ai_recommendations_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    ai_recommendations_max_price INTEGER,
    ai_recommendations_locations TEXT[],
    comp_sales_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    product_updates_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notif_prefs_user ON notification_preferences(user_id);

DROP TRIGGER IF EXISTS update_notif_prefs_updated_at ON notification_preferences;
CREATE TRIGGER update_notif_prefs_updated_at
    BEFORE UPDATE ON notification_preferences
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
