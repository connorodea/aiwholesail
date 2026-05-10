-- Migration: Webhooks for property alerts (Pro/Elite feature)
--
-- Lets users subscribe their app / CRM / workflow tool to property and
-- owner-related events. Phase 1 surfaces a single event type
-- (property_alert_match) wired into the existing spread-alert-worker.
-- Future events (price_change, status_change, owner_update) flow into
-- the same tables.
--
-- Security:
--   - Each endpoint gets a unique HMAC secret signed into every payload.
--   - Subscribers verify via X-AIWholesail-Signature header.
--   - URL must be https in prod (enforced at route layer, not here, so
--     local dev can use http).
--
-- Retry policy lives in lib/webhooks.js — table just tracks state.

-- ───────────── Registered webhook endpoints ─────────────
CREATE TABLE IF NOT EXISTS webhook_endpoints (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    url TEXT NOT NULL,
    -- 64-char hex; used for HMAC-SHA256 signing
    secret VARCHAR(64) NOT NULL,
    -- Array of event_type strings the endpoint wants to receive
    events TEXT[] NOT NULL DEFAULT '{}',
    description VARCHAR(120),
    active BOOLEAN DEFAULT true,
    -- Operational health for auto-disable + dashboards
    last_success_at TIMESTAMP WITH TIME ZONE,
    last_failure_at TIMESTAMP WITH TIME ZONE,
    consecutive_failures INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_webhook_endpoints_user
    ON webhook_endpoints(user_id);

-- Partial index for the dispatcher's "who do I send this event to" query
CREATE INDEX IF NOT EXISTS idx_webhook_endpoints_active
    ON webhook_endpoints(user_id, events)
    WHERE active = true;

-- ───────────── Delivery log ─────────────
CREATE TABLE IF NOT EXISTS webhook_deliveries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    endpoint_id UUID REFERENCES webhook_endpoints(id) ON DELETE CASCADE NOT NULL,
    event_type VARCHAR(64) NOT NULL,
    payload JSONB NOT NULL,
    attempt INTEGER DEFAULT 1,
    response_status INTEGER,
    response_body_truncated TEXT,
    duration_ms INTEGER,
    -- pending | success | failed (retryable) | abandoned (gave up)
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    next_retry_at TIMESTAMP WITH TIME ZONE,
    delivered_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_endpoint
    ON webhook_deliveries(endpoint_id, delivered_at DESC);

-- For a future retry worker
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_retry
    ON webhook_deliveries(next_retry_at)
    WHERE status = 'failed';

-- Lessons from PR #131: GRANT or the API role can't see the table.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'aiwholesail') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON webhook_endpoints, webhook_deliveries TO aiwholesail;
  END IF;
END$$;
