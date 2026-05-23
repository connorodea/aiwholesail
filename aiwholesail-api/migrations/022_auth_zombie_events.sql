-- Migration: 022 — auth_zombie_events
--
-- Append-only event log that records every request arriving with a
-- well-formed JWT that VERIFIES successfully but whose `userId` claim does
-- not match any row in `users`. This is the API-level analogue of the
-- frontend zombie-session pattern (cpodea5 2026-05-14, PR #375/#376):
-- the client believes it's authenticated, the token cryptographically
-- checks out, yet the user behind it no longer exists.
--
-- SLO_SPEC.md P1 step 3 calls for "API middleware that increments a
-- counter when JWT is well-formed but doesn't match a `users` row." This
-- table is that counter, with per-event detail so an on-call can pivot
-- from "spike on the dashboard" to "which user_ids, IPs, and paths are
-- involved" without grepping logs.
--
-- The helper that writes here (lib/observability/authMetrics.js) does the
-- insert with setImmediate so metric writes NEVER block the 401 response.
-- Metric loss on a DB blip is acceptable; user-facing latency or 500s
-- from a metric write are not. (Same fire-and-forget pattern as
-- scrape_provider_metrics — migration 020.)
--
-- Privacy: we DO NOT store the JWT itself or any of its other claims.
-- Just the userId claim that didn't resolve, plus request-shape metadata
-- (IP, UA, path) that's already in the access log anyway.
--
-- Lessons-learned from PR #131: migrations run as the postgres superuser,
-- but the API connects as `aiwholesail`. Without an explicit GRANT, every
-- read/write fails with "permission denied". Both the table AND its
-- sequence need to be granted, otherwise INSERTs fail on nextval().

CREATE TABLE IF NOT EXISTS auth_zombie_events (
  id BIGSERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- The userId claim from the verified JWT that didn't match any users row.
  -- TEXT (not UUID) because a malformed claim shouldn't blow up the insert —
  -- the whole point is to capture weird states, not reject them.
  jwt_user_id TEXT,
  -- Originating client IP (best-effort from X-Forwarded-For / req.ip).
  client_ip INET,
  -- User-Agent header (truncated by the helper before insert).
  user_agent TEXT,
  -- The route that fired (req.originalUrl / req.path).
  request_path TEXT
);

-- Hot-path: "show me zombie events in the last N minutes" for the alert
-- and incident-triage queries.
CREATE INDEX IF NOT EXISTS idx_auth_zombie_events_created_at
  ON auth_zombie_events (created_at DESC);

-- Per-user pivot: "is one specific stale user_id flooding us, or is this
-- broad?" — answers the "narrow vs broad" branch in the zombie-session
-- runbook.
CREATE INDEX IF NOT EXISTS idx_auth_zombie_events_user_id
  ON auth_zombie_events (jwt_user_id, created_at DESC);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'aiwholesail') THEN
    GRANT SELECT, INSERT ON auth_zombie_events TO aiwholesail;
    GRANT USAGE, SELECT ON SEQUENCE auth_zombie_events_id_seq TO aiwholesail;
  END IF;
END$$;
