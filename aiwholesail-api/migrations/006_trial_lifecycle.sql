-- Migration: Trial lifecycle email tracking
-- Drives the trial-lifecycle-worker which sends day -1, day 0, day +1, day +7 emails

-- Dedup table: ensures we never send the same trial-lifecycle email twice to the same user
CREATE TABLE IF NOT EXISTS trial_lifecycle_emails_sent (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    email_type VARCHAR(50) NOT NULL,
    sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    resend_id VARCHAR(255),
    opened_at TIMESTAMP WITH TIME ZONE,
    clicked_at TIMESTAMP WITH TIME ZONE,
    UNIQUE(user_id, email_type)
);

CREATE INDEX IF NOT EXISTS idx_trial_lifecycle_emails_sent_user
    ON trial_lifecycle_emails_sent(user_id);

CREATE INDEX IF NOT EXISTS idx_trial_lifecycle_emails_sent_email_type
    ON trial_lifecycle_emails_sent(email_type);

CREATE INDEX IF NOT EXISTS idx_trial_lifecycle_emails_sent_sent_at
    ON trial_lifecycle_emails_sent(sent_at);

-- Optional: a job-runs table for the worker, mirroring alert_job_runs pattern
CREATE TABLE IF NOT EXISTS trial_lifecycle_job_runs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    status VARCHAR(50) DEFAULT 'running',
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    candidates_evaluated INTEGER DEFAULT 0,
    emails_sent INTEGER DEFAULT 0,
    errors TEXT[],
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
