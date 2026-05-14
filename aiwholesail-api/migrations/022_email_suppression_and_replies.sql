-- Email Suppression & Inbound Replies Migration
-- Per-user suppression list, per-send delivery log, and parsed inbound replies

-- Global per-user suppression list
CREATE TABLE IF NOT EXISTS email_suppressions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    email VARCHAR(320) NOT NULL,
    reason VARCHAR(40) NOT NULL,
    source_message_id VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Idempotent unique constraint on (user_id, email)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'email_suppressions_user_id_email_key'
    ) THEN
        ALTER TABLE email_suppressions
            ADD CONSTRAINT email_suppressions_user_id_email_key UNIQUE (user_id, email);
    END IF;
END$$;

CREATE INDEX IF NOT EXISTS idx_email_suppressions_user_email ON email_suppressions(user_id, email);
CREATE INDEX IF NOT EXISTS idx_email_suppressions_created_at ON email_suppressions(created_at DESC);

-- Per-send delivery + engagement log
CREATE TABLE IF NOT EXISTS email_send_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    sequence_execution_id UUID REFERENCES sequence_executions(id) ON DELETE SET NULL,
    lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
    provider VARCHAR(20) NOT NULL DEFAULT 'resend',
    provider_message_id VARCHAR(255) NOT NULL,
    from_address VARCHAR(320) NOT NULL,
    to_address VARCHAR(320) NOT NULL,
    subject TEXT,
    sender_category VARCHAR(20),
    sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    delivered_at TIMESTAMP WITH TIME ZONE,
    opened_at TIMESTAMP WITH TIME ZONE,
    clicked_at TIMESTAMP WITH TIME ZONE,
    replied_at TIMESTAMP WITH TIME ZONE,
    bounced_at TIMESTAMP WITH TIME ZONE,
    complained_at TIMESTAMP WITH TIME ZONE,
    unsubscribed_at TIMESTAMP WITH TIME ZONE,
    failed_at TIMESTAMP WITH TIME ZONE,
    bounce_type VARCHAR(40),
    error_message TEXT
);

-- Idempotent unique constraint on provider_message_id
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'email_send_log_provider_message_id_key'
    ) THEN
        ALTER TABLE email_send_log
            ADD CONSTRAINT email_send_log_provider_message_id_key UNIQUE (provider_message_id);
    END IF;
END$$;

CREATE INDEX IF NOT EXISTS idx_email_send_log_user_sent ON email_send_log(user_id, sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_send_log_sequence_execution ON email_send_log(sequence_execution_id);
CREATE INDEX IF NOT EXISTS idx_email_send_log_to_sent ON email_send_log(to_address, sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_send_log_lead_sent ON email_send_log(lead_id, sent_at DESC);

-- Parsed inbound replies
CREATE TABLE IF NOT EXISTS email_inbound_replies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    email_send_log_id UUID REFERENCES email_send_log(id) ON DELETE SET NULL,
    lead_sequence_id UUID REFERENCES lead_sequences(id) ON DELETE SET NULL,
    from_address VARCHAR(320) NOT NULL,
    to_address VARCHAR(320) NOT NULL,
    subject TEXT,
    message_id VARCHAR(255),
    in_reply_to VARCHAR(255),
    body_text TEXT,
    body_html TEXT,
    parsed_intent VARCHAR(40),
    received_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Idempotent unique constraint on message_id
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'email_inbound_replies_message_id_key'
    ) THEN
        ALTER TABLE email_inbound_replies
            ADD CONSTRAINT email_inbound_replies_message_id_key UNIQUE (message_id);
    END IF;
END$$;

CREATE INDEX IF NOT EXISTS idx_email_inbound_replies_user_received ON email_inbound_replies(user_id, received_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_inbound_replies_lead_sequence ON email_inbound_replies(lead_sequence_id);
CREATE INDEX IF NOT EXISTS idx_email_inbound_replies_intent ON email_inbound_replies(parsed_intent);
