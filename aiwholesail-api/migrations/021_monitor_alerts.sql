-- Migration: 021 — monitor_alerts
--
-- Tracks fired alerts from the off-market routing monitor (and any future
-- cron-based SLI checks). Two reasons this table exists rather than just
-- emitting Resend emails:
--
--   1. Cooldown enforcement. Without a record of the last fire-time per SLI
--      we'd risk a tight retry loop emailing the operator every 5 min for
--      hours during a sustained incident. Cooldown is read from this table.
--   2. Exec-dashboard panel. "Last 24h monitor alerts" is the at-a-glance
--      health signal — the user-reported off-market regression on 2026-05-13
--      would have stood out as a row in this table within ~10 min of deploy.
--
-- Insert pattern (offmarket-routing-monitor.js):
--   INSERT INTO monitor_alerts(sli, value, details_json, fired_at)
--   VALUES ($1, $2, $3, NOW());
--
-- Per PR #131: GRANT to the `aiwholesail` role on table + sequence, or the
-- API connects-as-aiwholesail and silently 500s on INSERT.

CREATE TABLE IF NOT EXISTS monitor_alerts (
  id BIGSERIAL PRIMARY KEY,
  -- Short SLI identifier, e.g. 'offmarket-feed-ratio' | 'offmarket-empty-rate'.
  -- Kept open-ended so future cron monitors can reuse this table.
  sli VARCHAR(60) NOT NULL,
  -- The metric value that triggered (ratio, %, count). Numeric for sorting.
  value NUMERIC(12, 4),
  -- Free-form context — the bash one-liner output, log excerpts, sample
  -- request_ids. Keep small (<2KB) so the table stays cheap to scan.
  details_json JSONB,
  -- Severity tier, mostly for dashboard color-coding.
  severity VARCHAR(10) NOT NULL DEFAULT 'red' CHECK (severity IN ('red', 'yellow', 'green')),
  fired_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Hot-path: "did this SLI fire within the cooldown window?" — one row per
-- check, every 5 min, so the index on (sli, fired_at DESC) keeps the
-- cooldown lookup at ~1ms.
CREATE INDEX IF NOT EXISTS idx_monitor_alerts_sli_fired
  ON monitor_alerts (sli, fired_at DESC);

-- For the exec-dashboard "last 24h" panel.
CREATE INDEX IF NOT EXISTS idx_monitor_alerts_fired_at
  ON monitor_alerts (fired_at DESC);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'aiwholesail') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON monitor_alerts TO aiwholesail;
    GRANT USAGE, SELECT ON SEQUENCE monitor_alerts_id_seq TO aiwholesail;
  END IF;
END$$;
