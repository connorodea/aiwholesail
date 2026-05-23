-- Migration: 029 — email_captures
--
-- Backs POST /api/email-capture — the public lead-capture endpoint that
-- replaces PR #332's missing backend route. The exit-intent modal on
-- /guides/finding-motivated-sellers (and future lead magnets) POSTs
-- here to capture the email AND trigger Resend delivery of the promised
-- lead magnet PDF/checklist.
--
-- Unique constraint on (email, slug) gives us idempotency: a buggy or
-- abusive client submitting the same address twice won't trigger a
-- second delivery or cost us a second Resend send. ON CONFLICT DO
-- NOTHING returns rowCount=0 to the route handler, which then skips
-- the email-send (still 200 OK to the caller — no scary "duplicate"
-- message to a user just hitting submit twice).
--
-- Per `feedback_migration_grants.md`: every new table needs explicit
-- GRANTs to the `aiwholesail` role OR every INSERT silently 500s with
-- "permission denied" (PR #131 incident).

CREATE TABLE IF NOT EXISTS email_captures (
  id BIGSERIAL PRIMARY KEY,
  email VARCHAR(255) NOT NULL,
  -- Lead magnet slug. e.g. 'finding-motivated-sellers'. Matches the
  -- LEAD_MAGNETS allowlist in routes/emailCapture.js — adding a new
  -- magnet requires a code change there, not a DB schema change here.
  slug VARCHAR(100) NOT NULL,
  -- Light captured context for future de-bounce / analytics work.
  source_ip VARCHAR(64),
  user_agent VARCHAR(500),
  referrer VARCHAR(500),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Idempotency key: same email + same magnet = no double-send.
  CONSTRAINT email_captures_email_slug_key UNIQUE (email, slug)
);

-- Hot-path: "has this email already grabbed this magnet?" — answered
-- via the unique-constraint scan on insert. No additional index needed.

-- Cross-cohort analytics: "magnet conversion over time"
CREATE INDEX IF NOT EXISTS idx_email_captures_slug_created
  ON email_captures (slug, created_at DESC);

-- Operator panel: "what did this user grab?"
CREATE INDEX IF NOT EXISTS idx_email_captures_email
  ON email_captures (email);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'aiwholesail') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON email_captures TO aiwholesail;
    GRANT USAGE, SELECT ON SEQUENCE email_captures_id_seq TO aiwholesail;
  END IF;
END$$;
