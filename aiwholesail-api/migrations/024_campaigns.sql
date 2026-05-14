-- Campaign Builder Migration
-- Adds the `campaigns` table (one row per outreach campaign the user defines
-- and launches) and `campaign_targets` (one row per recipient inside a
-- campaign). Launching a campaign fans the audience out across
-- lead_sequences + sequence_executions so the existing
-- sequence-execution-worker (scripts/sequence-execution-worker.js) sends them.
--
-- Why lead_sequences.lead_id is being relaxed to NULL:
--   Migration 003 declared lead_sequences.lead_id as NOT NULL because the
--   sequence subsystem was lead-centric. Campaigns operate on contacts that
--   may NOT have a corresponding leads row (buyers, agents, CSV-imported
--   recipients). Synthesizing a placeholder leads row per contact would
--   pollute the leads table and the user's pipeline counts. The pragmatic
--   choice is to relax the NOT NULL constraint here, so a lead_sequences row
--   can stand alone for campaign-driven sends. The worker JOINs leads via
--   `JOIN leads l ON l.id = ls.lead_id`, which is INNER — a follow-up patch
--   to the worker (handled by the worker owner, not this migration) will
--   switch that JOIN to LEFT and look up recipient details on
--   campaign_targets when lead_id is NULL. This migration documents the
--   contract; it does not modify the worker source.

BEGIN;

-- 1. Relax lead_sequences.lead_id so campaign rows can stand alone.
ALTER TABLE lead_sequences ALTER COLUMN lead_id DROP NOT NULL;

-- 2. campaigns: one row per outreach campaign.
CREATE TABLE IF NOT EXISTS campaigns (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'draft',
        -- draft | scheduled | running | paused | completed | cancelled
    audience_type VARCHAR(20) NOT NULL,
        -- buyers | agents | csv
    audience_filter JSONB DEFAULT '{}'::jsonb,
    audience_count INTEGER NOT NULL DEFAULT 0,
    sequence_template_id UUID REFERENCES sequence_templates(id) ON DELETE SET NULL,
    sender_category VARCHAR(20) NOT NULL DEFAULT 'outreach',
    send_window_start_hour SMALLINT,
    send_window_end_hour SMALLINT,
    send_window_days SMALLINT[],
        -- 0=Sun, 1=Mon, ..., 6=Sat
    daily_cap INTEGER,
    start_at TIMESTAMP WITH TIME ZONE,
    launched_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CHECK (audience_type IN ('buyers', 'agents', 'csv')),
    CHECK (status IN ('draft','scheduled','running','paused','completed','cancelled')),
    CHECK (send_window_start_hour IS NULL OR (send_window_start_hour BETWEEN 0 AND 23)),
    CHECK (send_window_end_hour   IS NULL OR (send_window_end_hour   BETWEEN 0 AND 23))
);

CREATE INDEX IF NOT EXISTS idx_campaigns_user_status_created
    ON campaigns(user_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_campaigns_status_start
    ON campaigns(status, start_at);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger WHERE tgname = 'update_campaigns_updated_at'
    ) THEN
        CREATE TRIGGER update_campaigns_updated_at BEFORE UPDATE ON campaigns
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
END$$;

-- 3. campaign_targets: one row per recipient inside a campaign. Holds the
-- resolved contact info at launch time + a back-link to the lead_sequences
-- row created during fanout.
CREATE TABLE IF NOT EXISTS campaign_targets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    target_type VARCHAR(20) NOT NULL,
        -- buyer | agent | csv_row
    target_id UUID,
        -- buyers.id or agents.id; NULL for csv_row
    target_email VARCHAR(320),
    target_phone VARCHAR(40),
    target_name VARCHAR(255),
    target_variables JSONB DEFAULT '{}'::jsonb,
    lead_sequence_id UUID REFERENCES lead_sequences(id) ON DELETE SET NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
        -- pending | queued | sending | replied | unsubscribed | bounced | failed
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CHECK (target_type IN ('buyer','agent','csv_row')),
    CHECK (status IN ('pending','queued','sending','replied','unsubscribed','bounced','failed'))
);

-- Per-campaign unique-on-email (partial — null emails skipped).
CREATE UNIQUE INDEX IF NOT EXISTS idx_campaign_targets_email_unique
    ON campaign_targets(campaign_id, LOWER(target_email))
    WHERE target_email IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_campaign_targets_campaign_status
    ON campaign_targets(campaign_id, status);
CREATE INDEX IF NOT EXISTS idx_campaign_targets_lead_sequence
    ON campaign_targets(lead_sequence_id);

COMMIT;
