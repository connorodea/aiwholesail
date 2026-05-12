-- Marketing attribution columns.
--
-- Captures the UTM/click-ID payload from the user's first landing so we
-- can tag every Stripe customer + subscription with the ad set that
-- drove the trial. Without this, every paid conversion is anonymous from
-- a marketing-source perspective and Meta has no signal to optimise
-- against beyond "trial started".
--
-- First-touch attribution: frontend captures these on the very first
-- visit (cookie + localStorage) and re-sends them at signup. They are
-- written once on user creation and never overwritten.
--
-- All columns are nullable — existing rows + signups without UTM params
-- (organic, direct, refer-a-friend) keep working unchanged.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS utm_source        VARCHAR(128),
  ADD COLUMN IF NOT EXISTS utm_medium        VARCHAR(128),
  ADD COLUMN IF NOT EXISTS utm_campaign      VARCHAR(255),
  ADD COLUMN IF NOT EXISTS utm_content       VARCHAR(255),
  ADD COLUMN IF NOT EXISTS utm_term          VARCHAR(255),
  ADD COLUMN IF NOT EXISTS fbclid            VARCHAR(512),
  ADD COLUMN IF NOT EXISTS gclid             VARCHAR(512),
  ADD COLUMN IF NOT EXISTS landing_url       TEXT,
  ADD COLUMN IF NOT EXISTS referrer          TEXT,
  ADD COLUMN IF NOT EXISTS first_visit_at    TIMESTAMP WITH TIME ZONE;

-- Common ad-set queries: "how many trials did campaign X drive?"
CREATE INDEX IF NOT EXISTS idx_users_utm_campaign ON users (utm_campaign) WHERE utm_campaign IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_utm_content  ON users (utm_content)  WHERE utm_content  IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_fbclid       ON users (fbclid)       WHERE fbclid       IS NOT NULL;

-- Production-table GRANTs are required — without them the live API role
-- silently 500s with "permission denied for table users" on the next
-- write. Real bug from PR #131 era; see memory/feedback_migration_grants.md.
GRANT SELECT, INSERT, UPDATE ON TABLE users TO aiwholesail;
