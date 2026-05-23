-- Migration 037 — RevenueCat webhook idempotency dedup table.
--
-- Why this exists
-- ---------------
-- RC retries non-2xx webhooks aggressively. Without per-event dedup, a
-- retry can re-process a stale CANCELLATION/PURCHASE/etc. after state has
-- moved on — flipping `subscribed` back, double-counting analytics,
-- re-firing downstream notifications.
--
-- The handler does an INSERT-OR-CONFLICT against this table BEFORE any
-- state mutation. New event → INSERT succeeds (rowCount=1) → handler
-- proceeds. RC retry → INSERT conflicts (rowCount=0) → handler returns
-- 200 noop.
--
-- Retention: rows kept indefinitely. event.id is small (UUID-ish string)
-- and RC volume is low enough that this table stays well under 1M rows
-- in any realistic timeframe. Reviewer fix 2026-05-23.

CREATE TABLE IF NOT EXISTS revenuecat_processed_events (
  event_id VARCHAR(255) PRIMARY KEY,
  processed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON revenuecat_processed_events TO aiwholesail;
